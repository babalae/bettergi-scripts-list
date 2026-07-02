// 按键步骤处理器
(function () {
  StepProcessorLoader.register("按键", async function (step, context) {
    try {
    } catch (error) {
      log.error("执行按键步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "",
  "data": "",
  "note": ""
}
*/
