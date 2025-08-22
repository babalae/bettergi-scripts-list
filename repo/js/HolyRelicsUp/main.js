/**
 * 主方法
 * @returns {Promise<void>}
 */
async function main(log_off = config.log_off) {
    // mTo(1170,800)
    // await wait(500)
    // mTo(1270,800)
    // await wait(500)
    // mTo(1270,1000)
    // await wait(500)
    // return
    let ms = 300
    await setGameMetrics(1920, 1080, 1); // 设置游戏窗口大小和DPI
    if (config.enableBatchUp) { // 检查是否启用
        if (config.toBag) {
            await wait(ms);
            await toMainUi()
            await wait(ms);
            //打开背包
            await openKnapsack();
            await openHolyRelicsKnapsack();
        }

        if (config.toSort || config.toSift) {
            await wait(ms);
            //排序
            await openPrerequisitesAll(log_off);
        }
        await wait(ms);
        await bathClickUpLv1(config.insertionMethod)
    } else {
        throwError(`未启用批量强化请去浏览文档后开启！`)
    }
}

//========================以下为原有封装==============================
function info(msg, must = false) {
    if (config.log_off || must) {
        log.info(msg)
    }
}

function warn(msg, must = false) {
    if (must) {
        log.warn(msg)
    }
}

function debug(msg, must = false) {
    if (must) {
        log.debug(msg)
    }
}

function error(msg, must = false) {
    if (must) {
        log.error(msg)
    }
}

function throwError(msg) {
    notification.error(`${msg}`);
}

function openCaptureGameRegion() {
    return captureGameRegion()
}

function closeCaptureGameRegion(region) {
    region.Dispose()
}

function findByCaptureGameRegion(region, templateMatchObject) {
    return region.find(templateMatchObject)
}

function findMultiByCaptureGameRegion(region, templateMatchObject) {
    return region.findMulti(templateMatchObject)
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
const must = true
const config = {
    suit: settings.suit,
    log_off: !settings.log_off,
    countMaxByHoly: Math.floor(settings.countMaxByHoly),//筛选圣遗物界面最大翻页次数
    enableBatchUp: settings.enableBatchUp,//启用批量强化
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
    siftArray: (siftAll())//筛选条件

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
            await wait(delayMs)
        }
    }
    // 滚动完成后释放左键
    await wait(30);
    upLeftButton();
    await wait(100);
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
function templateMatchBase(path, x, y, width, height) {
    // 使用模板匹配方法创建识别对象
    // 从指定路径读取图像矩阵并进行模板匹配
    let templateMatchButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path}`), x, y, width, height);
    // 捕获游戏区域并查找匹配的识别对象
    let region = openCaptureGameRegion()
    let button = region.find(templateMatchButtonRo);
    closeCaptureGameRegion(region)
    // 返回查找到的按钮对象
    return button
}


/**
 * 模板匹配函数，用于在指定路径下进行图像模板匹配
 * @param {string} path - 模板图像的路径
 * @returns {Object} - 返回模板匹配的结果
 */
function templateMatch(path) {
    // 调用基础模板匹配函数，传入路径、初始坐标(0,0)以及目标图像的宽高
    return templateMatchBase(`${path}`, 0, 0, genshinJson.width, genshinJson.height)
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

//========================以上为基本操作==============================
//========================以下为实际操作==============================

/**
 * 打开背包
 * @returns {Promise<Boolean>}
 * <前置条件:处于主界面|测试通过:v>
 */
async function openKnapsack() {
    let templateJson = {
        "text": "背包",
        "x": 0,
        "y": 0,
        "width": genshinJson.width / 3.0,
        "height": genshinJson.width / 5.0
    }
    let knapsack = await templateMatchBase(`${path_base_main}${templateJson.text}.jpg`, templateJson.x, templateJson.y, templateJson.width, templateJson.height)
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
 * 模板匹配圣遗物背包区域的函数
 * 该函数通过模板匹配游戏界面中的圣遗物背包区域
 * @returns {Promise} 返回一个Promise对象，解析为OCR识别结果
 */
function templateMatchHolyRelicsKnapsack() {
    let templateJson = {
        "text": "圣遗物",               // 要识别的文本内容，即"圣遗物"三个字
        "x": 0,                       // 识别区域的起始x坐标，设为0表示从屏幕最左侧开始
        "y": 0,                       // 识别区域的起始y坐标，设为0表示从屏幕最顶部开始
        "width": genshinJson.width / 2.0,    // 识别区域的宽度（屏幕宽度的一半）
        "height": genshinJson.width / 5.0   // 识别区域的高度（屏幕宽度的五分之一）
    }
    let holyRelicsKnapsack = templateMatchBase(`${path_base_main}${templateJson.text}.jpg`, templateJson.x, templateJson.y, templateJson.width, templateJson.height)
    return holyRelicsKnapsack
}

/**
 * 打开圣遗物背包
 * @returns {Promise<boolean>}
 * <前置条件:处于背包界面|测试通过:v>
 */
async function openHolyRelicsKnapsack() {
    let re = false;

    let holyRelicsKnapsack = templateMatchHolyRelicsKnapsack()
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

    let templateMatchJson = {
        "text": "筛选",
        "x": 0,
        "y": 0,
        "width": genshinJson.width / 3.0,
        "height": genshinJson.height
    }
    // 查找筛选按钮元素
    let sift = templateMatchBase(`${path_base_main}${templateMatchJson.text}.jpg`, templateMatchJson.x, templateMatchJson.y, templateMatchJson.width, templateMatchJson.height)
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
        let templateResetJson = {
            "text": "重置",
            "x": 0,
            "y": 0,
            "width": genshinJson.width / 3.0,
            "height": genshinJson.height
        }
        // 查找重置按钮元素
        let reset = await templateMatchBase(`${path_base_main}${templateResetJson.text}.jpg`, templateResetJson.x, templateResetJson.y, templateResetJson.width, templateResetJson.height)
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
    let sift = await templateMatchBase(`${path_base_main}${siftSiftHolyRelicsSuitUIJson.text}.jpg`, siftSiftHolyRelicsSuitUIJson.x, siftSiftHolyRelicsSuitUIJson.y, siftSiftHolyRelicsSuitUIJson.width, siftSiftHolyRelicsSuitUIJson.height)
    await wait(300)
    let exist = isExist(sift);

    if (exist) {
        await logInfoTemplateBase(sift, 'HolyRelicsSuitUI', log_off)
        // await mTo(siftState.x, siftState.y)
        sift.click()
        if (log_off) {
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
            let templateMatchObject = recognitionObjectOcr(x, y, width, height);
            // await mTo(width, 0)
            // templateMatchObject.threshold = 1.0;
            let opJsons = new Array()
            let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
            await wait(10)
            for (let res of resList) {
                await logInfoTemplate(res, source)
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

            //画面拆为二分别识别
            await info('开始识别右边画面')
            await wait(1)
            templateMatchObject = await recognitionObjectOcr(x1, y, width, height);
            // await mTo(width, 0)
            // templateMatchObject.threshold = 1.0;
            resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
            closeCaptureGameRegion(captureRegion)
            await wait(1)
            for (let res of resList) {
                await logInfoTemplate(res, source)

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
            await mTo(genshinJson.width / 2, Math.floor(genshinJson.height * 3 / 4))
            await wait(2)
            // await dragBase(0, -Math.floor( genshinJson.height *40 / 1080 ), Math.floor( genshinJson.height *10  / 1080 ), config.log_off)
            await scrollPage(Math.floor(genshinJson.height / 3))
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
    let width = Math.floor(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.floor(genshinJson.height);
    // 使用OCR识别指定区域的图像
    let templateMatch = await templateMatchBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (isExist(templateMatch)) {
        await logInfoTemplate(templateMatch, 'openSort')
        templateMatch.click()
    }
    return templateMatch
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
    let width = Math.floor(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.floor(genshinJson.height);
    let templateMatch = await templateMatchBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    await wait(1000)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (isExist(templateMatch)) {
        // 更新按钮名称为选中状态
        up_name = '升序'
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
 * 该函数通过OCR识别和点击操作来切换或确认升序排列状态
 * <前置条件:处于圣遗物背包排序界面最底部|测试通过:v>
 * @returns {Promise<void>}
 */
async function openLvSort() {
    // 定义未选中状态下的升序按钮名称
    let up_name = '等级顺序排序'
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = Math.floor(genshinJson.width / 3.0);
    // 获取屏幕高度
    let height = Math.floor(genshinJson.height);
    // 使用OCR识别指定区域的图像
    let templateMatch = await templateMatchBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    await wait(1000)
    if (isExist(templateMatch)) {
        // 更新按钮名称为选中状态
        up_name = '等级顺序排序'
        // 点击升序按钮
        templateMatch.click()
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
    await templateMatchClick(`${path_base_sort}1.jpg`, "取消选择1", source, log_off)
    await wait(1)
    // 执行第二次模板匹配点击，点击"取消选择2"按钮，并等待1秒
    await templateMatchClick(`${path_base_sort}2.jpg`, "取消选择2", source, log_off)
    await wait(1)
    // 执行第三次模板匹配点击，点击"取消选择3"按钮，并等待1秒
    await templateMatchClick(`${path_base_sort}3.jpg`, "取消选择3", source, log_off)
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

    let x = Math.floor(genshinJson.width * 200 / 1920)
    let y = Math.floor(genshinJson.height * 300 / 1080)
    let h = Math.floor(genshinJson.height * 10 / 1080)
    let width = Math.floor(genshinJson.width * 450 / 1920);
    //拖动到看不见辅助排序规则(影响OCR)
    await mTo(x, y)
    await scrollPage(Math.floor(genshinJson.height * 1 / 5 + genshinJson.height * 1 / 6), true, 6)
    await info('[重置操作]拖动到看不见辅助排序规则(影响OCR)')
    await wait(100)
    let template_name = '属性排序规则'
    for (let index = 1; index <= 5; index++) {
        await unchecked(log_off)
        await mTo(x, y)
        await scrollPage(Math.floor(genshinJson.height * 2 / 3), true, 6)

        let templateMatch = await templateMatchBase(`${path_base_main}${template_name}.jpg`, 0, 0, width, genshinJson.height)
        if (isExist(templateMatch)) {
            await unchecked(log_off)
            await info(`已到顶`)
            break
        } else if (index == 5) {
            throwError(`未找到${template_name}`)
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
    let x = Math.floor(genshinJson.height * 200 / 1920)
    let y = Math.floor(300 * genshinJson.height / 1080)
    let h = Math.floor(genshinJson.height * 10 / 1080)
    await mTo(x, y)
    await wait(1)
    // await dragBase(0, Math.floor(26 * genshinJson.height / 1080 ), h, log_off)
    await scrollPage(Math.floor(genshinJson.height * 1 / 5 + genshinJson.height * 1 / 6), true, 6)
    await info('拖动到看不见辅助排序规则(影响OCR)')
    // await wait(100)
    let template_name = '属性排序规则'

    let sort = new Array()
    let templateMatch_y = Math.floor(60 * genshinJson.height / 1080)
    for (let index = 1; index <= 10; index++) {
        let width = Math.floor(450 * genshinJson.width / 1920);
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
                await wait(1)
                await downClick(one.x, one.y)
                attributeKeysOk.push(one.text)
                await wait(10)
                await info(`选中 {index: ${one.index}, text: ${one.text}, x: ${one.x}, y: ${one.y}}`)
            }
        }

        await mTo(x, y)
        await scrollPage(Math.floor(genshinJson.height * 2 / 3), true, 6)
        await wait(1)

        let templateMatch = templateMatchBase(`${path_base_main}${template_name}.jpg`, 0, 0, width, genshinJson.height)
        if (isExist(templateMatch)) {

            let captureRegion = openCaptureGameRegion();
            let templateMatchObject = recognitionObjectOcr(0, templateMatch_y, width, genshinJson.height - templateMatch_y);
            // await mTo(width, 0)
            // templateMatchObject.threshold = 1.0;
            let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
            closeCaptureGameRegion(captureRegion)


            for (let res of resList) {
                await logInfoTemplate(res, source)
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
            throwError(`未找到${template_name}`)
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
            let width = Math.floor(genshinJson.width * 450 / 1920);
            let captureRegion = openCaptureGameRegion();
            let y = Math.floor(genshinJson.height / 2);
            const templateMatchObject = recognitionObjectOcr(0, y, width, y);
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
    let ms = 300
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
    let ms = 300
    // await openSiftAll()
    await wait(ms)
    // await confirm('强制拉到顶')


    let templateMatchJson = {
        "text": "筛选",
        "x": 0,
        "y": 0,
        "width": genshinJson.width / 3.0,
        "height": genshinJson.height
    }
    // 查找筛选按钮元素
    let sift = templateMatchBase(`${path_base_main}${templateMatchJson.text}.jpg`, templateMatchJson.x, templateMatchJson.y, templateMatchJson.width, templateMatchJson.height)
    // let templateMatch = await templateMatch(`${path_base_main}确认.jpg`, 0, 0, Math.floor(genshinJson.width / 2), Math.floor(genshinJson.height / 2))
    // logInfoTemplate(templateMatch)
    if (isExist(sift)) {
        sift.click()
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
    let ms = 300
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
    let ms = 300
    // 注释掉的代码：使用模板匹配方法查找强化按钮
    // const aggrandizementRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}强化.jpg"), 0, 0, genshinJson.width / 3.0, genshinJson.height);
    // // 捕获游戏区域并查找强化按钮
    // let aggrandizement = captureGameRegion().find(aggrandizementRo);
    // 定义OCR识别的JSON对象，包含文本和位置信息
    let templateJson = {
        "text": "强化",    // 要识别的文本内容
        "x": 0,           // 识别区域的左上角x坐标
        "y": 0,           // 识别区域的左上角y坐标
        "width": genshinJson.width,    // 识别区域的宽度
        "height": genshinJson.height   // 识别区域的高度
    }
    // 使用模板匹配方法查找强化按钮
    let aggrandizement = templateMatchBase(`${path_base_main}${templateJson.text}.jpg`, templateJson.x, templateJson.y, templateJson.width, templateJson.height)
    await logInfoTemplate(aggrandizement, 'openAggrandizement')
    // 检查强化按钮是否存在
    if (isExist(aggrandizement)) {
        await wait(ms);
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
    return await templateMatchClick(`${path_base_main}确认.jpg`, log_msg, source, config.log_off)
}

/**
 * 清空选中的狗粮
 * @returns {Promise<void>}
 */
async function clear(source = 'clear') {
    // 通过OCR识别并点击"详情"按钮
    await templateMatchClick(`${path_base_main}详情.jpg`, "点击详情", source, config.log_off)
    await wait(300)
    // 通过OCR识别并点击"强化"按钮
    await templateMatchClick(`${path_base_main}强化.jpg`, "点击强化", source, config.log_off)
}

/**
 * 操作方式处理函数
 * @param operate - 操作类型参数

 * @param log_off - 日志开关参数
 * @returns {Promise<string>} - 返回处理后的操作类型
 */
async function operateDispose(operate, enableInsertionMethod, source = 'operateDispose', log_off) {
    let templateMatch_name = '阶段放入'  // 默认使用"阶段放入"进行OCR识别
    //自动识别界面元素
    let templateMatch1 = await templateMatch(`${path_base_main}${templateMatch_name}.jpg`)
    // 如果默认元素不存在，则切换为"快捷放入"
    let exist = isExist(templateMatch1);
    if (!exist) {
        templateMatch_name = '快捷放入'
    }
    info(`operateDispose`)
    // 如果操作方式为"默认"或未指定，则进行自动识别
    if (operate === '默认' || (!operate)) {
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

        let name = '设置按键'
        await templateMatchClick(`${path_base_main}${name}.jpg`, `点击${name}`, source, log_off)
        let name4 = `点击关闭`
        if (operate !== '快捷放入') {
            name4 = `点击开启`
        }
        await templateMatchClick(`${path_base_main}${name4}.jpg`, `${name4}`, source, log_off)
        let name5 = `关闭设置`
        await templateMatchClick(`${path_base_main}${name5}.jpg`, `${name5}`, source, log_off)
        mTo(0, 0)
    }
    info(`[放入方式]==>${operate}<==[end]`)
    if (isExist(templateMatch1)) {
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

    // // 定义OCR识别的初始坐标和区域大小
    // let templateMatch_x = Math.floor(genshinJson.width / 2); // OCR识别区域的x坐标，设置为屏幕宽度的一半
    // let templateMatch_y = 0; // OCR识别区域的y坐标，设置为0（屏幕顶部）
    // let width = Math.floor(genshinJson.width / 2); // OCR识别区域的宽度，设置为屏幕宽度的一半
    // let height = Math.floor(genshinJson.height); // OCR识别区域的高度，设置为整个屏幕高度
    //
    // // 定义并执行第一次OCR识别，用于识别经验值图标
    // let up_name = 'exp' // 识别对象名称为经验值图标
    // let templateMatch = await templateMatch(`${path_base_main}${up_name}.jpg`, templateMatch_x, templateMatch_y, width, height) // 执行OCR识别
    // if (log_off) {
    //     await logInfoTemplate(templateMatch, source + '-' + up_name) // 记录OCR识别结果
    // }
    //
    // // 定义并执行第二次OCR识别，用于识别返回键
    // let up_name1 = '返回键' // 识别对象名称为返回键
    // let templateMatch1 = await templateMatch(`${path_base_main}${up_name1}.jpg`, templateMatch_x, templateMatch_y, width, height) // 执行OCR识别
    //
    // if (log_off) {
    //     await logInfoTemplate(templateMatch1, source + '-' + up_name1) // 记录OCR识别结果
    // }
    // //todo :bug
    // // 计算OCR识别的目标区域
    // let x = Math.min(templateMatch1.x, templateMatch.x) // 目标区域的左上角x坐标
    // let y = Math.min(templateMatch1.y, templateMatch.y) // 目标区域的左上角y坐标
    // let w = Math.floor(Math.abs(templateMatch1.x - templateMatch.x) / 2) // 目标区域的宽度
    // let h = Math.abs(templateMatch1.y - templateMatch.y) // 目标区域的高度

    let x = Math.floor(genshinJson.width * 1173 / 1920)// 目标区域的左上角x坐标
    let y = Math.floor(genshinJson.height * 34 / 1080)// 目标区域的左上角y坐标
    let w = Math.floor(genshinJson.width * 329 / 1920)// 目标区域的宽度
    let h = Math.floor(genshinJson.height * 145 / 1080)// 目标区域的高度
    await wait(10)
    await infoLog(`{x:${x},y:${y},w:${w},h:${h}}`, source) // 记录OCR识别结果
    // 截取游戏画面并进行OCR识别
    let captureRegion = openCaptureGameRegion(); // 截取游戏画面
    const templateMatchObject = await recognitionObjectOcr(x, y, w, h); // 创建OCR识别对象
    let res = findByCaptureGameRegion(captureRegion, templateMatchObject); // 执行OCR识别
    await wait(10)
    if (log_off) {
        await logInfoTemplate(res, source) // 记录OCR识别结果
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
    await templateMatchClick(`${path_base_main}${operate}.jpg`, `点击${operate}`, source, log_off)  // 调用模板匹配识别并点击指定按钮
    await wait(500)  // 等待500毫秒，确保界面响应

    let templateMatchHolyRelics = await templateMatchHolyRelicsUpFrequency();
    await wait(10)
    upJson.level = templateMatchHolyRelics.level
    upJson.sumLevel = templateMatchHolyRelics.sumLevel
    // 输出当前圣遗物等级的日志信息
    await info(`当前圣遗物等级: ${templateMatchHolyRelics.level}`)
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

    await confirm(`[oneUp]点击确认`)  // 确认操作
    await mTo(0, 0)
    await wait(30)
    // 定义错误信息为"摩拉不足"
    let err = '摩拉不足'
    // 检查强化是否成功
    let upOk = await templateMatchClick(`${path_base_main}${err}.jpg`, `确认强化是否成功`, log_off)
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

    let levelJson = await templateMatchHolyRelicsUpFrequency();
    if ((!upJson.start) && templateMatchHolyRelics.level === levelJson.level) {
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


async function t() {
    let ms = 300
    let base_x = Math.floor(genshinJson.width * 200 / 1920)
    let base_y = Math.floor(genshinJson.height * 250 / 1080)
    let base_width = Math.floor(genshinJson.width * 145 / 1920)
    let base_height = Math.floor(genshinJson.height * 189 / 1080)
    let line = 8
    let page = line * 4
    info(`圣遗物${config.sortMain}强化操作`,must)
    for (let i = 0; i < page + line; i++) {
        let base_count_x = Math.floor(i % line)
        let base_count_y = (i % page) < line ? 0 : Math.floor((i % page) / line);
        let x = base_x + base_count_x * base_width;
        let y = base_y + base_count_y * base_height;
        warn(`i:${i},base_count_x:${base_count_x},base_count_y:${base_count_y},x:${x},y:${y}`)
        // lastJson.t_y = y
        // lastJson.t_x = x
        if (config.sortMain.includes('降序')) {
            if (config.upMax >= 20) {
                // warn(`降序排序功能暂未实现自动强化`)
                throwError(`降序排序功能暂未实现+20的自动强化`)
            }

            if (i <= 1) {
                //强制拉到顶
                await clickProgressBarTopByHolyRelics()
                await wait(ms);
            }
            let bool = i >= (page) && i % (page) === 0;
            if (bool) {
                await info(`滑动一页`,must)
                for (let j = 0; j < page / line; j++) {
                    await wait(1)
                    let line = Math.floor(genshinJson.height * 175 / 1080)
                    mTo(Math.floor(genshinJson.width / 2), Math.floor(genshinJson.height * 2 / 3))
                    await scrollPage(line, false, 6)
                }
                await wait(1)
            }

            //每行8个
            // throwError(`降序排序功能暂未实现自动强化`)
            // if (i % 8 === 0) {
            //     await wait(300)
            // }
            warn(`x:${x},y:${y}`,must)
            await mTo(x, y)
            await wait(300)
            await downClick(x, y)
            await wait(ms)
            warn(`点击确认x:${x},y:${y}`,must)
            // await wait(10)
            await confirm('降序强化点击确认')

        } else {
            //强制拉到顶
            await clickProgressBarTopByHolyRelics()
            await wait(ms);
            // 调用点击第一个圣物遗物的函数，并等待其完成
            await downClickFirstHolyRelics()
        }
        await wait(ms)
        //打开强化界面
        await openAggrandizement()
        await wait(ms)
        await mTo(genshinJson.width / 2, genshinJson.height / 2)
        await wait(ms)
        let up_name = '返回键'
        await templateMatchClick(`${path_base_main}${up_name}.jpg`, `圣遗物已经强化到+${config.upMax}退出强化页面 到圣遗物背包界面`)

    }
}

async function bathClickUpLv1(operate, source = 'bathClickUpLv1', log_off = config.log_off) {
    let ms = 300
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

    let base_x = Math.floor(genshinJson.width * 200 / 1920)
    let base_y = Math.floor(genshinJson.height * 250 / 1080)
    let base_width = Math.floor(genshinJson.width * 145 / 1920)
    let base_height = Math.floor(genshinJson.height * 189 / 1080)
    let line = 8
    let page = line * 4

    info(`圣遗物${config.sortMain}强化操作`,must)

    for (let i = 0; upMaxCount > actualCount; i++) {
        if (upMaxCount === actualCount) {
            info(`{强化次数已达到:${upMaxCount}}`)
            break
        }

        let base_count_x = Math.floor(i % line)
        let base_count_y = (i % page) < line ? 0 : Math.floor((i % page) / line);
        let x = base_x + base_count_x * base_width;
        let y = base_y + base_count_y * base_height;
        warn(`i:${i},base_count_x:${base_count_x},base_count_y:${base_count_y},x:${x},y:${y}`)
        lastJson.t_y = y
        lastJson.t_x = x
        if (config.sortMain.includes('降序') && config.upMax < 20) {
            if (i < 1) {
                //强制拉到顶
                await clickProgressBarTopByHolyRelics()
                await wait(ms);
            }
            let bool = i >= (page) && i % (page) === 0;
            if (bool) {
                await info(`滑动一页`,must)
                for (let j = 0; j < page / line; j++) {
                    await wait(1)
                    let line = Math.floor(genshinJson.height * 175 / 1080)
                    mTo(Math.floor(genshinJson.width / 2), Math.floor(genshinJson.height * 2 / 3))
                    await scrollPage(line, false, 6)
                }
                await wait(ms)
            }

            warn(`x:${x},y:${y}`)
            await mTo(x, y)
            await wait(ms)
            await downClick(x, y)
            await wait(ms)
            warn(`点击确认x:${x},y:${y}`)
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
            await templateMatchClick(`${path_base_main}${up_name}.jpg`, `圣遗物已经强化到+${config.upMax}退出强化页面 到圣遗物背包界面`, source, log_off)
            //返回圣遗物背包
            if (!re.start) {
                continue
            }
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
        warn(`当前强化次数:${actualCount} 总强化次数:${upMaxCount}`)
    }
    warn(`圣遗物强化+${config.upMax} 数量：${actualCount}`)
    info(`圣遗物强化+${config.upMax} 数量：${actualCount}`)

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
 * 批量强化函数(已经升级)
 * @param operate - 操作参数对象
 * @param log_off - 是否注销标志
 * @returns {Promise<void>} - 返回一个空Promise，表示异步操作完成
 */
async function bathClickUp(operate, source = 'bathClickUp', log_off = config.log_off) {
    let ms = 10
    // let index = 0
    let upMaxCount = 0
    if (config.upMaxCount) {
        upMaxCount = Math.floor(config.upMaxCount)
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
            let base_x = Math.floor(genshinJson.height * 200 / 1920)
            let base_y = Math.floor(genshinJson.height * 250 / 1080)
            let base_width = Math.floor(genshinJson.width * 145 / 1920)
            let base_height = Math.floor(genshinJson.height * 189 / 1080)
            let base_count_x = Math.floor(i % line)
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
            await templateMatchClick(`${path_base_main}${up_name}.jpg`, `圣遗物已经强化到+${config.upMax}退出强化页面 到圣遗物背包界面`, source, log_off)
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
        let buttonObject = await templateMatchBase(`${path_base_main}选择素材条件按键.jpg`, 0, 0, genshinJson.width, genshinJson.height)
        await wait(300)
        // 检查按钮是否存在
        if (isExist(buttonObject)) {
            await info('打开选择素材条件')
            await wait(500);
            // 点击按钮并等待界面加载
            // await buttonObject.click();
            let x = Math.floor(genshinJson.width * 1524 / 1920)
            let y = Math.floor(genshinJson.height * 758 / 1080)
            downClick(x, y)
            await wait(500);

            await info(`素材条件==>x:${buttonObject.x},y:${buttonObject.y}`)

            let needMoLa = await templateMatchBase(`${path_base_main}需要摩拉.jpg`, 0, 0, genshinJson.width, genshinJson.height)
            await wait(300)
            // 检查是否能定位到"需要摩拉"文本区域
            if (!isExist(needMoLa)) {
                let msg = `无法定位识别！`
                await error(msg)
                throwError(msg)
            } else {
                // 计算OCR识别区域的坐标和尺寸
                // let templateMatch_x = Math.min(needMoLa.x, buttonObject.x)
                // let templateMatch_y = Math.min(needMoLa.y, buttonObject.y)
                // let templateMatch_width = Math.abs(needMoLa.x - buttonObject.x)
                // let templateMatch_height = Math.abs(needMoLa.y - buttonObject.y)
                await info(`OCR==>x:${templateMatch_x},y:${templateMatch_y},width:${templateMatch_width},height:${templateMatch_height}`)
                //x:1170,y:758,width:354,height:243
                let templateMatch_x = Math.floor(genshinJson.width * 1170 / 1920)
                let templateMatch_y = Math.floor(genshinJson.height * 758 / 1080)
                let templateMatch_width = Math.floor(genshinJson.width * 354 / 1920)
                let templateMatch_height = Math.floor(genshinJson.height * 243 / 1080)
                // 以下代码被注释，可能是用于调试的鼠标移动
                // await mTo(templateMatch_x, templateMatch_y)
                // 创建OCR识别对象
                let templateMatchObject = await recognitionObjectOcr(templateMatch_x, templateMatch_y, templateMatch_width, templateMatch_height);
                // 捕获游戏界面并执行OCR识别
                let captureRegion = openCaptureGameRegion();
                let resList = findMultiByCaptureGameRegion(captureRegion, templateMatchObject);
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

