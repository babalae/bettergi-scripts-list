(async function () {

    const defaultExitDelay = 12;
    const defaultLoadingDelay = 10;

    function validateAndSetDefaults(exitDelay, loadingDelay) {
        if (isNaN(exitDelay) || exitDelay <= 0) {
            log.warn("你没有设置退出延迟，将使用默认值：12秒");
            exitDelay = defaultExitDelay;
        }
        if (isNaN(loadingDelay) || loadingDelay < 0) {
            log.warn("你没有设置加载延迟，将使用默认值：10秒");
            loadingDelay = defaultLoadingDelay;
        }
        return { exitDelay, loadingDelay };
    }

    async function ReopenTheGate() {
            await sleep(1000);
            keyPress("ESCAPE");
            await sleep(1000);
            click(50, 1030);
            await sleep(1000);
            click(1000, 750);
            await sleep(validatedExitDelay * 1000);
            click(1000, 550);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            click(1000, 750);
            await sleep(1000);
            await sleep(validatedLoadingDelay * 1000);
            click(1000, 750);
            await sleep(1000);
    }

    async function AutoPath(locationName) {
        try {
        let filePath = `assets/AutoPath/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
            log.error(error.message);
        }
        await sleep(2000);
    }

    async function AutoFriendship(times, statue_times, GetMeatMode) {
        log.info(`导航至好感-张牙舞爪的恶党-触发位置(二净甸)`);
        await AutoPath(`好感-张牙舞爪的恶党-触发位置(二净甸)`);
        // 加个10秒延迟，避免没上报当前位置导致登录重上后退回传送锚点
        await sleep(10000);

        log.info(`自动好感开始...`);
    
        for (let i = 0; i < times; i++) {
            if ((i + 1) % statue_times === 0) {
                await genshin.tp(2297.60, -824.45);
                await AutoPath(`好感-张牙舞爪的恶党-触发位置(二净甸)`);
                await ReopenTheGate();
                log.info(`当前次数：${i + 1}/${times}`);
                logTimeTaken(startTime);
                await AutoPath(`好感-张牙舞爪的恶党-循环${GetMeatMode ? '(二净甸刷肉版)' : '(二净甸)'}`);
            } else {
                await ReopenTheGate();
                log.info(`当前次数：${i + 1}/${times}`);
                logTimeTaken(startTime);
                await AutoPath(`好感-张牙舞爪的恶党-循环${GetMeatMode ? '(二净甸刷肉版)' : '(二净甸)'}`);
            }
            log.info(`已完成次数：${i + 1}/${times}`);
            logTimeTaken(startTime);
        }
        log.info('自动好感已完成');
    }

    function logTimeTaken(startTime) {
        const currentTime = Date.now();
        const totalTimeInSeconds = (currentTime - startTime) / 1000;
        const minutes = Math.floor(totalTimeInSeconds / 60);
        const seconds = totalTimeInSeconds % 60;
        const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
        log.info(`当前运行总时长：${formattedTime}`);
    }

    let exitdelay = Number(settings.exitdelay);
    let loadingdelay = Number(settings.loadingdelay);
    // 肉相关
    let GetMeatMode = settings.GetMeatMode ? settings.GetMeatMode : false; 
    let inputValue = settings.inputValue ? settings.inputValue : 300;
    let times =  GetMeatMode ? (isNaN(inputValue) ? 50 : Math.ceil(inputValue / 6)) : 10;
    // 神像相关
    let gostatue = settings.gostatue ? settings.gostatue : false; 
    let statue = settings.statue ? settings.statue : 5;
    let statue_times = gostatue ? (isNaN(statue) ? 5 : statue) : 0;

    // 启用自动拾取的实时任务，并配置成启用急速拾取模式
    dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));

    const startTime = Date.now();
    setGameMetrics(1920, 1080, 1); // 设置游戏窗口大小和DPI
    const { exitDelay: validatedExitDelay, loadingDelay: validatedLoadingDelay } = validateAndSetDefaults(exitdelay, loadingdelay);
    const messages = [
        '请确保队伍满员，并为队伍配置相应的战斗策略',
        `退出延迟: ${validatedExitDelay}秒, 加载延迟: ${validatedLoadingDelay}秒`,
        `设置的七天神像周期为： ${statue_times}`,
        `计算后的运行次数为： ${times}`,
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(1000);
    }
    log.info('自动好感开始...');

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

    //默认10次自动好感
    await AutoFriendship(times,statue_times,GetMeatMode);

    // 计算并输出总时长
    const endTime = Date.now();
    const totalTimeInSeconds = (endTime - startTime) / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = totalTimeInSeconds % 60;
    const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
    log.info(`自动好感运行总时长：${formattedTime}`);
})();
