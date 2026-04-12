const ocrRegionConfig = {
    activity: {x: 267, y: 197, width: 226, height: 616},//活动识别区域坐标和尺寸
    remainingTime: {x: 497, y: 202, width: 1417, height: 670},//剩余时间识别区域坐标和尺寸
}
const xyConfig = {
    top: {x: 344, y: 273},
    bottom: {x: 342, y: 791},
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
async function scrollPagesByActivity(isUp = false, total = 90, waitCount = 6, stepDistance = 30, scrollPageCount = 4) {
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
 * OCR识别活动剩余时间的函数
 * @param {Object} ocrRegion - OCR识别的区域坐标和尺寸
 * @param {string} activityName - 活动名称
 * @param {string} key - 要识别的关键词，默认为
 * @returns {string|null} 返回识别到的剩余时间文本，若未识别到则返回null
 */
async function OcrKey(activityName, key, ocrRegion = ocrRegionConfig.remainingTime) {
    if (!key) {
        return null
    }
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


// ... existing code ...

async function scrollFindActivity(name, key, value,activityKey = "F5") {
    const ms = 1000;
    // 1. 打开活动页面（默认 F5）
    await keyPress(activityKey);
    await sleep(ms * 2);
    // 2. 先强制滚动到最顶部（非常重要！）
    try {
        await scrollPagesByActivityToTop();
        await sleep(ms);
    } catch (e) {
        log.warn("回到顶部失败，但继续尝试执行");
    }
    let findActivity = {
        name: false,
        key: false,
        value: false
    };

    if (!name) {
        log.warn("未指定活动名称，无法查找");
        return findActivity;
    }

    let lastPageBottomName = null;
    let sameBottomCount = 0;
    const sameBottomCountMax = 1;
    let scannedPages = 0;
    const maxPages = 25;
    let previousPageActivities = new Set();

    // 4. 主循环：逐页向下扫描
    while (scannedPages < maxPages) {
        scannedPages++;
        log.info(`正在扫描第 ${scannedPages} 页`);

        await moveMouseTo(0, 20);

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

            if (resList.length === 0) {
                log.info("当前页未识别到任何活动，视为已到页面底部");
                break;
            }

            // ============ 重复页检测 ============
            const currentPageNames = new Set();
            for (let res of resList) {
                currentPageNames.add(res.text.trim());
            }

            if (previousPageActivities.size > 0) {
                let overlapCount = 0;
                for (let actName of currentPageNames) {
                    if (previousPageActivities.has(actName)) overlapCount++;
                }
                const overlapRatio = overlapCount / previousPageActivities.size;

                if (overlapRatio >= 0.7) {
                    log.info(`检测到当前页与上一页高度重复（重合率 ${Math.round(overlapRatio * 100)}%），已到达底部，停止扫描`);
                    break;
                }
            }
            previousPageActivities = currentPageNames;
            // ===================================

            let currentPageBottomName = null;
            let foundTarget = false;

            // 遍历当前页所有识别到的活动条目
            for (let res of resList) {
                const activityName = res.text.trim();
                currentPageBottomName = activityName;  // 更新底部活动名

                // 【关键修改】检查是否是目标活动名称（精确匹配）
                if (activityName.includes(name)) {
                    findActivity.name = true;
                    log.info(`找到目标活动：${activityName}`);
                    await click(res.x, res.y);
                    await sleep(ms);
                    foundTarget = true;

                    // 如果没有指定 key，找到活动名称就直接返回成功
                    if (!key) {
                        log.info(`已找到指定活动 [${activityName}]，无需匹配关键字`);
                        findActivity.key = true;
                        break;
                    }

                    // 如果指定了 key，进行关键字匹配
                    const text = await OcrKey(activityName, key);
                    if (text && text.includes(key)) {
                        log.info(`已找到指定活动 [${activityName}] 且包含关键字 [${key}]`);
                        findActivity.key = true;
                        if (value) {
                            findActivity.value = text.includes(value)
                        }
                        if (findActivity.value) {
                            log.info(`已找到指定活动 [${activityName}] 且包含关键字 [${key}] 和值 [${value}]`);
                        }
                    } else {
                        log.info(`活动 [${activityName}] 不包含关键字 [${key}]，继续查找`);
                    }
                    break;
                }
            }

            // 如果找到目标活动，直接退出主循环
            if (foundTarget) {
                break;
            }

            // 5. 判断是否已到达页面底部（单一判断逻辑）
            if (currentPageBottomName && currentPageBottomName === lastPageBottomName) {
                sameBottomCount++;
                if (sameBottomCount >= sameBottomCountMax) {
                    log.info(`连续 ${sameBottomCountMax} 次检测到相同底部活动，已确认到达页面最底部，扫描结束`);
                    break;
                }
            } else {
                sameBottomCount = 0;
            }
            lastPageBottomName = currentPageBottomName;

            // 6. 向下滑动一页，继续下一轮
            await scrollPagesByActivity(false);
            await sleep(ms);
        } finally {
            if (captureRegion) {
                captureRegion.dispose();
            }
        }
    }
    return findActivity;
}


async function findStygianOnslaught() {
    const findActivity = {
        name: "幽境危战",
        key: "紊乱爆发期",
        value: "已结束",
    }
    const findResult = await scrollFindActivity(findActivity.name, findActivity.key, findActivity.value);
    if((!findResult.name)||(findResult.name && findResult.key && findResult.value) ){
        // 幽境危战 紊乱爆发期 已结束
        return false
    }
    //正常模式
    return true
}

export {
    findStygianOnslaught
}