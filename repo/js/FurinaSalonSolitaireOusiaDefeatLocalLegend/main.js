(async function () {
    if (settings.target == "科西霍") {
        await pathingScript.runFile("Assets/pathing/纳塔-科西霍.json");
    } else if (settings.target == "海浪中的莎孚") {
        await pathingScript.runFile("Assets/pathing/纳塔-海浪中的莎孚.json");
    }
    log.info("循环开始执行，确保正确设置芙宁娜在队伍中的序号，建议使用双水队提升伤害")

    log.info("正在附身纳塔龙")
    keyPress("T");//附身纳塔龙
    await sleep(2000);
    log.info("附身纳塔龙完成")

    const offField = "VK_" + settings.Furina
    const onField = "VK_" + settings.onField

    for (let i = 0; i < settings.cycleTimes; ++i) {

        log.info("正在执行第" + (i + 1) + "次");

        keyDown("VK_Q");//脱身纳塔龙
        await sleep(1200);
        keyUp("VK_Q");
        await sleep(100);

        leftButtonClick();//下落攻击快速落地
        await sleep(1000);

        keyPress(offField);//切换芙芙
        await sleep(1000);

        keyPress("VK_E");//释放芙芙元素战技
        await sleep(800);

        keyPress(onField);//芙芙切后台触发剧团
        await sleep(500);

        keyPress("VK_T");//附身纳塔龙
        await sleep(28500);

        log.info("第" + (i + 1) + "次执行完成")
    }

})();
