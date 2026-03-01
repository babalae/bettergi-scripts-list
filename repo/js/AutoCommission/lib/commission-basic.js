// 原神每日委托自动执行脚本 - 委托功能基础模块
var CommissionBasic = {
  // 跳过的委托列表
  skipCommissionsList: [],

  // 初始化跳过委托列表
  initSkipCommissionsList: function() {
    var settings = Utils.getSetting();
    CommissionBasic.skipCommissionsList = Utils.parseSkipCommissions(settings.skipCommissions);
    if (CommissionBasic.skipCommissionsList.length > 0) {
      log.info(
        "配置的跳过委托列表: {list}",
        CommissionBasic.skipCommissionsList.join(", ")
      );
    }
  },

  // 检查委托状态（通过委托名称查找位置后检测）
  iscompleted: async function(completedCount) {
    try {
      // 记录已完成的委托数量
      log.info("已完成委托数量: {completedCount}", completedCount);

      var enterSuccess = await UI.enterCommissionScreen();
      if (!enterSuccess) {
        log.error("无法进入委托界面");
        return false;
      }
      await sleep(900);
      if (completedCount === 0) {
        await UI.pageScroll(1);
        var status = await CommissionBasic.detectCommissionStatusByImage(3);
        if (status === "completed") {
          return true;
        } else {
          return false;
        }
      } else {
        var status = await CommissionBasic.detectCommissionStatusByImage(
          3 - completedCount
        );
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

  // 获取委托的目标坐标（从路径追踪文件中获取最后一个坐标）
  getCommissionTargetPosition: async function(scriptPath) {
    try {
      var scriptContent = await file.readText(scriptPath);
      var pathData = JSON.parse(scriptContent);

      if (!pathData.positions || pathData.positions.length === 0) {
        log.warn("路径追踪文件 {path} 中没有有效的坐标数据", scriptPath);
        return null;
      }

      var lastPosition = pathData.positions[pathData.positions.length - 1];
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

  // 检测委托完成状态（使用图像识别）
  detectCommissionStatusByImage: async function(buttonIndex) {
    try {
      var button = Constants.COMMISSION_DETAIL_BUTTONS[buttonIndex];
      if (!button) {
        log.error("无效的按钮索引: {index}", buttonIndex);
        return "unknown";
      }

      log.debug("检测委托{id}的完成状态（图像识别）", button.id);
      // 截图
      var captureRegion = captureGameRegion();

      // 检测区域：按钮位置左右各扩展更大范围
      var checkRegion = captureRegion.deriveCrop(
        button.checkX,
        button.y - 30, // 稍微向上扩展检测区域
        button.checkWidth,
        60 // 增加高度以确保捕获状态图标
      );

      // 加载完成和未完成的模板图像
      var completedTemplate, uncompletedTemplate;

      try {
        completedTemplate = file.ReadImageMatSync(Constants.COMPLETED_IMAGE_PATH);
        uncompletedTemplate = file.ReadImageMatSync(
          Constants.UNCOMPLETED_IMAGE_PATH
        );
      } catch (imageError) {
        log.error("加载模板图像失败: {error}", imageError);
        return "unknown";
      }

      // 创建识别对象，使用更灵活的参数
      var completedRo = RecognitionObject.TemplateMatch(
        completedTemplate,
        0,
        0,
        button.checkWidth,
        60
      );
      var uncompletedRo = RecognitionObject.TemplateMatch(
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
      var completedResult = checkRegion.find(completedRo);
      if (!completedResult.isEmpty()) {
        captureRegion.dispose();
        checkRegion.dispose();
        return "completed";
      }

      // 检测未完成状态
      var uncompletedResult = checkRegion.find(uncompletedRo);
      if (!uncompletedResult.isEmpty()) {
        captureRegion.dispose();
        checkRegion.dispose();
        return "uncompleted";
      }
      captureRegion.dispose();
      checkRegion.dispose();

      log.warn("委托{id}状态识别失败", button.id);
      return "unknown";
    } catch (error) {
      log.error("检测委托完成状态时出错: {error}", error.message);
      return "unknown";
    }
  }
};