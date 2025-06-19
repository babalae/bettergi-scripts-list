// V0.97.2
(async function () {
  // 定义常量
  const OCR_REGION_X = 750;
  const OCR_REGION_Y = 250;
  const OCR_REGION_WIDTH = 450; // 1200 - 750
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
    TALK: "talk",
  };

  // 对话委托流程路径
  const TALK_PROCESS_BASE_PATH = "assets/process";

  // 委托详情按钮位置（扩展检测范围左右+50像素）
  const COMMISSION_DETAIL_BUTTONS = [
    { id: 1, x: 1550, y: 320, checkX: 1450, checkWidth: 150 }, // 第一个委托详情按钮
    { id: 2, x: 1550, y: 420, checkX: 1450, checkWidth: 150 }, // 第二个委托详情按钮
    { id: 3, x: 1550, y: 530, checkX: 1500, checkWidth: 100 }, // 第三个委托详情按钮
    { id: 4, x: 1550, y: 560, checkX: 1450, checkWidth: 150 }, // 第四个委托详情按钮（滑动后）
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
  //const debugMode = settings.debugMode || false;
  const minTextLength = parseInt(settings.minTextLength || "4");
  const team = settings.team || "";

  // 存储当前委托位置
  let currentCommissionPosition = null;

  async function prepareForLeyLineRun() {
    // 开局传送到七天神像
    await genshin.returnMainUi();
    await genshin.tpToStatueOfTheSeven();
    // 切换战斗队伍
    if (team) {
      log.info(`切换至队伍 ${team}`);
      await genshin.switchParty(team);
    }
  }

/**
 * 自动导航到NPC对话位置
 * @param {string} npcName - 目标NPC名称
 * @param {string} iconType - 图标类型 ("task"或"bigmap")
 * @returns {Promise<void>}
 */
const autoNavigateToTalk = async (npcName = "", iconType = "") => {
  // 设置目标NPC名称
  const textArray = [npcName];
  //log.info(npcName + iconType);
  // 根据图标类型选择不同的识别对象
  let boxIconRo;
  if (iconType === "task") {
    boxIconRo = RecognitionObject.TemplateMatch(
      file.ReadImageMatSync("Data/RecognitionObject/IconTaskCommission.png")
      
    );
    log.info("使用任务图标");
  } else { // 默认使用大地图图标
    boxIconRo = RecognitionObject.TemplateMatch(
      file.ReadImageMatSync("Data/RecognitionObject/IconBigmapCommission.jpg")
    );
  }
  
  const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50); //对话区域检测
  let advanceNum = 0; //前进次数

  middleButtonClick();
  await sleep(800);

  while (true) {
    // 1. 优先检查是否已到达
    let captureRegion = captureGameRegion();
    let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
    let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
    // 检测到特点文字则结束！！！
    if (rewardResult.text == textArray[0]) {
      log.info("已到达指定位置，检测到文字: " + rewardResult.text);
      return;
    } else if (advanceNum > 80) {
      throw new Error("前进时间超时");
    }
    // 2. 未到达领奖点，则调整视野
    for (let i = 0; i < 100; i++) {
      captureRegion = captureGameRegion();
      let iconRes = captureRegion.Find(boxIconRo);
      log.info(
        "检测到委托图标位置 ({x}, {y})",
        iconRes.x,
        iconRes.y
      )
      let climbTextArea = captureRegion.DeriveCrop(1808, 1030, 25, 25);
      let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
      // 检查是否处于攀爬状态
      if (climbResult.isEmpty()) {
        log.info("检侧进入攀爬状态，尝试脱离");
        keyPress("x");
        await sleep(1000);
        keyDown("a");
        await sleep(800);
        keyUp("a");
        keyDown("w");
        await sleep(800);
        keyUp("w");
      }
      if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {
        advanceNum++;
        log.info(`视野已调正，前进第${advanceNum}次`);
        break;
      } else {
        // 小幅度调整
        if (iconRes.y >= 520) moveMouseBy(0, 920);
        let adjustAmount = iconRes.x < 920 ? -20 : 20;
        let distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
        let scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
        let adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
        moveMouseBy(adjustAmount * adjustAmount2, 0);
        await sleep(100);
      }
      if (i > 50) throw new Error("视野调整超时");
    }
    // 3. 前进一小步
    keyDown("w");
    await sleep(500);
    keyUp("w");
    await sleep(200); // 等待角色移动稳定
  }
};

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

      //log.info("检测委托{id}的完成状态（图像识别）", button.id);

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
      const completedRo = RecognitionObject.TemplateMatch(
        completedTemplate,
        0,
        0,
        button.checkWidth,
        60
      );
      const uncompletedRo = RecognitionObject.TemplateMatch(
        uncompletedTemplate,
        0,
        0,
        button.checkWidth,
        60
      );

      // 降低匹配阈值，提高识别灵活性
      completedRo.threshold = 0.65;
      uncompletedRo.threshold = 0.65;

      // 检测完成状态
      const completedResult = checkRegion.find(completedRo);
      if (!completedResult.isEmpty()) {
        //log.info("委托{id}已完成", button.id);
        return "completed";
      }

      // 检测未完成状态
      const uncompletedResult = checkRegion.find(uncompletedRo);
      if (!uncompletedResult.isEmpty()) {
        //log.info("委托{id}未完成", button.id);
        return "uncompleted";
      }

      /* 尝试使用更低的阈值再次检测
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
    }*/

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
      talk: [],
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

            log.info(
              "已加载支持的战斗委托列表，共 {count} 个",
              supportedCommissions.fight.length
            );
            log.info(
              "已加载支持的对话委托列表，共 {count} 个",
              supportedCommissions.talk.length
            );
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
          const defaultJson = JSON.stringify(
            {
              fight: [],
              talk: [],
            },
            null,
            2
          );

          const writeResult = file.writeTextSync(
            SUPPORT_LIST_PATH,
            defaultJson
          );
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
      keyPress("VK_F1");
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
      log.info(
        "识别委托地点 ({x}, {y}) ({width}, {height})...",
        LOCATION_OCR_X,
        LOCATION_OCR_Y,
        LOCATION_OCR_X + LOCATION_OCR_WIDTH,
        LOCATION_OCR_Y + LOCATION_OCR_HEIGHT
      );

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
        commissions: commissionsTable,
      };

      // 保存到文件
      const outputPath = `${OUTPUT_DIR}/commissions_data.json`;
      try {
        const jsonResult = file.writeTextSync(
          outputPath,
          JSON.stringify(commissionsData, null, 2)
        );
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
        const locationInfo = commission.location
          ? `(${commission.location})`
          : "";
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

      return commissionsTable.filter((c) => c.supported);
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
      //log.info("检测是否进入委托详情界面...");

      // 创建OCR识别对象 - 检测区域(1480,100)到(1535,130)
      const detailOcrRo = RecognitionObject.Ocr(
        1480,
        100,
        55, // 1535 - 1480
        30 // 130 - 100
      );

      // 尝试3次OCR识别
      for (let i = 0; i < 3; i++) {
        //log.info(`执行第${i + 1}次详情界面OCR检测`);
        let captureRegion = captureGameRegion();
        let results = captureRegion.findMulti(detailOcrRo);

        if (results.count > 0) {
          // 检查OCR结果
          for (let j = 0; j < results.count; j++) {
            const text = results[j].text.trim();
            //log.info(`检测到文本: "${text}"`);

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

      log.info("三次OCR检测后仍未确认委托国家");
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

      // 第一次截图识别
      log.info(
        "执行第一次OCR识别 ({x}, {y}) ({width}, {height})",
        OCR_REGION_X,
        OCR_REGION_Y,
        OCR_REGION_X + OCR_REGION_WIDTH,
        OCR_REGION_Y + OCR_REGION_HEIGHT
      );
      let captureRegion = captureGameRegion();
      let firstResults = captureRegion.findMulti(ocrRo);
      log.info("第一次OCR识别结果数量: {count}", firstResults.count);

      // 处理第一次识别结果
      let firstCommissions = [];
      for (let i = 0; i < firstResults.count; i++) {
        let result = firstResults[i];
        let text = cleanText(result.text);
        if (text && text.length >= minTextLength) {
          log.info('第{index}个委托: "{text}"', i + 1, text);

          // 检查委托类型
          const isFightCommission = supportedCommissions.fight.includes(text);
          const isTalkCommission = supportedCommissions.talk.includes(text);
          const isSupported = isFightCommission || isTalkCommission;
          const commissionType = isFightCommission
            ? COMMISSION_TYPE.FIGHT
            : isTalkCommission
            ? COMMISSION_TYPE.TALK
            : "";

          firstCommissions.push({
            id: i + 1,
            name: text,
            supported: isSupported,
            type: commissionType,
            location: "",
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
          log.info(
            "委托{id} {name} 已完成，跳过详情查看",
            commission.id,
            commission.name
          );
          commission.location = "已完成";
          continue;
        } else if (status === "uncompleted") {
          log.info(
            "委托{id} {name} 未完成，查看详情",
            commission.id,
            commission.name
          );
        } else {
          log.warn(
            "委托{id} {name} 状态未知，尝试查看详情",
            commission.id,
            commission.name
          );
        }

        // 只有未完成或状态未知的委托才点击查看详情
        log.info(
          "查看第{id}个委托详情: {name}",
          commission.id,
          commission.name
        );

        // 点击详情按钮
        const detailButton = COMMISSION_DETAIL_BUTTONS[commission.id - 1];
        log.info("点击委托详情按钮 ({x}, {y})", detailButton.x, detailButton.y);
        click(detailButton.x, detailButton.y);
        await sleep(2500);

        // 检测委托国家
        const detailStatus = await checkDetailPageEntered();
        log.info(`委托国家: ${detailStatus}`);
        commission.country = detailStatus;
        const location = recognizeCommissionLocation();
        commission.location = location;
        log.info("委托 {name} 的地点: {location}", commission.name, location);

        // 退出详情页面并获取地图坐标
        if (commission.location !== "已完成") {
          log.info("退出详情页面 - 按ESC");
          keyDown("VK_ESCAPE");
          await sleep(300);
          keyUp("VK_ESCAPE");
          await sleep(1200);

          // 获取地图坐标并保存
          const bigMapPosition = genshin.getPositionFromBigMap();
          if (bigMapPosition) {
            currentCommissionPosition = bigMapPosition;
            commission.CommissionPosition = bigMapPosition;
            log.info(
              "当前委托位置: ({x}, {y})",
              bigMapPosition.x,
              bigMapPosition.y
            );
          }

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
      log.info(
        "步骤4: 执行第二次OCR识别({x}, {y}) ({width}, {height})",
        OCR_REGION_X,
        OCR_REGION_Y,
        OCR_REGION_X + OCR_REGION_WIDTH,
        OCR_REGION_Y + OCR_REGION_HEIGHT
      );
      captureRegion = captureGameRegion();
      let secondResults = captureRegion.findMulti(ocrRo);
      log.info("第二次OCR识别结果数量: {count}", secondResults.count);

      // 处理第二次识别结果
      let fourthCommission = null;
      for (let i = 0; i < secondResults.count; i++) {
        let result = secondResults[i];
        let text = cleanText(result.text);
        if (text && text.length >= minTextLength) {
          log.info('第4个委托: "{text}"', text);

          // 检查委托类型
          const isFightCommission = supportedCommissions.fight.includes(text);
          const isTalkCommission = supportedCommissions.talk.includes(text);
          const isSupported = isFightCommission || isTalkCommission;
          const commissionType = isFightCommission
            ? COMMISSION_TYPE.FIGHT
            : isTalkCommission
            ? COMMISSION_TYPE.TALK
            : "";

          fourthCommission = {
            id: 4,
            name: text,
            supported: isSupported,
            type: commissionType,
            location: "",
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
          log.info(
            "点击委托详情按钮 ({x}, {y})",
            detailButton.x,
            detailButton.y
          );
          click(detailButton.x, detailButton.y);
          await sleep(2500);

          // 检测是否成功进入详情界面并获取委托国家
          const detailStatus = await checkDetailPageEntered();
          log.info(`委托国家: ${detailStatus}`);
          fourthCommission.country = detailStatus;

          // 根据检测结果处理
          if (fourthCommission.location === "已完成") {
            log.info("该委托已完成，跳过地点识别和退出操作");
            fourthCommission.location = "已完成";
          } else {
            location = recognizeCommissionLocation();
            fourthCommission.location = location;
            log.info(
              "委托 {name} 的地点: {location}",
              fourthCommission.name,
              location
            );
          }

          // 退出详情页面并获取地图坐标
          if (fourthCommission.location !== "未知") {
            log.info("退出详情页面 - 按ESC");
            keyDown("VK_ESCAPE");
            await sleep(300);
            keyUp("VK_ESCAPE");
            await sleep(1200);

            // 获取地图坐标并保存
            const bigMapPosition = genshin.getPositionFromBigMap();
            if (bigMapPosition) {
              currentCommissionPosition = bigMapPosition;
              fourthCommission.CommissionPosition = bigMapPosition;
              log.info(
                "当前委托位置: ({x}, {y})",
                bigMapPosition.x,
                bigMapPosition.y
              );
            }

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
        const locationInfo = commission.location
          ? `(${commission.location})`
          : "";
        const typeInfo = commission.type ? `[${commission.type}]` : "";
        log.info(
          "{id}. {name} {location} {type} - {status}",
          commission.id,
          commission.name,
          locationInfo,
          typeInfo,
          supportStatus
        );
      }

      // 保存委托数据
      saveCommissionsData(allCommissions);

      log.info("原神每日委托识别脚本执行完成");
    } catch (error) {
      log.error("脚本执行出错: {error}", error);
    }
  }

  /**
   * 计算两点之间的距离
   * @param {Object} pos1 - 位置1 {x, y}
   * @param {Object} pos2 - 位置2 {x, y}
   * @returns {number} 距离
   */
  function calculateDistance(point1, point2) {
    if (
      !point1 ||
      !point2 ||
      !point1.X ||
      !point1.Y ||
      !point2.x ||
      !point2.y
    ) {
      log.warn("无效的位置数据");
      return Infinity;
    }
    return Math.sqrt(
      Math.pow(point1.X - point2.x, 2) + Math.pow(point1.Y - point2.y, 2)
    );
  }

  /**
   * 获取委托的目标坐标（从路径追踪文件中获取最后一个坐标）
   * @param {string} scriptPath - 委托的脚本路径
   * @returns {Object|null} 目标坐标 {x, y} 或 null
   */
  async function getCommissionTargetPosition(scriptPath) {
    try {
      const scriptContent = await file.readText(scriptPath);
      const pathData = JSON.parse(scriptContent);

      if (!pathData.positions || pathData.positions.length === 0) {
        log.warn("路径追踪文件 {path} 中没有有效的坐标数据", scriptPath);
        return null;
      }

      const lastPosition = pathData.positions[pathData.positions.length - 1];
      if (!lastPosition.x || !lastPosition.y) {
        log.warn(
          "路径追踪文件 {path} 的最后一个路径点缺少坐标数据",
          scriptPath
        );
        return null;
      }

      log.debug(
        "从脚本路径 {path} 获取到目标坐标: ({x}, {y})",
        scriptPath,
        lastPosition.x,
        lastPosition.y
      );
      return {
        x: lastPosition.x,
        y: lastPosition.y,
      };
    } catch (error) {
      log.error("获取委托目标位置时出错: {error}", error);
      return null;
    }
  }

  /**
   * 统一的对话委托流程处理器
   * @param {Array} processSteps - 处理步骤数组
   * @param {string} commissionName - 委托名称
   * @param {string} location - 委托地点
   * @returns {Promise<boolean>} - 执行结果
   */
  async function executeUnifiedTalkProcess(
    processSteps,
    commissionName,
    location
  ) {
    try {
      log.info("执行统一对话委托流程: {name}", commissionName);

      // 加载优先选项和白名单NPC名称的默认值
      let priorityOptions = [];
      let npcWhiteList = [];
      let clickedExtractedName = false;

      // 定义识别对象
      const paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("Data/RecognitionObject/paimon_menu.png"),
        0,
        0,
        genshin.width / 3.0,
        genshin.width / 5.0
      );

      // 判断是否在主界面的函数
      const isInMainUI = () => {
        let captureRegion = captureGameRegion();
        let res = captureRegion.Find(paimonMenuRo);
        return !res.isEmpty();
      };

      // 人名提取函数
      const extractName = (text) => {
        const patterns = [
          /与(.+?)对话/,
          /与(.+?)一起/,
          /同(.+?)交谈/,
          /向(.+?)打听/,
          /向(.+?)回报/,
          /陪同(.+?)\S+/,
          /找到(.+?)\S+/,
          /询问(.+?)\S+/,
          /拜访(.+?)\S+/,
          /寻找(.+?)\S+/,
          /告诉(.+?)\S+/,
          /带(.+?)去\S+/,
          /跟随(.+?)\S+/,
          /协助(.+?)\S+/,
          /请教(.+?)\S+/,
          /拜托(.+?)\S+/,
          /委托(.+?)\S+/,
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        return null;
      };

      // 自动剧情函数
      const executeOptimizedAutoTalk = async (
        extractedName = null,
        skipCount = 5,
        customPriorityOptions = null,
        customNpcWhiteList = null
      ) => {
        // 使用传入的参数，不再加载默认配置
        const effectivePriorityOptions = customPriorityOptions || [];
        const effectiveNpcWhiteList = customNpcWhiteList || [];

        // 初始化
        keyPress("V");

        // 初始触发剧情 - 识别人名并点击
        extractedName = [];
        let captureRegion = captureGameRegion();
        let nameArea = captureRegion.DeriveCrop(75, 240, 225, 60); // 人名区域
        let nameOcrRo = RecognitionObject.Ocr(
          0,
          0,
          nameArea.width,
          nameArea.height
        );
        let nameResults = nameArea.FindMulti(nameOcrRo);
        // 尝试提取任务人名
        for (let i = 0; i < nameResults.count; i++) {
          let text = nameResults[i].text;
          log.info(`任务区域识别文本: ${text}`);

          // 尝试提取任务人名
          let name = extractName(text);
          if (name) {
            extractedName = name;
            log.info(`提取到人名: ${extractedName}`);
            break;
          }
        }

        nameArea = captureRegion.DeriveCrop(1150, 300, 350, 400);
        //nameArea = captureRegion.DeriveCrop(0, 0, 1920, 1080);
        nameOcrRo = RecognitionObject.Ocr(
          0,
          0,
          nameArea.width,
          nameArea.height
        );
        nameResults = nameArea.FindMulti(nameOcrRo);
        let clickedWhitelistNPC = false;

        // 处理人名区域的OCR结果
        if (nameResults.count > 0) {
          log.info(`人名区域识别到 ${nameResults.count} 个文本`);

          // 首先尝试点击白名单中的NPC
          for (let i = 0; i < nameResults.count; i++) {
            let text = nameResults[i].text;
            let res = nameResults[i];
            log.info(
              "人名区域识别到{text}:位置({x},{y},{h},{w})",
              res.text,
              res.x,
              res.y,
              res.width,
              res.Height
            );
            // 检查是否包含白名单中的NPC名称
            for (let j = 0; j < effectiveNpcWhiteList.length; j++) {
              if (text.includes(effectiveNpcWhiteList[j])) {
                log.info(
                  `找到白名单NPC: ${effectiveNpcWhiteList[j]}，点击该NPC`
                );
                keyDown("VK_MENU");
                await sleep(500);
                click(res.x + 1150, res.y + 300);
                leftButtonClick();
                keyUp("VK_MENU");
                clickedWhitelistNPC = true;
                break;
              }
            }
            if (clickedWhitelistNPC) break;
          }

          // 如果没有点击白名单NPC，尝试点击包含提取到的人名的选项
          if (!clickedWhitelistNPC && extractedName) {
            for (let i = 0; i < nameResults.count; i++) {
              let text = nameResults[i].text;
              let res = nameResults[i];
              if (text.includes(extractedName)) {
                log.info(`点击包含提取到任务人名的选项: ${text}`);
                keyDown("VK_MENU");
                await sleep(500);
                click(res.x + 1150, res.y + 300);
                leftButtonClick();
                keyUp("VK_MENU");
                clickedExtractedName = true;
                break;
              }
            }
          }
        }

        // 如果没有找到NPC，使用默认触发
        if (!clickedWhitelistNPC && !clickedExtractedName) {
          log.info("未找到匹配的NPC，使用默认触发方式");
          keyPress("F"); // 默认触发剧情
          await sleep(500);
        }

        // 重复执行自动剧情，直到返回主界面
        let maxAttempts = 100; // 设置最大尝试次数，防止无限循环
        let attempts = 0;
        await sleep(1000);
        log.info("开始执行自动剧情");

        while (!isInMainUI() && attempts < maxAttempts) {
          attempts++;

          // 正常跳过对话
          await genshin.chooseTalkOption(
            "纳西妲美貌举世无双",
            skipCount,
            false
          );

          if (isInMainUI()) {
            log.info("检测到已返回主界面，结束循环");
            break;
          }

          // 每skipCount次跳过后，进行OCR识别
          if (true) {
            //log.info("执行OCR识别对话选项");

            // 检查是否有匹配的优先选项
            let foundPriorityOption = false;

            // 获取对话区域截图并进行OCR识别
            let captureRegion = captureGameRegion();
            let dialogArea = captureRegion.DeriveCrop(1250, 450, 550, 400); // 对话选项区域 1250,450 到 1800,850

            // 创建OCR识别对象并识别文本
            let ocrRo = RecognitionObject.Ocr(
              0,
              0,
              dialogArea.width,
              dialogArea.height
            );
            let ocrResults = dialogArea.FindMulti(ocrRo);
            if (ocrResults.count > 0) {
              log.info(`识别到 ${ocrResults.count} 个选项`);

              for (let i = 0; i < ocrResults.count; i++) {
                let ocrText = ocrResults[i].text;

                // 检查是否在优先选项列表中
                for (let j = 0; j < effectivePriorityOptions.length; j++) {
                  if (ocrText.includes(effectivePriorityOptions[j])) {
                    log.info(
                      `找到优先选项: ${effectivePriorityOptions[j]}，点击该选项`
                    );
                    // 点击该选项
                    ocrResults[i].click();
                    await sleep(500);
                    foundPriorityOption = true;
                    break;
                  }
                }

                if (foundPriorityOption) break;
              }

              // 如果没有找到优先选项，则使用默认跳过
              if (!foundPriorityOption) {
                await genshin.chooseTalkOption("", 1, false);
              }
            }
          }

          // 检查是否已返回主界面
          if (isInMainUI()) {
            log.info("检测到已返回主界面，结束循环");
            break;
          }
        }

        if (isInMainUI()) {
          log.info("已返回主界面，自动剧情执行完成");
          keyPress("V");
        } else {
          log.warn(`已达到最大尝试次数 ${maxAttempts}，但未检测到返回主界面`);
        }
      };

      // 执行处理步骤
      for (let i = 0; i < processSteps.length; i++) {
        const step = processSteps[i];
        log.info("执行流程步骤 {step}: {type}", i + 1, step.type || step);

        // 重置为默认值
        priorityOptions = [];
        npcWhiteList = [];

        // 如果步骤中包含自定义的优先选项和NPC白名单，则使用它们
        if (step.data && typeof step.data === "object") {
          if (Array.isArray(step.data.priorityOptions)) {
            priorityOptions = step.data.priorityOptions;
            log.info(
              "使用自定义优先选项: {options}",
              priorityOptions.join(", ")
            );
          }
          if (Array.isArray(step.data.npcWhiteList)) {
            npcWhiteList = step.data.npcWhiteList;
            log.info("使用自定义NPC白名单: {npcs}", npcWhiteList.join(", "));
          }
        }

        if (typeof step === "string") {//typeof step === "string"
          // 简单格式处理
          if (step.endsWith(".json")) {
            // 地图追踪文件
            const trackingPath = `${TALK_PROCESS_BASE_PATH}/${commissionName}/${location}/${step}`;
            log.info("执行地图追踪: {path}", trackingPath);
            try {
              await pathingScript.runFile(trackingPath);
              log.info("地图追踪执行完成");
            } catch (error) {
              log.error("执行地图追踪时出错: {error}", error);
            }
          } else if (step === "F") {
            // 按F键并执行优化的自动剧情
            log.info("执行自动剧情");
            await executeOptimizedAutoTalk(
              null,
              5,
              priorityOptions,
              npcWhiteList
            );
          } 
        } else if (typeof step === "object") {
          // JSON格式处理
          if (step.note) {
            log.info("步骤说明: {note}", step.note);
          }

          switch (step.type) {
            case "地图追踪":
              log.info("执行地图追踪: {path}", step.data);
              try {
                const fullPath = `${TALK_PROCESS_BASE_PATH}/${commissionName}/${location}/${step.data}`;
                await pathingScript.runFile(fullPath);
                log.info("地图追踪执行完成");
              } catch (error) {
                log.error("执行地图追踪时出错: {error}", error);
              }
              break;
              
            case "追踪委托":
              try {
                // 获取目标NPC名称和图标类型
                let targetNpc = "";
                let iconType = "bigmap";
                
                if (typeof step.data === "string") {
                  targetNpc = step.data;
                } else if (typeof step.data === "object") {
                  if (step.data.npc) targetNpc = step.data.npc;
                  if (step.data.iconType) iconType = step.data.iconType;
                }
                
                log.info("执行追踪委托，目标NPC: {target}，图标类型: {type}", targetNpc, iconType);
                await autoNavigateToTalk(targetNpc, iconType);
                log.info("追踪委托执行完成");
              } catch (error) {
                log.error("执行追踪委托时出错: {error}", error.message);
              }
              break;

            case "键鼠脚本":
              log.info("执行键鼠脚本: {path}", step.data);
              try {
                const fullPath = `${TALK_PROCESS_BASE_PATH}/${commissionName}/${location}/${step.data}`;
                await keyMouseScript.runFile(fullPath);
                log.info("键鼠脚本执行完成");
              } catch (error) {
                log.error("执行键鼠脚本时出错: {error}", error.message);
              }
              break;

            case "对话":
              log.info("执行对话");
              let skipCount = 5; // 默认跳过5次

              // 处理对话选项
              if (typeof step.data === "number") {
                // 兼容旧版本，如果data是数字，则视为skipCount
                skipCount = step.data;
              } else if (typeof step.data === "object" && step.data.skipCount) {
                // 新版本，data是对象，包含skipCount
                skipCount = step.data.skipCount;
              }

              // 执行对话，使用当前步骤的优先选项和NPC白名单
              await executeOptimizedAutoTalk(
                null,
                skipCount,
                priorityOptions,
                npcWhiteList
              );
              break;

            case "按键":
              if (typeof step.data === "string") {
                log.info("执行按键: {key}", step.data);
                keyPress(step.data);
              } else if (typeof step.data === "object") {
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
              if (Array.isArray(step.data) && step.data.length >= 2) {
                log.info("执行传送: {x}, {y}", step.data[0], step.data[1]);
                const force = step.data.length > 2 ? step.data[2] : false;
                await genshin.tp(step.data[0], step.data[1], force);
                log.info("传送完成");
              } else {
                log.error("传送参数格式错误");
              }
              break;

              case "isinMainUi":
                for (let i = 0; i < 60; i++) {
                  if (isInMainUI()) {
                    log.info("检测到已返回主界面，结束等待");
                    break;
                  }
                  await sleep(1000);
                }
                if (!isInMainUI()) {
                  log.info("等待返回主界面超时，尝试继续执行后续步骤");
                }
                break;

              default:
              log.warn("未知的流程类型: {type}", step.type);
          }
        }

        // 每个步骤之间等待一段时间
        await sleep(2000);
      }

      log.info("统一对话委托流程执行完成: {name}", commissionName);
      return true;
    } catch (error) {
      log.error("执行统一对话委托流程时出错: {error}", error.message);
      return false;
    }
  }

  /**
   * 执行对话委托流程（优化版）
   * @param {string} commissionName - 委托名称
   * @param {string} location - 委托地点
   * @returns {Promise<boolean>} - 执行结果
   */
  async function executeTalkCommission(commissionName, location) {
    try {
      log.info(
        "开始执行对话委托: {name} ({location})",
        commissionName,
        location
      );

      // 优化的文件路径：固定使用 ${processBasePath}/${location}/process.json
      const processBasePath = TALK_PROCESS_BASE_PATH;
      const processFilePath = `${processBasePath}/${commissionName}/${location}/process.json`;

      let processContent;
      try {
        processContent = await file.readText(processFilePath);
        log.info("找到对话委托流程文件: {path}", processFilePath);
      } catch (error) {
        log.warn(
          "未找到对话委托 {name} 在 {location} 的流程文件: {path}",
          commissionName,
          location,
          processFilePath
        );
        return false;
      }

      // 解析流程内容
      let processSteps;
      try {
        // 尝试解析为JSON格式
        const jsonData = JSON.parse(processContent);
        if (Array.isArray(jsonData)) {
          processSteps = jsonData;
        } else {
          log.error("JSON流程格式错误，应为数组");
          return false;
        }
      } catch (jsonError) {
        // 如果不是JSON格式，按简单格式处理
        const lines = processContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        processSteps = lines;
      }

      // 使用统一的处理器执行流程
      return await executeUnifiedTalkProcess(
        processSteps,
        commissionName,
        location
      );
    } catch (error) {
      log.error("执行对话委托时出错: {error}", error);
      return false;
    }
  }

  /**
   * 执行对话委托流程
   * @param {string} processPath - 流程文件路径
   */
  async function executeTalkCommissionWithBranches(processPath) {
    try {
      log.info("开始执行对话委托流程: {path}", processPath);
      
      // 读取流程文件
      const processContent = await file.readText(processPath);
      
      // 解析流程内容
      const branches = parseProcessBranches(processContent);
      
      // 确定要执行的分支
      const branchToExecute = await determineBranch(branches);
      
      if (branchToExecute) {
        log.info("执行分支: {id}", branchToExecute.id);
        await executeUnifiedTalkProcess(branchToExecute.steps);
      } else {
        log.warn("没有找到匹配的分支，执行默认流程");
        // 尝试解析整个内容作为单一流程
        const steps = JSON.parse(processContent);
        await executeUnifiedTalkProcess(steps);
      }
      
    } catch (error) {
      log.error("执行对话委托流程出错: {error}", error);
    }
  }
  
  /**
   * 解析流程文件中的分支
   * @param {string} content - 流程文件内容
   * @returns {Array} - 分支数组
   */
  function parseProcessBranches(content) {
    const branches = [];
    const branchRegex = /分支:(\d+)[\s\S]*?判断方法"([^"]+)"[\s\S]*?data:"([^"]+)"([\s\S]*?)(?=分支:|$)/g;
    
    let match;
    while ((match = branchRegex.exec(content)) !== null) {
      const branchId = parseInt(match[1]);
      const judgmentMethod = match[2];
      const judgmentData = match[3];
      const stepsContent = match[4].trim();
      
      // 解析步骤
      let steps = [];
      try {
        // 尝试解析JSON数组
        const jsonContent = `[${stepsContent}]`;
        steps = JSON.parse(jsonContent);
      } catch (error) {
        log.warn("解析分支{id}的步骤出错: {error}", branchId, error);
        continue;
      }
      
      branches.push({
        id: branchId,
        method: judgmentMethod,
        data: judgmentData,
        steps: steps
      });
    }
    
    return branches;
  }
  
  /**
   * 确定要执行的分支
   * @param {Array} branches - 分支数组
   * @returns {Object|null} - 要执行的分支或null
   */
  async function determineBranch(branches) {
    for (const branch of branches) {
      switch (branch.method) {
        case "坐标":
          if (await checkCoordinateMatch(branch.data)) {
            return branch;
          }
          break;
          
        case "任务追踪":
          if (await checkTaskMatch(branch.data)) {
            return branch;
          }
          break;
          
        default:
          log.warn("未知的判断方法: {method}", branch.method);
      }
    }
    
    return null;
  }
  
  /**
   * 检查当前坐标是否匹配
   * @param {string} coordData - 坐标数据 "x,y"
   * @returns {Promise<boolean>} - 是否匹配
   */
  async function checkCoordinateMatch(coordData) {
    try {
      const [targetX, targetY] = coordData.split(",").map(c => parseFloat(c.trim()));
      
      // 获取当前委托位置
      const playerPos = await getCurrentCommissionPosition();//委托位置会变，你每完成一个委托，未完成的委托就上一个
      if (!playerPos) return false;
      
      // 计算距离
      const distance = calculateDistance(playerPos, { x: targetX, y: targetY });
      log.info("当前位置: ({x}, {y})，目标位置: ({tx}, {ty})，距离: {d}", 
               playerPos.x, playerPos.y, targetX, targetY, distance);
      
      // 如果距离小于阈值，认为匹配
      return distance < 100; // 可以调整阈值
    } catch (error) {
      log.error("检查坐标匹配出错: {error}", error);
      return false;
    }
  }
  
  /**
   * 检查当前任务是否匹配
   * @param {string} taskName - 任务名称
   * @returns {Promise<boolean>} - 是否匹配
   */
  async function checkTaskMatch(taskName) {
    try {
      // 截取左上角任务区域
      const captureRegion = captureGameRegion();
      const taskArea = captureRegion.DeriveCrop(75, 240, 225, 60); // 任务区域
      
      // 创建OCR识别对象
      const taskOcrRo = RecognitionObject.Ocr(
        0,
        0,
        taskArea.width,
        taskArea.height
      );
      
      // 识别任务文本
      const taskResults = taskArea.FindMulti(taskOcrRo);
      
      // 检查是否包含目标任务名称
      for (let i = 0; i < taskResults.count; i++) {
        const text = taskResults[i].text;
        log.info(`任务区域识别文本: ${text}`);
        
        if (text.includes(taskName)) {
          log.info(`找到匹配任务: ${taskName}`);
          return true;
        }
      }
      
      log.info(`未找到匹配任务: ${taskName}`);
      return false;
    } catch (error) {
      log.error("检查任务匹配出错: {error}", error);
      return false;
    }
  }

  /**
   * 检查委托状态
   * @param completedCount — 已完成的委托数量
   * @returns — 返回 ture,false
   */
  async function iscompleted(completedCount) {
    // 记录已完成的委托数量
    log.info("已完成委托数量: {completedCount}", completedCount);

    const enterSuccess = await enterCommissionScreen();
    if (!enterSuccess) {
      log.error("无法进入委托界面，脚本终止");
      return false;
    } 
    await sleep(900);
  if (completedCount===0) {
    await PageScroll(1);
    const status = await detectCommissionStatusByImage(3);
    if (status === "completed") {
      return true;
    } else {
      return false;
    }
  }else{
    const status = await detectCommissionStatusByImage(3-completedCount);
    if (status === "completed") {
      return true;
    } else {
      return false;
    }
  }
  }

  /**
   * 执行委托追踪（优化版 - 按距离排序）
   */
  async function executeCommissionTracking() {
    try {
      log.info("开始执行委托追踪 - 按距离排序模式");
      dispatcher.addTimer(
        new RealtimeTimer("AutoPick", { forceInteraction: false })
      );
      // 获取已识别的委托列表
      let commissions = [];
      try {
        const commissionsData = JSON.parse(
          file.readTextSync(`${OUTPUT_DIR}/commissions_data.json`)
        );
        commissions = commissionsData.commissions.filter((c) => c.supported);
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

      // 统计已完成委托
      let completedCount = 0;
      for (const commission of commissions) {
        if (commission.location === "已完成") {
          completedCount++;
          continue;
        }
      }

      // 执行每个委托
      for (const commission of commissions) {
        // 跳过已完成的委托
        if (commission.location === "已完成") {
          log.info("委托 {name} 已完成，跳过", commission.name);
          continue;
        }

        // 跳过没有地点信息的委托
        if (
          !commission.location ||
          commission.location === "未知地点" ||
          commission.location === "识别失败"
        ) {
          log.warn("委托 {name} 缺少地点信息，跳过", commission.name);
          continue;
        }

        log.info(
          "开始执行委托: {name} ({location}) [{type}]",
          commission.name,
          commission.location,
          commission.type || "未知类型"
        );

        try {
          log.info(
            "当前委托位置: ({x}, {y})",
            commission.CommissionPosition.X,
            commission.CommissionPosition.Y
          );
        } catch (error) {
          log.warn("委托 {name} 缺少坐标信息，尝试全部执行", commission.name);
        }

        let success = false;

        // 根据委托类型执行不同的处理逻辑
        if (commission.type === COMMISSION_TYPE.TALK) {
          // 执行对话委托
          success = await executeTalkCommission(
            commission.name,
            commission.location
          );
          let completed = await iscompleted(completedCount);
          if (success && completed) {
            completedCount++;
            log.info("对话委托 {name} 执行完成", commission.name);
          } else {
            log.warn("对话委托 {name} 执行失败", commission.name);
          }
        } else {
          //dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));

          // 默认执行战斗委托
          const location = commission.location.trim();

          // 脚本路径
          const scriptPaths = [
            `assets/${commission.name}/${location}-1.json`,
            `assets/${commission.name}/${location}-2.json`,
            `assets/${commission.name}/${location}-3.json`,
          ];

          // 获取每个脚本对应的目标位置和距离
          const scriptInfo = [];
          for (const scriptPath of scriptPaths) {
            try {
              await file.readText(scriptPath);
              const targetPos = await getCommissionTargetPosition(scriptPath);
              if (targetPos) {
                const distance = calculateDistance(
                  commission.CommissionPosition,
                  targetPos
                );
                scriptInfo.push({
                  path: scriptPath,
                  distance: distance,
                  valid: true,
                });
                log.info(
                  "委托 {name} 目标位置: ({x}, {y})，距离: {distance}",
                  scriptPath,
                  targetPos.x,
                  targetPos.y,
                  distance
                );
              } else {
                log.warn("委托 {name} 无法获取距离", scriptPath);
                scriptInfo.push({
                  path: scriptPath,
                  distance: Infinity,
                  valid: false,
                });
              }
            } catch (readError) {
              log.info("路径追踪脚本不存在: {path}", scriptPath);
              continue;
            }
          }

          // 按距离从小到大排序
          scriptInfo.sort((a, b) => a.distance - b.distance);

          // 输出排序结果
          log.info("排序后的脚本执行顺序:");
          scriptInfo.forEach((info, index) => {
            log.info(
              "{index}. 脚本: {path}, 距离: {distance}",
              index + 1,
              info.path,
              info.distance
            );
          });

          // 尝试执行排序后的脚本路径
          let executed = false;
          for (const info of scriptInfo) {
            const scriptPath = info.path;
            try {
              /* 检查脚本文件是否存在
            log.info("检查路径追踪脚本: {path}", scriptPath);
            
            try {
              // 尝试读取文件内容来检查是否存在
              await file.readText(scriptPath);
              log.info("找到路径追踪脚本: {path}", scriptPath);
              scriptFound = true;
            } catch (readError) {
              log.info("路径追踪脚本不存在: {path}", scriptPath);
              continue; // 尝试下一个脚本路径
            }*/

              // 执行路径追踪脚本
              log.info("开始执行路径追踪脚本: {path}", scriptPath);
              await pathingScript.runFile(scriptPath);
              log.info("路径追踪脚本执行完成");
              if (await iscompleted(completedCount)) {
                log.info("委托 {name} 已完成", commission.name);
                completedCount++;
                success = true;
                break;
              } else {
                log.info("委托 {name} 未完成，尝试下一个脚本", commission.name);
              }
            } catch (scriptError) {
              log.error("执行路径追踪脚本时出错: {error}", scriptError);
              break;
            }
          }

          if (!success) {
            log.warn("委托 {name} 执行失败", commission.name);
          }
        }

        // 每个委托之间等待一段时间
        log.info("等待5秒后执行下一个委托...");
        await sleep(5000);
      }

      log.info(
        "委托追踪全部执行完成，共执行 {count}/{total} 个委托",
        completedCount,
        commissions.length
      );

      return completedCount > 0;
    } catch (error) {
      log.error("执行委托追踪时出错: {error}", error.message);
      return false;
    }
  }

  // 主函数
  async function main() {

    //await Identification();
    //setGameMetrics(1920, 1080, 1);
    //await genshin.returnMainUi();
    //await autoNavigateToTalk("盖伊","task");

    if (skipRecognition) {
      log.info("跳过识别，直接加载数据");
    } else {
      await Identification();
    } //识别委托

    // 开局准备
    await prepareForLeyLineRun();

    // 执行自动委托
    await executeCommissionTracking();

    log.info("每日委托执行完成，前往安全地点");
    await genshin.tpToStatueOfTheSeven();
  }
  // 使用 Promise 包装 main 函数的执行
  return main();
  //log.info("");
})();
