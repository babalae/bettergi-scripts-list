(async function () {
    // =========================================================================
    // 1. 读取用户设置
    // =========================================================================
    let userConfig = settings;
    let enableDebug = userConfig.EnableDebug;

    // --- 参数解析 ---
    let pDomainName = userConfig.DomainName;
    let pPartyName = userConfig.PartyName || "";
    let pRunUntilDepleted = userConfig.RunUntilResinDepleted;
    let pAutoArtifactSalvage = userConfig.AutoArtifactSalvage;
    let pMaxArtifactStar = userConfig.MaxArtifactStar || "4"; 
    let pSundaySelectedValue = userConfig.SundaySelectedValue || "";

    // 数值转换
    let pOriginal = parseInt(userConfig.OriginalResinUseCount) || 0;
    let pCondensed = parseInt(userConfig.CondensedResinUseCount) || 0;
    let pTransient = parseInt(userConfig.TransientResinUseCount) || 0;
    let pFragile = parseInt(userConfig.FragileResinUseCount) || 0;
    let pDomainRoundNum = parseInt(userConfig.DomainRoundNum) || 0;
    
    // 注意：FightEndDelay 在 JS 层执行，作为 C# 任务结束后的额外等待
    let pFightEndDelay = parseInt(userConfig.FightEndDelay) || 5;

    // --- 检查 ---
    if (!pDomainName) {
        log.error("请先在配置中选择要前往的秘境！");
        return;
    }

    // =========================================================================
    // 2. 主流程
    // =========================================================================
    while (true) {
        try {
            // --- A. 创建并配置 C# 参数对象 ---
            // 直接使用 EngineExtend 暴露的 AutoDomainParam 类
            let taskParam = new AutoDomainParam(pDomainRoundNum);
            
            // 填入参数 (仅填入 AutoDomainParam 实际支持的属性)
            taskParam.DomainName = pDomainName;
            taskParam.PartyName = pPartyName;
            taskParam.AutoArtifactSalvage = pAutoArtifactSalvage;
            taskParam.MaxArtifactStar = pMaxArtifactStar;
            taskParam.SundaySelectedValue = pSundaySelectedValue;
            
            // 重要：树脂设置逻辑
            taskParam.SpecifyResinUse = !pRunUntilDepleted;
            if (!pRunUntilDepleted) {
                // 指定次数模式
                taskParam.OriginalResinUseCount = pOriginal;
                taskParam.CondensedResinUseCount = pCondensed;
                taskParam.TransientResinUseCount = pTransient;
                taskParam.FragileResinUseCount = pFragile;
                // 设置优先级：从左到右
                taskParam.SetResinPriorityList("浓缩树脂", "原粹树脂", "须臾树脂", "脆弱树脂");
            } else {
                // 刷到耗尽模式
                taskParam.SetResinPriorityList("浓缩树脂", "原粹树脂");
            }

            if (enableDebug) {
                 log.info(`[DEBUG] 参数注入完成。模式: ${!pRunUntilDepleted ? "指定次数" : "刷到耗尽"}`);
                 log.info(`[DEBUG] 浓缩: ${pCondensed}, 原粹: ${pOriginal}, 周日: ${pSundaySelectedValue}`);
            }

            // --- B. 执行任务 ---
            // 使用 RunAutoDomainTask 直接执行 C# 托管的完整流程
            // 包含自动传送、自动进门、战斗及重试 logic
            await dispatcher.RunAutoDomainTask(taskParam);
            
            // --- C. 战后等待 (脚本层面额外等待) ---
            if (pFightEndDelay > 0) {
                log.info(`[脚本] 任务执行完毕，额外等待 ${pFightEndDelay} 秒...`);
                await sleep(pFightEndDelay * 1000);
            }

            break; 

        } catch (ex) {
            let msg = ex.message || "";
            if (msg.includes("背包物品已满") || msg.includes("未检测到秘境结束")) {
                log.warn(`[脚本] 任务可能已完成，但检测到: ${msg}`);
                break; 
            }
            else if (msg.includes("检测到复苏界面") || msg.includes("复苏")) {
                log.warn(`[脚本] 角色死亡，准备复活重试...`);
                await sleep(5000);
                continue;
            } 
            else if (msg.includes("TaskCanceledException") || msg.includes("A task was canceled")) {
                log.info("[脚本] 任务已取消或停止。");
                break;
            }
            else if (msg.includes("取消自动任务")) {
                log.info("[脚本] 用户手动停止任务。");
                break;
            }
            else {
                log.error(`[脚本] 发生错误: ${msg}`);
                throw ex; 
            }
        }
    }
})();