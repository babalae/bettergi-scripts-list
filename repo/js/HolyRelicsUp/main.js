
eval(file.readTextSync(`utils/languageUtils.js`));

async function init() {
    let manifest = JSON.parse(file.readTextSync("manifest.json"));
    log.info(`版本:{version}`, manifest.version);
    let utils=[
        "holyRelicsUpUtils",
    ]
    for (let util of utils) {
        eval(file.readTextSync(`utils/${util}.js`));
    }
    log.info("初始化完成");
    warn('holyRelicPartMapBySift==>' + JSON.stringify(Array.from(holyRelicPartMapBySift)), must)
}
/**
 * 主方法
 * @returns {Promise<void>}
 */
async function main(log_off = config.log_off) {
    let ms = 600
    setGameMetrics(1920, 1080, 1); // 设置游戏窗口大小和DPI


    if (genshinJson.width != 1920 && genshinJson.height != 1080) {
        warn(`分辨率不是1920x1080，请修改分辨率后运行！`, must)
        return
    }

    if (config.refreshSettingsByLanguage) {
        await refreshSettings()
        holyRelicsUpUtils.sendMessage(`update ${config.language} to settings ok`)
        return
    }

    if (config.enableBatchUp) { // 检查是否启用
        if (config.toBag) {
            await wait(ms);
            await toMainUi()
            await wait(ms);
            //打开背包
            await openKnapsack();
            await wait(ms);
            await openHolyRelicsKnapsack();
        }

        if (config.toSort || config.toSift) {
            await wait(ms);
            //排序
            await openPrerequisitesAll(log_off);
        }

        if (!config.toSift) {
            let filteredJson = getJsonPath('filtered', false);
            let template = await templateMatch(`${filteredJson.path}${filteredJson.name}${filteredJson.type}`)
            if (isExist(template)) {
                config.toSift = true
            }
        }

        await wait(ms);
        if (config.enableAttributeHolyRelic) {

            if (config.sortMain.includes(mana.get('asc_order'))) {
                throwError(`不支持在升序情况下使用`)
            }
            warn(`启用圣遗物强化命中功能(实验功能)`, must)
            if (config.meetAllSiftAttributeHolyRelic && config.upMax === 20) {
                await info(`开始验证...`, must)
                let valid = await validHitPreamble()
                //验证不属于 未选中满级 未选中未满级条件下
                if (!valid) {
                    throwError(`启用圣遗物强化命中功能(实验功能)时，不支持降序选中满级|未满级条件下强化+20操作`)
                    return
                }
            }
            await bathClickUpLv2(config.insertionMethod)
        } else {
            await bathClickUpLv1(config.insertionMethod)
        }
    } else {
        throwError(`未启用批量强化请去浏览文档后开启！`)
    }
}

//========================以下为原有封装==============================
function info(msg, must = false) {
    holyRelicsUpUtils.info(msg, must, config.log_off)
}

function warn(msg, must = false) {
    holyRelicsUpUtils.warn(msg, must, config.log_off)
}

function debug(msg, must = false) {
    holyRelicsUpUtils.debug(msg, must, config.log_off)
}

function error(msg, must = false) {
    holyRelicsUpUtils.error(msg, must, config.log_off)
}

function throwError(msg) {
    holyRelicsUpUtils.throwError(msg)
}

function openCaptureGameRegion() {
    return holyRelicsUpUtils.openCaptureGameRegion()
}

function closeCaptureGameRegion(region) {
    holyRelicsUpUtils.closeCaptureGameRegion(region)
}

function findByCaptureGameRegion(region, templateMatchObject) {
    return holyRelicsUpUtils.findByCaptureGameRegion(region, templateMatchObject)
}

function findMultiByCaptureGameRegion(region, templateMatchObject) {
    return holyRelicsUpUtils.findMultiByCaptureGameRegion(region, templateMatchObject)
}

function mTo(x, y) {
    holyRelicsUpUtils.mTo(x, y);
}

function recognitionObjectOcr(x, y, width, height) {
    return holyRelicsUpUtils.recognitionObjectOcr(x, y, width, height)
}

function downLeftButton() {
    holyRelicsUpUtils.downLeftButton();
}

function upLeftButton() {
    holyRelicsUpUtils.upLeftButton();
}

function moveByMouse(x, y) {
    holyRelicsUpUtils.moveByMouse(x, y);
}

async function wait(ms = 1000) {
    // 等待300毫秒，确保按下操作生效
    await holyRelicsUpUtils.wait(ms);
}

function downClick(x, y) {
    holyRelicsUpUtils.downClick(x, y);
}

/**
 * 检查资源是否存在
 * @param {Object} res - 需要检查的资源对象
 * @returns {Boolean} 返回资源是否存在的结果
 *                  true表示资源存在，false表示资源不存在
 */
function isExist(res) {
    return holyRelicsUpUtils.isExist(res) // 调用资源对象的isExist方法获取存在状态
}

//========================以上为原有封装==============================
//========================以下为基本配置==============================
const LanguageALLConfigMap = languageUtils.getLanguageALLConfigMap()

const LanguageMap = languageUtils.getLanguageMap()
const LanguageMsgMap = languageUtils.getLanguageMsgMap()
const LanguageKey = LanguageMap.get(settings.language)
if (LanguageKey === null || !LanguageKey) {
    let languageMsg = LanguageMsgMap.get(settings.language)
        .replace('language-key', `${settings.language}`)
        .replace('languageList-key', `${Array.from(LanguageMap.keys()).join(',')}`)
    throwError(languageMsg)
}
const LanguageConfigJson = LanguageALLConfigMap.get(LanguageKey)
//魔法值
const mana = LanguageConfigJson.mana

//刷新设置列表
async function refreshSettings() {
    await warn(JSON.stringify("settings==>" + LanguageConfigJson.settings), must)
    await holyRelicsUpUtils.updateSettingsFile(JSON.parse(LanguageConfigJson.settings))
}

function siftAll() {
    //筛选条件
    let baseSiftArray = new Array()
    baseSiftArray.push(mana.get('holyRelicsNoMax'))
    if (settings.holyRelicsLockMark) {
        baseSiftArray.push(mana.get('holyRelicsLockMark'))
    }
    if (settings.holyRelicsLockY) {
        baseSiftArray.push(mana.get('holyRelicsLockY'))
    }
    if (settings.holyRelicsLockN) {
        baseSiftArray.push(mana.get('holyRelicsLockN'))
    }
    if (settings.holyRelicsEquipY) {
        baseSiftArray.push(mana.get('holyRelicsEquipY'))
    }
    if (settings.holyRelicsEquipN) {
        baseSiftArray.push(mana.get('holyRelicsEquipN'))
    }
    if (settings.holyRelicsSourceFrostSaint) {
        baseSiftArray.push(mana.get('holyRelicsSourceFrostSaint'))
    }
    return baseSiftArray
}

function sortAll() {
    //筛选条件
    let baseSortArray = new Array()
    if (settings.sortMain === mana.get('desc_order')) {
        baseSortArray.push(settings.sortMain)
    }
    if (settings.sortAuxiliary === mana.get('quality_order')) {
        baseSortArray.push(settings.sortAuxiliary)
    }
    return baseSortArray
}

const must = true
const config = settings.refreshSettingsByLanguage ?
    {
        language: settings.language,
        refreshSettingsByLanguage: settings.refreshSettingsByLanguage,
    }
    :
    {
        suit: settings.suit,
        log_off: settings.log_off,
        countMaxByHoly: Math.floor(settings.countMaxByHoly),//筛选圣遗物界面最大翻页次数
        enableBatchUp: settings.enableBatchUp,//启用批量强化
        defaultEnhancedInterface: settings.defaultEnhancedInterface,//默认强化界面
        toBag: settings.toBag,//启用自动进入背包
        enableInsertionMethod: settings.enableInsertionMethod,//是否开启插入方式
        insertionMethod: settings.insertionMethod,//插入方式
        material: settings.material,//材料
        upMax: parseInt(settings.upMax + ''),//升级次数
        upMaxCount: settings.upMaxCount + '',//设置升级圣遗物个数
        knapsackKey: settings.knapsackKey,//背包快捷键
        toSort: settings.toSort,
        sortAuxiliary: settings.sortAuxiliary,//辅助排序
        sortMain: settings.sortMain,//主排序
        sortAttribute: settings.sortAttribute,//属性条件
        sortArray: (sortAll()),
        toSift: settings.toSift,
        siftArray: (siftAll()),//筛选条件
        enableAttributeHolyRelic: settings.enableAttributeHolyRelic,//启用圣遗物属性
        inputAttributeHolyRelic: settings.inputAttributeHolyRelic,//自定义圣遗物属性
        commonAttributeHolyRelic: settings.commonAttributeHolyRelic,//通用圣遗物属性
        coverAttributeHolyRelic: settings.coverAttributeHolyRelic,//覆盖圣遗物通用属性以部件为单位
        coverSiftAttributeHolyRelic: settings.coverSiftAttributeHolyRelic,//覆盖圣遗物通用属性以筛选条件为单位
        meetAllSiftAttributeHolyRelic: settings.meetAllSiftAttributeHolyRelic,//满足所有筛选条件
        commonSiftAttributeHolyRelic: settings.commonSiftAttributeHolyRelic,//通用筛选条件
        inputSiftAttributeHolyRelic: settings.inputSiftAttributeHolyRelic,//自定义筛选条件
        language: settings.language,
        refreshSettingsByLanguage: settings.refreshSettingsByLanguage,
    }


const genshinJson = {
    width: 1920,//genshin.width,
    height: 1080,//genshin.height,
}


const attributeMap = LanguageConfigJson.attributeMap
const attributeList = LanguageConfigJson.attributeList
const attributeFixedMap = LanguageConfigJson.attributeFixedMap
const AttributeHolyRelickeys = LanguageConfigJson.attributeHolyRelickeys
const HolyRelicPartsAsMap = LanguageConfigJson.holyRelicPartsAsMap
const HolyRelicParts = LanguageConfigJson.holyRelicParts
// @ -- 表示部件 # -- 表示主词条 * --表示副词条
// | -- 表示部件终止(多个部件不可忽略) & -- 表示主词条终止(主词条存在不可忽略) ! --表示副词条终止(可忽略)
//(全)==>(简)
//@花*生命%*攻击!|@杯#生命%#物伤&*生命%!|==>  @花*生命%*攻击|@杯#生命%#物伤&*生命%
// let jsonHolyRelicParts =[
//     {
//         name: '',//部件
//         main:[],//主词条
//         sub:[],//副词条
//     }
// ]
const commonHolyRelicPartMap = !config.enableAttributeHolyRelic ? [] : parseHolyRelicToMap(config.commonAttributeHolyRelic)
const holyRelicPartMap = !config.enableAttributeHolyRelic ? [] : (!config.coverAttributeHolyRelic ? parseHolyRelicToMap() : takeDifferentHolyRelicToMap(parseHolyRelicToMap(), commonHolyRelicPartMap))

const commonHolyRelicPartMapBySift = !config.enableAttributeHolyRelic ? [] : parseHolyRelicToMap(config.commonSiftAttributeHolyRelic)
const holyRelicPartMapBySift = !config.enableAttributeHolyRelic ? [] :
    (!config.coverSiftAttributeHolyRelic ? parseHolyRelicToMap(config.inputSiftAttributeHolyRelic) :
        takeDifferentHolyRelicToMap(parseHolyRelicToMap(config.inputSiftAttributeHolyRelic), commonHolyRelicPartMapBySift))

/**
 * 属性值替换函数
 * @param value
 * @returns {string}
 */
function attributeReplacement(value) {
    value = value.trim()
    if (value.includes('%')) {
        value = value.replace('%', '')
        let s = attributeMap.get(value);
        value = (s === null || !s ? value : s) + attributeMap.get('%')
    } else {
        let s = attributeMap.get(value);
        value = (s === null || !s ? value : s)
    }
    return value
}

//基础目录
const path_base_main = `assets/language/${LanguageKey}/`
// const path_base_sort = `${path_base_main}sort/`

const commonPath = `assets/common/`
const commonMap = new Map([
    ['bag', {name: '背包', type: '.jpg'}],
    // ['exp', {name: 'exp', type: '.jpg'}],
    ['slide_bar_main_down', {name: 'slide_bar_main_down', type: '.png'}],
    ['slide_bar_main_up', {name: 'slide_bar_main_up', type: '.png'}],
    ['main_interface', {name: '主界面', type: '.png'}],
    ['five_star', {name: '五星', type: '.jpg'}],
    ['close_settings', {name: '关闭设置', type: '.jpg'}],
    // ['delete', {name: '删除键', type: '.jpg'}],
    // ['package', {name: '包裹', type: '.jpg'}],
    ['holy_relic', {name: '圣遗物', type: '.jpg'}],
    ['sort', {name: '排序', type: '.jpg'}],
    // ['sort_progress_bar_bottom_arrow', {name: '排序进度条底部箭头', type: '.jpg'}],
    ['click_close', {name: '点击关闭', type: '.jpg'}],
    ['click_open', {name: '点击开启', type: '.jpg'}],
    ['confirm', {name: '确认', type: '.jpg'}],
    ['sift', {name: '筛选', type: '.jpg'}],
    // ['sift_holy_relic', {name: '筛选圣遗物套装', type: '.jpg'}],
    ['return_key', {name: '返回键', type: '.jpg'}],
    ['enter_filter_holy_relic_ui', {name: '进入筛选圣遗物界面', type: '.jpg'}],
    // ['progress_bar', {name: '进度条', type: '.jpg'}],
    // ['enter_progress_bar_bottom', {name: '进度条底部', type: '.jpg'}],
    // ['enter_progress_bar_top', {name: '进度条顶部', type: '.jpg'}],
    // ['enter_progress_bar_top_arrow', {name: '进度条顶部箭头', type: '.jpg'}],
    // ['send_gift_gift_choose', {name: '选择素材条件按键', type: '.jpg'}],
    ['reset', {name: '重置', type: '.jpg'}],
    ['setting_button', {name: '设置按键', type: '.jpg'}],
    ['common_sort1', {name: '1', type: '.jpg', sub: 'sort'}],
    ['common_sort2', {name: '2', type: '.jpg', sub: 'sort'}],
    ['common_sort3', {name: '3', type: '.jpg', sub: 'sort'}],
]);
const languageMap = LanguageConfigJson.languageMap;

function getJsonPath(key, isCommon = true) {
    if (isCommon) {
        let commonJson = commonMap.get(key);
        warn('commonJson==>' + JSON.stringify(commonJson))
        if (commonJson && commonJson.sub) {
            return {
                name: commonJson.name,
                type: commonJson.type,
                path: `${commonPath}${commonJson.sub}/`
            }
        } else if (commonJson) {
            return {
                name: commonJson.name,
                type: commonJson.type,
                path: `${commonPath}`
            }
        }
    } else {
        let languageJson = languageMap.get(key);
        warn('languageJson==>' + JSON.stringify(languageJson))
        if (languageJson) {
            return {
                name: languageJson.name,
                type: languageJson.type,
                path: `${path_base_main}`
            }
        }
    }
    throwError(`未找到key=${key}的配置`)
}

//========================以上为基本配置==============================
//========================以下为基本操作==============================
function infoLog(msg, source = '默认', log_off = config.log_off) {
    if (log_off) {
        info(`[${source}] msg: ${msg}`);
    }
}

function logInfoTemplateBase(res, source = '默认', log_off = config.log_off) {
    if (log_off) {
        info(`[${source}]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
    }
}

/**
 *
 * @param res
 * @returns {Promise<void>}
 */
function logInfoTemplate(res, source = '默认',) {
    logInfoTemplateBase(res, source)
}

/**
 * 通过圣遗物页面滑动功能
 * @param isUp 是否向上滑动，默认为false（向下滑动）
 * @param onTopOrDown 处于顶部or底部
 * @returns {Promise<void>}
 */
async function scrollPagesByHolyRelicsSelect(isUp = false, onTopOrDown = false) {
    let isSelect = config.toSift || config.toSort;
    mTo(genshinJson.width / 2, genshinJson.height / 2)
    if (!isSelect) {
        //未开启筛选或排序的滑动操作'
        //80 18次滑动偏移量  46次测试未发现偏移
        await scrollPage(Math.floor(genshinJson.height * 80 / 1080), onTopOrDown ? isUp : !isUp, 6, 18)
    } else {
        await scrollPage(Math.floor(genshinJson.height * 89 / 1080), onTopOrDown ? isUp : !isUp, 1, 10, 100)
    }
}

/**
 * 通过圣遗物页面滑动功能
 * @param {boolean} isUp - 是否向上滑动，默认为false（向下滑动）
 * @param {number} pages - 滑动页数，默认为1
 * @returns {Promise<boolean>}
 */
async function scrollPagesByHolyRelics(isUp = false, pages = 1) {
    let ms = 600
    let direction = "down" // 默认滑动方向为向下
    if (isUp) {
        direction = "up" // 如果isUp为true，则设置滑动方向为向上
    }

    // 计算模板匹配的坐标和尺寸，基于屏幕分辨率进行自适应
    let templateMatch_x = Math.floor(genshinJson.width * 1282 / 1920)
    let templateMatch_y = Math.floor(genshinJson.height * 112 / 1080)
    let templateMatch_width = Math.floor(genshinJson.width * 13 / 1920)
    let templateMatch_height = Math.floor(genshinJson.height * 840 / 1080)

    // 计算底部和顶部的Y坐标边界
    let bottom_y = Math.floor(genshinJson.height * 920 / 1080)
    let top_y = Math.floor(genshinJson.height * 125 / 1080)

    // 计算点击位置的X坐标和页面滑动距离
    let click_x = Math.floor(genshinJson.width * 1289 / 1920)
    let page_distance = Math.floor(genshinJson.height * 15 / 1080)
    let threshold = 0.6 // 模板匹配的阈值

    let slideBarUpJson = getJsonPath('slide_bar_main_up');
    let slideBarUp = {
        path_base: slideBarUpJson.path,
        name: slideBarUpJson.name,
        type: slideBarUpJson.type,
        x: templateMatch_x,
        y: templateMatch_y,
        width: templateMatch_width,
        height: templateMatch_height,
        threshold: threshold
    }
    let slideBarDownJson = getJsonPath('slide_bar_main_down');
    let slideBarDown = {
        path_base: slideBarDownJson.path,
        name: slideBarDownJson.name,
        type: slideBarDownJson.type,
        x: templateMatch_x,
        y: templateMatch_y,
        width: templateMatch_width,
        height: templateMatch_height,
        threshold: threshold
    }
    // 循环执行滑动操作，次数由pages参数决定
    for (let i = 0; i < pages; i++) {
        moveByMouse(genshinJson.width / 2, genshinJson.height / 2); // 移走鼠标，防止干扰识别
        await wait(ms)

        // 查找向上和向下的滑块
        let slide_bar_up = await templateMatchFindByJson(slideBarUp);
        let slide_bar_down = await templateMatchFindByJson(slideBarDown);

        // closeCaptureGameRegion(gameRegion)
        if (isExist(slide_bar_up) && isExist(slide_bar_down)) {
            info(`定位到滑块...(${slide_bar_up.x}, ${slide_bar_up.y})-滑动方向: ${direction}`);
            downClick(click_x, direction === "down" ? slide_bar_down.y + page_distance : slide_bar_up.y - page_distance); // 向上下滑动（点击）

            if (slide_bar_down.y > bottom_y && direction === "down") {
                await wait(ms);
                await scrollPagesByHolyRelicsSelect(isUp, true)
                info(`滑块已经滑动到底部...`);
                return true;
            } else if (slide_bar_up.y < top_y && direction === "up") {
                await wait(ms);
                await scrollPagesByHolyRelicsSelect(isUp, true)
                info(`滑块已经滑动到顶部...`);
                return true;
            }
            //反方向拉动 保证定位
            await wait(ms);
            mTo(genshinJson.width / 2, genshinJson.height / 2)
            await scrollPagesByHolyRelicsSelect(isUp, false)
            await wait(ms);
        } else {
            throwError("未找到滑块，无法执行页面滑动操作！");
            return false;
        }
    }
    return false;
}

// 滚动页面函数
/**
 * 滚动页面的异步函数
 * @param {number} totalDistance - 总滚动距离
 * @param {boolean} [isUp=false] - 是否向上滚动，默认为false(向下滚动)
 * @param {number} [waitCount=6] - 每隔多少步等待一次
 * @param {number} [stepDistance=30] - 每步滚动的距离
 * @param {number} [delayMs=1] - 等待的延迟时间(毫秒)
 */
async function scrollPage(totalDistance, isUp = false, waitCount = 6, stepDistance = 30, delayMs = 1000) {
    let ms = 600
    await wait(ms);
    downLeftButton();  // 按下左键
    await wait(ms);
    // 计算总步数
    let steps = Math.floor(totalDistance / stepDistance);
    // 开始循环滚动
    for (let j = 0; j < steps; j++) {
        // 计算剩余距离
        let remainingDistance = totalDistance - j * stepDistance;
        // 确定本次移动距离
        let moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        // 如果是向上滚动，则移动距离取反
        if (isUp) {
            //向上活动
            moveDistance = -moveDistance
        }
        // 执行鼠标移动
        moveByMouse(0, -moveDistance);
        // 取消注释后会在每一步后等待
        // await wait(delayMs);
        // 每隔waitCount步等待一次
        if (j % waitCount === 0) {
            await wait(delayMs);
        }
    }
    // 滚动完成后释放左键
    await wait(ms);
    upLeftButton();
    await wait(ms);
}


/**
 *

 * 该函数用于在指定路径的图像上执行模板操作
 * @param path {string} - 图像文件的路径
 * @param x {number} - 识别区域的起始x坐标
 * @param y {number} - 识别区域的起始y坐标
 * @param width {number} - 识别区域的宽度
 * @param height {number} - 识别区域的高度
 * @param threshold {number}
 * @returns {Promise<*>} - 返回一个Promise对象，解析为识别结果
 */
function templateMatchFind(path, x = 0, y = 0, width = genshinJson.width, height = genshinJson.height, threshold = undefined) {
    // 使用模板匹配方法创建识别对象
    // 从指定路径读取图像矩阵并进行模板匹配
    let templateMatchButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path}`), x, y, width, height);
    if (threshold) {
        templateMatchButtonRo.threshold = threshold;
    }
    // 捕获游戏区域并查找匹配的识别对象
    let region = openCaptureGameRegion()
    let button = region.find(templateMatchButtonRo);
    closeCaptureGameRegion(region)
    // 返回查找到的按钮对象
    return button
}

function templateMatchFindByJson(json) {
    warn("templateMatchFindByJson==>" + JSON.stringify(json))
    return templateMatchFind(`${json.path_base}${json.text}${json.type}`, json.x, json.y, json.width, json.height, json.threshold)
}

/**
 * 模板匹配函数，用于在指定路径下进行图像模板匹配
 * @param {string} path - 模板图像的路径
 * @returns {Object} - 返回模板匹配的结果
 */
function templateMatch(path) {
    // 调用基础模板匹配函数，传入路径、初始坐标(0,0)以及目标图像的宽高
    return templateMatchFind(`${path}`)
}


/**
 * 模板匹配点击函数
 * @param {string} path - 模板匹配的路径
 * @param {string} log_msg - 日志信息
 * @param {string} [source='templateMatchClick'] - 日志来源，默认为'templateMatchClick'
 * @param {boolean} [log_off=config.log_off] - 是否关闭日志记录，默认为配置中的log_off值
 * @returns {HTMLElement} 返回匹配到的按钮元素对象
 */
function templateMatchClick(path, log_msg, source = 'templateMatchClick', log_off = config.log_off) {
    let button = templateMatch(path);
    // 检查按钮元素是否存在
    if (isExist(button)) {
        // 如果未关闭日志记录功能
        if (log_off) {
            // 记录操作日志信息
            info(`log_msg==>${log_msg}`)
            info(`templateMatchPath==>${path}`)
            // 记录OCR识别到的按钮详细信息
            logInfoTemplate(button, source)
            info(`日志==>${path}`)
        }
        // 点击按钮元素
        button.click();
    }
    // 返回按钮对象
    return button
}

function templateMatchClickByJson(json, log_msg, source = 'templateMatchClickByJson', log_off = config.log_off) {
    return templateMatchClick(`${json.path_base}${json.text}${json.type}`, log_msg, source, log_off)
}

//========================以上为基本操作==============================
//========================以下为实际操作==============================

/**
 * 打开背包
 * @returns {Promise<Boolean>}
 * <前置条件:处于主界面|测试通过:v>
 */
async function openKnapsack() {
    let ms = 600
    let bag = getJsonPath('bag')
    let templateJson = {
        path_base: bag.path,
        text: bag.name,
        type: bag.type,
        x: 0,
        y: 0,
        width: genshinJson.width / 3.0,
        height: genshinJson.width / 5.0
    }
    await warn('openKnapsack==>' + JSON.stringify(templateJson), must)
    let knapsack = await templateMatchFindByJson(templateJson)
    // 如果背包不存在（即背包未打开）
    let exist = isExist(knapsack);
    if (!exist) {
        // 设置默认的背包快捷键为'B'
        let knapsackKey = 'B'
        // 如果设置中配置了自定义的背包快捷键，则使用自定义快捷键
        if (config.knapsackKey) {
            knapsackKey = config.knapsackKey;
        }
        // 记录日志，显示尝试按下的快捷键
        await info(`尝试按下${knapsackKey}键打开背包`)
        // 打开背包
        await keyPress(knapsackKey);
        await wait(ms);
        exist = true
    }
    return exist
}

/**
 * 模板匹配圣遗物背包区域的函数
 * 该函数通过模板匹配游戏界面中的圣遗物背包区域
 * @returns {Promise} 返回一个Promise对象，解析为OCR识别结果
 */
async function templateMatchHolyRelicsKnapsack() {
    let ms = 600
    let saint_relic_backpack_selected = getJsonPath('saint_relic_backpack_selected', false)
    let templateJson = {
        path_base: saint_relic_backpack_selected.path,
        text: saint_relic_backpack_selected.name,               // 要识别的文本内容，即"圣遗物"三个字
        type: saint_relic_backpack_selected.type,
        x: 0,                       // 识别区域的起始x坐标，设为0表示从屏幕最左侧开始
        y: 0,                       // 识别区域的起始y坐标，设为0表示从屏幕最顶部开始
        width: genshinJson.width,    // 识别区域的宽度（屏幕宽度的一半）
        height: genshinJson.height / 5.0,   // 识别区域的高度（屏幕宽度的五分之一）
        threshold: 0.6
    }
    let holyRelicsKnapsack = templateMatchFindByJson(templateJson)
    await wait(ms)
    if (!isExist(holyRelicsKnapsack)) {
        // templateJson.text = "圣遗物"
        let holy_relic = getJsonPath('holy_relic')
        templateJson.text = holy_relic.name
        templateJson.type = holy_relic.type
        templateJson.path_base = holy_relic.path
        holyRelicsKnapsack = templateMatchFindByJson(templateJson)
    }
    return holyRelicsKnapsack
}

/**
 * 打开圣遗物背包
 * @returns {Promise<boolean>}
 * <前置条件:处于背包界面|测试通过:v>
 */
async function openHolyRelicsKnapsack() {
    let ms = 600
    let re = false;
    await wait(ms);
    warn(``)
    let holyRelicsKnapsack = await templateMatchHolyRelicsKnapsack()
    // 检查圣遗物背包图标是否存在
    if (isExist(holyRelicsKnapsack)) {
        // 打开圣遗物背包
        await info('打开圣遗物背包');  // 记录日志信息
        await holyRelicsKnapsack.click();  // 点击圣遗物背包图标
        await wait(ms);  //
        re = true
    } else {
        throwError(`未找到圣遗物背包图标`)
    }

    return re
}

async function openSift() {
    let ms = 600
    let siftJson = getJsonPath('sift')
    let templateMatchJson = {
        path_base: siftJson.path,
        text: siftJson.name,
        type: siftJson.type,
        x: 0,
        y: 0,
        width: genshinJson.width / 3.0,
        height: genshinJson.height
    }
    // 查找筛选按钮元素
    let sift = templateMatchFindByJson(templateMatchJson)
    await wait(ms);
    // 判断筛选按钮是否存在
    let exist = isExist(sift);
    if (exist) {
        await info('打开筛选'); // 记录日志：打开筛选
        await sift.click(); // 点击筛选按钮
        // await wait(ms);
    }
    return exist
}

async function validHitPreamble() {
    let ms = 600
    let open_sift = await openSift()
    if (!open_sift) {
        throwError(`验证出错==>未打开筛选界面`)
        return true
    }
    let equipmentStatusOk = false
    let index = 1
    let x = Math.floor(genshinJson.width * 200 / 1920)
    let y = Math.floor(genshinJson.height * 4 / 5)
    while (index <= 20) {
        mTo(x, y)
        await scrollPage(Math.floor(genshinJson.height * 1 / 3), false, 6, 30, 600)
        let equipmentStatus = getJsonPath('equipment_status', false)
        let jsonEquipmentStatus = {
            path_base: equipmentStatus.path,
            text: equipmentStatus.name,
            type: equipmentStatus.type,
        }
        let tmEquipmentStatus = await templateMatchFindByJson(jsonEquipmentStatus)
        if (isExist(tmEquipmentStatus)) {
            equipmentStatusOk = true
            await info(`验证成功==>装备状态-识别成功`, must)
            break
        }
        index++
    }
    if (!equipmentStatusOk) {
        throwError(`验证出错==>未找到装备状态`)
        return true
    }
    let notLevelNotMax = getJsonPath('not_level_not_max', false)
    let notLevelMax = getJsonPath('not_level_max', false)

    let jsonNLNM = {
        path_base: notLevelNotMax.path,
        text: notLevelNotMax.name,
        type: notLevelNotMax.type,
    }
    let jsonNLM = {
        path_base: notLevelMax.path,
        text: notLevelMax.name,
        type: notLevelMax.type,
    }
    let tmNLNM = await templateMatchFindByJson(jsonNLNM)
    let tmNLM = await templateMatchFindByJson(jsonNLM)
    await wait(ms)
    //跳出筛选页面
    downClick(genshinJson.width / 2, genshinJson.height / 2)
    await info('跳出筛选页面')
    //属于 未选中满级 未选中未满级条件下
    return isExist(tmNLNM) && isExist(tmNLM)
}

/**
 * 重置筛选功能
 * 该函数用于在游戏界面中重置当前的筛选条件
 * 首先检查是否存在筛选按钮，如果存在则点击打开筛选面板
 * 然后检查是否存在重置按钮，如果存在则点击进行重置操作
 * 每次操作后都有短暂的延迟以确保界面响应
 * @returns {Promise<boolean>} - 返回一个Promise，表示异步操作的完成
 * <前置条件:处于圣遗物背包 筛选界面|测试通过:v>
 */
async function resetSift() {
    let ms = 600
    /*    let siftJson = getJsonPath('sift')
        let templateMatchJson = {
            path_base: siftJson.path,
            text: siftJson.name,
            type: siftJson.type,
            x: 0,
            y: 0,
            width: genshinJson.width / 3.0,
            height: genshinJson.height
        }
        // 查找筛选按钮元素
        let sift = templateMatchFindByJson(templateMatchJson)
        await wait(ms);*/
    // 判断筛选按钮是否存在
    let exist = await openSift();
    let exist1 = false
    if (exist) {
        /*  await info('打开筛选'); // 记录日志：打开筛选
          await sift.click(); // 点击筛选按钮*/
        await wait(ms);

        // const resetRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}重置.jpg"), 0, 0, genshinJson.width / 3.0, genshinJson.height);
        // // 查找重置按钮元素
        // let reset = captureGameRegion().find(resetRo);
        let resetJson = getJsonPath('reset');
        let templateResetJson = {
            text: resetJson.name,
            path_base: resetJson.path,
            type: resetJson.type,
            x: 0,
            y: 0,
            width: genshinJson.width / 3.0,
            height: genshinJson.height
        }
        // 查找重置按钮元素
        let reset = await templateMatchFindByJson(templateResetJson)
        await wait(ms);
        // 判断重置按钮是否存在
        exist1 = isExist(reset);
        if (exist1) {
            await info('重置'); // 记录日志：重置
            await reset.click(); // 点击重置按钮
            await wait(ms);
        }
    }
    return exist && exist1
}

/**
 * 进入筛选圣遗物界面 开始筛选圣遗物套装<1.0.1已修>
 * @param keyword
 * @param log_off
 * @returns {Promise<void>}
 */
async function openSiftHolyRelicsSuitUI_Start(keyword = config.suit, source = 'HolyRelicsSuitUI', log_off = config.log_off) {
    let ms = 600
    if (!keyword) {
        info('无套装筛选')
        return
    }
    let keywords = keyword.trim().split('|');
    if (keywords.length <= 0) {
        info('无套装筛选')
        return
    }
    info('开始筛选圣遗物套装请稍后...', must)
    let keywordsOk = new Array()
    //1.open
    let uiJson = getJsonPath("enter_filter_holy_relic_ui")
    let siftSiftHolyRelicsSuitUIJson = {
        text: uiJson.name,    // 按钮显示的文本内容
        path_base: uiJson.path,
        type: uiJson.type,
        x: 0,                    // 按钮的x坐标
        y: 0,                    // 按钮的y坐标
        width: genshinJson.width / 3.0,  // 按钮的宽度为屏幕宽度的1/3
        height: genshinJson.height      // 按钮的高度为整个屏幕高度
    }
    info('筛选:' + keywords.join(','), must)
    let sift = await templateMatchFindByJson(siftSiftHolyRelicsSuitUIJson)
    await wait(ms)
    let exist = isExist(sift);

    if (exist) {
        await logInfoTemplateBase(sift, 'HolyRelicsSuitUI', log_off)
        // await mTo(siftState.x, siftState.y)
        sift.click()
        if (log_off) {
            await info(`已${siftSiftHolyRelicsSuitUIJson.text}`)
        }
        await wait(ms)
        //2.start
        let last = {
            name_one: null,
            name_two: null,
            x: genshinJson.width / 2,
            y: genshinJson.height * 2 / 3,
        }

        let x = genshinJson.width * 140 / 1920
        let y = genshinJson.height * 100 / 1080

        let x1 = genshinJson.width * 800 / 1920
        let y1 = genshinJson.height * 1100 / 1080

        let height = (940 - 100) * genshinJson.height / 1080
        let width = (440 - 140) * genshinJson.width / 1920

        for (let i = 1; i <= config.countMaxByHoly; i++) {
            info('开始识别左边画面')
            let captureRegion = openCaptureGameRegion();
            let templateMatchObject = recognitionObjectOcr(x, y, width, height);
            // await mTo(width, 0)
            // templateMatchObject.threshold = 1.0;
            let opJsons = new Array()
            let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
            await wait(ms)
            for (let res of resList) {

                await logInfoTemplate(res, source)
                if (i % 2 !== 0) {
                    last.name_one = res.text
                } else {
                    last.name_two = res.text
                }

                // last.y = res.y
                if (keywordsOk.indexOf(res.text) < 0 && keywords.find(function (value) {
                    return res.text.includes(value.trim())
                }) && (opJsons.length === 0 || opJsons.find(function (value) {
                    return !value.text.includes(res.text)
                }))) {
                    await wait(ms)
                    opJsons.push({
                        text: res.text, x: res.x, y: res.y, sort: i
                    })
                    res.click()
                    keywordsOk.push(res.text)
                    if (keywords.length <= opJsons.length) {
                        break
                    }
                }

                if (keywords.length === keywordsOk.length) {
                    break
                }
            }

            //画面拆为二分别识别
            await info('开始识别右边画面')
            await wait(ms)
            templateMatchObject = await recognitionObjectOcr(x1, y, width, height);
            // await mTo(width, 0)
            // templateMatchObject.threshold = 1.0;
            resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
            closeCaptureGameRegion(captureRegion)
            await wait(ms)
            for (let res of resList) {

                await logInfoTemplate(res, source)

                last.y = res.y
                if (keywordsOk.indexOf(res.text) < 0 && keywords.find(function (value) {
                    return res.text.includes(value.trim())
                }) && (opJsons.length === 0 || opJsons.find(function (value) {
                    return !value.text.includes(res.text)
                }))) {
                    await wait(ms)
                    opJsons.push({
                        text: res.text, x: res.x, y: res.y, sort: i
                    })
                    res.click()
                    keywordsOk.push(res.text)
                    if (keywords.length <= opJsons.length) {
                        break
                    }
                }

                if (keywords.length === keywordsOk.length) {
                    break
                }
            }
            /*            await info(`选中 ${opJsons.map(value => value.text).join(",")}`)
                        //实际点击
                        for (let op of opJsons) {
                            wait(100)
                            downClick(op.x, op.y)
                        }
                        opJsons.sort((a, b) => {
                            return a.sort - b.sort
                        })
                        await info(`选中 ${opJsons.map(value => value.text).join(",")}`)
                        for (let op of opJsons) {
                            if (
                                keywordsOk.length === 0 || keywordsOk.find(function (value) {
                                    return !value.includes(op.text)
                                })
                            ) {
                                await info(`sort:${op.sort},text:${op.text},x:${op.x},y:${op.y}`)
                                await wait(100)
                                // await downClick(op.x, op.y)
                                keywordsOk.push(op.text)
                            }

                        }*/
            if (keywords.length <= opJsons.length) {
                // await info(`已选中 ${opJsons.map(value => value.text).join(",")}`, must)
                break
            }

            await wait(ms)
            await mTo(genshinJson.width / 2, Math.floor(genshinJson.height * 3 / 4))
            await wait(ms)

            if (keywords.length === keywordsOk.length) {
                break
            }

            // await dragBase(0, -Math.floor( genshinJson.height *40 / 1080 ), Math.floor( genshinJson.height *10  / 1080 ), config.log_off)
            await scrollPage(Math.floor(genshinJson.height * 400 / 1080), false, 6, 30)
            await wait(ms)

            if (last.name_one != null && last.name_one === last.name_two) {
                await info('已达底部')
                break
            }
            if (keywords.length === keywordsOk.length) {
                await info(`已选中 ${keywordsOk.join(",")}`)
                break
            }
        }
        if (keywordsOk.length > 0) {
            await info(`筛选圣遗物已选中 ${keywordsOk.join(",")}`, must)
        }
        await wait(ms)
        await confirm(`${source} 点击确认`, source)
        return
    }
}

/**
 * 筛选圣遗物 所有选项
 * @param log_off - 是否记录日志的开关参数
 * @returns {Promise<boolean>} - 返回一个空Promise，表示异步操作的完成
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */

async function openSiftAll(log_off = config.log_off) {
    let ms = 600
    // 调用重置筛选函数，恢复筛选条件到初始状态
    await info(`筛选中`)
    let reOk = await resetSift();
    let op = false
    if (reOk) {
        await wait(ms)
        // await siftState(log_off)
        // await wait(1)
        let width = Math.floor(450 * genshinJson.width / 1080);
        let captureRegion = openCaptureGameRegion();
        const templateMatchObject = recognitionObjectOcr(0, 0, width, genshinJson.height);
        // await mTo(width, 0)
        // templateMatchObject.threshold = 1.0;
        let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
        closeCaptureGameRegion(captureRegion)
        for (let res of resList) {
            // await wait(1)
            await logInfoTemplateBase(res, 'SiftAll', log_off)
            // await wait(1)
            // await mTo(res.x, res.y)
            if (config.siftArray.find(function (value) {
                return value === res.text
            })) {
                await info(`筛选${res.text}`)
                // await wait(1)
                // await downClick(res.x, res.y)
                await res.click()
            }
        }
        await wait(ms)
        await openSiftHolyRelicsSuitUI_Start(config.suit)
        await wait(ms)
        //确认
        let ok = await confirm()
        if (isExist(ok)) {
            await info(`筛选完成`)
            op = true
        }
    }
    return reOk && op
}

/**
 * 打开排序
 * @param log_off
 * @returns {Promise<void>}
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function openSort(log_off = config.log_off) {
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = Math.floor(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.floor(genshinJson.height);
    let sortJsonPath = getJsonPath('sort');
    let templateJson = {
        path_base: sortJsonPath.path,
        text: sortJsonPath.name,
        type: sortJsonPath.type,
        x: 0,
        y: 0,
        width: width,
        height: height
    }

    // 使用模板指定区域的图像
    let templateMatch = await templateMatchFindByJson(templateJson)
    // 检查模板结果是否存在（即升序按钮是否可见）
    if (isExist(templateMatch)) {
        await logInfoTemplate(templateMatch, 'openSort')
        templateMatch.click()
    }
    return templateMatch
}

/**
 * 切换升序排列的函数
 * 该函数通过模板和点击操作来切换或确认升序排列状态
 * <前置条件:处于圣遗物背包排序界面最底部|测试通过:v>
 */
async function openUpSort() {

    // 计算按钮宽度为屏幕宽度的三分之一
    let width = Math.floor(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.floor(genshinJson.height);
    let ascending_order_not_selected = getJsonPath('ascending_order_not_selected', false)
    let templateJson = {
        path_base: ascending_order_not_selected.path,
        text: ascending_order_not_selected.name,
        type: ascending_order_not_selected.type,
        x: 0,
        y: 0,
        width: width,
        height: height
    }
    // 定义未选中状态下的升序按钮名称
    let up_name = templateJson.text
    // 使用模板指定区域的图像
    let templateMatch = await templateMatchFindByJson(templateJson)

    await wait()
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (isExist(templateMatch)) {
        // 更新按钮名称为选中状态
        up_name = mana.get('asc_order')
        // 点击升序按钮
        templateMatch.click()
        // 记录切换成功的日志信息
        await info(`切换为${up_name}`)
    } else {
        // 如果按钮不存在，说明已处于升序状态，记录相应日志
        await info(`已处于升序`)
    }

}

/**
 * 切换等级排列的函数
 * 该函数通过模板和点击操作来切换或确认升序排列状态
 * <前置条件:处于圣遗物背包排序界面最底部|测试通过:v>
 * @returns {Promise<void>}
 */
async function openLvSort() {
    // 定义未选中状态下的升序按钮名称
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = Math.floor(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.floor(genshinJson.height);
    let level_sort = getJsonPath('level_sort', false)
    // 使用OCR识别指定区域的图像
    let templateJson = {
        path_base: level_sort.path,
        text: level_sort.name,
        type: level_sort.type,
        x: 0,
        y: 0,
        width: width,
        height: height
    }

    // 使用模板指定区域的图像
    let templateMatch = await templateMatchFindByJson(templateJson)
    // await wait(100)
    if (isExist(templateMatch)) {
        // 更新按钮名称为选中状态
        let up_name = templateJson.text
        // 点击升序按钮
        await templateMatch.click()
        // 记录切换成功的日志信息
        await info(`切换为${up_name}`)
    } else {
        // 如果按钮不存在，说明已处于升序状态，记录相应日志
        await info(`已处于等级顺序排序`)
    }
}

/**
 * 异步函数unchecked，用于执行一系列模板匹配点击操作
 * @param {boolean} log_off - 是否记录日志的标志
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 * <前置条件:处于圣遗物背包排序界面(需要和拖动配合)|测试通过:v>
 */
async function unchecked(log_off) {
    let source = 'unchecked'
    // 执行第一次模板匹配点击，点击"取消选择1"按钮，并等待1秒
    let sort1 = getJsonPath('common_sort1')
    let sort2 = getJsonPath('common_sort2')
    let sort3 = getJsonPath('common_sort3')

    let json = {
        path_base: sort1.path,
        text: sort1.name,
        type: sort1.type,
    }
    await templateMatchClickByJson(json, "取消选择1", source, log_off)
    json = {
        path_base: sort2.path,
        text: sort2.name,
        type: sort2.type,
    }
    await wait()
    // 执行第二次模板匹配点击，点击"取消选择2"按钮，并等待1秒
    await templateMatchClickByJson(json, "取消选择2", source, log_off)
    json = {
        path_base: sort3.path,
        text: sort3.name,
        type: sort3.type,
    }
    await wait()
    // 执行第三次模板匹配点击，点击"取消选择3"按钮，并等待1秒
    await templateMatchClickByJson(json, "取消选择3", source, log_off)
    await wait()
}


/**
 * 初始化页面并根据属性排序进行滚动
 * 该函数会按照特定比例计算滚动高度并执行滚动操作
 * @returns {Promise<void>} 异步函数，返回一个Promise
 */
async function scrollPageByAttributeSortInit() {
    // 计算滚动高度：页面总高度的1/5加上1/25
    // 然后执行滚动操作，true表示平滑滚动，6表示滚动速度
    await scrollPage(Math.floor(genshinJson.height * (165 / 1080)), true, 6)
    await info('拖动到看不见辅助排序规则(影响OCR)')
}

/**
 * 根据属性排序点击后的页面滚动函数
 * 该函数使用异步方式执行页面滚动操作
 * @returns {Promise<void>} 返回一个Promise，表示滚动操作的完成
 */
async function scrollPageByAttributeSortClick() {
    // 调用scrollPage函数执行页面滚动
    // 参数说明：
    // 1. Math.floor(genshinJson.height * 2 / 3) - 计算滚动的高度，为页面高度的2/3并向下取整
    // 2. true - 表示是否使用平滑滚动
    // 3. 6 - 可能是滚动的延迟时间或步长参数

    await scrollPage(Math.floor(genshinJson.height * 1 / 3), true, 6, 30, 600)

}

// [['key', {main: new Array(), sub: new Array()}],]
function takeDifferentHolyRelicToMap(mapSource, mapTarget) {
    mapTarget.forEach((value, key) => {
        // warn(`takeDifferentHolyRelicToMap key=${JSON.stringify(key)},value=${JSON.stringify(value)}`)
        if (!mapSource.has(key)) {
            mapSource.set(key, value)
        }
    })
    return mapSource
}

/**
 * 将圣遗物字符串解析为MAP格式的函数
 * @param {string} input - 输入的圣遗物字符串，使用特定分隔符
 * @returns {Map<string, any>} 返回包含圣遗物信息的对象数组
 */
function parseHolyRelicToMap(input = config.inputAttributeHolyRelic) {
    let addOkList = new Array()
    let map = new Map([['demo', {main: [], sub: []}],])
    map.delete('demo')
    // 使用竖线分隔符分割输入字符串，并过滤掉空值
    input.split('|').filter(p => p).forEach(p => {
            // 查找分隔符#和*的位置
            let match_index1 = p.indexOf('#')
            let match_index2 = p.indexOf('*')
            if (match_index1 === -1) {
                match_index1 = match_index2 + 1
            }
            // 默认分隔符为#
            // let match = '#'
            warn(`match=${p},match_index1=${match_index1},match_index2=${match_index2}`)
            // 根据分隔符位置选择不同的正则表达式来提取名称
            // 如果#在*前面，使用#作为分隔符，否则使用*
            let name = match_index1 < match_index2 ? p.match(/@([^#]+)/)[1] : p.match(/@([^*]+)/)[1];
            warn(`name=${name}`)
            if (HolyRelicPartsAsMap.get(name)) {
                name = HolyRelicPartsAsMap.get(name)
            }

            // 避免重复添加
            if (!addOkList.includes(name)) {
                warn(`ADD==>name=${name}`);
                // 处理 main 属性
                let main;

                if (attributeFixedMap.get(name)) {
                    main = attributeFixedMap.get(name)
                } else {
                    let mainMatch = p.match(/#([^&*]+)/); // 匹配 # 后的主属性
                    main = mainMatch
                        ? mainMatch[1].split('#').filter(m => m).map(m => attributeReplacement(m))
                        : [];
                }

                // 处理 sub 属性
                let subMatch = p.match(/\*([^!|]+)/); // 匹配 * 后的副属性
                let sub = subMatch
                    ? subMatch[1].split('*').filter(s => s).map(s => attributeReplacement(s))
                    : [];
                let json = {
                    main: main,
                    sub: sub
                }
                warn('json==>' + JSON.stringify(json))
                // 设置 Map
                map.set(name, json);
            }
            addOkList.push(name)
        }
    );

    // info('MAP==>' + JSON.stringify(map))
    info('addOkList==>' + JSON.stringify(addOkList))
    if (config.log_off) {
        for (const [key, value] of map) {
            info(`Key: ${key}, Value: ${JSON.stringify(value)}`);
        }
    }

    return map
}


// 自定义比较函数，用于比较 JSON 对象的 name 和 value
function areObjectsEqual(obj1, obj2) {
    return obj1.name === obj2.name && obj1.value === obj2.value;
}

/**
 * 获取两个数组中第一个不同的元素(共2个元素)
 * @param {Array} sub1 - 第一个数组
 * @param {Array} sub2 - 第二个数组
 * @returns {{length: number, diff: any[]}} 包含两个数组中不同元素的数组
 */
async function getSubFirstDifferentValues(sub1, sub2) {
    // 输入验证
    if (!Array.isArray(sub1) || !Array.isArray(sub2)) {
        throwError('输入参数必须是数组');
    }

    // 找出 sub1 中不在 sub2 中的元素
    let diff1 = sub1.filter(item1 => !sub2.some(item2 => areObjectsEqual(item1, item2)));
    // 找出 sub2 中不在 sub1 中的元素
    let diff2 = sub2.filter(item2 => !sub1.some(item1 => areObjectsEqual(item2, item1)));

    // 日志输出
    warn('diff1==>' + JSON.stringify(diff1));
    warn('diff2==>' + JSON.stringify(diff2));

    // 构建结果
    let diffJson = {
        length: 0,
        diff: []
    };

    if (diff1.length > 0) {
        diffJson.diff.push(diff1[0]);
    }
    if (diff2.length > 0) {
        diffJson.diff.push(diff2[0]);
    }
    diffJson.length = diffJson.diff.length;

    warn('diffJson==>' + JSON.stringify(diffJson));
    return diffJson;
}

async function ocrHolyRelicName() {
    let holyRelic = {
        name: null,//部件名称
        holyRelicName: null,//部件全称
    }
    let name = {
        x: genshinJson.width * 134 / 1920,
        y: genshinJson.height * 27 / 1080,
        width: genshinJson.width * 220 / 1920,
        height: genshinJson.height * 41 / 1080
    }
    let captureRegion = openCaptureGameRegion(); // 截取游戏画面


    let nameObject = await recognitionObjectOcr(name.x, name.y, name.width, name.height); // 创建OCR识别对象
    let nameRes = findByCaptureGameRegion(captureRegion, nameObject); // 执行OCR识别
    closeCaptureGameRegion(captureRegion); // 关闭游戏画面截取
    await logInfoTemplate(nameRes)
    holyRelic.holyRelicName = nameRes.text
    holyRelic.name = HolyRelicParts.find(holyRelicPart => {
        if (holyRelic.holyRelicName.includes(holyRelicPart)) {
            return holyRelicPart
        } else {
            return null
        }
    })

    if (holyRelic.name === null) {
        throwError('未识别到圣遗物名称')
    }


    // if (holyRelic.holyRelicName.includes('／')) {
    //     holyRelic.name = holyRelic.holyRelicName.split('／')[0].trim()
    // } else if (holyRelic.holyRelicName.includes('/')) {
    //     holyRelic.name = holyRelic.holyRelicName.split('/')[0].trim()
    // } else {
    //     throwError('未识别到圣遗物名称')
    // }
    info('ocrHolyRelicName==>' + JSON.stringify(holyRelic))
    return holyRelic
}

async function ocrAttributeHolyRelic() {
    let ms = 600
    let holyRelicAttribute = {
        main: null,//主属性名称
        value: null,//主属性值
        // sub: [{name: null, value: null},],
        sub: null,//副属性
    }
    let captureRegion = openCaptureGameRegion(); // 截取游戏画面

    let main = {
        x: genshinJson.width * 1194 / 1920,
        y: genshinJson.height * 233 / 1080,
        width: genshinJson.width * 186 / 1920,
        height: genshinJson.height * 45 / 1080
    }
    // await wait(ms)
    let mainObject = await recognitionObjectOcr(main.x, main.y, main.width, main.height); // 创建OCR识别对象
    let mainRes = findByCaptureGameRegion(captureRegion, mainObject); // 执行OCR识别
    await logInfoTemplate(mainRes)
    holyRelicAttribute.main = mainRes.text

    let mainV = {
        x: Math.floor(genshinJson.width * 1770 / 1920),
        y: Math.floor(genshinJson.height * 236 / 1080),
        width: Math.floor(genshinJson.width * 107 / 1920),
        height: Math.floor(genshinJson.height * 42 / 1080)
    }
    // await wait(ms)
    let mainVObject = await recognitionObjectOcr(mainV.x, mainV.y, mainV.width, mainV.height); // 创建OCR识别对象
    let mainVRes = findByCaptureGameRegion(captureRegion, mainVObject); // 执行OCR识别
    closeCaptureGameRegion(captureRegion); // 关闭游戏画面截取
    await logInfoTemplate(mainVRes)
    holyRelicAttribute.value = mainVRes.text

    if (holyRelicAttribute.value.includes('%') && AttributeHolyRelickeys.includes(holyRelicAttribute.main)) {
        holyRelicAttribute.main = holyRelicAttribute.main + mana.get('percentage')
    }
    captureRegion = openCaptureGameRegion(); // 截取游戏画面
    let subList = new Array()
    let sub = {
        x: Math.floor(genshinJson.width * 1195 / 1920),
        y: Math.floor(genshinJson.height * 304 / 1080),
        width: Math.floor(genshinJson.width * 253 / 1920),
        height: Math.floor(genshinJson.height * 209 / 1080)
    }
    // await wait(ms)
    let subObject = await recognitionObjectOcr(sub.x, sub.y, sub.width, sub.height); // 创建OCR识别对象
    let subResList = findMultiByCaptureGameRegion(captureRegion, subObject); // 执行OCR识别

    for (let subRes of subResList) {
        await logInfoTemplate(subRes)
        subList.push(subRes.text)
    }

    let subV = {
        x: Math.floor(genshinJson.width * 1781 / 1920),
        y: Math.floor(genshinJson.height * 296 / 1080),
        width: Math.floor(genshinJson.width * 101 / 1920),
        height: Math.floor(genshinJson.height * 224 / 1080)
    }
    // await wait(ms)
    let subVObject = await recognitionObjectOcr(subV.x, subV.y, subV.width, subV.height); // 创建OCR识别对象
    let subVResList = findMultiByCaptureGameRegion(captureRegion, subVObject); // 执行OCR识别
    closeCaptureGameRegion(captureRegion); // 关闭游戏画面截取

    let index = 0
    for (let subVRes of subVResList) {
        if (holyRelicAttribute.sub === null) {
            holyRelicAttribute.sub = new Array()
        }
        let subName = subList[index] + "";
        let subValue = subVRes.text + "";
        let key = mana.get('toBeActivated')
        if (subName.includes(key)) {
            subName = key + subName.split(key)[0].trim()
        }
        if (AttributeHolyRelickeys.includes(subName) && subValue.includes('%')) {
            subName = subName + mana.get('percentage')
        }
        holyRelicAttribute.sub.push({name: subName, value: subValue})
        await logInfoTemplate(subVRes)
        index++
    }
    info('ocrAttributeHolyRelic==>' + JSON.stringify(holyRelicAttribute))
    return holyRelicAttribute
}

//重置属性排序
/**
 * 重置属性排序的异步函数<1.0.1已修>
 * @param {any} x - 辅助排序的x，用于指定第一个属性
 * @param {any} y - 辅助排序的y，用于指定第二个属性
 * @param {any} h - 参数h，用于指定高度或层级
 * @param {boolean} log_off - 日志开关参数，用于控制是否记录日志
 * @returns {Promise<void>} - 不返回任何值的Promise
 * <前置条件:处于圣遗物排序最底部界面|测试通过:v>
 */
async function resetAttributeSort(log_off = config.log_off) {

    let x = Math.floor(genshinJson.width * 200 / 1920)
    let y = Math.floor(genshinJson.height * 200 / 1080)
    let h = Math.floor(genshinJson.height * 10 / 1080)
    let width = Math.floor(genshinJson.width * 450 / 1920);
    //拖动到看不见辅助排序规则
    await mTo(x, y)
    await scrollPageByAttributeSortInit()
    await wait()
    // let template_name = '属性排序规则'
    let attribute_sort_rules = getJsonPath('attribute_sort_rules', false)
    let templateJson = {
        path_base: attribute_sort_rules.path,
        text: attribute_sort_rules.name,
        type: attribute_sort_rules.type,
        x: 0,
        y: 0,
        width: width,
        height: genshinJson.height
    }

    for (let index = 1; index <= 5; index++) {
        await unchecked(log_off)
        await mTo(x, y)
        await scrollPageByAttributeSortClick()

        let templateMatch = await templateMatchFindByJson(templateJson)
        if (isExist(templateMatch)) {
            await unchecked(log_off)
            await info(`已到顶`)
            break
        } else if (index == 5) {
            throwError(`未找到${templateJson.text}`)
        }
    }

}

/**
 * 属性排序支持 <1.0.1已修>
 * @param keyword
 * @param log_off
 * @returns {Promise<void>}
 * <前置条件:处于圣遗物排序界面 使得辅助排序规则处于最下方不可被OCR识别到|测试通过:v>
 */
async function attributeSort(keyword = config.sortAttribute, source = 'attributeSort', log_off = config.log_off) {
    if (!keyword) {
        await info('无属性排序规则', must)
        return
    }
    let split = keyword.trim().split('|');
    if (split.length === 0) {
        await info('无属性排序规则', must)
        return
    }
    let ms = 600
    let specialKey = ''
    let attributeKeys = new Array();
    // warn(split.join(','), must)
    for (let i = 0; i < split.length; i++) {
        if (i >= 3) {
            break
        }
        let value = attributeReplacement(split[i], log_off)
        if (attributeList.indexOf(value) > 0 && i == 2) {
            specialKey = value
        } else {
            attributeKeys.push(value)
        }
    }
    info('筛选:' + attributeKeys.join(','), must)
    let attributeKeysOk = new Array();

    let x = Math.floor(genshinJson.width * 200 / 1920)
    let y = Math.floor(200 * genshinJson.height / 1080)
    let h = Math.floor(genshinJson.height * 10 / 1080)
    await mTo(x, y)
    await wait(ms)
    // await dragBase(0, Math.floor(26 * genshinJson.height / 1080 ), h, log_off)
    await scrollPageByAttributeSortInit()
    // await wait(100)

    // let template_name = '属性排序规则'
    let attribute_sort_rules = getJsonPath('attribute_sort_rules', false)
    let width = Math.floor(450 * genshinJson.width / 1920);

    let templateJson = {
        path_base: attribute_sort_rules.path,
        text: attribute_sort_rules.name,
        type: attribute_sort_rules.type,
        x: 0,
        y: 0,
        width: width,
        height: genshinJson.height
    }
    let sort = new Array()
    let templateMatch_y = Math.floor(60 * genshinJson.height / 1080)
    for (let index = 1; index <= 10; index++) {
        let captureRegion = openCaptureGameRegion();

        let templateMatchObject = recognitionObjectOcr(0, templateMatch_y, width, genshinJson.height - templateMatch_y);
        // await mTo(width, 0)
        // templateMatchObject.threshold = 1.0;
        let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
        closeCaptureGameRegion(captureRegion)

        for (let res of resList) {
            await logInfoTemplate(res, source)
            if (attributeKeys.indexOf(res.text) >= 0 && attributeKeysOk.indexOf(res.text) < 0) {
                // await wait(1)
                // res.click()
                // attributeKeysOk.push(res.text)
                sort.push({index: attributeKeys.indexOf(res.text), text: res.text, x: res.x, y: res.y})
                // await wait(10)
            }
        }

        sort.sort((a, b) => (a.index - b.index))
        for (let one of sort) {
            await info(`[Sort]{index: ${one.index}, text: ${one.text}, x: ${one.x}, y: ${one.y}}`)
            if (attributeKeysOk.indexOf(one.text) < 0) {
                await wait(ms)
                await downClick(one.x, one.y)
                attributeKeysOk.push(one.text)
                await info(`[Sort] 选中 {index: ${one.index}, text: ${one.text}, x: ${one.x}, y: ${one.y}}`)
            }
        }
        await wait(ms)
        await mTo(x, y)
        await scrollPageByAttributeSortClick()
        await wait(ms)

        let templateMatch = await templateMatchFindByJson(templateJson)
        if (isExist(templateMatch)) {
            // let width = Math.floor(450 * genshinJson.width / 1920);
            let captureRegion = openCaptureGameRegion();
            let templateMatchObject = recognitionObjectOcr(0, templateMatch_y, width, genshinJson.height - templateMatch_y);
            // await mTo(width, 0)
            // templateMatchObject.threshold = 1.0;
            let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
            closeCaptureGameRegion(captureRegion)


            for (let res of resList) {
                await logInfoTemplate(res, source)
                if (attributeKeys.indexOf(res.text) >= 0 && attributeKeysOk.indexOf(res.text) < 0) {
                    await wait(ms)
                    // res.click()
                    // attributeKeysOk.push(res.text)
                    sort.push({index: attributeKeys.indexOf(res.text), text: res.text, x: res.x, y: res.y})
                }
            }

            sort.sort((a, b) => (a.index - b.index))
            for (let one of sort) {
                await info(`[已到顶]{index: ${one.index}, text: ${one.text}, x: ${one.x}, y: ${one.y}}`)
                if (attributeKeysOk.indexOf(one.text) < 0) {
                    await info(`选中 ${one.index}`)
                    await wait(ms)
                    await downClick(one.x, one.y)
                    attributeKeysOk.push(one.text)
                    await info(`[已到顶] 选中 {index: ${one.index}, text: ${one.text}, x: ${one.x}, y: ${one.y}}`)
                }
            }


            if (specialKey !== '') {
                //特殊排序处理
                await wait(ms)
                await clickProgressBarDownBySort()
                await wait(ms)
                await mTo(x, y)
                await scrollPage(Math.floor(genshinJson.height * 1 / 5 + genshinJson.height * 1 / 6), true, 6)

                let captureRegion = openCaptureGameRegion();
                let templateMatchObject = recognitionObjectOcr(0, 0, width, genshinJson.height);
                // await mTo(width, 0)
                // templateMatchObject.threshold = 1.0;
                let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
                closeCaptureGameRegion(captureRegion)

                for (let res of resList) {
                    await logInfoTemplate(res, source)
                    if (res.text.includes(specialKey) && attributeKeysOk.indexOf(res.text) < 0) {
                        await wait(ms)
                        res.click()
                        attributeKeysOk.push(res.text)
                        break
                    }
                }
            }

            await info(`已到顶`)
            break
        } else if (index == 10) {
            throwError(`未找到${templateJson.text}`)
        }
    }
    if (attributeKeysOk.length > 0) {
        await info(`已选中 ${attributeKeysOk.join(',')}`)
    }
}

/**
 * 打开排序并选择所有
 * @param log_off - 日志关闭标志，用于控制是否在操作过程中记录日志
 * @returns {Promise<boolean>} - 返回一个Promise，表示异步操作的完成
 * 该函数用于执行打开排序并选择所有项目的操作
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function openSortAll(log_off = config.log_off) {
    let ms = 600
    await wait(ms)
    // 首先调用openSort函数，传入log_off参数
    let open = await openSort(log_off)
    let exist = isExist(open);
    if (exist) {
        await wait(ms)
        await clickProgressBarDownBySort()
        //升序
        await openUpSort()
        //等级
        await openLvSort()
        await wait(ms)
        // todo: 可扩展
        await info(`排序中...`, must)
        if (config.sortArray.length > 0) {
            let width = Math.floor(genshinJson.width * 450 / 1920);
            let captureRegion = openCaptureGameRegion();
            let y = Math.floor(genshinJson.height / 2);
            let templateMatchObject = recognitionObjectOcr(0, y, width, y);
            // await mTo(width, 0)
            // templateMatchObject.threshold = 1.0;
            let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
            closeCaptureGameRegion(captureRegion)
            for (let res of resList) {
                // await wait(1)
                await logInfoTemplateBase(res, 'SortAll', log_off)
                // await wait(1)
                // await mTo(res.x, res.y)
                if (config.sortArray.find(function (value) {
                    return value === res.text
                })) {
                    await info(`排序筛选==>${res.text}<==`)
                    // await wait(1)
                    // await downClick(res.x, res.y)
                    await res.click()
                }
            }
            await wait(ms)
        }
        await info(`[重置排序]操作中耗时长请稍后...`, must)
        await resetAttributeSort(log_off)
        await wait(ms)
        await clickProgressBarDownBySort()
        await info(`[筛选排序]开始属性排序`, must)
        await attributeSort(config.sortAttribute, log_off)
        await wait(ms)
        //确认
        await confirm()
        await wait(ms)
        await info(`筛选完成`)
    } else {
        let msg = `未找到排序按钮`;
        await error(msg)
        throwError(msg)
    }
    return exist
}

/**
 * 打开所有先决条件的异步函数
 * @param {boolean} log_off - 用于控制是否记录关闭操作的标志位
 * @returns {Promise<boolean>} - 返回一个Promise，表示异步操作的完成
 * 当Promise完成时，表示所有先决条件已成功打开
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function openPrerequisitesAll(log_off = config.log_off) {
    let re = true;
    let ms = 600
    await wait(ms)
    if (config.toSift) {
        // 首先执行 openSiftAll 函数，传入 log_off 参数
        let siftOk = await openSiftAll(log_off);
        if (!siftOk) {
            throw new Error(`筛选失败`)
            re = false;
        }
        // 然后执行 openSortAll 函数，同样传入 log_off 参数
        await wait(ms)
    }
    if (config.toSort) {
        // 使用 await 确保两个函数按顺序执行
        let sortOk = await openSortAll(log_off);
        if (!sortOk) {
            throw new Error(`排序失败`)
            re = false;
        }
    }
    await wait(ms)
    return re
}

/**
 * 点击进度条的异步函数
 * @param {number} x - 点击的x坐标
 * @param {number} y - 点击的y坐标
 * @returns {Promise<void>} 返回一个Promise，表示异步操作完成
 */
async function clickProgressBar(x, y) {
    await mTo(x, y);  // 将鼠标移动到指定坐标(x, y)
    await downLeftButton()  // 模拟按下鼠标左键
    await wait()  // 等待1000毫秒（1秒）
    await upLeftButton()  // 模拟释放鼠标左键
}

/**
 * 点击进度条顶部的箭头(圣遗物界面)
 * 该函数用于定位并点击游戏界面中进度条顶部的箭头按钮
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function clickProgressBarTopByHolyRelics() {
    // // 定义进度条顶部箭头的名称
    // let up_name = '进度条顶部箭头'
    // // 计算屏幕宽度的一半
    // // 1300,170
    // let width = Math.floor(genshinJson.width / 2 );
    // // 获取屏幕总高度
    // let height = Math.floor(genshinJson.height );
    // // 设置起始点的x坐标为屏幕宽度的一半
    // var x1 = Math.floor(genshinJson.width / 2 );
    // // 设置起始点的y坐标为0（顶部）
    // var y1 = 0;
    // // 构建进度条顶部箭头图片的完整路径
    // var path = `${path_base_main}${up_name}.jpg`;
    // await wait(10)
    // // 使用OCR识别图片在屏幕上的位置和大小
    // let templateMatch = await templateMatch(path, x1, y1, width, height)
    // // 记录OCR识别结果
    // await logInfoTemplate(templateMatch)
    // // 计算点击位置的x坐标（OCR识别区域的中心点）
    // let x = templateMatch.x + Math.floor(templateMatch.width / 2 );
    // // 计算点击位置的y坐标（OCR识别区域的底部）
    // let y = templateMatch.y + Math.floor(templateMatch.height );
    // // 输出点击坐标信息
    // await info(`x:${x},y:${y}`)


    /*    await wait(10)
        let x = Math.floor(genshinJson.width * 1289 / 1920)
        let y = Math.floor(genshinJson.height * 177 / 1080)
        // 移动鼠标到计算的位置
        await clickProgressBar(x, y)*/
    let ms = 600
    // await openSiftAll()
    await wait(ms)
    // await confirm('强制拉到顶')


    let siftJson = getJsonPath('sift')
    let templateMatchJson = {
        text: siftJson.name,
        type: siftJson.type,
        path_base: siftJson.path,
        x: 0,
        y: 0,
        width: genshinJson.width / 3.0,
        height: genshinJson.height
    }
    await wait(ms)
    // 查找筛选按钮元素
    let sift = await templateMatchFindByJson(templateMatchJson)
    await wait(ms)
    // let templateMatch = await templateMatch(`${path_base_main}确认.jpg`, 0, 0, Math.floor(genshinJson.width / 2), Math.floor(genshinJson.height / 2))
    // logInfoTemplate(templateMatch)
    if (isExist(sift)) {
        await sift.click()
        await wait(ms)
        await confirm('强制拉到顶')
    } else {
        throwError(`OCR识别失败未找到确认按钮`)
    }
    await info('强制拉到顶')
}

/**
 * 点击进度条进度的箭头(排序界面)
 * 该函数用于定位并点击游戏界面中进度条顶部的箭头按钮
 * <前置条件:处于圣遗物背包排序界面|测试通过:v>
 */
async function clickProgressBarDownBySort() {
    // // 定义进度条顶部箭头的名称
    // let up_name = '排序进度条底部箭头'
    // // 计算屏幕宽度的一半
    // let width = Math.floor(genshinJson.width / 2);
    // // 获取屏幕总高度
    // let height = Math.floor(genshinJson.height);
    // // 设置起始点的x坐标为屏幕宽度的一半
    // let x1 = 0;
    // // 设置起始点的y坐标为0（顶部）
    // let y1 = 0;
    // // 构建进度条顶部箭头图片的完整路径
    // let path = `${path_base_main}${up_name}.jpg`;
    // // 使用OCR识别图片在屏幕上的位置和大小
    // let templateMatch = await templateMatch(path, x1, y1, width, height)
    // // 记录OCR识别结果
    // await logInfoTemplate(templateMatch)
    // await mTo(templateMatch.x, templateMatch.y)
    //
    // // 计算点击位置的x坐标（OCR识别区域的中心点）
    // let x = templateMatch.x + Math.floor(templateMatch.width / 2);
    // // 计算点击位置的y坐标（OCR识别区域的底部）
    // let y = templateMatch.y - Math.floor(templateMatch.height);
    // // 输出点击坐标信息
    // await info(`x:${x},y:${y}`)
    // await mTo(x, y)
    let x = Math.floor(genshinJson.width * 607 / 1920)
    let y = Math.floor(genshinJson.height * 938 / 1080)
    // 移动鼠标到计算的位置
    await clickProgressBar(x, y)
}


/**
 * 点击第一个圣遗物的函数
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function downClickFirstHolyRelics() {
    let ms = 600
    let x = Math.floor(genshinJson.width * 200 / 1920)
    let y = Math.floor(genshinJson.height * 250 / 1080)
    // await mTo(200,300)
    await wait(ms)
    await downClick(x, y)
    await wait(ms)
    await confirm('点击第一个圣遗物', 'downClickFirstHolyRelics')
    await wait(ms)
    //避免多次点击
    await mTo(x, y)
    await wait(ms)
    await info('点击第一个圣遗物')
    // await openAggrandizement()
    // await wait(300)
    // let material = config.material
    // await openSelectTheClipCondition(material)
}


// 判断是否在主界面的函数
const isInMainUI = () => {
    // let name = '主界面'
    let main_interface = getJsonPath('main_interface');
    // 定义识别对象
    let paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync(`${main_interface.path}${main_interface.name}${main_interface.type}`),
        0,
        0,
        genshinJson.width / 3.0,
        genshinJson.width / 5.0
    );
    let captureRegion = openCaptureGameRegion();
    let res = findByCaptureGameRegion(captureRegion, paimonMenuRo);
    closeCaptureGameRegion(captureRegion)
    return !res.isEmpty();
};

/**
 * 打开强化界面的函数
 *
 * 该函数会查找游戏中的强化按钮，如果存在则点击它
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 * <前置条件:处于圣遗物详情界面|测试通过:v>
 */
async function openAggrandizement() {
    let defaultEnhancedInterface = mana.get("defaultEnhancedInterfaceUp")
    if (config.defaultEnhancedInterface.includes(defaultEnhancedInterface)) {
        log.info(`默认强化界面为{s}`, defaultEnhancedInterface)
        return;
    }
    let ms = 600
    // 注释掉的代码：使用模板匹配方法查找强化按钮
    // const aggrandizementRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}强化.jpg"), 0, 0, genshinJson.width / 3.0, genshinJson.height);
    // // 捕获游戏区域并查找强化按钮
    // let aggrandizement = captureGameRegion().find(aggrandizementRo);
    // 定义OCR识别的JSON对象，包含文本和位置信息
    let strengthen = getJsonPath('strengthen', false)
    let templateJson = {
        text: strengthen.name,
        type: strengthen.type,
        path_base: strengthen.path,
        x: 0,
        y: 0,
        width: genshinJson.width,
        height: genshinJson.height
    }
    // 查找筛选按钮元素
    let aggrandizement = await templateMatchFindByJson(templateJson)

    await logInfoTemplate(aggrandizement, 'openAggrandizement')

    // 检查强化按钮是否存在
    if (isExist(aggrandizement)) {
        await wait(ms);
        // 输出日志信息，表示正在打开强化界面
        await info('打开强化');
        // 点击强化按钮
        await aggrandizement.click();
        await wait(ms)
        // 等待500毫秒以确保界面完全打开
        mTo(genshinJson.width / 2, genshinJson.height / 2)
    } else {
        throwError(`识别失败未找到强化按钮`)
    }

}


// const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}确认.jpg"), 0, 0, genshinJson.width, genshinJson.height);
/**
 * 确认
 * @returns {Promise<void>}
 */
async function confirm(log_msg = '点击确认', source = 'confirm') {
    let confirmJson = getJsonPath('confirm');
    let json = {
        text: confirmJson.name,
        type: confirmJson.type,
        path_base: confirmJson.path,
    }
    return await templateMatchClickByJson(json, log_msg, source, config.log_off)
}

/**
 * 清空选中的狗粮
 * @returns {Promise<void>}
 */
async function clear(source = 'clear') {
    // 通过OCR识别并点击"详情"按钮
    let info = getJsonPath('info', false)
    let strengthen = getJsonPath('strengthen', false)
    let json = {
        text: info.name,
        type: info.type,
        path_base: info.path,
    }
    await templateMatchClickByJson(json, "点击详情", source, config.log_off)
    // json.text = '强化'
    json.text = strengthen.name
    json.type = strengthen.type
    json.path_base = strengthen.path
    await wait(600)
    // 通过OCR识别并点击"强化"按钮
    await templateMatchClickByJson(json, "点击强化", source, config.log_off)
}

/**
 * 操作方式处理函数
 * @param operate - 操作类型参数

 * @param log_off - 日志开关参数
 * @returns {Promise<string>} - 返回处理后的操作类型
 */
async function operateDispose(operate, enableInsertionMethod, source = 'operateDispose', log_off) {
    let ms = 600
    // let templateMatch_name = '阶段放入'  // 默认使用"阶段放入"进行OCR识别
    let stage_put_in = getJsonPath('stage_put_in', false)
    let templateJson = {
        text: stage_put_in.name,
        type: stage_put_in.type,
        path_base: stage_put_in.path,
        x: 0,
        y: 0,
        width: genshinJson.width,
        height: genshinJson.height
    }
    let templateMatch_name = templateJson.text
    //自动识别界面元素
    let templateMatch1 = await templateMatchFindByJson(templateJson)
    // 如果默认元素不存在，则切换为"快捷放入"
    let exist = isExist(templateMatch1);
    if (!exist) {
        templateMatch_name = mana.get('quicklyPutIn')
    }
    info(`operateDispose`)
    // 如果操作方式为"默认"或未指定，则进行自动识别

    if (operate === mana.get('defaultValue') || (!operate)) {
        // 更新操作方式为识别到的名称
        operate = templateMatch_name
        info(`更新操作方式为识别到的名称:${operate}`)
    } else if (config.enableInsertionMethod || enableInsertionMethod) {
        info(`如果操作方式为"阶段放入"或"快捷放入"，则进行模板匹配`)        // 如果操作方式为"阶段放入"或"快捷放入"，则进行模板匹配
        // 如果默认元素不存在，则切换为"快捷放入"
        if (exist) {
            return templateMatch_name
        }
        //和自动识别互斥  自启动 阶段放入||快捷放入
        await info(`${operate} 未打开`)

        // let name = '设置按键'
        let settingButtonJsonPath = getJsonPath('setting_button');
        let json = {
            text: settingButtonJsonPath.name,
            type: settingButtonJsonPath.type,
            path_base: settingButtonJsonPath.path,
        }
        await templateMatchClickByJson(json, `点击${json.text}`, source, log_off)
        await mTo(genshinJson.width / 2, genshinJson.height / 2)
        await wait(ms)
        let clickJsonPath
        // let name4 = `点击关闭`
        if (operate !== mana.get('quicklyPutIn')) {
            // name4 = `点击开启`
            clickJsonPath = getJsonPath('click_open');
        } else {
            clickJsonPath = getJsonPath('click_close');
        }
        let Json4 = {
            text: clickJsonPath.name,
            type: clickJsonPath.type,
            path_base: clickJsonPath.path,
        }
        await templateMatchClickByJson(Json4, `${clickJsonPath.name}`, source, log_off)
        // let name5 = `关闭设置`
        let closeSettingsJsonPath = getJsonPath('close_settings');
        let Json5 = {
            text: closeSettingsJsonPath.name,
            type: closeSettingsJsonPath.type,
            path_base: closeSettingsJsonPath.path,
        }
        await templateMatchClickByJson(Json5, `${Json5.text}`, source, log_off)
        mTo(0, 0)
    }
    info(`[放入方式]==>${operate}<==[end]`)
    if (isExist(templateMatch1)) {
        await wait(ms)
        templateMatch1.click()
    } else {
        throwError(`[放入方式]-${operate} 未打开`)
    }
    info(`[放入方式]-[click]`)
    return operate
}


/**
 * 模板匹配识别圣遗物强化次数的异步函数
 * 该函数通过截图和OCR技术识别游戏中圣遗物的强化次数
 * @returns {Promise<{sumLevel: number, level: number}>} 返回识别到的强化次数，如果未识别到则返回0
 */
async function templateMatchHolyRelicsUpFrequency(source = 'HolyRelicsUpFrequency', log_off) {
    /*
        // // 定义OCR识别的初始坐标和区域大小
        let templateMatch_x = Math.floor(genshinJson.width / 2); // OCR识别区域的x坐标，设置为屏幕宽度的一半
        let templateMatch_y = 0; // OCR识别区域的y坐标，设置为0（屏幕顶部）
        let width = Math.floor(genshinJson.width / 2); // OCR识别区域的宽度，设置为屏幕宽度的一半
        let height = Math.floor(genshinJson.height); // OCR识别区域的高度，设置为整个屏幕高度

        // 定义并执行第一次OCR识别，用于识别经验值图标
        let up_name = 'exp' // 识别对象名称为经验值图标
        let templateMatch1 = await templateMatch(`${path_base_main}${up_name}.jpg`, templateMatch_x, templateMatch_y, width, height) // 执行OCR识别
        if (log_off) {
            await logInfoTemplate(templateMatch1, source + '-' + up_name) // 记录OCR识别结果
        }

        // 定义并执行第二次OCR识别，用于识别返回键
        let up_name1 = '返回键' // 识别对象名称为返回键
        let templateMatch2 = await templateMatch(`${path_base_main}${up_name1}.jpg`, templateMatch_x, templateMatch_y, width, height) // 执行OCR识别

        if (log_off) {
            await logInfoTemplate(templateMatch2, source + '-' + up_name1) // 记录OCR识别结果
        }
        //todo :bug
        // 计算OCR识别的目标区域
        let x = Math.min(templateMatch1.x, templateMatch1.x) // 目标区域的左上角x坐标
        let y = Math.min(templateMatch1.y, templateMatch2.y) // 目标区域的左上角y坐标
        let w = Math.floor(Math.abs(templateMatch1.x - templateMatch2.x) / 2) // 目标区域的宽度
        let h = Math.abs(templateMatch1.y - templateMatch2.y) // 目标区域的高度

        // let x = Math.floor(genshinJson.width * 1173 / 1920)// 目标区域的左上角x坐标
        // let y = Math.floor(genshinJson.height * 34 / 1080)// 目标区域的左上角y坐标
        // let w = Math.floor(genshinJson.width * 329 / 1920)// 目标区域的宽度
        // let h = Math.floor(genshinJson.height * 145 / 1080)// 目标区域的高度
        await wait(300)
        await infoLog(`{x:${x},y:${y},w:${w},h:${h}}`, source) // 记录OCR识别结果*/
    // 截取游戏画面并进行OCR识别
    let ms = 800
    //x=1172, y=134,width:124,height:41
    let all = {
        x: Math.floor(genshinJson.width * 1172 / 1920),
        y: Math.floor(genshinJson.height * 134 / 1080),
        width: Math.ceil(genshinJson.width * 124 / 1920),
        height: Math.ceil(genshinJson.height * 41 / 1080)
    }
    await wait(ms)
    let captureRegion = openCaptureGameRegion(); // 截取游戏画面
    const templateMatchObject = await recognitionObjectOcr(all.x, all.y, all.width, all.height); // 创建OCR识别对象
    let res = findByCaptureGameRegion(captureRegion, templateMatchObject); // 执行OCR识别
    closeCaptureGameRegion(captureRegion)
    await wait(ms)
    if (log_off) {
        await logInfoTemplate(res, source) // 记录OCR识别结果
    }

    let levelJson = {
        sumLevel: -1,//预估可提升至等级
        level: -1//实际等级
    }

    function keepBeforeThirdPlus(str) {
        // 查找第三个 '+' 的索引
        let count = 0;
        let index = -1;
        let first = 0;

        for (let i = 0; i < str.length; i++) {
            if (str[i] === '+') {
                count++;
                if (count === 3) {
                    first = i;
                }
                if (count === 3) {
                    index = i;
                    break;
                }
            }
        }

        // 如果找到第三个 '+'，返回其之前的内容；否则返回原字符串
        return count >= 3 ? str.substring(first, index) : str;
    }


    if (res.text.includes('+')) {
        //保留数字和+
        let va = res.text.replace(/[^+\d]/g, "").replaceAll('++', '+')
        va = keepBeforeThirdPlus(va)
        // 如果最后不是数字，去掉末尾的 +
        va = va.replace(/\+$/g, "");
        let str = "0" + va;
        let level = parseInt(str.split("+")[1])//实际等级
        //16识别成166
        if (level > 20) {
            warn(`异常识别修正`)
            let t_level = Math.floor(level / 10)
            va = va.replace(`+${level}`, `+${t_level}`)
            level = t_level
        }

        str = "0" + va;

        await infoLog(res.text, source + '==处理前') // 记录OCR识别结果
        await infoLog(str, source + '处理过') // 记录OCR识别结果
        let result = new Function(`return ${str}`)() + "";
        await infoLog(result, source) // 记录OCR识别结果
        let sumLevel = parseInt(result)//计算等级
        await info(`圣遗物预估可提升至等级: ${sumLevel}`); // 20

        await info(`圣遗物实际等级: ${level}`)
        levelJson.sumLevel = sumLevel
        levelJson.level = level
        await wait(ms)
    } else {
        throwError(`识别异常==>${res.text}<==`)
    }

    await warn(`[OCR]-level:${levelJson.level}-sumLevel:${levelJson.sumLevel}`)
    return levelJson
}

/**
 * 单次点击强化功能
 * @param operate - 操作参数

 * @param log_off - 日志开关
 * @returns {Promise<{sumLevel: number, level: number, ok: boolean,start: boolean,okMsg: string, errorMsg: string}>} - 返回一个Promise对象，表示异步操作的完成
 */
async function upOperate(operate, source = 'upOperate', log_off) {
    let ms = 800
    let upJson = {
        sumLevel: 0,//预估可提升至等级
        level: 0,//实际等级
        ok: false, // 是否强化成功的标志
        errorMsg: '', // 强化失败的错误信息
        okMsg: '', // 强化失败的错误信息
        start: true // 强化过
    }

    await wait(ms)
    //点击operate按钮
    let operateJson = {
        text: operate,
        path_base: path_base_main,
        type: '.jpg',
    }
    await templateMatchClickByJson(operateJson, `点击${operate}`, source, log_off)  // 调用模板匹配识别并点击指定按钮
    await wait(ms)

    let templateMatchHolyRelics = await templateMatchHolyRelicsUpFrequency();
    await wait(ms)
    upJson.level = templateMatchHolyRelics.level
    upJson.sumLevel = templateMatchHolyRelics.sumLevel
    // 输出当前圣遗物等级的日志信息
    log.info(`===`)
    log.info(`当前圣遗物等级: {templateMatchHolyRelics.level}`,templateMatchHolyRelics.level)
    log.info(`当前圣遗物预估可提升至: {templateMatchHolyRelics.sumLevel}`,templateMatchHolyRelics.level)
    if (templateMatchHolyRelics.sumLevel % 4 !== 0) {
        upJson.errorMsg = '强化失败:狗粮不足'
        upJson.ok = false;
        throwError(upJson.errorMsg)
        return upJson
    }

    // 检查圣遗物是否已达到满级（20级）
    if (templateMatchHolyRelics.level === 20 || templateMatchHolyRelics.level >= config.upMax) {
        upJson.start = false
        // 记录圣遗物已满级的日志信息
        let op = templateMatchHolyRelics === 20 ? '已满级' : `已达到设置上限${config.upMax}`
        let msg1 = `圣遗物${op}`;
        await warn(msg1)
        // // reJson.errorMsg = msg1
        // // 检查是否启用了批量强化功能
        // if (config.enableBatchUp) {
        //     //批量强化已开启，执行满级退出强化页面的操作
        //     //满级退出强化页面 到圣遗物背包界面
        //     await wait(10)
        //     let up_name = '返回键'
        //     let logMsg = `${op}退出强化页面 到圣遗物背包界面`;
        //     await templateMatchClick(`${path_base_main}${up_name}.jpg`, logMsg, source, log_off)
        // } else {
        // }
        return upJson

    }

    await confirm(`[upOperate]点击确认`)  // 确认操作
    await mTo(0, 0)
    await wait(ms)
    // 定义错误信息为"摩拉不足"
    // let err = '摩拉不足'
    let morra_is_not_enough = getJsonPath('morra_is_not_enough', false)
    let errJson = {
        text: morra_is_not_enough.name,
        path_base: morra_is_not_enough.path,
        type: morra_is_not_enough.type,
    }
    let err = errJson.text
    // 检查强化是否成功
    let upOk = await templateMatchClickByJson(errJson, `确认强化是否成功`, log_off)
    // 如果识别到错误信息
    if (isExist(upOk)) {
        error(`${err}!`);  // 输出错误信息
        upJson.errorMsg = err;  // 设置强化失败的错误信息
        throwError(err)
        return upJson
    } else {
        upJson.ok = true;  // 设置强化成功的标志
    }
    //等待时间过短导致识别不上
    await wait(1600)

    let levelJson = await templateMatchHolyRelicsUpFrequency();
    upJson.sumLevel = levelJson.sumLevel
    upJson.level = levelJson.level

    if ((!upJson.start) && templateMatchHolyRelics.level === levelJson.level) {
        //真实强化过
        upJson.errorMsg = '强化失败:狗粮不足'
        upJson.ok = false;
        throwError(upJson.errorMsg)
        return upJson
    }

    warn(`[upOperate] {level: ${upJson.level},sumLevel ,${upJson.sumLevel}}`)
    // upJson.upOk = upJson.level !== 0 && upJson.level === upJson.sumLevel
    return upJson
}


/**
 * 单次强化函数
 *
 * 该函数用于执行一次强化操作，通过调用operateDispose处理操作参数，然后调用upOperate执行实际强化
 * @param operate - 操作参数对象，包含强化所需的相关配置信息
 * @param log_off - 是否记录日志的布尔值，用于控制是否输出操作日志
 * @returns {Promise<{sumLevel: number, level: number, await errorMsg: string}>} - 返回一个Promise，表示异步操作的完成，无返回值
 */
async function UpClick(operate, source = 'UpClick', log_off = config.log_off, isFirst = true) {
    let ms = 600
    let reJson = {
        sumLevel: 0,//预估可提升至等级
        level: 0,//实际等级
        errorMsg: null, // 失败的错误信息
        ok: false,
        okMsg: '',
        start: true
    }
    let count = 1
    let upMax = config.upMax

    // operate = await operateDispose(operate, false, log_off)
    // await wait(50)  // 等待500毫秒，确保界面响应

    if (isFirst) {
        // 调用operateDispose函数处理操作参数，处理后的结果重新赋值给operate变量
        warn(`首次操作`)

        if (upMax < 20) {
            //强制使用阶段放入
            operate = '阶段放入'
            warn(`强制使用阶段放入`)

            operate = await operateDispose(operate, true, log_off)
            await wait(ms)
        }

    }
    warn(`执行`)
    if (operate === '阶段放入') {
        count = upMax / 4;
    }

    for (let i = 0; i < count; i++) {
        operate = await operateDispose(operate, false, log_off)
        await wait(ms)  // 等待500毫秒，确保界面响应
        // 调用upOperate函数执行实际的强化操作，传入处理后的operate参数和日志控制参数
        let up = await upOperate(operate, source, log_off)
        reJson.start = up.start
        reJson.ok = up.ok
        reJson.errorMsg = up.errorMsg
        reJson.okMsg = up.okMsg
        reJson.level = up.level
        reJson.sumLevel = up.sumLevel
        warn(`单个圣遗物第${i + 1}次强化`)
        if (up.start && !up.ok) {
            //实际强化过
            // 如果强化失败，记录错误信息
            // throw new Error(`${up.errorMsg}`);
            throwError(up.errorMsg)
        } else if (!up.start) {
            //已达到要求的圣遗物
            warn(`该圣遗物已符合要求${reJson.okMsg}==>{level:${up.level},sumLevel:${up.sumLevel}}`)
            break
        } else if ((!up.ok) && up.sumLevel % 4 != 0) {
            let msg2 = `圣遗物预估可提升至等级: ${up.sumLevel}，未达到下一阶段等级，退出强化`;
            await info(msg2)
            await warn(msg2, must)
            reJson.errorMsg = msg2
            reJson.okMsg = msg2
            // throwError(msg2)
            break
        } else {
            await info(`强化成功`)
            reJson.ok = true
            reJson.start = false
            reJson.okMsg = '强化成功'
        }
    }
    warn(`[UpClick] {level: ${reJson.level},sumLevel ,${reJson.sumLevel}}`)
    warn(`执行完成`)
    return reJson
}


async function UpClickLv1(operate, source = 'UpClickLv1', log_off = config.log_off, isFirst = true) {
    let ms = 600
    let reJson = {
        sumLevel: 0,//预估可提升至等级
        level: 0,//实际等级
        errorMsg: null, // 失败的错误信息
        ok: false,
        okMsg: '',
        start: true,
        missed: false,//是否未命中
        missedMsg: '',//未命中
    }
    let count = 1
    let upMax = config.upMax

    let name = undefined
    // operate = await operateDispose(operate, false, log_off)
    // await wait(50)  // 等待500毫秒，确保界面响应

    if (isFirst) {
        // 调用operateDispose函数处理操作参数，处理后的结果重新赋值给operate变量
        warn(`首次操作`)

        if (upMax < 20) {
            //强制使用阶段放入
            operate = '阶段放入'
            warn(`强制使用阶段放入`)

            operate = await operateDispose(operate, true, log_off)
            await wait(ms)
        }
    }
    let holyRelic = await ocrHolyRelicName()
    name = holyRelic.name
    await wait(ms)

    warn(`执行`)
    if (operate === '阶段放入') {
        count = upMax / 4;
    }

    for (let i = 0; i < count; i++) {
        let one = await ocrAttributeHolyRelic()

        if (i < 1) {
            if (config.meetAllSiftAttributeHolyRelic) {
                //&&操作
                let meetCount = 0
                if (!holyRelicPartMapBySift.get(name)) {
                    warn("holyRelicPartMapBySift==>" + JSON.stringify(Array.from(holyRelicPartMapBySift)));
                    reJson.start = false
                    reJson.missed = true
                    reJson.missedMsg = `未命中圣遗物部件${Array.from(holyRelicPartMapBySift.keys()).join(',')}跳过`
                    warn(reJson.missedMsg)
                    return reJson
                }

                if (holyRelicPartMapBySift.get(name) && holyRelicPartMapBySift.get(name).main.length > 0 && !holyRelicPartMapBySift.get(name).main.includes(one.main)) {
                    //未命中主属性跳过
                    warn("holyRelicPartMapBySift==>" + JSON.stringify(Array.from(holyRelicPartMapBySift)));
                    reJson.start = false
                    reJson.missed = true
                    reJson.missedMsg = `未命中主属性${JSON.stringify(holyRelicPartMapBySift.get(name).main.join(','))}跳过`
                    await warn(reJson.missedMsg)
                    return reJson
                }

                one.sub.forEach((item) => {
                    if (holyRelicPartMapBySift.get(name) && holyRelicPartMapBySift.get(name).sub.includes(item.name)) {
                        meetCount++
                    }
                })

                if (meetCount !== one.sub.length) {
                    warn("holyRelicPartMap==>" + JSON.stringify(Array.from(holyRelicPartMap)));
                    //未命中全部子属性跳过
                    reJson.start = false
                    reJson.missed = true
                    reJson.missedMsg = `未命中全部子属性${JSON.stringify(holyRelicPartMapBySift.get(name).sub.join(','))}跳过`
                    await warn(reJson.missedMsg)
                    return reJson
                }
            } else {
                if (!holyRelicPartMap.get(name)) {
                    warn("holyRelicPartMap==>" + JSON.stringify(Array.from(holyRelicPartMap)));
                    reJson.start = false
                    reJson.missed = true
                    reJson.missedMsg = `未命中圣遗物部件${Array.from(holyRelicPartMap.keys()).join(',')}跳过`
                    warn(reJson.missedMsg)
                    return reJson
                }

                if (holyRelicPartMap.get(name) && holyRelicPartMap.get(name).main.length > 0 && !holyRelicPartMap.get(name).main.includes(one.main)) {
                    //未命中主属性跳过
                    warn("holyRelicPartMap==>" + JSON.stringify(Array.from(holyRelicPartMap)));
                    reJson.start = false
                    reJson.missed = true
                    reJson.missedMsg = `未命中主属性${JSON.stringify(holyRelicPartMap.get(name).main.join(','))}跳过`
                    await warn(reJson.missedMsg)
                    return reJson
                }

                if (holyRelicPartMapBySift.get(name) && holyRelicPartMapBySift.get(name).sub.length > 0 && !one.sub.find((item => holyRelicPartMapBySift.get(name).sub.includes(item.name)))) {
                    warn("holyRelicPartMap==>" + JSON.stringify(Array.from(holyRelicPartMap)));
                    //未命中子属性跳过
                    reJson.start = false
                    reJson.missed = true
                    reJson.missedMsg = `未命中子属性${JSON.stringify(holyRelicPartMapBySift.get(name).sub.join(','))}跳过`
                    await warn(reJson.missedMsg)
                    return reJson
                }
            }
        } else {
            if (holyRelicPartMap.get(name) && holyRelicPartMap.get(name).sub.length > 0 && !one.sub.find((item => holyRelicPartMap.get(name).sub.includes(item.name)))) {
                warn("holyRelicPartMap==>" + JSON.stringify(Array.from(holyRelicPartMap)));
                //未命中子属性跳过
                reJson.start = false
                reJson.missed = true
                reJson.missedMsg = `未命中子属性${JSON.stringify(holyRelicPartMap.get(name).sub.join(','))}跳过`
                await warn(reJson.missedMsg)
                return reJson
            }
        }

        await wait(ms)  // 等待500毫秒，确保界面响应
        operate = await operateDispose(operate, false, log_off)

        await wait(ms)  // 等待500毫秒，确保界面响应
        // 调用upOperate函数执行实际的强化操作，传入处理后的operate参数和日志控制参数
        let up = await upOperate(operate, source, log_off)
        reJson.start = up.start
        reJson.ok = up.ok
        reJson.errorMsg = up.errorMsg
        reJson.okMsg = up.okMsg
        reJson.level = up.level
        reJson.sumLevel = up.sumLevel
        warn(`单个圣遗物第${i + 1}次强化`)
        if (up.start && !up.ok) {
            //实际强化过
            // 如果强化失败，记录错误信息
            // throw new Error(`${up.errorMsg}`);
            throwError(up.errorMsg)
        } else if (!up.start) {
            //已达到要求的圣遗物
            warn(`该圣遗物已符合要求${reJson.okMsg}==>{level:${up.level},sumLevel:${up.sumLevel}}`)
            break
        } else if ((!up.ok) && up.sumLevel % 4 != 0) {
            let msg2 = `圣遗物预估可提升至等级: ${up.sumLevel}，未达到下一阶段等级，退出强化`;
            await info(msg2)
            await warn(msg2, must)
            reJson.errorMsg = msg2
            reJson.okMsg = msg2
            // throwError(msg2)
            break
        } else {
            await info(`强化成功`)
            reJson.ok = true
            reJson.start = false
            reJson.okMsg = '强化成功'
            await wait(ms)  // 等待500毫秒，确保界面响应

            let two = await ocrAttributeHolyRelic()
            let diffJson = await getSubFirstDifferentValues(one.sub, two.sub)
            warn('diffJson==>' + JSON.stringify(diffJson))
            let upKey
            if (diffJson.length > 0) {
                upKey = diffJson.diff[diffJson.length - 1]
            } else {
                warn('新版本3词条显示4词条可能识别到 取最后一条')
                //新版本3词条显示4词条可能识别到 取最后一条
                upKey = two.sub[two.sub.length - 1]
            }
            if (holyRelicPartMap.get(name) && holyRelicPartMap.get(name).sub.length > 0 && !holyRelicPartMap.get(name).sub.includes(upKey)) {
                //未命中子属性跳过
                reJson.missed = true
                reJson.missedMsg = `未命中子属性${holyRelicPartMap.get(name).sub.join(',')}跳过`
                warn(reJson.missedMsg)
                return reJson
            }

        }
    }
    warn(`[UpClickLv1] {level: ${reJson.level},sumLevel ,${reJson.sumLevel}}`)
    warn(`执行完成`)
    return reJson
}


async function ocrTest() {
    // let t = await templateMatch(`${path_base_main}test/+16.jpg`)
    // await logInfoTemplate(t, "测试")
    // let key = await templateMatch(`${path_base_main}test/key.jpg`)
    // await logInfoTemplate(key, "key")
    /*    mTo(Math.ceil(genshinJson.width *3/4), Math.ceil(genshinJson.height * 0.5))
        await scrollPage(200,true)
        let key = await templateMatch(`${path_base_main}test/+17.jpg`)
        await logInfoTemplate(key, "key")*/
    // return
    // await templateMatchHolyRelicsUpFrequency()

    let captureRegion = openCaptureGameRegion(); // 截取游戏画面

    let f = {
        x: 1347,
        y: 430,
        width: 39,
        height: 23
    }
    let fTemplate = await recognitionObjectOcr(f.x, f.y, f.width, f.height); // 创建OCR识别对象
    let fRes = findByCaptureGameRegion(captureRegion, fTemplate); // 执行OCR识别
    await logInfoTemplate(fRes, "f")

    //x=1172, y=134,width:124,height:41
    let all = {
        x: 1172,
        y: 134,
        width: 124,
        height: 41
    }
    let allTemplate = await recognitionObjectOcr(all.x, all.y, all.width, all.height); // 创建OCR识别对象
    let allRes = findByCaptureGameRegion(captureRegion, allTemplate); // 执行OCR识别
    await logInfoTemplate(allRes, "ALL")
    //当前x 1175 y 138 width 68 height 35
    let current = {
        x: 1175,
        y: 138,
        width: 68,
        height: 35
    }

    let currentTemplate = await recognitionObjectOcr(current.x, current.y, current.width, current.height); // 创建OCR识别对象
    let currentRes = findByCaptureGameRegion(captureRegion, currentTemplate); // 执行OCR识别
    await logInfoTemplate(currentRes, "当前等级")
    //预估加x 1242 y 141 width 52 height 28
    let estimate = {
        x: 1259,
        y: 141,
        width: 32,
        height: 29
    }
    let estimateTemplate = await recognitionObjectOcr(estimate.x, estimate.y, estimate.width, estimate.height); // 创建OCR识别对象
    let estimateRes = findByCaptureGameRegion(captureRegion, estimateTemplate); // 执行OCR识别
    await logInfoTemplate(estimateRes, "+等级")

    return
}

async function test() {
    let isDown = false
    let base_x = Math.floor(genshinJson.width * 178 / 1920)
    let base_y = Math.floor(genshinJson.height * 200 / 1080)
    let base_width = Math.floor(genshinJson.width * 145 / 1920)
    let base_height = Math.floor(genshinJson.height * 189 / 1080)
    let line = 8
    let page = line * 4
    let startPage = 20//开始页数
    let pageNumber = 20//开始页数后每多少页偏移一次
    await clickProgressBarTopByHolyRelics()
    for (let i = 0; i < page * 200; i++) {


        //从10页开始偏移一次后 每20页偏移一次
        if ((!isDown) && (((i + 1) / page === startPage && (i + 1) % page === 0) || (Math.floor((i + 1) / page) > startPage && (i + 1 - startPage) % (pageNumber * page) === 0))) {
            warn(`第${i < startPage ? 1 : (i + 1 - startPage) / (pageNumber * page)}次加滑动修偏移运行`, must)
            await scrollPagesByHolyRelicsSelect()
            await wait(300)
        }

        let bool = i >= (page) && i % (page) === 0;
        if (bool) {
            warn(`第${Math.floor((i + 1) / (page))}次运行`, must)
            await info(`滑动一页`, must)
            /*for (let j = 0; j < page / line; j++) {
                await wait(1)
                let line = Math.floor(genshinJson.height * 175 / 1080)
                mTo(Math.floor(genshinJson.width / 2), Math.floor(genshinJson.height * 2 / 3))
                await scrollPage(line, false, 6)
            }*/
            if (isDown) {
                info(`已滑动到底部`, must)
                break
            }
            isDown = await scrollPagesByHolyRelics();
            await wait(300)

        }

        if (isDown) {
            // base_x=
            base_y = Math.floor(genshinJson.height * 270 / 1080)
        }

        let base_count_x = Math.floor(i % line)
        let base_count_y = (i % page) < line ? 0 : Math.floor((i % page) / line);
        let x = base_x + base_count_x * base_width;
        let y = base_y + base_count_y * base_height;

        // await mTo(x, y)
        //测试等待值调低
        await wait(150)
        await downClick(x, y)
    }
}

/**
 * @returns {Promise<{err: boolean, cont: boolean,  msg: string}>} - 返回一个Promise，表示异步操作的完成，无返回值
 */
async function examine() {
    let ms = 600
    let reJson = {
        err: false,
        cont: false,
        msg: ''
    }
    let consecration_oil_paste = getJsonPath('consecration_oil_paste', false)
    let consecration_essence = getJsonPath('consecration_essence', false)
    let five_star_json = getJsonPath('five_star');

    //检查
    let json = {
        path_base: consecration_oil_paste.path,
        text: consecration_oil_paste.name,
        type: consecration_oil_paste.type,
    }
    let template = await templateMatchFindByJson(json)
    if (isExist(template)) {
        // error(`[匹配到${template_name}-退出强化]圣遗物强化+${config.upMax} 数量：${actualCount}`, must)
        reJson.err = true
        reJson.msg = `[匹配到${json.text}-退出强化]`
        return reJson
    }
    await wait(ms)
    // json.text = '祝圣油膏'
    json.type = consecration_essence.type
    json.path_base = consecration_essence.path
    json.text = consecration_essence.name
    template = await templateMatchFindByJson(json)
    if (isExist(template)) {
        // error(`[匹配到${template_name}-退出强化]圣遗物强化+${config.upMax} 数量：${actualCount}`, must)
        reJson.err = true
        reJson.msg = `[匹配到${json.text}-退出强化]`
        return reJson
    }

    let teJson = {
        path_base: five_star_json.path,
        text: five_star_json.name,
        type: five_star_json.type,
        x: Math.ceil(genshinJson.width * 1314 / 1920),
        y: Math.ceil(genshinJson.height * 128 / 1080),
        width: Math.floor(genshinJson.width * 475 / 1920),
        height: Math.floor(genshinJson.height * 762 / 1080)
    }
    await mTo(Math.floor(teJson.x + teJson.width / 2), Math.floor(teJson.y + teJson.height / 2))
    await wait(ms)
    await scrollPage(100, true, 6, 30, 1)
    //检查

    let te = await templateMatchFindByJson(teJson)
    if (!isExist(te)) {
        // warn(`[匹配到非${te_name}-跳过]`, must)
        reJson.cont = true
        reJson.msg = `[匹配到非${teJson.text}-跳过]`
    }
    return reJson
}

async function bathClickUpLv1(operate, source = 'bathClickUpLv1', log_off = config.log_off) {
    let ms = 600
    // let index = 0
    let upMaxCount = 0
    if (config.upMaxCount) {
        upMaxCount = parseInt(config.upMaxCount)
    }
    if (upMaxCount === null || upMaxCount <= 0) {
        throwError(`圣遗物强化个数 必须大于0`)
        return
    }
    //实际强化次数
    let actualCount = 0

    //点击圣遗物次数
    let i = 0
    //预留
    let lastJson = {
        t_x: 0,//当前临时x
        t_y: 0,//当前临时y
        x: 0,
        y: 0,
        lastLevel: 0,
        t_level: 0,
    }

    let isDown = false

    let base_x = Math.floor(genshinJson.width * 178 / 1920)
    let base_y = Math.floor(genshinJson.height * 200 / 1080)
    let base_width = Math.floor(genshinJson.width * 145 / 1920)
    let base_height = Math.floor(genshinJson.height * 189 / 1080)
    let line = 8
    let page = line * 4
    let startPage = 20//开始页数
    let pageNumber = 20//开始页数后每多少页偏移一次
// await clickProgressBarTopByHolyRelics()

    info(`圣遗物${config.sortMain}强化操作`, must)
    let isFirst = false
    for (let i = 0; upMaxCount > actualCount; i++) {
        if (upMaxCount === actualCount) {
            info(`强化次数已达到:${upMaxCount}`, must)
            break
        }

        if (config.sortMain.includes(mana.get('desc_order')) && isDown) {
            base_y = Math.floor(genshinJson.height * 270 / 1080)
        }

        let base_count_x = Math.floor(i % line)
        let base_count_y = (i % page) < line ? 0 : Math.floor((i % page) / line);
        let x = base_x + base_count_x * base_width;
        let y = base_y + base_count_y * base_height;
        warn(`i:${i},base_count_x:${base_count_x},base_count_y:${base_count_y},x:${x},y:${y}`)
        lastJson.t_y = y
        lastJson.t_x = x
        let isBool = config.sortMain.includes(mana.get('desc_order')) && config.upMax < 20;
        if (isBool) {
            if (i < 1) {
                //强制拉到顶
                await clickProgressBarTopByHolyRelics()
                await wait(ms);
            }

            //从10页开始偏移一次后 每20页偏移一次
            if ((!isDown) && (((i + 1) / page === startPage && (i + 1) % page === 0) || (Math.floor((i + 1) / page) > startPage && (i + 1 - startPage) % (pageNumber * page) === 0))) {
                warn(`第${i < startPage ? 1 : (i + 1 - startPage) / (pageNumber * page)}次加滑动修偏移运行`)
                await scrollPagesByHolyRelicsSelect()
                await wait(ms)
            }

            let bool = i >= (page) && i % (page) === 0;
            if (bool) {
                await info(`滑动一页`, must)
                if (isDown) {
                    info(`已滑动到底部`, must)
                    break
                }
                isDown = await scrollPagesByHolyRelics();
                await wait(ms)
            }
            await wait(ms)
            await downClick(x, y)
            warn(`点击确认x:${x},y:${y}`)
        } else {
            //强制拉到顶
            await clickProgressBarTopByHolyRelics()
            await wait(ms);
            // 调用点击第一个圣物遗物的函数，并等待其完成
            // await downClickFirstHolyRelics()
            await downClick(base_x, base_y)
            // await wait();
        }
        let ex = await examine()
        if (ex.err) {
            await error(ex.msg, must)
            break
        } else if (ex.cont) {
            await warn(ex.msg, must)
            continue
        }
        let log_msg = isBool ? '降序强化点击确认' : '点击第一个圣遗物'
        await confirm(log_msg, isBool ? '降序confirm' : 'downClickFirstHolyRelics')
        // await wait(ms)
        //避免多次点击
        await mTo(genshinJson.width / 2, genshinJson.height / 2)
        await wait(ms)
        await info(log_msg)

        await openAggrandizement()
        await wait(ms)  // 等待500毫秒，确保界面响应

        let re = await UpClick(operate, source, log_off, i === 0 ? true : isFirst);
        warn(`第${i}次强化结果:{sumLevel: ${re.sumLevel},level: ${re.level},errorMsg: ${re.errorMsg},ok: ${re.ok},okMsg: ${re.okMsg},start: ${re.start}}`)
        if (re.ok) {
            lastJson.t_level = re.level
        }

        //放入方式的判断
        if (i === 0 && re.start && (!isFirst) && !re.ok) {
            //只要一次
            isFirst = true
        }

        if (i !== 0 && isFirst) {
            //也只会执行一次 需求 true 变false 一次 中for中 以到达放入方式值操作一次开关
            isFirst = isFirst && !re.ok
        }

        if (re.ok || !re.start) {
            actualCount++
            // 如果强化成功，则继续下一个圣遗物
            await info(((!re.ok) && !re.start) ? `需求:+${config.upMax},实际:+${re.level},符合要求` : `需求:+${re.level} 强化成功`, must)
            await wait(ms)
            // let up_name = '返回键'
            let return_key_json = getJsonPath('return_key')
            let upJson = {
                text: return_key_json.name,
                path_base: return_key_json.path,
                type: return_key_json.type,
            }
            await templateMatchClickByJson(upJson, `圣遗物已经强化到+${config.upMax}退出强化页面 到圣遗物背包界面`, source, log_off)
            //返回圣遗物背包
            if (!re.start) {
                if (!config.sortMain.includes(mana.get('desc_order'))) {
                    // await clickProgressBarTopByHolyRelics()
                }
                continue
            }
        } else {
            // 如果强化失败，则退出循环
            await infoLog(`强化失败:${re.errorMsg}`, source)
            break
        }

        lastJson.y = lastJson.t_y
        lastJson.x = lastJson.t_x
        if (re.ok) {
            lastJson.lastLevel = lastJson.t_level
        }

        if (upMaxCount !== null && i === upMaxCount - 1) {
            info(`${upMaxCount}个圣遗物已经强化到+${config.upMax}终止运行`)
            await toMainUi()
            await wait(ms)
            break
        }
        warn(`当前强化次数:${actualCount} 总强化次数:${upMaxCount}`)
    }
    info(`圣遗物强化+${config.upMax} 数量：${actualCount}`, must)

}

async function bathClickUpLv2(operate, source = 'bathClickUpLv2', log_off = config.log_off) {
    let countJson = {
        missed: 0,//未命中
        noUp: 0,//未强化
        up: 0,//强化
    }
    let ms = 600
    // let index = 0
    let upMaxCount = 0
    if (config.upMaxCount) {
        upMaxCount = parseInt(config.upMaxCount)
    }
    if (upMaxCount === null || upMaxCount <= 0) {
        throwError(`圣遗物强化个数 必须大于0`)
        return
    }
    //实际强化次数
    let actualCount = 0

    //点击圣遗物次数
    let i = 0
    //预留
    let lastJson = {
        t_x: 0,//当前临时x
        t_y: 0,//当前临时y
        x: 0,
        y: 0,
        lastLevel: 0,
        t_level: 0,
    }

    let isDown = false

    let base_x = Math.floor(genshinJson.width * 178 / 1920)
    let base_y = Math.floor(genshinJson.height * 200 / 1080)
    let base_width = Math.floor(genshinJson.width * 145 / 1920)
    let base_height = Math.floor(genshinJson.height * 189 / 1080)
    let line = 8
    let page = line * 4
    let startPage = 20//开始页数
    let pageNumber = 20//开始页数后每多少页偏移一次
// await clickProgressBarTopByHolyRelics()

    info(`圣遗物${config.sortMain}强化操作`, must)
    let isFirst = false
    for (let i = 0; upMaxCount > actualCount; i++) {
        if (upMaxCount === actualCount) {
            info(`强化次数已达到:${upMaxCount}`, must)
            break
        }

        if (config.sortMain.includes(mana.get('desc_order')) && isDown) {
            base_y = Math.floor(genshinJson.height * 270 / 1080)
        }

        let base_count_x = Math.floor(i % line)
        let base_count_y = (i % page) < line ? 0 : Math.floor((i % page) / line);
        let x = base_x + base_count_x * base_width;
        let y = base_y + base_count_y * base_height;
        warn(`i:${i},base_count_x:${base_count_x},base_count_y:${base_count_y},x:${x},y:${y}`)
        lastJson.t_y = y
        lastJson.t_x = x
        let isBool = config.sortMain.includes(mana.get('desc_order')) && config.upMax < 20;
        if (isBool) {
            if (i < 1) {
                //强制拉到顶
                await clickProgressBarTopByHolyRelics()
                await wait(ms);
            }

            //从10页开始偏移一次后 每20页偏移一次
            if ((!isDown) && (((i + 1) / page === startPage && (i + 1) % page === 0) || (Math.floor((i + 1) / page) > startPage && (i + 1 - startPage) % (pageNumber * page) === 0))) {
                warn(`第${i < startPage ? 1 : (i + 1 - startPage) / (pageNumber * page)}次加滑动修偏移运行`)
                await scrollPagesByHolyRelicsSelect()
                await wait(ms)
            }

            let bool = i >= (page) && i % (page) === 0;
            if (bool) {
                await info(`滑动一页`, must)
                if (isDown) {
                    info(`已滑动到底部`, must)
                    break
                }
                isDown = await scrollPagesByHolyRelics();
                await wait(ms)
            }
            await wait(ms)
            await downClick(x, y)
            warn(`点击确认x:${x},y:${y}`)
        } else {
            //强制拉到顶
            await clickProgressBarTopByHolyRelics()
            await wait(ms);
            // 调用点击第一个圣物遗物的函数，并等待其完成
            // await downClickFirstHolyRelics()
            await downClick(base_x, base_y)
            // await wait();
        }
        let ex = await examine()
        if (ex.err) {
            await error(ex.msg, must)
            break
        } else if (ex.cont) {
            await warn(ex.msg, must)
            continue
        }
        let log_msg = isBool ? '降序强化点击确认' : '点击第一个圣遗物'
        await confirm(log_msg, isBool ? '降序confirm' : 'downClickFirstHolyRelics')
        // await wait(ms)
        //避免多次点击
        await mTo(genshinJson.width / 2, genshinJson.height / 2)
        await wait(ms)
        await info(log_msg)

        await openAggrandizement()
        await wait(ms)  // 等待500毫秒，确保界面响应

        let re = await UpClickLv1(operate, source, log_off, i === 0 ? true : isFirst);
        warn(`第${i}次强化结果:{sumLevel: ${re.sumLevel},level: ${re.level},errorMsg: ${re.errorMsg},ok: ${re.ok},okMsg: ${re.okMsg},start: ${re.start}}`)

        if (re.ok) {
            countJson.up = countJson.up + 1
            lastJson.t_level = re.level
        } else if (re.missed) {
            countJson.missed = countJson.missed + 1
        } else if (!re.start) {
            countJson.noUp = countJson.noUp + 1
        }

        //放入方式的判断
        if (i === 0 && re.start && (!isFirst) && !re.ok) {
            //只要一次
            isFirst = true
        }

        if (i !== 0 && isFirst) {
            //也只会执行一次 需求 true 变false 一次 中for中 以到达放入方式值操作一次开关
            isFirst = isFirst && !re.ok
        }

        if (re.ok || !re.start) {
            actualCount++
            // 如果强化成功，则继续下一个圣遗物
            let msg
            let msg_log
            if (re.missed) {
                msg = `${re.missedMsg}`
                msg_log = `${re.missedMsg}`
            } else {
                msg_log = `圣遗物已经强化到+${config.upMax}`
                msg =
                    ((!re.ok) && !re.start) ? `需求:+${config.upMax},实际:+${re.level},符合要求` : `需求:+${re.level} 强化成功`;
            }
            await info(msg, must)
            await wait(ms)
            // let up_name = '返回键'
            let return_key_json = getJsonPath('return_key')
            let upJson = {
                text: return_key_json.name,
                path_base: return_key_json.path,
                type: return_key_json.type,
            }
            // let up_json = {text: '返回键', type: '.jpg', path_base: path_base_main}
            await templateMatchClickByJson(upJson, `${msg_log},退出强化页面 到圣遗物背包界面`, source, log_off)
            //返回圣遗物背包
            if (re.missed || !re.start) {
                if (!config.sortMain.includes(mana.get('desc_order'))) {
                    // await clickProgressBarTopByHolyRelics()
                }
                continue
            }
        } else {
            // 如果强化失败，则退出循环
            await infoLog(`强化失败:${re.errorMsg}`, source)
            break
        }

        lastJson.y = lastJson.t_y
        lastJson.x = lastJson.t_x
        if (re.ok) {
            lastJson.lastLevel = lastJson.t_level
        }

        if (upMaxCount !== null && i === upMaxCount - 1) {
            info(`${upMaxCount}个圣遗物已经强化到+${config.upMax}终止运行`)
            await toMainUi()
            await wait(ms)
            break
        }
        warn(`当前强化次数:${actualCount} 总强化次数:${upMaxCount}`)
    }
    info(`圣遗物强化+${config.upMax} 未命中属性数量：${countJson.missed},达到等级数量:${countJson.up},未实际强化数量:${countJson.noUp}, 设定数量：${actualCount}`, must)

}

async function toMainUi() {
    let ms = 300
    let index = 1
    await wait();
    while (!isInMainUI()) {
        await wait();
        await genshin.returnMainUi(); // 如果未启用，则返回游戏主界面
        await wait();
        if (index > 3) {
            throwError(`多次尝试返回主界面失败`);
        }
        index += 1
    }

}


(async function () {
    await init()
    await main()
})();

//=========弃用以下=========

/**
 * 打开选择素材条件 弃用
 * 该函数用于打开游戏中的素材选择界面，并根据传入的条件自动选择对应的素材
 * @param {string} condition - 需要选择的素材条件文本
 * @returns {Promise<void>} 异步函数，无返回值
 * todo:<前置条件:处于圣遗物强化界面|测试通过:x> 出现问题：执行完成后会自动点击按键 任务结束后也会出现 执行下其他脚本后消失
 */
async function openSelectTheClipCondition(condition = config.material) {
    let ms = 100
    // 检查是否传入了有效的素材条件
    await info(condition)
    if (condition === null || condition === mana.get('defaultValue')) {
        await info(`使用默认素材`)
    } else {
        let captureRegion = openCaptureGameRegion();
        let tmJson = {
            x: Math.floor(genshinJson.width * 1300 / 1920),
            y: Math.floor(genshinJson.height * 760 / 1080),
            width: Math.floor(genshinJson.width * 162 / 1920),
            height: Math.floor(genshinJson.height * 173 / 1080)
        }
        // 创建OCR识别对象
        let tm = await recognitionObjectOcr(tmJson.x, tmJson.y, tmJson.width, tmJson.height);
        let res = findByCaptureGameRegion(captureRegion, tm);

        if (isExist(res) && condition === res.text) {
            closeCaptureGameRegion(captureRegion)
            return
        }

        let x = Math.floor(genshinJson.width * 1300 / 1920)
        let y = Math.floor(genshinJson.height * 760 / 1080)
        await downClick(x, y)
        await wait(ms)
        await mTo(genshinJson.width / 2, genshinJson.height / 2)
        // await wait(ms)

        //x: 1194, y: 803,width: 162, height: 173
        let templateMatch = {
            x: Math.floor(genshinJson.width * 1194 / 1920),
            y: Math.floor(genshinJson.height * 803 / 1080),
            width: Math.floor(genshinJson.width * 162 / 1920),
            height: Math.floor(genshinJson.height * 173 / 1080)
        }

        // 创建OCR识别对象
        let templateMatchObject = await recognitionObjectOcr(templateMatch.x, templateMatch.y, templateMatch.width, templateMatch.height);
        // 捕获游戏界面并执行OCR识别

        let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
        closeCaptureGameRegion(captureRegion)

        let index = 0;
        // 遍历OCR识别结果
        for (let res of resList) {
            await info(`[==]${index}识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`);
            // 跳过第一个结果（可能是标题），查找匹配条件的选项
            if (index !== 0 && res.text.includes(condition)) {
                await info(`点击${res.text}`)
                // await wait(ms);
                res.click();
                // await downClick(res.x, res.y);
                await mTo(genshinJson.width / 2, genshinJson.height / 2)
                await info('[break]')
                break;
            }
            index++
        }

        return
    }

}

