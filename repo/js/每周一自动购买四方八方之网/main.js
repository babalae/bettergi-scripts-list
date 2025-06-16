(async function () {
    // 新增：检查是否为周一
    const today = new Date().getDay(); // 0=周日, 1=周一, ... 6=周六
    if (today !== 1) {
        log.info(`今天不是周一（当前星期代码：${today}），脚本终止`);
        return;
    }

    setGameMetrics(1920, 1080, 2);
    // 传送到稻妻若紫处
    async function AutoPath(locationName) {
        log.info(`前往稻妻-白狐之野-若紫处`);
        try {
            let filePath = `assets/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        await sleep(500);
    }
    async function Shopping() {
        await sleep(500);
        for (let j = 0; j < 4; j++) {
            keyPress("F"); await sleep(1000);//对话
        }
        await sleep(1000);
        for (let i = 0; i < 5; i++) {
            click(1690, 1020); await sleep(500); // 购买
            click(1170, 780); await sleep(400); // 确定
            click(1690, 1020); await sleep(200); // 点击空白处
        }
        keyPress("ESCAPE"); await sleep(2000);
    }
    log.info("开始执行脚本");
    await AutoPath("四方八方之网");
    log.info("到达若紫处");
    await Shopping();
    log.info("已购买5个四方八方之网");
})();