// 模块级变量，存储默认映射表
let replacementMap = {
    监: "盐",
    卵: "卯",
};

/** 允许用户在运行时动态修改库的默认映射表 */
function setGlobalReplacementMap(newMap) {
    if (typeof newMap === "object" && newMap !== null) {
        replacementMap = newMap;
    }
}

/**
 * 内部私有工具：校正文本
 */
function _correctText(text, customMap) {
    if (!text) return "";
    const map = customMap || replacementMap; // 如果没传自定义的，就用默认的
    let correctedText = text;
    for (const [wrong, right] of Object.entries(map)) {
        correctedText = correctedText.replace(new RegExp(wrong, "g"), right);
    }
    return correctedText.trim();
}

/**
 * 解析坐标
 * @param {Array|Object} area - 坐标 [x, y, w, h] 或 {x, y, width, height}
 */
function parseRect(area) {
    let x, y, width, height;
    if (Array.isArray(area)) {
        [x, y, width, height] = area;
    } else if (typeof area === "object" && area !== null) {
        ({ x, y, width, height } = area);
    } else {
        throw new TypeError("Invalid area format");
    }
    return { x, y, width, height };
}

/**
 * 屏幕截图包装器
 * @param {Function} action - 接收 region 对象的异步函数
 */
async function withCapture(action) {
    const region = captureGameRegion();
    try {
        return await action(region);
    } finally {
        region.dispose?.();
    }
}

/**
 * 局部裁剪包装器
 * @param {object} region - 父级截图区域
 * @param {object} rect - {x, y, width, height}
 * @param {Function} action - 接收 crop 对象的异步函数
 */
async function withCrop(region, rect, action) {
    const crop = region.DeriveCrop(rect.x, rect.y, rect.width, rect.height);
    try {
        return await action(crop);
    } finally {
        crop.dispose?.();
    }
}

/**
 * 安全地绘制区域标识（自动处理坐标解析与资源释放）
 * @param {Array|Object} area - 坐标 [x, y, w, h] 或 {x, y, width, height}
 * @param {object} [existingFrame=null] - (可选) 已有的截图对象。如果不传，则自动创建并释放新截图。
 * @param {string} label - 绘制在框上的标签名
 */
async function drawRegion(area, existingFrame = null, label = null) {
    const rect = parseRect(area);

    // 内部绘制逻辑：只负责裁切和画图
    const doDraw = async (f) => {
        await withCrop(f, rect, async (crop) => {
            const mark = label ? label : `rect_${rect.x}_${rect.y}_${rect.width}_${rect.height}`;
            crop.DrawSelf(mark);
        });
    };

    if (existingFrame) {
        // 如果外部传了 frame，我们只负责释放 crop，不释放外部的 frame
        await doDraw(existingFrame);
    } else {
        // 如果没传，我们截一张新图，并在画完释放自己截的这张图
        await withCapture(async (tempFrame) => {
            await doDraw(tempFrame);
        });
    }
}

/**
 * 快速判断区域内是否存在文本（单次检查）
 */
async function isTextExistedInRegion(searchText, ocrRegion) {
    const rect = parseRect(ocrRegion);
    
    return await withCapture(async (captureRegion) => {
        const result = captureRegion.find(RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height));
        if (!result || !result.text) return false;

        const text = result.text;
        return (searchText instanceof RegExp) ? !!text.match(searchText) : text.includes(searchText);
    });
}


/**
 * 获取区域内的文本（带重试机制）
 */
async function getTextInRegion(ocrRegion, timeout = 5000, retryInterval = 50, replacementMap = null) {
    const rect = parseRect(ocrRegion);
    const debugThreshold = timeout / retryInterval / 3;
    const startTime = Date.now();
    let retryCount = 0;

    while (Date.now() - startTime < timeout) {
        // 使用 withCapture 自动管理截图资源的生命周期
        const result = await withCapture(async (captureRegion) => {
            try {
                const resList = captureRegion.findMulti(RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height));
                // resList 通常不是真正的 JS Array，使用 .count 且使用下标访问
                const count = resList.count || resList.Count || 0;
                for (let i = 0; i < count; i++) {
                    const res = resList[i];
                    if (!res || !res.text) continue;
                    const corrected = _correctText(res.text, replacementMap);
                    // 如果识别到了有效文本（不为空），则返回
                    if (corrected) {
                        return corrected;
                    }
                }
            } catch (error) {
                log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
            }
            
            // 达到调试阈值时画框
            if (++retryCount > debugThreshold) {
                await drawRegion(rect, captureRegion, "debug");
            }
            return null;
        });

        if (result !== null) return result;
        await sleep(retryInterval);
    }
    return null;
}

/**
 * 等待特定文本出现
 */
async function waitForTextAppear(targetText, ocrRegion, timeout = 5000, retryInterval = 50, replacementMap = null) {
    const startTime = Date.now();
    
    // 循环复用 getTextInRegion 的逻辑思想
    while (Date.now() - startTime < timeout) {
        const currentText = await getTextInRegion(ocrRegion, retryInterval, retryInterval, replacementMap);
        if (currentText && currentText.includes(targetText)) {
            return { success: true, wait_time: Date.now() - startTime };
        }
        // 此处不需要额外 sleep，因为 getTextInRegion 内部已经耗费了时间
    }
    return { success: false };
}

/**
 * 识别文本并点击中心点
 */
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 5000, retryInterval = 50, replacementMap = null) {
    const rect = parseRect(ocrRegion);
    const debugThreshold = timeout / retryInterval / 3;
    const startTime = Date.now();
    let retryCount = 0;

    while (Date.now() - startTime < timeout) {
        const clicked = await withCapture(async (captureRegion) => {
            try {
                const resList = captureRegion.findMulti(RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height));
                // resList 通常不是真正的 JS Array，使用 .count 且使用下标访问
                const count = resList.count || resList.Count || 0;
                for (let i = 0; i < count; i++) {
                    const res = resList[i];
                    const correctedText = _correctText(res.text, replacementMap);
                    if (correctedText.includes(targetText)) {
                        const centerX = Math.round(res.x + res.width / 2);
                        const centerY = Math.round(res.y + res.height / 2);
                        await click(centerX, centerY);
                        await sleep(50);
                        return { success: true, x: centerX, y: centerY };
                    }
                }
            } catch (e) {
                log.warn(`识别点击失败重试中...`);
            }

            if (++retryCount > debugThreshold) {
                await drawRegion(rect, captureRegion);
            }
            return null;
        });

        if (clicked) return clicked;
        await sleep(retryInterval);
    }
    return { success: false };
}
