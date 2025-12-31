// 原神每日委托自动执行脚本 - 委托功能识别模块
var CommissionRecognition = {
  // 识别委托地点
  recognizeCommissionLocation: async function() {
    try {
      log.info(
        "识别委托地点 ({x}, {y}) ({width}, {height})...",
        Constants.OCR_REGIONS.LOCATION.X,
        Constants.OCR_REGIONS.LOCATION.Y,
        Constants.OCR_REGIONS.LOCATION.X + Constants.OCR_REGIONS.LOCATION.WIDTH,
        Constants.OCR_REGIONS.LOCATION.Y + Constants.OCR_REGIONS.LOCATION.HEIGHT
      );

      // 使用Utils.easyOCROne进行识别
      var location = await Utils.easyOCROne(Constants.OCR_REGIONS.LOCATION);

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
  checkDetailPageEntered: async function() {
    try {
      // 尝试3次OCR识别
      for (var i = 0; i < 3; i++) {
        // 使用Utils.easyOCR进行识别
        var results = await Utils.easyOCR(Constants.OCR_REGIONS.DETAIL_COUNTRY);

        if (results.count > 0) {
          // 检查OCR结果
          for (var j = 0; j < results.count; j++) {
            var text = results[j].text.trim();

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
              log.info("检测到其他地区委托: {text}", text);
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
  recognizeCommissions: async function(supportedCommissions) {
    try {
      log.info("开始执行委托识别");

      // 初始化当前委托位置变量
      var currentCommissionPosition = null;

      // 步骤1: 识别前3个委托（索引0-2）
      log.info("步骤1: 使用识别前3个委托");

      var allCommissions = [];

      // 先识别前3个区域（索引0-2）
      for (var regionIndex = 0; regionIndex < 3; regionIndex++) {
        var region = Constants.OCR_REGIONS.Main_Dev[regionIndex];

        log.info(
          "识别第{index}个委托区域 ({x}, {y}) ({width}, {height})",
          regionIndex + 1,
          region.X,
          region.Y,
          region.X + region.WIDTH,
          region.Y + region.HEIGHT
        );

        try {
          var results = await Utils.easyOCR(region);
          log.info(
            "第{index}个区域OCR识别结果数量: {count}",
            regionIndex + 1,
            results.count
          );

          // 处理识别结果，取第一个有效结果
          for (var i = 0; i < results.count; i++) {
            try {
              var result = results[i];
              var text = Utils.cleanText(result.text);
              if (text && text.length >= Constants.MIN_TEXT_LENGTH) {
                log.info('第{index}个委托: "{text}"', regionIndex + 1, text);

                // 检查委托类型
                var isFightCommission = supportedCommissions.fight.includes(text);
                var isTalkCommission = supportedCommissions.talk.includes(text);
                var isSupported = isFightCommission || isTalkCommission;
                var commissionType = isFightCommission
                  ? Constants.COMMISSION_TYPE.FIGHT
                  : isTalkCommission
                  ? Constants.COMMISSION_TYPE.TALK
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
      for (var i = 0; i < Math.min(3, allCommissions.length); i++) {
        var commission = allCommissions[i];

        try {
          // 使用图像识别检测完成状态
          var status = await CommissionBasic.detectCommissionStatusByImage(i);

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
          var detailButton = Constants.COMMISSION_DETAIL_BUTTONS[commission.id - 1];
          log.info(
            "点击委托详情按钮 ({x}, {y})",
            detailButton.x,
            detailButton.y
          );
          click(detailButton.x, detailButton.y);
          await sleep(700);

          // 检测委托国家
          var detailStatus = await CommissionRecognition.checkDetailPageEntered();
          log.info("委托国家: {status}", detailStatus);
          commission.country = detailStatus;
          var location = await CommissionRecognition.recognizeCommissionLocation();
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
      var region = Constants.OCR_REGIONS.Main_Dev[3];
      var fourthCommission = null;

      log.info(
        "识别第4个委托区域 ({x}, {y}) ({width}, {height})",
        region.X,
        region.Y,
        region.X + region.WIDTH,
        region.Y + region.HEIGHT
      );

      try {
        var results = await Utils.easyOCR(region);
        log.info("第4个区域OCR识别结果数量: {count}", results.count);

        // 处理识别结果，取第一个有效结果
        for (var i = 0; i < results.count; i++) {
          try {
            var result = results[i];
            var text = Utils.cleanText(result.text);
            if (text && text.length >= Constants.MIN_TEXT_LENGTH) {
              log.info('第4个委托: "{text}"', text);

              // 检查委托类型
              var isFightCommission = supportedCommissions.fight.includes(text);
              var isTalkCommission = supportedCommissions.talk.includes(text);
              var isSupported = isFightCommission || isTalkCommission;
              var commissionType = isFightCommission
                ? Constants.COMMISSION_TYPE.FIGHT
                : isTalkCommission
                ? Constants.COMMISSION_TYPE.TALK
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
          var status = await CommissionBasic.detectCommissionStatusByImage(3); // 第4个委托索引为3

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
            var detailButton = Constants.COMMISSION_DETAIL_BUTTONS[3]; // 第4个按钮索引为3
            log.info(
              "点击委托详情按钮 ({x}, {y})",
              detailButton.x,
              detailButton.y
            );
            click(detailButton.x, detailButton.y);
            await sleep(700);

            // 检测是否成功进入详情界面并获取委托国家
            var detailStatus = await CommissionRecognition.checkDetailPageEntered();
            log.info("委托国家: {status}", detailStatus);
            fourthCommission.country = detailStatus;

            // 识别委托地点
            var location = await CommissionRecognition.recognizeCommissionLocation();
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
      for (var i = 0; i < allCommissions.length; i++) {
        var commission = allCommissions[i];
        var supportStatus = commission.supported ? "✅ 支持" : "❌ 不支持";
        var typeInfo = commission.type ? "[" + commission.type + "]" : "";
        var locationInfo = commission.location ? "(" + commission.location + ")" : "";
        var countryInfo = commission.country ? "{" + commission.country + "}" : "";
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
};