(async function () {

    function logTimeTaken(startTime) {
        const currentTime = Date.now();
        const totalTimeInSeconds = (currentTime - startTime) / 1000;
        const minutes = Math.floor(totalTimeInSeconds / 60);
        const seconds = totalTimeInSeconds % 60;
        const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
        log.info(`当前运行总时长：${formattedTime}`);
    }

    // powered by 秋云
    function calculateEstimatedCompletion(startTime, current, total) {
        if (current === 0) return "计算中...";
        const elapsedTime = Date.now() - startTime;
        const timePerTask = elapsedTime / current;
        const remainingTasks = total - current;
        const remainingTime = timePerTask * remainingTasks;
        const completionDate = new Date(Date.now() + remainingTime);
        return `${completionDate.toLocaleTimeString()} (约 ${Math.round(remainingTime / 60000)} 分钟)`;
    }

    async function AutoPath(locationName) {
        try {
        let filePath = `assets/AutoPath/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
            log.error(error.message);
        }
        await sleep(1000);
    }

    // 好感核心函数
    async function AutoFriendship(runTimes, statueTimes, GetMeatMode,startTime) {
        log.info(`导航至好感-张牙舞爪的恶党-触发位置(二净甸)`);
        await AutoPath(`好感-张牙舞爪的恶党-触发位置(二净甸)`);
    
        log.info(`已抵达预期位置，兽肉好感循环开始...`);
    
        for (let i = 0; i < runTimes; i++) {
            if ((i + 1) % statueTimes === 0) {
                await genshin.tp(2297.60, -824.45); //  神像坐标
                await AutoPath(`好感-张牙舞爪的恶党-触发位置(二净甸)`);
                log.info(`当前次数：${i + 1}/${runTimes}`);
                await AutoPath(`好感-张牙舞爪的恶党-循环${GetMeatMode ? '(二净甸刷肉版)' : '(二净甸)'}`);
            } else {
                log.info(`当前次数：${i + 1}/${runTimes}`);
                await AutoPath(`好感-张牙舞爪的恶党-循环${GetMeatMode ? '(二净甸刷肉版)' : '(二净甸)'}`);
            }
            const estimatedCompletion = calculateEstimatedCompletion(startTime, i + 1, runTimes);
            log.info(`已完成次数：${i + 1}/${runTimes}`);
            logTimeTaken(startTime);
            log.info(`预计完成时间：${estimatedCompletion}`);
        }
        log.info('兽肉好感已完成');
    }

    // 刷肉相关参数
    let GetMeatMode = settings.GetMeatMode ? settings.GetMeatMode : false; 
    let inputValue = settings.inputValue ? settings.inputValue : 300;
    let runTimes =  GetMeatMode ? (isNaN(inputValue) ? 50 : Math.ceil(inputValue / 6)) : 10;
    // 神像相关参数
    let goStatue = settings.goStatue ? settings.goStatue : false; 
    let statueTimes = goStatue ? (isNaN(settings.statueTimes) ? 5 : settings.statueTimes) : 0;
    // 卡时间相关参数
	if(settings.waitTimeMode){
		let maxTimes = settings.maxTimes ? settings.maxTimes : runTimes ;
        let waitTimeModeDay = settings.waitTimeModeDay
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;  // 日期正则
        if (!datePattern.test(settings.waitTimeModeDay)) {
            log.error(`检测到基准日期格式错误，当前输入值为：${waitTimeModeDay}`);
            waitTimeModeDay = "2025-03-31";
            log.info(`使用的基准日期为：${waitTimeModeDay}`);
        }
		const now = new Date();
		const benchmark = new Date(waitTimeModeDay + "T04:00:00");
        const timeDiff = now.getTime() - benchmark.getTime();
		const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
		let period = Number(settings.waitTimeModePeriod);
		if(isNaN(period)){
			log.warn(`错误的卡时间模式周期 ${period}！使用 7 天作为周期。`);
			period = 7.0;
		}
		if(period < 1 || period > 48){
			log.warn(`卡时间模式周期 ${period} 超过范围！使用 7 天作为周期。`);
			period = 7.0;
		}
        const daysNormalized = daysDiff >= 0 ? daysDiff : period - (Math.abs(daysDiff) % period);
		runTimes = Math.ceil(maxTimes / period) * (daysNormalized % period + 1);	
	}

    // Main
    dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
    const startTime = Date.now();
    let messages = [
        '请确保队伍满员，并为队伍配置相应的战斗策略',
        `使用的七天神像周期为： ${statueTimes}`,
        `计算后的运行次数为： ${runTimes}`,
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(500);
    }
    log.info('兽肉好感开始...');

    //  切换队伍
    if (!!settings.partyName) {
        try {
            await genshin.tp(2297.60, -824.45);
            await sleep(3000);
            log.info("正在尝试切换至" + settings.partyName);
            await genshin.switchParty(settings.partyName);
        } catch {
            log.warn("队伍切换失败，可能处于联机模式或其他不可切换状态");
            await genshin.returnMainUi();
        }
    } else {
        await genshin.returnMainUi();
    }

    await AutoFriendship(runTimes,statueTimes,GetMeatMode,startTime);
    log.info(`兽肉好感运行总时长：${LogTimeTaken(startTime)}`);
    
})();