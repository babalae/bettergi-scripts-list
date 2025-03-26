(async function () {
    const DEFAULT_RUNS = 10;
    const DEFAULT_PERIOD = 25;
    const DEFAULT_BASE_RUNS = 50;
    const BENCHMARK_HOUR = "T04:00:00";
    const TELEPORT_COORDS = { x: 2297.60, y: -824.45 };
	
	// 执行 path 任务
    async function AutoPath(locationName) {
        try {
            const filePath = `assets/AutoPath/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误: ${error.message}`);
        }
        await sleep(2000);
    }

	// 计算运行时长
    function LogTimeTaken(startTimeParam) {
        const currentTime = Date.now();
        const totalTimeInSeconds = (currentTime - startTimeParam) / 1000;
        const minutes = Math.floor(totalTimeInSeconds / 60);
        const seconds = totalTimeInSeconds % 60;
        const formattedTime = `${minutes} 分 ${seconds.toFixed(0).padStart(2, '0')} 秒`;
        return formattedTime;
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
    async function AutoFriendshipDev(times) {
        startFisrtTime = Date.now();
        for (let i = 0; i < times; i++) {
            await AutoPath('盗宝团');
            const estimatedCompletion = CalculateEstimatedCompletion(startFisrtTime, i + 1, times);
            const currentTime = LogTimeTaken(startFisrtTime);
            log.info(`当前进度：${i + 1}/${times} (${((i + 1) / times * 100).toFixed(1)}%)`);
            log.info(`当前运行总时长：${currentTime}`);
            log.info(`预计完成时间：${estimatedCompletion}`);
        }
        log.info('盗宝团好感已完成');
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
            await genshin.tp(TELEPORT_COORDS.x, TELEPORT_COORDS.y);
            await sleep(3000);
            log.info(`正在尝试切换至：${partyName}`);
            await genshin.switchParty(partyName);
            log.info(`队伍切换成功，继续下一步任务`);
        } catch (error) {
            log.warn("队伍切换失败，可能处于联机模式或其他不可切换状态");
            await genshin.returnMainUi();
        }
    }

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
    // 盗宝团好感循环开始	
	await AutoFriendshipDev(runTimes);
	log.info(`盗宝团好感运行总时长：${LogTimeTaken(startTime)}`);  
})();
