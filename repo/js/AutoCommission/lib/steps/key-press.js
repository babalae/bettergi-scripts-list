// 按键步骤处理器
(function() {
  StepProcessorLoader.register("按键", async function(step, context) {
    try {
      if (!step.data) {
        log.warn("按键步骤缺少数据");
        return;
      }
      
      if (typeof step.data === "string") {
        log.info("执行按键: {key}", step.data);
        keyPress(step.data);
      } else if (typeof step.data === "object") {
        if (step.data.action === "down") {
          log.info("按下按键: {key}", step.data.key);
          keyDown(step.data.key);
        } else if (step.data.action === "up") {
          log.info("释放按键: {key}", step.data.key);
          keyUp(step.data.key);
        } else if (step.data.action === "press") {
          log.info("点击按键: {key}", step.data.key);
          keyPress(step.data.key);
        } else {
          log.info("执行按键: {key}", step.data.key);
          keyPress(step.data.key);
        }
      }
      
    } catch (error) {
      log.error("执行按键步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "按键",
  "data": "VK_SPACE",  // 字符串格式: 直接按键
  "note": "按下空格键"
}

或者对象格式:
{
  "type": "按键",
  "data": {
    "key": "VK_SPACE",     // 必需: 按键名称
    "action": "press"      // 可选: "press"点击, "down"按下, "up"释放
  },
  "note": "执行按键操作"
}
*/