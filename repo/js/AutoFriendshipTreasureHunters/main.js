const DEFAULT_RUNS = 10;
const DEFAULT_PERIOD = 25;
const DEFAULT_BASE_RUNS = 50;
const BENCHMARK_HOUR = "T04:00:00";
const DEFAULT_OCR_TIMEOUT_SECONDS = 30;
const DEFAULT_FIGHT_TIMEOUT_SECONDS = 120;

(async function () {
    // 启用自动拾取的实时任务
    const startTime = Date.now();
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
	log.info(`'请确保队伍满员，并为队伍配置相应的战斗策略'`);
	// 计算运行次数
	let runTimes = Number(settings.runTimes);
	if(!isPositiveInteger(runTimes) && !settings.waitTimeMode){
		log.warn("请输入正确的次数，必须是正整数！");
		log.warn(`运行次数重置为 ${DEFAULT_RUNS} 次！`);
		runTimes = DEFAULT_RUNS;
	}  
	
	if(settings.waitTimeMode){
		if(!isPositiveInteger(runTimes)){
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
		if(!isPositiveInteger(period) || period > runTimes){
            period = DEFAULT_PERIOD < runTimes? DEFAULT_PERIOD : runTimes;
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
    
	await switchPartyIfNeeded(settings.partyName);

	log.info('盗宝团好感开始...');
	
	// 清理丘丘人
	if(settings.qiuQiuRen){
		log.info(`清理原住民...`);
		await AutoPath('清理原住民');
	}	
    // 验证超时设置
    const ocrTimeout = validateTimeoutSetting(settings.ocrTimeout, DEFAULT_OCR_TIMEOUT_SECONDS, "OCR");
    const fightTimeout = validateTimeoutSetting(settings.fightTimeout, DEFAULT_FIGHT_TIMEOUT_SECONDS, "战斗");
	
    // 盗宝团好感循环开始	
	await AutoFriendshipDev(runTimes, ocrTimeout, fightTimeout);
	log.info(`盗宝团好感运行总时长：${LogTimeTaken(startTime)}`);  
})();


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

// 执行 N 次盗宝团任务并输出日志
async function AutoFriendshipDev(times, ocrTimeout, fightTimeout) {
    let startFirstTime = Date.now();    
    for (let i = 0; i < times; i++) {
        await AutoPath('触发点');
        // 启动路径导航任务
        let pathTaskPromise = AutoPath('盗宝团');
        
        // OCR检测
        let ocrStatus = false;
        let ocrStartTime = Date.now();
        while (Date.now() - ocrStartTime < ocrTimeout * 1000 && !ocrStatus) {
            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 200, 300, 300));
            for (let o = 0; o < resList.count; o++) {
                let res = resList[o];
                if (res.text.includes("岛上") 
                    || res.text.includes("无贼")
                    || res.text.includes("消灭") 
                    || res.text.includes("鬼鬼祟祟") 
                    || res.text.includes("盗宝团")) {
                    ocrStatus = true;
                    log.info("检测到突发任务触发");
                    break;
                }
            }
            if (!ocrStatus) {
                await sleep(1000);
            }
        }
        
        if(ocrStatus){
            const cts = new CancellationTokenSource();
            try {
                // 设置最大等待时间为15秒
                const maxWaitTime = 15000;
                const waitStartTime = Date.now();
                
                // 校验距离，如果距离小于10米，则认为已经到达目的地
                const targetX = -2756.67;
                const targetY = -3467.63;
                const maxDistance = 10; // 10米距离判定
                
                // 等待角色到达指定位置附近
                let isNearTarget = false;
                let pathTaskFinished = false;
                
                // 简单监控路径任务完成
                pathTaskPromise.then(() => {
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
                        const distance = Math.sqrt(Math.pow(pos.x - targetX, 2) + Math.pow(pos.y - targetY, 2));
                        if (distance <= maxDistance) {
                            isNearTarget = true;
                            log.info(`已到达目标点附近，距离: ${distance.toFixed(2)}米`);
                            break;
                        }
                    }
                    await sleep(1000);
                }                
                
                log.info("开始战斗...");
                const battleTask = dispatcher.RunTask(new SoloTask("AutoFight"), cts);
                
                let fightResult = await waitForBattleResult(fightTimeout * 1000) ? "成功" : "失败";
                log.info(`战斗任务已结束，战斗结果：${fightResult}`);
                cts.cancel();
            } catch (error) {
                cts.cancel();
                log.error(`执行过程中出错: ${error}`);
            }
            const estimatedCompletion = CalculateEstimatedCompletion(startFirstTime, i + 1, times);
            const currentTime = LogTimeTaken(startFirstTime);
            log.info(`当前进度：${i + 1}/${times} (${((i + 1) / times * 100).toFixed(1)}%)`);
            log.info(`当前运行总时长：${currentTime}`);
            log.info(`预计完成时间：${estimatedCompletion}`);
        } else {
            notification.send(`未识别到突发任务（岛上无贼），盗宝团好感结束`);
            log.info(`未识别到突发任务（岛上无贼），盗宝团好感结束`);
            break;
        }
    }
    log.info('盗宝团好感已完成');
    await genshin.tpToStatueOfTheSeven();  // 虽然不知道什么原因，但是不加这句会报错
}

// 验证输入是否是正整数
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
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
        if(!await genshin.switchParty(partyName)){
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

async function waitForBattleResult(timeout = 2 * 60 * 1000) {
    let fightStartTime = Date.now();
    const successKeywords = ["事件", "完成"];
    const failureKeywords = ["失败"];
    const eventKeyword = ["岛上", "无贼","消灭","鬼鬼祟祟","盗宝团"];
    let notFind = 0;
    
    while (Date.now() - fightStartTime < timeout) {
        try {
            // 简化OCR检测，只使用一个try-catch块
            let result = captureGameRegion().find(RecognitionObject.ocr(850, 150, 200, 80));
            let result2 = captureGameRegion().find(RecognitionObject.ocr(0, 200, 300, 300));
            let text = result.text;
            let text2 = result2.text;
            
            // 检查成功关键词
            for (let keyword of successKeywords) {
                if (text.includes(keyword)) {
                    log.info("检测到战斗成功关键词: {0}", keyword);
                    return true;
                }
            }
            
            // 检查失败关键词
            for (let keyword of failureKeywords) {
                if (text.includes(keyword)) {
                    log.warn("检测到战斗失败关键词: {0}", keyword);
                    return false;
                }
            }
            
            // 检查事件关键词
            let find = 0;
            for(let keyword of eventKeyword) {
                if (text2.includes(keyword)) {
                    find++;
                }
            }
            
            if(find === 0) {
                notFind++;
                log.info("未检测到任务触发关键词：{0} 次", notFind);
            }else{
                notFind = 0;
            }
            
            if (notFind > 10) {
                log.warn("不在任务触发区域，战斗失败");
                return false;
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
    return false;
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

