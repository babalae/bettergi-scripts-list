(async function () {

  let anchorType = settings.anchorType;
  let firstRecord = 1;
  /**
   * 等待图片出现并点击
   * @param {string} imageName 图片名称（不带.png后缀且在assets文件中）
   * @param {number} [timeout=20000] 超时时间（毫秒），默认20秒
   * @param {number} [checkInterval=500] 检查间隔（毫秒），默认500毫秒
   * @returns {Promise<void>}
   * @throws 如果超时未找到图片则抛出错误
   */
// 使用示例：
// await waitAndClickImage("paimon_menu");
// await waitAndClickImage("confirm_button",false,9000);
//
// (2) 自定义偏移量和是否点击，可以用于检测是否有图片
// await waitAndClickImage("confirm_button",false,7000);
//滚动查询偏移点击
// await waitAndClickImage("confirm_button",true,20000,758,60,true,1);
  const waitAndClickImage = async (
    imageName,
    ifClick = true,
    timeout = 20000,
    extraWidth = 10,
    extraHeight = 10,
    ifScroll = false,
    scrollNum = 3,
    checkInterval = 500,
    threshold = 0.9 // 新增阈值参数，默认值0.8
  ) => {
    const startTime = Date.now();
    const imagePath = `assets/${imageName}.png`;

    // 读取模板图片
    const templateMat = file.ReadImageMatSync(imagePath);
    const recognitionObj = RecognitionObject.TemplateMatch(templateMat, 0, 0, 1920, 1080);
    recognitionObj.threshold = threshold;

    // 使用 try-finally 确保模板图像被释放
    try {
      while (Date.now() - startTime < timeout) {
        // 捕获游戏区域


        const captureRegion = captureGameRegion();

        // 使用 try-finally 确保每次循环的资源被释放
        try {
          // 查找图片
          const result = captureRegion.Find(recognitionObj);

          // 使用 try-finally 确保结果对象被释放
          try {
            if (!result.isEmpty()) {

              await sleep(400); // 点击前稍作等待
              if (ifClick) {
                click(result.x + extraWidth, result.y + extraHeight);
                log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
              } else {
                log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})`);
              }
              await sleep(200); // 点击后稍作等待
              return true;
            }
          } finally {
            // 释放结果对象
            if (result && result.Dispose) {
              result.Dispose();
            }
          }
        } finally {
          // 释放捕获区域
          if (captureRegion && captureRegion.Dispose) {
            captureRegion.Dispose();
          }
        }

        await sleep(checkInterval);

        if (ifScroll) {
          for (let i = 0; i < scrollNum; i++) {
            await keyMouseScript.runFile("assets/滚轮下滑.json");
            await sleep(50);
          }
          await sleep(500);
        }
      }
    } finally {
      // 释放模板图像
      if (templateMat && templateMat.Dispose) {
        templateMat.Dispose();
      }
    }

    throw new Error(`等待图片 ${imageName} 超时`);
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
        firstRecord = 0;
        await file.writeText(filePath, "");
        shouldRefresh = true;
      }

      if (shouldRefresh) {
        //刷新返回true
        return true;
      } else {
        //未刷新返回false
        return false;
      }

    } catch (error) {
      // 如果文件不存在，创建新文件并返回true(视为需要刷新)
      const createResult = await file.writeText(filePath, '');
      if (createResult) {
        log.info("创建新时间记录文件成功，执行脚本");
        firstRecord = 0;
        return true;
      } else throw new Error(`创建新文件失败`);
    }
  }


  async function main() {
    const isRefreshed = await isTaskRefreshed('assets/dateRecord.txt', {
      refreshType: 'custom',
      customHours: 140
    });

    const ifOutOfDate = await isTaskRefreshed('assets/dateRecord.txt', {
      refreshType: 'custom',
      customHours: 168
    });

    if (ifOutOfDate && firstRecord) {
      log.info("锚点已经过期，开始重新前往指定位置");
      try {
        await pathingScript.runFile("assets/恢复.json");
        await sleep(2000);
        keyPress("B");
        await sleep(2000);
        click(970, 755);//避免过期物品
        await sleep(1000);
        click(1050, 50);//点击小道具
        await sleep(1000);
        await waitAndClickImage(anchorType);
        keyPress("F");
        await sleep(1000);
        click(1180, 753);//点击确认
        await genshin.returnMainUi();
        await file.writeText(`assets/dateRecord.txt`, new Date().toISOString());
        log.info("重新包月成功，记录本次时间");
        return 1;
      } catch (error) {
        log.info("恢复失败，任务结束！！！");
        return 0;
      }
    }

    if (isRefreshed) {

      if (!firstRecord) log.info("首次运行,将尝试锚点续费一次");
      else log.info("检测到锚点即将到期，开始自动续费");
      try {
        await pathingScript.runFile("assets/续费.json");
        await sleep(1000);
        keyPress("B");
        await sleep(2000);
        click(970, 755);//避免过期物品
        await sleep(1000);
        click(1050, 50);//点击小道具
        await sleep(1000);
        await waitAndClickImage(anchorType);
        keyPress("F");
        await sleep(1000);
        click(1180, 753);//避免过期物品
        await genshin.returnMainUi();
        await file.writeText(`assets/dateRecord.txt`, new Date().toISOString());
        log.info("续费成功，记录本次时间");
      } catch (error) {
        log.info("传送失败，尝试使用恢复文件");
        await genshin.returnMainUi();
        try {
          await pathingScript.runFile("assets/恢复.json");
          await sleep(2000);
          keyPress("B");
          await sleep(2000);
          click(970, 755);//避免过期物品
          await sleep(1000);
          click(1050, 50);//点击小道具
          await sleep(1000);
          await waitAndClickImage(anchorType);
          keyPress("F");
          await sleep(1000);
          click(1180, 753);//点击确认
          await genshin.returnMainUi();
          await file.writeText(`assets/dateRecord.txt`, new Date().toISOString());
          log.info("重新包月成功，记录本次时间");
          return 1;
        } catch (error) {
          log.info("恢复失败，任务结束！！！");
          return 0;
        }
      }
    } else {
      log.info("便携锚点还未到期,跳过任务");
    }
  }

  await main();

})();