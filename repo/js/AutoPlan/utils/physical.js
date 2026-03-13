import {getJsonPath, toMainUi, throwError,findImgAndClick} from "./tool";
//====================================================
const genshinJson = {
    width: 1920,//genshin.width,
    height: 1080,//genshin.height,
}
// const MinPhysical = settings.minPhysical?parseInt(settings.minPhysical+''):parseInt(20+'')
// const OpenModeCountMin = settings.openModeCountMin
// let AlreadyRunsCount=0
// let NeedRunsCount=0
const TemplateOrcJson = {x: 1568, y: 16, width: 225, height: 60,}

// ==================== 常量定义 ====================

// 树脂图标识别对象
const RESIN_ICONS = {
    ORIGINAL: RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/original_resin.png")),
    // CONDENSED: RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/condensed_resin.png")),
    // FRAGILE: RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/fragile_resin.png")),
    // TRANSIENT: RecognitionObject.TemplateMatch(file.ReadImageMatSync("RecognitionObject/transient_resin.png")),
    // REPLENISH_BUTTON: RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/replenish_resin_button.png"))
};
// 配置常量
const CONFIG = {
    RECOGNITION_TIMEOUT: 2000,      // 图像识别超时时间（毫秒）
    SLEEP_INTERVAL: 500,            // 循环间隔时间（毫秒）
    UI_DELAY: 1500,                 // UI操作延迟时间（毫秒）
    MAP_ZOOM_LEVEL: 6,              // 地图缩放级别

    // 点击坐标
    COORDINATES: {
        MAP_SWITCH: {x: 1840, y: 1020},    // 地图右下角切换按钮
        MONDSTADT: {x: 1420, y: 180},      // 蒙德选择按钮
        AVOID_SELECTION: {x: 1090, y: 450}  // 避免选中效果的点击位置
    },

    // OCR识别区域配置
    OCR_REGIONS: {
        ORIGINAL_RESIN: {width: 200, height: 40},
        CONDENSED_RESIN: {width: 90, height: 40},
        OTHER_RESIN: {width: 0, height: 60}  // width会根据图标宽度动态设置
    }
};

//====================================================


/**
 * 从字符串中提取数字并组合成一个整数
 * @param {string} str - 包含数字的字符串
 * @returns {number} - 由字符串中所有数字组合而成的整数
 */
async function saveOnlyNumber(str, defaultValue = 0) {
    // 使用正则表达式匹配字符串中的所有数字
    // \d+ 匹配一个或多个数字
    // .join('') 将匹配到的数字数组连接成一个字符串
    // parseInt 将连接后的字符串转换为整数
    try {
        return parseInt(str.match(/\d+/g).join(''));
    } catch (e) {
        return defaultValue
    }
}

/**
 * 识别原粹树脂（体力）的函数
 * @param {boolean} [opToMainUi=false] - 是否操作到主界面
 * @param {boolean} [openMap=false] - 是否打开地图界面
 * @param {number} [minPhysical=20] - 最小可执行体力值
 * @param {boolean} [isResinExhaustionMode=true] - 是否启用体力识别功能
 * @returns {Promise<Object>} 返回一个包含识别结果的Promise对象
 *   - ok {boolean}: 是否可执行（体力是否足够）
 *   - min {number}: 最小可执行体力值
 *   - current {number}: 当前剩余体力值
 */
async function ocrPhysical(opToMainUi = false, openMap = false, minPhysical = 20, isResinExhaustionMode = true) {
    // 检查是否启用体力识别功能，如果未启用则直接返回默认结果
    if (!isResinExhaustionMode) {
        log.info(`===未启用===`)
        return {
            ok: true,
            min: 0,
            current: 0,
        }
    }
    log.debug(`===开始识别原粹树脂===`)
    let ms = 1000  // 定义操作延迟时间（毫秒）
    if (opToMainUi) {
        await sleep(ms)
        await toMainUi();  // 切换到主界面
    }

    if (openMap) {
        await sleep(ms)
        //打开地图界面
        await keyPress('M')
    }
    await sleep(ms)
    log.debug(`===[点击+]===`)
    // //点击+ 按钮 x=1264,y=39,width=18,height=19
    let add_buttonJSON = getJsonPath('add_button');
    let add_objJson = {
        path: `${add_buttonJSON.path}${add_buttonJSON.name}${add_buttonJSON.type}`,
        x: 1373,
        y: 22,
        width: 52,
        height: 49,
    }
    //
    // let templateMatchAddButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${add_objJson.path}`), add_objJson.x, add_objJson.y, add_objJson.width, add_objJson.height);
    // let regionA = captureGameRegion()
    // // let deriveCrop = regionA.DeriveCrop(add_objJson.x, add_objJson.y, add_objJson.width, add_objJson.height);
    // try {
    //     let buttonA = regionA.find(templateMatchAddButtonRo);
    //
    //     await sleep(ms)
    //     if (!buttonA.isExist()) {
    //         log.error(`${add_objJson.path}匹配异常`)
    //         throwError(`${add_objJson.path}匹配异常`)
    //     }
    //     await buttonA.click()
    // } finally {
    //     // deriveCrop.dispose()
    //     regionA.dispose()
    // }
    const addClick = await findImgAndClick(`${add_objJson.path}`,1248, 21, 50, 50);
    if (addClick===null) {
        throwError(`${add_objJson.path}匹配异常`)
    }
    await sleep(ms)

    log.debug(`===[定位原粹树脂]===`)
    //定位月亮
    let jsonPath = getJsonPath('yue');
    let tmJson = {
        path: `${jsonPath.path}${jsonPath.name}${jsonPath.type}`,
        x: TemplateOrcJson.x,
        y: TemplateOrcJson.y,
        width: TemplateOrcJson.width,
        height: TemplateOrcJson.height,
    }
    let templateMatchButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${tmJson.path}`), tmJson.x, tmJson.y, tmJson.width, tmJson.height);
    let region = captureGameRegion()
    let button
    try {
        button = region.find(templateMatchButtonRo);
        await sleep(ms)
        if ((!button) || !button.isExist()) {
            log.error(`${tmJson.path} 匹配异常`)
            throwError(`${tmJson.path} 匹配异常`)
        }
    } finally {
        region.dispose()
    }


    log.debug(`===[识别原粹树脂]===`)
    //识别体力 x=1625,y=31,width=79,height=30 / x=1689,y=35,width=15,height=26
    let ocr_obj = {
        // x: 1623,
        x: button.x + button.width,
        // y: 32,
        y: button.y,
        // width: 61,
        width: Math.abs(genshinJson.width - button.x - button.width),
        height: 26
    }

    log.debug(`ocr_obj: x={x},y={y},width={width},height={height}`, ocr_obj.x, ocr_obj.y, ocr_obj.width, ocr_obj.height)
    let region3 = captureGameRegion()

    try {
        let recognitionObjectOcr = RecognitionObject.Ocr(ocr_obj.x, ocr_obj.y, ocr_obj.width, ocr_obj.height);
        let res = region3.find(recognitionObjectOcr);

        log.debug(`[OCR原粹树脂]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
        let text = res.text.split('/')[0]
        let current = await saveOnlyNumber(text)
        let execute = (current - minPhysical) >= 0
        log.debug(`最小可执行原粹树脂:{min},原粹树脂:{key}`, minPhysical, current,)

        // await keyPress('VK_ESCAPE')
        return {
            ok: execute,
            min: minPhysical,
            current: current,
        }
    } catch (e) {
        throwError(`识别失败,err:${e.message}`)
    } finally {
        region3.dispose()
        //返回地图操作
        if (opToMainUi) {
            await toMainUi();  // 切换到主界面
        }
    }

}

// ==================== UI操作函数 ====================

/**
 * 打开并设置地图界面
 */
async function openMap() {
    log.info("打开地图界面");
    keyPress("M");
    await sleep(CONFIG.UI_DELAY);

    // 切换到国家选择界面
    // click(CONFIG.COORDINATES.MAP_SWITCH.x, CONFIG.COORDINATES.MAP_SWITCH.y);
    // await sleep(CONFIG.UI_DELAY);

    // 选择蒙德
    // click(CONFIG.COORDINATES.MONDSTADT.x, CONFIG.COORDINATES.MONDSTADT.y);
    // await sleep(CONFIG.UI_DELAY);
    // await switchtoCountrySelection(CONFIG.COORDINATES.MONDSTADT.x, CONFIG.COORDINATES.MONDSTADT.y)

    // 设置地图缩放级别，排除识别干扰
    await genshin.setBigMapZoomLevel(CONFIG.MAP_ZOOM_LEVEL);
    log.info("地图界面设置完成");
}
/**
 * 统计所有树脂数量的主函数
 * @returns {Object} 包含所有树脂数量的对象
 */
async function countAllResin() {
    try {
        // setGameMetrics(1920, 1080, 1);
        // log.info("开始统计树脂数量");
        let resinCounts = {
            original: 0,
            transient: undefined,
            fragile: undefined,
            condensed: undefined
        }
        await genshin.returnMainUi();
        await sleep(CONFIG.UI_DELAY);

        // 打开地图界面统计原粹/浓缩树脂
        await openMap();
        await sleep(CONFIG.UI_DELAY);
        let tryPass = true;
        try {
            // log.info("[开始]统计补充树脂界面中的树脂");
            resinCounts.original = await countOriginalResin(false, false);
            moveMouseTo(CONFIG.COORDINATES.AVOID_SELECTION.x, CONFIG.COORDINATES.AVOID_SELECTION.y)
            await sleep(500);
            // resinCounts.transient = await countTransientResin();
            // resinCounts.fragile = await countFragileResin();
            // log.info("[完成]统计补充树脂界面中的树脂");
            // 点击避免选中效果影响统计
            click(CONFIG.COORDINATES.AVOID_SELECTION.x, CONFIG.COORDINATES.AVOID_SELECTION.y);
        } catch (e) {
            tryPass = false
        }
        await sleep(CONFIG.UI_DELAY);
        log.info("开始统计地图界面中的树脂");
        if (!tryPass) {
            // 如果第一次尝试失败，则切换到蒙德
            await switchtoCountrySelection(CONFIG.COORDINATES.MONDSTADT.x, CONFIG.COORDINATES.MONDSTADT.y)
            resinCounts.original = await countOriginalResin(!tryPass);
        }
        // resinCounts.condensed = await countCondensedResin();
        // if (!tryPass) {
            // 打开补充树脂界面统计须臾/脆弱树脂
            // await openReplenishResinUi();
            // await sleep(CONFIG.UI_DELAY);

            // 点击避免选中效果影响统计
            // click(CONFIG.COORDINATES.AVOID_SELECTION.x, CONFIG.COORDINATES.AVOID_SELECTION.y);
            // await sleep(500);

            // log.info("开始统计补充树脂界面中的树脂");
            // resinCounts.transient = await countTransientResin();
            // resinCounts.fragile = await countFragileResin();
        // }
        // 显示结果
        displayResults(resinCounts);

        // 返回主界面
        await genshin.returnMainUi();
        await sleep(CONFIG.UI_DELAY);

        log.info("树脂统计完成");
        return {
            originalResinCount: resinCounts.original,
            condensedResinCount: resinCounts.condensed,
            transientResinCount: resinCounts.transient,
            fragileResinCount: resinCounts.fragile
        };

    } catch (error) {
        log.error(`统计树脂数量时发生异常: ${error.message}`);
        throw error;
    }
}
/**
 * 切换到国家选择界面的异步函数
 * 通过点击指定坐标并等待界面加载来完成切换操作
 */
async function switchtoCountrySelection(x, y) {
    // 切换到国家选择界面
    click(CONFIG.COORDINATES.MAP_SWITCH.x, CONFIG.COORDINATES.MAP_SWITCH.y);
    await sleep(CONFIG.UI_DELAY);
    click(x, y);
    await sleep(CONFIG.UI_DELAY);
}
function displayResults(results) {
    const resultText = `原粹:${results.original} 浓缩:${results.condensed} 须臾:${results.transient} 脆弱:${results.fragile}`;

    log.info(`============ 树脂统计结果 ============`);
    log.info(`原粹树脂数量: ${results.original}`);
    log.info(`浓缩树脂数量: ${results.condensed}`);
    log.info(`须臾树脂数量: ${results.transient}`);
    log.info(`脆弱树脂数量: ${results.fragile}`);
    log.info(`====================================`);
}

/**
 * 统计原粹树脂数量
 * @returns {number} 原粹树脂数量
 */
async function countOriginalResin(tryOriginalMode, opToMainUi, openMap) {
    if (tryOriginalMode) {
        log.info("尝试使用原始模式");
        return await countOriginalResinBackup()
    } else {
        log.info('尝试使用优化模式');
        let ocr_physical = await ocrPhysical(opToMainUi, openMap);
        log.debug(`ocrPhysical: {0}`, JSON.stringify(ocr_physical))
        await sleep(600)
        // ocrPhysical = false//模拟异常
        if (ocr_physical/* && ocrPhysical.ok*/) {
            return ocr_physical?.current;
        } else {
            //异常 退出至地图 尝试使用原始模式
            await keyPress("VK_ESCAPE")
            log.error(`ocrPhysical error`);
            throw new Error("ocrPhysical error");
        }
    }
}


async function countOriginalResinBackup() {
    const originalResin = await recognizeImage(RESIN_ICONS.ORIGINAL);
    if (!originalResin) {
        log.warn(`未找到原粹树脂图标`);
        return 0;
    }

    const ocrRegion = {
        x: originalResin.x,
        y: originalResin.y,
        width: CONFIG.OCR_REGIONS.ORIGINAL_RESIN.width,
        height: CONFIG.OCR_REGIONS.ORIGINAL_RESIN.height
    };

    // 匹配 xxx/200 格式中的第一个数字（1-3位）
    const count = await recognizeNumberByOCR(ocrRegion, /(\d{1,3})\/\d+/);
    if (count !== null) {
        log.info(`原粹树脂数量: ${count}`);
        return count;
    }

    log.warn(`未能识别原粹树脂数量`);
    return 0;
}

/**
 * 通过OCR识别数字
 * @param {Object} ocrRegion - OCR识别区域
 * @param {RegExp} pattern - 匹配模式
 * @returns {number|null} 识别到的数字或null
 */
async function recognizeNumberByOCR(ocrRegion, pattern) {
    let resList = null;
    let captureRegion = null;
    try {
        const ocrRo = RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        captureRegion = captureGameRegion();
        resList = captureRegion.findMulti(ocrRo);

        if (!resList || resList.length === 0) {
            log.warn("OCR未识别到任何文本");
            return null;
        }

        for (const res of resList) {
            if (!res || !res.text) {
                continue;
            }

            const numberMatch = res.text.match(pattern);
            if (numberMatch) {
                const number = parseInt(numberMatch[1] || numberMatch[0]);
                if (!isNaN(number)) {
                    return number;
                }
            }
        }
        return null;
    } catch (error) {
        log.error(`OCR识别时发生异常: ${error.message}`);
        return null;
    } finally {
        if (resList && typeof resList.dispose === 'function') {
            resList.dispose();
        }
        if (captureRegion && typeof captureRegion.dispose === 'function') {
            captureRegion.dispose();
        }
    }
}

export {
    ocrPhysical,
    countOriginalResin,
    countAllResin,
}