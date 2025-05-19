
const targetCount = Math.min(9999, Math.max(0, Math.floor(Number(settings.targetCount) || 5000))); // OCR基准时长
const OCRdelay = Math.min(50, Math.max(0, Math.floor(Number(settings.OcrDelay) || 10))); // OCR基准时长
// 定义映射表"unselected": "反选材料分类",
const material_mapping = {
    "General": "一般素材",
    "Drops": "怪物掉落素材",
    "CookingIngs": "烹饪食材",
    "ForagedFood": "采集食物",
    "Weekly": "周本素材",
    "Wood": "木材",
    "CharAscension": "角色突破素材",
    "Fishing": "鱼饵鱼类",
    "Smithing": "锻造素材",
    "Gems": "宝石",
    "Talent": "角色天赋素材",
    "WeaponAscension": "武器突破素材"
}
// 检查是否启用反选功能
const isUnselected = settings.unselected === true;

// 根据反选功能生成选中的材料分类数组
const selected_materials_array = Object.keys(settings)
    .filter(key => key !== "unselected") // 排除 "unselected" 键
    .filter(key => {
        // 确保 settings[key] 是布尔值
        if (typeof settings[key] !== 'boolean') {
            console.warn(`非布尔值的键: ${key}, 值: ${settings[key]}`);
            return false;
        }
        return isUnselected ? !settings[key] : settings[key];
    })
    .map(name => {
        // 确保 material_mapping 中存在对应的键
        if (!material_mapping[name]) {
            console.warn(`material_mapping 中缺失的键: ${name}`);
            return null;
        }
        return material_mapping[name];
    })
    .filter(name => name !== null); // 过滤掉 null 值

    // 初始化游戏窗口大小和返回主界面
    setGameMetrics(1920, 1080, 1);

    // 配置参数
    const pageScrollCount = 22; // 最多滑页次数

    // 材料分类映射表
    const materialTypeMap = {
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
        "料理": "4",
    };

    // 材料前位定义
    const materialPriority = {
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
        "武器突破素材": 6,
    };



    // 提前计算所有动态坐标
    // 物品区左顶处物品左上角坐标(117,121)
    // 物品图片大小(123,152)
    // 物品间隔(24,24)
    // 第一点击区位置:123/2+117=178.5; 152/2+121=197
    // const menuClickX = Math.round(575 + (Number(menuOffset) - 1) * 96.25); // 背包菜单的 X 坐标

    // log.info(`材料分类: ${materialsCategory}, 菜单偏移值: ${menuOffset}, 计算出的点击 X 坐标: ${menuClickX}`);

    // OCR识别文本
    async function recognizeText(ocrRegion, timeout = 10000, retryInterval = 20, maxAttempts = 10, maxFailures = 3) {
        let startTime = Date.now();
        let retryCount = 0;
        let failureCount = 0; // 用于记录连续失败的次数
        // const results = [];
        const frequencyMap = {}; // 用于记录每个结果的出现次数

        const replacementMap = {
            "O": "0", "o": "0", "Q": "0", "０": "0",
            "I": "1", "l": "1", "i": "1", "１": "1",
            "Z": "2", "z": "2", "２": "2",
            "E": "3", "e": "3", "３": "3",
            "A": "4", "a": "4", "４": "4",
            "S": "5", "s": "5", "５": "5",
            "G": "6", "b": "6", "６": "6",
            "T": "7", "t": "7", "７": "7",
            "B": "8", "θ": "8", "８": "8",
            "g": "9", "q": "9", "９": "9",
        };

        while (Date.now() - startTime < timeout && retryCount < maxAttempts) {
            let captureRegion = captureGameRegion();
            let ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
            ocrObject.threshold = 0.85; // 适当降低阈值以提高速度
            let resList = captureRegion.findMulti(ocrObject);

            if (resList.count === 0) {
                failureCount++;
                if (failureCount >= maxFailures) {
                    ocrRegion.x += 3; // 每次缩小6像素
                    ocrRegion.width -= 6; // 每次缩小6像素
                    retryInterval += 10;

                    if (ocrRegion.width <= 12) {
                        return { success: false };
                    }
                }
                retryCount++;
                await sleep(retryInterval);
                continue;
            }

            for (let res of resList) {
                let text = res.text;
                text = text.split('').map(char => replacementMap[char] || char).join('');
                // results.push(text);

                if (!frequencyMap[text]) {
                    frequencyMap[text] = 0;
                }
                frequencyMap[text]++;

                if (frequencyMap[text] >= 2) {
                    return { success: true, text: text };
                }
            }

            await sleep(retryInterval);
        }

        const sortedResults = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a]);
        return sortedResults.length > 0 ? { success: true, text: sortedResults[0] } : { success: false };
    }

    // 滚动页面
    async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
        moveMouseTo(999, 750);
        await sleep(50);
        leftButtonDown();
        const steps = Math.ceil(totalDistance / stepDistance);
        for (let j = 0; j < steps; j++) {
            const remainingDistance = totalDistance - j * stepDistance;
            const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
            moveMouseBy(0, -moveDistance);
            await sleep(delayMs);
        }
        await sleep(700);
        leftButtonUp();
        await sleep(100);
    }

    // 扫描材料
    async function scanMaterials(materialsCategory, materialCategoryMap) {
    // 根据材料分类获取对应的材料图片文件夹路径
    const materialIconDir = `assets/images/${materialsCategory}`;

    // 使用 ReadPathSync 读取所有材料图片路径
    const materialIconFilePaths = file.ReadPathSync(materialIconDir);

        // 创建材料种类集合
        const materialCategories = [];
        const allMaterials = new Set(); // 用于记录所有需要扫描的材料名称
        for (const filePath of materialIconFilePaths) {
            const mat = file.readImageMatSync(filePath);
            if (mat.empty()) {
                log.error(`加载图标失败：${filePath}`);
                continue; // 跳过当前文件
            }
            const name = basename(filePath).replace(".png", ""); // 去掉文件扩展名
            materialCategories.push({ name: name, filePath: filePath });
            allMaterials.add(name); // 将材料名称添加到集合中
        }

        // 已识别的材料集合，避免重复扫描
        const recognizedMaterials = new Set();

        // 扫描背包中的材料
        const tolerance = 1; // 容错区间
        const startX = 117;
        const startY = 121;
        const OffsetWidth = 147;
        const columnWidth = 123;
        const columnHeight = 750;
        const maxColumns = 8;

        // 用于存储图片名和材料数量的数组
        const materialInfo = [];
        const unmatchedMaterialNames = new Set();// 使用 Set 来存储未匹配的材料名称，确保不重复
        // 是否已经开始计时
        let hasFoundFirstMaterial = false;
        // 记录上一次发现材料的时间
        let lastFoundTime = null;

        // 初始化标志变量，确保在整个扫描过程中保持状态
        // let foundPriorityMaterial = false;
        let shouldEndScan = false;

        for (let scroll = 0; scroll <= pageScrollCount; scroll++) {
            // log.info(`第 ${scroll+1} 页`);

            // 随机选择一句俏皮话
            const scanPhrases = [
            "扫描中... 太好啦，有这么多素材！",
            "扫描中... 不错的珍宝！",
            "扫描中... 侦查骑士，发现目标！",
            "扫描中... 嗯哼，意外之喜！",
            "扫描中... 嗯？",
            "扫描中... 很好，没有放过任何角落！",
            "扫描中... 会有烟花材料嘛？",
            "扫描中... 嗯，这是什么？",
            "扫描中... 这些宝藏积灰了，先清洗一下",
            "扫描中... 哇！都是好东西！",
            "扫描中... 不虚此行！",
            "扫描中... 瑰丽的珍宝，令人欣喜。",
            "扫描中... 是对长高有帮助的东西吗？",
            "扫描中... 嗯！品相卓越！",
            "扫描中... 虽无法比拟黄金，但终有价值。",
            "扫描中... 收获不少，可以拿去换几瓶好酒啦。",
            "扫描中... 房租和伙食费，都有着落啦！",
            "扫描中... 还不赖。",
            "扫描中... 荒芜的世界，竟藏有这等瑰宝。",
            "扫描中... 运气还不错。",
        ];

        // 创建一个数组，用于存储未使用的俏皮话
        let tempPhrases = [...scanPhrases];
        // 打乱数组顺序，确保随机性
        tempPhrases.sort(() => Math.random() - 0.5);


    // 记录扫描开始时间
    let phrasesStartTime = Date.now();

    for (let column = 0; column < maxColumns; column++) {
        const scanX = startX + column * OffsetWidth;
        for (let i = 0; i < materialCategories.length; i++) {
            const { name, filePath } = materialCategories[i];
            if (recognizedMaterials.has(name)) {
                materialCategories.splice(i, 1); // 从数组中移除已识别的材料
                i--; // 调整索引
                continue; // 如果已经识别过，跳过
            }

            const mat = file.readImageMatSync(filePath);
            if (mat.empty()) {
                log.error(`加载材料图库失败：${filePath}`);
                continue; // 跳过当前文件
            }

            const recognitionObject = RecognitionObject.TemplateMatch(mat, scanX, startY, columnWidth, columnHeight);
            recognitionObject.threshold = 0.85; // 设置识别阈值为 0.85

            const result = captureGameRegion().find(recognitionObject);
            if (result.isExist()) {
                recognizedMaterials.add(name); // 标记为已识别
                await moveMouseTo(result.x, result.y); // 移动鼠标至图片

                const ocrRegion = {
                    x: result.x - tolerance,
                    y: result.y + 97 - tolerance,
                    width: 66 + 2 * tolerance,
                    height: 22 + 2 * tolerance
                };
                const ocrResult = await recognizeText(ocrRegion, 1000, OCRdelay, 10, 3);
                if (ocrResult.success) {
                    materialInfo.push({ name: name, count: ocrResult.text });
                } else {
                    log.warn(`芝麻大的数看不清(>ε<)`);
                    materialInfo.push({ name: name, count: "?" });
                }

                // 如果是第一次发现材料，开始计时
                if (!hasFoundFirstMaterial) {
                    hasFoundFirstMaterial = true;
                    lastFoundTime = Date.now();
                } else {
                    // 更新上一次发现材料的时间
                    lastFoundTime = Date.now();
                }
            }
        }
    }

            // 每2秒输出一句俏皮话
            const phrasesTime = Date.now();
            if (phrasesTime - phrasesStartTime >= 2000) {
                // 输出当前数组的第一句俏皮话
                const selectedPhrase = tempPhrases.shift();
                log.info(selectedPhrase);

                // 如果数组为空，重新加载并打乱所有俏皮话
                if (tempPhrases.length === 0) {
                    tempPhrases = [...scanPhrases];
                    tempPhrases.sort(() => Math.random() - 0.5);
                }

            phrasesStartTime = phrasesTime;
        }

        // 检查材料识别情况
        if (recognizedMaterials.size === allMaterials.size) {
            log.info("所有材料均已识别！");
            shouldEndScan = true;
            break; // 立即退出当前循环
        }

        // 如果已经发现过材料，检查是否超过3秒未发现新的材料
        if (hasFoundFirstMaterial) {
            const currentTime = Date.now();
            if (currentTime - lastFoundTime > 5000) {
                log.info("未发现新的材料，结束扫描");
                shouldEndScan = true;
                break; // 立即退出当前循环
            }
            // 如果未超过3秒，继续扫描（无需额外操作）
        }

        // 检查是否已经滑到最后一页
        const sliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/SliderBottom.png"), 1284, 916, 9, 26);
        sliderBottomRo.threshold = 0.8;

        const sliderBottomResult = captureGameRegion().find(sliderBottomRo);
        if (sliderBottomResult.isExist()) {
            log.info("已到达最后一页！");
            shouldEndScan = true;
            break; // 如果识别到滑动条底部，终止滑动
        }

        // 如果还没有到达最后一页，继续滑页
        if (scroll < pageScrollCount) {
            await scrollPage(680, 10, 5);
            await sleep(10); // 滑动后等待10毫秒
        }
    }

    const lowCountMaterials = filterLowCountMaterials(materialInfo, materialCategoryMap);
    // log.info(`低于目标的导入材料名 ${JSON.stringify(lowCountMaterials, null, 2)}`);


    // 检查是否需要结束扫描
    if (shouldEndScan) {
        // 输出识别到的材料数量
        log.info(`共识别到 ${recognizedMaterials.size} 种材料`);
    
        const now = new Date(); // 获取当前时间
        const formattedTime = now.toLocaleString(); // 使用本地时间格式化

        const allMaterialsArray = Array.from(allMaterials);

        // 过滤 allMaterials，找出不在 recognizedMaterials 中的材料名称
        for (const name of allMaterials) {
            if (!recognizedMaterials.has(name)) {
                unmatchedMaterialNames.add(name); // 使用 Set 的 add 方法添加名称
            }
        }
        const unmatchedMaterialNamesArray = Array.from(unmatchedMaterialNames);

        // 准备日志内容
        const logContent = `
${formattedTime}
  ${materialsCategory} 种类: ${recognizedMaterials.size} 数量: 
${materialInfo.map(item => `${item.name}: ${item.count}`).join(",")}
  未匹配的材料 种类: ${unmatchedMaterialNamesArray.length} 数量: 
${unmatchedMaterialNamesArray.join(",")}
`;

    // 按材料分类类别分文件记录
    const categoryFilePath = `history_record/${materialsCategory}.txt`;
    let categoryLogContent = `${logContent}\n\n`; // 添加换行分隔

    try {
        // 读取现有文件内容
        const existingContent = file.readTextSync(categoryFilePath);
        // 按记录分隔，假设每条记录之间用两个换行符分隔
        const records = existingContent.split("\n\n");
        // 截取最新的365个记录
        const latestRecords = records.slice(-365).join("\n\n");
        categoryLogContent = `${logContent}\n\n${latestRecords}`; // 将新内容拼接到最前面
    } catch (error) {
        // 如果文件不存在，直接使用新内容
        log.warn(`文件 ${categoryFilePath} 不存在，将创建新文件`);
    }

    // 写回文件
    const categoryResult = file.WriteTextSync(categoryFilePath, categoryLogContent, false); // 覆盖模式
    if (categoryResult) {
        log.info(`成功将 ${materialsCategory} 的材料写入历史文件`);
    } else {
        log.error(`写入 ${materialsCategory} 的本地文件失败`);
    }

        // 按材料分类类别分文件覆写记录
        const overwriteFilePath = `overwrite_record/${materialsCategory}.txt`;
        const overwriteLogContent = `${logContent}
  图库的材料 种类: ${allMaterialsArray.length} 数量: 
${allMaterialsArray.join(",")}\n\n`; // 添加换行分隔
        const overwriteResult = file.WriteTextSync(overwriteFilePath, overwriteLogContent, false); // 覆盖模式
        if (overwriteResult) {
            log.info(`成功将 ${materialsCategory} 的记录写入覆写文件`);
        } else {
        log.error(`覆写 ${materialsCategory} 到本地文件失败`);
        }

        // 最新的历史覆写记录
        const latestFilePath = "latest_record.txt";
        const latestLogContent = `${logContent}
  图库的材料 种类: ${allMaterialsArray.length} 数量: 
${allMaterialsArray.join(",")}\n\n`; // 添加换行分隔
        const latestResult = file.WriteTextSync(latestFilePath, latestLogContent, false); // 覆盖模式
        if (latestResult) {
            log.info("成功将最新的历史记录写入js根目录");
        } else {
            log.error("写入最新的历史记录失败");
        }
    }
return lowCountMaterials;
}

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
const BagpackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Bagpack.png"), 58, 31, 38, 38);
const MaterialsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Materials.png"), 941, 29, 38, 38);
const CultivationItemsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CultivationItems.png"), 749, 30, 38, 38);
const FoodRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Food.png"), 845, 31, 38, 38);

// 定义一个函数用于识别图像
async function recognizeImage(recognitionObject, timeout = 5000) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试识别图像
            let imageResult = captureGameRegion().find(recognitionObject);
            if (imageResult) {
                // log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
                // log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
                return { success: true, x: imageResult.x, y: imageResult.y };
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别图像`);
    return { success: false };
}
const specialMaterials = [
    "水晶块", "魔晶块", "星银矿石", "紫晶块", "萃凝晶", "铁块", "白铁块",
    "精锻用魔矿", "精锻用良矿", "精锻用杂矿"
];
function filterLowCountMaterials(materialInfo, materialCategoryMap) {
    // 将 materialCategoryMap 中的所有材料名提取出来
    const allMaterials = Object.values(materialCategoryMap).flat();

    // 筛选 materialInfo 中的材料，只保留 materialCategoryMap 中定义的材料，并且数量低于 targetCount 或 count 为 "?" 或 name 在 specialMaterials 中
    return materialInfo
        .filter(item =>
            allMaterials.includes(item.name) &&
            (item.count < targetCount || item.count === "?")
        )
        .map(item => {
            // 如果 name 在 specialMaterials 数组中
            if (specialMaterials.includes(item.name)) {
                // 如果 count 是 "?"，直接保留
                if (item.count === "?") {
                    return item;
                }
                // 否则，将 count 除以 10 并向下取整
                item.count = Math.floor(item.count / 10);
            }
            return item;
        });
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
async function MaterialPath(materialCategoryMap) {
    const maxStage = 4; // 最大阶段数
    let stage = 0; // 当前阶段
    let currentGroupIndex = 0; // 当前处理的分组索引
    let currentCategoryIndex = 0; // 当前处理的分类索引
    let materialsCategory = ""; // 当前处理的材料分类名称
    const allLowCountMaterials = []; // 用于存储所有识别到的低数量材料信息

    const sortedGroups = dynamicMaterialGrouping(materialCategoryMap);
// log.info("材料 动态[分组]结果:");
    sortedGroups.forEach(group => {
    log.info(`类型 ${group.type} | 包含分类: ${group.categories.join(', ')}`);
});

    while (stage <= maxStage) {
        switch (stage) {
            case 0: // 返回主界面
                log.info("返回主界面");
                await genshin.returnMainUi();
                await sleep(500);
                stage = 1; // 进入下一阶段
                break;

            case 1: // 打开背包界面
                log.info("打开背包界面");
                keyPress("B"); // 打开背包界面
                await sleep(1000);

                let backpackResult = await recognizeImage(BagpackRo, 2000);
                if (backpackResult.success) {
                    log.info("成功识别背包图标");
                    stage = 2; // 进入下一阶段
                } else {
                    log.warn("未识别到背包图标，重新尝试");
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
                let CategoryObject;
                switch (materialsCategory) {
                    case "锻造素材":
                    case "一般素材":
                    case "烹饪食材":
                    case "木材":
                    case "鱼饵鱼类":
                        CategoryObject = MaterialsRo;
                        break;
                    case "采集食物":
                    case "料理":
                        CategoryObject = FoodRo;
                        break;
                    case "怪物掉落素材":
                    case "周本素材":
                    case "角色突破素材":
                    case "宝石":
                    case "角色天赋素材":
                    case "武器突破素材":
                        CategoryObject = CultivationItemsRo;
                        break;
                    default:
                        log.error("未知的材料分类");
                        stage = 0; // 回退到阶段0
                        return;
                }

                let CategoryResult = await recognizeImage(CategoryObject, 2000);
                if (CategoryResult.success && CategoryResult.x !== 0 && CategoryResult.y !== 0) {
                    log.info(`识别到${materialsCategory} 所在分类。`);
                    stage = 4; // 进入下一阶段
                } else {
                    log.warn("未识别到材料分类图标，重新尝试");
                    log.warn(`识别结果：${JSON.stringify(CategoryResult)}`);
                    stage = 2; // 回退到阶段2
                }
                break;

            case 4: // 扫描材料
                log.info("芭芭拉，冲鸭！");
                await moveMouseTo(1288, 124); // 移动鼠标至滑条顶端
                await sleep(200);
                leftButtonDown(); // 长按左键重置材料滑条
                await sleep(300);
                leftButtonUp();
                await sleep(200);

                // 扫描材料并获取低于目标数量的材料
                const lowCountMaterials = await scanMaterials(materialsCategory, materialCategoryMap);
                allLowCountMaterials.push(lowCountMaterials);

                currentCategoryIndex++;
                stage = 2; // 返回阶段2处理下一个分类
                break;

            case 5: // 所有分组处理完毕
                log.info("所有分组处理完毕，返回主界面");
                await genshin.returnMainUi();
                stage = maxStage + 1; // 确保退出循环
                break;
        }
    }

    await genshin.returnMainUi(); // 返回主界面
    log.info("扫描流程结束");

    // 返回所有识别到的材料信息
    return allLowCountMaterials;
}

// 自定义 basename 函数
function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
    return filePath.substring(lastSlashIndex + 1);
}
// 检查路径是否存在
function pathExists(path) {
    try {
        const entries = file.readPathSync(path);
        return entries !== undefined && entries.length >= 0;
    } catch (error) {
        return false;
    }
}
// 递归读取目录下的所有文件路径，并排除特定后缀的文件
function readAllFilePaths(dirPath, currentDepth = 0, maxDepth = 3, includeExtensions = ['.png', '.json', '.txt']) {
    // log.info(`开始递归读取目录：${dirPath}，当前深度：${currentDepth}`);
    if (!pathExists(dirPath)) {
        log.error(`目录 ${dirPath} 不存在`);
        return [];
    }

    try {
        const entries = file.readPathSync(dirPath); // 读取目录内容，返回的是完整路径
        // log.info(`目录 ${dirPath} 下的条目：${JSON.stringify(entries)}`);

        const filePaths = [];
        for (const entry of entries) {
            const isDirectory = pathExists(entry); // 如果路径存在且返回的是数组，则认为是目录
            // log.info(`处理条目：${entry}，是否为目录：${isDirectory}`);

            if (isDirectory && currentDepth < maxDepth) {
                // log.info(`递归读取子目录：${entry}`);
                filePaths.push(...readAllFilePaths(entry, currentDepth + 1, maxDepth, includeExtensions)); // 递归读取子目录
            } else if (!isDirectory) {
                const fileExtension = entry.substring(entry.lastIndexOf('.'));
                if (includeExtensions.includes(fileExtension.toLowerCase())) {
                    // log.info(`添加文件路径：${entry}`);
                    filePaths.push(entry); // 添加文件路径
                } else {
                    // log.info(`跳过文件（不在包含的后缀中）：${entry}`);
                }
            }
        }

        // log.info(`完成目录 ${dirPath} 的递归读取，共找到 ${filePaths.length} 个文件`);
        return filePaths;
    } catch (error) {
        log.error(`读取目录 ${dirPath} 时发生错误: ${error}`);
        return [];
    }
}


// 解析文件内容，提取材料信息
function parseMaterialContent(content) {
    // log.info(`开始解析文件内容：\n${content}`);
    if (!content) {
        log.warn(`文件内容为空`);
        return {}; // 如果内容为空，直接返回空对象
    }

    const lines = content.split('\n').map(line => line.trim());
    const materialCDInfo = {};

    lines.forEach(line => {
        // log.info(`处理行：${line}`);
        if (!line.includes('：')) {
            // log.warn(`跳过无效行：${line}`);
            return;
        }

        const [refreshCD, materials] = line.split('：');
        if (!refreshCD || !materials) {
            // log.warn(`跳过无效行：${line}`);
            return;
        }

        // 处理特殊规则，如“N次0点”和“即时刷新”
        let refreshCDInHours;
        if (refreshCD.includes('次0点')) {
            const times = parseInt(refreshCD.split('次')[0], 10);
            if (isNaN(times)) {
                log.error(`无效的刷新时间格式：${refreshCD}`);
                return;
            }
            refreshCDInHours = { type: 'midnight', times: times };
        } else if (refreshCD.includes('点')) {
            const hours = parseFloat(refreshCD.replace('点', ''));
            if (isNaN(hours)) {
                log.error(`无效的刷新时间格式：${refreshCD}`);
                return;
            }
            refreshCDInHours = { type: 'specific', hour: hours };
        } else if (refreshCD.includes('小时')) {
            const hours = parseFloat(refreshCD.replace('小时', ''));
            if (isNaN(hours)) {
                log.error(`无效的刷新时间格式：${refreshCD}`);
                return;
            }
            refreshCDInHours = hours;
        } else if (refreshCD === '即时刷新') {
            refreshCDInHours = { type: 'instant' };
        } else {
            log.error(`未知的刷新时间格式：${refreshCD}`);
            return;
        }

        materialCDInfo[JSON.stringify(refreshCDInHours)] = materials.split('，').map(material => material.trim()).filter(material => material !== '');

/*        // 改进日志记录，更清晰地显示对象内容
        if (typeof refreshCDInHours === 'object') {
            if (refreshCDInHours.type === 'midnight') {
                log.info(`解析结果：刷新时间 ${refreshCDInHours.type} ${refreshCDInHours.times}次，材料 ${materialList}`);
            } else if (refreshCDInHours.type === 'specific') {
                log.info(`解析结果：刷新时间 ${refreshCDInHours.type} ${refreshCDInHours.hour}点，材料 ${materialList}`);
            } else if (refreshCDInHours.type === 'instant') {
                log.info(`解析结果：刷新时间 ${refreshCDInHours.type}，材料 ${materialList}`);
            }
        } else {
            log.info(`解析结果：刷新时间 ${refreshCDInHours}小时，材料 ${materialList}`);
        }*/
    });

    // log.info(`完成文件内容解析，结果：${JSON.stringify(materialCDInfo, null, 2)}`);
    return materialCDInfo;
}

// 从路径中提取材料名
function extractResourceNameFromPath(filePath) {
    const pathParts = filePath.split('\\'); // 或者使用 '/'，取决于你的路径分隔符
    if (pathParts.length < 3) {
        log.warn(`路径格式不正确，无法提取材料名：${filePath}`);
        return null; // 返回 null 表示无法提取材料名
    }
     // 第一层文件夹名即为材料名
    return pathParts[1];
}
// 从 materials 文件夹中读取分类信息
function readMaterialCategories(materialDir) {
    // log.info(`开始读取材料分类信息：${materialDir}`);
    const materialFilePaths = readAllFilePaths(materialDir, 0, 1);
    const materialCategories = {};

    for (const filePath of materialFilePaths) {
        const content = file.readTextSync(filePath); // 同步读取文本文件内容
        if (!content) {
            log.error(`加载文件失败：${filePath}`);
            continue; // 跳过当前文件
        }

        const sourceCategory = basename(filePath).replace('.txt', ''); // 去掉文件扩展名
        materialCategories[sourceCategory] = parseMaterialContent(content);
    }
    // log.info(`完成材料分类信息读取，分类信息：${JSON.stringify(materialCategories, null, 2)}`);
    return materialCategories;
}
// 获取当前时间（以小时为单位）
function getCurrentTimeInHours() {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}
// 记录运行时间到材料对应的文件中
function recordRunTime(resourceName, pathName, startTime, endTime, runTime, recordDir) {
    const recordPath = `${recordDir}/${resourceName}.txt`; // 记录文件路径，以材料名命名
    const content = `路径名: ${pathName}\n开始时间: ${startTime}\n结束时间: ${endTime}\n运行时间: ${runTime}秒\n\n`;

    try {
        // 只有当运行时间大于或等于3秒时，才记录运行时间
        if (runTime >= 3) {
            // 读取文件现有内容
            let existingContent = '';
            try {
                existingContent = file.readTextSync(recordPath); // 读取文件内容
            } catch (readError) {
                // 如果文件不存在或读取失败，existingContent 保持为空字符串
                log.warn(`文件读取失败或文件不存在: ${readError}`);
            }

            // 将新的记录内容插入到最前面
            const updatedContent = content + existingContent;

            // 将更新后的内容写回文件
            const result = file.writeTextSync(recordPath, updatedContent, false); // 覆盖写入
            if (result) {
                log.info(`记录运行时间成功: ${recordPath}`);
            } else {
                log.error(`记录运行时间失败: ${recordPath}`);
            }
        } else {
            log.info(`运行时间小于3秒，请检查路径要求: ${recordPath}`);
        }
    } catch (error) {
        log.error(`记录运行时间失败: ${error}`);
    }
}
// 读取材料对应的文件，获取上次运行的结束时间
function getLastRunEndTime(resourceName, pathName, recordDir) {
    const recordPath = `${recordDir}/${resourceName}.txt`; // 记录文件路径，以材料名命名
    try {
        const content = file.readTextSync(recordPath); // 同步读取记录文件
        const lines = content.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].startsWith('路径名: ')) {
                const currentPathName = lines[i].split('路径名: ')[1];
                if (currentPathName === pathName) {
                    const endTimeLine = lines[i + 2]; // 假设结束时间在路径名后的第三行
                    if (endTimeLine.startsWith('结束时间: ')) {
                        return endTimeLine.split('结束时间: ')[1]; // 返回结束时间
                    }
                }
            }
        }
    } catch (error) {
        log.warn(`未找到记录文件或记录文件中无结束时间: ${recordPath}`);
    }
    return null; // 如果未找到记录文件或结束时间，返回 null
}
// 判断是否可以运行脚本
function canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName) {
    if (!lastEndTime) {
        return true; // 如果没有上次运行记录，直接可以运行
    }

    const lastEndTimeDate = new Date(lastEndTime);
    const currentDate = new Date();

    if (typeof refreshCD === 'object') {
        if (refreshCD.type === 'midnight') {
            // 处理“N次0点”这样的特殊规则
            const times = refreshCD.times;

            // 计算从上次运行时间到当前时间的天数差
            let daysPassed = Math.floor((currentDate - lastEndTimeDate) / (1000 * 60 * 60 * 24));

            // 计算下一个刷新时间
            const nextRunTime = new Date(lastEndTimeDate);
            nextRunTime.setDate(lastEndTimeDate.getDate() + times); // 在上次运行时间的基础上加上N天
            nextRunTime.setHours(0, 0, 0, 0); // 将时间设置为午夜0点

            // 判断是否可以运行
            const canRun = currentDate >= nextRunTime;

            log.info(`路径文件${pathName}上次运行时间：${lastEndTimeDate.toLocaleString()}，下次运行时间：${nextRunTime.toLocaleString()}`);
            // log.info(`是否可以运行：${canRun}`);
            return canRun;
        } else if (refreshCD.type === 'specific') {
            // 处理“具体时间点”这样的特殊规则
            const specificHour = refreshCD.hour;
            const currentHour = currentDate.getHours();
            // const lastEndHour = lastEndTimeDate.getHours();

            // 如果当前时间等于指定时间点，且日期已经改变
            if (currentHour === specificHour && currentDate.getDate() !== lastEndTimeDate.getDate()) {
                return true;
            }

            const nextRunTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), specificHour);
            if (currentHour >= specificHour) {
                nextRunTime.setDate(nextRunTime.getDate() + 1);
            }
            log.info(`路径文件${pathName}上次运行时间：${lastEndTimeDate.toLocaleString()}，下次运行时间：${nextRunTime.toLocaleString()}`);
            return false;
        } else if (refreshCD.type === 'instant') {
            // 处理“即时刷新”这样的特殊规则
            return true;
        }
    } else {
        // 处理普通刷新时间
        const nextRefreshTime = new Date(lastEndTimeDate.getTime() + refreshCD * 3600 * 1000);
        log.info(`路径文件${pathName}上次运行时间：${lastEndTimeDate.toLocaleString()}，下次运行时间：${nextRefreshTime.toLocaleString()}`);
        return currentDate >= nextRefreshTime;
    }

    return false;
}

const MATERIAL_ALIAS = {
    '晶蝶': '晶核',
    '白铁矿': '白铁块',
    '铁矿': '铁块',
    // 添加更多别名映射...
};
const imageMapCache = new Map();

const createImageCategoryMap = (imagesDir) => {
    const map = {};
    const imageFiles = readAllFilePaths(imagesDir, 0, 1);
    
    for (const imagePath of imageFiles) {
        const pathParts = imagePath.split(/[\\/]/);
        if (pathParts.length < 3) continue;

        // 统一小写存储（新增逻辑）
        const imageName = pathParts.pop()
            .replace(/\.png$/i, '')
            .trim()
            .toLowerCase(); // 新增
        
        if (!(imageName in map)) {
            map[imageName] = pathParts[2];
        }
    }
    
    // log.info(JSON.stringify({ dir: imagesDir, entries: map }, null, 2));
    return map;
};
// 模块级去重集合（新增）
const loggedResources = new Set();

function matchImageAndGetCategory(resourceName, imagesDir) {
    const processedName = (MATERIAL_ALIAS[resourceName] || resourceName)
        .toLowerCase();
    
    if (!imageMapCache.has(imagesDir)) {
        imageMapCache.set(imagesDir, createImageCategoryMap(imagesDir));
    }
    
    const result = imageMapCache.get(imagesDir)[processedName] ?? null;

    // Set 去重逻辑
    if (!loggedResources.has(processedName)) {
        // log.info(JSON.stringify({ entries: { [processedName]: result } }, null, 2));
        loggedResources.add(processedName);
    }
    
    return result;
}


(async function () {
    // 定义文件夹路径
    const materialDir = "materialsCD"; // 存储材料信息的文件夹
    const pathingDir = "pathing"; // 存储路径信息的文件夹
    const recordDir = "pathing_record"; // 存储运行记录的文件夹
    const imagesDir = "assets\\images"; // 存储图片的文件夹

    // 从设置中获取目标材料名称
    const targetResourceNamesStr = settings.targetresourceName || "";

    // 使用正则表达式分割字符串，支持多种分隔符（如逗号、分号、空格等）
    const targetResourceNames = targetResourceNamesStr
        .split(/[,，、 \s]+/) // 使用正则表达式分割字符串
        .map(name => name.trim()) // 去除每个元素的多余空格
        .filter(name => name !== ""); // 过滤掉空字符串

    // 打印目标材料名称数组
    log.info(`优先材料名称数组: ${JSON.stringify(targetResourceNames)}`);

    try {
        // 读取材料分类信息
        const materialCategories = readMaterialCategories(materialDir);

        // 递归读取路径信息文件夹
        const pathingFilePaths = readAllFilePaths(pathingDir, 0, 1);


        // 将路径和资源名绑定，避免重复提取
        const pathEntries = pathingFilePaths.map(path => ({
            path,
            resourceName: extractResourceNameFromPath(path)
        }));

        // 从路径文件中提取材料名
        const resourceNames = pathEntries
            .map(entry => entry.resourceName)
            .filter(name => name);

        // 生成材料与分类的映射对象
        const materialCategoryMap = resourceNames.reduce((acc, resourceName) => {
            const category = matchImageAndGetCategory(resourceName, imagesDir); // 获取材料的分类
            if (category) {
        // 初始化分类键（如果不存在）
                if (!acc[category]) acc[category] = [];
                // 将材料名加入对应分类数组（避免重复）
                if (!acc[category].includes(resourceName)) {
                    acc[category].push(resourceName);
                }
            }
            // 检查是否需要初始化选中的分类
            selected_materials_array.forEach(selectedCategory => {
                if (!acc[selectedCategory]) {
                    acc[selectedCategory] = [];
                }
            });
            return acc;
        }, {});
        // log.info(JSON.stringify(materialCategoryMap, null, 2));

        // 调用背包材料统计
        const lowCountMaterialsFiltered = await MaterialPath(materialCategoryMap);

        // 展平数组并按数量从小到大排序
        const flattenedLowCountMaterials = lowCountMaterialsFiltered
          .flat()
          .sort((a, b) => parseInt(a.count, 10) - parseInt(b.count, 10));

        // log.info(`筛选后的低数量材料信息: ${JSON.stringify(flattenedLowCountMaterials, null, 2)}`);

// 提取低数量材料的名称
const lowCountMaterialNames = flattenedLowCountMaterials.map(material => material.name);

// 将路径文件按是否为目标材料分类
const prioritizedPaths = [];
const normalPaths = [];

for (const { path, resourceName } of pathEntries) {
    if (!resourceName) {
        log.warn(`无法提取材料名：${path}`);
        continue;
    }

    // 检查当前 resourceName 是否在 targetResourceNames 中
    if (targetResourceNames.includes(resourceName)) {
        prioritizedPaths.push({ path, resourceName });
    } else if (lowCountMaterialNames.includes(resourceName)) {
        // 只有当 resourceName 不在 targetResourceNames 中时，才将其加入到 normalPaths
        normalPaths.push({ path, resourceName });
    }
}
// 按照 flattenedLowCountMaterials 的顺序对 normalPaths 进行排序
normalPaths.sort((a, b) => {
    const indexA = lowCountMaterialNames.indexOf(a.resourceName);
    const indexB = lowCountMaterialNames.indexOf(b.resourceName);
    return indexA - indexB;
});

        // log.info(`优先路径数组 (prioritizedPaths): ${JSON.stringify(prioritizedPaths, null, 2)}`);
        // log.info(`普通路径数组 (normalPaths): ${JSON.stringify(normalPaths, null, 2)}`);

        // 合并优先路径和普通路径
        const allPaths = prioritizedPaths.concat(normalPaths);
        log.info(`最终路径数组 (allPaths): ${JSON.stringify(allPaths, null, 2)}`);

        dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));

        // 遍历所有路径文件
        for (const { path: pathingFilePath, resourceName } of allPaths) {
            const pathName = basename(pathingFilePath); // 假设路径文件名即为材料路径
            // log.info(`处理路径文件：${pathingFilePath}，材料名：${resourceName}，材料路径：${pathName}`);

            // 查找材料对应的分类
            let categoryFound = false;
            for (const [category, materials] of Object.entries(materialCategories)) {
                for (const [refreshCDKey, materialList] of Object.entries(materials)) {
                    const refreshCD = JSON.parse(refreshCDKey);
                    if (materialList.includes(resourceName)) {
                        // 获取当前时间
                        const currentTime = getCurrentTimeInHours();

                        // 读取上次运行的结束时间
                        const lastEndTime = getLastRunEndTime(resourceName, pathName, recordDir);

                        // 判断是否可以运行脚本
                        if (canRunPathingFile(currentTime, lastEndTime, refreshCD, pathName)) {
                            log.info(`可调用路径文件：${pathName}`);

                            // 记录开始时间
                            const startTime = new Date().toLocaleString();

                            // 调用路径文件
                            await pathingScript.runFile(pathingFilePath);
                            await sleep(1000);

                            // 记录结束时间
                            const endTime = new Date().toLocaleString();

                            // 计算运行时间
                            const runTime = (new Date(endTime) - new Date(startTime)) / 1000; // 秒

                            // 记录运行时间到材料对应的文件中
                            recordRunTime(resourceName, pathName, startTime, endTime, runTime, recordDir);

                            categoryFound = true;

                            break;
                        } else {
                            log.info(`路径文件 ${pathName} 还未到刷新时间`);
                        }
                    }
                }
                if (categoryFound) break;
            }
        }
    } catch (error) {
        log.error(`操作失败: ${error}`);
    }
})();

