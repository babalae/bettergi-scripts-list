// 主函数
(async function () {
    operationMode = settings.operationMode || "截图";
    const xRange = parseInt(+settings.xRange || 1920, 10);
    const yRange = parseInt(+settings.yRange || 1920, 10);
    let startTime = Date.now();
    const interval = +settings.interval || 1000;
    const timeout = +settings.timeout || 60;
    let lastCheck = startTime;
    let ocrcount = 0;
    let loopCount = 0;
    const imagePath = "assets/流放.png";
    let template = file.ReadImageMatSync(imagePath);
    if (operationMode === "截图") {
        while (Date.now() - startTime < timeout * 1000) {
            try {
                let GameRegion = captureGameRegion();
                if (settings.dispose) GameRegion.dispose();
                ocrcount++;
                if (Date.now() - lastCheck >= interval) {
                    loopCount++;
                    await sleep(1);
                    lastCheck = Date.now();
                    log.info(`在第${loopCount}个${interval}毫秒内执行了${ocrcount}次截图`);
                    ocrcount = 0;
                }
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
        }
    }

    if (operationMode === "模板匹配") {
        let GameRegion = captureGameRegion();
        while (Date.now() - startTime < timeout * 1000) {
            try {

                let recognitionObject = RecognitionObject.TemplateMatch(template, 0, 0, xRange, yRange);
                let result = GameRegion.find(recognitionObject);
                ocrcount++;
                if (Date.now() - lastCheck >= interval) {
                    loopCount++;
                    await sleep(1);
                    lastCheck = Date.now();
                    log.info(`在第${loopCount}个${interval}毫秒内执行了${ocrcount}次模板匹配`);
                    ocrcount = 0;
                }
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
        }
        if (settings.dispose) GameRegion.dispose();
    }
    if (operationMode === "ocr") {
        let GameRegion = captureGameRegion();
        while (Date.now() - startTime < timeout * 1000) {
            try {
                let result = GameRegion.findMulti(RecognitionObject.ocr(
                    0, 0,
                    xRange, yRange
                ));
                ocrcount++;
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
            if (Date.now() - lastCheck >= interval) {
                loopCount++;
                lastCheck = Date.now();
                await sleep(1);
                log.info(`在第${loopCount}个${interval}毫秒内执行了${ocrcount}次OCR`);
                ocrcount = 0;
            }
        }
        if (settings.dispose) GameRegion.dispose();
    }
})();
