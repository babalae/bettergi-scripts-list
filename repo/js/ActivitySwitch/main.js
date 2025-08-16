// 切换到活动页面
async function switchToActivityPage(activityName, activityKey, maxOcrCount) {
    try {
        //标记点击成功
        let switchToActivity = false;
        // 记录日志
        log.info(`正在尝试切换到活动页面: ${activityName}`);

        // 检查游戏窗口信息
        const gameWidth = genshin.width;
        const gameHeight = genshin.height;
        if (!gameWidth || !gameHeight) {
            notification.error('无法获取游戏窗口信息，请确保原神正在运行！');
            return;
        }
        log.info(`按下 ${activityKey}`)
        //  打开活动页面
        await keyDown(activityKey);
        await sleep(1000); // 等待活动页面加载
        await keyUp(activityKey);

        await sleep(1000);
        // log.info("移动到第一个活动")
        // var act_x1 = parseInt("300");
        // var act_y1 = parseInt("240");
        // log.info("x:" + 700 + "y:" + 440)
        //
        // await moveMouseTo(act_x1, act_y1);
        // await sleep(1000)
        // log.info('点击第一个活动')
        // await click(act_x1, act_y1);
        // 使用 OCR 识别活动列表区域（假设活动列表在屏幕左半部分）
        let ocr_x = parseInt(100 * gameWidth / 1920 + '')
        let ocr_y = parseInt(200 * gameHeight / 1080 + '')
        let ocr_width = parseInt(450 * gameWidth / 1920 + '')
        let ocr_hight = parseInt(600 * gameHeight / 1080 + '')
        log.info(`参考值(1920*1080):{"x": 100, "y": 200, "width": 450, "height": 600}`)
        let ocrRegion = {
            "x": ocr_x,
            "y": ocr_y,
            "width": ocr_width,
            "height": ocr_hight
        }
        log.info(`实际值(${gameWidth}*${gameHeight}):{"x": ${ocr_x}, "y": ${ocr_y}, "width": ${ocr_width}, "height": ${ocr_hight}}`)
        let activity = await lookForClickActivity(ocrRegion, activityName);

        switchToActivity = activity.switchToActivity
        if (!switchToActivity) {
            //第一页没有找到活动
            //第一次不记录(存在不标准从第二次<标准化后>开始记录)
            let lastActivityNameOne = null//记录最后一个活动名称第一次
            let lastActivityNameTwo = null//记录最后一个活动名称第二次
            //俩个名称一致时说明活动识别完了
            let isOne = true;
            let index = 1;//记录滑动几次
            while (lastActivityNameOne !== lastActivityNameTwo || (isOne && lastActivityNameOne === null && lastActivityNameTwo === null)) {
                isOne = false
                await sleep(1000)
                if (index === 1) {
                    //滑动
                    await slideToTop(activity.act_x1, activity.act_y1);
                    log.info('滑动到顶')
                } else {
                    await swipeOnePageDown(activity.act_x1, activity.act_y1);
                    log.info('滑动一页')
                }
                await sleep(1000)
                let clickActivity = await lookForClickActivity(ocrRegion, activityName);
                switchToActivity = clickActivity.switchToActivity

                if (index % 2 !== 0) {
                    lastActivityNameOne = clickActivity.lastActivityName
                } else {
                    lastActivityNameTwo = clickActivity.lastActivityName
                }
                log.info(`滑动次数:${index}`)
                if (!switchToActivity && maxOcrCount <= index) {
                    log.error(`已识别:${index}次,已超出最大次数:${maxOcrCount}`)
                    break;
                }
                index += 1
                if (switchToActivity) {
                    //点击成功
                    break;
                }
            }
        }
        if (!switchToActivity) {
            notification.error(`未找到活动: ${activityName}`);
        }
    } catch (error) {
        log.error(`切换活动页面失败: ${error.message}`);
        notification.error(`错误: ${error.message}`);
    }
}


/**
 * 移动向上鼠标
 * @param height
 * @returns {Promise<void>}
 */
async function moveMouseUp(x, y, height) {
    for (let i = 0; i < height; i++) {
        await moveMouseTo(x, y);
        await sleep(1000)
        await leftButtonDown();
        await keyMouseScript.runFile(`assets/(活动页面)鼠标向上移动一格.json`)
        await leftButtonUp();
    }
}

/**
 * 移动向下鼠标
 * @param height
 * @returns {Promise<void>}
 */
async function moveMouseDown(x, y, height) {
    for (let i = 0; i < height; i++) {
        // await sleep(1000)
        await moveMouseTo(x, y);
        await sleep(1000)
        // await keyDown('VK_LBUTTON');
        await leftButtonDown();
        // await sleep(1000)
        await keyMouseScript.runFile(`assets/(活动页面)鼠标向下移动一格.json`)
        // await sleep(1000)
        // await keyUp('VK_LBUTTON');
        await leftButtonUp();
    }
}

/**
 * 向下滑动一页(6次为一页）
 */
async function swipeOnePageDown(x, y) {
    let move_height = parseInt(6 * genshin.height / 1080 + '')
    await moveMouseUp(x, y, move_height)
}

/**
 * 滑动到顶
 * @param act_x1
 * @param act_y1
 */
async function slideToTop(act_x1, act_y1) {
    // await sleep(1000)
    // log.info(`移到x:${act_x1},y:${act_y1}`)
    // await moveMouseTo(act_x1, act_y1);
    // await sleep(1000)
    // log.info(`按下`)
    // keyDown('VK_LBUTTON')
    // //向下滑动
    // //todo
    // log.info(`向下滑动`)
    // // moveby(0, 1000)
    // await sleep(1000)
    // moveMouseBy(0, 1000)
    // log.info(`ok`)
    // keyUp('VK_LBUTTON')
    let move_height = parseInt(6 * genshin.height / 1080 + '')
    await moveMouseDown(act_x1, act_y1, move_height)
}

/**
 * 查找点击活动
 * @param ocrRegion
 * @param activityName
 * @returns {Promise<boolean>}
 */
async function lookForClickActivity(ocrRegion, activityName) {
    let switchToActivity = false
    let captureRegion = captureGameRegion();
    const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
    // ocrObject.threshold = 1.0;
    let resList = captureRegion.findMulti(ocrObject);
    let firstRes = null
    let lastRes = null
    for (let res of resList) {
        // log.info(`res:${res}`)
        // log.info(`识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}`);
        if (res.text.includes(activityName)) {
            log.info(`找到活动: ${activityName}`);
            // 模拟点击活动
            await sleep(1000)
            await click(res.x, res.y);
            switchToActivity = true;
            break;
        }
        if (firstRes === null) {
            firstRes = res
        }
        lastRes = res
    }
    let resObject = {
        "switchToActivity": switchToActivity,//记录是否点击成功
        "act_x1": null,//第一个活动的x坐标
        "act_y1": null,//第一个活动的y坐标
        "lastActivityName": null//记录最后一个活动名称 点击成功就为空
    }
    if (firstRes !== null) {
        resObject.act_x1 = firstRes.x
        resObject.act_y1 = firstRes.y
    }
    if (!switchToActivity && (lastRes !== null)) {
        // log.info(`test--length-1`)
        resObject.lastActivityName = lastRes.text
    }
    return resObject
}

(async function () {
    setGameMetrics(1920, 1080, 2); // 设置游戏窗口大小和DPI
    // await swipeOnePageDown(300, 240)
    if (settings.enable) {
        //返回主界面
        log.info('返回主界面');
        genshin.returnMainUi();
    }
    await sleep(1000);
    const activityName = settings.activityName;
    let activityKey = settings.activityKey;
    let maxOcrCount = 2;
    if (settings.maxOcrCount && settings.maxOcrCount !== '默认') {
        maxOcrCount = parseInt(settings.maxOcrCount)
    }
    if (!activityName) {
        notification.error('未配置活动名称，请设置');
        return;
    }
    if (!activityKey) {
        activityKey = 'F5';
    }
    await switchToActivityPage(activityName, activityKey, maxOcrCount);
})();
