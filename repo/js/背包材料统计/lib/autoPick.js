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
            log.error(`识别图标异常: ${error.message}`);
            if (state.cancelRequested) {
                break;
            }
            return null;
        }
        await sleep(5); // 每次检测间隔 5 毫秒
    }
    if (state.cancelRequested) {
        log.info("图标识别任务已取消");
    }
    return null;
}

// 定义Scroll.png识别对象（按需求使用TemplateMatch，包含指定范围）
const ScrollRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("assets/Scroll.png"), 
    1055, 521, 15, 35  // 识别范围：x=1055, y=521, width=15, height=35
);

/**
 * 对齐并交互目标（直接用findFIcon识别Scroll.png）
 * @param {string[]} targetTexts - 待匹配的目标文本列表
 * @param {Object} fDialogueRo - F图标的识别对象
 * @param {Object} textxRange - 文本识别的X轴范围 { min: number, max: number }
 * @param {number} texttolerance - 文本与F图标Y轴对齐的容差
 * @param {Object} cachedFrame - 缓存的图像帧（可选）
 */
async function alignAndInteractTarget(targetTexts, fDialogueRo, textxRange, texttolerance, cachedFrame = null) {
    let lastLogTime = Date.now();
    const recognitionCount = new Map(); // 避免误触：文本+Y坐标 → 计数
    const ocrScreenshots = []; // 收集最新版performOcr返回的截图，统一释放

    try {
        while (!state.completed && !state.cancelRequested) {
            const currentTime = Date.now();
            // 每10秒输出检测日志（保留原逻辑）
            if (currentTime - lastLogTime >= 10000) {
                log.info("独立OCR识别中...");
                lastLogTime = currentTime;
            }
            await sleep(50);

            // 1. 释放上一帧缓存，捕获新帧（保留原逻辑）
            if (cachedFrame) {
                if (cachedFrame.Dispose) cachedFrame.Dispose();
                else if (cachedFrame.dispose) cachedFrame.dispose();
            }
            cachedFrame = captureGameRegion();

        // 尝试找到 F 图标
        let fRes = await findFIcon(fDialogueRo, 10, cachedFrame);
        if (!fRes) {
            const scrollRes = await findFIcon(ScrollRo, 10, cachedFrame); // 复用findFIcon函数
            if (scrollRes) {
                await keyMouseScript.runFile(`assets/滚轮下翻.json`); // 调用翻滚脚本
            }
            continue; // 继续下一轮检测
        }

            // 3. 核心改造：调用最新版performOcr
            // 适配点1：参数顺序调整为「targetTexts, xRange, yRange, ra, timeout, interval」
            // 适配点2：接收返回的「results+screenshot」，并收集screenshot
            const yRange = { min: fRes.y - 3, max: fRes.y + 37 }; // 原Y轴范围不变
            const { results: ocrResults, screenshot: ocrScreenshot } = await performOcr(
                targetTexts,    // 目标文本列表（原逻辑）
                textxRange,     // 文本X轴范围（原逻辑）
                yRange,         // 文本Y轴范围（原逻辑）
                cachedFrame,    // 初始截图（最新版：第4个参数为ra）
                10,             // 超时时间（保留原10ms）
                5               // 重试间隔（保留原5ms）
            );
            ocrScreenshots.push(ocrScreenshot); // 收集截图，避免内存泄漏

            // 4. 文本匹配与交互（保留原逻辑，无修改）
            let foundTarget = false;
            for (const targetText of targetTexts) {
                const targetResult = ocrResults.find(res => res.text.includes(targetText));
                if (!targetResult) continue;

                // 计数防误触（原逻辑）
                const materialId = `${targetText}-${targetResult.y}`;
                recognitionCount.set(materialId, (recognitionCount.get(materialId) || 0) + 1);

                // Y轴对齐判断（原逻辑）
                const centerYTargetText = targetResult.y + targetResult.height / 2;
                if (Math.abs(centerYTargetText - (fRes.y + fRes.height / 2)) <= texttolerance) {
                    if (recognitionCount.get(materialId) >= 1) {
                        keyPress("F");
                        log.info(`交互或拾取: ${targetText}`);
                        recognitionCount.delete(materialId);
                    }
                    
                    foundTarget = true;
                    break;
                }
            }

            // 5. 未找到目标则翻滚（保留原逻辑）
            if (!foundTarget) {
                await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            }
        }
    } catch (error) {
        log.error(`对齐交互异常: ${error.message}`);
    } finally {
        // 6. 统一释放所有资源（新增：解决内存泄漏）
        // 释放缓存帧
        if (cachedFrame) {
            if (cachedFrame.Dispose) cachedFrame.Dispose();
            else if (cachedFrame.dispose) cachedFrame.dispose();
        }
        // 释放OCR截图
        for (const screenshot of ocrScreenshots) {
            if (screenshot) {
                if (screenshot.Dispose) screenshot.Dispose();
                else if (screenshot.dispose) screenshot.dispose();
            }
        }
        // 任务状态日志（保留原逻辑）
        if (state.cancelRequested) {
            log.info("检测任务已取消");
        } else if (!state.completed) {
            log.error("未能找到正确的目标文本或未成功交互，跳过该目标文本");
        }
    }
}
