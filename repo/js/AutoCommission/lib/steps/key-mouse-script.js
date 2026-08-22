// 键鼠脚本步骤处理器
(function () {
  StepProcessorLoader.register("键鼠脚本", async function (step, context) {
    try {
      log.info("执行键鼠脚本: {path}", step.data);

      var fullPath =
        Constants.TALK_PROCESS_BASE_PATH +
        "/" +
        context.commissionName +
        "/" +
        context.location +
        "/" +
        step.data;

      try {
        await keyMouseScript.runFile(fullPath);
        log.info("键鼠脚本执行完成");
      } catch (error) {
        log.error("执行键鼠脚本时出错: {error}", error.message);
        throw error;
      }
    } catch (error) {
      log.error("执行键鼠脚本步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "键鼠脚本",
  "data": "脚本文件名.json",  // 必需: 要执行的键鼠脚本文件名
  "note": "执行键鼠操作脚本"
}
注意: 脚本文件路径会自动拼接为 assets/process/委托名称/地点/脚本文件名
*/
