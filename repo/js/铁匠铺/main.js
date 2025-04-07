(async function () {
    ///
    // 读取用户配置
    ///
    let smithyName = settings.smithyName != undefined ? settings.smithyName : "须弥铁匠铺";
    let ore = settings.ore != undefined ? settings.ore : '';

    ///
    // 定义函数
    ///
    // 自动前往铁匠铺
    async function autoSmithy(smithyName) {
        log.info(`自动前往${smithyName}`);
        try {
            let filePath = `assets/${smithyName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${smithyName} 路径时发生错误`);
            log.error(error.toString());
        }
    }

    //确认使用矿石
    function determineOre() {
        if (ore == '水晶块') 
             {log.info("将使用 水晶块 锻造矿石");} 
        else if (ore == '紫晶块') 
             {log.info("将使用 紫晶块 锻造矿石");} 
        else if (ore == '萃凝晶') 
             {log.info("将使用 萃凝晶 锻造矿石");} 
        else 
             {log.info("无指定矿石,将使用 水晶块 锻造矿石");}
    }

    const forgeOre = async function (smithyName) {
        await sleep(1000);
        keyPress("F"); await sleep(1000); // 开始交互
        await click(960, 600); await sleep(1000); // 跳过第一个对话
        await click(960, 600); await sleep(1000); // 跳过第一个对话
        await click(1375, 500); await sleep(1000);
        await click(960, 600); await sleep(1000); // 跳过第二个对话
        await click(960, 600); await sleep(1000); // 跳过第二个对话
        await click(520, 140); await sleep(1000); // 选择锻造队列
        await click(170, 1010); await sleep(1000); // 领取全部

    log.info("已进入锻造界面，开始锻造");
    // 点击"配方"
    click(220, 150);
    await sleep(1000);
    // 根据用户选择的矿石进行锻造
    if (ore == '水晶块') 
        {click(545, 290);} 
    else if (ore == '紫晶块') 
        {click(685, 290);} 
    else if (ore == '萃凝晶') 
        {click(120, 455);} 
    else {
        // 无指定矿石,将使用 水晶块 锻造矿石
        click(545, 290);
    }
    await sleep(1000);
    // 按合成按钮3次
    click(1645, 1015);
    await sleep(4000);
    click(1645, 1015);
    await sleep(4000);
    click(1645, 1015);
    await sleep(4000);


    log.info("锻造结束，退出画面");
    // 退出锻造界面
    click(1845, 45);
    await sleep(1000);
}

    ///
    // main
    ///
    setGameMetrics(1920, 1080, 1);
    await autoSmithy(smithyName);// 设置游戏窗口大小和DPI
    await forgeOre(smithyName);
    determineOre();
})();
