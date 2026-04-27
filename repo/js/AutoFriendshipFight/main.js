// ----------------------------
// AutoFriendshipFight 主脚本
// - 通过 OCR 识别“突发事件”任务文本来判定是否触发
// - 通过地图路径文件导航到触发点/战斗点
// - 通过自动战斗任务完成战斗，并用 OCR 判定胜负/是否离开触发区域
// - 可选：后台检测是否出现经验/摩拉图标，用于提前终止循环
// ----------------------------

// 默认配置（当 settings.json 未设置或设置非法时使用）
const DEFAULT_RUNS = 10;
const DEFAULT_OCR_TIMEOUT_SECONDS = 10;
const DEFAULT_FIGHT_TIMEOUT_SECONDS = 120;
const DEFAULT_SWIM_CONSECUTIVE_LIMIT = 5;

// 掉落检测状态
// detectedExpOrMora：上一轮是否识别到经验/摩拉图标（用于判断“连续两轮都没有掉落则停”）
// NoExpOrMoraCount：连续“没有识别到掉落”的计数器
// running：后台循环 detectExpOrMora 的停止开关（必须在任何退出路径上关闭，避免后台占用）
let detectedExpOrMora = true;
let NoExpOrMoraCount = 0;
let running = true;

// 默认突发任务 OCR 关键词（敌人配置未提供时使用）
const DEFAULT_OCR_KEYWORDS = ["突发", "任务", "打倒", "消灭", "敌人", "所有"];

// 各敌人类型的参数配置
// - ocrKeywords：用于 detectTaskTrigger / waitForBattleResult 的 OCR 关键字
// - triggerPoint：触发点坐标（用于到位校验与二次导航）
// - targetCoords：战斗点坐标（用于到位校验）
// - preparePath：准备路径（通常是传送点->触发区域附近）
// - postBattlePath：战斗后补充路径（如拾取/对话）
// - failReturnPath：失败后的回退路径（通常回到准备点/触发点）
// - failReturnSleepMs：失败回退后额外等待（给加载/稳定留时间）
// - initialDelayMs：首轮额外等待（给地图/加载/触发留时间）
const ENEMY_CONFIG = {
    "愚人众": {
        ocrKeywords: ["买卖", "不成", "正义存", "愚人众", "禁止", "危险", "运输", "打倒", "盗宝团", "丘丘人", "今晚", "伙食", "所有人"],
        targetCoords: { x: 4840.55, y: -3078.01 },
        triggerPoint: { x: 4783.79, y: -3065.62 },
        preparePath: "愚人众-准备",
        failReturnPath: "愚人众-准备",
    },
    "盗宝团": {
        ocrKeywords: ["岛上", "无贼", "消灭", "鬼鬼祟祟", "盗宝团"],
        targetCoords: { x: -2753.04, y: -3459.3025 },
        triggerPoint: { x: -2736.60, y: -3415.44 },
    },
    "鳄鱼": {
        ocrKeywords: ["张牙", "舞爪", "恶党", "鳄鱼", "打倒", "所有", "鳄鱼"],
        targetCoords: { x: 3578.08, y: -500.75 },
        triggerPoint: { x: 3614.63, y: -521.60 },
        preparePath: "鳄鱼-准备",
        failReturnPath: "鳄鱼-准备",
        failReturnSleepMs: 5000,
        initialDelayMs: 5000,
        postBattlePath: "鳄鱼-拾取",
    },
    "蕈兽": {
        ocrKeywords: ["实验家", "变成", "实验品", "击败", "所有", "魔物"],
        targetCoords: { x: 3794.55, y: -350.60 },
        triggerPoint: { x: 3749.38, y: -391.91 },
        preparePath: "蕈兽-准备",
        postBattlePath: "蕈兽-对话",
    },
    "雷萤术士": {
        ocrKeywords: ["雷萤", "术士", "圆滚滚", "不可食用", "威撼", "攀岩", "消灭", "准备", "打倒", "所有", "魔物", "盗宝团", "击败", "成员", "盗亦无道"],
        targetCoords: { x: 883.91, y: 656.63 },
        triggerPoint: { x: 881.92, y: 616.85 },
        preparePath: "雷萤术士-准备",
    },
};

// 经验/摩拉模板匹配资源
// 这里保留 Mat 引用，便于脚本结束时主动释放，降低长时间运行的资源占用风险
let expMat = file.ReadImageMatSync("assets/exp.png");
const expRo = RecognitionObject.TemplateMatch(expMat, 74, 341, 207 - 74, 803 - 341);
expRo.Threshold = 0.85;
expRo.Use3Channels = true;
expRo.InitTemplate();

let moraMat = file.ReadImageMatSync("assets/mora.png");
const moraRo = RecognitionObject.TemplateMatch(moraMat, 74, 341, 207 - 74, 803 - 341);
moraRo.Threshold = 0.85;
moraRo.Use3Channels = true;
moraRo.InitTemplate();

(async function () {
    const startTime = Date.now();
    try {
        // 可选：启用自动拾取实时任务
        if (convertToTrueIfNotBoolean(settings.pickupMode)) {
            dispatcher.addTimer(new RealtimeTimer("AutoPick"));
            log.info("已 启用 自动拾取任务");
        } else {
            log.info("已 禁用 自动拾取任务");
        }
        // 修复点：runTimes 必须用 let/const 声明，避免污染全局变量
        let runTimes = await calulateRunTimes();
        await switchPartyIfNeeded(settings.partyName);

        // 选择敌人类型（默认盗宝团）
        const enemyType = settings.enemyType || "盗宝团";
        log.info(`当前选择的敌人类型: ${enemyType}`);
        log.info(`${enemyType}好感开始...`);

        // 敌人准备流程（部分敌人需要先走准备路径/清理）
        await prepareForEnemy(enemyType);
        // 超时设置校验（非法则回退默认值）
        const ocrTimeout = validateTimeoutSetting(settings.ocrTimeout, DEFAULT_OCR_TIMEOUT_SECONDS, "OCR");
        const fightTimeout = validateTimeoutSetting(settings.fightTimeout, DEFAULT_FIGHT_TIMEOUT_SECONDS, "战斗");

        // 主循环入口
        await AutoFriendshipDev(runTimes, ocrTimeout, fightTimeout, enemyType);
        log.info(`${enemyType}好感运行总时长：${LogTimeTaken(startTime)}`);
    } catch (error) {
        if (isCancellationError(error)) {
            resetDailySwimConsecutiveIfNeeded();
            log.info("脚本已取消");
            return;
        }
        log.error(`脚本运行出错: ${error && error.message ? error.message : error}`);
        notification.error(`脚本运行出错: ${error && error.message ? error.message : error}`);
    } finally {
        // 修复点：无论成功/失败/异常，都必须停止后台循环与释放模板资源
        running = false;
        try { expMat?.Dispose?.(); } catch { }
        try { moraMat?.Dispose?.(); } catch { }
        expMat = null;
        moraMat = null;
    }
})();

function convertToTrueIfNotBoolean(value) {
    // settings 里可能是 undefined/字符串等非布尔值，此处按“未设置则视为开启”处理
    return typeof value === 'boolean' ? value : true;
}

function isCancellationError(error) {
    const msg = error && error.message ? String(error.message) : "";
    return msg.includes("取消自动任务") || msg.includes("A task was canceled.");
}

function isCtsCancellationRequested(cts) {
    try {
        const v =
            cts?.isCancellationRequested ??
            cts?.IsCancellationRequested ??
            cts?.token?.isCancellationRequested ??
            cts?.token?.IsCancellationRequested;
        return v === true;
    } catch {
        return false;
    }
}

function safeGetPositionFromMap() {
    try {
        return genshin.getPositionFromMap();
    } catch (error) {
        if (isCancellationError(error)) {
            throw error;
        }
        return null;
    }
}

function getEnemyConfig(enemyType) {
    // 根据敌人类型返回配置对象（不存在则返回空对象，调用方负责兜底）
    return ENEMY_CONFIG[enemyType] || {};
}

async function prepareForEnemy(enemyType) {
    // 清理丘丘人（仅盗宝团需要）
    if (settings.qiuQiuRen && enemyType === "盗宝团") {
        log.info("清理原住民...");
        await AutoPath("盗宝团-准备");
    }

    const { preparePath } = getEnemyConfig(enemyType);
    if (preparePath) {
        log.info(`导航到${enemyType}触发点...`);
        await AutoPath(preparePath);
    }
}

async function runPostBattle(enemyType) {
    // 战斗后处理：按敌人配置执行附加路径；部分敌人需要对话交互
    const { postBattlePath } = getEnemyConfig(enemyType);
    if (postBattlePath) {
        await AutoPath(postBattlePath);
    }

    if (enemyType === "蕈兽") {
        await sleep(50);
        keyPress("F");
        await sleep(50);
        keyPress("F");
        await sleep(500);
        await genshin.chooseTalkOption("下次");
        await sleep(500);
    }
}

async function recoverAfterFailure(enemyType, skipTp = false) {
    if (!skipTp) {
        await genshin.tpToStatueOfTheSeven();
    }
    const { failReturnPath, failReturnSleepMs, preparePath } = getEnemyConfig(enemyType);
    if (failReturnPath) {
        await AutoPath(failReturnPath);
    } else if (preparePath) {
        await AutoPath(preparePath);
    } else {
        await AutoPath(`${enemyType}-触发点`);
    }
    if (failReturnSleepMs) {
        await sleep(failReturnSleepMs);
    }
}
// 执行 path 任务
async function AutoPath(locationName) {
    // 统一包装路径执行：避免 runFile 抛错导致整个脚本中断
    try {
        const filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
        return true;
    } catch (error) {
        if (isCancellationError(error)) {
            throw error;
        }
        log.error(`执行 ${locationName} 路径时发生错误: ${error.message}`);
        return false;
    }
}

function getTodayKey() {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function normalizePathForCompare(p) {
    if (!p || typeof p !== "string") return "";
    return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function fileExistsSafe(filePath) {
    try {
        if (!filePath || typeof filePath !== "string") return false;
        if (file.isFolder(filePath)) return false;
        const normalized = normalizePathForCompare(filePath);
        const lastSlash = normalized.lastIndexOf("/");
        const dir = lastSlash >= 0 ? normalized.slice(0, lastSlash) : ".";
        const name = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
        const items = file.readPathSync(dir);
        if (!items || items.length === 0) return false;
        for (const item of items) {
            const n = normalizePathForCompare(item);
            if (n === normalized) return true;
            const nLastSlash = n.lastIndexOf("/");
            const nName = nLastSlash >= 0 ? n.slice(nLastSlash + 1) : n;
            if (nName === name) return true;
        }
        return false;
    } catch {
        return false;
    }
}

function loadDailySwimStats() {
    const today = getTodayKey();
    const statsPath = "swim_stats.json";
    try {
        if (!fileExistsSafe(statsPath)) {
            return { date: today, totalSwimCount: 0, consecutiveSwimCount: 0 };
        }
        const raw = file.readTextSync(statsPath);
        const parsed = JSON.parse(raw);
        if (parsed && parsed.date === today) {
            const totalSwimCount = typeof parsed.totalSwimCount === "number"
                ? parsed.totalSwimCount
                : (typeof parsed.swimCount === "number" ? parsed.swimCount : 0);
            const consecutiveSwimCount = typeof parsed.consecutiveSwimCount === "number" ? parsed.consecutiveSwimCount : 0;
            return { date: today, totalSwimCount, consecutiveSwimCount };
        }
    } catch { }
    return { date: today, totalSwimCount: 0, consecutiveSwimCount: 0 };
}

function saveDailySwimStats(stats) {
    const statsPath = "swim_stats.json";
    try {
        file.writeTextSync(statsPath, JSON.stringify(stats, null, 2), false);
    } catch { }
}

function resetDailySwimConsecutiveIfNeeded() {
    const stats = loadDailySwimStats();
    if (stats.consecutiveSwimCount > 0) {
        stats.consecutiveSwimCount = 0;
        saveDailySwimStats(stats);
    }
}

function recordSwimEventAndCheck(consecutiveLimit) {
    const stats = loadDailySwimStats();
    stats.totalSwimCount = (Number(stats.totalSwimCount) || 0) + 1;
    stats.consecutiveSwimCount = (Number(stats.consecutiveSwimCount) || 0) + 1;
    saveDailySwimStats(stats);
    const limit = Number.isFinite(Number(consecutiveLimit)) ? Number(consecutiveLimit) : DEFAULT_SWIM_CONSECUTIVE_LIMIT;
    return {
        totalSwimCount: stats.totalSwimCount,
        consecutiveSwimCount: stats.consecutiveSwimCount,
        consecutiveLimit: limit,
        exceeded: stats.consecutiveSwimCount >= limit
    };
}

const battlePointCache = new Map();

function getBattlePointFromBattlePath(enemyType) {
    if (battlePointCache.has(enemyType)) {
        return battlePointCache.get(enemyType);
    }
    const filePath = `assets/AutoPath/${enemyType}-战斗点.json`;
    let point = null;
    try {
        if (fileExistsSafe(filePath)) {
            const raw = file.readTextSync(filePath);
            const parsed = JSON.parse(raw);
            const positions = parsed && Array.isArray(parsed.positions) ? parsed.positions : null;
            if (positions && positions.length > 0) {
                const last = positions[positions.length - 1];
                if (last && Number.isFinite(Number(last.x)) && Number.isFinite(Number(last.y))) {
                    point = { x: Number(last.x), y: Number(last.y) };
                }
            }
        }
    } catch { }
    if (!point) {
        point = getTargetCoordinates(enemyType);
    }
    battlePointCache.set(enemyType, point);
    return point;
}

async function runBattlePathAndFight(enemyType) {
    const filePath = `assets/AutoPath/${enemyType}-战斗点.json`;
    if (!fileExistsSafe(filePath)) {
        throw new Error(`缺少战斗点路径文件: ${filePath}`);
    }
    const raw = file.readTextSync(filePath);
    const parsed = JSON.parse(raw);
    const positions = parsed && Array.isArray(parsed.positions) ? parsed.positions : null;
    if (!positions || positions.length === 0) {
        throw new Error(`战斗点路径文件无有效 positions: ${filePath}`);
    }

    const last = positions[positions.length - 1];
    const clonedPositions = positions.map(p => ({ ...p }));
    clonedPositions[clonedPositions.length - 1] = {
        ...last,
        action: "fight",
        action_params: last && typeof last.action_params === "string" ? last.action_params : ""
    };

    const payload = {
        ...parsed,
        positions: clonedPositions
    };
    await pathingScript.run(JSON.stringify(payload));
}

// 计算运行时长
function LogTimeTaken(startTimeParam) {
    const currentTime = Date.now();
    const totalTimeInSeconds = (currentTime - startTimeParam) / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = totalTimeInSeconds % 60;
    return `${minutes} 分 ${seconds.toFixed(0).padStart(2, '0')} 秒`;
}

// 计算预估时间
function CalculateEstimatedCompletion(startTime, current, total) {
    if (current === 0) return "计算中...";

    const elapsedTime = Date.now() - startTime;
    const timePerTask = elapsedTime / current;
    const remainingTasks = total - current;
    const remainingTime = timePerTask * remainingTasks;
    const completionDate = new Date(Date.now() + remainingTime);
    return `${completionDate.toLocaleTimeString()} (约 ${Math.round(remainingTime / 60000)} 分钟)`;
}

// 检查并导航到触发点
async function navigateToTriggerPoint(enemyType) {
    await AutoPath(`${enemyType}-触发点`);
    const triggerPoint = getTriggerPoint(enemyType);
    if (!triggerPoint) {
        log.warn(`未配置 ${enemyType} 的 triggerPoint，跳过触发点距离校验`);
        return;
    }
    const pos = safeGetPositionFromMap();

    if (pos) {
        const distance = Math.sqrt(Math.pow(pos.x - triggerPoint.x, 2) + Math.pow(pos.y - triggerPoint.y, 2));
        if (distance <= 8) {
            log.info(`已到达触发点附近，距离: ${distance.toFixed(2)}米`);
        } else {
            log.info(`未到达触发点，当前距离: ${distance.toFixed(2)}米，正在导航...`);
            await AutoPath(`${enemyType}-触发点`);
        }
    }
}

// OCR检测突发任务
async function detectTaskTrigger(ocrTimeout, enemyType) {
    // 修复点：OCR 的截图对象与 findMulti 返回对象可能持有底层资源
    // 必须在 finally 中释放，避免长时间循环导致资源累积
    const ocrKeywords = getOcrKeywords(enemyType);
    let ocrStatus = false;
    let ocrStartTime = Date.now();

    while (Date.now() - ocrStartTime < ocrTimeout * 1000 && !ocrStatus) {
        let captureRegion = null;
        let resList = null;
        try {
            captureRegion = captureGameRegion();
            resList = captureRegion.findMulti(RecognitionObject.ocr(0, 200, 300, 300));
            for (let o = 0; o < resList.count; o++) {
                let res = resList[o];
                try {
                    for (let keyword of ocrKeywords) {
                        if (res && res.text && String(res.text).includes(keyword)) {
                            ocrStatus = true;
                            log.info("检测到突发任务触发");
                            break;
                        }
                    }
                    if (ocrStatus) break;
                } finally {
                    try { res?.Dispose?.(); } catch { }
                    try { res?.dispose?.(); } catch { }
                }
            }
        } catch (error) {
            if (isCancellationError(error)) {
                throw error;
            }
            log.error(`OCR检测突发任务过程中出错: ${error && error.message ? error.message : error}`);
        } finally {
            try { resList?.dispose?.(); } catch { }
            try { resList?.Dispose?.(); } catch { }
            try { captureRegion?.dispose?.(); } catch { }
            try { captureRegion?.Dispose?.(); } catch { }
        }

        if (!ocrStatus) {
            await sleep(1000);
        }
    }

    return ocrStatus;
}

// 等待角色到达目标位置
async function waitForTargetPosition(pathTask, targetCoords, maxWaitTime = 15000, maxDistance = 5) {
    const waitStartTime = Date.now();
    let isNearTarget = false;
    let pathTaskFinished = false;
    let sawPosition = false;

    // 监控路径任务完成
    pathTask.then(() => {
        pathTaskFinished = true;
        log.info("路径任务已完成");
    }).catch(error => {
        pathTaskFinished = true;
        if (isCancellationError(error)) {
            log.info("路径任务已取消");
            return;
        }
        log.error(`路径任务出错: ${error}`);
    });

    // 等待角色到达目标位置或超时
    while (!isNearTarget && !pathTaskFinished && (Date.now() - waitStartTime < maxWaitTime)) {
        const pos = safeGetPositionFromMap();
        if (pos) {
            sawPosition = true;
            const distance = Math.sqrt(Math.pow(pos.x - targetCoords.x, 2) + Math.pow(pos.y - targetCoords.y, 2));
            if (distance <= maxDistance) {
                isNearTarget = true;
                log.info(`已到达目标点附近，距离: ${distance.toFixed(2)}米`);
                break;
            }
        }
        await sleep(1000);
    }

    return { isNearTarget, pathTaskFinished, sawPosition };
}

// 执行战斗任务（并发执行战斗和结果检测）
async function executeBattleTasks(fightTimeout, enemyType, cts) {
    // 修复点：
    // - 以前只要“检测任务 fulfilled”就当成功；现在明确区分 success/failure/out_of_area 等状态
    // - 取消只意味着停止战斗任务，不等价于“本轮战斗成功”
    log.info("开始战斗!");

    let battleTask;
    let battleResult = null;
    let battleDetectTask = null;
    try {
        if (settings.disableAsyncFight) {
            // 同步战斗模式：由宿主的战斗结束检测/策略决定何时返回
            await dispatcher.RunTask(new SoloTask("AutoFight"));
            const maxDetectMs = Math.max(0, Number(fightTimeout) * 1000);
            const graceMs = Math.min(8000, maxDetectMs);
            try {
                const status = await waitForBattleResult(graceMs, enemyType, new CancellationTokenSource());
                return { success: status === "success", status };
            } catch (error) {
                if (error && error.message && String(error.message).includes("战斗超时")) {
                    return { success: false, status: "auto_fight_ended" };
                }
                throw error;
            }
        } else {
            // 异步战斗模式：并发启动战斗 + OCR 检测结果；检测到结果后取消战斗任务
            battleTask = dispatcher.RunTask(new SoloTask("AutoFight"), cts);
            battleDetectTask = waitForBattleResult(fightTimeout * 1000, enemyType, cts);
            const maxDetectMs = Math.max(0, Number(fightTimeout) * 1000);
            const graceMs = Math.min(8000, maxDetectMs);

            const battleWrapped = battleTask
                .then(value => ({ kind: "battle_fulfilled", value }))
                .catch(error => ({ kind: "battle_rejected", error }));

            const detectWrapped = battleDetectTask
                .then(status => ({ kind: "detect_fulfilled", status }))
                .catch(error => ({ kind: "detect_rejected", error }));

            const first = await Promise.race([battleWrapped, detectWrapped]);

            if (first.kind === "detect_fulfilled") {
                log.info("战斗检测任务完成");
                return { success: first.status === "success", status: first.status };
            }
            if (first.kind === "detect_rejected") {
                throw first.error;
            }

            battleResult = first;
            if (first.kind === "battle_rejected" && isCancellationError(first.error)) {
                throw first.error;
            }

            const second = await Promise.race([
                detectWrapped,
                sleep(graceMs).then(() => ({ kind: "detect_timeout" }))
            ]);

            if (second.kind === "detect_fulfilled") {
                log.info("战斗检测任务完成");
                return { success: second.status === "success", status: second.status };
            }
            if (second.kind === "detect_rejected") {
                throw second.error;
            }

            return { success: false, status: "auto_fight_ended" };
        }
    } catch (error) {
        // 过滤掉正常的取消错误
        if (isCancellationError(error)) {
            log.info("战斗任务已取消");
            return { success: false, status: "cancelled" };
        }
        const msg = error && error.message ? String(error.message) : "";
        if (msg.includes("前往七天神像重试") || msg.includes("检测到游泳")) {
            log.warn(`战斗执行异常（已自动回七天神像）: ${msg}`);
            return { success: false, status: "recovered_to_statue", errorMessage: msg };
        }
        log.error(`战斗执行过程中出错: ${msg}`);
        return { success: false, status: "error", errorMessage: msg };
    } finally {
        // 确保战斗任务被等待完成（即使被取消）
        if (battleTask) {
            try {
                await battleTask;
            } catch (error) {
                // 忽略 finally 块中的取消错误
                if (!isCancellationError(error)) {
                    log.warn(`清理战斗任务时出错: ${error.message}`);
                }
            }
        }
        keyUp("VK_LBUTTON");
    }
}

// 执行单次好感任务循环
async function executeSingleFriendshipRound(roundIndex, ocrTimeout, fightTimeout, enemyType) {
    // 单轮流程：
    // 1) 导航到触发点附近
    // 2) 通过 OCR 判断是否已触发突发任务
    // 3) 导航到战斗点（避免与失败回退路径并发冲突）
    // 4) 启动战斗 + OCR 判定胜负/是否离开区域
    // 5) 成功则执行战斗后流程；失败则回退到准备/触发点并进入下一轮
    // 导航到触发点
    await navigateToTriggerPoint(enemyType);
    const { initialDelayMs } = getEnemyConfig(enemyType);
    if (roundIndex === 0 && initialDelayMs) {
        await sleep(initialDelayMs);
    }
    let initialDetected = false;
    if (roundIndex === 0) {
        initialDetected = await detectTaskTrigger(3, enemyType);
    }
    if (!detectedExpOrMora && settings.loopTillNoExpOrMora) {
        NoExpOrMoraCount++;
        log.warn("上次运行未检测到经验或摩拉");
        if (NoExpOrMoraCount >= 2) {
            log.warn("连续两次循环没有经验或摩拉掉落，提前终止");
            return false;
        }
    } else {
        NoExpOrMoraCount = 0;
        detectedExpOrMora = false;
    }
    if (!initialDetected || roundIndex > 0) {
        if (settings.use1000Stars) {
            await genshin.wonderlandCycle();
        } else {
            await genshin.relogin();
        }
    }

    const ocrStatus = await detectTaskTrigger(ocrTimeout, enemyType);

    if (!ocrStatus) {
        // 本轮未检测到突发任务：按设计直接结束整个脚本循环
        notification.send(`未识别到突发任务，${enemyType}好感结束`);
        log.info(`未识别到突发任务，${enemyType}好感结束`);
        resetDailySwimConsecutiveIfNeeded();
        return false; // 返回 false 表示需要终止循环
    }

    // 修复点：先确认触发，再执行导航；避免“未触发时仍去战斗点”以及失败时多路径并发
    const battlePointCoords = getBattlePointFromBattlePath(enemyType);
    if (!battlePointCoords) {
        throw new Error(`未配置 ${enemyType} 的 targetCoords`);
    }

    const maxDetectMs = Math.max(0, Number(fightTimeout) * 1000);
    const battleDetectCts = new CancellationTokenSource();
    const battleDetectPromise = waitForBattleResult(maxDetectMs, enemyType, battleDetectCts, battlePointCoords);

    try {
        log.info("开始战斗!");
        await runBattlePathAndFight(enemyType);
    } catch (e) {
        try { battleDetectCts.cancel(); } catch { }
        if (isCancellationError(e)) throw e;
        const msg = e && e.message ? String(e.message) : "";
        if (msg.includes("前往七天神像重试") || msg.includes("检测到游泳")) {
            const { totalSwimCount, consecutiveSwimCount, consecutiveLimit, exceeded } = recordSwimEventAndCheck(settings.swimConsecutiveLimit);
            log.warn(`检测到游泳异常，今日累计 ${totalSwimCount} 次，连续 ${consecutiveSwimCount}/${consecutiveLimit} 次`);
            if (exceeded) {
                throw new Error(`当日连续触发游泳已达 ${consecutiveLimit} 次，战斗策略或配队严重不合理`);
            }
            throw new Error("检测到游泳且自动回七天神像，视为本轮失败");
        }
        throw e;
    }
    const battleStatus = await battleDetectPromise;
    if (battleStatus === "cancelled") {
        throw new Error("战斗任务已取消");
    }
    resetDailySwimConsecutiveIfNeeded();

    await runPostBattle(enemyType);

    // 返回 true 表示成功完成这一轮
    return true;
}

// 记录进度信息
function logProgress(startTime, currentRound, totalRounds) {
    const estimatedCompletion = CalculateEstimatedCompletion(startTime, currentRound + 1, totalRounds);
    const currentTime = LogTimeTaken(startTime);
    log.info(`当前进度：${currentRound + 1}/${totalRounds} (${((currentRound + 1) / totalRounds * 100).toFixed(1)}%)`);
    log.info(`当前运行总时长：${currentTime}`);
    log.info(`预计完成时间：${estimatedCompletion}`);
}

// 执行 N 次好感任务并输出日志 - 重构后的主函数
async function AutoFriendshipDev(times, ocrTimeout, fightTimeout, enemyType = "盗宝团") {
    // 主循环：执行指定次数或在 detectTaskTrigger 判定“未触发”时提前退出
    // 修复点：finally 中统一关闭 running 并等待 detectExpOrMoraTask 退出，避免后台循环残留
    const startFirstTime = Date.now();
    let detectExpOrMoraTask;
    let cancelled = false;
    let successCount = 0;
    let failureCount = 0;
    try {
        if (settings.loopTillNoExpOrMora) {
            detectExpOrMoraTask = detectExpOrMora();
        }
        for (let i = 0; i < times; i++) {
            try { await sleep(1); } catch (e) { break; }
            try {
                const success = await executeSingleFriendshipRound(i, ocrTimeout, fightTimeout, enemyType);
                if (!success)
                    break;
                successCount++;
                logProgress(startFirstTime, i, times);
            } catch (error) {
                if (isCancellationError(error)) {
                    cancelled = true;
                    throw error;
                }
                failureCount++;
                log.error(`第 ${i + 1} 轮好感任务失败: ${error.message}`);
                if (error.message && error.message.includes("战斗超时")) {
                    throw error;
                }
                if (error.message && error.message.includes("当日连续触发游泳")) {
                    throw error;
                }
                continue;
            }
        }
        if (!cancelled) {
            log.info(`${enemyType} 好感已完成`);
        }
    } finally {
        if (!cancelled) {
            const stats = loadDailySwimStats();
            const limit = Number.isFinite(Number(settings.swimConsecutiveLimit)) ? Number(settings.swimConsecutiveLimit) : DEFAULT_SWIM_CONSECUTIVE_LIMIT;
            log.info(`本次运行统计：成功 ${successCount} 次，失败 ${failureCount} 次，今日游泳累计 ${stats.totalSwimCount} 次，连续游泳 ${stats.consecutiveSwimCount}/${limit} 次`);
        }
        running = false;
        if (detectExpOrMoraTask) {
            try { await detectExpOrMoraTask; } catch { }
        }
    }
}

async function detectExpOrMora() {
    // 后台循环：通过模板匹配检测经验/摩拉图标
    // 注意：该循环依赖 running 停止；必须保证任何退出路径都会把 running=false
    while (running) {
        try { await sleep(1); } catch (e) { break; }
        let gameRegion;
        if (!detectedExpOrMora) {
            try {
                gameRegion = captureGameRegion();
                const res1 = gameRegion.find(expRo);
                if (res1.isExist()) {
                    log.info("识别到经验");
                    detectedExpOrMora = true;
                    continue;
                }
                const res2 = gameRegion.find(moraRo);
                if (res2.isExist()) {
                    log.info("识别到摩拉");
                    detectedExpOrMora = true;
                    continue;
                }
            } catch (e) {
                log.error(`检测经验和摩拉掉落过程中出现错误 ${e.message}`);
            } finally {
                try { gameRegion?.dispose?.(); } catch { }
                try { gameRegion?.Dispose?.(); } catch { }
            }
        } else {
            //无需检测时额外等待200
            await sleep(200);
        }
        await sleep(200);
    }
}

async function calulateRunTimes() {
    // 从 settings 读取次数并校验；非法则回退默认值
    log.info(`'请确保队伍满员，并为队伍配置相应的战斗策略'`);
    // 计算运行次数
    let runTimes = Number(settings.runTimes);
    if (!isPositiveInteger(runTimes)) {
        log.warn("请输入正确的次数，必须是正整数！");
        log.warn(`运行次数重置为 ${DEFAULT_RUNS} 次！`);
        runTimes = DEFAULT_RUNS;
    }

    log.info(`当前设置的运行次数: ${runTimes}`);
    return runTimes;
}

// 验证输入是否是正整数
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

// 根据敌人类型获取OCR关键词
function getOcrKeywords(enemyType) {
    // OCR 关键词获取：优先使用敌人类型配置，否则回退到默认关键词
    const { ocrKeywords } = getEnemyConfig(enemyType);
    return ocrKeywords || DEFAULT_OCR_KEYWORDS;
}

// 根据敌人类型获取目标战斗点坐标
function getTargetCoordinates(enemyType) {
    const { targetCoords } = getEnemyConfig(enemyType);
    return targetCoords;
}

function getTriggerPoint(enemyType) {
    const { triggerPoint } = getEnemyConfig(enemyType);
    return triggerPoint;
}

// 验证日期格式
async function switchPartyIfNeeded(partyName) {
    // 可选队伍切换：为空则直接回到主界面，避免停留在菜单/对话等状态
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }
    try {
        log.info("正在尝试切换至" + partyName);
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(partyName);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}

async function waitForBattleResult(timeout = 2 * 60 * 1000, enemyType = "盗宝团", cts = new CancellationTokenSource(), battlePointCoords = null) {
    // 战斗结果 OCR 判定：
    // - 返回 "success"：识别到成功关键字/特殊条件
    // - 返回 "failure"：识别到失败关键字
    // - 返回 "out_of_area"：连续多次识别不到事件关键字，认为离开触发区域
    // - 超时：抛出 Error("战斗超时，未检测到结果")
    //
    // 修复点：这里不做 tp/跑路径，只做“结果判定 + cts.cancel()”
    // 失败后的恢复统一在 executeSingleFriendshipRound 中串行处理，避免路径并发冲突
    const fightStartTime = Date.now();
    const successKeywords = ["事件", "完成"];
    const failureKeywords = ["失败"];
    const eventKeywords = getOcrKeywords(enemyType);
    const pollIntervalMs = 1000;
    let notFind = 0;

    while (Date.now() - fightStartTime < timeout) {
        if (isCtsCancellationRequested(cts)) {
            return "cancelled";
        }
        let capture = null;
        try {
            capture = captureGameRegion();
            // 沿用最初版写死的 OCR 框（1080p 下的“事件完成”识别区域）
            let result = capture.find(RecognitionObject.ocr(850, 150, 200, 80));
            let result2 = capture.find(RecognitionObject.ocr(0, 200, 300, 300));
            let text = result && result.text ? String(result.text) : "";
            text = text ? text.replace(/\s+/g, "") : "";
            let text2 = result2 && result2.text ? String(result2.text) : "";
            text2 = text2 ? text2.replace(/\s+/g, "") : "";
            if (enemyType === "蕈兽" && text2.includes("维沙瓦")) {
                log.info("战斗结果：成功");
                cts.cancel();
                return "success";
            }

            // 检查成功关键词：只要开战后识别到“事件/完成”等关键词即可认为本轮结束
            if (Date.now() - fightStartTime >= 2000) {
                for (let keyword of successKeywords) {
                    if (text.includes(keyword)) {
                        log.info("检测到战斗成功关键词: {0}", keyword);
                        log.info("战斗结果：成功");
                        cts.cancel(); // 取消任务
                        return "success";
                    }
                }
            }

            // 检查失败关键词
            for (let keyword of failureKeywords) {
                if (text.includes(keyword)) {
                    log.warn("检测到战斗失败关键词: {0}", keyword);
                    cts.cancel(); // 取消任务
                    return "failure";
                }
            }
            if (enemyType !== "蕈兽") {
                // 检查事件关键词
                let find = 0;
                for (let keyword of eventKeywords) {
                    if (text2.includes(keyword)) {
                        find++;
                    }
                }

                if (find === 0) {
                    notFind++;
                    log.info("未检测到任务触发关键词：{0} 次", notFind);
                } else {
                    notFind = 0;
                }

                if (notFind > 10) {
                    let nearBattlePoint = false;
                    if (battlePointCoords && Number.isFinite(Number(battlePointCoords.x)) && Number.isFinite(Number(battlePointCoords.y))) {
                        const pos = safeGetPositionFromMap();
                        if (pos && typeof pos === "object") {
                            const dx = Number(pos.x) - Number(battlePointCoords.x);
                            const dy = Number(pos.y) - Number(battlePointCoords.y);
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            nearBattlePoint = Number.isFinite(dist) && dist <= 25;
                        }
                    }

                    if (nearBattlePoint) {
                        log.info("触发关键词消失但仍在战斗点附近，视为本轮结束");
                        cts.cancel();
                        return "success";
                    }

                    log.warn("不在任务触发区域，战斗失败");
                    cts.cancel(); // 取消任务
                    return "out_of_area";

                }
            }
        }
        catch (error) {
            log.error("OCR过程中出错: {0}", error);
            // 出错后继续循环，不进行额外嵌套处理
        }
        finally {
            try { capture?.dispose?.(); } catch { }
            try { capture?.Dispose?.(); } catch { }
        }

        // 统一的检查间隔
        await sleep(pollIntervalMs);
    }

    log.warn("在超时时间内未检测到战斗结果");
    cts.cancel(); // 取消任务
    throw new Error("战斗超时，未检测到结果");
}

/**
 * 验证超时时间设置
 * @param {number|string} value - 用户设置的超时时间（秒）
 * @param {number} defaultValue - 默认超时时间（秒）
 * @param {string} timeoutType - 超时类型名称
 * @returns {number} - 验证后的超时时间（秒）
 */
function validateTimeoutSetting(value, defaultValue, timeoutType) {
    // 转换为数字
    const timeout = Number(value);

    // 检查是否为有效数字且大于0
    if (!isFinite(timeout) || timeout <= 0) {
        log.warn(`${timeoutType} 超时设置无效，必须是大于0的数字，将使用默认值 ${defaultValue} 秒`);
        return defaultValue;
    }

    log.info(`${timeoutType}超时设置为 ${timeout} 秒`);
    return timeout;
}

