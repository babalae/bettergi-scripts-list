// 原神每日委托自动执行脚本 - 执行功能模块
var Execute = {
  // 寻找委托目的地址带追踪任务
  findCommissionTarget: async function(commissionName) {
    try {
      log.info("开始寻找委托目标位置: {name}", commissionName);

      // 确保回到主界面
      await genshin.returnMainUi();

      // 第一步，检测这个任务是否在1-3之中
      var index = 4;

      try {
        // 进入委托界面
        var enterSuccess = await UI.enterCommissionScreen();
        if (!enterSuccess) {
          log.error("无法进入委托界面");
          return null;
        }

        await sleep(1000);

        // 识别前3个委托
        log.debug("findCommissionTarget识别前3个委托");

        // 先识别前3个Main_Dev区域（索引0-2）
        for (var regionIndex = 0; regionIndex < 3; regionIndex++) {
          var region = Constants.OCR_REGIONS.Main_Dev[regionIndex];

          try {
            var results = await Utils.easyOCR(region);

            // 处理识别结果，取第一个有效结果
            for (var i = 0; i < results.count; i++) {
              var result = results[i];
              var text = Utils.cleanText(result.text);
              if (text && text.length >= 2) {
                log.info(
                  '第{regionIndex}个委托: "{text}"',
                  regionIndex + 1,
                  text
                );
                if (text === commissionName) {
                  index = regionIndex + 1;
                  log.info(
                    "找到委托 {name} 在位置 {index}",
                    commissionName,
                    index
                  );
                  break;
                }
              }
            }

            // 如果找到了委托，跳出外层循环
            if (index !== 4) {
              break;
            }
          } catch (regionError) {
            log.error(
              "识别第{index}个委托区域时出错: {error}",
              regionIndex + 1,
              regionError
            );
            continue;
          }
        }
      } catch (error) {
        log.error("findCommissionTarget第一步失败: {error}", error.message);
      }

      // 如果前3个没找到，检查第4个委托（需要翻页）
      if (index === 4) {
        try {
          log.info("前3个委托中未找到，检查第4个委托");
          await UI.pageScroll(1);

          var region = Constants.OCR_REGIONS.Main_Dev[3]; // 第4个区域
          var results = await Utils.easyOCR(region);

          for (var i = 0; i < results.count; i++) {
            var result = results[i];
            var text = Utils.cleanText(result.text);
            if (text && text.length >= 2) {
              log.info('第4个委托: "{text}"', text);
              if (text === commissionName) {
                index = 4;
                log.info("找到委托 {name} 在第4个位置", commissionName);
                break;
              }
            }
          }
        } catch (fourthError) {
          log.error("识别第4个委托时出错: {error}", fourthError);
        }
      }

      // 第二步：进入对应的大地图,获取位置
      var currentCommissionPosition = null;
      try {
        // 点击详情按钮
        if (index === 4) {
          // 第4个委托已经翻页了，使用索引3
          index = 3;
        }

        var button = Constants.COMMISSION_DETAIL_BUTTONS[index - 1];
        if (button) {
          log.info("点击委托详情按钮: {id}", button.id);
          click(button.x, button.y);
          await sleep(2000);

          // 检查是否有追踪按钮并点击
          var trackingResult = await Utils.easyOCROne(
            Constants.OCR_REGIONS.COMMISSION_TRACKING
          );
          if (trackingResult === "追踪") {
            log.info("发现追踪按钮，点击追踪");
            click(1693, 1000);
            await sleep(1000);
          }

          // 退出详情页面
          log.info("退出详情页面 - 按ESC");
          keyDown("VK_ESCAPE");
          await sleep(300);
          keyUp("VK_ESCAPE");
          await sleep(1200);
          let scale = 2.0
          let bigMapPosition
          while (scale <= 5.0) {
            try {
              await genshin.setBigMapZoomLevel(scale);
              bigMapPosition = genshin.getPositionFromBigMap();
              break;
            } catch {
              scale += 0.1;
            }
            await sleep(100);
          }
          if (bigMapPosition) {
            currentCommissionPosition = bigMapPosition;
            log.info(
              "当前委托位置: ({x}, {y})",
              bigMapPosition.x,
              bigMapPosition.y
            );
          }

          await genshin.returnMainUi();
        } else {
          log.error("无效的委托按钮索引: {index}", index);
        }
      } catch (error) {
        log.error("findCommissionTarget第2步失败: {error}", error.message);
      }

      return currentCommissionPosition;
    } catch (error) {
      log.error("寻找委托目标位置时出错: {error}", error.message);
      return null;
    }
  },

  // 读取并解析流程文件为步骤数组
  loadAndParseProcessFile: async function(
    commissionName,
    location,
    locationprocessFilePath
  ) {
    locationprocessFilePath = locationprocessFilePath || "process.json";
    
    var processFilePath = Constants.TALK_PROCESS_BASE_PATH + "/" + commissionName + "/" + location + "/" + locationprocessFilePath;
    var processContent;
    var processSteps;
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

    try {
      // 尝试解析为JSON格式
      var jsonData = JSON.parse(processContent);
      if (Array.isArray(jsonData)) {
        processSteps = jsonData;
        log.debug("JSON流程解析成功");
      } else {
        log.error("JSON流程格式错误，应为数组");
        return false;
      }
    } catch (jsonError) {
      // 如果不是JSON格式，按简单格式处理
      var lines = processContent
        .split("\n")
        .map(function(line) { return line.trim(); })
        .filter(function(line) { return line.length > 0; });
      processSteps = lines;
    }
    return processSteps;
  },

  // 执行对话委托流程（优化版）
  executeTalkCommission: async function(commissionName, location) {
    try {
      var processSteps = await Execute.loadAndParseProcessFile(
        commissionName,
        location,
        "process.json"
      );

      // 使用统一的处理器执行流程
      return await Execute.executeUnifiedTalkProcess(
        processSteps,
        commissionName,
        location
      );
    } catch (error) {
      log.error("执行对话委托时出错: {error}", error.message);
      return false;
    }
  },

  // 自动导航到NPC对话位置（从main_branch.js移植）
  autoNavigateToTalk: async function(npcName, iconType,autoTalk) {
    npcName = npcName || "";
    iconType = iconType || "";
    autoTalk = autoTalk || false;
    try {
      // 设置目标NPC名称
      var textArray = npcName;

      // 根据图标类型选择不同的识别对象
      var boxIconRo;
      if (iconType === "Bigmap") {
        boxIconRo = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync(
            "Data/RecognitionObject/IconBigmapCommission.jpg"
          )
        );
        log.info("使用大地图图标");
      } else if (iconType === "Question") {
        boxIconRo = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync(
            "Data/RecognitionObject/IconQuestionCommission.png"
          )
        );
        log.info("使用问号任务图标");
      } else {
        // 默认使用任务图标
        boxIconRo = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync(
            "Data/RecognitionObject/IconTaskCommission.png"
          )
        );
        log.info("使用任务图标");
      }

      var advanceNum = 0; //前进次数

      middleButtonClick();
      await sleep(800);

      while (true) {
        // 1. 优先检查是否已到达
        await sleep(500); // 等待0.5秒
        var captureRegion = captureGameRegion();
        var rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
        var rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
        captureRegion.dispose();
        rewardTextArea.dispose();
        log.debug("检测到文字: " + rewardResult.text);
        // 检测到特点文字则结束！！！
        if (rewardResult.text == textArray) {
          log.info("已到达指定位置，检测到文字: " + rewardResult.text);
          if (autoTalk) {
            keyPress("VK_F");
          }
          return;
        } else if (advanceNum > 80) {
          throw new Error("前进时间超时");
        }
        // 2. 未到达领奖点，则调整视野
        for (var i = 0; i < 100; i++) {
          captureRegion = captureGameRegion();
          var iconRes = captureRegion.Find(boxIconRo);
          captureRegion.dispose();
          log.info("检测到委托图标位置 ({x}, {y})", iconRes.x, iconRes.y);
          if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {
            advanceNum++;
            log.info("视野已调正，前进第{num}次", advanceNum);
            break;
          } else {
            // 小幅度调整
            if (iconRes.y >= 520) moveMouseBy(0, 920);
            var adjustAmount = iconRes.x < 920 ? -20 : 20;
            var distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
            var scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
            var adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
            moveMouseBy(adjustAmount * adjustAmount2, 0);
            await sleep(100);
          }
          if (i > 50) throw new Error("视野调整超时");
        }
        // 3. 前进一小步
        keyDown("w");
        await sleep(200);
        keyPress("VK_SPACE");
        await sleep(200);
        keyPress("VK_SPACE");
        await sleep(200);
        keyUp("w");
        await sleep(200); // 等待角色移动稳定
      }
    } catch (error) {
      log.error("自动导航到NPC对话位置时出错: {error}", error.message);
      throw error;
    }
  },

  // 统一的对话委托流程处理器（重构版 - 更简洁的主控制函数）
  executeUnifiedTalkProcess: async function(
    processSteps,
    commissionName,
    location
  ) {
    try {
      log.info("执行统一对话委托流程: {name}", commissionName);

      if (!processSteps || processSteps.length === 0) {
        log.warn("没有找到有效的流程步骤");
        return false;
      }

      // 初始化UI检测器和配置
      var isInMainUI = UI.UIUtils.isInMainUI;
      var priorityOptions = [];
      var npcWhiteList = [];

      // 刚开始就追踪委托目标
      await Execute.findCommissionTarget(commissionName);

      // 执行处理步骤
      for (var i = 0; i < processSteps.length; i++) {
        var step = processSteps[i];
        log.info("执行流程步骤 {step}: {type}", i + 1, step.type || step);

        try {
          // 重置为默认值并处理自定义配置
          var stepConfig = Execute.processStepConfiguration(
            step,
            priorityOptions,
            npcWhiteList
          );
          priorityOptions = stepConfig.priorityOptions;
          npcWhiteList = stepConfig.npcWhiteList;

          var context = {
            commissionName: commissionName,
            location: location,
            processSteps: processSteps,
            currentIndex: i,
            isInMainUI: isInMainUI,
            priorityOptions: priorityOptions,
            npcWhiteList: npcWhiteList,
          };

          // 处理步骤
          await Execute.processStep(step, context);
        } catch (stepError) {
          log.error(
            "执行步骤 {step} 时出错: {error}",
            i + 1,
            stepError.message
          );
          // 继续执行下一步，不中断整个流程
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
  },

  // 处理步骤配置（优先选项和NPC白名单）
  processStepConfiguration: function(
    step,
    defaultPriorityOptions,
    defaultNpcWhiteList
  ) {
    var priorityOptions = defaultPriorityOptions.slice(); // 复制数组
    var npcWhiteList = defaultNpcWhiteList.slice(); // 复制数组

    // 如果步骤中包含自定义的优先选项和NPC白名单，则使用它们
    if (step.data && typeof step.data === "object") {
      if (Array.isArray(step.data.priorityOptions)) {
        priorityOptions = step.data.priorityOptions;
        log.info("使用自定义优先选项: {options}", priorityOptions.join(", "));
      }
      if (Array.isArray(step.data.npcWhiteList)) {
        npcWhiteList = step.data.npcWhiteList;
        log.info("使用自定义NPC白名单: {npcs}", npcWhiteList.join(", "));
      }
    }

    return { priorityOptions: priorityOptions, npcWhiteList: npcWhiteList };
  },

  // 处理单个步骤
  processStep: async function(step, context) {
    if (typeof step === "string") {
      // 简单格式处理
      await Execute.processStringStep(step, context);
    } else if (typeof step === "object") {
      // JSON格式处理
      await Execute.processObjectStep(step, context);
    }
  },

  // 处理字符串格式的步骤
  processStringStep: async function(step, context) {
    if (step.endsWith(".json")) {
      // 地图追踪文件
      await StepProcessorLoader.process({
        type: "地图追踪",
        data: step
      }, context);
    } else if (step === "F") {
      // 按F键并执行优化的自动剧情
      log.info("执行自动剧情");
      await DialogProcessor.executeOptimizedAutoTalk(
        null,
        5,
        context.priorityOptions,
        context.npcWhiteList,
        context.isInMainUI
      );
    }
  },

  // 处理对象格式的步骤
  processObjectStep: async function(step, context) {
    if (step.note) {
      log.info("步骤说明: {note}", step.note);
    }

    // 使用步骤处理器加载器来处理步骤
    await StepProcessorLoader.process(step, context);
  },

  // 处理对话步骤
  processDialogStep: async function(
    step,
    priorityOptions,
    npcWhiteList,
    isInMainUI
  ) {
    log.info("执行对话");
    var skipCount = 2; // 默认跳过2次

    // 处理对话选项
    if (typeof step.data === "number") {
      // 兼容旧版本，如果data是数字，则视为skipCount
      skipCount = step.data;
    } else if (typeof step.data === "object" && step.data.skipCount) {
      // 新版本，data是对象，包含skipCount
      skipCount = step.data.skipCount;
    }

    // 执行对话，使用当前步骤的优先选项和NPC白名单
    await DialogProcessor.executeOptimizedAutoTalk(
      null,
      skipCount,
      priorityOptions,
      npcWhiteList,
      isInMainUI
    );
  },

  // 按类型执行委托列表
  executeCommissionsByType: async function(commissions, type) {
    var results = [];

    for (var i = 0; i < commissions.length; i++) {
      var commission = commissions[i];

      try {
        log.info(
          "执行第 {current}/{total} 个{type}委托: {name} ({location})",
          i + 1,
          commissions.length,
          type === "talk" ? "对话" : "战斗",
          commission.name,
          commission.location
        );

        var success = false;

        if (type === "talk") {
          success = await Execute.executeTalkCommission(
            commission.name,
            commission.location
          );
        } else if (type === "fight") {
          success = await Execute.executeFightCommission(commission);
        }

        results.push({
          commission: commission,
          success: success,
          type: type,
        });

        if (success) {
          log.info("委托 {name} 执行成功", commission.name);
        } else {
          log.warn("委托 {name} 执行失败", commission.name);
        }

        await sleep(2000);
      } catch (commissionError) {
        log.error(
          "执行委托 {name} 时出错: {error}",
          commission.name,
          commissionError.message
        );

        results.push({
          commission: commission,
          success: false,
          type: type,
          error: commissionError.message,
        });
      }
    }

    return results;
  },

  // 执行战斗委托
  executeFightCommission: async function(commission) {
    try {
      log.info("执行战斗委托: {name}", commission.name);

      var location = commission.location.trim();

      // 脚本路径
      var scriptPaths = [
        "assets/" + commission.name + "/" + location + "-1.json",
        "assets/" + commission.name + "/" + location + "-2.json", 
        "assets/" + commission.name + "/" + location + "-3.json",
      ];

      // 获取每个脚本对应的目标位置和距离
      var scriptInfo = [];
      for (var i = 0; i < scriptPaths.length; i++) {
        var scriptPath = scriptPaths[i];
        try {
          file.readTextSync(scriptPath);
          var targetPos = await CommissionBasic.getCommissionTargetPosition(scriptPath);
          if (targetPos) {
            var distance = Utils.calculateDistance(
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

      // 按距离排序脚本
      scriptInfo.sort(function(a, b) { return a.distance - b.distance; });

      // 输出排序结果
      log.info("排序后的脚本执行顺序:");
      scriptInfo.forEach(function(info, index) {
        log.info(
          "{index}. 脚本: {path}, 距离: {distance}",
          index + 1,
          info.path,
          info.distance
        );
      });

      // 尝试执行排序后的脚本路径
      var scriptSuccess = false;
      for (var j = 0; j < scriptInfo.length; j++) {
        var info = scriptInfo[j];
        var scriptPath = info.path;
        try {
          // 执行路径追踪脚本
          log.info("开始执行路径追踪脚本: {path}", scriptPath);
          dispatcher.addTimer(
            new RealtimeTimer("AutoPick", { forceInteraction: false })
          );
          // dispatcher.addTimer(new RealtimeTimer("AutoEat"));
          await pathingScript.runFile(scriptPath);
          log.info("路径追踪脚本执行完成");
          dispatcher.ClearAllTriggers();
          
          scriptSuccess = true;
          break;
          
        } catch (scriptError) {
          log.error("执行路径追踪脚本时出错: {error}", scriptError);
          continue; // 尝试下一个脚本
        }
      }

      if (scriptSuccess) {
        log.info("战斗委托 {name} 执行完成", commission.name);
        return true;
      } else {
        log.warn("战斗委托 {name} 所有脚本执行失败", commission.name);
        return false;
      }
      
    } catch (error) {
      log.error("执行战斗委托时出错: {error}", error.message);
      return false;
    }
  },
};