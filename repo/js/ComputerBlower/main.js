// 主函数
(async function () {
    operationMode = settings.operationMode || "综合测试";
    let xRange = 1651;
    let yRange = 1051;
    let whidth = 1920 - 1651;
    let height = 1080 - 1051;
    let interval = 1000;
    let timeout = 10;
    dispose = true;
    let template = file.ReadImageMatSync("assets/0.png");
    let template2 = file.ReadImageMatSync("assets/1.png");
    let roTM = RecognitionObject.TemplateMatch(template, xRange, yRange, whidth, height);
    let ro2TM = RecognitionObject.TemplateMatch(template2);
    let roOCR = RecognitionObject.ocr(xRange, yRange, whidth, height);
    let captureRegionScore = 0;
    let tempalteMatchScore = 0;
    let tempalteMatch2Score = 0;
    let calculateScore = 0;
    let ocrScore = 0;
    let tpScore = 0;
    await genshin.tpToStatueOfTheSeven();

    if (operationMode === "综合测试") {
        log.info("开始综合测试,预计用时约120秒");
        dispose = true;
        interval = 1000;
    }

    if (operationMode === "截图" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        let loopCount = 0;
        while (loopCount < timeout) {
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

    if (operationMode === "模板匹配1" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        let loopCount = 0;
        let GameRegion = captureGameRegion();
        while (loopCount < timeout) {
            try {

                let result = GameRegion.find(roTM);
                count++;
                if (Date.now() - startTime >= interval * (loopCount + 1)) {
                    loopCount++;
                    await sleep(1);
                    log.info(`在第${loopCount}个${interval}毫秒内执行了${count}次模板匹配1`);
                    tempalteMatchScore += count;
                    count = 0;
                }
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
        }
        if (dispose) GameRegion.dispose();
        tempalteMatchScore = Math.round(((tempalteMatchScore * 10 / loopCount) / 250) * 100) / 100;
        log.info(`模板匹配1测试完成,得分${tempalteMatchScore.toFixed(2)}`);
    }

    if (operationMode === "模板匹配2" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        let loopCount = 0;
        let GameRegion = captureGameRegion();
        while (loopCount < timeout) {
            try {

                let result = GameRegion.find(ro2TM);
                count++;
                if (Date.now() - startTime >= interval * (loopCount + 1)) {
                    loopCount++;
                    await sleep(1);
                    log.info(`在第${loopCount}个${interval}毫秒内执行了${count}次模板匹配2`);
                    tempalteMatch2Score += count;
                    count = 0;
                }
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }
        }
        if (dispose) GameRegion.dispose();
        tempalteMatch2Score = Math.round(((tempalteMatch2Score * 10 / loopCount) / 0.85) * 100) / 100;
        log.info(`模板匹配2测试完成,得分${tempalteMatch2Score.toFixed(2)}`);
    }

    if (operationMode === "ocr" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        let loopCount = 0;
        let GameRegion = captureGameRegion();
        while (loopCount < timeout) {
            try {
                let result = GameRegion.find(roOCR);
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
        ocrScore = Math.round((ocrScore * 2 * 10 / loopCount) * 100 / 3.5) / 100;
        log.info(`ocr测试完成,得分${ocrScore.toFixed(2)}`);
    }

    if (operationMode === '纯运算' || operationMode === '综合测试') {
        const startTime = Date.now();
        const timeoutMs = timeout * 1000;
        const CHECK_EVERY = 1000_000;   // ★ 每 100 万次看一次表

        let x = 1.23456789;
        let count = 0;        // 当前 interval 计数
        let loopCount = 0;    // 已完成的 interval 个数
        let totalIter = 0;    // 总迭代次数（用于分段时间判断）

        while (true) {
            // 一次性批跑 CHECK_EVERY 次浮点
            for (let i = 0; i < CHECK_EVERY; i++) {
                x = Math.sqrt(x + 1) * 1.000001;

            }
            count++;
            totalIter += CHECK_EVERY;

            // 批跑完再看时间
            const elapsed = Date.now() - startTime;
            if (elapsed >= timeoutMs) break;

            // 是否到达日志/统计点
            if (elapsed >= interval * (loopCount + 1)) {
                loopCount++;
                log.info(`第${loopCount}个${interval}ms 内执行了约 ${count}百万 次纯运算`);
                calculateScore += count;
                count = 0;
            }
        }

        const R60 = 6000;          // 60 分基准点
        const k = 0.2;         // 曲率系数
        const R = calculateScore; // 原始累加值（百万次）

        const score = 100 * Math.log1p(k * R) / Math.log1p(k * R60);
        calculateScore = Math.round(score * 100) / 100; // 保留两位小数

        log.info(`浮点运算测试完成，得分 ${calculateScore.toFixed(2)}`);
    }

    if (operationMode === "传送" || operationMode === "综合测试") {
        let startTime = Date.now();
        let count = 0;
        while (Date.now() - startTime < 45 * 1000) {
            try {
                await genshin.tp(-876.73, 2277.07);
                await genshin.tp(9452.18, 1660.94);
                count++;
            } catch (error) {
                log.error(`运行时发生异常: ${error.message}`);
                break;
            }

        }

        log.info(`在45秒内执行了${count * 2}次传送`);
        tpScore += count;
        count = 0;
        tpScore = Math.round((tpScore * 2 * 10) * 100) / 100;
        log.info(`传送测试完成,得分${tpScore.toFixed(2)}`);
    }

    if (operationMode === "综合测试") {
        log.info("综合测试结束");
        // squash 函数
        const squash = x => x <= 100 ? x : 100 + Math.log1p(x - 100);

        // 原始六项
        const src = [
            captureRegionScore,
            tempalteMatchScore,
            calculateScore,
            tempalteMatch2Score,
            ocrScore,
            tpScore
        ];

        // 1. 先 squash，2. 再升序，3. 按序号加权
        const w = [0.1, 0.2, 0.2, 0.2, 0.2, 0.1];
        let finalScore = src
            .map(squash)               // ① 压制 100+ 分数
            .sort((a, b) => a - b)     // ② 排序（1最小…6最大）
            .reduce((s, v, i) => s + v * w[i], 0); // ③ 加权

        // 可选保留两位小数
        finalScore = Math.round(finalScore * 100) / 100;


        log.info(`截图评分为${captureRegionScore.toFixed(2)}`);
        log.info(`模板匹配评分为${tempalteMatchScore.toFixed(2)}`);
        log.info(`模板匹配2评分为${tempalteMatch2Score.toFixed(2)}`);
        log.info(`浮点运算评分为${calculateScore.toFixed(2)}`);
        log.info(`ocr评分为${ocrScore.toFixed(2)}`);
        log.info(`传送评分为${tpScore.toFixed(2)}`);
        log.info(`综合评分为${finalScore.toFixed(2)}`)
    }
})();
