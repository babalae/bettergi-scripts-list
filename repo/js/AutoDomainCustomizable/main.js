(async function () {
    // =========================================================================
    // 0. 数据定义 (源自 Genshin_Domains_SC_Live_Source.json)
    // =========================================================================
    const MATERIAL_DB = {
        // ====== 角色天赋素材 ======
        // 蒙德
        "「自由」的哲学": { domain: "忘却之峡", idx: 1 },
        "「抗争」的哲学": { domain: "忘却之峡", idx: 2 },
        "「诗文」的哲学": { domain: "忘却之峡", idx: 3 },
        // 璃月
        "「繁荣」的哲学": { domain: "太山府", idx: 1 },
        "「勤劳」的哲学": { domain: "太山府", idx: 2 },
        "「黄金」的哲学": { domain: "太山府", idx: 3 },
        // 稻妻
        "「浮世」的哲学": { domain: "堇色之庭", idx: 1 },
        "「风雅」的哲学": { domain: "堇色之庭", idx: 2 },
        "「天光」的哲学": { domain: "堇色之庭", idx: 3 },
        // 须弥
        "「诤言」的哲学": { domain: "昏识塔", idx: 1 },
        "「巧思」的哲学": { domain: "昏识塔", idx: 2 },
        "「笃行」的哲学": { domain: "昏识塔", idx: 3 },
        // 枫丹
        "「公平」的哲学": { domain: "苍白的遗荣", idx: 1 },
        "「正义」的哲学": { domain: "苍白的遗荣", idx: 2 },
        "「秩序」的哲学": { domain: "苍白的遗荣", idx: 3 },
        // 纳塔
        "「角逐」的哲学": { domain: "蕴火的幽墟", idx: 1 },
        "「焚燔」的哲学": { domain: "蕴火的幽墟", idx: 2 },
        "「纷争」的哲学": { domain: "蕴火的幽墟", idx: 3 },
        // 挪德卡莱
        "「月光」的哲学": { domain: "无光的深都", idx: 1 },
        "「乐园」的哲学": { domain: "无光的深都", idx: 2 },
        "「浪迹」的哲学": { domain: "无光的深都", idx: 3 },

        // ====== 武器升级素材 ======
        // 蒙德
        "高塔孤王的碎梦": { domain: "塞西莉亚苗圃", idx: 1 },
        "凛风奔狼的怀乡": { domain: "塞西莉亚苗圃", idx: 2 },
        "狮牙斗士的理想": { domain: "塞西莉亚苗圃", idx: 3 },
        // 璃月
        "孤云寒林的神体": { domain: "震雷连山密宫", idx: 1 },
        "雾海云间的转还": { domain: "震雷连山密宫", idx: 2 },
        "漆黑陨铁的一块": { domain: "震雷连山密宫", idx: 3 },
        // 稻妻
        "远海夷地的金枝": { domain: "砂流之庭", idx: 1 },
        "鸣神御灵的勇武": { domain: "砂流之庭", idx: 2 },
        "今昔剧画之鬼人": { domain: "砂流之庭", idx: 3 },
        // 须弥
        "谧林涓露的金符": { domain: "有顶塔", idx: 1 },
        "绿洲花园的真谛": { domain: "有顶塔", idx: 2 },
        "烈日威权的旧日": { domain: "有顶塔", idx: 3 },
        // 枫丹
        "悠古弦音的回响": { domain: "深潮的余响", idx: 1 },
        "纯圣露滴的真粹": { domain: "深潮的余响", idx: 2 },
        "无垢之海的金杯": { domain: "深潮的余响", idx: 3 },
        // 纳塔
        "贡祭炽心的荣膺": { domain: "深古瞭望所", idx: 1 },
        "谵妄圣主的神面": { domain: "深古瞭望所", idx: 2 },
        "神合秘烟的启示": { domain: "深古瞭望所", idx: 3 },
        // 挪德卡莱
        "奇巧秘器的真愿": { domain: "失落的月庭", idx: 1 },
        "长夜燧火的烈辉": { domain: "失落的月庭", idx: 2 },
        "终北遗嗣的煌熠": { domain: "失落的月庭", idx: 3 },

        // ====== 圣遗物 (type: 'artifact') ======
        // 蒙德
        "如雷的盛怒 / 平息雷鸣的尊者": { domain: "仲夏庭园", type: "artifact" },
        "翠绿之影 / 被怜爱的少女": { domain: "铭记之谷", type: "artifact" },
        "沉沦之心 / 冰风迷途的勇士": { domain: "芬德尼尔之顶", type: "artifact" },
        // 璃月
        "炽烈的炎之魔女 / 渡过烈火的贤人": { domain: "无妄引咎密宫", type: "artifact" },
        "昔日宗室之仪 / 染血的骑士道": { domain: "华池岩岫", type: "artifact" },
        "悠古的磐岩 / 逆飞的流星": { domain: "孤云凌霄之处", type: "artifact" },
        "辰砂往生录 / 来歆余响": { domain: "岩中幽谷", type: "artifact" },
        // 稻妻
        "绝缘之旗印 / 追忆之注连": { domain: "椛染之庭", type: "artifact" },
        "海染砗磲 / 华馆梦醒形骸记": { domain: "沉眠之庭", type: "artifact" },
        // 须弥
        "深林的记忆 / 饰金之梦": { domain: "缘觉塔", type: "artifact" },
        "沙上楼阁史话 / 乐园遗落之花": { domain: "赤金的城墟", type: "artifact" },
        "水仙之梦 / 花海甘露之光": { domain: "熔铁的孤塞", type: "artifact" },
        // 枫丹
        "逐影猎人 / 黄金剧团": { domain: "罪祸的终末", type: "artifact" },
        "昔时之歌 / 回声之林夜话": { domain: "临瀑之城", type: "artifact" },
        "谐律异想断章 / 未竟的遐思": { domain: "剧变丛林", type: "artifact" },
        // 纳塔
        "黑曜秘典 / 烬城勇者绘卷": { domain: "虹灵的净土", type: "artifact" },
        "深廊终曲 / 长夜之誓": { domain: "荒废砌造坞", type: "artifact" },
        // 挪德卡莱
        "纺月的夜歌 / 穹境示现之夜": { domain: "霜凝的机枢", type: "artifact" }
    };

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
            log.warn(`【日期检查】警告：今日 (游戏内星期${dayStr}) 非該素材常規開放日！`);
            
            if (pForceRunMode) {
                log.warn(`【强制运行】检测到"强制运行"已勾选。脚本将继续执行。`);
                log.warn(`【风险提示】若游戏内并无"限时全开"活动，底层的 OCR 将无法识别活动，BetterGI 將會直接進入今日預設副本，導致刷錯素材！`);
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
                throw ex; 
            }
        }
    }
})();