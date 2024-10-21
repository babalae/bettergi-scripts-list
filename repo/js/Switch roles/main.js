(async function () {
    setGameMetrics(3840, 2160, 2);

    keyPress(settings.n);
    await sleep(1000);

    log.info("已切换至角色"+ settings.n);
})();