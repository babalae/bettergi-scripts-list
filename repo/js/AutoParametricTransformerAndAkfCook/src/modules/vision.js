//作者：夜雨l星辰
// 视觉识别模块：OCR 与图像识别封装（移植自AutoMonday），以及背包过期物品提示处理

// ===== 处理背包过期物品提示 =====
export async function handleExpiredItems() {
    try {
        const ifGuoqi = await textOCREnhanced("物品过期", 1.5, 0, 3, 870, 280, 170, 40);
        if (ifGuoqi.found) {
            log.info("检测到过期物品，正在处理...");
            await sleep(500);
            await click(980, 750); // 点击确认按钮，关闭提示
        }
    } catch (e) {
        log.warn("过期物品检测失败(可忽略): " + e.message);
    }
}

// ===== 文字OCR识别封装（移植自AutoMonday）=====
export async function textOCREnhanced(text, timeout, afterBehavior, debugmodel, x, y, w, h, matchMode) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;
    let lastResult = null;
    let captureRegion = null;
    while (Date.now() - startTime < timeoutMs) {
        try {
            captureRegion = captureGameRegion();
            const resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));
            for (let i = 0; i < resList.count; i++) {
                const res = resList[i];
                let isMatched = false;
                if (text === "") {
                    isMatched = true;
                } else if (matchMode === 1) {
                    isMatched = res.text === text;
                } else {
                    isMatched = res.text.includes(text);
                }
                if (isMatched) {
                    switch (afterBehavior) {
                        case 1:
                            await sleep(1000);
                            click(res.x, res.y);
                            break;
                        case 2:
                            await sleep(100);
                            keyPress("F");
                            break;
                        default:
                            break;
                    }
                    lastResult = { text: res.text, x: res.x, y: res.y, found: true };
                    break; // 只取第一个匹配项，避免空文本匹配时被后续文本块覆盖
                }
            }
            if (captureRegion) { captureRegion.dispose(); captureRegion = null; }
            if (lastResult && debugmodel !== 2) { return lastResult; }
            await sleep(100);
        } catch (error) {
            if (captureRegion) { captureRegion.dispose(); captureRegion = null; }
            log.error(`OCR异常: ${error.message}`);
            await sleep(100);
        }
    }
    return lastResult || { found: false };
}

// ===== 图像识别封装（移植自AutoMonday）=====
export async function imageRecognitionEnhanced(imagefilePath, timeout, afterBehavior, debugmodel, xa, ya, wa, ha, clickCenter, clickOffsetX, clickOffsetY, tt) {
    xa = xa || 0; ya = ya || 0; wa = wa || 1920; ha = ha || 1080; tt = tt || 0.8;
    if (xa + wa > 1920 || ya + ha > 1080) {
        return { found: false, error: "区域超出屏幕范围" };
    }
    const startTime = Date.now();
    let result = { found: false };
    try {
        const templateImage = file.ReadImageMatSync(imagefilePath);
        if (!templateImage) { throw new Error("无法读取模板图像"); }
        const Imagidentify = RecognitionObject.TemplateMatch(templateImage, true);
        if (tt !== 0.8) {
            Imagidentify.Threshold = tt;
            Imagidentify.InitTemplate();
        }
        for (let attempt = 0; attempt < 10; attempt++) {
            if (Date.now() - startTime > timeout * 1000) { break; }
            let captureRegion = captureGameRegion();
            if (!captureRegion) { await sleep(200); continue; }
            try {
                const croppedRegion = captureRegion.DeriveCrop(xa, ya, wa, ha);
                const res = croppedRegion.Find(Imagidentify);
                if (res.isEmpty()) {
                    // 未找到
                } else {
                    let clickX = res.x + xa;
                    let clickY = res.y + ya;
                    if (clickCenter) {
                        clickX += Math.floor(res.width / 2);
                        clickY += Math.floor(res.height / 2);
                    }
                    clickX += (clickOffsetX || 0);
                    clickY += (clickOffsetY || 0);
                    if (afterBehavior === 1) {
                        await sleep(1000);
                        click(clickX, clickY);
                    } else if (afterBehavior === 2) {
                        await sleep(1000);
                        keyPress("F");
                    }
                    result = { x: clickX, y: clickY, w: res.width, h: res.height, found: true };
                    break;
                }
            } finally {
                if (captureRegion) { captureRegion.dispose(); captureRegion = null; }
            }
            await sleep(200);
        }
    } catch (error) {
        log.info(`图像识别错误: ${error.message}`);
        result.error = error.message;
    }
    return result;
}
