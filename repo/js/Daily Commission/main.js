(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("F");
    await sleep(3000); 
    click(960, 540); 
    await sleep(2000); 
    click(1400, 430);
    await sleep(3000); 
    click(950, 800); 

    log.info("已领取每日委托奖励");
})();