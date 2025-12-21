function settingsParseInt(str, defaultValue) {
    try {
        return str ? parseInt('' + str) : defaultValue;
    } catch (e) {
        log.warn(`settingsParseInt error:${e}`)
        return defaultValue;
    }
}

function settingsParseStr(str, defaultValue) {
    return '' + (str ? str : defaultValue);
}

const config = {
    campaignAreaKey: settingsParseStr(settings.campaignAreaKey, 'F1'),
}
const ocrRegionConfig = {
    weeklyCount: {x: 809, y: 258, width: 277, height: 37},//征讨领域减半次数识别区域坐标和尺寸
}
const xyConfig = {
    campaignArea: {x: 0, y: 0},//征讨领域坐标
    secretRealm: {x: 304, y: 448},//秘境坐标
}

async function ocrWeeklyCount(ocrRegion = ocrRegionConfig.weeklyCount) {
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
    // ocrObject.threshold = 1.0;
    let res = captureRegion.find(ocrObject); // 在指定区域进行OCR识别
    captureRegion.dispose(); // 释放截图资源
    if (!res.isExist()) {
        log.error(`ocrWeeklyCount not found`)
        throw new Error(`ocrWeeklyCount not found`)
    }
    let weekJson = {
        text: res.text,
        total: 3,
        count: 3,
    }
    let weekCountText = res.text
    let result = weekCountText.match(/[0-9/]+/g)?.join('') || '';

    log.info(`识别结果:{weekCountText}`, weekCountText)
    log.info(`处理结果:{result}`, result)
    const numbers = result.split('/').map((item) => parseInt(item));
    weekJson.total = numbers[1]
    weekJson.count = numbers[0]
    log.info(`Json:{weekJson}`, weekJson)
    return weekJson
}

/**
 * 获取当前日期的星期信息
 * @returns {Object} 返回包含星期数字和星期名称的对象
 */
async function getDayOfWeek() {
    // 获取当前日期对象
    const today = new Date();
    // 获取当前日期是星期几（0代表星期日，1代表星期一，以此类推）
    const day = today.getDay();
    // 创建包含星期名称的数组
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    // 返回包含星期数字和对应星期名称的对象
    return {
        day: day,
        dayOfWeek: weekDays[day]
    }
}

async function campaignAreaMain() {
    let dayOfWeek = getDayOfWeek();
    if (dayOfWeek.day===0) {
        return
    }
    let ms = 600
    await sleep(ms)
    await keyPress(config.campaignAreaKey)
    await sleep(ms * 2)
    await click(xyConfig.secretRealm.x, xyConfig.secretRealm.y)
    await sleep(ms * 2)
    await click(xyConfig.campaignArea.x, xyConfig.campaignArea.y)
    await sleep(ms * 2)
    //
    let weekJson = await ocrWeeklyCount();

    if (weekJson.count > 0) {
        log.info(`剩余次数:${weekJson.count}`)
        await noticeUtil.send(`剩余次数:${weekJson.count}`, '秘境征讨')
    }

}

this.campaignAreaUtil = {
    campaignAreaMain,
}