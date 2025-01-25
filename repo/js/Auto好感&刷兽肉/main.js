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

    async function AutoFriendship(times) {

        log.info(`导航至好感-张牙舞爪的恶党-触发位置`);
        await AutoPath('好感-张牙舞爪的恶党-触发位置');

        log.info(`自动好感开始...`);

        await ReopenTheGate();
        for (let i = 0; i < times; i++) {
            log.info(`自动好感当前次数：${i + 1}/${times}`);
            await AutoPath('好感-张牙舞爪的恶党-循环');
            await ReopenTheGate();
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
    let UL = settings.UL? settings.UL : false; 
    let inputValue = settings.inputValue? settings.inputValue : 9999; 
    let times =  UL ? (isNaN(inputValue) ? 1667 : Math.ceil(inputValue / 6)) : 10;
    log.info(`计算后的运行次数为： ${times}`);

    const { exitDelay: validatedExitDelay, loadingDelay: validatedLoadingDelay } = validateAndSetDefaults(exitdelay, loadingdelay);
    const messages = [
        '请确保队伍满员，并为队伍配置相应的战斗策略',
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(1000);
    }
    log.info('自动好感开始...');
    log.info(`退出延迟: ${validatedExitDelay}秒, 加载延迟: ${validatedLoadingDelay}秒`);

    //默认10次自动好感
    await AutoFriendship(times);

    // 计算并输出总时长
    const endTime = Date.now();
    const totalTimeInSeconds = (endTime - startTime) / 1000;
    const minutes = Math.floor(totalTimeInSeconds / 60);
    const seconds = totalTimeInSeconds % 60;
    const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
    log.info(`自动好感运行总时长：${formattedTime}`);
})();
