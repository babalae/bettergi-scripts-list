(async function () {
    // 所有的代码必须由 async function 包裹
    async function AutoPath(locationName) {
        log.info(`前往 ${locationName}`);
        try {
            let filePath = `assets/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        await sleep(2000);
        if (locationName == "纳塔凯瑟琳")
            keyDown("w");
            await sleep(4500);
            keyUp("w");
            keyDown("d");
            await sleep(2000);
            keyUp("d");           
    }
    let filePath;
    
    if (settings.selectway === undefined)
        filePath = "枫丹凯瑟琳"
    else
        filePath = settings.selectway;

    log.info("开始执行路径脚本");
    await AutoPath(filePath);
})();
