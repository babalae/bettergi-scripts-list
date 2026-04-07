// 原神每日委托自动执行脚本 - 对话处理器模块
var DialogProcessor = {
  // 执行优化的自动对话
  executeOptimizedAutoTalk: async function (
    customPriorityOptions,
    customNpcWhiteList,
    isInMainUI
  ) {
    customPriorityOptions = customPriorityOptions || null;
    customNpcWhiteList = customNpcWhiteList || null;
    var effectivePriorityOptions = customPriorityOptions || [];
    var effectiveNpcWhiteList = customNpcWhiteList || [];

    // 初始化
    keyPress("V");

    // 从委托描述中提取任务相关的人名存为列表
    extractedName = [];
    // 委托描述的OCR识别区域
    var nameRegion = {X: 75, Y: 240, WIDTH: 225, HEIGHT: 60};
    var nameResults = await Utils.easyOCR(nameRegion);
    // 尝试提取任务人名
    for (var i = 0; i < nameResults.count; i++) {
      var text = nameResults[i].text;
      log.info("任务区域识别文本: {text}", text);

      // 尝试提取任务人名
      var name = Utils.extractName(text);
      if (name) {
        extractedName = name;
        log.info("提取到人名: {name}", extractedName);
        break;
      }
    }

    // 交互选项区域OCR识别
    var dialogRegion = { X: 1150, Y: 300, WIDTH: 350, HEIGHT: 400 };
    // 对话选项的ICON识别区域
    var talkIconRegion = { X: 1260, Y: 300, WIDTH: 90, HEIGHT: 550 };
    nameResults = await Utils.easyOCR(dialogRegion);
    var clickedWhitelistNPC = false;
    var clickedExtractedName = false;

    // 处理人名区域的OCR结果
    if (nameResults.count > 0) {
      log.info("人名区域识别到 {count} 个文本", nameResults.count);

      // 首先尝试点击白名单中的NPC
      for (var i = 0; i < nameResults.count; i++) {
        var text = nameResults[i].text;
        var res = nameResults[i];
        log.info(
          "人名区域识别到{text}:位置({x},{y},{h},{w})",
          res.text,
          res.x,
          res.y,
          res.width,
          res.Height
        );
        // 检查是否包含白名单中的NPC名称
        for (var j = 0; j < effectiveNpcWhiteList.length; j++) {
          if (text.includes(effectiveNpcWhiteList[j])) {
            log.info(
              "找到白名单NPC: {npc}，点击该NPC",
              effectiveNpcWhiteList[j]
            );
            keyDown("VK_MENU");
            await sleep(500);
            click(res.x, res.y);
            leftButtonClick();
            keyUp("VK_MENU");
            await sleep(200);
            if (!isInMainUI()) {
              clickedWhitelistNPC = true;
              break;
            }
          }
        }
      }

      // 如果没有点击白名单NPC，尝试点击包含提取到的人名的选项
      if (!clickedWhitelistNPC && extractedName) {
        for (var i = 0; i < nameResults.count; i++) {
          var text = nameResults[i].text;
          var res = nameResults[i];
          if (text.includes(extractedName)) {
            log.info("点击包含提取到任务人名的选项: {text}", text);
            keyDown("VK_MENU");
            await sleep(500);
            click(res.x, res.y);
            leftButtonClick();
            keyUp("VK_MENU");
            await sleep(200);
            if (!isInMainUI()) {
              clickedExtractedName = true;
              break;
            }
          }
        }
      }
    }

    // 如果没有找到NPC，使用默认触发
    if (!clickedWhitelistNPC && !clickedExtractedName) {
      log.info("未找到匹配的NPC，使用默认触发方式");
      keyPress("F"); // 默认触发剧情
      await sleep(100);
      keyPress("F"); // 默认触发剧情
      await sleep(400);
    }

    // 重复执行自动剧情，直到返回主界面
    var maxAttempts = 100; // 设置最大尝试次数，防止无限循环
    var attempts = 0;
    await sleep(1000);
    log.info("开始执行自动剧情");

    while (!isInMainUI() && attempts < maxAttempts) {
      attempts++;

      var startTime = new Date().getTime();

      // 1秒内按空格键跳过
      while (new Date().getTime() - startTime < 1000) {
        keyPress("VK_SPACE");
        await sleep(200);
      }

      if (isInMainUI()) {
        log.info("检测到已返回主界面，结束循环");
        break;
      }

      // 检查是否有匹配的优先选项
      var foundPriorityOption = false;

      // 获取对话区域截图并进行OCR识别
      var dialogOptionsRegion = {
        X: 1250,
        Y: 250,
        WIDTH: 550,
        HEIGHT: 600,
      };
      var ocrResults = await Utils.easyOCR(dialogOptionsRegion);
      if (ocrResults.count > 0) {
        log.info("识别到 {count} 个选项", ocrResults.count);

        for (var i = 0; i < ocrResults.count; i++) {
          var ocrText = ocrResults[i].text;

          // 检查是否在优先选项列表中
          for (var j = 0; j < effectivePriorityOptions.length; j++) {
            if (ocrText.includes(effectivePriorityOptions[j])) {
              log.info(
                "找到优先选项: {option}，点击该选项",
                effectivePriorityOptions[j]
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
        if (!foundPriorityOption && !isInMainUI()) {
          let exitList = await Utils.easyTemplateMatch(
            Constants.TALK_EXIT_IMAGE_PATH,
            talkIconRegion,
            true
          );
          let iconList = await Utils.easyTemplateMatch(
            Constants.TALK_ICON_IMAGE_PATH,
            talkIconRegion
          );
          let clickXY = null;
          //正常应该只识别到一个退出选项
          if (exitList.count === 1) {
            log.info("发现一个退出对话选项");
            clickXY = [exitList[0].x, exitList[0].y];

            //点击最下边的气泡选项
          } else if (iconList.count > 0) {
            log.info(
              `发现{count}个气泡对话选项，点击最后一个气泡选项`,
              iconList.count
            );
            iconList = [...iconList];
            iconList.sort((a, b) => b.y - a.y);
            clickXY = [iconList[0].x, iconList[0].y];

            // 有对话选项时，点击最后一个选项
          } else if (ocrResults.count > 0) {
            log.info("指定类型的对话选项不符合数量条件,默认点击最后一个选项");
            //C#的List不能用-1索引，^1不确定在js中能否使用，所以用count-1
            clickXY = [
              ocrResults[ocrResults.count - 1].x,
              ocrResults[ocrResults.count - 1].y
            ];

          } else {
            log.warn("指定类型的对话选项不符合数量条件，不进行操作");
            log.warn(
              `退出图标：{exit}个，气泡图标：{icon}个，对话选项：{ocrResults}个`,
              exitList.count,
              iconList.count,
              ocrResults.count
            );
          }

          //点击对话选项
          if (clickXY) {
            keyDown("VK_MENU");
            await sleep(300);
            click(...clickXY);
            leftButtonClick();
            keyUp("VK_MENU");
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
      await sleep(500) //等主界面加载完毕，防止吞操作
      keyPress("V");
      await sleep(2000) //等待委托任务描述加载完毕
    } else {
      log.warn(
        "已达到最大尝试次数 {attempts}，但未检测到返回主界面",
        maxAttempts
      );
    }
  },
};
