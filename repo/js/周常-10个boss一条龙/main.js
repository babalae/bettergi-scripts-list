(async function () {

    bossMap = [];

    baoyanshu = settings.baoyanshu;
    if (baoyanshu) {
        bossMap.push("爆炎树");
    }

    foshishachong = settings.foshishachong;
    if (foshishachong) {
        bossMap.push("风蚀沙虫");
    }

    gpeiliadezangsong = settings.gpeiliadezangsong;
    if (gpeiliadezangsong) {
        bossMap.push("歌裴莉娅的葬送");
    }

    guyanlongxi = settings.guyanlongxi;
    if (guyanlongxi) {
        bossMap.push("古岩龙蜥");
    }

    hengchangjiguanzhulie = settings.hengchangjiguanzhulie;
    if (hengchangjiguanzhulie) {
        bossMap.push("恒常机关阵列");
    }

    jinyanrongyilongbujun = settings.jinyanrongyilongbujun;
    if (jinyanrongyilongbujun) {
        bossMap.push("金焰绒翼龙暴君");
    }

    kepeiliusidejiefu = settings.kepeiliusidejiefu;
    if (kepeiliusidejiefu) {
        bossMap.push("科培琉司的劫罚");
    }

    leyinquanxian = settings.leyinquanxian;
    if (leyinquanxian) {
        bossMap.push("雷音权现");
    }

    mooujiangui = settings.mooujiangui;
    if (mooujiangui) {
        bossMap.push("魔偶剑鬼");
    }

    qiannianzhenzhunlin = settings.qiannianzhenzhunlin;
    if (qiannianzhenzhunlin) {
        bossMap.push("千年珍珠骏麟");
    }

    rongyanhuidragonxiang = settings.rongyanhuidragonxiang;
    if (rongyanhuidragonxiang) {
        bossMap.push("熔岩辉龙像");
    }

    log.info('需要打的boss：{zy}', bossMap);


    //主流程
    if(!settings.confirm) throw new Error('请阅读使用说明后，在调度器中调用JS脚本，并设置好相关参数');


    for (let i = 0; i < bossMap.length; i++) {
        challengeName = bossMap[i]
        log.info('boss：{zy}', challengeName);
        log.info(`前往恢复状态`);
        log.info(`前往讨伐${challengeName}`);
        await pathingScript.runFile(`assets/${challengeName}前往.json`);
        await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
        log.info(`开始第${i+1}次战斗`);
        try {
        await dispatcher.runTask(new SoloTask("AutoFight"));
        } catch (error) {
        //失败后最多只挑战一次，因为两次都打不过，基本上没戏，干脆直接报错结束
        log.info(`挑战失败，再来一次`);
        await pathingScript.runFile("assets/recover.json");//回复状态
        await pathingScript.runFile(`assets/${challengeName}前往.json`);
        await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
        await dispatcher.runTask(new SoloTask("AutoFight"));
    }

    }
    

    // log.info(`前往第1次恢复状态`);
    // await pathingScript.runFile("assets/recover.json");//回复状态
    // log.info(`前往讨伐${challengeName}`);
    // await pathingScript.runFile(`assets/${challengeName}前往.json`);
    // await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
    // for (let i = 0;i < challengeNum; i++) {
    //     await sleep(1000);
    //     if(samePlace != "YES" && i > 0){
    //     log.info(`前往第${i+1}次恢复状态`);
    //     await pathingScript.runFile("assets/recover.json");//回复状态
    //     log.info(`前往第${i+1}次讨伐${challengeName}`);
    //     await pathingScript.runFile(`assets/${challengeName}前往.json`);
    //     await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
    //     }
    //     log.info(`开始第${i+1}次战斗`);
    //     try {
    //     await dispatcher.runTask(new SoloTask("AutoFight"));
    //     } catch (error) {
    //     //失败后最多只挑战一次，因为两次都打不过，基本上没戏，干脆直接报错结束
    //     log.info(`挑战失败，再来一次`);
    //     await pathingScript.runFile("assets/recover.json");//回复状态
    //     await pathingScript.runFile(`assets/${challengeName}前往.json`);
    //     await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
    //     await dispatcher.runTask(new SoloTask("AutoFight"));
    // }

    // }
    // await pathingScript.runFile("assets/recover.json");//回复状态
    // log.info(`首领讨伐结束`);
})();
