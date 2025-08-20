// 主函数
(async function () {
    operationMode = settings.operationMode || "综合测试";
    let xRange = parseInt(+settings.xRange || 1920, 10);
    let yRange = parseInt(+settings.yRange || 1080, 10);
    let interval = +settings.interval || 1000;
    let timeout = +settings.timeout || 60;
    let dispose = settings.dispose;


    const imagePath = "assets/流放.png";
    let template = file.ReadImageMatSync(imagePath);
    let captureRegionScore = 0;
    let tempalteMatchScore = 0;
    let ocrScore = 0;
    await genshin.tpToStatueOfTheSeven();

    if (operationMode === "综合测试") {
        log.info("开始综合测试,预计用时约30秒");
        dispose = true;
        timeout = 11;
        xRange = 1920;
        yRange = 1080;
        interval = 1000;
    }

    if (operationMode === "截图" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        let loopCount = 0;
        while (Date.now() - startTime <= timeout * 1000) {
            try {
                let GameRegion = captureGameRegion();
                if (dispose) GameRegion.dispose();
                count++;
                if (Date.now() - startTime >= interval * (loopCount + 1)) {
                    loopCount++;
                    await sleep(1);
                    log.info(`在第${loopCount}个${interval}毫秒内执行了${count}次截图`);
                    captureRegionScore += count;
                    count = 0;
                }
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
        }
        captureRegionScore = Math.round(((captureRegionScore * 10 / loopCount) / 33.3) * 100) / 100;
        log.info(`截图测试完成,得分${captureRegionScore.toFixed(2)}`);
    }

    if (operationMode === "模板匹配" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        let loopCount = 0;
        let GameRegion = captureGameRegion();
        while (Date.now() - startTime <= timeout * 1000) {
            try {
                let recognitionObject = RecognitionObject.TemplateMatch(template, 0, 0, xRange, yRange);
                let result = GameRegion.find(recognitionObject);
                count++;
                if (Date.now() - startTime >= interval * (loopCount + 1)) {
                    loopCount++;
                    await sleep(1);
                    log.info(`在第${loopCount}个${interval}毫秒内执行了${count}次模板匹配`);
                    tempalteMatchScore += count;
                    count = 0;
                }
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
        }
        if (dispose) GameRegion.dispose();
        tempalteMatchScore = Math.round(((tempalteMatchScore * 10 / loopCount) / 3.5) * 100) / 100;
        log.info(`模板匹配测试完成,得分${tempalteMatchScore.toFixed(2)}`);
    }

    if (operationMode === "ocr" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        let loopCount = 0;
        let GameRegion = captureGameRegion();
        while (Date.now() - startTime < timeout * 1000) {
            try {
                let result = GameRegion.findMulti(RecognitionObject.ocr(
                    0, 0,
                    xRange, yRange
                ));
                count++;
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
            if (Date.now() - startTime >= interval * (loopCount + 1)) {
                loopCount++;
                await sleep(1);
                log.info(`在第${loopCount}个${interval}毫秒内执行了${count}次OCR`);
                ocrScore += count;
                count = 0;
            }
        }
        if (dispose) GameRegion.dispose();
        ocrScore = ocrScore;
        ocrScore = Math.round((ocrScore * 2 * 10 / loopCount) * 100) / 100;
        log.info(`ocr测试完成,得分${ocrScore.toFixed(2)}`);
    }

    if (operationMode === "综合测试") {
        log.info("综合测试结束");
        finalScore = (captureRegionScore + tempalteMatchScore + ocrScore) / 3;
        log.info(`截图评分为${captureRegionScore.toFixed(2)}`);
        log.info(`模板匹配评分为${tempalteMatchScore.toFixed(2)}`);
        log.info(`ocr评分为${ocrScore.toFixed(2)}`);
        log.info(`综合评分为${finalScore.toFixed(2)}`)
    }
})();
