(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("F1");
    await sleep(3000);
    click(300,340); 
    await sleep(1000);
    click(1550,750);
    await sleep(3000);
    keyPress("Escape");
  
    log.info("已领取历练点");
})();