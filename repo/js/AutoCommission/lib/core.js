// 原神每日委托自动执行脚本 - 核心业务逻辑模块
var Core = {
  // 委托前准备工作
  PrepareForLeyLineRun: async function() {
    log.info("开始执行委托前准备");
    setGameMetrics(1920, 1080, 1);
    try {
      await genshin.returnMainUi();
      var settings = await Utils.getSetting();
      if (!settings.prepare) {
        await genshin.tpToStatueOfTheSeven();
      }
      // 切换战斗队伍
      if (settings.team) {
        log.info("切换至队伍 {team}", settings.team);
        await genshin.switchParty(settings.team);
      }
    } catch (error) {
      log.error("PrepareForLeyLineRun函数出现错误: {error}", error.message);
    }
  },

  // 委托识别主函数
  Identification: async function() {
    log.info("开始执行原神每日委托识别脚本");
    try {
      // 设置游戏参数
      setGameMetrics(1920, 1080, 1);
      await genshin.returnMainUi();

      // 初始化跳过委托列表
      CommissionBasic.initSkipCommissionsList();

      // 加载支持的委托列表
      var supportedCommissions = await CommissionData.loadSupportedCommissions();

      log.info(
        "支持的战斗委托: {count} 个",
        supportedCommissions.fight.length
      );
      log.info(
        "支持的对话委托: {count} 个",
        supportedCommissions.talk.length
      );

      // 确保所有委托的资源目录存在
      for (var i = 0; i < supportedCommissions.fight.length; i++) {
        var commission = supportedCommissions.fight[i];
        await Utils.ensureDirectoryExists("assets/" + commission);
      }
      for (var i = 0; i < supportedCommissions.talk.length; i++) {
        var commission = supportedCommissions.talk[i];
        await Utils.ensureDirectoryExists(
          Constants.TALK_PROCESS_BASE_PATH + "/" + commission
        );
      }

      // 进入委托界面
      var enterSuccess = await UI.enterCommissionScreen();
      if (!enterSuccess) {
        log.error("无法进入委托界面，脚本终止");
        return [];
      }
      await sleep(1000);

      // 识别委托
      var commissions = await CommissionRecognition.recognizeCommissions(
        supportedCommissions
      );

      // 检测委托是否为错误状态，只有在成功识别到委托时才保存数据
      if (commissions && commissions.length > 0) {
        log.info("委托识别成功，开始保存数据");
        await CommissionData.saveCommissionsData(commissions);
      } else {
        log.warn("委托识别失败或未识别到任何委托，跳过保存数据");
      }

      // 根据识别结果输出不同的日志信息
      if (commissions && commissions.length > 0) {
        log.info(
          "委托识别完成，共识别到 {total} 个委托，其中 {supported} 个受支持",
          commissions.length,
          commissions.filter(function(c) { return c.supported; }).length
        );
      } else {
        log.warn("委托识别失败，未识别到任何委托");
      }

      return commissions;
    } catch (error) {
      log.error("Identification函数出现错误: {error}", error.message);
      return [];
    }
  },

  // 执行委托追踪（优化版 - 按距离排序）
  executeCommissionTracking: async function() {
    try {
      log.info("开始执行委托追踪 - 按距离排序模式");

      // 确保回到主界面
      await genshin.returnMainUi();
      await sleep(1000);

      // 获取已识别的委托列表
      var commissions = [];
      try {
        var commissionsDataContent = file.readTextSync(Constants.OUTPUT_DIR + "/commissions_data.json");
        var commissionsData = JSON.parse(commissionsDataContent);
        
        // 安全检查委托数据结构
        if (commissionsData && commissionsData.commissions && Array.isArray(commissionsData.commissions)) {
          commissions = commissionsData.commissions.filter(function(c) { return c.supported; });
          log.info("已加载支持的委托数据，共 {count} 个", commissions.length);
        } else {
          log.error("委托数据文件格式错误，commissions字段不存在或不是数组");
          return false;
        }
      } catch (error) {
        log.error("读取委托数据失败: {error}", error.message);
        return false;
      }

      if (commissions.length === 0) {
        log.warn("没有找到支持的委托，请先运行识别脚本");
        return false;
      }

      // 按距离排序委托（如果有位置信息）
      var commissionsWithPosition = commissions.filter(function(c) {
        return c.CommissionPosition &&
          c.CommissionPosition.X &&
          c.CommissionPosition.Y;
      });

      // 统计已完成委托
      var completedCount = 0;
      for (var i = 0; i < commissions.length; i++) {
        var commission = commissions[i];
        if (commission.location === "已完成") {
          completedCount++;
          continue;
        }
      }

      // 执行每个委托
      for (var i = 0; i < commissions.length; i++) {
        var commission = commissions[i];
        
        // 检查是否在跳过列表中
        if (
          CommissionBasic.skipCommissionsList.length > 0 &&
          CommissionBasic.skipCommissionsList.indexOf(commission.name) !== -1
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

        var success = false;
        var retryCount = 0;

        // 委托执行重试循环
        while (retryCount <= Constants.MAX_COMMISSION_RETRY_COUNT && !success) {
          if (retryCount > 0) {
            log.info(
              "委托 {name} 第 {retry} 次重试执行",
              commission.name,
              retryCount
            );
          }

          // 根据委托类型执行不同的处理逻辑
          if (commission.type === Constants.COMMISSION_TYPE.TALK) {
            // 执行对话委托
            var talkSuccess = await Execute.executeTalkCommission(
              commission.name,
              commission.location
            );
            dispatcher.ClearAllTriggers();

            if (talkSuccess) {
              var completed = await CommissionBasic.iscompleted(completedCount);
              if (completed) {
                completedCount++;
                success = true;
                log.info("对话委托 {name} 执行完成", commission.name);
              } else {
                log.warn(
                  "对话委托 {name} 执行后检查未完成，重试次数: {retry}/{max}",
                  commission.name,
                  retryCount,
                  Constants.MAX_COMMISSION_RETRY_COUNT
                );
              }
            } else {
              log.warn(
                "对话委托 {name} 执行失败，重试次数: {retry}/{max}",
                commission.name,
                retryCount,
                Constants.MAX_COMMISSION_RETRY_COUNT
              );
            }
          } else {
            // 默认执行战斗委托
            var location = commission.location.trim();

            // 脚本路径
            var scriptPaths = [
              "assets/" + commission.name + "/" + location + "-1.json",
              "assets/" + commission.name + "/" + location + "-2.json",
              "assets/" + commission.name + "/" + location + "-3.json",
            ];

            // 获取每个脚本对应的目标位置和距离（每次重试都重新计算）
            var scriptInfo = [];
            for (var j = 0; j < scriptPaths.length; j++) {
              var scriptPath = scriptPaths[j];
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

            // 按距离排序脚本（每次重试都重新排序）
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

            // 尝试执行距离最近的脚本
            var scriptSuccess = false;
            if (scriptInfo.length > 0) {
              // 只执行距离最近的脚本（已经排序过，第一个就是最近的）
              var closestScript = scriptInfo[0];
              var scriptPath = closestScript.path;
              try {
                // 执行路径追踪脚本
                log.info("执行最近的脚本: {path} (距离: {distance})", scriptPath, closestScript.distance);
                dispatcher.addTimer(
                  new RealtimeTimer("AutoPick", { forceInteraction: false })
                );
                // dispatcher.addTimer(new RealtimeTimer("AutoEat"));
                await pathingScript.runFile(scriptPath);
                log.info("路径追踪脚本执行完成");
                dispatcher.ClearAllTriggers();
                // 检查委托是否完成
                if (await CommissionBasic.iscompleted(completedCount)) {
                  log.info("委托 {name} 已完成", commission.name);
                  completedCount++;
                  success = true;
                  scriptSuccess = true;
                } else {
                  log.info("委托 {name} 未完成", commission.name);
                }
              } catch (scriptError) {
                log.error("执行路径追踪脚本时出错: {error}", scriptError);
              }
            } else {
              log.warn("委托 {name} 没有可用的脚本", commission.name);
            }

            if (!scriptSuccess) {
              log.warn(
                "战斗委托 {name} 最近脚本执行失败，重试次数: {retry}/{max}",
                commission.name,
                retryCount,
                Constants.MAX_COMMISSION_RETRY_COUNT
              );
            }
          }

          // 增加重试计数
          retryCount++;

          // 如果未成功且还有重试机会，等待一段时间再重试
          if (!success && retryCount <= Constants.MAX_COMMISSION_RETRY_COUNT) {
            log.info("等待1秒后重试委托 {name}...", commission.name);
            await sleep(1000);
          }
        }

        // 重试循环结束后的处理
        if (!success) {
          if (retryCount > Constants.MAX_COMMISSION_RETRY_COUNT) {
            log.warn(
              "委托 {name} 重试 {retry} 次后仍未完成，跳过该委托",
              commission.name,
              Constants.MAX_COMMISSION_RETRY_COUNT
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
      return false;
    }
  },

  // 主流程执行函数
  executeMainProcess: async function() {
    try {
      var settings = await Utils.getSetting();
      
      if (settings.skipRecognition) {
        log.info("跳过识别，直接加载数据");
      } else {
        log.info("开始执行委托识别");
        await Core.Identification();
      }

      // 开局准备
      await Core.PrepareForLeyLineRun();

      // 执行自动委托
      await Core.executeCommissionTracking();
      
      if (!settings.prepare) {
        log.info("每日委托执行完成，前往安全地点");
        await genshin.tpToStatueOfTheSeven();
      } else {
        log.info("每日委托执行完成");
      }
    } catch (error) {
      log.error("执行出错: {error}", error.message);
    }
  },
};