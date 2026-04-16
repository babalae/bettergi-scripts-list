// 自动任务步骤处理器
(function() {
  StepProcessorLoader.register("自动任务", async function(step, context) {
    try {
      var action = step.data && step.data.action;
      var taskType = (step.data && step.data.taskType) || "default";
      var config = (step.data && step.data.config) || {};

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
  });
})();

/*
JSON使用示例:
{
  "type": "自动任务",
  "data": {
    "action": "enable",    // 必需: "enable"启用任务, "disable"禁用任务
    "taskType": "default", // 启用时必需: 任务类型
    "config": {}           // 可选: 任务配置
  },
  "note": "启用/禁用自动任务"
}
*/