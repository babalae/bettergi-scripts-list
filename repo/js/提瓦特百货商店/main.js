// 定义所有食材及其对应的路径文件和 NPC
// 定义路径常量
const paths = {
    monde: {
        grocery: `assets/Pathing/蒙德杂货商人-布兰琪.json`,
        restaurant: `assets/Pathing/蒙德餐馆-莎拉.json`,
        plantShop: `assets/Pathing/蒙德植物商人-芙萝拉.json`,
        meatShop: `assets/Pathing/蒙德肉类商人-杜拉夫.json`
    },
    liyue: {
        grocery: `assets/Pathing/璃月荣发商铺-东升.json`,
        wanmin: `assets/Pathing/璃月万民堂老板-卯师傅.json`,
        plantShop: `assets/Pathing/璃月植物类商人-阿桂.json`,
        fruitShop: `assets/Pathing/璃月水果和鱼肉-博来.json`,
        generalShop: `assets/Pathing/璃月商人-长顺.json`,
        fishShop1: `assets/Pathing/璃月鱼贩1-老孙.json`,
        fishShop2: `assets/Pathing/璃月鱼贩2-老高.json`,
        restaurant: `assets/Pathing/璃月客栈老板娘-菲尔戈黛特.json`,
        mill: `assets/Pathing/璃月轻策庄磨坊主-小白.json`,
        yilong: `assets/Pathing/璃月遗珑埠百货商人-丰泰.json`,
        snackStall: `assets/Pathing/璃月小吃摊摊主-连芳.json`
    },
    inazuma: {
        grocery: `assets/Pathing/稻妻九十九物店主-葵.json`,
        generalShop: `assets/Pathing/稻妻百货商人-葵.json`,
        restaurant: `assets/Pathing/稻妻餐馆-志村勘兵卫.json`,
        fishShop: `assets/Pathing/稻妻征集店名的店主-山城健太.json`,
        haijishop: `assets/Pathing/稻妻海祇岛百货商人-清子.json`
    },
    fontaine: {
        grocery: `assets/Pathing/枫丹达莫维百货店主-布希柯.json`,
        cafe: `assets/Pathing/枫丹咖啡厅露泽店主-阿鲁埃.json`
    },
    sumeru: {
        cafe: `assets/Pathing/须弥城咖啡馆代理店长-恩忒卡.json`,
        fishShop: `assets/Pathing/须弥鱼贩-珀姆.json`,
        portFish: `assets/Pathing/须弥奥摩斯港鱼贩-布特罗斯.json`,
        villageMerchant: `assets/Pathing/须弥阿如村商人-阿扎莱.json`
    }
};

// 定义 ingredient 对应路径
const ingredientPaths = {
    "枫达": [paths.fontaine.grocery, paths.fontaine.cafe],
    "盐": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.inazuma.generalShop],
    "洋葱": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.inazuma.generalShop],
    "牛奶": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.inazuma.generalShop, paths.inazuma.haijishop],
    "番茄": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.inazuma.generalShop, paths.inazuma.haijishop],
    "卷心菜": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.inazuma.generalShop],
    "土豆": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.liyue.generalShop, paths.inazuma.generalShop, paths.inazuma.haijishop],
    "小麦": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.inazuma.generalShop, paths.inazuma.haijishop],
    "胡椒": [paths.monde.grocery, paths.liyue.grocery, paths.inazuma.grocery, paths.fontaine.grocery, paths.inazuma.generalShop],
    "稻米": [paths.liyue.grocery, paths.inazuma.grocery, paths.liyue.yilong, paths.inazuma.generalShop],
    "虾仁": [paths.liyue.grocery, paths.inazuma.grocery, paths.sumeru.fishShop, paths.sumeru.portFish, paths.liyue.fishShop1, paths.liyue.fishShop2, paths.inazuma.generalShop],
    "豆腐": [paths.liyue.grocery, paths.inazuma.grocery, paths.liyue.mill, paths.liyue.yilong, paths.inazuma.generalShop, paths.inazuma.haijishop],
    "杏仁": [paths.liyue.grocery, paths.fontaine.grocery, paths.liyue.mill],
    "鱼肉": [paths.liyue.wanmin, paths.inazuma.restaurant, paths.sumeru.fishShop, paths.sumeru.portFish, paths.sumeru.villageMerchant, paths.liyue.fruitShop, paths.liyue.fishShop1, paths.liyue.fishShop2],
    "螃蟹": [paths.liyue.wanmin, paths.inazuma.restaurant, paths.sumeru.fishShop, paths.sumeru.portFish, paths.liyue.fishShop1, paths.liyue.fishShop2],
    "海草": [paths.sumeru.fishShop, paths.sumeru.portFish],
    "秃秃豆": [paths.fontaine.grocery, paths.sumeru.villageMerchant],
    "咖啡豆": [paths.sumeru.cafe, paths.fontaine.cafe],
    "香辛料": [paths.sumeru.villageMerchant],
    "发酵果实汁": [paths.fontaine.grocery],
    "提瓦特煎蛋": [paths.monde.restaurant],
    "野菇鸡肉串": [paths.monde.restaurant, paths.liyue.restaurant, paths.inazuma.restaurant],
    "渔人吐司": [paths.monde.restaurant, paths.inazuma.restaurant],
    "面粉": [paths.monde.restaurant, paths.inazuma.restaurant],
    "奶油": [paths.monde.restaurant],
    "熏禽肉": [paths.monde.restaurant],
    "黄油": [paths.monde.restaurant, paths.liyue.restaurant],
    "火腿": [paths.monde.restaurant],
    "糖": [paths.monde.restaurant, paths.liyue.generalShop, paths.inazuma.restaurant],
    "蟹黄": [paths.monde.restaurant, paths.liyue.yilong],
    "果酱": [paths.monde.restaurant],
    "奶酪": [paths.monde.restaurant, paths.liyue.generalShop],
    "培根": [paths.monde.restaurant, paths.inazuma.restaurant],
    "香肠": [paths.monde.restaurant, paths.liyue.restaurant, paths.inazuma.restaurant],
    "甜甜花": [paths.monde.plantShop],
    "风车菊": [paths.monde.plantShop],
    "塞西莉亚花": [paths.monde.plantShop],
    "小灯草": [paths.monde.plantShop],
    "嘟嘟莲": [paths.monde.plantShop],
    "禽肉": [paths.monde.meatShop],
    "鸟蛋": [paths.monde.meatShop],
    "兽肉": [paths.monde.meatShop],
    "冰雾花花朵": [paths.liyue.plantShop],
    "烈焰花花朵": [paths.liyue.plantShop],
    "琉璃袋": [paths.liyue.plantShop, paths.liyue.yilong],
    "莲蓬": [paths.liyue.plantShop],
    "马尾": [paths.liyue.plantShop],
    "清心": [paths.liyue.plantShop],
    "苹果": [paths.liyue.fruitShop],
    "日落果": [paths.liyue.fruitShop],
    "星螺": [paths.liyue.fruitShop],
    "电气水晶": [paths.liyue.generalShop],
    "石珀": [paths.liyue.generalShop, paths.liyue.yilong],
    "杏仁豆腐": [paths.liyue.restaurant],
    "松茸酿肉卷": [paths.liyue.restaurant],
    "香嫩椒椒鸡": [paths.liyue.restaurant],
    "山珍热卤面": [paths.liyue.restaurant],
    "松茸": [paths.liyue.restaurant],
    "霓裳花": [paths.liyue.plantShop, paths.liyue.mill, paths.liyue.yilong],
    "琉璃百合": [paths.liyue.mill],
    "轻策农家菜": [paths.liyue.mill],
    "沉玉仙茗": [paths.liyue.yilong, paths.liyue.snackStall],
    "清水玉": [paths.liyue.yilong],
    "夜泊石": [paths.liyue.yilong],
    "绝云椒椒": [paths.liyue.yilong],
    "玉纹茶叶蛋": [paths.liyue.snackStall],
    "沉玉茶露": [paths.liyue.snackStall],
    "茶熏乳鸽": [paths.liyue.snackStall],
    "茶好月圆": [paths.liyue.snackStall],
    "鸣草": [paths.inazuma.generalShop],
    "堇瓜": [paths.inazuma.restaurant],
    "白萝卜": [paths.inazuma.restaurant],
    "珊瑚真珠": [paths.inazuma.fishShop],
    "鳗肉": [paths.inazuma.fishShop]
};


// 定义所有可能的食材，注意料理名字长度可能超过识图范围
const ingredients = Object.keys(ingredientPaths);

// 定义食材名称和图片文件名的映射表
const ingredientImageMap = Object.fromEntries(
    ingredients.map(name => [name, `${name}.png`])
);

// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};
// 定义所有NPC名，注意名字长度可能超过识图范围
// 🎭 NPC 映射
// ��️ 提取路径对应的NPC姓名（从路径中"-"后的名字提取）
const npcNames = {};
for (const region in paths) {
    const regionPaths = paths[region];
    for (const key in regionPaths) {
        const path = regionPaths[key];
        const match = path.match(/-([^\/]+)\.json$/);  // 提取 -后姓名
        if (match) {
            const name = match[1];
            npcNames[path] = [name];  // 用数组包装（支持后续扩展多个别名）
        }
    }
}

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

//设定时间
async function settime(time) {
    try {
        const centerX = 1441;
        const centerY = 501;
        const radius = 100;
        let angle;
        angle = (90 + time * 15) % 360;
        angle = angle >= 0 ? angle : 360 + angle;
        const angle1 = (angle + 90) % 360;
        const angle2 = (angle + 180) % 360;
        const angle3 = (angle + 270) % 360;
        const radians = angle * (Math.PI / 180);
        const radians1 = angle1 * (Math.PI / 180);
        const radians2 = angle2 * (Math.PI / 180);
        const radians3 = angle3 * (Math.PI / 180);
        const x = centerX + radius * Math.cos(radians);
        const y = centerY + radius * Math.sin(radians);
        const x1 = centerX + radius * Math.cos(radians1);
        const y1 = centerY + radius * Math.sin(radians1);
        const x2 = centerX + radius * Math.cos(radians2);
        const y2 = centerY + radius * Math.sin(radians2);
        const x3 = centerX + radius * Math.cos(radians3);
        const y3 = centerY + radius * Math.sin(radians3);

        await sleep(2000);
        await moveMouseSmoothly(centerX, centerY, x1, y1);
        await sleep(2000);
        await moveMouseSmoothly(centerX, centerY, x2, y2);
        await sleep(2000);
        await moveMouseSmoothly(centerX, centerY, x3, y3);
        await sleep(2000);
        await moveMouseSmoothly(centerX, centerY, x, y);
    } catch (err) {
        log.warn(`设置时间操作失败: ${err}`);
    }
}

//拖动鼠标
async function moveMouseSmoothly(x1, y1, x2, y2) {
    try {
        const deltaX = x2 - x1;
        const deltaY = y2 - y1;
        const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));
        const stepX = deltaX / steps;
        const stepY = deltaY / steps;
        await moveMouseTo(x1, y1);
        await leftButtonDown();
        for (let i = 1; i <= steps; i++) {
            const newX = x1 + stepX * i;
            const newY = y1 + stepY * i;
            const validX = Math.round(newX);
            const validY = Math.round(newY);
            await moveMouseTo(validX, validY);
            await sleep(10);
        }
        await leftButtonUp();
    } catch (err) {
        log.warn(`鼠标移动失败: ${err}`);
    }
}

// 设置游戏时间的主函数
async function setGameTime(targetTime) {
    try {
        log.info(`设置时间到 ${targetTime} 点`);
        
        // 打开菜单
        await keyPress("Escape");
        await sleep(1000);
        
        // 点击时间设置按钮
        await click(50, 700);
        await sleep(2000);
        
        // 设置具体时间
        await settime(targetTime);
        await sleep(3000);
        
        // 确认设置
        await click(1500, 1000);
        await sleep(20000);
        
        // 关闭菜单
        await keyPress("Escape");
        await sleep(2000);
        await keyPress("Escape");
        await sleep(2000);
        
        log.info("时间设置完成");
    } catch (err) {
        log.warn(`设置游戏时间失败: ${err}`);
    }
}

// 定义一个函数用于模拟按键操作
async function simulateKeyOperations(key, duration) {
    try {
        keyDown(key);
        await sleep(duration);
        keyUp(key);
        await sleep(500); // 释放按键后等待 500 毫秒
    } catch (err) {
        log.warn(`模拟按键操作失败: ${err}`);
    }
}

// 定义一个函数用于购买食材
async function purchaseIngredient(ingredient) {
    try {
        log.info(`购买食材: ${ingredient}`);
        // 在购买前进行识别
        let ComfirmRoResult1 = await recognizeImage("assets/Comfirm.png", 1585, 1005, 30, 30, 2000);
        let soldOutResult = await recognizeImage("assets/已售罄.png", 1320, 920, 31, 31, 2000);
        
        if (soldOutResult) {
            log.warn(`食材: ${ingredient}已售罄`);
            return;
        }

        if (ComfirmRoResult1) {
            // 模拟购买操作的后续点击
            await click(1600, 1020); 
            await sleep(1000); // 购买
        } else {
            log.warn(`食材: ${ingredient}背包已满`);
            return; // 退出操作
        }

        // 在点击选择100个之前进行识别
        let ComfirmRoResult2 = await recognizeImage("assets/Comfirm.png", 995, 766, 30, 30, 2000);
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
    } catch (err) {
        log.warn(`购买食材 ${ingredient} 失败: ${err}`);
    }
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
        } catch (err) {
            log.warn(`识别图像时发生异常: ${err}`);
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
                let correctedText = res.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }

                if (correctedText.includes(targetText)) {
                    return { success: true, x: res.x, y: res.y, width: res.width, height: res.height };
                }
            }
        } catch (err) {
            log.info(`OCR识别超时: ${err}`);
            return { success: false };
        }
    }
    log.warn("OCR识别超时");
    return { success: false };
}

// 定义一个函数用于识别食材
async function recognizeIngredient(ingredient) {
    try {
        let recognized = false;
        const clickOffset = 30; // 点击坐标偏移

        // 尝试 OCR 识别
        let ocrResult = await performOcr(ingredient, { min: 210, max: 390 }, { min: 105, max: 920 }, 10);
        if (ocrResult.success) {
            log.info(`通过 OCR 识别找到食材: ${ingredient}`);
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
                let x = Math.round(imageResult.x);
                let y = Math.round(imageResult.y);
                await click(x, y);
                await sleep(1000);
                recognized = true;
            } else {
                log.warn(`未能识别到食材: ${ingredient}`);
            }
        }
        return recognized;
    } catch (err) {
        log.warn(`识别食材 ${ingredient} 失败: ${err}`);
        return false;
    }
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

    // 检查 F 图标和右边水平对齐的文字
    async function checkNpcAndFAlignment(npcName, fDialogueRo) {
        try {
            log.info("进入 checkNpcAndFAlignment");
            
            // 检查F图标和NPC是否对齐的函数
            async function checkAlignment() {
                let ra = captureGameRegion();
                let fRes = ra.find(fDialogueRo);
                if (!fRes.isExist()) {
                    log.info("未找到F图标");
                    return false;
                }
                
                let centerYF = fRes.y + fRes.height / 2;
                let ocrResult = await performOcr(npcName, npcxRange, { min: fRes.y, max: fRes.y + fRes.height }, tolerance);
                if (!ocrResult.success) {
                    log.info("未找到NPC名称");
                    return false;
                }

                let centerYnpcName = ocrResult.y + ocrResult.height / 2;
                let isAligned = Math.abs(centerYnpcName - centerYF) <= npctolerance;
                log.info(`NPC和F图标是否对齐: ${isAligned}`);
                return isAligned;
            }

            // 执行滚轮下滑和检查的函数
            async function tryScrollAndCheck() {
                for (let i = 0; i < 3; i++) {
                    log.info(`执行第${i + 1}次滚轮下滑`);
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                    await sleep(1000);
                    
                    if (await checkAlignment()) {
                        log.info(`在第${i + 1}次滚轮下滑后找到对齐的NPC`);
                        return true;
                    }
                }
                return false;
            }

            // 主要逻辑
            // 1. 先检查当前状态
            if (await checkAlignment()) {
                log.info("初始状态已对齐");
                return true;
            }

            // 2. 尝试3次滚轮下滑
            log.info("开始尝试滚轮下滑");
            if (await tryScrollAndCheck()) {
                return true;
            }

            // 3. 调整到8点
            log.info("滚轮下滑失败，调整到8点");
            await setGameTime(8);
            await sleep(2000);

            // 4. 8点时检查并尝试滚轮下滑
            if (await checkAlignment()) {
                log.info("8点时初始状态已对齐");
                return true;
            }
            if (await tryScrollAndCheck()) {
                return true;
            }

            // 5. 调整到18点
            log.info("8点尝试失败，调整到18点");
            await setGameTime(18);
            await sleep(2000);

            // 6. 18点时检查并尝试滚轮下滑
            if (await checkAlignment()) {
                log.info("18点时初始状态已对齐");
                return true;
            }
            if (await tryScrollAndCheck()) {
                return true;
            }

            // 7. 如果都失败了，重新加载路径
            log.info("所有尝试都失败，重新加载路径");
            await pathingScript.runFile(filePath);
            await sleep(500);

            // 8. 最后再检查一次
            return await checkAlignment();
        } catch (err) {
            log.warn(`检查NPC和F对齐失败: ${err}`);
            return false;
        }
    }

    // 执行点击操作
    async function performClickOperations(filePath) {
        // 根据NPC执行不同的点击操作
        if (filePath === paths.monde.meatShop) {
            log.info("执行杜拉夫的特殊点击操作");
            for (let i = 0; i < 3; i++) {
                await click(1300, 580);
                await sleep(i < 2 ? 500 : 1000);
            }
            await click(1320, 780);
            await sleep(1000);

            // 检查是否出现购买按钮或已售罄图标
            let buyButtonResult = await recognizeImage("assets/Comfirm.png", 1585, 1005, 31, 31, 2000);
            let soldOutResult = await recognizeImage("assets/已售罄.png", 1320, 916, 50, 50, 2000);
            
            if (buyButtonResult) {
                log.info("成功触发购买界面");
            } else if (soldOutResult) {
                log.info("检测到已售罄状态");
            } else {
                log.warn("杜拉夫操作后未检测到购买按钮或已售罄图标");
            }
            
            return buyButtonResult || soldOutResult;
        }

        // 其他NPC的标准点击操作
        const maxAttempts = 10;
        let attempts = 0;
        let success = false;

        while (attempts < maxAttempts && !success) {
            attempts++;

            // 其他NPC的标准点击操作
            await keyPress("F");
            await sleep(50);
            await click(1300, 500);
            await sleep(50);

            // 检查是否出现购买按钮或已售罄图标
            let buyButtonResult = await recognizeImage("assets/Comfirm.png", 1585, 1005, 31, 31, 2000);
            let soldOutResult = await recognizeImage("assets/已售罄.png", 1320, 916, 50, 50, 2000);
            
            if (buyButtonResult || soldOutResult) {
                if (buyButtonResult) {
                    log.info("成功触发购买界面");
                } else {
                    log.info("检测到已售罄状态");
                }
                success = true;
                break;
            }
        }

        if (!success) {
            log.error(`未能进入商店界面，重试次数已达 ${maxAttempts} 次，返回主界面并继续下一条路径`);
            await genshin.returnMainUi();
            return;
        }

        return success;
    }

    // 执行完整的购买流程
    async function executePurchaseFlow() {
        for (const npcName of npcNames) {
            log.info(`尝试识别 NPC: ${npcName}`);
            let isAligned = await checkNpcAndFAlignment(npcName, fDialogueRo);
            let scrollAttempts = 0;
            const maxScrollAttempts = 5;

            while (!isAligned && scrollAttempts < maxScrollAttempts) {
                await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                await sleep(1000);
                scrollAttempts++;
                if (scrollAttempts >= maxScrollAttempts) {
                    log.error(`滚轮操作次数已达上限 ${maxScrollAttempts} 次，退出循环`);
                    break;
                }

                let ra = captureGameRegion();
                let fRes = ra.find(fDialogueRo);
                if (!fRes.isExist()) {
                    log.warn("未找到 F 图标");
                    continue;
                }

                let centerYF = fRes.y + fRes.height / 2;
                let ocrResult = await performOcr(npcName, npcxRange, { min: fRes.y, max: fRes.y + fRes.height }, tolerance);
                if (!ocrResult.success) {
                    log.warn(`OCR 识别未找到 NPC: ${npcName}`);
                    continue;
                }

                let centerYnpcName = ocrResult.y + ocrResult.height / 2;
                if (Math.abs(centerYnpcName - centerYF) <= npctolerance) {
                    isAligned = true;
                    log.info(`NPC '${npcName}' 和 F 图标水平对齐，NPC: ${centerYnpcName}, F 图标: ${centerYF}`);
                } else {
                    log.info(`NPC '${npcName}' 和 F 图标未水平对齐，NPC: ${centerYnpcName}, F 图标: ${centerYF}`);
                }
            }

            if (isAligned) {
                keyPress("F");
                await sleep(2500);

                await performClickOperations(filePath);
                let ComfirmRoResult = null;
                let C_maxAttempts = 2;
                let C_attempts = 0;

                while (!ComfirmRoResult && C_attempts < C_maxAttempts) {
                    ComfirmRoResult = await recognizeImage("assets/Comfirm.png", 1585, 1005, 31, 31, 2000);
                    if (ComfirmRoResult) {
                        log.info("识别到购买按钮，执行食材选择");
                        break;
                    } else {
                        log.warn("未识别到购买按钮，尝试重新识别");
                    }
                    await sleep(500);
                    await performClickOperations(filePath);
                    C_attempts++;
                }

                if (!ComfirmRoResult) {
                    log.warn("未在规定时间内完成对话");
                    return;
                }

                let purchasedIngredients = new Set();
                let allIngredientsFound = false;
                let scrollAttemptsForIngredients = 0;
                const maxScrollAttemptsForIngredients = 3;

                while (!allIngredientsFound && scrollAttemptsForIngredients < maxScrollAttemptsForIngredients) {
                    allIngredientsFound = true;

                    for (const ingredient of selectedIngredients) {
                        if (purchasedIngredients.has(ingredient)) {
                            log.info(`跳过已购买的食材: ${ingredient}`);
                            continue;
                        }

                        let recognized = await recognizeIngredient(ingredient);
                        if (recognized) {
                            log.info(`识别到 '${ingredient}'，执行购买操作`);
                            await purchaseIngredient(ingredient);
                            purchasedIngredients.add(ingredient);
                        } else {
                            allIngredientsFound = false;
                        }
                    }

                    if (!allIngredientsFound) {
                        log.info(`在当前页面未找到所有食材，尝试翻页`);
                        await PageScroll(1);
                        await sleep(1000);
                        scrollAttemptsForIngredients++;
                    }
                }

                if (!allIngredientsFound) {
                    log.error(`在所有页面中未找到所有食材，跳过该路径`);
                }

                log.info("点击退出按钮...");
                await click(1845, 45);
                await sleep(2000);

                if (allIngredientsFound) {
                    log.info("该处所需食材已完成购买！");
                } else {
                    log.error("未能购买所有食材，部分食材可能未找到或未成功购买。");
                }

                return;
            } else {
                log.error(`未能找到正确的 NPC '${npcName}' 或未成功交互，跳过该 NPC`);
            }
        }
        log.error("未能找到正确的 NPC 或未成功交互，跳过该路径");
    }

    // 对于老高的商店，执行两遍完整流程
    if (filePath === paths.liyue.fishShop2) {
        log.info("执行双重购买流程");
        // 第一遍
        await executePurchaseFlow();
        await sleep(1000);
        // 第二遍
        await executePurchaseFlow();
    } else {
        // 其他商店正常执行一遍
        await executePurchaseFlow();
    }
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
    } catch (err) {
        log.warn(`执行滑动操作失败: ${err}`);
    }
}

// 主函数
async function AutoPath() {
    try {
        log.info("开始执行自动寻路任务");

        // 创建一个Map来存储每个NPC需要购买的所有食材
        let npcIngredientMap = new Map();

        // 遍历选中的食材，按NPC分组
        for (let [path, ingredients] of selectedPaths) {
            if (!npcIngredientMap.has(path)) {
                npcIngredientMap.set(path, new Set());
            }
            ingredients.forEach(ingredient => {
                npcIngredientMap.get(path).add(ingredient);
            });
        }

        // 定义区域顺序
        const regionOrder = {
            'monde': 2,    // 蒙德
            'liyue': 3,    // 璃月
            'sumeru': 4,   // 须弥
            'fontaine': 5  // 枫丹
        };

        // 将Map转换为数组并排序
        let sortedPaths = Array.from(npcIngredientMap.entries()).sort((a, b) => {
            // 按照正常区域顺序排序
            const getRegion = (path) => {
                for (const region in paths) {
                    if (Object.values(paths[region]).includes(path)) {
                        return region;
                    }
                }
                return '';
            };

            const regionA = getRegion(a[0]);
            const regionB = getRegion(b[0]);

            return (regionOrder[regionA] || 999) - (regionOrder[regionB] || 999);
        });

        // 按排序后的顺序访问NPC
        for (let [path, ingredientSet] of sortedPaths) {
            log.info(`访问NPC路径: ${path}`);
            log.info(`需要购买的食材: ${Array.from(ingredientSet).join(", ")}`);
            
            let npcName = npcNames[path];
            // 将Set转换回数组
            await clickSelectedIngredients(Array.from(ingredientSet), path, npcName);
        }
    } catch (err) {
        log.warn(`自动寻路任务失败: ${err}`);
    }
}

// 执行主函数
(async function () {
    try {
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();
        
        // 执行自动寻路
        await AutoPath();
    } catch (err) {
        log.warn(`主函数执行失败: ${err}`);
    }
})();