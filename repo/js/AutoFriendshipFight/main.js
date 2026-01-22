const DEFAULT_RUNS = 10;
const DEFAULT_PERIOD = 25;
const DEFAULT_BASE_RUNS = 50;
const BENCHMARK_HOUR = "T04:00:00";
const DEFAULT_OCR_TIMEOUT_SECONDS = 10;
const DEFAULT_FIGHT_TIMEOUT_SECONDS = 120;

(async function () {
    const startTime = Date.now();
    // 启用自动拾取的实时任务
    if (convertToTrueIfNotBoolean(settings.pickupMode)) {
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        log.info("已 启用 自动拾取任务");
    } else {
        log.info("已 禁用 自动拾取任务");
    }
    runTimes = await calulateRunTimes();
    await switchPartyIfNeeded(settings.partyName);

    // 获取敌人类型设置，默认为盗宝团
    const enemyType = settings.enemyType || "盗宝团";
    log.info(`当前选择的敌人类型: ${enemyType}`);
    log.info(`${enemyType}好感开始...`);

    // 清理丘丘人（仅盗宝团需要）
    if (settings.qiuQiuRen && enemyType === "盗宝团") {
        log.info(`清理原住民...`);
        await AutoPath('盗宝团-准备');
    }
    if (enemyType === "愚人众") {
        log.info(`导航到愚人众触发点...`);
        await AutoPath('愚人众-准备');
    }
    if (enemyType === "鳄鱼") {
        log.info(`导航到鳄鱼触发点...`);
        await AutoPath('鳄鱼-准备');
    }
    if (enemyType === "蕈兽") {
        log.info(`导航到蕈兽触发点...`);
        await AutoPath('蕈兽-准备');
    }
    if (enemyType === "雷萤术士") {
        log.info(`导航到雷萤术士触发点...`);
        await AutoPath('雷萤术士-准备');
    }
    // 验证超时设置
    const ocrTimeout = validateTimeoutSetting(settings.ocrTimeout, DEFAULT_OCR_TIMEOUT_SECONDS, "OCR");
    const fightTimeout = validateTimeoutSetting(settings.fightTimeout, DEFAULT_FIGHT_TIMEOUT_SECONDS, "战斗");

    // 好感循环开始	
    await AutoFriendshipDev(runTimes, ocrTimeout, fightTimeout, enemyType);
    log.info(`${enemyType}好感运行总时长：${LogTimeTaken(startTime)}`);
})();

function convertToTrueIfNotBoolean(value) {
  return typeof value === 'boolean' ? value : true;
}
// 执行 path 任务
async function AutoPath(locationName) {
    try {
        const filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
    } catch (error) {
        log.error(`执行 ${locationName} 路径时发生错误: ${error.message}`);
    }
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
    const pos = genshin.getPositionFromMap();

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
    const ocrKeywords = getOcrKeywords(enemyType);
    let ocrStatus = false;
    let ocrStartTime = Date.now();

    while (Date.now() - ocrStartTime < ocrTimeout * 1000 && !ocrStatus) {
        let captureRegion = captureGameRegion();
        let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 200, 300, 300));
        captureRegion.dispose();
        for (let o = 0; o < resList.count; o++) {
            let res = resList[o];
            for (let keyword of ocrKeywords) {
                if (res.text.includes(keyword)) {
                    ocrStatus = true;
                    log.info("检测到突发任务触发");
                    break;
                }
            }
            if (ocrStatus) break;
        }

        if (!ocrStatus) {
            await sleep(1000);
        }
    }

    return ocrStatus;
}

// 等待角色到达目标位置
async function waitForTargetPosition(pathTask, targetCoords, maxWaitTime = 15000) {
    const waitStartTime = Date.now();
    const maxDistance = 5;
    let isNearTarget = false;
    let pathTaskFinished = false;

    // 监控路径任务完成
    pathTask.then(() => {
        pathTaskFinished = true;
        log.info("路径任务已完成");
    }).catch(error => {
        pathTaskFinished = true;
        log.error(`路径任务出错: ${error}`);
    });

    // 等待角色到达目标位置或超时
    while (!isNearTarget && !pathTaskFinished && (Date.now() - waitStartTime < maxWaitTime)) {
        const pos = genshin.getPositionFromMap();
        if (pos) {
            const distance = Math.sqrt(Math.pow(pos.x - targetCoords.x, 2) + Math.pow(pos.y - targetCoords.y, 2));
            if (distance <= maxDistance) {
                isNearTarget = true;
                log.info(`已到达目标点附近，距离: ${distance.toFixed(2)}米`);
                break;
            }
        }
        await sleep(1000);
    }

    return { isNearTarget, pathTaskFinished };
}

// 执行战斗任务（并发执行战斗和结果检测）
async function executeBattleTasks(fightTimeout, enemyType, cts) {
    log.info("开始战斗!");

    let battleTask;
    let battleResult = null;
    let fightResult = null;

    try {
        battleTask = dispatcher.RunTask(new SoloTask("AutoFight"), cts);
        const battleDetectTask = waitForBattleResult(fightTimeout * 1000, enemyType, cts);

        // 使用 Promise.allSettled 而不是 Promise.all，这样可以处理部分成功的情况
        const results = await Promise.allSettled([
            battleTask.catch(error => {
                // 如果是取消错误（成功检测后的正常取消），不算真正的错误
                if (error.message && error.message.includes("取消自动任务")) {
                    log.info("战斗任务已被成功取消");
                    return { cancelled: true };
                }
                throw error; // 其他错误继续抛出
            }),
            battleDetectTask
        ]);

        battleResult = results[0];
        fightResult = results[1];

        // 检查检测任务是否成功
        if (fightResult.status === 'fulfilled') {
            log.info("战斗检测任务完成");
            return { success: true, battleResult: battleResult.value, fightResult: fightResult.value };
        } else if (fightResult.status === 'rejected') {
            throw fightResult.reason;
        }

    } catch (error) {
        if (error.message && error.message.includes("战斗超时")) {
            log.error(`战斗超时，终止整个任务: ${error.message}`);
            await genshin.tpToStatueOfTheSeven();
            throw error;
        }

        // 过滤掉正常的取消错误
        if (error.message && error.message.includes("取消自动任务")) {
            log.info("战斗任务正常取消（战斗检测成功）");
            return { success: true, cancelled: true };
        }

        log.error(`战斗执行过程中出错: ${error.message}`);
        throw error;
    } finally {
        // 确保战斗任务被等待完成（即使被取消）
        if (battleTask) {
            try {
                await battleTask;
            } catch (error) {
                // 忽略 finally 块中的取消错误
                if (!error.message || !error.message.includes("取消自动任务")) {
                    log.warn(`清理战斗任务时出错: ${error.message}`);
                }
            }
        }
    }
}

// 执行单次好感任务循环
async function executeSingleFriendshipRound(roundIndex, ocrTimeout, fightTimeout, enemyType) {
    // 导航到触发点
    await navigateToTriggerPoint(enemyType);
    if (roundIndex === 0 && enemyType === "鳄鱼") {
        await sleep(5000);
    }
    let initialDetected = false;
    if (roundIndex === 0) {
        initialDetected = await detectTaskTrigger(3, enemyType);
    }
    if(!initialDetected || roundIndex > 0) {
        await genshin.relogin();
    }
    

    // 启动路径导航任务（异步）
    let pathTask = AutoPath(`${enemyType}-战斗点`);
    const ocrStatus = await detectTaskTrigger(ocrTimeout, enemyType);

    if (!ocrStatus) {
        notification.send(`未识别到突发任务，${enemyType}好感结束`);
        log.info(`未识别到突发任务，${enemyType}好感结束`);
        await pathTask;  // 防止报错
        return false; // 返回 false 表示需要终止循环
    }

    const cts = new CancellationTokenSource();

    const targetCoords = getTargetCoordinates(enemyType);
    await waitForTargetPosition(pathTask, targetCoords); 
    await executeBattleTasks(fightTimeout, enemyType, cts);
    await pathTask;

    // 特殊处理：鳄鱼战斗后需要拾取
    if (enemyType === "鳄鱼") {
        await AutoPath('鳄鱼-拾取');
    }
    if(enemyType === "蕈兽") {
        await AutoPath('蕈兽-对话');
        await sleep(50);
        keyPress("F");
        await sleep(50);
        keyPress("F");
        await sleep(500);
        await genshin.chooseTalkOption("下次");
        await sleep(500);
    }

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
    const startFirstTime = Date.now();
    for (let i = 0; i < times; i++) {
        try {
            const success = await executeSingleFriendshipRound(i, ocrTimeout, fightTimeout, enemyType);
            if (!success)
                break;
            logProgress(startFirstTime, i, times);
        } catch (error) {
            log.error(`第 ${i + 1} 轮好感任务失败: ${error.message}`);

            // 如果是战斗超时错误，直接终止整个任务
            if (error.message && error.message.includes("战斗超时")) {
                throw error;
            }
            continue;
        }
    }

    log.info(`${enemyType}好感已完成`);
}


async function calulateRunTimes() {
    log.info(`'请确保队伍满员，并为队伍配置相应的战斗策略'`);
    // 计算运行次数
    let runTimes = Number(settings.runTimes);
    if (!isPositiveInteger(runTimes) && !settings.waitTimeMode) {
        log.warn("请输入正确的次数，必须是正整数！");
        log.warn(`运行次数重置为 ${DEFAULT_RUNS} 次！`);
        runTimes = DEFAULT_RUNS;
    }

    if (settings.waitTimeMode) {
        if (!isPositiveInteger(runTimes)) {
            log.warn("运行次数必须是正整数，使用默认基准次数");
            log.warn(`运行次数重置为 ${DEFAULT_BASE_RUNS} 次！`);
            runTimes = DEFAULT_BASE_RUNS;
        }

        // 验证日期格式
        const waitTimeModeDay = settings.waitTimeModeDay;
        if (!isValidDateFormat(waitTimeModeDay)) {
            log.error("基准日期格式错误，请检查后重试！");
            log.error("参考格式：2025-01-01");
            log.error(`错误输入：${waitTimeModeDay}`);
            await sleep(5000);
            return;
        }

        let period = Number(settings.waitTimeModePeriod);
        if (!isPositiveInteger(period) || period > runTimes) {
            period = DEFAULT_PERIOD < runTimes ? DEFAULT_PERIOD : runTimes;
            log.warn(`卡时间模式周期必须是 1-${runTimes} 之间的正整数！使用 ${period} 作为周期`);
        }
        runTimes = calculateWaitModeRuns(runTimes, waitTimeModeDay, period);

        // 添加日志输出，提醒用户当前使用的基准日期和周期
        log.info(`当前使用的基准日期: ${waitTimeModeDay}`);
        log.info(`当前使用的周期: ${period} 天`);
        log.info(`根据基准日期和周期计算，今日运行次数: ${runTimes}`);
    } else {
        log.info(`当前设置的运行次数: ${runTimes}`);
    }
    return runTimes;
}

// 验证输入是否是正整数
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

// 根据敌人类型获取OCR关键词
function getOcrKeywords(enemyType) {
    if (enemyType === "愚人众") {
        return ["买卖", "不成", "正义存", "愚人众", "禁止", "危险", "运输", "打倒", "盗宝团", "丘丘人", "今晚", "伙食", "所有人"];
    }
    else if (enemyType === "盗宝团") {
        return ["岛上", "无贼", "消灭", "鬼鬼祟祟", "盗宝团"];
    }
    else if (enemyType === "鳄鱼") {
        return ["张牙", "舞爪", "恶党", "鳄鱼", "打倒", "所有", "鳄鱼"];
    }
    else if (enemyType === "蕈兽") {
        return ["实验家", "变成", "实验品", "击败", "所有", "魔物"];
    }
    else if (enemyType === "雷萤术士") {
        return ["雷萤", "术士","圆滚滚", "不可食用", "威撼", "攀岩", "消灭", "准备", "打倒", "所有", "魔物","盗宝团","击败","成员","盗亦无道"];
    }
    else
    {
        return ["突发", "任务", "打倒", "消灭", "敌人", "所有"]; // 兜底关键词
    }
}

// 根据敌人类型获取目标战斗点坐标
function getTargetCoordinates(enemyType) {
    if (enemyType === "愚人众") {
        return { x: 4840.55, y: -3078.01 };
    } else if (enemyType === "盗宝团") {
        // 盗宝团战斗点坐标
        return { x: -2757.28, y: -3468.43 };
    } else if (enemyType === "鳄鱼") {
        // 鳄鱼战斗点坐标
        return { x: 3578.08, y: -500.75 };
    } else if (enemyType === "蕈兽") {
        return { x: 3794.55, y: -350.60 };
    } else if (enemyType === "雷萤术士") {
        return {x:  883.91,  y:656.63};
    }
}

function getTriggerPoint(enemyType) {
    if (enemyType === "愚人众") {
        return { x: 4783.79, y: -3065.62 }; // 愚人众触发点坐标
    }
    else if (enemyType === "盗宝团") {
        return { x: -2736.60, y: -3415.44 }; // 盗宝团触发点坐标
    }
    else if (enemyType === "鳄鱼") {
        return { x: 3614.63, y: -521.60 }; // 鳄鱼触发点坐标
    } else if (enemyType === "蕈兽") {
        return { x: 3749.38, y: -391.91 }; // 蕈兽触发点坐标
    } else if (enemyType === "雷萤术士") {
        return {x:881.92, y: 616.85}; // 雷萤术士触发点坐标
    }
}

// 验证日期格式
function isValidDateFormat(dateStr) {
    if (!dateStr) return false;

    // 检查格式是否为 YYYY-MM-DD
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    // 检查是否为有效日期
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

function calculateWaitModeRuns(baseRuns, waitTimeModeDay, period) {
    const now = new Date();
    const benchmark = new Date(waitTimeModeDay + BENCHMARK_HOUR);
    const timeDiff = now.getTime() - benchmark.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const daysNormalized = daysDiff >= 0 ? daysDiff : period - (Math.abs(daysDiff) % period);
    const dayInCycle = (daysNormalized % period) + 1;
    const baseRunsPerDay = Math.ceil(baseRuns / period);
    return baseRunsPerDay * dayInCycle;
}

async function switchPartyIfNeeded(partyName) {
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

async function waitForBattleResult(timeout = 2 * 60 * 1000, enemyType = "盗宝团", cts = new CancellationTokenSource()) {
    let fightStartTime = Date.now();
    const successKeywords = ["事件", "完成"];
    const failureKeywords = ["失败"];
    const eventKeywords = getOcrKeywords(enemyType);
    let notFind = 0;

    while (Date.now() - fightStartTime < timeout) {
        try {
            // 简化OCR检测，只使用一个try-catch块
            let capture = captureGameRegion();
            let result = capture.find(RecognitionObject.ocr(850, 150, 200, 80));
            let result2 = capture.find(RecognitionObject.ocr(0, 200, 300, 300));
            let text = result.text;
            let text2 = result2.text;
            capture.dispose();
            // 检查成功关键词
            for (let keyword of successKeywords) {
                if (text.includes(keyword)) {
                    log.info("检测到战斗成功关键词: {0}", keyword);
                    log.info("战斗结果：成功");
                    cts.cancel(); // 取消任务
                    return true;
                }
                if(enemyType=="蕈兽" && text2.includes("维沙瓦")){
                    log.info("战斗结果：成功");
                    cts.cancel(); 
                    return true;
                }
            }

            // 检查失败关键词
            for (let keyword of failureKeywords) {
                if (text.includes(keyword)) {
                    log.warn("检测到战斗失败关键词: {0}", keyword);
                    log.warn("战斗结果：失败，回到七天神像重试");
                    cts.cancel(); // 取消任务
                    await genshin.tpToStatueOfTheSeven();
                    if (enemyType === "愚人众") {
                        await AutoPath('愚人众-准备');
                    }
                    return false;
                }
            }
            if(enemyType !== "蕈兽") {
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
                    log.warn("不在任务触发区域，战斗失败");
                    cts.cancel(); // 取消任务
                    if (enemyType === "愚人众") {
                        log.warn("回到愚人众准备点");
                        await AutoPath('愚人众-准备');
                    }
                    if (enemyType === "鳄鱼") {
                        log.warn("回到鳄鱼准备点");
                        await AutoPath('鳄鱼-准备');
                        await sleep(5000);
                    }
                    return false;

                }
            }
        }
        catch (error) {
            log.error("OCR过程中出错: {0}", error);
            // 出错后继续循环，不进行额外嵌套处理
        }

        // 统一的检查间隔
        await sleep(1000);
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
        log.warn(`${timeoutType}超时设置无效，必须是大于0的数字，将使用默认值 ${defaultValue} 秒`);
        return defaultValue;
    }

    log.info(`${timeoutType}超时设置为 ${timeout} 秒`);
    return timeout;
}

