(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    await sleep(3000);     
    keyPress("F");
    await sleep(5000); 
    click(1370, 655); 
    await sleep(3000); 
    click(1370, 655); 
    await sleep(3000); 
    click(680,300); 
    await sleep(3000); 
    click(1760, 1020);
    await sleep(3000); 
    click(1160, 780);
    await sleep(3000); 
    click(1160, 780);
    await sleep(3000); 
    click(1865, 44);
    await sleep(3000);   
    log.info("已领取洞天宝钱和好感");
})();