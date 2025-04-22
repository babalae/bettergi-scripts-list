(async function () {
    setGameMetrics(1920, 1080, 2);
    // 传送到枫丹冒险家公会附近传送点
    await genshin.tp(4514.18, 3630.4);
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