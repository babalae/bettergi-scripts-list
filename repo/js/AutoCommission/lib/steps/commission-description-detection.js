// 委托描述检测步骤处理器
(function () {
  StepProcessorLoader.register("委托描述检测", async function (step, context) {
    try {
      log.info("执行委托描述检测");

      // 处理step.data，支持字符串和对象格式
      var targetDescription = "";
      var executeFile = step.run || "";
      var runType = step.data?.runType || "process";
      var useKeyword = step.data?.useKeyword || false;

      if (typeof step.data === "string") {
        targetDescription = step.data;
      } else if (typeof step.data === "object") {
        targetDescription = step.data.description || step.data.keyword || "";
        executeFile = step.data.executeFile || "";
      }

      if (!targetDescription || !executeFile) {
        log.error("描述文本 与 json文件 为必填项！");
        return;
      }

      log.info("委托描述检测: {description}", targetDescription);

      // 按v键打开任务界面
      keyPress("v");
      await sleep(300);

      // 循环检测，直到稳定（最多13次）
      for (var c = 0; c < 13; c++) {
        try {
          // 使用委托详情检测区域进行OCR
          var ocrResult = await Utils.easyOCROne(
            Constants.OCR_REGIONS.COMMISSION_DETAIL
          );

          if (ocrResult === context.commissionName || ocrResult === "") {
            await sleep(1000);
            // 没有延时13s的错误提示，继续检测
            log.debug("检测到委托名称或空文本，继续等待...");
          }
          else if (
            (!useKeyword && ocrResult === targetDescription) ||
            (useKeyword && ocrResult.includes(targetDescription))
          ) {
            log.info("委托描述检测成功，执行后续步骤");

            if (executeFile && runType === "process") {
              var nextSteps = await Execute.loadAndParseProcessFile(
                context.commissionName,
                context.location,
                executeFile
              );
              // 插入到这一步后面
              if (nextSteps && Array.isArray(nextSteps)) {
                context.processSteps.splice(context.currentIndex + 1, 0, ...nextSteps);
                log.info("已插入 {count} 个后续步骤", nextSteps.length);
              }
            } else if (executeFile && runType === "path") {
              executeFile = executeFile || "path.json"
              filePath = Constants.TALK_PROCESS_BASE_PATH + "/" + context.commissionName + "/" + context.location + "/" + executeFile;
              try {
                await pathingScript.runFile(filePath);
              } catch (error) {
                log.warn(
                  "未找到对话委托 {name} 在 {location} 的地图追踪文件: {path}",
                  context.commissionName,
                  context.location,
                  executeFile
                );
                return false;
              }
            }
            break;
          } else {
            log.warn("委托描述不匹配,识别：{actual},期望：{expected}", ocrResult, targetDescription);
            break;
          }
        } catch (ocrError) {
          log.error("委托描述OCR识别出错: {error}", ocrError.message);
          break;
        }
      }
    } catch (error) {
      log.error("执行委托描述检测步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "委托描述检测",
  "data": "目标描述文本",  // 必填: 要检测的委托描述
  "run": "后续执行文件.json",  // 必填: 检测成功后执行的流程文件
  "note": "检测特定委托描述"
}

或者对象格式:
{
  "type": "委托描述检测", 
  "data": {
    "description": "目标描述文本",  // 必填: 要检测的描述
    "executeFile": "后续文件.json"   // 必填: 检测成功后执行的文件
    "runType": "process"  // 可选: process | path  默认process, process表示执行流程文件, path表示执行路径文件
    "useKeyword": false  // 可选: 是否使用关键字匹配, 默认false, true表示委托描述包含description即可, false表示完全匹配description
  },
  "note": "检测委托描述并执行后续步骤"
}
*/
