(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
  // 向右走0.5s
keyDown("D");
await sleep(500);
keyUp("D");

    log.info("已进入向左走0.5s");
})();