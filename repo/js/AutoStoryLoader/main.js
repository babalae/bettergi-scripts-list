(async function () {
  // 版本和编译信息
  const VERSION = "1.1";
  const BUILD_TIME = "2025.08.26";

  // 读取设置
  const team = settings.team || "";
  const elementTeam = settings.elementTeam || "";
  const selectedProcess = settings.process_selector || "刷新剧情列表";

  async function errorlog() {
    // 输出版本和编译时间信息
    log.info("=".repeat(20));
    log.info("版本: {version}", VERSION);
    log.info("编译时间: {buildTime}", BUILD_TIME);
    log.info("=".repeat(20));
  }

  // 统一常量定义
  const Datas = {
    // 文件路径常量
    SUPPORT_LIST_PATH: "name.json",
    OUTPUT_DIR: "Data",
    TALK_PROCESS_BASE_PATH: "assets/process"
  };

  // 获取设置
  /*const getSetting = async () => {
    try {
      const skipRecognition = settings.skipRecognition || false;
      const prepare = settings.prepare || false;
      const team = settings.team || "";
      const skipCommissions = "";

      const result = {
        skipRecognition,
        prepare,
        team,
        skipCommissions,
      };

      log.debug("setting:{index}", result);

      return result;
    } catch {
      log.error("getSetting函数出现错误,将使用默认配置");
      return {
        skipRecognition: false,
        prepare: true,
        team: "",
        skipCommissions: "",
      };
    }
  };

  const { skipRecognition, prepare, team, skipCommissions } =
    await getSetting();*/

  const Utils = {
    iframe: async ({ X, Y, WIDTH, HEIGHT }) => {
      try {
        log.info("i{index}", { X, Y, WIDTH, HEIGHT });

        // 最简单的方式创建OCR识别对象
        const ro = RecognitionObject.Ocr(X, Y, WIDTH, HEIGHT);
        ro.Name = "debug";
        ro.DrawOnWindow = true;

        // 捕获并识别
        const region = captureGameRegion();
        region.Find(ro);

        // 2000毫秒后移除绘制的边框
        setTimeout(() => {
          // 使用相同的名称移除边框
          const drawContent = VisionContext.Instance().DrawContent;
          drawContent.RemoveRect("debug");
          // 或者也可以使用 drawContent.Clear() 清除所有绘制的内容

          log.info("已移除边框");
        }, 2000);
      } catch (error) {
        // 记录完整错误信息
        log.error("详细错误: " + JSON.stringify(error));
      }
    },
    easyOCR: async ({ X, Y, WIDTH, HEIGHT }) => {
      try {
        // log.info("进行文字识别")
        // 创建OCR识别对象
        const locationOcrRo = RecognitionObject.Ocr(X, Y, WIDTH, HEIGHT);

        // 截图识别
        let captureRegion = captureGameRegion();
        let OCRresults = await captureRegion.findMulti(locationOcrRo);

        return OCRresults;
      } catch (error) {
        log.error("easyOCR识别出错: {error}", error.message);
        return { count: 0 };
      }
    },
    easyOCROne: async (ocrdata) => {
      results = await Utils.easyOCR(ocrdata);
      if (results.count > 0) {
        // 取第一个结果作为地点
        return results[0].text.trim();
      }
      return "";
    },
    // 清理文本（去除标点符号等）
    cleanText: (text) => {
      if (!text) return "";
      // 去除标点符号和特殊字符
      return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").trim();
    },

    // 读取角色别名文件
    readAliases: () => {
      try {
        const combatText = file.ReadTextSync("Data/avatar/combat_avatar.json");
        const combatData = JSON.parse(combatText);
        const aliases = {};
        for (const character of combatData) {
          if (character.alias && character.name) {
            for (const alias of character.alias) {
              aliases[alias] = character.name;
            }
          }
        }
        return aliases;
      } catch (error) {
        log.error("读取角色别名文件失败: {error}", error.message);
        return {};
      }
    },
  };

  const UI = {
    // 角色选择界面滚动页面函数
    scrollPage: async (totalDistance, stepDistance = 10, delayMs = 5) => {
      try {
        moveMouseTo(400, 750);
        await sleep(50);
        leftButtonDown();
        const steps = Math.ceil(totalDistance / stepDistance);
        for (let j = 0; j < steps; j++) {
          const remainingDistance = totalDistance - j * stepDistance;
          const moveDistance =
            remainingDistance < stepDistance ? remainingDistance : stepDistance;
          moveMouseBy(0, -moveDistance);
          await sleep(delayMs);
        }
        await sleep(700);
        leftButtonUp();
        await sleep(100);
        return true;
      } catch (error) {
        log.error(`角色选择界面滚动操作时发生错误：${error.message}`);
        return false;
      }
    },
  };

  // 步骤处理器类 - 处理不同类型的委托执行步骤
  // TAG:添加脚本功能点1
  const StepProcessor = {
    // 处理地图追踪步骤
    processMapTracking: async (step, commissionName, location) => {
      const fullPath = `${
        Datas.TALK_PROCESS_BASE_PATH
      }/${commissionName}/${location}/${step.data || step}`;
      log.info("执行地图追踪: {path}", fullPath);
      try {
        await pathingScript.runFile(fullPath);
        log.info("地图追踪执行完成");
      } catch (error) {
        log.error("执行地图追踪时出错: {error}", error.message);
        throw error;
      }
    },

    // 处理追踪委托步骤
    processCommissionTracking: async (step) => {
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

        log.info(
          "执行追踪委托，目标NPC: {target}，图标类型: {type}",
          targetNpc,
          iconType
        );
        await Execute.autoNavigateToTalk(targetNpc, iconType);
        log.info("追踪委托执行完成");
      } catch (error) {
        log.error("执行追踪委托时出错: {error}", error.message);
        throw error;
      }
    },

    // 处理键鼠脚本步骤
    processKeyMouseScript: async (step, commissionName, location) => {
      log.info("执行键鼠脚本: {path}", step.data);
      try {
        const fullPath = `${Datas.TALK_PROCESS_BASE_PATH}/${commissionName}/${location}/${step.data}`;
        await keyMouseScript.runFile(fullPath);
        log.info("键鼠脚本执行完成");
      } catch (error) {
        log.error("执行键鼠脚本时出错: {error}", error.message);
        throw error;
      }
    },

    // 处理按键步骤
    processKeyPress: async (step) => {
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
    },

    // 处理传送步骤
    processTeleport: async (step) => {
      if (Array.isArray(step.data) && step.data.length >= 2) {
        log.info("执行传送: {x}, {y}", step.data[0], step.data[1]);
        const force = step.data.length > 2 ? step.data[2] : false;
        await genshin.tp(step.data[0], step.data[1], force);
        log.info("传送完成");
      } else {
        log.error("传送参数格式错误");
        throw new Error("传送参数格式错误");
      }
    },

    // 处理等待主界面步骤
    processWaitMainUI: async (isInMainUI) => {
      for (let i = 0; i < 120; i++) {
        if (isInMainUI()) {
          log.info("检测到已返回主界面，结束等待");
          break;
        }
        await sleep(1000);
      }
      if (!isInMainUI()) {
        log.info("等待返回主界面超时，尝试继续执行后续步骤");
      }
    },

    // 处理地址检测步骤
    processLocationDetection: async (
      step,
      commissionName,
      location,
      processSteps,
      currentIndex
    ) => {
      if (Array.isArray(step.data) && step.data.length >= 2) {
        log.info(
          `地址检测: {${step.data[0]}},{${step.data[1]}},run:${step.run}`
        );

        try {
          // 获取当前委托目标位置
          let commissionTarget = await Execute.findCommissionTarget(
            commissionName
          );

          if (commissionTarget) {
            const distance2 = CommissionsFunc.calculateDistance(
              commissionTarget,
              {
                x: step.data[0],
                y: step.data[1],
              }
            );

            log.info(
              "地址检测 - 委托位置: ({x}, {y}), 目标位置: ({tx}, {ty}), 距离: {d}",
              commissionTarget.x,
              commissionTarget.y,
              step.data[0],
              step.data[1],
              distance2
            );

            if (distance2 < 15) {
              log.info("地址检测成功，执行后续步骤");
              const nextSteps = await Execute.loadAndParseProcessFile(
                commissionName,
                location,
                step.run
              );
              // 插入到processSteps的这一步后面
              if (nextSteps && Array.isArray(nextSteps)) {
                processSteps.splice(currentIndex + 1, 0, ...nextSteps);
                log.info("已插入 {count} 个后续步骤", nextSteps.length);
              }
            } else {
              log.info("地址检测失败，距离过远: {distance}", distance2);
            }
          } else {
            log.warn("无法获取委托目标位置，跳过地址检测");
          }
        } catch (error) {
          log.error("地址检测时出错: {error}", error.message);
          throw error;
        }
      } else {
        log.error("地址检测参数格式错误");
        throw new Error("地址检测参数格式错误");
      }
    },

    // 处理委托描述检测步骤
    processCommissionDescriptionDetection: async (
      step,
      commissionName,
      location,
      processSteps,
      currentIndex
    ) => {
      // 按v键打开任务界面
      keyPress("v");
      await sleep(300);

      if (step.data !== "") {
        log.info(`委托描述检测: {${step.data}}`);

        // 循环检测，直到稳定
        for (let c = 0; c < 13; c++) {
          try {
            // 使用委托详情检测区域进行OCR
            const taskRegion = { X: 75, Y: 240, WIDTH: 280, HEIGHT: 43 };
            const ocrResult = await Utils.easyOCROne(taskRegion);
            if (ocrResult === commissionName || ocrResult === "") {
              await sleep(1000);
              // 没有延时13s的错误提示，继续检测
              log.debug("检测到委托名称或空文本，继续等待...");
              keyPress("v");
            }
            // 成功匹配，开始插入step
            else if (ocrResult === step.data) {
              log.info("委托描述检测成功，执行后续步骤");
              const nextSteps = await Execute.loadAndParseProcessFile(
                commissionName,
                location,
                step.run
              );
              // 插入到这一步后面
              if (nextSteps && Array.isArray(nextSteps)) {
                processSteps.splice(currentIndex + 1, 0, ...nextSteps);
                log.info("已插入 {count} 个后续步骤", nextSteps.length);
              }
              break;
            } else {
              log.warn(`委托描述不匹配,识别：${ocrResult},期望：${step.data}`);
              break;
            }
          } catch (ocrError) {
            log.error("委托描述OCR识别出错: {error}", ocrError);
            break;
          }
        }
      } else {
        log.error("委托描述检测参数格式错误");
        throw new Error("委托描述检测参数格式错误");
      }
    },

    // 处理角色切换步骤
    processSwitchRole: async (step) => {
      try {
        const { position, character } = step.data;

        if (!position || !character) {
          log.error("角色切换参数不完整，需要 position 和 character");
          return false;
        }

        log.info(`开始切换角色：第${position}号位 -> ${character}`);

        const positionCoordinates = [
          [460, 538],
          [792, 538],
          [1130, 538],
          [1462, 538],
        ];

        // 读取别名
        const aliases = Utils.readAliases();
        const actualName = aliases[character] || character;
        log.info(`设置对应号位为【${character}】，切换角色为【${actualName}】`);

        // 识别对象定义
        const roTeamConfig = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync(`Data/RecognitionObject/队伍配置.png`),
          0,
          0,
          1920,
          1080
        );
        const roReplace = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync(`Data/RecognitionObject/更换.png`),
          0,
          0,
          1920,
          1080
        );
        const roJoin = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync(`Data/RecognitionObject/加入.png`),
          0,
          0,
          1920,
          1080
        );

        let openPairingTries = 0;
        let totalOpenPairingTries = 0;

        // 打开配对界面的内部函数
        const openPairingInterface = async () => {
          while (openPairingTries < 3) {
            keyPress("l");
            await sleep(3500);
            const teamConfigResult = captureGameRegion().find(roTeamConfig);
            if (teamConfigResult.isExist()) {
              openPairingTries = 0;
              return true;
            }
            openPairingTries++;
            totalOpenPairingTries++;
          }
          if (totalOpenPairingTries < 6) {
            await genshin.tp("2297.630859375", "-824.5517578125");
            openPairingTries = 0;
            return openPairingInterface();
          } else {
            log.error("无法打开配对界面，任务结束");
            return false;
          }
        };

        if (!(await openPairingInterface())) {
          return false;
        }

        const rolenum = position;
        const selectedCharacter = actualName;
        const [x, y] = positionCoordinates[position - 1];
        click(x, y);
        log.info(`开始设置${rolenum}号位角色`);
        await sleep(1000);
        let characterFound = false;
        let pageTries = 0;

        // 最多尝试滚动页面20次
        while (pageTries < 20) {
          // 尝试识别所有可能的角色文件名
          for (let num = 1; ; num++) {
            const paddedNum = num.toString().padStart(2, "0");
            const characterFileName = `${selectedCharacter}${paddedNum}`;
            try {
              const characterRo = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(
                  `Data/characterimage/${characterFileName}.png`
                ),
                0,
                0,
                1920,
                1080
              );
              const characterResult = captureGameRegion().find(characterRo);
              if (characterResult.isExist()) {
                log.info(`已找到角色${selectedCharacter}`);
                // 计算向右偏移35像素、向下偏移35像素的位置
                const targetX = characterResult.x + 35;
                const targetY = characterResult.y + 35;

                // 边界检查，确保坐标在屏幕范围内
                const safeX = Math.min(Math.max(targetX, 0), 1920);
                const safeY = Math.min(Math.max(targetY, 0), 1080);

                click(safeX, safeY);
                await sleep(500); // 点击角色后等待0.5秒
                characterFound = true;
                break;
              }
            } catch (error) {
              // 如果文件不存在，跳出循环
              break;
            }
          }

          if (characterFound) {
            break;
          }

          // 如果不是最后一次尝试，尝试滚动页面
          if (pageTries < 15) {
            log.info("当前页面没有目标角色，滚动页面");
            await UI.scrollPage(200); // 使用UI模块的scrollPage函数
          }
          pageTries++;
        }

        if (!characterFound) {
          log.error(`未找到【${selectedCharacter}】`);
          return false;
        }

        // 识别"更换"或"加入"按钮
        const replaceResult = captureGameRegion().find(roReplace);
        const joinResult = captureGameRegion().find(roJoin);

        if (replaceResult.isExist() || joinResult.isExist()) {
          await sleep(300);
          click(68, 1020);
          keyPress("VK_LBUTTON");
          await sleep(500);
          log.info(`角色切换完成：${character} -> ${actualName}`);
          return true;
        } else {
          log.error(`该角色已在队伍中，无需切换`);
          await sleep(300);
          keyPress("VK_ESCAPE");
          await sleep(500);
          return false;
        }
      } catch (error) {
        log.error("角色切换过程中出错: {error}", error.message);
        return false;
      }
    },

    // 处理自动任务步骤
    processAutoTask: async (step) => {
      try {
        const { action, taskType, config } = step.data;

        if (!action) {
          log.error("自动任务参数不完整，需要 action 参数");
          return false;
        }

        log.info("执行自动任务操作: {action}", action);

        switch (action) {
          case "enable":
            // 启用自动任务
            if (!taskType) {
              log.error("启用自动任务需要指定 taskType");
              return false;
            }
            
            if (config && typeof config === "object") {
              log.info("启用自动任务: {type}，配置: {config}", taskType, JSON.stringify(config));
              dispatcher.addTimer(new RealtimeTimer(taskType, config));
            } else {
              log.info("启用自动任务: {type}", taskType);
              dispatcher.addTimer(new RealtimeTimer(taskType));
            }
            break;

          case "disable":
            // 取消所有自动任务
            log.info("取消所有自动任务");
            dispatcher.ClearAllTriggers();
            break;

          default:
            log.error("未知的自动任务操作: {action}", action);
            return false;
        }

        return true;
      } catch (error) {
        log.error("处理自动任务步骤时出错: {error}", error.message);
        return false;
      }
    },
  };

  // 步骤处理器工厂 - 更好的扩展性设计
  // TAG:添加脚本功能点2
  const StepProcessorFactory = {
    // 步骤处理器映射表
    processors: {
      地图追踪: async (step, context) => {
        await StepProcessor.processMapTracking(
          step,
          context.commissionName,
          context.location
        );
      },

      等待: async (step, context) => {
        const waitTime = step.data || 5000;
        log.info("等待 {time} 毫秒", waitTime);
        await sleep(waitTime);
      },

      追踪委托: async (step, context) => {
        await StepProcessor.processCommissionTracking(step);
      },

      键鼠脚本: async (step, context) => {
        await StepProcessor.processKeyMouseScript(
          step,
          context.commissionName,
          context.location
        );
      },

      对话: async (step, context) => {
        await Execute.processDialogStep(
          step,
          context.priorityOptions,
          context.npcWhiteList,
          context.isInMainUI
        );
      },

      按键: async (step, context) => {
        await StepProcessor.processKeyPress(step);
      },

      tp: async (step, context) => {
        await StepProcessor.processTeleport(step);
      },

      等待返回主界面: async (step, context) => {
        await StepProcessor.processWaitMainUI(context.isInMainUI);
      },

      地址检测: async (step, context) => {
        //await StepProcessor.processLocationDetection(step,context.commissionName,context.location,context.processSteps,context.currentIndex);
        log.info("地址检测当前版本用不了，请联请联系作者获取最新版");
      },

      委托描述检测: async (step, context) => {
        await StepProcessor.processCommissionDescriptionDetection(
          step,
          context.commissionName,
          context.location,
          context.processSteps,
          context.currentIndex
        );
      },

      切换角色: async (step, context) => {
        await StepProcessor.processSwitchRole(step);
      },

      自动任务: async (step, context) => {
        await StepProcessor.processAutoTask(step);
      },
    },

    // 注册新的步骤处理器
    register: (stepType, processor) => {
      StepProcessorFactory.processors[stepType] = processor;
      log.info("注册新的步骤处理器: {type}", stepType);
    },

    // 处理步骤
    process: async (step, context) => {
      const processor = StepProcessorFactory.processors[step.type];
      if (processor) {
        await processor(step, context);
      } else {
        log.warn("未知的流程类型: {type}", step.type);
      }
    },
  };

  // UI工具模块 - 处理UI检测和文本提取等工具函数
  const UIUtils = {
    // 创建主界面检测函数
    createMainUIChecker: () => {
      const paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("Data/RecognitionObject/paimon_menu.png"),
        0,
        0,
        genshin.width / 3.0,
        genshin.width / 5.0
      );

      return () => {
        let captureRegion = captureGameRegion();
        let res = captureRegion.Find(paimonMenuRo);
        return !res.isEmpty();
      };
    },

    // 人名提取函数
    extractName: (text) => {
      const patterns = [
        /与(.+?)对话/,
        /与(.+?)一起/,
        /同(.+?)交谈/,
        /向(.+?)打听/,
        /向(.+?)回报/,
        /向(.+?)报告/,
        /给(.+?)听/,
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
    },
  };

  // 对话处理模块 - 处理自动对话相关功能
  const DialogProcessor = {
    // 执行优化的自动对话
    executeOptimizedAutoTalk: async (
      extractedName = null,
      skipCount = 5,
      customPriorityOptions = null,
      customNpcWhiteList = null,
      isInMainUI
    ) => {
      // 使用传入的参数，不再加载默认配置
      const effectivePriorityOptions = customPriorityOptions || [];
      const effectiveNpcWhiteList = customNpcWhiteList || [];

      // 初始化
      keyPress("V");

      // 初始触发剧情 - 识别人名并点击
      extractedName = [];
      // 人名区域OCR识别
      const nameRegion = { X: 75, Y: 240, WIDTH: 225, HEIGHT: 60 };
      let nameResults = await Utils.easyOCR(nameRegion);
      // 尝试提取任务人名
      for (let i = 0; i < nameResults.count; i++) {
        let text = nameResults[i].text;
        log.info(`任务区域识别文本: ${text}`);

        // 尝试提取任务人名
        let name = UIUtils.extractName(text);
        if (name) {
          extractedName = name;
          log.info(`提取到人名: ${extractedName}`);
          break;
        }
      }

      // 对话选项区域OCR识别
      const dialogRegion = { X: 1150, Y: 300, WIDTH: 350, HEIGHT: 400 };
      nameResults = await Utils.easyOCR(dialogRegion);
      let clickedWhitelistNPC = false;
      let clickedExtractedName = false;

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
              log.info(`找到白名单NPC: ${effectiveNpcWhiteList[j]}，点击该NPC`);
              keyDown("VK_MENU");
              await sleep(500);
              click(res.x, res.y);
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
              click(res.x, res.y);
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
      let repetition = 0;
      let oldcount = 1;
      await sleep(1000);
      log.info("开始执行自动剧情");

      while (!isInMainUI() && attempts < maxAttempts) {
        attempts++;

        // 正常跳过对话
        await genshin.chooseTalkOption("纳西妲美貌举世无双", skipCount, false);

        if (isInMainUI()) {
          log.info("检测到已返回主界面，结束循环");
          break;
        }

        //keyPress("VK_ESCAPE");//关弹窗

        // 每skipCount次跳过后，进行OCR识别
        if (true) {
          // 检查是否有匹配的优先选项
          let foundPriorityOption = false;

          // 获取对话区域截图并进行OCR识别
          const dialogOptionsRegion = {
            X: 1250,
            Y: 450,
            WIDTH: 550,
            HEIGHT: 400,
          };
          let ocrResults = await Utils.easyOCR(dialogOptionsRegion);
          if (ocrResults.count > 0) {
            log.info(`识别到 ${ocrResults.count} 个选项`);

            if (ocrResults.count === oldcount) {
              repetition++;
            }
            else {
              repetition = 0;
            }
            oldcount = ocrResults.count;
            if (repetition >= 5) {
              log.info("连续5次选项数量一样，执行F跳过");
              keyPress("F");
              keyPress("VK_ESCAPE");
              repetition = 0;
            }
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
    },
  };

  const Execute = {
    // 寻找委托目的地址带追踪任务
    findCommissionTarget: async (commissionName) => {
      try {
        log.info("开始寻找委托目标位置: {name}", commissionName);

        // 确保回到主界面
        await genshin.returnMainUi();

        // 第一步，检测这个任务是否在1-3之中
        let index = 4;

        try {
          // 进入委托界面
          const enterSuccess = await UI.enterCommissionScreen();
          if (!enterSuccess) {
            log.error("无法进入委托界面");
            return null;
          }

          await sleep(1000);

          // 识别前3个委托
          log.debug("findCommissionTarget识别前3个委托");

          // 先识别前3个Main_Dev区域（索引0-2）
          for (let regionIndex = 0; regionIndex < 3; regionIndex++) {
            const region = Datas.OCR_REGIONS.Main_Dev[regionIndex];

            try {
              let results = await Utils.easyOCR(region);

              // 处理识别结果，取第一个有效结果
              for (let i = 0; i < results.count; i++) {
                let result = results[i];
                let text = Utils.cleanText(result.text);
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

            const region = Datas.OCR_REGIONS.Main_Dev[3]; // 第4个区域
            let results = await Utils.easyOCR(region);

            for (let i = 0; i < results.count; i++) {
              let result = results[i];
              let text = Utils.cleanText(result.text);
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
        let currentCommissionPosition = null;
        try {
          // 点击详情按钮
          if (index === 4) {
            // 第4个委托已经翻页了，使用索引3
            index = 3;
          }

          const button = Datas.COMMISSION_DETAIL_BUTTONS[index - 1];
          if (button) {
            log.info("点击委托详情按钮: {id}", button.id);
            click(button.x, button.y);
            await sleep(2000);

            // 检查是否有追踪按钮并点击
            const trackingResult = await Utils.easyOCROne(
              Datas.OCR_REGIONS.COMMISSION_TRACKING
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
            await genshin.setBigMapZoomLevel(2);
            // 获取地图坐标并保存
            const bigMapPosition = genshin.getPositionFromBigMap();
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
    loadAndParseProcessFile: async (
      commissionName,
      location,
      locationprocessFilePath = "process.json"
    ) => {
      const processFilePath = `${Datas.TALK_PROCESS_BASE_PATH}/${commissionName}/${location}/${locationprocessFilePath}`;
      let processContent;
      let processSteps;
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
        const jsonData = JSON.parse(processContent);
        if (Array.isArray(jsonData)) {
          processSteps = jsonData;
          log.debug("JSON流程解析成功");
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
      return processSteps;
    },

    // 执行对话委托流程（优化版）
    executeTalkCommission: async (commissionName, location) => {
      try {
        const processSteps = await Execute.loadAndParseProcessFile(
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
    autoNavigateToTalk: async (npcName = "", iconType = "") => {
      try {
        // 设置目标NPC名称
        const textArray = npcName;

        // 根据图标类型选择不同的识别对象
        let boxIconRo;
        if (iconType === "Bigmap") {
          boxIconRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(
              "Data/RecognitionObject/IconBigmapCommission.jpg"
            )
          );
          log.info("使用大地图图标");
        }
        else if (iconType === "Question") {
          boxIconRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(
              "Data/RecognitionObject/IconQuestionCommission.png"
            )
          );
          log.info("使用问号任务图标");
        } 
        else {
          // 默认使用任务图标
          boxIconRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(
              "Data/RecognitionObject/IconTaskCommission.png"
            )
          );
          log.info("使用任务图标");
        }

        let advanceNum = 0; //前进次数

        middleButtonClick();
        await sleep(800);

        while (true) {
          // 1. 优先检查是否已到达
          await sleep(500);// 等待0.5秒
          let captureRegion = captureGameRegion();
          let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
          let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
          log.debug("检测到文字: " + rewardResult.text);
          // 检测到特点文字则结束！！！
          if (rewardResult.text == textArray) {
            log.info("已到达指定位置，检测到文字: " + rewardResult.text);
            return;
          } else if (advanceNum > 80) {
            throw new Error("前进时间超时");
          }
          // 2. 未到达领奖点，则调整视野
          for (let i = 0; i < 100; i++) {
            captureRegion = captureGameRegion();
            let iconRes = captureRegion.Find(boxIconRo);
            log.info("检测到委托图标位置 ({x}, {y})", iconRes.x, iconRes.y);
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
    executeUnifiedTalkProcess: async (
      processSteps,
      commissionName,
      location
    ) => {
      try {
        log.info("执行统一对话委托流程: {name}", commissionName);

        if (!processSteps || processSteps.length === 0) {
          log.warn("没有找到有效的流程步骤");
          return false;
        }

        // 初始化UI检测器和配置
        const isInMainUI = UIUtils.createMainUIChecker();
        let priorityOptions = [];
        let npcWhiteList = [];

        // 刚开始就追踪委托目标
        //await Execute.findCommissionTarget(commissionName);

        // 执行处理步骤
        for (let i = 0; i < processSteps.length; i++) {
          const step = processSteps[i];
          log.info("执行流程步骤 {step}: {type}", i + 1, step.type || step);

          try {
            // 重置为默认值并处理自定义配置
            const stepConfig = Execute.processStepConfiguration(
              step,
              priorityOptions,
              npcWhiteList
            );
            priorityOptions = stepConfig.priorityOptions;
            npcWhiteList = stepConfig.npcWhiteList;

            // TAG:添加脚本功能点3
            const context = {
              commissionName,
              location,
              processSteps,
              currentIndex: i,
              isInMainUI,
              priorityOptions,
              npcWhiteList,
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
    processStepConfiguration: (
      step,
      defaultPriorityOptions,
      defaultNpcWhiteList
    ) => {
      let priorityOptions = [...defaultPriorityOptions];
      let npcWhiteList = [...defaultNpcWhiteList];

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

      return { priorityOptions, npcWhiteList };
    },

    // 处理单个步骤
    processStep: async (step, context) => {
      if (typeof step === "string") {
        // 简单格式处理
        await Execute.processStringStep(step, context);
      } else if (typeof step === "object") {
        // JSON格式处理
        await Execute.processObjectStep(step, context);
      }
    },

    // 处理字符串格式的步骤
    processStringStep: async (step, context) => {
      if (step.endsWith(".json")) {
        // 地图追踪文件
        await StepProcessor.processMapTracking(
          step,
          context.commissionName,
          context.location
        );
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
    processObjectStep: async (step, context) => {
      if (step.note) {
        log.info("步骤说明: {note}", step.note);
      }

      // 使用步骤处理器工厂来处理步骤
      await StepProcessorFactory.process(step, context);
    },

    // 示例：注册自定义步骤处理器
    registerCustomStepProcessors: () => {
      // 注册等待步骤处理器
      StepProcessorFactory.register("等待", async (step, context) => {
        const waitTime = step.data || 1000;
        log.info("等待 {time} 毫秒", waitTime);
        await sleep(waitTime);
      });

      // 注册截图步骤处理器
      StepProcessorFactory.register("截图", async (step, context) => {
        const filename = step.data || `screenshot_${Date.now()}.png`;
        log.info("截图保存为: {filename}", filename);
        // 这里可以添加实际的截图逻辑
      });

      // 注册条件检查步骤处理器
      StepProcessorFactory.register("条件检查", async (step, context) => {
        const condition = step.data.condition;
        const trueSteps = step.data.trueSteps || [];
        const falseSteps = step.data.falseSteps || [];

        log.info("执行条件检查: {condition}", condition);

        // 这里可以添加条件判断逻辑
        const conditionResult = true; // 示例结果

        const stepsToExecute = conditionResult ? trueSteps : falseSteps;
        for (const subStep of stepsToExecute) {
          await Execute.processStep(subStep, context);
        }
      });

      log.info("自定义步骤处理器注册完成");
    },

    // 处理对话步骤
    processDialogStep: async (
      step,
      priorityOptions,
      npcWhiteList,
      isInMainUI
    ) => {
      log.info("执行对话");
      let skipCount = 2; // 默认跳过2次
      
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
  };

  const CommissionsFunc = {

    // 计算两点之间的距离
    calculateDistance: (point1, point2) => {
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
    },

    // 获取委托的目标坐标（从路径追踪文件中获取最后一个坐标）
    getCommissionTargetPosition: async (scriptPath) => {
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
        log.error("获取委托目标坐标时出错: {error}", error.message);
        return null;
      }
    },

    // 执行带分支的对话委托流程（从main_branch.js移植）
    executeTalkCommissionWithBranches: async (processPath) => {
      try {
        log.info("开始执行对话委托流程: {path}", processPath);

        // 读取流程文件
        const processContent = await file.readText(processPath);

        // 解析流程内容
        const branches = CommissionsFunc.parseProcessBranches(processContent);

        // 确定要执行的分支
        const branchToExecute = await CommissionsFunc.determineBranch(branches);

        if (branchToExecute) {
          log.info("执行分支: {id}", branchToExecute.id);
          await Execute.executeUnifiedTalkProcess(branchToExecute.steps);
        } else {
          log.warn("没有找到匹配的分支，执行默认流程");
          // 尝试解析整个内容作为单一流程
          const steps = JSON.parse(processContent);
          await Execute.executeUnifiedTalkProcess(steps);
        }
      } catch (error) {
        log.error("执行对话委托流程出错: {error}", error.message);
      }
    },

    // 解析流程文件中的分支（从main_branch.js移植）
    parseProcessBranches: (content) => {
      const branches = [];
      const branchRegex =
        /分支:(\d+)[\s\S]*?判断方法"([^"]+)"[\s\S]*?data:"([^"]+)"([\s\S]*?)(?=分支:|$)/g;

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
          steps: steps,
        });
      }

      return branches;
    },

    // 确定要执行的分支（从main_branch.js移植）
    determineBranch: async (branches) => {
      for (const branch of branches) {
        switch (branch.method) {
          case "坐标":
            if (await CommissionsFunc.checkCoordinateMatch(branch.data)) {
              return branch;
            }
            break;

          case "任务追踪":
            if (await CommissionsFunc.checkTaskMatch(branch.data)) {
              return branch;
            }
            break;

          default:
            log.warn("未知的判断方法: {method}", branch.method);
        }
      }

      return null;
    },

    // 检查当前坐标是否匹配（从main_branch.js移植）
    checkCoordinateMatch: async (coordData) => {
      try {
        const [targetX, targetY] = coordData
          .split(",")
          .map((c) => parseFloat(c.trim()));

        // 获取当前委托位置
        const playerPos = await CommissionsFunc.getCurrentCommissionPosition();
        if (!playerPos) return false;

        // 计算距离
        const distance = CommissionsFunc.calculateDistance(playerPos, {
          x: targetX,
          y: targetY,
        });
        log.info(
          "当前位置: ({x}, {y})，目标位置: ({tx}, {ty})，距离: {d}",
          playerPos.x,
          playerPos.y,
          targetX,
          targetY,
          distance
        );

        // 如果距离小于阈值，认为匹配
        return distance < 100; // 可以调整阈值
      } catch (error) {
        log.error("检查坐标匹配出错: {error}", error.message);
        return false;
      }
    },

    // 检查当前任务是否匹配（从main_branch.js移植）
    checkTaskMatch: async (taskName) => {
      try {
        // 识别左上角任务区域文本
        const taskRegion = { X: 75, Y: 240, WIDTH: 225, HEIGHT: 60 };
        const taskResults = await Utils.easyOCR(taskRegion);

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
        log.error("检查任务匹配出错: {error}", error.message);
        return false;
      }
    },

    // 获取当前委托位置（辅助函数）
    getCurrentCommissionPosition: async () => {
      try {
        // 这里可以通过多种方式获取当前位置
        // 1. 从大地图获取
        await genshin.setBigMapZoomLevel(2);
        const bigMapPosition = genshin.getPositionFromBigMap();
        if (bigMapPosition) {
          return bigMapPosition;
        }

        // 2. 从当前委托位置变量获取（如果有的话）
        if (currentCommissionPosition) {
          return currentCommissionPosition;
        }

        log.warn("无法获取当前委托位置");
        return null;
      } catch (error) {
        log.error("获取当前委托位置时出错: {error}", error.message);
        return null;
      }
    },
  };

  const Test = async () => {
    Utils.iframe(Datas.OCR_REGIONS.Main_Dev[0]);
    // 角色切换步骤使用示例：
    // 在process.json文件中添加如下步骤：
    // {
    //   "type": "切换角色",
    //   "data": {
    //     "position": 1,
    //     "character": "枫原万叶"
    //   },
    //   "note": "切换第1号位为枫原万叶"
    // }

    // // 切换角色示例（可选）
    // // 如果需要切换角色，可以取消注释下面的代码
    // const switchRoleStep = {
    //   type: "切换角色",
    //   data: { position: 1, character: "枫原万叶" },
    //   note: "切换第1号位为枫原万叶",
    // };
    // await StepProcessor.processSwitchRole(switchRoleStep);
  };

  //Main
  const Main = async () => {
    log.debug("版本: {version}", VERSION);
    try {
      if (selectedProcess === "刷新剧情列表") {
        // 刷新操作：扫描所有process.json并更新设置
        await refreshProcessList();
        log.info("委托列表已刷新，请重新选择并运行");
      } else {
        // 解析选中的委托路径
        const pathParts = selectedProcess.split('-');

        // 确保至少有两个文件夹层级
        if (pathParts.length < 2) {
          throw new Error("无效的委托路径格式");
        }

        // 提取最后两个文件夹名
        const folder1 = pathParts[pathParts.length - 2];
        const folder2 = pathParts[pathParts.length - 1];

        // 设置动态基础路径（倒数第二个文件夹之前的所有部分）
        Datas.TALK_PROCESS_BASE_PATH = "process/" + pathParts.slice(0, pathParts.length - 2).join('/');

        log.info("执行任务: {path}", selectedProcess);
        log.debug("基础路径: {basePath}", Datas.TALK_PROCESS_BASE_PATH);
        log.debug("文件夹1: {folder1}, 文件夹2: {folder2}", folder1, folder2);
        log.info("启用自动剧情");
        dispatcher.AddTrigger(new RealtimeTimer("AutoSkip"));
        if (!settings.noSkip) {
          log.info("启用自动拾取");
          dispatcher.AddTrigger(new RealtimeTimer("AutoPick"));
        }
        if (!settings.noEat) {
          log.info("启用自动吃药");
          dispatcher.AddTrigger(new RealtimeTimer("AutoEat"));
        }
        await switchPartyIfNeeded(team);
        await Execute.executeTalkCommission(folder1, folder2);
        dispatcher.ClearAllTriggers();
      }
    } catch (error) {
      log.error("执行出错: {error}", error.message);
      errorlog();
    }
  };


// 刷新委托列表（保留完整路径结构）
async function refreshProcessList() {
  // 读取所有process.json文件
  const allFiles = await readFolder("process/", true);
  
  // 筛选并处理符合条件的process.json文件
  const processEntries = allFiles
      .filter(file => file.fileName === "process.json")
      .map(file => {
          const pathSegments = file.folderPathArray;
          
          // 确保路径中有"process"部分
          const processIndex = pathSegments.indexOf("process");
          if (processIndex === -1 || processIndex >= pathSegments.length - 2) {
              throw new Error(`无效的路径结构: ${file.fullPath}`);
          }
          
          // 提取"process"之后的所有部分
          const relativePath = pathSegments.slice(processIndex + 1);
          
          // 确保至少有两个文件夹层级
          if (relativePath.length < 2) {
              throw new Error(`路径层级不足: ${file.fullPath}`);
          }
          
          // 创建选项名称（用连字符连接所有文件夹名）
          const optionName = relativePath.join('-');
          
          return {
              name: optionName,
              path: file.fullPath
          };
      });
  
  // 创建选项列表（以"刷新剧情列表"开头）
  const options = ["刷新剧情列表", ...processEntries.map(entry => entry.name)];
  
  // 更新settings.json
  await updateSettingsFile(options);
  log.info("已更新{count}个委托选项", processEntries.length);
}

// 更新settings.json文件
async function updateSettingsFile(options) {
    const settingsPath = "./settings.json";
    let settingsArray;
    
    try {
        // 读取现有设置
        const content = file.readTextSync(settingsPath);
        settingsArray = JSON.parse(content);
    } catch (e) {
        // 文件不存在或解析失败时创建默认设置
        throw new Error("设置文件不存在");
    }
    
    // 更新process_selector选项
    const selectorIndex = settingsArray.findIndex(item => item.name === "process_selector");
    if (selectorIndex !== -1) {
        settingsArray[selectorIndex].options = options;
        settingsArray[selectorIndex].default = "刷新剧情列表";
    } else {
        // 如果不存在则添加
        settingsArray.push({
            "name": "process_selector",
            "type": "select",
            "label": "可执行剧情列表",
            "options": options,
            "default": "刷新剧情列表"
        });
    }
    
    // 写入更新后的设置
    const success = file.writeTextSync(settingsPath, JSON.stringify(settingsArray, null, 2));
    if (!success) {
        throw new Error("写入设置文件失败");
    }
}

// 文件夹读取函数（优化版）
async function readFolder(folderPath, onlyJson) {
    log.info(`开始读取文件夹: ${folderPath}`);
    const folderStack = [folderPath];
    const files = [];

    while (folderStack.length > 0) {
        const currentPath = folderStack.pop();
        const items = file.ReadPathSync(currentPath);
        const subFolders = [];

        for (const itemPath of items) {
            if (file.IsFolder(itemPath)) {
                subFolders.push(itemPath);
            } else if (!onlyJson || itemPath.toLowerCase().endsWith(".json")) {
                const pathParts = itemPath.split(/[\\\/]/).filter(Boolean);
                const fileName = pathParts.pop();
                files.push({
                    fullPath: itemPath,
                    fileName: fileName,
                    folderPathArray: pathParts
                });
            }
        }

        // 保持原始顺序添加子文件夹
        folderStack.push(...subFolders.reverse());
    }

    return files;
}

//切换队伍
async function switchPartyIfNeeded(partyName) {
  if (!partyName) {
      await genshin.returnMainUi();
      return;
  }
  try {
      log.info("正在尝试切换至" + partyName);
      if (!await genshin.switchParty(partyName)) {
          log.info("切换队伍失败，前往七天神像重试");
          await genshin.tpToStatueOfTheSeven();
          await genshin.switchParty(partyName);
      }
  } catch {
      log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
      notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
      await genshin.returnMainUi();
  }
}

await Main();
})();
