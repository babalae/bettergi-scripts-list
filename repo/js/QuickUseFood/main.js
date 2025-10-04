(async function () {
    notification.send("自动消耗回血食物脚本开始");
    await genshin.returnMainUi(); // 返回主界面
    
    setGameMetrics(1920, 1080, 1.25);
    
    if (!settings.numToUse) {
        throw new Error("请选择数量");
    }

    numToUse = settings.numToUse;
  
    let count = 0;

    let domainInfo = 
    {
        "name": "岩中幽谷",
        "position": [
            -476.8003,
            0,
            1897.123
        ]
    }

    // 进入副本
    await sleep(1000);
    await genshin.tp(domainInfo.position[2], domainInfo.position[0]);
    await sleep(1000);
    keyDown("w");
    await sleep(2500);
    keyUp("w");
    await sleep(500);
    keyDown("f");
    await sleep(500);
    keyUp("f");
    await sleep(5000);
    click(1780, 1030);
    await sleep(3000);

    click(1780, 1030);
    await sleep(10000);

    // 消除提示
    click(1780, 1030);
    await sleep(2000);
    
    notification.send("开始循环");

    while (count < numToUse) {

        await keyMouseScript.runFile("assets/fall.json");
        await sleep(4000);
        
        for (let i = 0; i < 4; i++) {
            if (!(count < numToUse)) {
                break;
            }
            keyDown("z");
            await sleep(200);
            keyUp("z");
            await sleep(200);
            count++;
        }
    }

    notification.send("循环结束");

    await genshin.tp(domainInfo.position[2], domainInfo.position[0]);

    notification.send("自动消耗回血食物脚本完成");
    
})();
