// 地图追踪步骤处理器
(function() {
  StepProcessorLoader.register("地图追踪", async function(step, context) {
    try {
      var fullPath = Constants.TALK_PROCESS_BASE_PATH + "/" + 
                    context.commissionName + "/" + 
                    context.location + "/" + 
                    (step.data || step);
      
      log.info("执行地图追踪: {path}", fullPath);
      
      try {
        await pathingScript.runFile(fullPath);
        log.info("地图追踪执行完成");
      } catch (error) {
        log.error("执行地图追踪时出错: {error}", error.message);
        throw error;
      }
      
    } catch (error) {
      log.error("执行地图追踪步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "地图追踪",
  "data": "路径文件名.json",  // 必需: 要执行的路径追踪文件名
  "note": "执行路径追踪导航"
}
注意: 路径文件会自动拼接为 assets/process/委托名称/地点/路径文件名
*/