const ocrRegionConfig = {
    activity: {x: 267, y: 197, width: 226, height: 616},//活动识别区域坐标和尺寸
    remainingTime: {x: 497, y: 202, width: 1417, height: 670},//剩余时间识别区域坐标和尺寸
}
const xyConfig = {
    top: {x: 344, y: 273},
    bottom: {x: 342, y: 791},
}

export class scroll {
    /**
     * 模拟页面滚动功能
     * @param {number} totalDistance - 总滚动距离
     * @param {boolean} [isUp=false] - 是否向上滚动，默认为向下滚动
     * @param {number} [waitCount=6] - 每隔多少步等待一次，默认为6步
     * @param {number} [stepDistance=30] - 每次滚动的步长距离，默认为30像素
     * @param {number} [delayMs=1000] - 每次等待的毫秒数，默认为1000毫秒
     * @returns {Promise<void>} - 返回一个Promise，表示滚动操作完成
     */
    static async page(totalDistance, isUp = false, waitCount = 6, stepDistance = 30, delayMs = 1000) {
        let ms = 600  // 初始延迟时间，单位毫秒
        await sleep(ms);  // 等待初始延迟时间
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
     * 根据活动滑动页面
     * @param {boolean} isUp - 滑动方向，true表示向上滑动，false表示向下滑动
     * @param {number} total - 滑动总量
     * @param {number} waitCount - 等待次数
     * @param {number} stepDistance - 每次滑动的步长距离
     * @param {number} scrollPageCount - 滑动页面的次数
     * @returns {Promise<void>} - 返回一个Promise，表示异步操作的完成
     */
    static async pagesByActivity(isUp = false, total = 90, waitCount = 6, stepDistance = 30, scrollPageCount = 4) {
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
            await scroll.page(total, isUp, waitCount, stepDistance)
        }
    }

    /**
     * 滚动到活动页面顶部的异步方法
     * @param {Object} ocrRegion - OCR识别区域配置，默认为ocrRegionConfig.activity
     * @returns {Promise<void>}
     * @throws {Error} 当超过最大尝试次数仍未回到顶部时抛出错误
     */
    static async pagesByActivityToTop(ocrRegion = ocrRegionConfig.activity) {
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
                    await scroll.pagesByActivity(true, 80 * 4, 6, 60, 1);
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
                await scroll.pagesByActivity(true, 80 * 4, 6, 60, 1);

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
     * 查找指定活动的静态异步方法
     * @param {string} name - 要查找的活动名称
     * @param {string} key - 活动中要匹配的关键字
     * @param {string} value - 关键字对应的值
     * @param {string} activityKey - 默认为"F5"，用于打开活动页面的按键
     * @returns {Object} 返回一个包含查找结果的对象，包含name、key、value三个布尔值属性
     */
    static async findActivity(name, key, value, activityKey = "F5") {
        const ms = 1000;  // 定义时间单位，1秒
        // 1. 打开活动页面（默认 F5）
        await keyPress(activityKey);  // 模拟按键打开活动页面
        await sleep(ms * 2);  // 等待2秒确保页面加载完成
        // 2. 先强制滚动到最顶部（非常重要！）
        try {
            await scroll.pagesByActivityToTop();  // 滚动到页面顶部
            await sleep(ms);  // 等待1秒确保滚动完成
        } catch (e) {
            log.warn("回到顶部失败，但继续尝试执行");  // 捕获并处理异常
        }
    // 初始化查找结果对象
        let findActivity = {
            name: false,
            key: false,
            value: false
        };

    // 如果未指定活动名称，直接返回失败结果
        if (!name) {
            log.warn("未指定活动名称，无法查找");
            return findActivity;
        }



    // 初始化底部检测相关变量
        let lastPageBottomName = null;  // 记录上一页底部活动名称
        let sameBottomCount = 0;  // 连续相同底部活动计数
        const sameBottomCountMax = 1;  // 最大连续相同次数
        let scannedPages = 0;  // 已扫描页数计数
        const maxPages = 25;  // 最大扫描页数限制
        let previousPageActivities = new Set();  // 存储上一页所有活动名称

        // 4. 主循环：逐页向下扫描
        while (scannedPages < maxPages) {
            scannedPages++;
            log.info(`正在扫描第 ${scannedPages} 页`);

            await moveMouseTo(0, 20);  // 移动鼠标到页面顶部

            let captureRegion = null;  // 初始化屏幕捕获区域
            try {
                captureRegion = captureGameRegion();  // 捕获游戏屏幕区域

            // 创建OCR识别对象
                const ocrObject = RecognitionObject.Ocr(
                    ocrRegionConfig.activity.x,
                    ocrRegionConfig.activity.y,
                    ocrRegionConfig.activity.width,
                    ocrRegionConfig.activity.height
                );
                let resList = captureRegion.findMulti(ocrObject);  // 使用OCR识别活动

            // 如果当前页没有识别到任何活动，视为已到底部
                if (resList.length === 0) {
                    log.info("当前页未识别到任何活动，视为已到页面底部");
                    break;
                }

                // ============ 重复页检测 ============
                const currentPageNames = new Set();  // 存储当前页所有活动名称
                for (let res of resList) {
                    currentPageNames.add(res.text.trim());  // 添加活动名称到集合
                }

            // 检测当前页与上一页的重合度
                if (previousPageActivities.size > 0) {
                    let overlapCount = 0;
                    for (let actName of currentPageNames) {
                        if (previousPageActivities.has(actName)) overlapCount++;
                    }
                    const overlapRatio = overlapCount / previousPageActivities.size;

                // 如果重合度超过70%，认为已到底部
                    if (overlapRatio >= 0.7) {
                        log.info(`检测到当前页与上一页高度重复（重合率 ${Math.round(overlapRatio * 100)}%），已到达底部，停止扫描`);
                        break;
                    }
                }
                previousPageActivities = currentPageNames;  // 更新上一页活动集合
                // ===================================

                let currentPageBottomName = null;  // 当前页底部活动名称
                let foundTarget = false;  // 是否找到目标活动标志

                // 遍历当前页所有识别到的活动条目
                for (let res of resList) {
                    const activityName = res.text.trim();  // 获取活动名称
                    currentPageBottomName = activityName;  // 更新底部活动名

                    // 【关键修改】检查是否是目标活动名称（精确匹配）
                    if (activityName.includes(name)) {
                        findActivity.name = true;  // 找到活动名称
                        log.info(`找到目标活动：${activityName}`);
                        await click(res.x, res.y);  // 点击活动
                        await sleep(ms);  // 等待1秒
                        foundTarget = true;  // 设置找到目标标志

                        // 如果没有指定 key，找到活动名称就直接返回成功
                        if (!key) {
                            log.info(`已找到指定活动 [${activityName}]，无需匹配关键字`);
                            findActivity.key = true;
                            break;
                        }

                        // 如果指定了 key，进行关键字匹配
                        const text = await Ocr.key(activityName, key);  // OCR识别关键字
                        if (text && text.includes(key)) {
                            log.info(`已找到指定活动 [${activityName}] 且包含关键字 [${key}]`);
                            findActivity.key = true;  // 找到关键字
                            if (value) {
                                findActivity.value = text.includes(value)  // 检查值
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
                await scroll.pagesByActivity(false);
                await sleep(ms);
            } finally {
                if (captureRegion) {
                    captureRegion.dispose();
                }
            }
        }
        return findActivity;
    }
}

export class Ocr{
    /**
     * 在指定区域进行OCR识别并匹配关键词
     * @param {string} activityName - 活动名称，用于日志记录
     * @param {string} key - 要匹配的关键词
     * @param {Object} ocrRegion - OCR识别区域配置，默认为剩余时间区域
     * @param {number} ocrRegion.x - 识别区域左上角X坐标
     * @param {number} ocrRegion.y - 识别区域左上角Y坐标
     * @param {number} ocrRegion.width - 识别区域宽度
     * @param {number} ocrRegion.height - 识别区域高度
     * @returns {string|null} 匹配到的文本列表（用'<-->'连接），未匹配到则返回null
     */
    static key(activityName, key, ocrRegion = ocrRegionConfig.remainingTime) {
        if (!key) {
            return null
        }
        let captureRegion = captureGameRegion();
        try {
            let list = new Array()
            const ocrObject = RecognitionObject.Ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
            let resList = captureRegion.findMulti(ocrObject);
            
            for (let res of resList) {
                log.debug(`[info][{key}]{activityName}--{time}`, key, activityName, res.text);
                if (res.text.includes(key)) {
                    log.debug(`[{key}][命中]{activityName}--{time}`, key, activityName, res.text);
                    list.push(res.text.trim())
                }
            }
            
            if (list.length > 0) {
                return list.join('<-->')
            }
            return null;

        } finally {
            captureRegion.dispose();
        }
    }
}

async function findStygianOnslaught() {
    const findActivity = {
        name: "幽境危战",
        key: "紊乱爆发期",
        value: "已结束",
    }
    const findResult = await scroll.findActivity(findActivity.name, findActivity.key, findActivity.value);
    if ((!findResult.name) || (findResult.name && findResult.key && findResult.value)) {
        // 幽境危战 紊乱爆发期 已结束
        return false
    }
    //正常模式
    return true
}

export {
    findStygianOnslaught
}