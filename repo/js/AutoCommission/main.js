(async function () {
  // 版本和编译信息
  const VERSION = "0.98.2";
  const BUILD_TIME = "2025.07.13";
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
    TALK_PROCESS_BASE_PATH: "assets/process",

    // 图像识别相关常量
    COMPLETED_IMAGE_PATH: "Data/RecognitionObject/Completed.png",
    UNCOMPLETED_IMAGE_PATH: "Data/RecognitionObject/UnCompleted.png",

    // 基础配置常量
    MIN_TEXT_LENGTH: 4, // 最小文本长度
    MAX_COMMISSION_RETRY_COUNT: 1, // 默认重试机制，超过则跳过该委托

    // 委托类型常量
    COMMISSION_TYPE: {
      FIGHT: "fight",
      TALK: "talk",
    },

    // OCR识别区域常量
    OCR_REGIONS: {
      Main_Dev: [
        // 第1个委托名字
        {
          X: 796,
          Y: 293,
          WIDTH: 440,
          HEIGHT: 40,
        },
        // 第2个委托名字
        {
          X: 796,
          Y: 401,
          WIDTH: 440,
          HEIGHT: 40,
        },
        // 第3个委托名字
        {
          X: 796,
          Y: 509,
          WIDTH: 440,
          HEIGHT: 40,
        },
        // 第4个委托名字(滑动后)
        {
          X: 796,
          Y: 544,
          WIDTH: 440,
          HEIGHT: 40,
        },
      ],

      // 主要委托识别区域
      MAIN: {
        X: 750,
        Y: 250,
        WIDTH: 450,
        HEIGHT: 400,
      },
      // 委托地点OCR区域
      LOCATION: {
        X: 1530,
        Y: 100,
        WIDTH: 250, // 1630 - 1530
        HEIGHT: 30, // 130 - 100
      },
      // 委托详情页面国家检测OCR区域
      DETAIL_COUNTRY: {
        X: 1480,
        Y: 100,
        WIDTH: 55, // 1535 - 1480
        HEIGHT: 30, // 130 - 100
      },
      // 委托触发检测区域
      COMMISSION_TRIGGER: {
        X: 885,
        Y: 200,
        WIDTH: 165, // 1050 - 885
        HEIGHT: 50, // 250 - 200
      },
      // 委托完成检测区域
      COMMISSION_COMPLETE: {
        X: 880,
        Y: 165,
        WIDTH: 170, // 1050 - 880
        HEIGHT: 45, // 210 - 165
      },
      // 委托追踪检测区域
      COMMISSION_TRACKING: {
        X: 1622,
        Y: 987,
        WIDTH: 137,
        HEIGHT: 35,
      },
      // 委托详情检测区域
      COMMISSION_DETAIL: {
        X: 76,
        Y: 239,
        WIDTH: 280, // 358 - 76
        HEIGHT: 43, // 272-239
      },
    },

    // 委托详情按钮位置常量
    COMMISSION_DETAIL_BUTTONS: [
      { id: 1, x: 1550, y: 320, checkX: 1450, checkWidth: 150 }, // 第一个委托详情按钮
      { id: 2, x: 1550, y: 440, checkX: 1450, checkWidth: 150 }, // 第二个委托详情按钮
      { id: 3, x: 1550, y: 530, checkX: 1500, checkWidth: 100 }, // 第三个委托详情按钮
      { id: 4, x: 1550, y: 560, checkX: 1450, checkWidth: 150 }, // 第四个委托详情按钮（滑动后）
    ],
  };

  // 存储当前委托位置
  let currentCommissionPosition = null;
    
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
  const getSetting = async () => {
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
    await getSetting();

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
    // 解析跳过的委托列表
    parseSkipCommissions: (skipCommissionsStr) => {
      if (!skipCommissionsStr || typeof skipCommissionsStr !== "string") {
        return [];
      }

      // 支持中文逗号和英文逗号分割
      return skipCommissionsStr
        .split(/[,，]/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
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
    // 进入委托界面
    enterCommissionScreen: async () => {
      //log.info("正在进入委托界面...");

      try {
        // 使用F1快捷键直接打开委托界面
        log.info("尝试使用F1快捷键进入委托界面");
        keyPress("VK_F1");
        // 点击委托界面
        log.debug("点击委托界面");
        await sleep(1000);
        click(300, 350);
        await sleep(100);
        log.debug("已进入委托界面");
        return true;
      } catch (error) {
        log.error("进入委托界面失败: {error}", error);
        return false;
      }
    },

    // 自动执行划页操作 - 新的滑动方法
    pageScroll: async (scrollCount) => {
      try {
        const clickX = 950; // 假设点击的起始坐标
        const clickY = 600;
        const totalDistance = 200; // 假设每次滑动的总距离
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
          await sleep(100);
          leftButtonUp();
          await sleep(300); // 增加滑动后的等待时间，确保界面稳定
        }

        return true;
      } catch (error) {
        log.error(`执行滑动操作时发生错误：${error.message}`);
        return false;
      }
    },

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

  const Core = {
    PrepareForLeyLineRun: async () => {
      log.info("开始执行委托前准备");
      setGameMetrics(1920, 1080, 1);
      try {
        await genshin.returnMainUi();
        if (!prepare) {
          await genshin.tpToStatueOfTheSeven();
        }
        // 切换战斗队伍
        if (team) {
          log.info(`切换至队伍 ${team}`);
          await genshin.switchParty(team);
        }
      } catch (error) {
        log.error("PrepareForLeyLineRun函数出现错误: {error}", error.message);
      }
    },

    Identification: async () => {
      log.info("开始执行原神每日委托识别脚本");
      try {
        // 设置游戏参数
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();

        // 初始化跳过委托列表
        CommissionsFunc.initSkipCommissionsList();

        // 加载支持的委托列表
        const supportedCommissions =
          await CommissionsFunc.loadSupportedCommissions();

        log.info(
          "支持的战斗委托: {count} 个",
          supportedCommissions.fight.length
        );
        log.info(
          "支持的对话委托: {count} 个",
          supportedCommissions.talk.length
        );

        // 确保所有委托的资源目录存在
        for (const commission of supportedCommissions.fight) {
          await CommissionsFunc.ensureDirectoryExists(`assets/${commission}`);
        }
        for (const commission of supportedCommissions.talk) {
          await CommissionsFunc.ensureDirectoryExists(
            `${Datas.TALK_PROCESS_BASE_PATH}/${commission}`
          );
        }

        // 进入委托界面
        const enterSuccess = await UI.enterCommissionScreen();
        if (!enterSuccess) {
          log.error("无法进入委托界面，脚本终止");
          return [];
        }
        await sleep(100);

        // 识别委托
        const commissions = await CommissionsFunc.recognizeCommissions(
          supportedCommissions
        );

        // 检测委托是否为错误状态，只有在成功识别到委托时才保存数据
        if (commissions && commissions.length > 0) {
          log.info("委托识别成功，开始保存数据");
          await CommissionsFunc.saveCommissionsData(commissions);
        } else {
          log.warn("委托识别失败或未识别到任何委托，跳过保存数据");
        }

        // 根据识别结果输出不同的日志信息
        if (commissions && commissions.length > 0) {
          log.info(
            "委托识别完成，共识别到 {total} 个委托，其中 {supported} 个受支持",
            commissions.length,
            commissions.filter((c) => c.supported).length
          );
        } else {
          log.warn("委托识别失败，未识别到任何委托");
        }

        return commissions;
      } catch (error) {
        log.error("Identification函数出现错误: ${error.message}");
        errorlog();
        return [];
      }
    },

    // 执行委托追踪（优化版 - 按距离排序）
    executeCommissionTracking: async () => {
      try {
        log.info("开始执行委托追踪 - 按距离排序模式");

        // 确保回到主界面
        await genshin.returnMainUi();
        await sleep(1000);

        // 获取已识别的委托列表
        let commissions = [];
        try {
          const commissionsData = JSON.parse(
            file.readTextSync(`${Datas.OUTPUT_DIR}/commissions_data.json`)
          );
          commissions = commissionsData.commissions.filter((c) => c.supported);
          log.info("已加载支持的委托数据，共 {count} 个", commissions.length);
        } catch (error) {
          log.error("读取委托数据失败: {error}", error.message);
          return false;
        }

        if (commissions.length === 0) {
          log.warn("没有找到支持的委托，请先运行识别脚本");
          return false;
        }

        // 按距离排序委托（如果有位置信息）
        const commissionsWithPosition = commissions.filter(
          (c) =>
            c.CommissionPosition &&
            c.CommissionPosition.X &&
            c.CommissionPosition.Y
        );

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
          // 检查是否在跳过列表中
          if (
            CommissionsFunc.skipCommissionsList.length > 0 &&
            CommissionsFunc.skipCommissionsList.includes(commission.name)
          ) {
            log.info("委托 {name} 在跳过列表中，跳过执行", commission.name);
            continue;
          }

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
            if (commission.CommissionPosition) {
              log.info(
                "当前委托位置: ({x}, {y})",
                commission.CommissionPosition.X,
                commission.CommissionPosition.Y
              );
            }
          } catch (error) {
            log.warn("委托 {name} 缺少坐标信息，尝试全部执行", commission.name);
          }

          let success = false;
          let retryCount = 0;

          // 委托执行重试循环
          while (retryCount <= Datas.MAX_COMMISSION_RETRY_COUNT && !success) {
            if (retryCount > 0) {
              log.info(
                "委托 {name} 第 {retry} 次重试执行",
                commission.name,
                retryCount
              );
            }

            // 根据委托类型执行不同的处理逻辑
            if (commission.type === Datas.COMMISSION_TYPE.TALK) {
              // 执行对话委托
              const talkSuccess = await Execute.executeTalkCommission(
                commission.name,
                commission.location
              );
              dispatcher.ClearAllTriggers();

              if (talkSuccess) {
                const completed = await CommissionsFunc.iscompleted(completedCount);
                if (completed) {
                  completedCount++;
                  success = true;
                  log.info("对话委托 {name} 执行完成", commission.name);
                } else {
                  log.warn(
                    "对话委托 {name} 执行后检查未完成，重试次数: {retry}/{max}",
                    commission.name,
                    retryCount,
                    Datas.MAX_COMMISSION_RETRY_COUNT
                  );
                }
              } else {
                log.warn(
                  "对话委托 {name} 执行失败，重试次数: {retry}/{max}",
                  commission.name,
                  retryCount,
                  Datas.MAX_COMMISSION_RETRY_COUNT
                );
              }
            } else {
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
                  const targetPos =
                    await CommissionsFunc.getCommissionTargetPosition(
                      scriptPath
                    );
                  if (targetPos) {
                    const distance = CommissionsFunc.calculateDistance(
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
              // TODO:只执行第一个
              let scriptSuccess = false;
              for (const info of scriptInfo) {
                const scriptPath = info.path;
                try {
                  // 执行路径追踪脚本
                  log.info("开始执行路径追踪脚本: {path}", scriptPath);
                  dispatcher.addTimer(
                    new RealtimeTimer("AutoPick", { forceInteraction: false })
                  );
                  await pathingScript.runFile(scriptPath);
                  log.info("路径追踪脚本执行完成");
                  dispatcher.ClearAllTriggers();
                  // 检查委托是否完成
                  if (await CommissionsFunc.iscompleted(completedCount)) {
                    log.info("委托 {name} 已完成", commission.name);
                    completedCount++;
                    success = true;
                    scriptSuccess = true;
                    break;
                  } else {
                    log.info(
                      "委托 {name} 未完成，尝试下一个脚本",
                      commission.name
                    );
                  }
                } catch (scriptError) {
                  log.error("执行路径追踪脚本时出错: {error}", scriptError);
                  continue; // 尝试下一个脚本
                }
              }

              if (!scriptSuccess) {
                log.warn(
                  "战斗委托 {name} 所有脚本执行失败，重试次数: {retry}/{max}",
                  commission.name,
                  retryCount,
                  Datas.MAX_COMMISSION_RETRY_COUNT
                );
              }
            }

            // 增加重试计数
            retryCount++;

            // 如果未成功且还有重试机会，等待一段时间再重试
            if (!success && retryCount <= Datas.MAX_COMMISSION_RETRY_COUNT) {
              log.info("等待1秒后重试委托 {name}...", commission.name);
              await sleep(1000);
            }
          }

          // 重试循环结束后的处理
          if (!success) {
            if (retryCount > Datas.MAX_COMMISSION_RETRY_COUNT) {
              log.warn(
                "委托 {name} 重试 {retry} 次后仍未完成，跳过该委托",
                commission.name,
                Datas.MAX_COMMISSION_RETRY_COUNT
              );
            } else {
              log.warn("委托 {name} 执行失败", commission.name);
            }
          } else {
            log.info("委托 {name} 执行成功", commission.name);
          }

          // 每个委托之间等待一段时间
          log.info("立刻执行下一个委托");
          //await sleep(5000);
        }

        log.info(
          "委托追踪全部执行完成，共执行 {count}/{total} 个委托",
          completedCount,
          commissions.length
        );

        return completedCount > 0;
      } catch (error) {
        log.error("执行委托追踪时出错: {error}", error.message);
        errorlog();
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
            const ocrResult = await Utils.easyOCROne(
              Datas.OCR_REGIONS.COMMISSION_DETAIL
            );

            if (ocrResult === commissionName || ocrResult === "") {
              await sleep(1000);
              // 没有延时13s的错误提示，继续检测
              log.debug("检测到委托名称或空文本，继续等待...");
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

      isinMainUi: async (step, context) => {
        await StepProcessor.processWaitMainUI(context.isInMainUI);
      },

      地址检测: async (step, context) => {
        await StepProcessor.processLocationDetection(
          step,
          context.commissionName,
          context.location,
          context.processSteps,
          context.currentIndex
        );
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
        await Execute.findCommissionTarget(commissionName);

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
    // 跳过的委托列表
    skipCommissionsList: [],

    // 初始化跳过委托列表
    initSkipCommissionsList: () => {
      CommissionsFunc.skipCommissionsList =
        Utils.parseSkipCommissions(skipCommissions);
      if (CommissionsFunc.skipCommissionsList.length > 0) {
        log.info(
          "配置的跳过委托列表: {list}",
          CommissionsFunc.skipCommissionsList.join(", ")
        );
      }
    },

    // 检测委托完成状态（使用图像识别）
    detectCommissionStatusByImage: async (buttonIndex) => {
      try {
        const button = Datas.COMMISSION_DETAIL_BUTTONS[buttonIndex];
        if (!button) {
          log.error("无效的按钮索引: {index}", buttonIndex);
          return "unknown";
        }

        log.debug("检测委托{id}的完成状态（图像识别）", button.id);
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
          completedTemplate = file.ReadImageMatSync(Datas.COMPLETED_IMAGE_PATH);
          uncompletedTemplate = file.ReadImageMatSync(
            Datas.UNCOMPLETED_IMAGE_PATH
          );
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
          return "completed";
        }

        // 检测未完成状态
        const uncompletedResult = checkRegion.find(uncompletedRo);
        if (!uncompletedResult.isEmpty()) {
          return "uncompleted";
        }

        log.warn("委托{id}状态识别失败", button.id);
        return "unknown";
      } catch (error) {
        log.error("检测委托完成状态时出错: {error}", error.message);
        return "unknown";
      }
    },

    // 识别委托地点
    recognizeCommissionLocation: async () => {
      try {
        log.info(
          "识别委托地点 ({x}, {y}) ({width}, {height})...",
          Datas.OCR_REGIONS.LOCATION.X,
          Datas.OCR_REGIONS.LOCATION.Y,
          Datas.OCR_REGIONS.LOCATION.X + Datas.OCR_REGIONS.LOCATION.WIDTH,
          Datas.OCR_REGIONS.LOCATION.Y + Datas.OCR_REGIONS.LOCATION.HEIGHT
        );

        // 使用Utils.easyOCROne进行识别
        const location = await Utils.easyOCROne(Datas.OCR_REGIONS.LOCATION);

        if (location && location.trim()) {
          return location.trim();
        }

        return "未知地点";
      } catch (error) {
        log.error("识别委托地点时出错: {error}", error.message);
        return "识别失败";
      }
    },

    // 检测是否进入委托详情界面
    checkDetailPageEntered: async () => {
      try {
        // 尝试3次OCR识别
        for (let i = 0; i < 3; i++) {
          // 使用Utils.easyOCR进行识别
          const results = await Utils.easyOCR(Datas.OCR_REGIONS.DETAIL_COUNTRY);

          if (results.count > 0) {
            // 检查OCR结果
            for (let j = 0; j < results.count; j++) {
              const text = results[j].text.trim();

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
        log.error("检测委托详情界面时出错: {error}", error.message);
        return "错误";
      }
    },

    // 识别委托列表 - 进行4个单独识别
    recognizeCommissions: async (supportedCommissions) => {
      try {
        log.info("开始执行委托识别");

        // 初始化当前委托位置变量
        let currentCommissionPosition = null;

        // 步骤1: 识别前3个委托（索引0-2）
        log.info("步骤1: 使用识别前3个委托");

        let allCommissions = [];

        // 先识别前3个区域（索引0-2）
        for (let regionIndex = 0; regionIndex < 3; regionIndex++) {
          const region = Datas.OCR_REGIONS.Main_Dev[regionIndex];

          log.info(
            "识别第{index}个委托区域 ({x}, {y}) ({width}, {height})",
            regionIndex + 1,
            region.X,
            region.Y,
            region.X + region.WIDTH,
            region.Y + region.HEIGHT
          );

          try {
            let results = await Utils.easyOCR(region);
            log.info(
              "第{index}个区域OCR识别结果数量: {count}",
              regionIndex + 1,
              results.count
            );

            // 处理识别结果，取第一个有效结果
            for (let i = 0; i < results.count; i++) {
              try {
                let result = results[i];
                let text = Utils.cleanText(result.text);
                if (text && text.length >= Datas.MIN_TEXT_LENGTH) {
                  log.info('第{index}个委托: "{text}"', regionIndex + 1, text);

                  // 检查委托类型
                  const isFightCommission =
                    supportedCommissions.fight.includes(text);
                  const isTalkCommission =
                    supportedCommissions.talk.includes(text);
                  const isSupported = isFightCommission || isTalkCommission;
                  const commissionType = isFightCommission
                    ? Datas.COMMISSION_TYPE.FIGHT
                    : isTalkCommission
                    ? Datas.COMMISSION_TYPE.TALK
                    : "";

                  allCommissions.push({
                    id: regionIndex + 1,
                    name: text,
                    supported: isSupported,
                    type: commissionType,
                    location: "",
                  });

                  // 找到有效结果后跳出循环
                  break;
                }
              } catch (ocrError) {
                log.error(
                  "处理第{regionIndex}个区域第{resultIndex}个OCR识别结果时出错: {error}，跳过该结果",
                  regionIndex + 1,
                  i + 1,
                  ocrError
                );
                // 跳过该结果，继续处理下一个
                continue;
              }
            }
          } catch (regionError) {
            log.error(
              "识别第{index}个委托区域时出错: {error}，跳过该区域",
              regionIndex + 1,
              regionError
            );
            continue;
          }
        }

        // 步骤2: 使用图像识别检测所有委托的完成状态
        log.info("步骤2: 检测所有委托的完成状态");

        // 处理前3个委托
        for (let i = 0; i < Math.min(3, allCommissions.length); i++) {
          const commission = allCommissions[i];

          try {
            // 使用图像识别检测完成状态
            const status = await CommissionsFunc.detectCommissionStatusByImage(
              i
            );

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
            const detailButton =
              Datas.COMMISSION_DETAIL_BUTTONS[commission.id - 1];
            log.info(
              "点击委托详情按钮 ({x}, {y})",
              detailButton.x,
              detailButton.y
            );
            click(detailButton.x, detailButton.y);
            await sleep(700);

            // 检测委托国家
            const detailStatus = await CommissionsFunc.checkDetailPageEntered();
            log.info(`委托国家: ${detailStatus}`);
            commission.country = detailStatus;
            const location =
              await CommissionsFunc.recognizeCommissionLocation();
            commission.location = location;
            log.info(
              "委托 {name} 的地点: {location}",
              commission.name,
              location
            );

            // 退出详情页面并获取地图坐标
            if (commission.location !== "已完成") {
              log.info("退出详情页面 - 按ESC");
              keyDown("VK_ESCAPE");
              await sleep(300);
              keyUp("VK_ESCAPE");
              await sleep(1200);
              await genshin.setBigMapZoomLevel(2);
              // 获取地图坐标并保存
              const bigMapPosition = genshin.getPositionFromBigMap();
              if (bigMapPosition) {
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
          } catch (commissionError) {
            log.error(
              "处理委托{id} {name} 时出错: {error}，跳过该委托",
              commission.id,
              commission.name,
              commissionError
            );
            // 设置错误状态，但不中断整个流程
            commission.location = "处理失败";
            commission.country = "未知";

            // 尝试退出可能打开的详情页面
            try {
              keyDown("VK_ESCAPE");
              await sleep(300);
              keyUp("VK_ESCAPE");
              await sleep(1200);
            } catch (escapeError) {
              log.warn("尝试退出详情页面时出错: {error}", escapeError);
            }
          }
        }

        // 步骤3: 翻页后识别第4个委托
        log.info("步骤3: 翻页后识别第4个委托");
        await UI.pageScroll(1);

        // 识别第4个区域（索引3）
        const region = Datas.OCR_REGIONS.Main_Dev[3];
        let fourthCommission = null;

        log.info(
          "识别第4个委托区域 ({x}, {y}) ({width}, {height})",
          region.X,
          region.Y,
          region.X + region.WIDTH,
          region.Y + region.HEIGHT
        );

        try {
          let results = await Utils.easyOCR(region);
          log.info("第4个区域OCR识别结果数量: {count}", results.count);

          // 处理识别结果，取第一个有效结果
          for (let i = 0; i < results.count; i++) {
            try {
              let result = results[i];
              let text = Utils.cleanText(result.text);
              if (text && text.length >= Datas.MIN_TEXT_LENGTH) {
                log.info('第4个委托: "{text}"', text);

                // 检查委托类型
                const isFightCommission =
                  supportedCommissions.fight.includes(text);
                const isTalkCommission =
                  supportedCommissions.talk.includes(text);
                const isSupported = isFightCommission || isTalkCommission;
                const commissionType = isFightCommission
                  ? Datas.COMMISSION_TYPE.FIGHT
                  : isTalkCommission
                  ? Datas.COMMISSION_TYPE.TALK
                  : "";

                fourthCommission = {
                  id: 4,
                  name: text,
                  supported: isSupported,
                  type: commissionType,
                  location: "",
                };

                // 找到有效结果后跳出循环
                break;
              }
            } catch (ocrError) {
              log.error(
                "处理第4个区域第{resultIndex}个OCR识别结果时出错: {error}，跳过该结果",
                i + 1,
                ocrError
              );
              // 跳过该结果，继续处理下一个
              continue;
            }
          }
        } catch (regionError) {
          log.error("识别第4个委托区域时出错: {error}", regionError);
        }

        // 如果识别到第4个委托，添加到列表中
        if (fourthCommission) {
          allCommissions.push(fourthCommission);
        }

        // 步骤4: 处理第4个委托的完成状态
        if (fourthCommission) {
          try {
            // 使用图像识别检测第4个委托的完成状态
            const status = await CommissionsFunc.detectCommissionStatusByImage(
              3
            ); // 第4个委托索引为3

            if (status === "completed") {
              log.info(
                "委托{id} {name} 已完成，跳过详情查看",
                fourthCommission.id,
                fourthCommission.name
              );
              fourthCommission.location = "已完成";
            } else if (status === "uncompleted") {
              log.info(
                "委托{id} {name} 未完成，查看详情",
                fourthCommission.id,
                fourthCommission.name
              );
            } else {
              log.warn(
                "委托{id} {name} 状态未知，尝试查看详情",
                fourthCommission.id,
                fourthCommission.name
              );
            }

            // 只有未完成或状态未知的委托才点击查看详情
            if (status !== "completed") {
              log.info("查看第4个委托详情: {name}", fourthCommission.name);

              // 点击详情按钮
              const detailButton = Datas.COMMISSION_DETAIL_BUTTONS[3]; // 第4个按钮索引为3
              log.info(
                "点击委托详情按钮 ({x}, {y})",
                detailButton.x,
                detailButton.y
              );
              click(detailButton.x, detailButton.y);
              await sleep(700);

              // 检测是否成功进入详情界面并获取委托国家
              const detailStatus =
                await CommissionsFunc.checkDetailPageEntered();
              log.info(`委托国家: ${detailStatus}`);
              fourthCommission.country = detailStatus;

              // 识别委托地点
              const location =
                await CommissionsFunc.recognizeCommissionLocation();
              fourthCommission.location = location;
              log.info(
                "委托 {name} 的地点: {location}",
                fourthCommission.name,
                location
              );

              // 退出详情页面并获取地图坐标
              if (fourthCommission.location !== "已完成") {
                log.info("退出详情页面 - 按ESC");
                keyDown("VK_ESCAPE");
                await sleep(300);
                keyUp("VK_ESCAPE");
                await sleep(1200);
                await genshin.setBigMapZoomLevel(2);
                // 获取地图坐标并保存
                const bigMapPosition = genshin.getPositionFromBigMap();
                if (bigMapPosition) {
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
          } catch (fourthCommissionError) {
            log.error(
              "处理第4个委托{name} 时出错: {error}，跳过该委托",
              fourthCommission.name,
              fourthCommissionError
            );
            // 设置错误状态，但不中断整个流程
            fourthCommission.location = "处理失败";
            fourthCommission.country = "未知";

            // 尝试退出可能打开的详情页面
            try {
              keyDown("VK_ESCAPE");
              await sleep(300);
              keyUp("VK_ESCAPE");
              await sleep(1200);
            } catch (escapeError) {
              log.warn("尝试退出详情页面时出错: {error}", escapeError);
            }
          }
        }

        // 输出完整委托列表
        log.info("完整委托列表:");
        for (const commission of allCommissions) {
          const supportStatus = commission.supported ? "✅ 支持" : "❌ 不支持";
          const typeInfo = commission.type ? `[${commission.type}]` : "";
          const locationInfo = commission.location
            ? `(${commission.location})`
            : "";
          const countryInfo = commission.country
            ? `{${commission.country}}`
            : "";
          log.info(
            "{id}. {name} {location} {country} {type} - {status}",
            commission.id,
            commission.name,
            locationInfo,
            countryInfo,
            typeInfo,
            supportStatus
          );
        }

        return allCommissions;
      } catch (error) {
        log.error("识别委托时出错: {error}", error.message);
        return [];
      }
    },

    // 读取支持的委托列表
    loadSupportedCommissions: async () => {
      let supportedCommissions = {
        fight: [],
        talk: [],
      };

      try {
        // 使用正确的文件读取方法
        log.info("开始读取支持的委托列表: {path}", Datas.SUPPORT_LIST_PATH);

        // 尝试读取文件内容
        try {
          const supportListContent = file.readTextSync(Datas.SUPPORT_LIST_PATH);

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
              Datas.SUPPORT_LIST_PATH,
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
        log.error("处理委托列表时出错: {error}", error.message);
      }

      return supportedCommissions;
    },

    ensureDirectoryExists: async (dirPath) => {
      try {
        // 尝试创建目录，如果目录已存在，writeTextSync不会报错
        // 创建一个临时文件来确保目录存在
        const tempFilePath = `${dirPath}/.temp`;
        file.writeTextSync(tempFilePath, "");
        // log.info(`已确保目录存在: ${dirPath}`);
        return true;
      } catch (error) {
        log.error(`创建目录时出错: ${error}`);
        return false;
      }
    },

    // 保存委托数据到文件
    saveCommissionsData: async (commissionsTable) => {
      try {
        log.info("保存委托数据到文件...");

        // 创建JSON格式的委托数据
        const commissionsData = {
          timestamp: new Date().toISOString(),
          commissions: commissionsTable,
        };

        // 保存到文件
        const outputPath = `${Datas.OUTPUT_DIR}/commissions_data.json`;
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
          const typeInfo = commission.type ? `[${commission.type}]` : "";
          reportContent += `${commission.id}. ${commission.name} ${typeInfo} - ${supportStatus}\r\n`;
        }

        // 保存报告
        const reportPath = `${Datas.OUTPUT_DIR}/commissions_report.txt`;
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
        log.error("处理委托数据时出错: {error}", error.message);
        return [];
      }
    },

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

    // 检查委托状态（通过委托名称查找位置后检测）
    iscompleted: async (completedCount) => {
      try {
      // 记录已完成的委托数量
      log.info("已完成委托数量: {completedCount}", completedCount);

        const enterSuccess = await UI.enterCommissionScreen();
        if (!enterSuccess) {
          log.error("无法进入委托界面");
          return false;
        }
        await sleep(900);
        if (completedCount===0) {
          await UI.pageScroll(1);
          const status = await CommissionsFunc.detectCommissionStatusByImage(3);
          if (status === "completed") {
            return true;
          } else {
            return false;
          }
        }else{
          const status = await CommissionsFunc.detectCommissionStatusByImage(3-completedCount);
          if (status === "completed") {
            return true;
          } else {
            return false;
          }
        }
      } catch (error) {
        log.error("检查委托完成状态失败: {error}", error.message);
        try {
          await genshin.returnMainUi();
        } catch (exitError) {
          log.warn("退出委托界面失败: {error}", exitError);
        }
        return false;
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

  // TAG:Main
  const Main = async () => {
    try {
      
    //await Identification();
    //await Execute.autoNavigateToTalk("汤米","task");

      if (skipRecognition) {
        log.info("跳过识别，直接加载数据");
      } else {
        log.info("开始执行委托识别");
        await Core.Identification();
      }

      // 开局准备
      await Core.PrepareForLeyLineRun();

      // 执行自动委托
      await Core.executeCommissionTracking();
      if (!prepare) {
        log.info("每日委托执行完成，前往安全地点");
        await genshin.tpToStatueOfTheSeven();
      }
      else {
        log.info("每日委托执行完成");
      }
    } catch (error) {
      log.error("执行出错:  {error}", error.message);
      errorlog();
    }
  };
  await Main();
  // await Test();
})();
