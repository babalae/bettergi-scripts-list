function settingsParseInt(str, defaultValue) {
    try {
        return str ? parseInt('' + str) : defaultValue;
    } catch (e) {
        log.warn(`settingsParseInt error:${e}`)
        return defaultValue;
    }
}

/**
 * 解析白名单活动文本，将其转换为活动列表
 * @param {string} text - 包含活动信息的文本，多个活动用'|'分隔
 * @param {Array} defaultList - 当text为空时的默认返回列表，默认为空数组
 * @returns {Array} 解析后的活动列表，去除空字符串并过滤空白项
 */
function parseWhiteActivity(text, defaultList = []) {
    return (text ? text.split('|').filter(s => s.trim()) : defaultList)
}


/**
 * 解析黑名单活动文本
 * @param {string} text - 包含活动信息的文本，使用'|'分隔多个活动，使用'-'分隔活动名称和条件，使用','分隔多个条件
 * @param {Array<string>} excludeList - 需要排除的活动名称列表
 * @returns {Map<string, Array<string>>|undefined} 解析后的活动映射，键为活动名称，值为条件数组；如果输入文本为空则返回undefined
 */
function parseBlackActivity(text, excludeList = []) {
    if (!text) return undefined;

    const result = new Map();

    // 使用'|'分割文本为多个活动元素
    const splitList = text.split('|');
    for (let element of splitList) {
        element = element.trim(); // 清理空白字符
        if (!element) continue; // 跳过空元素

        // 使用'-'分割活动元素的名称和条件
        const elementList = element.split('-');
        const activityName = elementList[0].trim();

        if (!activityName) continue; // 跳过没有名称的活动

        // 检查是否在排除列表中
        if (excludeList.includes(activityName)) {
            continue;
        }

        // 解析条件：如果有条件部分（length > 1），则分割条件；否则为空数组
        const conditions = elementList.length > 1
            ? Array.from(elementList[1].split(',').map(item => item.trim()))
            : [];
        log.debug(`parseBlackActivity: ${activityName} - ${conditions}`)
        // 将解析后的活动对象添加到结果中
        result.set(activityName, conditions);
    }

    return result.size > 0 ? result : undefined;
}


let config = {
    //剩余时间,白名单 启用`和`关系(默认`与`关系)
    relationship: settings.relationship,
    whiteActivityNameList: parseWhiteActivity(settings.whiteActivityNameList),
    activityKey: (settings.activityKey ? settings.activityKey : 'F5'),
    toTopCount: settingsParseInt(settings.toTopCount, 10),//滑动到顶最大尝试次数
    scrollPageCount: settingsParseInt(settings.scrollPageCount, 4),//滑动次数/页
    notifyHoursThreshold: settingsParseInt(settings.notifyHoursThreshold, 8760),//剩余时间阈值(默认 8760小时=365天)
    // 黑名单活动名称列表，这些活动将被排除在识别和处理之外
    // 通过 | 分隔多个活动名称，并过滤掉空白项
    blackActivityMap: parseBlackActivity(settings.blackActivity, parseWhiteActivity(settings.whiteActivityNameList)),
    // 同时确保黑名单中的活动名称不包含在白名单（whiteActivityNameList）中
    blackActivityNameList: [],
}
const ocrRegionConfig = {
    activity: {x: 267, y: 197, width: 226, height: 616},//活动识别区域坐标和尺寸
    remainingTime: {x: 497, y: 202, width: 1417, height: 670},//剩余时间识别区域坐标和尺寸
}
const xyConfig = {
    top: {x: 344, y: 273},
    bottom: {x: 342, y: 791},
}
const DATE_ENUM = Object.freeze({
    YEAR: '年',
    MON: '月',
    WEEK: '周',
    DAY: '天',
    HOUR: '小时',
    // 添加反向映射（可选）
    fromValue(value) {
        return Object.keys(this).find(key => this[key] === value);
    }
});
const activityTermConversionMap = new Map([
    ["砺行修远", {dateEnum: DATE_ENUM.WEEK}],
]);
const commonList = ["已完成"]
const needOcrOtherMap = new Map([
    ["砺行修远", ["本周进度", "完成进度"]],
    ["幽境危战", ["紊乱爆发期"]],
]);
const genshinJson = {
    width: 1920,//genshin.width,
    height: 1080,//genshin.height,
}

/**
 * 根据键名的一部分内容从Map中获取对应的值
 * 遍历Map的所有键名，查找包含指定key字符串的键，并返回对应的值
 *
 * @param {Map} map - 要搜索的Map对象，默认为空Map
 * @param {string} key - 用于匹配的键名部分字符串
 * @param {boolean} reverseMatch - 开启反向匹配
 * @returns {*} 匹配键对应的值，如果未找到匹配项则返回undefined
 */
function getMapByKey(map = new Map(), key, reverseMatch = false) {
    // 遍历Map的所有键名，查找包含指定key的键
    log.debug('Map=>size:{size}', map.size)
    for (let keyName of map.keys()) {
        log.debug('Map=>key:{key},keyName:{keyName},value:{value},ok:{ok}', key, keyName, JSON.stringify(map.get(keyName)), keyName.includes(key))
        if (keyName.includes(key) && !reverseMatch) {
            return map.get(keyName)
        } else if (key.includes(keyName) && reverseMatch) {
            return map.get(keyName)
        }
    }
    return undefined
}

/**
 * 根据活动名称获取对应的学期转换规则
 * @param {string} activityName - 活动名称
 * @returns {object} 返回包含dateEnum属性的对象，表示日期枚举类型
 */
function getActivityTermConversion(activityName) {
    // 遍历活动学期转换映射表的所有键
    for (let key of activityTermConversionMap.keys()) {
        // 检查活动名称是否包含当前键
        if (activityName.includes(key))
            // 如果包含，则返回映射表中对应的值
            return activityTermConversionMap.get(key)
    }
    // 如果没有匹配到任何键，则返回默认的小时日期枚举
    return {dateEnum: DATE_ENUM.HOUR}
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
 * 根据活动页面进行滚动操作
 * @param {boolean} isUp - 滚动方向，true表示向上滚动，false表示向下滚动
 * @param {number} total - 滚动总量
 * @param {number} waitCount - 等待次数
 * @param {number} stepDistance - 每次滚动的步长距离
 * @param {number} scrollPageCount - 滚动页面次数，默认从config中获取
 */
async function scrollPagesByActivity(isUp = false, total = 90, waitCount = 6, stepDistance = 30, scrollPageCount = config.scrollPageCount) {
    // 根据滚动方向设置坐标位置
    // 如果是向上滚动，使用顶部坐标；否则使用底部坐标
    let x = isUp ? xyConfig.top.x : xyConfig.bottom.x;  // 根据滚动方向获取x坐标
    let y = isUp ? xyConfig.top.y : xyConfig.bottom.y;  // 根据滚动方向获取y坐标
    // 记录滑动方向
    log.info(`活动页面-${isUp ? '向上' : '向下'}滑动`);
    // 注释：坐标信息已注释掉，避免日志过多
    // log.info(`坐标:${x},${y}`);
    // 根据配置的滑动次数执行循环
    for (let i = 0; i < scrollPageCount; i++) {
        // 移动到坐标位置
        await moveMouseTo(x, y)
        //80 18次滑动偏移量  46次测试未发现偏移
        await scrollPage(total, isUp, waitCount, stepDistance)
    }
}

/**
 * 滚动到活动页面最顶部（优化版）
 * 通过连续检测顶部活动名称相同来确认已到顶，更加健壮
 * @param {Object} ocrRegion - OCR识别区域，默认为活动列表区域
 * @throws {Error} 如果超过最大尝试次数仍未检测到稳定顶部，则抛出错误
 */
async function scrollPagesByActivityToTop(ocrRegion = ocrRegionConfig.activity) {
    let ms = 800;  // 等待时间，单位毫秒
    let topActivityName = null;         // 上一次检测到的顶部活动名称
    let sameTopCount = 0;               // 连续出现相同顶部名称的次数
    const requiredSameCount = 1;        // 需要连续几次相同才确认到顶（推荐 2~3）
    let attemptIndex = 0;                // 总尝试次数计数器
    const maxAttempts = config.toTopCount;  // 可配置，默认为15次

    log.info("开始滚动到活动页面顶部...");

    while (attemptIndex < maxAttempts) {
        attemptIndex++;
        log.info(`第 {attemptIndex} 次尝试回顶`, attemptIndex);

        // 移动鼠标到安全位置，避免干扰截图
        await moveMouseTo(0, 20);

        // 截图 + OCR 识别活动列表区域
        let captureRegion = null;
        try {
            captureRegion = captureGameRegion();
            const ocrObject = RecognitionObject.Ocr(
                ocrRegion.x,
                ocrRegion.y,
                ocrRegion.width,
                ocrRegion.height
            );
            // 可选：提升识别率
            // ocrObject.threshold = 0.8;

            let resList = captureRegion.findMulti(ocrObject);
            // captureRegion.dispose();

            // 如果完全没识别到任何活动，可能是页面异常或已在顶（极少情况）
            if (resList.length === 0) {
                log.warn("顶部OCR未识别到任何活动条目，可能是页面为空或识别失败");
                // 再尝试一次向上滚大距离
                // await scrollPagesByActivity(true);  // true = 向上
                await scrollPagesByActivity(true, 80 * 4, 6, 60, 1);
                await sleep(ms);
                continue;
            }

            // 取当前识别到的最顶部活动名称（resList[0] 通常是列表最上面的）
            const currentTopName = resList[0].text.trim();

            log.info(`当前检测到的顶部活动: {currentTopName}`, currentTopName);

            // 判断是否与上一次相同
            if (currentTopName === topActivityName) {
                sameTopCount++;
                log.debug(`顶部活动连续相同 ${sameTopCount} 次`);

                if (sameTopCount >= requiredSameCount) {
                    log.info(`已连续 {sameTopCount} 次检测到相同顶部活动，确认回到页面最顶部！`, sameTopCount);
                    return;  // 成功回到顶部
                }
            } else {
                // 顶部名称变了，说明还在向上滚动，重置计数
                topActivityName = currentTopName;
                sameTopCount = 1;  // 这次算第一次
            }

            // 未达到稳定状态，继续向上滚动一页（可根据实际情况调整滚动距离）
            // 这里使用更大滚动距离确保能快速回顶
            // await scrollPagesByActivity(true);  // true = 向上
            await scrollPagesByActivity(true, 80 * 4, 6, 60, 1);

            await sleep(ms);  // 给页面滚动和渲染留时间
        } finally {
            // 确保资源被正确释放
            if (captureRegion) {
                captureRegion.dispose();
            }
        }

    }

    // 超过最大尝试次数仍未稳定
    throw new Error(`回到活动页面顶部失败：尝试 ${attemptIndex} 次后仍未检测到稳定顶部活动`);
}

/**
 * 解析原神活动剩余时间字符串，返回总小时数
 * 支持格式示例：
 *   "剩余时间：22天14小时"  → 542（22*24 + 14）
 *   "剩余时间：5小时"      → 5
 *   "剩余时间：3天"        → 72（3*24 + 0）
 *   "剩余时间：1天23小时"  → 47
 *   "剩余：10天"           → 240（也支持部分关键词匹配）
 *
 * @param {string} timeText - OCR识别出的剩余时间文本
 * @returns {number} 总剩余小时数（整数，四舍五入向下取整）
 *                   如果解析失败，返回 0
 */
function parseRemainingTimeToHours(timeText) {
    if (!timeText || typeof timeText !== 'string') {
        return 0;
    }

    let days = 0;
    let hours = 0;
    let minutes = 0;

    // 如果上面的复杂正则有问题，可以使用原来的简化版本
    const dayMatch = timeText.match(/(\d+(?:\.\d+)?)\s*天/);
    const hourMatch = timeText.match(/(\d+(?:\.\d+)?)\s*小时/);
    const minuteMatch = timeText.match(/(\d+(?:\.\d+)?)\s*分钟/);

    if (dayMatch) {
        days = parseFloat(dayMatch[1]);
    }
    if (hourMatch) {
        hours = parseFloat(hourMatch[1]);
    }
    if (minuteMatch) {
        minutes = parseFloat(minuteMatch[1]);
    }

    // 确保数值非负
    days = Math.max(0, days);
    hours = Math.max(0, hours);
    minutes = Math.max(0, minutes);

    // 将分钟转换为小时
    const totalHours = days * 24 + hours + minutes / 60;

    return Math.round(totalHours); // 四舍五入到整数
}

/**
 * 可选：返回格式化字符串，如 "542小时（22天14小时）"
 */
function formatRemainingTime(timeText) {
    if (!timeText || typeof timeText !== 'string') {
        return "解析失败";
    }

    const dayMatch = timeText.match(/(\d+)\s*天/);
    const hourMatch = timeText.match(/(\d+)\s*小时/);

    const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const totalHours = days * 24 + hours;

    const original = timeText.trim();
    return `${totalHours}小时（${days > 0 ? days + '天' : ''}${hours > 0 ? hours + '小时' : ''}）`;
}

/**
 * 将总小时数转换为周、天和小时的组合表示
 * @param {number} totalHours - 需要转换的总小时数
 * @returns {string} 返回格式为"X周 Y天 Z小时"的字符串
 */
function convertHoursToWeeksDaysHours(totalHours) {
    // 1周 = 168小时 (7 * 24)
    const hoursPerWeek = 168;
    const hoursPerDay = 24;

    // 计算整周数 - 使用Math.floor获取完整的周数
    const weeks = Math.floor(totalHours / hoursPerWeek);

    // 剩余小时 - 总小时数减去完整周数对应的小时数
    let remainingHours = totalHours % hoursPerWeek;

    // 从剩余小时中计算天数 - 使用Math.floor获取完整的天数
    const days = Math.floor(remainingHours / hoursPerDay);

    // 剩余的小时 - 剩余小时数减去完整天数对应的小时数
    const hours = remainingHours % hoursPerDay;

    // 返回格式化后的字符串，包含周、天和小时
    return `${weeks}周 ${days}天 ${hours}小时`;
}

/**
 * OCR识别活动剩余时间的函数
 * @param {Object} ocrRegion - OCR识别的区域坐标和尺寸
 * @param {string} activityName - 活动名称
 * @param {string} key - 要识别的关键词，默认为"剩余时间"
 * @returns {string|null} 返回识别到的剩余时间文本，若未识别到则返回null
 */
async function OcrKey(activityName, key = "剩余时间", ocrRegion = ocrRegionConfig.remainingTime) {

    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    try {
        let list = new Array()
        const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象
        // ocrObject.threshold = 1.0;
        let resList = captureRegion.findMulti(ocrObject); // 在指定区域进行OCR识别
        for (let res of resList) {
            log.debug(`[info][{key}]{activityName}--{time}`, key, activityName, res.text); // 记录日志
            if (res.text.includes(key)) { // 检查识别结果是否包含关键词
                log.debug(`[{key}][命中]{activityName}--{time}`, key, activityName, res.text); // 记录日志
                list.push(res.text.trim())
                // return res.text             // 返回识别到的文本
            }
        }
        if (list.length > 0) {
            return list.join('<-->')
        }
        // 没有识别到剩余时间
        return null;

    } finally {
        captureRegion.dispose(); // 释放截图资源
    }
}

async function init() {
    log.debug(`[init-config]-[{config}]`, JSON.stringify(config));
    let blackActivityMap = config.blackActivityMap
    config.blackActivityNameList = blackActivityMap ? Array.from(blackActivityMap.keys()) : [];
    config.blackActivityNameList.length > 0 && log.debug(`[init]-[{blackActivityNameList}]`, config.blackActivityNameList.join('|'));
    log.debug(`[init]-[{ket}]`, 'activity');
    log.debug(`[init-config-end]-[{config}]`, JSON.stringify(config));
}

/**
 * 活动主函数：扫描所有活动页面，识别剩余时间，最后统一发送通知
 */
async function activityMain() {
    await init();
    const ms = 1000;
    await sleep(ms);

    // 1. 打开活动页面（默认 F5）
    await keyPress(config.activityKey);
    await sleep(ms * 2);  // 给活动页面多点加载时间

    // 2. 先强制滚动到最顶部（非常重要！）
    try {
        await scrollPagesByActivityToTop();
        await sleep(ms);
    } catch (e) {
        log.warn("回到顶部失败，但继续尝试执行");
    }

    // 3. 初始化存储所有活动的 Map
    let activityMap = new Map();  // key: 活动名称, value: 剩余时间文本
    let previousPageActivities = new Set();  // 新增：记录上一页识别到的所有活动名称（用于重复页判断）

    let lastPageBottomName = null;     // 上一次扫描到的页面最底部活动名
    let sameBottomCount = 0;           // 连续出现相同底部活动名的次数
    let scannedPages = 0;
    const maxPages = 25;               // 防止意外死循环的安全上限
    let sameBottomCountMax = 1;         // 连续相同底部活动名的最大次数

    // 4. 主循环：逐页向下扫描
    while (scannedPages < maxPages) {
        scannedPages++;
        log.info(`正在扫描第 {scannedPages} 页`, scannedPages);
        // 移动鼠标到安全位置，避免干扰截图
        await moveMouseTo(0, 20);
        // 获取当前页面活动列表区域截图并 OCR
        let captureRegion = null;
        try {
            captureRegion = captureGameRegion();

            const ocrObject = RecognitionObject.Ocr(
                ocrRegionConfig.activity.x,
                ocrRegionConfig.activity.y,
                ocrRegionConfig.activity.width,
                ocrRegionConfig.activity.height
            );
            let resList = captureRegion.findMulti(ocrObject);
            // captureRegion.dispose();

            // 如果本页完全没有识别到活动，可能是到底了或 OCR 失败
            if (resList.length === 0) {
                log.info("当前页未识别到任何活动，视为已到页面底部");
                break;
            }
            // ============ 新增：提前判断是否为重复页 ============
            const currentPageNames = new Set();
            for (let res of resList) {
                currentPageNames.add(res.text.trim());
            }

            // 计算与上一页的重合率
            if (previousPageActivities.size > 0) {
                let overlapCount = 0;
                for (let name of currentPageNames) {
                    if (previousPageActivities.has(name)) overlapCount++;
                }
                const overlapRatio = overlapCount / previousPageActivities.size;

                // 如果重合率 >= 70%（可调整），认为滚动未生效，是重复页
                if (overlapRatio >= 0.7) {
                    log.info(`检测到当前页与上一页高度重复（重合率 ${Math.round(overlapRatio * 100)}%），已到达底部，停止扫描`);
                    break;
                }
            }

            // 更新上一页记录（为下一轮做准备）
            previousPageActivities = currentPageNames;
            // =================================================

            let currentPageBottomName = null;  // 本页最下面的活动名
            let newActivityCountThisPage = 0;

            // 遍历当前页所有识别到的活动条目
            for (let res of resList) {
                const activityName = res.text.trim();

                // 如果设置了指定活动列表，只处理包含这些关键词的活动
                if (config.whiteActivityNameList.length > 0) {
                    const matched = config.whiteActivityNameList.some(keyword => activityName.includes(keyword));
                    if (!matched && (config.relationship)) {
                        continue;  // 不关心的活动，跳过不点击
                    }
                }

                // 检查当前活动名称是否在黑名单中
                if (config.blackActivityNameList.length > 0) {
                    let matched = config.blackActivityNameList.some(keyword => activityName.includes(keyword));
                    if (matched) {
                        // 获取黑名单活动的条件配置
                        let blackActivityConditions = getMapByKey(config.blackActivityMap, activityName,true);
                        log.info(`[黑名单条件检测]blackActivityMap:{blackActivityMap},activityName:{activityName},blackActivityConditions:{blackActivityConditions}`,
                            config.blackActivityMap, activityName, blackActivityConditions);
                        if (blackActivityConditions && blackActivityConditions.length > 0) {
                            log.debug('[黑名单条件检测开始]')
                            matched = false;
                            // 遍历所有条件，检查是否满足黑名单条件
                            for (const blackActivityCondition of blackActivityConditions) {
                                try {
                                    let condition = await OcrKey(activityName,blackActivityCondition);
                                    if (condition) {
                                        log.info(`满足黑名单条件==>{ac}->{ba}`, activityName, blackActivityCondition);
                                        matched = true;
                                        break;
                                    }
                                } catch (error) {
                                    log.error(`检查黑名单条件时发生错误: ${error.message}`, error);
                                    // 继续检查下一个条件，不中断整个流程
                                    continue;
                                }
                            }
                        }

                        // 如果匹配到黑名单活动，则跳过不点击
                        if (matched) {
                            continue;  // 不关心的活动，跳过不点击
                        }
                    }
                }


                // 避免重复点击同一个活动（防止 OCR 误识别或页面抖动）
                if (activityMap.has(activityName)) {
                    log.info(`活动已记录，跳过重复点击: ${activityName}`);
                } else {
                    await click(res.x, res.y);     // 点击进入活动详情
                    await sleep(ms);

                    let remainingTimeText = await OcrKey(activityName);
                    if (remainingTimeText) {
                        if (remainingTimeText.endsWith('小')) {
                            remainingTimeText += '时'
                        } else if (remainingTimeText.endsWith('分')) {
                            remainingTimeText += '钟'
                        }
                        const totalHours = parseRemainingTimeToHours(remainingTimeText);
                        if (totalHours <= 24 && totalHours > 0) {
                            remainingTimeText += '<即将结束>'
                        }
                        let desc = ""

                        let dateEnum = getActivityTermConversion(activityName);
                        log.debug(`activityName:{activityName},dateEnum：{dateenum.dateEnum}`, activityName, dateEnum.dateEnum)
                        switch (dateEnum.dateEnum) {
                            case DATE_ENUM.WEEK:
                                desc += "|==>" + convertHoursToWeeksDaysHours(totalHours) + "<==|";
                                break;
                            case DATE_ENUM.HOUR:
                                break;
                            default:
                                break;
                        }
                        let needMap = getMapByKey(needOcrOtherMap, activityName);
                        if (needMap) {
                            const keys = needMap;
                            for (const key of keys) {
                                let text = await OcrKey(activityName, key);
                                if (text) {
                                    remainingTimeText += " [" + text + "] "
                                }
                            }
                        }
                        let common = new Array()
                        // 通用key
                        if (commonList && commonList.length > 0) {
                            for (let commonKey of commonList) {
                                let text = await OcrKey(activityName, commonKey);
                                if (text) {
                                    common.push(text)
                                }
                            }
                        }
                        activityMap.set(activityName, {
                            common: common.length > 0 ? common.join(",") : undefined,
                            text: remainingTimeText,
                            hours: totalHours,
                            desc: desc
                        });
                        log.info(`成功记录 → {activityName} {remainingTime} 共计: {hours} 小时`, activityName, remainingTimeText, totalHours);
                        newActivityCountThisPage++;
                    }

                    await sleep(ms);
                }

                // 更新本页最下面的活动名
                currentPageBottomName = activityName;
            }
            // 备用判断：本页一个新活动都没加，也认为到底（双保险）
            if (newActivityCountThisPage === 0 && scannedPages > 1) {
                log.info("本页无新活动添加，确认已到底");
                break;
            }
            // 5. 判断是否已到达页面底部
            if (currentPageBottomName && currentPageBottomName === lastPageBottomName) {
                sameBottomCount++;
                if (sameBottomCount >= sameBottomCountMax) {
                    log.info("连续{sameBottomCountMax}次检测到相同底部活动，已确认到达页面最底部，扫描结束", sameBottomCountMax);
                    break;
                }
            } else {
                sameBottomCount = 0;  // 重置计数
            }
            lastPageBottomName = currentPageBottomName;

            // 6. 向下滑动一页，继续下一轮
            await scrollPagesByActivity(false);  // false = 向下滚动
            await sleep(ms);
        } finally {
            if (captureRegion) {
                captureRegion.dispose();
            }
        }
    }
    let activityMapFilter = new Map();
    Array.from(activityMap.entries())
        .filter(([name, info]) => {
            // 检查活动是否满足通知条件：
            // 1. 剩余时间小于等于阈值
            // 2. 活动名称包含在白名单中
            const isWithinThreshold = info.hours <= config.notifyHoursThreshold;
            const isInWhitelist = config.whiteActivityNameList.some(keyword => name.includes(keyword));
            return config.relationship ? (isWithinThreshold && isInWhitelist) : (isWithinThreshold || isInWhitelist);
        })
        .forEach(([name, info]) => activityMapFilter.set(name, info));

    if (config.whiteActivityNameList.length > 0) {
        log.info(`[模式]==>(剩余时间,白名单)已开启{key}模式`, config.relationship ? `和` : `或`)

    }
    // 7. 全部扫描完毕，统一发送通知（只发一次！）
    if (activityMapFilter.size > 0) {
        let uid = await uidUtil.ocrUID()
        log.info(`扫描完成，共记录 {activityMap.size} 个活动，即将发送通知`, activityMapFilter.size);
        // 构建通知标题，根据配置显示剩余时间阈值和白名单活动信息
        let titleKey = `[ `;
        titleKey += `剩余时间 <= ${config.notifyHoursThreshold} 小时`;
        // 如果配置了白名单活动，则在标题中添加相关信息
        if (config.whiteActivityNameList.length > 0) {
            titleKey += config.relationship ? ` 和 ` : ` 或 `;
            titleKey += `白名单 <<${config.whiteActivityNameList.join(", ")}>>`;
        }
        titleKey += `] `;

        let blackText = "";
        if (config.blackActivityNameList.length > 0) {
            let blackAllText = []
            for (let en of config.blackActivityNameList) {
                let configTextList = config.blackActivityMap.get(en)
                if (configTextList) {
                    en += (configTextList.length > 0 ? "-" : "") + configTextList.join(',')
                    blackAllText.push(en)
                }
            }
            blackText += `==>{已开启黑名单: ${blackAllText.join("|")}}<==`
        }

        await noticeUtil.sendNotice(activityMapFilter, `UID:${uid}\n原神活动剩余时间提醒(仅显示 ${titleKey} 的活动)${blackText}`);
    } else {
        log.warn("不存在符合条件的活动，未发送通知");
    }
}

this.activityUtil = {
    // config,
    activityMain,
    // OcrRemainingTime,
}
