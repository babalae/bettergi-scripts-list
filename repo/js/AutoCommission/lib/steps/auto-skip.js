// 原神每日委托自动执行脚本 - AutoSkip步骤处理器
// 共同的AutoSkip逻辑函数
var executeAutoSkipLogic = async function (stepData, stepName) {
  try {
    log.info("执行{stepName}步骤", stepName);

    // 从stepData中提取配置参数
    var customPriorityOptions = stepData.priorityOptions || [];
    var customBlacklist = stepData.blacklist || [];
    var customPriorityIcons = stepData.priorityIcons || [];
    var customNpcWhiteList = stepData.npcWhiteList || [];

    var StoryRo = RecognitionObject.TemplateMatch(
      file.ReadImageMatSync("Data/RecognitionObject/disabled_ui.png"),
      265,
      37,
      30,
      22
    );

    // 识别图像函数
    var recognizeImage = async function (recognitionObject) {
      try {
        // 尝试识别图像
        let captureRegion = captureGameRegion();
        var imageResult = captureRegion.find(recognitionObject);
        captureRegion.dispose();
        if (
          imageResult &&
          imageResult.x !== 0 &&
          imageResult.y !== 0 &&
          imageResult.width !== 0 &&
          imageResult.height !== 0
        ) {
          return { success: true, x: imageResult.x, y: imageResult.y };
        }
      } catch (error) {
        log.error("识别图像时发生异常: {error}", error.message);
      }
      return { success: false };
    };

    var AutoSkip = async function (
      customPriorityOptions,
      customBlacklist,
      customPriorityIcons,
      customNpcWhiteList
    ) {
      customPriorityOptions = customPriorityOptions || [];
      customBlacklist = customBlacklist || [];
      customPriorityIcons = customPriorityIcons || [];
      customNpcWhiteList = customNpcWhiteList || [];

      // 默认配置
      var defaultPriorityOptions = [];
      var defaultBlacklist = [];
      var defaultPriorityIcons = [];

      // 将npcWhiteList添加到priorityOptions的前面
      var mergedPriorityOptions = customNpcWhiteList.concat(
        customPriorityOptions
      );

      // 合并用户自定义配置和默认配置
      var effectivePriorityOptions = defaultPriorityOptions.concat(
        mergedPriorityOptions
      );
      var effectiveBlacklist = defaultBlacklist.concat(customBlacklist);
      var effectivePriorityIcons =
        customPriorityIcons.length > 0
          ? customPriorityIcons
          : defaultPriorityIcons;

      // 重复执行自动剧情，直到返回主界面
      var maxAttempts = 1200; // 设置最大尝试次数，防止无限循环
      var attempts = 0;
      var SkipTime = 100; // 跳过间隔时间（毫秒）
      var storyIconDetectedOnce = false; // 首次出现机制标志

      await sleep(1000);

      // 预加载优先图标识别对象
      var priorityIconROs = [];
      for (var k = 0; k < effectivePriorityIcons.length; k++) {
        var iconName = effectivePriorityIcons[k];
        try {
          var iconPath = "Data/RecognitionObject/" + iconName;
          var iconMat = file.ReadImageMatSync(iconPath);
          if (iconMat) {
            var ro = RecognitionObject.TemplateMatch(iconMat);
            priorityIconROs.push(ro);
          }
        } catch (error) {
          log.warn(
            "无法加载优先图标 {iconName}: {error}",
            iconName,
            error.message
          );
        }
      }

      while (attempts < maxAttempts) {
        var StoryResult = await recognizeImage(StoryRo);
        
        // 首次出现机制：如果图标曾经出现过，就必须通过这个判断
        if (storyIconDetectedOnce) {
          if (!StoryResult.success) {
            log.info("剧情图标消失，结束AutoSkip");
            return;
          }
        } else {
          // 如果图标第一次被检测到，记录首次出现
          if (StoryResult.success) {
            storyIconDetectedOnce = true;
            log.info("检测到剧情图标首次出现，启用图标检测机制");
          }
          // 如果图标从未出现过，继续执行不进行判断
        }
        
        attempts++;

        var startTime = new Date().getTime();

        // 1秒内按空格键跳过
        while (new Date().getTime() - startTime < 1000) {
          keyPress("VK_SPACE");
          await sleep(SkipTime);
        }

        // 1. 查找F图标
        var fIconFound = false;
        var fIconY = 0;

        // F图标检测逻辑
        var fIconRO = RecognitionObject.TemplateMatch(
          file.ReadImageMatSync("Data/RecognitionObject/F.png"),
          1207,
          0,
          43,
          850
        );
        var fIconResult = await recognizeImage(fIconRO);
        log.info(fIconResult.success)

        if (fIconResult.success) {
          fIconFound = true;
          fIconY = fIconResult.y;
        }

        // 2. 查找优先图标
        var priorityIconClicked = false;
        if (fIconFound) {
          for (var m = 0; m < priorityIconROs.length; m++) {
            var iconRO = priorityIconROs[m];
            var iconResult = await recognizeImage(iconRO);
            if (iconResult.success) {
              log.info("找到优先图标点击");
              click(iconResult.x, iconResult.y);
              priorityIconClicked = true;
              break;
            }
          }
        }

        // 3. 如果没有找到优先图标，进行OCR识别
        if (fIconFound && !priorityIconClicked) {
          // 定义OCR区域：1250, F图标的y+10 到 1800,850
          var ocrStartY = fIconY + 10;
          var ocrHeight = 850 - ocrStartY;

          if (ocrHeight > 0) {
            var captureRegion = captureGameRegion();
            var dialogArea = captureRegion.DeriveCrop(
              1250,
              ocrStartY,
              550,
              ocrHeight
            );

            // 创建OCR识别对象并识别文本
            var ocrRo = RecognitionObject.Ocr(
              0,
              0,
              dialogArea.width,
              dialogArea.height
            );
            var ocrResults = dialogArea.FindMulti(ocrRo);
            captureRegion.dispose();
            dialogArea.dispose();

            if (ocrResults && ocrResults.count > 0) {
              var foundValidOption = false;
              var firstNonBlacklistOption = null;

              // 首先查找优先选项
              for (var i = 0; i < ocrResults.count; i++) {
                var ocrText = ocrResults[i].text;
                log.debug("选项 {index}: {text}", i + 1, ocrText);

                // 检查是否在优先选项列表中
                for (var j = 0; j < effectivePriorityOptions.length; j++) {
                  var priorityOption = effectivePriorityOptions[j];
                  if (ocrText.includes(priorityOption)) {
                    log.info(
                      "找到优先选项: {option}，点击该选项",
                      priorityOption
                    );
                    ocrResults[i].click();
                    foundValidOption = true;
                    break;
                  }
                }
                if (foundValidOption) break;

                // 记录第一个非黑名单选项
                if (!firstNonBlacklistOption) {
                  var isBlacklisted = false;
                  for (var k = 0; k < effectiveBlacklist.length; k++) {
                    var blackOption = effectiveBlacklist[k];
                    if (ocrText.includes(blackOption)) {
                      isBlacklisted = true;
                      break;
                    }
                  }
                  if (!isBlacklisted) {
                    firstNonBlacklistOption = ocrResults[i];
                  }
                }
              }

              // 如果没有找到优先选项，但有非黑名单选项，点击第一个非黑名单选项
              if (!foundValidOption && firstNonBlacklistOption) {
                firstNonBlacklistOption.click();
                foundValidOption = true;
              }

              // 如果既没有优先选项也没有非黑名单选项，按F键
              if (!foundValidOption) {
                keyPress("F");
              }
            } else {
              keyPress("F");
            }
          }
        }
      }
    };

    // 执行AutoSkip功能
    await AutoSkip(
      customPriorityOptions,
      customBlacklist,
      customPriorityIcons,
      customNpcWhiteList
    );

    log.info("{stepName}步骤执行完成", stepName);
  } catch (error) {
    log.error("执行{stepName}步骤时出错: {error}", stepName, error.message);
    throw error;
  }
};

// 注册"AutoSkip"步骤处理器
StepProcessorLoader.register("AutoSkip", async function (stepData, context) {
  await executeAutoSkipLogic(stepData, "AutoSkip");
});

// 注册"对话"步骤处理器
StepProcessorLoader.register("对话", async function (stepData, context) {
  await executeAutoSkipLogic(stepData, "对话");
});

/*
使用示例 - JSON格式配置：

1. 基本用法（使用默认配置）：
{
  "type": "AutoSkip"
}

2. 带优先选项的用法：
{
  "type": "AutoSkip",
  "priorityOptions": ["帮助", "同意", "确认"],
  "note": "优先点击包含'帮助'、'同意'、'确认'的选项"
}

3. 带NPC白名单的用法：
{
  "type": "AutoSkip",
  "npcWhiteList": ["派蒙", "旅行者", "温迪"],
  "note": "最优先点击包含指定NPC名称的选项"
}

4. 带黑名单选项的用法：
{
  "type": "AutoSkip",
  "blacklist": ["拒绝", "离开", "结束对话"],
  "note": "避免点击包含'拒绝'、'离开'、'结束对话'的选项"
}

5. 带优先图标的用法：
{
  "type": "AutoSkip",
  "priorityIcons": ["icon_quest.png", "icon_important.png"],
  "note": "优先点击指定图标"
}

6. 完整配置示例：
{
  "type": "AutoSkip",
  "npcWhiteList": ["委托发布者", "任务NPC"],
  "priorityOptions": ["帮助", "委托", "任务"],
  "blacklist": ["拒绝", "离开"],
  "priorityIcons": ["icon_quest.png"],
  "note": "完整配置：NPC白名单优先级最高，然后是任务相关选项，避免拒绝类选项"
}

7. 实际场景示例：
{
  "type": "AutoSkip",
  "npcWhiteList": ["凯瑟琳", "委托发布人"],
  "priorityOptions": ["接受", "好的", "没问题"],
  "blacklist": ["算了", "不了", "再见"],
  "note": "委托对话：最优先选择NPC相关选项，然后是接受委托选项，避免拒绝选项"
}

参数说明：
- npcWhiteList: NPC白名单关键词数组，具有最高优先级，会被添加到priorityOptions的前面
- priorityOptions: 优先选项关键词数组，会优先点击包含这些关键词的对话选项
- blacklist: 黑名单关键词数组，会避免点击包含这些关键词的选项
- priorityIcons: 优先图标文件名数组，图标文件需放在Data/RecognitionObject/目录下
- note: 步骤说明（可选），用于注释当前步骤的作用

优先级顺序：
1. NPC白名单选项（npcWhiteList）- 最高优先级
2. 普通优先选项（priorityOptions）
3. 非黑名单选项
4. 按F键（默认操作）

功能说明：
- 自动识别剧情对话界面（通过disabled_ui.png图标）
- 连续按空格键跳过剧情文本
- 检测F键提示图标的位置
- 优先点击指定的图标（如果配置了priorityIcons）
- 使用OCR识别对话选项文本
- 按上述优先级顺序选择对话选项
- 循环执行直到剧情结束
*/
