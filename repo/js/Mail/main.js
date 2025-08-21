(async function () {
    setGameMetrics(3840, 2160, 2);
    keyPress("Escape");
    await sleep(1500);
    click(94, 1212);
    await sleep(1500);
    click(500, 2024);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");

    log.info("已领取邮件");
})();