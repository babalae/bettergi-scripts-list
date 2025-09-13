// 等待步骤处理器
(function() {
  StepProcessorLoader.register("等待", async function(step, context) {
    try {
      var waitTime = 1000; // 默认等待1秒
      
      // 处理等待时间参数
      if (typeof step.data === "number") {
        waitTime = step.data;
      } else if (typeof step.data === "object" && step.data.time) {
        waitTime = step.data.time;
      } else if (typeof step.data === "string") {
        // 尝试解析字符串为数字
        var parsedTime = parseInt(step.data);
        if (!isNaN(parsedTime)) {
          waitTime = parsedTime;
        }
      }
      
      log.info("等待 {time}ms", waitTime);
      await sleep(waitTime);
      
    } catch (error) {
      log.error("执行等待步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "等待",
  "data": 3000,  // 数字格式: 等待时间(毫秒)
  "note": "等待3秒"
}

或者字符串格式:
{
  "type": "等待", 
  "data": "3000",  // 字符串格式: 等待时间(毫秒)
  "note": "等待指定时间"
}

或者对象格式:
{
  "type": "等待",
  "data": {
    "time": 3000  // 等待时间(毫秒)
  },
  "note": "等待指定时间"
}
*/