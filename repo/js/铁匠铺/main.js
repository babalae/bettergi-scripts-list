/*********************** 配置与常量 ***********************/

// 用户配置
let smithyName = settings.smithyName || "枫丹铁匠铺";           // 铁匠铺地区
let primaryOre = settings.ore || "水晶块";                      // 主选矿石
let secondaryOre = settings.secondaryOre || "萃凝晶";           // 备选矿石1
let tertiaryOre = settings.tertiaryOre || "紫晶块";             // 备选矿石2
let notice = settings.notice ?? false;                          // 通知状态
let forgedOrNot = (settings.forgedOrNot && settings.forgedOrNot.trim() !== "") ? settings.forgedOrNot : "是"; // 是否锻造
let model = settings.model || "模式一";                         // 模式选择

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

const smithyMap = {
    "蒙德铁匠铺": { x: -869, y: 2278, country: "蒙德" },
    "璃月铁匠铺": { x: 267, y: -665, country: "璃月" },
    "稻妻铁匠铺": { x: -4402, y: -3052, country: "稻妻" },
    "须弥铁匠铺": { x: 2786, y: -503, country: "须弥" },
    "枫丹铁匠铺": { x: 4507, y: 3630, country: "枫丹" },
    "纳塔铁匠铺": { x: 9085, y: -1964, country: "纳塔" }
};

// 模板识别对象
//游戏界面
const InventoryInterFaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/GameInterface/InventoryInterFace.png"),
    0, 0, 140, 100
); // 【背包界面】图标
const DisabledMaterialsFaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/GameInterface/DisabledMaterialsFace.png"),
    0, 0, 1920, 100
); // 【材料界面-未处于】图标
const MaterialsFaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/GameInterface/MaterialsFace.png"),
    0, 0, 1920, 100
); // 【材料界面-已处于】图标
const ForgingInterFaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/GameInterface/ForgingInterFace.png"),
    0, 0, 140, 100
); // 锻造界面图标


//锻造界面物品图标-未使用这部分代码
const CondessenceCrystalForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/Picture/CondessenceCrystal.png"),
    0, 870, 1920, 210
); // 【萃凝晶】
const AmethystLumpForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/Picture/AmethystLump.png"),
    0, 870, 1920, 210
); // 【紫晶块】
const CrystalChunkForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/Picture/CrystalChunk.png"),
    0, 870, 1920, 210
); // 【水晶块】

//背包界面物品图标
const CondessenceCrystalRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ItemImage/CondessenceCrystal.png"),
    115, 115, 1270, 625
); // 【萃凝晶】
const AmethystLumpRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ItemImage/AmethystLump.png"),
    115, 115, 1165, 510
); // 【紫晶块】
const CrystalChunkRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ItemImage/CrystalChunk.png"),
    115, 115, 1165, 510
); // 【水晶块】

//对话框图标
const ForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/DialogueInterface/Forge.png"),
    1260, 300, 600, 600
); // 对话框中的锻造图标

//图标
const ConfirmDeployButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/Icon/ConfirmDeployButton.png"),
    0, 870, 1920, 210
); // 确定按钮
const ClaimAllRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/Icon/全部领取.png"),
    0, 900, 1920, 180
);
//地图界面图标
const MapRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/icon/右上角巨诗.png"),
    945, 20, 975, 50
); // 地图右上角【识别用】图标
const MapForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/icon/MapForge.png"),
    0, 0, 400, 625
); // 地图左上角【锻造】图标

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

// 模板匹配与交互
/**
 * 图像识别与交互函数（优化版）
 * @param {Object} target - 要识别的图像模板对象
 * @param {Object} [options={}] - 配置选项
 * @param {boolean} [options.useClick=false] - 是否执行点击操作
 * @param {number} [options.timeout=5000] - 识别超时时间(毫秒)
 * @param {number} [options.interval=500] - 重试间隔(毫秒)
 * @param {boolean} [options.clickCenter=true] - 是否点击中心点
 * @param {number} [options.postClickDelay=500] - 点击后等待时间(毫秒)
 * @param {boolean} [options.singleAttempt=false] - 是否仅尝试一次
 * @returns {Promise<Object>} 返回识别结果对象
 */
async function findAndInteract(target, options = {}) {
    // 合并默认选项
    const {
        useClick = false,
        timeout = 3000,
        interval = 300,
        clickCenter = true,
        postClickDelay = 300,
        singleAttempt = false
    } = options || {};

    const startTime = Date.now();
    let attemptCount = 0;
    let lastError = null;

    // 结果对象结构
    const resultTemplate = {
        success: false,
        position: null,     // {x, y} 原始位置
        clickPosition: null, // {x, y} 点击位置
        dimensions: null,   // {width, height}
        attempts: 0,
        elapsed: 0,
        error: null
    };

    // 主识别循环
    while (true) {
        attemptCount++;
        let gameRegion = null;
        try {
            // 1. 捕获游戏区域
            gameRegion = captureGameRegion();
            // 2. 执行图像识别
            const found = gameRegion.find(target);

            if (found?.isExist?.() === true) {
                // 构建成功结果
                const result = {
                    ...resultTemplate,
                    success: true,
                    position: { x: found.x, y: found.y },
                    dimensions: { width: found.width, height: found.height },
                    attempts: attemptCount,
                    elapsed: Date.now() - startTime
                };

                //log.info(`✅ 识别成功 | 位置: (${found.x}, ${found.y}) | 尺寸: ${found.width}x${found.height} | 尝试: ${attemptCount}次`);

                // 3. 处理点击交互
                if (useClick) {
                    // 计算点击位置
                    const clickPos = clickCenter
                        ? {
                            x: Math.round(found.x + found.width / 2),
                            y: Math.round(found.y + found.height / 2)
                        }
                        : { x: Math.round(found.x), y: Math.round(found.y) };

                    result.clickPosition = clickPos;

                    // 兼容同步/异步 click
                    if (typeof click === 'function') {
                        const clickResult = click(clickPos.x, clickPos.y);
                        if (clickResult && typeof clickResult.then === 'function') {
                            await clickResult;
                        }
                    }
                    //log.info(`🖱️ 已点击位置: (${clickPos.x}, ${clickPos.y})`);

                    // 点击后延迟
                    if (postClickDelay > 0) {
                        await sleep(postClickDelay);
                    }
                }

                return result;
            }

            // 未找到时的日志
            if (attemptCount % 3 === 0) {
                log.debug(`⏳ 识别尝试中... 次数: ${attemptCount}, 已用时: ${Date.now() - startTime}ms`);
            }
        } catch (error) {
            lastError = error;
            log.error(`识别异常,错误: ${error.message}`);
        } finally {
            // 4. 资源清理
            if (gameRegion?.dispose) {
                try { gameRegion.dispose(); } catch (e) { }
            }
        }

        // 退出条件
        if (singleAttempt || Date.now() - startTime >= timeout) {
            log.warn(`识别失败 | 尝试: ${attemptCount}次,未能识别到目标图像`);
            return {
                ...resultTemplate,
                attempts: attemptCount,
                elapsed: Date.now() - startTime,
                error: lastError?.message
            },
                false;
        }
        await sleep(interval);
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

// 模式一：自动识别背包中数量最多的矿石
async function getMaxOreType() {
    try {
        //开启背包
        await sleep(1000);
        await genshin.returnMainUi();
        keyPress("B"); await sleep(1000);
        //【背包】界面检测
        if (!await findAndInteract(InventoryInterFaceRo, {
            singleAttempt: true
        })) {
            log.info("未检测到背包界面，尝试返回主界面并打开背包");
            await genshin.returnMainUi();
            keyPress("B"); await sleep(1000);
        } else {
            log.info("检测到处于背包界面");
        }

        // 【材料】界面检测，多次尝试，避免过期道具卡弹窗
        let maxAttempts = 10; // 最大尝试次数，防止无限循环
        let attempts = 0;

        while (attempts < maxAttempts) {
            if (await findAndInteract(MaterialsFaceRo,
                {
                    singleAttempt: true
                })) {
                log.info("已经处于材料界面，准备识别矿物数量");
                break; // 成功进入界面，退出循环
            } else {
                log.info("未处于材料界面，准备点击材料界面图标");
                await findAndInteract(DisabledMaterialsFaceRo,
                    {
                        useClick: true
                    });
                await sleep(600); // 等待界面响应
                attempts++;
            }
        }
        if (attempts === maxAttempts) {
            log.error("多次尝试后仍未能进入材料界面，请检查界面状态或操作逻辑");
        } else {
            log.info("成功进入材料界面");
        }

        const oreResults = [
            { name: "萃凝晶", ro: CondessenceCrystalRo },
            { name: "紫晶块", ro: AmethystLumpRo },
            { name: "水晶块", ro: CrystalChunkRo }
        ];
        let maxOre = null;
        let maxCount = 0;
        for (const ore of oreResults) {
            const result = await findAndInteract(ore.ro, {
                useClick: true,
                timeout: 5000,
                interval: 500,
                postClickDelay: 500
            });
            if (!result || !result.success || !result.clickPosition) continue;
            let ocrX = result.clickPosition.x - 63;
            let ocrY = result.clickPosition.y + 60;
            let resList = captureGameRegion().findMulti(RecognitionObject.ocr(ocrX, ocrY, 130, 55));
            let oreNum = 0;
            if (resList.count > 0) {
                let text = resList[0].text.replace(/[^\d]/g, "");
                oreNum = parseInt(text, 10) || 0;
                log.info(`识别到 ${OreChineseMap[ore.name]} 数量: ${oreNum}`);
            }
            if (oreNum > maxCount) {
                maxCount = oreNum;
                maxOre = ore.name;
                /*
                                if (notice) {
                                    notification.send(`当前最多矿石为: ${OreChineseMap[ore.name]} 数量: ${oreNum}`);
                                } else {
                                    log.info(`当前最多矿石为: ${OreChineseMap[ore.name]} 数量: ${oreNum}`);
                                }
                */
            }
        }
        return maxOre ? { name: maxOre, count: maxCount } : null; // 修改返回值
    } catch (error) {
        if (notice) {
            notification.error(`自动识别背包中数量最多的矿石失败，错误: ${error.message}`);
        } else {
            log.error(`识自动识别背包中数量最多的矿石失败，错误: ${error.message}`);
        }
        return null;
    }
}

// 自动前往铁匠铺
async function autoSmithy(smithyName) {
    await genshin.returnMainUi();
    await sleep(1000);
    log.info(`自动前往 ${smithyName}`);
    try {
        if (smithyName === "纳塔铁匠铺") {
            keyPress("M"); await sleep(1000);
            click(1845, 1015); await sleep(250);
            click(1650, 355); await sleep(250);
            await genshin.setBigMapZoomLevel(1.0);
            click(845, 615); await sleep(250);
            click(1475, 1005); await sleep(250);
            await genshin.returnMainUi();// 通过返回主界面，等待传送完成
        }
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
                await sleep(250);
                // if (notice) {
                // notification.send(`找到矿石: ${OreChineseMap[oreType]}`);
                // } else {
                log.info(`找到矿石: ${OreChineseMap[oreType]}`);
                // }
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
                    await sleep(200);
                    let ocrResults = captureGameRegion().find(
                        RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
                    );
                    if (ocrResults) {
                        // log.info(`${ocrResults.text}`);
                        if (ocrResults.text.includes("今日已无法锻造")) {
                            if (notice) {
                                notification.send("检测到 今日已无法锻造 结束锻造");
                            } else {
                                log.info("检测到 今日已无法锻造 结束锻造");
                            }
                            await sleep(250);
                            await click(960, 1042);
                            await sleep(200);
                            await click(960, 1042);// 多次点击结束弹窗
                            return true; // 终止锻造流程
                        }
                        else if (ocrResults.text.includes("材料不足")) {
                            if (notice) {
                                notification.send("检测到 材料不足 跳过当前矿物。请检查背包，及时补充矿物。");
                            } else {
                                log.info("检测到 材料不足 跳过当前矿物。请检查背包，及时补充矿物。");
                            }
                            clickAttempts--; // 出现材料不足时减去一次点击计数
                            await sleep(250);
                            await click(960, 1042);
                            await sleep(200);
                            await click(960, 1042);// 多次点击结束弹窗
                            return false; // 跳过当前矿石
                        }
                    }
                    if (clickAttempts === 4) {
                        await sleep(1000);
                        if (notice) {
                            notification.send(`锻造已完成，使用了 ${OreChineseMap[oreType]}`);
                        } else {
                            // 偽造拾取
                            log.info(`交互或拾取："使用了[${OreChineseMap[oreType]}]"`);
                            log.info(`锻造已完成，使用了 ${OreChineseMap[oreType]}`);
                        }
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
async function forgeOre(smithyName, maxOre = null) {
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
                await sleep(1000);
                Forge.click();
                dialogFound = true;
                break;
            } else {
                await sleep(1000);
                await click(960, 1042);
            }
        }
        if (!dialogFound)
            log.error("多次尝试未能识别到对话界面锻造图标");
        break;
    }
    // 检测锻造界面是否出现
    if (dialogFound) {
        let interFaceFound = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const ocrRegion = { x: 185, y: 125, width: 670 - 185, height: 175 - 125 };
            let ocrResults = captureGameRegion().find(
                RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
            );
            let innerFound = false;
            for (let i = 0; i < 3; i++) {
                let ForgingInterFace = captureGameRegion().find(ForgingInterFaceRo);
                if (ForgingInterFace.isExist()) {
                    log.info("已进入锻造界面");
                    innerFound = true;
                    break;
                } else {
                    await sleep(1000);
                    await click(960, 1042);
                }
            }
            if (innerFound) {
                interFaceFound = true;

                // 领取操作：点击全部领取及确认领取
                let ClaimAll = captureGameRegion().find(ClaimAllRo);
                if (ClaimAll.isExist()) {
                    ClaimAll.click();
                    await sleep(500);
                    let ConfirmButton = captureGameRegion().find(ConfirmDeployButtonRo);
                    if (ConfirmButton.isExist()) {
                        ConfirmButton.click();
                        await sleep(500);
                        if (forgedOrNot === "是") {
                            await click(220, 150);
                            await sleep(1000); // 点击进入锻造界面
                        }
                    } else {
                        log.warn("未能识别到确定按钮");
                    }
                }
                if (forgedOrNot === "是") {
                    let forgeSuccess = false;

                    // 模式一：自动模式：自动选择数量最多的矿石锻造
                    if (model === "模式一" && maxOre) {
                        primaryOre = maxOre;
                        log.info(`自动选择数量最多的矿石为: ${primaryOre}`);
                        forgeSuccess = await tryForgeOre(primaryOre, []);
                        if (!forgeSuccess) {
                            log.warn("自动模式锻造未成功，切换到手动备选矿石模式");
                        }
                    }
                    // 模式二或模式一失败时，依次尝试主选及备选矿石
                    if (model === "模式二" || !forgeSuccess) {
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
                }

                // 退出锻造前判断配方，点击“锻造队列”，再次确认使用的矿物已经锻造结果
                const ocrRegionAfter = { x: 185, y: 125, width: 670 - 185, height: 175 - 125 };
                let ocrResultsAfter = captureGameRegion().find(
                    RecognitionObject.ocr(ocrRegionAfter.x, ocrRegionAfter.y, ocrRegionAfter.width, ocrRegionAfter.height)
                );
                if (ocrResultsAfter.text.includes("锻造队列")) {
                    await sleep(1000);//等待僵直
                    ocrResultsAfter.click();
                    await sleep(200);
                    ocrResultsAfter.click();
                    await sleep(500);
                }
                break; // 退出锻造界面检测循环
            }
        }
        if (!interFaceFound) {
            log.error("经过多次尝试，未能进入锻造界面");
        }
    } else {
        log.error("未能找到对话界面锻造图标，无法进入锻造流程");
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
    } else {
        log.info("自动锻造矿石脚本开始");
    }

    let maxOre = null;
    if (forgedOrNot === "是") {
        if (model === "模式一") {
            const maxOreResult = await getMaxOreType();
            if (maxOreResult) {
                maxOre = maxOreResult.name;
                primaryOre = maxOre;
                //log.info(`自动选择数量最多的矿石为: ${maxOre}`);
                if (notice) {
                    notification.send(`当前最多矿石为: ${OreChineseMap[maxOre]}，数量: ${maxOreResult.count}`);
                } else {
                    log.info(`当前最多矿石为: ${OreChineseMap[maxOre]}，数量: ${maxOreResult.count}`);
                }
            } else {
                log.warn("自动识别矿石失败，将使用默认配置");
            }
        }
        await genshin.returnMainUi();
        await autoSmithy(smithyName);
        await forgeOre(smithyName, maxOre);
    }

    if (forgedOrNot === "否") {
        keyPress("M"); await sleep(1000);

        if (!await findAndInteract(MapRo,
            {
                singleAttempt: true
            })) {
            const smithyInfo = smithyMap[smithyName];
            if (smithyInfo) {
                await genshin.moveMapTo(smithyInfo.x, smithyInfo.y, smithyInfo.country);
            }
        }
        if (!await findAndInteract(MapForgeRo,
            {
            })) {
            await genshin.returnMainUi();
            log.info("未能识别到锻造完成图标，无需前往领取。结束脚本");
            return; // 若没有锻造图标则跳出
        }

        await autoSmithy(smithyName);//路径函数，前往铁匠铺
        await forgeOre(smithyName);
    }

    await genshin.returnMainUi();

    //后退两步
    { keyDown("S"); await sleep(1000); keyUp("S"); await sleep(1000); }

    //if (notice) {
    //    notification.send("自动锻造矿石脚本结束");
    //}
    //else {
    log.info("自动锻造矿石脚本结束");
    //}

})();
