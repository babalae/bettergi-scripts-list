function settingsParseInt(str, defaultValue) {
    try {
        return str ? parseInt('' + str) : defaultValue;
    } catch (e) {
        log.warn(`settingsParseInt error:${e}`)
        return defaultValue;
    }
}

const config = {
    activityNameList: (settings.activityNameList ? settings.activityNameList.split('|') : []),
    activityKey: (settings.activityKey ? settings.activityKey : 'F5'),
    toTopCount: settingsParseInt(settings.toTopCount,10),//滑动到顶最大尝试次数
    scrollPageCount: settingsParseInt(settings.scrollPageCount,4),//滑动次数/页
    notifyHoursThreshold: settingsParseInt(settings.notifyHoursThreshold, 8760),//剩余时间阈值(默认 8760小时=365天)
}
const ocrRegionConfig = {
    activity: {x: 267, y: 197, width: 226, height: 616},//活动识别区域坐标和尺寸
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
async function scrollPagesByActivity(isUp = false, total = 90, waitCount = 6, stepDistance = 30) {
    // 根据滚动方向设置坐标位置
    // 如果是向上滚动，使用顶部坐标；否则使用底部坐标
    let x = isUp ? xyConfig.top.x : xyConfig.bottom.x
    let y = isUp ? xyConfig.top.y : xyConfig.bottom.y
    // 记录滑动方向
    log.info(`活动页面-${isUp ? '向上' : '向下'}滑动`)
    // 注释：坐标信息已注释掉，避免日志过多
    // log.info(`坐标:${x},${y}`)
    // 根据配置的滑动次数执行循环
    for (let i = 0; i < config.scrollPageCount; i++) {
        // 移动到坐标位置
        await moveMouseTo(x, y)
        //80 18次滑动偏移量  46次测试未发现偏移
        await scrollPage(total, isUp, waitCount, stepDistance)
    }
}

/**
 * 通过滚动页面直到到达顶部位置
 * 该函数会持续滚动页面，直到检测到页面顶部的标识不再变化为止
 * @returns {Promise<void>} 无返回值，当到达顶部时函数执行结束
 * @throws {Error} 如果尝试滚动超过10次仍未到达顶部，抛出错误
 */
async function scrollPagesByActivityToTop(ocrRegion = ocrRegionConfig.activity) {
    let topName = null  // 用于存储检测到的顶部标识文本
    let index = 0       // 记录滚动尝试次数的计数器
    // 无限循环，直到到达顶部后通过return退出
    while (true) {
        // 检查是否已超过最大尝试次数(10次)
        if (index >= config.toTopCount) {
            throw new Error("回到顶部失败")  // 超过尝试次数抛出错误
        }
        await moveMouseTo(0, 20)
        index++  // 增加尝试次数计数器
        let captureRegion = captureGameRegion(); // 获取游戏区域截图
        const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height); // 创建OCR识别对象

        // ocrObject.threshold = 1.0;
        let resList = captureRegion.findMulti(ocrObject); // 在指定区域进行OCR识别
        captureRegion.dispose(); // 释放截图资源
        if (topName !== resList[0].text) {
            topName = resList[0].text
        } else {
            log.info(`回到顶部成功`)
            // break
            return
        }
        await scrollPagesByActivity(true, 80 * 4, 6, 60)
    }

}

/**
 * 滚动到活动页面最顶部（优化版）
 * 通过连续检测顶部活动名称相同来确认已到顶，更加健壮
 * @param {Object} ocrRegion - OCR识别区域，默认为活动列表区域
 * @throws {Error} 如果超过最大尝试次数仍未检测到稳定顶部，则抛出错误
 */
async function scrollPagesByActivityToTop(ocrRegion = ocrRegionConfig.activity) {
    let ms = 800
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
        let captureRegion = captureGameRegion();
        const ocrObject = RecognitionObject.Ocr(
            ocrRegion.x,
            ocrRegion.y,
            ocrRegion.width,
            ocrRegion.height
        );
        // 可选：提升识别率
        // ocrObject.threshold = 0.8;

        let resList = captureRegion.findMulti(ocrObject);
        captureRegion.dispose();

        // 如果完全没识别到任何活动，可能是页面异常或已在顶（极少情况）
        if (resList.length === 0) {
            log.warn("顶部OCR未识别到任何活动条目，可能是页面为空或识别失败");
            // 再尝试一次向上滚大距离
            // await scrollPagesByActivity(true);  // true = 向上
            await scrollPagesByActivity(true, 80 * 4, 6, 60);
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
        // 可选：加大单次滚动量（如果你发现默认一页不够）
        await scrollPagesByActivity(true, 80 * 4, 6, 60);

        await sleep(ms);  // 给页面滚动和渲染留时间
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

    // 提取数字和单位（支持中英文冒号、空格等）
    const dayMatch = timeText.match(/(\d+)\s*天/);
    const hourMatch = timeText.match(/(\d+)\s*小时/);

    let days = 0;
    let hours = 0;

    if (dayMatch) {
        days = parseInt(dayMatch[1], 10);
    }
    if (hourMatch) {
        hours = parseInt(hourMatch[1], 10);
    }

    // 天数转小时 + 原有小时
    const totalHours = days * 24 + hours;

    return totalHours;
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
            log.debug(`{activityName}--{time}`, activityName, res.text); // 记录日志
            return res.text             // 返回识别到的文本
        }
    }
    // 没有识别到剩余时间
    return null;
}


/**
 * 活动主函数：扫描所有活动页面，识别剩余时间，最后统一发送通知
 */
async function activityMain() {
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
        let captureRegion = captureGameRegion();
        const ocrObject = RecognitionObject.Ocr(
            ocrRegionConfig.activity.x,
            ocrRegionConfig.activity.y,
            ocrRegionConfig.activity.width,
            ocrRegionConfig.activity.height
        );
        let resList = captureRegion.findMulti(ocrObject);
        captureRegion.dispose();

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
            if (config.activityNameList.length > 0) {
                const matched = config.activityNameList.some(keyword => activityName.includes(keyword));
                if (!matched) {
                    continue;  // 不关心的活动，跳过不点击
                }
            }

            // 避免重复点击同一个活动（防止 OCR 误识别或页面抖动）
            if (activityMap.has(activityName)) {
                log.info(`活动已记录，跳过重复点击: ${activityName}`);
            } else {
                await click(res.x, res.y);     // 点击进入活动详情
                await sleep(ms);

                let remainingTimeText = await OcrRemainingTime(activityName);
                if (remainingTimeText) {
                    const totalHours = parseRemainingTimeToHours(remainingTimeText);
                    if (totalHours <= 24 && totalHours > 0) {
                        remainingTimeText += '<即将结束>'
                    }
                    activityMap.set(activityName, {
                        text: remainingTimeText,
                        hours: totalHours
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
    }
    let activityMapFilter = new Map();
     Array.from(activityMap.entries())
        .filter(([name, info]) => info.hours <= config.notifyHoursThreshold)
        .forEach(([name, info]) => activityMapFilter.set(name, info));
    // 7. 全部扫描完毕，统一发送通知（只发一次！）
    if (activityMapFilter.size > 0) {
        log.info(`扫描完成，共记录 {activityMap.size} 个活动，即将发送通知`, activityMapFilter.size);
        await noticeUtil.sendNotice(activityMapFilter, `原神活动剩余时间提醒(仅显示剩余 ≤ ${config.notifyHoursThreshold} 小时的活动):`);
    } else {
        log.warn("未识别到任何活动，未发送通知");
    }
}

this.activityUtil = {
    // config,
    activityMain,
    // OcrRemainingTime,
}
