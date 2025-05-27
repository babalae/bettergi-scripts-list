(function () {
  // 定义常量
  const OCR_REGION_X = 750;
  const OCR_REGION_Y = 250;
  const OCR_REGION_WIDTH = 450;  // 1200 - 750
  const OCR_REGION_HEIGHT = 400; // 650 - 250
  

  // 修复文件路径问题 - 使用相对路径
  const SUPPORT_LIST_PATH = "name.json";
  const OUTPUT_DIR = "Data";
  
  // 添加图像识别相关常量
  const COMPLETED_IMAGE_PATH = "Data/RecognitionObject/Completed.png";
  const UNCOMPLETED_IMAGE_PATH = "Data/RecognitionObject/UnCompleted.png";

  // 委托类型常量
  const COMMISSION_TYPE = {
    FIGHT: "fight",
    TALK: "talk"
  };

  // 对话委托流程路径
  const TALK_PROCESS_BASE_PATH = "assets/process";
  
  // 委托详情按钮位置（扩展检测范围左右+50像素）
  const COMMISSION_DETAIL_BUTTONS = [
    { id: 1, x: 1550, y: 320, checkX: 1450, checkWidth: 150 }, // 第一个委托详情按钮
    { id: 2, x: 1550, y: 420, checkX: 1450, checkWidth: 150 }, // 第二个委托详情按钮
    { id: 3, x: 1550, y: 530, checkX: 1500, checkWidth: 100 }, // 第三个委托详情按钮
    { id: 4, x: 1550, y: 560, checkX: 1450, checkWidth: 150 }  // 第四个委托详情按钮（滑动后）
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

/**
 * 检测委托完成状态（使用图像识别）
 * @param {number} buttonIndex - 按钮索引（0-3）
 * @returns {Promise<string>} 返回 "completed", "uncompleted", 或 "unknown"
 */
async function detectCommissionStatusByImage(buttonIndex) {
  try {
    const button = COMMISSION_DETAIL_BUTTONS[buttonIndex];
    if (!button) {
      log.error("无效的按钮索引: {index}", buttonIndex);
      return "unknown";
    }
    
    log.info("检测委托{id}的完成状态（图像识别）", button.id);
    
    // 截图
    let captureRegion = captureGameRegion();
    
    // 检测区域：按钮位置左右各扩展更大范围
    const checkRegion = captureRegion.deriveCrop(
      button.checkX, 
      button.y - 30, // 稍微向上扩展检测区域
      button.checkWidth, 
      60 // 增加高度以确保捕获状态图标
    );

    
    // 加载完成和未完成的模板图像
    let completedTemplate, uncompletedTemplate;
    
    try {
      completedTemplate = file.readImageMatSync(COMPLETED_IMAGE_PATH);
      uncompletedTemplate = file.readImageMatSync(UNCOMPLETED_IMAGE_PATH);
    } catch (imageError) {
      log.error("加载模板图像失败: {error}", imageError);
      return "unknown";
    }
    
    // 创建识别对象，使用更灵活的参数
    const completedRo = RecognitionObject.TemplateMatch(completedTemplate, 0, 0, button.checkWidth, 60);
    const uncompletedRo = RecognitionObject.TemplateMatch(uncompletedTemplate, 0, 0, button.checkWidth, 60);
    
    // 降低匹配阈值，提高识别灵活性
    completedRo.threshold = 0.65;
    uncompletedRo.threshold = 0.65;
    
    // 检测完成状态
    const completedResult = checkRegion.find(completedRo);
    if (!completedResult.isEmpty()) {
      log.info("委托{id}已完成", button.id);
      return "completed";
    }
    
    // 检测未完成状态
    const uncompletedResult = checkRegion.find(uncompletedRo);
    if (!uncompletedResult.isEmpty()) {
      log.info("委托{id}未完成", button.id);
      return "uncompleted";
    }
    
    // 尝试使用更低的阈值再次检测
    log.info("使用更低阈值再次检测委托{id}状态", button.id);
    completedRo.threshold = 0.6;
    uncompletedRo.threshold = 0.6;
    
    const completedResult2 = checkRegion.find(completedRo);
    if (!completedResult2.isEmpty()) {
      log.info("委托{id}已完成（低阈值检测）", button.id);
      return "completed";
    }
    
    const uncompletedResult2 = checkRegion.find(uncompletedRo);
    if (!uncompletedResult2.isEmpty()) {
      log.info("委托{id}未完成（低阈值检测）", button.id);
      return "uncompleted";
    }
    
    log.warn("委托{id}状态识别失败", button.id);
    return "unknown";
    
  } catch (error) {
    log.error("检测委托完成状态时出错: {error}", error);
    return "unknown";
  }
}

  // 读取支持的委托列表
  function loadSupportedCommissions() {
    let supportedCommissions = {
      fight: [],
      talk: []
    };
    
    try {
      // 使用正确的文件读取方法
      log.info("开始读取支持的委托列表: {path}", SUPPORT_LIST_PATH);
      
      // 尝试读取文件内容
      try {
        const supportListContent = file.readTextSync(SUPPORT_LIST_PATH);
        
        if (supportListContent && supportListContent.trim()) {
          try {
            // 解析JSON格式
            const commissionData = JSON.parse(supportListContent);
            supportedCommissions.fight = commissionData.fight || [];
            supportedCommissions.talk = commissionData.talk || [];
            
            log.info("已加载支持的战斗委托列表，共 {count} 个", supportedCommissions.fight.length);
            log.info("已加载支持的对话委托列表，共 {count} 个", supportedCommissions.talk.length);
          } catch (jsonError) {
            log.error("解析委托列表JSON失败: {error}", jsonError);
          }
        } else {
          log.warn("支持的委托列表为空");
        }
      } catch (readError) {
        // 如果读取失败，检查文件是否存在
        log.error("读取委托列表失败: {error}", readError);
        
        // 尝试创建文件
        try {
          // 创建默认的JSON结构
          const defaultJson = JSON.stringify({
            fight: [],
            talk: []
          }, null, 2);
          
          const writeResult = file.writeTextSync(SUPPORT_LIST_PATH, defaultJson);
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



/**
 * 优化后的委托识别主函数
 */
async function Identification() {
  try {
    log.info("开始执行原神每日委托识别脚本");
    await genshin.returnMainUi();
    setGameMetrics(1920, 1080, 1);
    
    // 加载支持的委托列表
    const supportedCommissions = loadSupportedCommissions();
    
    // 确保所有委托的资源目录存在
    for (const commission of supportedCommissions.fight) {
      ensureDirectoryExists(`assets/${commission}`);
    }
    for (const commission of supportedCommissions.talk) {
      ensureDirectoryExists(`assets/process/${commission}`);
    }

    // 进入委托界面
    const enterSuccess = await enterCommissionScreen();
    if (!enterSuccess) {
      log.error("无法进入委托界面，脚本终止");
      return;
    }
    await sleep(1000);
    
    // 步骤1: 执行第一次OCR识别
    log.info("步骤1: 执行第一次OCR识别");
    const ocrRo = RecognitionObject.Ocr(
      OCR_REGION_X, 
      OCR_REGION_Y, 
      OCR_REGION_WIDTH, 
      OCR_REGION_HEIGHT
    );
    
    await sleep(2000);
    
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
        
        // 检查委托类型
        const isFightCommission = supportedCommissions.fight.includes(text);
        const isTalkCommission = supportedCommissions.talk.includes(text);
        const isSupported = isFightCommission || isTalkCommission;
        const commissionType = isFightCommission ? COMMISSION_TYPE.FIGHT : 
                              (isTalkCommission ? COMMISSION_TYPE.TALK : "");
        
        firstCommissions.push({
          id: i + 1,
          name: text,
          supported: isSupported,
          type: commissionType,
          location: ""
        });
      }
    }
    
    // 步骤2: 使用图像识别检测前3个委托的完成状态
    log.info("步骤2: 检测前3个委托的完成状态");
    for (let i = 0; i < Math.min(3, firstCommissions.length); i++) {
      const commission = firstCommissions[i];
      
      // 使用图像识别检测完成状态
      const status = await detectCommissionStatusByImage(i);
      
      if (status === "completed") {
        log.info("委托{id} {name} 已完成，跳过详情查看", commission.id, commission.name);
        commission.location = "已完成";
        continue;
      } else if (status === "uncompleted") {
        log.info("委托{id} {name} 未完成，查看详情", commission.id, commission.name);
      } else {
        log.warn("委托{id} {name} 状态未知，尝试查看详情", commission.id, commission.name);
      }
      
      // 只有未完成或状态未知的委托才点击查看详情
      log.info("查看第{id}个委托详情: {name}", commission.id, commission.name);
      
      // 点击详情按钮
      const detailButton = COMMISSION_DETAIL_BUTTONS[commission.id - 1];
      log.info("点击委托详情按钮 ({x}, {y})", detailButton.x, detailButton.y);
      click(detailButton.x, detailButton.y);
      await sleep(2500);
      
      // 检测是否成功进入详情界面
      const detailStatus = await checkDetailPageEntered();
      log.info(`委托详情界面状态: ${detailStatus}`);
      
      // 根据检测结果处理
      if (detailStatus === "已完成") {
        log.info("该委托已完成，跳过地点识别和退出操作");
        commission.location = "已完成";
        continue;
      } else if (detailStatus === "未知" || detailStatus === "错误") {
        log.warn("无法确认是否进入详情界面，尝试继续执行");
        const location = recognizeCommissionLocation();
        commission.location = location;
        log.info("委托 {name} 的地点: {location}", commission.name, location);
      } else {
        const location = recognizeCommissionLocation();
        commission.location = location;
        log.info("委托 {name} 的地点: {location}", commission.name, location);
      }
      
      // 退出详情页面
      if (detailStatus !== "未知") {
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
    await sleep(2000);
    
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
        
        // 检查委托类型
        const isFightCommission = supportedCommissions.fight.includes(text);
        const isTalkCommission = supportedCommissions.talk.includes(text);
        const isSupported = isFightCommission || isTalkCommission;
        const commissionType = isFightCommission ? COMMISSION_TYPE.FIGHT : 
                              (isTalkCommission ? COMMISSION_TYPE.TALK : "");
        
        fourthCommission = {
          id: 4,
          name: text,
          supported: isSupported,
          type: commissionType,
          location: ""
        };
      }
    }

    // 步骤5: 检测第4个委托的完成状态
    if (fourthCommission) {
      log.info("步骤5: 检测第4个委托的完成状态");
      
      // 使用图像识别检测完成状态
      const status = await detectCommissionStatusByImage(3); // 第4个按钮索引为3
      
      if (status === "completed") {
        log.info("委托4 {name} 已完成，跳过详情查看", fourthCommission.name);
        fourthCommission.location = "已完成";
      } else if (status === "uncompleted" || status === "unknown") {
        log.info("委托4 {name} 需要查看详情", fourthCommission.name);
        
        // 点击详情按钮
        const detailButton = COMMISSION_DETAIL_BUTTONS[3];
        log.info("点击委托详情按钮 ({x}, {y})", detailButton.x, detailButton.y);
        click(detailButton.x, detailButton.y);
        await sleep(2500);
        
        // 检测是否成功进入详情界面
        const detailStatus = await checkDetailPageEntered();
        log.info(`委托详情界面状态: ${detailStatus}`);
        
        // 根据检测结果处理
        if (detailStatus === "已完成") {
          log.info("该委托已完成，跳过地点识别和退出操作");
          fourthCommission.location = "已完成";
        } else if (detailStatus === "未知" || detailStatus === "错误") {
          log.warn("无法确认是否进入详情界面，尝试继续执行");
          const location = recognizeCommissionLocation();
          fourthCommission.location = location;
          log.info("委托 {name} 的地点: {location}", fourthCommission.name, location);
        } else {
          location = recognizeCommissionLocation();
          fourthCommission.location = location;
          log.info("委托 {name} 的地点: {location}", fourthCommission.name, location);
        }
        
        // 退出详情页面
        if (detailStatus !== "未知") {
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
      const typeInfo = commission.type ? `[${commission.type}]` : "";
      log.info("{id}. {name} {location} {type} - {status}", 
        commission.id, commission.name, locationInfo, typeInfo, supportStatus);
    }
    
    // 保存委托数据
    saveCommissionsData(allCommissions);

    log.info("原神每日委托识别脚本执行完成");
  } catch (error) {
    log.error("脚本执行出错: {error}", error);
  }
}

/**
 * 执行对话委托流程
 * @param {string} commissionName - 委托名称
 * @param {string} location - 委托地点
 * @returns {Promise<boolean>} - 执行结果
 */
async function executeTalkCommission(commissionName, location) {
  try {
    log.info("开始执行对话委托: {name} ({location})", commissionName, location);
    
    // 构建可能的流程文件路径
    const processBasePath = `${TALK_PROCESS_BASE_PATH}/${commissionName}`;
    const processFilePaths = [
      `${processBasePath}/process.json`,
      `${processBasePath}/${location}/process.json`
    ];
    
    let processFilePath = null;
    
    // 查找流程文件
    for (const path of processFilePaths) {
      try {
        await file.readText(path);
        processFilePath = path;
        log.info("找到对话委托流程文件: {path}", path);
        break;
      } catch (error) {
        log.info("对话委托流程文件不存在: {path}", path);
      }
    }
    
    if (!processFilePath) {
      log.warn("未找到对话委托 {name} 在 {location} 的流程文件", commissionName, location);
      return false;
    }
    
    // 读取流程文件内容
    const processContent = await file.readText(processFilePath);
    
    // 判断是简单格式还是JSON格式
    let isJsonFormat = false;
    try {
      JSON.parse(processContent);
      isJsonFormat = true;
    } catch (error) {
      isJsonFormat = false;
    }
    
    if (isJsonFormat) {
      // 处理JSON格式的流程
      return await executeJsonProcess(processContent, commissionName, location);
    } else {
      // 处理简单格式的流程
      return await executeSimpleProcess(processContent, commissionName, location);
    }
    
  } catch (error) {
    log.error("执行对话委托时出错: {error}", error);
    return false;
  }
}

/**
 * 执行简单格式的对话委托流程
 * @param {string} processContent - 流程内容
 * @param {string} commissionName - 委托名称
 * @param {string} location - 委托地点
 * @returns {Promise<boolean>} - 执行结果
 */
async function executeSimpleProcess(processContent, commissionName, location) {
  try {
    log.info("执行简单格式的对话委托流程: {name}", commissionName);
    
    // 按行分割流程内容
    const lines = processContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      log.info("执行流程步骤 {step}: {line}", i + 1, line);
      
      if (line.endsWith(".json")) {
        // 地图追踪文件
        const trackingPath = `assets/process/${commissionName}/${line}`;
        log.info("执行地图追踪: {path}", trackingPath);
        try {
          await pathingScript.runFile(trackingPath);
          log.info("地图追踪执行完成");
        } catch (error) {
          log.error("执行地图追踪时出错: {error}", error);
        }
      } else if (line === "F") {
        // 按F键并等待对话结束
        log.info("按下F键并等待对话结束");
        keyPress("F");
        
        // 定义识别对象
        const paimonMenuRo = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync("Data/RecognitionObject/paimon_menu.png"), 
          0, 0, genshin.width / 3.0, genshin.width / 5.0
        );
        
        // 判断是否在主界面的函数
        const isInMainUI = () => {
          let captureRegion = captureGameRegion();  // 获取一张截图
          let res = captureRegion.Find(paimonMenuRo);
          return !res.isEmpty();
        };
        
        // 重复执行自动剧情，直到返回主界面
        let maxAttempts = 100; // 设置最大尝试次数，防止无限循环
        let attempts = 0;
        await sleep(1000);
        log.info("开始执行自动剧情循环");
        
        while (!isInMainUI() && attempts < maxAttempts) {
          attempts++;
          log.info(`执行第 ${attempts} 次自动剧情选择`);
          await genshin.chooseTalkOption("", 10, false);
          
          // 检查是否已返回主界面
          if (isInMainUI()) {
            log.info("检测到已返回主界面，结束循环");
            break;
          }
        }
        
        if (isInMainUI()) {
          log.info("已返回主界面，自动剧情执行完成");
        } else {
          log.warn(`已达到最大尝试次数 ${maxAttempts}，但未检测到返回主界面`);
        }
      } else {
        // 其他未知命令
        log.warn("未知的流程命令: {command}", line);
      }
      
      // 每个步骤之间等待一段时间
      await sleep(2000);
    }
    
    log.info("简单格式的对话委托流程执行完成: {name}", commissionName);
    return true;
  } catch (error) {
    log.error("执行简单格式的对话委托流程时出错: {error}", error);
    return false;
  }
}

/**
 * 执行JSON格式的对话委托流程
 * @param {string} processContent - 流程内容
 * @param {string} commissionName - 委托名称
 * @param {string} location - 委托地点
 * @returns {Promise<boolean>} - 执行结果
 */
async function executeJsonProcess(processContent, commissionName, location) {
  try {
    log.info("执行JSON格式的对话委托流程: {name}", commissionName);
    
    // 解析JSON内容
    const processSteps = JSON.parse(processContent);
    
    // 如果是数组，则按顺序执行每个步骤
    if (Array.isArray(processSteps)) {
      for (let i = 0; i < processSteps.length; i++) {
        const step = processSteps[i];
        log.info("执行流程步骤 {step}: {type}", i + 1, step.type);
        
        // 如果有注释，输出注释
        if (step.note) {
          log.info("步骤说明: {note}", step.note);
        }
        
        switch (step.type) {
          case "地图追踪":
            // 执行地图追踪
            log.info("执行地图追踪: {path}", step.data);
            try {
              await pathingScript.runFile(step.data);
              log.info("地图追踪执行完成");
            } catch (error) {
              log.error("执行地图追踪时出错: {error}", error);
            }
            break;
            
          case "键鼠脚本":
            // 执行键鼠脚本
            log.info("执行键鼠脚本: {path}", step.data);
            try {
              await runFile(step.data);
              log.info("键鼠脚本执行完成");
            } catch (error) {
              log.error("执行键鼠脚本时出错: {error}", error);
            }
            break;
            
          case "对话":
            // 执行对话
            log.info("执行对话流程");
            keyPress("F");
            
            // 定义识别对象
            const paimonMenuRo = RecognitionObject.TemplateMatch(
              file.ReadImageMatSync("Data/RecognitionObject/paimon_menu.png"), 
              0, 0, genshin.width / 3.0, genshin.width / 5.0
            );
            
            // 判断是否在主界面的函数
            const isInMainUI = () => {
              let captureRegion = captureGameRegion();  // 获取一张截图
              let res = captureRegion.Find(paimonMenuRo);
              return !res.isEmpty();
            };
            
            // 重复执行自动剧情，直到返回主界面
            let maxAttempts = 100; // 设置最大尝试次数，防止无限循环
            let attempts = 0;
            await sleep(1000);
            log.info("开始执行自动剧情循环");
            
            const skipCount = step.data || 10; // 默认跳过10次对话
            
            while (!isInMainUI() && attempts < maxAttempts) {
              attempts++;
              log.info(`执行第 ${attempts} 次自动剧情选择`);
              await genshin.chooseTalkOption("", skipCount, false);
              
              // 检查是否已返回主界面
              if (isInMainUI()) {
                log.info("检测到已返回主界面，结束循环");
                break;
              }
            }
            
            if (isInMainUI()) {
              log.info("已返回主界面，自动剧情执行完成");
            } else {
              log.warn(`已达到最大尝试次数 ${maxAttempts}，但未检测到返回主界面`);
            }
            break;
            
          case "按键":
            // 执行按键操作
            if (typeof step.data === "string") {
              // 单个按键
              log.info("执行按键: {key}", step.data);
              keyPress(step.data);
            } else if (typeof step.data === "object") {
              // 复杂按键操作
              if (step.data.action === "down") {
                log.info("按下按键: {key}", step.data.key);
                keyDown(step.data.key);
              } else if (step.data.action === "up") {
                log.info("释放按键: {key}", step.data.key);
                keyUp(step.data.key);
              } else if (step.data.action === "press") {
                log.info("点击按键: {key}", step.data.key);
                keyPress(step.data.key);
              }
            }
            break;
            
          case "tp":
            // 执行传送
            if (Array.isArray(step.data) && step.data.length >= 2) {
              log.info("执行传送: {x}, {y}", step.data[0], step.data[1]);
              const force = step.data.length > 2 ? step.data[2] : false;
              await genshin.tp(step.data[0], step.data[1], force);
              log.info("传送完成");
            } else {
              log.error("传送参数格式错误");
            }
            break;
            
          default:
            log.warn("未知的流程类型: {type}", step.type);
        }
        
        // 每个步骤之间等待一段时间
        await sleep(2000);
      }
    } else {
      log.error("JSON流程格式错误，应为数组");
      return false;
    }
    
    log.info("JSON格式的对话委托流程执行完成: {name}", commissionName);
    return true;
  } catch (error) {
    log.error("执行JSON格式的对话委托流程时出错: {error}", error);
    return false;
  }
}

/**
 * 执行委托追踪
 * 新版本：执行所有委托而不检测触发状态
 */
async function executeCommissionTracking_old() {
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
      
      log.info("开始执行委托: {name} ({location}) [{type}]", 
        commission.name, commission.location, commission.type || "未知类型");
      
      // 根据委托类型执行不同的处理逻辑
      if (commission.type === COMMISSION_TYPE.TALK) {
        // 执行对话委托
        const success = await executeTalkCommission(commission.name, commission.location);
        if (success) {
          completedCount++;
          log.info("对话委托 {name} 执行完成", commission.name);
        } else {
          log.warn("对话委托 {name} 执行失败", commission.name);
        }
      } else {
        // 默认执行战斗委托
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
          } catch (scriptError) {
            log.error("执行路径追踪脚本时出错: {error}", scriptError);
          }
        }
        
        if (!scriptFound) {
          log.warn("未找到委托 {name} 在 {location} 的路径追踪脚本", commission.name, location);
        } else if (scriptExecuted) {
          completedCount++;
          log.info("战斗委托 {name} 执行完成", commission.name);
        }
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
      
      log.info("开始执行委托: {name} ({location}) [{type}]", 
        commission.name, commission.location, commission.type || "未知类型");
      
      // 根据委托类型执行不同的处理逻辑
      if (commission.type === COMMISSION_TYPE.TALK) {
        // 执行对话委托
        const success = await executeTalkCommission(commission.name, commission.location);
        if (success) {
          completedCount++;
          log.info("对话委托 {name} 执行完成", commission.name);
        } else {
          log.warn("对话委托 {name} 执行失败", commission.name);
        }
      } else {
        // 默认执行战斗委托
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
          } catch (scriptError) {
            log.error("执行路径追踪脚本时出错: {error}", scriptError);
          }
        }
        
        if (!scriptFound) {
          log.warn("未找到委托 {name} 在 {location} 的路径追踪脚本", commission.name, location);
        } else if (scriptExecuted) {
          completedCount++;
          log.info("战斗委托 {name} 执行完成", commission.name);
        }
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
