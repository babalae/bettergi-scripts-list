// 自动战斗处理器
(function () {
  StepProcessorLoader.register("定时自动战斗", async function (step, context) {
    /**
  * 等待战斗结束（通过识别“team.png”模板）
  * @param {number} timeout - 超时时间（毫秒），默认30秒
  * @returns {Promise<boolean>} - 识别到战斗结束返回true，超时返回false
  */
    var waitFight = async function (timeout = 30000, intervals = 5000) {
      let team = null;        // 模板图像（Mat对象）
      let cap = null;         // 当前屏幕截图（Mat对象）
      let teamRO = null;      // 模板匹配识别对象

      try {
        team = file.readImageMatSync("Data/team.png");
        teamRO = RecognitionObject.TemplateMatch(team);
        teamRO.useMask = true; // 忽略绿色区域 (RGB: 0,255,0)

        const startTime = Date.now();

        // 循环检测直到超时
        while (Date.now() - startTime < timeout) {
          // 按下 L 键 打开队伍
          keyPress("l");
          await sleep(1000);

          // 截取当前游戏区域
          cap = captureGameRegion();

          // 查找模板
          if (cap.find(teamRO)) {
            log.info("识别到战斗结束");
            cap.dispose();
            // 取消 打开队伍
            keyPress("l");
            return true;
          }

          cap.dispose();
          log.info("未识别到战斗结束");
          await sleep(intervals);
        }

        // 超时未识别
        return false;

      } catch (e) {
        log.error(e);
      } finally {
        // 释放资源
        team?.Dispose();
        cap?.Dispose();
      }
    }
    try {
      var timeout = step.data && step.data.timeout;
      var intervals = step.data && step.data.intervals;

      let args = [];

      if (timeout) { args.push(timeout) };
      if (intervals) { args.push(intervals) };

      // 创建取消令牌
      let cts = new CancellationTokenSource();

      log.info("开始战斗");
      let fightTask = dispatcher.RunTask(new SoloTask("AutoFight"), cts);

      // 等待战斗结束或超时，动态传参，默认超时30秒，间隔10秒
      await waitFight(...args);

      // 超时或战斗结束，取消战斗任务
      cts.cancel();
      return true;

    } catch (error) {
      // 捕获并记录执行过程中的异常
      log.error("处理自动战斗（自定时长版）步骤时出错: {error}", error.message);
      return false;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "定时自动战斗",
  "data": {
    "timeout": 3000,      //可选参数，单位为毫秒，默认30秒
    "intervals": 1000     //可选参数，单位为毫秒，默认10秒 
  },
  "note": "开始自动战斗-自定时长版"
}
*/