//锻造按钮模板
const ConfirmDeployButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Confirm Deploy Button.png"), 0, 870, 1920, 210);
const ForgingInterfaceRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ForgingInterface.png"), 0, 0, 140, 100);
const ForgeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Forge.png"), 1260, 300, 600, 600);



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
    let secondaryOre = settings.secondaryOre || "萃凝晶";
    let tertiaryOre = settings.tertiaryOre || "紫晶块";

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
    const rows = [1, 2, 3, 4]; // 行数
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


        // 最大尝试次数
        const maxAttempts = 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let found = false;
            for (const coordinate of gridCoordinates) {
                const scanX = coordinate.x + scanOffset.x;
                const scanY = coordinate.y + scanOffset.y;
                const imageResult = recognizeImage(imagePath, scanX, scanY, 70, 70);

                if (imageResult) {
                    found = true;
                    imageResult.click();
                    await sleep(1000);

                    if (notice) {
                        notification.send(`通过图像识别找到矿石: ${OreChineseMap[oreType]}`);
                    }
                    determineOre(oreType);

                    // 点击“开始锻造”按钮3次，每次点击后进行OCR识别提示
                    const ocrRegion = { x: 660, y: 495, width: 1250 - 660, height: 550 - 495 };

                    // 内部点击循环——点击“开始锻造”按钮后，进行OCR识别
                    let clickAttempts = 0;
                    let forgingTriggered = false;

                    while (clickAttempts < 3 && !forgingTriggered) {
                        // 点击“开始锻造”
                        let ConfirmButton = captureGameRegion().find(ConfirmDeployButtonRo);
                        if (ConfirmButton.isExist()) {
                            //log.info("识别到确定按钮:({x},{y},{w},{h})", ConfirmButton.x, ConfirmButton.y, ConfirmButton.Width, ConfirmButton.Height);
                            ConfirmButton.click();
                        } else {
                            //log.warn("未能识别到确定按钮");
                        }
                        await sleep(1500); // 等待提示出现

                        // 执行OCR识别提示区域内的文字
                        let ocrResults = captureGameRegion().find(
                            RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
                        );

                        if (ocrResults) {
                            log.info(`${ocrResults.text}`);
                            if (ocrResults.text.includes("今日已无法锻造")) {
                                if (notice) {
                                    notification.send("检测到 今日已无法锻造 停止脚本");
                                } else {
                                    log.info("检测到 今日已无法锻造 停止脚本");
                                }
                                return true; // 完全终止锻造流程
                            } else if (ocrResults.text.includes("材料不足")) {
                                if (notice) {
                                    notification.send("检测到 材料不足 跳过当前矿物。请检查背包，及时补充矿物。");
                                } else {
                                    log.info("检测到 材料不足 跳过当前矿物。请检查背包，及时补充矿物。");
                                }
                                await click(960, 800); // 点击确定关闭提示
                                await sleep(1000);
                                return false; // 直接返回，跳过识别当前矿物
                            } else {
                                // 如果OCR识别结果没有检测到错误提示，则认为本次锻造指令有效
                                forgingTriggered = true;
                            }
                        } else {
                            //log.warn("未能识别到任何文字");
                        }
                        clickAttempts++;
                    }
                }
            }
            // 如果本次尝试未识别到矿石，则等待后重试
            if (!found) {
                if (notice) {
                    //notification.error(`未能识别到矿石: ${OreChineseMap[oreType]}，重试中... (${attempt + 1}/${maxAttempts})`);
                }
                log.error(`未能识别到矿石: ${OreChineseMap[oreType]}，重试中... (${attempt + 1}/${maxAttempts})`);

                await sleep(1000);
            }
        }
        if (notice) {
            notification.error(`未能识别到矿石: ${OreChineseMap[oreType]}，停止尝试`);
        } else {
            log.error(`未能识别到矿石: ${OreChineseMap[oreType]}，停止尝试`);
        }
        return false;
    }

    // 锻造矿石操作
    const forgeOre = async function (smithyName) {
        // 对话部分（如果需要可打开注释）
        await sleep(1000); keyPress("F");
        await sleep(1000); await click(960, 1042);
        await sleep(1000); await click(960, 1042);
        let Forge = captureGameRegion().find(ForgeRo);
        if (Forge.isExist()) {
            //log.info("识别到锻造图标:({x},{y},{w},{h})", Forge.x, Forge.y, Forge.Width, Forge.Height);
            await Forge.click();
        } else {
            log.warn("未能识别到锻造图标");
        }
        await sleep(1000); await click(960, 1042);

        await sleep(1000); await click(960, 1042);

        //检测到锻造界面
        for (let i = 0; i < 3; i++) {
            let ForgingInterface = captureGameRegion().find(ForgingInterfaceRo);
            if (ForgingInterface.isExist()) {
                log.info("已进入锻造界面，准备锻造");
                break;
            } else {
                await sleep(1000);
            }
        }

        // 锻造领取（如果需要可打开注释）
        //领取全部
        const ClaimAllRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/全部领取.png"), 0, 900, 1920, 180);
        let ClaimAll = captureGameRegion().find(ClaimAllRo);
        if (ClaimAll.isExist()) {
            //log.info("识别到全部领取按钮:({x},{y},{w},{h})", ClaimAll.x, ClaimAll.y, ClaimAll.Width, ClaimAll.Height);
            ClaimAll.click();
            await sleep(1000); // 等待提示出现

            //确认领取
            let ConfirmButton = captureGameRegion().find(ConfirmDeployButtonRo);
            if (ConfirmButton.isExist()) {
                //log.info("识别到确定按钮:({x},{y},{w},{h})", ConfirmButton.x, ConfirmButton.y, ConfirmButton.Width, ConfirmButton.Height);
                ConfirmButton.click();
            } else {
                //log.warn("未能识别到确定按钮");
            }

        } else {
            //log.warn("未能识别到全部领取按钮");
        }

        click(220, 150); await sleep(1000);

        let forgeSuccess = false;
        // 尝试主选矿石 
        if (await tryForgeOre(primaryOre, [])) {
            forgeSuccess = true;
        }
        // 如果主选识别失败，尝试备选矿石2
        else if (await tryForgeOre(secondaryOre, [primaryOre])) {
            forgeSuccess = true;
        }
        // 如果备选矿石2也失败，尝试备选矿石3
        else if (await tryForgeOre(tertiaryOre, [primaryOre, secondaryOre])) {
            forgeSuccess = true;
        }
        // 所有备选矿石都未能识别，结束锻造
        else {
            if (notice) {
                notification.error("所有备选矿石都未能识别，结束锻造");
            } else {
                log.error("所有备选矿石都未能识别，结束锻造");
            }
        }

        // 退出锻造界面（如果需要可打开注释）
        await click(520, 140); await sleep(1000);
        if (notice) {
            notification.send("锻造结束，退出界面");
        } else {
            log.info("锻造结束，退出界面");
        }
        await genshin.returnMainUi();
    };

    // 执行步骤
    await autoSmithy(smithyName);
    await forgeOre(smithyName);
    await genshin.returnMainUi();
    { keyDown("S"); await sleep(1000); keyUp("S"); await sleep(1000); }

    if (notice) {
        notification.send("自动锻造矿石脚本结束");
    }
})();