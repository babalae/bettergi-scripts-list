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
    // 数字，中英文，长度在20个字符以内
        if (!userName || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(userName)) {
            log.error(`账户名${userName}违规，暂时使用默认账户名，请查看readme后修改`)
            userName = "默认账户";
        }
        return userName;
    }

    // 格式化日期为 YYYY/MM/DD
    async function formatDate(date) {
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    }

    // 获取适用于记录的日期（根据刷新时间调整）
    async function getRecordDate() {
        const now = new Date();
        const currentHour = now.getHours();
        // 如果当前时间在刷新时间之前，使用昨天的日期
        if (currentHour < 4) {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            return yesterday;
        }
        return now;
    }

    // 处理旧格式记录文件
    async function migrateOldFormatRecords(filePath) {
    try {
        const content = await file.readText(filePath);
        const lines = content.split('\n').filter(line => line.trim());

        // 检查是否有旧格式的记录（如2025-12-10T02:02:32.460Z|179|546）
        const hasOldFormat = lines.some(line =>
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|\d+\|\d+$/.test(line)
        );

        if (hasOldFormat) {
            // 直接清空文件（不创建备份）
            await file.writeText(filePath, '');
            notification.send(`${settings.userName}: 检测到旧格式记录，已重置记录文件`);
            return true;
        }
    } catch (error) {
        // 文件不存在或其他错误
    }
    return false;
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
        // 首先检查并删除旧格式记录
        await migrateOldFormatRecords(filePath);
        try {
            // 读取文件内容
            const content = await file.readText(filePath);
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                return { refreshed: true, recovery: 0, resurrection: 0 };
            }

            // 解析最新一条记录
            const lastLine = lines[lines.length - 1];
            const match = lastLine.match(/日期:(\d{4}\/\d{2}\/\d{2})，(.+)-(\d+)，(.+)-(\d+)/);

            if (!match) return { refreshed: true, recovery: 0, resurrection: 0 };

            const lastDate = new Date(match[1]);
            lastDate.setHours(dailyHour, 0, 0, 0);
            const recoveryNum = parseInt(match[3]);
            const resurrectionNum = parseInt(match[5]);
            const nowTime = new Date();
            let shouldRefresh = false;


            switch (refreshType) {
                case 'daily': {// 每天固定时间刷新
                    // 计算从上次记录到现在的小时数
                    const diffHours = (nowTime - lastDate) / (1000 * 60 * 60);

                    // 如果距离上次记录超过24小时，或者当前时间在刷新时间之后但日期变化
                    if (diffHours >= 24 ||
                        (nowTime.getDate() !== lastDate.getDate() &&
                         nowTime.getHours() >= dailyHour)) {
                        shouldRefresh = true;
                    }
                    break;
                }
                default:
                    throw new Error(`未知的刷新类型: ${refreshType}`);
            }

            return {
                refreshed: shouldRefresh,
                recovery: recoveryNum,
                resurrection: resurrectionNum
            };

        } catch (error) {
            // 文件不存在时视为需要刷新
            return { refreshed: true, recovery: 0, resurrection: 0 };
        }
    }

    // 管理记录文件（限制30条）
    async function updateRecord(filePath, recoveryNum, resurrectionNum) {
        const recordDate = await getRecordDate();
        const dateStr = await formatDate(recordDate);
        const newLine = `日期:${dateStr}，${settings.recoveryFoodName}-${recoveryNum}，${settings.resurrectionFoodName}-${resurrectionNum}`;
    try {
        // 首先检查并删除旧格式记录
        await migrateOldFormatRecords(filePath);

        let content = await file.readText(filePath);
        let lines = content.split('\n').filter(line => line.trim());
        let updated = false;

        // 检查最后一行是否与要写入的日期相同
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];

            // 正则匹配最后一行中的日期
            const lastDateMatch = lastLine.match(/日期:(\d{4}\/\d{2}\/\d{2})/);

            if (lastDateMatch && lastDateMatch[1] === dateStr) {
                // 替换最后一行
                lines[lines.length - 1] = newLine;
                updated = true;
            }
        }

        // 如果日期不同或没有匹配，添加新行
        if (!updated) {
            lines.push(newLine);
        }

        // 只保留最近30条记录
        if (lines.length > 30) {
            lines = lines.slice(-30);
        }

        await file.writeText(filePath, lines.join('\n'));
        return true;
    } catch (error) {
        // 文件不存在时创建新文件
        await file.writeText(filePath, newLine);
        return true;
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
    let captureRegion = null;
    try {
        const ocrRo = RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        captureRegion = captureGameRegion();
        const resList = captureRegion.findMulti(ocrRo);

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
    }
    catch (error) {
        log.error(`OCR识别时发生异常: ${error.message}`);
    }
    finally {
        if (captureRegion) {
            captureRegion.dispose();
        }
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
        await updateRecord(recordPath, recoveryNumber, resurrectionNumber);
        notification.send(`${userName}: 强制初始化完成！${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`);
        return;
    }
    if (refreshStatus.refreshed) {
        // 今日未初始化 - 写入初始数量
        await updateRecord(recordPath, recoveryNumber, resurrectionNumber);
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


        // 处理回血药描述
        let descRecovery = "";
        if (diffRecovery > 0) {
            descRecovery = `消耗${recoveryFoodName}${diffRecovery}个`;
        } else if (diffRecovery < 0) {
            descRecovery = `新增${recoveryFoodName}${-diffRecovery}个`;
        } else {
            descRecovery = `${recoveryFoodName}无变化`;
        }

        // 处理复活药描述
        let descResurrection = "";
        if (diffResurrection > 0) {
            descResurrection = `消耗${resurrectionFoodName}${diffResurrection}个`;
        } else if (diffResurrection < 0) {
            descResurrection = `新增${resurrectionFoodName}${-diffResurrection}个`;
        } else {
            descResurrection = `${resurrectionFoodName}无变化`;
        }

        // 根据变化组合日志消息
        if (diffRecovery === 0 && diffResurrection === 0) {
            // 两个值都等于0，输出无变化
            logMsg = `${userName}: 今日药物数量无变化`;
        }else {
            // 其他情况
            logMsg = `${userName}: 今日${descRecovery}，${descResurrection}`;
        }

        // 添加库存信息
        logMsg += ` | 当前库存：${recoveryFoodName}${recoveryNumber}个, ${resurrectionFoodName}${resurrectionNumber}个`;
        // 发送通知
        notification.send(logMsg);
    }
})();
