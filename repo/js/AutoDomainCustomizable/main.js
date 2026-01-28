(async function () {
    // =========================================================================
    // 0. 动态加载数据 (基于 Genshin_Domains_SC_Live_Source.json)
    // =========================================================================
    let MATERIAL_DB = {};
    const DB_FILENAME = "Genshin_Domains_SC_Live_Source.json";

    try {
        // [修正] 使用正确的方法名 ReadTextSync 读取文件
        let rawContent = file.ReadTextSync(DB_FILENAME);
        
        // 检查读取结果是否为空
        if (!rawContent) {
            throw new Error("读取文件返回空内容");
        }

        let sourceData = JSON.parse(rawContent);
        
        if (!sourceData || !sourceData.domains) {
            throw new Error("JSON文件格式不正确，缺少 domains 字段");
        }

        // --- 1. 转换角色天赋素材 ---
        if (sourceData.domains.talent_books) {
            sourceData.domains.talent_books.forEach(item => {
                let domain = item.domain_name_sc;
                let schedule = item.schedule;
                // 映射规则: Mon_Thu -> 1, Tue_Fri -> 2, Wed_Sat -> 3
                if (schedule.Mon_Thu) MATERIAL_DB[schedule.Mon_Thu] = { domain: domain, idx: 1 };
                if (schedule.Tue_Fri) MATERIAL_DB[schedule.Tue_Fri] = { domain: domain, idx: 2 };
                if (schedule.Wed_Sat) MATERIAL_DB[schedule.Wed_Sat] = { domain: domain, idx: 3 };
            });
        }

        // --- 2. 转换武器升级素材 ---
        if (sourceData.domains.weapon_materials) {
            sourceData.domains.weapon_materials.forEach(item => {
                let domain = item.domain_name_sc;
                let schedule = item.schedule;
                if (schedule.Mon_Thu) MATERIAL_DB[schedule.Mon_Thu] = { domain: domain, idx: 1 };
                if (schedule.Tue_Fri) MATERIAL_DB[schedule.Tue_Fri] = { domain: domain, idx: 2 };
                if (schedule.Wed_Sat) MATERIAL_DB[schedule.Wed_Sat] = { domain: domain, idx: 3 };
            });
        }

        // --- 3. 转换圣遗物 (type: 'artifact') ---
        if (sourceData.domains.artifacts) {
            sourceData.domains.artifacts.forEach(item => {
                let domain = item.domain_name_sc;
                // 将 drops 数组组合成 key，格式为 "Drop1 / Drop2"
                let key = item.drops.join(" / ");
                MATERIAL_DB[key] = { domain: domain, type: "artifact" };
            });
        }

        log.info(`【系统】成功加载外部数据文件: ${DB_FILENAME}，包含 ${Object.keys(MATERIAL_DB).length} 条记录`);

    } catch (e) {
        log.error(`【致命错误】无法读取或解析 ${DB_FILENAME}`);
        log.error(`错误详情: ${e.message}`);
        log.error("请确保 JSON 文件存在于脚本目录中且格式正确。脚本已停止。");
        return;
    }

    // =========================================================================
    // 1. 读取用户设置
    // =========================================================================
    let userConfig = settings;
    let enableDebug = userConfig.EnableDebug;

    // --- 读取三个独立栏位 ---
    let pTalent = userConfig.TargetTalentMaterialName;
    let pWeapon = userConfig.TargetWeaponMaterialName;
    let pArtifact = userConfig.TargetArtifactName;
    let pForceRunMode = userConfig.ForceRunMode;

    // --- 互斥检查与目标确定 ---
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

    // --- 通用参数 ---
    let pPartyName = userConfig.PartyName || "";
    let pRunUntilDepleted = userConfig.RunUntilResinDepleted;
    let pAutoArtifactSalvage = userConfig.AutoArtifactSalvage;
    let pMaxArtifactStar = userConfig.MaxArtifactStar || "4"; 
    
    // 初始化目标参数
    let pDomainName = "";
    let pSundaySelectedValue = "";

    // 数值参数
    let pOriginal = parseInt(userConfig.OriginalResinUseCount) || 0;
    let pCondensed = parseInt(userConfig.CondensedResinUseCount) || 0;
    let pTransient = parseInt(userConfig.TransientResinUseCount) || 0;
    let pFragile = parseInt(userConfig.FragileResinUseCount) || 0;
    let pDomainRoundNum = parseInt(userConfig.DomainRoundNum) || 0;
    let pFightEndDelay = parseInt(userConfig.FightEndDelay) || 5;

    // [新增] 树脂机制警告
    if (!pRunUntilDepleted && pOriginal > 0) {
        log.warn("【树脂警告】您设置了使用原粹树脂。由于 BetterGI 本体任务目前不支持选择 20/40 树脂：");
        log.warn(" -> 请务必在运行脚本前，手动进入一次秘境，确认并调整好游戏内的树脂消耗选项，否则可能导致消耗不符合预期。");
    }

    // =========================================================================
    // 2. 智能逻辑处理
    // =========================================================================
    
    // 中文星期对照表 (0-6)
    const WEEK_MAP = ["日", "一", "二", "三", "四", "五", "六"];

    let materialInfo = MATERIAL_DB[pTargetMaterial];
    if (!materialInfo) {
        log.error(`【数据错误】无法在数据库中找到项目：${pTargetMaterial}`);
        log.error("请检查 JSON 数据文件是否包含此素材，或 settings.json 中的名称是否一致。");
        return;
    }

    if (materialInfo.type === 'artifact') {
        // [圣遗物] 每日开放，直接放行
        pDomainName = materialInfo.domain;
        pSundaySelectedValue = ""; 
        log.info(`【圣遗物模式】目标：${pTargetMaterial}`);
        log.info(`【自动定位】秘境：${pDomainName} (每日开放)`);
    } else {
        // [天赋/武器素材] 需要日期检查
        let requiredIdx = materialInfo.idx;
        pDomainName = materialInfo.domain;
        pSundaySelectedValue = requiredIdx.toString(); 

        // --- 全球通用时间逻辑 (跨时区修正版) ---
        
        // 1. 获取 BGI 配置的服务器偏移量 (例如亚服为 +8小时，单位毫秒)
        let serverOffsetMs = ServerTime.GetServerTimeZoneOffset();
        
        // 2. 获取当前的 UTC 时间戳 (全球统一，不受电脑时区影响)
        let utcNow = Date.now();
        
        // 3. 计算"游戏服务器的逻辑时间戳"
        // 算法: UTC时间 + 服务器偏移量 - 4小时(换日)
        // 这样算出来的时间，如果视作 UTC 时间，其"星期几"就是游戏内的"星期几"
        let logicTimeMs = utcNow + serverOffsetMs - (4 * 60 * 60 * 1000);
        let logicDate = new Date(logicTimeMs);
        
        // 4. 获取 UTC 星期 (关键: 必须用 getUTCDay，忽略本地时区)
        let dayOfWeek = logicDate.getUTCDay();
        let dayStr = WEEK_MAP[dayOfWeek]; 

        if (enableDebug) {
            // 调试信息：计算当前的服务器名义时间
            let serverTimeDate = new Date(utcNow + serverOffsetMs);
            log.info(`[DEBUG] 游戏服务器时间(UTC视角): ${serverTimeDate.toUTCString()}`);
            log.info(`[DEBUG] 逻辑判定后星期: ${dayStr}`);
        }

        // 判断今日是否开放
        let isDateOpen = false;
        if (dayOfWeek === 0) isDateOpen = true; // 周日
        else if (requiredIdx === 1 && (dayOfWeek === 1 || dayOfWeek === 4)) isDateOpen = true;
        else if (requiredIdx === 2 && (dayOfWeek === 2 || dayOfWeek === 5)) isDateOpen = true;
        else if (requiredIdx === 3 && (dayOfWeek === 3 || dayOfWeek === 6)) isDateOpen = true;

        log.info(`【智能匹配】目标: ${pTargetMaterial} (游戏内星期${dayStr})`);

        if (isDateOpen) {
            log.info(`【日期检查】通过，今日为常规开放日。`);
        } else {
            log.warn(`【日期检查】警告：今日 (游戏内星期${dayStr}) 非该素材常规开放日！`);
            
            if (pForceRunMode) {
                log.warn(`【强制运行】检测到"强制运行"已勾选。脚本将继续执行。`);
                log.warn(`【风险提示】若游戏内并无"限时全开"活动，底层的 OCR 将无法识别活动，BetterGI 将会直接进入今日预设副本，导致刷错素材！`);
            } else {
                log.error(`【停止运行】为防止刷错素材，脚本已停止。`);
                log.error(`  -> 若您确认当前游戏有"限时全开/精通移涌"活动，请在设置中勾选"强制运行"以忽略此警告。`);
                return; // 安全退出
            }
        }
    }

    // =========================================================================
    // 3. 执行主流程
    // =========================================================================
    while (true) {
        try {
            let taskParam = new AutoDomainParam(pDomainRoundNum);
            taskParam.DomainName = pDomainName;
            taskParam.PartyName = pPartyName;
            taskParam.AutoArtifactSalvage = pAutoArtifactSalvage;
            taskParam.MaxArtifactStar = pMaxArtifactStar;
            taskParam.SundaySelectedValue = pSundaySelectedValue;
            
            taskParam.SpecifyResinUse = !pRunUntilDepleted;
            if (!pRunUntilDepleted) {
                taskParam.OriginalResinUseCount = pOriginal;
                taskParam.CondensedResinUseCount = pCondensed;
                taskParam.TransientResinUseCount = pTransient;
                taskParam.FragileResinUseCount = pFragile;
                taskParam.SetResinPriorityList("浓缩树脂", "原粹树脂", "须臾树脂", "脆弱树脂");
            } else {
                taskParam.SetResinPriorityList("浓缩树脂", "原粹树脂");
            }

            await dispatcher.RunAutoDomainTask(taskParam);
            
            if (pFightEndDelay > 0) {
                log.info(`[脚本] 任务结束，等待 ${pFightEndDelay} 秒...`);
                await sleep(pFightEndDelay * 1000);
            }
            break; 
        } catch (ex) {
            let msg = ex.message || "";
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
            } else {
                log.error(`[脚本] 错误: ${msg}`);
                // [修改] 新增针对未找到传送点的错误提示
                if (msg.includes("未找到对应的秘境")) {
                    log.error("请等待BetterGI本体更新支援新秘境");
                }
                throw ex; 
            }
        }
    }
})();