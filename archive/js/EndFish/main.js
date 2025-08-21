(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    
      log.info(`退出钓鱼，为下个钓点做准备`);

      await keyPress("Escape");
  
      await sleep(1000);
  
      click(1010, 756);

      await sleep(1000);

})();