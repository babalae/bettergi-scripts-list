(async function () {
    setGameMetrics(1920, 1080, 2);
    keyPress("M");
    await sleep(1500);
    click(1842, 1018);
    await sleep(1500);
    click(1467, 358);
    await sleep(1500);
    click(959, 543);
    await sleep(1500);
    click(1300, 735);
    await sleep(1500);
    click(1570, 1009);
    await sleep(10000);
    keyDown("w");
    await sleep(4500);
    keyUp("w");
    keyDown("d");
    await sleep(500);
    keyUp("d");
    keyDown("w");
    await sleep(1450);
    keyUp("w");

    log.info("已到达合成台旁");
})();