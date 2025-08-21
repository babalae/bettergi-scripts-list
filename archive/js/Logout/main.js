(async function () {
    setGameMetrics(1920, 1080, 2);
    await sleep(1000);
    keyPress("ESCAPE")
    await sleep(1000);
    click(50, 1030);
    log.info("退出");
    await sleep(1000);
    click(1000, 750);
    log.info("确认");
    await sleep(20000);
    click(1800, 1000);
    log.info("切换账号");
    await sleep(1000);
    click(1000, 550);
    log.info("确认");
    await sleep(4000);
})();