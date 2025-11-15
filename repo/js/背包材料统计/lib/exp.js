
// ===================== 狗粮模式专属函数 =====================
// 1. 狗粮分解配置与OCR区域
const AUTO_SALVAGE_CONFIG = {
    autoSalvage3: settings.autoSalvage3 || "是",
    autoSalvage4: settings.autoSalvage4 || "是"
};
const OCR_REGIONS = {
    expStorage: { x: 1472, y: 883, width: 170, height: 34 },
    expCount: { x: 1472, y: 895, width: 170, height: 34 }
};

// 2. 数字替换映射表（处理OCR识别误差）
const numberReplaceMap = {
    "O": "0", "o": "0", "Q": "0", "０": "0",
    "I": "1", "l": "1", "i": "1", "１": "1", "一": "1",
    "Z": "2", "z": "2", "２": "2", "二": "2",
    "E": "3", "e": "3", "３": "3", "三": "3",
    "A": "4", "a": "4", "４": "4",
    "S": "5", "s": "5", "５": "5",
    "G": "6", "b": "6", "６": "6",
    "T": "7", "t": "7", "７": "7",
    "B": "8", "θ": "8", "８": "8",
    "g": "9", "q": "9", "９": "9",
};

// 3. OCR文本处理
function processExpText(text) {
    let correctedText = text || "";
    let removedSymbols = [];

    // 替换错误字符
    for (const [wrong, correct] of Object.entries(numberReplaceMap)) {
        correctedText = correctedText.replace(new RegExp(wrong, 'g'), correct);
    }

    // 提取纯数字
    let finalText = '';
    for (const char of correctedText) {
        if (/[0-9]/.test(char)) {
            finalText += char;
        } else if (char.trim() !== '') {
            removedSymbols.push(char);
        }
    }

    return {
        processedText: finalText,
        removedSymbols: [...new Set(removedSymbols)]
    };
}

// 4. OCR识别EXP
async function recognizeExpRegion(regionName, ra = null, timeout = 2000) {
    const ocrRegion = OCR_REGIONS[regionName];
    if (!ocrRegion) {
        log.error(`[狗粮OCR] 无效区域：${regionName}`);
        return { success: false, expCount: 0 };
    }

    log.info(`[狗粮OCR] 识别${regionName}（x=${ocrRegion.x}, y=${ocrRegion.y}）`);
    const startTime = Date.now();
    let retryCount = 0;

    while (Date.now() - startTime < timeout) {
        try {
            const ocrResult = ra.find(RecognitionObject.ocr(
                ocrRegion.x,
                ocrRegion.y,
                ocrRegion.width,
                ocrRegion.height
            ));
            log.info(`[狗粮OCR] 原始文本：${ocrResult.text}`);

            if (ocrResult?.text) {
                const { processedText, removedSymbols } = processExpText(ocrResult.text);
                if (removedSymbols.length > 0) {
                    log.info(`[狗粮OCR] 去除无效字符：${removedSymbols.join(', ')}`);
                }
                const expCount = processedText ? parseInt(processedText, 10) : 0;
                log.info(`[狗粮OCR] ${regionName}结果：${expCount}`);
                return { success: true, expCount };
            }
        } catch (error) {
            retryCount++;
            log.warn(`[狗粮OCR] ${regionName}第${retryCount}次识别失败：${error.message}`);
        }
        await sleep(500);
    }

    log.error(`[狗粮OCR] ${regionName}超时未识别，默认0`);
    return { success: false, expCount: 0 };
}

// 5. 狗粮分解流程
async function executeSalvageWithOCR() {
    log.info("[狗粮分解] 开始执行分解流程");
    let storageExp = 0;
    let countExp = 0;

    let cachedFrame = null;

    try {
        keyPress("B"); await sleep(1000);
        const coords = [
            [670, 40],                  // 打开背包
            [660, 1010],    // 打开分解
            [300, 1020],    // 打开分解选项页面
            // [200, 150, 500],      // 勾选1星狗粮
            // [200, 220, 500],      // 勾选2星狗粮
            [200, 300, 500, AUTO_SALVAGE_CONFIG.autoSalvage3 !== '否'], // 3星（按配置）
            [200, 380, 500, AUTO_SALVAGE_CONFIG.autoSalvage4 !== '否'], // 4星（按配置）
            [340, 1000],    // 确认选择
            [1720, 1015],   // 点击是否分解
            [1320, 756],     // 确认分解
            [1840, 45, 1500],     // 退出
            [1840, 45],     // 退出
            [1840, 45],     // 退出
        ];

        for (const coord of coords) {
            const [x, y, delay = 1000, condition = true] = coord;
            if (condition) {
                click(x, y);
                await sleep(delay);
                log.debug(`[狗粮分解] 点击(${x},${y})，延迟${delay}ms`);

                // 分解前识别储存EXP
                if (x === 660 && y === 1010) {
                    cachedFrame?.dispose();
                    cachedFrame = captureGameRegion();
                    const { expCount } = await recognizeExpRegion("expStorage", cachedFrame, 1000);
                    storageExp = expCount;
                }

                // 分解后识别新增EXP
                if (x === 340 && y === 1000) {
                    cachedFrame?.dispose();
                    cachedFrame = captureGameRegion();
                    const { expCount } = await recognizeExpRegion("expCount", cachedFrame, 1000);
                    countExp = expCount;
                }
            }
        }

        const totalExp = countExp - storageExp; // 分解新增EXP = 分解后 - 分解前
        log.info(`[狗粮分解] 完成，新增EXP：${totalExp}（分解前：${storageExp}，分解后：${countExp}）`);
        return { success: true, totalExp: Math.max(totalExp, 0) }; // 避免负数
    } catch (error) {
        log.error(`[狗粮分解] 失败：${error.message}`);
        return { success: false, totalExp: 0 };
    }
}

// 6. 判断是否为狗粮资源（关键词匹配）
function isFoodResource(resourceName) {
    const foodKeywords = ["12h狗粮", "24h狗粮"];
    return resourceName && foodKeywords.some(keyword => resourceName.includes(keyword));
}
