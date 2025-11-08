const defaultReplacementMap = {
    监: "盐",
    卵: "卯",
};

async function waitForTextAppear(targetText, ocrRegion, timeout = 5000, retryInterval = 50, replacementMap = defaultReplacementMap) {
    let x, y, width, height;

    if (Array.isArray(ocrRegion)) {
        [x, y, width, height] = ocrRegion;
    } else if (typeof ocrRegion === "object" && ocrRegion !== null) {
        ({ x, y, width, height } = ocrRegion);
    } else {
        throw new Error("Invalid parameter 'ocrRegion'");
    }

    const debugThreshold = timeout / retryInterval / 3;
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        let captureRegion = captureGameRegion();
        try {
            // 尝试 OCR 识别
            let resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, width, height)); // 指定识别区域
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = res.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, "g"), correctChar);
                }

                if (correctedText.includes(targetText)) {
                    return { success: true, wait_time: Date.now() - startTime };
                }
            }
        } catch (error) {
            log.warn(`页面标志识别失败，正在进行第 ${retryCount} 次重试...`);
        } finally {
            retryCount++; // 增加重试计数
            if (retryCount > debugThreshold) {
                let region = captureRegion.DeriveCrop(x, y, width, height);
                region.DrawSelf("debug");
                region.dispose();
            }
            captureRegion.dispose();
        }
        await sleep(retryInterval);
    }
    return { success: false };
}

async function recognizeTextAndClick(targetText, ocrRegion, timeout = 5000, retryInterval = 50, replacementMap = defaultReplacementMap) {
    let x, y, width, height;

    if (Array.isArray(ocrRegion)) {
        [x, y, width, height] = ocrRegion;
    } else if (typeof ocrRegion === "object" && ocrRegion !== null) {
        ({ x, y, width, height } = ocrRegion);
    } else {
        throw new Error("Invalid parameter 'ocrRegion'");
    }

    const debugThreshold = timeout / retryInterval / 3;
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        let captureRegion = captureGameRegion();
        try {
            // 尝试 OCR 识别
            let resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, width, height)); // 指定识别区域
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = res.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, "g"), correctChar);
                }

                if (correctedText.includes(targetText)) {
                    // 如果找到目标文本，计算并点击文字的中心坐标
                    let centerX = Math.round(res.x + res.width / 2);
                    let centerY = Math.round(res.y + res.height / 2);
                    await click(centerX, centerY);
                    await sleep(50);
                    return { success: true, x: centerX, y: centerY };
                }
            }
        } catch (error) {
            log.warn(`页面标志识别失败，正在进行第 ${retryCount} 次重试...`);
        } finally {
            retryCount++; // 增加重试计数
            if (retryCount > debugThreshold) {
                let region = captureRegion.DeriveCrop(x, y, width, height);
                region.DrawSelf("debug");
                region.dispose();
            }
            captureRegion.dispose();
        }
        await sleep(retryInterval);
    }
    return { success: false };
}
