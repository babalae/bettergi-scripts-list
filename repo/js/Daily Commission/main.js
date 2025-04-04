(async function () {
    setGameMetrics(1920, 1080, 2);
    keyPress("F");
    log.info("按下F键");
    await sleep(1000);
    log.info("等待1秒");
    click(960, 540);
    log.info("点击坐标(960, 540)(屏幕中心)");
    await sleep(1500);
    log.info("等待1.5秒");
    click(1380, 425);
    log.info("点击坐标(1380, 425)(领取「每日委托」奖励)");
    await sleep(1000);
    log.info("等待1秒");
    click(960, 540);
    log.info("点击坐标(960, 540)(屏幕中心)");
    await sleep(3000);
    log.info("等待3秒");
    click(960, 960);
    log.info("点击坐标(960, 960)(关闭奖励弹出页面)");
    
    log.info("结束");
})();
