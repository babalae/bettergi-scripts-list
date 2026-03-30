import {ocrUid} from "./utils/uid.js";
import {toMainUi, throwError} from "./utils/tool.js";

const config = {
    tryRe: {
        max: 3,
        count: 0
    },
    user: {
        uid: undefined
    },
    send_notification: false
}

/**
 * 判断任务是否已刷新
 * @param {string} filePath - 存储最后完成时间的文件路径
 * @param {object} options - 配置选项
 * @param {string} [options.refreshType] - 刷新类型: 'hourly'|'daily'|'weekly'|'monthly'|'custom'
 * @param {number} [options.customHours] - 自定义小时数(用于'custom'类型)
 * @param {number} [options.dailyHour=4] - 每日刷新的小时(0-23)
 * @param {number} [options.weeklyDay=1] - 每周刷新的星期(0-6, 0是周日)
 * @param {number} [options.weeklyHour=4] - 每周刷新的小时(0-23)
 * @param {number} [options.monthlyDay=1] - 每月刷新的日期(1-31)
 * @param {number} [options.monthlyHour=4] - 每月刷新的小时(0-23)
 * @returns {Promise<boolean>} - 是否已刷新
 */
async function isTaskRefreshed(filePath, options = {}) {
    const {
        refreshType = 'hourly', // 默认每小时刷新
        customHours = 24,       // 自定义刷新小时数默认24
        dailyHour = 4,          // 每日刷新默认凌晨4点
        weeklyDay = 1,          // 每周刷新默认周一(0是周日)
        weeklyHour = 4,         // 每周刷新默认凌晨4点
        monthlyDay = 1,         // 每月刷新默认第1天
        monthlyHour = 4          // 每月刷新默认凌晨4点
    } = options;
    config.tryRe.count++
    const retry = config.tryRe;
    const try_count_max = retry.max
    const try_count = retry.count
    if (try_count_max < try_count) {
        throw new Error("已重试" + (try_count - 1) + "次数,超出最大重试" + try_count_max + "次数");
    }
    if (!config.user.uid) {
        const resolvedUid = await ocrUid();
        if (!Number.isInteger(resolvedUid) || resolvedUid <= 0) {
              throw new Error(`UID 识别失败: ${resolvedUid}`);
        }
        config.user.uid = resolvedUid;
    }
    const uid = config.user.uid;
    const current = {uid: uid, time: undefined}
    // 读取文件内容
    let contentList = [];
    try {
        contentList = JSON.parse(file.readTextSync(filePath))
    } catch (e) {
        log.debug("warn:" + e.message)
    }
    const last = contentList.find(item => item.uid === uid)
    const lastTimeNumber = last?.time
    const lastTime = lastTimeNumber ? new Date(lastTimeNumber) : new Date(0);
    try {
        const nowTime = new Date();
        current.time = nowTime.getTime();

        let shouldRefresh = false;


        switch (refreshType) {
            case 'hourly': // 每小时刷新
                shouldRefresh = (nowTime - lastTime) >= 3600 * 1000;
                break;

            case 'daily': // 每天固定时间刷新
                // 检查是否已经过了当天的刷新时间
                const todayRefresh = new Date(nowTime);
                todayRefresh.setHours(dailyHour, 0, 0, 0);

                // 如果当前时间已经过了今天的刷新时间，检查上次完成时间是否在今天刷新之前
                if (nowTime >= todayRefresh) {
                    shouldRefresh = lastTime < todayRefresh;
                } else {
                    // 否则检查上次完成时间是否在昨天刷新之前
                    const yesterdayRefresh = new Date(todayRefresh);
                    yesterdayRefresh.setDate(yesterdayRefresh.getDate() - 1);
                    shouldRefresh = lastTime < yesterdayRefresh;
                }
                break;

            case 'weekly': // 每周固定时间刷新
                // 获取本周的刷新时间
                const thisWeekRefresh = new Date(nowTime);
                // 计算与本周指定星期几的差值
                const dayDiff = (thisWeekRefresh.getDay() - weeklyDay + 7) % 7;
                thisWeekRefresh.setDate(thisWeekRefresh.getDate() - dayDiff);
                thisWeekRefresh.setHours(weeklyHour, 0, 0, 0);

                // 如果当前时间已经过了本周的刷新时间
                if (nowTime >= thisWeekRefresh) {
                    shouldRefresh = lastTime < thisWeekRefresh;
                } else {
                    // 否则检查上次完成时间是否在上周刷新之前
                    const lastWeekRefresh = new Date(thisWeekRefresh);
                    lastWeekRefresh.setDate(lastWeekRefresh.getDate() - 7);
                    shouldRefresh = lastTime < lastWeekRefresh;
                }
                break;

            case 'monthly': // 每月固定时间刷新
                // 获取本月的刷新时间
                const thisMonthRefresh = new Date(nowTime);
                // 设置为本月指定日期的凌晨
                thisMonthRefresh.setDate(monthlyDay);
                thisMonthRefresh.setHours(monthlyHour, 0, 0, 0);

                // 如果当前时间已经过了本月的刷新时间
                if (nowTime >= thisMonthRefresh) {
                    shouldRefresh = lastTime < thisMonthRefresh;
                } else {
                    // 否则检查上次完成时间是否在上月刷新之前
                    const lastMonthRefresh = new Date(thisMonthRefresh);
                    lastMonthRefresh.setMonth(lastMonthRefresh.getMonth() - 1);
                    shouldRefresh = lastTime < lastMonthRefresh;
                }
                break;

            case 'custom': // 自定义小时数刷新
                shouldRefresh = (nowTime - lastTime) >= customHours * 3600 * 1000;
                break;

            default:
                throw new Error(`未知的刷新类型: ${refreshType}`);
        }

        // // 如果文件内容无效或不存在，视为需要刷新
        // if (!contentList || isNaN(lastTime.getTime())) {
        //     //todo:写入也要改 contentList.put(uid, nowTime.toISOString())
        //     // await file.writeText(filePath, JSON.stringify(contentList));
        //     shouldRefresh = true;
        // }
        try {
            if (shouldRefresh) {
                const message = `任务已刷新，执行每月兑换抽卡资源`;
                log.info(message)
                if (config.send_notification) {
                    notification.send(message);
                }
                await exchangeGoods();

                if (contentList.some(item => item.uid === current.uid)) {
                    contentList.forEach(item => {
                        if (item.uid === current.uid) {
                            item.time = current.time;
                        }
                    })
                } else {
                    contentList.push(current);
                }

                // 更新最后完成时间
                await file.writeText(filePath, JSON.stringify(contentList));
                return true;
            } else {
                const message = `任务未刷新，跳过每月兑换抽卡资源`;
                log.info(message)
                if (config.send_notification) {
                    notification.send(message);
                }
                return false;
            }
        } finally {
            log.debug("contentList:", JSON.stringify(contentList))
        }
    } catch (error) {
        log.error(`刷新任务失败: ${error}`);
        const createResult = await file.writeText(filePath, JSON.stringify(contentList));
        if (createResult) {
            log.debug("创建新文件成功");
            await isTaskRefreshed(filePath, options = {});
        }
    }
}

//检查是否为正整数
function positiveIntegerJudgment(testNumber) {
    // 如果输入是字符串，尝试转换为数字
    if (typeof testNumber === 'string') {
        // 移除可能存在的非数字字符（如空格、百分号等）
        const cleaned = testNumber.replace(/[^\d]/g, '');
        testNumber = parseInt(cleaned, 10);
    }

    // 检查是否为有效的数字
    if (typeof testNumber !== 'number' || isNaN(testNumber)) {
        throw new Error(`无效的值: ${testNumber} (必须为数字)`);
    }

    // 检查是否为整数
    if (!Number.isInteger(testNumber)) {
        throw new Error(`必须为整数: ${testNumber}`);
    }

    return testNumber;
}

async function exchangeGoods() {
    await toMainUi();
    await sleep(1000);
    keyPress("ESCAPE");
    await sleep(2000);//呼叫派蒙
    click(198, 416);
    await sleep(2000);//点击商城
    click(127, 434);
    await sleep(1000);//尘辉兑换
    click(998, 125);
    await sleep(1000);//星辰兑换
    let materialQuantity = "";
    //检查星辰的数量
    const region = RecognitionObject.ocr(1400, 31, 150, 50); // 星辰数量区域
    let capture = captureGameRegion();
    try {
        let res = capture.find(region);
        materialQuantity = res.text;
    } finally {
        if (capture) {
            capture.dispose();
        }
    }

    const pinkBallRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/pinkBall.png"));
    let ro1 = captureGameRegion();
    let pinkBallExist = false
    let pinkBall
    try {
        let pinkBallFind = ro1.find(pinkBallRo);
        pinkBallExist = pinkBallFind.isExist();
        pinkBall = {
            x: pinkBallFind.x,
            y: pinkBallFind.y
        }
    } finally {
        if (ro1) {
            ro1.dispose();
        }
    }

    const blueBallRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/blueBall.png"));
    let ro2 = captureGameRegion();
    let blueBallExist = false
    let blueBall
    try {
        let blueBallFind = ro2.find(blueBallRo);
        blueBallExist = blueBallFind.isExist();
        blueBall = {
            x: blueBallFind.x,
            y: blueBallFind.y
        }
    } finally {
        if (ro2) {
            ro2.dispose();
        }
    }

    if (!pinkBallExist && !blueBallExist) {
        log.info(`没有粉球和蓝球，跳过兑换`);
        return
    }

    let validatedMaterialQuantity = positiveIntegerJudgment(materialQuantity);
    if (validatedMaterialQuantity < 750) {
        throwError(`星尘数量为：${validatedMaterialQuantity}，数量不足，无法全部兑换`, config.send_notification)
        // notification.send(`星尘数量为：${validatedMaterialQuantity}，无法全部兑换`);
        // throw new Error(`星尘数量为：${validatedMaterialQuantity}，不能完全兑换`);
    }
    log.info(`星尘数量为：${validatedMaterialQuantity}，数量充足，可以全部兑换`);

    if (pinkBallExist && pinkBall) {
        // pinkBall.click();
        click(pinkBall.x, pinkBall.y)
        await sleep(1000);
        click(1290, 604);
        await sleep(500);//增加
        click(1290, 604);
        await sleep(500);//增加
        click(1290, 604);
        await sleep(500);//增加
        click(1290, 604);
        await sleep(500);//增加
        click(1164, 782);
        await sleep(500);//确认兑换
        click(960, 754);
        await sleep(1000);//点击空白处继续
    }

    if (blueBallExist && blueBall) {
        // blueBall.click();
        click(blueBall.x, blueBall.y)
        await sleep(1000);
        click(1290, 604);
        await sleep(500);//增加
        click(1290, 604);
        await sleep(500);//增加
        click(1290, 604);
        await sleep(500);//增加
        click(1290, 604);
        await sleep(500);//增加
        click(1164, 782);
        await sleep(500);//确认兑换
        click(960, 754);
        await sleep(1000);//点击空白处继续
    }
    const message = `商城抽卡资源兑换完成`;
    log.info(message)
    if (config.send_notification) {
        notification.send(message);
    }
}

async function main() {
    try {
        config.tryRe.max = parseInt(settings.try_count_max + "") || config.tryRe.max
        config.send_notification = settings.send_notification
    } catch (e) {
    }
    try {
        await isTaskRefreshed("assets/monthly.txt", {
            refreshType: 'monthly',
            monthlyDay: 1,    // 每月第1天（默认值，可省略）
            monthlyHour: 4    // 凌晨4点（默认值，可省略）
        });
    } finally {
        await toMainUi()
    }
}

await main();
