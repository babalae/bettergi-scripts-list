import {getJsonPath, toMainUi,throwError} from "./tool";
//====================================================
const genshinJson = {
    width: 1920,//genshin.width,
    height: 1080,//genshin.height,
}
// const MinPhysical = settings.minPhysical?parseInt(settings.minPhysical+''):parseInt(20+'')
// const OpenModeCountMin = settings.openModeCountMin
// let AlreadyRunsCount=0
// let NeedRunsCount=0
const TemplateOrcJson={x: 1568, y: 16, width: 225, height: 60,}
//====================================================


/**
 * 从字符串中提取数字并组合成一个整数
 * @param {string} str - 包含数字的字符串
 * @returns {number} - 由字符串中所有数字组合而成的整数
 */
async function saveOnlyNumber(str,defaultValue=0) {
    // 使用正则表达式匹配字符串中的所有数字
    // \d+ 匹配一个或多个数字
    // .join('') 将匹配到的数字数组连接成一个字符串
    // parseInt 将连接后的字符串转换为整数
    try {
        return parseInt(str.match(/\d+/g).join(''));
    }catch (e) {
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
async function ocrPhysical(opToMainUi = false,openMap=false,minPhysical=20,isResinExhaustionMode=true) {
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

    if (openMap){
        await sleep(ms)
        //打开地图界面
        await keyPress('M')
    }
    await sleep(ms)
    log.debug(`===[点击+]===`)
    //点击+ 按钮 x=1264,y=39,width=18,height=19
    let add_buttonJSON = getJsonPath('add_button');
    let add_objJson = {
        path: `${add_buttonJSON.path}${add_buttonJSON.name}${add_buttonJSON.type}`,
        x: 1373,
        y: 22,
        width: 52,
        height: 49,
    }
    let templateMatchAddButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${add_objJson.path}`), add_objJson.x, add_objJson.y, add_objJson.width, add_objJson.height);
    let regionA = captureGameRegion()
    // let deriveCrop = regionA.DeriveCrop(add_objJson.x, add_objJson.y, add_objJson.width, add_objJson.height);
    try {
        let buttonA = regionA.find(templateMatchAddButtonRo);

        await sleep(ms)
        if (!buttonA.isExist()) {
            log.error(`${add_objJson.path}匹配异常`)
            throwError(`${add_objJson.path}匹配异常`)
        }
        await buttonA.click()
    }finally {
        // deriveCrop.dispose()
        regionA.dispose()
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
    let region =captureGameRegion()
    let button
    try {
        button = region.find(templateMatchButtonRo);
        await sleep(ms)
        if ((!button)||!button.isExist()) {
            log.error(`${tmJson.path} 匹配异常`)
            throwError(`${tmJson.path} 匹配异常`)
        }
    }finally {
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
        width: Math.abs(genshinJson.width  - button.x - button.width),
        height: 26
    }

    log.debug(`ocr_obj: x={x},y={y},width={width},height={height}`, ocr_obj.x, ocr_obj.y, ocr_obj.width, ocr_obj.height)
    let region3 = captureGameRegion()

    try {
        let recognitionObjectOcr = RecognitionObject.Ocr(ocr_obj.x, ocr_obj.y, ocr_obj.width, ocr_obj.height);
        let res = region3.find(recognitionObjectOcr);

        log.debug(`[OCR原粹树脂]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
        let text=res.text.split('/')[0]
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

export {
    ocrPhysical,
}