// 地址检测步骤处理器
(function () {
  StepProcessorLoader.register("地址检测", async function (step, context) {
    try {
      log.info("执行地址检测");

      if (!step.data || !Array.isArray(step.data) || step.data.length < 2) {
        log.warn("地址检测步骤缺少有效的坐标数据");
        return;
      }

      var targetX = step.data[0];
      var targetY = step.data[1];
      var tolerance = step.data[2] || 15; // 默认容差15单位
      var executeFile = step.run; // 要执行的后续文件

      log.info(
        "地址检测: 目标({x}, {y}), 容差: {tolerance}, 执行文件: {file}",
        targetX,
        targetY,
        tolerance,
        executeFile || "无"
      );

      try {
        // 获取当前委托目标位置
        var commissionTarget = await Execute.findCommissionTarget(
          context.commissionName
        );

        if (commissionTarget) {
          var distance = Utils.calculateDistance(commissionTarget, {
            x: targetX,
            y: targetY,
          });

          log.info(
            "地址检测 - 委托位置: ({x}, {y}), 目标位置: ({tx}, {ty}), 距离: {d}",
            commissionTarget.x,
            commissionTarget.y,
            targetX,
            targetY,
            distance
          );

          if (distance < tolerance) {
            log.info("地址检测成功，距离在容差范围内");

            // 执行后续步骤文件
            if (executeFile) {
              log.info("加载并执行后续步骤文件: {file}", executeFile);
              try {
                var nextSteps = await Execute.loadAndParseProcessFile(
                  context.commissionName,
                  context.location,
                  executeFile
                );

                // 插入到当前步骤后面
                if (nextSteps && nextSteps.length > 0) {
                  context.processSteps.splice(
                    context.currentIndex + 1,
                    0,
                    ...nextSteps
                  );
                  log.info("已插入 {count} 个后续步骤", nextSteps.length);
                }
              } catch (fileError) {
                log.error("加载后续步骤文件失败: {error}", fileError.message);
              }
            }

            // 设置检测结果到上下文
            context.locationDetected = true;
            context.detectedPosition = commissionTarget;
          } else {
            log.info("地址检测失败，距离过远: {distance}", distance);
            context.locationDetected = false;
          }
        } else {
          log.warn("无法获取委托目标位置，跳过地址检测");
          context.locationDetected = false;
        }
      } catch (error) {
        log.error("地址检测时出错: {error}", error.message);
        context.locationDetected = false;
        throw error;
      }
    } catch (error) {
      log.error("执行地址检测步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "地址检测",
  "data": [100, 200, 15],  // 必需数组: [目标X, 目标Y, 容差距离(可选,默认15)]
  "run": "后续执行文件.json",  // 可选: 检测成功后执行的文件
  "note": "检测是否到达目标位置"
}
注意: 会检测当前委托位置与目标坐标的距离，在容差范围内视为检测成功
*/
