// Version: 1.7
// Modified Date: 2026-04-11
(async function () {
    // =========================================================================
    // 0. 动态加载数据 (基于 Genshin_Domains_SC_Live_Source.json)
    // =========================================================================
    let MATERIAL_DB = {};
    const DB_FILENAME = "Genshin_Domains_SC_Live_Source.json";

    try {
        let rawContent = file.ReadTextSync(DB_FILENAME);
        if (!rawContent) throw new Error("读取文件返回空内容");

        let sourceData = JSON.parse(rawContent);
        if (!sourceData || !sourceData.domains) throw new Error("JSON文件格式不正确，缺少 domains 字段");

        // 转换角色天赋素材
        if (sourceData.domains.talent_books) {
            sourceData.domains.talent_books.forEach(item => {
                let domain = item.domain_name_sc;
                if (item.schedule.Mon_Thu) MATERIAL_DB[item.schedule.Mon_Thu] = { domain: domain, idx: 1 };
                if (item.schedule.Tue_Fri) MATERIAL_DB[item.schedule.Tue_Fri] = { domain: domain, idx: 2 };
                if (item.schedule.Wed_Sat) MATERIAL_DB[item.schedule.Wed_Sat] = { domain: domain, idx: 3 };
            });
        }
        // 转换武器升级素材
        if (sourceData.domains.weapon_materials) {
            sourceData.domains.weapon_materials.forEach(item => {
                let domain = item.domain_name_sc;
                if (item.schedule.Mon_Thu) MATERIAL_DB[item.schedule.Mon_Thu] = { domain: domain, idx: 1 };
                if (item.schedule.Tue_Fri) MATERIAL_DB[item.schedule.Tue_Fri] = { domain: domain, idx: 2 };
                if (item.schedule.Wed_Sat) MATERIAL_DB[item.schedule.Wed_Sat] = { domain: domain, idx: 3 };
            });
        }
        // 转换圣遗物
        if (sourceData.domains.artifacts) {
            sourceData.domains.artifacts.forEach(item => {
                let domain = item.domain_name_sc;
                let key = item.drops.join(" / ");
                MATERIAL_DB[key] = { domain: domain, type: "artifact" };
            });
        }
        log.info(`【系统】成功加载外部数据文件: ${DB_FILENAME}，包含 ${Object.keys(MATERIAL_DB).length} 条记录`);
    } catch (e) {
        log.error(`【致命错误】无法读取或解析 ${DB_FILENAME}`);
        log.error(`错误详情: ${e.message}`);
        return;
    }

    // =========================================================================
    // 1. 读取并验证用户设置 (全 input-text 防呆机制)
    // =========================================================================
    let userConfig = settings;
    let enableDebug = userConfig.EnableDebug;

    // --- 调试模式输出所有使用者设定参数 ---
    if (enableDebug) {
        log.info("[DEBUG] ====== 收到使用者设定参数 (User Config) ======");
        for (let key in userConfig) {
            log.info(`[DEBUG] ${key}: ${userConfig[key]}`);
        }
        log.info("[DEBUG] ==============================================");
    }

    let pForceRunMode = userConfig.ForceRunMode;
    let pRunUntilDepleted = userConfig.RunUntilResinDepleted;
    let pAutoArtifactSalvage = userConfig.AutoArtifactSalvage;
    let pMaxArtifactStar = userConfig.MaxArtifactStar || "4"; 

    // --- 1.1 秘境目标防呆 ---
    let pTalent = userConfig.TargetTalentMaterialName;
    let pWeapon = userConfig.TargetWeaponMaterialName;
    let pArtifact = userConfig.TargetArtifactName;
    let selectedCount = (pTalent ? 1 : 0) + (pWeapon ? 1 : 0) + (pArtifact ? 1 : 0);

    if (selectedCount === 0) {
        log.error("【配置错误】您未选择任何素材！请在天赋、武器或圣遗物中选择一项。");
        return;
    }
    if (selectedCount > 1) {
        log.error("【配置冲突】您同时选择了多种类型的素材！请只保留一项，将其余两项设为空。");
        return;
    }
    let pTargetMaterial = pTalent || pWeapon || pArtifact;

    // --- 1.2 队伍名称防呆 (input-text) ---
    let pPartyName = (userConfig.PartyName || "").toString().trim();
    if (pPartyName !== "") {
        try {
            new RegExp(pPartyName); // 测试正则表达式是否合法
        } catch (e) {
            log.warn(`【配置警告】队伍名称的正则表达式语法错误: ${pPartyName}，已重置为空 (不执行队伍切换)。`);
            pPartyName = "";
        }
    }

    // --- 1.3 战斗策略防呆 (select + input-text) ---
    let pCombatStrategyType = (userConfig.CombatStrategyType || "").toString().trim();
    let pSpecifiedCombatStrategy = (userConfig.SpecifiedCombatStrategy || "").toString().trim();
    let pCombatStrategyPath = ""; 

    if (pCombatStrategyType === "指定战斗策略") {
        if (!pSpecifiedCombatStrategy) {
            log.warn("【配置警告】您选择了'指定战斗策略'但未填写策略名称，系统将自动退回'根据队伍自动选择'。");
        } else if (/[\\/:*?"<>|]/.test(pSpecifiedCombatStrategy)) {
            log.warn(`【配置警告】指定的战斗策略名称包含非法字元: ${pSpecifiedCombatStrategy}，系统将自动退回'根据队伍自动选择'。`);
        } else {
            pCombatStrategyPath = pSpecifiedCombatStrategy;
        }
    }

    // --- 1.4 各项数值与树脂防呆 (input-text 与 select) ---
    let pOriginalAmount = parseInt(userConfig.OriginalResinAmount) || 0;
    let pOriginal40 = Math.floor(pOriginalAmount / 40);
    let pOriginal20 = Math.floor((pOriginalAmount % 40) / 20);
    let pCondensed = parseInt(userConfig.CondensedResinUseCount) || 0;
    let pTransient = parseInt(userConfig.TransientResinUseCount) || 0;
    
    // 脆弱树脂 (input-text)
    let pFragileRaw = parseInt(userConfig.FragileResinUseCount);
    let pFragile = (isNaN(pFragileRaw) || pFragileRaw < 0) ? 0 : pFragileRaw;
    if (userConfig.FragileResinUseCount && (isNaN(pFragileRaw) || pFragileRaw < 0)) {
        log.warn("【配置警告】脆弱树脂刷取数量输入无效或为负数，已自动重置为 0。");
    }

    // 秘境轮数 (input-text)
    let pDomainRoundNumRaw = parseInt(userConfig.DomainRoundNum);
    let pDomainRoundNum = (isNaN(pDomainRoundNumRaw) || pDomainRoundNumRaw < 0) ? 0 : pDomainRoundNumRaw;
    if (userConfig.DomainRoundNum && (isNaN(pDomainRoundNumRaw) || pDomainRoundNumRaw < 0)) {
        log.warn("【配置警告】秘境刷取轮数输入无效，已自动重置为 0 (无限轮直至树脂耗尽)。");
    }

    // 战斗后等待时间 (input-text)
    let pFightEndDelayRaw = parseInt(userConfig.FightEndDelay);
    let pFightEndDelay = (isNaN(pFightEndDelayRaw) || pFightEndDelayRaw < 0) ? 5 : pFightEndDelayRaw;
    if (userConfig.FightEndDelay && (isNaN(pFightEndDelayRaw) || pFightEndDelayRaw < 0)) {
        log.warn("【配置警告】战斗完成后等待时间输入无效，已恢复默认值 5 秒。");
    }

    // 树脂刷取顺序 (input-text)
    let rawOrderStr = (userConfig.ResinUsageOrder || "").toString().trim();
    if (/[^12345]/.test(rawOrderStr)) {
        log.warn(`【配置警告】树脂刷取顺序包含无效字符，非 1~5 的内容已被自动过滤。`);
    }
    let pOrderStr = [...new Set(rawOrderStr.replace(/[^12345]/g, '').split(''))].join('');
    if (rawOrderStr.replace(/[^12345]/g, '').length !== pOrderStr.length) {
        log.warn(`【配置警告】树脂刷取顺序中存在重复设定的数字，已自动去重处理为: ${pOrderStr}`);
    }

    let priorityList = [];
    for (let char of pOrderStr) {
        if (char === '1') priorityList.push("浓缩树脂");
        else if (char === '2') priorityList.push("原粹树脂40");
        else if (char === '3') priorityList.push("原粹树脂20");
        else if (char === '4') priorityList.push("须臾树脂");
        else if (char === '5') priorityList.push("脆弱树脂");
    }

    if (!pRunUntilDepleted && pOriginalAmount === 0 && pCondensed === 0 && pTransient === 0 && pFragile === 0 && pDomainRoundNum === 0) {
        log.warn("【配置警告】您未设置任何树脂消耗数量，也未限制秘境轮数！脚本可能进本后无事可做。");
    }

    // =========================================================================
    // 2. 智能逻辑处理 (日期检查)
    // =========================================================================
    const WEEK_MAP = ["日", "一", "二", "三", "四", "五", "六"];
    let materialInfo = MATERIAL_DB[pTargetMaterial];
    let pDomainName = "";
    let pSundaySelectedValue = "";

    if (!materialInfo) {
        log.error(`【数据错误】无法在数据库中找到项目：${pTargetMaterial}`);
        return;
    }

    if (materialInfo.type === 'artifact') {
        pDomainName = materialInfo.domain;
        log.info(`【圣遗物模式】目标：${pTargetMaterial}`);
    } else {
        let requiredIdx = materialInfo.idx;
        pDomainName = materialInfo.domain;
        pSundaySelectedValue = requiredIdx.toString(); 

        let serverOffsetMs = ServerTime.GetServerTimeZoneOffset();
        let utcNow = Date.now();
        let logicTimeMs = utcNow + serverOffsetMs - (4 * 60 * 60 * 1000);
        let dayOfWeek = new Date(logicTimeMs).getUTCDay();
        let dayStr = WEEK_MAP[dayOfWeek]; 

        if (enableDebug) {
            log.info(`[DEBUG] 游戏服务器时间: ${new Date(utcNow + serverOffsetMs).toUTCString()}`);
        }

        let isDateOpen = (dayOfWeek === 0) || 
                         (requiredIdx === 1 && (dayOfWeek === 1 || dayOfWeek === 4)) ||
                         (requiredIdx === 2 && (dayOfWeek === 2 || dayOfWeek === 5)) ||
                         (requiredIdx === 3 && (dayOfWeek === 3 || dayOfWeek === 6));

        log.info(`【智能匹配】目标: ${pTargetMaterial} (游戏内星期${dayStr})`);

        if (!isDateOpen && !pForceRunMode) {
            log.error(`【停止运行】今日非该素材开放日。若需强制运行，请在设置中勾选。`);
            return;
        }
    }

    // =========================================================================
    // 3. 执行主流程
    // =========================================================================
    let taskParam = new AutoDomainParam(pDomainRoundNum);
    taskParam.DomainName = pDomainName;
    taskParam.PartyName = pPartyName;
    taskParam.AutoArtifactSalvage = pAutoArtifactSalvage;
    taskParam.MaxArtifactStar = pMaxArtifactStar;
    taskParam.SundaySelectedValue = pSundaySelectedValue;
    
    // 调用底层方法以支持路径转换，并将回传值賦予屬性
    taskParam.CombatStrategyPath = taskParam.SetCombatStrategyPath(pCombatStrategyPath); 
    
    taskParam.SpecifyResinUse = !pRunUntilDepleted;
    
    // 樹脂數量與警告邏輯
    if (!pRunUntilDepleted) {
        taskParam.OriginalResin20UseCount = pOriginal20;
        taskParam.OriginalResin40UseCount = pOriginal40;
        taskParam.OriginalResinUseCount = 0; 
        taskParam.CondensedResinUseCount = pCondensed;
        taskParam.TransientResinUseCount = pTransient;
        taskParam.FragileResinUseCount = pFragile;
        
        if (pOrderStr === "") {
            log.warn("【配置警告】树脂刷取顺序完全留空！在指定次数模式下，脚本将不会消耗任何树脂。");
        } else {
            if (pCondensed > 0 && !pOrderStr.includes('1')) log.warn("【配置警告】浓缩树脂数量大于0，但未配置在刷取顺序(1)中，将被底层忽略！");
            if (pOriginal40 > 0 && !pOrderStr.includes('2')) log.warn("【配置警告】原粹树脂需要消耗40体力，但未配置在刷取顺序(2)中，将被底层忽略！");
            if (pOriginal20 > 0 && !pOrderStr.includes('3')) log.warn("【配置警告】原粹树脂需要消耗20体力，但未配置在刷取顺序(3)中，将被底层忽略！");
            if (pTransient > 0 && !pOrderStr.includes('4')) log.warn("【配置警告】须臾树脂数量大于0，但未配置在刷取顺序(4)中，将被底层忽略！");
            if (pFragile > 0 && !pOrderStr.includes('5')) log.warn("【配置警告】脆弱树脂数量大于0，但未配置在刷取顺序(5)中，将被底层忽略！");
        }
    } else {
        if (pOrderStr === "") {
            log.warn("【配置警告】树脂刷取顺序完全留空！在耗尽模式下，脚本将不会消耗任何树脂。");
        }
    }

    // 統一由 priorityList 決定刷取順序 (包含耗盡模式)
    if (priorityList.length > 0) {
        taskParam.SetResinPriorityList(...priorityList);
    } else {
        taskParam.SetResinPriorityList(""); 
    }

    while (true) {
        try {
            await dispatcher.RunAutoDomainTask(taskParam);
            
            if (pFightEndDelay > 0) {
                log.info(`[脚本] 任务结束，等待 ${pFightEndDelay} 秒...`);
                await sleep(pFightEndDelay * 1000);
            }
            break; 
        } catch (ex) {
            let msg = ex.message || "";
            
            // --- 战斗策略档案不存在的降级重试逻辑 ---
            if (msg.includes("战斗脚本文件不存在")) {
                if (taskParam.CombatStrategyPath && taskParam.CombatStrategyPath !== "") {
                    log.warn(`[脚本] 找不到指定的战斗策略档案！`);
                    log.warn(`[脚本] 已触发降级机制：退回【根据队伍自动选择】模式，3 秒后重新启动任务...`);
                    
                    // 调用底层方法正确切换为目录路径，并将回传值賦予屬性
                    taskParam.CombatStrategyPath = taskParam.SetCombatStrategyPath(""); 
                    
                    await sleep(3000);
                    continue; 
                } else {
                    log.error("[脚本] 自动匹配战斗脚本失败：请检查 User/AutoFight 目录下是否有 txt 脚本，且脚本内角色是否符合当前队伍。");
                    break;
                }
            }

            if (msg.includes("背包物品已满") || msg.includes("未检测到秘境结束")) {
                log.warn(`[脚本] 任务可能已完成，但检测到: ${msg}`);
                break; 
            } else if (msg.includes("复苏")) {
                log.warn(`[脚本] 角色死亡，5秒后重试...`);
                await sleep(5000);
                continue;
            } else if (msg.includes("TaskCanceledException")) {
                log.info("[脚本] 任务已取消。");
                break;
            } else if (msg.includes("未找到对应的秘境")) {
                log.error("请等待BetterGI本体更新支援新秘境");
                throw ex;
            } else {
                log.error(`[脚本] 错误: ${msg}`);
                throw ex; 
            }
        }
    }
})();
