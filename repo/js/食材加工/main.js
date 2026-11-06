(async function () {
    // 设置游戏基础参数
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    /**菜单区**/
    // 初始化变量
    let CookingClickX; // 烹饪点击坐标 X
    const CookingClickY = 45; // 烹饪点击坐标 Y（假设固定为 45）
    /**加工区**/
    // 食材图像映射
    const ingredientImageMap = {
        "Processing11": "assets/Picture/Flour.png",
        "Processing12": "assets/Picture/Raw-Meat.png",
        "Processing13": "assets/Picture/Fish.png",
        "Processing14": "assets/Picture/Mysterious-Meat.png",
        "Processing15": "assets/Picture/Rye-Flour.png",
        "Processing16": "assets/Picture/Butter.png",
        "Processing17": "assets/Picture/Smoked-Poultry.png",
        "Processing18": "assets/Picture/Lard.png",
        "Processing21": "assets/Picture/Ham.png",
        "Processing22": "assets/Picture/Sugar.png",
        "Processing23": "assets/Picture/Spices.png",
        "Processing24": "assets/Picture/Sour-Cream.png",
        "Processing25": "assets/Picture/Crab-Roe.png",
        "Processing26": "assets/Picture/Jam.png",
        "Processing27": "assets/Picture/Cheese.png",
        "Processing28": "assets/Picture/Bacon.png",
        "Processing31": "assets/Picture/Sausage.png",
        // 添加其他食材的图像映射
    };

    // processingKey 映射为中文
    const processingKeyChineseMap = {
        "Processing11": "面粉",
        "Processing12": "兽肉",
        "Processing13": "鱼",
        "Processing14": "神秘的肉",
        "Processing15": "黑麦粉",
        "Processing16": "奶油",
        "Processing17": "熏禽肉",
        "Processing18": "黄油",
        "Processing21": "火腿",
        "Processing22": "糖",
        "Processing23": "香辛料",
        "Processing24": "酸奶油",
        "Processing25": "蟹黄",
        "Processing26": "果酱",
        "Processing27": "奶酪",
        "Processing28": "培根",
        "Processing31": "香肠"
        // 添加其他加工设置的中文映射
    };

    // 解析 加工数量PrepCount 的值，逗号分隔的数字序列
    const PrepCountArray = (settings.PrepCount || "")
        .split(",")
        .filter(Boolean) // 过滤掉空字符串
        .map((num) => Math.max(0, Number(num) || 0)); // 转换为非负整数数组

    // 提取所有 ProcessingXX 的键名，并过滤出值为 true 的项
    const enabledProcessingKeys = Object.keys(settings)
        .filter(key => key.startsWith("Processing"))
        .filter(key => settings[key]); // 确保值为 true

    // log.info(`启用的加工项: ${enabledProcessingKeys.join(", ")}`);

    // 将 enabledProcessingKeys 映射为中文描述
    const enabledProcessingKeysChinese = enabledProcessingKeys.map(key => processingKeyChineseMap[key] || "未知食材");

    log.info(`启用的加工项: ${enabledProcessingKeysChinese.join(", ")}`);

    if (enabledProcessingKeys.length === 0) {
        log.error("未找到启用的 Processing 设置");
        // 如果没有启用的 Processing 设置，假设所有 Processing 设置都为 true
        for (let i = 1; i <= 4; i++) {
            for (let j = 1; j <= 8; j++) {
                const processingKey = `Processing${i}${j}`;
                settings[processingKey] = false; // 如果没有启用的 ProcessingXX，则设置所有 ProcessingXX都为 false
                // enabledProcessingKeys.push(processingKey);// 如果没有启用的 ProcessingXX，则所有 ProcessingXX都为 true
            }
        }
    }

    // 行列数的排列组合
    const rows = [1, 2, 3];// [1, 2, 3, 4];三、四行 暂时用不上
    const cols = [1, 2, 3, 4, 5, 6, 7, 8];
    const gridCoordinates = [];

    // 计算每个行列组合的坐标
    for (const row of rows) {
        for (const col of cols) {
            const ProcessingX = Math.round(178.5 + (col - 1) * 146);
            const ProcessingY = Math.round(182.5 + (row - 1) * 175);
            gridCoordinates.push({ row, col, x: ProcessingX, y: ProcessingY });
        }
    }

    // log.info(`生成的搜索区域坐标: ${JSON.stringify(gridCoordinates)}`);

    // 图像识别函数
    function recognizeImage(imagePath, x, y, searchWidth, searchHeight) {
        try {
            let template = file.ReadImageMatSync(imagePath);
            let recognitionObject = RecognitionObject.TemplateMatch(template, x, y, searchWidth, searchHeight);
            // 设置识别阈值和通道
            recognitionObject.threshold = 0.9; // 设置识别阈值为 0.9
            recognitionObject.Use3Channels = true; // 使用三通道匹配

            ra = captureGameRegion();
            let result = ra.find(recognitionObject);
            ra.dispose();
            return result.isExist() ? result : null;
        } catch (error) {
            log.error(`图像识别失败，路径: ${imagePath}, 错误: ${error.message}`);
            return null;
        }
    }

    // 执行额外的点击操作
    async function performExtraClicks(processingKey) {
        if (processingKey === "Processing13") {
            log.info("为 Processing13 执行额外的点击操作");
            click(1715, 565); await sleep(1000); // 打开素材列表
            click(220, 295); await sleep(1000);   // 非红色花鳉一般位于第一行，默认选择第二行
            click(1005, 45); await sleep(500)
            click(1005, 45);  // 点击菜单防止其他页面干扰
        }
    }

    // 执行 PrepCount 操作
    async function performPrepCountActions(PrepCount) {
        log.info(`加工数量: ${PrepCount}`);
        if (PrepCount < 99) {
            click(965, 455); // 输入数量
            await sleep(1000);

            // 逐个字符输入 PrepCount
            const PrepCountStr = String(PrepCount);
            for (const char of PrepCountStr) {
                keyPress(char);
                await sleep(500);
            }
        } else if (PrepCount === 99) {
            click(1195, 590); await sleep(1000);
        }

        click(1315, 755); await sleep(2000); // 点击确认
    }

    /**烹饪区**/
    // 检查 CookingTimes 是否为正整数
    const CookingTimes = Math.max(0, Number(settings.CookingTimes) || 0);
    const Cooking = settings.Cooking
    const rightOffset = 0; // 右偏移
    const downOffset = 0; // 下偏移

    if (CookingTimes > 0 && Number.isInteger(CookingTimes)) {
        CookingClickX = 910; // 设置 CookingClickX
        log.info("烹饪次数为正整数，有效");
    } else {
        log.info("烹饪次数不对，跳过烹饪操作。");
    }

    // 烹饪操作函数
    async function performCookingOperations(CookingClickX, CookingClickY, rightOffset, downOffset, CookingTimes) {
        log.info("执行烹饪操作...");
        click(CookingClickX, CookingClickY);
        await sleep(500);
        click(CookingClickX, CookingClickY); // 点击菜单
        await sleep(500);

        click(145, 1015); // 点击筛选
        await sleep(500);
        click(79, 1020); // 重置输入框
        await sleep(500);
        click(160, 115); // 点击输入框
        await sleep(500);
        inputText(`${Cooking}`); // 输入 Cooking 的值
        await sleep(500);
        click(375, 1020); // 确认筛选
        await sleep(500);

        // 点击动态坐标
        const rightClickX = Math.round(178.5 + rightOffset * 147);
        const downClickY = Math.round(197 + downOffset * 176);
        click(rightClickX, downClickY); // 点击选中物品的坐标
        await sleep(1000);

        click(1600, 1020); await sleep(3000);
        click(635, 1015); await sleep(1000);

        if (CookingTimes < 99) {
            click(965, 455); // 输入数量
            await sleep(1000);

            // 逐个字符输入 CookingTimes
            const CookingTimesStr = String(CookingTimes);
            for (const char of CookingTimesStr) {
                keyPress(char);
                await sleep(500);
            }
        } else if (CookingTimes === 99) {
            click(1190, 590); await sleep(1000);
        }

        click(1315, 755); await sleep(3000); // 点击自动烹饪
        click(960, 905); await sleep(2000);  // 点击确认
        click(1845, 45); await sleep(200);   // 退出烹饪界面
    }

    /**
        F交互区
    **/
    // 定义一个函数用于模拟按键操作
    async function simulateKeyOperations(key, duration) {
        keyDown(key);
        await sleep(duration);
        keyUp(key);
        await sleep(500); // 释放按键后等待 500 毫秒
    }

    // 识别 F 图标
    async function recognizeFIcon() {
        const fDialogueRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync("assets/F_Dialogue.png"),
            1101,
            400,
            36,
            400
        );

        ra = captureGameRegion();
        let fRes = ra.find(fDialogueRo);
        ra.dispose();

        if (!fRes.isExist()) {
            let f_attempts = 0; // 初始化尝试次数
            while (f_attempts < 3) { // 最多尝试 3 次
                f_attempts++;
                log.info(`当前尝试次数：${f_attempts}`);

                if (f_attempts === 1 || f_attempts === 2) {
                    // 第一次未找到 F 图标
                    await simulateKeyOperations("S", 200); // 后退 200 毫秒
                    log.info("执行后退操作");
                    await sleep(200);
                    await simulateKeyOperations("W", 600); // 前进 600 毫秒
                    log.info("执行前进操作");
                } else if (f_attempts === 3) {
                    // 第二次未找到 F 图标
                    log.info("重新加载路径文件");
                    const filePath = `assets/璃月杂货商东升旁灶台.json`;
                    log.info(`加载路径文件：${filePath}`);
                    await pathingScript.runFile(filePath);
                    await sleep(500);
                }

                // 重新获取游戏区域截图
                ra = captureGameRegion();
                fRes = ra.find(fDialogueRo);
                ra.dispose();

                // 打印识别结果
                log.info(`识别结果：${fRes.isExist()}`);

                // 如果识别成功，立即退出循环
                if (fRes.isExist()) {
                    log.info("识别成功，退出循环");
                    break;
                }

                await sleep(500);
            }
        }

        // 如果尝试次数已达上限，返回 null
        if (!fRes.isExist()) {
            log.error("尝试次数已达上限");
            return null;
        }

        return fRes;
    }

    // 识别 Cooking 图标
    async function recognizeCookingIcon(centerYF) {
        const cookingRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync("assets/Cooking.png"),
            1176,
            centerYF - 18, // 以 F 图标的中心，向上偏移 18 像素
            27,           // 宽度范围
            36            // 高度范围
        );

        ra = captureGameRegion();
        let cookingRes = ra.find(cookingRo);
        ra.dispose();

        if (cookingRes.isExist()) {
            log.info("找到 灶台 图标");
            return cookingRes;
        } else {
            log.info("未找到 灶台 图标");
            return null;
        }
    }

    // 主逻辑函数
    async function main() {
        // 识别 F 图标
        let fRes = await recognizeFIcon();
        if (!fRes) {
            log.error("未能识别 F 图标，退出任务");
            return;
        }

        // 获取 F 图标的中心点 Y 坐标
        let centerYF = Math.round(fRes.y + fRes.height / 2);

        const maxScrollAttempts = 5; // 最大滚轮操作次数限制
        let scrollAttempts = 0;

        while (scrollAttempts < maxScrollAttempts) {
            // 识别 灶台 图标
            let cookingRes = await recognizeCookingIcon(centerYF);
            if (cookingRes) {
                // log.info("找到 灶台 图标");
                return cookingRes; // 识别成功，返回结果
            }

            // 如果未找到 Cooking 图标，执行滚轮操作
            log.info(`未找到 Cooking 图标，执行滚轮操作，当前尝试次数：${scrollAttempts + 1}`);
            await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            await sleep(1000);

            // 重新识别 F 图标，获取最新的中心点
            fRes = await recognizeFIcon();
            if (!fRes) {
                log.error("滚轮操作后，未能重新识别 F 图标，退出任务");
                return;
            }

            centerYF = Math.round(fRes.y + fRes.height / 2); // 更新 F 图标的中心点 Y 坐标

            // 增加尝试次数
            scrollAttempts++;
        }

        // 如果超过最大滚轮操作次数，返回 null
        log.error(`滚轮操作次数已达上限 ${maxScrollAttempts} 次，未能找到 Cooking 图标`);
        return null;
    }

    // 自动寻路并执行按键操作
    async function AutoPath() {
        log.info("开始执行自动寻路任务");

        // 定义路径文件路径
        const filePath = `assets/璃月杂货商东升旁灶台.json`;
        log.info(`加载路径文件：${filePath}`);

        try {
            // 执行路径文件
            await pathingScript.runFile(filePath);
            log.info("路径文件执行完成");
        } catch (error) {
            log.error(`执行路径文件时发生错误：${error.message}`);
            return; // 如果路径文件执行失败，直接返回
        }

        // 等待1秒后执行按键操作
        log.info("等待1秒后执行按键操作...");
        await sleep(1000);

        try {
            // 识别 Cooking 图标
            const cookingRes = await main();
            if (!cookingRes) {
                log.error("未能识别 灶台 图标，退出任务");
                return;
            }

            // 按下 F 键
            keyPress("F");
            await sleep(1000);

            // 加工菜单
            click(1005, 45);
            await sleep(1000);
            click(150, 1020); await sleep(500);
            click(150, 1020); await sleep(500);

            // 如果 PrepCountArray 和 enabledProcessingKeys 的长度不匹配，使用第一个 PrepCount 值
            const minLen = Math.min(PrepCountArray.length, enabledProcessingKeys.length);
            const defaultPrepCount = PrepCountArray[0] || 99; // 默认值为第一个 PrepCount 或 99

            // 遍历启用的 Processing 设置，进行图像识别
            for (const processingKey of enabledProcessingKeys) {
                // 获取 processingKey 的中文描述
                const chineseDescription = processingKeyChineseMap[processingKey] || "未知食材";

                const imagePath = ingredientImageMap[processingKey];
                if (!imagePath) {
                    log.error(`未找到食材图像路径: ${chineseDescription}`);
                    continue;
                }

                // log.info(`开始识别食材: ${chineseDescription}, 图像路径: ${imagePath}`);
                log.info(`开始识别食材: ${chineseDescription}`);

                // 左上角的偏移量
                const scanOffset = { x: -35, y: -35 };

                let foundIngredient = false;
                for (const coordinate of gridCoordinates) {
                    const scanX = coordinate.x + scanOffset.x; // 左上角的 X 坐标
                    const scanY = coordinate.y + scanOffset.y; // 左上角的 Y 坐标

                    const imageResult = recognizeImage(imagePath, scanX, scanY, 70, 70);
                    if (imageResult) {
                        // log.info(`通过图像识别找到食材: ${chineseDescription} 在坐标 X=${scanX}, Y=${scanY}`);
                        log.info(`通过图像识别找到食材: ${chineseDescription}`);
                        imageResult.click();
                        await sleep(1000); // 等待1秒以确保点击生效
                        imageResult.click(); // 重复点击，防止上一个食材加工满了的横幅导致没点击成功
                        await sleep(1000);
                        foundIngredient = true;

                        break; // 找到食材后跳出循环
                    }
                }
                if (!foundIngredient) {
                    // 图像识别未成功，可能是因为该食材正在被加工，通过OCR识别
                    ra = captureGameRegion();
                    const ocrResult = ra.findMulti(RecognitionObject.ocr(117, 196, 1148, 502));
                    ra.dispose();
                    for (var i = 0; i < ocrResult.count; ++i) {
                        if (ocrResult[i].text.endsWith("分钟") || ocrResult[i].text.endsWith("秒")) {
                            // 选中该食材
                            click(ocrResult[i].x, ocrResult[i].y);
                            await sleep(500);
                            // OCR食材名称
                            ra = captureGameRegion();
                            const ocrResult2 = ra.findMulti(RecognitionObject.ocr(1332, 130, 137, 34));
                            ra.dispose();
                            const ingredientName = ocrResult2.count > 0 ? ocrResult2[0].text : null;
                            if (ingredientName === chineseDescription) {
                                log.info(`通过OCR识别找到食材: ${chineseDescription}`);
                                foundIngredient = true;
                                break;
                            }
                        }
                    }
                }

                if (foundIngredient) {
                    // 执行额外的点击操作（如果需要）
                    await performExtraClicks(processingKey);

                    // 点击确认按钮
                    click(1600, 1020); await sleep(2000);

                    // 执行 PrepCount 操作
                    const PrepCount = PrepCountArray.length > 0 ? PrepCountArray.shift() : defaultPrepCount;
                    if (PrepCount > 0) {
                        await performPrepCountActions(PrepCount);
                    }
                } else {
                    log.error(`未能识别到食材: ${chineseDescription}`);
                }
            }
            // 如果 CookingClickX 被设置，执行烹饪操作
            if (CookingClickX === 910) {
                await performCookingOperations(CookingClickX, CookingClickY, rightOffset, downOffset, CookingTimes);
            }
            await genshin.returnMainUi();
            keyDown("S"); await sleep(1000);
            keyUp("S"); await sleep(1000);
        } catch (error) {
            log.error(`执行按键或鼠标操作时发生错误：${error.message}`);
        }
    }

    let ra = null
    // 调用 AutoPath 函数
    await AutoPath();
})();

