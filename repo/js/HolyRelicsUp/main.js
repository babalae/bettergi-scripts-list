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

async function mTo(x, y) {
    await moveMouseTo(x, y);
}

async function recognitionObjectOcr(x, y, width, height) {
    return await RecognitionObject.Ocr(x, y, width, height)
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
const config = {
    enableBatchUp: settings.enableBatchUp,//是否开启批量升级
    enableOneUp: settings.enableOneUp,//是否开启单次升级
    enableInsertionMethod: settings.enableInsertionMethod,//是否开启插入方式
    insertionMethod: settings.insertionMethod,//插入方式
    material: settings.material,//材料
    upMax: parseInt(settings.upMax + ''),//升级次数
    upMaxCount: settings.upMaxCount + '',//设置升级圣遗物个数
    operate: settings.operate,//操作
    knapsackKey: settings.knapsackKey//背包快捷键
}
const genshinJson = {
    width: genshin.width,
    height: genshin.height,
}
const path_base_main = 'assets/main/'
//========================以上为基本配置==============================
//========================以下为基本操作==============================
async function logInfoOcrBase(res, log_off) {
    if (!log_off) {
        await info(`识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
    }
}

/**
 *
 * @param res
 * @returns {Promise<void>}
 */
async function logInfoOcr(res) {
    await logInfoOcrBase(res, false)
}

/**
 * 异步函数，用于模拟鼠标拖动操作
 * @param {number} x - 每次移动的X轴距离
 * @param {number} y - 每次移动的Y轴距离
 * @param {number} h - 移动的总步数/高度
 */
async function drag(x, y, h) {
    await dragBase(x, y, h, true)
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
    await wait(1000);
    // 循环移动鼠标，实现拖动效果
    for (let i = 0; i < h; ++i) {
        await moveByMouse(x, y);
        await wait(1);
    }
    // 释放鼠标左键，结束拖动
    await upLeftButton();
    await wait(1000);
    // 如果log_off为false，则输出拖动完成日志
    if (!log_off) {
        await info(`拖动完成，步数: ${h},x:${x},y:${y}`);
    }
}


/**
 * 执行页面基础拖动操作的异步函数
 * @param {boolean} log_off - 是否关闭日志输出的标志位
 * @returns {Promise<void>} - 返回一个Promise，表示拖动操作的完成
 */
async function dragPageBase(log_off) {
    // 计算 drag 高度，基于genshin.height按比例缩放，基准高度为1080
    // 这样可以使拖动高度根据屏幕高度自适应
    let h = parseInt(300 * genshinJson.height / 1080 + '')
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
    await dragPageBase(false)
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
async function ocrBase(path, x, y, width, height) {
    // 使用模板匹配方法创建识别对象
    // 从指定路径读取图像矩阵并进行模板匹配
    let ocrButtonRo = await RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path}`), x, y, width, height);
    // 捕获游戏区域并查找匹配的识别对象
    let button = await captureGameRegion().find(ocrButtonRo);
    // 返回查找到的按钮对象
    return button
}

/**
 * 识别函数 - 用于对指定路径的图像进行OCR文字识别
 * @param path {string} - 需要进行OCR识别的图像文件路径
 * @returns {Promise<*>} - 返回一个Promise对象，解析后的结果为OCR识别的内容
 */
async function ocr(path) {
    // 调用基础OCR识别函数，传入完整路径和默认的坐标参数
    // 参数说明：
    // - path: 图像文件路径
    // - 0, 0: 起始坐标(x, y)，设为0表示从图像左上角开始
    // - genshinJson.width: 识别区域的宽度，使用全局变量genshin的宽度值
    // - genshinJson.height: 识别区域的高度，使用全局变量genshin的高度值
    return await ocrBase(`${path}`, 0, 0, genshinJson.width, genshinJson.height)
}

/**
 * 识别并点击指定路径的按钮元素

 * @param {string} path - 用于OCR识别的路径或模板
 * @param {string} log_msg - 点击按钮前要记录的日志信息
 * @param {boolean} log_off - 是否关闭日志记录功能，false表示开启日志记录
 * @returns {Promise<void>} - 返回一个Promise对象，表示异步操作的完成
 */
async function ocrClick(path, log_msg, log_off) {
    // 使用OCR技术识别指定路径的按钮元素
    let button = await ocr(path);
    // 检查按钮元素是否存在
    if (isExist(button)) {
        // 如果未关闭日志记录功能
        if (!log_off) {
            // 记录操作日志信息
            await info(`${log_msg}`)
            // 记录OCR识别到的按钮详细信息
            await logInfoOcr(button)
        }
        // 点击按钮元素
        await button.click();
        // 暂停500毫秒，等待操作完成
        await wait(1000);
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
 * 打开圣遗物背包
 * @returns {Promise<boolean>}
 * <前置条件:处于背包界面|测试通过:v>
 */
async function openHolyRelicsKnapsack() {
    // const holyRelicsKnapsackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}圣遗物.jpg"), 0, 0, genshinJson.width / 2.0, genshinJson.width / 5.0);
    // // 通过捕获游戏区域并查找圣遗物背包图标元素
    // let holyRelicsKnapsack = captureGameRegion().find(holyRelicsKnapsackRo);
    let ocrJson = {
        "text": "圣遗物",
        "x": 0,
        "y": 0,
        "width": genshinJson.width / 2.0,
        "height": genshinJson.width / 5.0
    }
    let re = false;

    let holyRelicsKnapsack = await ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
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
    let sift = await ocrBase(`${path_base_main}${ocrSiftJson.text}.jpg`, ocrSiftJson.x, ocrSiftJson.y, ocrSiftJson.width, ocrSiftJson.height)
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
 * 筛选圣遗物套装的异步函数
 * @param {boolean} log_off - 是否记录日志的参数
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 */
async function siftHolyRelicsSuit(log_off) {
    // 定义筛选按钮的JSON配置对象
    let siftSuitJson = {
        "text": "筛选圣遗物套装",    // 按钮显示的文本内容
        "x": 0,                    // 按钮的x坐标
        "y": 0,                    // 按钮的y坐标
        "width": genshinJson.width / 3.0,  // 按钮的宽度为屏幕宽度的1/3
        "height": genshinJson.height      // 按钮的高度为整个屏幕高度
    }
    // 查找筛选按钮元素
    let siftSuit = await ocrBase(`${path_base_main}${siftSuitJson.text}.jpg`, siftSuitJson.x, siftSuitJson.y, siftSuitJson.width, siftSuitJson.height)
    // 判断筛选按钮是否存在
    if (isExist(sift)) {
        await info('筛选圣遗物套装'); // 记录日志：筛选圣遗物套装
        await siftSuit.click(); // 点击筛选按钮
        await wait(500); // 等待500毫秒
        //todo: 筛选套装 这版不做 预留
    }
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
    let siftState = await ocrBase(`${path_base_main}${siftJson.text}.jpg`, siftJson.x, siftJson.y, siftJson.width, siftJson.height)
    await wait(300)
    let exist = isExist(siftState);
    if (exist) {
        await logInfoOcrBase(siftState, false)
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
 * 筛选圣遗物 所有选项
 * @param log_off - 是否记录日志的开关参数
 * @returns {Promise<boolean>} - 返回一个空Promise，表示异步操作的完成
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */

async function openSiftAll(log_off) {
    // 调用重置筛选函数，恢复筛选条件到初始状态
    let reOk = await resetSift();
    let op = false
    if (reOk) {
        await wait(1)
        await siftState(log_off)
        await wait(1)
        // todo: 可扩展
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
async function openSort(log_off) {
    let up_name = '排序'
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = parseInt(genshinJson.width / 3.0 + '');
    // 获取屏幕高度
    let height = parseInt(genshinJson.height + '');
    // 使用OCR识别指定区域的图像
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (isExist(ocr)) {
        await logInfoOcr(ocr, log_off)
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
    let width = parseInt(genshinJson.width / 3.0 + '');
    // 获取屏幕高度
    let height = parseInt(genshinJson.height + '');
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
    let width = parseInt(genshinJson.width / 3.0 + '');
    // 获取屏幕高度
    let height = parseInt(genshinJson.height + '');
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
 * 打开排序并选择所有
 * @param log_off - 日志关闭标志，用于控制是否在操作过程中记录日志
 * @returns {Promise<boolean>} - 返回一个Promise，表示异步操作的完成
 * 该函数用于执行打开排序并选择所有项目的操作
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function openSortAll(log_off) {
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
        // await wait(300)
        // todo: 可扩展
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
async function openPrerequisitesAll(log_off) {
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
    // 定义进度条顶部箭头的名称
    let up_name = '进度条顶部箭头'
    // 计算屏幕宽度的一半
    let width = parseInt(genshinJson.width / 2 + '');
    // 获取屏幕总高度
    let height = parseInt(genshinJson.height + '');
    // 设置起始点的x坐标为屏幕宽度的一半
    var x1 = parseInt(genshinJson.width / 2 + '');
    // 设置起始点的y坐标为0（顶部）
    var y1 = 0;
    // 构建进度条顶部箭头图片的完整路径
    var path = `${path_base_main}${up_name}.jpg`;
    await wait(10)
    // 使用OCR识别图片在屏幕上的位置和大小
    let ocr = await ocrBase(path, x1, y1, width, height)
    // 记录OCR识别结果
    await logInfoOcr(ocr)
    // 计算点击位置的x坐标（OCR识别区域的中心点）
    let x = ocr.x + parseInt(ocr.width / 2 + '');
    // 计算点击位置的y坐标（OCR识别区域的底部）
    let y = ocr.y + parseInt(ocr.height / 2 + '');
    // 输出点击坐标信息
    await info(`x:${x},y:${y}`)
    await wait(10)
    // 移动鼠标到计算的位置
    await clickProgressBar(x, y)
}

/**
 * 点击进度条进度的箭头(排序界面)
 * 该函数用于定位并点击游戏界面中进度条顶部的箭头按钮
 * <前置条件:处于圣遗物背包排序界面|测试通过:v>
 */
async function clickProgressBarDownBySort() {
    // 定义进度条顶部箭头的名称
    let up_name = '排序进度条底部箭头'
    // 计算屏幕宽度的一半
    let width = parseInt(genshinJson.width / 2 + '');
    // 获取屏幕总高度
    let height = parseInt(genshinJson.height + '');
    // 设置起始点的x坐标为屏幕宽度的一半
    var x1 = 0;
    // 设置起始点的y坐标为0（顶部）
    var y1 = 0;
    // 构建进度条顶部箭头图片的完整路径
    var path = `${path_base_main}${up_name}.jpg`;
    // 使用OCR识别图片在屏幕上的位置和大小
    let ocr = await ocrBase(path, x1, y1, width, height)
    // 记录OCR识别结果
    await logInfoOcr(ocr)
    await mTo(ocr.x, ocr.y)

    // 计算点击位置的x坐标（OCR识别区域的中心点）
    let x = ocr.x + parseInt(ocr.width / 2 + '');
    // 计算点击位置的y坐标（OCR识别区域的底部）
    let y = ocr.y - parseInt(ocr.height + '');
    // 输出点击坐标信息
    await info(`x:${x},y:${y}`)
    // await mTo(x, y)
    // 移动鼠标到计算的位置
    await clickProgressBar(x, y)
}


/**
 * 点击第一个圣遗物的函数
 * <前置条件:处于圣遗物背包界面|测试通过:v>
 */
async function downClickFirstHolyRelics() {
    let x = 200 * genshinJson.width / 1920
    let y = 300 * genshinJson.height / 1080
    // await mTo(200,300)
    await downClick(x, y)
    await wait(500)
    await confirm()
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
    let captureRegion = captureGameRegion();
    let res = captureRegion.Find(paimonMenuRo);
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
    let aggrandizement = await ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
    await wait(300);
    // 检查强化按钮是否存在
    if (isExist(aggrandizement)) {
        await wait(300);
        // 输出日志信息，表示正在打开强化界面
        await info('打开强化');
        await wait(300);
        // 点击强化按钮
        await aggrandizement.click();
        // 等待500毫秒以确保界面完全打开
        await wait(300);
    }
}

function selectTheClipCondition(key) {
    info(key).then(r => {
    })
    if (key === null || key === '默认') {
        info(`使用默认素材`).then(r => {
        })
    }
}

/**
 * 打开选择素材条件
 * 该函数用于打开游戏中的素材选择界面，并根据传入的条件自动选择对应的素材
 * @param {string} condition - 需要选择的素材条件文本
 * @returns {Promise<void>} 异步函数，无返回值
 * todo:<前置条件:处于圣遗物强化界面|测试通过:x> 出现问题：执行完成后会自动点击按键 任务结束后也会出现 执行下其他脚本后消失
 */
async function openSelectTheClipCondition(condition) {
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
            await buttonObject.click();
            await wait(500);

            await info(`素材条件==>x:${buttonObject.x},y:${buttonObject.y}`)

            // const needMoLaRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path_base_main}需要摩拉.jpg`), 0, 0, genshinJson.width, genshinJson.height);
            // 捕获界面并查找"需要摩拉"文本区域
            // let needMoLa = captureGameRegion().find(needMoLaRo);
            let needMoLa = await ocrBase(`${path_base_main}需要摩拉.jpg`, 0, 0, genshinJson.width, genshinJson.height)
            await wait(300)
            // 检查是否能定位到"需要摩拉"文本区域
            if (!isExist(needMoLa)) {
                var msg = `无法定位识别！`
                await error(msg)
                throwError(msg)
            } else {
                // 以下代码被注释，可能是用于调试的坐标计算
                // needMoLa.x
                // needMoLa.y
                // let ocr_x = parseInt(1200 * genshinJson.width / 1920 + '')
                // let ocr_y = parseInt(760 * genshinJson.height / 1080 + '')
                // let ocr_width = parseInt(400 * genshinJson.width / 1920 + '')
                // let ocr_height = parseInt(300 * genshinJson.height / 1080 + '')
                // await info(`需要摩拉==>x:${needMoLa.x},y:${needMoLa.y}`)
                // 计算OCR识别区域的坐标和尺寸
                let ocr_x = Math.min(needMoLa.x, buttonObject.x)
                let ocr_y = Math.min(needMoLa.y, buttonObject.y)
                let ocr_width = Math.abs(needMoLa.x - buttonObject.x)
                let ocr_height = Math.abs(needMoLa.y - buttonObject.y)
                await info(`OCR==>x:${ocr_x},y:${ocr_y},width:${ocr_width},height:${ocr_height}`)
                // 以下代码被注释，可能是用于调试的鼠标移动
                // await mTo(ocr_x, ocr_y)
                // 创建OCR识别对象
                let ocrObject = await recognitionObjectOcr(ocr_x, ocr_y, ocr_width, ocr_height);
                // 捕获游戏界面并执行OCR识别
                let captureRegion = captureGameRegion();
                let resList = captureRegion.findMulti(ocrObject);
                let index = 0;
                // 遍历OCR识别结果
                for (let res of resList) {
                    await info(`${index}识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`);
                    // 跳过第一个结果（可能是标题），查找匹配条件的选项
                    if (index !== 0 && res.text.includes(condition)) {
                        await info(`点击${res.text}`)
                        await wait(1000);
                        await res.click();
                        // await downClick(res.x, res.y);
                        await mTo(genshinJson.width / 2, genshinJson.height / 2)
                        await info('[break]')
                        break;
                    }
                    index += 1
                }
            }

        }
    }

}


// const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}确认.jpg"), 0, 0, genshinJson.width, genshinJson.height);
/**
 * 确认
 * @returns {Promise<void>}
 */
async function confirm() {
    return await ocrClick(`${path_base_main}确认.jpg`, "点击确认", false)
}

/**
 * 清空选中的狗粮
 * @returns {Promise<void>}
 */
async function clear() {
    // 通过OCR识别并点击"详情"按钮
    await ocrClick(`${path_base_main}详情.jpg`, "点击详情", false)
    await wait(1)
    // 通过OCR识别并点击"强化"按钮
    await ocrClick(`${path_base_main}强化.jpg`, "点击强化", false)
}

/**
 * 操作方式处理函数
 * @param operate - 操作类型参数

 * @param log_off - 日志开关参数
 * @returns {Promise<string>} - 返回处理后的操作类型
 */
async function operateDispose(operate, enableInsertionMethod, log_off) {
    let ocr_name = '阶段放入'  // 默认使用"阶段放入"进行OCR识别
    //自动识别界面元素
    let ocr1 = await ocr(`${path_base_main}${ocr_name}.jpg`)
    // 如果默认元素不存在，则切换为"快捷放入"
    let exist = isExist(ocr1);
    if (!exist) {
        ocr_name = '快捷放入'
    }
    // 如果操作方式为"默认"或未指定，则进行自动识别
    if (operate === '默认' || (!operate)) {
        // 更新操作方式为识别到的名称
        operate = ocr_name
    } else if (config.enableInsertionMethod || enableInsertionMethod) {
        // 如果默认元素不存在，则切换为"快捷放入"
        if (exist) {
            return ocr_name
        }
        //和自动识别互斥  自启动 阶段放入||快捷放入
        await info(`${operate} 未打开`)
        let name = '设置按键'
        await ocrClick(`${path_base_main}${name}.jpg`, `点击${name}`, log_off)
        let name4 = `点击关闭`
        if (operate !== '快捷放入') {
            name4 = `点击开启`
        }
        await ocrClick(`${path_base_main}${name4}.jpg`, `${name4}`, log_off)
        let name5 = `关闭设置`
        await ocrClick(`${path_base_main}${name5}.jpg`, `${name5}`, log_off)
    }
    return operate
}

/**
 * 放入狗粮后
 * 判断狗粮是否充足
 */
async function judgeDogFoodFilling() {
    let err = null
    // 定义需要检查的资源名称为"需要摩拉"
    let up_name = '需要摩拉'
    // 计算OCR识别区域的宽度，为屏幕宽度的一半
    let width = parseInt(genshinJson.width + '');
    // 获取屏幕总高度作为OCR识别区域的高度
    let height = parseInt(genshinJson.height + '');
    // 执行OCR识别，检查指定区域是否存在"需要摩拉"的提示
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    await wait(300)
    await logInfoOcr(ocr)
    // 如果OCR识别结果不存在，则输出错误日志提示狗粮不足
    if (!isExist(ocr)) {
        err = '狗粮不足'
        // await error(`${err}`)
        throwError(err)
    }
    return err
}

/**
 * OCR识别圣遗物强化次数的异步函数
 * 该函数通过截图和OCR技术识别游戏中圣遗物的强化次数
 * @returns {Promise<{sumLevel: number, level: number}>} 返回识别到的强化次数，如果未识别到则返回0
 */
async function ocrHolyRelicsUpFrequency(log_off) {

    // 定义OCR识别的初始坐标和区域大小
    let ocr_x = parseInt(genshinJson.width / 2 + ''); // OCR识别区域的x坐标，设置为屏幕宽度的一半
    let ocr_y = 0; // OCR识别区域的y坐标，设置为0（屏幕顶部）
    let width = parseInt(genshinJson.width / 2 + ''); // OCR识别区域的宽度，设置为屏幕宽度的一半
    let height = parseInt(genshinJson.height + ''); // OCR识别区域的高度，设置为整个屏幕高度

    // 定义并执行第一次OCR识别，用于识别经验值图标
    let up_name = 'exp' // 识别对象名称为经验值图标
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, ocr_x, ocr_y, width, height) // 执行OCR识别
    if (!log_off) {
        await logInfoOcr(ocr) // 记录OCR识别结果
    }

    // 定义并执行第二次OCR识别，用于识别返回键
    let up_name1 = '返回键' // 识别对象名称为返回键
    let ocr1 = await ocrBase(`${path_base_main}${up_name1}.jpg`, ocr_x, ocr_y, width, height) // 执行OCR识别

    if (!log_off) {
        await logInfoOcr(ocr1) // 记录OCR识别结果
    }

    // 计算OCR识别的目标区域
    let x = Math.min(ocr1.x, ocr.x) // 目标区域的左上角x坐标
    let y = Math.min(ocr1.y, ocr.y) // 目标区域的左上角y坐标
    let w = parseInt(Math.abs(ocr1.x - ocr.x) / 2 + '') // 目标区域的宽度
    let h = Math.abs(ocr1.y - ocr.y) // 目标区域的高度

    // 截取游戏画面并进行OCR识别
    let captureRegion = captureGameRegion(); // 截取游戏画面
    const ocrObject = await recognitionObjectOcr(x, y, w, h); // 创建OCR识别对象
    let res = captureRegion.find(ocrObject); // 执行OCR识别

    if (!log_off) {
        await logInfoOcr(res) // 记录OCR识别结果
    }
    //
    // // 处理OCR识别结果
    // if (res.text.includes('+')) { // 如果识别结果中包含"+"符号
    //     let upCount = res.text.replace("+", "") // 移除"+"符号
    //     return parseInt(upCount) // 返回转换后的数字
    // }

    let levelJson = {
        "sumLevel": 0,//预估可提升至等级
        "level": 0//实际等级
    }
    if (res.text.includes('+')) {
        let str = "0" + res.text;
        let result = new Function(`return ${str}`)() + "";
        let sumLevel = parseInt(result)//计算等级
        await info(`圣遗物预估可提升至等级: ${sumLevel}`); // 20
        let level = res.text.replace("+", "").split("+")[0]//实际等级
        await info(`圣遗物实际等级: ${level}`)
        levelJson.sumLevel = sumLevel
        levelJson.level = level
    }
    return levelJson
}

/**
 * 单次点击强化功能
 * @param operate - 操作参数

 * @param log_off - 日志开关
 * @returns {Promise<{sumLevel: number, level: number, upOk: boolean, upErrorMsg: string}>} - 返回一个Promise对象，表示异步操作的完成
 */
async function oneUp(operate, log_off) {
    let upJson = {
        "sumLevel": 0,//预估可提升至等级
        "level": 0,//实际等级
        "upOk": false, // 是否强化成功的标志
        "upErrorMsg": '', // 强化失败的错误信息
    }
    let ocrHolyRelics = await ocrHolyRelicsUpFrequency(log_off);
    //点击operate按钮
    await ocrClick(`${path_base_main}${operate}.jpg`, `点击${operate}`, log_off)  // 调用OCR识别并点击指定按钮
    await wait(500)  // 等待500毫秒，确保界面响应
    // let errorMsg = await judgeDogFoodFilling();  // 判断狗粮是否充足
    // if (errorMsg) {
    //     upJson.upErrorMsg = errorMsg
    //     return upJson
    // }
    await confirm();  // 确认操作
    await mTo(0, 0)
    // 定义错误信息为"摩拉不足"
    let err = '摩拉不足'
    // 检查强化是否成功
    let upOk = await ocrClick(`${path_base_main}${err}.jpg`, `确认强化是否成功`, log_off)
    // 如果识别到错误信息
    if (isExist(upOk)) {
        // await info(`${upOk.text}`)
        // await info(`识别结果: ${upOk.text}, 原始坐标: x=${upOk.x}, y=${upOk.y}`);
        error(`${err}!`);  // 输出错误信息
        upJson.upErrorMsg = err;  // 设置强化失败的错误信息
        throwError(err)
    } else {
        upJson.upOk = true;  // 设置强化成功的标志
    }
    let levelJson = await ocrHolyRelicsUpFrequency(log_off);
    if (ocrHolyRelics.level === levelJson.level) {
        upJson.upErrorMsg = '强化失败:狗粮不足'
        upJson.upOk = false;
        throwError(upJson.upErrorMsg)
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
async function oneClickUp(operate, log_off) {
    let reJson = {
        "sumLevel": 0,//预估可提升至等级
        "level": 0,//实际等级
        "errorMsg": null, // 失败的错误信息
    }
    // 调用operateDispose函数处理操作参数，处理后的结果重新赋值给operate变量
    operate = await operateDispose(operate, false, log_off)
    // info('ocrHolyRelicsUpFrequency')
    // 通过OCR识别当前圣遗物的等级信息
    let ocrHolyRelics = await ocrHolyRelicsUpFrequency(log_off);
    // 输出当前圣遗物等级的日志信息
    await info(`当前圣遗物等级: ${ocrHolyRelics.level}`)
    // 检查圣遗物是否已达到满级（20级）
    if (ocrHolyRelics.level === 20) {
        // 记录圣遗物已满级的日志信息
        let msg1 = `圣遗物已经满级`;
        await info(msg1)
        reJson.errorMsg = msg1
        // 检查是否启用了批量强化功能
        if (config.enableBatchUp) {
            //批量强化已开启，执行满级退出强化页面的操作
            //满级退出强化页面 到圣遗物背包界面
            await wait(10)
            let up_name = '返回键'
            await ocrClick(`${path_base_main}${up_name}.jpg`, `满级退出强化页面 到圣遗物背包界面`, log_off)
        }
        return reJson
    }
    // let sumLevel = ocrHolyRelics.sumLevel;

    await wait(500)  // 等待500毫秒，确保界面响应
    let upMax = config.upMax
    // if (sumLevel != 4 && sumLevel != 8 && sumLevel != 16 && sumLevel >= upMax) {
    //     let msg = `圣遗物预估可提升至等级: ${sumLevel} >= ${upMax}，已达到达到下一阶段等级，退出强化`;
    //     await info(msg)
    //     reJson.errorMsg = msg
    //     throwError(msg)
    //     return reJson
    // }
    let count = 1
    if (upMax < 20) {
        count = upMax / 4;
        //强制使用阶段放入
        operate = '阶段放入'
        operate = await operateDispose(operate, true, log_off)
    }

    for (let i = 0; i < count; i++) {
        await wait(300)
        // 调用oneUp函数执行实际的强化操作，传入处理后的operate参数和日志控制参数
        let up = await oneUp(operate, log_off)
        if (!up.upOk) {
            // 如果强化失败，记录错误信息
            throw new Error(`${up.upErrorMsg}`);
            throwError(up.upErrorMsg)
        } else {
            await info(`强化成功`)
            if (up.sumLevel % 4 != 0) {
                let msg2 = `圣遗物预估可提升至等级: ${up.sumLevel}，未达到下一阶段等级，退出强化`;
                await info(msg2)
                reJson.errorMsg = msg2
                throwError(msg2)
                break
            }
        }
    }
    return reJson
}

/**
 * 批量强化函数
 * @param operate - 操作参数对象
 * @param log_off - 是否注销标志
 * @returns {Promise<void>} - 返回一个空Promise，表示异步操作完成
 */
async function bathClickUp(operate, log_off) {
    let ms = 300
    let index = 0
    let upMaxCount = null
    if (config.upMaxCount) {
        upMaxCount = parseInt(config.upMaxCount + '')
        if (upMaxCount <= 0) {
            throwError(`圣遗物强化个数 必须大于0`)
        }
    }
    while (true) {
        if (upMaxCount !== null && index === upMaxCount) {
            info(`${upMaxCount}个圣遗物已经强化到+${config.upMax}终止运行`)
            await toMainUi()
            await wait(ms)
            break
        }
        //强制拉到顶
        await clickProgressBarTopByHolyRelics()
        // 调用点击第一个圣物遗物的函数，并等待其完成
        await downClickFirstHolyRelics()
        await wait(ms);
        //打开强化界面
        await openAggrandizement()
        await wait(ms)  // 等待500毫秒，确保界面响应
        let re = await oneClickUp(operate, log_off);
        if (!re.errorMsg) {
            // 如果强化成功，则继续下一个圣遗物
            await info(`强化成功`)
            await wait(ms)
            let up_name = '返回键'
            await ocrClick(`${path_base_main}${up_name}.jpg`, `圣遗物已经强化到+${config.upMax}退出强化页面 到圣遗物背包界面`, log_off)
            //返回圣遗物背包
        } else {
            // 如果强化失败，则退出循环
            await info(`强化失败`)
            break
        }
        info(`圣遗物强化+${config.upMax} 数量：${index}`)
        index += 1
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
    let captureRegion = captureGameRegion();
    // 创建OCR识别对象，使用传入的OCR区域参数
    const ocrObject = await recognitionObjectOcr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
    // ocrObject.threshold = 1.0; // 可选：设置OCR识别的阈值，当前已被注释掉
    // 在捕获的区域中查找多个匹配项
    let resList = captureRegion.findMulti(ocrObject);
    // 遍历所有识别结果
    for (let res of resList) {
        // await info(`res:${res}`) // 可选：日志输出完整识别结果，当前已被注释掉
        // await info(`识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`); // 可选：日志输出识别文本和坐标，当前已被注释掉
        // 记录OCR识别信息的详细日志
        await logInfoOcr(res)
        //todo: 暂时只处理识别结果为"圣遗物"的项 已弃用
    }
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

/**
 * 主方法
 * @returns {Promise<void>}
 */
async function main(log_off) {
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

        await bathClickUp(config.insertionMethod, log_off)
    } else {
        throwError(`未启用批量强化请去浏览文档后开启！`)
    }

    ////选择升级素材 //禁用 存在异常
    // await openSelectTheClipCondition('1星素材');
    ////强化
    // await oneClickUp('快捷放入',null);
    //todo: 待实现的功能
}

(async function () {

    //重置
    // await resetSift();
    // await main(false)
    await main(true)
    // await judgeDogFoodFilling()
    // await bathClickUp(config.insertionMethod, false)
})();


//以下方法 均为测试



