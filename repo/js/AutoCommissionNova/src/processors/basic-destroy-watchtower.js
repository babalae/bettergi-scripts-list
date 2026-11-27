/**
 * Basic 攀高危险 - 摧毁哨塔步骤处理器
 */
import { PATHS } from "../config/index.js";
import { RO } from "../vision/index.js";
import { bvPageOcrRegionText } from "../vision/ocr-utils.js";
import { defineStep } from "./define-step.js";
import { isCancellationError } from "../utils/error-utils.js";
import { readTrackedDescriptionText } from "./commission-desc-utils.js";

const WATCHTOWER_CONFIG = {
    /** 单次执行最多摧毁的哨塔数量；攀高危险最多两个，之后的任务图标可能属于其他委托。 */
    maxDestroyCount: 2,
    /** 距离阈值：OCR 识别到哨塔距离小于该值时，停止靠近并进入攻击阶段。 */
    distanceThreshold: 3,
    /** 距离文字连续识别失败上限：达到后认为当前图标不是哨塔，直接结束步骤。 */
    missingDistanceLimit: 5,
    /** 靠近阶段超时时间（毫秒）：超过后仍未进入距离阈值则返回失败。 */
    approachTimeout: 45 * 1000,
    /** 攻击阶段超时时间（毫秒）：进度未变化且未识别到完成提示时停止攻击。 */
    attackTimeout: 30 * 1000,
    /** 战斗期间 OCR 轮询间隔（毫秒）。 */
    statusPollInterval: 200,
    /** 主动取消简易策略后的最长退出等待时间（毫秒）。 */
    combatCancelTimeout: 10 * 1000,
    /** 单次前进时长（毫秒）：视角对准图标后按住 W 前进的时间。 */
    forwardMs: 600,
    /** 与乐流奔引一致的“委托完成”提示区域。 */
    completionRegion: new OpenCvSharp.OpenCvSharp.Rect(880, 165, 160, 45),
    /** 距离文字 OCR 区域：以任务图标坐标为基准偏移后裁剪，识别形如 23m 的整数距离。 */
    distanceRegion: {
        /** OCR 区域相对图标 x 坐标的偏移。 */
        offsetX: -55,
        /** OCR 区域相对图标 y 坐标的偏移。 */
        offsetY: 32,
        /** OCR 区域宽度。 */
        width: 130,
        /** OCR 区域高度。 */
        height: 45,
    },
};

const NAVIGATION_ICON = "图标寻路";
const NAVIGATION_PATH = "路径追踪";
/** 每轮优先执行的护盾角色，命中多名时严格保持此顺序。 */
const SHIELD_PRIORITY = ["钟离", "诺艾尔", "绮良良", "茜特菈莉", "迪奥娜", "莱依拉", "托马", "辛焱", "蓝砚"];
const ATTACK_RESULT = {
    PROGRESS: "progress",
    COMPLETED: "completed",
    TIMEOUT: "timeout",
};

function resolveStepOptions(step) {
    if (step.data === undefined || step.data === null) {
        return { navigation: NAVIGATION_ICON, paths: [] };
    }
    if (typeof step.data !== "object" || Array.isArray(step.data)) {
        throw new Error("摧毁哨塔步骤 data 必须是对象");
    }

    const navigation = step.data.navigation || NAVIGATION_ICON;
    if (navigation !== NAVIGATION_ICON && navigation !== NAVIGATION_PATH) {
        throw new Error(`摧毁哨塔步骤 navigation 只能是“${NAVIGATION_ICON}”或“${NAVIGATION_PATH}”`);
    }
    const legacyPath = typeof step.data.path === "string" ? step.data.path.trim() : "";
    const path1 = typeof step.data.path1 === "string" ? step.data.path1.trim() : "";
    const path2 = typeof step.data.path2 === "string" ? step.data.path2.trim() : "";
    if (navigation === NAVIGATION_PATH) {
        if (legacyPath && (path1 || path2)) {
            throw new Error("摧毁哨塔步骤不能混用 data.path 与 data.path1/data.path2");
        }
        if (!legacyPath && (!path1 || !path2)) {
            throw new Error("摧毁哨塔步骤使用路径追踪时必须同时配置 data.path1 和 data.path2");
        }
    }
    return { navigation, paths: navigation === NAVIGATION_PATH ? (legacyPath ? [legacyPath] : [path1, path2]) : [] };
}

/**
 * 解析“丘丘人哨塔0/2”一类委托描述。
 * @returns {{current: number, total: number}|null}
 */
export function parseWatchtowerProgress(text) {
    const normalized = String(text || "")
        .replace(/\s/g, "")
        .replace(/[oO]/g, "0")
        .replace(/[|\\]/g, "/");
    const match = normalized.match(/丘丘人哨塔.*?(\d+)\/(\d+)/);
    if (!match) return null;
    return { current: Number(match[1]), total: Number(match[2]) };
}

function readDestroyStatus(context) {
    let descriptionText = "";
    let completionText = "";
    try {
        descriptionText = readTrackedDescriptionText(context);
        completionText = bvPageOcrRegionText(WATCHTOWER_CONFIG.completionRegion);
        log.debug("摧毁哨塔委托描述 OCR: {text}", descriptionText);
        log.debug("摧毁哨塔委托完成 OCR: {text}", completionText);
    } catch (error) {
        if (isCancellationError(error)) throw error;
        log.debug("摧毁哨塔状态 OCR 失败: {error}", error.message);
    }
    return {
        progress: parseWatchtowerProgress(descriptionText),
        completed: completionText.includes("委托完成"),
        descriptionText,
        completionText,
    };
}

/**
 * 从 OCR 文本中解析整数米距离，例如 23m。
 * @param {string} text - OCR 文本
 * @returns {number|null}
 */
function parseDistance(text) {
    const match = String(text || "").replace(/[oO]/g, "0").match(/(\d+)\s*m/i);
    return match ? Number(match[1]) : null;
}

/**
 * 查找任务图标，优先使用中心限定区域基础委托图标，失败后回退到全屏基础委托图标。
 * @param {Object} cap - captureGameRegion() 返回的截图对象
 * @returns {Object|null} 图标匹配结果
 */
function findTaskIcon(cap) {
    const centerIconRes = cap.Find(RO.iconBase);
    if (centerIconRes && !centerIconRes.isEmpty()) return centerIconRes;

    const iconRes = cap.Find(RO.iconBaseFull);
    if (!iconRes || iconRes.isEmpty()) return null;
    return iconRes;
}

/**
 * 判断全屏范围内是否仍存在基础委托图标。
 * @returns {boolean}
 */
function hasAnyBaseIcon() {
    const cap = captureGameRegion();
    try {
        const iconRes = cap.Find(RO.iconBaseFull);
        return !!iconRes && !iconRes.isEmpty();
    } finally {
        cap.Dispose();
    }
}

/**
 * 根据任务图标位置计算距离文字 OCR 裁剪区域。
 * @param {Object} iconRes - 任务图标匹配结果
 * @returns {{x: number, y: number, width: number, height: number}}
 */
function makeDistanceRegion(iconRes) {
    const cfg = WATCHTOWER_CONFIG.distanceRegion;
    const x = Math.round(iconRes.x + cfg.offsetX);
    const y = Math.round(iconRes.y + cfg.offsetY);
    const { width, height } = cfg;
    return { x, y, width, height };
}

/**
 * 从任务图标下方 OCR 距离文本。
 * @param {Object} cap - captureGameRegion() 返回的截图对象
 * @param {Object} iconRes - 任务图标匹配结果
 * @returns {{text: string, distance: number|null}}
 */
function readDistanceFromCapture(cap, iconRes) {
    const region = makeDistanceRegion(iconRes);
    const area = cap.DeriveCrop(region.x, region.y, region.width, region.height);
    try {
        const result = area.find(RecognitionObject.ocrThis);
        const text = result && result.text ? result.text.trim() : "";
        return { text, distance: parseDistance(text) };
    } finally {
        area.Dispose();
    }
}

/**
 * 根据任务图标位置调整镜头朝向。
 * @param {Object} iconRes - 任务图标匹配结果
 * @param {Object} state - 靠近阶段的临时状态
 * @returns {boolean} true 表示图标已在正前方范围，可前进
 */
function adjustViewToIcon(iconRes, state) {
    if (iconRes.x >= 900 && iconRes.x <= 1020 && iconRes.y < 540) {
        return true;
    }

    if (iconRes.y >= 600 && !state.lookedDownOnce) {
        state.lookedDownOnce = true;
        log.debug("图标位于画面下方，先下拉镜头后重新判断");
        moveMouseBy(0, 540);
        return false;
    }

    const distanceToCenter = iconRes.x - 960;
    moveMouseBy(parseInt(Math.round(distanceToCenter) * 0.8), 0);
    return false;
}

/**
 * 按住 W 前进指定时间，并确保最后释放按键。
 * @param {number} duration - 前进时长（毫秒）
 * @returns {Promise<void>}
 */
async function walkForward(duration) {
    keyDown("w");
    try {
        await sleep(duration);
    } finally {
        keyUp("w");
    }
}

/**
 * 持续识别任务图标、调整镜头并向哨塔靠近，直到距离小于阈值。
 * @returns {Promise<boolean|null>} true 表示成功靠近哨塔，null 表示当前图标不是哨塔
 */
async function approachWatchtower() {
    middleButtonClick();
    await sleep(800);

    const startTime = Date.now();
    let failCount = 0;
    let missingDistanceCount = 0;
    const adjustState = { lookedDownOnce: false };
    while (Date.now() - startTime < WATCHTOWER_CONFIG.approachTimeout) {
        const cap = captureGameRegion();
        try {
            const iconRes = findTaskIcon(cap);
            if (!iconRes) {
                failCount++;
                log.warn("任务图标识别失败，连续失败次数: {count}/8", failCount);
                if (failCount >= 8) return false;
                await sleep(300);
                continue;
            }

            failCount = 0;
            if (!adjustViewToIcon(iconRes, adjustState)) {
                await sleep(250);
                continue;
            }

            const { text, distance } = readDistanceFromCapture(cap, iconRes);
            if (distance !== null) {
                missingDistanceCount = 0;
                log.debug("哨塔距离: {distance}m", distance);
                if (distance < WATCHTOWER_CONFIG.distanceThreshold) {
                    return true;
                }
            } else {
                missingDistanceCount++;
                log.warn("未解析到哨塔距离文本: {text}，连续失败次数: {count}/{limit}", text, missingDistanceCount, WATCHTOWER_CONFIG.missingDistanceLimit);
                if (missingDistanceCount >= WATCHTOWER_CONFIG.missingDistanceLimit) {
                    log.info("连续未识别到距离文字，判断当前图标不是哨塔，结束摧毁哨塔步骤");
                    return null;
                }
                await sleep(300);
                continue;
            }

            await walkForward(WATCHTOWER_CONFIG.forwardMs);
        } finally {
            cap.Dispose();
        }
        await sleep(1);
    }

    log.warn("靠近哨塔超时");
    return false;
}

/**
 * 获取 ClearScript 暴露的 C# string[] 中的角色名。
 * @param {Object} avatars - getAvatars() 返回值
 * @param {number} index - 0 基索引
 * @returns {string}
 */
function getAvatarName(avatars, index) {
    return String(avatars.GetValue(index));
}

/**
 * 从已校验的简易策略行中读取角色名。
 * @param {string} line - 格式为“角色名 动作”的策略行
 * @returns {string}
 */
function getStrategyAvatarName(line) {
    return line.match(/^(\S+)/)[1];
}

/**
 * 从统一角色策略文件加载简易策略，并筛选当前队伍中的角色。
 * @returns {string[]} 护盾角色优先、其余角色保持策略文件顺序的当前队伍策略行
 */
function loadCurrentTeamStrategies() {
    const avatars = getAvatars();
    const currentNames = new Set();
    for (let i = 0; i < avatars.Length; i++) {
        currentNames.add(getAvatarName(avatars, i));
    }

    if (!file.isFile(PATHS.AVATAR_STRATEGIES)) throw new Error(`角色策略文件不存在: ${PATHS.AVATAR_STRATEGIES}`);
    const configured = JSON.parse(file.readTextSync(PATHS.AVATAR_STRATEGIES));
    const strategies = Object.entries(configured)
        .filter(([avatarName]) => currentNames.has(avatarName))
        .map(([avatarName, value]) => {
            if (!value || typeof value.script !== "string" || !value.script.trim()) {
                throw new Error(`哨塔简易策略格式错误: ${avatarName}`);
            }
            return `${avatarName} ${value.script.trim()}`;
        });

    if (strategies.length === 0) {
        throw new Error("当前队伍没有匹配到哨塔简易策略");
    }
    const shieldOrder = new Map(SHIELD_PRIORITY.map((name, index) => [name, index]));
    const shieldStrategies = strategies
        .filter((line) => shieldOrder.has(getStrategyAvatarName(line)))
        .sort((left, right) => shieldOrder.get(getStrategyAvatarName(left)) - shieldOrder.get(getStrategyAvatarName(right)));
    const otherStrategies = strategies.filter((line) => !shieldOrder.has(getStrategyAvatarName(line)));
    log.info("当前队伍匹配到 {shieldCount} 条护盾优先策略、{otherCount} 条普通策略", shieldStrategies.length, otherStrategies.length);
    return [...shieldStrategies, ...otherStrategies];
}

/**
 * 启动持续循环的简易策略，调用方通过独立 CTS 控制退出。
 * @param {string} fullScript - 已按护盾优先顺序排列的完整策略
 * @param {number} strategyCount - 策略行数量
 * @returns {{cts: Object, state: {settled: boolean, error: Error|null, intentionalCancel: boolean}, task: Promise<void>}}
 */
function createCombatLoop(fullScript, strategyCount) {
    const cts = dispatcher.GetLinkedCancellationTokenSource();
    const state = { settled: false, error: null, intentionalCancel: false };
    const task = (async () => {
        try {
            while (!cts.Token.IsCancellationRequested) {
                log.info("执行一轮哨塔简易策略，共 {count} 行", strategyCount);
                await dispatcher.RunCombatScript(fullScript, null, cts.Token);
                await sleep(1);
            }
        } catch (error) {
            state.error = error;
        } finally {
            state.settled = true;
        }
    })();
    return { cts, state, task };
}

/**
 * 主动取消简易策略循环并等待完全退出。
 * @param {{cts: Object, state: Object, task: Promise<void>}} combat - 当前战斗句柄
 * @returns {Promise<void>}
 */
async function stopCombatLoop(combat) {
    combat.state.intentionalCancel = true;
    combat.cts.Cancel();
    const completed = await Promise.race([
        combat.task.then(() => true),
        sleep(WATCHTOWER_CONFIG.combatCancelTimeout).then(() => false),
    ]);
    if (!completed) {
        throw new Error(`取消哨塔简易策略超过 ${WATCHTOWER_CONFIG.combatCancelTimeout / 1000} 秒仍未退出`);
    }
    if (combat.state.error && !isCancellationError(combat.state.error)) {
        throw combat.state.error;
    }
}

/**
 * 释放简易策略的取消令牌源。
 * @param {{cts: Object}|null} combat - 当前战斗句柄
 * @returns {void}
 */
function disposeCombatLoop(combat) {
    if (!combat) return;
    try { combat.cts.Dispose(); } catch (_) { /* ClearScript 版本可能不暴露 Dispose。 */ }
}

/**
 * 检查简易策略是否在非主动取消的情况下提前结束。
 * @param {{cts: Object, state: {settled: boolean, error: Error|null, intentionalCancel: boolean}}} combat - 当前战斗句柄
 * @returns {void}
 */
function assertCombatLoopRunning(combat) {
    if (!combat.state.settled || combat.state.intentionalCancel) return;
    if (combat.state.error) throw combat.state.error;
    if (combat.cts.Token.IsCancellationRequested) throw new Error("取消自动任务");
    throw new Error("哨塔简易策略在进度更新前意外结束");
}

/**
 * 并行执行简易策略与状态 OCR，直到摧毁数量增加、委托完成或软超时。
 * @param {number|null} initialCount - 开始攻击前识别到的已摧毁数量
 * @param {string[]} strategies - 当前队伍匹配到的策略行
 * @param {Object} context - 当前委托执行上下文
 * @returns {Promise<string>} 攻击结束原因
 */
async function attackUntilDestroyed(initialCount, strategies, context) {
    const startTime = Date.now();
    const fullScript = strategies.join("\n");
    const combat = createCombatLoop(fullScript, strategies.length);
    let result = null;
    try {
        while (result === null) {
            assertCombatLoopRunning(combat);
            const status = readDestroyStatus(context);
            if (status.completed) {
                log.info("识别到委托完成文本: {text}", status.completionText);
                result = ATTACK_RESULT.COMPLETED;
                break;
            }
            if (status.progress && status.progress.current >= status.progress.total) {
                log.info("哨塔摧毁进度已完成: {current}/{total}", status.progress.current, status.progress.total);
                result = ATTACK_RESULT.COMPLETED;
                break;
            }
            if (status.progress && initialCount !== null && status.progress.current > initialCount) {
                log.info("哨塔摧毁进度已更新: {current}/{total}", status.progress.current, status.progress.total);
                result = ATTACK_RESULT.PROGRESS;
                break;
            }
            if (Date.now() - startTime >= WATCHTOWER_CONFIG.attackTimeout) {
                log.warn("攻击哨塔超过 {seconds} 秒，判定软超时", WATCHTOWER_CONFIG.attackTimeout / 1000);
                result = ATTACK_RESULT.TIMEOUT;
                break;
            }
            await sleep(WATCHTOWER_CONFIG.statusPollInterval);
        }
        await stopCombatLoop(combat);
        return result;
    } catch (error) {
        if (!combat.state.intentionalCancel) await stopCombatLoop(combat);
        throw error;
    } finally {
        if (!combat.state.intentionalCancel) {
            combat.state.intentionalCancel = true;
            try { combat.cts.Cancel(); } catch (_) { /* 已释放或已取消。 */ }
        }
        disposeCombatLoop(combat);
    }
}

/**
 * 图标寻路会循环处理剩余哨塔；路径追踪按配置顺序处理路径终点处的哨塔。
 * 每座哨塔均在到达后才切换近战角色并开始普通攻击。
 * @returns {Promise<boolean>} 是否成功完成哨塔处理
 */
async function destroyAllWatchtowers(options, context) {
    let processedCount = 0;
    let attackStrategies = null;

    const pathCount = options.paths.length;
    while (processedCount < WATCHTOWER_CONFIG.maxDestroyCount &&
        (options.navigation === NAVIGATION_PATH ? processedCount < pathCount : hasAnyBaseIcon())) {
        if (options.navigation === NAVIGATION_PATH) {
            const fullPath = context.resolveResource(options.paths[processedCount]);
            log.info("使用路径追踪前往第 {count} 个哨塔: {path}", processedCount + 1, fullPath);
            await pathingScript.runFile(fullPath);
            log.info("已到达第 {count} 条路径终点，开始准备攻击哨塔", processedCount + 1);
        }
        log.info("开始处理第 {count} 个哨塔", processedCount + 1);

        if (options.navigation === NAVIGATION_ICON) {
            const approachResult = await approachWatchtower();
            if (approachResult === null) {
                return true;
            }
            if (!approachResult) {
                if (!hasAnyBaseIcon()) {
                    log.info("靠近过程中全屏基础委托图标已消失，结束摧毁哨塔步骤");
                    return true;
                }
                return false;
            }
        }

        const initialStatus = readDestroyStatus(context);
        const initialCount = initialStatus.progress ? initialStatus.progress.current : null;
        if (initialStatus.completed) return true;
        if (initialStatus.progress && initialStatus.progress.current >= initialStatus.progress.total) return true;
        if (initialStatus.progress) {
            log.info("攻击前哨塔摧毁进度: {current}/{total}", initialStatus.progress.current, initialStatus.progress.total);
        } else {
            log.warn("攻击前未识别到哨塔摧毁进度，将继续等待委托完成提示");
        }

        if (!attackStrategies) {
            await genshin.returnMainUi();
            await sleep(500);
            attackStrategies = loadCurrentTeamStrategies();
        }

        const attackResult = await attackUntilDestroyed(initialCount, attackStrategies, context);
        if (attackResult === ATTACK_RESULT.COMPLETED) {
            return true;
        }
        if (attackResult === ATTACK_RESULT.TIMEOUT &&
            !(options.navigation === NAVIGATION_PATH && pathCount === 2 && processedCount === 0)) {
            return false;
        }
        if (attackResult === ATTACK_RESULT.TIMEOUT) {
            log.warn("第一座哨塔攻击软超时，继续执行第二条路径");
        }

        processedCount++;
        await sleep(500);
    }

    if (processedCount >= WATCHTOWER_CONFIG.maxDestroyCount) {
        log.info("已达到最大处理数量 {count}，停止继续处理哨塔", WATCHTOWER_CONFIG.maxDestroyCount);
        return true;
    }

    log.info("摧毁哨塔步骤完成，共处理 {count} 个", processedCount);
    return true;
}

export default defineStep({
    type: "摧毁哨塔",
    category: "特定委托对策",
    dataSpec: {
        kind: "object",
        optional: true,
        fields: {
            navigation: {
                type: "string",
                label: "寻路方式",
                default: NAVIGATION_ICON,
                alwaysVisible: true,
                options: [NAVIGATION_ICON, NAVIGATION_PATH],
            },
            path: { type: "string", label: "旧版路径文件", nonEmpty: true, resource: "path" },
            path1: { type: "string", label: "哨塔1路径", nonEmpty: true, resource: "path" },
            path2: { type: "string", label: "哨塔2路径", nonEmpty: true, resource: "path" },
        },
        validate: data => {
            const navigation = data.navigation || NAVIGATION_ICON;
            const hasLegacyPath = data.path !== undefined;
            const hasPath1 = data.path1 !== undefined;
            const hasPath2 = data.path2 !== undefined;
            if (navigation === NAVIGATION_ICON && (hasLegacyPath || hasPath1 || hasPath2)) {
                return "摧毁哨塔使用图标寻路时不能配置路径文件";
            }
            if (navigation === NAVIGATION_PATH && hasLegacyPath && (hasPath1 || hasPath2)) {
                return "摧毁哨塔不能混用 data.path 与 data.path1/data.path2";
            }
            if (navigation === NAVIGATION_PATH && !hasLegacyPath && (!hasPath1 || !hasPath2)) {
                return "摧毁哨塔使用路径追踪时必须同时配置 data.path1 和 data.path2";
            }
            return "";
        },
    },
    run: async (step, context) => {
        try {
            const options = resolveStepOptions(step);
            log.info("开始执行摧毁哨塔步骤，寻路方式: {navigation}", options.navigation);

            return await destroyAllWatchtowers(options, context);
        } catch (error) {
            if (isCancellationError(error)) throw error;
            log.error("执行摧毁哨塔步骤时出错: {error}", error.message);
            log.debug("详情: {error}", error.stack);
            throw error;
        }
    },
});
