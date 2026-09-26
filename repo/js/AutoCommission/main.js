// 原神每日委托自动执行脚本 - 模块化主文件
// BGI兼容的模块化架构实现

// === 模块加载区域（顶层执行，BGI要求） ===
eval(file.readTextSync("constants.js"));
eval(file.readTextSync("lib/utils.js"));
eval(file.readTextSync("lib/ui.js"));
eval(file.readTextSync("lib/core.js"));
eval(file.readTextSync("lib/execute.js"));
eval(file.readTextSync("lib/dialog-processor.js"));
eval(file.readTextSync("lib/commission-basic.js"));
eval(file.readTextSync("lib/commission-recognition.js"));
eval(file.readTextSync("lib/commission-data.js"));
eval(file.readTextSync("lib/step-processor-loader.js"));
eval(file.readTextSync("lib/checkVersion.js"));

// === BGI标准脚本入口：匿名立即执行异步函数（必须是文件的最后一个表达式） ===
// 测试用代码
const test = async () => {
  log.info("=== 开始测试执行脚本 ===");
  try {
    // 读取并解析 testScript/process.json 文件
    const testScriptPath = "testScript/process.json";
    const processContent = await file.readText(testScriptPath);
    const processSteps = JSON.parse(processContent);
    
    log.info("成功加载测试脚本文件: {path}", testScriptPath);
    log.info("测试步骤数量: {count}", processSteps.length);
    
    // 创建执行上下文
    const context = {
      commissionName: "测试委托",
      location: "测试位置", 
      processSteps: processSteps,
      currentIndex: 0,
      isInMainUI: UI.UIUtils.isInMainUI,
      priorityOptions: [],
      npcWhiteList: []
    };
    
    // 执行测试流程中的每个步骤
    for (let i = 0; i < processSteps.length; i++) {
      const step = processSteps[i];
      log.info("执行测试步骤 {step}: {type}", i + 1, step.type || step);
      
      context.currentIndex = i;
      
      // 处理步骤配置
      const stepConfig = Execute.processStepConfiguration(
        step,
        context.priorityOptions,
        context.npcWhiteList
      );
      context.priorityOptions = stepConfig.priorityOptions;
      context.npcWhiteList = stepConfig.npcWhiteList;
      
      // 执行步骤
      await Execute.processStep(step, context);
      
      // 步骤间等待
      await sleep(1000);
    }
    
    log.info("=== 测试执行脚本完成 ===");
    return true;
    
  } catch (error) {
    log.error("测试执行过程中发生错误: {error}", error.message);
    return false;
  }
};

(async function () {
  try {
    // 检查更新
    await printVersion()

    // 加载步骤处理器
    log.info("正在加载步骤处理器...");
    StepProcessorLoader.loadStepProcessors();

    // 执行主要流程
    var mainStartTime = new Date();
    await Core.executeMainProcess();
    // await test();

    // 记录结束时间
    var endTime = new Date();
    var totalTime = Math.round((endTime - mainStartTime) / 1000);
    log.info("脚本执行完成，总耗时: {time} 秒", totalTime);

    log.info("模块化主文件加载完成");
  } catch (error) {
    log.error("脚本执行过程中发生错误: {error}", error.message);
    throw error;
  }
})();
