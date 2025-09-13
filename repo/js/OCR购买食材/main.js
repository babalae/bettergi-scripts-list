// 定义所有食材的图像识别对象
let FengdaRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/FengdaRo.png"));
let SaltRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/SaltRo.png"));
let PepperRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/PepperRo.png"));
let OnionRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/OnionRo.png"));
let MilkRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/MilkRo.png"));
let TomatoRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/TomatoRo.png"));
let SpicesRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/SpicesRo.png"));
let CabbageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/CabbageRo.png"));
let PotatoRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/PotatoRo.png"));
let WheatRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/WheatRo.png"));
let RiceRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/RiceRo.png"));
let TofuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/TofuRo.png"));
let AlmondRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/AlmondRo.png"));
let FishRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/FishRo.png"));
let CrabRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/CrabRo.png"));
let ShrimpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/ShrimpRo.png"));
let CoffeeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/CoffeeRo.png"));
let ToutuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/ToutuRo.png"));
let FermentRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/FermentRo.png"));

// 定义所有可能的食材，注意料理名字长度可能超过识图范围
const ingredients = [
    "枫达", "盐", "胡椒", "洋葱", "牛奶", "番茄", "香辛料", "卷心菜", "土豆", "小麦", "稻米", "豆腐", "杏仁", "鱼肉", "螃蟹", "虾仁", "咖啡豆", "秃秃豆", "发酵果实汁", "黑麦"
];

// 定义所有食材及其对应的路径文件和 NPC
const mondstadtGroceryFilePath = `assets/Pathing/蒙德百货销售员布兰琪.json`;
const liyueGroceryFilePath = `assets/Pathing/璃月荣发商铺店主东升.json`;
const liyueWanminFilePath = `assets/Pathing/璃月万民堂老板卯师傅.json`;
const groceryFilePath = `assets/Pathing/稻妻九十九物店主葵.json`;
const charcoalFilePath = `assets/Pathing/稻妻志村屋店主志村勘兵卫.json`;
const fengdanGroceryFilePath = `assets/Pathing/枫丹达莫维百货店主布希柯.json`;
const cafeLuzheFilePath = `assets/Pathing/枫丹咖啡厅露泽店主阿鲁埃.json`;
const sumiCitycafeFilePath = `assets/Pathing/须弥城咖啡馆代理店长恩忒卡.json`;
const sumiCityFishPath = `assets/Pathing/须弥城鱼贩珀姆.json`;
const sumiGroceryFilePath = `assets/Pathing/须弥杂货铺哈马维.json`;
const omosPortFishPath = `assets/Pathing/须弥奥摩斯港鱼贩布特罗斯.json`;
const azaleVillMerPath = `assets/Pathing/须弥阿如村商人阿扎莱.json`;
const natlanGroceryFilePath = `assets/Pathing/纳塔杂货铺布纳马.json`;
const nodKraiGroceryFilePath = `assets/Pathing/挪德卡莱杂货铺采若.json`;

const ingredientPaths = {
    "枫达": [fengdanGroceryFilePath, cafeLuzheFilePath],
    "盐": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "洋葱": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "牛奶": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "番茄": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "卷心菜": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "土豆": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "小麦": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "胡椒": [mondstadtGroceryFilePath, liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, fengdanGroceryFilePath, natlanGroceryFilePath, nodKraiGroceryFilePath],
    "稻米": [liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath],//
    "虾仁": [liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath, sumiCityFishPath, omosPortFishPath],
    "豆腐": [liyueGroceryFilePath, groceryFilePath, sumiGroceryFilePath],
    "杏仁": [liyueGroceryFilePath, fengdanGroceryFilePath],
    "鱼肉": [liyueWanminFilePath, charcoalFilePath, sumiCityFishPath, omosPortFishPath, azaleVillMerPath],
    "螃蟹": [liyueWanminFilePath, charcoalFilePath, sumiCityFishPath, omosPortFishPath],
    "秃秃豆": [fengdanGroceryFilePath, azaleVillMerPath, natlanGroceryFilePath],
    "咖啡豆": [sumiCitycafeFilePath, cafeLuzheFilePath],
    "香辛料": [azaleVillMerPath],
    "发酵果实汁": [fengdanGroceryFilePath],
    "黑麦": [nodKraiGroceryFilePath],
};

// 定义食材名称和图片文件名的映射表
const ingredientImageMap = {
    "枫达": "FengdaRo.png",
    "盐": "SaltRo.png",
    "洋葱": "OnionRo.png",
    "牛奶": "MilkRo.png",
    "番茄": "TomatoRo.png",
    "卷心菜": "CabbageRo.png",
    "土豆": "PotatoRo.png",
    "小麦": "WheatRo.png",
    "胡椒": "PepperRo.png",
    "稻米": "RiceRo.png",
    "虾仁": "ShrimpRo.png",
    "豆腐": "TofuRo.png",
    "杏仁": "AlmondRo.png",
    "鱼肉": "FishRo.png",
    "螃蟹": "CrabRo.png",
    "秃秃豆": "ToutuRo.png",
    "咖啡豆": "CoffeeRo.png",
    "香辛料": "SpicesRo.png",
    "发酵果实汁": "FermentRo.png",
    // 可以继续添加更多食材的映射
};

// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};
// 定义所有NPC名，注意名字长度可能超过识图范围
const npcNames = {
    [mondstadtGroceryFilePath]: ["布兰琪"],
    [liyueGroceryFilePath]: ["东升"],
    [liyueWanminFilePath]: ["卯师傅", "师傅"],// ["卯师傅", "卵师傅"]
    [groceryFilePath]: ["葵"],
    [charcoalFilePath]: ["志村勘"],
    [fengdanGroceryFilePath]: ["布希柯"],
    [cafeLuzheFilePath]: ["阿鲁埃"],
    [sumiCityFishPath]: ["珀姆"],
    [sumiCitycafeFilePath]: ["恩忒卡"],
    [omosPortFishPath]: ["布特罗斯"],
    [azaleVillMerPath]: ["阿扎莱"],
    [sumiGroceryFilePath]: ["哈马维"],
    [natlanGroceryFilePath]: ["布纳马"],
    [nodKraiGroceryFilePath]: ["采若"],
};

// 筛选出用户选择的食材及其对应的路径文件和 NPC
let selectedIngredients = []; // 在函数外部声明一次
let selectedPaths = new Map();

for (let ingredient of ingredients) {
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
let purchaseSummary = selectedIngredients.join(", ");
log.info(`即将购买: ${purchaseSummary}`);

// 定义一个函数用于模拟按键操作
async function simulateKeyOperations(key, duration) {
    keyDown(key);
    await sleep(duration);
    keyUp(key);
    await sleep(500); // 释放按键后等待 500 毫秒
}

// 定义一个函数用于购买食材
async function purchaseIngredient(ingredient) {
    log.info(`购买食材: ${ingredient}`);
    // 在购买前进行识别
    let ComfirmRoResult1 = await recognizeImage("assets/Comfirm.png", 1585, 1005, 31, 31, 2000);
    if (ComfirmRoResult1) {
        // 模拟购买操作的后续点击
        await click(1600, 1020); 
        await sleep(1000); // 购买
    } else {
        log.warn(`食材: ${ingredient}已售罄或背包已满`);
        return; // 退出操作
    }

    // 在点击选择100个之前进行识别
    let ComfirmRoResult2 = await recognizeImage("assets/Comfirm.png", 995, 766, 31, 31, 2000);
    if (ComfirmRoResult2) {
        log.info("选择100个的");
        await click(1181, 600); 
        await sleep(200);  // 选择100个
    } else {
        log.warn("尝试重新点击购买");
        await click(1600, 1020); 
        await sleep(1000); // 购买
        return; // 退出操作
    }

    await click(1320, 780); 
    await sleep(1000); // 最终确认
    await click(1320, 780); 
    await sleep(1000); // 点击空白
}


// 定义一个通用的图像识别函数
function recognizeImage(templatePath, xMin, yMin, width, height, timeout = 2000) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            let template = file.ReadImageMatSync(templatePath);
            let recognitionObject = RecognitionObject.TemplateMatch(template, xMin, yMin, width, height);
            let result = captureGameRegion().find(recognitionObject);
            if (result.isExist()) {
                return { success: true, x: result.x, y: result.y, width: result.width, height: result.height };
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            return null;
        }
    }
    log.warn("图像识别超时");
    return null;
}

// 定义一个函数用于执行OCR识别
function performOcr(targetText, xRange, yRange, tolerance, timeout = 2000) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            // 调整区域范围以包含容错区间
            let adjustedXMin = xRange.min - tolerance;
            let adjustedXMax = xRange.max + tolerance;
            let adjustedYMin = yRange.min - tolerance;
            let adjustedYMax = yRange.max + tolerance;

            // 在捕获的区域内进行OCR识别
            let ra = captureGameRegion();
            let resList = ra.findMulti(RecognitionObject.ocr(
                adjustedXMin, adjustedYMin, 
                adjustedXMax - adjustedXMin, adjustedYMax - adjustedYMin
            ));

            // 遍历识别结果，检查是否找到目标文本
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                // log.info("0CR结果-"+ res.text);
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = res.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }

                if (correctedText.includes(targetText)) {
                    // 如果找到目标文本，直接返回坐标
                    return { success: true, x: res.x, y: res.y, width: res.width, height: res.height };
                }
            }
        } catch (error) {
            log.error(`识别文字时发生异常: ${error.message}`);
            return { success: false };
        }
    }
    log.warn("OCR识别超时");
    return { success: false };
}

// 定义一个函数用于识别食材
async function recognizeIngredient(ingredient) {
    let recognized = false;
    const clickOffset = 30; // 点击坐标偏移

    // 尝试 OCR 识别
    let ocrResult = await performOcr(ingredient, { min: 210, max: 390 }, { min: 105, max: 920 }, 10);
    if (ocrResult.success) {
        log.info(`通过 OCR 识别找到食材: ${ingredient}`);
        // log.info(`坐标: x=${ocrResult.x}, y=${ocrResult.y}`);
        await click(ocrResult.x, ocrResult.y + clickOffset);
        await sleep(1000);
        recognized = true;
    } else {
        // OCR 识别失败，尝试图像识别
        let imagePath = `assets/Picture/${ingredientImageMap[ingredient]}`;
        if (!imagePath) {
            log.warn(`未找到食材 '${ingredient}' 的图片文件`);
            return recognized;
        }
        let imageResult = recognizeImage(imagePath, 120, 90, 95, 865, 1000);
        if (imageResult) {
            log.info(`通过图像识别找到食材: ${ingredient}`);
            // log.debug(`imageResult: ${JSON.stringify(imageResult)}`);
            let x = Math.round(imageResult.x);
            let y = Math.round(imageResult.y);
            await click(x, y);await sleep(1000);
            recognized = true;
        } else {
                log.warn(`未能识别到食材: ${ingredient}`);
        }
        }

    return recognized;
}

// 定义一个函数用于识别并点击用户选择的食材
async function clickSelectedIngredients(selectedIngredients, filePath, npcNames) {
    log.info(`加载路径文件: ${filePath}`);
    await pathingScript.runFile(filePath);
    await sleep(1000);

    // 识别并交互 NPC
    const npcxRange = { min: 1190, max: 1320 }; // npc X轴区间
    const FxRange = { min: 1050, max: 1150 }; // F X轴坐标
    const FyRange = { min: 400, max: 800 }; // F Y轴坐标
    let fDialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/F_Dialogue.png"), FxRange.min, FyRange.min, FxRange.max - FxRange.min, FyRange.max - FyRange.min);
    const tolerance = 12; // 容错区间
    const npctolerance = 5; // 容错区间

    // 执行点击操作
    async function performClickOperations(filePath) {
        if (filePath === liyueGroceryFilePath || filePath === groceryFilePath || filePath === sumiCityFishPath) {
            log.info("执行璃月稻妻杂货商等的点击操作");
            await click(1300, 650); await sleep(500); // 双击增加低帧点击成功率
            await click(1300, 650); await sleep(500);
            await click(1300, 650); await sleep(1000);
            await click(1320, 780); await sleep(1000);
        } else if (filePath === azaleVillMerPath || filePath === sumiGroceryFilePath) {
            log.info("执行须弥杂货商等的点击操作");
            await click(1300, 660); await sleep(1000);
            await click(1300, 660); await sleep(1000);
            await click(1300, 660); await sleep(1000);
            await click(1300, 660); await sleep(1000);
        } else if (filePath === natlanGroceryFilePath) {
            log.info("执行纳塔杂货商等的点击操作");
            await click(1300, 580); await sleep(1000);
            await click(1300, 580); await sleep(1000);
            await click(1300, 580); await sleep(1000);
            await click(1300, 580); await sleep(1000);
        } else if (filePath === nodKraiGroceryFilePath) {
            log.info("执行挪德卡莱杂货商等的点击操作");
            await click(1300, 430); await sleep(1000);
            await click(1300, 430); await sleep(1000);
            await click(1300, 430); await sleep(1000);
        } else {
            log.info("执行其他路径文件的点击操作");
            await click(1300, 580); await sleep(500);
            await click(1300, 580); await sleep(500);
            await click(1300, 580); await sleep(1000);
            await click(1320, 780); await sleep(1000);
        }
    }

// 检查 F 图标和右边水平对齐的文字
async function checkNpcAndFAlignment(npcName, fDialogueRo) {
    let ra = captureGameRegion();
    let fRes = ra.find(fDialogueRo);
    if (!fRes.isExist()) {
        let f_attempts = null; // 初始化尝试次数
        while (f_attempts < 5) { // 最多尝试 4 次
            f_attempts++;
            log.info(`当前尝试次数：${f_attempts}`);

            if (f_attempts <= 3) {
                // 第 1-3 次尝试
                await simulateKeyOperations("S", 200); // 后退 200 毫秒
                await sleep(200);
                await simulateKeyOperations("W", 400); // 前进 400 毫秒
                await sleep(500);
            } else if (f_attempts === 4) {
                // 第 4 次尝试
                log.info("重新加载路径文件");
                await pathingScript.runFile(filePath);
                await sleep(500);
            } else {
                // 第 5 次尝试，尝试次数已达上限
                log.warn("尝试次数已达上限");
                break; // 找到后退出循环
            }

            // 检查是否找到 F 图标
            ra = captureGameRegion();
            fRes = ra.find(fDialogueRo); // 重新查找 F 图标
            if (fRes.isExist()) {
                log.info("找到 F 图标");
                break; // 找到后退出循环
            }
            log.warn(`尝试 ${f_attempts}：寻找 F 图标`);
        }

        // 如果尝试次数用完仍未找到 F 图标，返回 false
        if (!fRes.isExist()) {
            log.warn("经过多次尝试后仍未找到 F 图标");
            return false;
        }
    }

    // 获取 F 图标的中心点 Y 坐标
    let centerYF = fRes.y + fRes.height / 2;

    // 在 F 图标右侧水平方向上识别 NPC 名称
    let ocrResult = await performOcr(npcName, npcxRange, { min: fRes.y, max: fRes.y + fRes.height }, tolerance);
    if (!ocrResult.success) {
        log.warn(`OCR 识别未找到 NPC: ${npcName}，尝试滚动`);
        return false;
    }

    // 获取 NPC 名称的中心点 Y 坐标
    let centerYnpcName = ocrResult.y + ocrResult.height / 2;

    // 检查 NPC 名称和 F 图标的中心点 Y 坐标是否在容错范围内
    if (Math.abs(centerYnpcName - centerYF) <= npctolerance) {
        return true;
    } else {
        log.info(`NPC '${npcName}' 和 F 图标未水平对齐，NPC: ${centerYnpcName}, F 图标: ${centerYF}`);
        return false;
    }
}

    // 新增变量用于记录滚轮操作次数
    let scrollAttempts = 0;
    const maxScrollAttempts = 5; // 最大滚轮操作次数限制

    for (const npcName of npcNames) {
        log.info(`尝试识别 NPC: ${npcName}`);
        let isAligned = await checkNpcAndFAlignment(npcName, fDialogueRo);
        while (!isAligned && scrollAttempts < maxScrollAttempts) {
            // 如果未水平对齐，执行滚轮操作
            await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            await sleep(1000);

            // 检查是否超过最大滚轮操作次数
            scrollAttempts++;
            if (scrollAttempts >= maxScrollAttempts) {
                log.error(`滚轮操作次数已达上限 ${maxScrollAttempts} 次，退出循环`);
                break; // 超过最大滚轮操作次数，终止循环
            }

            // 重新检查 F 图标和 NPC 名称是否对齐
            let ra = captureGameRegion();
            let fRes = ra.find(fDialogueRo);
            if (!fRes.isExist()) {
                log.warn("未找到 F 图标");
                continue; // 如果未找到 F 图标，继续下一次循环
            }

            // 获取 F 图标的中心点 Y 坐标
            let centerYF = fRes.y + fRes.height / 2;

            // 在 F 图标右侧水平方向上识别 NPC 名称
            let ocrResult = await performOcr(npcName, npcxRange, { min: fRes.y, max: fRes.y + fRes.height }, tolerance);
            if (!ocrResult.success) {
                log.warn(`OCR 识别未找到 NPC: ${npcName}`);
                continue; // 如果未找到 NPC 名称，继续下一次循环
            }

            // 获取 NPC 名称的中心点 Y 坐标
            let centerYnpcName = ocrResult.y + ocrResult.height / 2;

            // 检查 NPC 名称和 F 图标的中心点 Y 坐标是否在容错范围内
            if (Math.abs(centerYnpcName - centerYF) <= npctolerance) {
                isAligned = true;
                log.info(`NPC '${npcName}' 和 F 图标水平对齐，NPC: ${centerYnpcName}, F 图标: ${centerYF}`);
            } else {
                log.info(`NPC '${npcName}' 和 F 图标未水平对齐，NPC: ${centerYnpcName}, F 图标: ${centerYF}`);
            }
        }

        // 如果水平对齐，执行交互操作
         if (isAligned) {
            keyPress("F");
            await sleep(2500);

// 首次执行点击操作
            await performClickOperations(filePath);
            let ComfirmRoResult = null;
            let C_maxAttempts = 2; // 最大尝试次数
            let C_attempts = 0; // 当前尝试次数

            while (!ComfirmRoResult && C_attempts < C_maxAttempts) {
                // 调用 recognizeImage 检测 ComfirmRo
                ComfirmRoResult = await recognizeImage("assets/Comfirm.png", 1585, 1005, 31, 31, 2000);

                if (ComfirmRoResult) {
                    log.info("识别到购买按钮，执行食材选择");
                    break; // 如果识别到，退出循环
                } else {
                    log.warn("未识别到购买按钮，尝试重新识别");
                }

                await sleep(500); // 等待一段时间后再次检测
                // 如果未识别到 ComfirmRo，再次执行点击操作
                await performClickOperations(filePath);

                C_attempts++; // 增加尝试次数
            }

            if (!ComfirmRoResult) {
                log.warn("未在规定时间内完成对话");
                return; // 退出函数
}

            // 只有在成功对齐并交互后，才执行后续的食材购买操作
            // 记录已购买的食材
            let purchasedIngredients = new Set();

            let allIngredientsFound = false; // 标记是否所有食材都已找到
            let scrollAttemptsForIngredients = 0;
            const maxScrollAttemptsForIngredients = 3; // 最大翻页次数

            while (!allIngredientsFound && scrollAttemptsForIngredients < maxScrollAttemptsForIngredients) {
                allIngredientsFound = true; // 假设本轮所有食材都已找到，若后续发现未找到则修改为 false

                for (const ingredient of selectedIngredients) {
                    if (purchasedIngredients.has(ingredient)) {
                        log.info(`跳过已购买的食材: ${ingredient}`);
                        continue; // 跳过已购买的食材
                    }
                    // await sleep(1000);

                    // 尝试识别食材
                    let recognized = await recognizeIngredient(ingredient);
                    if (recognized) {
                        log.info(`识别到 '${ingredient}'，执行购买操作`);
                        await purchaseIngredient(ingredient);
                        purchasedIngredients.add(ingredient);
                    } else {
                        // log.error(`未能识别到食材: ${ingredient}`);
                        allIngredientsFound = false; // 本轮有食材未找到
                    }
                }

                if (!allIngredientsFound) {
                    log.info(`在当前页面未找到所有食材，尝试翻页`);
                    await PageScroll(1); // 每轮翻页滑动1次
                    await sleep(1000);
                    scrollAttemptsForIngredients++;
                }
            }

            if (!allIngredientsFound) {
                log.error(`在所有页面中未找到所有食材，跳过该路径`);
            }

            // 最后点击退出按钮
            log.info("点击退出按钮...");
            await click(1845, 45); // 退出
            await sleep(2000);

            // 如果成功购买了所有食材，记录成功信息
            if (allIngredientsFound) {
                log.info("该处所需食材已完成购买！");
            } else {
                log.error("未能购买所有食材，部分食材可能未找到或未成功购买。");
            }

            return; // 结束函数，后续逻辑不再执行
        } else {
            // 如果未水平对齐且超过最大滚轮操作次数，记录错误信息并跳过该 NPC
            log.error(`未能找到正确的 NPC '${npcName}' 或未成功交互，跳过该 NPC`);
        }
    }

    // 如果没有找到任何 NPC 或未成功交互，则记录错误信息并退出
    log.error("未能找到正确的 NPC 或未成功交互，跳过该路径");
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
        log.error(`执行滑动操作时发生错误：${error.message}`);
    }
}

// 主函数
async function AutoPath() {
    log.info("开始执行自动寻路任务");

    // 加载路径文件和 NPC 名称
    for (let [path, ingredients] of selectedPaths) {
        let npcName = npcNames[path];
        await clickSelectedIngredients(ingredients, path, npcName);
    }
}

// 执行主函数
(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    await AutoPath();
})();
