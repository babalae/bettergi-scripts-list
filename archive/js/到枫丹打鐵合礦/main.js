(async function () {

    async function AutoPath(locationName) {
        try {
            let filePath = `assets/AutoPath/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
            log.error(error.message);
        }
        await sleep(2000);
    }

    // 確認使用礦石
    function determineOre() {
        if (ore == '水晶块') {
            log.info("將使用 水晶块 鍛造礦石");
        } else if (ore == '紫晶块') {
            log.info("將使用 紫晶块 鍛造礦石");
        } else if (ore == '萃凝晶') {
            log.info("將使用 萃凝晶 鍛造礦石");
        } else {
            log.info("無指定礦石﹐將使用 水晶块 鍛造礦石");
        }
    }
    // 读取用户设置
    let ore = settings.ore != undefined ? settings.ore : '';

    setGameMetrics(1920, 1080, 2);// 设置游戏窗口大小和DPI
    determineOre();


    log.info("前往枫丹鐵匠位置");
    await AutoPath(`到枫丹打鐵`);
    log.info("到逹枫丹鐵匠位置");
    await sleep(2000);
    log.info("對話進入任鍛造頁面");
    await sleep(2000);
    keyPress("F");
    await sleep(2000);
    keyPress("F");
    await sleep(2000);
    click(1300, 505);
    await sleep(2000);
    keyPress("F");
    await sleep(2000);


    log.info("已進入任鍛造頁面，開始鍛造");
    // 點擊 "配方"
    click(220, 150);
    await sleep(1000);
    // 跟據用戶選擇的礦石進行鍛造
    if (ore == '水晶块') {
        click(545, 290);
    } else if (ore == '紫晶块') {
        click(685, 290);
    } else if (ore == '萃凝晶') {
        click(120, 455);
    } else {
        // 無指定礦石﹐將使用 水晶块 鍛造礦石
        click(545, 290);
    }
    await sleep(1000);
    // 按合成按鈕3次
    click(1645, 1015);
    await sleep(4000);
    click(1645, 1015);
    await sleep(4000);
    click(1645, 1015);
    await sleep(4000);


    log.info("鍛造結束，退出畫面");
    // 退出鍛造頁面
    click(1845, 45);
    await sleep(1000);

})();