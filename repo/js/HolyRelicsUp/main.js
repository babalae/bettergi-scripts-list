const path_base_main = 'assets/main/'

function info(msg) {
    log.info(msg)
}

function debug(msg) {
    log.debug(msg)
}

function error(msg) {
    log.error(msg)
}

async function mTo(x, y) {
    await moveMouseTo(x, y);
}

function recognitionObjectOcr(x, y, width, height) {
    return RecognitionObject.Ocr(x, y, width, height)
}

//==============================================================
async function logInfoOcrBase(res, log_off) {
    if (!log_off) {
        info(`识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`);
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
    leftButtonDown();
    // 等待300毫秒，确保按下操作生效
    await sleep(300);
    // 循环移动鼠标，实现拖动效果
    for (let i = 0; i < h; ++i) {
        moveMouseBy(x, y);
        await sleep(1);
    }
    await sleep(30);
    // 释放鼠标左键，结束拖动
    leftButtonUp();
    await sleep(300);
    // 如果log_off为false，则输出拖动完成日志
    if (!log_off) {
        info(`拖动完成，步数: ${h},x:${x},y:${y}`);
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
    let h = parseInt(300 * genshin.height / 1080 + '')
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
    let ocrButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path}`), x, y, width, height);
    // 捕获游戏区域并查找匹配的识别对象
    let button = captureGameRegion().find(ocrButtonRo);
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
    // - genshin.width: 识别区域的宽度，使用全局变量genshin的宽度值
    // - genshin.height: 识别区域的高度，使用全局变量genshin的高度值
    return await ocrBase(`${path}`, 0, 0, genshin.width, genshin.height)
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
    if (button.isExist()) {
        // 如果未关闭日志记录功能
        if (!log_off) {
            // 记录操作日志信息
            info(`${log_msg}`)
            // 记录OCR识别到的按钮详细信息
            await logInfoOcr(button)
        }
        // 点击按钮元素
        await button.click();
        // 暂停500毫秒，等待操作完成
        await sleep(500);
    }
    // 返回按钮对象
    return button
}


/**
 * 打开背包
 * @returns {Promise<void>}
 */
async function openKnapsack() {
    // // 定义识别对象
    // const knapsackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path_base_main}背包.jpg`), 0, 0,genshin.width / 3.0 , genshin.width / 5.0);
    // // 通过截取游戏区域并查找背包图标来判断背包是否已打开
    // let knapsack = captureGameRegion().find(knapsackRo);
    let ocrJson = {
        "text": "背包",
        "x": 0,
        "y": 0,
        "width": genshin.width / 3.0,
        "height": genshin.width / 5.0
    }
    let knapsack = await ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
    // 如果背包不存在（即背包未打开）
    if (!knapsack.isExist()) {
        // 设置默认的背包快捷键为'B'
        let knapsackKey = 'B'
        // 如果设置中配置了自定义的背包快捷键，则使用自定义快捷键
        if (settings.knapsackKey) {
            knapsackKey = settings.knapsackKey;
        }
        // 记录日志，显示尝试按下的快捷键
        info(`尝试按下${knapsackKey}键打开背包`)
        // 打开背包
        await keyPress(knapsackKey);
        await sleep(500);
    }
}


/**
 * 打开圣遗物背包
 * @returns {Promise<void>}
 */
async function openHolyRelicsKnapsack() {
    // const holyRelicsKnapsackRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}圣遗物.jpg"), 0, 0, genshin.width / 2.0, genshin.width / 5.0);
    // // 通过捕获游戏区域并查找圣遗物背包图标元素
    // let holyRelicsKnapsack = captureGameRegion().find(holyRelicsKnapsackRo);
    let ocrJson = {
        "text": "圣遗物",
        "x": 0,
        "y": 0,
        "width": genshin.width / 2.0,
        "height": genshin.width / 5.0
    }
    let holyRelicsKnapsack = await ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
    // 检查圣遗物背包图标是否存在
    if (holyRelicsKnapsack.isExist()) {
        // 打开圣遗物背包
        info('打开圣遗物背包');  // 记录日志信息
        await holyRelicsKnapsack.click();  // 点击圣遗物背包图标
        await sleep(500);  // 等待500毫秒确保界面加载完成
    }
}


/**
 * 重置筛选功能

 * 该函数用于在游戏界面中重置当前的筛选条件
 * 首先检查是否存在筛选按钮，如果存在则点击打开筛选面板
 * 然后检查是否存在重置按钮，如果存在则点击进行重置操作
 * 每次操作后都有短暂的延迟以确保界面响应
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 */
async function resetSift() {
    // const siftRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}筛选.jpg"), 0, 0, genshin.width / 3.0, genshin.height);
    // 查找筛选按钮元素
    // let sift = captureGameRegion().find(siftRo);
    let ocrSiftJson = {
        "text": "筛选",
        "x": 0,
        "y": 0,
        "width": genshin.width / 3.0,
        "height": genshin.height
    }
    // 查找筛选按钮元素
    let sift = await ocrBase(`${path_base_main}${ocrSiftJson.text}.jpg`, ocrSiftJson.x, ocrSiftJson.y, ocrSiftJson.width, ocrSiftJson.height)
    await sleep(500);
    // 判断筛选按钮是否存在
    if (sift.isExist()) {
        info('打开筛选'); // 记录日志：打开筛选
        await sift.click(); // 点击筛选按钮
        await sleep(500); // 等待500毫秒

        // const resetRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}重置.jpg"), 0, 0, genshin.width / 3.0, genshin.height);
        // // 查找重置按钮元素
        // let reset = captureGameRegion().find(resetRo);
        let ocrResetJson = {
            "text": "重置",
            "x": 0,
            "y": 0,
            "width": genshin.width / 3.0,
            "height": genshin.height
        }
        // 查找重置按钮元素
        let reset = await ocrBase(`${path_base_main}${ocrResetJson.text}.jpg`, ocrResetJson.x, ocrResetJson.y, ocrResetJson.width, ocrResetJson.height)
        await sleep(500);
        // 判断重置按钮是否存在
        if (reset.isExist()) {
            info('重置'); // 记录日志：重置
            await reset.click(); // 点击重置按钮
            await sleep(500); // 等待500毫秒
        }
    }
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
        "width": genshin.width / 3.0,  // 按钮的宽度为屏幕宽度的1/3
        "height": genshin.height      // 按钮的高度为整个屏幕高度
    }
    // 查找筛选按钮元素
    let siftSuit = await ocrBase(`${path_base_main}${siftSuitJson.text}.jpg`, siftSuitJson.x, siftSuitJson.y, siftSuitJson.width, siftSuitJson.height)
    // 判断筛选按钮是否存在
    if (sift.isExist()) {
        info('筛选圣遗物套装'); // 记录日志：筛选圣遗物套装
        await siftSuit.click(); // 点击筛选按钮
        await sleep(500); // 等待500毫秒
        //todo: 筛选套装 这版不做 预留
    }
}

/**
 * 筛选圣遗物状态<核心:未满级>
 * @param log_off
 * @returns {Promise<void>}
 */
async function siftState(log_off) {
    let siftJson = {
        "text": "筛选未满级",    // 按钮显示的文本内容
        "x": 0,                    // 按钮的x坐标
        "y": 0,                    // 按钮的y坐标
        "width": genshin.width / 3.0,  // 按钮的宽度为屏幕宽度的1/3
        "height": genshin.height      // 按钮的高度为整个屏幕高度
    }
    let siftState = await ocrBase(`${path_base_main}${siftJson.text}.jpg`, siftJson.x, siftJson.y, siftJson.width, siftJson.height)
    await sleep(300)
    if (siftState.isExist()) {
        await logInfoOcrBase(siftState, false)
        await mTo(siftState.x, siftState.y)
        // siftState.click()
        if (!log_off) {
            info(`筛选圣遗物状态 核心:未满级`)
        }
        return
    }
    info(`已${siftJson.text}`)
}

/**
 * 筛选圣遗物 所有选项
 * @param log_off - 是否记录日志的开关参数
 * @returns {Promise<void>} - 返回一个空Promise，表示异步操作的完成
 */
async function siftAll(log_off) {
    // 调用重置筛选函数，恢复筛选条件到初始状态
    await resetSift()
    await sleep(1)
    await siftState(log_off)
    await sleep(1)
    // todo: 可扩展
}

/**
 * 打开排序
 * @param log_off
 * @returns {Promise<void>}
 */
async function openSort(log_off) {
    let up_name = '排序'
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = parseInt(genshin.width / 3.0 + '');
    // 获取屏幕高度
    let height = parseInt(genshin.height / 3.0 + '');
    let x = width
    let y = height * 2
    // 使用OCR识别指定区域的图像
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, x, y, width, height)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (ocr.isExist()) {
        await logInfoOcr(ocr, log_off)
        ocr.click()
    }
    return ocr
}

/**
 * 切换升序排列的函数
 * 该函数通过OCR识别和点击操作来切换或确认升序排列状态
 */
async function openUpSort() {
    // 定义未选中状态下的升序按钮名称
    let up_name = '未选中升序1'
    // 计算按钮宽度为屏幕宽度的三分之一
    let width = parseInt(genshin.width / 3.0 + '');
    // 获取屏幕高度
    let height = parseInt(genshin.height + '');
    // 使用OCR识别指定区域的图像
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    // 检查OCR识别结果是否存在（即升序按钮是否可见）
    if (ocr.isExist()) {
        // 更新按钮名称为选中状态
        up_name = '升序'
        // 点击升序按钮
        ocr.click()
        // 记录切换成功的日志信息
        info(`切换为${up_name}`)
    } else {
        // 如果按钮不存在，说明已处于升序状态，记录相应日志
        info(`已处于升序`)
    }

}

/**
 * 打开排序并选择所有
 * @param log_off - 日志关闭标志，用于控制是否在操作过程中记录日志
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 * 该函数用于执行打开排序并选择所有项目的操作
 */
async function openSortAll(log_off) {
    // 首先调用openSort函数，传入log_off参数
    await openSort(log_off)
    // 然后调用openUpSort函数，完成排序操作
    await openUpSort()
    // todo: 可扩展
}

/**
 * 打开所有先决条件的异步函数
 * @param {boolean} log_off - 用于控制是否记录关闭操作的标志位
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 * 当Promise完成时，表示所有先决条件已成功打开
 */
async function openPrerequisitesAll(log_off) {
    // 首先执行 siftAll 函数，传入 log_off 参数
    await siftAll(log_off)
    // 然后执行 openSortAll 函数，同样传入 log_off 参数
    // 使用 await 确保两个函数按顺序执行
    await openSortAll(log_off)
}

/**
 * 打开强化界面的函数
 *
 * 该函数会查找游戏中的强化按钮，如果存在则点击它
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 */
async function openAggrandizement() {
    // 注释掉的代码：使用模板匹配方法查找强化按钮
    // const aggrandizementRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}强化.jpg"), 0, 0, genshin.width / 3.0, genshin.height);
    // // 捕获游戏区域并查找强化按钮
    // let aggrandizement = captureGameRegion().find(aggrandizementRo);
    // 定义OCR识别的JSON对象，包含文本和位置信息
    let ocrJson = {
        "text": "强化",    // 要识别的文本内容
        "x": 0,           // 识别区域的左上角x坐标
        "y": 0,           // 识别区域的左上角y坐标
        "width": genshin.width / 3.0,    // 识别区域的宽度
        "height": genshin.height / 5.0  // 识别区域的高度
    }
    // 使用OCR方法查找强化按钮
    let aggrandizement = await ocrBase(`${path_base_main}${ocrJson.text}.jpg`, ocrJson.x, ocrJson.y, ocrJson.width, ocrJson.height)
    // 检查强化按钮是否存在
    if (aggrandizement.isExist()) {
        // 输出日志信息，表示正在打开强化界面
        info('打开强化');
        // 点击强化按钮
        await aggrandizement.click();
        // 等待500毫秒以确保界面完全打开
        await sleep(500);
    }
}


/**
 * 打开选择素材条件
 * 该函数用于打开游戏中的素材选择界面，并根据传入的条件自动选择对应的素材
 * @param {string} condition - 需要选择的素材条件文本
 * @returns {Promise<void>} 异步函数，无返回值
 */
async function openSelectTheClipCondition(condition) {
    // 检查是否传入了有效的素材条件
    if (!condition) {
        info(`未传入素材条件 使用默认条件`)
        return
    }
    const selectTheClipConditionButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path_base_main}选择素材条件按键.jpg`), 0, 0, genshin.width, genshin.height);

    // 捕获游戏界面并查找"选择素材条件"按钮
    let buttonObject = captureGameRegion().find(selectTheClipConditionButtonRo);
    // 检查按钮是否存在
    if (buttonObject.isExist()) {
        info('打开选择素材条件')
        // 点击按钮并等待界面加载
        await buttonObject.click();
        await sleep(500);

        info(`素材条件==>x:${buttonObject.x},y:${buttonObject.y}`)

        const needMoLaRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`${path_base_main}需要摩拉.jpg`), 0, 0, genshin.width, genshin.height);
        // 捕获界面并查找"需要摩拉"文本区域
        let needMoLa = captureGameRegion().find(needMoLaRo);

        // 检查是否能定位到"需要摩拉"文本区域
        if (!needMoLa.isExist()) {
            error(`无法定位识别！`)
            return
        }
        // 以下代码被注释，可能是用于调试的坐标计算
        // needMoLa.x
        // needMoLa.y
        // let ocr_x = parseInt(1200 * genshin.width / 1920 + '')
        // let ocr_y = parseInt(760 * genshin.height / 1080 + '')
        // let ocr_width = parseInt(400 * genshin.width / 1920 + '')
        // let ocr_height = parseInt(300 * genshin.height / 1080 + '')
        // info(`需要摩拉==>x:${needMoLa.x},y:${needMoLa.y}`)
        // 计算OCR识别区域的坐标和尺寸
        let ocr_x = Math.min(needMoLa.x, buttonObject.x)
        let ocr_y = Math.min(needMoLa.y, buttonObject.y)
        let ocr_width = Math.abs(needMoLa.x - buttonObject.x)
        let ocr_height = Math.abs(needMoLa.y - buttonObject.y)
        info(`OCR==>x:${ocr_x},y:${ocr_y},width:${ocr_width},height:${ocr_height}`)
        // 以下代码被注释，可能是用于调试的鼠标移动
        // await mTo(ocr_x, ocr_y)
        // 创建OCR识别对象
        const ocrObject = recognitionObjectOcr(ocr_x, ocr_y, ocr_width, ocr_height);
        // 捕获游戏界面并执行OCR识别
        let captureRegion = captureGameRegion();
        let resList = captureRegion.findMulti(ocrObject);
        let index = 0;
        // 遍历OCR识别结果
        for (let res of resList) {
            info(`识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`);
            // 跳过第一个结果（可能是标题），查找匹配条件的选项
            if (index !== 0 && res.text.includes(condition)) {
                info(`点击${res.text}`)
                await res.click();
                await sleep(500);
                break;
            }
            index += 1
        }
    }
}


// const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("${path_base_main}确认.jpg"), 0, 0, genshin.width, genshin.height);
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
    await sleep(1)
    // 通过OCR识别并点击"强化"按钮
    await ocrClick(`${path_base_main}强化.jpg`, "点击强化", false)
}

/**
 * 操作方式处理
 * @param operate - 操作类型参数

 * @param log_off - 日志开关参数
 * @returns {Promise<string>} - 返回处理后的操作类型
 */
async function operateDispose(operate, log_off) {
    // 如果操作方式为"默认"或未指定，则进行自动识别
    if (operate === '默认' || (!operate)) {
        let ocr_name = '阶段放入'  // 默认使用"阶段放入"进行OCR识别
        //自动识别界面元素
        let ocr1 = await ocr(`${path_base_main}${ocr_name}.jpg`)
        // 如果默认元素不存在，则切换为"快捷放入"
        if (!ocr1.isExist()) {
            ocr_name = '快捷放入'
        }
        // 更新操作方式为识别到的名称
        operate = ocr_name

    } else if (settings.enableInsertionMethod) {
        //和自动识别互斥  自启动 阶段放入||快捷放入
        info(`${operate} 未打开`)
        let name = '设置按键'
        await ocrClick(`${path_base_main}${name}.jpg`, `点击${name}`, log_off)
        // let name1 = `设置内容右上角`
        // let re1 = await ocrClick(`${path_base_main}${name1}.jpg`, `识别${name1}坐标`, log_off)
        // let name2 = `设置内容左上角`
        // let re2 = await ocrClick(`${path_base_main}${name2}.jpg`, `识别${name2}坐标`, log_off)
        //
        // let name3 = `开启阶段放入功能`
        // let re3 = await ocrClick(`${path_base_main}${name3}.jpg`, `识别${name3}坐标`, log_off)
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
    let width = parseInt(genshin.width / 2 + '');
    // 获取屏幕总高度作为OCR识别区域的高度
    let height = parseInt(genshin.height + '');
    // 执行OCR识别，检查指定区域是否存在"需要摩拉"的提示
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, parseInt(genshin.width / 2 + ''), 0, width, height)
    // 如果OCR识别结果不存在，则输出错误日志提示狗粮不足
    if (!ocr.isExist()) {
        err = '狗粮不足'
        error(`${err}`)
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
    let ocr_x = parseInt(genshin.width / 2 + ''); // OCR识别区域的x坐标，设置为屏幕宽度的一半
    let ocr_y = 0; // OCR识别区域的y坐标，设置为0（屏幕顶部）
    let width = parseInt(genshin.width / 2 + ''); // OCR识别区域的宽度，设置为屏幕宽度的一半
    let height = parseInt(genshin.height + ''); // OCR识别区域的高度，设置为整个屏幕高度

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
    const ocrObject = recognitionObjectOcr(x, y, w, h); // 创建OCR识别对象
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
        info(`圣遗物预估可提升至等级: ${sumLevel}`); // 20
        let level = res.text.replace("+", "").split("+")[0]//实际等级
        info(`圣遗物实际等级: ${level}`)
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
    //点击operate按钮
    await ocrClick(`${path_base_main}${operate}.jpg`, `点击${operate}`, log_off)  // 调用OCR识别并点击指定按钮
    await sleep(500)  // 等待500毫秒，确保界面响应
    let error = await judgeDogFoodFilling();  // 判断狗粮是否充足
    if (error) {
        upJson.upErrorMsg = error
        return upJson
    }
    await confirm();  // 确认操作
    // 定义错误信息为"摩拉不足"
    let err = '摩拉不足'
    // 检查强化是否成功
    let upOk = await ocrClick(`${path_base_main}${err}.jpg`, `确认强化是否成功`, log_off)
    // 如果识别到错误信息
    if (upOk) {
        // info(`${upOk.text}`)
        // info(`识别结果: ${upOk.text}, 原始坐标: x=${upOk.x}, y=${upOk.y}`);
        error(`${err}!`);  // 输出错误信息
        upJson.upErrorMsg = err;  // 设置强化失败的错误信息
    } else {
        upJson.upOk = true;  // 设置强化成功的标志
    }
    let levelJson = await ocrHolyRelicsUpFrequency(log_off);
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
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成，无返回值
 */
async function oneClickUp(operate, log_off) {
    // 调用operateDispose函数处理操作参数，处理后的结果重新赋值给operate变量
    operate = await operateDispose(operate, log_off)
    // 通过OCR识别当前圣遗物的等级信息
    let ocrHolyRelics = await ocrHolyRelicsUpFrequency(log_off);
    // 输出当前圣遗物等级的日志信息
    info(`当前圣遗物等级: ${ocrHolyRelics.level}`)
    // 检查圣遗物是否已达到满级（20级）
    if (ocrHolyRelics.level === 20) {
        // 记录圣遗物已满级的日志信息
        info(`圣遗物已经满级`)
        // 检查是否启用了批量强化功能
        if (settings.enableBatchUp) {
            //批量强化已开启，执行满级退出强化页面的操作
            //满级退出强化页面 到圣遗物背包界面
            let up_name = '返回键'
            await ocrClick(`${path_base_main}${up_name}.jpg`, `满级退出强化页面 到圣遗物背包界面`, log_off)
        }
        return
    }
    // 调用oneUp函数执行实际的强化操作，传入处理后的operate参数和日志控制参数
    let up = await oneUp(operate, log_off)
    if (!up.upOk) {
        // 如果强化失败，记录错误信息
        throw new Error(`${up.upErrorMsg}`);
    }
}

/**
 * 批量强化函数
 * @param operate - 操作参数对象
 * @param log_off - 是否注销标志
 * @returns {Promise<void>} - 返回一个空Promise，表示异步操作完成
 */
async function bathClickUp(operate, log_off) {
    // 对操作参数进行处理，等待处理完成
    operate = await operateDispose(operate, log_off)
    // 以下代码被注释，可能是暂时禁用或待实现的功能
    // await oneUp(operate,log_off)
}


/**
 * 识别圣遗物背包区域
 * @param ocrRegion - OCR识别区域的参数对象，包含x坐标、y坐标、宽度和高度
 * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
 */
async function bathOcrRegionHolyRelics(ocrRegion) {
    // 捕获游戏区域图像
    let captureRegion = captureGameRegion();
    // 创建OCR识别对象，使用传入的OCR区域参数
    const ocrObject = recognitionObjectOcr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
    // ocrObject.threshold = 1.0; // 可选：设置OCR识别的阈值，当前已被注释掉
    // 在捕获的区域中查找多个匹配项
    let resList = captureRegion.findMulti(ocrObject);
    // 遍历所有识别结果
    for (let res of resList) {
        // info(`res:${res}`) // 可选：日志输出完整识别结果，当前已被注释掉
        // info(`识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`); // 可选：日志输出识别文本和坐标，当前已被注释掉
        // 记录OCR识别信息的详细日志
        await logInfoOcr(res)
        //todo: 暂时只处理识别结果为"圣遗物"的项
    }
}


/**
 * 主方法
 * @returns {Promise<void>}
 */
async function main(log_off) {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    if (!settings.enableOneUp) { // 检查是否启用自动登录功能
        genshin.returnMainUi(); // 如果未启用，则返回游戏主界面
    }
    //打开背包
    await openKnapsack();
    //打开圣遗物背包
    await openHolyRelicsKnapsack();
    //排序
    await siftAll(log_off);
    //打开强化界面
    await openAggrandizement();
    ////选择升级素材
    // await openSelectTheClipCondition('1星素材');
    ////强化
    // await oneClickUp('快捷放入',null);
    //todo: 待实现的功能
}


(async function () {
    //重置
    // await resetSift();

    ////测试
    // await test5()
    // await test6()
    await test7()
})();


//以下方法 均为测试
async function test7() {
    await siftState(false)
}

async function test6() {
    error("error")
    let up_name = 'exp'
    let width = parseInt(genshin.width / 2 + '');
    let height = parseInt(genshin.height + '');
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, parseInt(genshin.width / 2 + ''), 0, width, height)
    await logInfoOcr(ocr)
    await sleep(10)
    // ocr.click()
    await mTo(ocr.x, ocr.y);
    await sleep(10)
    let up_name1 = '返回键'
    let ocr1 = await ocrBase(`${path_base_main}${up_name1}.jpg`, parseInt(genshin.width / 2 + ''), 0, width, height)
    await logInfoOcr(ocr1)
    // ocr1.click()
    info(`${up_name1}`)
    // await mTo(ocr1.x, ocr1.y);
    let x = Math.min(ocr1.x, ocr.x)
    let y = Math.min(ocr1.y, ocr.y)
    let w = parseInt(Math.abs(ocr1.x - ocr.x) / 2 + '')
    let h = Math.abs(ocr1.y - ocr.y)

    let captureRegion = captureGameRegion();
    const ocrObject = recognitionObjectOcr(x, y, w, h);
    // ocrObject.threshold = 1.0;
    let res = captureRegion.find(ocrObject);
    await logInfoOcr(res)
    // parseInt()
    let levelJson = null
    if (res.text.includes('+')) {
        let str = "0" + res.text;
        let result = new Function(`return ${str}`)() + "";
        let sumLevel = parseInt(result)//计算等级
        info(`圣遗物预估可提升至等级: ${sumLevel}`); // 20
        // info(`bool:${result === 20}`); // 20

        let level = res.text.replace("+", "").split("+")[0]//实际等级
        info(`圣遗物实际等级: ${level}`)

        levelJson = {
            "sumLevel": sumLevel,//预估可提升至等级
            "level": level//实际等级
        }
    }
    return levelJson
}

async function test5() {
    let x = parseInt(genshin.width / 2 + '');
    let y = parseInt(genshin.height / 2 + '');
    await mTo(x, y);
    let h = parseInt(300 * genshin.height / 1080 + '')
    for (let i = 0; i < 4; i++) {
        await dragBase(0, -1, h, false)
    }
}

async function test4() {
    let x = parseInt(genshin.width / 2 + '');
    let y = parseInt(genshin.height / 2 + '');
    await mTo(x, y);
    await dragBase(0, -1, 300, false)
}

async function test3() {
    let up_name = '进度条底部'
    let width = parseInt(genshin.width / 2 + '');
    let height = parseInt(genshin.height + '');
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, parseInt(genshin.width / 2 + ''), 0, width, height)
    await logInfoOcr(ocr)
    await mTo(ocr.x, ocr.y);
    //300 一格 圣遗物
    await drag(0, -300, 1)
}

async function test2() {
    let up_name = '需要摩拉'
    let width = parseInt(genshin.width / 2 + '');
    let height = parseInt(genshin.height + '');
    let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, parseInt(genshin.width / 2 + ''), 0, width, height)
    if (!ocr.isExist()) {
        error(`狗粮不足`)
    }
}


async function test1() {
    let up_name = '选中升序'
    let width = parseInt(genshin.width / 3.0 + '');
    let height = parseInt(genshin.height + '');
    // let ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    // if (ocr.isExist()) {
    //     logInfoOcr(ocr)
    //     await mTo(ocr.x, ocr.y);
    //     info(`${up_name}`);
    // }
    up_name = '未选中升序1'
    ocr = await ocrBase(`${path_base_main}${up_name}.jpg`, 0, 0, width, height)
    // info(`${up_name}`);
    if (ocr.isExist()) {
        logInfoOcr(ocr)
        info(`降序`)
        up_name = '升序'
        // await ocrClick(`${path_base_main}${up_name}.jpg`, `${up_name}`, null)
        ocr.click()
        info(`切换为${up_name}`)
    } else {
        info(`已处于升序`)
    }

}


/**
 * 测试函数，用于执行OCR识别和鼠标移动操作
 * 该函数会识别两个按钮的位置，并执行一系列鼠标操作
 */
async function test() {
    // 定义删除按钮的名称和执行OCR识别
    let del_name = '删除键'
    let del = await ocr(`${path_base_main}${del_name}.jpg`)
    // 定义包裹按钮的名称和执行OCR识别
    let open_name = '包裹'
    let open = await ocr(`${path_base_main}${open_name}.jpg`)

    // 检查两个按钮是否都存在
    if (del.isExist() && open.isExist()) {
        // 记录删除按钮的识别结果和坐标信息
        info(`识别结果: ${del.text}, 原始坐标: x=${del.x}, y=${del.y}`);
        // 移动鼠标到删除按钮位置
        await mTo(del.x, del.y);
        // 等待5秒
        await sleep(5000);
        // 记录包裹按钮的识别结果和坐标信息
        info(`识别结果: ${open.text}, 原始坐标: x=${open.x}, y=${open.y}`);
        // 移动鼠标到包裹按钮位置
        await mTo(open.x, open.y);
        // 等待5秒
        await sleep(5000);
        // 移动鼠标到删除按钮的x坐标和包裹按钮的y坐标的交点
        await mTo(del.x, open.y);
        // 记录该位置的坐标信息
        info(`原始坐标: x=${del.x}, y=${open.y}`);


        // 计算OCR区域的左上角坐标和宽高
        let ocr_x = Math.min(del.x, open.x)  // 取较小的x坐标作为左边界
        let ocr_y = Math.min(del.y, open.y)  // 取较小的y坐标作为上边界
        let ocr_width = Math.abs(del.x - open.x)  // 计算宽度
        let ocr_height = Math.abs(del.y - open.y)  // 计算高度

        // 创建OCR区域对象
        let ocrRegion = {
            "x": ocr_x,        // 区域左上角x坐标
            "y": ocr_y,        // 区域左上角y坐标
            "width": ocr_width, // 区域宽度
            "height": ocr_height // 区域高度
        }
        // 对指定区域执行圣物OCR识别
        await bathOcrRegionHolyRelics(ocrRegion)
        // 记录OCR区域的详细信息
        info(`ocrRegion:{ x:${ocrRegion.x},y:${ocrRegion.y},width:${ocrRegion.width},height:${ocrRegion.height} }`)

    }
}


