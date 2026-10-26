import { LIKE_TAG_PATTERN, PATHS, POINT_FILE_PATTERN } from "../constants.js";
import { readDelay } from "./config.js";
import { baseName, errorText, fileStem, formatPointNumber } from "../utils/common.js";

// 普通锚点距任务入口约 137 个地图坐标单位；70 可容纳落点误差，同时排除普通锚点。
const POINT12_SHORTCUT_MAX_DISTANCE = 70;
const POINT12_POSITION_RETRIES = 3;

function loadPathData(path) {
    let content;
    try {
        content = file.readTextSync(path);
    } catch (error) {
        throw new Error(`无法读取路径文件 ${path}：${errorText(error)}`);
    }

    let data;
    try {
        data = JSON.parse(content.replace(/^\uFEFF/, ""));
    } catch (error) {
        throw new Error(`路径文件不是有效 JSON：${path}：${errorText(error)}`);
    }

    if (!data || !Array.isArray(data.positions)) {
        throw new Error(`路径文件缺少 positions 数组：${path}`);
    }
    if (data.positions.length === 0) {
        throw new Error(`路径文件 positions 为空：${path}`);
    }

    return data;
}

function validatePathName(path, data) {
    const declaredName = data.info && String(data.info.name || "").trim();
    const expectedName = fileStem(path);
    if (declaredName !== expectedName) {
        throw new Error(`路径文件名与 info.name 不一致：${baseName(path)} / ${declaredName || "未填写"}`);
    }
}

function parseLikeCount(data, point) {
    const tags = data.info && Array.isArray(data.info.tags) ? data.info.tags : [];
    const matchedCounts = [];

    for (const rawTag of tags) {
        const tag = String(rawTag).trim();
        const match = LIKE_TAG_PATTERN.exec(tag);
        if (match) {
            matchedCounts.push(Number(match[1]));
        } else if (/^(?:点赞|likes?)/i.test(tag)) {
            log.warn(`[${point.name}] 无法识别点赞标签“${tag}”，正确格式示例：点赞=6`);
        }
    }

    if (matchedCounts.length > 1) {
        throw new Error(`[${point.name}] 存在多个点赞数量标签，请只保留一个“点赞=总数”标签`);
    }
    if (matchedCounts.length === 0) {
        return null;
    }

    const count = matchedCounts[0];
    if (!Number.isSafeInteger(count) || count < 0 || count > 9999) {
        throw new Error(`[${point.name}] 点赞数量超出允许范围 0～9999`);
    }
    return count;
}

export function discoverPoints() {
    let paths;
    try {
        paths = Array.from(file.readPathSync(PATHS.pointDirectory));
    } catch (error) {
        throw new Error(`无法读取点位目录 ${PATHS.pointDirectory}：${errorText(error)}`);
    }

    const points = [];
    const seenNumbers = {};

    for (const path of paths) {
        if (file.isFolder(path)) {
            continue;
        }

        const match = POINT_FILE_PATTERN.exec(baseName(path));
        if (!match) {
            continue;
        }

        const number = Number(match[1]);
        if (number < 1) {
            continue;
        }

        if (seenNumbers[number]) {
            throw new Error(`Point ${formatPointNumber(number)} 存在重复文件：${seenNumbers[number]} 与 ${path}`);
        }
        seenNumbers[number] = path;

        points.push({
            number,
            name: `Point ${formatPointNumber(number)}`,
            path: String(path).replace(/\\/g, "/"),
            continueFromPrevious: false,
            alternatePathReason: null,
            enabled: true,
            hasFinalOrientation: false,
            requiresRestoreStart: false,
            likeCount: null
        });
    }

    points.sort((a, b) => a.number - b.number);

    if (points.length === 0) {
        throw new Error(`未在 ${PATHS.pointDirectory} 中找到符合命名规范的 Point 路线`);
    }

    return points;
}

function validatePoint09AlternatePath() {
    const data = loadPathData(PATHS.point09FromPoint07);
    validatePathName(PATHS.point09FromPoint07, data);

    const positions = data.positions;
    const firstType = String(positions[0].type || "").toLowerCase();
    const lastType = String(positions[positions.length - 1].type || "").toLowerCase();

    if (firstType === "teleport") {
        throw new Error(`[Point 09] 备用路线不能以 teleport 开始：${PATHS.point09FromPoint07}`);
    }
    if (lastType !== "orientation") {
        throw new Error(`[Point 09] 备用路线必须以 orientation 结束：${PATHS.point09FromPoint07}`);
    }

    const matchMethod = data.info && data.info.map_match_method;
    if (matchMethod && String(matchMethod).toUpperCase() !== "SIFT") {
        log.warn(`[Point 09] 备用路线 map_match_method=${matchMethod}，至冬区域建议使用 SIFT`);
    }

    log.info("[System] Point 09 绕过 Point 08 的备用路线预检通过");
}

export function preflight(points, enabledPointNumbers) {
    const restoreData = loadPathData(PATHS.restore);
    validatePathName(PATHS.restore, restoreData);

    for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const data = loadPathData(point.path);
        validatePathName(point.path, data);

        const positions = data.positions;
        const firstPosition = positions[0];
        const lastPosition = positions[positions.length - 1];
        const firstType = String(firstPosition.type || "").toLowerCase();
        const lastType = String(lastPosition.type || "").toLowerCase();
        const previousPoint = index > 0 ? points[index - 1] : null;

        // 规范化文件名不再使用 _continue；是否接续由路线起点类型和连续编号判断。
        point.continueFromPrevious = firstType !== "teleport" &&
            previousPoint !== null && point.number === previousPoint.number + 1;

        if (point.continueFromPrevious && previousPoint.number + 1 !== point.number) {
            throw new Error(`[${point.name}] 接续路线必须紧跟上一个 Point`);
        }

        point.hasFinalOrientation = lastType === "orientation";
        if (!point.hasFinalOrientation) {
            throw new Error(`[${point.name}] 路线末尾必须是 orientation，才能固定冰造物的水平放置方向`);
        }

        point.requiresRestoreStart = !point.continueFromPrevious && firstType !== "teleport";
        point.likeCount = parseLikeCount(data, point);
        point.enabled = enabledPointNumbers.has(point.number);

        const matchMethod = data.info && data.info.map_match_method;
        if (matchMethod && String(matchMethod).toUpperCase() !== "SIFT") {
            log.warn(`[${point.name}] map_match_method=${matchMethod}，至冬区域建议使用 SIFT`);
        }

        if (point.likeCount === null) {
            log.warn(`[${point.name}] 未填写“点赞=总数”标签，高点赞排序时将放在已标注路线之后`);
        } else {
            log.info(`[${point.name}] 标签记录预计总点赞：${point.likeCount}`);
        }
    }

    const hasStationChain = [7, 8, 9].every(number =>
        points.some(point => point.number === number)
    );
    if (hasStationChain) {
        validatePoint09AlternatePath();
    }

    log.info(`[System] 路径预检通过，共发现 ${points.length} 个 Point`);
}

export async function runPathFile(label, path) {
    log.info(`[${label}] 开始地图追踪：${path}`);
    try {
        await pathingScript.runFile(path);
    } catch (error) {
        throw new Error(`[${label}] 地图追踪失败：${errorText(error)}`);
    }
    log.info(`[${label}] 地图追踪完成`);
}

async function runPoint12Path(point) {
    const cancellationToken = dispatcher.getLinkedCancellationToken();
    let shortcutStarted = false;

    try {
        const data = loadPathData(PATHS.point12Shortcut);
        validatePathName(PATHS.point12Shortcut, data);
        const positions = data.positions;
        const teleport = positions[0];
        if (positions.length < 2 || String(teleport.type).toLowerCase() !== "teleport" ||
            String(teleport.action).toLowerCase() !== "force_tp" ||
            String(positions[positions.length - 1].type).toLowerCase() !== "orientation") {
            throw new Error("近路文件缺少强制传送起点或最终朝向");
        }

        log.info(`[${point.name}] 优先尝试特殊招募计划任务入口近路`);
        shortcutStarted = true;
        await pathingScript.run(JSON.stringify({ ...data, positions: [teleport] }));

        const mapName = data.info && data.info.map_name || "Teyvat";
        let verified = false;
        for (let attempt = 0; attempt < POINT12_POSITION_RETRIES; attempt += 1) {
            const position = await genshin.getPositionFromMap(mapName, 0);
            if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
                const distance = Math.hypot(position.x - teleport.x, position.y - teleport.y);
                if (distance <= POINT12_SHORTCUT_MAX_DISTANCE) {
                    log.info(`[${point.name}] 近路落点已确认，距任务入口约 ${distance.toFixed(1)} 个地图坐标单位`);
                    verified = true;
                    break;
                }
                log.warn(`[${point.name}] 第 ${attempt + 1} 次位置核对距任务入口约 ${distance.toFixed(1)}，继续核对`);
            } else {
                log.warn(`[${point.name}] 第 ${attempt + 1} 次无法取得有效地图位置，继续核对`);
            }
            if (attempt + 1 < POINT12_POSITION_RETRIES) {
                await sleep(500);
            }
        }
        if (!verified) {
            throw new Error("无法确认角色已到达任务入口附近");
        }

        await pathingScript.run(JSON.stringify({ ...data, positions: positions.slice(1) }));
        log.info(`[${point.name}] 任务入口近路已完成`);
    } catch (error) {
        if (cancellationToken.isCancellationRequested) {
            throw error;
        }
        log.warn(`[${point.name}] 近路未完成（${errorText(error)}），改走普通锚点完整路线`);
        if (shortcutStarted) {
            try {
                await genshin.returnMainUi();
            } catch (uiError) {
                if (cancellationToken.isCancellationRequested) {
                    throw uiError;
                }
                log.warn(`[${point.name}] 返回主界面未确认：${errorText(uiError)}`);
            }
        }
        if (cancellationToken.isCancellationRequested) {
            throw error;
        }
        await pathingScript.runFile(point.path);
        log.info(`[${point.name}] 普通锚点完整路线已完成`);
    }
}

export async function runPointPath(point) {
    if (point.alternatePathReason) {
        log.info(`[${point.name}] 使用备用路线：${point.alternatePathReason}`);
    }
    log.info(point.number === 12
        ? `[${point.name}] 开始地图追踪：优先任务入口近路，必要时改走 ${point.path}`
        : `[${point.name}] 开始地图追踪：${point.path}`);
    try {
        if (point.number === 12) {
            await runPoint12Path(point);
        } else {
            await pathingScript.runFile(point.path);
        }
    } catch (error) {
        throw new Error(`[${point.name}] 地图追踪失败：${errorText(error)}`);
    }
    log.info(`[${point.name}] 地图追踪完成，orientation 已执行`);
}

export async function restoreHeat(reason) {
    log.info(`[Heat] 开始恢复热能：${reason}`);
    await runPathFile("Heat", PATHS.restore);
    await sleep(readDelay("restoreDelay"));
    log.info("[Heat] 七天神像范围内自动恢复完成，无需按 F（未进行热能数值识别）");
}
