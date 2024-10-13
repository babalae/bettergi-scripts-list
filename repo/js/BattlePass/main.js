(async function () {
    setGameMetrics(3840, 2160, 2);
    keyPress("F4");
    await sleep(1500);
    click(1920, 100);
    await sleep(1000);
    click(3480, 1948);
    await sleep(1000);
    keyPress("Escape");

    log.info("已领取历练点");
})();