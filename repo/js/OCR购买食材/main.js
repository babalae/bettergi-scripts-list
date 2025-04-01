// 定义所有食材及其对应的路径文件和 NPC
const mondstadtGroceryFilePath = `assets/蒙德杂货商布兰琪.json`;
const liyueGroceryFilePath = `assets/璃月杂货商东升.json`;
const liyueWanminFilePath = `assets/璃月万民堂老板卯师傅.json`;
const groceryFilePath = `assets/稻妻九十九物店主葵.json`;
const charcoalFilePath = `assets/稻妻志村屋店主志村勘兵卫.json`;
const fengdanGroceryFilePath = `assets/枫丹杂货商布希柯.json`;
const cafeLuzheFilePath = `assets/咖啡厅露泽店主阿鲁埃.json`;
const sumiCityFishPath = `assets/须弥城鱼贩珀姆.json`;
const omosPortFishPath = `assets/须弥奥摩斯港鱼贩布特罗斯.json`;
const azaleVillMerPath = `assets/须弥阿如村商人阿扎莱.json`;

// 定义所有可能的食材，注意料理名字长度可能超过识图范围
const ingredients = [
    "枫达", "盐", "洋葱", "牛奶", "番茄", "卷心菜", "土豆", "小麦", "胡椒","稻米", "豆腐", "杏仁", "鱼肉", "螃蟹", "虾仁", "咖啡豆", "秃秃豆", "发酵果实汁"
];

// 筛选出用户选择的食材及其对应的路径文件和 NPC
const selectedIngredients = []; // 在函数外部声明一次
const selectedPaths = new Map();

const ingredientPaths = {
    "枫达": [fengdanGroceryFilePath, cafeLuzheFilePath],
    "盐": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "洋葱": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "牛奶": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "番茄": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "卷心菜": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "土豆": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "小麦": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "胡椒": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, fengdanGroceryFilePath],
    "稻米": [liyueGroceryFilePath, groceryFilePath],
    "虾仁": [liyueGroceryFilePath, groceryFilePath, sumiCityFishPath, omosPortFishPath],
    "豆腐": [liyueGroceryFilePath, groceryFilePath],
    "杏仁": [liyueGroceryFilePath, fengdanGroceryFilePath],
    "鱼肉": [liyueWanminFilePath, charcoalFilePath, sumiCityFishPath, omosPortFishPath, azaleVillMerPath],
    "螃蟹": [liyueWanminFilePath, charcoalFilePath, sumiCityFishPath, omosPortFishPath],
    "秃秃豆": [fengdanGroceryFilePath, azaleVillMerPath],
    "咖啡豆": [cafeLuzheFilePath],
    "发酵果实汁": [fengdanGroceryFilePath]
};
// 定义所有NPC名，注意名字长度可能超过识图范围
const npcNames = {
    [mondstadtGroceryFilePath]: ["布兰琪"],
    [liyueGroceryFilePath]: ["东升"],
    [liyueWanminFilePath]: ["卵师傅", "卯师傅"],
    [groceryFilePath]: ["葵"],
    [charcoalFilePath]: ["志村勘"],
    [fengdanGroceryFilePath]: ["布希柯"],
    [cafeLuzheFilePath]: ["阿鲁埃"],
    [sumiCityFishPath]: ["珀姆"],
    [omosPortFishPath]: ["布特罗斯"],
    [azaleVillMerPath]: ["阿扎莱"]
};

for (const ingredient of ingredients) {
    if (settings[ingredient]) {
        selectedIngredients.push(ingredient);
        ingredientPaths[ingredient].forEach(path => {
            if (!selectedPaths.has(path)) {
                selectedPaths.set(path, []);
            }
            selectedPaths.get(path).push(ingredient);
        });
    }
}

if (selectedIngredients.length === 0) {
    log.error("未选择任何食材，退出任务");
    throw new Error("未选择任何食材，任务终止"); // 抛出异常以终止任务
}
// 汇总即将购买的食材信息
const purchaseSummary = selectedIngredients.join(", ");
log.info(`即将购买: ${purchaseSummary}`);

// 定义一个函数用于模拟按键操作
async function simulateKeyOperations(key, duration) {
    keyDown(key);
    await sleep(duration);
    keyUp(key);
    await sleep(500); // 释放按键后等待 500 毫秒
}

// 定义一个函数用于识别并点击用户选择的食材
async function clickSelectedIngredients(selectedIngredients, filePath, npcNames) {
    log.info(`加载路径文件: ${filePath}`);
    await pathingScript.runFile(filePath);
    await sleep(1000);
    log.info("路径文件执行完成");

    // 识别并交互 NPC
    let attempts = 0;
    const maxAttempts = 5; // 最大尝试次数
    const npcxRange = { min: 1190, max: 1320 }; // X轴固定区间
    const npcyRanges = [478, 514, 552]; // 可能的Y轴坐标
    const tolerance = 10; // 容错区间
    const npctolerance = 10; // 容错区间

    let npcOcrResult = { success: false }; // 初始化 npcOcrResult

    // 判断 Y 坐标是否在容错范围内
    function isYWithinTolerance(y, targetY, tolerance) {
        return y >= targetY - tolerance && y <= targetY + tolerance;
    }

    // 执行点击操作
    async function performClickOperations(filePath) {
        if (filePath === liyueGroceryFilePath || filePath === groceryFilePath || filePath === sumiCityFishPath) {
            log.info("执行璃月杂货商或稻妻九十九物店主的点击操作");
            await click(1300, 650); await sleep(1000);
            await click(1300, 650); await sleep(1000);
            await click(1600, 1020); await sleep(1000);
        } else {
            log.info("执行其他路径文件的点击操作");
            await click(1300, 580); await sleep(1000);
            await click(1300, 580); await sleep(1000);
            await click(1600, 1020); await sleep(1000);
        }
    }

    while (attempts < maxAttempts) {
        attempts++;
        log.info(`尝试识别 NPC，尝试次数: ${attempts}`);

        for (const npcName of npcNames) {
            log.info(`尝试识别 NPC: ${npcName}`);
            npcOcrResult = await performOcr(npcName, npcxRange, { min: 470, max: 602 }, tolerance);

            if (npcOcrResult.success) {
                if (
                    isYWithinTolerance(npcOcrResult.y, 478, npctolerance) ||
                    isYWithinTolerance(npcOcrResult.y, 514, npctolerance)
                ) {
                    // 如果 Y 坐标在 478 或 514 的容错范围内，直接按下 F 键
                    log.info(`直接按下 F 键与 NPC ${npcName} 交互...`);
                    keyPress("F");
                    await sleep(2000);

                    // 执行点击操作
                    await performClickOperations(filePath);
                    break; // 成功交互，退出内层循环
                } else if (isYWithinTolerance(npcOcrResult.y, 552, npctolerance)) {
                    // 如果 Y 坐标在 552 的容错范围内，调整当前路径
                    log.info(`Y 坐标在 552 的容错范围内，调整当前路径`);
                    await simulateKeyOperations("S", 600); // 后退 600 毫秒
                    await simulateKeyOperations("W", 800); // 前进 800 毫秒
                } else {
                    log.error(`识别到的 Y 坐标 ${npcOcrResult.y} 不在预期范围内，尝试次数: ${attempts}`);
                }
                break; // 成功识别到 NPC，退出内层循环
            } else {
                if (attempts === 1) {
                    // 第一次失败时，尝试调整位置
                    await simulateKeyOperations("S", 600); // 后退 600 毫秒
                    await simulateKeyOperations("W", 800); // 前进 800 毫秒
                } else if (attempts === 2) {
                    // 第二次失败时，重新加载路径文件
                    log.info("重新加载路径文件");
                    await pathingScript.runFile(filePath);
                    await sleep(1000);
                }
                log.error(`OCR 识别未找到 NPC: ${npcName}，尝试次数: ${attempts}`);
            }
        }

        if (npcOcrResult.success) {
            break; // 成功识别到 NPC，退出外层循环
        }
    }

    if (attempts >= maxAttempts) {
        log.error(`识别 NPC 失败 ${maxAttempts} 次，放弃该路线`);
        return; // 放弃该路线
    }

    // 记录已购买的食材
    const purchasedIngredients = new Set();

    // 继续后续操作
    const ingredientXRange = { min: 220, max: 390 }; // X坐标范围
    const ingredientYRange = { min: 95, max: 950 }; // Y坐标范围
    const ingredientTolerance = 10; // 容错区间
    const clickOffset = 30; // 点击坐标容错

    let allIngredientsFound = false; // 标记是否所有食材都已找到
    let scrollAttempts = 0;
    const maxScrollAttempts = 3; // 最大翻页次数

    while (!allIngredientsFound && scrollAttempts < maxScrollAttempts) {
        allIngredientsFound = true; // 假设本轮所有食材都已找到，若后续发现未找到则修改为 false

        for (const ingredient of selectedIngredients) {
            if (purchasedIngredients.has(ingredient)) {
                log.info(`跳过已购买的食材: ${ingredient}`);
                continue; // 跳过已购买的食材
            }

            const ocrResult = await performOcr(ingredient, ingredientXRange, ingredientYRange, ingredientTolerance);
            if (ocrResult.success) {
                log.info(`识别到 '${ingredient}'，坐标: x=${ocrResult.x}, y=${ocrResult.y}`);
                await click(ocrResult.x, ocrResult.y + clickOffset);
                await sleep(1000);

                // 模拟购买操作的后续点击
                await click(1600, 1020); await sleep(1000); // 购买
                await click(1181, 600); await sleep(200);  // 选择100个
                await click(1320, 780); await sleep(1000); // 最终确认
                await click(1320, 780); await sleep(1000); // 点击空白

                // 记录已购买的食材
                purchasedIngredients.add(ingredient);
            } else {
                log.error(`OCR 识别未找到 '${ingredient}'`);
                allIngredientsFound = false; // 本轮有食材未找到
            }
        }

        if (!allIngredientsFound) {
            log.info(`在当前页面未找到所有食材，尝试翻页`);
            await PageScroll(1); // 每轮翻页滑动1次
            await sleep(600);
            scrollAttempts++;
        }
    }

    if (!allIngredientsFound) {
        log.error(`在所有页面中未找到所有食材，跳过该路径`);
    }

    // 最后点击退出按钮
    log.info("点击退出按钮...");
    await click(1845, 45); // 退出
    await sleep(2000);
}

// 自动执行划页操作
async function PageScroll(scrollCount) {
    try {
        const clickX = 1200; // 假设点击的起始坐标
        const clickY = 900;
        const totalDistance = 500; // 假设每次滑动的总距离
        const stepDistance = 15; // 每步移动的距离

        for (let i = 0; i < scrollCount; ++i) {
            log.info(`开始第 ${i + 1} 次滑动`);

            // 如果点击坐标为 (0, 0)，则跳过点击
            if (clickX !== 0 || clickY !== 0) {
                moveMouseTo(clickX, clickY); // 移动到指定坐标
                await sleep(100);
            }

            // 按住鼠标左键
            leftButtonDown();

            // 将鼠标移动到目标位置，模拟更自然的拖动操作
            log.info("移动鼠标");
            const steps = totalDistance / stepDistance; // 分成若干步移动

            for (let j = 0; j < steps; j++) {
                moveMouseBy(0, -stepDistance); // 每次移动 stepDistance 像素
                await sleep(10); // 每次移动后延迟10毫秒
            }

            // 释放鼠标左键
            await sleep(700);
            leftButtonUp();
            await sleep(100);
        }
    } catch (error) {
        log.error(`执行划页操作时发生错误：${error.message}`);
    }
}

// 定义一个函数用于执行OCR识别
async function performOcr(targetText, xRange, yRange, tolerance) {
    // 调整区域范围以包含容错区间
    const adjustedXMin = xRange.min - tolerance;
    const adjustedXMax = xRange.max + tolerance;
    const adjustedYMin = yRange.min - tolerance;
    const adjustedYMax = yRange.max + tolerance;
    /*/ log.info(`
  adjustedXMin: ${adjustedXMin}
  adjustedXMax: ${adjustedXMax}
  adjustedYMin: ${adjustedYMin}
  adjustedYMax: ${adjustedYMax}
`);*/

    // 在捕获的区域内进行OCR识别
    const ra = captureGameRegion();

    const resList = ra.findMulti(RecognitionObject.ocr(
        adjustedXMin, adjustedYMin, 
        adjustedXMax - adjustedXMin, adjustedYMax - adjustedYMin
    ));
    // log.info(`OCR 识别数量: ${resList.count}`);

    // 遍历识别结果，检查是否找到目标文本
    for (let i = 0; i < resList.count; i++) {
        if (resList[i].text.includes(targetText)) {
            // 如果找到目标文本，直接返回坐标
            return { success: true, x: resList[i].x, y: resList[i].y }; // 找到符合条件的文本，返回坐标
        }
    }
    return { success: false }; // 未找到符合条件的文本
}

// 主函数
async function AutoPath() {
    log.info("开始执行自动寻路任务");

    // 加载路径文件和 NPC 名称
    for (const [path, ingredients] of selectedPaths) {
        const npcName = npcNames[path];
        await clickSelectedIngredients(ingredients, path, npcName);
    }
}

// 执行主函数
(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    await AutoPath();
})();
