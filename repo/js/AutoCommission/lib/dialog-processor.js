// 原神每日委托自动执行脚本 - 对话处理器模块
var DialogProcessor = {
  // 执行优化的自动对话
  executeOptimizedAutoTalk: async function (
    extractedName,
    skipCount,
    customPriorityOptions,
    customNpcWhiteList,
    isInMainUI
  ) {
    extractedName = extractedName || null;
    skipCount = skipCount || 5;
    customPriorityOptions = customPriorityOptions || null;
    customNpcWhiteList = customNpcWhiteList || null;

    // 使用传入的参数，不再加载默认配置
    var effectivePriorityOptions = customPriorityOptions || [];
    var effectiveNpcWhiteList = customNpcWhiteList || [];

    // 初始化
    keyPress("V");

    // 初始触发剧情 - 识别人名并点击
    extractedName = [];
    // 人名区域OCR识别
    var nameRegion = { X: 75, Y: 240, WIDTH: 225, HEIGHT: 60 };
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

    // 对话选项区域OCR识别
    var dialogRegion = { X: 1150, Y: 300, WIDTH: 350, HEIGHT: 400 };
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
            log.info("找到白名单NPC: {npc}，点击该NPC", effectiveNpcWhiteList[j]);
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
    var repetition = 0;
    var oldcount = 1;
    await sleep(1000);
    log.info("开始执行自动剧情");

    while (!isInMainUI() && attempts < maxAttempts) {
      attempts++;

      // 正常跳过对话
      //await genshin.chooseTalkOption("纳西妲美貌举世无双", skipCount, false); 不好用

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

      //keyPress("VK_ESCAPE");//关弹窗

      // 每skipCount次跳过后，进行OCR识别
      if (true) {
        // 检查是否有匹配的优先选项
        var foundPriorityOption = false;

        // 获取对话区域截图并进行OCR识别
        var dialogOptionsRegion = {
          X: 1250,
          Y: 450,
          WIDTH: 550,
          HEIGHT: 400,
        };
        var ocrResults = await Utils.easyOCR(dialogOptionsRegion);
        if (ocrResults.count > 0) {
          log.info("识别到 {count} 个选项", ocrResults.count);

          if (ocrResults.count === oldcount) {
            repetition++;
          } else {
            repetition = 0;
          }
          oldcount = ocrResults.count;
          if (repetition >= 5) {
            log.info("连续5次选项数量一样，执行F跳过");
            keyPress("F");
            repetition = 0;
          }
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
          if (!foundPriorityOption) {
            keyPress("F");
            await sleep(100);
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
      log.warn("已达到最大尝试次数 {attempts}，但未检测到返回主界面", maxAttempts);
    }
  },
};