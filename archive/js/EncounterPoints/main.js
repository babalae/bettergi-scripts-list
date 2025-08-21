(async function () {
    setGameMetrics(3840, 2160, 2);
    keyPress("F1");
    await sleep(1600);
    click(580, 680); 
    await sleep(1000);
    click(3110, 1508);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1500);
    keyPress("Escape");

    log.info("已领取历练点");
})();