// 对话步骤处理器
(function() {
  StepProcessorLoader.register("对话", async function(step, context) {
    try {
      log.info("执行对话步骤");
      
      // 从step.data中获取配置，如果没有则使用默认值
      var skipCount = 5;
      var priorityOptions = [];
      var npcWhiteList = [];
      
      if (step.data && typeof step.data === "object") {
        skipCount = step.data.skipCount || 5;
        priorityOptions = step.data.priorityOptions || [];
        npcWhiteList = step.data.npcWhiteList || [];
      } else if (typeof step.data === "number") {
        // 兼容旧版本，如果data是数字，则视为skipCount
        skipCount = step.data;
      }
      
      if (priorityOptions.length > 0) {
        log.info("使用自定义优先选项: " + priorityOptions.join(", "));
      }
      
      if (npcWhiteList.length > 0) {
        log.info("使用自定义NPC白名单: " + npcWhiteList.join(", "));
      }
      
      log.info("步骤说明: " + (step.note || "执行对话步骤"));
      
      // 执行优化的自动对话
      await DialogProcessor.executeOptimizedAutoTalk(
        priorityOptions,
        npcWhiteList,
        context.isInMainUI
      );
      
    } catch (error) {
      log.error("执行对话步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "对话",
  "data": 5,  // 数字格式: 跳过对话次数(兼容旧版本)
  "note": "执行对话步骤"
}

或者对象格式:
{
  "type": "对话",
  "data": {
    "skipCount": 5,                    // 可选: 跳过对话次数,默认5
    "priorityOptions": ["选项1", "选项2"], // 可选: 优先对话选项
    "npcWhiteList": ["NPC1", "NPC2"]   // 可选: NPC白名单
  },
  "note": "执行优化的自动对话"
}
*/