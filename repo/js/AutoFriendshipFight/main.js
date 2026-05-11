// 掉落检测状态
// detectedExpOrMora：上一轮是否识别到经验/摩拉图标（用于判断“连续两轮都没有掉落则停”）
// noExpOrMoraCount：连续“没有识别到掉落”的计数器
let detectedExpOrMora = true;
let noExpOrMoraCount = 0;
let running = true;
let fighting = false;
let consecutiveMaxRetryCount = 0;

const warnedEnemyTypes = new Set();

// 默认突发任务 OCR 关键词（敌人配置未提供时使用）
const DEFAULT_OCR_KEYWORDS = ["突发", "任务", "打倒", "消灭", "敌人", "所有"];

// 各敌人类型的参数配置
// - ocrKeywords：用于 detectTaskTrigger / waitForBattleResult 的 OCR 关键字
// - preparePath：准备路径（通常是传送点->触发区域附近）
// - postBattlePath：战斗后补充路径（如拾取/对话）
// - failReturnPath：失败后的回退路径（通常回到准备点/触发点）
// - failReturnSleepMs：失败回退后额外等待（给加载/稳定留时间）
// - initialDelayMs：首轮额外等待（给地图/加载/触发留时间）
const ENEMY_CONFIG = {
    "愚人众": {
        ocrKeywords: ["买卖", "不成", "正义存", "愚人众", "禁止", "危险", "运输", "打倒", "盗宝团", "丘丘人", "今晚", "伙食", "所有人"],
        preparePath: "愚人众-准备",
        failReturnPath: "愚人众-准备",
    },
    "盗宝团": {
        ocrKeywords: ["岛上", "无贼", "消灭", "鬼鬼祟祟", "盗宝团"],
    },
    "鳄鱼": {
        ocrKeywords: ["张牙", "舞爪", "恶党", "鳄鱼", "打倒", "所有", "鳄鱼"],
        preparePath: "鳄鱼-准备",
        failReturnPath: "鳄鱼-准备",
        failReturnSleepMs: 5000,
        initialDelayMs: 5000,
        postBattlePath: "鳄鱼-拾取",
    },
    "蕈兽": {
        ocrKeywords: ["实验家", "变成", "实验品", "击败", "所有", "魔物"],
        preparePath: "蕈兽-准备",
        postBattlePath: "蕈兽-对话",
    },
    "雷萤术士": {
        ocrKeywords: ["雷萤", "术士", "圆滚滚", "不可食用", "威撼", "攀岩", "消灭", "准备", "打倒", "所有", "魔物", "盗宝团", "击败", "成员", "盗亦无道"],
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

const GAME_REGION_CACHE_SIZE = 3; // 游戏区域截图缓存大小上限
const gameRegionManager = {
    cache: [], // 缓存队列，保存近GAME_REGION_CACHE_SIZE张截图
    lastCapture: new Date(),
    isDisposing: false,
    isCapturing: false
};

let runTimes = parseNumericSetting(settings.runTimes, 10);
let enemyType = settings.enemyType || "盗宝团";
const ocrTimeout = parseNumericSetting(settings.ocrTimeout, 10);
const fightTimeout = parseNumericSetting(settings.fightTimeout, 120);
(async function () {
    const startTime = Date.now();
    await switchPartyIfNeeded(settings.partyName);
    log.info(`当前选择的敌人类型: ${enemyType}`);
    log.info(`${enemyType}好感开始...`);
    if (settings.disablePickup) {
        log.info("已 禁用 自动拾取任务");
    } else {
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        log.info("已 启用 自动拾取任务");
    }
    //准备
    try {
        // 清理丘丘人（仅盗宝团需要）
        const qiuQiuRenTimeout = parseNumericSetting(settings.qiuQiuRen, 0);
        if (qiuQiuRenTimeout > 0 && enemyType === "盗宝团") {
            log.info("清理原住民...");
            await AutoPath("盗宝团-准备");

            log.info("开始清理战斗，超时时间: {0}秒...", qiuQiuRenTimeout);
            const clearCts = new CancellationTokenSource();
            try {
                if (settings.disableAsyncFight) {
                    fighting = true;
                    await dispatcher.runTask(new SoloTask("AutoFight"));
                    fighting = false;
                } else {
                    const clearTask = dispatcher.runTask(new SoloTask("AutoFight"), clearCts);
                    fighting = true;
                    const maxLoops = Math.ceil(4 * qiuQiuRenTimeout);
                    const timeoutTask = (async () => {
                        for (let i = 0; i < maxLoops; i++) {
                            try { await sleep(1) } catch (e) { break; }
                            if (!fighting) break;
                            await sleep(250);
                        }
                        if (fighting) {
                            try { clearCts.cancel(); } catch { }
                        }
                    })();
                    await clearTask;
                    fighting = false;
                    await Promise.allSettled([clearTask, timeoutTask]);
                }
            } catch (e) {
                log.warn(`清理战斗异常: ${e.message}`);
            } finally {
                fighting = false;
                try { clearCts.cancel(); } catch { }
            }
        }

        const { preparePath } = getEnemyConfig(enemyType);
        if (preparePath) {
            log.info(`导航到${enemyType}触发点...`);
            await AutoPath(preparePath);
        }
    } catch (error) { }
    //主循环
    try {
        await AutoFriendshipDev();
        log.info(`${enemyType}好感运行总时长：${LogTimeTaken(startTime)}`);
    } catch (error) { log.error(`主循环中出现错误 ${error.message}`) }
})();

/**
 * 获取地图坐标，失败时返回 null
 * @returns {{x:number,y:number}|null}
 */
function safeGetPositionFromMap() {
    try {
        return genshin.getPositionFromMap();
    } catch (error) {
        return null;
    }
}

/**
 * 获取敌人配置；未知 enemyType 仅提示一次并回退为空配置。
 * @param {string} enemyType
 * @returns {object}
 */
function getEnemyConfig(enemyType) {
    // 根据敌人类型返回配置对象（不存在则返回空对象，调用方负责兜底）
    const cfg = ENEMY_CONFIG[enemyType];
    if (!cfg && !warnedEnemyTypes.has(enemyType)) {
        warnedEnemyTypes.add(enemyType);
        log.warn(`未知 enemyType: ${enemyType}，将使用默认配置`);
    }
    return cfg || {};
}

/**
 * 战后附加流程：按敌人配置跑 postBattlePath；蕈兽包含对话交互。
 * @returns {Promise<void>}
 */
async function runPostBattle() {
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

/**
 * 失败恢复：回七天神像并走回退路径。
 * @returns {Promise<void>}
 */
async function recoverAfterFailure() {
    //失败统一返回七天神像
    await genshin.tpToStatueOfTheSeven();
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

/**
 * 执行路径文件（AutoPath/*.json）；失败返回 false，取消错误透传。
 * @param {string} locationName
 * @returns {Promise<boolean>}
 */
async function AutoPath(locationName) {
    // 统一包装路径执行：避免 runFile 抛错导致整个脚本中断
    try {
        const filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
        return true;
    } catch (error) {
        log.error(`执行 ${locationName} 路径时发生错误: ${error.message}`);
        return false;
    }
}

/**
 * 计算从 startTime 到现在的耗时字符串。
 * @param {number} startTimeParam
 * @returns {string}
 */
function LogTimeTaken(startTimeParam) {
    const currentTime = Date.now();
    const totalTimeInSeconds = (currentTime - startTimeParam) / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = totalTimeInSeconds % 60;
    return `${minutes} 分 ${seconds.toFixed(0).padStart(2, '0')} 秒`;
}

/**
 * 估算完成时间（按平均单轮耗时线性推算）。
 * @param {number} startTime
 * @param {number} current
 * @param {number} total
 * @returns {string}
 */
function CalculateEstimatedCompletion(startTime, current, total) {
    if (current === 0) return "计算中...";

    const elapsedTime = Date.now() - startTime;
    const timePerTask = elapsedTime / current;
    const remainingTasks = total - current;
    const remainingTime = timePerTask * remainingTasks;
    const completionDate = new Date(Date.now() + remainingTime);
    return `${completionDate.toLocaleTimeString()} (约 ${Math.round(remainingTime / 60000)} 分钟)`;
}

/**
 * 导航到触发点
 * @returns {Promise<void>}
 */
async function navigateToTriggerPoint() {
    const path = `assets/AutoPath/${enemyType}-触发点.json`;
    let triggerPoint = null;

    try {
        const content = await file.readText(path);
        const data = JSON.parse(content);
        if (data.positions && Array.isArray(data.positions) && data.positions.length > 0) {
            const lastPosition = data.positions[data.positions.length - 1];
            triggerPoint = { x: lastPosition.x, y: lastPosition.y };
        }
    } catch (error) {
        log.warn(`读取触发点配置失败: ${error.message}`);
    }

    if (!triggerPoint) {
        log.warn(`未配置 ${enemyType} 的 triggerPoint，跳过触发点距离校验`);
        return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try { await sleep(1) } catch (e) { break; }
        if (!running) {
            break;
        }
        const pos = safeGetPositionFromMap();

        if (pos) {
            const distance = Math.sqrt(Math.pow(pos.x - triggerPoint.x, 2) + Math.pow(pos.y - triggerPoint.y, 2));
            if (distance <= 8) {
                log.info(`已到达触发点附近，距离: ${distance.toFixed(2)}米`);
                return;
            } else {
                log.info(`未到达触发点，当前距离: ${distance.toFixed(2)}米，正在导航...`);
            }
        }

        await AutoPath(`${enemyType}-触发点`);
        retryCount++;
    }
}

/**
 * 导航到战斗点
 * @returns {Promise<void>}
 */
async function navigateToBattlePoint() {
    const path = `assets/AutoPath/${enemyType}-战斗点.json`;
    let battlePoint = null;

    try {
        const content = await file.readText(path);
        const data = JSON.parse(content);
        if (data.positions && Array.isArray(data.positions) && data.positions.length > 0) {
            const lastPosition = data.positions[data.positions.length - 1];
            battlePoint = { x: lastPosition.x, y: lastPosition.y };
        }
    } catch (error) {
        log.warn(`读取战斗点配置失败: ${error.message}`);
    }

    if (!battlePoint) {
        log.warn(`未配置 ${enemyType} 的 battlePoint，跳过战斗点距离校验`);
        return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try { await sleep(1) } catch (e) { break; }
        if (!running) {
            break;
        }
        const pos = safeGetPositionFromMap();

        if (pos) {
            const distance = Math.sqrt(Math.pow(pos.x - battlePoint.x, 2) + Math.pow(pos.y - battlePoint.y, 2));
            if (distance <= 8) {
                log.info(`已到达战斗点附近，距离: ${distance.toFixed(2)}米`);
                return;
            } else {
                log.info(`未到达战斗点，当前距离: ${distance.toFixed(2)}米，正在导航...`);
            }
        }

        await AutoPath(`${enemyType}-战斗点`);
        retryCount++;
    }
}

// OCR检测突发任务
/**
 * OCR 检测是否触发突发任务。
 * @returns {Promise<boolean>}
 */
async function detectTaskTrigger() {
    // 修复点：OCR 的截图对象与 findMulti 返回对象可能持有底层资源
    // 必须在 finally 中释放，避免长时间循环导致资源累积
    const ocrKeywords = getOcrKeywords(enemyType);
    let ocrStatus = false;
    let ocrStartTime = Date.now();

    while (Date.now() - ocrStartTime < ocrTimeout * 1000 && !ocrStatus) {
        try { await sleep(1) } catch (e) { break; }
        if (!running) {
            break;
        }
        let resList = null;
        try {
            resList = (await getGameRegion()).findMulti(RecognitionObject.ocr(0, 200, 300, 300));
            for (let o = 0; o < resList.count; o++) {
                let res = resList[o];
                for (let keyword of ocrKeywords) {
                    if (res && res.text && String(res.text).includes(keyword)) {
                        ocrStatus = true;
                        log.info("检测到突发任务触发");
                        break;
                    }
                }
                if (ocrStatus) break;
            }
        } catch (error) {
            log.error(`OCR检测突发任务过程中出错: ${error && error.message ? error.message : error}`);
        }

        if (!ocrStatus) {
            await sleep(1000);
        }
    }
    return ocrStatus;
}

/**
 * 执行 AutoFight 战斗任务。
 * @returns {Promise<{status:string,errorMessage?:string}>}
 * 
 * @description
 * 使用全局变量：settings.disableAsyncFight, fightTimeout, enemyType
 * 
 * 支持两种战斗模式：
 * - 同步模式 (disableAsyncFight=true): 直接执行 AutoFight，依赖配置组的"战斗结束检测"自行退出
 * - 异步模式 (默认): 启动战斗任务后等待 OCR 检测结果，检测到结果后取消战斗
 * 
 * 错误处理：捕获所有异常并返回错误信息，不向上抛出
 * 清理工作：无论成功失败，最终都会释放鼠标左键
 */
async function executeBattleTasks() {
    log.info("开始战斗!");
    const cts = new CancellationTokenSource();
    try {
        if (settings.disableAsyncFight) {
            // 同步模式：直接执行战斗，依赖配置组的"战斗结束检测"自行退出
            await dispatcher.runTask(new SoloTask("AutoFight"));
            return { status: "success" };
        } else {
            // 异步模式：并发启动战斗 + OCR 检测结果
            const fightTask = dispatcher.runTask(new SoloTask("AutoFight"), cts);
            fighting = true;
            const statusPromise = waitForBattleResult(cts);
            await fightTask;
            fighting = false;
            const results = await Promise.allSettled([fightTask, statusPromise]);
            const status = results[1].value;
            return { status };
        }
    } catch (error) {
        const msg = error && error.message ? String(error.message) : "";
        // 特别处理：如果是"取消自动任务"错误，视为成功
        if (msg.includes("取消自动任务")) {
            return { status: "success" };
        }
        log.error(`战斗执行过程中出错: ${msg}`);
        return { status: "error", errorMessage: msg };
    } finally {
        try { cts.cancel(); } catch { }
        keyUp("VK_LBUTTON");
    }
}

/**
 * OCR 轮询战斗结果：success/failure/out_of_area/cancelled；超时抛 BATTLE_TIMEOUT。
 * @param {*} cts - CancellationTokenSource，用于取消任务
 * @returns {Promise<"success"|"failure"|"out_of_area"|"cancelled">}
 * 
 * @description
 * 使用全局变量：fightTimeout, enemyType
 */
async function waitForBattleResult(cts = null) {
    const timeout = fightTimeout * 1000;
    // 战斗结果 OCR 判定：
    // - 返回 "success"：识别到成功关键字/特殊条件
    // - 返回 "failure"：识别到失败关键字
    // - 返回 "out_of_area"：连续多次识别不到事件关键字，认为离开触发区域
    // - 超时：抛出 Error("战斗超时，未检测到结果")
    //
    // 失败后的恢复统一在 executeSingleFriendshipRound 中串行处理，避免路径并发冲突
    const fightStartTime = Date.now();
    const successKeywords = ["事件", "完成"];
    const failureKeywords = ["失败"];
    const eventKeywords = getOcrKeywords(enemyType);
    const pollIntervalMs = 500;
    let notFind = 0;

    while (Date.now() - fightStartTime < timeout) {
        try { await sleep(1) } catch (e) { break; }
        if (!running) {
            break;
        }
        if (!fighting) {
            break;
        }
        let result = null;
        let result2 = null;
        try {
            // 沿用最初版写死的 OCR 框（1080p 下的“事件完成”识别区域）
            result = (await getGameRegion()).find(RecognitionObject.ocr(850, 150, 200, 80));
            result2 = (await getGameRegion()).find(RecognitionObject.ocr(0, 200, 300, 300));
            let text = result && result.text ? String(result.text) : "";
            text = text ? text.replace(/\s+/g, "") : "";
            let text2 = result2 && result2.text ? String(result2.text) : "";
            text2 = text2 ? text2.replace(/\s+/g, "") : "";
            if (enemyType === "蕈兽" && text2.includes("维沙瓦")) {
                log.info("战斗结果：成功");
                try { cts.cancel(); } catch { } // 取消任务
                return "success";
            }

            // 检查成功关键词：只要开战后识别到“事件/完成”等关键词即可认为本轮结束
            if (Date.now() - fightStartTime >= 2000) {
                for (let keyword of successKeywords) {
                    if (text.includes(keyword)) {
                        log.info("检测到战斗成功关键词: {0}", keyword);
                        log.info("战斗结果：成功");
                        try { cts.cancel(); } catch { } // 取消任务
                        return "success";
                    }
                }
            }

            // 检查失败关键词
            for (let keyword of failureKeywords) {
                if (text.includes(keyword)) {
                    log.warn("检测到战斗失败关键词: {0}", keyword);
                    try { cts.cancel(); } catch { } // 取消任务
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
                        try { cts.cancel(); } catch { } // 取消任务
                        return "success";
                    }

                    log.warn("不在任务触发区域，战斗失败");
                    try { cts.cancel(); } catch { } // 取消任务
                    return "out_of_area";

                }
            }
        }
        catch (error) {
            log.error("OCR过程中出错", error);
        }
        // 统一的检查间隔
        await sleep(pollIntervalMs);
    }

    log.warn("在超时时间内未检测到战斗结果");
    try { cts.cancel(); } catch { } // 取消任务
}

// 执行单次好感任务循环
/**
 * 执行单轮好感流程（触发检测→导航→战斗→判定→战后/恢复）。
 * @param {number} roundIndex
 * @returns {Promise<boolean>} 返回 false 表示整体应提前结束
 */
async function executeSingleFriendshipRound(roundIndex) {
    // 单轮流程：
    // 1) 导航到触发点附近
    // 2) 通过 OCR 判断是否已触发突发任务
    // 3) 导航到战斗点（避免与失败回退路径并发冲突）
    // 4) 启动战斗 + OCR 判定胜负/是否离开区域
    // 5) 成功则执行战斗后流程；失败则回退到准备/触发点并进入下一轮

    // 导航到触发点
    await navigateToTriggerPoint();
    //根据经验/摩拉决定是否需要终止任务
    if (!detectedExpOrMora && settings.loopTillNoExpOrMora) {
        noExpOrMoraCount++;
        log.warn("上次运行未检测到经验或摩拉");
        if (noExpOrMoraCount >= 2) {
            log.warn("连续两次循环没有经验或摩拉掉落，提前终止");
            return false;
        }
    } else {
        noExpOrMoraCount = 0;
        detectedExpOrMora = false;
    }
    //检测任务是否触发
    const { initialDelayMs } = getEnemyConfig(enemyType);

    if (roundIndex === 0 && initialDelayMs) {
        await sleep(initialDelayMs);
    }
    let ocrStatus;
    if (roundIndex === 0) {
        ocrStatus = await detectTaskTrigger();
    }
    if (!ocrStatus) {
        if (settings.use1000Stars) {
            await genshin.wonderlandCycle();
        } else {
            await genshin.relogin();
        }
        ocrStatus = await detectTaskTrigger();
    }
    if (!ocrStatus) {
        // 本轮未检测到突发任务：按设计直接结束整个脚本循环
        notification.send(`未识别到突发任务，${enemyType}好感结束`);
        log.info(`未识别到突发任务，${enemyType}好感结束`);
        return false; // 返回 false 表示需要终止循环
    }
    //导航至战斗点
    await navigateToBattlePoint();

    const maxRetryCount = 2;
    let retryCount = 0;

    while (true) {
        try { await sleep(1) } catch (e) { break; }
        if (!running) {
            break;
        }
        const battleResult = await executeBattleTasks();

        if (battleResult.status === "success") {
            consecutiveMaxRetryCount = 0; // 重置连续最大重试计数器
            await runPostBattle();
            return true;
        }

        // 战斗失败，执行恢复
        log.warn(`战斗失败，状态: ${battleResult.status}，错误信息: ${battleResult.errorMessage || '无'}`);

        if (retryCount >= maxRetryCount) {
            consecutiveMaxRetryCount++;
            log.warn(`已尝试恢复 ${maxRetryCount} 次，第 ${consecutiveMaxRetryCount} 次触发最大重试`);

            if (consecutiveMaxRetryCount >= 2) {
                log.error(`连续两次达到最大重试次数，终止任务`);
                notification.send(`${enemyType}好感任务失败，连续两次达到最大重试次数`);
                return false;
            }

            log.info("尝试容错处理：传送至七天神像并切换队伍");
            await genshin.teleportToStatue();
            await switchPartyIfNeeded(settings.partyName);
            log.info("容错处理完成，进入下一轮");
            return true;
        }

        await recoverAfterFailure();
        retryCount++;
        log.info(`第 ${retryCount} 次恢复后，重新导航至战斗点...`);
        await navigateToBattlePoint();
        log.info(`第 ${retryCount} 次恢复后，重新执行战斗...`);
    }
}

// 记录进度信息
/**
 * 输出当前进度与预计完成时间。
 * @param {number} startTime
 * @param {number} currentRound
 * @param {number} totalRounds
 */
function logProgress(startTime, currentRound, totalRounds) {
    const estimatedCompletion = CalculateEstimatedCompletion(startTime, currentRound + 1, totalRounds);
    const currentTime = LogTimeTaken(startTime);
    log.info(`当前进度：${currentRound + 1}/${totalRounds} (${((currentRound + 1) / totalRounds * 100).toFixed(1)}%)`);
    log.info(`当前运行总时长：${currentTime}`);
    log.info(`预计完成时间：${estimatedCompletion}`);
}

// 执行 N 次好感任务并输出日志 - 重构后的主函数
/**
 * 主循环：执行指定次数；在未触发/连续无掉落等条件下提前退出。
 * @returns {Promise<void>}
 */
async function AutoFriendshipDev() {
    const startFirstTime = Date.now();
    let detectExpOrMoraTask;
    let cancelled = false;
    let successCount = 0;
    let failureCount = 0;
    try {
        if (settings.loopTillNoExpOrMora) {
            detectExpOrMoraTask = detectExpOrMora();
        }
        for (let i = 0; i < runTimes; i++) {
            try { await sleep(1); } catch (e) { break; }
            try {
                const success = await executeSingleFriendshipRound(i);
                if (!success)
                    break;
                successCount++;
                logProgress(startFirstTime, i, runTimes);
            } catch (error) {
                continue;
            }
        }
    } finally {
        if (!cancelled) {
            log.info(`本次运行统计：成功 ${successCount} 次，失败 ${failureCount} 次`);
        }
        running = false;
        if (detectExpOrMoraTask) {
            try { await detectExpOrMoraTask; } catch { }
        }
    }
}

/**
 * 后台循环：模板匹配检测经验/摩拉掉落图标（用于提前终止循环）。
 * @returns {Promise<void>}
 */
async function detectExpOrMora() {
    // 后台循环：通过模板匹配检测经验/摩拉图标
    // 注意：该循环依赖 running 停止；必须保证任何退出路径都会把 running=false
    while (running) {
        try { await sleep(1); } catch (e) { break; }
        if (!detectedExpOrMora) {
            let res1 = null;
            let res2 = null;
            try {
                res1 = (await getGameRegion()).find(expRo);
                if (res1.isExist()) {
                    log.info("识别到经验");
                    detectedExpOrMora = true;
                    continue;
                }
                res2 = (await getGameRegion()).find(moraRo);
                if (res2.isExist()) {
                    log.info("识别到摩拉");
                    detectedExpOrMora = true;
                    continue;
                }
            } catch (e) {
                log.error(`检测经验和摩拉掉落过程中出现错误 ${e.message}`);
            }
        } else {
            await sleep(200);
        }
        await sleep(200);
    }
}

/**
 * 解析数值类型配置项
 * @param {*} value    配置原始值（可能是字符串、数字、undefined、null）
 * @param {number} defaultVal 默认值
 * @returns {number} 若 value 为空字符串/undefined/null 或转换后为 NaN，返回 defaultVal；否则返回转换后的数值（包含 0）
 */
function parseNumericSetting(value, defaultVal) {
    if (value === undefined || value === null || value === '') return defaultVal;
    const n = Number(value);
    return isNaN(n) || n === 0 ? defaultVal : n;
}

/**
 * 获取 OCR 关键词（优先敌人配置，否则回退默认）。
 * @param {string} enemyType
 * @returns {string[]}
 */
function getOcrKeywords(enemyType) {
    // OCR 关键词获取：优先使用敌人类型配置，否则回退到默认关键词
    const { ocrKeywords } = getEnemyConfig(enemyType);
    return ocrKeywords || DEFAULT_OCR_KEYWORDS;
}

/**
 * 可选切换队伍；失败则尝试回七天神像后重试。
 * @param {string} partyName
 * @returns {Promise<void>}
 */
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

/**
 * 获取游戏区域截图，根据时间间隔决定是否重新捕获
 * 
 * @param {number} [minInterval=17] - 最小截图间隔（毫秒），默认17ms（约60fps）
 * @param {boolean} [asyncDispose=false] - 是否异步释放旧截图，默认false
 * @returns {Promise<Object>} 游戏区域截图对象
 * 
 * @description
 * 使用 gameRegionManager 对象管理以下属性：
 * - cache: 缓存队列，保存近5张截图
 * - lastCapture: 上一次捕获游戏区域的时间戳
 * - isDisposing: 标记是否正在释放旧截图，用于安全锁
 * - isCapturing: 标记是否正在执行截图操作，用于全局锁
 */
async function getGameRegion(minInterval = 17, asyncDispose = false) {
    async function disposeOldGameRegion() {
        gameRegionManager.isDisposing = true;
        try {
            // 当缓存队列超过GAME_REGION_CACHE_SIZE个时，销毁最旧的截图
            while (gameRegionManager.cache.length > GAME_REGION_CACHE_SIZE) {
                const oldestRegion = gameRegionManager.cache.shift();
                if (oldestRegion) {
                    oldestRegion.dispose();
                }
            }
        } catch (error) {
            log.error(`释放旧游戏区域截图失败: ${error.message}`);
        } finally {
            gameRegionManager.isDisposing = false;
        }
    }

    // 等待其他任务完成截图
    while (gameRegionManager.isCapturing) {
        await sleep(1);
    }

    gameRegionManager.isCapturing = true;
    try {
        if (new Date() - gameRegionManager.lastCapture >= minInterval || gameRegionManager.cache.length === 0) {
            while (gameRegionManager.isDisposing) {
                await sleep(1);
            }
            gameRegionManager.lastCapture = new Date();
            const newRegion = captureGameRegion();
            gameRegionManager.cache.push(newRegion);

            // 根据参数决定是否等待释放完成
            if (asyncDispose) {
                disposeOldGameRegion();
            } else {
                await disposeOldGameRegion();
            }
        }
    } catch (error) {
        log.error(`获取游戏区域截图失败: ${error.message}`);
    } finally {
        gameRegionManager.isCapturing = false;
        // 返回最新的截图
        return gameRegionManager.cache[gameRegionManager.cache.length - 1];
    }
}