(async function () {
    setGameMetrics(1920, 1080, 2);
    // 传送到枫丹冒险家公会附近传送点
    await genshin.tp(4514.18, 3630.4);
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