(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    keyPress("B");
    await sleep(3000); 
    click(1060, 50); 
    await sleep(3000); 
    click(770, 180);
    await sleep(3000); 
    click(1690, 1010);
    await sleep(3000); 
    keyPress("F");
    await sleep(8000); 
    log.info("已进入尘歌壶");
})();