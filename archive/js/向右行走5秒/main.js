(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
  // 向右走5s
keyDown("D");
await sleep(5000);
keyUp("D");

    log.info("已进入向右走5s");
})();