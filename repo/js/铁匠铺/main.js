(async function () {
    // 设置通知状态
    let notice = settings.notice ?? false;

    // 设置游戏基础参数/初始化
    setGameMetrics(1920, 1080, 1.25);
    await genshin.returnMainUi();
    if (notice) {
        notification.send("自动锻造矿石脚本开始");
    }

    // 读取用户配置
    let smithyName = settings.smithyName || "枫丹铁匠铺";
    let primaryOre = settings.ore || "水晶块";
    let secondaryOre = settings.secondaryOre || "萃凝晶";  // 新增备选矿物2
    let tertiaryOre = settings.tertiaryOre || "紫晶块";    // 新增备选矿物3

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
    };

    // 行列数的排列组合
    const rows = [1, 2, 3]; // 行数
    const cols = [1, 2, 3, 4, 5]; // 列数

    const gridCoordinates = [];

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
            let recognitionObject = RecognitionObject.TemplateMatch(template, x, y, searchWidth, searchHeight);
            recognitionObject.threshold = 0.85;
            recognitionObject.Use3Channels = true;
            let result = captureGameRegion().find(recognitionObject);
            return result.isExist() ? result : null;
        } catch (error) {
            if (notice) {
                notification.error(`图像识别失败，路径: ${imagePath}, 错误: ${error.message}`);
            } else {
                log.error(`图像识别失败，路径: ${imagePath}, 错误: ${error.message}`);
            }
            return null;
        }
    }

    // 自动前往铁匠铺
    async function autoSmithy(smithyName) {
        log.info(`自动前往 ${smithyName}`);
        try {
            let filePath = `assets/Pathing/${smithyName}.json`;
            await pathingScript.runFile(filePath);
            if (notice) {
                notification.send(`已抵达 ${smithyName}`);
            } else {
                log.info(`已抵达 ${smithyName}`);
            }
        } catch (error) {
            if (notice) {
                notification.error(`执行 ${smithyName} 路径时发生错误: ${error.toString()}`);
            } else {
                log.error(`执行 ${smithyName} 路径时发生错误: ${error.toString()}`);
            }
        }
    }

    // 确认使用矿石
    function determineOre(oreType) {
        let message = `将使用 ${OreChineseMap[oreType]} 锻造矿石`;
        log.info(message);
        return message;
    }

    // 检查是否需要跳过备选矿物
    function shouldSkipOre(targetOre, compareOres) {
        return compareOres.includes(targetOre);
    }

    // 尝试识别并锻造矿石
    async function tryForgeOre(oreType, skipCheckOres = []) {
        if (shouldSkipOre(oreType, skipCheckOres)) {
            if (notice) {
                notification.send(`跳过 ${OreChineseMap[oreType]}，因为已存在于优先选择中`);
            }
            return false;
        }

        const imagePath = ingredientImageMap[oreType];
        if (!imagePath) {
            if (notice) {
                notification.error(`未找到矿石图像路径: ${OreChineseMap[oreType]}`);
            } else {
                log.error(`未找到矿石图像路径: ${OreChineseMap[oreType]}`);
            }
            return false;
        }

        log.info(`开始识别矿石: ${OreChineseMap[oreType]}`);
        const scanOffset = { x: -35, y: -35 };

        for (const coordinate of gridCoordinates) {
            const scanX = coordinate.x + scanOffset.x;
            const scanY = coordinate.y + scanOffset.y;
            const imageResult = recognizeImage(imagePath, scanX, scanY, 70, 70);

            if (imageResult) {
                imageResult.click();
                await sleep(2000);
                if (notice) {
                    notification.send(`通过图像识别找到矿石: ${OreChineseMap[oreType]}`);
                } else {
                    log.info(`通过图像识别找到矿石: ${OreChineseMap[oreType]}`);
                }

                determineOre(oreType);
                // 点击"开始锻造"3次
                for (let i = 0; i < 3; i++) {
                    await sleep(1000);
                    click(1645, 1015);
                }
                return true;
            }
        }

        if (notice) {
            notification.error(`未能识别到矿石: ${OreChineseMap[oreType]}`);
        } else {
            log.error(`未能识别到矿石: ${OreChineseMap[oreType]}`);
        }
        return false;
    }

    // 锻造矿石操作
    const forgeOre = async function (smithyName) {
        // 对话
        await sleep(1000); keyPress("F");
        await sleep(1000); await click(960, 600);
        await sleep(1000); await click(960, 600);
        await sleep(1000); await click(1375, 500);
        await sleep(1000); await click(960, 600); await sleep(1000);
        await click(960, 600); await sleep(1000);

        log.info("已进入锻造界面，准备锻造");
        // 锻造领取
        await click(520, 140); await sleep(1000);
        await click(170, 1010); await sleep(1000);
        await click(960, 900); await sleep(1000);
        click(220, 150); await sleep(1000);

        // 按优先级尝试识别矿石
        let forgeSuccess = false;

        // 尝试主选矿石
        if (!forgeSuccess) {
            forgeSuccess = await tryForgeOre(primaryOre, []);
        }

        // 如果主选矿石识别失败，尝试备选矿石2（跳过与主选相同的）
        if (!forgeSuccess) {
            forgeSuccess = await tryForgeOre(secondaryOre, [primaryOre]);
        }

        // 如果备选矿石2也识别失败，尝试备选矿石3（跳过与主选和备选2相同的）
        if (!forgeSuccess) {
            forgeSuccess = await tryForgeOre(tertiaryOre, [primaryOre, secondaryOre]);
        }

        // 如果所有矿石都识别失败
        if (!forgeSuccess) {
            if (notice) {
                notification.error("所有备选矿石都未能识别，结束锻造");
            } else {
                log.error("所有备选矿石都未能识别，结束锻造");
            }
        }

        // 退出锻造界面
        await click(520, 140); await sleep(1000);
        if (notice) {
            notification.send("锻造结束，退出界面");
        } else {
            log.info("锻造结束，退出界面");
        }
        await genshin.returnMainUi();
    };

    await autoSmithy(smithyName);
    await forgeOre(smithyName);
    await genshin.returnMainUi();
    { keyDown("S"); await sleep(1000); keyUp("S"); await sleep(1000); }

    if (notice) {
        notification.send("自动锻造矿石脚本结束");
    }
})();
