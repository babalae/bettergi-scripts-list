(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("F");
    await sleep(3000); 
    click(1370, 420); 
    await sleep(3000); 
    click(1370, 420); 
    await sleep(3000); 
    click(1800, 710);
    await sleep(3000); 
    click(1080, 960);
    await sleep(3000); 
    click(1865, 44);
    await sleep(8000); 
    log.info("已领取洞天宝钱和好感");
})();