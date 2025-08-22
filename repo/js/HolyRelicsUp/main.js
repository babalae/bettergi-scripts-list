/**
 * 主方法
 * @returns {Promise<void>}
 */
async function main(log_off = config.log_off) {
    // await clickProgressBarTopByHolyRelics()
    // await clickProgressBarDownBySort()
    // await openSelectTheClipConditionFix()
    // mTo(1173, 100)
    // await wait(1000)
    // mTo(1200, 200)
    // await wait(1000)
    // mTo(1300, 200)
    // await wait(1000)
    // mTo(1173 + 329, 34 + 145)
    // await ocrHolyRelicsUpFrequency()
    // await openAggrandizement()
    await bathClickUpLv1(config.insertionMethod)
    return
    let ms = 300
    await setGameMetrics(1920, 1080, 1); // 设置游戏窗口大小和DPI
    if (config.enableBatchUp) { // 检查是否启用
        await wait(ms);
        await toMainUi()
        await wait(ms);
        //打开背包
        await openKnapsack();
        await openHolyRelicsKnapsack();
        await wait(ms);
        //排序
        await openPrerequisitesAll(log_off);
        await wait(ms);

        await bathClickUp(config.insertionMethod)
    } else {
        throwError(`未启用批量强化请去浏览文档后开启！`)
    }

    ////选择升级素材 //禁用 存在异常
    // await openSelectTheClipCondition('1星素材');
    ////强化
    // await oneClickUp('快捷放入',null);
}

//========================以下为原有封装==============================
function info(msg) {
    log.info(msg)
}

function warn(msg) {
    log.warn(msg)
}

function debug(msg) {
    log.debug(msg)
}

function error(msg) {
    log.error(msg)
}

function throwError(msg) {
    notification.error(`${msg}`);
}

function openCaptureGameRegion() {
    return captureGameRegion()
}

function closeCaptureGameRegion(region) {
    return region.Dispose()
}

function findByCaptureGameRegion(region, ocrObject) {
    return region.find(ocrObject)
}

function findMultiByCaptureGameRegion(region, ocrObject) {
    return region.findMulti(ocrObject)
}

function mTo(x, y) {
    moveMouseTo(x, y);
}

function recognitionObjectOcr(x, y, width, height) {
    return RecognitionObject.Ocr(x, y, width, height)
}

function downLeftButton() {
    leftButtonDown();
}

function upLeftButton() {
    leftButtonUp();
}

function moveByMouse(x, y) {
    moveMouseBy(x, y);
}

async function wait(ms) {
    // 等待300毫秒，确保按下操作生效
    await sleep(1000);
}

function downClick(x, y) {
    click(x, y);
}

/**
 * 检查资源是否存在
 * @param {Object} res - 需要检查的资源对象
 * @returns {Boolean} 返回资源是否存在的结果
 *                  true表示资源存在，false表示资源不存在
 */
function isExist(res) {
    return res.isExist() // 调用资源对象的isExist方法获取存在状态
}

//========================以上为原有封装==============================
//========================以下为基本配置==============================

function siftAll() {
    //筛选条件
    let baseSiftArray = new Array('未满级')
    if (settings.holyRelicsLockMark) {
        baseSiftArray.push('标记')
    }
    if (settings.holyRelicsLockY) {
        baseSiftArray.push('仅锁定')
    }
    if (settings.holyRelicsLockN) {
        baseSiftArray.push('未锁定')
    }
    if (settings.holyRelicsEquipY) {
        baseSiftArray.push('已装备')
    }
    if (settings.holyRelicsEquipN) {
        baseSiftArray.push('未装备')
    }
    if (settings.holyRelicsSourceFrostSaint) {
        baseSiftArray.push('祝圣之霜定义')
    }
    return baseSiftArray
}

function sortAll() {
    //筛选条件
    let baseSortArray = new Array()
    if (settings.sortMain === '降序') {
        baseSortArray.push(settings.sortMain)
    }
    if (settings.sortAuxiliary === '品质顺序') {
        baseSortArray.push(settings.sortAuxiliary)
    }
    return baseSortArray
}

const config = {
    suit: settings.suit,
    log_off: !settings.log_off,
    countMaxByHoly: Math.ceil(settings.countMaxByHoly),//筛选圣遗物界面最大翻页次数
    enableBatchUp: settings.enableBatchUp,//是否开启批量升级
    enableOneUp: settings.enableOneUp,//是否开启单次升级
    enableInsertionMethod: settings.enableInsertionMethod,//是否开启插入方式
    insertionMethod: settings.insertionMethod,//插入方式
    material: settings.material,//材料
    upMax: parseInt(settings.upMax + ''),//升级次数
    upMaxCount: settings.upMaxCount + '',//设置升级圣遗物个数
    knapsackKey: settings.knapsackKey,//背包快捷键
    sortAuxiliary: settings.sortAuxiliary,//辅助排序
    sortMain: settings.sortMain,//主排序
    sortAttribute: settings.sortAttribute,//属性条件
    siftArray: (siftAll()),//筛选条件
    sortArray: (sortAll())
}
const genshinJson = {
    width: genshin.width,
    height: genshin.height,
}
const attributeMap = new Map([
    ['%', '百分比'],
    ['生命', '生命值'],
    ['防御', '防御力'],
    ['攻击', '攻击力'],
    ['暴率', '暴击率'],
    ['爆率', '暴击率'],
    ['暴伤', '暴击伤害'],
    ['爆伤', '暴击伤害'],
    ['物伤', '物理伤害加成'],
    ['风伤', '风元素伤害加成'],
    ['水伤', '水元素伤害加成'],
    ['雷伤', '雷元素伤害加成'],
    ['岩伤', '岩元素伤害加成'],
    ['草伤', '草元素伤害加成'],
    ['冰伤', '冰元素伤害加成'],
    ['火伤', '火元素伤害加成'],
    ['治疗', '治疗加成'],
    ['精通', '元素精通'],
    ['充能', '元素充能效率'],
]);
const attributeList = [
    '物理伤害加成'
    , '风元素伤害加成'
    , '水元素伤害加成'
    , '雷元素伤害加成'
    , '岩元素伤害加成'
    , '草元素伤害加成'
    , '冰元素伤害加成'
    , '火元素伤害加成'
    , '治疗加成'
    // , '元素精通'
    , '元素充能效率'
]

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
        value = (s === null ? value : s) + attributeMap.get('%')
    } else {
        let s = attributeMap.get(value);
        value = (s === null ? value : s)
    }
    return value
}

//基础目录
const path_base_main = `assets/main/`
const path_base_sort = `${path_base_main}sort/`
//========================以上为基本配置==============================
//========================以下为基本操作==============================
function infoLog(msg, source = '默认', log_off = config.log_off) {
    if (!log_off) {
        info(`[${source}] msg: ${msg}`);
    }
}

function logInfoOcrBase(res, source = '默认', log_off = config.log_off) {
    if (!log_off) {
        info(`[${source}]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
    }
}

/**
 *
 * @param res
 * @returns {Promise<void>}
 */
function logInfoOcr(res, source = '默认',) {
    logInfoOcrBase(res, source)
}

/**
 * 异步函数，用于模拟鼠标拖动操作
 * @param {number} x - 每次移动的X轴距离
 * @param {number} y - 每次移动的Y轴距离
 * @param {number} h - 移动的总步数/高度
 */
async function drag(x, y, h) {
    await dragBase(x, y, h, config.log_off)
}

/**
 * 执行鼠标拖动操作的异步函数
 * @param {number} x - X轴移动距离
 * @param {number} y - Y轴移动距离
 * @param {number} h - 拖动步数
 * @param {boolean} log_off - 是否关闭日志输出
 */
async function dragBase(x, y, h, log_off) {
    // 按下鼠标左键，开始拖动操作
    await downLeftButton();
    // 等待300毫秒，确保按下操作生效
    // await wait(300);
    // 循环移动鼠标，实现拖动效果
    for (let i = 0; i < h; ++i) {
        await moveByMouse(x, y);
        await wait(1);
    }
    // 释放鼠标左键，结束拖动
    await upLeftButton();
    // await wait(300);
    // 如果log_off为false，则输出拖动完成日志
    if (!log_off) {
        await info(`拖动完成，步数: ${h},x:${x},y:${y}`);
    }
}

// 滚动页面函数
/**
 * 滚动页面的异步函数
 * @param {number} totalDistance - 总滚动距离
 * @param {boolean} [isUp=false] - 是否向上滚动，默认为false(向下滚动)
 * @param {number} [waitCount=3] - 每隔多少步等待一次
 * @param {number} [stepDistance=10] - 每步滚动的距离
 * @param {number} [delayMs=1] - 等待的延迟时间(毫秒)
 */
async function scrollPage(totalDistance, isUp = false, waitCount = 3, stepDistance = 10, delayMs = 1) {
    await wait(50);  // 初始等待50ms
    downLeftButton();  // 按下左键
    await wait(50);  // 再次等待50ms
    // 计算总步数
    let steps = Math.ceil(totalDistance / stepDistance);
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
            await wait(delayMs)
        }
    }
    // 滚动完成后释放左键
    await wait(30);
    upLeftButton();
    await wait(100);
}


/**
 * 执行页面基础拖动操作的异步函数
 * @param {boolean} log_off - 是否关闭日志输出的标志位
 * @returns {Promise<void>} - 返回一个Promise，表示拖动操作的完成
 */
async function dragPageBase(log_off) {
    // 计算 drag 高度，基于genshin.height按比例缩放，基准高度为1080
    // 这样可以使拖动高度根据屏幕高度自适应
    let h = Math.ceil(300 * genshinJson.height / 1080)
    // 循环4次执行拖动操作，可能是为了确保页面完全加载或刷新内容
    for (let i = 0; i < 4; i++) {
        // 调用基础拖动函数，参数为x方向不变，y方向向下，高度为h，以及日志标志位
        await dragBase(0, -1, h, log_off)
    }
}


/**
 * 执行页面拖动的异步函数
 * 该函数调用基础拖动函数，并传入false作为参数
 * @returns {Promise<void>} 返回一个Promise，表示拖动操作的完成
 */
async function dragPage() {
    // 调用基础拖动函数，传入false作为参数
    await dragPageBase(config.log_off)
}


/**
 * 识别函数

 * 该函数用于在指定路径的图像上执行OCR（光学字符识别）操作
 * @param path {string} - 图像文件的路径
 * @param x {number} - 识别区域的起始x坐标
 * @param y {number} - 识别区域的起始y坐标
 * @param width {number} - 识别区域的宽度
 * @param height {number} - 识别区域的高度
 * @returns {Promise<*>} - 返回一个Promise对象，解析为识别结果
 */
function ocrBase(path, x, y, width, height) {
    // 使用模板匹配方法创建识别对象
    // 从指定路径读取图像矩阵并进行模板匹配
    let ocrButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path}`), x, y, width, height);
    // 捕获游戏区域并查找匹配的识别对象
    let region = openCaptureGameRegion()
    let button = region.find(ocrButtonRo);
    closeCaptureGameRegion(region)
    // 返回查找到的按钮对象
    return button
}

/**
 * 识别函数 - 用于对指定路径的图像进行OCR文字识别
 * @param path {string} - 需要进行OCR识别的图像文件路径
 * @returns {Promise<*>} - 返回一个Promise对象，解析后的结果为OCR识别的内容
 */
function ocr(path) {
    // 调用基础OCR识别函数，传入完整路径和默认的坐标参数
    // 参数说明：
    // - path: 图像文件路径
    // - 0, 0: 起始坐标(x, y)，设为0表示从图像左上角开始
    // - genshinJson.width: 识别区域的宽度，使用全局变量genshin的宽度值
    // - genshinJson.height: 识别区域的高度，使用全局变量genshin的高度值
    return ocrBase(`${path}`, 0, 0, genshinJson.width, genshinJson.height)
}

/**
 * 识别并点击指定路径的按钮元素

 * @param {string} path - 用于OCR识别的路径或模板
 * @param {string} log_msg - 点击按钮前要记录的日志信息
 * @param {boolean} log_off - 是否关闭日志记录功能，false表示开启日志记录
 * @returns {Promise<void>} - 返回一个Promise对象，表示异步操作的完成
 */
function ocrClick(path, log_msg, source = 'ocrClick', log_off = config.log_off) {
    // 使用OCR技术识别指定路径的按钮元素
    let button = ocr(path);
    // 检查按钮元素是否存在
    if (isExist(button)) {
        // 如果未关闭日志记录功能
        if (!log_off) {
            // 记录操作日志信息
            info(`log_msg==>${log_msg}`)
            info(`ocrPath==>${path}`)
            // 记录OCR识别到的按钮详细信息
            logInfoOcr(button, source)
            info(`日志==>${path}`)
        }
        // 点击按钮元素
        button.click();
    }
    // 返回按钮对象
    return button
}

//========================以上为基本操作==============================
//========================以下为实际操作==============================

/**
 * 打开背包
 * @returns {Promise<Boolean>}
 * <前置条件:处于主界面|测试通过:v>
 */
async function openKnapsack() {
    // // 定义识别对象
    // const knapsackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path_base_main}背包.jpg`), 0, 0,genshinJson.width / 3.0 , genshinJson.width / 5.0);
    // // 通过截取游戏区域并查找背包图标来判断背包是否已打开
    // let knapsack = captureGameRegion().find(knapsackRo);
    let ocrJson = {
        "text": "背包",
        "x": 0,
        "y": 0,
        "width": genshinJson.width / 3.0,
        "height": genshinJson.width / 5.0
    }
    let knapsack = await ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
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
        await wait(1000);
        exist = true
    }
    return exist
}

/**
 * OCR识别圣遗物背包区域的函数
 * 该函数通过OCR技术识别游戏界面中的圣遗物背包区域
 * @returns {Promise} 返回一个Promise对象，解析为OCR识别结果
 */
function ocrHolyRelicsKnapsack() {
    // 定义OCR识别的参数配置对象
    let ocrJson = {
        "text": "圣遗物",               // 要识别的文本内容
        "x": 0,                       // 识别区域的起始x坐标
        "y": 0,                       // 识别区域的起始y坐标
        "width": genshinJson.width / 2.0,    // 识别区域的宽度（屏幕宽度的一半）
        "height": genshinJson.width / 5.0   // 识别区域的高度（屏幕宽度的五分之一）
    }
    // 调用基础OCR函数进行图像识别，传入路径和坐标参数
    let holyRelicsKnapsack = ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
    // 返回OCR识别结果
    return holyRelicsKnapsack
}

/**
 * 打开圣遗物背包
 * @returns {Promise<boolean>}
 * <前置条件:处于背包界面|测试通过:v>
 */
async function openHolyRelicsKnapsack() {
    // const holyRelicsKnapsackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}圣遗物.jpg"), 0, 0, genshinJson.width / 2.0, genshinJson.width / 5.0);
    // // 通过捕获游戏区域并查找圣遗物背包图标元素
    // let holyRelicsKnapsack = captureGameRegion().find(holyRelicsKnapsackRo);
    // let ocrJson = {
    //     "text": "圣遗物",
    //     "x": 0,
    //     "y": 0,
    //     "width": genshinJson.width / 2.0,
    //     "height": genshinJson.width / 5.0
    // }
    let re = false;

    let holyRelicsKnapsack = ocrHolyRelicsKnapsack()
    // 检查圣遗物背包图标是否存在
    if (isExist(holyRelicsKnapsack)) {
        // 打开圣遗物背包
        await info('打开圣遗物背包');  // 记录日志信息
        await holyRelicsKnapsack.click();  // 点击圣遗物背包图标
        await wait(1000);  // 等待500毫秒确保界面加载完成
        re = true
    }

    return re
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
    // const siftRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}筛选.jpg"), 0, 0, genshinJson.width / 3.0, genshinJson.height);
    // 查找筛选按钮元素
    // let sift = captureGameRegion().find(siftRo);
    let ocrSiftJson = {
        "text": "筛选",
        "x": 0,
        "y": 0,
        "width": genshinJson.width / 3.0,
        "height": genshinJson.height
    }
    // 查找筛选按钮元素
    let sift = ocrBase(`${path_base_main}${ocrSiftJson.text}.jpg`, ocrSiftJson.x, ocrSiftJson.y, ocrSiftJson.width, ocrSiftJson.height)
    await wait(1000);
    // 判断筛选按钮是否存在
    let exist = isExist(sift);
    let exist1 = false
    if (exist) {
        await info('打开筛选'); // 记录日志：打开筛选
        await sift.click(); // 点击筛选按钮
        await wait(1000); // 等待500毫秒

        // const resetRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}重置.jpg"), 0, 0, genshinJson.width / 3.0, genshinJson.height);
        // // 查找重置按钮元素
        // let reset = captureGameRegion().find(resetRo);
        let ocrResetJson = {
            "text": "重置",
            "x": 0,
            "y": 0,
            "width": genshinJson.width / 3.0,
            "height": genshinJson.height
        }
        // 查找重置按钮元素
        let reset = await ocrBase(`${path_base_main}${ocrResetJson.text}.jpg`, ocrResetJson.x, ocrResetJson.y, ocrResetJson.width, ocrResetJson.height)
        await wait(1000);
        // 判断重置按钮是否存在
        exist1 = isExist(reset);
        if (exist1) {
            await info('重置'); // 记录日志：重置
            await reset.click(); // 点击重置按钮
            await wait(1000); // 等待500毫秒
        }
    }
    return exist && exist1
}


/**
 * 筛选圣遗物状态<核心:未满级>
 * @param log_off
 * @returns {Promise<void>}
 * <前置条件:处于圣遗物背包 筛选界面|测试通过:v>
 */
async function siftState(log_off) {
    let siftJson = {
        "text": "筛选未满级",    // 按钮显示的文本内容
        "x": 0,                    // 按钮的x坐标
        "y": 0,                    // 按钮的y坐标
        "width": genshinJson.width / 3.0,  // 按钮的宽度为屏幕宽度的1/3
        "height": genshinJson.height      // 按钮的高度为整个屏幕高度
    }
    let siftState = ocrBase(`${path_base_main}${siftJson.text}.jpg`, siftJson.x, siftJson.y, siftJson.width, siftJson.height)
    await wait(300)
    let exist = isExist(siftState);
    if (exist) {
        await logInfoOcrBase(siftState, 'siftState', config.log_off)
        // await mTo(siftState.x, siftState.y)
        siftState.click()
        if (!log_off) {
            await info(`筛选圣遗物状态 核心:未满级`)
        }
        return
    }
    await info(`已${siftJson.text}`)
}

/**
 * 进入筛选圣遗物界面 开始筛选圣遗物套装<1.0.1已修>
 * @param keyword
 * @param log_off
 * @returns {Promise<void>}
 */
async function openSiftHolyRelicsSuitUI_Start(keyword, source = 'HolyRelicsSuitUI', log_off = config.log_off) {
    if (!keyword) {
        return
    }
    let keywords = keyword.trim().split('|');
    if (keywords.length <= 0) {
        return
    }
    let keywordsOk = new Array()
    //1.open
    let siftSiftHolyRelicsSuitUIJson = {
        "text": "进入筛选圣遗物界面",    // 按钮显示的文本内容
        "x": 0,                    // 按钮的x坐标
        "y": 0,                    // 按钮的y坐标
        "width": genshinJson.width / 3.0,  // 按钮的宽度为屏幕宽度的1/3
        "height": genshinJson.height      // 按钮的高度为整个屏幕高度
    }
    keywords.forEach(value => {
        info("==>key:" + value + "<==")
    })
    let sift = await ocrBase(`${path_base_main}${siftSiftHolyRelicsSuitUIJson.text}.jpg`, siftSiftHolyRelicsSuitUIJson.x, siftSiftHolyRelicsSuitUIJson.y, siftSiftHolyRelicsSuitUIJson.width, siftSiftHolyRelicsSuitUIJson.height)
    await wait(300)
    let exist = isExist(sift);

    if (exist) {
        await logInfoOcrBase(sift, 'HolyRelicsSuitUI', log_off)
        // await mTo(siftState.x, siftState.y)
        sift.click()
        if (!log_off) {
            await info(`已${siftSiftHolyRelicsSuitUIJson.text}`)
        }
        await wait(10)
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
            let ocrObject = recognitionObjectOcr(x, y, width, height);
            // await mTo(width, 0)
            // ocrObject.threshold = 1.0;
            let opJsons = new Array()
            let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
            await wait(10)
            for (let res of resList) {
                await logInfoOcr(res, source)
                if (i % 2 !== 0) {
                    last.name_one = res.text
                } else {
                    last.name_two = res.text
                }

                // last.y = res.y
                if (keywords.find(function (value) {
                    return res.text.includes(value.trim())
                }) && (opJsons.length === 0 || opJsons.find(function (value) {
                    return !value.text.includes(res.text)
                }))) {
                    await wait(1)
                    opJsons.push({
                        text: res.text, x: res.x, y: res.y, sort: i
                    })
                    // res.click()
                    // keywordsOk.push(res.text)
                }
            }

            await info(`LAST ==>${last.name_one} === ${last.name_two}`)
            //画面拆为二分别识别
            await info('开始识别右边画面')
            await info(`mto ${x1}==${y + height}`)
            // await mTo(x1, y + height)
            await wait(1)
            ocrObject = await recognitionObjectOcr(x1, y, width, height);
            // await mTo(width, 0)
            // ocrObject.threshold = 1.0;
            resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
            closeCaptureGameRegion(captureRegion)
            await wait(1)
            for (let res of resList) {
                await logInfoOcr(res, source)

                last.y = res.y
                if (keywords.find(function (value) {
                    return res.text.includes(value.trim())
                }) && (opJsons.length === 0 || opJsons.find(function (value) {
                    return !value.text.includes(res.text)
                }))) {
                    await wait(1)
                    opJsons.push({
                        text: res.text, x: res.x, y: res.y, sort: i
                    })
                    // res.click()
                    // keywordsOk.push(res.text)
                }
            }
            await info(`选中 ${opJsons.map(value => value.text).join(",")}`)
            //实际点击
            // for (let op of opJsons) {
            //     wait(100)
            //     downClick(op.x, op.y)
            // }
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
                    await downClick(op.x, op.y)
                    keywordsOk.push(op.text)
                }

            }

            if (keywords.length === opJsons.length) {
                await info(`已选中 ${opJsons.map(value => value.text).join(",")}`)
                break
            }
            await wait(1)
            await mTo(genshinJson.width / 2, Math.ceil(genshinJson.height * 3 / 4))
            await wait(2)
            // await dragBase(0, -Math.ceil( genshinJson.height *40 / 1080 ), Math.ceil( genshinJson.height *10  / 1080 ), config.log_off)
            await scrollPage(Math.ceil(genshinJson.height / 3))
            await wait(1)

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
            await info(`已选中 ${keywordsOk.join(",")}`)
        }
        await wait(1)
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

async function openSiftAll(log_off) {
    // 调用重置筛选函数，恢复筛选条件到初始状态
    await info(`筛选中`)
    let reOk = await resetSift();
    let op = false
    if (reOk) {
        await wait(1)
        await openSiftHolyRelicsSuitUI_Start(config.suit)
        await wait(1)
        // await siftState(log_off)
        // await wait(1)
        let width = Math.ceil(450 * genshinJson.width / 1080);
        let captureRegion = openCaptureGameRegion();
        const ocrObject = recognitionObjectOcr(0, 0, width, genshinJson.height);
        // await mTo(width, 0)
        // ocrObject.threshold = 1.0;
        let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
        closeCaptureGameRegion(captureRegion)
        for (let res of resList) {
            // await wait(1)
            await logInfoOcrBase(res, 'SiftAll', log_off)
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
        await wait(1)
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
    let up_name = '排序'
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = Math.ceil(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.ceil(genshinJson.height);
    // 使用OCR识别指定区域的图像
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (isExist(ocr)) {
        await logInfoOcr(ocr, 'openSort')
        ocr.click()
    }
    return ocr
}

/**
 * 切换升序排列的函数
 * 该函数通过OCR识别和点击操作来切换或确认升序排列状态
 * <前置条件:处于圣遗物背包排序界面最底部|测试通过:v>
 */
async function openUpSort() {
    // 定义未选中状态下的升序按钮名称
    let up_name = '未选中升序1'
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = Math.ceil(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.ceil(genshinJson.height);
    // 使用OCR识别指定区域的图像
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    await wait(1000)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (isExist(ocr)) {
        // 更新按钮名称为选中状态
        up_name = '升序'
        // 点击升序按钮
        ocr.click()
        // 记录切换成功的日志信息
        await info(`切换为${up_name}`)
    } else {
        // 如果按钮不存在，说明已处于升序状态，记录相应日志
        await info(`已处于升序`)
    }

}

/**
 * 切换等级排列的函数
 * 该函数通过OCR识别和点击操作来切换或确认升序排列状态
 * <前置条件:处于圣遗物背包排序界面最底部|测试通过:v>
 * @returns {Promise<void>}
 */
async function openLvSort() {
    // 定义未选中状态下的升序按钮名称
    let up_name = '等级顺序排序'
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = Math.ceil(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.ceil(genshinJson.height);
    // 使用OCR识别指定区域的图像
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    await wait(1000)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (isExist(ocr)) {
        // 更新按钮名称为选中状态
        up_name = '等级顺序排序'
        // 点击升序按钮
        ocr.click()
        // 记录切换成功的日志信息
        await info(`切换为${up_name}`)
    } else {
        // 如果按钮不存在，说明已处于升序状态，记录相应日志
        await info(`已处于等级顺序排序`)
    }
}

/**
 * 异步函数unchecked，用于执行一系列OCR点击操作
 * @param {boolean} log_off - 是否记录日志的标志
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 * <前置条件:处于圣遗物背包排序界面(需要和拖动配合)|测试通过:v>
 */
async function unchecked(log_off) {
    let source = 'unchecked'
    // 执行第一次OCR点击，点击"取消选择1"按钮，并等待1秒
    await ocrClick(`${path_base_sort}1.jpg`, "取消选择1", source, log_off)
    await wait(1)
    // 执行第二次OCR点击，点击"取消选择2"按钮，并等待1秒
    await ocrClick(`${path_base_sort}2.jpg`, "取消选择2", source, log_off)
    await wait(1)
    // 执行第三次OCR点击，点击"取消选择3"按钮，并等待1秒
    await ocrClick(`${path_base_sort}3.jpg`, "取消选择3", source, log_off)
    await wait(1)
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

    let x = Math.ceil(genshinJson.width * 200 / 1920)
    let y = Math.ceil(genshinJson.height * 300 / 1080)
    let h = Math.ceil(genshinJson.height * 10 / 1080)
    let width = Math.ceil(genshinJson.width * 450 / 1920);
    //拖动到看不见辅助排序规则(影响OCR)
    await mTo(x, y)
    // await wait(1)
    // await dragBase(0, Math.ceil(25 * genshinJson.height / 1080 ), h, log_off)
    await scrollPage(Math.ceil(genshinJson.height * 1 / 5 + genshinJson.height * 1 / 6), true, 6)
    await info('[重置操作]拖动到看不见辅助排序规则(影响OCR)')
    await wait(100)
    let oce_name = '属性排序规则'
    for (let index = 1; index <= 5; index++) {
        await unchecked(log_off)
        await mTo(x, y)
        // await wait(1)
        // await dragBase(0, Math.ceil( genshinJson.height *40 / 1080 ), h, log_off)
        await scrollPage(Math.ceil(genshinJson.height * 2 / 3), true, 6)
        // await wait(1)

        let ocr = await ocrBase(`${path_base_main}${oce_name}.jpg`, 0, 0, width, genshinJson.height)
        // await wait(1)
        if (isExist(ocr)) {
            await unchecked(log_off)
            await info(`已到顶`)
            break
        } else if (index == 5) {
            throwError(`未找到${oce_name}`)
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
        await info('无属性排序规则')
        return
    }
    let split = keyword.trim().split('|');
    if (split.length === 0) {
        await info('无属性排序规则')
        return
    }
    let specialKey = ''
    let attributeKeys = new Array();
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
    // info(attributeKeys.toString())
    let attributeKeysOk = new Array();
    let x = Math.ceil(genshinJson.height * 200 / 1920)
    let y = Math.ceil(300 * genshinJson.height / 1080)
    let h = Math.ceil(genshinJson.height * 10 / 1080)
    await mTo(x, y)
    await wait(1)
    // await dragBase(0, Math.ceil(26 * genshinJson.height / 1080 ), h, log_off)
    await scrollPage(Math.ceil(genshinJson.height * 1 / 5 + genshinJson.height * 1 / 6), true, 6)
    await info('拖动到看不见辅助排序规则(影响OCR)')
    // await wait(100)
    let oce_name = '属性排序规则'

    let sort = new Array()
    let ocr_y = Math.ceil(60 * genshinJson.height / 1080)
    for (let index = 1; index <= 10; index++) {
        // todo:属性排序
        let width = Math.ceil(450 * genshinJson.width / 1920);
        let captureRegion = openCaptureGameRegion();

        let ocrObject = recognitionObjectOcr(0, ocr_y, width, genshinJson.height - ocr_y);
        // await mTo(width, 0)
        // ocrObject.threshold = 1.0;
        let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
        closeCaptureGameRegion(captureRegion)

        for (let res of resList) {
            await logInfoOcr(res, source)
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
                await wait(1)
                await downClick(one.x, one.y)
                attributeKeysOk.push(one.text)
                await wait(10)
                await info(`选中 {index: ${one.index}, text: ${one.text}, x: ${one.x}, y: ${one.y}}`)
            }
        }

        await mTo(x, y)
        // await wait(1)
        // await dragBase(0, Math.ceil( genshinJson.height *40 / 1080 ), h, log_off)
        await scrollPage(Math.ceil(genshinJson.height * 2 / 3), true, 6)
        await wait(1)

        let ocr = ocrBase(`${path_base_main}${oce_name}.jpg`, 0, 0, width, genshinJson.height)
        // await wait(1)
        if (isExist(ocr)) {

            let captureRegion = openCaptureGameRegion();
            let ocrObject = recognitionObjectOcr(0, ocr_y, width, genshinJson.height - ocr_y);
            // await mTo(width, 0)
            // ocrObject.threshold = 1.0;
            let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
            closeCaptureGameRegion(captureRegion)


            for (let res of resList) {
                await logInfoOcr(res, source)
                if (attributeKeys.indexOf(res.text) >= 0 && attributeKeysOk.indexOf(res.text) < 0) {
                    await wait(1)
                    // res.click()
                    // attributeKeysOk.push(res.text)
                    sort.push({index: attributeKeys.indexOf(res.text), text: res.text, x: res.x, y: res.y})
                    await wait(10)
                }
            }

            sort.sort((a, b) => (a.index - b.index))
            for (let one of sort) {
                await info(`[已到顶]{index: ${one.index}, text: ${one.text}, x: ${one.x}, y: ${one.y}}`)
                if (attributeKeysOk.indexOf(one.text) < 0) {
                    await info(`选中 ${one.toString()}`)
                    await wait(1)
                    await downClick(one.x, one.y)
                    attributeKeysOk.push(one.text)
                    await wait(10)
                }
            }

            if (specialKey !== '') {
                //特殊排序处理
                // await wait(1)
                await clickProgressBarDownBySort()
                await wait(1)
                await mTo(x, y)
                await scrollPage(Math.ceil(genshinJson.height * 1 / 5 + genshinJson.height * 1 / 6), true, 6)

                let captureRegion = openCaptureGameRegion();
                let ocrObject = recognitionObjectOcr(0, 0, width, genshinJson.height);
                // await mTo(width, 0)
                // ocrObject.threshold = 1.0;
                let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
                closeCaptureGameRegion(captureRegion)

                for (let res of resList) {
                    await logInfoOcr(res, source)
                    if (res.text.includes(specialKey) && attributeKeysOk.indexOf(res.text) < 0) {
                        // await wait(1)
                        res.click()
                        attributeKeysOk.push(res.text)
                        await wait(10)
                        break
                    }
                }
            }

            await info(`已到顶`)
            break
        } else if (index == 10) {
            throwError(`未找到${oce_name}`)
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
    await wait(300)
    // 首先调用openSort函数，传入log_off参数
    let open = await openSort(log_off)
    let exist = false
    exist = isExist(open);
    if (exist) {
        await wait(300)
        await clickProgressBarDownBySort()
        //升序
        await openUpSort()
        //等级
        await openLvSort()
        await wait(1)
        // todo: 可扩展
        await info(`排序中`)
        if (config.sortArray.length > 0) {
            let width = Math.ceil(genshinJson.width * 450 / 1920);
            let captureRegion = openCaptureGameRegion();
            let y = Math.ceil(genshinJson.height / 2);
            const ocrObject = recognitionObjectOcr(0, y, width, y);
            // await mTo(width, 0)
            // ocrObject.threshold = 1.0;
            let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
            closeCaptureGameRegion(captureRegion)
            for (let res of resList) {
                // await wait(1)
                await logInfoOcrBase(res, 'SortAll', log_off)
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
            await wait(1)
        }
        await info(`排序中`)
        //todo:属性排序
        await resetAttributeSort(log_off)
        await wait(1)
        await clickProgressBarDownBySort()
        await attributeSort(config.sortAttribute, log_off)
        await wait(1)
        //确认
        await confirm()
        await wait(300)
        await info(`筛选完成`)
    } else {
        var msg = `未找到排序按钮`;
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

    await wait(300)
    // 首先执行 openSiftAll 函数，传入 log_off 参数
    let siftOk = await openSiftAll(log_off);
    if (!siftOk) {
        throw new Error(`筛选失败`)
        re = false;
    }
    // 然后执行 openSortAll 函数，同样传入 log_off 参数
    await wait(1)
    // 使用 await 确保两个函数按顺序执行
    let sortOk = await openSortAll(log_off);
    if (!sortOk) {
        throw new Error(`排序失败`)
        re = false;
    }
    await wait(300)
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
    await wait(1000)  // 等待1000毫秒（1秒）
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
    // let width = Math.ceil(genshinJson.width / 2 );
    // // 获取屏幕总高度
    // let height = Math.ceil(genshinJson.height );
    // // 设置起始点的x坐标为屏幕宽度的一半
    // var x1 = Math.ceil(genshinJson.width / 2 );
    // // 设置起始点的y坐标为0（顶部）
    // var y1 = 0;
    // // 构建进度条顶部箭头图片的完整路径
    // var path = `${path_base_main}${up_name}.jpg`;
    // await wait(10)
    // // 使用OCR识别图片在屏幕上的位置和大小
    // let ocr = await ocrBase(path, x1, y1, width, height)
    // // 记录OCR识别结果
    // await logInfoOcr(ocr)
    // // 计算点击位置的x坐标（OCR识别区域的中心点）
    // let x = ocr.x + Math.ceil(ocr.width / 2 );
    // // 计算点击位置的y坐标（OCR识别区域的底部）
    // let y = ocr.y + Math.ceil(ocr.height );
    // // 输出点击坐标信息
    // await info(`x:${x},y:${y}`)


    /*    await wait(10)
        let x = Math.ceil(genshinJson.width * 1289 / 1920)
        let y = Math.ceil(genshinJson.height * 177 / 1080)
        // 移动鼠标到计算的位置
        await clickProgressBar(x, y)*/

    // await openSiftAll()
    await wait(300)
    // await confirm('强制拉到顶')


    let ocrSiftJson = {
        "text": "筛选",
        "x": 0,
        "y": 0,
        "width": genshinJson.width / 3.0,
        "height": genshinJson.height
    }
    // 查找筛选按钮元素
    let sift = ocrBase(`${path_base_main}${ocrSiftJson.text}.jpg`, ocrSiftJson.x, ocrSiftJson.y, ocrSiftJson.width, ocrSiftJson.height)
    // let ocr = await ocrBase(`${path_base_main}确认.jpg`, 0, 0, Math.ceil(genshinJson.width / 2), Math.ceil(genshinJson.height / 2))
    // logInfoOcr(ocr)
    if (isExist(sift)) {
        sift.click()
        await wait(300)
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
    // let width = Math.ceil(genshinJson.width / 2);
    // // 获取屏幕总高度
    // let height = Math.ceil(genshinJson.height);
    // // 设置起始点的x坐标为屏幕宽度的一半
    // let x1 = 0;
    // // 设置起始点的y坐标为0（顶部）
    // let y1 = 0;
    // // 构建进度条顶部箭头图片的完整路径
    // let path = `${path_base_main}${up_name}.jpg`;
    // // 使用OCR识别图片在屏幕上的位置和大小
    // let ocr = await ocrBase(path, x1, y1, width, height)
    // // 记录OCR识别结果
    // await logInfoOcr(ocr)
    // await mTo(ocr.x, ocr.y)
    //
    // // 计算点击位置的x坐标（OCR识别区域的中心点）
    // let x = ocr.x + Math.ceil(ocr.width / 2);
    // // 计算点击位置的y坐标（OCR识别区域的底部）
    // let y = ocr.y - Math.ceil(ocr.height);
    // // 输出点击坐标信息
    // await info(`x:${x},y:${y}`)
    // await mTo(x, y)
    let x = Math.ceil(genshinJson.width * 607 / 1920)
    let y = Math.ceil(genshinJson.height * 938 / 1080)
    // 移动鼠标到计算的位置
    await clickProgressBar(x, y)
}


/**
 * 点击第一个圣遗物的函数
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function downClickFirstHolyRelics() {
    let x = Math.ceil(genshinJson.width * 200 / 1920)
    let y = Math.ceil(genshinJson.height * 250 / 1080)
    // await mTo(200,300)
    await downClick(x, y)
    await wait(500)
    await confirm('点击第一个圣遗物', 'downClickFirstHolyRelics')
    await wait(500)
    //避免多次点击
    await mTo(x, y)
    await info('点击第一个圣遗物')
    await openAggrandizement()
    await wait(300)
    // let material = config.material
    // await openSelectTheClipCondition(material)
}


// 判断是否在主界面的函数
const isInMainUI = () => {
    let name = '主界面'
    // 定义识别对象
    let paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync(`${path_base_main}${name}.png`),
        0,
        0,
        genshin.width / 3.0,
        genshin.width / 5.0
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
    // 注释掉的代码：使用模板匹配方法查找强化按钮
    // const aggrandizementRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}强化.jpg"), 0, 0, genshinJson.width / 3.0, genshinJson.height);
    // // 捕获游戏区域并查找强化按钮
    // let aggrandizement = captureGameRegion().find(aggrandizementRo);
    // 定义OCR识别的JSON对象，包含文本和位置信息
    let ocrJson = {
        "text": "强化",    // 要识别的文本内容
        "x": 0,           // 识别区域的左上角x坐标
        "y": 0,           // 识别区域的左上角y坐标
        "width": genshinJson.width,    // 识别区域的宽度
        "height": genshinJson.height   // 识别区域的高度
    }
    // 使用OCR方法查找强化按钮
    let aggrandizement = ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
    await logInfoOcr(aggrandizement, 'openAggrandizement')
    // 检查强化按钮是否存在
    if (isExist(aggrandizement)) {
        await wait(10);
        // 输出日志信息，表示正在打开强化界面
        await info('打开强化');
        // 点击强化按钮
        aggrandizement.click();
        // 等待500毫秒以确保界面完全打开
    }
}


// const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}确认.jpg"), 0, 0, genshinJson.width, genshinJson.height);
/**
 * 确认
 * @returns {Promise<void>}
 */
async function confirm(log_msg = '点击确认', source = 'confirm') {
    return await ocrClick(`${path_base_main}确认.jpg`, log_msg, source, config.log_off)
}

/**
 * 清空选中的狗粮
 * @returns {Promise<void>}
 */
async function clear(source = 'clear') {
    // 通过OCR识别并点击"详情"按钮
    await ocrClick(`${path_base_main}详情.jpg`, "点击详情", source, config.log_off)
    await wait(1)
    // 通过OCR识别并点击"强化"按钮
    await ocrClick(`${path_base_main}强化.jpg`, "点击强化", source, config.log_off)
}

/**
 * 操作方式处理函数
 * @param operate - 操作类型参数

 * @param log_off - 日志开关参数
 * @returns {Promise<string>} - 返回处理后的操作类型
 */
async function operateDispose(operate, enableInsertionMethod, source = 'operateDispose', log_off) {
    let ocr_name = '阶段放入'  // 默认使用"阶段放入"进行OCR识别
    //自动识别界面元素
    let ocr1 = await ocr(`${path_base_main}${ocr_name}.jpg`)
    // 如果默认元素不存在，则切换为"快捷放入"
    info(`isExist start`)
    let exist = isExist(ocr1);
    info(`isExist end`)
    if (!exist) {
        ocr_name = '快捷放入'
    }
    info(`operateDispose`)
    // 如果操作方式为"默认"或未指定，则进行自动识别
    if (operate === '默认' || (!operate)) {
        // 更新操作方式为识别到的名称
        operate = ocr_name
        info(`更新操作方式为识别到的名称:${operate}`)
    } else if (config.enableInsertionMethod || enableInsertionMethod) {
        info(`如果操作方式为"阶段放入"或"快捷放入"，则进行OCR识别`)        // 如果操作方式为"阶段放入"或"快捷放入"，则进行OCR识别
        // 如果默认元素不存在，则切换为"快捷放入"
        if (exist) {
            return ocr_name
        }
        //和自动识别互斥  自启动 阶段放入||快捷放入
        await info(`${operate} 未打开`)

        let name = '设置按键'
        await ocrClick(`${path_base_main}${name}.jpg`, `点击${name}`, source, log_off)
        let name4 = `点击关闭`
        if (operate !== '快捷放入') {
            name4 = `点击开启`
        }
        await ocrClick(`${path_base_main}${name4}.jpg`, `${name4}`, source, log_off)
        let name5 = `关闭设置`
        await ocrClick(`${path_base_main}${name5}.jpg`, `${name5}`, source, log_off)
        mTo(0, 0)
    }
    info(`[放入方式]==>${operate}<==[end]`)
    ocr1.click()
    info(`[放入方式]-[click]`)
    return operate
}


/**
 * OCR识别圣遗物强化次数的异步函数
 * 该函数通过截图和OCR技术识别游戏中圣遗物的强化次数
 * @returns {Promise<{sumLevel: number, level: number}>} 返回识别到的强化次数，如果未识别到则返回0
 */
async function ocrHolyRelicsUpFrequency(source = 'HolyRelicsUpFrequency', log_off) {

    // // 定义OCR识别的初始坐标和区域大小
    // let ocr_x = Math.ceil(genshinJson.width / 2); // OCR识别区域的x坐标，设置为屏幕宽度的一半
    // let ocr_y = 0; // OCR识别区域的y坐标，设置为0（屏幕顶部）
    // let width = Math.ceil(genshinJson.width / 2); // OCR识别区域的宽度，设置为屏幕宽度的一半
    // let height = Math.ceil(genshinJson.height); // OCR识别区域的高度，设置为整个屏幕高度
    //
    // // 定义并执行第一次OCR识别，用于识别经验值图标
    // let up_name = 'exp' // 识别对象名称为经验值图标
    // let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, ocr_x, ocr_y, width, height) // 执行OCR识别
    // if (!log_off) {
    //     await logInfoOcr(ocr, source + '-' + up_name) // 记录OCR识别结果
    // }
    //
    // // 定义并执行第二次OCR识别，用于识别返回键
    // let up_name1 = '返回键' // 识别对象名称为返回键
    // let ocr1 = await ocrBase(`${path_base_main}${up_name1}.jpg`, ocr_x, ocr_y, width, height) // 执行OCR识别
    //
    // if (!log_off) {
    //     await logInfoOcr(ocr1, source + '-' + up_name1) // 记录OCR识别结果
    // }
    // //todo :bug
    // // 计算OCR识别的目标区域
    // let x = Math.min(ocr1.x, ocr.x) // 目标区域的左上角x坐标
    // let y = Math.min(ocr1.y, ocr.y) // 目标区域的左上角y坐标
    // let w = Math.ceil(Math.abs(ocr1.x - ocr.x) / 2) // 目标区域的宽度
    // let h = Math.abs(ocr1.y - ocr.y) // 目标区域的高度

    let x = Math.ceil(genshinJson.width * 1173 / 1920)// 目标区域的左上角x坐标
    let y = Math.ceil(genshinJson.height * 34 / 1080)// 目标区域的左上角y坐标
    let w = Math.ceil(genshinJson.width * 329 / 1920)// 目标区域的宽度
    let h = Math.ceil(genshinJson.height * 145 / 1080)// 目标区域的高度
    await wait(10)
    await infoLog(`{x:${x},y:${y},w:${w},h:${h}}`, source) // 记录OCR识别结果
    // 截取游戏画面并进行OCR识别
    let captureRegion = openCaptureGameRegion(); // 截取游戏画面
    const ocrObject = await recognitionObjectOcr(x, y, w, h); // 创建OCR识别对象
    let res = findByCaptureGameRegion(captureRegion, ocrObject); // 执行OCR识别
    await wait(10)
    if (!log_off) {
        await logInfoOcr(res, source) // 记录OCR识别结果
    }

    let levelJson = {
        "sumLevel": 0,//预估可提升至等级
        "level": 0//实际等级
    }

    if (res.text.includes('+')) {
        //保留数字和+
        let va = res.text.replace(/[^+\d]/g, "")
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

        await infoLog(res.text, source) // 记录OCR识别结果
        await infoLog(str, source) // 记录OCR识别结果
        let result = new Function(`return ${str}`)() + "";
        await infoLog(result, source) // 记录OCR识别结果
        let sumLevel = parseInt(result)//计算等级
        await info(`圣遗物预估可提升至等级: ${sumLevel}`); // 20

        await info(`圣遗物实际等级: ${level}`)
        levelJson.sumLevel = sumLevel
        levelJson.level = level
    }
    closeCaptureGameRegion(captureRegion)
    return levelJson
}

/**
 * 单次点击强化功能
 * @param operate - 操作参数

 * @param log_off - 日志开关
 * @returns {Promise<{sumLevel: number, level: number, ok: boolean,start: boolean,okMsg: string, errorMsg: string}>} - 返回一个Promise对象，表示异步操作的完成
 */
async function oneUp(operate, source = 'oneUp', log_off) {
    let upJson = {
        "sumLevel": 0,//预估可提升至等级
        "level": 0,//实际等级
        "ok": false, // 是否强化成功的标志
        "errorMsg": '', // 强化失败的错误信息
        "okMsg": '', // 强化失败的错误信息
        "start": true // 强化过
    }

    await wait(300)
    //点击operate按钮
    await ocrClick(`${path_base_main}${operate}.jpg`, `点击${operate}`, source, log_off)  // 调用OCR识别并点击指定按钮
    await wait(500)  // 等待500毫秒，确保界面响应

    let ocrHolyRelics = await ocrHolyRelicsUpFrequency();
    await wait(10)
    upJson.level = ocrHolyRelics.level
    upJson.sumLevel = ocrHolyRelics.sumLevel
    // 输出当前圣遗物等级的日志信息
    await info(`当前圣遗物等级: ${ocrHolyRelics.level}`)
    // 检查圣遗物是否已达到满级（20级）
    if (ocrHolyRelics.level === 20 || ocrHolyRelics.level >= config.upMax) {
        upJson.start = false
        // 记录圣遗物已满级的日志信息
        let op = ocrHolyRelics === 20 ? '已满级' : `已达到设置上限${config.upMax}`
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
        //     await ocrClick(`${path_base_main}${up_name}.jpg`, logMsg, source, log_off)
        // } else {
        // }
        return upJson

    }

    await confirm(`[oneUp]点击确认`)  // 确认操作
    await mTo(0, 0)
    await wait(30)
    // 定义错误信息为"摩拉不足"
    let err = '摩拉不足'
    // 检查强化是否成功
    let upOk = await ocrClick(`${path_base_main}${err}.jpg`, `确认强化是否成功`, log_off)
    // 如果识别到错误信息
    if (isExist(upOk)) {
        error(`${err}!`);  // 输出错误信息
        upJson.errorMsg = err;  // 设置强化失败的错误信息
        throwError(err)
        return upJson
    } else {
        upJson.ok = true;  // 设置强化成功的标志
    }
    await wait(300)

    let levelJson = await ocrHolyRelicsUpFrequency();
    if ((!upJson.start) && ocrHolyRelics.level === levelJson.level) {
        //真实强化过
        upJson.errorMsg = '强化失败:狗粮不足'
        upJson.ok = false;
        throwError(upJson.errorMsg)
        return upJson
    }
    upJson.sumLevel = levelJson.sumLevel
    upJson.level = levelJson.level
    // upJson.upOk = upJson.level !== 0 && upJson.level === upJson.sumLevel
    return upJson
}


/**
 * 单次强化函数
 *
 * 该函数用于执行一次强化操作，通过调用operateDispose处理操作参数，然后调用oneUp执行实际强化
 * @param operate - 操作参数对象，包含强化所需的相关配置信息
 * @param log_off - 是否记录日志的布尔值，用于控制是否输出操作日志
 * @returns {Promise<{sumLevel: number, level: number, await errorMsg: string}>} - 返回一个Promise，表示异步操作的完成，无返回值
 */
async function oneClickUp(operate, source = 'oneClickUp', log_off = config.log_off, isFirst = true) {
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
        }

    }
    warn(`执行`)
    if (operate === '阶段放入') {
        count = upMax / 4;
    }

    for (let i = 0; i < count; i++) {
        operate = await operateDispose(operate, false, log_off)
        await wait(50)  // 等待500毫秒，确保界面响应
        // 调用oneUp函数执行实际的强化操作，传入处理后的operate参数和日志控制参数
        warn(`start==>单个圣遗物第${i + 1}次强化`)
        let up = await oneUp(operate, source, log_off)
        warn(`end==>单个圣遗物第${i + 1}次强化`)
        reJson.start = up.start
        reJson.ok = up.ok
        reJson.errorMsg = up.errorMsg
        reJson.okMsg = up.okMsg
        warn(`单个圣遗物第${i + 1}次强化`)
        if (up.start && !up.ok) {
            //实际强化过
            // 如果强化失败，记录错误信息
            throw new Error(`${up.errorMsg}`);
            throwError(up.errorMsg)
        } else if (!up.start) {
            //已达到要求的圣遗物
            warn(`该圣遗物已符合要求${reJson.okMsg}==>{level:${up.level},sumLevel:${up.sumLevel}}`)
            break
        } else {
            await info(`强化成功`)
            reJson.ok = true
            reJson.okMsg = '强化成功'
            if (up.sumLevel % 4 != 0) {
                let msg2 = `圣遗物预估可提升至等级: ${up.sumLevel}，未达到下一阶段等级，退出强化`;
                await info(msg2)
                reJson.errorMsg = msg2
                reJson.okMsg = msg2
                // throwError(msg2)
                break
            } else {
                // todo: 预留单次强化成功后操作 后续可考虑 阶段有效词条智能停止强化
            }
        }
    }
    warn(`执行完成`)
    return reJson
}

// let line =Math.ceil(genshinJson.height  * 175 / 1080)
//
// mTo(Math.ceil(genshinJson.width / 2), Math.ceil(genshinJson.height * 2 / 3))
// //一格圣遗物 一页为4格
// await scrollPage(Math.ceil(genshinJson.height  * 175 / 1080), false, 6)
// // mTo(Math.ceil(genshinJson.width / 2), Math.ceil(genshinJson.height * 2 / 3))
// await wait(1000)
// await scrollPage(Math.ceil(genshinJson.height  * 175 / 1080), false, 6)
// mTo(Math.ceil(genshinJson.width / 2), Math.ceil(genshinJson.height * 2 / 3))
// await wait(1000)
// await scrollPage(Math.ceil(genshinJson.height  * 175 / 1080), false, 6)
// // mTo(Math.ceil(genshinJson.width / 2), Math.ceil(genshinJson.height * 2 / 3))
// await wait(1000)
// await scrollPage(Math.ceil(genshinJson.height  * 175 / 1080), false, 6)
async function bathClickUpLv1(operate, source = 'bathClickUpLv1', log_off = config.log_off) {
    let ms = 10
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

    let base_x = Math.ceil(genshinJson.width * 200 / 1920)
    let base_y = Math.ceil(genshinJson.height * 250 / 1080)
    let base_width = Math.ceil(genshinJson.width * 145 / 1920)
    let base_height = Math.ceil(genshinJson.height * 189 / 1080)
    let line = 8
    let page = line * 4

    while (upMaxCount > actualCount) {
        if (upMaxCount === actualCount) {
            info(`{强化次数已达到:${upMaxCount}}`)
            break
        }

        let base_count_x = Math.ceil(i % line)
        let base_count_y = (i % page) < line ? 0 : Math.floor((i % page) / line);
        let x = base_x + base_count_x * base_width;
        let y = base_y + base_count_y * base_height;
        warn(`i:${i},base_count_x:${base_count_x},base_count_y:${base_count_y}`)
        lastJson.t_y = y
        lastJson.t_x = x
        info(`圣遗物${config.sortMain}强化操作`)
        if (config.sortMain === '降序') {
            if (config.upMax >= 20) {
                // warn(`降序排序功能暂未实现自动强化`)
                throwError(`降序排序功能暂未实现+20的自动强化`)
            }

            if (i <= 1) {
                //强制拉到顶
                await clickProgressBarTopByHolyRelics()
                await wait(ms);
            } else {

            }
            //每行8个
            // throwError(`降序排序功能暂未实现自动强化`)

            if (i % 8 === 0) {
                await wait(300)
            }
            let bool = i >= (page) && i % (page) === 0;
            if (bool) {
                await info(`滑动一页`)
                for (let j = 0; j < page / line; j++) {
                    await wait(1)
                    let line = Math.ceil(genshinJson.height * 175 / 1080)
                    mTo(Math.ceil(genshinJson.width / 2), Math.ceil(genshinJson.height * 2 / 3))
                    await scrollPage(line, false, 6)
                }
                await wait(1)
            }
            warn(`x:${x},y:${y}`)
            await mTo(x, y)
            await downClick(x, y)
            // await wait(10)
            await confirm('降序强化点击确认')
            await wait(ms)
            //打开强化界面
            await openAggrandizement()
        } else {
            //强制拉到顶
            await clickProgressBarTopByHolyRelics()
            await wait(ms);
            // 调用点击第一个圣物遗物的函数，并等待其完成
            await downClickFirstHolyRelics()
            await wait(ms);
        }
        await wait(ms)
        await openAggrandizement()
        await wait(ms)  // 等待500毫秒，确保界面响应
        let re = await oneClickUp(operate, source, log_off, i === 0);
        warn(`第${i}次强化结果:{sumLevel: ${re.sumLevel},level: ${re.level},errorMsg: ${re.errorMsg},ok: ${re.ok},okMsg: ${re.okMsg},start: ${re.start}}`)
        if (re.ok) {
            lastJson.t_level = re.level
        }
        if (re.ok || !re.start) {
            actualCount++
            // 如果强化成功，则继续下一个圣遗物
            await info(!re.start ? `符合要求` : `强化成功`)
            await wait(ms)
            let up_name = '返回键'
            await ocrClick(`${path_base_main}${up_name}.jpg`, `圣遗物已经强化到+${config.upMax}退出强化页面 到圣遗物背包界面`, source, log_off)
            //返回圣遗物背包
        } else {
            // 如果强化失败，则退出循环
            await info(`强化失败:${re.errorMsg}`)
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
        i++
        warn(`当前强化次数:${actualCount} 总强化次数:${upMaxCount}`)
    }
    warn(`圣遗物强化+${config.upMax} 数量：${actualCount}`)
    info(`圣遗物强化+${config.upMax} 数量：${actualCount}`)

}

/**
 * 批量强化函数
 * @param operate - 操作参数对象
 * @param log_off - 是否注销标志
 * @returns {Promise<void>} - 返回一个空Promise，表示异步操作完成
 */
async function bathClickUp(operate, source = 'bathClickUp', log_off = config.log_off) {
    let ms = 10
    // let index = 0
    let upMaxCount = 0
    if (config.upMaxCount) {
        upMaxCount = Math.ceil(config.upMaxCount)
    }
    if (upMaxCount === null || upMaxCount <= 0) {
        throwError(`圣遗物强化个数 必须大于0`)
        return
    }
    info("强化开始")
    // while (true) {

    for (let i = 1; i <= upMaxCount; i++) {

        if (config.sortMain === '降序' && upMaxCount < 20) {
            if (i === 1) {
                //强制拉到顶
                await clickProgressBarTopByHolyRelics()
                await wait(ms);
            }
            info("==1")
            //每行8个
            // throwError(`降序排序功能暂未实现自动强化`)
            let line = 8
            let base_x = Math.ceil(genshinJson.height * 200 / 1920)
            let base_y = Math.ceil(genshinJson.height * 250 / 1080)
            let base_width = Math.ceil(genshinJson.width * 145 / 1920)
            let base_height = Math.ceil(genshinJson.height * 189 / 1080)
            let base_count_x = Math.ceil(i % line)
            info("==2")
            let x = base_x + base_count_x * base_width;
            let y = base_y;
            if (i % 8 === 1) {
                await wait(300)
            }
            let bool = i >= (line) && i % (line) === 0;
            if (bool) {
                await info(`滑动一行`)
                await wait(1)
                // await dragBase(0, -9, base_height / 9, config.log_off)
                await scrollPage(200, true, 6)
                await wait(1)
            }
            // info(`x:${x},y:${y}`)
            await mTo(x, y)
            // await wait(1000)
            await downClick(x, y)
            await openAggrandizement()
        } else {
            //强制拉到顶
            await clickProgressBarTopByHolyRelics()
            await wait(ms);
            // 调用点击第一个圣物遗物的函数，并等待其完成
            await downClickFirstHolyRelics()
            await wait(ms);
        }
        //打开强化界面
        await openAggrandizement()
        await wait(ms)  // 等待500毫秒，确保界面响应
        let re = await oneClickUp(operate, log_off, i === 1);
        if (!re.errorMsg) {
            // 如果强化成功，则继续下一个圣遗物
            await info(`强化成功`)
            await wait(ms)
            let up_name = '返回键'
            await ocrClick(`${path_base_main}${up_name}.jpg`, `圣遗物已经强化到+${config.upMax}退出强化页面 到圣遗物背包界面`, source, log_off)
            //返回圣遗物背包
        } else {
            // 如果强化失败，则退出循环
            await info(`强化失败`)
            break
        }
        info(`圣遗物强化+${config.upMax} 数量：${i}`)

        if (upMaxCount !== null && i === upMaxCount) {
            info(`${upMaxCount}个圣遗物已经强化到+${config.upMax}终止运行`)
            await toMainUi()
            await wait(ms)
            break
        }
    }
    // }
    await wait(ms)
    await toMainUi()
}


async function toMainUi() {
    let ms = 300
    let index = 1
    await wait(ms);
    while (!isInMainUI()) {
        await wait(ms);
        await genshin.returnMainUi(); // 如果未启用，则返回游戏主界面
        await wait(ms);
        if (index > 3) {
            throwError(`多次尝试返回主界面失败`);
        }
        index += 1
    }

}


(async function () {
    await main()
})();

//=========弃用以下=========

/**
 * 放入狗粮后
 * 判断狗粮是否充足 弃用
 */
async function judgeDogFoodFilling() {
    let err = null
    // 定义需要检查的资源名称为"需要摩拉"
    let up_name = '需要摩拉'
    // 计算OCR识别区域的宽度，为屏幕宽度的一半
    let width = Math.ceil(genshinJson.width);
    // 获取屏幕总高度作为OCR识别区域的高度
    let height = Math.ceil(genshinJson.height);
    // 执行OCR识别，检查指定区域是否存在"需要摩拉"的提示
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    await wait(300)
    await logInfoOcr(ocr, 'judgeDogFoodFilling')
    // 如果OCR识别结果不存在，则输出错误日志提示狗粮不足
    if (!isExist(ocr)) {
        err = '狗粮不足'
        // await error(`${err}`)
        throwError(err)
    }
    return err
}

/**
 * 打开选择素材条件 弃用
 * 该函数用于打开游戏中的素材选择界面，并根据传入的条件自动选择对应的素材
 * @param {string} condition - 需要选择的素材条件文本
 * @returns {Promise<void>} 异步函数，无返回值
 * todo:<前置条件:处于圣遗物强化界面|测试通过:x> 出现问题：执行完成后会自动点击按键 任务结束后也会出现 执行下其他脚本后消失
 */
async function openSelectTheClipCondition(condition = config.material) {
    // 检查是否传入了有效的素材条件
    await info(condition)
    if (condition === null || condition === '默认') {
        await info(`使用默认素材`)
    } else {
        // const selectTheClipConditionButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path_base_main}选择素材条件按键.jpg`), 0, 0, genshinJson.width, genshinJson.height);

        // 捕获游戏界面并查找"选择素材条件"按钮
        // let buttonObject = captureGameRegion().find(selectTheClipConditionButtonRo);
        let buttonObject = await ocrBase(`${path_base_main}选择素材条件按键.jpg`, 0, 0, genshinJson.width, genshinJson.height)
        await wait(300)
        // 检查按钮是否存在
        if (isExist(buttonObject)) {
            await info('打开选择素材条件')
            await wait(500);
            // 点击按钮并等待界面加载
            // await buttonObject.click();
            let x = Math.ceil(genshinJson.width * 1524 / 1920)
            let y = Math.ceil(genshinJson.height * 758 / 1080)
            downClick(x, y)
            await wait(500);

            await info(`素材条件==>x:${buttonObject.x},y:${buttonObject.y}`)

            let needMoLa = await ocrBase(`${path_base_main}需要摩拉.jpg`, 0, 0, genshinJson.width, genshinJson.height)
            await wait(300)
            // 检查是否能定位到"需要摩拉"文本区域
            if (!isExist(needMoLa)) {
                let msg = `无法定位识别！`
                await error(msg)
                throwError(msg)
            } else {
                // 计算OCR识别区域的坐标和尺寸
                // let ocr_x = Math.min(needMoLa.x, buttonObject.x)
                // let ocr_y = Math.min(needMoLa.y, buttonObject.y)
                // let ocr_width = Math.abs(needMoLa.x - buttonObject.x)
                // let ocr_height = Math.abs(needMoLa.y - buttonObject.y)
                await info(`OCR==>x:${ocr_x},y:${ocr_y},width:${ocr_width},height:${ocr_height}`)
                //x:1170,y:758,width:354,height:243
                let ocr_x = Math.ceil(genshinJson.width * 1170 / 1920)
                let ocr_y = Math.ceil(genshinJson.height * 758 / 1080)
                let ocr_width = Math.ceil(genshinJson.width * 354 / 1920)
                let ocr_height = Math.ceil(genshinJson.height * 243 / 1080)
                // 以下代码被注释，可能是用于调试的鼠标移动
                // await mTo(ocr_x, ocr_y)
                // 创建OCR识别对象
                let ocrObject = await recognitionObjectOcr(ocr_x, ocr_y, ocr_width, ocr_height);
                // 捕获游戏界面并执行OCR识别
                let captureRegion = openCaptureGameRegion();
                let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
                closeCaptureGameRegion(captureRegion)
                let index = 0;
                // 遍历OCR识别结果
                for (let res of resList) {
                    await info(`[==]${index}识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`);
                    // 跳过第一个结果（可能是标题），查找匹配条件的选项
                    if (index !== 0 && res.text.includes(condition)) {
                        await info(`点击${res.text}`)
                        await wait(1000);
                        res.click();
                        // await downClick(res.x, res.y);
                        await mTo(genshinJson.width / 2, genshinJson.height / 2)
                        await info('[break]')
                        break;
                    }
                    index++
                }
            }

        }
    }

}


/**
 * 识别圣遗物背包区域
 * @param ocrRegion - OCR识别区域的参数对象，包含x坐标、y坐标、宽度和高度
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 * 弃用
 */
async function bathOcrRegionHolyRelics(ocrRegion) {
    // 捕获游戏区域图像
    let captureRegion = openCaptureGameRegion();
    // 创建OCR识别对象，使用传入的OCR区域参数
    const ocrObject = await recognitionObjectOcr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
    // ocrObject.threshold = 1.0; // 可选：设置OCR识别的阈值，当前已被注释掉
    // 在捕获的区域中查找多个匹配项
    let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
    closeCaptureGameRegion(captureRegion)

    // 遍历所有识别结果
    for (let res of resList) {
        // 记录OCR识别信息的详细日志
        await logInfoOcr(res, 'bathOcrRegionHolyRelics')
    }
}


/**
 * 圣遗物界面 单次点击 到达8次 换行 拖动太慢改为行了 弃用
 * @param upMaxCount
 * @returns {Promise<void>}
 */
async function holyRelicsLineClick(upMaxCount) {
    //设置的最大强化次数
    let index = upMaxCount
    let base_x = Math.ceil(genshinJson.width * 200 / 1920)
    let base_y = Math.ceil(genshinJson.height * 250 / 1080)
    let base_width = Math.ceil(genshinJson.width * 145 / 1920)
    let base_height = Math.ceil(genshinJson.height * 189 / 1080)
    let line = 8
    //强制拉到顶
    await clickProgressBarTopByHolyRelics()
    // let one_page = 4 * line
    for (let i = 1; i <= index; i++) {
        let base_count_x = Math.ceil(i % line)
        // let base_count_y = Math.ceil(i / line )
        let x = base_x + base_count_x * base_width;
        let y = base_y;
        if (i % 8 === 1) {
            await wait(300)
        }
        let bool = i >= (line) && i % (line) === 0;
        // await info(`滑动：${bool},i:${i}`)
        if (bool) {
            // await wait(1000)
            await info(`滑动一行`)
            await wait(1)
            await dragBase(0, -9, base_height / 9, config.log_off)
            await wait(1)
        }
        // info(`x:${x},y:${y}`)
        await mTo(x, y)
        // await wait(1000)
        await downClick(x, y)
        //todo:强化操作
    }
}

/**
 * 筛选圣遗物套装的异步函数
 * @param {boolean} log_off - 是否记录日志的参数
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 */
// async function siftHolyRelicsSuit(keyword, log_off) {
//     if (!keyword) {
//         return
//     }
//     let keywords = keyword.trim().split('|');
//     if (keywords.length <= 0) {
//         return
//     }
//     // 定义筛选按钮的JSON配置对象
//     let siftSuitJson = {
//         "text": "筛选圣遗物套装",    // 按钮显示的文本内容
//         "x": 0,                    // 按钮的x坐标
//         "y": 0,                    // 按钮的y坐标
//         "width": genshinJson.width / 3.0,  // 按钮的宽度为屏幕宽度的1/3
//         "height": genshinJson.height      // 按钮的高度为整个屏幕高度
//     }
//     // 查找筛选按钮元素
//     let siftSuit = await ocrBase(`${path_base_main}${siftSuitJson.text}.jpg`, siftSuitJson.x, siftSuitJson.y, siftSuitJson.width, siftSuitJson.height)
//     // 判断筛选按钮是否存在
//     if (isExist(sift)) {
//         await info('筛选圣遗物套装'); // 记录日志：筛选圣遗物套装
//         await siftSuit.click(); // 点击筛选按钮
//         await wait(300); // 等待500毫秒
//         //todo: 筛选套装 这版不做 预留
//
//         let last = {
//             name_one: null,
//             name_two: null,
//             x: genshinJson.width / 2,
//             y: genshinJson.height * 2 / 3,
//         }
//         // 计算屏幕宽度的一半
//         let width = Math.ceil(genshinJson.width * 6 / 10);
//         // 获取屏幕总高度
//         let height = Math.ceil(genshinJson.height * 11 / 12);
//         // 设置起始点的x坐标为屏幕宽度的一半
//         let x = 0;
//         // 设置起始点的y坐标为0（顶部）
//         let y = 0;
//         // await mTo(width, height/2)
//         // await mTo(733, 849)
//         // return
//         let index = 1;
//         for (let i = 1; i <= config.countMaxByHoly; i++) {
//             let captureRegion = openCaptureGameRegion();
//             let ocrObject = recognitionObjectOcr(x, y, width, height);
//             // await mTo(width, 0)
//             // ocrObject.threshold = 1.0;
//             let resList = findMultiByCaptureGameRegion(captureRegion, ocrObject);
//             closeCaptureGameRegion(captureRegion)
//             await wait(10)
//             for (let res of resList) {
//                 await logInfoOcr(res)
//                 if (containsChinese(res.text)) {
//                     //中文设入
//                     if (index % 2 !== 0) {
//                         last.name_one = res.text
//                     } else {
//                         last.name_two = res.text
//                     }
//                     // await info(`==>${last.name_one}<==>${last.name_two}<==`)
//                     index++
//                 }
//                 await mTo(res.x, res.y)
//                 last.y = res.y
//             }
//
//             await wait(1)
//             await mTo(last.x, last.y)
//             await wait(2)
//             await dragBase(0, -Math.ceil(genshinJson.height * 40 / 1080), Math.ceil(genshinJson.height * 10 / 1080), config.log_off)
//             await wait(1)
//
//             if (last.name_one != null && last.name_one === last.name_two) {
//                 await info('已达底部')
//                 break
//             }
//         }
//
//     }
// }
