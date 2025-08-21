(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
  // 向后走5s
keyDown("S");
await sleep(5000);
keyUp("S");

    log.info("已进入向后走5s");
})();