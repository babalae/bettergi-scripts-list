//当前js版本2.2.1

//自定义配置变量预声明
let accountName;
let pickup_Mode;
let dumpers;
let findFInterval;
let checkDelay;
let rollingDelay;
let pickupDelay;
let timeMove;
let timeMoveUp;
let timeMoveDown;
let priorityTags;
let excludeTags;
let operationMode;
let k1;
let k2;
let targetEliteNum;
let targetMonsterNum;
let partyName;
let groupSettings;
let groupTags;

//模板与识别对象预加载
const itemFullRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/itemFull.png"), 0, 0, 1920, 1080);
const frozenRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/解除冰冻.png"), 1379, 574, 1463 - 1379, 613 - 574);
const revivalRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/复苏.png"), 755, 915, 1117 - 755, 1037 - 915);
revivalRo.Threshold = 0.95;
revivalRo.InitTemplate();
const cookingRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/烹饪界面.png"), 1547, 965, 1815 - 1547, 1059 - 965);
cookingRo.Threshold = 0.95;
cookingRo.InitTemplate();
const whiteFurinaRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/白芙图标.png"), 1634, 967, 1750 - 1634, 1070 - 967);
whiteFurinaRo.Threshold = 0.97;
whiteFurinaRo.InitTemplate();
const flyingRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/飞行状态.png"), 1657, 945, 1758 - 1657, 1029 - 945);
flyingRo.Threshold = 0.97;
flyingRo.InitTemplate();
const fIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/F_Dialogue.png'), 1102, 335, 34, 400);
fIconRo.Threshold = 0.95;
fIconRo.InitTemplate();
const mainUIRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/MainUI.png"), 0, 0, 150, 150);

//全局通用变量声明
let gameRegion;
let targetItems;
let doFurinaSwitch = false;
let lastRoll = new Date();
let blacklist = [];
let blacklistSet = new Set();
let state;
let pathings;
let localeWorks;
let lastEatBuff = 0;

(async function () {
    //通用预处理
    await loadConfig();
    let switchPartyTask;
    if (["运行锄地路线", "启用仅指定怪物模式"].includes(operationMode)) {
        switchPartyTask = switchPartyIfNeeded(partyName);
    }
    if (settings.disableAsync) {
        await switchPartyTask;
    }
    targetItems = await loadTargetItems();
    localeWorks = await checkLocaleTimeSupport();
    dispatcher.AddTrigger(new RealtimeTimer("AutoSkip"));
    await loadBlacklist(true);
    await rotateWarnIfAccountEmpty();


    if (operationMode === "启用仅指定怪物模式") {
        await filterPathingsByTargetMonsters();
        await updateRecords(pathings, accountName);
        if (!settings.disableAsync) {
            await switchPartyTask;
        }
        await processPathingsByGroup(pathings, accountName);
        return;

    } else {
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
            await printGroupSummary();
            log.info("开始复制并输出地图追踪文件\n请前往js文件夹查看");
            await copyPathingsByGroup(pathings);
            await updateRecords(pathings, accountName);
        } else if (operationMode === "运行锄地路线") {
            if (!settings.disableAsync) {
                await switchPartyTask;
            }
            await validateTeamAndConfig();
            log.info("开始运行锄地路线");
            await updateRecords(pathings, accountName);
            await processPathingsByGroup(pathings, accountName);
        } else {
            log.info("强制刷新所有运行记录");
            await initializeCdTime(pathings, "");
            await updateRecords(pathings, accountName);
        }
    }
})();
/* ========================= ① 启动与配置 =========================
 * 负责：读取/生成用户配置、检测本地时间格式、提示未打开自定义配置等
 * 为后续所有模块提供经过校验的 settings 与全局常量
 * ============================================================= */

/**
 * 配置加载 / 创建函数
 * 依赖全局变量：settings、accountName
 * 1. 当 groupIndex 为"路径组一"时，把当前 UI 上的字段落盘到 settings/{accountName}.json；
 * 2. 其它组则尝试读盘，失败就报错并 10s 后退出；
 * 3. 无论读写，最终都把结果同步回全局 settings；
 * 4. 若配置里出现"莫酱""汐酱"关键词，直接终止脚本。
 */
async function loadConfig() {
    operationMode = settings.operationMode || "运行锄地路线";
    accountName = settings.accountName || "默认账户";
    if (operationMode !== '启用仅指定怪物模式') {
        const FORBIDDEN = ['莫酱', '汐酱'];

        /* -------- 1. 构造 10 个分组标签 + 其它字段的默认值 -------- */
        const buildCfgObj = () => ({
            tagsForGroup1: settings.tagsForGroup1 || '',
            tagsForGroup2: settings.tagsForGroup2 || '',
            tagsForGroup3: settings.tagsForGroup3 || '',
            tagsForGroup4: settings.tagsForGroup4 || '',
            tagsForGroup5: settings.tagsForGroup5 || '',
            tagsForGroup6: settings.tagsForGroup6 || '',
            tagsForGroup7: settings.tagsForGroup7 || '',
            tagsForGroup8: settings.tagsForGroup8 || '',
            tagsForGroup9: settings.tagsForGroup9 || '',
            tagsForGroup10: settings.tagsForGroup10 || '',
            disableSelfOptimization: settings.disableSelfOptimization ?? false,
            eEfficiencyIndex: settings.eEfficiencyIndex ?? 2.5,
            mEfficiencyIndex: settings.mEfficiencyIndex ?? 0.5,
            curiosityFactor: settings.curiosityFactor ?? '0',
            ignoreRate: settings.ignoreRate ?? 0,
            targetEliteNum: settings.targetEliteNum ?? 400,
            targetMonsterNum: settings.targetMonsterNum ?? 2000,
            priorityTags: settings.priorityTags ?? '',
            excludeTags: settings.excludeTags ?? ''
        });

        /* -------- 2. 关键词黑名单检查 -------- */
        const checkForbidden = (cfgStr) => {
            FORBIDDEN.forEach(word => {
                if (cfgStr.includes(word)) {
                    log.error(`路线选择与分组配置中包含关键词（${word}），强制终止！`);
                    throw new Error('禁止以汐酱或莫酱作为关键词');
                }
            });
        };

        /* -------- 3. 主逻辑 -------- */
        if (settings.groupIndex === '路径组一') {
            const cfg = buildCfgObj();
            const cfgStr = JSON.stringify(cfg, null, 2);
            checkForbidden(cfgStr);

            const filePath = `settings/${accountName}.json`;
            file.writeText(filePath, cfgStr, false);
        } else {
            let cfg;
            try {
                const raw = await file.readText(`settings/${accountName}.json`);
                cfg = JSON.parse(raw);
            } catch (e) {
                log.error(`配置文件 settings/${accountName}.json 不存在或格式错误，请先在"路径组一"运行一次！`);
                throw new Error('无可用的配置文件');
            }
            /* 把读到的字段同步回全局 settings */
            for (const key in cfg) {
                settings[key] = cfg[key];
            }
        }
    }
    //加载自定义配置
    pickup_Mode = settings.pickup_Mode || "模板匹配拾取，拾取狗粮和怪物材料";
    dumpers = settings.activeDumperMode
        ? settings.activeDumperMode.split('，').map(Number).filter(num => [1, 2, 3, 4].includes(num))
        : [];

    findFInterval = Math.max(16, Math.min(200, +settings.findFInterval || 100));
    checkDelay = Math.round(findFInterval / 2);
    rollingDelay = (+settings.rollingDelay || 32);
    pickupDelay = (+settings.pickupDelay || 100);
    timeMove = (+settings.timeMove || 1000);
    timeMoveUp = Math.round(timeMove * 0.45);
    timeMoveDown = Math.round(timeMove * 0.55);

    priorityTags = (settings.priorityTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);
    excludeTags = (settings.excludeTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (!pickup_Mode.includes("模板匹配")) {
        excludeTags.push("沙暴");
        log.warn("拾取模式不是模板匹配，无法处理沙暴路线，自动排除所有沙暴路线");
    }

    k1 = +settings.eEfficiencyIndex || 2.5;
    k1 = Math.max(0, Math.min(10, Number.isNaN(k1) ? 2.5 : k1));

    k2 = +settings.mEfficiencyIndex || 0.5;
    k2 = Math.max(0, Math.min(4, Number.isNaN(k2) ? 0.5 : k2));

    targetEliteNum = Math.max(0, +settings.targetEliteNum || 400) + 5; // 预留漏怪
    targetMonsterNum = Math.max(0, +(settings.targetMonsterNum ?? 2000)) + 25; // 预留漏怪

    partyName = settings.partyName || "";
    groupSettings = Array.from({ length: 10 }, (_, i) =>
        settings[`tagsForGroup${i + 1}`] || (i === 0 ? '蕈兽' : '')
    );
    groupTags = groupSettings.map(str => str.split('，').filter(Boolean));
    groupTags[0] = [...new Set(groupTags.flat())];
}

/**
 * 检测本机 toLocaleString() 是否能被 Date.parse 正确解析。
 * 若解析失败，会连续输出 3 条警告并阻塞 5 秒，最后返回 false。
 * @returns {boolean}  true  -> 本地时间可用
 *                     false -> 只能退而用 UTC 时间
 */
async function checkLocaleTimeSupport() {
    const localStr = new Date().toLocaleString();
    const ok = !isNaN(Date.parse(localStr));
    if (!ok) {
        ['当前设备本地时间格式无法解析',
            '建议不要使用12小时时间制',
            '已将记录改为使用 utc 时间'].forEach(t => log.warn(`${t}`));
        await sleep(5000);
    }
    return ok;
}

/**
 * 自定义配置未启用警告
 * 若 settings.accountName 为空，则在控制台滚动输出 5 次提示，
 * 提醒用户先阅读 README 后再使用，防止因未配置导致后续逻辑异常。
 * 依赖全局：settings、log、sleep
 */
async function rotateWarnIfAccountEmpty() {
    if (!settings.accountName) {
        for (let i = 0; i < 5; i++) {
            let originalMessage = "   请先阅读js文件夹中的【README.md】后使用";
            let offset = i % originalMessage.length;
            let message = originalMessage.slice(-offset) + originalMessage.slice(0, -offset);
            log.error(message);
            await sleep(500);
        }
    }
}

/* ========================= ② 路线预处理与策略计算 =========================
 * 负责：解析路线 JSON → 计算怪物数量/收益/时间 → 按用户标签、优先级、排除词过滤
 * 最终产出：已标记 selected + group 的最优路线集合
 * ====================================================================== */

/**
 * 路线预处理核心函数
 * 1. 读取 assets/monsterInfo.json 建立怪物-收益映射表
 * 2. 扫描 pathing/ 目录下所有 *.json 路线文件，反序列化 info.description
 *    提取「预计用时」与「怪物清单」并计算普通/精英怪数量及对应摩拉收益
 * 3. 根据 settings.ignoreRate 过滤高小怪占比路线；按 groupTags[0] 反查补 tag
 * 4. 若开启自我优化且存在历史运行时长，则对「预计用时」做削峰填谷取均值
 * 返回已附加 {t, m, e, mora_m, mora_e, tags, map_name, ...} 的完整路径对象数组
 * 依赖全局：settings、accountName、file、initializeCdTime、readFolder
 */
async function processPathings(groupTags) {
    // 读取怪物信息
    const monsterInfoContent = await file.readText("assets/monsterInfo.json");
    const monsterInfoObject = JSON.parse(monsterInfoContent);

    // 读取路径文件夹中的所有文件
    log.info("开始读取路径文件");
    let pathings = await readFolder("pathing", "json");

    //加载路线cd信息
    log.info("路径文件读取完成，开始加载cd信息");
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
    log.info("cd信息加载完成，开始处理路线详细信息");
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
        pathing.original_e = 0; // 原始精英数量（用于统计被忽略的）
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
                    pathing.original_e += count; // 记录原始精英数量
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

        // ===== 根据 settings.ignoreRate 过滤 =====
        const ignoreRate = Number(settings.ignoreRate) || 100;
        if (Number.isInteger(ignoreRate) && ignoreRate > 0) {
            const protectTags = ['精英高收益', '高危', '传奇'];
            const hasProtectTag = protectTags.some(tag => pathing.tags.includes(tag));

            if (!hasProtectTag && pathing.e > 0) {          // ① 先保证有精英
                const ratio = pathing.m / pathing.e;        // ② 再计算比例（e 已 > 0）
                if (ratio >= ignoreRate) {                  // ③ 比例达标才清零
                    pathing.e = 0;
                    pathing.mora_e = 0;
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
    log.info("预处理阶段完成");
    return pathings; // 返回处理后的 pathings 数组
}

/**
 * 路线打标与过滤
 * 1. 将「仅第 0 组独有」的标签视为互斥标签：路线一旦包含则直接置 unavailable
 * 2. 若路线文件名、已有标签或所含怪物名命中 excludeTags，同样置 unavailable
 * 3. 命中 priorityTags 的路线打上 prioritized 标记，后续选路时会被优先保留
 * 4. 最终给每条路线新增：
 *    available（bool）- 是否可参与后续选路
 *    prioritized（bool）- 是否优先保留
 * 依赖：pathings、groupTags、priorityTags、excludeTags
 */
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

/**
 * 最优路线组合生成器
 * 1. 为每条可用路线计算精英收益效率 E1 与小怪收益效率 E2（含好奇系数修正）
 * 2. 先按 E1 降序选够 targetEliteNum，再按 E2 降序补够 targetMonsterNum
 * 3. 迭代微调精英门槛，并贪心剔除非优先路线，使总量恰好落在目标区间
 * 4. 按 settings.sortMode 重排最终路线顺序，输出总精英/小怪/收益/用时
 * 返回：pathings[] 各元素新增 selected（bool）及排序
 * 依赖：pathings（已含 mora_e/mora_m/t/e/available/prioritized）
 */
async function findBestRouteGroups(pathings, k1, k2, targetEliteNum, targetMonsterNum) {
    log.info("开始根据配置寻找路线组合");
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

        /* 收益 */
        const eliteGain = p.e === 0 ? 200 : (G1 - G2) / p.e;
        const normalGain = p.m === 0 ? 40.5 : G2 / p.m;

        p.E1 = (eliteGain ** k1) * (G1 / p.t);
        if (p.e === 0) p.E1 = 0;

        p.E2 = (normalGain ** k2) * (G2 / p.t);

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

        // 新条件：总量必须落在区间里
        if (totalSelectedElites >= targetEliteNum &&
            totalSelectedElites <= iterationCount / 20 &&
            totalSelectedMonsters >= targetMonsterNum &&
            totalSelectedMonsters <= iterationCount / 4) {
            break;
        }

        // 只调精英目标：若当前选多了就降门槛，选少了就抬门槛
        const eliteGap = targetEliteNum - totalSelectedElites;
        nextTargetEliteNum += Math.round(0.7 * eliteGap);   // 可正可负，自动收敛
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
            //log.info("调试-删掉了一条路线")
            p.selected = false;
            totalSelectedElites = newE;
            totalSelectedMonsters = newM;
            totalGainCombined -= p.G1;
            totalTimeCombined -= p.t;
        }
    }

    /* ========== 4. 小怪标签 & 排序 & 日志，保持原样 ========== */
    pathings.forEach(p => {
        // 1. 统一先删掉旧的小怪标签（不管之前有没有）
        p.tags = p.tags.filter(t => t !== '小怪');

        // 2. 按最新条件重新判断
        if (p.selected && p.e === 0 &&
            !p.tags.includes('传奇') && !p.tags.includes('高危')) {
            p.tags.push('小怪');
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
    log.info("路线组合结果如下：");
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

/**
 * 把已选路线分配到 10 个用户分组
 * 规则：
 * 1. 只处理 selected 的路线，其余保持 group=0
 * 2. 若路线不含第 0 组任何标签 → 直接分到组 1
 * 3. 否则按 groupTags[1]...groupTags[9] 顺序匹配，命中即分到对应组（2-10）
 * 结果：pathing.group = 1..10，后续按组批量执行
 * 依赖：pathings（已有 selected & tags）、groupTags
 */
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

/**
 * 仅指定怪物模式入口
 * 1. 解析用户填写的目标怪物字符串（中文逗号分隔）
 * 2. 强制使用“路径组一”并构造空分组，避免后续数组越界
 * 3. 调用 processPathings 取得全部路线对象
 * 4. 逐路线在「文件名 + 描述」中全文匹配任一目标怪物关键字
 * 结果：pathings[].selected = 是否命中；pathings[].group = 1 或 0
 * 依赖：settings、file、processPathings、pathings（全局）
 */
async function filterPathingsByTargetMonsters() {
    // 1. 日志 & 检查空值
    if (settings.targetMonsters) {
        log.info(`当前目标怪物信息：${settings.targetMonsters}`);
    } else {
        log.error(`当前目标怪物为空，请阅读readme后重新检查自定义配置`);
    }

    // 2. 拆分成数组
    const targetMonsters = (settings.targetMonsters || "")
        .split("，")        // 中文逗号
        .map(s => s.trim())
        .filter(Boolean);

    // 3. 固定用路径组一
    settings.groupIndex = "路径组一";

    // 4. 构造空分组，避免后续越界
    const fakeGroupTags = Array.from({ length: 10 }, () => []);

    // 5. 预处理拿到完整路线
    pathings = await processPathings(fakeGroupTags);

    // 6. 逐路线匹配 description 与文件名
    for (const p of pathings) {
        let desc = '';
        try {
            const raw = await file.readText(p.fullPath);
            desc = (JSON.parse(raw).info?.description || '');
        } catch { /* 忽略读失败 */ }

        const textToSearch = (p.fullPath || '') + ' ' + desc;
        p.selected = targetMonsters.some(m => textToSearch.includes(m));
        p.group = p.selected ? 1 : 0;   // 选中→组1，否则组0
    }
    const selectedCount = pathings.filter(p => p.selected).length;
    log.info(`目标怪物模式：共找到 ${selectedCount} 条相关路线`);
}

/* ========================= ③ 运行前校验与调试输出 =========================
 * 负责：队伍合理性检查、四神队禁断、窗口分辨率警告
 * 调试模式下导出各组统计与路线文件，供人工核对
 * ====================================================================== */

/**
 * 完整的队伍校验流程（原逻辑 0 改动，仅把最末尾的 return 换成 throw 终止脚本）
 * 1. 打印当前队伍（依赖全局 getAvatars）
 * 2. 按配置项逐项校验，标记 haveProblem
 * 3. 四神队检测 -> 抛错终止
 * 依赖全局：settings、log、sleep、genshin、targetEliteNum、targetMonsterNum、getAvatars
 * @throws {Error}  四神队齐全时抛出 'FOUR_GODS_TEAM_FORBIDDEN' 终止脚本
 */
async function validateTeamAndConfig() {
    const avatars = Array.from(getAvatars?.() || []);
    // 1. 打印队伍
    const teamStr = avatars.join('、');
    log.info('当前队伍：' + teamStr);

    let haveProblem = false;

    // 2. 校验阶段
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

    // 3. 四神队检测：抛出即终止
    if (['钟离', '芙宁娜', '纳西妲', '雷电将军'].every(n => avatars.includes(n))) {
        log.warn("禁止使用四神队，请重新阅读 readme 相关部分");
        await sleep(5000);
        throw new Error('禁止使用四神队');
    }
}

/**
 * 调试-分组汇总打印
 * 仅统计 group=1..10 且 selected 的路线，累加精英数、小怪数、总收益(G1)与总时长
 * 输出每组的路线条数、精英/小怪数量、预计收益（摩拉）与预计用时（时:分:秒）
 * 用于“调试路线分配”模式快速核对各组工作量
 * 将汇总结果写入 调试结果/路线分配结果.txt 文件
 * 依赖全局：pathings
 */
async function printGroupSummary() {
    const groupNames = [
        '路径组一', '路径组二', '路径组三', '路径组四', '路径组五',
        '路径组六', '路径组七', '路径组八', '路径组九', '路径组十'
    ];

    // 创建结果字符串
    let resultText = "路线分配结果汇总\n";
    resultText += "=".repeat(50) + "\n\n";

    // 统计所有选中的路线
    const selectedPathings = pathings.filter(p => p.selected);
    resultText += `总选中路线数: ${selectedPathings.length} 条\n\n`;

    let totalElites = 0, totalMonsters = 0, totalGain = 0, totalTime = 0, totalIgnoredElites = 0;

    for (let g = 1; g <= 10; g++) {
        const groupPath = pathings.filter(p => p.group === g && p.selected);
        if (groupPath.length === 0) continue;   // 跳过空组

        let elites = 0, monsters = 0, gain = 0, time = 0, ignoredElites = 0;

        for (const p of groupPath) {
            elites += p.e || 0;
            monsters += p.m || 0;
            gain += p.G1 || 0;
            time += p.t || 0;
            ignoredElites += (p.original_e || 0) - (p.e || 0);
        }

        // 累加到总计
        totalElites += elites;
        totalMonsters += monsters;
        totalGain += gain;
        totalTime += time;
        totalIgnoredElites += ignoredElites;

        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = time % 60;

        // 获取该组的标签配置
        const tagsKey = `tagsForGroup${g}`;
        const groupTags = settings[tagsKey] || '';
        const tagType = g === 1 ? "排除的标签" : "选择的标签";

        // 构建输出内容
        const outputLines = [
            `${groupNames[g - 1]} 总计：`,
            `  ${tagType}:【${groupTags}】`,
            `  路线条数: ${groupPath.length}`,
            `  精英怪数: ${elites.toFixed(0)}`,
            `  被忽视精英数: ${ignoredElites.toFixed(0)}`,
            `  小怪数  : ${monsters.toFixed(0)}`,
            `  预计收益: ${gain.toFixed(0)} 摩拉`,
            `  预计用时: ${h} 时 ${m} 分 ${s.toFixed(0)} 秒`,
            "" // 空行
        ];

        // 输出到控制台和结果文本
        outputLines.forEach(line => {
            if (line === "") {
                // 空行不输出到控制台，但保留在结果文本中
                resultText += "\n";
            } else {
                log.info(line);
                resultText += line + "\n";
            }
        });
    }

    // 添加总计信息
    const totalH = Math.floor(totalTime / 3600);
    const totalM = Math.floor((totalTime % 3600) / 60);
    const totalS = totalTime % 60;

    resultText += "=".repeat(50) + "\n";
    resultText += "总体统计：\n";
    resultText += `  总路线数: ${selectedPathings.length} 条\n`;
    resultText += `  总精英怪: ${totalElites.toFixed(0)}\n`;
    resultText += `  被忽视精英怪数: ${totalIgnoredElites.toFixed(0)}\n`;
    resultText += `  总小怪数: ${totalMonsters.toFixed(0)}\n`;
    resultText += `  总收益  : ${totalGain.toFixed(0)} 摩拉\n`;
    resultText += `  总用时  : ${totalH} 时 ${totalM} 分 ${totalS.toFixed(0)} 秒\n`;
    resultText += "=".repeat(50) + "\n\n";

    // 其他配置信息
    resultText += "配置参数：\n";
    resultText += `  精英效率指数: ${settings.eEfficiencyIndex || 2.5}\n`;
    resultText += `  小怪效率指数: ${settings.mEfficiencyIndex || 0.5}\n`;
    resultText += `  好奇系数: ${settings.curiosityFactor || 0}\n`;
    resultText += `  忽略比例: ${settings.ignoreRate || 0}\n`;
    resultText += `  目标精英数: ${settings.targetEliteNum || 400}\n`;
    resultText += `  目标小怪数: ${settings.targetMonsterNum ?? 2000}\n`;
    resultText += `  优先级标签: ${settings.priorityTags || ''}\n`;
    resultText += `  排除标签: ${settings.excludeTags || ''}\n\n`;

    // 写入文件
    const filePath = "调试结果/路线分配结果.txt";
    try {
        await file.writeText(filePath, resultText, false);
        log.info(`路线分配结果已保存至: ${filePath}`);
    } catch (error) {
        log.error(`保存路线分配结果文件失败: ${error.message}`);
    }
}

/**
 * 调试-按组导出路线文件
 * 仅复制被选中的路线（selected===true）到本地调试目录
 * 输出结构：调试结果/group{1..10}/原相对路径/文件名.json
 * 用于“调试路线分配”模式，人工核对各组最终路线清单
 * 依赖：file 读写接口、pathings（已有 selected & group）
 */
async function copyPathingsByGroup(pathings) {
    // 遍历 pathings 数组
    for (const pathing of pathings) {
        // 只处理 selected 为 true 的项
        if (pathing.selected) {
            // 读取文件内容
            const content = await file.readText(pathing.fullPath);
            // 构造目标路径
            const groupFolder = `调试结果/group${pathing.group}`;
            const targetPath = `${groupFolder}/${pathing.fullPath}`;
            // 写入文件内容
            await file.writeText(targetPath, content, false);
        }
    }
}

/* ========================= ④ 路线执行引擎 =========================
 * 负责：单条路线的真正执行（地图追踪）、并发拾取、异常状态检测、泥头车放技能
 * 通过 Promise.allSettled 并发跑主任务+拾取+异常监控+泥头车
 * ============================================================== */

/**
 * 单路线执行与并发监控
 * 1. 前置处理：白芙切黑芙、吃料理buff、水下路线补螃蟹技能
 * 2. 并发启动四个子任务：
 *    - pathingTask：真正执行地图追踪文件
 *    - pickupTask：模板匹配拾取物品
 *    - errorProcessTask：冻结/白芙/烹饪界面检测与脱困
 *    - blacklistTask：背包满时OCR识别并拉黑多余物品
 *    - dumperTask（可选）：接近战斗坐标时自动切人放E
 * 3. 全部子任务完成后返回，state.running 被置 false
 * 依赖全局：settings、state、pathings、targetItems、dumpers、doFurinaSwitch、lastEatBuff 等
 */
async function runPath(fullPath, map_name, pm, pe) {
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
            await sleep(300);
            let type = "食物"
            await findAndClick([`assets/背包界面/${type}1.png`, `assets/背包界面/${type}2.png`]);
            await sleep(300);
            // 2. 遍历数组，逐项执行
            for (const item of res) {
                await sleep(300);
                await findAndClick(['assets/筛选1.png', 'assets/筛选2.png']);
                await findAndClick("assets/重置.png");
                await sleep(500);
                await findAndClick("assets/搜索.png");
                await sleep(1000);
                // 真正输入当前这一项
                log.info(`搜索${item}`)
                inputText(item);
                await findAndClick("assets/确认筛选.png");
                await sleep(500);
                await findAndClick("assets/使用.png");
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
            let skillRes = await findAndClick("assets/螃蟹技能图标.png", false, 1000);
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
        // 从 fullPath 中提取纯文件名（去掉路径和扩展名）
        const fileName = fullPath.split(/[\\/]/).pop();

        let doLogMonsterCount = true;
        log.info(`开始执行路线: ${fileName}`);
        await fakeLog(`${fileName}`, true);
        try {
            await pathingScript.runFile(fullPath);
        } catch (error) {
            log.error(`执行地图追踪出现错误${error.message}`);
        }
        try {
            await sleep(1);
        } catch (e) {
            doLogMonsterCount = false;
        }
        if (settings.logMonsterCount && doLogMonsterCount) {
            const m = Math.floor(pm);
            const e = Math.floor(pe);
            const lines = [];
            for (let i = 0; i < m; i++) lines.push('交互或拾取："小怪"');
            for (let i = 0; i < e; i++) lines.push('交互或拾取："精英"');
            if (lines.length) log.debug(lines.join('\n'));
        }
        await fakeLog(`${fileName}`, false);
        state.running = false;
    })();

    /* ---------- 伴随任务 ---------- */
    const pickupTask = (async () => {
        if (pickup_Mode.includes("模板匹配")) {
            await recognizeAndInteract();
        }
    })();

    const errorProcessTask = (async () => {
        let errorProcessCount = 0;
        while (state.running) {
            if (errorProcessCount % 5 === 0) {
                //每约250毫秒进行一次冻结检测和白芙检测
                if (await findAndClick(frozenRo, false, 2, 3)) {
                    log.info("检测到冻结，尝试挣脱");
                    for (let m = 0; m < 3; m++) {
                        keyPress("VK_SPACE");
                        await sleep(30);
                    }
                    continue;
                }
                if (!doFurinaSwitch) {
                    if (await findAndClick(whiteFurinaRo, false, 2, 3)) {
                        log.info("检测到白芙，本路线运行结束后切换芙宁娜形态");
                        doFurinaSwitch = true;
                        continue;
                    }
                }
                if (await findAndClick(revivalRo, true, 2, 3)) {
                    log.info("识别到复苏按钮，点击");
                    await sleep(500);
                    continue;
                }
            }
            if (errorProcessCount % 100 === 0) {
                //每约5000毫秒进行一次烹饪检测
                if (await findAndClick(cookingRo, false, 2, 3)) {
                    log.info("检测到烹饪界面，尝试脱离");
                    keyPress("VK_ESCAPE");
                    await sleep(500);
                    continue;
                }
            }
            errorProcessCount++;
            await sleep(50);
        }
    })();

    const blacklistTask = (async () => {
        async function checkItemFull() {
            const maxAttempts = 1;
            let attempts = 0;
            while (attempts < maxAttempts && state.running) {
                try {
                    gameRegion.dispose();
                    gameRegion = captureGameRegion();
                    const result = gameRegion.find(itemFullRo);
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

        if (pickup_Mode.includes("模板匹配")) {
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

/**
 * 模板匹配拾取主循环
 * 持续识别屏幕 F 图标 → 根据物品名模板匹配 → 黑名单过滤 → 按键拾取
 * 同时通过滚轮上下翻页扩大识别范围，避免漏捡
 * 将本次拾取记录回写至当前路线对象，用于下次优先识别
 * 依赖全局：state、targetItems、blacklistSet、pickupDelay、rollingDelay 等
 */
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
        //log.info("调试-交互拾取进行中");
        gameRegion.dispose();
        gameRegion = captureGameRegion();
        let centerYF = await findFIcon();

        if (!centerYF) {
            if (new Date() - lastRoll >= 200) {
                lastRoll = new Date();
                if (await isMainUI()) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                }
            }
            continue;
        }

        let foundTarget = false;
        if (pickup_Mode.includes("模板匹配")) {
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
 * 泥头车自动放 E
 * 读取当前路线坐标，若检测到即将进入战斗点（5-30 像素）且路线未使用按键 T，
 * 则按 dumpers 列表循环切人放 E，CD 10 秒；若检测到复活界面则立即退出
 * 返回前内部定义 isRevivalUI 用于自救
 * 依赖全局：state、dumpers、lastDumperTimer、dumperCD
 */
async function dumper(pathFilePath, map_name) {
    //log.info("开始泥头车");
    let lastDumperTimer = 0;
    const dumperCD = 10000;
    try {
        const pathingContent = await file.readText(pathFilePath);
        const parsedContent = JSON.parse(pathingContent);
        const positions = parsedContent.positions;
        // 初始化 disableDumper 为 false
        let disableDumper = false;

        // 初始化 fightPositions 数组
        let fightPositions = [];

        // 遍历 positions 数组
        for (const pos of positions) {
            // 检查 action_params 是否包含 keypress(T)
            if (pos.action_params && pos.action_params.includes('keypress(T)')) {
                disableDumper = true;
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

        //6.3强制使用sift的地图不开启泥头车
        const info = parsedContent.info;
        if (info.map_match_method && info.map_match_method === "SIFT") {
            disableDumper = true;
        }

        if (!disableDumper) {
            while (state.running) {
                //log.info("调试-泥头车循环");
                await sleep(501);
                if (await isMainUI() && !await findAndClick(flyingRo, false, 2, 3)) {
                    //log.info("调试-获取坐标");
                    //在主界面才尝试获取坐标
                    let dumperDistance = 0;
                    try {
                        let shouldPressKeys = false;
                        const currentPosition = await genshin.getPositionFromMap(map_name);
                        if (!currentPosition) {
                            continue;
                        }
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

/* ========================= ⑤ 批量调度与数据持久化 =========================
 * 负责：按组依次执行路线、刷新时间(CD)判断、坐标偏差校验、运行耗时记录
 * 把本次运行结果写回 records/{账户}.json 与黑名单文件
 * ======================================================================= */

/**
 * 批量调度与持久化主入口
 * 1. 按用户选择的“路径组X”筛选路线，输出组内总计精英/小怪/收益/时长
 * 2. 循环执行组内每条路线：CD未到则跳过；否则runPath()并记录真实耗时
 * 3. 坐标偏差校验，失败≥1次且未禁用检查时放弃写入运行数据
 * 4. 计算下次刷新时间（CD）并写回 records/{accountName}.json
 * 依赖：settings、pathings、runPath、updateRecords、isTimeRestricted 等
 */
async function processPathingsByGroup(pathings, accountName) {
    let lastX = 0;
    let lastY = 0;

    if (settings.enableCoordCheck) {
        try {
            await genshin.returnMainUi();
            const miniMapPosition = await genshin.getPositionFromMap(pathing.map_name);
            if (miniMapPosition) {
                // 更新坐标
                lastX = miniMapPosition.X;
                lastY = miniMapPosition.Y;
            }
        } catch (error) {
            log.error(`获取坐标时发生错误：${error.message}`);
        }
    }

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
    // 将预计总时间转换为时、分、秒表示
    const hours = Math.floor(totalEstimatedTime / 3600);
    const minutes = Math.floor((totalEstimatedTime % 3600) / 60);
    const seconds = totalEstimatedTime % 60;


    // 输出当前组的总计信息
    log.info(`当前组 ${selectedGroupName} 的总计信息：`);
    log.info(`精英怪数量: ${totalElites.toFixed(0)}`);
    log.info(`小怪数量: ${totalMonsters.toFixed(0)}`);
    if (settings.operationMode != "启用仅指定怪物模式") {
        log.info(`预计收益: ${totalGain.toFixed(0)} 摩拉`);
    }
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

            // 调用 runPath 函数处理路径
            await runPath(pathing.fullPath, pathing.map_name, pathing.m, pathing.e);
            try {
                await sleep(1);
            } catch (error) {
                break;
            }
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
            let coordAbnormal = false;
            if (settings.enableCoordCheck) {
                try {
                    await genshin.returnMainUi();
                    const miniMapPosition = await genshin.getPositionFromMap(pathing.map_name);
                    if (miniMapPosition) {
                        const diffX = Math.abs(lastX - miniMapPosition.X);
                        const diffY = Math.abs(lastY - miniMapPosition.Y);
                        const endDiffX = Math.abs(fileEndX - miniMapPosition.X);
                        const endDiffY = Math.abs(fileEndY - miniMapPosition.Y);

                        lastX = miniMapPosition.X;
                        lastY = miniMapPosition.Y;

                        if ((diffX + diffY) < 5 || (endDiffX + endDiffY) > 30) {
                            coordAbnormal = true;
                        }
                    }
                } catch (error) {
                    log.error(`获取坐标时发生错误：${error.message}`);
                    coordAbnormal = true;
                }
            }
            await genshin.returnMainUi();
            let mainUiRes = await isMainUI(2000);
            let reconnectRes = await findAndClick(["assets/确认.png", "assets/重新连接服务器.png"], true, 300);
            if ((coordAbnormal && settings.enableCoordCheck) || !mainUiRes || reconnectRes) {
                log.error("路线未正常完成、坐标获取异常或不处于主界面，不记录运行数据");
                notification.send(`路线${pathing.fileName}:路线未正常完成、坐标获取异常或不处于主界面，不记录运行数据`);
                continue;
            }

            // 计算下一个 UTC 时间的晚上 8 点（即北京时间凌晨四点）
            let newCDTime = new Date(now);
            newCDTime.setUTCHours(20, 0, 0, 0); // 设置为 UTC 时间的 20:00
            if (newCDTime <= now) {
                // 如果设置的时间小于等于当前时间，说明需要取下一个晚上 8 点
                newCDTime.setUTCHours(20 + 24, 0, 0, 0); // 设置为下一个 UTC 时间的 20:00
            }
            if (pathing.m !== 0 && !pathing.tags.includes("传奇")) {
                const nowPlus12h = new Date(now.getTime() + 12 * 3600 * 1000); // now + 12h
                if (newCDTime < nowPlus12h) {
                    newCDTime = nowPlus12h;
                }
            }
            // 更新路径的 cdTime
            pathing.cdTime = newCDTime.toLocaleString();
            if (!localeWorks) pathing.cdTime = newCDTime.toISOString();

            await updateRecords(pathings, accountName);
        }
    }
}

/**
 * 初始化或更新路线CD与运行记录
 * 读取 records/{accountName}.json：
 *   - 为每条路线赋予 cdTime（本地或UTC）与最近7次运行时长
 *   - 拾取历史仅保留最后20个不重复项
 * 若记录文件缺失则初始化为7条-1
 * 依赖：file、accountName、localeWorks
 */
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

/**
 * 回写运行记录
 * 把当前 pathings 数组中的 cdTime、records、items、标签、预计用时
 * 按文件名为主键写入 records/{accountName}.json（倒序，仅保留>0的时长）
 * 供下次启动时 initializeCdTime() 加载
 * 依赖：file、accountName
 */
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

/**
 * 黑名单加载/保存
 * @param {boolean} merge  true 时先与本地文件合并再去重；false 仅重写内存到磁盘
 * 内存结构：blacklist 数组 + blacklistSet Set 用于O(1)查询
 * 文件路径：blacklists/{accountName}.json
 * 依赖：file、accountName、blacklist/blacklistSet
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

/* ========================= ⑥ 底层工具 =========================
 * 负责：队伍切换、时间规则判断、模板匹配点击、OCR、日志伪造、目录递归读取等
 * 供以上各模块随时调用
 * =========================================================== */

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
 * 判断当前是否位于主界面
 * @param {number} maxDuration 最大允许耗时（毫秒）
 */
async function isMainUI(maxDuration = 10) {
    const start = Date.now();
    let dodispose = false;
    while (Date.now() - start < maxDuration) {
        if (!gameRegion) {
            gameRegion = captureGameRegion();
            dodispose = true;
        }
        try {
            const result = gameRegion.find(mainUIRo);
            if (result.isExist()) return true;
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            return false;          // 一旦出现异常直接退出，不再重试
        }
        await sleep(checkDelay);   // 识别间隔
        if (dodispose) {
            gameRegion.dispose();
            dodispose = false;     // 已经释放，标记避免重复 dispose
        }
    }
    /* 超时仍未识别到，返回失败 */
    return false;
}

// 加载拾取物图片
async function loadTargetItems() {

    let targetItemPath;
    if (pickup_Mode === "模板匹配拾取，拾取狗粮和怪物材料") {
        targetItemPath = "assets/targetItems/";
    } else if (pickup_Mode === "模板匹配拾取，只拾取狗粮") {
        targetItemPath = "assets/targetItems/其他/";
    } else {
        return null;
    }
    log.info("开始加载模板图片");
    const items = await readFolder(targetItemPath, "png");

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

/**
 * 递归读取目录下所有文件
 * @param {string} folderPath 起始目录
 * @param {string} [ext='']   需要的文件后缀，空字符串表示不限制；例如 'json' 或 '.json' 均可
 * @returns {Array<{fullPath:string, fileName:string, folderPathArray:string[]}>}
 */
async function readFolder(folderPath, ext = '') {
    // 统一后缀格式：确保前面有一个点，且全小写
    const targetExt = ext ? (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase() : '';

    const folderStack = [folderPath];
    const files = [];

    while (folderStack.length > 0) {
        const currentPath = folderStack.pop();
        const filesInSubFolder = file.ReadPathSync(currentPath); // 同步读取当前目录
        const subFolders = [];

        for (const filePath of filesInSubFolder) {
            if (file.IsFolder(filePath)) {
                subFolders.push(filePath);          // 子目录稍后处理
            } else {
                // 后缀过滤
                if (targetExt) {
                    const fileExt = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
                    if (fileExt !== targetExt) continue;
                }

                const fileName = filePath.split('\\').pop();
                const folderPathArray = filePath.split('\\').slice(0, -1);
                files.push({ fullPath: filePath, fileName, folderPathArray });
            }
        }

        // 保持同层顺序，reverse 后仍按原顺序入栈
        folderStack.push(...subFolders.reverse());
    }

    return files;
}

/**
 * 伪造 BetterGenshinImpact 的js/地图追踪日志
 * 1. 执行地图追踪等任务时，输出日志来让日志分析可以看到地图追踪的信息。
 * 2. 支持两种任务类型：JS 脚本 与 地图追踪任务（通过 isJs 切换）。
 * 3. 支持可选耗时统计，仅在“结束”时拼接到日志中。
 *
 * 参数：
 * @param {string}  name      任务名称，会原样输出到日志里
 * @param {boolean} isStart   true → 开始日志；false → 结束日志
 * @param {number}  [duration=0]  耗时（毫秒），仅在结束日志中用到；为 0 时不显示耗时
 * @param {boolean} [isJs=false]  任务类型：true 为 JS 脚本，false 为地图追踪任务
 *
 * 示例：
 *   // 地图追踪开始
 *   await fakeLog('采集路线', true);
 *
 *   // JS 脚本结束，耗时 12.5 秒
 *   await fakeLog('自动钓鱼', false, 12500, true);
 */
async function fakeLog(name, isStart, duration = 0, isJs = false) {
    await sleep(1);
    const currentTime = Date.now();

    /* ---------------- 时间格式化 ---------------- */
    const t = new Date(currentTime);
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    const msec = String(t.getMilliseconds()).padStart(3, '0');
    const formattedTime = `${hh}:${mm}:${ss}.${msec}`;

    /* ---------------- 耗时格式化（仅结束用） ---------------- */
    const totalSec = duration / 1000;
    const durationMinutes = Math.floor(totalSec / 60);
    const durationSeconds = (totalSec % 60).toFixed(3);

    /* ---------------- 四分支，输出与旧版完全一致 ---------------- */
    if (isJs && isStart) {
        const logMessage = `正在伪造js开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行JS脚本: "${name}"`;
        log.debug(logMessage);
    }
    if (isJs && !isStart) {
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
    }
    if (!isJs && isStart) {
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.debug(logMessage);
    }
    if (!isJs && !isStart) {
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.debug(logMessage);
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

/**
 * 通用找图/找RO并可选点击（支持单图片文件路径、单RO、图片文件路径数组、RO数组）
 * @param {string|string[]|RecognitionObject|RecognitionObject[]} target
 * @param {boolean}  [doClick=true]                是否点击
 * @param {number}   [timeout=3000]                识别时间上限（ms）
 * @param {number}   [interval=50]                 识别间隔（ms）
 * @param {number}   [retType=0]                   0-返回布尔；1-返回 Region 结果
 * @param {number}   [preClickDelay=50]            点击前等待
 * @param {number}   [postClickDelay=50]           点击后等待
 * @returns {boolean|Region}  根据 retType 返回是否成功或最终 Region
 */
async function findAndClick(target,
    doClick = true,
    timeout = 3000,
    interval = 50,
    retType = 0,
    preClickDelay = 50,
    postClickDelay = 50) {
    try {
        // 1. 统一转成 RecognitionObject 数组
        let ros = [];
        if (Array.isArray(target)) {
            ros = target.map(t =>
                (typeof t === 'string')
                    ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(t))
                    : t
            );
        } else {
            ros = [(typeof target === 'string')
                ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(target))
                : target];
        }

        const start = Date.now();
        let found = null;

        while (Date.now() - start <= timeout) {
            const gameRegion = captureGameRegion();
            try {
                // 依次尝试每一个 ro
                for (const ro of ros) {
                    const res = gameRegion.find(ro);
                    if (!res.isEmpty()) {          // 找到
                        found = res;
                        if (doClick) {
                            await sleep(preClickDelay);
                            res.click();
                            await sleep(postClickDelay);
                        }
                        break;                     // 成功即跳出 for
                    }
                }
                if (found) break;                  // 成功即跳出 while
            } finally {
                gameRegion.dispose();
            }
            await sleep(interval);                 // 没找到时等待
        }

        // 3. 按需返回
        return retType === 0 ? !!found : (found || null);

    } catch (error) {
        log.error(`执行通用识图时出现错误：${error.message}`);
        return retType === 0 ? false : null;
    }
}