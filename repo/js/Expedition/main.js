(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("F");
    await sleep(3000); 
    click(960, 540); 
    await sleep(1000); 
    click(1400, 580);
    await sleep(1000); 
    click(160, 1010); 
    await sleep(1000); 
    click(1160, 1020);
    await sleep(1000); 
    keyPress("Escape"); 

    log.info("已领取每日委托奖励");
})();