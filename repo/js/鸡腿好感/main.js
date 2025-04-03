(async function () {
    const TELEPORT_COORDS = { x: 2297.60, y: -824.45 };
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
    async function Feed() {
        await sleep(500);
        keyPress("F");
        await sleep(500);
        keyPress("F");
        await sleep(1000);
        click(1010, 760);
        await sleep(1000);
    }  // todo:考虑添加ocr参数确保一定点击到 F

    async function AutoPath(locationName) {
        try {
            const filePath = `assets/AutoPath/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误: ${error.message}`);
        }
        await sleep(2000);
    }

    async function AutoFriendshipDev(times) {

        log.info(`导航至甜甜花位置`);
        await AutoPath('导航至甜甜花位置');
        log.info(`自动好感开始...`);
        const startFirstTime = Date.now();
        for (let i = 0; i < times; i++) {
            log.info(`自动好感当前次数：${i + 1}/${times}`);
            await AutoPath('从甜甜花到狗盆');
            await Feed();
            if( i != times - 1) {
                await AutoPath('从狗盆到甜甜花'); 
            }  //最后一次不需要返回到甜甜花
            const estimatedCompletion = CalculateEstimatedCompletion(startFirstTime, i + 1, times);
            const currentTime = LogTimeTaken(startFirstTime);
            log.info(`当前进度：${i + 1}/${times} (${((i + 1) / times * 100).toFixed(1)}%)`);
            log.info(`当前运行总时长：${currentTime}`);
            log.info(`预计完成时间：${estimatedCompletion}`);
        }
        log.info('自动好感已完成');
    }

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

    function isPositiveInteger(value) {
        return Number.isInteger(value) && value > 0;
    }
    // 启用自动拾取的实时任务
    const startTime = Date.now();
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    const messages = [
        '请确保有足够的鸡腿',
        '请确保队伍满员',
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(500);
    }

    await switchPartyIfNeeded(settings.partyName);

    log.info('自动好感开始...');
    //默认10次自动好感
    if(isPositiveInteger(settings.times)){
        log.info(`自动好感任务开始，运行：${settings.times} 次`);
    	await AutoFriendshipDev(settings.times);	
    } else {
	log.info(`运行次数输入不合法或者未输入，使用默认值`);
	times = 10;
	log.info(`自动好感任务开始，运行：${times} 次`);
	await AutoFriendshipDev(10);	
    }
    log.info(`自动好感运行总时长：${LogTimeTaken(startTime)}`);
})();
