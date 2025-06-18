/*********************** 配置与常量 ***********************/

// 用户配置
let smithyName = settings.smithyName || "枫丹铁匠铺";          // 铁匠铺地区
let primaryOre = settings.ore || "水晶块";                      // 主选矿石
let secondaryOre = settings.secondaryOre || "萃凝晶";           // 备选矿石1
let tertiaryOre = settings.tertiaryOre || "紫晶块";             // 备选矿石2
let notice = settings.notice ?? false;                         // 通知状态
let forgedOrNot = (settings.forgedOrNot && settings.forgedOrNot.trim() !== "") ? settings.forgedOrNot : "是"; // 是否锻造

// 矿石图像与中文名称映射
const ingredientImageMap = {
    萃凝晶: "assets/Picture/CondessenceCrystal.png",
    紫晶块: "assets/Picture/AmethystLump.png",
    水晶块: "assets/Picture/CrystalChunk.png",
    星银矿石: "assets/Picture/Starsilver.png",
    白铁块: "assets/Picture/WhiteIronChunk.png",
    铁块: "assets/Picture/IronChunk.png",
};

const OreChineseMap = {
    萃凝晶: "萃凝晶",
    紫晶块: "紫晶块",
    水晶块: "水晶块",
    星银矿石: "星银矿石",
    白铁块: "白铁块",
    铁块: "铁块",
};

// 模板识别对象
const ConfirmDeployButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/Confirm Deploy Button.png"),
    0, 870, 1920, 210
); // 确定按钮

const ForgingInterfaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ForgingInterface.png"),
    0, 0, 140, 100
); // 锻造界面图标

const ForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/Forge.png"),
    1260, 300, 600, 600
); // 对话框中的锻造图标

// 计算矿物图标的坐标（行列排列）
const rows = [1, 2, 3];
const cols = [1, 2, 3, 4, 5];
const gridCoordinates = [];
for (const row of rows) {
    for (const col of cols) {
        const ProcessingX = Math.round(150 + (col - 1) * 145);
        const ProcessingY = Math.round(230 + (row - 1) * 170);
        gridCoordinates.push({ row, col, x: ProcessingX, y: ProcessingY });
    }
}

/*********************** 工具函数 ***********************/

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

// 检查是否需要跳过该矿石（若已属于备选中）
function shouldSkipOre(targetOre, compareOres) {
    return compareOres.includes(targetOre);
}

// 通知日志：使用矿石提示
function determineOre(oreType) {
    let message = `将使用 ${OreChineseMap[oreType]} 锻造矿石`;
    log.info(message);
    return message;
}

/*********************** 主逻辑函数 ***********************/

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

// 尝试识别并锻造矿石
async function tryForgeOre(oreType, skipCheckOres = []) {
    // 若矿石在跳过列表中则直接返回
    if (shouldSkipOre(oreType, skipCheckOres)) {
        if (notice) {
            //notification.send(`跳过 ${OreChineseMap[oreType]}，因为已存在于优先选择中`);
        }
        return false;
    }

    // 获取矿石图像路径
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
                    notification.send(`找到矿石: ${OreChineseMap[oreType]}`);
                } else {
                    log.info(`找到矿石: ${OreChineseMap[oreType]}`);
                }
                determineOre(oreType);

                // 点击“开始锻造”按钮并进行OCR识别
                const ocrRegion = { x: 660, y: 495, width: 1250 - 660, height: 550 - 495 };
                let clickAttempts = 0;
                let forgingTriggered = false;
                while (clickAttempts < 4 && !forgingTriggered) {
                    let ConfirmButton = captureGameRegion().find(ConfirmDeployButtonRo);
                    if (ConfirmButton.isExist()) {
                        ConfirmButton.click();
                        clickAttempts++;
                    }
                    await sleep(1500);
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
                            await click(960, 800);
                            await sleep(1000);
                            return true; // 终止锻造流程
                        }
                        else if (ocrResults.text.includes("材料不足")) {
                            if (notice) {
                                notification.send("检测到 材料不足 跳过当前矿物。请检查背包，及时补充矿物。");
                            } else {
                                log.info("检测到 材料不足 跳过当前矿物。请检查背包，及时补充矿物。");
                            }
                            clickAttempts--; // 出现材料不足时减去一次点击计数
                            await click(960, 800);
                            await sleep(1000);
                            return false; // 跳过当前矿石
                        }
                    }
                    if (clickAttempts === 4) {
                        return true; // 达到点击上限，终止锻造流程
                    }
                }
            }
        }
        if (!found) {
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

// 对话、领取、锻造操作
async function forgeOre(smithyName) {
    // 对话部分
    await sleep(1000);
    keyPress("F");
    await sleep(1000);
    await click(960, 1042);
    await sleep(1000);
    await click(960, 1042);

    // 搜索对话界面中的锻造图标
    const maxAttempts = 3;
    let dialogFound = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        for (let i = 0; i < 3; i++) {
            let Forge = captureGameRegion().find(ForgeRo);
            if (Forge.isExist()) {
                log.info("已找到对话界面锻造图标");
                Forge.click();
                dialogFound = true;
                break;
            } else {
                await sleep(1000);
                await click(960, 1042);
            }
        }
        if (dialogFound) break;
    }

    // 检测锻造界面是否出现
    if (dialogFound) {
        let interfaceFound = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const ocrRegion = { x: 185, y: 125, width: 670 - 185, height: 175 - 125 };
            let ocrResults = captureGameRegion().find(
                RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
            );
            let innerFound = false;
            for (let i = 0; i < 3; i++) {
                let ForgingInterface = captureGameRegion().find(ForgingInterfaceRo);
                if (ForgingInterface.isExist()) {
                    log.info("已进入锻造界面");
                    innerFound = true;
                    break;
                } else {
                    await sleep(1000);
                    await click(960, 1042);
                }
            }
            if (innerFound) {
                interfaceFound = true;

                // 领取操作：点击全部领取及确认领取
                const ClaimAllRo = RecognitionObject.TemplateMatch(
                    file.ReadImageMatSync("Assets/RecognitionObject/全部领取.png"),
                    0, 900, 1920, 180
                );
                let ClaimAll = captureGameRegion().find(ClaimAllRo);
                if (ClaimAll.isExist()) {
                    ClaimAll.click();
                    await sleep(1000);
                    let ConfirmButton = captureGameRegion().find(ConfirmDeployButtonRo);
                    if (ConfirmButton.isExist()) {
                        ConfirmButton.click();
                        if (ocrResults.text.includes("配方")) {
                            ocrResults.click();
                        }
                        await click(220, 150);
                        await sleep(1000); // 点击进入锻造界面
                    } else {
                        log.warn("未能识别到确定按钮");
                    }
                }
                // 若设置为锻造，则依次尝试主选及备选矿石
                if (forgedOrNot === "是") {
                    let forgeSuccess = false;
                    if (await tryForgeOre(primaryOre, [])) {
                        forgeSuccess = true;
                    } else if (await tryForgeOre(secondaryOre, [primaryOre])) {
                        forgeSuccess = true;
                    } else if (await tryForgeOre(tertiaryOre, [primaryOre, secondaryOre])) {
                        forgeSuccess = true;
                    } else {
                        if (notice) {
                            notification.error("所有备选矿石都未能识别，结束锻造");
                        } else {
                            log.error("所有备选矿石都未能识别，结束锻造");
                        }
                    }
                }

                // 退出锻造前判断配方，如果出现“锻造队列”则点击
                const ocrRegionAfter = { x: 185, y: 125, width: 670 - 185, height: 175 - 125 };
                let ocrResultsAfter = captureGameRegion().find(
                    RecognitionObject.ocr(ocrRegionAfter.x, ocrRegionAfter.y, ocrRegionAfter.width, ocrRegionAfter.height)
                );
                if (ocrResultsAfter.text.includes("锻造队列")) {
                    ocrResultsAfter.click();
                    await sleep(1000);
                }
                break; // 退出锻造界面检测循环
            }
        }
        if (!interfaceFound) {
            log.error("经过多次尝试，未能进入锻造界面");
        }
    } else {
        log.info("未能找到对话界面锻造图标，无法进入锻造流程");
    }

    // 退出锻造界面并返回主界面
    if (notice) {
        notification.send("锻造结束，退出界面");
    } else {
        log.info("锻造结束，退出界面");
    }
    await genshin.returnMainUi();
}

/*********************** 主执行入口 ***********************/

(async function () {
    // 初始化及前往铁匠铺
    setGameMetrics(1920, 1080, 1.25);
    await genshin.returnMainUi();
    if (notice) {
        notification.send("自动锻造矿石脚本开始");
    }

    await autoSmithy(smithyName);
    await forgeOre(smithyName);
    await genshin.returnMainUi();

    // 后退两步
    { keyDown("S"); await sleep(1000); keyUp("S"); await sleep(1000); }

    if (notice) {
        notification.send("自动锻造矿石脚本结束");
    }
})();