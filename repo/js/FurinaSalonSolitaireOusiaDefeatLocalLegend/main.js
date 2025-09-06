(async function () {
    setGameMetrics(2560, 1440, 1.5); // 设置游戏窗口大小和DPI

    log.info("循环开始执行，确保1号位芙宁娜，建议使用双水队提升伤害")

    log.info("正在附身纳塔龙")
    keyPress("T");//附身纳塔龙
    await sleep(2000);
    log.info("附身纳塔龙完成")

    for (let i = 0; i < settings.cycle_times; ++i) {

        log.info("正在执行第" + (i + 1) + "次");

        keyDown("Q");//脱身纳塔龙
        await sleep(1200);
        keyUp("Q");
        await sleep(100);

        leftButtonClick();//下落攻击快速落地
        await sleep(500);

        keyPress("1");//切换芙芙
        await sleep(1000);

        keyPress("E");//释放芙芙元素战技
        await sleep(800);

        keyPress("2");//芙芙切后台触发剧团
        await sleep(500);

        keyPress("T");//附身纳塔龙
        await sleep(28500);

        log.info("第" + (i + 1) + "次执行完成")
    }

})();
