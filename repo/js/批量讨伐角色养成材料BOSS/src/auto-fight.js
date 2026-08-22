export async function runAutoFight(param) {
    // 传入战斗策略
    let autoFightParam = new AutoFightParam(param.strategyName);

    // 战斗超时设置  
    autoFightParam.Timeout = param.timeout;

    // 战斗结束检测配置  
    autoFightParam.FightFinishDetectEnabled = true;
    autoFightParam.FinishDetectConfig.FastCheckEnabled = false;

    // 战斗后拾取配置  
    autoFightParam.PickDropsAfterFightEnabled = false;

    // 万叶拾取配置  
    autoFightParam.KazuhaPickupEnabled = false;

    // 技能CD优化  
    autoFightParam.ActionSchedulerByCd = "";

    // 精英怪拾取模式  
    autoFightParam.OnlyPickEliteDropsMode = "Close";

    // 盾奶配置  
    autoFightParam.GuardianAvatar = "";

    // 运行任务  
    await dispatcher.runAutoFightTask(autoFightParam);
}