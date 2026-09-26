// Version: 1.9
// Modified Date: 2026-05-24
(async function () {
    let SCRIPT_START_TIME = Date.now();

    function __wipOcrCheckText(roi1080, keywords, label) {
        let ra = null;
        try {
            const s = genshin.scaleTo1080PRatio;
            const x = Math.round(roi1080[0] * s);
            const y = Math.round(roi1080[1] * s);
            const w = Math.round(roi1080[2] * s);
            const h = Math.round(roi1080[3] * s);

            ra = captureGameRegion();
            const resList = ra.findMulti(RecognitionObject.ocr(x, y, w, h));
            const count = resList.length !== undefined ? resList.length : resList.count;

            if (typeof enableDebug !== "undefined" && enableDebug) {
                log.info(`[DEBUG][${label}] ROI(1080P)=(${roi1080.join(',')}) 当前=(${x},${y},${w},${h}) 段数=${count}`);
                for (let i = 0; i < count; i++) {
                    const r = resList[i];
                    if (r) log.info(`[DEBUG][${label}] #${i+1} text="${r.text}" pos=(${r.x},${r.y},${r.width},${r.height})`);
                }
            }

            for (let i = 0; i < count; i++) {
                const r = resList[i];
                if (!r || !r.text) continue;
                for (let k = 0; k < keywords.length; k++) {
                    if (r.text.includes(keywords[k])) return r;
                }
            }
            return null;
        } catch (e) {
            log.warn(`[DEBUG][${label}] OCR异常: ${e.message}`);
            return null;
        } finally {
            if (ra) ra.dispose();
        }
    }

    // =========================================================================
    // 限时全开检测函数
    // 参数: targetType - 'weapon' 或 'talent'，决定点击哪种素材
    // 返回值: true(检测到限时全开) / false(未检测到) / null(检测异常)
    // =========================================================================
    async function __detectLimitedOpen(targetType = 'weapon') {
        log.info('[限时全开] 开始检测...');
        
        try {
            // 第一步：返回主界面
            log.info('[限时全开] 第一步: 返回主界面');
            try { await genshin.returnMainUi(); } catch(e) { log.warn(`[限时全开] 返回主界面失败: ${e.message}`); }
            await sleep(100);

            // 第二步：ESC打开菜单 → OCR识别冒险之证 → 点击
            log.info('[限时全开] 第二步: ESC打开菜单');
            keyPress("VK_ESCAPE");
            await sleep(2000);

            let bookHit = null;
            const smallRoi = [149, 861, 94, 41], largeRoi = [98, 346, 651, 708];

            bookHit = __wipOcrCheckText(smallRoi, ["冒险之证"], "限时全开-冒险之证");
            if (!bookHit) { log.info('[限时全开] 冒险之证识别失败，重试1...'); await sleep(2500); bookHit = __wipOcrCheckText(smallRoi, ["冒险之证"], "限时全开-冒险之证-r1"); }
            if (!bookHit) { log.info('[限时全开] 冒险之证识别失败，重试2...'); await sleep(2500); bookHit = __wipOcrCheckText(smallRoi, ["冒险之证"], "限时全开-冒险之证-r2"); }
            if (!bookHit) { log.info('[限时全开] 小范围失败，尝试大范围...'); bookHit = __wipOcrCheckText(largeRoi, ["冒险之证"], "限时全开-冒险之证-large"); }
            if (!bookHit) { log.info('[限时全开] 大范围失败，重新打开ESC...'); try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {} keyPress("VK_ESCAPE"); await sleep(2000); bookHit = __wipOcrCheckText(largeRoi, ["冒险之证"], "限时全开-冒险之证-esc"); }

            if (bookHit) {
                const s = genshin.scaleTo1080PRatio;
                const bookX = Math.round(bookHit.x / s + bookHit.width / s / 2);
                const bookY = Math.round(bookHit.y / s + bookHit.height / s / 2) - 50;
                log.info(`[限时全开] 点击冒险之证: (${bookX}, ${bookY})`);
                GameCaptureRegion.gameRegion1080PPosClick(bookX, bookY);
                await sleep(2500);
            } else {
                log.warn('[限时全开] 冒险之证识别失败，尝试F1快捷键');
                try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {}
                keyPress("VK_F1");
                await sleep(2000);
            }

            // 第三步：识别秘境 → 点击
            log.info('[限时全开] 第三步: 识别秘境');
            let hit = null;
            const dSmall = [258, 414, 89, 59], dLarge = [214, 38, 127, 982];
            
            hit = __wipOcrCheckText(dSmall, ["秘境"], "限时全开-秘境");
            if (!hit) { log.info('[限时全开] 秘境识别失败，重试1...'); await sleep(2500); hit = __wipOcrCheckText(dSmall, ["秘境"], "限时全开-秘境-r1"); }
            if (!hit) { log.info('[限时全开] 秘境识别失败，重试2...'); await sleep(2500); hit = __wipOcrCheckText(dSmall, ["秘境"], "限时全开-秘境-r2"); }
            if (!hit) { log.info('[限时全开] 小范围失败，尝试大范围...'); hit = __wipOcrCheckText(dLarge, ["秘境"], "限时全开-秘境-large"); }
            if (!hit) { log.info('[限时全开] 大范围失败，重试...'); await sleep(2500); hit = __wipOcrCheckText(dLarge, ["秘境"], "限时全开-秘境-large2"); }

            if (hit) {
                const s = genshin.scaleTo1080PRatio;
                log.info(`[限时全开] 点击秘境: (${Math.round(hit.x/s+hit.width/s/2)}, ${Math.round(hit.y/s+hit.height/s/2)})`);
                GameCaptureRegion.gameRegion1080PPosClick(Math.round(hit.x/s+hit.width/s/2), Math.round(hit.y/s+hit.height/s/2));
                await sleep(1500);
            } else {
                log.warn('[限时全开] 秘境识别失败，点击默认位置');
                GameCaptureRegion.gameRegion1080PPosClick(297, 437);
                await sleep(1500);
            }

            // 第四步：根据目标类型识别并点击对应的素材
            log.info(`[限时全开] 第四步: 识别${targetType === 'talent' ? '天赋' : '武器'}突破素材`);
            const wSmall = [429, 425, 255, 41], wLarge = [364, 0, 369, 1060];
            const tSmall = [431, 516, 249, 40], tLarge = [364, 0, 369, 1060];
            
            const isTalent = targetType === 'talent';
            const targetKeyword = isTalent ? "天赋突破素材" : "武器突破素材";
            const targetSmall = isTalent ? tSmall : wSmall;
            const targetLarge = isTalent ? tLarge : wLarge;
            const defaultX = isTalent ? 523 : 523;
            const defaultY = isTalent ? 530 : 438;

            let targetHit = __wipOcrCheckText(targetSmall, [targetKeyword], `限时全开-${targetKeyword}`);
            if (!targetHit) { log.info(`[限时全开] ${targetKeyword}识别失败，重试1...`); await sleep(2500); targetHit = __wipOcrCheckText(targetSmall, [targetKeyword], `限时全开-${targetKeyword}-r1`); }
            if (!targetHit) { log.info(`[限时全开] ${targetKeyword}识别失败，重试2...`); await sleep(2500); targetHit = __wipOcrCheckText(targetSmall, [targetKeyword], `限时全开-${targetKeyword}-r2`); }
            if (!targetHit) { log.info('[限时全开] 小范围失败，尝试大范围...'); targetHit = __wipOcrCheckText(targetLarge, [targetKeyword], `限时全开-${targetKeyword}-large`); }
            if (!targetHit) { log.info('[限时全开] 大范围失败，重试...'); await sleep(2500); targetHit = __wipOcrCheckText(targetLarge, [targetKeyword], `限时全开-${targetKeyword}-large2`); }

            if (targetHit) {
                const s = genshin.scaleTo1080PRatio;
                log.info(`[限时全开] 点击${targetKeyword}: (${Math.round(targetHit.x/s+targetHit.width/s/2)}, ${Math.round(targetHit.y/s+targetHit.height/s/2)})`);
                GameCaptureRegion.gameRegion1080PPosClick(Math.round(targetHit.x/s+targetHit.width/s/2), Math.round(targetHit.y/s+targetHit.height/s/2));
                await sleep(1500);
            } else {
                log.warn(`[限时全开] ${targetKeyword}识别失败，点击默认位置`);
                GameCaptureRegion.gameRegion1080PPosClick(defaultX, defaultY);
                await sleep(1500);
            }

            // 第五步：识别限时开放状态
            log.info('[限时全开] 第五步: 识别限时开放状态');
            let limitHit = __wipOcrCheckText([761, 261, 384, 31], ["限时", "开放", "特定秘境"], "限时全开-限时状态");
            if (!limitHit) { log.info('[限时全开] 限时状态识别失败，重试1...'); await sleep(1000); limitHit = __wipOcrCheckText([761, 261, 384, 31], ["限时", "开放", "特定秘境"], "限时全开-限时状态-r1"); }
            if (!limitHit) { log.info('[限时全开] 限时状态识别失败，重试2...'); await sleep(1000); limitHit = __wipOcrCheckText([761, 261, 384, 31], ["限时", "开放", "特定秘境"], "限时全开-限时状态-r2"); }

            const result = limitHit ? true : false;
            const timeText = limitHit ? limitHit.text : "";
            log.info(`[限时全开] 检测结果: ${result ? `有限时开放 [${timeText}]` : '无限时开放'}`);

            try { await genshin.returnMainUi(); } catch(e) { log.warn(`[限时全开] 还原主界面失败: ${e.message}`); }
            await sleep(500);

            return { result: result, timeText: timeText };

        } catch (ex) {
            log.warn(`[限时全开] 检测异常: ${ex.message}`);
            try { await genshin.returnMainUi(); } catch(e2) { log.warn(`[限时全开] 异常后还原主界面失败: ${e2.message}`); }
            await sleep(500);
            return { result: null, timeText: "" };
        }
    }

    function safeNotify(type, message) {
        try {
            if (typeof notification !== "undefined") {
                if (type === "error") {
                    notification.Error(message);
                } else {
                    notification.Send(message);
                }
            }
        } catch (e) {
            log.warn("[通知] 发送通知失败: " + e.message);
        }
    }

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

    // --- 调试模式输出所有用户设置参数 ---
    if (enableDebug) {
        log.info("[DEBUG] ====== 收到用户设置参数 (User Config) ======");
        for (let key in userConfig) {
            log.info(`[DEBUG] ${key}: ${userConfig[key]}`);
        }
        log.info("[DEBUG] ==============================================");
    }

    let pForceRunMode = userConfig.ForceRunMode;
    let pAutoDetectLimitedOpen = userConfig.AutoDetectLimitedOpen;  // 自动识别限时全开
    let pRunUntilDepleted = userConfig.RunUntilResinDepleted;
    let pAutoArtifactSalvage = userConfig.AutoArtifactSalvage;
    let pMaxArtifactStar = userConfig.MaxArtifactStar || "4"; 

    // --- 1.1 秘境目标防呆 ---
    let pTalent = userConfig.TargetTalentMaterialName;
    let pWeapon = userConfig.TargetWeaponMaterialName;
    let pArtifact = userConfig.TargetArtifactName;
    let pAutoSwitchToArtifact = userConfig.AutoSwitchToArtifactWhenNotMatch;
    
    // 检查武器和天赋是否同时选择（始终互斥）
    if (pTalent && pWeapon) {
        log.error("【配置冲突】您同时选择了角色天赋素材和武器升级素材！请只保留一项。");
        return;
    }
    
    // 检查是否选择了任何素材
    let hasTalentOrWeapon = !!pTalent || !!pWeapon;
    let hasArtifact = !!pArtifact;
    
    if (!hasTalentOrWeapon && !hasArtifact) {
        log.error("【配置错误】您未选择任何素材！请至少选择一项。");
        return;
    }
    
    // 当启用"不命中规则时刷取圣遗物"时，允许同时选择圣遗物和武器/天赋
    // 否则，只能选择一项
    if (pAutoSwitchToArtifact) {
        if (!hasTalentOrWeapon || !hasArtifact) {
            log.warn("【配置警告】已勾选'不命中规则时刷取圣遗物'，但未同时选择素材与圣遗物，该选项将被视为未勾选。");
            pAutoSwitchToArtifact = false;
        }
    }
    if (!pAutoSwitchToArtifact && hasTalentOrWeapon && hasArtifact) {
        log.error("【配置冲突】您同时选择了圣遗物和其他素材！请只保留一项，或勾选'不命中规则时刷取圣遗物'并正确配置。");
        return;
    }
    
    // 默认优先使用武器/天赋，没有则使用圣遗物
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
        } else if (/[/:*?"<>|]/.test(pSpecifiedCombatStrategy)) {
            log.warn(`【配置警告】指定的战斗策略名称包含非法字符: ${pSpecifiedCombatStrategy}，系统将自动退回'根据队伍自动选择'。`);
        } else {
            // 自动去除 .txt 后缀（如果存在）
            let strategyName = pSpecifiedCombatStrategy;
            if (strategyName.toLowerCase().endsWith(".txt")) {
                strategyName = strategyName.substring(0, strategyName.length - 4);
            }
            
            // 处理路径分隔符：如果存在单个 \ 则转换为 \\，如果已有 \\ 则保持不变
            if (strategyName.includes("\\") && !strategyName.includes("\\\\")) {
                pCombatStrategyPath = strategyName.replace(/\\/g, "\\\\");
            } else {
                pCombatStrategyPath = strategyName;
            }
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
        safeNotify("info", `任务启动：已自动切换目标秘境为【${pDomainName} - ${pTargetMaterial}】。`);
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

        // --- 日期检查与限时全开检测 ---
        let isLimitedOpen = false;  // 是否检测到限时全开（声明在外部作用域）
        let isSwitchedToArtifact = false;  // 是否已切换到圣遗物
        
        // 圣遗物每日开放，无需日期检查和限时全开检测
        if (materialInfo.type !== 'artifact') {

            if (!isDateOpen) {
                if (pForceRunMode) {
                    // 强制运行模式：直接跳过日期检查（优先级最高）
                    log.warn(`【强制运行】已跳过日期检查，强制进入秘境。`);
                } else if (pAutoDetectLimitedOpen) {
                    // 自动识别限时全开模式：执行OCR检测
                    log.info(`【限时全开检测】日期不匹配，开始检测限时全开活动...`);
                    // 传入目标素材类型，决定点击武器还是天赋
                    const limitedOpenResult = await __detectLimitedOpen(pTalent ? 'talent' : 'weapon');
                    isLimitedOpen = limitedOpenResult.result;
                    const limitedTimeText = limitedOpenResult.timeText;
                    if (isLimitedOpen === true) {
                        log.info(`【限时全开检测】检测到限时全开活动，允许进入秘境。`);
                        safeNotify("info", `[限时全开] 检测结果：有限时开放 [${limitedTimeText}]`);
                    } else if (isLimitedOpen === false) {
                        // 未检测到限时全开，检查是否启用自动切换到圣遗物
                        if (pAutoSwitchToArtifact && pArtifact) {
                            log.warn(`【自动切换】日期不匹配且无限时全开，自动切换到圣遗物【${pArtifact}】。`);
                            // 重新获取圣遗物的信息
                            materialInfo = MATERIAL_DB[pArtifact];
                            pDomainName = materialInfo.domain;
                            pTargetMaterial = pArtifact;
                            pSundaySelectedValue = "";
                            isSwitchedToArtifact = true;
                        } else {
                            log.error(`【停止运行】日期不匹配且未检测到限时全开活动。`);
                            return;
                        }
                    } else {
                        // isLimitedOpen === null，检测异常
                        if (pAutoSwitchToArtifact && pArtifact) {
                            log.warn(`【自动切换】限时全开检测异常，自动切换到圣遗物【${pArtifact}】。`);
                            // 重新获取圣遗物的信息
                            materialInfo = MATERIAL_DB[pArtifact];
                            pDomainName = materialInfo.domain;
                            pTargetMaterial = pArtifact;
                            pSundaySelectedValue = "";
                            isSwitchedToArtifact = true;
                        } else {
                            log.error(`【停止运行】限时全开检测异常，无法确定活动状态。`);
                            return;
                        }
                    }
                } else if (pAutoSwitchToArtifact && pArtifact) {
                    // 未启用自动识别，但启用了自动切换到圣遗物
                    log.warn(`【自动切换】日期不匹配，自动切换到圣遗物【${pArtifact}】。`);
                    // 重新获取圣遗物的信息
                    materialInfo = MATERIAL_DB[pArtifact];
                    pDomainName = materialInfo.domain;
                    pTargetMaterial = pArtifact;
                    pSundaySelectedValue = "";
                    isSwitchedToArtifact = true;
                } else {
                    log.error(`【停止运行】今日非该素材开放日。若需强制运行、自动识别限时全开或自动切换圣遗物，请在设置中勾选。`);
                    return;
                }
            }
        }

        let notifyMsg = `任务启动：今日为游戏内星期${dayStr}，已自动切换目标秘境为【${pDomainName} - ${pTargetMaterial}】。`;
        if (!isDateOpen) {
            if (pForceRunMode) {
                notifyMsg = `任务启动：今日为游戏内星期${dayStr}，日期不匹配，强制运行进入秘境【${pDomainName} - ${pTargetMaterial}】。`;
            } else if (pAutoDetectLimitedOpen && isLimitedOpen) {
                notifyMsg = `任务启动：今日为游戏内星期${dayStr}，日期不匹配，检测到限时全开进入秘境【${pDomainName} - ${pTargetMaterial}】。`;
            } else if (isSwitchedToArtifact) {
                notifyMsg = `任务启动：今日为游戏内星期${dayStr}，日期不匹配，自动切换到圣遗物【${pDomainName} - ${pTargetMaterial}】。`;
            }
        }
        safeNotify("info", notifyMsg);
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
    
    // 调用底层方法以支持路径转换，并将返回值赋予属性
    taskParam.CombatStrategyPath = taskParam.SetCombatStrategyPath(pCombatStrategyPath); 
    
    taskParam.SpecifyResinUse = !pRunUntilDepleted;
    
    // 树脂数量与警告逻辑
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

    // 统一由 priorityList 决定刷取顺序 (包含耗尽模式)
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

            let totalTimeMs = Date.now() - SCRIPT_START_TIME;
            let totalMins = Math.floor(totalTimeMs / 60000);
            let totalSecs = Math.floor((totalTimeMs % 60000) / 1000);
            let timeStr = `${totalMins}分${totalSecs}秒`;
            let extraStr = pAutoArtifactSalvage ? " (已完成圣遗物自动分解)" : "";
            safeNotify("info", `任务完成：今日自动秘境已全数执行完毕！总耗时：${timeStr}。${extraStr}`);

            break; 
        } catch (ex) {
            let msg = ex.message || "";
            
            // --- 战斗策略文件不存在的降级重试逻辑 ---
            if (msg.includes("战斗脚本文件不存在")) {
                if (taskParam.CombatStrategyPath && taskParam.CombatStrategyPath !== "") {
                    log.warn(`[脚本] 找不到指定的战斗策略文件！`);
                    log.warn(`[脚本] 已触发降级机制：退回【根据队伍自动选择】模式，3 秒后重新启动任务...`);
                    safeNotify("info", `警告：找不到指定的战斗策略文件，已触发降级机制，改以【自动匹配队伍】模式接续执行。`);
                    
                    // 调用底层方法正确切换为目录路径，并将返回值赋予属性
                    taskParam.CombatStrategyPath = taskParam.SetCombatStrategyPath(""); 
                    
                    await sleep(3000);
                    continue; 
                } else {
                    log.error("[脚本] 自动匹配战斗脚本失败：请检查 User/AutoFight 目录下是否有 txt 脚本，且脚本内角色是否符合当前队伍。");
                    safeNotify("error", "异常中断：自动匹配战斗脚本失败，请检查 User/AutoFight 目录下的配置，任务已强制停止。");
                    break;
                }
            }

            if (msg.includes("背包物品已满") || msg.includes("未检测到秘境结束")) {
                log.warn(`[脚本] 任务可能已完成，但检测到: ${msg}`);
                safeNotify("error", `异常中断：背包物品可能已满，或无法检测秘境结束状态，自动任务已强制停止。`);
                break; 
            } else if (msg.includes("复苏")) {
                log.warn(`[脚本] 角色死亡，5秒后重试...`);
                await sleep(5000);
                continue;
            } else if (msg.includes("TaskCanceledException")) {
                log.info("[脚本] 任务已取消。");
                break;
            } else if (msg.includes("未找到对应的秘境")) {
                log.error("请等待BetterGI本体更新支持新秘境");
                safeNotify("error", "异常中断：未找到对应的秘境，请等待 BetterGI 更新支持。");
                throw ex;
            } else {
                log.error(`[脚本] 错误: ${msg}`);
                safeNotify("error", `异常中断：发生未知的脚本错误，任务已强制停止。\n详细信息: ${msg.substring(0, 100)}`);
                throw ex; 
            }
        }
    }
})();