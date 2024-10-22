(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
  // 向左走5s
keyDown("A");
await sleep(5000);
keyUp("A");

    log.info("已进入向右左走5s");
})();