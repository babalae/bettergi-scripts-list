(async function () {
    // 秘境坐标数据
    var domainList = [
        { "name": "仲夏庭园", "position": [2492.511, 0, -1559.0781] },
        { "name": "塞西莉亚苗圃", "position": [2256, 0, -238] },
        { "name": "震雷连山密宫", "position": [733.8096, 0, -416.16895] },
        { "name": "铭记之谷", "position": [1701.4146, 0, -662.9004] },
        { "name": "孤云凌霄之处", "position": [-292.23486, 0, -965.48926] },
        { "name": "无妄引咎密宫", "position": [1692.4849, 0, 392.50488] },
        { "name": "华池岩岫", "position": [1290, 0, 1429] },
        { "name": "忘却之峡", "position": [1679.4097, 0, -891.89746] },
        { "name": "太山府", "position": [658, 0, 1168] },
        { "name": "芬德尼尔之顶", "position": [1039.1699, 0, -823.71484] },
        { "name": "山脊守望", "position": [1470.272, 0, -321.72656] },
        { "name": "砂流之庭", "position": [-2399.8633, 0, -4406.427] },
        { "name": "菫色之庭", "position": [-3204.5703, 0, -3933.9707] },
        { "name": "椛染之庭", "position": [-3772.582, 0, -2367.2656] },
        { "name": "沉眠之庭", "position": [-4298.787, 0, -4211.6465] },
        { "name": "岩中幽谷", "position": [-476.8003, 0, 1897.123] },
        { "name": "缘觉塔", "position": [-564.2788, 0, 2211.4712] },
        { "name": "有顶塔", "position": [-1747.3838, 0, 3471.52] },
        { "name": "赤金的城墟", "position": [-1407.8496, 0, 4291.583] },
        { "name": "熔铁的孤塞", "position": [-74.48389, 0, 6053.4297] },
        { "name": "苍白的遗荣", "position": [2988.157959, 389.184509, 4188.811523] },
        { "name": "深潮的余响", "position": [3956.014404, 490.579529, 4702.80127] },
        { "name": "罪祸的终末", "position": [1852.823975, 441.412659, 4726.575195] },
        { "name": "临瀑之城", "position": [2469.4155, 0, 3944.8374] },
        { "name": "褪色的剧场", "position": [1287.5386, 0, 4202.8003] },
        { "name": "蕴火的幽墟", "position": [-1867.7261962891, 217.77606201172, 7793.6870117188] },
        { "name": "深古瞭望所", "position": [-1871.3815917969, 131.88421630859, 8175.0346679688] },
        { "name": "虹灵的净土", "position": [-2421.4799804688, 213.12219238281, 9041.2890625] },
        { "name": "昏识塔", "position": [-93.67, 0, 3015.46] },
        { "name": "荒废砌造坞", "position": [-3378.5, 0, 10535.5] },
        { "name": "霜凝的机枢", "position": [3150.53, 0, 9375.39] },
        { "name": "失落的月庭", "position": [1936.05, 0, 10828.34] },
        { "name": "无光的深都", "position": [1832.2, 0, 9967.05] }
    ];

    // 读取用户配置
    let config = settings;
    let domainName = config.DomainName; // 对应 settings.json 中的 Name

    // 检查是否选择了秘境
    if (!domainName || domainName === "") {
        log.error("请先在配置中选择要前往的秘境！");
        return;
    }

    // 查找秘境信息
    let domainInfo = domainList.find(d => d.name === domainName);
    if (!domainInfo) {
        log.error(`未找到秘境: ${domainName}`);
        return;
    }

    while (true) {
        try {
            log.info(`正在前往: ${domainName}`);
            await genshin.tp(domainInfo.position[2], domainInfo.position[0]);
            await sleep(1000);

            // 移动逻辑
            switch (domainName) {
                case "芬德尼尔之顶":
                case "太山府":
                    break;
                case "无妄引咎密宫":
                    keyDown("a"); await sleep(1500); keyUp("a"); await sleep(500);
                    keyDown("w"); await sleep(500); keyUp("w"); await sleep(500);
                    break;
                case "苍白的遗荣":
                    keyDown("w"); await sleep(1000); keyUp("w"); await sleep(500);
                    keyDown("f"); await sleep(500); keyUp("f"); await sleep(500);
                    break;
                default:
                    keyDown("w"); await sleep(2500); keyUp("w"); await sleep(500);
                    break;
            }

            // --- 配置并执行自动秘境任务 ---
            log.info(`开始配置自动秘境任务...`);
            let task = new SoloTask("AutoDomain");
            
            // 基础信息
            task.DomainName = config.DomainName;
            task.PartyName = config.PartyName || ""; 
            
            // 刷取轮数与特殊设置 (添加 || 0 防止解析失败)
            task.DomainRoundNum = parseInt(config.DomainRoundNum) || 0;
            
            // 处理周日副本序号 (下拉选单逻辑)
            // 直接读取，空字符串代表未选择，UI已移除 "空白" 选项
            task.SundaySelectedValue = config.SundaySelectedValue || "";
            
            // 树脂策略逻辑
            let runUntilDepleted = config.RunUntilResinDepleted;
            task.SpecifyResinUse = !runUntilDepleted;
            
            if (runUntilDepleted) {
                // 刷取至树脂耗尽
                task.ResinPriorityList = ["原粹树脂", "浓缩树脂"];
                log.info("模式: 刷取至树脂耗尽 (优先 原粹 -> 浓缩)");
            } else {
                // 指定次数模式 (使用 || 0 确保数值安全)
                task.OriginalResinUseCount = parseInt(config.OriginalResinUseCount) || 0;
                task.CondensedResinUseCount = parseInt(config.CondensedResinUseCount) || 0;
                task.TransientResinUseCount = parseInt(config.TransientResinUseCount) || 0;
                task.FragileResinUseCount = parseInt(config.FragileResinUseCount) || 0;
                log.info(`模式: 指定次数 (浓缩${task.CondensedResinUseCount}, 原粹${task.OriginalResinUseCount}, 须臾${task.TransientResinUseCount}, 脆弱${task.FragileResinUseCount})`);
            }
            
            // 圣遗物处理
            task.AutoArtifactSalvage = config.AutoArtifactSalvage;
            task.MaxArtifactStar = config.MaxArtifactStar; 
            
            // 其他细节参数 (使用 || 0 确保数值安全)
            task.FightEndDelay = parseInt(config.FightEndDelay) || 5;
            task.ShortMovement = config.ShortMovement;
            task.WalkToF = config.WalkToF;
            task.LeftRightMoveTimes = parseInt(config.LeftRightMoveTimes) || 3;
            task.AutoEat = config.AutoEat;
            task.ReviveRetryCount = parseInt(config.ReviveRetryCount) || 3;

            await dispatcher.runTask(task);
            
            await sleep(500);
            break;

        } catch (ex) {
            if (ex.message && ex.message.includes("检测到复苏界面")) {
                log.info("复活后，继续执行自动秘境。");
                continue;
            } else {
                throw ex;
            }
        }
    }
})();