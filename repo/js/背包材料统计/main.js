(async function () {
    // 初始化游戏窗口大小和返回主界面
    setGameMetrics(1920, 1080, 1);

    // 配置参数
    const pageScrollCount = 22; // 最多滑页次数
    const OCRdelay = Math.min(99, Math.max(0, Math.floor(Number(settings.OcrDelay) || 10))); // OCR基准时长

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
    };

    // 获取设置中的材料分类，默认为"一般素材"
    const materialsCategory = settings.materials || "一般素材";

    // 材料前位定义
    const materialPriority = {
        "锻造素材": 1,
        "怪物掉落素材": 1,
        "一般素材": 2,
        "周本素材": 2,
        "烹饪食材": 3,
        "角色突破素材": 3,
        "木材": 4,
        "宝石": 4,
        "鱼饵鱼类": 5,
        "角色天赋素材": 5,
        "武器突破素材": 6,
    };

    // 获取当前材料分类的前位
    const currentPriority = materialPriority[materialsCategory];
    const previousPriority = Math.max(1, currentPriority - 1); // 获取上一个前位
    // log.info(`正在寻找前位为 "${previousPriority}" 的材料`);

    // 获取上一个前位的所有材料分类
    const previousPriorityMaterials = Object.keys(materialPriority)
        .filter(mat => materialPriority[mat] === previousPriority);

    // 获取当前材料分类的 menuOffset 对应值
    const validValues = new Set([materialTypeMap[materialsCategory]]);

    // 过滤出符合条件的材料分类
    const finalFilteredMaterials = previousPriorityMaterials
        .filter(mat => validValues.has(materialTypeMap[mat]));

    // 根据材料分类获取对应的 menuOffset
    const menuOffset = materialTypeMap[materialsCategory];
    if (!menuOffset) {
        log.error(`未找到材料分类 "${materialsCategory}" 的对应菜单偏移值`);
        return;
    }

    // 提前计算所有动态坐标
    const menuClickX = Math.round(575 + (Number(menuOffset) - 1) * 96.25); // 背包菜单的 X 坐标

    // 自定义 basename 函数
    function basename(filePath) {
        const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
        return filePath.substring(lastSlashIndex + 1);
    }

    // OCR识别文本
    async function recognizeText(ocrRegion, timeout = 10000, retryInterval = 20, maxAttempts = 10, maxFailures = 3) {
        let startTime = Date.now();
        let retryCount = 0;
        let failureCount = 0; // 用于记录连续失败的次数
        const results = [];
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
            "B": "8", "b": "8", "８": "8",
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
                results.push(text);

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
    async function scanMaterials(materialsCategory) {
        // 获取前位材料名单
        const priorityMaterialNames = [];
        for (const category of finalFilteredMaterials) {
            const materialIconDir = `assets/images/${category}`;
            const materialIconFilePaths = file.ReadPathSync(materialIconDir);
            for (const filePath of materialIconFilePaths) {
                const name = basename(filePath).replace(".png", ""); // 去掉文件扩展名
                priorityMaterialNames.push(name);
            }
        }

        // 获取当前材料分类的材料图片文件夹路径
        const materialIconDir = `assets/images/${materialsCategory}`;
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
        let foundPriorityMaterial = false;
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

        // 扫描
        const scanX = startX + (maxColumns - 1) * OffsetWidth;
        const scanY = startY;

        if (!foundPriorityMaterial) {
            for (const name of priorityMaterialNames) {
                if (recognizedMaterials.has(name)) {
                    continue; // 如果已经识别过，跳过
                }

                const filePath = `assets/images/${finalFilteredMaterials}/${name}.png`;
                const mat = file.readImageMatSync(filePath);
                if (mat.empty()) {
                    log.error(`加载材料图库失败：${filePath}`);
                    continue; // 跳过当前文件
                }

                const recognitionObject = RecognitionObject.TemplateMatch(mat, 1146, scanY, columnWidth, columnHeight);
                recognitionObject.threshold = 0.8; // 设置识别阈值

                const result = captureGameRegion().find(recognitionObject);
                if (result.isExist() && result.x !== 0 && result.y !== 0) {

                    foundPriorityMaterial = true; // 标记找到前位材料
                    log.info(`发现前位材料: ${name}，开始全列扫描`);
                    break; // 发现前位材料后，退出当前循环
                }
            }
        }

        // 如果找到前位材料，则进行全列扫描
        if (foundPriorityMaterial) {
            for (let column = maxColumns - 1; column >= 0; column--) {
                const scanX = startX + column * OffsetWidth;
                const scanY = startY;

                for (const { name, filePath } of materialCategories) {
                    if (recognizedMaterials.has(name)) {
                        continue; // 如果已经识别过，跳过
                    }

                    const mat = file.readImageMatSync(filePath);
                    if (mat.empty()) {
                        log.error(`加载图标失败：${filePath}`);
                        continue; // 跳过当前文件
                    }

                    const recognitionObject = RecognitionObject.TemplateMatch(mat, scanX, scanY, columnWidth, columnHeight);
                    recognitionObject.threshold = 0.9; // 设置识别阈值

                    const result = captureGameRegion().find(recognitionObject);
                    if (result.isExist()) {
                        recognizedMaterials.add(name); // 标记为已识别
                        await moveMouseTo(result.x, result.y); // 移动鼠标至图片
                        await sleep(10);

                        const ocrRegion = {
                            x: result.x - 1 * tolerance,
                            y: result.y + 97 - 1 * tolerance,
                            width: 66 + 2 * tolerance,
                            height: 22 + 2 * tolerance
                        };
                        const ocrResult = await recognizeText(ocrRegion, 1000, OCRdelay, 10, 3);
                        if (ocrResult.success) {
                            materialInfo.push({ name: name, count: ocrResult.text });
                        } else {
                                log.warn("{芝麻大的数看不清(>ε<)}");
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
        }

        // 每2秒输出一句俏皮话
        const phrasesTime = Date.now();
        if (phrasesTime - phrasesStartTime >= 2000) {
            const selectedPhrase = tempPhrases.shift();
            log.info(selectedPhrase);

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
// 检查是否需要结束扫描
    if (shouldEndScan) {
        // 输出识别到的材料数量
        log.info(`共识别到 ${recognizedMaterials.size} 种材料`);

        const now = new Date();// 获取当前时间
        const formattedTime = now.toLocaleString(); // 使用本地时间格式化

        const allMaterialsArray = Array.from(allMaterials);

        // 过滤 allMaterials，找出不在 recognizedMaterials 中的材料名称
        for (const name of allMaterials) {
            if (!recognizedMaterials.has(name)) {
            unmatchedMaterialNames.add(name); // 使用 Set 的 add 方法添加名称
        }
    }
        const unmatchedMaterialNamesArray = Array.from(unmatchedMaterialNames);

    // 写入本地文件
        const filePath = "recognized_materials.txt";
        const logContent = `\n${formattedTime}\n  ${materialsCategory} 种类: ${recognizedMaterials.size} 数量: \n${materialInfo.map(item => `${item.name}: ${item.count}`).join(",")}\n  未匹配的材料 种类: ${unmatchedMaterialNamesArray .length} 数量: \n${unmatchedMaterialNamesArray.join(",")}\n  图库的材料 种类: ${allMaterialsArray .length} 数量: \n${allMaterialsArray.join(",")}\n`;
        const result = file.WriteTextSync(filePath, logContent, true); // 追加模式
        if (result) {
            log.info("成功将识别到的材料写入本地文件");
        } else {
            log.error("写入本地文件失败");
        }
    }
}

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
const BagpackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Bagpack.png"), 58, 31, 38, 38);
const MaterialsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Materials.png"), 941, 29, 38, 38);
const CultivationItemsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CultivationItems.png"), 749, 30, 38, 38);

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

// 主逻辑函数
async function MaterialPath() {
    const maxStage = 4; // 最大阶段数
    let stage = 0; // 当前阶段

    while (stage <= maxStage) {
        switch (stage) {
            case 0: // 返回主界面
                await genshin.returnMainUi();
                await sleep(500);
                stage = 1;
                break;

            case 1: // 打开背包界面
                keyPress("B"); // 打开背包界面
                await sleep(1000);

                // 尝试识别背包图标
                let backpackResult = await recognizeImage(BagpackRo, 2000);
                if (backpackResult.success) {
                    stage = 2; // 进入下一阶段
                } else {
                    log.warn("未识别到背包图标，重新尝试");
                    stage = 0; // 回退到阶段0
                }
                break;

            case 2: // 点击动态坐标
                click(menuClickX, 75);  // 点击菜单
                await sleep(500);
                stage = 3; // 进入下一阶段
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

                // 尝试识别材料分类图标
                let CategoryResult = await recognizeImage(CategoryObject, 2000);
                if (CategoryResult.success && CategoryResult.x !== 0 && CategoryResult.y !== 0) {
                    log.info(`识别到${materialsCategory} 所在分类。`);
                    stage = 4; // 进入下一阶段
                } else {
                    log.warn("未识别到材料分类图标，重新尝试");
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

                // 调用扫描材料的逻辑
                if (!await scanMaterials(materialsCategory)) {
                    // log.warn(`${pageScrollCount} 页扫描完。`);
                }
                // 扫描完成后，流程结束
                stage = maxStage + 1; // 确保退出循环
                break;
        }
    }

    // 返回主界面
    await genshin.returnMainUi();
    log.info("扫描流程结束，返回主界面。");
}


    // 执行主逻辑
    await MaterialPath();
})();
