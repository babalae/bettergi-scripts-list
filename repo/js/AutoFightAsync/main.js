async function recognizeTextInRegion(ocrRegion, timeout = 2 * 60 * 1000) {
    let startTime = Date.now();
    const successKeywords = ["挑战达成", "战斗胜利", "挑战成功"];
    const failureKeywords = ["挑战失败"];
    while (Date.now() - startTime < timeout) {
        try {
            let result = captureGameRegion().find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            let text = result.text;
            for (let keyword of successKeywords) {
                if (text.includes(keyword)) {
                    log.info("检测到战斗成功关键词: {0}", keyword);
                    return true;
                }
            }
            for (let keyword of failureKeywords) {
                if (text.includes(keyword)) {
                    log.warn("检测到战斗失败关键词: {0}", keyword);
                    return false;
                }
            }
        }
        catch (error) {
            log.error("OCR过程中出错: {0}", error);
        }
        await sleep(1000);   // 检查间隔
    }
    log.warn("在超时时间内未检测到战斗结果");
    return false;
}

(async function () {
    await genshin.returnMainUi();
    keyPress("F");
    // 上面是地脉测试使用的代码 正式使用请注释掉
    const cts = new CancellationTokenSource();
    try {
        log.info("开始执行自动战斗任务...");
        const battleTask = dispatcher.RunTask(new SoloTask("AutoFight"), cts);
        const ocrRegionX = 850;
        const ocrRegionY = 230;
        const ocrRegionWidth = 1040 - 850;
        const ocrRegionHeight = 300 - 230;
        let ocrRegion = { x: ocrRegionX, y: ocrRegionY, width: ocrRegionWidth, height: ocrRegionHeight };
        let fightResult = await recognizeTextInRegion(ocrRegion) ? "成功" : "失败";
        log.info(`战斗任务已结束，战斗结果：${fightResult}`);
        cts.cancel();
    } catch (error) {
        log.error(`执行过程中出错: ${error}`);
    }
})();