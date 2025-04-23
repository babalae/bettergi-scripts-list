/**
 * 原神地脉花自动化脚本 (Genshin Impact Ley Line Outcrop Automation Script)
 * 
 * 功能：自动寻找并完成地脉花挑战，领取奖励
 * 
 * 术语对照表：
 * 中文 - 英文：
 * 地脉之花 - Ley Line Outcrop
 * 地脉 - Ley Line
 * 启示之花 - Blossom of Revelation (蓝花，产出经验书)
 * 藏金之花 - Blossom of Wealth (黄花，产出摩拉)
 */

// 全局变量
let leyLineX = 0;         // 地脉花X坐标
let leyLineY = 0;         // 地脉花Y坐标
let currentFlower = null; // 当前花的引用
let strategyName = "";    // 任务策略名称
let retryCount = 0;       // 重试次数

/**
 * 主函数 - 脚本入口点
 */
(async function () {
    try {
        // 初始化
        await genshin.returnMainUi();
        setGameMetrics(1920, 1080, 1);

        // 加载配置和设置
        const config = await loadConfig();
        const settings = loadSettings();
        retryCount = 0;

        // 输出基本设置信息
        log.info(`地脉花类型：${settings.leyLineOutcropType}`);
        log.info(`国家：${settings.country}`);
        if (settings.friendshipTeam) { // 显示好感队信息（如果配置了好感队）
            log.info(`好感队：${settings.friendshipTeam}`);
        }
        // 开局传送到七天神像
        await genshin.tpToStatueOfTheSeven();
        // 切换战斗队伍
        if (settings.team) {
            log.info(`切换至队伍 ${settings.team}`);
            await genshin.switchParty(settings.team);
        }
        
        log.info(`刷取次数：${settings.timesValue}`);

        // 可重跑模式提示
        if (settings.reRun) {
            log.info("已开启可重跑模式，将选择可重跑路线"); 
        }

        // 强制运行模式（不识别地脉花位置）
        if (settings.forceRun) {
            log.info("已开启强制运行，不再识别地脉花位置");
            log.info(`执行策略：${settings.forceRunPath}`);
            try {
                for (let i = 1; i <= 6; i++) {
                    await pathingScript.runFile(`assets/pathing/${settings.forceRunPath}-${i}.json`);
                    await processLeyLineOutcrop(settings.timeout, settings.forceRun, `assets/pathing/target/${settings.forceRunPath}-${i}.json`);
                }
            } catch (error) {
                log.info(error.message);
            }
            return;
        }

        // 正常模式：寻找地脉花位置
        await findLeyLineOutcrop(settings.country, settings.leyLineOutcropType, settings);

        // 寻找并执行对应的策略
        let foundStrategy = false;

        // 从配置中查找匹配的位置和策略
        if (config.leyLinePositions[settings.country]) {
            const positions = config.leyLinePositions[settings.country];
            for (const position of positions) {
                if (isNearPosition(leyLineX, leyLineY, position.x, position.y, config.errorThreshold)) {
                    foundStrategy = true;
                    strategyName = position.strategy;
                    log.info(`执行策略：${strategyName}`);
                    
                    // 执行位置对应的路径文件
                    for (let i = 1; i <= position.steps; i++) {
                        if (settings.reRun) {
                            await pathingScript.runFile(`assets/pathing/rerun/${strategyName}-${i}-rerun.json`);
                            await processLeyLineOutcrop(settings.timeout, settings.forceRun, `assets/pathing/target/${settings.forceRunPath}-${i}.json`);
                            await attemptReward(settings);
                        } else {
                            await pathingScript.runFile(`assets/pathing/${strategyName}-${i}.json`);
                            await processLeyLineOutcrop(settings.timeout, settings.forceRun, `assets/pathing/target/${settings.forceRunPath}-${i}.json`);
                            await attemptReward(settings);
                        }
                    }
                    break;
                }
            }
        }

        // 未找到策略的错误处理
        if (!foundStrategy) {
            log.error("未找到对应的地脉花策略，请再次运行脚本");
            log.error("如果仍然不行，请截图*完整的*游戏界面，并反馈给作者！");
            log.error("完整的游戏界面！完整的游戏界面！完整的游戏界面！");
            return;
        }
        
        // 完成后恢复自定义标记
        await openCustomMarks();
    } catch (e) {
        log.error("出错了！ {error}", e.message);
        await openCustomMarks();
    }
})();

/**
 * 配置相关函数
 */

/**
 * 加载配置文件 
 * @returns {Object} 配置对象
 */
async function loadConfig() {
    try {
        const configData = JSON.parse(await file.readText("config.json"));
        return configData;
    } catch (error) {
        log.error(`加载配置文件失败: ${error.message}`);
        throw new Error("配置文件加载失败，请检查config.json文件是否存在");
    }
}

/**
 * 加载并验证用户设置
 * @returns {Object} 处理过的设置对象
 */
function loadSettings() {
    try {
        // 从全局settings加载用户设置
        const settingsData = {
            start: settings.start,
            leyLineOutcropType: settings.leyLineOutcropType,
            country: settings.country,
            team: settings.team,
            reRun: settings.reRun,
            friendshipTeam: settings.friendshipTeam,
            timeout: settings.timeout * 1000 ? settings.timeout * 1000 : 120000,
            count: settings.count ? settings.count : "6",
            forceRun: settings.forceRun,
            forceRunPath: settings.forceRunPath
        };
        
        // 验证必要的设置
        if (!settingsData.start) {
            throw new Error("请仔细阅读脚本介绍，并在调度器内进行配置，如果你是直接运行的脚本，请将脚本加入调度器内运行！");
        }
        
        if (!settingsData.leyLineOutcropType) {
            throw new Error("请在游戏中确认地脉花的类型，然后在js设置中选择地脉花的类型。");
        }
        
        if (!settingsData.country) {
            throw new Error("请在游戏中确认地脉花的第一个点的位置，然后在js设置中选择地脉花所在的国家。");
        }
        
        if (settingsData.friendshipTeam && !settingsData.team) {
            throw new Error("未配置战斗队伍！当配置了好感队时必须配置战斗队伍！");
        }
        
        // 处理刷取次数
        if (!/^-?\d+\.?\d*$/.test(settingsData.count)) {
            log.warn(`刷取次数 ${settingsData.count} 不是数字，使用默认次数6次`);
            settingsData.timesValue = 6;
        } else {
            // 转换为数字
            const num = parseFloat(settingsData.count);

            // 范围检查
            if (num < 1) {
                settingsData.timesValue = 1;
                log.info(`⚠️ 次数 ${num} 小于1，已调整为1`);
            } else if (num > 6) {
                settingsData.timesValue = 6;
                log.info(`⚠️ 次数 ${num} 大于6，已调整为6`);
            } else {
                // 处理小数
                if (!Number.isInteger(num)) {
                    settingsData.timesValue = Math.floor(num);
                    log.info(`⚠️ 次数 ${num} 不是整数，已向下取整为 ${settingsData.timesValue}`);
                } else {
                    settingsData.timesValue = num;
                }
            }
        }
        
        return settingsData;
    } catch (error) {
        log.error(`加载设置失败: ${error.message}`);
        throw error;
    }
}

/**
 * 地脉花寻找和定位相关函数
 */

/**
 * 查找地脉花位置
 * @param {string} country - 国家名称
 * @param {string} type - 地脉花类型
 * @param {Object} settings - 设置对象
 * @returns {Promise<void>}
 */
async function findLeyLineOutcrop(country, type, settings) {
    // 加载配置
    const config = await loadConfig();
    
    // 最大重试次数检查
    if (retryCount >= 5) {
        retryCount = 0;
        throw new Error("寻找地脉花位置失败");
    }
    
    log.info("寻找地脉花位置");
    
    // 从配置文件读取地图位置
    if (config.mapPositions[country] && config.mapPositions[country].length > 0) {
        // 使用第一个位置（默认位置）
        const defaultPos = config.mapPositions[country][0];
        await genshin.moveMapTo(defaultPos.x, defaultPos.y, country);
    } else {
        throw new Error(`未找到国家 ${country} 的位置信息`);
    }
    
    // 初始化花的引用
    currentFlower = null;

    // 尝试定位地脉花
    const found = await locateLeyLineOutcrop(country, type, config);

    // 如果未找到，进行重试
    if (!found) {
        retryCount++;

        // 首次重试时，额外步骤：传送到七天神像并关闭自定义标记
        if (retryCount == 1) {
            log.warn("传送到七天神像并关闭自定义标记以避免地脉花图标被遮挡导致找不到地脉花");
            await closeCustomMarks();
        }

        // 递归调用自身继续查找
        await findLeyLineOutcrop(country, type, settings);
    }
}

/**
 * 在地图上定位地脉花
 * @param {string} country - 国家名称
 * @param {string} type - 地脉花类型
 * @param {Object} config - 配置对象
 * @returns {Promise<boolean>} 是否找到地脉花
 */
async function locateLeyLineOutcrop(country, type, config) {
    await sleep(200);
    await genshin.setBigMapZoomLevel(3.0);
    
    // 根据花的类型选择图标路径
    const iconPath = type == "蓝花（经验书）"
        ? "assets/icon/Blossom_of_Revelation.png"
        : "assets/icon/Blossom_of_Wealth.png";

    // 查找地脉花图标
    const flowerList = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconPath)));

    if (flowerList && flowerList.count > 0) {
        // 找到地脉花，记录位置并计算坐标
        currentFlower = flowerList[0];
        const flowerType = type == "蓝花（经验书）" ? "经验" : "摩拉";

        log.info(`找到${flowerType}地脉花,位置：(${currentFlower.x},${currentFlower.y})`);

        // 计算地脉花的实际坐标
        const center = genshin.getPositionFromBigMap();
        const mapZoomLevel = genshin.getBigMapZoomLevel();
        log.info(`地图缩放级别：${mapZoomLevel}`);

        const mapScaleFactor = 2.35; // 地图缩放因子，固定值
        leyLineX = (960 - currentFlower.x - 25) * mapZoomLevel / mapScaleFactor + center.x;
        leyLineY = (540 - currentFlower.y - 25) * mapZoomLevel / mapScaleFactor + center.y;

        log.info(`地脉花的实际坐标：(${leyLineX},${leyLineY})`);
        return true; // 返回true表示找到了地脉花
    } else {
        // 未找到地脉花，尝试移动地图或重试
        if (shouldMoveMap(country, retryCount)) {
            // 移动到特定位置再次尝试
            const position = getMapPosition(country, retryCount, config);
            log.info(`移动到特定位置：(${position.x},${position.y})`);
            await genshin.moveMapTo(position.x, position.y);
            return await locateLeyLineOutcrop(country, type, config);
        }

        log.warn("未找到地脉花");
        return false; // 返回false表示未找到地脉花
    }
}

/**
 * 判断是否需要移动地图
 * @param {string} country - 国家名称
 * @param {number} retryCount - 重试次数
 * @returns {boolean} 是否需要移动地图
 */
function shouldMoveMap(country, retryCount) {
    if (retryCount == 0) return false;

    // 不同国家的重试策略
    const countryRetryMap = {
        "蒙德": [0, 1, 2],
        "璃月": [0, 1, 2],
        "稻妻": [0, 1],
        "枫丹": [0, 1],
        "纳塔": [0, 1, 2, 3]
    };

    return countryRetryMap[country] && countryRetryMap[country].includes(retryCount);
}

/**
 * 获取地图移动位置
 * @param {string} country - 国家名称
 * @param {number} retryCount - 重试次数
 * @param {Object} config - 配置对象
 * @returns {Object} 包含x,y坐标的位置对象
 */
function getMapPosition(country, retryCount, config) {
    // 从配置文件获取位置
    if (config.mapPositions[country]) {
        const positions = config.mapPositions[country];
        // 确保retryCount+1不超过位置数量
        const index = Math.min(retryCount + 1, positions.length - 1);
        return positions[index];
    }
    
    // 默认返回
    log.warn(`未找到国家 ${country} 的位置信息`);
    return { x: 0, y: 0, name: "默认位置" };
}

/**
 * 判断坐标是否在指定位置附近（误差范围内）
 * @param {number} x - 当前X坐标
 * @param {number} y - 当前Y坐标 
 * @param {number} targetX - 目标X坐标
 * @param {number} targetY - 目标Y坐标
 * @param {number} threshold - 误差阈值
 * @returns {boolean} 是否在指定范围内
 */
function isNearPosition(x, y, targetX, targetY, threshold) {
    // 使用配置中的阈值或默认值100
    const errorThreshold = threshold || 100;
    return Math.abs(x - targetX) <= errorThreshold && Math.abs(y - targetY) <= errorThreshold;
}

/**
 * 奖励和战斗相关函数
 */

/**
 * 判断是否为地脉花并处理
 * @param {number} timeout - 超时时间
 * @param {boolean} forceRun - 是否为强制运行模式
 * @param {string} targetPath - 目标路径
 * @param {number} [retries=0] - 当前函数内重试次数
 * @returns {Promise<void>}
 */
async function processLeyLineOutcrop(timeout, forceRun, targetPath, retries = 0) {
    // 设置最大重试次数，防止死循环
    const MAX_RETRIES = 3;
    
    // 如果超过最大重试次数，记录错误并返回，避免死循环
    if (retries >= MAX_RETRIES) {
        log.error(`打开地脉花失败，已重试${MAX_RETRIES}次，终止处理`);
        log.error("我辣么大一个地脉花哪去了？");
        return;
    }
    
    let ocr = captureGameRegion().find(RecognitionObject.ocrThis);
    if (ocr && ocr.text.includes("地脉溢口")) {
        log.info("识别到地脉溢口");
        await openOutcrop(targetPath);
        await autoFight(timeout);
        await autoNavigateToReward();
        const settings = { forceRun };
        await attemptReward(settings)
    } else if (ocr && ocr.text.includes("打倒所有敌人")) {
        log.info("地脉花已经打开，直接战斗");
        await autoFight(timeout);
        await autoNavigateToReward();
        const settings = { forceRun };
        await attemptReward(settings)
    } else if (ocr && ocr.text.includes("地脉之花")) {
        log.info("识别到地脉之花");
        const settings = { forceRun };
        await attemptReward(settings);
    } else {
        log.warn(`未识别到地脉花文本，当前重试次数: ${retries + 1}/${MAX_RETRIES}`);
        try {
            await pathingScript.runFile(targetPath);
            await processLeyLineOutcrop(timeout, forceRun, targetPath, retries + 1);
        } catch (error) {
            log.error(`打开地脉花失败: ${error.message}`);
        }
    }
}

/**
 * 尝试领取地脉花奖励
 * @param {Object} settings - 设置对象，包含forceRun和friendshipTeam
 * @returns {Promise<void>}
 */
async function attemptReward(settings) {
    const MAX_RETRY = 5;
    
    // 超时处理
    if (retryCount >= MAX_RETRY && !settings.forceRun) {
        retryCount = 0;
        throw new Error("超过最大重试次数，领取奖励失败");
    } else if (retryCount >= MAX_RETRY && settings.forceRun) {
        retryCount = 0;
        log.error("超过最大重试次数，领取奖励失败");
        log.info("强制运行模式，继续执行后续路线");
        await genshin.returnMainUi();
        return;
    }
    
    // 切换好感队
    if (settings.friendshipTeam) {
        log.info(`切换至队伍 ${settings.friendshipTeam}`);
        await genshin.switchParty(settings.friendshipTeam);
    }
    
    log.info("领取奖励，优先使用浓缩树脂");
    keyPress("F");
    await sleep(500);
    
    // 识别是否为地脉之花界面
    let resList = captureGameRegion().findMulti(RecognitionObject.ocrThis);
    let isValid = false;
    let condensedResin = null;
    let originalResin = null;
    let isResinEmpty = false;

    if (resList && resList.count > 0) {
        // 分析识别到的文本
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("使用浓缩树脂")) {
                isValid = true;
                condensedResin = res;
            } else if (res.text.includes("使用原粹树脂")) {
                isValid = true;
                originalResin = res;
            } else if (res.text.includes("补充原粹树脂")) {
                isValid = true;
                isResinEmpty = true;
            }
        }

        // 处理不同的树脂情况
        if (condensedResin) {
            log.info("选择使用浓缩树脂");
            click(Math.round(condensedResin.x + condensedResin.width / 2), Math.round(condensedResin.y + condensedResin.height / 2));
            if (settings.friendshipTeam) {
                log.info("切换回战斗队伍");
                await genshin.switchParty(settings.team);
            }
            return;
        } else if (originalResin) {
            log.info("选择使用原粹树脂");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
            if (settings.friendshipTeam) {
                log.info("切换回战斗队伍");
                await genshin.switchParty(settings.team);
            }
            return;
        } else if (isResinEmpty) {
            log.error("识别到补充原粹树脂，看来树脂用完了呢");
            await keyPress("VK_ESCAPE");
            throw new Error("树脂已用完");
        }
    }

    // 界面不正确，尝试重试
    if (!isValid) {
        log.info("当前界面不是地脉之花界面，重试");
        await genshin.returnMainUi();
        await sleep(1000);
        retryCount++;
        await attemptReward(settings);
    }
}

async function openOutcrop(targetPath){
    const ocrRegionX = 850;
    const ocrRegionY = 230;
    const ocrRegionWidth = 1040 - ocrRegionX;
    const ocrRegionHeight = 300 - ocrRegionY;
    let ocrRegion = { x: ocrRegionX, y: ocrRegionY, width: ocrRegionWidth, height: ocrRegionHeight };
    keyPress("F");
    await sleep(500);
    while(!recognizeFightText(ocrRegion)){
        await pathingScript.runFile(targetPath);
        keyPress("F");
        await sleep(400);
    }
    keyDown("S");
    await sleep(200);
    keyUp("S"); // 后撤一步防止被花卡住
}

/**
 * 自动战斗
 * @param {number} timeout - 超时时间
 * @returns {Promise<void>}
 */
async function autoFight(timeout) {
    const cts = new CancellationTokenSource();
    try {
        const ocrRegionX = 850;
        const ocrRegionY = 230;
        const ocrRegionWidth = 1040 - ocrRegionX;
        const ocrRegionHeight = 300 - ocrRegionY;
        let ocrRegion = { x: ocrRegionX, y: ocrRegionY, width: ocrRegionWidth, height: ocrRegionHeight };
        
        log.info("开始战斗");
        dispatcher.RunTask(new SoloTask("AutoFight"), cts);
        let fightResult = await recognizeTextInRegion(ocrRegion, timeout) ? "成功" : "失败";
        log.info(`战斗结束，战斗结果：${fightResult}`);
        cts.cancel();
    } catch (error) {
        log.error(`执行过程中出错: ${error}`);
    }
}

/**
 * 识别战斗结果
 * @param {Object} ocrRegion - OCR识别区域
 * @param {number} timeout - 超时时间
 * @returns {Promise<boolean>} 战斗是否成功
 */
async function recognizeTextInRegion(ocrRegion, timeout) {
    let startTime = Date.now();
    const successKeywords = ["挑战达成", "战斗胜利", "挑战成功"];
    const failureKeywords = ["挑战失败"];
    
    // 循环检测直到超时
    while (Date.now() - startTime < timeout) {
        try {
            let result = captureGameRegion().find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            let text = result.text;
            
            // 检查成功关键词
            for (let keyword of successKeywords) {
                if (text.includes(keyword)) {
                    log.info("检测到战斗成功关键词: {0}", keyword);
                    return true;
                }
            }
            
            // 检查失败关键词
            for (let keyword of failureKeywords) {
                if (text.includes(keyword)) {
                    log.warn("检测到战斗失败关键词: {0}", keyword);
                    return false;
                }
            }
        }
        catch (error) {
            log.error("OCR过程中出错: {0}", error);
        }
        await sleep(1000); // 检查间隔
    }
    
    log.warn("在超时时间内未检测到战斗结果");
    return false;
}

function recognizeFightText(ocrRegion){
    try{
        let result = captureGameRegion().find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
        let text = result.text;
        keywords = ["打倒","所有","敌人"];
        for(let keyword of keywords){
            if(text.includes(keyword)){
                return true;
            }
        }
        return false;
    }catch(error){
        log.error("OCR过程中出错: {0}", error);
    }
}

/**
 * 地图标记相关函数
 */

/**
 * 关闭自定义标记，使用前确保在地图界面
 * @returns {Promise<void>}
 */
async function closeCustomMarks() {
    // await genshin.returnMainUi();
    // keyPress("M");
    await sleep(600);
    click(60, 1020);
    await sleep(600);
    
    let button = captureGameRegion().find(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/open.png"),));
    if (button) {
        log.info("关闭自定义标记");
        click(Math.round(button.x + button.width / 2), Math.round(button.y + button.height / 2));
        await sleep(600);
    } else {
        log.error("未找到开关按钮");
    }
}

/**
 * 打开自定义标记，使用前确保在地图界面
 * @returns {Promise<void>}
 */
async function openCustomMarks() {
    await sleep(600);
    click(60, 1020);
    await sleep(600);
    
    let button = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/close.png"),));
    if (button) {
        for (let i = 0; i < button.count; i++) {
            let b = button[i];
            if (b.y > 280 && b.y < 350) {
                log.info("打开自定义标记");
                click(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
            }
        }
    } else {
        log.error("未找到开关按钮");
    }
}

/**
 * 自动导航到地脉花奖励点
 * @returns {Promise<void>}
 */
async function autoNavigateToReward() {
    // 定义识别对象
    const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/box.png"));
    const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50); // 领奖区域检测
    let advanceNum = 0; // 前进次数

    // 调整初始视角为俯视角
    log.info("调整为俯视视角...");
    middleButtonClick();
    await sleep(1000);
    moveMouseBy(0, 1030);
    await sleep(500);
    moveMouseBy(0, 920);
    await sleep(500);
    moveMouseBy(0, 710);
    await sleep(500);
    
    log.info("开始自动导航到地脉花...");
    while (true) {
        // 1. 优先检查是否已到达领奖点
        let captureRegion = captureGameRegion();
        let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
        let ocrResults = rewardTextArea.findMulti(RecognitionObject.ocrThis);
        
        // 检测到地脉之花文字则结束
        if (ocrResults.count > 0 && ocrResults[0].text.trim().length > 0) {
            for(let i = 0; i < ocrResults.count; i++){
                if(ocrResults[i].text.includes("地脉之花")){
                    log.info("已到达领奖点，检测到文字: " + ocrResults[i].text);
                    return;
                }
            }
        }
        else if(advanceNum > 80){
            throw new Error('前进时间超时');
        }
        
        // 2. 未到达领奖点，则调整视野
        await adjustViewForReward(boxIconRo, advanceNum);
        
        // 3. 前进一小步
        keyDown("w");
        await sleep(900);
        keyUp("w");
        await sleep(100); // 等待角色移动稳定
        advanceNum++;
    }
}

/**
 * 调整视野直到图标位于正前方
 * @param {Object} boxIconRo - 宝箱图标识别对象
 * @param {number} advanceNum - 当前前进次数
 * @returns {Promise<void>}
 */
async function adjustViewForReward(boxIconRo, advanceNum) {
    for(let i = 0; i < 100; i++) {
        let captureRegion = captureGameRegion();
        let iconRes = captureRegion.Find(boxIconRo);
        
        if (!iconRes) {
            // 未找到图标，小幅度转动视角
            moveMouseBy(20, 0);
            await sleep(100);
            continue;
        }
        
        if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {    
            log.info(`视野已调正，前进第 ${advanceNum} 次`);
            return;
        } else {
            // 小幅度调整
            let adjustAmount = iconRes.x < 920 ? -20 : 20;
            let adjustAmount2 = iconRes.y < 540 ? 1 : 10;
            moveMouseBy(adjustAmount*adjustAmount2, 0);
            await sleep(100);
        }       
    }

    throw new Error('视野调整超时');
}
