(async function () {
    setGameMetrics(3840, 2160, 2);
    log.info("切换角色2");
    keyPress("VK_2");
    await sleep(50);
    log.info("往左侧发柱子避免卡路线");
    keyPress("VK_A");
    await sleep(50);
    keyDown("VK_E");
    await sleep(300);
    keyUp("VK_E");
    await sleep(400);
    log.info("切换角色3");
    keyPress("VK_3");

    log.info("切换角色结束");
})();