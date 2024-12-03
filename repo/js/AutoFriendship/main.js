(async function () {

    const defaultExitDelay = 12;
    const defaultLoadingDelay = 15;

    function validateAndSetDefaults(exitDelay, loadingDelay) {
        if (isNaN(exitDelay) || exitDelay <= 0) {
            log.warn("你没有设置退出延迟，将使用默认值：12秒");
            exitDelay = defaultExitDelay;
        }
        if (isNaN(loadingDelay) || loadingDelay <= 0) {
            log.warn("你没有设置加载延迟，将使用默认值：15秒");
            loadingDelay = defaultLoadingDelay;
        }
        return { exitDelay, loadingDelay };
    }

    async function runGameActionsMultipleTimes() {
            await sleep(1000);
            keyPress("ESCAPE");
            await sleep(1000);
            click(50, 1030);
            await sleep(1000);
            click(1000, 750);
            await sleep(validatedExitDelay * 1000);
            click(1000, 550);
            await sleep(validatedLoadingDelay * 1000);
    }

    async function resetMap() {
        log.info("重置地图大小...");
        await sleep(1000);
        keyPress("M");
        await sleep(1000);
        click(1840, 1010);
        await sleep(1000);
        click(1450, 460);
        await sleep(1000);
        click(1840, 1010);
        await sleep(1000);
        click(1450, 140);
        await sleep(1000);
        keyPress("M");
        log.info("重置地图大小完成");
    }

    async function AutoPath(locationName) {
        try {
        let filePath = `assets/AutoPath/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        await sleep(2000);
    }

    async function AutoFriendshipDev(times) {
        await resetMap();
        log.info(`清理原住民...`);
        await AutoPath('清理原住民');
        log.info(`自动好感开始...`);
        for (let i = 0; i < times; i++) {
            await AutoPath('两武士');
            await runGameActionsMultipleTimes();
            log.info(`自动好感当前次数：${i + 1}/${times}`);
            await AutoPath('盗宝团');
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

    // 启用自动拾取的实时任务
    const startTime = Date.now();
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    setGameMetrics(1920, 1080, 1); // 设置游戏窗口大小和DPI
    let exitdelay = Number(settings.exitdelay);
    let loadingdelay = Number(settings.loadingdelay);
    const { exitDelay: validatedExitDelay, loadingDelay: validatedLoadingDelay } = validateAndSetDefaults(exitdelay, loadingdelay);
    const messages = [
        '请确保当前队伍为好感度队伍',
        '好感度队伍：用待刷好感角色替换战斗策略中的人物即可',
        '随后将自动匹配到战斗策略脚本',
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(1000);
    }
    log.info('自动好感开始...');
    log.info(`退出延迟: ${validatedExitDelay}秒, 加载延迟: ${validatedLoadingDelay}秒`);
    //默认10次自动好感
    await AutoFriendshipDev(10);
    // 计算并输出总时长
    const endTime = Date.now();
    const totalTimeInSeconds = (endTime - startTime) / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = totalTimeInSeconds % 60;
    const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
    log.info(`自动好感运行总时长：${formattedTime}`);
})();
