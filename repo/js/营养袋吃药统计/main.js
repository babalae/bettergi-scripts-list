let userName = settings.userName || "默认账户";
const recoveryFoodName = settings.recoveryFoodName || "回血药名字没填";
const resurrectionFoodName = settings.resurrectionFoodName || "复活药名字没填";
const ocrRegion = {
        x: 150,
        y: 250,
        width: 220,
        height: 270
    };
(async function () {
    // 检验账户名
    async function getUserName() {
        userName = userName.trim();
    //数字，中英文，长度在20个字符以内
        if (!userName || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(userName)) {
            log.error(`账户名${userName}违规，暂时使用默认账户名，请查看readme后修改`)
            userName = "默认账户";
        }
        return userName;
    }
     /**
     * 文字OCR识别封装函数（支持空文本匹配任意文字）
     * @param {string} text - 要识别的文字，默认为"空参数"，空字符串会匹配任意文字
     * @param {number} timeout - 超时时间，单位为秒，默认为10秒
     * @param {number} afterBehavior - 点击模式，0=不点击，1=点击文字位置，2=按F键，默认为0
     * @param {number} debugmodel - 调试模式，0=无输出，1=基础日志，2=详细输出，3=立即返回，默认为0
     * @param {number} x - OCR识别区域起始X坐标，默认为0
     * @param {number} y - OCR识别区域起始Y坐标，默认为0
     * @param {number} w - OCR识别区域宽度，默认为1920
     * @param {number} h - OCR识别区域高度，默认为1080
     * @param {number} matchMode - 匹配模式，0=包含匹配，1=精确匹配，默认为0
     * @returns {object} 包含识别结果的对象 {text, x, y, found}
     */
    async function textOCREnhanced(
          text = "空参数",
          timeout = 10,
          afterBehavior = 0,
          debugmodel = 0,
          x = 0,
          y = 0,
          w = 1920,
          h = 1080,
          matchMode = 0
     ) {
          const startTime = Date.now();
          const timeoutMs = timeout * 1000;
          let lastResult = null;
          let captureRegion = null; // 用于存储截图对象

          // 只在调试模式1下输出基本信息
          if (debugmodel === 1) {
               if (text === "") {
                    log.info(`OCR: 空文本模式 - 匹配任意文字`);
               } else if (text === "空参数") {
                    log.warn(`OCR: 使用默认参数"空参数"`);
               }
          }

          while (Date.now() - startTime < timeoutMs) {
               try {
                    // 获取截图并进行OCR识别
                    captureRegion = captureGameRegion();
                    const resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));

                    // 遍历识别结果
                    for (let i = 0; i < resList.count; i++) {
                         const res = resList[i];

                         // 检查是否匹配
                         let isMatched = false;
                         if (text === "") {
                              // 空文本匹配任意文字
                              isMatched = true;
                         } else if (matchMode === 1) {
                              // 精确匹配
                              isMatched = res.text === text;
                         } else {
                              // 包含匹配（默认）
                              isMatched = res.text.includes(text);
                         }

                         if (isMatched) {
                              // 只在调试模式1下输出匹配成功信息
                              if (debugmodel === 1) {
                                   log.info(`OCR成功: "${res.text}" 位置(${res.x},${res.y})`);
                              }

                              // 调试模式3: 立即返回
                              if (debugmodel === 3) {
                                   // 释放内存
                                   if (captureRegion) {
                                        captureRegion.dispose();
                                   }
                                   return { text: res.text, x: res.x, y: res.y, found: true };
                              }

                              // 执行后续行为
                              switch (afterBehavior) {
                                   case 1: // 点击文字位置
                                        await sleep(1000);
                                        click(res.x, res.y);
                                        break;
                                   case 2: // 按F键
                                        await sleep(100);
                                        keyPress("F");
                                        break;
                                   default:
                                        // 不执行任何操作
                                        break;
                              }

                              // 记录最后一个匹配结果但不立即返回
                              lastResult = { text: res.text, x: res.x, y: res.y, found: true };
                         }
                    }

                    // 释放截图对象内存
                    if (captureRegion) {
                         captureRegion.dispose();
                    }

                    // 如果找到匹配结果，根据调试模式决定是否立即返回
                    if (lastResult && debugmodel !== 2) {
                         return lastResult;
                    }

                    // 短暂延迟后继续下一轮识别
                    await sleep(100);

               } catch (error) {
                    // 发生异常时释放内存
                    if (captureRegion) {
                         captureRegion.dispose();
                    }
                    log.error(`OCR异常: ${error.message}`);
                    await sleep(100);
               }
          }

          if (debugmodel === 1) {
               // 超时处理
               if (text === "") {
                    log.info(`OCR超时: ${timeout}秒内未找到任何文字`);
               } else {
                    log.info(`OCR超时: ${timeout}秒内未找到"${text}"`);
               }
          }

          // 返回最后一个结果或未找到
          return lastResult || { found: false };
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
    async function checkRefreshStatus(filePath, options = {}) {
        const {
            refreshType = 'daily', // 默认每小时刷新
            customHours = 24,       // 自定义刷新小时数默认24
            dailyHour = 4,          // 每日刷新默认凌晨4点
            weeklyDay = 1,          // 每周刷新默认周一(0是周日)
            weeklyHour = 4,         // 每周刷新默认凌晨4点
            monthlyDay = 1,         // 每月刷新默认第1天
            monthlyHour = 4          // 每月刷新默认凌晨4点
        } = options;

        try {
            // 读取文件内容
            let content = await file.readText(filePath);
            const parts = content.split("|");

            if (parts.length < 3) {
                return { refreshed: true, recovery: 0, resurrection: 0 };
            }
            const lastTime = new Date(parts[0]);
            const savedRecovery = parseInt(parts[1]) || 0;
            const savedResurrection = parseInt(parts[2]) || 0;
            const nowTime = new Date();

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

            return {
                refreshed: shouldRefresh,
                recovery: savedRecovery,
                resurrection: savedResurrection
            };

        } catch (error) {
            // 文件不存在时视为需要刷新
            return { refreshed: true, recovery: 0, resurrection: 0 };
        }
    }

//  背包过期物品识别，需要在背包界面，并且是1920x1080分辨率下使用
    async function handleExpiredItems() {
          const ifGuoqi = await textOCREnhanced("物品过期", 1.5, 0, 3, 870, 280, 170, 40);
          if (ifGuoqi.found) {
               log.info("检测到过期物品，正在处理...");
               await sleep(500);
               await click(980, 750); // 点击确认按钮，关闭提示
          }
          else { log.info("未检测到过期物品"); }
     }

    async function recognizeNumberByOCR(ocrRegion, pattern) {
    try {
        // 直接链式调用，避免内存管理问题
        const ocrRo = RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        const resList = captureGameRegion().findMulti(ocrRo);

        if (!resList || resList.length === 0) {
            log.warn("OCR未识别到任何文本");
            return null;
        }

        for (const res of resList) {
            if (!res || !res.text) {
                continue;
            }

            const numberMatch = res.text.match(pattern);
            if (numberMatch) {
                const number = parseInt(numberMatch[1] || numberMatch[0]);
                if (!isNaN(number)) {
                    return number;
                }
            }
        }
    } catch (error) {
        log.error(`OCR识别时发生异常: ${error.message}`);
    }
    return null;
}

    async function getFoodNum(){
        keyPress("B");//打开背包
        await handleExpiredItems(); //处理过期物品弹窗
        await sleep(2000);
        click(863, 51);//选择食物
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(110, 110);//输入名字
        await sleep(1000);
        inputText(recoveryFoodName);
        await sleep(500);
        click(490, 1020);//确认筛选
        await sleep(1000);
        var recoveryNumber=await recognizeNumberByOCR(ocrRegion,/\d+/) //识别回血药数量
        // 处理回血药识别结果
        if (recoveryNumber === null) {
            recoveryNumber = 0;
            notification.send(`未识别到回血药数量，设置数量为0，药品名：${recoveryFoodName}`)
        }
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(110, 110);//输入名字
        await sleep(1000);
        inputText(resurrectionFoodName);
        await sleep(500);
        click(490, 1020);//确认筛选
        await sleep(1000);
        var resurrectionNumber=await recognizeNumberByOCR(ocrRegion,/\d+/) //识别复活药数量
        // 处理复活药识别结果
        if (resurrectionNumber === null) {
            resurrectionNumber = 0;
            notification.send(`未识别到复活药数量，设置数量为0，药品名：${resurrectionFoodName}`)
        }
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(490, 1020);//确认筛选
        await genshin.returnMainUi();
        return { recoveryNumber, resurrectionNumber };
    }

    async function main() {
    // 设置分辨率和缩放
    setGameMetrics(1920, 1080, 1);
    // 点击领月卡
    await genshin.blessingOfTheWelkinMoon();
    await sleep(1000);
    await genshin.returnMainUi();
    await sleep(1000);
    // 获取食物数量
    return await getFoodNum();
    }

    // 主执行流程
    userName = await getUserName();
    const recordPath = `assets/${userName}.txt`;
    // 检查刷新状态
    const refreshStatus = await checkRefreshStatus(recordPath, { dailyHour: 4 });
    // 获取当前药物数量
    const { recoveryNumber, resurrectionNumber } = await main();
    // initSelect处理逻辑
    if (settings.initSelect) {
        // 获取当前时间戳
        const currentTime = new Date().toISOString();
        // 构建保存内容：时间戳|回血药数量|复活药数量
        const saveContent = `${currentTime}|${recoveryNumber}|${resurrectionNumber}`;
        try {
            // 写入本地文件
            await file.writeText(recordPath, saveContent);
            notification.send(`${userName}: 强制初始化完成！${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`);
        } catch (error) {
            notification.send(`${userName}: 药品保存失败！`);
        }
        return; // 终止后续流程
    }
    if (refreshStatus.refreshed) {
        // 今日未初始化 - 写入初始数量
        await file.writeText(recordPath, `${new Date().toISOString()}|${recoveryNumber}|${resurrectionNumber}`);
        // 添加账户名称的通知
        notification.send(`${userName}: 今日初始化完成！${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`);
    } else {
        // 使用初始数量进行对比
        const initialRecovery = refreshStatus.recovery;
        const initialResurrection = refreshStatus.resurrection;

        // 计算消耗/增加数量
        const diffRecovery = initialRecovery - recoveryNumber;
        const diffResurrection = initialResurrection - resurrectionNumber;

        let logMsg = "";

        if (diffRecovery > 0 || diffResurrection > 0) {
            // 数量减少
            logMsg = `${userName}: 今日消耗：${recoveryFoodName}${diffRecovery}个，${resurrectionFoodName}${diffResurrection}个`;
        } else if (diffRecovery < 0 || diffResurrection < 0) {
            // 数量增加
            const addRecovery = -diffRecovery;
            const addResurrection = -diffResurrection;
            logMsg = `${userName}: 今日新增：${recoveryFoodName}${addRecovery}个，${resurrectionFoodName}${addResurrection}个`;
        } else {
            // 数量无变化
            logMsg = `${userName}: 今日药物数量无变化`;
        }

        // 添加库存信息
        logMsg += ` | 当前库存：${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`;
        // 发送通知
        notification.send(logMsg);
    }
})();
