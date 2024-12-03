(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
  // 向右走1.5s
keyDown("D");
await sleep(1500);
keyUp("D");

    log.info("已进入向左走1.5s");
})();