(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("F");
    await sleep(1000); 
    click(1497, 1024); 
    await sleep(1000);
 

    log.info("已开始钓鱼");
})();