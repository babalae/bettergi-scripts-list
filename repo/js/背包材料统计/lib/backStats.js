eval(safeReadTextSync("lib/region.js"));

const holdX = Math.min(1920, Math.max(0, Math.floor(Number(settings.HoldX) || 1050)));
const holdY = Math.min(1080, Math.max(0, Math.floor(Number(settings.HoldY) || 750)));
const totalPageDistance = Math.max(10, Math.floor(Number(settings.PageScrollDistance) || 711));
const imageDelay = Math.min(1000, Math.max(0, Math.floor(Number(settings.ImageDelay) || 0))); // 识图基准时长    await sleep(imageDelay);

// 配置参数
const pageScrollCount = 22; // 最多滑页次数

// 材料分类映射表
const materialTypeMap = {
    "祝圣精华": "2",
    "锻造素材": "5",
    "怪物掉落素材": "3",
    "一般素材": "5",
    "周本素材": "3",
    "烹饪食材": "5",
    "角色突破素材": "3",
    "木材": "5",
    "宝石": "3",
    "鱼饵鱼类": "5",
    "角色天赋素材": "3",
    "武器突破素材": "3",
    "采集食物": "4",
    "料理": "4"
};

// 材料前位定义
const materialPriority = {
    "祝圣精华": 2,
    "锻造素材": 1,
    "怪物掉落素材": 1,
    "采集食物": 1,
    "一般素材": 2,
    "周本素材": 2,
    "料理": 2,
    "烹饪食材": 3,
    "角色突破素材": 3,
    "木材": 4,
    "宝石": 4,
    "鱼饵鱼类": 5,
    "角色天赋素材": 5,
    "武器突破素材": 6
};

// 2. 数字替换映射表（处理OCR识别误差）
var numberReplaceMap = {
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

// 提前计算所有动态坐标
// 物品区左顶处物品左上角坐标(117,121)
// 物品图片大小(123,152)
// 物品间隔(24,24)
// 第一点击区位置:123/2+117=178.5; 152/2+121=197
// const menuClickX = Math.round(575 + (Number(menuOffset) - 1) * 96.25); // 背包菜单的 X 坐标

// log.info(`材料分类: ${materialsCategory}, 菜单偏移值: ${menuOffset}, 计算出的点击 X 坐标: ${menuClickX}`);

// OCR识别文本
async function recognizeText(ocrRegion, timeout = 100, retryInterval = 20, maxAttempts = 10, maxFailures = 3, ra = null) {
    let startTime = Date.now();
    let retryCount = 0;
    let failureCount = 0; // 用于记录连续失败的次数
    // const results = [];
    const frequencyMap = {}; // 用于记录每个结果的出现次数

    while (Date.now() - startTime < timeout && retryCount < maxAttempts) {
        let ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        ocrObject.threshold = 0.85; // 适当降低阈值以提高速度
        let resList = ra.findMulti(ocrObject);

        if (resList.count === 0) {
            failureCount++;
            if (failureCount >= maxFailures) {
                ocrRegion.x += 3; // 每次缩小6像素
                ocrRegion.width -= 6; // 每次缩小6像素
                retryInterval += 10;

                if (ocrRegion.width <= 12) {
                    return false;
                }
            }
            retryCount++;
            await sleep(retryInterval);
            continue;
        }

        for (let res of resList) {
            let text = res.text;
            text = text.split('').map(char => numberReplaceMap[char] || char).join('');
            // results.push(text);

            if (!frequencyMap[text]) {
                frequencyMap[text] = 0;
            }
            frequencyMap[text]++;

            if (frequencyMap[text] >= 2) {
                return text;
            }
        }

        await sleep(retryInterval);
    }

    const sortedResults = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a]);
    return sortedResults.length > 0 ? sortedResults[0] : false;
}

// 优化后的滑动页面函数（基于通用函数）
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    await mouseDrag({
        holdMouseX: holdX, // 固定起点X
        holdMouseY: holdY, // 固定起点Y
        totalDistance: totalDistance, // 原逻辑中是向上滑动（原代码中是-moveDistance）
        stepDistance,
        stepInterval: delayMs,
        waitBefore: 50,
        waitAfter: 700, // 原逻辑中松开后等待700ms
        repeat: 1
    });
}

// 并行模板匹配函数
async function parallelTemplateMatch(ra, materials, x, y, width, height, threshold = 0.8, enableMouseMove = true) {
    const matchPromises = materials.map(({ name, mat }) => {
        return new Promise((resolve) => {
            try {
                const recognitionObject = RecognitionObject.TemplateMatch(mat, x, y, width, height);
                recognitionObject.threshold = threshold;
                recognitionObject.Use3Channels = true;

                const result = ra.find(recognitionObject);
                if (result.isExist() && result.x !== 0 && result.y !== 0) {
                    if (enableMouseMove) {
                        moveMouseTo(result.x, result.y);
                    }
                    resolve({ name, result });
                } else {
                    resolve({ name, result: null });
                }
            } catch (error) {
                log.error(`并行模板匹配错误: ${name} - ${error.message}`);
                resolve({ name, result: null });
            }
        });
    });

    return await Promise.all(matchPromises);
}

// 智能OCR识别函数
async function smartRecognizeText(ocrRegion, ra, quickMode = true) {
    if (quickMode) {
        // 快速模式：超时50ms，只尝试1次
        return await recognizeText(ocrRegion, 50, 5, 1, 1, ra);
    } else {
        // 正常模式：超时100ms，尝试3次
        return await recognizeText(ocrRegion, 100, 10, 3, 2, ra);
    }
}

// 批量OCR处理函数
async function batchRecognizeText(ocrRegions, ra, timeout = 200, retryInterval = 10, maxAttempts = 5, maxFailures = 2, quickMode = true) {
    const ocrPromises = ocrRegions.map(({ region, name }) => {
        return new Promise((resolve) => {
            smartRecognizeText(region, ra, quickMode)
                .then(result => resolve({ name, result }))
                .catch(error => {
                    log.error(`批量OCR错误: ${name} - ${error.message}`);
                    resolve({ name, result: false });
                });
        });
    });

    return await Promise.all(ocrPromises);
}

// 合并OCR区域函数（用于密集区域的批量处理）
function mergeOcrRegions(regions) {
    if (regions.length === 0) return [];

    // 按y坐标排序
    regions.sort((a, b) => a.region.y - b.region.y);

    const merged = [];
    let currentMerge = { ...regions[0] };

    for (let i = 1; i < regions.length; i++) {
        const region = regions[i];
        // 检查是否可以合并（垂直距离小于阈值）
        if (region.region.y - (currentMerge.region.y + currentMerge.region.height) < 20) {
            // 合并区域
            currentMerge.region.width = Math.max(currentMerge.region.width, region.region.width);
            currentMerge.region.height = region.region.y + region.region.height - currentMerge.region.y;
            currentMerge.name += `,${region.name}`;
        } else {
            merged.push(currentMerge);
            currentMerge = { ...region };
        }
    }
    merged.push(currentMerge);

    return merged;
}

// 通用鼠标拖动函数（提取重复逻辑）
/**
 * 通用鼠标拖动工具函数
 * @param {Object} options 拖动参数
 * @param {number} [options.holdX] 拖动起点X坐标（默认当前鼠标位置）
 * @param {number} [options.holdY] 拖动起点Y坐标（默认当前鼠标位置）
 * @param {number} options.totalDistance 总拖动距离（垂直方向，正数向下，负数向上）
 * @param {number} [options.stepDistance=10] 每步拖动距离
 * @param {number} [options.stepInterval=20] 步间隔时间(ms)
 * @param {number} [options.waitBefore=50] 按下左键前的等待时间(ms)
 * @param {number} [options.waitAfter=100] 拖动结束后的等待时间(ms)
 * @param {number} [options.repeat=1] 重复拖动次数
 * @param {Object} [options.state] 状态对象（用于外部控制中断）
 */
async function mouseDrag({
    holdMouseX,
    holdMouseY,
    totalDistance,
    stepDistance = 10,
    stepInterval = 20,
    waitBefore = 50,
    waitAfter = 100,
    repeat = 1,
    state = { isRunning: true }
}) {
    try {
        // 移动到起点（如果指定了起点）
        if (holdMouseX !== undefined && holdMouseY !== undefined) {
            moveMouseTo(holdMouseX, holdMouseY);
            await sleep(waitBefore);
        }

        leftButtonDown();
        await sleep(waitBefore); // 按下后短暂等待

        for (let r = 0; r < repeat; r++) {
            if (!state.isRunning) break;

            const steps = Math.ceil(Math.abs(totalDistance) / stepDistance);
            const direction = totalDistance > 0 ? 1 : -1; // 方向：正向下，负向上

            for (let s = 0; s < steps; s++) {
                if (!state.isRunning) break;
                // 计算当前步实际移动距离（最后一步可能不足stepDistance）
                const remaining = Math.abs(totalDistance) - s * stepDistance;
                const move = Math.min(stepDistance, remaining) * direction;
                moveMouseBy(0, move); // 垂直拖动
                await sleep(stepInterval);
            }

            // 更新进度（如果有状态对象）
            if (state) {
                state.progress = Math.min(100, Math.round((r + 1) / repeat * 100));
            }
            await sleep(waitAfter);
        }

        leftButtonUp();
        await sleep(waitBefore); // 松开后等待稳定
    } catch (e) {
        log.error(`拖动出错: ${e.message}`);
        leftButtonUp(); // 确保鼠标抬起，避免卡死
    }
}

function filterMaterialsByPriority(materialsCategory) {
    // 获取当前材料分类的优先级
    const currentPriority = materialPriority[materialsCategory];
    if (currentPriority === undefined) {
        throw new Error(`Invalid materialsCategory: ${materialsCategory}`);
    }

    // 获取当前材料分类的 materialTypeMap 对应值
    const currentType = materialTypeMap[materialsCategory];
    if (currentType === undefined) {
        throw new Error(`Invalid materialTypeMap for: ${materialsCategory}`);
    }

    // 获取所有优先级更低的材料分类（后位材料）
    const backPriorityMaterials = Object.keys(materialPriority)
        .filter(mat => materialPriority[mat] > currentPriority && materialTypeMap[mat] === currentType);

    // 合并当前和后位材料分类（只包含同位和后位，不包含前位）
    // 只有同位或后位材料才会触发全列扫描
    const finalFilteredMaterials = [...backPriorityMaterials, materialsCategory];
    return finalFilteredMaterials
}

// 扫描材料
async function scanMaterials(materialsCategory, materialCategoryMap) {
    // 材料图片缓存
    const materialImages = {}; // 用于缓存加载的图片
    const priorityMaterialImages = {}; // 用于缓存优先级材料图片

    // 获取当前+后位材料名单（仅包含同位和后位，不包含前位）
    const priorityMaterialNames = [];
    const finalFilteredMaterials = await filterMaterialsByPriority(materialsCategory);
    for (const category of finalFilteredMaterials) {
        const materialIconDir = `assets/images/${category}`;
        const materialIconFilePaths = file.ReadPathSync(materialIconDir);
        for (const filePath of materialIconFilePaths) {
            const name = basename(filePath).replace(".png", ""); // 去掉文件扩展名
            priorityMaterialNames.push({ category, name });

            // 预加载优先级材料图片
            if (!priorityMaterialImages[name]) {
                const mat = file.readImageMatSync(filePath);
                if (!mat.empty()) {
                    priorityMaterialImages[name] = mat;
                }
            }
        }
    }

    // 根据材料分类获取对应的材料图片文件夹路径
    const materialIconDir = `assets/images/${materialsCategory}`;

    // 使用 ReadPathSync 读取所有材料图片路径
    const materialIconFilePaths = file.ReadPathSync(materialIconDir);

    // 创建材料种类集合
    const materialCategories = [];
    const allMaterials = new Set(); // 用于记录所有需要扫描的材料名称

    // 检查 materialCategoryMap 中当前分类的数组是否为空
    const categoryMaterials = materialCategoryMap[materialsCategory] || [];
    const shouldScanAllMaterials = categoryMaterials.length === 0; // 如果为空，则扫描所有材料

    for (const filePath of materialIconFilePaths) {
        const name = basename(filePath).replace(".png", ""); // 去掉文件扩展名

        // 如果 materialCategoryMap 中当前分类的数组不为空
        // 且当前材料名称不在指定的材料列表中，则跳过加载
        if (pathingMode.onlyPathing && !shouldScanAllMaterials && !categoryMaterials.includes(name)) {
            continue;
        }

        const mat = file.readImageMatSync(filePath);
        if (mat.empty()) {
            log.error(`加载图标失败：${filePath}`);
            continue; // 跳过当前文件
        }

        materialCategories.push({ name, filePath });
        allMaterials.add(name); // 将材料名称添加到集合中
        materialImages[name] = mat; // 缓存图片
    }

    // 已识别的材料集合，避免重复扫描
    const recognizedMaterials = new Set();
    const unmatchedMaterialNames = new Set(); // 未匹配的材料名称
    const materialInfo = []; // 存储材料名称和数量

    // 扫描参数
    const tolerance = 1;
    const startX = 117;
    const startY = 121;
    const OffsetWidth = 146.428; // 146.428
    const columnWidth = 123;
    const columnHeight = 680;
    const maxColumns = 8;
    // 跟踪已截图的区域（避免重复）
    const capturedRegions = new Set();

    // 扫描状态
    let hasFoundFirstMaterial = false;
    let lastFoundTime = null;
    let shouldEndScan = false;
    let foundPriorityMaterial = false;

    // 俏皮话逻辑
    const scanPhrases = [
        "... 太好啦，有这么多素材！",
        "... 不错的珍宝！",
        "... 侦查骑士，发现目标！",
        "... 嗯哼，意外之喜！",
        "... 嗯？",
        "... 很好，没有放过任何角落！",
        "... 会有烟花材料嘛？",
        "... 嗯，这是什么？",
        "... 这些宝藏积灰了，先清洗一下",
        "... 哇！都是好东西！",
        "... 不虚此行！",
        "... 瑰丽的珍宝，令人欣喜。",
        "... 是对长高有帮助的东西吗？",
        "... 嗯！品相卓越！",
        "... 虽无法比拟黄金，但终有价值。",
        "... 收获不少，可以拿去换几瓶好酒啦。",
        "... 房租和伙食费，都有着落啦！",
        "... 还不赖。",
        "... 荒芜的世界，竟藏有这等瑰宝。",
        "... 运气还不错。",
    ];

    let tempPhrases = [...scanPhrases];
    tempPhrases.sort(() => Math.random() - 0.5); // 打乱数组顺序，确保随机性
    let phrasesStartTime = Date.now();
    let previousScreenshot = null; // 用于存储上一次翻页前的截图
    // 扫描背包中的材料
    for (let scroll = 0; scroll <= pageScrollCount; scroll++) {

        const ra = captureGameRegion();
        // 重置foundPriorityMaterial标志，每次翻页都重新检查
        foundPriorityMaterial = false;

        // 检查第八列是否有目标材料
        // priorityMaterialNames只包含当前和后位材料
        const priorityMaterialsToMatch = priorityMaterialNames
            .filter(({ name }) => !recognizedMaterials.has(name))
            .map(({ name }) => {
                const mat = priorityMaterialImages[name];
                return mat ? { name, mat } : null;
            })
            .filter(Boolean);

        if (priorityMaterialsToMatch.length > 0) {
            const matchResults = await parallelTemplateMatch(ra, priorityMaterialsToMatch, 1142, startY, columnWidth, columnHeight, 0.8);

            for (const { name, result } of matchResults) {
                if (result) {
                    foundPriorityMaterial = true; // 标记找到目标材料
                    // log.info(`发现目标材料: ${name}，开始全列扫描`);
                    break;
                }
            }
        }

        // 只有发现目标材料时，才执行全列扫描
        if (foundPriorityMaterial) {
            log.info(`开始全列扫描`);
            const ocrRegions = [];
            const matchedMaterials = [];

            for (let column = 0; column < maxColumns; column++) {
                const scanX0 = startX + column * OffsetWidth;
                const scanX = Math.round(scanX0);

                // 准备当前列需要扫描的材料
                const materialsToMatch = materialCategories
                    .filter(({ name }) => !recognizedMaterials.has(name))
                    .map(({ name }) => {
                        const mat = materialImages[name];
                        return mat ? { name, mat } : null;
                    })
                    .filter(Boolean);

                if (materialsToMatch.length > 0) {
                    // 并行扫描当前列的所有材料
                    const matchResults = await parallelTemplateMatch(ra, materialsToMatch, scanX, startY, columnWidth, columnHeight, 0.85);

                    // 收集匹配结果和OCR区域
                    for (const { name, result } of matchResults) {
                        if (result) {
                            recognizedMaterials.add(name);

                            // drawAndClearRedBox(result, ra, 100);// 调用异步函数绘制红框并延时清除
                            const ocrRegion = {
                                x: result.x - tolerance,
                                y: result.y + 97 - tolerance,
                                width: 66 + 2 * tolerance,
                                height: 22 + 2 * tolerance
                            };
                            ocrRegions.push({ region: ocrRegion, name });
                            matchedMaterials.push({ name, result });

                            if (!hasFoundFirstMaterial) {
                                hasFoundFirstMaterial = true;
                                lastFoundTime = Date.now();
                            } else {
                                lastFoundTime = Date.now();
                            }
                        }
                    }
                }
            }

            // 批量处理OCR
            if (ocrRegions.length > 0) {
                const ocrResults = await batchRecognizeText(ocrRegions, ra);

                // 处理OCR结果
                for (const { name, result } of ocrResults) {
                    materialInfo.push({ name, count: result || "?" });
                }
            }
        } else {
            log.info(`未发现目标材料，跳过`);
        }

        // 每5秒输出一句俏皮话
        const phrasesTime = Date.now();
        if (phrasesTime - phrasesStartTime >= 5000) {
            const selectedPhrase = tempPhrases.shift();
            log.info(selectedPhrase);
            if (tempPhrases.length === 0) {
                tempPhrases = [...scanPhrases];
                tempPhrases.sort(() => Math.random() - 0.5);
            }
            phrasesStartTime = phrasesTime;
        }

        // 检查是否结束扫描
        if (recognizedMaterials.size === allMaterials.size) {
            log.info("所有材料均已识别！");
            shouldEndScan = true;
            break;
        }

        if (hasFoundFirstMaterial && Date.now() - lastFoundTime > 5000) {
            log.info("未发现新的材料，结束扫描");
            shouldEndScan = true;
            break;
        }

        // 检查是否到达最后一页（使用画面比较替代滑条检测）
        // 注：画面比较逻辑已集成到翻页操作中


        // 捕获当前翻页前的截图（用于与下一次翻页前的截图比较）
        const currentScreenshot = {
            region: { x: 400, y: 400, width: 600, height: 100 }, // 长条形状比较区域
            mat: ra.DeriveCrop(400, 400, 600, 100).SrcMat // 外扩1像素
        };

        // 检查是否需要启动画面比较兜底逻辑
        let useScreenComparison = false;
        if (!shouldEndScan && scroll < pageScrollCount && previousScreenshot) {
            // 检查是否满足兜底条件：
            // 1. 已找到至少一个材料，但长时间未发现新材料
            // 2. 或连续多次未发现任何材料
            if (recognizedMaterials.size > 0) {
                const noNewMaterialTime = Date.now() - lastFoundTime;
                if (noNewMaterialTime > 5000) { // 5秒未发现新材料
                    useScreenComparison = true;
                    log.info(`5秒未发现新材料，启动画面比较兜底逻辑`);
                }
            } else if (scroll > 5) { // 连续翻页5次以上仍未发现任何材料
                useScreenComparison = true;
                log.info(`连续翻页${scroll}次未发现任何材料，启动画面比较兜底逻辑`);
            }
        }

        // 滑动到下一页
        if (scroll < pageScrollCount) {
            if (useScreenComparison && previousScreenshot) {
                // 使用模板匹配比较两次翻页前的截图（兜底机制）
                const matchRo = RecognitionObject.TemplateMatch(
                    previousScreenshot.mat,
                    previousScreenshot.region.x - 1,
                    previousScreenshot.region.y - 1,
                    previousScreenshot.region.width + 2,
                    previousScreenshot.region.height + 2
                );
                matchRo.threshold = 0.95; // 高阈值，确保区域变化足够明显
                matchRo.Use3Channels = true;

                const matchResult = ra.find(matchRo);
                if (matchResult.isExist()) {
                    log.info("连续翻页画面无明显变化，执行最后一次全列扫描");

                    // 执行最后一次全列扫描
                    log.info("执行最后一次全列扫描");
                    for (let column = 0; column < maxColumns; column++) {
                        const scanX0 = startX + column * OffsetWidth;
                        const scanX = Math.round(scanX0);
                        for (let i = 0; i < materialCategories.length; i++) {
                            const { name } = materialCategories[i];
                            if (recognizedMaterials.has(name)) {
                                continue; // 如果已经识别过，跳过
                            }

                            const mat = materialImages[name];
                            const recognitionObject = RecognitionObject.TemplateMatch(mat, scanX, startY, columnWidth, columnHeight);
                            recognitionObject.threshold = 0.85;
                            recognitionObject.Use3Channels = true;

                            const result = ra.find(recognitionObject);

                            if (result.isExist() && result.x !== 0 && result.y !== 0) {
                                recognizedMaterials.add(name);
                                moveMouseTo(result.x, result.y);

                                const ocrRegion = {
                                    x: result.x - tolerance,
                                    y: result.y + 97 - tolerance,
                                    width: 66 + 2 * tolerance,
                                    height: 22 + 2 * tolerance
                                };
                                const ocrResult = await recognizeText(ocrRegion, 200, 10, 5, 2, ra);
                                materialInfo.push({ name, count: ocrResult || "?" });

                                if (!hasFoundFirstMaterial) {
                                    hasFoundFirstMaterial = true;
                                    lastFoundTime = Date.now();
                                } else {
                                    lastFoundTime = Date.now();
                                }
                            }
                            await sleep(imageDelay);
                        }
                    }

                    log.info("最后一次全列扫描完成，结束扫描");
                    shouldEndScan = true;
                    break;
                } else {
                    log.info("连续翻页画面有变化，继续扫描");
                }
            }

            // 执行翻页
            await scrollPage(-totalPageDistance, 10, 5);
            // 减少等待时间，提高翻页速度
            await sleep(50);
        }

        // 更新上一次的截图
        previousScreenshot = currentScreenshot;
    }

    // 处理未匹配的材料
    for (const name of allMaterials) {
        if (!recognizedMaterials.has(name)) {
            unmatchedMaterialNames.add(name);
        }
    }

    // 日志记录
    const now = new Date();
    const formattedTime = now.toLocaleString();
    const scanMode = shouldScanAllMaterials ? "全材料扫描" : "指定材料扫描";
    const logContent = `
${formattedTime}
${scanMode} - ${materialsCategory} 种类: ${recognizedMaterials.size} 数量: 
${materialInfo.map(item => `${item.name}: ${item.count}`).join(",")}
未匹配的材料 种类: ${unmatchedMaterialNames.size} 数量: 
${Array.from(unmatchedMaterialNames).join(",")}
`;

    const categoryFilePath = `history_record/${materialsCategory}.txt`; // 勾选【材料分类】的历史记录
    const overwriteFilePath = `overwrite_record/${materialsCategory}.txt`; // 所有的历史记录分类储存
    const latestFilePath = "latest_record.txt"; // 所有的历史记录集集合
    if (pathingMode.onlyCategory) {
        writeFile(categoryFilePath, logContent);
    }
    writeFile(overwriteFilePath, logContent);
    writeFile(latestFilePath, logContent); // 覆盖模式？

    // 返回结果
    return materialInfo;
}

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
const BagpackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Bagpack.png"), 58, 31, 38, 38);
const XPRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/XP.png"), 653, 29, 38, 38);
const MaterialsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Materials.png"), 941, 29, 38, 38);
const CultivationItemsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CultivationItems.png"), 749, 30, 38, 38);
const FoodRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Food.png"), 845, 31, 38, 38);

/**
 * 获取材料分类对应的CategoryObject
 * @param {string} materialsCategory - 材料分类名称
 * @returns {Object|null} 对应的CategoryObject或null
 */
function getCategoryObject(materialsCategory) {
    switch (materialsCategory) {
        case "祝圣精华":
            return XPRo;
        case "锻造素材":
        case "一般素材":
        case "烹饪食材":
        case "木材":
        case "鱼饵鱼类":
            return MaterialsRo;
        case "采集食物":
        case "料理":
            return FoodRo;
        case "怪物掉落素材":
        case "周本素材":
        case "角色突破素材":
        case "宝石":
        case "角色天赋素材":
        case "武器突破素材":
            return CultivationItemsRo;
        default:
            return null;
    }
}

function dynamicMaterialGrouping(materialCategoryMap) {
    // 初始化动态分组对象
    const dynamicMaterialGroups = {};

    // 遍历 materialCategoryMap 的 entries
    for (const category in materialCategoryMap) {
        const type = materialTypeMap[category]; // 获取材料分类对应的组编号（3、4、5）
        if (!dynamicMaterialGroups[type]) {
            dynamicMaterialGroups[type] = []; // 初始化组
        }
        dynamicMaterialGroups[type].push(category); // 将分类加入对应组
    }

    // 对每组内的材料分类按照 materialPriority 排序
    for (const type in dynamicMaterialGroups) {
        dynamicMaterialGroups[type].sort((a, b) => materialPriority[a] - materialPriority[b]);
    }

    // 将分组结果转换为数组并按类型排序（3, 4, 5）
    const sortedGroups = Object.entries(dynamicMaterialGroups)
        .map(([type, categories]) => ({ type: parseInt(type), categories }))
        .sort((a, b) => a.type - b.type);

    // 返回分组结果
    return sortedGroups;
}

// 主逻辑函数
async function MaterialPath(materialCategoryMap, cachedFrame = null) {

    // 1. 先记录原始名称与别名的映射关系（用于最后反向转换）
    const nameMap = new Map();
    Object.values(materialCategoryMap).flat().forEach(originalName => {
        const aliasName = MATERIAL_ALIAS[originalName] || originalName;
        nameMap.set(aliasName, originalName); // 存储：别名→原始名
    });

    // 2. 转换materialCategoryMap为别名（用于内部处理）
    const processedMap = {};
    Object.entries(materialCategoryMap).forEach(([category, names]) => {
        processedMap[category] = names.map(name => MATERIAL_ALIAS[name] || name);
    });
    materialCategoryMap = processedMap;

    const maxStage = 4; // 最大阶段数
    let stage = 0; // 当前阶段
    let currentGroupIndex = 0; // 当前处理的分组索引
    let currentCategoryIndex = 0; // 当前处理的分类索引
    let materialsCategory = ""; // 当前处理的材料分类名称
    const allLowCountMaterials = []; // 用于存储所有识别到的低数量材料信息

    // 添加状态变量，记录上一个分类的信息
    let prevCategory = null;
    let prevCategoryObject = null;
    let prevPriority = null;
    let prevGroup = null;
    let skipSliderReset = false; // 是否跳过滑条重置

    const sortedGroups = dynamicMaterialGrouping(materialCategoryMap);
    // log.info("材料 动态[分组]结果:");
    sortedGroups.forEach(group => {
        log.info(`类型 ${group.type} | 包含分类: ${group.categories.join(', ')}`);
    });

    let loopCount = 0;
    const maxLoopCount = 200; // 合理阈值，正常流程约50-100次循环

    while (stage <= maxStage && loopCount <= maxLoopCount) { // ===== 补充优化：加入循环次数限制 =====
        loopCount++;
        switch (stage) {
            case 0: // 返回主界面
                log.info("返回主界面");
                await genshin.returnMainUi();
                await sleep(500);
                stage = 1; // 进入下一阶段
                break;

            case 1: // 打开背包界面
                // log.info("打开背包界面");
                keyPress("B"); // 打开背包界面
                await sleep(800); // 减少等待时间

                cachedFrame?.dispose();
                cachedFrame = captureGameRegion();

                const backpackResult = await recognizeImage(BagpackRo, cachedFrame, 2000);
                if (backpackResult.isDetected) {
                    // log.info("成功识别背包图标");
                    stage = 2; // 进入下一阶段
                } else {
                    log.warn("未识别到背包图标，重新尝试");
                    // ===== 补充优化：连续回退时释放资源 =====
                    cachedFrame?.dispose();
                    stage = 0; // 回退
                }
                break;

            case 2: // 按分组处理材料分类
                if (currentGroupIndex < sortedGroups.length) {
                    const group = sortedGroups[currentGroupIndex];

                    if (currentCategoryIndex < group.categories.length) {
                        materialsCategory = group.categories[currentCategoryIndex];
                        const offset = materialTypeMap[materialsCategory];
                        const menuClickX = Math.round(575 + (offset - 1) * 96.25);
                        // log.info(`点击坐标 (${menuClickX},75)`);
                        click(menuClickX, 75);

                        await sleep(500);

                        cachedFrame?.dispose();
                        cachedFrame = captureGameRegion();

                        stage = 3; // 进入下一阶段
                    } else {
                        currentGroupIndex++;
                        currentCategoryIndex = 0; // 重置分类索引
                        stage = 2; // 继续处理下一组
                    }
                } else {
                    stage = 5; // 跳出循环
                }
                break;

            case 3: // 识别材料分类
                let CategoryObject = getCategoryObject(materialsCategory);
                if (!CategoryObject) {
                    log.error("未知的材料分类");
                    // ===== 补充优化：异常时释放资源并退出 =====
                    cachedFrame?.dispose();
                    stage = 0; // 回退到阶段0
                    return;
                }

                const CategoryResult = await recognizeImage(CategoryObject, cachedFrame);
                if (CategoryResult.isDetected) {
                    log.info(`识别到${materialsCategory} 所在分类。`);
                    stage = 4; // 进入下一阶段
                } else {
                    log.warn("未识别到材料分类图标，重新尝试");
                    // log.warn(`识别结果：${JSON.stringify(CategoryResult)}`);
                    // ===== 补充优化：连续回退时释放资源 =====
                    cachedFrame?.dispose();
                    stage = 2; // 回退到阶段2
                }
                break;

            case 4: // 扫描材料
                log.info("芭芭拉，冲鸭！");

                // 判断是否需要重置滑条
                if (!skipSliderReset) {
                    await moveMouseTo(1288, 124); // 移动鼠标至滑条顶端
                    await sleep(200);
                    leftButtonDown(); // 长按左键重置材料滑条
                    await sleep(300);
                    leftButtonUp();
                    await sleep(200);
                } else {
                    log.info("同一大类且为后位材料，跳过滑条重置");
                    // 不重置滑条，直接从当前位置开始检查第八列
                }

                // 扫描材料并获取低于目标数量的材料
                const lowCountMaterials = await scanMaterials(materialsCategory, materialCategoryMap);
                allLowCountMaterials.push(lowCountMaterials);

                // 保存当前分类信息，用于下一个分类的判断
                prevCategory = materialsCategory;
                prevPriority = materialPriority[materialsCategory];

                // 获取当前分类的CategoryObject
                const currentCategoryObject = getCategoryObject(materialsCategory);
                prevCategoryObject = currentCategoryObject;
                prevGroup = sortedGroups[currentGroupIndex];

                currentCategoryIndex++;

                // 判断下一个分类是否是同一个大类CategoryObject下的后位材料
                let nextCategory = null;
                let nextCategoryObject = null;
                let nextPriority = null;

                // 检查是否还有下一个分类
                if (currentGroupIndex < sortedGroups.length) {
                    const group = sortedGroups[currentGroupIndex];
                    if (currentCategoryIndex < group.categories.length) {
                        nextCategory = group.categories[currentCategoryIndex];

                        // 获取下一个分类的CategoryObject
                        nextCategoryObject = getCategoryObject(nextCategory);

                        // 获取下一个分类的优先级
                        nextPriority = materialPriority[nextCategory];
                    }
                }

                // 判断是否跳过滑条重置：同一大类且为后位材料
                if (nextCategory &&
                    nextCategoryObject === prevCategoryObject &&
                    nextPriority > prevPriority) {
                    skipSliderReset = true;
                } else {
                    skipSliderReset = false;
                }

                stage = 2; // 返回阶段2处理下一个分类
                break;

            case 5: // 所有分组处理完毕
                log.info("所有分组处理完毕，返回主界面");
                await genshin.returnMainUi();
                stage = maxStage + 1; // 确保退出循环
                break;
        }
    }

    // ===== 补充优化：循环超限处理，防止卡死 =====
    if (loopCount > maxLoopCount) {
        log.error(`主循环次数超限（${maxLoopCount}次），强制退出`);
        cachedFrame?.dispose();
        await genshin.returnMainUi();
        return [];
    }

    await genshin.returnMainUi(); // 返回主界面
    log.info("扫描流程结束");


    // 3. 处理完成后，将输出结果转换回原始名称
    const finalResult = allLowCountMaterials.map(categoryMaterials => {
        return categoryMaterials.map(material => {
            // 假设material包含name属性，将别名转回原始名
            return {
                ...material,
                name: nameMap.get(material.name) || material.name // 反向映射
            };
        });
    });

    cachedFrame?.dispose();
    return finalResult; // 返回转换后的结果（如"晶蝶"）
}


