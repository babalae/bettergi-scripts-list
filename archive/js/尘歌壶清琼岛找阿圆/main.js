(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
  // 向左走1.5s
keyDown("A");
await sleep(1500);
keyUp("A");

    log.info("已进入向左走1.5s");
})();