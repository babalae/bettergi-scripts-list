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


    setGameMetrics(1920, 1080, 2);// 设置游戏窗口大小和DPI

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

    // 點擊 "鍛造隊列"
    click(600, 150);
    await sleep(1000);
    //  點擊 "全部領取"
    click(160, 1010);
    await sleep(1000);
    //  點擊 "確認"
    click(970, 910);
    await sleep(1000);

    log.info("領取結束，退出畫面");
    // 退出鍛造頁面
    click(1845, 45);
    await sleep(1000);

})();