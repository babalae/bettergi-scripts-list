// 修改后的切换队伍步骤处理器
(function () {
  StepProcessorLoader.register("切换队伍", async function (step, context) {
    try {
      log.info("执行切换队伍操作");

      if (!step.data) {
        log.warn("切换队伍步骤缺少数据");
        return false;
      }

      var teamData = step.data;
      var teamName;

      // 处理不同的数据格式
      if (typeof teamData === "string") {
        teamName = teamData;
      } else if (typeof teamData === "object") {
        teamName = teamData.name;
      }

      if (!teamName) {
        log.warn("切换队伍步骤缺少队伍名称");
        return false;
      }

      try {
        log.info("开始切换到队伍类型: {team}", teamName);

        // 根据队伍类型从设置中获取实际队伍名称
        var actualTeamName;
        if (teamName === "战斗") {
          actualTeamName = settings.team; // 从设置获取战斗队伍名称
        } else if (teamName === "元素采集") {
          actualTeamName = settings.elementTeam; // 从设置获取元素采集队名称
        } else {
          actualTeamName = teamName; // 直接使用自定义名称
        }

        // 如果未配置队伍名称则跳过
        if (!actualTeamName || actualTeamName.trim() === "") {
          log.warn("未配置队伍名称，跳过切换操作");
          return true;
        }

        // 调用队伍切换API
        var success = await genshin.switchParty(actualTeamName);

        if (success) {
          log.info("队伍切换成功: {team}", actualTeamName);

          // 等待队伍切换完成
          await sleep(300);

          return true;
        } else {
          log.error("队伍切换失败: {team}", actualTeamName);
          return false;
        }
      } catch (switchError) {
        log.error("切换队伍时出错: {error}", switchError.message);
        throw switchError;
      }
    } catch (error) {
      log.error("执行切换队伍步骤时出错: {error}", error.message);
      throw error;
    }
  });
})();

/*
JSON使用示例:
{
  "type": "切换队伍",
  "data": "战斗" //队伍名称
}
*/