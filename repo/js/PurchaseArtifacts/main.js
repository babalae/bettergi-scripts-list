(async function () {
    
 async function Purchase(locationName) {       
        let filePath = `assets/${locationName}.json`;
        await pathingScript.runFile(filePath);
    }

/**
 * 在指定区域内查找并点击指定文字
 * @param {string} targetText - 要点击的目标文字
 * @param {number} x - 识别区域的左上角X坐标
 * @param {number} y - 识别区域的左上角Y坐标
 * @param {number} width - 识别区域的宽度
 * @param {number} height - 识别区域的高度
 * @param {object} options - 可选参数
 * @param {boolean} options.trimText - 是否对OCR结果进行trim处理，默认true
 * @param {boolean} options.clickCenter - 是否点击文字区域中心，默认true
 * @param {number} options.retryCount - 重试次数，默认1（不重试）
 * @param {number} options.retryInterval - 重试间隔(毫秒)，默认500
 * @returns {Promise<boolean>} 是否找到并点击了文字
 */
async function clickTextInRegion(targetText, x, y, width, height, options = {}) {
    const {
        trimText = true,
        clickCenter = true,
        retryCount = 1,
        retryInterval = 500
    } = options;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
            // 获取游戏区域截图
            const captureRegion = captureGameRegion();

            // 创建OCR识别对象，限定识别区域
            const ocrRo = RecognitionObject.ocr(x, y, width, height);
            
            // 在限定区域内进行OCR识别
            const results = captureRegion.findMulti(ocrRo);

            // 遍历OCR结果
            for (let i = 0; i < results.count; i++) {
                const res = results[i];
                let detectedText = res.text;
                
                // 可选：去除前后空白字符
                if (trimText) {
                    detectedText = detectedText.trim();
                }

                // 检查是否匹配目标文字
                if (detectedText === targetText) {
                    log.info(`找到目标文字: "${targetText}"，位置: (${res.x}, ${res.y}, ${res.width}, ${res.height})`);
                    
                    if (clickCenter) {
                        // 点击文字区域中心
                        await sleep(200);
                        keyDown("VK_LMENU");
                        await sleep(500);
                        res.click();
                        await sleep(100);
                        keyUp("VK_LMENU");
                        log.info(`已点击文字中心: "${targetText}"`);

                    } else {
                        // 点击文字区域的左上角
                        res.clickTo(0, 0);
                        log.info(`已点击文字偏移位置: "${targetText}"`);
                    }
                    
                   
                    return true;
                }
            }

            // 如果当前尝试未找到，且还有重试机会，则等待后重试
            if (attempt < retryCount) {
                log.info(`第${attempt + 1}次尝试未找到文字"${targetText}"，${retryInterval}ms后重试...`);
                await sleep(retryInterval);
            }
        } catch (error) {
            log.error(`点击文字"${targetText}"时发生错误: ${error.message}`);
            if (attempt < retryCount) {
                await sleep(retryInterval);
            }
        }
    }

    log.info(`未找到文字: "${targetText}"，已尝试${retryCount + 1}次`);
    return false;
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

    try {
        // 读取文件内容
        let content = await file.readText(filePath);
        const lastTime = new Date(content);
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
        
        // 如果文件内容无效或不存在，视为需要刷新
        if (!content || isNaN(lastTime.getTime())) {
            await file.writeText(filePath, '');
            shouldRefresh = true;
        }
        
        if (shouldRefresh) {
            notification.send(`购买狗粮已经刷新，执行脚本`);

            
            return true;
        } else {
            log.info(`购买狗粮未刷新`);
            return false;
        }
        
    } catch (error) {
        // 如果文件不存在，创建新文件并返回true(视为需要刷新)
        const createResult = await file.writeText(filePath, '');
        if (createResult) {
            log.info("创建新时间记录文件成功，执行脚本");
            return true;
        }
        else throw new Error(`创建新文件失败`);
    }
}


//基本购买流程
   async function Shopping() {
        await sleep(1500);
        for (let j = 0; j < 4; j++) {
    keyPress("F"); await sleep(1800);//对话
         }
        for (let i = 0; i < 5; i++) {
  click(1690, 1020); await sleep(500); // 购买
  click(1170, 780); await sleep(400); // 确定
  click(1690, 1020); await sleep(200); // 点击空白处
        }
        keyPress("ESCAPE"); await sleep(2000);
    }

   async function main() {
    if(settings.select1){
    await Purchase('蒙德购买狗粮');
    await Shopping();
    }

    if(settings.select2){
    await Purchase('璃月购买狗粮1');
    await Shopping();
    }

    if(settings.select3){
    await Purchase('璃月购买狗粮2');
    await sleep(1000);
    keyDown("w");
    await sleep(600);
    keyUp("w");
    await sleep(1000);
    keyPress("F"); await sleep(1200);
    keyPress("F"); await sleep(1800);
    await clickTextInRegion("我想买些古董。", 1264, 532, 370, 160);
    await sleep(500);
    keyPress("F"); await sleep(1200);
    keyPress("F"); await sleep(1800);
    for (let i = 0; i < 5; i++) {
  click(1690, 1020); await sleep(500); // 购买
  click(1170, 780); await sleep(400); // 确定
  click(1690, 1020); await sleep(200); // 点击空白处
        }
    keyPress("ESCAPE"); await sleep(2000);
    }

    if(settings.select4){
    await Purchase('稻妻购买狗粮');
    await sleep(1500);
        for (let j = 0; j < 5; j++) {
    keyPress("F"); await sleep(1800);//对话
         }
        click(200, 400); await sleep(500); // 选择狗粮
        for (let i = 0; i < 5; i++) {
  click(1690, 1020); await sleep(500); // 购买
  click(1170, 780); await sleep(400); // 确定
  click(1690, 1020); await sleep(200); // 点击空白处
        }
        keyPress("ESCAPE"); await sleep(2000);
       }
    if(settings.select5){
    await Purchase('须弥购买狗粮');
    await Shopping();
    }

    if(settings.select6){
    await Purchase('枫丹购买狗粮');
    await Shopping();
    }

    if(settings.select7){
    await Purchase('纳塔购买狗粮');
    await sleep(1000);
    keyDown("a");
    await sleep(500);
    keyUp("a");
    await Shopping();
    }

    if(settings.select8){
    await Purchase('挪德卡莱购买狗粮');
    await Shopping();
    }

    await file.writeText("assets/weekly.txt", new Date().toISOString());
}

//每周四4点刷新 
if( await isTaskRefreshed("assets/weekly.txt", {
    refreshType: 'weekly',
    weeklyDay: 4, // 周一
    weeklyHour: 4 // 凌晨4点
})){
await main();
}

})();
