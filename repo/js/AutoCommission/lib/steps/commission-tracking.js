// 委托追踪步骤处理器
(function() {
  StepProcessorLoader.register("追踪委托", async function(step, context) {
    try {
      // 获取目标NPC名称和图标类型
      var targetNpc = "";
      var iconType = "bigmap";
      var autoTalk = false;
      
      if (typeof step.data === "string") {
        targetNpc = step.data;
      } else if (typeof step.data === "object") {
        if (step.data.npc) targetNpc = step.data.npc;
        if (step.data.iconType) iconType = step.data.iconType;
        if (step.data.autoTalk) autoTalk = step.data.autoTalk;
      }

      log.info(
        "执行追踪委托，目标NPC: {target}，图标类型: {type}",
        targetNpc,
        iconType
      );
      
      // 执行自动导航到对话位置
      await Execute.autoNavigateToTalk(targetNpc, iconType, autoTalk);
      log.info("追踪委托执行完成");
      
    } catch (error) {
      log.error("执行委托追踪步骤时出错: {error}", error.message);
      throw error;
    }
  });
  
  // 同时注册"委托追踪"别名
  StepProcessorLoader.register("委托追踪", async function(step, context) {
    return StepProcessorLoader.processors["追踪委托"](step, context);
  });
})();

/*
JSON使用示例:
{
  "type": "追踪委托",  // 或者 "委托追踪"
  "data": "NPC名称",   // 字符串格式: 目标NPC名称
  "note": "自动导航到目标NPC"
}

或者对象格式:
{
  "type": "追踪委托",
  "data": {
    "npc": "NPC名称",        // 必需: 目标NPC名称
    "iconType": "bigmap"     // 可选: 图标类型,默认"bigmap"
    "autoTalk": true         // 可选: 是否自动对话,默认false
  },
  "note": "追踪委托到指定NPC"
}
*/