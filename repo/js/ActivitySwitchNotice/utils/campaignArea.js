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
    campaignAreaReminderDay: settingsParseInt(settings.campaignAreaReminderDay, 0),//征讨领域提醒日
}
const ocrRegionConfig = {
    weeklyCount: {x: 809, y: 258, width: 277, height: 37},//征讨领域减半次数识别区域坐标和尺寸
    dailyCommission: {x: 630, y: 312, width: 105, height: 118},//每日委托识别区域坐标和尺寸
}
const xyConfig = {
    campaignArea: {x: 493, y: 537},//征讨领域坐标
    secretRealm: {x: 304, y: 448},//秘境坐标
    dailyCommission: {x: 266, y: 318},//委托坐标 x=266, y=318, width=69, height=44
}

/**
 * 每日委托OCR识别函数
 * @param {Object} ocrRegion - OCR识别区域配置，默认为ocrRegionConfig.dailyCommission
 * @returns {Object} 返回包含每日委托和体力使用情况的对象
 */
async function ocrDailyCommission(ocrRegion = ocrRegionConfig.dailyCommission) {
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    try {
        const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
        // ocrObject.threshold = 1.0;
        let resList = captureRegion.findMulti(ocrObject); // 在指定区域进行OCR识别
        let dailyCommission = resList[0].text?.trim();
        const lastName = dailyCommission.at(dailyCommission.length - 1);

        if (dailyCommission.lastIndexOf('1') === 1) {
            //  0/4 被识别成==>014
            dailyCommission = dailyCommission.replace('1' + lastName, '/' + lastName)
        }
        const dailyCommissionSplit = dailyCommission.split('/');

        // physical
        let physical = resList[1].text?.trim();
        const physicalSplit = physical.split('/');
        return {
            daily: {
                total: parseInt(dailyCommissionSplit[1]),
                use: parseInt(dailyCommissionSplit[0]),
            },
            physical: {
                total: parseInt(physicalSplit[1]),
                use: parseInt(physicalSplit[0]),
            },
        }
    } finally {
        captureRegion.dispose(); // 释放截图资源
    }
}

/**
 * OCR识别周计数函数
 * @param {Object} ocrRegion - OCR识别区域配置，默认为ocrRegionConfig.weeklyCount
 * @returns {Object} 返回包含周计数信息的JSON对象，包含text、total和count属性
 * @throws {Error} 当OCR识别失败时抛出错误
 */
async function ocrWeeklyCount(ocrRegion = ocrRegionConfig.weeklyCount) {
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    try {
        const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
        // ocrObject.threshold = 1.0;
        let res = captureRegion.find(ocrObject); // 在指定区域进行OCR识别
        if (!res.isExist()) {
            log.error(`ocrWeeklyCount not found`) // 记录错误日志
            throw new Error(`ocrWeeklyCount not found`) // 抛出错误异常
        }
        let weekJson = { // 初始化周计数JSON对象
            text: res.text,
            total: 3,
            count: 3,
        }
        let weekCountText = res.text // 获取OCR识别的文本结果
        let result = weekCountText.match(/[0-9/]+/g)?.join('') || ''; // 使用正则表达式提取数字和斜杠

        log.debug(`识别结果:{weekCountText}`, weekCountText) // 记录原始识别结果
        log.debug(`处理结果:{result}`, result) // 记录处理后的结果
        const numbers = result.split('/').map((item) => parseInt(item)); // 分割字符串并转换为数字数组
        weekJson.total = numbers[1] // 设置总数
        weekJson.count = numbers[0] // 设置当前计数
        log.debug(`Json:{weekJson}`, weekJson) // 记录最终JSON结果
        return weekJson // 返回处理后的周计数JSON对象
    } finally {
        captureRegion.dispose(); // 释放截图资源
    }
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
    let weekDay = `${weekDays[day]}`;

    log.debug(`今天是[{day}]`, day)
    log.debug(`今天是[{weekDays}]`, weekDay)
    // 返回包含星期数字和对应星期名称的对象
    return {
        day: day,
        dayOfWeek: weekDay
    }
}

/**
 * 执行秘境征讨剩余次数提醒的主函数
 * 该函数会在每周日执行，检查秘境征讨的剩余次数并发送提醒
 */
async function campaignAreaMain(openKey = true) {
    // 获取当前星期信息
    let dayOfWeek = await getDayOfWeek();
    // 如果不是周日(0代表周日)，则直接返回
    const bool = dayOfWeek.day != config.campaignAreaReminderDay;
    // 记录开始执行秘境征讨提醒的日志
    log.info(`[{dayOfWeek.dayOfWeek}]，${bool ? "跳过" : "开始"}执行秘境征讨剩余次数提醒`, dayOfWeek.dayOfWeek)
    if (bool) {
        return
    }
    // 设置操作间隔时间(毫秒)
    let ms = 600
    if (openKey) {
        // 等待一段时间
        await sleep(ms)
        // 按下配置的热键
        await keyPress(config.campaignAreaKey)
    }
    await sleep(ms * 2)
    // 点击秘境入口坐标
    await click(xyConfig.secretRealm.x, xyConfig.secretRealm.y)
    await sleep(ms * 2)
    // 点击秘境征讨坐标
    await click(xyConfig.campaignArea.x, xyConfig.campaignArea.y)
    await sleep(ms * 2)
    // 使用OCR识别本周秘境征讨剩余次数
    let weekJson = await ocrWeeklyCount();

    // 如果有剩余次数，则记录日志并发送通知
    if (weekJson.count > 0) {
        let uid = await uidUtil.ocrUID()
        log.info(`本周剩余消耗减半次数:${weekJson.count}`)
        await noticeUtil.sendText(`>|本周剩余消耗减半次数:${weekJson.count}`, `UID:${uid}\n秘境征讨`)
    }

}

/**
 * 每日委托主函数
 * @param {boolean} openKey - 是否开启热键功能，默认为true
 * @returns {Promise<void>}
 */
async function dailyCommissionMain(openKey = true) {
    // 获取当前星期信息
    let dayOfWeek = await getDayOfWeek();
    // 如果不是周日(0代表周日)，
    const bool = dayOfWeek.day != config.campaignAreaReminderDay;

    // 设置操作间隔时间(毫秒)
    let ms = 600
    // 等待一段时间
    await sleep(ms)
    if (openKey || bool) {
        // 按下配置的热键
        await keyPress(config.campaignAreaKey)
    }
    await sleep(ms * 2)
    // 点击秘境入口坐标
    await click(xyConfig.dailyCommission.x, xyConfig.dailyCommission.y)
    await sleep(ms * 2)
    const re = await ocrDailyCommission();
    log.debug(`dailyCommission:{re}`, re)
    // 如果有每日未完成/领取，则记录日志并发送通知
    if (re.daily.total > re.daily.use
        || re.physical.total > re.physical.use
    ) {
        let uid = await uidUtil.ocrUID()
        await noticeUtil.sendText(`>|每日委托奖励:${re.daily.use}/${re.daily.total}\n>|原粹树脂消耗:${re.physical.use}/${re.physical.total}`, `UID:${uid}\n每日委托`)
    }
}

this.campaignAreaUtil = {
    campaignAreaMain,
    dailyCommissionMain,
}