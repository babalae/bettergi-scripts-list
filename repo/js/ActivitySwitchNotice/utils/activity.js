const config = {
    activityNameList: (settings.activityNameList ? settings.activityNameList.splice('|') : []),
    activityKey: (settings.activityKey ? settings.activityKey : 'F5'),
}

/**
 * OCR点击活动函数
 * @param {Object} ocrRegion - OCR识别区域坐标和尺寸
 * @param {Array} activityNameList - 活动名称列表
 * @returns {Object} 返回包含点击活动结果的对象
 */
async function OcrClickActivity(ocrRegion, activityNameList) {
    let ms = 1000; // 设置等待时间（毫秒）
    let switchToActivityCount = 0 // 记录成功切换到活动的次数
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
    // ocrObject.threshold = 1.0;
    let resList = captureRegion.findMulti(ocrObject); // 在指定区域进行OCR识别
    captureRegion.dispose(); // 释放截图资源
    let firstRes = null // 存储第一个识别结果
    let lastRes = null // 存储最后一个识别结果
    let activityMap = new Map([]) // 创建活动映射表
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
        let time = "剩余时间:"
        //todo:识别剩余时间

        // 记录所有活动名称
        activityMap.set(res.text, time)

        // 记录第一个和最后一个识别结果
        if (firstRes === null) {
            firstRes = res
        }
        lastRes = res
        // 检查是否已找到所有活动
        if (activityNameList.length !== 0 && activityNameList.length === switchToActivityCount) {
            log.info(`已识别:{switchToActivityCount}个活动`, switchToActivityCount);
            break
        }
    }
    // 创建并返回结果对象
    let resObject = {
        switchToActivityCount: switchToActivityCount,//记录点击成功的次数
        act_x1: null,//第一个活动的x坐标
        act_y1: null,//第一个活动的y坐标
        lastActivityName: null,//记录最后一个活动名称 点击成功就为空
        activityMap: null,//记录所有活动名称
    }
    // 如果有识别结果，记录第一个活动的坐标
    if (firstRes !== null) {
        resObject.act_x1 = firstRes.x
        resObject.act_y1 = firstRes.y
    }
    // 如果没有成功切换到活动，记录最后一个活动名称
    if (!switchToActivity && (lastRes !== null)) {
        // log.info(`test--length-1`)
        resObject.lastActivityName = lastRes.text
    }
    return resObject
}


async function activityMain() {
    let ms = 1000;
    //  打开活动页面
    await keyDown(config.activityKey);
    await sleep(ms); // 等待活动页面加载
    await keyUp(config.activityKey);
    if (config.activityNameList.length <= 0) {
        //通知所有
    } else {
        //通知指定
    }
}

this.activityUtil = {
    activityMain,
}
