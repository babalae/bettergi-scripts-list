// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "炽": "烬",
    "盞": "盏",
    "攜": "携",
    "於": "于",
    "卵": "卯"
};


/**
 * 执行OCR识别并匹配目标文本（失败自动重截图，返回结果+有效截图）
 * @param {string[]} targetTexts - 待匹配的目标文本列表
 * @param {Object} xRange - X轴范围 { min: number, max: number }
 * @param {Object} yRange - Y轴范围 { min: number, max: number }
 * @param {Object} ra - 初始图像捕获对象（外部传入，需确保已初始化）
 * @param {number} timeout - 超时时间(毫秒)，默认200ms
 * @param {number} interval - 重试间隔(毫秒)，默认50ms
 * @returns {Promise<{ 
 *   results: Object[],  // 识别结果数组（含文本、坐标）
 *   screenshot: Object  // 有效截图（成功时用的截图/超时前最后一次截图）
 * }>}
 */
async function performOcr(targetTexts, xRange, yRange, ra = null, timeout = 200, interval = 50) {
    // 正则特殊字符转义工具函数（避免替换时的正则语法错误）
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const startTime = Date.now(); // 记录开始时间，用于超时判断
    let currentScreenshot = ra;   // 跟踪当前有效截图（初始为外部传入的原图）

    // 1. 初始参数校验（提前拦截无效输入）
    if (!currentScreenshot) {
        throw new Error("初始图像捕获对象(ra)未初始化，请传入有效截图");
    }
    const regionWidth = xRange.max - xRange.min;
    const regionHeight = yRange.max - yRange.min;
    if (regionWidth <= 0 || regionHeight <= 0) {
        throw new Error(`无效的识别区域：宽=${regionWidth}, 高=${regionHeight}`);
    }

    // 在超时时间内循环重试识别（处理临时失败，自动重截图）
    while (Date.now() - startTime < timeout) {
        // 额外增加空值检查，防止currentScreenshot变为null
        if (!currentScreenshot) {
            log.error("currentScreenshot为null，尝试重新捕获");
            currentScreenshot = captureGameRegion();
            await sleep(interval);
            continue;
        }

        try {
            // 2. 执行OCR识别（基于当前有效截图的指定区域）
            const resList = currentScreenshot.findMulti(
                RecognitionObject.ocr(xRange.min, yRange.min, regionWidth, regionHeight)
            );

            // 3. 处理识别结果（文本修正 + 目标匹配）
            const results = [];
            for (let i = 0; i < resList.count; i++) {
                const res = resList[i];
                let correctedText = res.text; // 修正后的文本
                const originalText = res.text; // 保留原始识别文本（便于调试）
                log.debug(`OCR原始文本: ${res.text}`);

                // 3.1 修正OCR常见错误（基于替换映射表）
                for (const [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    const escapedWrong = escapeRegExp(wrongChar);
                    correctedText = correctedText.replace(new RegExp(escapedWrong, 'g'), correctChar);
                }

                // 3.2 匹配目标文本（避免重复添加同一结果）
                const isTargetMatched = targetTexts.some(target => correctedText.includes(target));
                if (isTargetMatched) {
                    results.push({
                        text: correctedText,    // 最终修正后的文本
                        originalText: originalText, // 原始识别文本（调试用）
                        x: res.x, y: res.y,     // 文本在截图中的X/Y坐标
                        width: res.width, height: res.height // 文本区域尺寸
                    });
                }
            }

            // 4. 识别成功：返回「结果数组 + 本次成功用的截图」
            // log.info(`OCR识别完成，匹配到${results.length}个目标文本`);
            return {
                results: results,
                screenshot: currentScreenshot // 成功截图（与结果对应的有效画面）
            };

        } catch (error) {
            // 5. 识别失败：释放旧截图→重新捕获→更新当前截图
            if (currentScreenshot) {
                // 检查是否存在释放方法，支持不同可能的命名
                if (typeof currentScreenshot.Dispose === 'function') {
                    currentScreenshot.Dispose();
                } else if (typeof currentScreenshot.dispose === 'function') {
                    currentScreenshot.dispose();
                }
                log.debug("已释放旧截图资源，准备重新捕获");
            }
            
            // 重新捕获后增加null校验
            currentScreenshot = captureGameRegion();
            if (!currentScreenshot) {
                log.error("重新捕获截图失败，返回了null值");
            }
            
            log.error(`OCR识别异常（已重新截图，将重试）: ${error.message}`);
            await sleep(5); // 短暂等待，避免高频截图占用CPU/内存
        }

        await sleep(interval); // 每次重试间隔（默认50ms）
    }

    // 6. 超时未成功：返回「空结果 + 超时前最后一次截图」
    log.warn(`OCR识别超时（超过${timeout}ms）`);
    return {
        results: [],
        screenshot: currentScreenshot // 超时前最后一次有效截图（可用于排查原因）
    };
}
