// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "炽": "烬",
    "盞": "盏",
    "攜": "携",
    "於": "于",
    "卵": "卯",
    "亥": "刻",
    "脈": "脉",
    "黄": "夤",
    "黃": "夤",
    "问": "间",
    "谭": "镡"
};

/**
 * 计算两个字符串的相似度（基于最长公共子序列）
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {number} 相似度（0-1之间的小数）
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    // 动态规划计算最长公共子序列长度
    const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    const lcsLength = dp[len1][len2];
    const maxLength = Math.max(len1, len2);
    
    return maxLength === 0 ? 0 : lcsLength / maxLength;
}

/**
 * 保存OCR无法识别的区域截图
 * @param {Object} screenshot - 截图对象
 * @param {Object} xRangeOrRegion - X轴范围 { min, max } 或区域 { x, y, width, height }
 * @param {Object} yRange - Y轴范围 { min, max }（可选，如果xRangeOrRegion是区域则不需要）
 * @param {string} saveDir - 保存目录，默认 'user/regions'
 */
async function saveFailedOcrRegion(screenshot, xRangeOrRegion, yRange = null, saveDir = 'user/regions') {
    log.info(`[saveFailedOcrRegion] 开始保存, screenshot: ${!!screenshot}`);
    if (!screenshot) {
        log.warn("[保存失败OCR] 截图为空，跳过保存");
        return;
    }
    
    let region;
    if (yRange === null) {
        region = xRangeOrRegion;
    } else {
        region = {
            x: xRangeOrRegion.min,
            y: yRange.min,
            width: xRangeOrRegion.max - xRangeOrRegion.min,
            height: yRange.max - yRange.min
        };
    }
    
    log.info(`[saveFailedOcrRegion] region: ${JSON.stringify(region)}`);
    await saveAllOcrRegionImages(screenshot, [region], {}, saveDir);
}


/**
 * 执行OCR识别并匹配目标文本（失败自动重截图，返回结果+有效截图）
 * @param {string[]} targetTexts - 待匹配的目标文本列表
 * @param {Object} region - 识别区域 { x: number, y: number, width: number, height: number }
 * @param {Object} ra - 初始图像捕获对象（外部传入，需确保已初始化）
 * @param {number} timeout - 超时时间(毫秒)，默认200ms
 * @param {number} interval - 重试间隔(毫秒)，默认50ms
 * @returns {Promise<{ 
 *   results: Object[],  // 识别结果数组（含文本、坐标）
 *   screenshot: Object, // 有效截图（成功时用的截图/超时前最后一次截图）
 *   shouldDispose: boolean // 是否需要释放此截图（true=需要释放，false=外部传入的截图）
 * }>}
 */
async function performOcr(targetTexts, region, ra = null, timeout = 200, interval = 50) {
    // 正则特殊字符转义工具函数（避免替换时的正则语法错误）
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const startTime = Date.now(); // 记录开始时间，用于超时判断
    let currentScreenshot = ra;   // 跟踪当前有效截图（初始为外部传入的原图）
    let isExternalRa = true;      // 标记当前截图是否为外部传入（不释放外部资源）

    // 1. 初始参数校验（提前拦截无效输入）
    if (!currentScreenshot) {
        throw new Error("初始图像捕获对象(ra)未初始化，请传入有效截图");
    }
    if (region.width <= 0 || region.height <= 0) {
        throw new Error(`无效的识别区域：宽=${region.width}, 高=${region.height}`);
    }

    // 在超时时间内循环重试识别（处理临时失败，自动重截图）
    while (Date.now() - startTime < timeout) {
        // 额外增加空值检查，防止currentScreenshot变为null
        if (!currentScreenshot) {
            log.error("currentScreenshot为null，尝试重新捕获");
            currentScreenshot = captureGameRegion();
            isExternalRa = false; // 重新捕获的截图不是外部传入的
            await sleep(interval);
            continue;
        }

        try {
            // 2. 执行OCR识别（基于当前有效截图的指定区域）
            const resList = currentScreenshot.findMulti(
                RecognitionObject.ocr(region.x, region.y, region.width, region.height)
            );

            // log.debug(`OCR识别到${resList.count}个文本块`);

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

                // 3.2 匹配目标文本（双向匹配 + 相似度特殊通道）
                const isTargetMatched = targetTexts.length === 0 || targetTexts.some(target => {
                    // 通道1：双向匹配（要求至少2个字符）
                    if (correctedText.length >= 2 && (correctedText.includes(target) || target.includes(correctedText))) {
                        return true;
                    }
                    
                    // 通道2：相似度大于75%（特殊通道）
                    const similarity = calculateSimilarity(correctedText, target);
                    if (similarity >= 0.75) {
                        log.debug(`相似度匹配: "${correctedText}" vs "${target}" = ${(similarity * 100).toFixed(1)}%`);
                        return true;
                    }
                    
                    return false;
                });
                if (isTargetMatched) {
                    results.push({
                        text: correctedText,    // 最终修正后的文本
                        originalText: originalText, // 原始识别文本（调试用）
                        x: res.x, y: res.y,     // 文本在截图中的X/Y坐标
                        width: res.width, height: res.height // 文本区域尺寸
                    });
                }
            }

            // log.debug(`OCR最终返回${results.length}个匹配结果`);

            // 4. 识别成功：返回「结果数组 + 本次成功用的截图」
            // log.info(`OCR识别完成，匹配到${results.length}个目标文本`);
            return {
                results: results,
                screenshot: currentScreenshot, // 成功截图（与结果对应的有效画面）
                shouldDispose: !isExternalRa    // 标记是否需要释放（true=需要释放，false=外部传入的截图）
            };

        } catch (error) {
            // 5. 识别失败：释放旧截图→重新捕获→更新当前截图
            if (currentScreenshot && !isExternalRa) {
                // 只释放非外部传入的截图
                try {
                    if (typeof currentScreenshot.Dispose === 'function') {
                        currentScreenshot.Dispose();
                    } else if (typeof currentScreenshot.dispose === 'function') {
                        currentScreenshot.dispose();
                    }
                    log.debug("已释放旧截图资源，准备重新捕获");
                } catch (e) {
                    log.debug(`释放旧截图失败（可能已释放）: ${e.message}`);
                }
            }
            
            // 重新捕获后增加null校验
            currentScreenshot = captureGameRegion();
            isExternalRa = false; // 重新捕获的截图不是外部传入的
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
    log.info(`[OCR] 准备保存失败区域截图, screenshot: ${!!currentScreenshot}, region: ${JSON.stringify(region)}`);
    await saveFailedOcrRegion(currentScreenshot, region);
    log.info(`[OCR] 保存失败区域截图完成`);
    return {
        results: [],
        screenshot: currentScreenshot, // 超时前最后一次有效截图（可用于排查原因）
        shouldDispose: !isExternalRa    // 标记是否需要释放
    };
}
