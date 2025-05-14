(async function () {
    // 设置游戏基础参数
    setGameMetrics(1920, 1080, 1.25); // 设置编写脚本环境的游戏分辨率和DPI缩放
    await genshin.returnMainUi(); // 返回主界面

    ///
    // 读取用户配置
    ///
    let smithyName = settings.smithyName || "枫丹铁匠铺";
    let ore = settings.ore || "水晶块";

    // 定义矿物名称和图片文件名的映射表
    const ingredientImageMap = {
        萃凝晶: "assets/Picture/CondessenceCrystal.png",
        紫晶块: "assets/Picture/AmethystLump.png",
        水晶块: "assets/Picture/CrystalChunk.png",
        星银矿石: "assets/Picture/Starsilver.png",
        白铁块: "assets/Picture/WhiteIronChunk.png",
        铁块: "assets/Picture/IronChunk.png",
    };

    // Ore 映射为中文
    const OreChineseMap = {
        萃凝晶: "萃凝晶",
        紫晶块: "紫晶块",
        水晶块: "水晶块",
        星银矿石: "星银矿石",
        白铁块: "白铁块",
        铁块: "铁块",
        // 添加其他加工设置的中文映射
    };

    // 获取中文描述和图像路径
    const processingKey = settings.ore || "水晶块";
    const chineseDescription = OreChineseMap[processingKey];
    const imagePath = ingredientImageMap[processingKey];

    // 行列数的排列组合
    const rows = [1, 2, 3]; // 行数
    const cols = [1, 2, 3, 4, 5]; // 列数
    const gridCoordinates = [];

    // 计算每个行列组合的坐标
    for (const row of rows) {
        for (const col of cols) {
            const ProcessingX = Math.round(150 + (col - 1) * 145);
            const ProcessingY = Math.round(230 + (row - 1) * 170);
            gridCoordinates.push({ row, col, x: ProcessingX, y: ProcessingY });
        }
    }

    // 图像识别函数
    function recognizeImage(imagePath, x, y, searchWidth, searchHeight) {
        try {
            let template = file.ReadImageMatSync(imagePath);
            let recognitionObject = RecognitionObject.TemplateMatch(
                template,
                x,
                y,
                searchWidth,
                searchHeight
            );

            // 设置识别阈值和通道
            recognitionObject.threshold = 0.9; // 设置识别阈值
            recognitionObject.Use3Channels = true; // 使用三通道匹配

            let result = captureGameRegion().find(recognitionObject);
            return result.isExist() ? result : null;
        } catch (error) {
            log.error(
                `图像识别失败，路径: ${imagePath}, 错误: ${error.message}`
            );
            return null;
        }
    }

    // 自动前往铁匠铺
    async function autoSmithy(smithyName) {
        log.info(`自动前往 ${smithyName}`);
        try {
            let filePath = `assets/Pathing/${smithyName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${smithyName} 路径时发生错误`);
            log.error(error.toString());
        }
    }

    // 确认使用矿石
    function determineOre() {
        if (ore == "水晶块") {
            log.info("将使用 水晶块 锻造矿石");
        } else if (ore == "紫晶块") {
            log.info("将使用 紫晶块 锻造矿石");
        } else if (ore == "萃凝晶") {
            log.info("将使用 萃凝晶 锻造矿石");
        } else {
            log.info("无指定矿石,将使用 水晶块 锻造矿石");
        }
    }

    // 锻造矿石操作
    const forgeOre = async function (smithyName) {
        await sleep(1000);
        keyPress("F");
        await sleep(1000); // 开始交互
        await click(960, 600);
        await sleep(1000); // 跳过第一个对话
        await click(960, 600);
        await sleep(1000); // 跳过第一个对话
        await click(1375, 500);
        await sleep(1000);
        await click(960, 600);
        await sleep(1000); // 跳过第二个对话
        await click(960, 600);
        await sleep(1000); // 跳过第二个对话

        log.info("已进入锻造界面，准备锻造");
        // 锻造领取
        await click(520, 140);
        await sleep(1000); // 选择锻造队列
        await click(170, 1010);
        await sleep(1000); // 领取全部
        await click(960, 900);
        await sleep(1000); // 确认

        click(220, 150);
        await sleep(1000); // 点击"配方"
        determineOre();

        // 根据用户选择的矿石进行锻造
        if (!imagePath) {
            log.error(`未找到矿石图像路径: ${chineseDescription}`);
        } else {
            log.info(`开始识别矿石: ${chineseDescription}`);

            // 左上角的偏移量
            const scanOffset = { x: -35, y: -35 };
            let foundIngredient = false;
            for (const coordinate of gridCoordinates) {
                const scanX = coordinate.x + scanOffset.x;
                const scanY = coordinate.y + scanOffset.y;

                const imageResult = recognizeImage(
                    imagePath,
                    scanX,
                    scanY,
                    70,
                    70
                );
                if (imageResult) {
                    log.info(`通过图像识别找到矿石: ${chineseDescription}`);
                    imageResult.click();
                    await sleep(2000); // 等待点击生效
                    foundIngredient = true;

                    // 点击“开始锻造”3次
                    click(1645, 1015);
                    await sleep(1500);
                    click(1645, 1015);
                    await sleep(1500);
                    click(1645, 1015);
                    await sleep(1500);
                    break; // 找到矿石后退出循环
                }
            }
            if (!foundIngredient) {
                log.error(`未能识别到矿石: ${chineseDescription}`);
            }
        }

        // 退出锻造界面
        log.info("锻造结束，退出界面");
        keyPress("ESCAPE");
    };
    await autoSmithy(smithyName); //寻路函数
    await forgeOre(smithyName);

    await genshin.returnMainUi(); // 返回主界面
    keyDown("S");
    await sleep(1000);
    keyUp("S");
    await sleep(1000);
})();
