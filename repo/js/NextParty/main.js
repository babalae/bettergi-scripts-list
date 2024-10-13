(async function () {
    setGameMetrics(3840, 2160, 2);
    keyPress("L");
    await sleep(4500);
    click(3684, 1078);
    await sleep(800);
    click(3200, 2050);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);

    log.info("已切换至下一队");
})();