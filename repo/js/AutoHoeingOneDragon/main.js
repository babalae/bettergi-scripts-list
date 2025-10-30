//当前js版本1.10.0

let timeMoveUp;
let timeMoveDown;
let pickup_Mode = settings.pickup_Mode || "模板匹配拾取，拾取狗粮和怪物材料";
let dumpers;
if (settings.activeDumperMode) { //处理泥头车信息
    dumpers = settings.activeDumperMode.split('，').map(Number).filter(num => num === 1 || num === 2 || num === 3 || num === 4);
} else {
    dumpers = [];
}
let gameRegion;
let targetItemPath = "assets/targetItems";
let mainUITemplate = file.ReadImageMatSync("assets/MainUI.png");
let itemFullTemplate = file.ReadImageMatSync("assets/itemFull.png");
let frozenTemplate = file.ReadImageMatSync("assets/解除冰冻.png");
const frozenRo = RecognitionObject.TemplateMatch(frozenTemplate, 1379, 574, 1463 - 1379, 613 - 574);
let cookingTemplate = file.ReadImageMatSync("assets/烹饪界面.png");
const cookingRo = RecognitionObject.TemplateMatch(cookingTemplate, 1547, 965, 1815 - 1547, 1059 - 965);
let whiteFurinaTemplate = file.ReadImageMatSync("assets/白芙图标.png");
let whiteFurinaRo = RecognitionObject.TemplateMatch(whiteFurinaTemplate, 1634, 967, 1750 - 1634, 1070 - 967);
whiteFurinaRo.Threshold = 0.99;
whiteFurinaRo.InitTemplate();

let targetItems;
let doFurinaSwitch = false;

let rollingDelay = (+settings.rollingDelay || 25);
const pickupDelay = (+settings.pickupDelay || 100);
const timeMove = (+settings.timeMove || 1000);

let warnMessage = [];
let blacklist = [];
let blacklistSet = new Set();
let state;
const accountName = settings.accountName || "默认账户";
let pathings;
let localeWorks;
(async function () {
    targetItems = await loadTargetItems();
    //自定义配置处理
    const operationMode = settings.operationMode || "运行锄地路线";

    localeWorks = !isNaN(Date.parse(new Date().toLocaleString()));
    if (!localeWorks) {
        log.warn('[WARN] 当前设备 toLocaleString 无法被 Date 解析');
        log.warn('[WARN] 建议不要使用12小时时间制');
        await sleep(5000);
    }

    let k = settings.efficiencyIndex;
    // 空字符串、null、undefined 或非数字 → 0.5
    if (k === '' || k == null || Number.isNaN(Number(k))) {
        k = 0.5;
    } else {
        k = Number(k);
        if (k < 0) k = 0;
        else if (k > 5) k = 5;
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

    const priorityTags = (settings.priorityTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);
    const excludeTags = (settings.excludeTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);
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
    pathings = await processPathings();

    //按照用户配置标记路线
    await markPathings(pathings, groupTags, priorityTags, excludeTags);

    //找出最优组合
    await findBestRouteGroups(pathings, k, targetEliteNum, targetMonsterNum);

    //分配到不同路径组
    await assignGroups(pathings, groupTags);
    /*
        //分配结果输出
        pathings.forEach((pathing, index) => {
            log.info(`路径 ${index + 1}:`);
            log.info(`  fullPath: ${pathing.fullPath}`);
            log.info(`  fileName: ${pathing.fileName}`);
            log.info(`  group: ${pathing.group}`);
            log.info(`  cdTime: ${pathing.cdTime}`);
            log.info(`  tags: ${pathing.tags.join(', ')}`);
            log.info(`  available: ${pathing.available}`);
            log.info(`  selected: ${pathing.selected}`);
            log.info(`  预计用时: ${pathing.t} 秒`);
            log.info(`  普通怪物数量: ${pathing.m}`);
            log.info(`  精英怪物数量: ${pathing.e}`);
            log.info(`  普通怪物摩拉值: ${pathing.mora_m}`);
            log.info(`  精英怪物摩拉值: ${pathing.mora_e}`);
            log.info(''); // 空行分隔每个路径的信息
        });
    */
    //根据操作模式选择不同的处理方式
    if (operationMode === "输出地图追踪文件") {
        log.info("开始复制并输出地图追踪文件\n请前往js文件夹查看");
        await copyPathingsByGroup(pathings);
        await updateRecords(pathings, accountName);
    } else if (operationMode === "运行锄地路线") {
        await switchPartyIfNeeded(partyName);
        // 检测四神队伍并输出当前角色
        const avatars = getAvatars() || [];
        const need = ['钟离', '芙宁娜', '纳西妲', '雷电将军'];

        let improperTeam = true;
        for (let i = 0; i < need.length; i++) {
            let found = false;
            for (let j = 0; j < avatars.length; j++) {
                if (avatars[j] === need[i]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                improperTeam = false;
                break;
            }
        }

        // 手动拼接角色名，避免 join 报错
        let teamStr = '';
        for (let k = 0; k < avatars.length; k++) {
            teamStr += avatars[k];
            if (k < avatars.length - 1) {
                teamStr += '、';
            }
        }

        log.info('当前队伍：' + teamStr);
        if (improperTeam) {
            log.warn("当前队伍不适合锄地，建议重新阅读readme相关部分");
            await sleep(5000);
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
async function processPathings() {
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

                // 添加标签
                if (monster.tags && monster.tags.length > 0) {
                    pathing.tags.push(...monster.tags);
                }
            }
        }

        // 去除重复标签
        pathing.tags = [...new Set(pathing.tags)];
        // 处理 map_name 属性
        pathing.map_name = parsedContent.info?.map_name || "Teyvat"; // 如果有 map_name，则使用其值，否则默认为 "Teyvat"
    }

    //优先使用index中的数据
    // 更新 pathings 的函数，接受索引文件路径作为参数
    async function updatePathings(indexFilePath) {
        try {
            // 读取文件内容
            const fileContent = await file.readText(indexFilePath);
            // 将文件内容解析为 JSON 格式
            const data = JSON.parse(fileContent);

            // 遍历解析后的 JSON 数据
            for (const item of data) {
                // 检查 pathings 中是否存在某个对象的 fileName 属性与 item.fileName 相同
                const existingPathing = pathings.find(pathing => pathing.fileName === item.fileName);

                if (existingPathing) {
                    // 直接覆盖其他字段，但先检查是否存在有效值
                    if (item.时间 !== undefined) existingPathing.t = item.时间;
                    if (item.精英摩拉 !== undefined) existingPathing.mora_e = item.精英摩拉;
                    if (item.小怪摩拉 !== undefined) existingPathing.mora_m = item.小怪摩拉;
                    if (item.小怪数量 !== undefined) existingPathing.m = item.小怪数量;
                    if (item.精英数量 !== undefined) existingPathing.e = item.精英数量;

                    // 使用 Set 来存储 tags，避免重复项
                    const tagsSet = new Set(existingPathing.tags);
                    for (const key in item) {
                        if (key !== "fileName" && key !== "时间" && key !== "精英摩拉" && key !== "小怪摩拉" && key !== "小怪数量" && key !== "精英数量") {
                            if (item[key] === 1) {
                                tagsSet.add(key);
                            }
                        }
                    }
                    existingPathing.tags = Array.from(tagsSet);
                }
            }
        } catch (error) {
            log.error("Error:", error);
        }
    }
    //await updatePathings("assets/index1.json");
    //await updatePathings("assets/index2.json");

    for (const pathing of pathings) {
        if (!settings.disableSelfOptimization && pathing.records) {
            //如果用户没有禁用自动优化，则参考运行记录更改预期用时
            const history = pathing.records.filter(v => v > 0);
            if (history.length) {
                const max = Math.max(...history);
                const min = Math.min(...history);

                let maxRemoved = false;
                let minRemoved = false;

                // 就地修改 history：先去掉一个最大值，再去掉一个最小值
                for (let i = history.length - 1; i >= 0; i--) {
                    const v = history[i];
                    if (!maxRemoved && v === max) {
                        history.splice(i, 1);
                        maxRemoved = true;
                    } else if (!minRemoved && v === min) {
                        history.splice(i, 1);
                        minRemoved = true;
                    }
                    if (maxRemoved && minRemoved) break;
                }
            }
            prevt = pathing.t;
            //每一个有效的record占用0.2权重，剩余权重为原时间
            pathing.t = pathing.t * (1 - history.length * 0.2) + history.reduce((a, b) => a + b, 0) * 0.2;
            //log.info(`将路线${pathing.fileName}用时从${prevt}更新为${pathing.t}`)
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

async function findBestRouteGroups(pathings, k, targetEliteNum, targetMonsterNum) {
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
        p.E1 = p.e === 0 ? 0 : ((G1 - G2 * f) / p.e) ** k * (G1 / p.t);
        p.E2 = p.m === 0 ? 0 : (G2 / p.m) ** k * (G2 / p.t);
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

    /* ========== 3. 最小不可再减集合（贪心逆筛） ========== */
    // 3.1 【仅修改此处】排序依据改为约定的score：(怪均收益^k) × 秒均收益（精英权重=5）
    // 怪均收益 = (总收益) / (精英数×5 + 普通怪数)；秒均收益 = 总收益 / 时间；score小的优先删除
    const selectedList = pathings.filter(p => p.selected)
        .sort((a, b) => {
            // 计算a的score
            const aTotalGain = a.G1 + a.G2;
            const aDenominator = a.e * 5 + a.m; // 精英权重=5
            const aPerMobGain = aDenominator === 0 ? 0 : aTotalGain / aDenominator;
            const aPerSecGain = a.t === 0 ? 0 : aTotalGain / a.t;
            const aScore = (aPerMobGain ** k) * aPerSecGain;

            // 计算b的score
            const bTotalGain = b.G1 + b.G2;
            const bDenominator = b.e * 5 + b.m; // 精英权重=5
            const bPerMobGain = bDenominator === 0 ? 0 : bTotalGain / bDenominator;
            const bPerSecGain = b.t === 0 ? 0 : bTotalGain / b.t;
            const bScore = (bPerMobGain ** k) * bPerSecGain;

            // 升序排序：score小的在前，优先删除
            return aScore - bScore;
        });

    for (const p of selectedList) {
        // 试删
        const newE = totalSelectedElites - p.e;
        const newM = totalSelectedMonsters - p.m;
        if (newE >= targetEliteNum && newM >= targetMonsterNum) {
            // 删了仍达标，真删
            p.selected = false;
            totalSelectedElites = newE;
            totalSelectedMonsters = newM;
            totalGainCombined -= (p.selected ? p.G1 : p.G2);
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
    if (settings.runByEfficiency) {
        log.info("使用效率降序运行");
        pathings.sort((a, b) => b.E1 - a.E1 || b.E2 - a.E2);
    } else {
        log.info("使用默认顺序运行");
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

async function runPath(fullPath, map_name) {
    //当需要切换芙宁娜形态时，执行一次强制黑芙
    if (doFurinaSwitch) {
        log.info("上条路线识别到白芙，开始强制切换黑芙")
        doFurinaSwitch = false;
        await pathingScript.runFile("assets/强制黑芙.json");
    }
    /* ===== 1. 取得当前路线对象 ===== */
    let currentPathing = null;
    for (let i = 0; i < pathings.length; i++) {
        if (pathings[i].fullPath === fullPath) {
            currentPathing = pathings[i];
            break;
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
        await pathingScript.runFile(fullPath);
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
                        for (const targetItem of targetItems) {
                            const cnPart = targetItem.itemName.replace(/[^\u4e00-\u9fa5]/g, '');
                            if (cnPart && ocrText.includes(cnPart)) {
                                const itemName = targetItem.itemName;
                                log.warn(`物品"${itemName}"已满，加入黑名单`);
                                if (!blacklistSet.has(itemName)) {  // 仅当第一次出现才添加
                                    blacklistSet.add(itemName);
                                    blacklist.push(itemName);
                                }
                                await loadBlacklist(false);
                            }
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
    let fIcontemplate = file.ReadImageMatSync('assets/F_Dialogue.png');
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
            if (await isMainUI()) await keyMouseScript.runFile(`assets/滚轮下翻.json`);
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
        try {
            let result;
            let itemName = null;
            for (const targetItem of targetItems) {
                //log.info(`正在尝试匹配${targetItem.itemName}`);
                const cnLen = Math.min([...targetItem.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length, 5);
                const recognitionObject = RecognitionObject.TemplateMatch(
                    targetItem.template,
                    1219,
                    centerYF - 15,
                    12 + 28 * cnLen + 2,
                    30
                );
                recognitionObject.Threshold = targetItem.Threshold;
                recognitionObject.InitTemplate();
                result = gameRegion.find(recognitionObject);
                if (result.isExist()) {
                    itemName = targetItem.itemName;
                    break;
                }
            }
            return itemName;
        } catch (error) {
            log.error(`模板匹配时发生异常: ${error.message}`);
            return null;
        }
    }

    async function findFIcon() {
        let recognitionObject = RecognitionObject.TemplateMatch(fIcontemplate, 1102, 335, 34, 400);
        recognitionObject.Threshold = 0.95;
        recognitionObject.InitTemplate();
        try {
            let result = gameRegion.find(recognitionObject);
            if (result.isExist()) {
                return Math.round(result.y + result.height / 2);
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            if (!state.running)
                return null;
        }
        await sleep(50);
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
    const recognitionObject = RecognitionObject.TemplateMatch(mainUITemplate, 0, 0, 150, 150);
    const maxAttempts = 1;
    let attempts = 0;
    let dodispose = false;
    while (attempts < maxAttempts && state.running) {
        if (!gameRegion) {
            gameRegion = captureGameRegion();
            dodispose = true;
        }
        try {
            const result = gameRegion.find(recognitionObject);
            if (result.isExist()) return true;
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
            if (!state.running) break;
            return false;
        }
        attempts++;
        await sleep(50);
        if (dodispose) {
            gameRegion.dispose;
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

    const items = await readFolder(targetItemPath, false);

    // 统一预加载模板
    for (const it of items) {
        try {
            it.template = file.ReadImageMatSync(it.fullPath);
            it.itemName = it.fileName.replace(/\.png$/i, '');

            // 新增：解析括号中的阈值
            const match = it.fullPath.match(/[（(](.*?)[)）]/); // 匹配英文或中文括号
            if (match) {
                const val = parseFloat(match[1]);
                it.Threshold = (!isNaN(val) && val >= 0 && val <= 1) ? val : 0.85;
            } else {
                it.Threshold = 0.85;
            }
        } catch (error) { }
    }

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
                gameRegion.dispose;
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
    let runningFailCount = 0;

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
        const keysToDelete = ['monsterInfo', 'm', 'e', 'mora_m', 'mora_e', 'available', 'prioritized', 'G1', 'G2', 'index', 'folderPathArray', 'tags', 'E1', 'E2']; // 删除的字段列表
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
            await runPath(pathing.fullPath, pathing.map_name);
            try {
                await sleep(1);
            } catch (error) {
                break;
            }
            await fakeLog(`${pathing.fileName}`, false, false, 0);

            try {
                await genshin.returnMainUi();
                const miniMapPosition = await genshin.getPositionFromMap(pathing.map_name);
                // 比较坐标
                const diffX = Math.abs(lastX - miniMapPosition.X);
                const diffY = Math.abs(lastY - miniMapPosition.Y);
                lastX = miniMapPosition.X;
                lastY = miniMapPosition.Y;
                if ((diffX + diffY) < 5) {
                    runningFailCount++;
                } else {
                    runningFailCount = 0;
                }
                //log.info(`当前位于${pathing.map_name}地图的（${miniMapPosition.X}，${miniMapPosition.Y}，距离上次距离${(diffX + diffY)}`);
            } catch (error) {
                log.error(`获取坐标时发生错误：${error.message}`);
                runningFailCount++;
            }

            if (runningFailCount >= 1) {
                log.error("出发点与终点过于接近，或坐标获取异常，不记录运行数据");
                continue;
            }

            // 计算下一个 UTC 时间的晚上 8 点（即北京时间凌晨四点）
            const nextEightClock = new Date(now);
            nextEightClock.setUTCHours(20, 0, 0, 0); // 设置为 UTC 时间的 20:00
            if (nextEightClock <= now) {
                // 如果设置的时间小于等于当前时间，说明需要取下一个晚上 8 点
                nextEightClock.setUTCHours(20 + 24, 0, 0, 0); // 设置为下一个 UTC 时间的 20:00
            }

            const pathTime = new Date() - now;
            pathing.records = [...pathing.records, pathTime / 1000].slice(-7);

            // 更新路径的 cdTime
            pathing.cdTime = nextEightClock.toLocaleString();
            if (!localeWorks) pathing.cdTime = nextEightClock.toISOString();

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
 * @param {string} timeRule - 时间规则字符串，格式如 "4, 4-6, 10-12"
 * @param {number} [threshold=5] - 接近限制时间的阈值（分钟）
 * @returns {Promise<boolean>} - 如果处于限制时间内或即将进入限制时间，则返回 true，否则返回 false
 */
async function isTimeRestricted(timeRule, threshold = 5) {
    // 如果输入的时间规则为 undefined 或空字符串，视为不进行时间处理，返回 false
    if (timeRule === undefined || timeRule === "") {
        return false;
    }

    // 初始化 0-23 小时为可用状态
    const hours = Array(24).fill(false);

    // 解析时间规则
    const rules = timeRule.split('，').map(rule => rule.trim());

    // 校验输入的字符串是否符合规则
    for (const rule of rules) {
        if (rule.includes('-')) {
            // 处理时间段，如 "4-6"
            const [startHour, endHour] = rule.split('-').map(Number);
            if (isNaN(startHour) || isNaN(endHour) || startHour < 0 || startHour >= 24 || endHour <= startHour || endHour > 24) {
                // 如果时间段格式不正确或超出范围，则报错并返回 true
                log.error("时间填写不符合规则，请检查");
                return true;
            }
            for (let i = startHour; i < endHour; i++) {
                hours[i] = true; // 标记为不可用
            }
        } else {
            // 处理单个时间点，如 "4"
            const hour = Number(rule);
            if (isNaN(hour) || hour < 0 || hour >= 24) {
                // 如果时间点格式不正确或超出范围，则报错并返回 true
                log.error("时间填写不符合规则，请检查");
                return true;
            }
            hours[hour] = true; // 标记为不可用
        }
    }

    // 获取当前时间
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 检查当前时间是否处于限制时间内
    if (hours[currentHour]) {
        log.warn("处于限制时间内");
        return true; // 当前时间处于限制时间内
    }

    // 检查当前时间是否即将进入限制时间
    for (let i = 0; i < 24; i++) {
        if (hours[i]) {
            const nextHour = i;
            const timeUntilNextHour = (nextHour - currentHour - 1) * 60 + (60 - currentMinute);
            if (timeUntilNextHour > 0 && timeUntilNextHour <= threshold) {
                // 如果距离下一个限制时间小于等于阈值，则等待到限制时间开始
                log.warn("接近限制时间，开始等待至限制时间");
                await genshin.tpToStatueOfTheSeven();
                await sleep(timeUntilNextHour * 60 * 1000);
                return true;
            }
        }
    }
    log.info("不处于限制时间");
    return false; // 当前时间不在限制时间内
}