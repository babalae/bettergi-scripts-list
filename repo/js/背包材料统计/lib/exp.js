// ===================== 狗粮模式专属函数 =====================
// 1. 狗粮分解配置与OCR区域（保留原配置，无修改）
const AUTO_SALVAGE_CONFIG = {
    autoSalvage3: settings.autoSalvage3 || "是",
    autoSalvage4: settings.autoSalvage4 || "是"
};
const EXP_OCRREGIONS = {
    expStorage: { x: 1472, y: 883, width: 170, height: 34 },
    expCount: { x: 1472, y: 895, width: 170, height: 34 }
};

// 处理数字文本：保留原逻辑（复用全局数字替换能力）
function processNumberText(text) {
    let correctedText = text || "";
    let removedSymbols = [];

    // 替换错误字符（依赖全局 numberReplaceMap）
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

// 4. OCR识别EXP（核心改造：用 performOcr 替代重复OCR逻辑）
async function recognizeExpRegion(regionName, initialRa = null, timeout = 2000) {
    // 1. 基础校验（保留原逻辑）
    const ocrRegion = EXP_OCRREGIONS[regionName];
    if (!ocrRegion) {
        log.error(`[狗粮OCR] 无效区域：${regionName}`);
        return { success: false, expCount: 0, screenshot: null }; // 新增返回截图（便于调试）
    }

    log.info(`[狗粮OCR] 识别${regionName}（x=${ocrRegion.x}, y=${ocrRegion.y}）`);
    let ocrScreenshot = null; // 存储performOcr返回的有效截图

    try {
        // 2. 转换OCR区域格式：ocrRegion(x,y,width,height) → xRange/yRange(min/max)
        const xRange = { 
            min: ocrRegion.x, 
            max: ocrRegion.x + ocrRegion.width 
        };
        const yRange = { 
            min: ocrRegion.y, 
            max: ocrRegion.y + ocrRegion.height 
        };

        // 3. 调用新版 performOcr（自动重截图、资源管理、异常处理）
        // 目标文本传空数组：识别数字无需匹配特定文本，仅需提取内容
        const { results, screenshot } = await performOcr(
            [""],        // targetTexts：空数组（数字识别无特定目标）
            xRange,      // 转换后的X轴范围
            yRange,      // 转换后的Y轴范围
            initialRa,   // 初始截图（外部传入）
            timeout,     // 超时时间（复用原参数）
            50           // 重试间隔（默认50ms，比原500ms更灵敏）
        );
        ocrScreenshot = screenshot; // 暂存截图，后续返回或释放

        // 4. 处理OCR结果（保留原数字处理+日志逻辑）
        if (results.length > 0) {
            const { originalText, text: correctedText } = results[0]; // 从performOcr拿原始/修正文本
            log.info(`[狗粮OCR] 原始文本：${originalText}`); // 保持原日志格式

            // 用原processNumberText提纯数字
            const { processedText, removedSymbols } = processNumberText(correctedText);
            if (removedSymbols.length > 0) {
                log.info(`[狗粮OCR] 去除无效字符：${removedSymbols.join(', ')}`); // 保留原日志
            }

            const expCount = processedText ? parseInt(processedText, 10) : 0;
            log.info(`[狗粮OCR] ${regionName}结果：${expCount}`); // 保留原日志
            return { success: true, expCount, screenshot: ocrScreenshot }; // 返回截图（调试用）
        }

    } catch (error) {
        // 捕获performOcr未处理的异常（如参数错误）
        log.error(`[狗粮OCR] ${regionName}识别异常：${error.message}`);
        // 异常时释放截图资源
        if (ocrScreenshot) {
            if (ocrScreenshot.Dispose) ocrScreenshot.Dispose();
            else if (ocrScreenshot.dispose) ocrScreenshot.dispose();
        }
    }

    // 5. 识别失败/超时（保留原逻辑）
    log.error(`[狗粮OCR] ${regionName}超时未识别，默认0`);
    return { success: false, expCount: 0, screenshot: ocrScreenshot }; // 超时也返回截图（排查用）
}

// 5. 狗粮分解流程（调整：适配recognizeExpRegion的新返回值，优化资源释放）
async function executeSalvageWithOCR() {
    log.info("[狗粮分解] 开始执行分解流程");
    let storageExp = 0;
    let countExp = 0;
    let cachedFrame = null;
    let ocrScreenshots = []; // 存储识别过程中产生的截图（统一释放）

    try {
        keyPress("B"); 
        await sleep(1000);

        const coords = [
            [670, 40],                  // 打开背包
            [660, 1010],    // 打开分解
            [300, 1020],    // 打开分解选项页面
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

                // 分解前识别储存EXP（适配新的recognizeExpRegion返回值）
                if (x === 660 && y === 1010) {
                    // 释放旧缓存帧
                    if (cachedFrame) {
                        if (cachedFrame.Dispose) cachedFrame.Dispose();
                        else if (cachedFrame.dispose) cachedFrame.dispose();
                    }
                    // 捕获新帧
                    cachedFrame = captureGameRegion();
                    // 调用改造后的recognizeExpRegion（接收expCount和screenshot）
                    const { expCount, screenshot } = await recognizeExpRegion("expStorage", cachedFrame, 1000);
                    storageExp = expCount;
                    ocrScreenshots.push(screenshot); // 收集截图（后续统一释放）
                }

                // 分解后识别新增EXP（同上，适配新返回值）
                if (x === 340 && y === 1000) {
                    if (cachedFrame) {
                        if (cachedFrame.Dispose) cachedFrame.Dispose();
                        else if (cachedFrame.dispose) cachedFrame.dispose();
                    }
                    cachedFrame = captureGameRegion();
                    const { expCount, screenshot } = await recognizeExpRegion("expCount", cachedFrame, 1000);
                    countExp = expCount;
                    ocrScreenshots.push(screenshot); // 收集截图
                }
            }
        }

        // 计算并返回结果（保留原逻辑）
        const totalExp = countExp - storageExp;
        log.info(`[狗粮分解] 完成，新增EXP：${totalExp}（分解前：${storageExp}，分解后：${countExp}）`);
        return { success: true, totalExp: Math.max(totalExp, 0) };

    } catch (error) {
        log.error(`[狗粮分解] 失败：${error.message}`);
        return { success: false, totalExp: 0 };

    } finally {
        // 最终统一释放所有资源（避免内存泄漏）
        // 1. 释放缓存帧
        if (cachedFrame) {
            if (cachedFrame.Dispose) cachedFrame.Dispose();
            else if (cachedFrame.dispose) cachedFrame.dispose();
        }
        // 2. 释放OCR过程中产生的截图
        for (const screenshot of ocrScreenshots) {
            if (screenshot) {
                if (screenshot.Dispose) screenshot.Dispose();
                else if (screenshot.dispose) screenshot.dispose();
            }
        }
        log.debug("[狗粮分解] 所有资源已释放");
    }
}

// 6. 判断是否为狗粮资源（保留原逻辑，无修改）
function isFoodResource(resourceName) {
    const foodKeywords = ["12h狗粮", "24h狗粮"];
    return resourceName && foodKeywords.some(keyword => resourceName.includes(keyword));
}