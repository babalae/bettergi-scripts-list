(async function () {
    const PATHS = {
        restore: "Assets/Pathing/restore.json",
        pointDirectory: "Assets/Pathing",
        point09FromPoint07: "Assets/Pathing/point09_from07.json"
    };

    const POINT_FILE_PATTERN = /^point(\d+)(_continue)?\.json$/i;
    const LIKE_TAG_PATTERN = /^(?:点赞|likes?)\s*[:：=＝]\s*(\d+)\s*$/i;
    const ORDER_BY_POINT = "按 Point 编号";
    const ORDER_BY_LIKES = "高点赞优先";
    const HIGH_YIELD_ONLY = "高收益精简（6赞及以上）";
    const HIGH_YIELD_MIN_LIKES = 6;

    // 只改变镜头俯仰，不改变 orientation 已经确定的水平朝向。
    // 相对鼠标移动可能被游戏分帧截断，因此分多次、带间隔地推到俯仰上限。
    const CAMERA_PITCH_CLAMP_Y = -10000;

    // settings.json 中的值会覆盖这些兜底时间。
    const DEFAULT_TIMINGS = {
        pathSettleDelay: 1000,
        restoreDelay: 1500,
        cameraClampPassDelay: 100,
        cameraClampSettleDelay: 150,
        cameraSettleDelay: 400,
        fourKExtraTDelay: 800,
        enterCreationDelay: 500,
        firstLikeDelay: 800,
        selectObjectDelay: 500,
        deleteDelay: 400,
        secondLikeDelay: 800,
        finalDeleteDelay: 400,
        exitCreationDelay: 500
    };

    const DEFAULT_CAMERA = {
        x: 0,
        pitchFromTop: 7500,
        clampPasses: 4
    };

    let runtimeTDelayExtra = 0;

    function errorText(error) {
        if (error && error.message) {
            return error.message;
        }
        return String(error);
    }

    function formatPointNumber(number) {
        return String(number).padStart(2, "0");
    }

    function baseName(path) {
        const normalized = String(path).replace(/\\/g, "/");
        return normalized.slice(normalized.lastIndexOf("/") + 1);
    }

    function readCheckbox(name, fallback) {
        const raw = settings[name];
        if (raw === undefined || raw === null || raw === "") {
            return fallback;
        }
        return raw === true || String(raw).toLowerCase() === "true";
    }

    function readInteger(name, fallback, min, max) {
        const raw = settings[name];
        if (raw === undefined || raw === null || raw === "") {
            return fallback;
        }

        const value = Number(raw);
        if (!Number.isFinite(value) || value < min || value > max) {
            log.warn(`[Config] ${name}=${raw} 无效，使用默认值 ${fallback}`);
            return fallback;
        }

        return Math.round(value);
    }

    function readSelect(name, fallback, allowedValues) {
        const raw = String(settings[name] || fallback).trim();
        if (allowedValues.includes(raw)) {
            return raw;
        }
        log.warn(`[Config] ${name}=${raw} 无效，使用默认值 ${fallback}`);
        return fallback;
    }

    function readDelay(name) {
        return readInteger(name, DEFAULT_TIMINGS[name], 0, 600000);
    }

    function readGameResolution() {
        try {
            const metrics = getGameMetrics();
            if (metrics && metrics.length >= 2) {
                const width = Math.round(Number(metrics[0]));
                const height = Math.round(Number(metrics[1]));
                if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                    return { width, height };
                }
            }
        } catch (error) {
            log.warn(`[Environment] 无法读取游戏窗口尺寸：${errorText(error)}`);
        }

        return null;
    }

    function configureRuntimeTimings() {
        const forceCompensation = readCheckbox("forceTDelayCompensationEnabled", false);
        const configuredExtraDelay = readDelay("fourKExtraTDelay");
        const resolution = readGameResolution();
        if (!resolution) {
            runtimeTDelayExtra = forceCompensation ? configuredExtraDelay : 0;
            if (forceCompensation) {
                log.warn(
                    `[Environment] 未能确认游戏分辨率，已按手动设置启用 T 后额外等待 ${runtimeTDelayExtra}ms`
                );
            } else {
                log.warn("[Environment] 未能确认游戏分辨率，不启用 T 后额外等待");
            }
            return;
        }

        log.info(`[Environment] 游戏窗口分辨率：${resolution.width}x${resolution.height}`);

        const isFourK = resolution.width >= 3840 && resolution.height >= 2160;
        runtimeTDelayExtra = isFourK || forceCompensation ? configuredExtraDelay : 0;

        if (isFourK && runtimeTDelayExtra > 0) {
            log.info(
                `[Environment] 已启用 4K 时序补偿：每次 T 后、左键前额外等待 ${runtimeTDelayExtra}ms`
            );
        } else if (isFourK) {
            log.info("[Environment] 检测到 4K，4K 时序补偿已设为 0ms");
        } else if (forceCompensation && runtimeTDelayExtra > 0) {
            log.info(
                `[Environment] 当前不是 4K，已按手动设置启用 T 后额外等待 ${runtimeTDelayExtra}ms`
            );
        } else if (forceCompensation) {
            log.info("[Environment] 当前不是 4K，手动时序补偿已开启，但额外等待设为 0ms");
        } else {
            log.info("[Environment] 当前不是 4K，且未手动启用时序补偿");
        }
    }

    function readTTransitionDelay(name) {
        return readDelay(name) + runtimeTDelayExtra;
    }

    function parsePointIntegerOverrides(settingName, min, max) {
        const result = {};
        const raw = String(settings[settingName] || "").trim();
        if (!raw) {
            return result;
        }

        const entries = raw.split(/[,，;；]+/);
        for (const entry of entries) {
            const trimmed = entry.trim();
            if (!trimmed) {
                continue;
            }

            const match = /^(\d+)\s*=\s*(-?\d+)$/.exec(trimmed);
            if (!match) {
                log.warn(`[Config] ${settingName} 中的“${trimmed}”格式无效，已忽略`);
                continue;
            }

            const pointNumber = Number(match[1]);
            const value = Number(match[2]);
            if (pointNumber < 1 || value < min || value > max) {
                log.warn(`[Config] ${settingName} 中的“${trimmed}”超出范围，已忽略`);
                continue;
            }

            result[pointNumber] = Math.round(value);
        }

        return result;
    }

    function normalizeVirtualKey(rawKey, fallback) {
        const value = String(rawKey || fallback).trim().toUpperCase();
        if (value.startsWith("VK_")) {
            return value;
        }
        if (value.length === 1) {
            return `VK_${value}`;
        }
        return value;
    }

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

    function discoverPoints() {
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
                continueFromPrevious: Boolean(match[2]),
                alternatePathReason: null,
                enabled: true,
                hasFinalOrientation: false,
                requiresRestoreStart: false,
                likeCount: null
            });
        }

        points.sort((a, b) => a.number - b.number);

        if (points.length === 0) {
            throw new Error(`未在 ${PATHS.pointDirectory} 中找到 pointXX.json 或 pointXX_continue.json`);
        }

        return points;
    }

    function validatePoint09AlternatePath() {
        const data = loadPathData(PATHS.point09FromPoint07);
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

        log.info(`[System] Point 09 绕过 Point 08 的备用路线预检通过`);
    }

    function preflight(points) {
        loadPathData(PATHS.restore);

        for (let index = 0; index < points.length; index += 1) {
            const point = points[index];
            const data = loadPathData(point.path);
            const positions = data.positions;
            const firstPosition = positions[0];
            const lastPosition = positions[positions.length - 1];
            const firstType = String(firstPosition.type || "").toLowerCase();
            const lastType = String(lastPosition.type || "").toLowerCase();

            if (point.continueFromPrevious) {
                if (index === 0) {
                    throw new Error(`${point.name} 是首个点位，文件名不能带 _continue`);
                }
                if (point.number !== points[index - 1].number + 1) {
                    throw new Error(`[${point.name}] _continue 必须紧接上一个编号，当前上一个点是 ${points[index - 1].name}`);
                }
                if (firstType === "teleport") {
                    throw new Error(`[${point.name}] _continue 路线不能以 teleport 开始：${point.path}`);
                }
            }

            point.hasFinalOrientation = lastType === "orientation";
            if (!point.hasFinalOrientation) {
                throw new Error(`[${point.name}] 路线末尾必须是 orientation，才能固定冰造物的水平放置方向`);
            }

            point.requiresRestoreStart = !point.continueFromPrevious && firstType !== "teleport";
            point.likeCount = parseLikeCount(data, point);
            point.enabled = readCheckbox(`point${formatPointNumber(point.number)}Enabled`, true);

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

    function buildRouteGroups(points) {
        const groups = [];

        for (const point of points) {
            if (!point.continueFromPrevious) {
                groups.push({
                    points: [point],
                    firstNumber: point.number,
                    requiresRestoreStart: point.requiresRestoreStart,
                    likeCount: 0,
                    hasCompleteLikeData: true
                });
            } else {
                groups[groups.length - 1].points.push(point);
            }
        }

        return groups;
    }

    function createSelectedGroup(sourceGroup, selectedPoints) {
        if (selectedPoints.length === 0) {
            return null;
        }

        const selectedGroup = {
            points: selectedPoints,
            firstNumber: selectedPoints[0].number,
            requiresRestoreStart: sourceGroup.requiresRestoreStart,
            likeCount: 0,
            hasCompleteLikeData: true
        };

        for (const point of selectedPoints) {
            if (point.likeCount === null) {
                selectedGroup.hasCompleteLikeData = false;
            } else {
                selectedGroup.likeCount += point.likeCount;
            }
        }

        return selectedGroup;
    }

    function selectStationRouteGroup(group) {
        const point07 = group.points.find(point => point.number === 7);
        const point08 = group.points.find(point => point.number === 8);
        const point09 = group.points.find(point => point.number === 9);

        if (!point07 || !point08 || !point09) {
            return null;
        }

        if (!point07.enabled) {
            log.info(`[${point07.name}] 已在 JS 自定义设置中关闭`);
            if (point08.enabled) {
                log.warn(`[${point08.name}] 依赖 ${point07.name} 的当前位置，已自动跳过`);
            }
            if (point09.enabled) {
                log.warn(`[${point09.name}] 依赖 ${point07.name} 的当前位置，已自动跳过`);
            }
            return { handled: true, group: null };
        }

        const selectedPoints = [point07];

        if (point08.enabled) {
            selectedPoints.push(point08);
        } else {
            log.info(`[${point08.name}] 已关闭，将在需要时使用备用路线绕过`);
        }

        if (point09.enabled) {
            if (point08.enabled) {
                selectedPoints.push(point09);
            } else {
                selectedPoints.push({
                    ...point09,
                    path: PATHS.point09FromPoint07,
                    alternatePathReason: "Point 08 已关闭，从 Point 07 直接前往 Point 09"
                });
                log.info(`[RouteGroup] Point 07 → Point 09 将使用备用路线，跳过 Point 08`);
            }
        } else {
            log.info(`[${point09.name}] 已在 JS 自定义设置中关闭`);
        }

        return {
            handled: true,
            group: createSelectedGroup(group, selectedPoints)
        };
    }

    function applyRouteSwitches(groups) {
        const selectedGroups = [];

        for (const group of groups) {
            const stationSelection = selectStationRouteGroup(group);
            if (stationSelection) {
                if (stationSelection.group) {
                    selectedGroups.push(stationSelection.group);
                }
                continue;
            }

            const selectedPoints = [];
            let dependencyBrokenBy = null;

            for (const point of group.points) {
                if (dependencyBrokenBy) {
                    log.warn(`[${point.name}] 依赖已跳过的 ${dependencyBrokenBy.name}，连续路线已自动跳过`);
                    continue;
                }

                if (!point.enabled) {
                    log.info(`[${point.name}] 已在 JS 自定义设置中关闭`);
                    dependencyBrokenBy = point;
                    continue;
                }

                selectedPoints.push(point);
            }

            const selectedGroup = createSelectedGroup(group, selectedPoints);
            if (selectedGroup) {
                selectedGroups.push(selectedGroup);
            }
        }

        return selectedGroups;
    }

    function routeGroupName(group) {
        return group.points.map(point => point.name).join(" → ");
    }

    function orderRouteGroups(groups, orderMode) {
        let ordered = groups.slice();

        if (orderMode === HIGH_YIELD_ONLY) {
            ordered = ordered.filter(group => {
                if (!group.hasCompleteLikeData) {
                    log.warn(
                        `[RouteGroup] “${routeGroupName(group)}”缺少完整点赞标签，` +
                        "无法判断是否达到高收益门槛，已跳过"
                    );
                    return false;
                }
                if (group.likeCount < HIGH_YIELD_MIN_LIKES) {
                    log.info(
                        `[RouteGroup] “${routeGroupName(group)}”预计 ${group.likeCount} 赞，` +
                        `低于高收益门槛 ${HIGH_YIELD_MIN_LIKES} 赞，已跳过`
                    );
                    return false;
                }
                return true;
            });
        }

        if (orderMode === ORDER_BY_LIKES || orderMode === HIGH_YIELD_ONLY) {
            ordered.sort((a, b) => {
                if (a.hasCompleteLikeData !== b.hasCompleteLikeData) {
                    return a.hasCompleteLikeData ? -1 : 1;
                }
                if (a.hasCompleteLikeData && a.likeCount !== b.likeCount) {
                    return b.likeCount - a.likeCount;
                }
                return a.firstNumber - b.firstNumber;
            });
        } else {
            ordered.sort((a, b) => a.firstNumber - b.firstNumber);
        }

        return ordered;
    }

    function validateRouteGroups(groups, restoreEveryPoints) {
        for (const group of groups) {
            if (group.points.length > 6) {
                throw new Error(
                    `连续路线组“${routeGroupName(group)}”包含 ${group.points.length} 个 Point，` +
                    "超过已确认的60点热能容量；请拆分为可以重新传送的独立路线"
                );
            }
            if (group.points.length > restoreEveryPoints) {
                log.warn(
                    `[RouteGroup] “${routeGroupName(group)}”长度超过恢复间隔 ${restoreEveryPoints}，` +
                    "为保持连续位置，将在组开始前恢复并完整执行该组"
                );
            }
        }
    }

    function logExecutionPlan(groups, orderMode, restoreEveryPoints) {
        const plan = groups.map(group => {
            const likes = group.hasCompleteLikeData ? `${group.likeCount}赞` : "点赞未完整标注";
            return `${routeGroupName(group)}（${likes}）`;
        }).join(" | ");

        log.info(`[Config] 路线运行模式：${orderMode}`);
        log.info(`[Config] 每 ${restoreEveryPoints} 个成功 Point 恢复一次热能`);
        log.info(`[Plan] ${plan}`);
    }

    async function runPathFile(label, path) {
        log.info(`[${label}] 开始地图追踪：${path}`);
        try {
            await pathingScript.runFile(path);
        } catch (error) {
            throw new Error(`[${label}] 地图追踪失败：${errorText(error)}`);
        }
        log.info(`[${label}] 地图追踪完成`);
    }

    async function runPointPath(point) {
        if (point.alternatePathReason) {
            log.info(`[${point.name}] 使用备用路线：${point.alternatePathReason}`);
        }
        log.info(`[${point.name}] 开始地图追踪：${point.path}`);
        try {
            await pathingScript.runFile(point.path);
        } catch (error) {
            throw new Error(`[${point.name}] 地图追踪失败：${errorText(error)}`);
        }
        log.info(`[${point.name}] 地图追踪完成，orientation 已执行`);
    }

    async function restoreHeat(reason) {
        log.info(`[Heat] 开始恢复热能：${reason}`);
        await runPathFile("Heat", PATHS.restore);

        if (readCheckbox("restoreInteractionEnabled", false)) {
            const interactKey = normalizeVirtualKey(settings.restoreInteractionKey, "VK_F");
            log.info(`[Heat] 执行固定交互键：${interactKey}`);
            keyPress(interactKey);
        }

        await sleep(readDelay("restoreDelay"));
        log.info("[Heat] 恢复完成（未进行热能数值识别）");
    }

    async function applyPointCameraOffset(point, xOverrides, pitchOverrides) {
        const clampPasses = readInteger(
            "cameraClampPasses",
            DEFAULT_CAMERA.clampPasses,
            1,
            20
        );
        const clampPassDelay = readDelay("cameraClampPassDelay");

        log.info(
            `[${point.name}] 固定镜头垂直基准：向上推 ${clampPasses} 次，` +
            `间隔 ${clampPassDelay}ms（保留 orientation 水平朝向）`
        );
        for (let pass = 0; pass < clampPasses; pass += 1) {
            moveMouseBy(0, CAMERA_PITCH_CLAMP_Y);
            if (pass + 1 < clampPasses) {
                await sleep(clampPassDelay);
            }
        }
        await sleep(readDelay("cameraClampSettleDelay"));

        const defaultX = readInteger("defaultCameraOffsetX", DEFAULT_CAMERA.x, -10000, 10000);
        const defaultPitch = readInteger(
            "defaultCameraPitchFromTop",
            DEFAULT_CAMERA.pitchFromTop,
            0,
            10000
        );
        const x = Object.prototype.hasOwnProperty.call(xOverrides, point.number)
            ? xOverrides[point.number]
            : defaultX;
        const pitchFromTop = Object.prototype.hasOwnProperty.call(pitchOverrides, point.number)
            ? pitchOverrides[point.number]
            : defaultPitch;

        log.info(`[${point.name}] 应用镜头标定：水平 x=${x}，从垂直上限向下 y=${pitchFromTop}`);
        if (x !== 0) {
            moveMouseBy(x, 0);
        }
        if (pitchFromTop !== 0) {
            moveMouseBy(0, pitchFromTop);
        }
        await sleep(readDelay("cameraSettleDelay"));
    }

    async function exitCreationMode(point) {
        log.info(`[${point.name}] 按 T 退出冰造物界面`);
        keyPress("VK_T");
        await sleep(readDelay("exitCreationDelay"));
        log.info(`[${point.name}] 已回到正常游戏状态`);
    }

    async function doIceObjectCycle(point) {
        const label = point.name;

        log.info(`[${label}] 第一次放置：进入造物模式`);
        keyPress("VK_T");
        await sleep(readTTransitionDelay("enterCreationDelay"));

        leftButtonClick();
        log.info(`[${label}] 第一次放置完成，等待 NPC 点赞`);
        await sleep(readDelay("firstLikeDelay"));
        log.info(`[${label}] 第一次点赞安全等待完成`);

        log.info(`[${label}] 删除第一次造物`);
        keyPress("VK_T");
        await sleep(readTTransitionDelay("selectObjectDelay"));

        leftButtonClick();
        log.info(`[${label}] 第一次造物已删除`);
        await sleep(readDelay("deleteDelay"));

        log.info(`[${label}] 第二次放置`);
        leftButtonClick();
        await sleep(readDelay("secondLikeDelay"));
        log.info(`[${label}] 第二次点赞安全等待完成`);

        log.info(`[${label}] 最终删除第二次造物`);
        keyPress("VK_T");
        await sleep(readTTransitionDelay("selectObjectDelay"));

        leftButtonClick();
        await sleep(readDelay("finalDeleteDelay"));
        log.info(`[${label}] 最终删除动作完成（未进行视觉校验）`);

        await exitCreationMode(point);
        log.info(`[${label}] 完成`);
    }

    async function runPoint(point, xOverrides, pitchOverrides) {
        await runPointPath(point);
        log.info(`[${point.name}] 已到达固定工位，orientation 完成`);

        await sleep(readDelay("pathSettleDelay"));
        await applyPointCameraOffset(point, xOverrides, pitchOverrides);
        await doIceObjectCycle(point);
    }

    try {
        log.info("[System] 冰造物 NPC 点赞自动化开始");
        configureRuntimeTimings();

        const points = discoverPoints();
        preflight(points);

        const orderMode = readSelect(
            "executionOrderMode",
            ORDER_BY_POINT,
            [ORDER_BY_POINT, ORDER_BY_LIKES, HIGH_YIELD_ONLY]
        );
        const restoreEveryPoints = readInteger("restoreEveryPoints", 4, 1, 6);
        const xOverrides = parsePointIntegerOverrides("cameraOffsetXOverrides", -10000, 10000);
        const pitchOverrides = parsePointIntegerOverrides("cameraPitchFromTopOverrides", 0, 10000);

        const allGroups = buildRouteGroups(points);
        const selectedGroups = applyRouteSwitches(allGroups);
        const orderedGroups = orderRouteGroups(selectedGroups, orderMode);

        if (orderedGroups.length === 0) {
            log.warn("[System] 没有启用任何可执行路线，脚本结束");
            return;
        }

        validateRouteGroups(orderedGroups, restoreEveryPoints);
        logExecutionPlan(orderedGroups, orderMode, restoreEveryPoints);

        await restoreHeat("脚本启动");

        let completedSinceRestore = 0;
        let completedPoints = 0;
        let expectedLikes = 0;
        let pointsWithoutLikeTag = 0;

        for (const group of orderedGroups) {
            const groupSize = group.points.length;
            const insufficientHeatQuota = completedSinceRestore > 0 &&
                completedSinceRestore + groupSize > restoreEveryPoints;
            const mustReturnToRestoreStart = group.requiresRestoreStart && completedSinceRestore > 0;

            if (insufficientHeatQuota || mustReturnToRestoreStart) {
                const reason = mustReturnToRestoreStart
                    ? `${routeGroupName(group)} 需要从恢复点开始`
                    : `下一个连续组有 ${groupSize} 个 Point，当前剩余额度不足`;
                await restoreHeat(reason);
                completedSinceRestore = 0;
            }

            if (group.points.length > 1) {
                log.info(`[RouteGroup] 开始连续执行：${routeGroupName(group)}`);
            }

            for (const point of group.points) {
                if (point.continueFromPrevious) {
                    log.info(`[${point.name}] 连续路线：从上一个 Point 的当前位置继续`);
                }

                await runPoint(point, xOverrides, pitchOverrides);
                completedSinceRestore += 1;
                completedPoints += 1;

                if (point.likeCount === null) {
                    pointsWithoutLikeTag += 1;
                } else {
                    expectedLikes += point.likeCount;
                    log.info(`[${point.name}] 标签预计获得 ${point.likeCount} 赞`);
                }

                log.info(`[Heat] 本轮已完成 ${completedSinceRestore}/${restoreEveryPoints} 个 Point`);
            }
        }

        if (pointsWithoutLikeTag === 0) {
            log.info(`[System] 全部完成：执行 ${completedPoints} 个 Point，标签预计总计 ${expectedLikes} 赞`);
        } else {
            log.info(
                `[System] 全部完成：执行 ${completedPoints} 个 Point，已标注路线预计 ${expectedLikes} 赞，` +
                `${pointsWithoutLikeTag} 个 Point 未填写点赞标签`
            );
        }
    } catch (error) {
        log.error(`[System] 脚本终止：${errorText(error)}`);
        throw error;
    }
})();
