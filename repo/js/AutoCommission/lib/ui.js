// 原神每日委托自动执行脚本 - UI交互功能模块
var UI = {
  // 进入委托界面
  enterCommissionScreen: async function() {
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
      click(300, 350);
      log.debug("已进入委托界面");
      return true;
    } catch (error) {
      log.error("进入委托界面失败: {error}", error);
      return false;
    }
  },

  // 自动执行划页操作 - 新的滑动方法
  pageScroll: async function(scrollCount) {
    try {
      var clickX = 950; // 假设点击的起始坐标
      var clickY = 600;
      var totalDistance = 200; // 假设每次滑动的总距离
      var stepDistance = 10; // 每步移动的距离

      for (var i = 0; i < scrollCount; ++i) {
        log.info("开始第 {num} 次滑动", i + 1);

        // 如果点击坐标为 (0, 0)，则跳过点击
        if (clickX !== 0 || clickY !== 0) {
          moveMouseTo(clickX, clickY); // 移动到指定坐标
          await sleep(100);
        }

        // 按住鼠标左键
        leftButtonDown();

        // 将鼠标移动到目标位置，模拟更自然的拖动操作
        var steps = totalDistance / stepDistance; // 分成若干步移动

        for (var j = 0; j < steps; j++) {
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
      log.error("执行滑动操作时发生错误：{error}", error.message);
      return false;
    }
  },

  // 角色选择界面滚动页面函数
  scrollPage: async function(totalDistance, stepDistance, delayMs) {
    stepDistance = stepDistance || 10;
    delayMs = delayMs || 5;
    
    try {
      moveMouseTo(400, 750);
      await sleep(50);
      leftButtonDown();
      var steps = Math.ceil(totalDistance / stepDistance);
      for (var j = 0; j < steps; j++) {
        var remainingDistance = totalDistance - j * stepDistance;
        var moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        moveMouseBy(0, -moveDistance);
        await sleep(delayMs);
      }
      await sleep(700);
      leftButtonUp();
      await sleep(100);
      return true;
    } catch (error) {
      log.error("角色选择界面滚动操作时发生错误：{error}", error.message);
      return false;
    }
  },

  // UI工具模块 - 处理UI检测和文本提取等工具函数
  UIUtils: {
    // 检测是否在主界面
    isInMainUI: function() {
      var paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("Data/RecognitionObject/paimon_menu.png"),
        0,
        0,
        genshin.width / 3.0,
        genshin.width / 5.0
      );

      var captureRegion = captureGameRegion();
      var res = captureRegion.Find(paimonMenuRo);
      captureRegion.dispose();
      return !res.isEmpty();
    },

    isStoreUI: function() {
      var paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("Data/RecognitionObject/商店.png"),
        0,
        0,
        genshin.width / 3.0,
        genshin.width / 5.0
      );

      var captureRegion = captureGameRegion();
      var res = captureRegion.Find(paimonMenuRo);
      captureRegion.dispose();
      return !res.isEmpty();
    },

  }
};