// 等待主界面步骤处理器
(function() {
  StepProcessorLoader.register("等待返回主界面", async function(step, context) {
    try {
      log.info("等待返回主界面");
      
      var maxWaitTime = 120000; // 默认最大等待120秒
      var checkInterval = 1000; // 检查间隔1秒
      
      // 处理等待时间配置
      if (step.data && typeof step.data === "object") {
        maxWaitTime = step.data.maxWaitTime || maxWaitTime;
        checkInterval = step.data.checkInterval || checkInterval;
      } else if (typeof step.data === "number") {
        maxWaitTime = step.data;
      }
      
      var startTime = Date.now();
      var isInMainUI = context.isInMainUI;
      
      for (var i = 0; i < Math.floor(maxWaitTime / checkInterval); i++) {
        if (isInMainUI()) {
          log.info("检测到已返回主界面，结束等待");
          return;
        }
        await sleep(checkInterval);
      }
      
      if (!isInMainUI()) {
        log.info("等待返回主界面超时，尝试继续执行后续步骤");
      }
      
    } catch (error) {
      log.error("执行等待主界面步骤时出错: {error}", error.message);
      throw error;
    }
  });
  
  // 同时注册"等待主界面"别名
  StepProcessorLoader.register("等待主界面", async function(step, context) {
    return StepProcessorLoader.processors["等待返回主界面"](step, context);
  });
})();

/*
JSON使用示例:
{
  "type": "等待返回主界面",  // 或者 "等待主界面"
  "data": 120000,  // 数字格式: 最大等待时间(毫秒),默认120000
  "note": "等待返回主界面"
}

或者对象格式:
{
  "type": "等待主界面",
  "data": {
    "maxWaitTime": 120000,   // 可选: 最大等待时间(毫秒),默认120000
    "checkInterval": 1000    // 可选: 检查间隔(毫秒),默认1000
  },
  "note": "等待返回主界面"
}
*/