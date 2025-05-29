(function () {
  // 定义常量
  const OCR_REGION_X = 750;
  const OCR_REGION_Y = 250;
  const OCR_REGION_WIDTH = 450;  // 1200 - 750
  const OCR_REGION_HEIGHT = 400; // 650 - 250
  

  // 修复文件路径问题 - 使用相对路径
  const SUPPORT_LIST_PATH = "name.txt";
  const OUTPUT_DIR = "Data";
  
  // 委托详情按钮位置
  const COMMISSION_DETAIL_BUTTONS = [
    { id: 1, x: 1550, y: 320 }, // 第一个委托详情按钮
    { id: 2, x: 1550, y: 420 }, // 第二个委托详情按钮
    { id: 3, x: 1550, y: 520 }, // 第三个委托详情按钮
    { id: 4, x: 1550, y: 560 }  // 第四个委托详情按钮（滑动后）
  ];
  
  // 委托地点OCR区域
  const LOCATION_OCR_X = 1530;
  const LOCATION_OCR_Y = 100;
  const LOCATION_OCR_WIDTH = 250; // 1630 - 1530
  const LOCATION_OCR_HEIGHT = 30; // 130 - 100

  // 委托触发检测区域
  const COMMISSION_TRIGGER_OCR_X = 885;
  const COMMISSION_TRIGGER_OCR_Y = 200;
  const COMMISSION_TRIGGER_OCR_WIDTH = 165; // 1050 - 885
  const COMMISSION_TRIGGER_OCR_HEIGHT = 50; // 250 - 200

  // 委托完成检测区域
  const COMMISSION_COMPLETE_OCR_X = 880;
  const COMMISSION_COMPLETE_OCR_Y = 165;
  const COMMISSION_COMPLETE_OCR_WIDTH = 170; // 1050 - 880
  const COMMISSION_COMPLETE_OCR_HEIGHT = 45; // 210 - 165

  // 自动战斗超时时间（毫秒）
  const FIGHT_TIMEOUT = 180000; // 3分钟

  // 获取设置
  const skipRecognition = settings.skipRecognition || false;
  const debugMode = settings.debugMode || false;
  const minTextLength = parseInt(settings.minTextLength || "4");
  const team = settings.team || "";
  
  async function prepareForLeyLineRun(settings) {
    // 开局传送到七天神像
    await genshin.returnMainUi()
    await genshin.tpToStatueOfTheSeven();
    
    // 切换战斗队伍
    if (settings.team) {
        log.info(`切换至队伍 ${settings.team}`);
        await genshin.switchParty(settings.team);
    }
}


  // 读取支持的委托列表
  function loadSupportedCommissions() {
    let supportedCommissions = [];
    
    try {
      // 使用正确的文件读取方法
      log.info("开始读取支持的委托列表: {path}", SUPPORT_LIST_PATH);
      
      // 尝试读取文件内容
      try {
        const supportListContent = file.readTextSync(SUPPORT_LIST_PATH);
        
        if (supportListContent && supportListContent.trim()) {
          supportedCommissions = supportListContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          log.info("已加载支持的委托列表，共 {count} 个", supportedCommissions.length);
        } else {
          log.warn("支持的委托列表为空");
        }
      } catch (readError) {
        // 如果读取失败，检查文件是否存在
        log.error("读取委托列表失败: {error}", readError);
        
        // 尝试创建文件
        try {
          const writeResult = file.writeTextSync(SUPPORT_LIST_PATH, "");
          if (writeResult) {
            log.info("已创建空的委托列表文件");
          } else {
            log.error("创建委托列表文件失败");
          }
        } catch (writeError) {
          log.error("创建委托列表文件失败: {error}", writeError);
        }
      }
    } catch (error) {
      log.error("处理委托列表时出错: {error}", error);
    }
    
    return supportedCommissions;
  }
  
  // 清理文本（去除标点符号等）
  function cleanText(text) {
    if (!text) return "";
    // 去除标点符号和特殊字符
    return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").trim();
  }
  
  // 进入委托界面
  async function enterCommissionScreen() {
    log.info("正在进入委托界面...");
    
    try {
      // 使用F1快捷键直接打开委托界面
      log.info("尝试使用F1快捷键打开委托界面");
      keyDown("VK_F1");
      await sleep(100);
      keyUp("VK_F1");

      // 点击委托界面
      log.info("点击委托界面");
      await sleep(900);
      click(300, 350);
      await sleep(100);
      log.info("已进入委托界面");
      return true;

    } catch (error) {
      log.error("进入委托界面失败: {error}", error);
      return false;
    }
  }

  // 自动执行划页操作 - 新的滑动方法
  async function PageScroll(scrollCount) { 
    try { 
      const clickX = 950; // 假设点击的起始坐标 
      const clickY = 600; 
      const totalDistance = 300; // 假设每次滑动的总距离 
      const stepDistance = 10; // 每步移动的距离 

      for (let i = 0; i < scrollCount; ++i) { 
        log.info(`开始第 ${i + 1} 次滑动`); 

        // 如果点击坐标为 (0, 0)，则跳过点击 
        if (clickX !== 0 || clickY !== 0) { 
          moveMouseTo(clickX, clickY); // 移动到指定坐标 
          await sleep(100); 
        } 

        // 按住鼠标左键 
        leftButtonDown(); 

        // 将鼠标移动到目标位置，模拟更自然的拖动操作 
        const steps = totalDistance / stepDistance; // 分成若干步移动 

        for (let j = 0; j < steps; j++) { 
          moveMouseBy(0, -stepDistance); // 每次移动 stepDistance 像素 
          await sleep(10); // 每次移动后延迟10毫秒 
        } 

        // 释放鼠标左键 
        await sleep(700); 
        leftButtonUp(); 
        await sleep(1000); // 增加滑动后的等待时间，确保界面稳定
      } 
      
      return true;
    } catch (error) { 
      log.error(`执行滑动操作时发生错误：${error.message}`); 
      return false;
    } 
  }

  // 识别委托地点
  function recognizeCommissionLocation() {
    try {
      log.info("识别委托地点 ({x}, {y}) ({width}, {height})...", 
        LOCATION_OCR_X, LOCATION_OCR_Y, LOCATION_OCR_X + LOCATION_OCR_WIDTH, LOCATION_OCR_Y + LOCATION_OCR_HEIGHT);
      
      // 创建OCR识别对象
      const locationOcrRo = RecognitionObject.Ocr(
        LOCATION_OCR_X,
        LOCATION_OCR_Y,
        LOCATION_OCR_WIDTH,
        LOCATION_OCR_HEIGHT
      );
      
      // 截图识别
      let captureRegion = captureGameRegion();
      let results = captureRegion.findMulti(locationOcrRo);
      
      if (results.count > 0) {
        // 取第一个结果作为地点
        return results[0].text.trim();
      }
      
      return "未知地点";
    } catch (error) {
      log.error("识别委托地点时出错: {error}", error);
      return "识别失败";
    }
  }
  
  // 保存委托数据到文件
  function saveCommissionsData(commissionsTable) {
    try {
      log.info("保存委托数据到文件...");
      
      // 创建JSON格式的委托数据
      const commissionsData = {
        timestamp: new Date().toISOString(),
        commissions: commissionsTable
      };
      
      // 保存到文件
      const outputPath = `${OUTPUT_DIR}/commissions_data.json`;
      try {
        const jsonResult = file.writeTextSync(outputPath, JSON.stringify(commissionsData, null, 2));
        if (jsonResult) {
          log.info("委托数据已保存到: {path}", outputPath);
        } else {
          log.error("保存委托数据失败");
        }
      } catch (jsonError) {
        log.error("保存委托数据失败: {error}", jsonError);
      }
      
      // 创建可读的文本报告
      let reportContent = "# 原神每日委托识别报告\r\n";
      reportContent += `生成时间: ${new Date().toLocaleString()}\r\n\r\n`;
      reportContent += "## 委托列表\r\n\r\n";
      
      for (const commission of commissionsTable) {
        const supportStatus = commission.supported ? "✅ 支持" : "❌ 不支持";
        const locationInfo = commission.location ? `(${commission.location})` : "";
        reportContent += `${commission.id}. ${commission.name} ${locationInfo} - ${supportStatus}\r\n`;
      }
      
      // 保存报告
      const reportPath = `${OUTPUT_DIR}/commissions_report.txt`;
      try {
        const reportResult = file.writeTextSync(reportPath, reportContent);
        if (reportResult) {
          log.info("委托报告已保存到: {path}", reportPath);
        } else {
          log.error("保存委托报告失败");
        }
      } catch (reportError) {
        log.error("保存委托报告失败: {error}", reportError);
      }
      
      return commissionsTable.filter(c => c.supported);
    } catch (error) {
      log.error("处理委托数据时出错: {error}", error);
      return [];
    }
  }
  
  function ensureDirectoryExists(dirPath) {
    try {
      // 尝试创建目录，如果目录已存在，writeTextSync不会报错
      // 创建一个临时文件来确保目录存在
      const tempFilePath = `${dirPath}/.temp`;
      file.writeTextSync(tempFilePath, "");
      log.info(`已确保目录存在: ${dirPath}`);
      return true;
    } catch (error) {
      log.error(`创建目录时出错: ${error}`);
      return false;
    }
  }

  // 检测是否进入委托详情界面
  async function checkDetailPageEntered() {
    try {
      log.info("检测是否进入委托详情界面...");
      
      // 创建OCR识别对象 - 检测区域(1480,100)到(1535,130)
      const detailOcrRo = RecognitionObject.Ocr(
        1480,
        100,
        55,  // 1535 - 1480
        30   // 130 - 100
      );
      
      // 尝试3次OCR识别
      for (let i = 0; i < 3; i++) {
        log.info(`执行第${i + 1}次详情界面OCR检测`);
        let captureRegion = captureGameRegion();
        let results = captureRegion.findMulti(detailOcrRo);
        
        if (results.count > 0) {
          // 检查OCR结果
          for (let j = 0; j < results.count; j++) {
            const text = results[j].text.trim();
            log.info(`检测到文本: "${text}"`);
            
            // 如果有"蒙德"，表示进入了详情界面
            if (text.includes("蒙德")) {
              log.info("检测到蒙德委托，成功进入详情界面");
              return "蒙德";
            } 
            // 如果没有文字，可能是已完成委托
            else if (text === "") {
              log.info("未检测到地区文本，可能是已完成委托");
              return "已完成";
            }
            // 其他地区委托
            else if (text.length >= 2) {
              log.info(`检测到其他地区委托: ${text}`);
              return text;
            }
          }
        }
        
        // 如果没有检测到，等待一会再试
        await sleep(500);
      }
      
      log.warn("三次OCR检测后仍未确认是否进入详情界面");
      return "未知";
    } catch (error) {
      log.error("检测委托详情界面时出错: {error}", error);
      return "错误";
    }
  }

  // 原神每日委托识别主函数
  async function Identification() {
    try {
      log.info("开始执行原神每日委托识别脚本");
      await genshin.returnMainUi();
      setGameMetrics(1920, 1080, 1);
      // 加载支持的委托列表
      const supportedCommissions = loadSupportedCommissions();
      
      // 确保所有委托的资源目录存在
      for (const commission of supportedCommissions) {
        ensureDirectoryExists(`assets/${commission}`);
      }

      // 进入委托界面
      const enterSuccess = await enterCommissionScreen();
      if (!enterSuccess) {
        log.error("无法进入委托界面，脚本终止");
        return;
      }
      await sleep(1000); // 增加延迟，确保界面完全加载
      
      // 步骤1: 执行第一次OCR识别
      log.info("步骤1: 执行第一次OCR识别");
      const ocrRo = RecognitionObject.Ocr(
        OCR_REGION_X, 
        OCR_REGION_Y, 
        OCR_REGION_WIDTH, 
        OCR_REGION_HEIGHT
      );
      
      await sleep(2000); // 等待界面稳定
      
      // 第一次截图识别
      log.info("执行第一次OCR识别 ({x}, {y}) ({width}, {height})", 
        OCR_REGION_X, OCR_REGION_Y, OCR_REGION_X + OCR_REGION_WIDTH, OCR_REGION_Y + OCR_REGION_HEIGHT);
      let captureRegion = captureGameRegion();
      let firstResults = captureRegion.findMulti(ocrRo);
      log.info("第一次OCR识别结果数量: {count}", firstResults.count);
      
      // 处理第一次识别结果
      let firstCommissions = [];
      for (let i = 0; i < firstResults.count; i++) {
        let result = firstResults[i];
        let text = cleanText(result.text);
        if (text && text.length >= minTextLength) {
          log.info("第{index}个委托: \"{text}\"", i + 1, text);
          firstCommissions.push({
            id: i + 1,
            name: text,
            supported: supportedCommissions.includes(text),
            location: ""
          });
        }
      }
      
      // 步骤2: 点击1、2、3号委托详情按钮
      log.info("步骤2: 点击1、2、3号委托详情按钮");
      for (let i = 0; i < Math.min(3, firstCommissions.length); i++) {
        const commission = firstCommissions[i];
        log.info("查看第{id}个委托详情: {name}", commission.id, commission.name);
        // 点击详情按钮
        const detailButton = COMMISSION_DETAIL_BUTTONS[commission.id - 1];
        log.info("点击委托详情按钮 ({x}, {y})", detailButton.x, detailButton.y);
        click(detailButton.x, detailButton.y);
        await sleep(2500); // 等待详情页面加载
        
        // 检测是否成功进入详情界面
        const detailStatus = await checkDetailPageEntered();
        log.info(`委托详情界面状态: ${detailStatus}`);
        
        // 根据检测结果处理
        if (detailStatus === "已完成") {
          log.info("该委托已完成，跳过地点识别和退出操作");
          commission.location = "已完成";
          continue; // 跳过后续的地点识别和退出操作
        } else if (detailStatus === "未知" || detailStatus === "错误") {
          log.warn("无法确认是否进入详情界面，尝试继续执行");
          // 尝试识别委托地点
          const location = recognizeCommissionLocation();
          commission.location = location;
          log.info("委托 {name} 的地点: {location}", commission.name, location);
        } else {
          // 成功进入详情界面，记录地点
          const location = recognizeCommissionLocation();
          commission.location = location;
          log.info("委托 {name} 的地点: {location}", commission.name, location);
        }
        
        // 如果不是已完成状态，需要执行退出操作
        if (detailStatus !== "未知") {
          // 退出详情页面
          log.info("退出详情页面 - 按ESC");
          keyDown("VK_ESCAPE");
          await sleep(300);
          keyUp("VK_ESCAPE");
          await sleep(1200);
          
          keyDown("VK_ESCAPE");
          await sleep(300);
          keyUp("VK_ESCAPE");
          await sleep(1200);
        }
      }
      
      // 步骤3: 执行下滑操作
      log.info("步骤3: 执行下滑操作");
      await PageScroll(1);
      await sleep(2000); // 等待滑动完成
      
      // 步骤4: 执行第二次OCR识别
      log.info("步骤4: 执行第二次OCR识别({x}, {y}) ({width}, {height})", 
      OCR_REGION_X, OCR_REGION_Y, OCR_REGION_X + OCR_REGION_WIDTH, OCR_REGION_Y + OCR_REGION_HEIGHT);
      captureRegion = captureGameRegion();
      let secondResults = captureRegion.findMulti(ocrRo);
      log.info("第二次OCR识别结果数量: {count}", secondResults.count);
      

      // 处理第二次识别结果
      let fourthCommission = null;
      for (let i = 0; i < secondResults.count; i++) {
        let result = secondResults[i];
        let text = cleanText(result.text);
        if (text && text.length >= minTextLength) {
          log.info("第4个委托: \"{text}\"", text);
          fourthCommission = {
            id: 4,
            name: text,
            supported: supportedCommissions.includes(text),
            location: ""
          };
          // 移除break，继续循环，取最后一个有效结果
        }
      }

      // 步骤5: 点击委托4详情按钮
      if (fourthCommission) {
        log.info("步骤5: 点击委托4详情按钮");
        log.info("查看第4个委托详情: {name}", fourthCommission.name);
        
        // 点击详情按钮
        const detailButton = COMMISSION_DETAIL_BUTTONS[3]; // 第4个按钮
        log.info("点击委托详情按钮 ({x}, {y})", detailButton.x, detailButton.y);
        click(detailButton.x, detailButton.y);
        await sleep(2500); // 等待详情页面加载
        
        // 检测是否成功进入详情界面
        const detailStatus = await checkDetailPageEntered();
        log.info(`委托详情界面状态: ${detailStatus}`);
        const commission = firstCommissions[4];

        // 根据检测结果处理
        if (detailStatus === "已完成") {
          log.info("该委托已完成，跳过地点识别和退出操作");
          fourthCommission.location = "已完成";
        } else if (detailStatus === "未知" || detailStatus === "错误") {
          log.warn("无法确认是否进入详情界面，尝试继续执行");
          // 尝试识别委托地点
          location = recognizeCommissionLocation();
          fourthCommission.location = location;
          log.info("委托 {name} 的地点: {location}", fourthCommission.name, location);
        } else {
          location = recognizeCommissionLocation();
          fourthCommission.location = location;
          log.info("委托 {name} 的地点: {location}", fourthCommission.name, location);
        }
        
        // 如果不是已完成状态，需要执行退出操作
        if (detailStatus !== "未知") {
          // 退出详情页面
          log.info("退出详情页面 - 按ESC");
          keyDown("VK_ESCAPE");
          await sleep(300);
          keyUp("VK_ESCAPE");
          await sleep(1200);
          
          keyDown("VK_ESCAPE");
          await sleep(300);
          keyUp("VK_ESCAPE");
          await sleep(1200);
        }
      } 
      
      // 合并所有委托结果
      let allCommissions = [...firstCommissions];
      if (fourthCommission) {
        allCommissions.push(fourthCommission);
      }
      
      // 输出完整委托列表
      log.info("完整委托列表:");
      for (const commission of allCommissions) {
        const supportStatus = commission.supported ? "✅ 支持" : "❌ 不支持";
        const locationInfo = commission.location ? `(${commission.location})` : "";
        log.info("{id}. {name} {location} - {status}", 
          commission.id, commission.name, locationInfo, supportStatus);
      }
      
      // 保存委托数据
      saveCommissionsData(allCommissions);

      log.info("原神每日委托识别脚本执行完成");
    } catch (error) {
      log.error("脚本执行出错: {error}", error);
    }
  }


  


/**
 * 检测委托是否触发
 * @returns {Promise<boolean>} 是否触发委托
 */
async function detectCommissionTrigger() {
  try {
    log.info("检测委托触发 ({x}, {y}) ({width}, {height})...", 
      COMMISSION_TRIGGER_OCR_X, COMMISSION_TRIGGER_OCR_Y, 
      COMMISSION_TRIGGER_OCR_X + COMMISSION_TRIGGER_OCR_WIDTH, 
      COMMISSION_TRIGGER_OCR_Y + COMMISSION_TRIGGER_OCR_HEIGHT);
    
    // 创建OCR识别对象
    const triggerOcrRo = RecognitionObject.Ocr(
      COMMISSION_TRIGGER_OCR_X,
      COMMISSION_TRIGGER_OCR_Y,
      COMMISSION_TRIGGER_OCR_WIDTH,
      COMMISSION_TRIGGER_OCR_HEIGHT
    );
    
    // 截图识别
    let captureRegion = captureGameRegion();
    let results = captureRegion.findMulti(triggerOcrRo);
    
    if (results.count > 0) {
      for (let i = 0; i < results.count; i++) {
        const text = results[i].text.trim();
        log.info("检测到文本: {text}", text);
        
        // 检查是否包含委托触发相关文字
        if (text.includes("触发委托")) {
          log.info("检测到委托触发");
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    log.error("检测委托触发时出错: {error}", error);
    return false;
  }
}

/**
 * 检测委托是否完成
 * @returns {Promise<boolean>} 是否完成委托
 */
async function detectCommissionComplete() {
  try {
    log.info("检测委托完成 ({x}, {y}) ({width}, {height})...", 
      COMMISSION_COMPLETE_OCR_X, COMMISSION_COMPLETE_OCR_Y, 
      COMMISSION_COMPLETE_OCR_X + COMMISSION_COMPLETE_OCR_WIDTH, 
      COMMISSION_COMPLETE_OCR_Y + COMMISSION_COMPLETE_OCR_HEIGHT);
    
    // 创建OCR识别对象
    const completeOcrRo = RecognitionObject.Ocr(
      COMMISSION_COMPLETE_OCR_X,
      COMMISSION_COMPLETE_OCR_Y,
      COMMISSION_COMPLETE_OCR_WIDTH,
      COMMISSION_COMPLETE_OCR_HEIGHT
    );
    
    // 截图识别
    let captureRegion = captureGameRegion();
    let results = captureRegion.findMulti(completeOcrRo);
    
    if (results.count > 0) {
      for (let i = 0; i < results.count; i++) {
        const text = results[i].text.trim();
        log.info("检测到文本: {text}", text);
        
        // 检查是否包含委托完成相关文字
        if (text.includes("委托完成")) {
          log.info("检测到委托完成");
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    log.error("检测委托完成时出错: {error}", error);
    return false;
  }
}



/**
 * 自动战斗
 * @param {number} timeout - 超时时间
 * @returns {Promise<boolean>} 战斗是否成功
 */
async function autoFight(timeout) {
  const cts = new CancellationTokenSource();
  try {
    log.info("开始战斗");
    dispatcher.RunTask(new SoloTask("AutoFight"), cts);
    let fightResult = await detectCommissionComplete();
    log.info(`战斗结束，战斗结果：${fightResult ? "成功" : "失败"}`);
    cts.cancel();
    return fightResult;
  } catch (error) {
    log.error(`执行过程中出错: ${error}`);
    cts.cancel();
    return false;
  }
}

/**
 * 执行委托追踪脚本
 * @param {Object} commission - 委托信息对象
 * @returns {Promise<boolean>} 是否成功完成委托
 */
async function executeTrackingScript(commission) {
  log.info("准备执行委托追踪脚本: {name} ({location})", 
    commission.name, 
    commission.location || "未知地点");
  
  try {
    // 检查委托是否已完成
    if (commission.location === "已完成") {
      log.info("该委托已完成，跳过执行");
      return true;
    }
    
    // 检查委托名称和地点是否有效
    if (!commission.name || !commission.location || commission.location === "未知地点" || commission.location === "识别失败") {
      log.warn("委托信息不完整，无法执行追踪脚本");
      return false;
    }
    
    // 构建可能的路径追踪脚本路径
    const location = commission.location.trim();
    const scriptPaths = [
      `assets/${commission.name}/${location}-1.json`,
      `assets/${commission.name}/${location}-2.json`
    ];
    
    let scriptFound = false;
    let scriptCompleted = false;
    
    // 设置全局超时时间（30分钟）
    const GLOBAL_TIMEOUT = 30 * 60 * 1000;
    const startTime = Date.now();
    
    // 尝试执行每个可能的脚本路径
    for (const scriptPath of scriptPaths) {
      try {
        // 检查是否超过全局超时时间
        if (Date.now() - startTime > GLOBAL_TIMEOUT) {
          log.warn("委托追踪超过全局超时时间，终止执行");
          return false;
        }
        
        // 检查脚本文件是否存在
        log.info("检查路径追踪脚本: {path}", scriptPath);
        
        try {
          // 尝试读取文件内容来检查是否存在
          await file.readText(scriptPath);
          log.info("找到路径追踪脚本: {path}", scriptPath);
          scriptFound = true;
        } catch (readError) {
          log.info("路径追踪脚本不存在: {path}", scriptPath);
          continue; // 尝试下一个脚本路径
        }
        
        // 执行路径追踪脚本
        log.info("开始执行路径追踪脚本: {path}", scriptPath);
        
        // 单个脚本执行超时时间（10分钟）
        const SCRIPT_TIMEOUT = 10 * 60 * 1000; 
        
        // 创建路径追踪任务（异步执行）
        const pathingTask = pathingScript.runFile(scriptPath);
        
        // 实时检测委托触发和完成状态
        let triggered = false;
        let completed = false;
        
        // 开始时间记录
        const scriptStartTime = Date.now();
        
        // 实时检测循环
        while (Date.now() - scriptStartTime < SCRIPT_TIMEOUT) {
          // 检测委托是否触发
          if (!triggered && await detectCommissionTrigger()) {
            triggered = true;
            log.info("委托已触发，开始自动战斗");
            await autoFight(FIGHT_TIMEOUT);
            
            // 战斗后等待一段时间再检测完成状态
            await sleep(3000);
          }
          
          // 检测委托是否完成
          if (await detectCommissionComplete()) {
            log.info("委托已完成: {name} ({location})", commission.name, location);
            commission.completed = true;
            scriptCompleted = true;
            
            // 尝试取消路径追踪任务（如果API支持）
            try {
              pathingTask.cancel && pathingTask.cancel();
            } catch (cancelError) {
              log.warn("取消路径追踪任务失败: {error}", cancelError);
            }
            
            return true;
          }
          
          // 每秒检测一次
          await sleep(1000);
        }
        
        log.warn("脚本执行超时，尝试下一个脚本");
        
        // 尝试取消路径追踪任务（如果API支持）
        try {
          pathingTask.cancel && pathingTask.cancel();
        } catch (cancelError) {
          log.warn("取消路径追踪任务失败: {error}", cancelError);
        }
        
        // 额外等待检测
        log.info("额外等待5秒检测委托触发...");
        let finalTriggered = false;
        
        for (let i = 0; i < 5; i++) {
          await sleep(1000);
          
          if (!triggered && await detectCommissionTrigger()) {
            finalTriggered = true;
            log.info("在额外等待期间检测到委托触发");
            
            // 开始自动战斗
            log.info("委托已触发，开始自动战斗");
            await autoFight(FIGHT_TIMEOUT);
            
            // 战斗后等待一段时间再检测完成状态
            await sleep(3000);
            
            if (await detectCommissionComplete()) {
              log.info("委托已完成: {name} ({location})", commission.name, location);
              commission.completed = true;
              scriptCompleted = true;
              return true;
            }
            
            break;
          }
        }
        
        if (!finalTriggered && !triggered) {
          log.info("未检测到委托触发，尝试下一个脚本");
        }
        
      } catch (scriptError) {
        log.error("执行路径追踪脚本时出错: {error}", scriptError);
      }
    }
    
    if (!scriptFound) {
      log.warn("未找到委托 {name} 在 {location} 的路径追踪脚本", commission.name, location);
      return false;
    }
    
    return scriptCompleted;
  } catch (error) {
    log.error("执行追踪脚本时出错: {error}", error);
    return false;
  }
}

/**
 * 从Data文件夹加载委托数据
 * @returns {Promise<Array>} 委托数据数组
 */
async function loadCommissionsFromData() {
  try {
    log.info("尝试从Data文件夹加载委托数据");
    const dataPath = `${OUTPUT_DIR}/commissions_data.json`;
    
    try {
      const dataContent = await file.readText(dataPath);
      const commissionsData = JSON.parse(dataContent);
      
      if (commissionsData && commissionsData.commissions && commissionsData.commissions.length > 0) {
        log.info("成功从Data文件夹加载委托数据，共 {count} 个", commissionsData.commissions.length);
        return commissionsData.commissions;
      } else {
        log.warn("Data文件夹中的委托数据为空");
        return null;
      }
    } catch (readError) {
      log.warn("读取委托数据文件失败: {error}", readError);
      return null;
    }
  } catch (error) {
    log.error("加载委托数据时出错: {error}", error);
    return null;
  }
}


/**
 * 执行委托追踪
 * 新版本：执行所有委托而不检测触发状态
 */
async function executeCommissionTracking() {
  try {
    log.info("开始执行委托追踪 - 全部执行模式");
    
    // 获取已识别的委托列表
    let commissions = [];
    try {
      const commissionsData = JSON.parse(file.readTextSync(`${OUTPUT_DIR}/commissions_data.json`));
      commissions = commissionsData.commissions.filter(c => c.supported);
      log.info("已加载支持的委托数据，共 {count} 个", commissions.length);
    } catch (error) {
      log.error("读取委托数据失败: {error}", error);
      return false;
    }
    
    if (commissions.length === 0) {
      log.warn("没有找到支持的委托，请先运行识别脚本");
      return false;
    }
    
    // 确保回到主界面
    await genshin.returnMainUi();
    
    // 执行每个委托
    let completedCount = 0;
    for (const commission of commissions) {
      // 跳过已完成的委托
      if (commission.location === "已完成") {
        log.info("委托 {name} 已完成，跳过", commission.name);
        completedCount++;
        continue;
      }
      
      // 跳过没有地点信息的委托
      if (!commission.location || commission.location === "未知地点" || commission.location === "识别失败") {
        log.warn("委托 {name} 缺少地点信息，跳过", commission.name);
        continue;
      }
      
      log.info("开始执行委托: {name} ({location})", commission.name, commission.location);
      
      // 构建可能的路径追踪脚本路径
      const location = commission.location.trim();
      const scriptPaths = [
        `assets/${commission.name}/${location}-1.json`,
        `assets/${commission.name}/${location}-2.json`,
        `assets/${commission.name}/${location}-3.json`,
      ];
      
      let scriptFound = false;
      let scriptExecuted = false;
      
      // 尝试执行每个可能的脚本路径
      for (const scriptPath of scriptPaths) {
        try {
          // 检查脚本文件是否存在
          log.info("检查路径追踪脚本: {path}", scriptPath);
          
          try {
            // 尝试读取文件内容来检查是否存在
            await file.readText(scriptPath);
            log.info("找到路径追踪脚本: {path}", scriptPath);
            scriptFound = true;
            scriptExecuted = true;
          } catch (readError) {
            log.info("路径追踪脚本不存在: {path}", scriptPath);
            continue; // 尝试下一个脚本路径
          }
          
          // 执行路径追踪脚本
          log.info("开始执行路径追踪脚本: {path}", scriptPath);
          
          // 执行脚本并等待完成
          await pathingScript.runFile(scriptPath);
          log.info("路径追踪脚本执行完成");

          //log.info("委托 {name} 执行完成", commission.name);
          
          // 成功执行一个脚本后，跳出循环
          //break;
        } catch (scriptError) {
          log.error("执行路径追踪脚本时出错: {error}", scriptError);
        }
      }
      
      if (!scriptFound) {
        log.warn("未找到委托 {name} 在 {location} 的路径追踪脚本", commission.name, location);
      } else if (scriptExecuted) {
        completedCount++;
      }
      
      // 每个委托之间等待一段时间
      log.info("等待5秒后执行下一个委托...");
      await sleep(5000);
    }
    
    log.info("委托追踪全部执行完成，共执行 {count}/{total} 个委托", 
      completedCount, commissions.length);
    
    return completedCount > 0;
  } catch (error) {
    log.error("执行委托追踪时出错: {error}", error);
    return false;
  }
}

/**
 * 执行委托追踪主函数
 * @returns {Promise<void>}
 */
async function executeCommissionTracking_old() {
  try {
    log.info("开始执行委托追踪");
    await genshin.returnMainUi();
    
    // 加载支持的委托列表
    const supportedCommissions = loadSupportedCommissions();
    
    // 尝试从Data文件夹加载委托数据
    let commissions = await loadCommissionsFromData();
    
    // 如果Data文件夹没有数据，则执行识别
    if (!commissions) {
      log.info("未找到已保存的委托数据，开始执行委托识别");
      await Identification();
      
      // 再次尝试加载委托数据
      commissions = await loadCommissionsFromData();
      
      if (!commissions) {
        log.error("无法获取委托数据，脚本终止");
        return;
      }
    }
    
    // 过滤出支持的委托
    const supportedCommissionsList = commissions.filter(c => c.supported);
    
    if (supportedCommissionsList.length === 0) {
      log.warn("没有找到支持的委托");
      return;
    }
    
    log.info("找到 {count} 个支持的委托", supportedCommissionsList.length);
    
    // 执行每个支持的委托
    for (const commission of supportedCommissionsList) {
      log.info("开始处理委托: {name} ({location})", commission.name, commission.location || "未知地点");
      
      // 执行委托追踪脚本
      //const success = await executeTrackingScript(commission);
      
      if (success) {
        log.info("委托 {name} 已成功完成", commission.name);
      } else {
        log.warn("委托 {name} 未能完成", commission.name);
      }
      
      await sleep(2000); // 等待一段时间再处理下一个委托
    }
    
    log.info("委托追踪执行完成");
  } catch (error) {
    log.error("执行委托追踪时出错: {error}", error);
  }
}

  // 主函数
  async function main() {

    //await Identification();
    
    if(settings.skipRecognition){
      log.info("跳过识别，直接加载数据");
    }else{
      await Identification();
    }//识别委托

    // 开局准备
    await prepareForLeyLineRun(settings);
          
    // 执行自动委托
    await executeCommissionTracking();
    
    log.info("每日委托执行完成，前往安全地点");
    await genshin.tpToStatueOfTheSeven();
  }
  // 修改这里：使用 Promise 包装 main 函数的执行
  return main();
  //log.info("");
})();