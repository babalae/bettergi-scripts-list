/*
// 自动拾取逻辑（基于最新版performOcr改造）
*/

// 拾取列表滚轮状态（var：跨文件/全局可读）
// 原来主循环 50ms 一轮、每轮都滚一档（每秒最多 20 档），会把列表顶部几栏一带而过；
// 改为固定间隔下翻，每下翻 pickScrollDownStep 档只回补 pickScrollUpStep 档（一小段），净位移向前、不整段倒退
var pickScrollInterval = 400;   // 每次滚动间隔(ms)
var pickScrollDownStep = 6;     // 连续下翻几档后回补一小段
var pickScrollUpStep = 1;       // 回补档数（只上翻一小段，不做整段倒退）
var pickScrollStep = 0;         // 本段已下翻档数
var lastPickScrollTime = 0;     // 上次滚动时刻

// 解析文件内容，提取分类信息（无修改，与OCR无关）
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

// 从 targetText 文件夹中读取分类信息（无修改，与OCR无关）
function readtargetTextCategories(targetTextDir) {
    const targetTextFilePaths = readAllFilePaths(targetTextDir, 0, 1, ['.txt']);
    const materialCategories = {};

    let pickTextNames = [];
    try {
        pickTextNames = Array.from(settings.PickCategories || []);
    } catch (e) {
        log.error(`获取PickCategories设置失败: ${e.message}`);
    }

    let availablePickCategories = [];
    try {
        availablePickCategories = targetTextFilePaths.map(filePath => basename(filePath).replace('.txt', ''));
        if (debugLog) log.info(`可用识别名单：${availablePickCategories.join(', ')}`);
    } catch (e) {
        log.error(`扫描识别名单目录失败: ${e.message}`);
    }

    if (pickTextNames.length === 0) {
        if (debugLog) log.info("未指定识别名单，将加载所有文件");
    } else {
        const invalidCategories = pickTextNames.filter(name => !availablePickCategories.includes(name));
        if (invalidCategories.length > 0) {
            log.warn(`以下识别名单不存在，将被忽略：${invalidCategories.join(', ')}`);
            pickTextNames = pickTextNames.filter(name => availablePickCategories.includes(name));
        }
    }

    if (debugLog) log.info(`筛选名单状态：${pickTextNames.length === 0 ? '未指定（空），将加载所有文件' : '指定了：' + pickTextNames.join(',')}`);

    for (const filePath of targetTextFilePaths) {
        if (state.cancelRequested) break;
        const content = safeReadTextSync(filePath);
        if (!content) {
            log.error(`加载文件失败：${filePath}`);
            continue;
        }

        const sourceCategory = basename(filePath).replace('.txt', '');

        // 核心筛选：空名单直接加载所有，非空名单仅加载指定
        if (pickTextNames.length === 0) {
            // 空名单时保留当前文件
        } else if (!pickTextNames.includes(sourceCategory)) {
            // 非空名单且不在列表中则跳过
            continue;
        }

        materialCategories[sourceCategory] = parseCategoryContent(content);
    }
    if (debugLog) log.info(`完成读取，加载的分类：${Object.keys(materialCategories).join(',')}`);
    return materialCategories;
}

// 尝试找到目标图标（F图标/Scroll.png通用）并返回其坐标（无修改，与OCR无关）
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
        await sleep(5); // 每次检测间隔5毫秒
    }
    if (state.cancelRequested) {
        log.info("图标识别任务已取消");
    }
    return null;
}

// 定义Scroll.png识别对象（无修改，与OCR无关）
const ScrollRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("assets/Scroll.png"), 
    1055, 521, 15, 35  // 识别范围：x=1055, y=521, width=15, height=35
);

/**
 * 对齐并交互目标（核心改造：适配最新版performOcr）
 * @param {string[]|Function} targetTextsOrFunc - 待匹配的目标文本列表或函数
 * @param {Object} fDialogueRo - F图标的识别对象
 * @param {Object} textxRange - 文本识别的X轴范围 { min: number, max: number }
 * @param {number} texttolerance - 文本与F图标Y轴对齐的容差
 * @param {Object} cachedFrame - 缓存的图像帧（可选）
 */
async function alignAndInteractTarget(targetTextsOrFunc, fDialogueRo, textxRange, texttolerance, cachedFrame = null) {
    let lastLogTime = Date.now();
    const recognitionCount = new Map();
    const ocrScreenshots = [];

    try {
        while (!state.completed && !state.cancelRequested) {
            if (state.ocrPaused) {
                await sleep(100);
                continue;
            }
            recognitionCount.clear();
            const currentTime = Date.now();
            
            if (currentTime - lastLogTime >= 15000) {
                if (debugLog) log.info("独立OCR识别中...");
                lastLogTime = currentTime;
            }
            await sleep(50);

            if (cachedFrame) {
                if (cachedFrame.Dispose) cachedFrame.Dispose();
                else if (cachedFrame.dispose) cachedFrame.dispose();
            }
            cachedFrame = captureGameRegion();

            let fRes = await findFIcon(fDialogueRo, 10, cachedFrame);
            if (!fRes) {
                const scrollRes = await findFIcon(ScrollRo, 10, cachedFrame);
                if (scrollRes && Date.now() - lastPickScrollTime >= pickScrollInterval) {
                    // 节流：每 pickScrollInterval 只滚一档
                    lastPickScrollTime = Date.now();
                    if (pickScrollStep >= pickScrollDownStep) {
                        // 下翻够一段 → 只回补一小段（上翻 pickScrollUpStep 档）再继续下翻，避免整段倒退把净位移抵消
                        pickScrollStep = 0;
                        log.debug(`未识别到F图标，但识别到Scroll.png，下翻${pickScrollDownStep}档后回补上翻${pickScrollUpStep}档`);
                        for (let i = 0; i < pickScrollUpStep; i++) {
                            await keyMouseScript.runFile(`assets/滚轮上翻.json`);
                        }
                    } else {
                        pickScrollStep++;
                        log.debug(`未识别到F图标，但识别到Scroll.png，执行下翻第${pickScrollStep}/${pickScrollDownStep}档`);
                        await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                    }
                }
                continue;
            }

            // 已找到F图标 → 重置滚动状态，下次进列表从头（下翻）开始
            pickScrollStep = 0;
            lastPickScrollTime = 0;

            const targetTexts = typeof targetTextsOrFunc === 'function' ? targetTextsOrFunc() : targetTextsOrFunc;

            const region = {
                x: textxRange.min,
                y: fRes.y - 3,
                width: textxRange.max - textxRange.min,
                height: 40
            };
            const { results: ocrResults, rawTexts: ocrRawTexts, screenshot: ocrScreenshot, shouldDispose } = await performOcr(
                targetTexts,
                region,
                cachedFrame,
                10,
                5
            );
            ocrScreenshots.push({ screenshot: ocrScreenshot, shouldDispose });

            let foundTarget = false;
            for (const targetResult of ocrResults) {
                const targetText = targetResult.text;

                const materialId = `${targetText}-${targetResult.y}`;
                recognitionCount.set(materialId, (recognitionCount.get(materialId) || 0) + 1);

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

            if (!foundTarget) {
                if (ocrResults.length > 0) {
                    const fCenterY = fRes.y + fRes.height / 2;
                    for (const res of ocrResults) {
                        const centerY = res.y + res.height / 2;
                        const yDiff = Math.abs(centerY - fCenterY);
                        const logText = `未匹配: "${res.text}" Y中心: ${centerY.toFixed(1)}, F图标Y中心: ${fCenterY.toFixed(1)}, 差值: ${yDiff.toFixed(1)}, 容忍度: ${texttolerance}`;
                        log.debug(logText);
                        writeFile("user/OCR未匹配记录.txt", logText);
                    }
                }
                await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            }
        }
    } catch (error) {
        log.error(`对齐交互异常: ${error.message}`);
    } finally {
        if (cachedFrame) {
            try {
                if (cachedFrame.Dispose) cachedFrame.Dispose();
                else if (cachedFrame.dispose) cachedFrame.dispose();
            } catch (e) {
                log.debug(`释放缓存帧失败（可能已释放）: ${e.message}`);
            }
        }
        for (const { screenshot, shouldDispose } of ocrScreenshots) {
            if (screenshot && shouldDispose) {
                try {
                    if (screenshot.Dispose) screenshot.Dispose();
                    else if (screenshot.dispose) screenshot.dispose();
                } catch (e) {
                    log.debug(`释放OCR截图失败（可能已释放）: ${e.message}`);
                }
            }
        }
        if (state.cancelRequested) {
            log.info("检测任务已取消");
        } else if (!state.completed) {
            log.error("未能找到正确的目标文本或未成功交互，跳过该目标文本");
        }
    }
}
