// 按键步骤处理器
(function () {
  StepProcessorLoader.register("关闭商店界面", async function (step, context) {
    try {
      const isStoreUI = UI.UIUtils.isStoreUI;

      await sleep(500);
      if (isStoreUI) {
        keyPress("VK_ESCAPE");
      }
      await sleep(500);
    } catch (error) {
      log.error("执行按键步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "关闭商店界面",
  "note": "关闭商店界面(如果现在在商店页面)"
}
*/
