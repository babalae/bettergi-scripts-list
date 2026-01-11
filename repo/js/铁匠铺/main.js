/*********************** 配置与常量 ***********************/

// 用户配置
let smithyName = settings.smithyName ?? "枫丹铁匠铺";           // 铁匠铺地区
let CondessenceCrystal = settings.CondessenceCrystal ?? "1";   // 萃凝晶
let CrystalChunk = settings.CrystalChunk ?? "2";               // 水晶块
let AmethystLump = settings.AmethystLump ?? "3";               // 紫晶块 
let RainbowdropCrystal = settings.RainbowdropCrystal ?? "4";   // 虹滴晶


let notice = settings.notice ?? false;                          // 通知状态
let forgedOrNot = (settings.forgedOrNot && settings.forgedOrNot.trim() !== "") ? settings.forgedOrNot : "是"; // 是否锻造
let model = settings.model || "模式一";                         // 模式选择

// 矿石图像与中文名称映射
const ingredientImageMap = {
    萃凝晶: "assets/Picture/CondessenceCrystal.png",
    水晶块: "assets/Picture/CrystalChunk.png",
    紫晶块: "assets/Picture/AmethystLump.png",
    虹滴晶: "assets/Picture/RainbowdropCrystal.png",

    星银矿石: "assets/Picture/Starsilver.png",
    白铁块: "assets/Picture/WhiteIronChunk.png",
    铁块: "assets/Picture/IronChunk.png",
};

const OreChineseMap = {
    萃凝晶: "萃凝晶",
    水晶块: "水晶块",
    紫晶块: "紫晶块",
    虹滴晶: "虹滴晶",

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
    "纳塔铁匠铺": { x: 9085, y: -1964, country: "纳塔" },
    "挪德卡莱铁匠铺": { x: 9458, y: 1660, country: "挪德卡莱" }
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
    40, 200, 770, 720
); // 【萃凝晶】
const AmethystLumpForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/Picture/AmethystLump.png"),
    40, 200, 770, 720
); // 【紫晶块】
const CrystalChunkForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/Picture/CrystalChunk.png"),
    40, 200, 770, 720
); // 【水晶块】
const RainbowdropCrystalForgeRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/Picture/RainbowdropCrystal.png"),
    40, 200, 770, 720
); // 【虹滴晶】



//背包界面物品图标
const CondessenceCrystalRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ItemImage/CondessenceCrystal.png"),
    115, 115, 1300, 955
); // 【萃凝晶】
const CrystalChunkRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ItemImage/CrystalChunk.png"),
    115, 115, 1300, 955
); // 【水晶块】
const AmethystLumpRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ItemImage/AmethystLump.png"),
    115, 115, 1300, 955
); // 【紫晶块】
const RainbowdropCrystalRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ItemImage/RainbowdropCrystal.png"),
    115, 115, 1300, 955
); // 【虹滴晶】


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


// 定义优先级配置和昵称顺序。读取 settings.json 里的矿石优先级配置，转为数字
const orePriorityConfig = {
    "萃凝晶": Number(CondessenceCrystal) ?? 0,
    "水晶块": Number(CrystalChunk) ?? 0,
    "紫晶块": Number(AmethystLump) ?? 0,
    "虹滴晶": Number(RainbowdropCrystal) ?? 0
};
//定义昵称顺序，用于优先级相同时的排序。
const nicknameOrder = ["萃凝晶", "水晶块", "紫晶块", "虹滴晶"];






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
        useClick = false,   // 是否执行点击操作
        timeout = 3000,    // 识别超时时间(毫秒)
        interval = 300,     // 重试间隔(毫秒)
        clickCenter = true,    // 是否点击中心点
        postClickDelay = 300,     // 点击后等待时间(毫秒)
        singleAttempt = false,   // 是否仅尝试一次
        silentOnFail = false      // 失败时不报错（静默模式）
    } = options || {};

    const startTime = Date.now();
    let attemptCount = 0;
    let lastError = null;

    // 模板————结果对象结构
    const resultTemplate = {
        success: false,   // 操作是否成功
        position: null,    // 识别到的原始坐标 {x, y}
        clickPosition: null,    // 实际点击的坐标 {x, y}（可能包含偏移）
        dimensions: null,    // 识别区域的尺寸 {width, height}
        attempts: 0,       // 尝试次数
        elapsed: 0,       // 耗时（毫秒）
        error: null     // 错误信息
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
                    ...resultTemplate, // 复制模板所有属性
                    success: true,
                    position: { x: found.x, y: found.y },
                    dimensions: { width: found.width, height: found.height },
                    attempts: attemptCount,
                    elapsed: Date.now() - startTime
                };

                //log.info(`✅ 识别成功 | 左上角位置: (${found.x}, ${found.y}) | 尺寸: ${found.width}x${found.height} | 尝试: ${attemptCount}次`);

                // 3. 处理点击交互
                if (useClick) {
                    // 计算点击位置
                    const clickPos = clickCenter ?// 条件判断：是否点击中心点
                        // 如果 clickCenter 为 true，点击元素的中心点
                        {
                            x: Math.round(found.x + found.width / 2),
                            y: Math.round(found.y + found.height / 2)
                        } :
                        // 如果 clickCenter 为 false，点击元素的左上角
                        {
                            x: Math.round(found.x), y: Math.round(found.y)
                        };

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
            if (!silentOnFail) {
                lastError = error;
                log.error(`识别异常,错误: ${error.message}`);
            }
        } finally {
            // 4. 资源清理
            if (gameRegion?.dispose) {
                try {
                    gameRegion.dispose();
                } catch (error) {
                    log.error(`释放游戏区域资源时出错: ${error.message}`);
                }
            }
        }

        // 退出条件
        if (singleAttempt || Date.now() - startTime >= timeout) {
            if (!silentOnFail) {
                log.warn(`模板匹配失败 | 尝试: ${attemptCount}次,未能识别到目标图像`);
            }
            return false;
        }
        await sleep(interval);
    }
}

// 通知日志：使用矿石提示
function determineOre(oreType) {
    let message = `将使用 ${OreChineseMap[oreType]} 锻造矿石`;
    log.info(message);
    return message;
}

// 2.4.0*新增：过滤并排序列表函数
/**
 * 在锻造逻辑前，生成一个按优先级排序的矿石列表，数字为 0 的矿石不参与锻造：
 * @param {Object} priorityConfig - 矿石优先级配置对象，键为矿石名称，值为优先级数字  // priorityConfig: { oreName: priorityNumber, ... }
 * @param {Array} tieBreakOrder - 矿石昵称顺序数组，用于同优先级时的排序         // tieBreakOrder: 当优先级相同或重复时，按此数组的顺序决定先后（越靠前优先级越高）
 * @returns {Array} 返回按优先级排序且去重的矿石名称数组
 */
function getSortedOresByPriority(priorityConfig, tieBreakOrder = []) {
    try {
        if (!priorityConfig || typeof priorityConfig !== 'object') {
            log.error('优先级配置无效');
            return [];
        }
        // 调试日志：显示原始配置
        //log.info(`原始优先级配置: ${JSON.stringify(priorityConfig)}`);
        const entries = Object.entries(priorityConfig || {}).filter(([_, priority]) => Number(priority) > 0);
        // 调试日志：显示过滤后的条目
        //log.info(`[排序调试] 过滤后的矿石条目: ${JSON.stringify(entries)}`);
        // 去重并稳定排序：先按 priority 升序，同优先级时按 tieBreakOrder 的索引升序
        entries.sort((a, b) => {
            const pa = Number(a[1]);
            const pb = Number(b[1]);
            // 调试日志：显示每次比较
            //log.info(`[排序调试] 比较 ${a[0]}=${pa} vs ${b[0]}=${pb}`);
            if (pb !== pa)
                return pa - pb; // 数字小的排前面（升序）
            const ai = tieBreakOrder.indexOf(a[0]);
            const bi = tieBreakOrder.indexOf(b[0]);
            const aIdx = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
            const bIdx = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
            return aIdx - bIdx;
        });
        // 调试日志：显示排序后的条目
        //log.info(`[排序调试] 排序后的矿石条目: ${JSON.stringify(entries)}`);
        // 返回去重后的名称列表（保持排序）
        const seen = new Set();
        const result = [];
        for (const [name] of entries) {
            if (!seen.has(name)) {
                seen.add(name);
                result.push(name);
            }
        }
        // 调试日志：显示最终结果
        log.info(`矿石使用排序: ${JSON.stringify(result)}`);
        return result;
    } catch (error) {
        log.error(`生成排序矿石列表失败，错误: ${error.message}`);
        return [];
    }
}


/*********************** 封装函数 ***********************/

// 2.4.0*新增：封装启用通知与否日志记录
function logMessage(level, message) {
    if (notice) {
        notification[level](message);
    } else {
        log[level](message);
    }
}

// 2.4.0*新增：【背包界面】封装背包界面打开与检测
async function openInventory() {
    let maxAttempts = 3; // 最大尝试次数，防止无限循环

    try {
        // ========== 第一阶段：确保打开背包界面 ==========
        log.info("开始尝试打开背包界面...");
        await sleep(1000);

        for (let bagAttempt = 1; bagAttempt <= maxAttempts; bagAttempt++) {
            //log.info(`尝试打开背包 (第 ${bagAttempt}/${maxAttempts} 次)`);

            // 先执行一次标准的打开背包操作
            await genshin.returnMainUi();
            keyPress("B"); await sleep(1000);

            // 检测是否成功进入背包界面
            if (await findAndInteract(InventoryInterFaceRo, { singleAttempt: true })) {
                log.info("✓ 成功进入背包界面");
                break; // 成功，跳出循环
            }

            //log.warn(`第 ${bagAttempt} 次打开背包失败`);

            // 如果这是最后一次尝试，直接失败返回
            if (bagAttempt === maxAttempts) {
                log.error(`无法打开背包界面，已重试 ${maxAttempts} 次`);
                return false;
            }
        }

        // ========== 第二阶段：切换到材料标签页 ==========
        log.info("准备切换到材料界面...");

        for (let materialAttempt = 1; materialAttempt <= maxAttempts; materialAttempt++) {
            //log.info(`尝试进入材料界面 (第 ${materialAttempt}/${maxAttempts} 次)`);

            // 先检测是否已经在材料界面
            if (await findAndInteract(MaterialsFaceRo, { singleAttempt: true })) {
                log.info("✓ 已处于材料界面");
                return true; // 完全成功
            }

            // 点击材料标签页图标
            //log.info("点击材料标签页图标...");
            await findAndInteract(DisabledMaterialsFaceRo, { useClick: true });
            await sleep(600); // 等待界面响应

            // 检测点击后是否成功切换
            if (await findAndInteract(MaterialsFaceRo, { singleAttempt: true })) {
                log.info("✓ 成功切换到材料界面");
                return true; // 完全成功
            }

            //log.warn(`第 ${materialAttempt} 次切换材料界面失败`);

            // 最后一次尝试也失败
            if (materialAttempt === maxAttempts) {
                log.error("多次尝试后仍未能进入材料界面，请检查界面状态");
                return false;
            }
        }
    } catch (error) {
        logMessage('error', `打开背包界面失败，错误: ${error.message}`);
        return false;
    }
}

/*********************** 主逻辑函数 ***********************/

// 2.4.0*新增：【配置检查】模块：当所有矿石优先级均为 0 时，停止脚本并通知用户
async function configurationCheck() {
    // 详细的所有矿石优先级为0的检查
    //log.info(`[配置检查] 开始检查矿石优先级配置`);
    try {
        // 2.4.0*新增：当所有矿石优先级均为 0 时，停止脚本并通知用户
        const allOrePriorities = Object.values(orePriorityConfig || {}).map(v => Number(v) || 0);
        const allZero = allOrePriorities.length > 0 && allOrePriorities.every(v => v === 0);
        if (allZero) {
            const msg = "所有矿石优先级均为0或无效 ，已停止脚本。请在设置中至少启用一种矿石。";
            logMessage('error', msg);
            return false; // 配置无效，停止脚本
        }
        return true;
    } catch (error) {
        logMessage('error', `[配置检查] 失败，错误: ${error.message}`);
        return false; // 出现错误，停止脚本
    }
}




// 模式一：自动识别背包中数量最多的矿石
async function getMaxOreType() {
    try {

        if (!await openInventory()) {
            return false; // 无法打开背包界面，停止操作
        }

        const oreResults = [
            { name: "水晶块", ro: CrystalChunkRo },
            { name: "紫晶块", ro: AmethystLumpRo },
            { name: "萃凝晶", ro: CondessenceCrystalRo },
            { name: "虹滴晶", ro: RainbowdropCrystalRo }
        ];

        // 定义日志收集对象
        const priorityLog = [];  // 优先级检查日志
        // 过滤掉优先级为0的矿石
        //const validOres = oreResults.filter(ore => Number(orePriorityConfig[ore.name]) > 0);
        const validOres = oreResults.filter(ore => {
            const priority = Number(orePriorityConfig[ore.name]);
            const isValid = priority > 0;
            // 收集优先级检查日志
            priorityLog.push(`矿石 ${ore.name} 优先级: ${priority}, 是否使用对应矿: ${isValid}`);
            //log.debug(`矿石 ${ore.name} 优先级: ${priority}, 是否有效: ${isValid}`);
            return isValid;

        });
        // 在过滤完成后一次性输出所有日志
        if (priorityLog.length > 0) {
            log.info(`矿石优先级检查详情:\n${priorityLog.join('\n')}`);
        }

        let maxOre = null;
        let maxCount = 0;
        // 定义日志收集对象
        const quantityLog = [];   // 数量识别日志

        for (const ore of validOres) {
            const result = await findAndInteract(ore.ro, {
                useClick: true,
                timeout: 5000,
                interval: 500,
                postClickDelay: 500
            });
            if (!result || !result.success || !result.clickPosition) continue;
            let ocrX = result.clickPosition.x - 63;
            let ocrY = result.clickPosition.y + 60;
            let ro = captureGameRegion();
            let resList = ro.findMulti(RecognitionObject.ocr(ocrX, ocrY, 130, 55));
            ro.dispose();
            let oreNum = 0;
            if (resList && resList.count > 0 && resList[0]?.text) {
                let text = resList[0].text.replace(/[^\d]/g, "");
                oreNum = parseInt(text, 10) || 0;
                quantityLog.push(`识别到 ${OreChineseMap[ore.name]} 数量: ${oreNum}`);
                //log.info(`识别到 ${OreChineseMap[ore.name]} 数量: ${oreNum}`);
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

        // 数量识别日志
        if (quantityLog.length > 0) {
            log.info(`矿石数量识别:\n${quantityLog.join('\n')}`);
        }
        return maxOre ? { name: maxOre, count: maxCount } : null; // 修改返回值

    } catch (error) {
        logMessage('error', `自动识别背包中数量最多的矿石失败，错误: ${error.message}`);
        return null;
    }
}

// 【路径函数】自动前往铁匠铺
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
    } catch (error) {
        logMessage('error', `执行 ${smithyName} 路径时发生错误: ${error.toString()}`);
        return false; // 出现错误，停止脚本
    }
    if (notice) {
        notification.send(`已抵达 ${smithyName}`);
    } else {
        log.info(`已抵达 ${smithyName}`);
    }
    return true; // 成功抵达
}


// 【锻造界面】识别并进行锻造矿石
async function tryForgeOre(oreType) {
    // 获取矿石图像路径
    const imagePath = ingredientImageMap[oreType];
    if (!imagePath) {
        /*if (notice) {
            notification.error(`未找到矿石图像路径: ${OreChineseMap[oreType]}`);
        } else {
            log.error(`未找到矿石图像路径: ${OreChineseMap[oreType]}`);
        }
*/
        logMessage('error', `未找到矿石图像路径: ${OreChineseMap[oreType]}`);
        return false;
    }

    log.info(`【锻造界面】开始寻找矿石: ${OreChineseMap[oreType]}`);
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let found = false;

        // 使用模板匹配替代图像识别
        const templateMatchResult = await findAndInteract(
            RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(imagePath),
                40, 200, 770, 720
            ),
            {
                useClick: true, // 是否点击
                timeout: 3000,  // 超时时间
                interval: 500,  // 重试间隔
            }
        );
        await sleep(250);

        if (templateMatchResult && templateMatchResult.success) {
            found = true;
            log.info(`找到矿石: ${OreChineseMap[oreType]}`);
            determineOre(oreType);

            // 点击“开始锻造”按钮并进行OCR识别
            const ocrRegion = { x: 660, y: 495, width: 1250 - 660, height: 550 - 495 };
            let clickAttempts = 0;
            let forgingTriggered = false;
            while (clickAttempts < 4 && !forgingTriggered) {

                if (await findAndInteract(ConfirmDeployButtonRo,
                    {
                        useClick: true, // 是否点击
                        singleAttempt: true
                    }
                )) {
                    clickAttempts++;
                } else {
                    log.warn("未能识别到确认按钮，尝试重新识别");
                }
                await sleep(200);

                let ro2 = captureGameRegion();
                let ocrResults = ro2.find(
                    RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)
                );
                ro2.dispose();
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
        if (!found) {
            log.error(`未能识别到矿石: ${OreChineseMap[oreType]}，重试中... (${attempt + 1}/${maxAttempts})`);
            await sleep(1000);
        }
    }
    /*if (notice) {
        notification.error(`未能识别到矿石: ${OreChineseMap[oreType]}，停止尝试`);
    } else {
        log.error(`未能识别到矿石: ${OreChineseMap[oreType]}，停止尝试`);
    }
*/
    logMessage('error', `未能识别到矿石: ${OreChineseMap[oreType]}，停止尝试`);
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
        if (await findAndInteract(ForgeRo, {
            timeout: 2000,
            interval: 500,
            postClickDelay: 1000,
            singleAttempt: true
        })) {            
            await sleep(1000);
            await click(960, 1042);
            await findAndInteract(ForgeRo, {
                useClick: true,
                timeout: 2000,
                interval: 500,
                postClickDelay: 1000,
                singleAttempt: true
            });

            log.info("已找到对话界面锻造图标并点击");
            await sleep(1000);
            await click(960, 1042);
            await sleep(1000);
            await click(960, 1042);
            dialogFound = true;
            break;
        } else {
            log.warn("未能识别到对话界面锻造图标，尝试重新点击");
            await sleep(1000);
            await click(960, 1042);
        }
    }

    if (!dialogFound) {
        log.error("多次尝试未能识别到对话界面锻造图标");
        return; // 退出函数
    }

    // 对话框内的锻造图标识别到后，进入锻造界面
    if (dialogFound) {
        let interFaceFound = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // 检测锻造界面是否出现
            let innerFound = false;
            for (let i = 0; i < 3; i++) {
                if (await findAndInteract(ForgingInterFaceRo,
                    {

                    })) {
                    log.info("已进入锻造界面");
                    innerFound = true;
                    break;
                } else {
                    await sleep(1000);
                    await click(960, 1042);
                }
            }

            // 检测到锻造界面出现
            if (innerFound) {
                interFaceFound = true;

                // 领取操作：点击全部领取及确认领取
                if (await findAndInteract(ClaimAllRo, {
                    useClick: true,
                    timeout: 2000,
                    interval: 500,
                    postClickDelay: 1000,
                    singleAttempt: true,
                    silentOnFail: true      // 失败时不报错（静默模式）

                })) {
                    await sleep(500);
                    if (await findAndInteract(ConfirmDeployButtonRo, {
                        useClick: true,
                        timeout: 2000,
                        interval: 500,
                        postClickDelay: 1000,
                        singleAttempt: true
                    })) {
                        await sleep(500);
                    } else {
                        log.warn("未能识别到确定按钮");
                    }
                }

                if (forgedOrNot === "是") {
                    let forgeSuccess = false;

                    await click(220, 150);
                    await sleep(1000); // 点击进入锻造界面
                    // 模式一：自动模式：自动选择数量最多的矿石锻造
                    if (model === "模式一" && maxOre) {
                        //log.info(`自动选择数量最多的矿石为: ${maxOre}`);
                        forgeSuccess = await tryForgeOre(maxOre);
                        if (!forgeSuccess) {
                            log.warn("自动模式锻造未成功，切换到手动排序选矿模式");
                        }
                    }
                    // 处于模式二或模式一失败时，则按配置优先级依次尝试
                    if (model === "模式二" || !forgeSuccess) {
                        // 生成按优先级的候选矿石列表（只包含优先级大于0的项）
                        let orderedOres = getSortedOresByPriority(orePriorityConfig, nicknameOrder);
                        // 如果之前已尝试过 maxOre，则从列表中过滤掉它，避免重复尝试
                        if (maxOre) {
                            orderedOres = orderedOres.filter(o => o !== maxOre);
                        }

                        // 按顺序逐个尝试
                        for (const oreName of orderedOres) {
                            //if (!oreName) continue;//如果 oreName 是假值，就跳过当前循环迭代，继续下一个
                            log.info(`按优先级尝试使用矿石: ${oreName} 锻造`);
                            try {
                                if (await tryForgeOre(oreName)) {
                                    forgeSuccess = true;
                                    break;
                                } else {
                                    log.info(`${oreName} 尝试未成功，继续下一个`);
                                }
                            } catch (error) {
                                log.error(`tryForgeOre(${oreName}) 报错: ${error.message}`);
                            }
                        }

                        if (!forgeSuccess) {
                            logMessage('error', "所有候选矿石均未能成功锻造，结束锻造");
                        }
                    }
                }

                // 退出锻造前判断配方，点击“锻造队列”，再次确认使用的矿物已经锻造结果
                const ocrRegionAfter = { x: 185, y: 125, width: 670 - 185, height: 175 - 125 };
                let ro2 = captureGameRegion();
                let ocrResultsAfter = ro2.find(
                    RecognitionObject.ocr(ocrRegionAfter.x, ocrRegionAfter.y, ocrRegionAfter.width, ocrRegionAfter.height)
                );
                ro2.dispose();
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
    // 1. 初始化
    setGameMetrics(1920, 1080, 1.25);
    await genshin.returnMainUi();
    if (notice) {
        notification.send("自动锻造矿石脚本开始");
    } else {
        log.info("自动锻造矿石脚本开始");
    }

    // 2. 主流程
    try {
        // 2.1 配置检查
        if (!(await configurationCheck())) return;

        // 2.2.1 锻造选择-是
        let maxOre = null;
        if (forgedOrNot === "是") {
            if (model === "模式一") {
                const maxOreResult = await getMaxOreType();
                if (maxOreResult) {
                    maxOre = maxOreResult.name;
                    //log.info(`自动选择数量最多的矿石为: ${maxOre}`);
                    if (notice) {
                        notification.send(`自动选择当前数量最多矿石: ${OreChineseMap[maxOre]}，数量: ${maxOreResult.count}`);
                    } else {
                        log.info(`自动选择当前数量最多矿石: ${OreChineseMap[maxOre]}，数量: ${maxOreResult.count}`);
                    }
                } else {
                    log.warn("自动识别矿石失败，将使用默认配置");
                }
            }
            await genshin.returnMainUi();
            if (!await autoSmithy(smithyName)) return;
            await forgeOre(smithyName, maxOre);
        }

        // 2.2.2 锻造选择-否
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

            if (!await autoSmithy(smithyName)) return; //路径函数，前往铁匠铺
            await forgeOre(smithyName);
        }

    } catch (error) {
        logMessage('error', `脚本执行过程中发生错误: ${error.message}`);
    }

    // 3. 结束流程
    finally {
        // 3.1 返回主界面
        await genshin.returnMainUi();

        //3.2 后退两步
        { keyDown("S"); await sleep(1000); keyUp("S"); await sleep(1000); }

        //if (notice) {
        //    notification.send("自动锻造矿石脚本结束");
        //}
        //else {

        //3.3 发送通知
        log.info("自动锻造矿石脚本结束");
        //}

    }


})();


