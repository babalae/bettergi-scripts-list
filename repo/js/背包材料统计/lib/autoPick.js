/*

// 自动拾取逻辑

*/

// 解析文件内容，提取分类信息
function parseCategoryContent(content) {
    if (!content) {
        log.warn(`文件内容为空`);
        return {};
    }

    const lines = content.split('\n').map(line => line.trim());
    const categories = {};

    lines.forEach(line => {
        if (!line.includes(':')) return;

        const [category, items] = line.split(':');
        if (!category || !items) return;

        categories[category.trim()] = items.split(',').map(item => item.trim()).filter(item => item !== '');
    });

    return categories;
}
// 从 targetText 文件夹中读取分类信息
function readtargetTextCategories(targetTextDir) {
    // log.info(`开始读取材料分类信息：${targetTextDir}`);
    const targetTextFilePaths = readAllFilePaths(targetTextDir, 0, 1);
    const materialCategories = {};

    // 解析筛选名单
    const pickTextNames = (settings.PickCategories || "")
        .split(/[,，、 \s]+/).map(n => n.trim()).filter(n => n);

    // 【新增：兜底日志】确认pickTextNames是否为空，方便排查
    log.info(`筛选名单状态：${pickTextNames.length === 0 ? '未指定（空），将加载所有文件' : '指定了：' + pickTextNames.join(',')}`);

    for (const filePath of targetTextFilePaths) {
        if (state.cancelRequested) break;
        const content = file.readTextSync(filePath);
        if (!content) {
            log.error(`加载文件失败：${filePath}`);
            continue;
        }

        const sourceCategory = basename(filePath).replace('.txt', ''); // 去掉文件扩展名
        // 【核心筛选：空名单直接跳过判断，加载所有】
        if (pickTextNames.length === 0) {
            // 空名单时，直接保留当前文件，不跳过
        } else if (!pickTextNames.includes(sourceCategory)) {
            // 非空名单且不在列表里，才跳过
            continue;
        }
        materialCategories[sourceCategory] = parseCategoryContent(content);
    }
    return materialCategories;
}
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
 * 执行OCR识别并匹配目标文本
 * @param {string[]} targetTexts - 待匹配的目标文本列表
 * @param {Object} xRange - X轴范围 { min: number, max: number }
 * @param {Object} yRange - Y轴范围 { min: number, max: number }
 * @param {number} timeout - 超时时间(毫秒)，默认200ms
 * @param {Object} ra - 图像捕获对象（外部传入，需确保已初始化）
 * @returns {Promise<Object[]>} 识别结果数组，包含匹配目标的文本及坐标信息
 */
async function performOcr(targetTexts, xRange, yRange, timeout = 10, ra = null) {
    // 正则特殊字符转义工具函数（避免替换时的正则语法错误）
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const startTime = Date.now(); // 记录开始时间，用于超时判断

    // 2. 计算识别区域宽高（xRange.max - xRange.min 为宽度，y同理）
    const regionWidth = xRange.max - xRange.min;
    const regionHeight = yRange.max - yRange.min;
    if (regionWidth <= 0 || regionHeight <= 0) {
        throw new Error(`无效的识别区域：宽=${regionWidth}, 高=${regionHeight}`);
    }

    // 在超时时间内循环重试识别（处理临时识别失败）
    while (Date.now() - startTime < timeout) {
        try {
            // 1. 检查图像捕获对象是否有效
            if (!ra) {
                throw new Error("图像捕获对象(ra)未初始化");
            }

            // 3. 执行OCR识别（在指定区域内查找多结果）
            const resList = ra.findMulti(
                RecognitionObject.ocr(xRange.min, yRange.min, regionWidth, regionHeight)
            );

            // 4. 处理识别结果（文本修正 + 目标匹配）
            const results = [];
            for (let i = 0; i < resList.count; i++) {
                const res = resList[i];
                let correctedText = res.text; // 原始识别文本
                log.info(`原始识别文本: ${res.text}`);

                // 4.1 修正识别错误（替换错误字符）
                for (const [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    const escapedWrong = escapeRegExp(wrongChar); // 转义特殊字符
                    correctedText = correctedText.replace(new RegExp(escapedWrong, 'g'), correctChar);
                }

                // 4.2 检查是否包含任意目标文本（避免重复添加同个结果）
                const isTargetMatched = targetTexts.some(target => correctedText.includes(target));
                if (isTargetMatched) {
                    results.push({
                        text: correctedText,
                        x: res.x,
                        y: res.y,
                        width: res.width,
                        height: res.height
                    });
                }
            }

            // 5. 识别成功，返回结果（无论是否匹配到目标，均返回当前识别到的有效结果）
            return results;

        } catch (error) {
            // 识别异常时记录日志，继续重试（直到超时）
            log.error(`OCR识别异常（将重试）: ${error.message}`);
            // 短暂等待后重试，避免高频失败占用资源
            await sleep(1);
        }
        await sleep(5); // 每次间隔 5 毫秒
    }

    // 超时未完成识别，返回空数组
    log.warn(`OCR识别超时（超过${timeout}ms）`);
    return [];
}

// const OCRdelay = Math.min(100, Math.max(0, Math.floor(Number(settings.OcrDelay) || 2))); // F识别基准时长

// 尝试找到 F 图标并返回其坐标
async function findFIcon(recognitionObject, timeout = 10, ra = null) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout && !state.cancelRequested) {
        try {
            let result = ra.find(recognitionObject);
            if (result.isExist() && result.x !== 0 && result.y !== 0) {
                return { success: true, x: result.x, y: result.y, width: result.width, height: result.height };
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            if (state.cancelRequested) {
                break; // 如果请求了取消，则退出循环
            }
            return null;
        }
        await sleep(5); // 每次检测间隔 5 毫秒
    }
    if (state.cancelRequested) {
        log.info("图像识别任务已取消");
    }
    return null;
}

// 对齐并交互目标
async function alignAndInteractTarget(targetTexts, fDialogueRo, textxRange, texttolerance, cachedFrame=null) {
    let lastLogTime = Date.now();
    // 记录每个材料的识别次数（文本+坐标 → 计数）
    const recognitionCount = new Map();

    while (!state.completed && !state.cancelRequested) {
        const currentTime = Date.now();
        if (currentTime - lastLogTime >= 10000) { // 每5秒记录一次日志
            log.info("检测中...");
            lastLogTime = currentTime;
        }
        await sleep(50);
        cachedFrame?.dispose();
        cachedFrame = captureGameRegion();

        // 尝试找到 F 图标
        let fRes = await findFIcon(fDialogueRo, 10, cachedFrame);
        if (!fRes) {
            continue;
        }

        // 获取 F 图标的中心点 Y 坐标
        let centerYF = fRes.y + fRes.height / 2;

        // 在当前屏幕范围内进行 OCR 识别
        let ocrResults = await performOcr(targetTexts, textxRange, { min: fRes.y - 3, max: fRes.y + 37 }, 10, cachedFrame);

        // 检查所有目标文本是否在当前页面中
        let foundTarget = false;
        for (let targetText of targetTexts) {
            let targetResult = ocrResults.find(res => res.text.includes(targetText));
            if (targetResult) {
                
                // 生成唯一标识并更新识别计数（文本+Y坐标）
                const materialId = `${targetText}-${targetResult.y}`;
                recognitionCount.set(materialId, (recognitionCount.get(materialId) || 0) + 1);
                
                let centerYTargetText = targetResult.y + targetResult.height / 2;
                if (Math.abs(centerYTargetText - centerYF) <= texttolerance) {
                    // log.info(`目标文本 '${targetText}' 和 F 图标水平对齐`);
                    if (recognitionCount.get(materialId) >= 1) {
                        keyPress("F"); // 执行交互操作
                        log.info(`交互或拾取: ${targetText}`);
                        
                        // F键后清除计数，确保单次交互
                        recognitionCount.delete(materialId);
                    }
                    
                    foundTarget = true;
                    break; // 成功交互后退出当前循环，但继续检测
                }
            }
        }

        // 如果在当前页面中没有找到任何目标文本，则滚动到下一页
        if (!foundTarget) {
            await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            // verticalScroll(-20);
        }
        if (state.cancelRequested) {
            break;
        }
    cachedFrame?.dispose();
    }

    if (state.cancelRequested) {
        log.info("检测任务已取消");
    } else if (!state.completed) {
        log.error("未能找到正确的目标文本或未成功交互，跳过该目标文本");
    }
}
