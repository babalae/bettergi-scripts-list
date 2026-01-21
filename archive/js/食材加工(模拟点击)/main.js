(async function () {
    notification.send("烹饪脚本开始");
    setGameMetrics(1920, 1080, 1.25); // 设置编写脚本环境的游戏分辨率和DPI缩放
    await genshin.returnMainUi(); // 返回主界面

    let foodName = settings.foodName ?? 0;
    let foodNum = settings.foodNum ?? 0;
    let flour = settings.flour ?? false;


    let rawmeat = settings.rawmeat ?? false;
    let fish = settings.fish ?? false;
    let mysteriousmeat = settings.mysteriousmeat ?? false;

    let ryeflour = settings.ryeflour ?? false;

    let cream = settings.cream ?? false;
    let smokedPoultry = settings.smokedPoultry ?? false;
    let butter = settings.butter ?? false;
    let ham = settings.ham ?? false;
    let sugar = settings.sugar ?? false;
    let spice = settings.spice ?? false;
    let smetana = settings.smetana ?? false;

    let crabRoe = settings.crabRoe ?? false;
    let jam = settings.jam ?? false;
    let cheese = settings.cheese ?? false;
    let bacon = settings.bacon ?? false;
    let sausage = settings.sausage ?? false;

    // 优化后的食材列表，顺序即加工顺序
    const ingredientList = [
        { key: "面粉", value: flour },

        { key: "兽肉", value: rawmeat },
        { key: "鱼肉", value: fish },
        { key: "神秘肉", value: mysteriousmeat },

        { key: "黑麦粉", value: ryeflour },

        { key: "奶油", value: cream },
        { key: "熏禽肉", value: smokedPoultry },
        { key: "黄油", value: butter },
        { key: "火腿", value: ham },
        { key: "糖", value: sugar },
        { key: "香辛料", value: spice },
        { key: "酸奶油", value: smetana },

        { key: "蟹黄", value: crabRoe },
        { key: "果酱", value: jam },
        { key: "奶酪", value: cheese },
        { key: "培根", value: bacon },
        { key: "香肠", value: sausage },
    ];


    // 判断是否有食材参数
    const allEmpty = ingredientList.every(item => !item.value);
    if (!foodName && !foodNum && allEmpty) {
        notification.send("未设置烹饪参数，跳过烹饪操作");
        await genshin.returnMainUi();
        return;
    }

    await sleep(1000);
    await pathingScript.runFile("assets/璃月杂货商东升旁灶台.json");

    // 行列均从 0 开始计数
    function getItemPosition(row, col) {
        const startX = 115;
        const startY = 120;
        const itemWidth = 124;
        const itemHeight = 152;
        const colGap = 22;
        const rowGap = 22;

        const x = startX + col * (itemWidth + colGap) + itemWidth / 2;
        const y = startY + row * (itemHeight + rowGap) + itemHeight / 2;
        //const x = startX + col * (itemWidth / 2 + (colGap - 22));
        //const y = startY + row * (itemHeight / 2 + (rowGap - 22));

        return { x, y };
    }
    // 自动分配行列坐标
    const maxCols = 8;
    const ingredientCoordinates = ingredientList.map((item, idx) => {
        const row = Math.floor(idx / maxCols);
        const col = idx % maxCols;
        const { x, y } = getItemPosition(row, col);
        return { ...item, x, y, row, col };
    });
    // 通用：处理食材制作步骤
    async function processIngredient(quantity, row, col, key) {
        const { x, y } = getItemPosition(row, col);
        if (quantity) {
            log.info(`开始加工：${key}`);
            click(x, y);
            await sleep(500);

            click(1690, 1015); // 制作
            await sleep(500);
            // 输入数量
            //click(965, 455); 
            //await sleep(1000);
            //await inputText(quantity);
            //拉满
            click(1190, 590);
            await sleep(500);

            click(1190, 755); // 确认
            await sleep(500);
        }
    };
    // 通用：模拟输入文本
    async function inputText(text) {
        for (const char of text) {
            keyPress(char);
            await sleep(500);
        }
    };


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

        let ra = captureGameRegion();
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

        let ra = captureGameRegion();
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
            await sleep(800);

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


    try {
        // 识别 Cooking 图标
        const cookingRes = await main();
        if (!cookingRes) {
            log.error("未能识别 灶台 图标，退出任务");
            return;
        }

        keyPress("F");
        await sleep(1000);



        //食材加工

        click(1010, 50); //选择食材加工
        await sleep(500);
        click(255, 1020); //全部领取
        await sleep(500);
        click(960, 1045); //点击任意处
        await sleep(500);
        click(960, 1045); //点击任意处
        await sleep(500);
        click(960, 1045); //点击任意处
        await sleep(800);

        // 按行列处理所有食材
        for (const ingredient of ingredientCoordinates) {
            if (ingredient.value) {
                await processIngredient(ingredient.value, ingredient.row, ingredient.col, ingredient.key);
            }
        }

        await genshin.returnMainUi();
        await sleep(800);
        keyDown("S");
        await sleep(1000);
        keyUp("S");
        await sleep(800);
    } catch (error) {
        log.error(`执行按键或鼠标操作时发生错误：${error.message}`);
    }

    notification.send("烹饪脚本结束");
})();
