//当前js版本1.19.0

let timeMoveUp;
let timeMoveDown;
const accountName = settings.accountName || "默认账户";

let pickup_Mode;
let dumpers;

let gameRegion;
let targetItemPath = "assets/targetItems";

let itemFullTemplate = file.ReadImageMatSync("assets/itemFull.png");
let frozenTemplate = file.ReadImageMatSync("assets/解除冰冻.png");
const frozenRo = RecognitionObject.TemplateMatch(frozenTemplate, 1379, 574, 1463 - 1379, 613 - 574);
let cookingTemplate = file.ReadImageMatSync("assets/烹饪界面.png");
const cookingRo = RecognitionObject.TemplateMatch(cookingTemplate, 1547, 965, 1815 - 1547, 1059 - 965);
cookingRo.Threshold = 0.95;
cookingRo.InitTemplate();
let whiteFurinaTemplate = file.ReadImageMatSync("assets/白芙图标.png");
let whiteFurinaRo = RecognitionObject.TemplateMatch(whiteFurinaTemplate, 1634, 967, 1750 - 1634, 1070 - 967);
whiteFurinaRo.Threshold = 0.99;
whiteFurinaRo.InitTemplate();

let fIcontemplate = file.ReadImageMatSync('assets/F_Dialogue.png');
let fIconRo = RecognitionObject.TemplateMatch(fIcontemplate, 1102, 335, 34, 400);
fIconRo.Threshold = 0.95;
fIconRo.InitTemplate();

let mainUITemplate = file.ReadImageMatSync("assets/MainUI.png");
const mainUIRo = RecognitionObject.TemplateMatch(mainUITemplate, 0, 0, 150, 150);


let targetItems;
let doFurinaSwitch = false;

let findFInterval = (+settings.findFInterval || 100);
if (findFInterval < 16) {
    findFInterval = 16;
}
if (findFInterval > 200) {
    findFInterval = 200;
}
let lastRoll = new Date();
let checkDelay = Math.round(findFInterval / 2);
let rollingDelay = (+settings.rollingDelay || 32);
const pickupDelay = (+settings.pickupDelay || 100);
const timeMove = (+settings.timeMove || 1000);

let warnMessage = [];
let blacklist = [];
let blacklistSet = new Set();
let state;

let pathings;
let localeWorks;

let priorityTags;
let excludeTags;

let runningFailCount = 0;

let lastEatBuff = 0;

(async function () {
    if (settings.groupIndex === "路径组一") {
        const cfg = {
            tagsForGroup1: settings.tagsForGroup1 || "",
            tagsForGroup2: settings.tagsForGroup2 || "",
            tagsForGroup3: settings.tagsForGroup3 || "",
            tagsForGroup4: settings.tagsForGroup4 || "",
            tagsForGroup5: settings.tagsForGroup5 || "",
            tagsForGroup6: settings.tagsForGroup6 || "",
            tagsForGroup7: settings.tagsForGroup7 || "",
            tagsForGroup8: settings.tagsForGroup8 || "",
            tagsForGroup9: settings.tagsForGroup9 || "",
            tagsForGroup10: settings.tagsForGroup10 || "",
            disableSelfOptimization: settings.disableSelfOptimization ?? false,
            eEfficiencyIndex: settings.eEfficiencyIndex ?? 2.5,
            mEfficiencyIndex: settings.mEfficiencyIndex ?? 0.5,
            splitFactor: settings.splitFactor ?? 0,
            targetEliteNum: settings.targetEliteNum ?? 400,
            targetMonsterNum: settings.targetMonsterNum ?? 2000,
            priorityTags: settings.priorityTags ?? "",
            excludeTags: settings.excludeTags ?? "",
            curiosityFactor: settings.curiosityFactor ?? "0"
        };
        const cfgStr = JSON.stringify(cfg, null, 2);
        if (cfgStr.includes("莫酱") || cfgStr.includes("汐酱")) {
            log.error("路线选择与分组配置中包含关键词（莫酱/汐酱），强制终止！");
            return;
        }

        /* 校验通过，正常写文件 */
        const filePath = `settings/${accountName}.json`;
        file.writeText(filePath, cfgStr, false);
    } else {
        let cfg;
        try {
            const raw = await file.readText(`settings/${accountName}.json`);
            cfg = JSON.parse(raw);
        } catch (error) {
            log.error(`配置文件settings/${accountName}.json不存在，请先在路径组一的配置组运行一次`);
            await sleep(10000);
            return;
        }
        settings.tagsForGroup1 = cfg.tagsForGroup1 ?? "";
        settings.tagsForGroup2 = cfg.tagsForGroup2 ?? "";
        settings.tagsForGroup3 = cfg.tagsForGroup3 ?? "";
        settings.tagsForGroup4 = cfg.tagsForGroup4 ?? "";
        settings.tagsForGroup5 = cfg.tagsForGroup5 ?? "";
        settings.tagsForGroup6 = cfg.tagsForGroup6 ?? "";
        settings.tagsForGroup7 = cfg.tagsForGroup7 ?? "";
        settings.tagsForGroup8 = cfg.tagsForGroup8 ?? "";
        settings.tagsForGroup9 = cfg.tagsForGroup9 ?? "";
        settings.tagsForGroup10 = cfg.tagsForGroup10 ?? "";
        settings.disableSelfOptimization = cfg.disableSelfOptimization ?? false;
        settings.eEfficiencyIndex = cfg.eEfficiencyIndex ?? 2.5;
        settings.mEfficiencyIndex = cfg.mEfficiencyIndex ?? 0.5;
        settings.splitFactor = cfg.splitFactor ?? 0;
        settings.targetEliteNum = cfg.targetEliteNum ?? 400;
        settings.targetMonsterNum = cfg.targetMonsterNum ?? 2000;
        settings.priorityTags = cfg.priorityTags ?? "";
        settings.excludeTags = cfg.excludeTags ?? "";
        settings.curiosityFactor = cfg.curiosityFactor ?? "0";
    }

    //自定义配置处理
    const operationMode = settings.operationMode || "运行锄地路线";
    pickup_Mode = settings.pickup_Mode || "模板匹配拾取，拾取狗粮和怪物材料";
    targetItems = await loadTargetItems();
    if (settings.activeDumperMode) { //处理泥头车信息
        dumpers = settings.activeDumperMode.split('，').map(Number).filter(num => num === 1 || num === 2 || num === 3 || num === 4);
    } else {
        dumpers = [];
    }

    priorityTags = (settings.priorityTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);
    excludeTags = (settings.excludeTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);

    localeWorks = !isNaN(Date.parse(new Date().toLocaleString()));
    if (!localeWorks) {
        log.warn('[WARN] 当前设备本地时间格式无法解析');
        log.warn('[WARN] 建议不要使用12小时时间制');
        log.warn('[WARN] 已将记录改为使用utc时间');
        await sleep(5000);
    }

    let k1 = +settings.eEfficiencyIndex || 2.5;
    // 空字符串、null、undefined 或非数字 → 2.5
    if (k1 === '' || k1 == null || Number.isNaN(Number(k1))) {
        k1 = 2.5;
    } else {
        k1 = Number(k1);
        if (k1 < 0) k1 = 0;
        else if (k1 > 10) k1 = 10;
    }

    let k2 = +settings.mEfficiencyIndex || 0.5;
    // 空字符串、null、undefined 或非数字 → 0.5
    if (k2 === '' || k2 == null || Number.isNaN(Number(k2))) {
        k2 = 0.5;
    } else {
        k2 = Number(k2);
        if (k2 < 0) k2 = 0;
        else if (k2 > 4) k2 = 4;
    }

    let targetEliteNum = (+settings.targetEliteNum || 400);
    targetEliteNum += 5;//预留漏怪
    let targetMonsterNum = (+settings.targetMonsterNum + 1 || 2000);
    targetMonsterNum += 25;//预留漏怪
    const partyName = settings.partyName || "";

    //读取 settings（没有时用默认值）
    const groupSettings = Array.from({ length: 10 }, (_, i) =>
        settings[`tagsForGroup${i + 1}`] || (i === 0 ? '蕈兽' : '') // 第 0 组默认“蕈兽”，其余默认空串
    );
    const groupTags = groupSettings.map(str => str.split('，').filter(Boolean));
    groupTags[0] = [...new Set(groupTags.flat())];

    if (pickup_Mode != "模板匹配拾取，拾取狗粮和怪物材料" && pickup_Mode != "模板匹配拾取，只拾取狗粮") {
        excludeTags.push("沙暴");
        log.warn("拾取模式不是模板匹配，无法处理沙暴路线，自动排除所有沙暴路线");
    }

    await loadBlacklist(true);

    timeMoveUp = Math.round(timeMove * 0.45);
    timeMoveDown = Math.round(timeMove * 0.55);
    if (!settings.accountName) {
        warnMessage.push("请先阅读js文件夹中的【README.md】后使用");
        for (let i = 0; i < 5; i++) {
            // 原始文本
            let originalMessage = "   请先阅读js文件夹中的【README.md】后使用";
            // 计算轮替的偏移量，每次循环偏移一位
            let offset = i % originalMessage.length; // 每次循环偏移一位
            // 构造轮替后的文本
            let message = originalMessage.slice(-offset) + originalMessage.slice(0, -offset);
            // 输出内容
            log.error(message);
            await sleep(500);
        }
    }

    //预处理路线并建立对象
    pathings = await processPathings(groupTags);

    //按照用户配置标记路线
    await markPathings(pathings, groupTags, priorityTags, excludeTags);

    //找出最优组合
    await findBestRouteGroups(pathings, k1, k2, targetEliteNum, targetMonsterNum);

    //分配到不同路径组
    await assignGroups(pathings, groupTags);

    //根据操作模式选择不同的处理方式
    if (operationMode === "调试路线分配") {
        log.info("开始复制并输出地图追踪文件\n请前往js文件夹查看");
        await copyPathingsByGroup(pathings);
        await updateRecords(pathings, accountName);
    } else if (operationMode === "运行锄地路线") {
        await switchPartyIfNeeded(partyName);

        const avatars = Array.from(getAvatars?.() || []);

        let teamStr = '';
        for (let k = 0; k < avatars.length; k++) {
            teamStr += avatars[k];
            if (k < avatars.length - 1) teamStr += '、';
        }
        log.info('当前队伍：' + teamStr);
        let haveProblem = false;

        if (settings.skipCheck) {
            log.warn("确认跳过校验阶段，任何包括但不限于漏怪、卡死、不拾取等问题均由自己配置与队伍等引起，与脚本和路线无关");
        } else {
            if (targetEliteNum <= 350 && targetMonsterNum >= 100) {
                log.warn("目标怪物数量配置不合理，请重新阅读 readme 相关部分");
                await sleep(5000);
                haveProblem = true;
            }
            if (genshin.width !== 1920 || genshin.height !== 1080) {
                log.warn("游戏窗口非 1920×1080，可能导致图像识别失败，造成拾取等行为异常");
                await sleep(5000);
                haveProblem = true;
            }
            if (avatars.includes('钟离')) {
                log.warn("当前队伍包含钟离，请重新阅读 readme 相关部分");
                await sleep(5000);
                haveProblem = true;
            }
            if (!['芙宁娜', '爱可菲'].some(n => avatars.includes(n))) {
                log.warn("未携带合适的输出角色（芙宁娜/爱可菲），建议重新阅读 readme 相关部分");
                await sleep(5000);
                haveProblem = true;
            }
            if (!['茜特菈莉', '伊涅芙', '莱依拉', '蓝砚', '琦良良', '迪希雅', '迪奥娜']
                .some(n => avatars.includes(n))) {
                log.warn("未携带合适的抗打断角色（茜特菈莉/伊涅芙/莱依拉/蓝砚/白术/琦良良/迪希雅/迪奥娜）");
                await sleep(5000);
                haveProblem = true;
            }
            if (haveProblem) {
                log.warn("校验未通过，请按照以上提示修改，或者在自定义配置中勾选以跳过校验阶段");
                await sleep(5000);
                log.warn("校验未通过，请按照以上提示修改，或者在自定义配置中勾选以跳过校验阶段");
                await sleep(5000);
                log.warn("校验未通过，请按照以上提示修改，或者在自定义配置中勾选以跳过校验阶段");
                await sleep(5000);
                log.warn("继续运行视为同意以下免责声明：任何包括但不限于漏怪、卡死、不拾取等问题均由自己配置与队伍等引起，与脚本和路线无关");
            }
        }
        if (['钟离', '芙宁娜', '纳西妲', '雷电将军'].every(n => avatars.includes(n))) {
            log.warn("禁止使用四神队，请重新阅读 readme 相关部分");
            await sleep(5000);
            return;
        }
        log.info("开始运行锄地路线");
        await updateRecords(pathings, accountName);
        await processPathingsByGroup(pathings, accountName);
    } else {
        log.info("强制刷新所有运行记录");
        await initializeCdTime(pathings, "");
        await updateRecords(pathings, accountName);
    }
})();

//预处理路线，建立对象
async function processPathings(groupTags) {
    // 读取怪物信息
    const monsterInfoContent = await file.readText("assets/monsterInfo.json");
    const monsterInfoObject = JSON.parse(monsterInfoContent);

    // 读取路径文件夹中的所有文件
    let pathings = await readFolder("pathing", true);

    //加载路线cd信息
    await initializeCdTime(pathings, accountName);

    // 定义解析 description 的函数
    function parseDescription(desc) {
        const routeInfo = {
            time: 60, // 预计用时初始化为60秒
            monsterInfo: {}
        };

        // 正则表达式匹配预计用时
        const timeMatch = desc.match(/预计用时([\d\.]+)秒/);
        if (timeMatch) {
            routeInfo.time = parseFloat(timeMatch[1]);
        }

        // 正则表达式匹配怪物信息
        const monsterMatch = desc.match(/包含以下怪物：(.*?)。/);
        if (monsterMatch) {
            const monsterList = monsterMatch[1].split('、');
            monsterList.forEach(monsterStr => {
                const [countStr, monsterName] = monsterStr.split('只');
                const count = Math.ceil(parseFloat(countStr.trim()) || 0);
                routeInfo.monsterInfo[monsterName.trim()] = count;
            });
        }

        return routeInfo;
    }
    let index = 0

    // 遍历每个路径文件并处理
    for (const pathing of pathings) {
        index++;
        pathing.index = index;
        const pathingContent = await file.readText(pathing.fullPath);
        const parsedContent = JSON.parse(pathingContent);
        const description = parsedContent.info?.description || "";
        pathing.tags = parsedContent.info?.tags || [];

        // 解析 description 获取预计用时和怪物信息
        const routeInfo = parseDescription(description);

        //pathing 对象的属性
        pathing.t = routeInfo.time; // description 中有值则覆盖
        pathing.monsterInfo = routeInfo.monsterInfo;

        pathing.m = 0; // 普通怪物数量
        pathing.e = 0; // 精英怪物数量
        pathing.mora_m = 0; // 普通怪物摩拉值
        pathing.mora_e = 0; // 精英怪物摩拉值

        // 处理怪物信息
        for (const [monsterName, count] of Object.entries(routeInfo.monsterInfo)) {
            const monster = monsterInfoObject.find(m => m.name === monsterName);

            if (monster) {
                if (monster.type === "普通") {
                    pathing.m += count; // 增加普通怪物数量
                    pathing.mora_m += count * 40.5 * monster.moraRate; // 增加普通怪物摩拉值
                } else if (monster.type === "精英") {
                    pathing.e += count; // 增加精英怪物数量
                    pathing.mora_e += count * 200 * monster.moraRate; // 增加精英怪物摩拉值

                }

                if (monster.moraRate > 1) {
                    pathing.tags.push('高收益');
                    if (monster.type === "精英") {
                        pathing.tags.push('精英高收益');
                    }
                }

                // 添加标签
                if (monster.tags && monster.tags.length > 0) {
                    pathing.tags.push(...monster.tags);
                }
            }
        }

        const allTags = groupTags[0];          // 已经是 [...new Set(...)] 的结果
        // 2. 待匹配文本：路径名 + 描述
        const textToMatch = (pathing.fullPath + " " + (description || ""));
        // 3. 反查补 tag
        allTags.forEach(tag => {
            if (textToMatch.includes(tag)) {
                pathing.tags.push(tag);
            }
        });

        // 去除重复标签
        pathing.tags = [...new Set(pathing.tags)];
        // 处理 map_name 属性
        pathing.map_name = parsedContent.info?.map_name || "Teyvat"; // 如果有 map_name，则使用其值，否则默认为 "Teyvat"
    }

    for (const pathing of pathings) {
        if (!settings.disableSelfOptimization && pathing.records) {
            // 1. 安全解析 + 边界校验
            let cf = 0; // 默认
            if (settings?.curiosityFactor != null) {
                const parsed = parseFloat(String(settings.curiosityFactor));
                if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) cf = parsed;
            }

            // 2. 构造 7 条内部样本
            const raw = Array.isArray(pathing.records) ? pathing.records.filter(v => v > 0) : [];
            const pool = [];
            for (let i = 0; i < 7; i++) {
                pool.push(i < raw.length ? raw[i] : pathing.t * (1 - cf)); // 补齐时带好奇系数
            }

            // 3. 削峰填谷 → 均值
            const copy = [...pool];
            const max = Math.max(...copy);
            const min = Math.min(...copy);
            const maxIdx = copy.indexOf(max);
            const minIdx = copy.indexOf(min);
            if (maxIdx > -1) copy.splice(maxIdx, 1);
            if (minIdx > -1 && copy.length) copy.splice(copy.indexOf(min), 1);

            const avg = copy.reduce((a, b) => a + b, 0) / copy.length;
            pathing.t = avg;
        }
    }
    return pathings; // 返回处理后的 pathings 数组
}

async function markPathings(pathings, groupTags, priorityTags, excludeTags) {
    // 取出第 0 组并剔除与其他 9 组重复的标签
    const uniqueTags = groupTags[0].filter(tag =>
        !groupTags.slice(1).some(arr => arr.includes(tag))
    );

    pathings.forEach(pathing => {
        pathing.tags = pathing.tags || [];
        pathing.monsterInfo = pathing.monsterInfo || {};
        pathing.prioritized = false;

        const containsUniqueTag = uniqueTags.some(uniqueTag => pathing.tags.includes(uniqueTag));

        const containsExcludeTag = excludeTags.some(excludeTag => {
            const fullPathContainsExcludeTag = pathing.fullPath && pathing.fullPath.includes(excludeTag);
            const tagsContainExcludeTag = pathing.tags.some(tag => tag.includes(excludeTag));
            const monsterInfoContainsExcludeTag = Object.keys(pathing.monsterInfo).some(monsterName => monsterName.includes(excludeTag));
            return fullPathContainsExcludeTag || tagsContainExcludeTag || monsterInfoContainsExcludeTag;
        });

        const containsPriorityTag = priorityTags.some(priorityTag => {
            const fullPathContainsPriorityTag = pathing.fullPath && pathing.fullPath.includes(priorityTag);
            const tagsContainPriorityTag = pathing.tags.some(tag => tag.includes(priorityTag));
            const monsterInfoContainsPriorityTag = Object.keys(pathing.monsterInfo).some(monsterName => monsterName.includes(priorityTag));
            return fullPathContainsPriorityTag || tagsContainPriorityTag || monsterInfoContainsPriorityTag;
        });

        pathing.available = !(containsUniqueTag || containsExcludeTag);
        pathing.prioritized = containsPriorityTag;
    });
}

async function findBestRouteGroups(pathings, k1, k2, targetEliteNum, targetMonsterNum) {
    /* ========== 0. 原初始化不动 ========== */
    let nextTargetEliteNum = targetEliteNum;
    let iterationCount = 0;

    let totalSelectedElites = 0;
    let totalSelectedMonsters = 0;
    let totalGainCombined = 0;
    let totalTimeCombined = 0;
    let monsterRouteElite = 0;

    let maxE1 = 0, maxE2 = 0;
    const ratio = targetEliteNum / Math.max(targetMonsterNum, 1);   // 防 0
    const f = (Number((1 - Math.exp(-ratio * ratio)).toFixed(3)) + 1) / 2;

    pathings.forEach(p => {
        p.selected = false;
        const G1 = p.mora_e + p.mora_m, G2 = p.mora_m;
        p.G1 = G1; p.G2 = G2;

        /* 分离系数 0-1：0 无惩罚，1 最大惩罚 95 % */
        const splitFactor = +(settings.splitFactor ?? 0);

        /* 混合度：纯血 λ=0，最混合 λ=1 */
        const λ = (p.e === 0 || p.m === 0) ? 0
            : 1 - Math.min(p.e, p.m) / Math.max(p.e, p.m);

        /* 仅 E2 惩罚，上限 95 %，线性 */
        const penalty = 1 - 0.95 * splitFactor * λ;

        /* 收益 */
        const eliteGain = p.e === 0 ? 200 : (G1 - G2) / p.e;
        const normalGain = p.m === 0 ? 40.5 : G2 / p.m;

        /* 打分：E1 不惩罚，E2 带惩罚 */
        p.E1 = (eliteGain ** k1) * (G1 / p.t);
        if (p.e === 0) p.E1 = 0;

        p.E2 = (normalGain ** k2) * (G2 / p.t) * penalty;

        maxE1 = Math.max(maxE1, p.E1);
        maxE2 = Math.max(maxE2, p.E2);
    });

    pathings.forEach(p => {
        if (p.prioritized) { p.E1 += maxE1; p.E2 += maxE2; }
    });

    /* ========== 1. 原两轮选择逻辑照搬，只是去掉“提前 break” ========== */
    function selectRoutesByEliteTarget(targetEliteNum) {
        pathings.forEach(p => p.selected = false);
        totalSelectedElites = 0; totalSelectedMonsters = 0;
        totalGainCombined = 0; totalTimeCombined = 0;

        pathings.sort((a, b) => b.E1 - a.E1);
        for (const p of pathings) {
            if (p.E1 > 0 && p.available &&
                (totalSelectedElites + p.e <= targetEliteNum + 2)) { // 留一点余量
                p.selected = true;
                totalSelectedElites += p.e;
                totalSelectedMonsters += p.m;
                totalGainCombined += p.G1;
                totalTimeCombined += p.t;
            }
        }
    }

    function selectRoutesByMonsterTarget(targetMonsterNum) {
        monsterRouteElite = 0;
        pathings.sort((a, b) => b.E2 - a.E2);
        for (const p of pathings) {
            if (p.E2 > 0 && p.available && !p.selected &&
                (totalSelectedMonsters + p.m < targetMonsterNum + 5)) {
                p.selected = true;
                totalSelectedElites += p.e; monsterRouteElite += p.e;
                totalSelectedMonsters += p.m;
                totalGainCombined += p.G2;
                totalTimeCombined += p.t;
            }
        }
    }

    /* ========== 2. 迭代：直到“双达标”才停 ========== */
    while (iterationCount < 100) {
        selectRoutesByEliteTarget(nextTargetEliteNum);
        selectRoutesByMonsterTarget(targetMonsterNum);

        // 新收敛条件：必须同时大于等于双目标
        if (totalSelectedElites >= targetEliteNum &&
            totalSelectedMonsters >= targetMonsterNum) {
            break;
        }
        // 只要没达标，就加压：把精英目标向上推
        const eliteShort = targetEliteNum - totalSelectedElites;
        nextTargetEliteNum += Math.max(1, Math.round(0.1 * eliteShort));
        iterationCount++;
    }

    /* ========== 3. 最小不可再减集合（贪心逆筛，不碰优先路线） ========== */
    // 1. 只留非优先的已选路线，按性价比升序排
    const selectedList = pathings
        .filter(p =>
            p.selected &&
            !p.prioritized &&
            !p.tags.includes('精英高收益')
        )
        .sort((a, b) => {
            const score = p => {
                const eliteGain = p.e === 0 ? 200 : (p.G1 - p.G2) / p.e;
                const normalGain = p.m === 0 ? 40.5 : p.G2 / p.m;
                const perSec = p.t === 0 ? 0 : p.G1 / p.t;
                return ((eliteGain / 200) ** k1 + (normalGain / 40.5) ** k2) * perSec;
            };
            return score(a) - score(b);   // 升序：差的先删
        });

    // 2. 试删
    for (const p of selectedList) {
        const newE = totalSelectedElites - p.e;
        const newM = totalSelectedMonsters - p.m;
        if (newE >= targetEliteNum && newM >= targetMonsterNum) {
            p.selected = false;
            totalSelectedElites = newE;
            totalSelectedMonsters = newM;
            totalGainCombined -= p.G1;
            totalTimeCombined -= p.t;
        }
    }

    /* ========== 4. 小怪标签 & 排序 & 日志，保持原样 ========== */
    pathings.forEach(p => {
        if (p.selected && p.e === 0 &&
            !p.tags.includes("传奇") && !p.tags.includes("高危")) {
            p.tags.push("小怪");
        }
    });

    switch (settings.sortMode) {
        case "效率降序":
            log.info("使用效率降序运行");
            pathings.sort((a, b) => b.E1 - a.E1 || b.E2 - a.E2);
            break;

        case "高收益优先":
            log.info("使用高收益优先运行");
            pathings.sort((a, b) => {
                const aHigh = a.tags.includes("高收益") ? 1 : 0;
                const bHigh = b.tags.includes("高收益") ? 1 : 0;
                return bHigh - aHigh || a.index - b.index; // 有标签的在前，同标签按原顺序
            });
            break;

        default:
            log.info("使用原文件顺序运行");
            pathings.sort((a, b) => a.index - b.index);
    }

    log.info(`总精英怪数量: ${totalSelectedElites.toFixed(0)}`);
    log.info(`总普通怪数量: ${totalSelectedMonsters.toFixed(0)}`);
    log.info(`总收益: ${totalGainCombined.toFixed(0)} 摩拉`);
    const h = Math.floor(totalTimeCombined / 3600);
    const m = Math.floor((totalTimeCombined % 3600) / 60);
    const s = totalTimeCombined % 60;
    log.info(`预计总用时: ${h} 时 ${m} 分 ${s.toFixed(0)} 秒`);
    if (totalSelectedElites < targetEliteNum || totalSelectedMonsters < targetMonsterNum || totalSelectedElites > targetEliteNum * 1.1) {
        log.warn("警告，可能条件填写不合理，分配结果与目标存在较大差异");
        await sleep(5000);
    }
}

async function assignGroups(pathings, groupTags) {
    // 遍历 pathings 数组
    pathings.forEach(pathing => {
        if (pathing.selected) {
            pathing.group = 0;

            if (!groupTags[0].some(tag => pathing.tags.includes(tag))) {
                pathing.group = 1;
            } else {
                // 依次判断 groupTags[1] ~ groupTags[9]
                for (let i = 1; i <= 9; i++) {
                    if (groupTags[i].some(tag => pathing.tags.includes(tag))) {
                        pathing.group = i + 1;
                        break;
                    }
                }
            }
        }
    });
}

async function runPath(fullPath, map_name, pm, pe) {
    if (settings.logMonsterCount) {
        const m = Math.floor(pm); // 取整
        const e = Math.floor(pe); // 取整
        for (let i = 0; i < m; i++) log.debug('交互或拾取："小怪"');
        for (let i = 0; i < e; i++) log.debug('交互或拾取："精英"');
    }
    //当需要切换芙宁娜形态时，执行一次强制黑芙
    if (doFurinaSwitch) {
        log.info("上条路线识别到白芙，开始强制切换黑芙")
        doFurinaSwitch = false;
        await pathingScript.runFile("assets/强制黑芙.json");
    }
    if (settings.eatBuff) {
        const res = settings.eatBuff.split('，');
        if (new Date() - lastEatBuff > 300 * 1000) {
            lastEatBuff = new Date();
            await genshin.returnMainUi();
            keyPress("B");
            await clickPNG("料理界面");
            // 2. 遍历数组，逐项执行
            for (const item of res) {
                await sleep(800);
                await clickPNG('筛选1', 1);
                await clickPNG('筛选2', 1);
                await clickPNG('重置');
                await sleep(500);
                await clickPNG('搜索');
                await sleep(800);
                // 真正输入当前这一项
                log.info(`搜索${item}`)
                inputText(item);

                await clickPNG('确认筛选');
                await sleep(500);
                await clickPNG('使用');
            }
            await genshin.returnMainUi();
        }

    }
    /* ===== 1. 取得当前路线对象 ===== */
    let currentPathing = null;
    for (let i = 0; i < pathings.length; i++) {
        if (pathings[i].fullPath === fullPath) {
            currentPathing = pathings[i];
            break;
        }
    }
    if (currentPathing.tags) {
        if (currentPathing.tags.includes("水下")) {
            log.info("当前路线为水下路线，检查螃蟹技能");
            let skillRes = await findPNG("螃蟹技能图标");
            if (!skillRes) {
                log.info("识别到没有螃蟹技能，前往获取");
                await pathingScript.runFile("assets/学习螃蟹技能.json");
            }
        }
    }

    /* ===== 2. 重排 targetItems：当前路线拾取过的提前 ===== */
    if (targetItems && currentPathing && currentPathing.items && currentPathing.items.length) {
        // 用对象当 Set 做 O(1) 查询
        const history = {};
        for (let i = 0; i < currentPathing.items.length; i++) {
            history[currentPathing.items[i]] = true;
        }
        // 排序：命中历史 -> 提前，其余保持原序
        targetItems.sort(function (a, b) {
            const aHit = history[a.itemName] ? 1 : 0;
            const bHit = history[b.itemName] ? 1 : 0;
            return bHit - aHit;   // 1 在前，0 在后
        });
    }

    /* ===== 3. 原逻辑不变 ===== */
    state = { running: true, currentPathing: currentPathing };

    /* ---------- 主任务 ---------- */
    const pathingTask = (async () => {
        log.info(`开始执行路线: ${fullPath}`);
        await fakeLog(`${fullPath}`, false, true, 0);
        try {
            await pathingScript.runFile(fullPath);
        } catch (error) {
            log.error(`执行地图追踪出现错误${error.message}`);
        }
        await fakeLog(`${fullPath}`, false, false, 0);
        state.running = false;
    })();

    /* ---------- 伴随任务 ---------- */
    const pickupTask = (async () => {
        if (pickup_Mode != "不拾取任何物品") {
            await recognizeAndInteract();
        }
    })();

    const errorProcessTask = (async () => {
        let errorProcessCount = 0;
        async function checkRo(recognitionObject) {
            const maxAttempts = 1;
            let attempts = 0;
            let errorProcessGameRegion;
            while (attempts < maxAttempts && state.running) {
                try {
                    errorProcessGameRegion = captureGameRegion();
                    const result = errorProcessGameRegion.find(recognitionObject);
                    errorProcessGameRegion.dispose();
                    if (result.isExist()) {
                        return true;
                    }
                } catch (error) {
                    log.error(`识别图像时发生异常: ${error.message}`);
                    if (!state.running) break;
                    return false;
                }
                attempts++;
            }
            return false;
        }
        while (state.running) {
            if (errorProcessCount % 5 === 0) {
                //每约250毫秒进行一次冻结检测和白芙检测
                if (await checkRo(frozenRo)) {
                    log.info("检测到冻结，尝试挣脱");
                    for (let m = 0; m < 3; m++) {
                        keyPress("VK_SPACE");
                        await sleep(30);
                    }
                    continue;
                }
                if (!doFurinaSwitch) {
                    if (await checkRo(whiteFurinaRo)) {
                        log.info("检测到白芙，本路线运行结束后切换芙宁娜形态");
                        doFurinaSwitch = true;
                        continue;
                    }
                }
            }
            if (errorProcessCount % 100 === 0) {
                //每约5000毫秒进行一次烹饪检测
                if (await checkRo(cookingRo)) {
                    log.info("检测到烹饪界面，尝试脱离");
                    keyPress("VK_ESCAPE");
                    await sleep(500);
                    continue;
                }
            }
            errorProcessCount++;
            await sleep(45);
        }
    })();

    const blacklistTask = (async () => {
        async function checkItemFull() {
            const maxAttempts = 1;
            let attempts = 0;
            while (attempts < maxAttempts && state.running) {
                try {
                    const recognitionObject = RecognitionObject.TemplateMatch(itemFullTemplate, 0, 0, 1920, 1080);
                    gameRegion.dispose();
                    gameRegion = captureGameRegion();
                    const result = gameRegion.find(recognitionObject);
                    if (result.isExist()) {
                        return true;
                    }
                } catch (error) {
                    log.error(`识别图像时发生异常: ${error.message}`);
                    if (!state.running) break;
                    return false;
                }
                attempts++;
            }
            return false;
        }

        /**
         * 计算匹配度：itemName中文部分在识别文本中出现的最长长度占总长度的比例
         * @param {string} cnPart itemName的中文部分
         * @param {string} ocrText OCR识别到的文本
         * @returns {number} 0~1
         */
        function calcMatchRatio(cnPart, ocrText) {
            if (!cnPart || !ocrText) return 0;
            const len = cnPart.length;
            let maxMatch = 0;
            // 滑动窗口找最长连续子串
            for (let i = 0; i <= ocrText.length - len; i++) {
                let match = 0;
                for (let j = 0; j < len; j++) {
                    if (ocrText[i + j] === cnPart[j]) match++;
                }
                maxMatch = Math.max(maxMatch, match);
            }
            return maxMatch / len;
        }

        if (pickup_Mode === "模板匹配拾取，拾取狗粮和怪物材料" || pickup_Mode === "模板匹配拾取，只拾取狗粮") {
            while (state.running) {
                await sleep(1500);
                if (await checkItemFull()) {
                    const TEXT_X = 560, TEXT_Y = 450, TEXT_W = 1360 - 560, TEXT_H = 620 - 450;
                    let ocrText = null;
                    try {
                        const resList = gameRegion.findMulti(
                            RecognitionObject.ocr(TEXT_X, TEXT_Y, TEXT_W, TEXT_H)
                        );
                        if (resList.count) {
                            let longest = resList[0];
                            for (let i = 1; i < resList.count; i++) {
                                if (resList[i].text.length > longest.text.length) longest = resList[i];
                            }
                            ocrText = longest.text.replace(/[^\u4e00-\u9fa5]/g, '');
                        }
                    } catch (e) {
                        log.error(`OCR异常: ${e.message}`);
                    }

                    if (ocrText) {
                        log.info(`识别到背包已满，识别到文本：${ocrText}`);
                        const ratioMap = new Map(); // itemName -> ratio

                        for (const targetItem of targetItems) {
                            const cnPart = targetItem.itemName.replace(/[^\u4e00-\u9fa5]/g, '');
                            const ratio = calcMatchRatio(cnPart, ocrText);
                            if (ratio > 0.75) {
                                ratioMap.set(targetItem.itemName, ratio);
                            }
                        }

                        if (ratioMap.size > 0) {
                            // 找出最大匹配度
                            const maxRatio = Math.max(...ratioMap.values());
                            // 所有等于最大匹配度的项
                            const names = Array.from(ratioMap.entries())
                                .filter(([, r]) => r === maxRatio)
                                .map(([n]) => n)
                                .sort(); // 排序方便日志

                            log.warn(`以下物品匹配度最高且≥75%（${(maxRatio * 100).toFixed(1)}%），加入黑名单：${names.join('、')}`);
                            for (const nm of names) {
                                if (!blacklistSet.has(nm)) {
                                    blacklistSet.add(nm);
                                    blacklist.push(nm);
                                }
                            }
                            await loadBlacklist(false);
                        }
                    }
                }
            }
        }
    })();

    /* ---------- 泥头车任务 ---------- */
    let dumperTask = null;
    if (dumpers.length > 0) {
        dumperTask = dumper(fullPath, map_name);
    }

    /* ---------- 并发等待 ---------- */
    await Promise.allSettled([
        pathingTask,
        pickupTask,
        errorProcessTask,
        blacklistTask,
        dumperTask
    ].filter(Boolean));
}

// 定义一个函数用于拾取
async function recognizeAndInteract() {
    //log.info("调试-开始执行图像识别与拾取任务");
    let lastcenterYF = 0;
    let lastItemName = "";
    let thisMoveUpTime = 0;
    let lastMoveDown = 0;
    gameRegion = captureGameRegion();
    let itemName;
    //主循环
    while (state.running) {
        gameRegion.dispose();
        gameRegion = captureGameRegion();
        let centerYF = await findFIcon();

        if (!centerYF) {
            if (await isMainUI()) {
                if (new Date() - lastRoll >= 200) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                    lastRoll = new Date();
                }
            }
            continue;
        }
        /*
                await sleep(160);
                centerYF = await findFIcon();
        */
        //log.info(`调试-成功找到f图标,centerYF为${centerYF}`);

        let foundTarget = false;
        if (pickup_Mode === "模板匹配拾取，拾取狗粮和怪物材料" || pickup_Mode === "模板匹配拾取，只拾取狗粮") {
            let time1 = new Date();
            itemName = await performTemplateMatch(centerYF);
            let time2 = new Date();
            //log.info(`调试-本次识别用时${time2 - time1}毫秒`);
        }
        if (itemName) {
            //log.info(`调试-识别到物品${itemName}`);
            if (Math.abs(lastcenterYF - centerYF) <= 20 && lastItemName === itemName) {
                //log.info("调试-相同物品名和相近y坐标，本次不拾取");
                await sleep(160);
                lastcenterYF = -20;
                lastItemName = null;
            } else {
                if (blacklistSet.has(itemName)) {
                    //log.warn(`识别到黑名单物品${itemName}，不拾取`);
                } else {
                    keyPress("F");
                    log.info(`交互或拾取："${itemName}"`);
                    // 把本次拾取加入当前路线名单，保持最多 20 个
                    if (state.currentPathing) {
                        state.currentPathing.items.push(itemName);
                        // 去重 + 保留最后 20 个
                        state.currentPathing.items = [...new Set(state.currentPathing.items)].slice(-20);
                    }
                    lastcenterYF = centerYF;
                    lastItemName = itemName;
                    await sleep(pickupDelay);
                    //foundTarget = true;
                }
            }
        } else {
            //log.warn("未识别到结果");
            //await refreshTargetItems(centerYF);
            lastItemName = "";
        }
        if (!foundTarget) {
            //log.info(`调试-执行滚轮动作`);
            const currentTime = new Date().getTime();
            if (currentTime - lastMoveDown > timeMoveUp) {
                await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                if (thisMoveUpTime === 0) thisMoveUpTime = currentTime;
                if (currentTime - thisMoveUpTime >= timeMoveDown) {
                    lastMoveDown = currentTime;
                    thisMoveUpTime = 0;
                }
            } else {
                await keyMouseScript.runFile(`assets/滚轮上翻.json`);
            }
            await sleep(rollingDelay);
        }
    }

    async function performTemplateMatch(centerYF) {
        /* 一次性切 6 种宽度（0-5 汉字） */
        const regions = [];
        for (let cn = 0; cn <= 5; cn++) {   // 0~5 共 6 档
            const w = 12 + 28 * Math.min(cn, 5) + 2;
            regions[cn] = gameRegion.DeriveCrop(1219, centerYF - 15, w, 30);
        }

        try {
            for (const it of targetItems) {
                const cnLen = Math.min(
                    [...it.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length,
                    5
                ); // 0-5

                if (regions[cnLen].find(it.roi).isExist()) {
                    return it.itemName;
                }
            }
        } catch (e) {
            log.error(`performTemplateMatch: ${e.message}`);
        } finally {
            regions.forEach(r => r.dispose());
        }
        return null;
    }

    async function findFIcon() {
        try {
            let result = gameRegion.find(fIconRo);
            if (result.isExist()) {
                return Math.round(result.y + result.height / 2);
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            if (!state.running)
                return null;
        }
        await sleep(checkDelay);
        return null;
    }

}

/**
 * 加载黑名单
 * @param {boolean} merge 是否先读取文件与现有 blacklist 合并再去重
 */
async function loadBlacklist(merge = false) {
    try {
        if (merge) {
            const raw = await file.readText(`blacklists/${accountName}.json`);
            const arr = JSON.parse(raw);
            blacklist = [...new Set([...blacklist, ...arr])];
        }
        blacklistSet.clear();
        blacklist.forEach(item => blacklistSet.add(item));
    } catch (err) {
        log.error(`读取黑名单失败: ${err.message}`);
        blacklist = [];
        blacklistSet.clear();
    }
    await file.writeText(`blacklists/${accountName}.json`, JSON.stringify(blacklist, null, 2), false);
}

async function isMainUI() {
    const maxAttempts = 1;
    let attempts = 0;
    let dodispose = false;
    while (attempts < maxAttempts && state.running) {
        if (!gameRegion) {
            gameRegion = captureGameRegion();
            dodispose = true;
        }
        try {
            const result = gameRegion.find(mainUIRo);
            if (result.isExist()) return true;
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            if (!state.running) break;
            return false;
        }
        attempts++;
        await sleep(checkDelay);
        if (dodispose) {
            gameRegion.dispose();
        }
    }
    return false;
}

// 加载拾取物图片
async function loadTargetItems() {

    let targetItemPath;
    if (pickup_Mode === "模板匹配拾取，拾取狗粮和怪物材料") {
        targetItemPath = "assets/targetItems/";
    } else if (pickup_Mode === "模板匹配拾取，只拾取狗粮") {
        targetItemPath = "assets/targetItems/00狗粮（0.8）/";
    } else {
        return null;
    }
    log.info("开始加载模板图片");
    const items = await readFolder(targetItemPath, false);

    // 统一预加载模板
    for (const it of items) {
        try {
            it.template = file.ReadImageMatSync(it.fullPath);
            it.itemName = it.fileName.replace(/\.png$/i, '');
            it.roi = RecognitionObject.TemplateMatch(it.template);

            // 新增：解析括号中的阈值
            const match = it.fullPath.match(/[（(](.*?)[)）]/); // 匹配英文或中文括号
            let itsThreshold;
            if (match) {
                const val = parseFloat(match[1]);
                itsThreshold = (!isNaN(val) && val >= 0 && val <= 1) ? val : 0.9;
            } else {
                itsThreshold = 0.9;
            }
            it.roi.Threshold = itsThreshold;
            it.roi.InitTemplate();

        } catch (error) { }
    }
    log.info("模板图片加载完成");
    return items;
}

async function performOcr(centerYF) {
    const TEXT_X = 1210, TEXT_W = 250;   // 1210 ~ 1460
    const TEXT_Y = centerYF - 30, TEXT_H = 60;

    try {
        const resList = gameRegion.findMulti(
            RecognitionObject.ocr(TEXT_X, TEXT_Y, TEXT_W, TEXT_H)
        );
        if (!resList.count) return null;

        // 取最长串
        let longest = resList[0];
        for (let i = 1; i < resList.count; i++) {
            if (resList[i].text.length > longest.text.length) longest = resList[i];
        }
        // 只要中文
        return longest.text.replace(/[^\u4e00-\u9fa5]/g, '');
    } catch (e) {
        log.error(`OCR异常: ${e.message}`);
        return null;
    }
}

/* ========== 主流程（只用 let 和基础循环） ========== */
async function refreshTargetItems(centerYF) {
    const TARGET_DIR = 'assets/targetItems';

    /* 1. 一次截屏 */
    const rawText = await performOcr(centerYF);
    if (!rawText) { log.warn('未识别到文字'); return; }

    const itemName = rawText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    if (!itemName) { log.warn('未提取到有效物品名'); return; }

    const CAP_X = 1220;                       // 左侧固定
    let CAP_W = 12 + 28 * (itemName.length);  // 动态宽度
    if (itemName.length > 4) {
        CAP_W = 32 + 30 * 4;//过长时只取前五个字的区域
    }
    const CAP_Y = centerYF - 14;
    const CAP_H = 28;

    const mat = gameRegion.DeriveCrop(CAP_X, CAP_Y, CAP_W, CAP_H).SrcMat;

    /* 2. 纯 for 循环重名检测 */
    let finalName = itemName;
    let seq = 1;
    while (true) {
        let hit = false;
        for (let i = 0; i < targetItems.length; i++) {
            if (targetItems[i].itemName === finalName) {
                hit = true;
                break;
            }
        }
        if (!hit) break;          // 没找到重名，可用
        finalName = itemName + '(' + seq + ')';
        seq++;
    }

    /* 3. 保存 & 入库 */
    const fullPath = TARGET_DIR + '/' + finalName + '.png';
    file.WriteImageSync(fullPath, mat);
    targetItems.push({
        fullPath: fullPath,
        fileName: finalName + '.png',
        itemName: finalName,
        template: file.ReadImageMatSync(fullPath)
    });

    log.info('已新增拾取物：' + finalName);
}

//处理泥头车模式
async function dumper(pathFilePath, map_name) {
    //log.info("开始泥头车");
    let lastDumperTimer = 0;
    const dumperCD = 10000;
    try {
        const pathingContent = await file.readText(pathFilePath);
        const parsedContent = JSON.parse(pathingContent);
        const positions = parsedContent.positions;
        // 初始化 hasT 为 false
        let hasT = false;

        // 初始化 fightPositions 数组
        let fightPositions = [];

        // 遍历 positions 数组
        for (const pos of positions) {
            // 检查 action_params 是否包含 keypress(T)
            if (pos.action_params && pos.action_params.includes('keypress(T)')) {
                hasT = true;
            }

            // 如果 action 是 "fight"，则添加到 fightPositions
            if (pos.action === "fight") {
                fightPositions.push({
                    x: pos.x,
                    y: pos.y,
                    used: false
                });
            }
        }
        if (!hasT) {
            while (state.running) {
                //log.info("调试-泥头车循环");
                await sleep(501);
                if (await isMainUI()) {
                    //log.info("调试-获取坐标");
                    //在主界面才尝试获取坐标
                    let dumperDistance = 0;
                    try {
                        let shouldPressKeys = false;
                        const currentPosition = await genshin.getPositionFromMap(map_name);
                        for (let i = 0; i < fightPositions.length; i++) {
                            const fightPos = fightPositions[i];

                            if (fightPos.used) {
                                continue;
                            }

                            const distance = Math.sqrt(
                                Math.pow(currentPosition.x - fightPos.x, 2) +
                                Math.pow(currentPosition.y - fightPos.y, 2)
                            );

                            if (distance <= 30) {
                                fightPositions[i].used = true;
                            }

                            if (distance > 5 && distance <= 30) {
                                if ((new Date() - lastDumperTimer) > dumperCD) {
                                    shouldPressKeys = true;
                                    lastDumperTimer = new Date();
                                    dumperDistance = distance;
                                }
                            }
                        }

                        if (shouldPressKeys) {
                            log.info(`距离下个战斗地点距离${dumperDistance.toFixed(2)}，启用泥头车`);
                            for (const key of dumpers) {
                                log.info(`[泥头车]:尝试切换${key}号角色施放e技能`)
                                keyPress(String(key));
                                await sleep(400);
                                keyPress('e');
                                await sleep(400);
                                keyPress('e');
                                await sleep(400);
                                keyPress('e');
                                await sleep(400);
                            }

                            for (let i = 0; i < 10; i++) {
                                if (await isRevivalUI()) {
                                    //检测到复苏界面时，退出复苏界面
                                    keyPress("VK_ESCAPE");
                                    await sleep(500);
                                    await genshin.returnMainUi();
                                } else {
                                    break;
                                }

                            }

                        }
                    } catch (error) {
                    }
                }
            }
        } else {
            log.info("当前路线含有按键T，不启用泥头车");
        }
    } catch (error) {
        log.error(`执行泥头车时出现异常: ${error.message}`);
    }
    //检查是否在复活界面
    async function isRevivalUI() {
        // 修改后的图像路径
        const imagePath = "assets/RevivalUI.png";

        // 修改后的识别区域（左上角区域）
        const xMin = 450;
        const yMin = 200;
        const width = 1000; // 识别区域宽度
        const height = 250; // 识别区域高度
        let template = file.ReadImageMatSync(imagePath);
        let recognitionObject = RecognitionObject.TemplateMatch(template, xMin, yMin, width, height);
        // 尝试次数设置为 10 次
        const maxAttempts = 10;

        let attempts = 0;
        let dodispose = false;
        while (attempts < maxAttempts && state.running) {
            try {
                if (!gameRegion) {
                    gameRegion = captureGameRegion();
                    dodispose = true;
                }
                let result = gameRegion.find(recognitionObject);
                if (result.isExist()) {
                    return true; // 如果找到图标，返回 true
                }
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
                return false; // 发生异常时返回 false
            }
            attempts++; // 增加尝试次数
            await sleep(200); // 每次检测间隔 200 毫秒
            if (dodispose) {
                gameRegion.dispose();
            }
        }
        return false; // 如果尝试次数达到上限或取消，返回 false
    }
}

// 定义 readFolder 函数
async function readFolder(folderPath, onlyJson) {
    // 新增一个堆栈，初始时包含 folderPath
    const folderStack = [folderPath];

    // 新增一个数组，用于存储文件信息对象
    const files = [];

    // 当堆栈不为空时，继续处理
    while (folderStack.length > 0) {
        // 从堆栈中弹出一个路径
        const currentPath = folderStack.pop();

        // 读取当前路径下的所有文件和子文件夹路径
        const filesInSubFolder = file.ReadPathSync(currentPath);

        // 临时数组，用于存储子文件夹路径
        const subFolders = [];
        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                // 如果是文件夹，先存储到临时数组中
                subFolders.push(filePath);
            } else {
                if (filePath.endsWith(".js")) {
                    //跳过js结尾的文件
                    continue;
                }
                // 如果是文件，根据 onlyJson 判断是否存储
                if (onlyJson) {
                    if (filePath.endsWith(".json")) {
                        const fileName = filePath.split('\\').pop(); // 提取文件名
                        const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                        files.push({
                            fullPath: filePath,
                            fileName: fileName,
                            folderPathArray: folderPathArray
                        });
                        //log.info(`找到 JSON 文件：${filePath}`);
                    }
                } else {
                    const fileName = filePath.split('\\').pop(); // 提取文件名
                    const folderPathArray = filePath.split('\\').slice(0, -1); // 提取文件夹路径数组
                    files.push({
                        fullPath: filePath,
                        fileName: fileName,
                        folderPathArray: folderPathArray
                    });
                    //log.info(`找到文件：${filePath}`);
                }
            }
        }
        // 将临时数组中的子文件夹路径按原顺序压入堆栈
        folderStack.push(...subFolders.reverse()); // 反转子文件夹路径
    }

    return files;
}

async function copyPathingsByGroup(pathings) {
    // 遍历 pathings 数组
    for (const pathing of pathings) {
        // 只处理 selected 为 true 的项
        if (pathing.selected) {
            // 读取文件内容
            const content = await file.readText(pathing.fullPath);
            // 构造目标路径
            const groupFolder = `pathingOut/group${pathing.group}`;
            const targetPath = `${groupFolder}/${pathing.fullPath}`;
            // 写入文件内容
            await file.writeText(targetPath, content, false);
        }
    }
}

async function processPathingsByGroup(pathings, accountName) {
    let lastX = 0;
    let lastY = 0;

    // 定义路径组名称到组号的映射（10 个）
    const groupMapping = {
        "路径组一": 1,
        "路径组二": 2,
        "路径组三": 3,
        "路径组四": 4,
        "路径组五": 5,
        "路径组六": 6,
        "路径组七": 7,
        "路径组八": 8,
        "路径组九": 9,
        "路径组十": 10
    };

    // 从全局 settings 中获取用户选择的路径组名称
    const selectedGroupName = settings.groupIndex || "路径组一"; // 默认值为 "路径组一"

    // 将路径组名称映射到组号
    const targetGroup = groupMapping[selectedGroupName];

    // 初始化变量，用于标记当前路径是该组的第几个
    let groupPathCount = 0;

    // 获取该组的总路径数
    const totalPathsInGroup = pathings.filter(pathing => pathing.group === targetGroup).length;

    if (pickup_Mode === "bgi原版拾取") {
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        rollingDelay = 160;
    }

    // 初始化统计变量
    let totalElites = 0; // 总精英怪数量
    let totalMonsters = 0; // 总小怪数量
    let totalGain = 0; // 总收益
    let totalEstimatedTime = 0; // 预计总时间

    // 遍历 pathings 数组，计算当前组的总计精英怪数量、小怪数量、总计收益和预计总时间
    for (const pathing of pathings) {
        if (pathing.group === targetGroup) {
            totalElites += pathing.e || 0; // 精英怪数量
            totalMonsters += pathing.m || 0; // 小怪数量
            totalGain += pathing.G1 || 0; // 收益
            totalEstimatedTime += pathing.t || 0; // 预计时间
        }
    }

    // 输出当前组的总计信息
    log.info(`当前组 ${selectedGroupName} 的总计信息：`);
    log.info(`精英怪数量: ${totalElites.toFixed(0)}`);
    log.info(`小怪数量: ${totalMonsters.toFixed(0)}`);
    log.info(`预计收益: ${totalGain.toFixed(0)} 摩拉`);

    // 将预计总时间转换为时、分、秒表示
    const hours = Math.floor(totalEstimatedTime / 3600);
    const minutes = Math.floor((totalEstimatedTime % 3600) / 60);
    const seconds = totalEstimatedTime % 60;
    log.info(`预计用时: ${hours} 时 ${minutes} 分 ${seconds.toFixed(0)} 秒`);

    const groupStartTime = new Date();
    let remainingEstimatedTime = totalEstimatedTime;
    let skippedTime = 0;
    //移除不必要的属性
    {
        const keysToDelete = ['monsterInfo', 'mora_m', 'mora_e', 'available', 'prioritized', 'G1', 'G2', 'index', 'folderPathArray', 'E1', 'E2']; // 删除的字段列表
        pathings.forEach(p => {
            keysToDelete.forEach(k => delete p[k]);
        });
    }
    // 遍历 pathings 数组
    for (const pathing of pathings) {
        // 检查路径是否属于指定的组
        if (pathing.group === targetGroup) {
            // 增加路径计数
            groupPathCount++;

            if (await isTimeRestricted(settings.timeRule, Math.ceil(pathing.t / 40))) {
                break;
            }

            // 输出当前路径的序号信息
            log.info(`开始处理第 ${targetGroup} 组第 ${groupPathCount}/${totalPathsInGroup} 个${pathing.fileName}`);

            // 获取当前时间
            const now = new Date();

            // 检查 cdTime 是否晚于当前时间
            const cdTime = new Date(pathing.cdTime);
            if (cdTime > now) {
                log.info(`该路线未刷新，跳过。`);
                skippedTime += pathing.t;
                remainingEstimatedTime -= pathing.t;
                continue;
            }

            // 输出路径已刷新并开始处理的信息
            log.info(`该路线已刷新，开始处理。`);
            try {
                await genshin.returnMainUi();
                const miniMapPosition = await genshin.getPositionFromMap(pathing.map_name);
                // 更新坐标
                lastX = miniMapPosition.X;
                lastY = miniMapPosition.Y;
                //log.info(`当前位于${pathing.map_name}地图的（${miniMapPosition.X}，${miniMapPosition.Y}，距离上次距离${(diffX + diffY)}`);
            } catch (error) {
                log.error(`获取坐标时发生错误：${error.message}`);
                runningFailCount++;
            }

            // 调用 runPath 函数处理路径
            await runPath(pathing.fullPath, pathing.map_name, pathing.m, pathing.e);
            try {
                await sleep(1);
            } catch (error) {
                break;
            }

            let fileEndX = 0, fileEndY = 0;
            try {
                const raw = file.readTextSync(pathing.fullPath);
                const json = JSON.parse(raw);
                if (Array.isArray(json.positions)) {
                    for (let i = json.positions.length - 1; i >= 0; i--) {
                        const p = json.positions[i];
                        if (p.type !== 'orientation' &&
                            typeof p.x === 'number' &&
                            typeof p.y === 'number') {
                            fileEndX = p.x;
                            fileEndY = p.y;
                            break;
                        }
                    }
                }
            } catch (e) { /* 读文件失败就留 0,0 继续走后面逻辑 */ }

            try {
                await genshin.returnMainUi();
                const miniMapPosition = await genshin.getPositionFromMap(pathing.map_name);
                const diffX = Math.abs(lastX - miniMapPosition.X);
                const diffY = Math.abs(lastY - miniMapPosition.Y);
                const endDiffX = Math.abs(fileEndX - miniMapPosition.X);
                const endDiffY = Math.abs(fileEndY - miniMapPosition.Y);

                lastX = miniMapPosition.X;
                lastY = miniMapPosition.Y;

                if ((diffX + diffY) < 5 || (endDiffX + endDiffY) > 30) {
                    runningFailCount++;
                } else {
                    runningFailCount = 0;
                }
            } catch (error) {
                log.error(`获取坐标时发生错误：${error.message}`);
                runningFailCount++;
            }

            if (runningFailCount >= 1) {
                log.error("出发点与终点过于接近，终点偏差大于30，或坐标获取异常，不记录运行数据");
                continue;
            }

            // 计算下一个 UTC 时间的晚上 8 点（即北京时间凌晨四点）
            let newCDTime = new Date(now);
            newCDTime.setUTCHours(20, 0, 0, 0); // 设置为 UTC 时间的 20:00
            if (newCDTime <= now) {
                // 如果设置的时间小于等于当前时间，说明需要取下一个晚上 8 点
                newCDTime.setUTCHours(20 + 24, 0, 0, 0); // 设置为下一个 UTC 时间的 20:00
            }
            if (pathing.m !== 0) {
                const nowPlus12h = new Date(now.getTime() + 12 * 3600 * 1000); // now + 12h
                if (newCDTime < nowPlus12h) {
                    newCDTime = nowPlus12h;
                }
            }

            // 更新路径的 cdTime
            pathing.cdTime = newCDTime.toLocaleString();
            if (!localeWorks) pathing.cdTime = newCDTime.toISOString();

            const pathTime = new Date() - now;
            pathing.records = [...pathing.records, pathTime / 1000].slice(-7);

            remainingEstimatedTime -= pathing.t;
            const actualUsedTime = (new Date() - groupStartTime) / 1000;
            const predictRemainingTime = remainingEstimatedTime * actualUsedTime / (totalEstimatedTime - remainingEstimatedTime - skippedTime);
            // 将预计剩余时间转换为时、分、秒表示
            const remaininghours = Math.floor(predictRemainingTime / 3600);
            const remainingminutes = Math.floor((predictRemainingTime % 3600) / 60);
            const remainingseconds = predictRemainingTime % 60;
            log.info(`当前进度：第 ${targetGroup} 组第 ${groupPathCount}/${totalPathsInGroup} 个  ${pathing.fileName}已完成，该组预计剩余: ${remaininghours} 时 ${remainingminutes} 分 ${remainingseconds.toFixed(0)} 秒`);

            await updateRecords(pathings, accountName);
        }
    }
}

async function initializeCdTime(pathings, accountName) {
    try {
        const filePath = `records/${accountName}.json`;
        const fileContent = await file.readText(filePath);
        const cdTimeData = JSON.parse(fileContent);

        pathings.forEach(pathing => {
            let entry = null;
            for (let i = 0; i < cdTimeData.length; i++) {
                if (cdTimeData[i].fileName === pathing.fileName) {
                    entry = cdTimeData[i];
                    break;
                }
            }
            // 读取 cdTime
            pathing.cdTime = entry
                ? new Date(entry.cdTime).toLocaleString()
                : new Date(0).toLocaleString();

            if (!localeWorks) pathing.cdTime = entry
                ? new Date(entry.cdTime).toISOString()
                : new Date(0).toISOString();
            // 确保当前 records 是数组
            const current = Array.isArray(pathing.records) ? pathing.records : new Array(7).fill(-1);

            // 读取文件中的 records（若缺失则为空数组）
            const loaded = (entry && Array.isArray(entry.records)) ? entry.records : [];

            // 合并：文件中的 records（倒序最新在前）→ 追加到当前数组末尾
            // 再整体倒序恢复正确顺序，截取最新 7 项
            pathing.records = [...current, ...loaded.reverse()].slice(-7);
            // 读取历史拾取名单，只保留最后 20 个不重复
            const rawItems = (entry && Array.isArray(entry.items)) ? entry.items : [];
            pathing.items = [...new Set(rawItems)].slice(-20);   // 去重 + 截断
        });
    } catch (error) {
        // 文件不存在或解析错误，初始化为 6 个 -1
        pathings.forEach(pathing => {
            pathing.cdTime = new Date(0).toLocaleString();
            pathing.records = new Array(7).fill(-1);
        });
        if (!localeWorks) pathings.forEach(pathing => {
            pathing.cdTime = new Date(0).toISOString();
            pathing.records = new Array(7).fill(-1);
        });
    }
}

async function updateRecords(pathings, accountName) {
    try {
        const filePath = `records/${accountName}.json`;

        const cdTimeData = pathings.map(pathing => ({
            fileName: pathing.fileName,
            标签: pathing.tags,
            预计用时: pathing.t.toFixed(2),
            cdTime: pathing.cdTime,
            records: [...pathing.records]
                .reverse()
                .filter(v => v > 0)
                .map(v => Number(v.toFixed(2))),
            items: pathing.items
        }));
        await file.writeText(filePath, JSON.stringify(cdTimeData, null, 2), false);
    } catch (error) {
        log.error(`更新 cdTime 时出错: ${error.message}`);
    }
}

// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看

async function fakeLog(name, isJs, isStart, duration) {
    await sleep(10);
    const currentTime = Date.now();
    // 参数检查
    if (typeof name !== 'string') {
        log.error("参数 'name' 必须是字符串类型！");
        return;
    }
    if (typeof isJs !== 'boolean') {
        log.error("参数 'isJs' 必须是布尔型！");
        return;
    }
    if (typeof isStart !== 'boolean') {
        log.error("参数 'isStart' 必须是布尔型！");
        return;
    }
    if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
        log.error("参数 'currentTime' 必须是整数！");
        return;
    }
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
        log.error("参数 'duration' 必须是整数！");
        return;
    }

    // 将 currentTime 转换为 Date 对象并格式化为 HH:mm:ss.sss
    const date = new Date(currentTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

    // 将 duration 转换为分钟和秒，并保留三位小数
    const durationInSeconds = duration / 1000; // 转换为秒
    const durationMinutes = Math.floor(durationInSeconds / 60);
    const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数

    // 使用四个独立的 if 语句处理四种情况
    if (isJs && isStart) {
        // 处理 isJs = true 且 isStart = true 的情况
        const logMessage = `正在伪造js开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行JS脚本: "${name}"`;
        log.debug(logMessage);
    }
    if (isJs && !isStart) {
        // 处理 isJs = true 且 isStart = false 的情况
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
    if (!isJs && isStart) {
        // 处理 isJs = false 且 isStart = true 的情况
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    }
    if (!isJs && !isStart) {
        // 处理 isJs = false 且 isStart = false 的情况
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
}

//切换队伍
async function switchPartyIfNeeded(partyName) {
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }
    try {
        log.info("正在尝试切换至" + partyName);
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(partyName);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}

/**
 * 检查当前时间是否处于限制时间内或即将进入限制时间
 * @param {string} timeRule - 时间规则字符串，格式如 "8, 8-11, 23:11-23:55"
 * @param {number} [threshold=5] - 接近限制时间的阈值（分钟）
 * @returns {Promise<boolean>} - 如果处于限制时间内或即将进入限制时间，则返回 true，否则返回 false
 */
async function isTimeRestricted(timeRule, threshold = 5) {
    if (!timeRule) return false;

    // 兼容中英文逗号、冒号
    const ruleClean = timeRule
        .replace(/，/g, ',')
        .replace(/：/g, ':');

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMinute;

    for (const seg of ruleClean.split(',').map(s => s.trim())) {
        if (!seg) continue;

        let startStr, endStr;
        if (seg.includes('-')) {
            [startStr, endStr] = seg.split('-').map(s => s.trim());
        } else {
            startStr = endStr = seg.trim();
        }

        const parseTime = (str, isEnd) => {
            if (str.includes(':')) {
                const [h, m] = str.split(':').map(Number);
                return { h, m };
            }
            // 单独小时：start 8→8:00，end 8→8:59
            const h = Number(str);
            return { h, m: isEnd ? 59 : 0 };
        };

        const start = parseTime(startStr, false);
        const end = parseTime(endStr, true);

        const startTotal = start.h * 60 + start.m;
        const endTotal = end.h * 60 + end.m;

        const effectiveEnd = endTotal >= startTotal ? endTotal : endTotal + 24 * 60;

        if (
            (currentTotal >= startTotal && currentTotal < effectiveEnd) ||
            (currentTotal + 24 * 60 >= startTotal && currentTotal + 24 * 60 < effectiveEnd)
        ) {
            log.warn("处于限制时间内");
            return true;
        }

        let nextStartTotal = startTotal;
        if (nextStartTotal <= currentTotal) nextStartTotal += 24 * 60;
        const waitMin = nextStartTotal - currentTotal;
        if (waitMin > 0 && waitMin <= threshold) {
            log.warn(`接近限制时间，等待 ${waitMin} 分钟`);
            await genshin.tpToStatueOfTheSeven();
            await sleep(waitMin * 60 * 1000);
            return true;
        }
    }

    log.info("不处于限制时间");
    return false;
}

async function clickPNG(png, maxAttempts = 20) {
    //log.info(`调试-点击目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${png}.png`));
    pngRo.Threshold = 0.95;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, true, maxAttempts);
}

async function findPNG(png, maxAttempts = 20) {
    //log.info(`调试-识别目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${png}.png`));
    pngRo.Threshold = 0.95;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, false, maxAttempts);
}

async function findAndClick(target, doClick = true, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { await sleep(50 * 2 + 50); if (doClick) { res.click(); } return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(50);
    }
    return false;
}