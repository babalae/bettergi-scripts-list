// 传送步骤处理器
(function() {
  StepProcessorLoader.register("tp", async function(step, context) {
    try {
      log.info("执行传送操作");
      
      if (!step.data || !Array.isArray(step.data) || step.data.length < 2) {
        log.warn("传送步骤缺少有效的坐标数据");
        return;
      }
      
      var x = step.data[0];
      var y = step.data[1];
      var force = step.data.length > 2 ? step.data[2] : false;
      
      log.info("传送到坐标: ({x}, {y}), 强制: {force}", x, y, force);
      await genshin.tp(x, y, force);
      log.info("传送完成");
      
      // 传送后等待稳定
      await sleep(2000);
      
    } catch (error) {
      log.error("执行传送步骤时出错: {error}", error.message);
      throw error;
    }
  });
  
  // 同时注册"传送"别名
  StepProcessorLoader.register("传送", async function(step, context) {
    return StepProcessorLoader.processors["tp"](step, context);
  });
})();

/*
JSON使用示例:
{
  "type": "tp",  // 或者 "传送"
  "data": [100, 200],      // 必需数组: [X坐标, Y坐标]
  "note": "传送到指定坐标"
}

或者带强制传送参数:
{
  "type": "传送",
  "data": [100, 200, true],  // 第三个参数为强制传送标志
  "note": "强制传送到坐标"
}
*/