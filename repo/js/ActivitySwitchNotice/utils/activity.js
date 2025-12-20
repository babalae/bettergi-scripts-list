const config = {
    activityNameList: (settings.activityNameList ? settings.activityNameList.splice('|') : []),
    activityKey: (settings.activityKey ? settings.activityKey : 'F5'),
    toTopCount: (settings.toTopCount ? parseInt('' + settings.toTopCount) : 10),//滑动到顶最大尝试次数
    scrollPageCount: (settings.scrollPageCount ? parseInt('' + settings.scrollPageCount) : 4),//滑动次数/页
}
const ocrRegionConfig = {
    activity: {x: 197, y: 220, width: 292, height: 701},//活动识别区域坐标和尺寸
    remainingTime: {x: 497, y: 202, width: 1417, height: 670},//剩余时间识别区域坐标和尺寸
}
const xyConfig = {
    top: {x: 344, y: 273},
    bottom: {x: 342, y: 791},
}

const genshinJson = {
    width: 1920,//genshin.width,
    height: 1080,//genshin.height,
}

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
    await sleep(ms);
    leftButtonDown();  // 按下左键
    await sleep(ms);
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
        moveMouseBy(0, -moveDistance);
        // 取消注释后会在每一步后等待
        // await sleep(delayMs);
        // 每隔waitCount步等待一次
        if (j % waitCount === 0) {
            await sleep(delayMs);
        }
    }
    // 滚动完成后释放左键
    await sleep(ms);
    leftButtonUp();
    await sleep(ms);
}

/**
 * 根据活动状态进行页面滚动
 * @param {boolean} isUp - 是否向上滚动，默认为false
 */
async function scrollPagesByActivity(isUp = false) {
    let x = isUp ? xyConfig.top.x : xyConfig.bottom.x
    let y = isUp ? xyConfig.top.y : xyConfig.bottom.y
    log.info(`${isUp ? '向上' : '向下'}滑动`)
    // log.info(`坐标:${x},${y}`)
    for (let i = 0; i < config.scrollPageCount; i++) {
        // 移动到坐标位置
        await moveMouseTo(x, y)
        //80 18次滑动偏移量  46次测试未发现偏移
        await scrollPage(90, isUp, 6, 30)
    }
}

/**
 * 通过滚动页面直到到达顶部位置
 * 该函数会持续滚动页面，直到检测到页面顶部的标识不再变化为止
 * @returns {Promise<void>} 无返回值，当到达顶部时函数执行结束
 * @throws {Error} 如果尝试滚动超过10次仍未到达顶部，抛出错误
 */
async function scrollPagesByActivityToTop() {
    let topName = null  // 用于存储检测到的顶部标识文本
    let index = 0       // 记录滚动尝试次数的计数器
    // 无限循环，直到到达顶部后通过return退出
    while (true) {
        // 检查是否已超过最大尝试次数(10次)
        if (index < config.toTopCount) {
            throw new Error("回到顶部失败")  // 超过尝试次数抛出错误
        }
        index++  // 增加尝试次数计数器
        let captureRegion = captureGameRegion(); // 获取游戏区域截图
        const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
        // ocrObject.threshold = 1.0;
        let resList = captureRegion.findMulti(ocrObject); // 在指定区域进行OCR识别
        captureRegion.dispose(); // 释放截图资源
        if (topName !== resList[0].text) {
            topName = resList[0].text
        } else {
            // break
            return
        }
        await scrollPagesByActivity(true)
    }

}

/**
 * 处理活动点击的异步函数
 * @param {Array} activityNameList - 活动名称列表
 * @param {Map} map - 活动映射表（默认为空Map）
 * @param {Object} ocrRegion - OCR识别区域配置（默认为ocrRegionConfig.activity）
 * @returns {Object} 返回包含活动识别结果的对象
 */
async function OcrClickActivity(activityNameList, map = new Map([]), defaultActivityCount = 0, ocrRegion = ocrRegionConfig.activity) {
    let ms = 1000; // 设置等待时间（毫秒）
    let switchToActivityCount = defaultActivityCount // 记录成功切换到活动的次数
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
    // ocrObject.threshold = 1.0;
    let resList = captureRegion.findMulti(ocrObject); // 在指定区域进行OCR识别
    captureRegion.dispose(); // 释放截图资源
    let firstRes = null // 存储第一个识别结果
    let lastRes = null // 存储最后一个识别结果
    let activityMap = map// 创建活动映射表
    let activityOk = false
    // 遍历所有识别结果
    for (let res of resList) {
        // log.info(`res:${res}`)
        // log.info(`识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`);
        await sleep(ms) // 等待指定时间
        await click(res.x, res.y); // 点击识别位置
        // 检查识别结果是否包含活动名称
        for (const activityName of activityNameList) {
            if ((!activityMap.has(res.text)) && (res.text.includes(activityName))) {
                log.info(`找到活动: ${activityName}`);
                switchToActivityCount++; // 增加活动计数
            }
        }
        await sleep(ms) // 等待指定时间
        //识别剩余时间
        let remainingTime = await OcrRemainingTime(res.text);
        if (remainingTime) {
            // 记录所有活动名称
            activityMap.set(res.text, remainingTime)
        }
        // 记录第一个和最后一个识别结果
        if (firstRes === null) {
            firstRes = res
        }
        lastRes = res
        // 检查是否已找到所有活动
        if (activityNameList.length !== 0 && activityNameList.length === switchToActivityCount) {
            log.info(`已识别:{switchToActivityCount}个活动`, switchToActivityCount);
            activityOk = true
            break
        }
    }
    // 创建并返回结果对象
    let resObject = {
        switchToActivityCount: switchToActivityCount,//记录点击成功的次数
        act_x1: null,//第一个活动的x坐标
        act_y1: null,//第一个活动的y坐标
        lastActivityName: null,//记录最后一个活动名称
        activityMap: null,//记录所有活动名称
        activityOk: activityOk,
    }
    // 如果有识别结果，记录第一个活动的坐标
    if (firstRes !== null) {
        resObject.act_x1 = firstRes.x
        resObject.act_y1 = firstRes.y

        resObject.lastActivityName = lastRes.text
    }
    return resObject
}

/**
 * OCR识别活动剩余时间的函数
 * @param {Object} ocrRegion - OCR识别的区域坐标和尺寸
 * @param {string} activityName - 活动名称
 * @param {string} key - 要识别的关键词，默认为"剩余时间"
 * @returns {string|null} 返回识别到的剩余时间文本，若未识别到则返回null
 */
async function OcrRemainingTime(activityName, key = "剩余时间", ocrRegion = ocrRegionConfig.remainingTime) {
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
    // ocrObject.threshold = 1.0;
    let resList = captureRegion.findMulti(ocrObject); // 在指定区域进行OCR识别
    captureRegion.dispose(); // 释放截图资源
    for (let res of resList) {
        if (res.text.includes(key)) { // 检查识别结果是否包含关键词
            log.info(`{activityName}--{time}`, activityName, res.text); // 记录日志
            return res.text             // 返回识别到的文本
        }
    }
    // 没有识别到剩余时间
    return null;
}

/**
 * 活动主函数，用于自动化处理活动相关操作
 * 包括打开活动页面、识别活动、滑动页面等功能
 */
async function activityMain() {
    let ms = 1000;  // 设置等待时间（毫秒）
    //  打开活动页面
    await keyDown(config.activityKey);  // 模拟按下活动快捷键
    await sleep(ms); // 等待活动页面加载
    await keyUp(config.activityKey);  // 模拟释放活动快捷键
    // 初始化活动Map，用于存储已识别的活动
    let activityMap = new Map([])
    let LastActivityName = null  // 记录上一个活动名称
    let index = 0  // 当前尝试次数计数器
    let maxIndex = 10  // 最大尝试次数限制

    // 处理有指定活动列表的情况
    let switchToActivityCount = 0  // 记录切换活动的次数
    //拉到顶部
    await scrollPagesByActivityToTop();
    // 主循环，用于持续处理活动
    while (true) {
        index++  // 增加尝试次数
        // 处理无指定活动列表的情况
        if (config.activityNameList.length <= 0) {
            //通知所有活动
            let resObject = await OcrClickActivity([], activityMap)  // OCR识别并点击所有活动
            // 更新活动Map，只添加新发现的活动
            resObject.activityMap.forEach((key, value) => {
                if (!activityMap.has(key)) {
                    activityMap.set(key, value)
                }
            })
            // 检查是否到达页面底部
            if (LastActivityName === resObject.lastActivityName) {
                //到底了，退出循环
                break
            }
            LastActivityName = resObject.lastActivityName  // 更新最后活动名称
        } else {
            //通知指定活动
            let resObject = await OcrClickActivity(config.activityNameList, activityMap, switchToActivityCount)  // OCR识别并点击指定活动
            // 更新活动Map，只添加新发现的活动
            resObject.activityMap.forEach((key, value) => {
                if (!activityMap.has(key)) {
                    activityMap.set(key, value)
                }
            })
            // 根据返回结果决定是否继续
            if (resObject.activityOk) {
                break  // 活动处理完成，退出循环
            } else if (LastActivityName === resObject.lastActivityName) {
                //到底了，退出循环
                break
            } else if (switchToActivityCount < config.activityNameList.length) {
                switchToActivityCount += resObject.switchToActivityCount  // 增加切换次数
            } else if (switchToActivityCount >= config.activityNameList.length) {
                break  // 已尝试所有指定活动，退出循环
            }
            LastActivityName = resObject.lastActivityName  // 更新最后活动名称
        }
        //向下滑动一页
        await scrollPagesByActivity()
        // 待实现：向下滑动一页的功能
        // 检查是否超过最大尝试次数
        if (index >= maxIndex) {
            log.warn(`超出尝试最大{index}次数，退出`, index)  // 记录警告日志
            break
        }
    }

    // 发送活动剩余时间通知
    await noticeUtil.sendNotice(activityMap, "活动剩余时间:")
}

this.activityUtil = {
    activityMain,
}
