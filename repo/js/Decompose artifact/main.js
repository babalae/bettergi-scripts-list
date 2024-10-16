(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("B");
    await sleep(3000); 
    click(670,40);
    await sleep(2000); 
    click(660,1010);
    await sleep(2000); 
    click(300,1020); 
    await sleep(1000); 
    click(300,380);
    await sleep(400); 
    click(300,300);
    await sleep(400);    
    click(300,220);
    await sleep(400);
    click(300,150);
    await sleep(800);
    click(340,1010);
    await sleep(800);
    click(1740,1020);
    await sleep(800);
    click(1180,750);
    await sleep(800);
    click(950,800);
    await sleep(800);
    keyPress("Escape"); 
    await sleep(1000);
    keyPress("Escape"); 

    log.info("已分解狗粮");
})();