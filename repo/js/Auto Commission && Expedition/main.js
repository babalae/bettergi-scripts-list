(async function () {
    //传送到枫丹
    log.info('开始传送到枫丹廷');
    let Catherine_Egeria = `assets/AutoPath/冒险家协会_枫丹.json`;
    await pathingScript.runFile(Catherine_Egeria);
    log.info('开始每日委托或探索派遣，若无退出对话，则说明重复领取或未完成派遣');
    // 自动每日或纪行
    await keyPress("f");
    dispatcher.addTimer(new RealtimeTimer("AutoSkip", { "forceInteraction": true }));
    
})();