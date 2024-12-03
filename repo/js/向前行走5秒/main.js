(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
  // 向前走5s
keyDown("w");
await sleep(5000);
keyUp("w");

    log.info("已进入向前走5s");
})();