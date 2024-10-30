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
    await sleep(1750);
    keyUp("w");
    keyDown("a");
    await sleep(1330);
    keyUp("a");
    keyDown("w");
    await sleep(1200);
    keyUp("w");

    log.info("已到达凯瑟琳旁");
})();