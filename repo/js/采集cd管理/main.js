
/* ===== 强制模板匹配拾取（BEGIN） ===== */
let targetItems = [];
let blacklist = [];
let blacklistSet = new Set();
let gameRegion;
let state = { running: true };
state.runPickupLog = [];   // 本次路线运行中拾取/交互的物品明细
const rollingDelay = 32;
const pickupDelay = 100;
const timeMoveUp = Math.round((settings.timeMove || 1000) * 0.45);
const timeMoveDown = Math.round((settings.timeMove || 1000) * 0.55);
const targetItemPath = "assets/targetItems";
const mainUITemplate = file.ReadImageMatSync("assets/MainUI.png");
const itemFullTemplate = file.ReadImageMatSync("assets/itemFull.png");
const fIcontemplate = file.ReadImageMatSync("assets/F_Dialogue.png");
const accountName = settings.infoFileName || "默认账户";

// 定义目标文件夹路径和记录文件路径
const recordFolder = "record"; // 存储记录文件的文件夹路径
const defaultTimeStamp = "2023-10-13T00:00:00.000Z"; // 固定的时间戳

// 从 settings 中读取用户配置，并设置默认值
const userSettings = {
    operationMode: settings.operationMode || "执行任务（若不存在索引文件则自动创建）",
    pathGroup1CdType: settings.pathGroup1CdType || "",
    pathGroup2CdType: settings.pathGroup2CdType || "",
    pathGroup3CdType: settings.pathGroup3CdType || "",
    otherPathGroupsCdTypes: settings.otherPathGroupsCdTypes || "",
    partyNames: settings.partyNames || "",
    skipTimeRanges: settings.skipTimeRanges || "",
    infoFileName: settings.infoFileName || "默认账户",
    disableJsons: settings.disableJsons || ""
};

let ingredientProcessingFood = settings.ingredientProcessingFood;
let foodCounts = settings.foodCount;

let firstCook = true;
let firstsettime = true;
let lastCookTime = new Date();
let lastsettimeTime = new Date();

// 解析禁用名单
let disableArray = [];
if (userSettings.disableJsons) {
    tmp = userSettings.disableJsons.split('；');
    for (k = 0; k < tmp.length; k++) {
        s = tmp[k].trim();
        if (s) disableArray[disableArray.length] = s;
    }
}

// 将 partyNames 分割并存储到一个数组中
const partyNamesArray = userSettings.partyNames.split(";").map(name => name.trim());

// 新增一个数组 pathGroupCdType，存储每个路径组的 cdtype 信息
const pathGroupCdType = [
    userSettings.pathGroup1CdType,
    userSettings.pathGroup2CdType,
    userSettings.pathGroup3CdType
];

// 如果 otherPathGroupsCdTypes 不为空，将其分割为数组并添加到 pathGroupCdType 中
if (userSettings.otherPathGroupsCdTypes) {
    pathGroupCdType.push(...userSettings.otherPathGroupsCdTypes.split(";"));
}

// 当infoFileName为空时，将其改为由其他自定义配置决定的一个字符串
if (!userSettings.infoFileName) {
    userSettings.infoFileName = [
        userSettings.pathGroup1CdType,
        userSettings.pathGroup2CdType,
        userSettings.pathGroup3CdType,
        userSettings.otherPathGroupsCdTypes,
    ].join(".");
}

let findFInterval = (+settings.findFInterval || 100);
if (findFInterval < 16) {
    findFInterval = 16;
}
if (findFInterval > 200) {
    findFInterval = 200;
}
let lastRoll = new Date();
let checkDelay = Math.round(findFInterval / 2);

let Foods = [];
let foodCount = [];

const FiconRo = RecognitionObject.TemplateMatch(fIcontemplate, 1102, 335, 34, 400);
FiconRo.Threshold = 0.95;
FiconRo.InitTemplate();

const mainUiRo = RecognitionObject.TemplateMatch(mainUITemplate, 0, 0, 150, 150);

(async function () {
    /* ===== 零基构建 settings.json（BEGIN） ===== */
    const SETTINGS_FILE = `settings.json`;
    const PATHINGS_ROOT = `pathing`;

    /* 1. 扫描 pathing 下第一层目录 */
    const filesInFolder = file.ReadPathSync(PATHINGS_ROOT);
    const subFolders = []; // 用于存储第一层文件夹路径
    for (const filePath of filesInFolder) {
        if (file.IsFolder(filePath)) {
            // 如果是文件夹，先存储到临时数组中
            subFolders.push(filePath);
        }
    }

    /* 2. 提取文件夹名称 */
    const firstLevelDirs = subFolders
        .map(folderPath => folderPath.replace(`${PATHINGS_ROOT}/`, '').replace(`${PATHINGS_ROOT}\\`, '')) // 去掉前缀 `pathing/` 或 `pathing\`
        .filter(Boolean); // 去掉空字符串

    let uniqueDirs = Array.from(new Set(firstLevelDirs)); // 去重

    /* 3. 移除多余的 'pathing' 选项 */
    //uniqueDirs = uniqueDirs.filter(dir => dir !== 'pathing');

    /* 4. 路径组数量 */
    const groupCount = Math.min(99, Math.max(1, parseInt(settings.groupCount || '3')));

    /* 5. 硬编码构建全新 JSON */
    const newSettings = [];

    /* 5.1 最前端：onlyRefresh + groupCount */
    newSettings.push(
        {
            name: "onlyRefresh",
            type: "checkbox",
            label: "勾选后仅刷新自定义配置，不运行"
        },
        {
            name: "groupCount",
            type: "input-text",
            label: "需要生成几个路径组配置（1-99）",
            default: "3"
        },
        {
            name: "enableMoreSettings",
            type: "checkbox",
            label: "勾选后下次运行展开高级设置\n用于进行路线筛选和排序"
        }
    );

    /* 5.2 操作模式 */
    newSettings.push({
        name: "operationMode",
        type: "select",
        label: "选择操作模式",
        options: [
            "执行任务（若不存在索引文件则自动创建）",
            "重新生成索引文件（用于强制刷新CD）"
        ]
    });

    /* 5.3 固定尾部节点（原样照搬） */
    newSettings.push(
        {
            "name": "timeRule",
            "type": "input-text",
            "label": "本地时间-不运行时段\n示例写法：\n  单个小时：8\n  连续区间：8-11 或 23:11-23:55（可省略分钟）\n  多项分隔：用中文逗号【，】\n规则：\n  只写小时：开始=整点，结束=59分；跨天自动识别\n  含分钟：按实际时分计算\n  提前10分钟结束并等待到限制时段开始\n留空=全天可运行"
        },
        {
            "name": "infoFileName",
            "type": "input-text",
            "label": "输入用于存储信息的文件名，只在不同账号分别管理CD时填写"
        },
        {
            "name": "disableJsons",
            "type": "input-text",
            "label": "填写需要禁用的路线的关键词，使用中文分号分隔\n文件路径含有相关关键词的路线会被禁用"
        },
        {
            "name": "findFInterval",
            "type": "input-text",
            "label": "识别间隔(毫秒)\n两次检测f图标之间等待时间",
            "default": "100"
        },
        {
            "name": "ingredientProcessingFood",
            "type": "input-text",
            "label": "料理/食材名称\n建议料理和食材分开填写"
        },
        {
            "name": "foodCount",
            "type": "input-text",
            "label": "料理/食材数量\n数量对应上方的食材"
        },
        {
            "name": "setTimeMode",
            "type": "select",
            "label": "尝试调节时间来获得移速加成\n队伍中含迪希雅、嘉明或塔利雅时选择白天\n队伍中含罗莎莉亚时选择夜晚",
            "options": [
                "不调节时间",
                "尽量调为白天",
                "尽量调为夜晚"
            ],
            "default": "不调节时间"
        }
    );

    if (settings.enableMoreSettings) {
        newSettings.push(
            {
                "name": "priorityTags",
                "type": "input-text",
                "label": "优先关键词，文件名或拾取材料含关键词的路线会被视为最高效率\n不同关键词使用【中文逗号】分隔"
            },
            {
                "name": "sortMode",
                "type": "select",
                "label": "选择同组路线排序模式",
                "options": [
                    "文件顺序，按在文件夹中位置顺序运行",
                    "优先最早刷新，将优先执行最早刷新的路线",
                    "优先最高效率，将优先执行最高分均拾取物的路线"
                ],
                "default": "文件顺序，按在文件夹中位置顺序运行"
            },
            {
                "name": "weightedRule",
                "type": "input-text",
                "label": "加权规则，允许将特定物品视为多倍计算效率\n黑名单物品将自动视为0\n格式如下：\n物品名称*权重\n使用【中文逗号】分隔\n如：甜甜花*2，树莓*0"
            }
        );
    }

    /* 5.4 路径组节点（整体移到最后） */
    for (let g = 1; g <= groupCount; g++) {
        /* 文件夹 */
        newSettings.push({
            name: `pathGroup${g}FolderName`,
            type: "select",
            label: `##############################################################################\n选择路径组${g}文件夹（pathing下第一层）`,
            options: ["", ...uniqueDirs]
        });

        /* CD类型 */
        newSettings.push({
            name: `pathGroup${g}CdType`,
            type: "select",
            label: `选择路径组${g}CD类型，不选不运行该路径组`,
            options: [
                "",
                "1次0点刷新",
                "2次0点刷新",
                "3次0点刷新",
                "4点刷新",
                "12小时刷新",
                "24小时刷新",
                "46小时刷新"
            ]
        });

        /* 队伍名 */
        newSettings.push({
            name: `pathGroup${g}PartyName`,
            type: "input-text",
            label: `输入路径组${g}使用配队名称`
        });

        if (settings.enableMoreSettings) {
            newSettings.push({
                "name": `pathGroup${g}thresholdEfficiency`,
                "type": "input-text",
                "label": `路径组${g}临界效率\n分均拾取个数效率低于临界效率的路线会被排除\n无历史记录或历史记录少于3次的路线会被视为恰好处于临界效率`,
                "default": "0"
            });
        }
    }

    /* 6. 一次性写入 & 日志 */
    await file.writeText(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), false);
    log.info(`已全新生成 settings.json，共 ${groupCount} 个路径组配置。`);
    log.info(`扫描到可供选择的文件夹：${uniqueDirs.join(' | ')}`);

    /* 仅刷新模式出口 */
    if (settings.onlyRefresh) {
        settings.onlyRefresh = false;
        return;
    }
    /* ===== 零基构建 settings.json（END） ===== */

    try {
        /* ===== 读取新 settings ===== */
        const groupCount = Math.min(99, Math.max(1, parseInt(settings.groupCount || '3')));
        const folderNames = [];
        const partyNames = [];
        for (let g = 1; g <= groupCount; g++) {
            folderNames.push(settings[`pathGroup${g}FolderName`] || '');
            partyNames.push(settings[`pathGroup${g}PartyName`] || '');
        }

        // 获取子文件夹路径
        const subFolderName = userSettings.infoFileName;
        const subFolderPath = `${recordFolder}/${subFolderName}`;

        // 读取子文件夹中的所有文件路径
        const filesInSubFolder = file.ReadPathSync(subFolderPath);

        // 检查优先顺序：record.json > record.txt
        let indexDoExist = false;
        let useJson = false;
        for (const filePath of filesInSubFolder) {
            const fileName = basename(filePath);
            if (fileName === "record.json") {
                indexDoExist = true;
                useJson = true;
                break;
            }
            if (fileName === "record.txt") {
                indexDoExist = true;
                useJson = false;
            }
        }

        if (userSettings.operationMode === "重新生成索引文件（用于强制刷新CD）") {
            log.info("重新生成索引文件模式，将覆盖现有索引文件");
        }
        if (!indexDoExist) {
            log.info("文件不存在，将尝试生成索引文件");
        }

        /* 禁用BGI原生拾取，强制模板匹配 */
        targetItems = await loadTargetItems();
        await loadBlacklist(true);
        state.running = true;

        await fakeLog("采集cd管理", true, false, 1000);

        // 统一的 record.json 文件路径
        const recordFilePath = `${subFolderPath}/record.json`;

        // 读取 pathing 文件夹下的所有 .json 文件
        const pathingFolder = "pathing";
        const files = await readFolder(pathingFolder, true);
        const filePaths = files.map(file => file.fullPath);

        // ① 先加载已有记录（整对象）
        let recordArray = [];
        if (indexDoExist && useJson) {
            try { recordArray = JSON.parse(await file.readText(recordFilePath)); } catch (e) { }
        } else if (indexDoExist && !useJson) {
            try {
                const txt = await file.readText(`${subFolderPath}/record.txt`);
                txt.trim().split('\n').forEach(line => {
                    const [n, t] = line.trim().split('::');
                    if (n && t) recordArray.push({ fileName: n + '.json', cdTime: t });
                });
            } catch (e) { }
        }

        // ② 建 Map<fileName, 原对象>  确保 history 存在
        const existMap = new Map(recordArray.map(it => [it.fileName, {
            ...it,
            history: it.history || []   // 补空数组
        }]));

        // ③ 对 pathing 里存在的路线：只更新 cdTime，其余保留
        const defaultTime = "1970/1/1 08:00:00";
        for (const filePath of filePaths) {
            const fileName = basename(filePath);
            if (!fileName.endsWith('.json')) continue;

            const old = existMap.get(fileName) || {};
            const newCd = (indexDoExist &&
                userSettings.operationMode !== "重新生成索引文件（用于强制刷新CD）" &&
                old.cdTime)
                ? old.cdTime
                : defaultTime;

            existMap.set(fileName, {
                ...old,          // 保留所有旧字段
                fileName,
                cdTime: newCd,
                history: old.history || []   // 确保有 history
            });
        }

        // ④ 写回（含已消失的路线）
        const writeResult = file.writeTextSync(recordFilePath,
            JSON.stringify(Array.from(existMap.values()), null, 2));

        if (writeResult) {
            log.info(`信息已成功写入: ${recordFilePath}`);
        } else {
            log.error(`写入文件失败: ${recordFilePath}`);
        }


        if (typeof ingredientProcessingFood === 'string' && ingredientProcessingFood.trim()) {
            Foods = ingredientProcessingFood
                .split(/[,，;；\s]+/)          // 支持中英文逗号、分号、空格
                .map(word => word.trim())
                .filter(word => word.length > 0);
        }

        if (typeof foodCounts === 'string' && foodCounts.trim()) {
            foodCount = foodCounts
                .split(/[,，;；\s]+/)
                .map(word => word.trim())
                .filter(word => word.length > 0);
        }

        let cookInterval = 60 * 60 * 1000;
        let settimeInterval = 10 * 60 * 1000;

        // ==================== 路径组循环 ====================
        for (let i = 1; i <= groupCount; i++) {
            const currentCdType = settings[`pathGroup${i}CdType`] || "";
            if (!currentCdType) continue;

            const folder = folderNames[i - 1] || `路径组${i}`;
            const targetFolder = `pathing/${folder}`;

            /* 运行期同样用 Map<fileName, 原对象> 只改 cdTime */
            const rawRecord = await file.readText(recordFilePath);
            let recordArray = JSON.parse(rawRecord);
            const cdMap = new Map(recordArray.map(it => [it.fileName, it]));

            const groupFiles = await readFolder(targetFolder, true);

            if (userSettings.operationMode === "执行任务（若不存在索引文件则自动创建）") {
                const groupNumber = i;
                await genshin.returnMainUi();

                try {
                    const filePaths = groupFiles.map(f => f.fullPath);
                    let changedParty = false;

                    /* ================== 提前计算分均效率（所有模式通用） ================== */
                    // 0) 解析优先关键词
                    const priorityKeywords = settings.priorityTags
                        ? settings.priorityTags.split('，').map(s => s.trim()).filter(Boolean)
                        : [];

                    // 1) 解析加权规则
                    const weightMap = new Map();
                    if (settings.weightedRule) {
                        settings.weightedRule
                            .split('，')
                            .map(s => s.trim())
                            .forEach(rule => {
                                const [item, wStr] = rule.split('*');
                                if (item && wStr) {
                                    const w = Number(wStr);
                                    weightMap.set(item, isNaN(w) ? 1 : w);
                                }
                            });
                    }

                    // 2) 先计算一次基础效率，并找出全局最大效率
                    filePaths.forEach(p => {
                        const fullName = basename(p);
                        const obj = cdMap.get(fullName);
                        let avgEff = 0;

                        if (obj && obj.history && obj.history.length >= 3) {
                            const effList = obj.history.map(log => {
                                const total = Object.entries(log.items).reduce((sum, [name, cnt]) => {
                                    const w = blacklistSet.has(name) ? 0 : (weightMap.get(name) ?? 1);
                                    return sum + cnt * w;
                                }, 0);
                                return (total / log.durationSec) * 60;
                            });
                            avgEff = effList.reduce((a, b) => a + b, 0) / effList.length;
                        } else {
                            const threshold = Number(settings[`pathGroup${i}thresholdEfficiency`]) || 0;
                            avgEff = threshold;
                        }
                        p._efficiency = avgEff;   // 先存基础值
                    });

                    // 3) 计算全局最大效率值
                    const maxEff = Math.max(...filePaths.map(p => p._efficiency), 0);

                    // 4) 优先关键词加分
                    filePaths.forEach(p => {
                        const fullName = basename(p);
                        const obj = cdMap.get(fullName);

                        // 4-1) 历史拾取物里是否含关键词
                        const itemHit = obj?.history?.some(log =>
                            Object.keys(log.items).some(item =>
                                priorityKeywords.some(key => item.includes(key))
                            )
                        );

                        // 4-2) 文件路径（含文件名）是否含关键词
                        const pathHit = priorityKeywords.some(key => p.includes(key));

                        if (itemHit || pathHit) {
                            p._efficiency += maxEff;   // 把最大效率值直接加给它
                        }
                    });


                    /* ================== 排序分支 ================== */
                    switch (settings.sortMode) {
                        case "优先最早刷新，将优先执行最早刷新的路线":
                            filePaths.sort((a, b) => {
                                const nameA = basename(a);
                                const nameB = basename(b);
                                const timeA = cdMap.has(nameA) ? new Date(cdMap.get(nameA).cdTime) : new Date(0);
                                const timeB = cdMap.has(nameB) ? new Date(cdMap.get(nameB).cdTime) : new Date(0);
                                return timeA - timeB;   // 越早刷新越靠前
                            });
                            break;

                        case "优先最高效率，将优先执行最高分均拾取物的路线":
                            // 直接复用提前算好的 _efficiency
                            filePaths.sort((a, b) => (b._efficiency || 0) - (a._efficiency || 0));
                            break;

                        default:
                            // 保持原有顺序，不做任何排序
                            break;
                    }

                    for (const filePath of filePaths) {
                        const fileName = basename(filePath).replace('.json', '');
                        const fullName = fileName + '.json';
                        const targetObj = cdMap.get(fullName);
                        const nextCD = targetObj ? new Date(targetObj.cdTime) : new Date(0);

                        const startTime = new Date();
                        if (startTime <= nextCD) {
                            log.info(`当前任务 ${fileName} 未刷新，跳过任务`);
                            continue;   // 跳过，不写回
                        }
                        if (await isTimeRestricted(settings.timeRule, 10)) break;

                        let doSkip = false;
                        for (const kw of disableArray) {
                            if (filePath.includes(kw)) {
                                log.info(`路径文件 ${filePath} 包含禁用关键词 "${kw}"，跳过任务 ${fileName}`);
                                doSkip = true; break;
                            }
                        }
                        if (doSkip) continue;

                        // ===== 临界效率过滤 =====
                        const routeEff = filePath._efficiency ?? 0;          // 提前算好的分均效率
                        const threshold = Number(settings[`pathGroup${i}thresholdEfficiency`]) || 0;
                        if (routeEff < threshold) {
                            log.info(`路线 ${fileName} 分均效率为 ${routeEff.toFixed(2)}，低于设定的临界值 ${threshold}，跳过`);
                            continue;
                        }

                        let timeNow = new Date();
                        if (Foods.length != 0 && (((timeNow - lastCookTime) > cookInterval) || firstCook)) {
                            firstCook = false;
                            await ingredientProcessing();
                            lastCookTime = new Date();
                        }

                        if (settings.setTimeMode && settings.setTimeMode != "不调节时间" && (((timeNow - lastsettimeTime) > settimeInterval) || firstsettime)) {
                            firstsettime = false;
                            if (settings.setTimeMode === "尽量调为白天") {
                                await pathingScript.runFile("assets/调为白天.json");
                            } else {
                                await pathingScript.runFile("assets/调为夜晚.json");
                            }
                            lastsettimeTime = new Date();
                        }

                        if (!changedParty) {
                            await switchPartyIfNeeded(partyNames[groupNumber - 1]);
                            changedParty = true;
                        }
                        await fakeLog(fileName, false, true, 0);

                        /* ========== 历史拾取物前置排序 ========== */
                        // 0) 只有 history 里出现过的物品才需要前置
                        const historyItemSet = new Set();
                        const routeRec = cdMap.get(fullName);
                        if (routeRec?.history) {
                            routeRec.history.forEach(log => {
                                Object.keys(log.items).forEach(name => historyItemSet.add(name));
                            });
                        }

                        // 1) 把 targetItems 拆成「历史出现」+「未出现」两部分
                        const frontPart = [];
                        const backPart = [];
                        for (const it of targetItems) {
                            (historyItemSet.has(it.itemName) ? frontPart : backPart).push(it);
                        }

                        // 2) 合并后重新赋值，完成前置
                        targetItems = [...frontPart, ...backPart];
                        /* ======================================= */

                        state.running = true;
                        const pickupTask = recognizeAndInteract();

                        log.info(`当前进度：路径组${i} ${folder} ${fileName} 为第 ${filePaths.indexOf(filePath) + 1}/${filePaths.length} 个`);

                        try {
                            state.runPickupLog = [];          // 新路线开始前清空
                            await pathingScript.runFile(filePath);
                        } catch (error) {
                            log.error(`路径文件 ${filePath} 不存在或执行失败: ${error}`);
                            continue;
                        }

                        try { await sleep(1); }
                        catch (error) { log.error(`发生错误: ${error}`); break; }

                        const endTime = new Date();
                        const timeDiff = endTime.getTime() - startTime.getTime();

                        await fakeLog(fileName, false, false, timeDiff);
                        state.running = false;
                        await pickupTask;

                        // >>> 仅当 >3s 才更新 CD 并立即写回整条记录（含 history） <<<
                        if (timeDiff > 3000) {
                            let newTimestamp = new Date(startTime);

                            switch (currentCdType) {
                                case "1次0点刷新":
                                    newTimestamp.setDate(newTimestamp.getDate() + 1);
                                    newTimestamp.setHours(0, 0, 0, 0); break;
                                case "2次0点刷新":
                                    newTimestamp.setDate(newTimestamp.getDate() + 2);
                                    newTimestamp.setHours(0, 0, 0, 0); break;
                                case "3次0点刷新":
                                    newTimestamp.setDate(newTimestamp.getDate() + 3);
                                    newTimestamp.setHours(0, 0, 0, 0); break;
                                case "4点刷新":
                                    newTimestamp.setHours(4, 0, 0, 0);
                                    if (newTimestamp <= startTime) newTimestamp.setDate(newTimestamp.getDate() + 1); break;
                                case "12小时刷新":
                                    newTimestamp = new Date(startTime.getTime() + 12 * 60 * 60 * 1000); break;
                                case "24小时刷新":
                                    newTimestamp = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); break;
                                case "46小时刷新":
                                    newTimestamp = new Date(startTime.getTime() + 46 * 60 * 60 * 1000); break;
                                default:
                                    newTimestamp = startTime; break;
                            }

                            // ===== 把本次拾取明细写进 history =====
                            const durationSec = Math.round(timeDiff / 1000);
                            const itemCounter = {};
                            for (const name of state.runPickupLog) {
                                itemCounter[name] = (itemCounter[name] || 0) + 1;
                            }
                            const logEntry = {
                                items: itemCounter,
                                durationSec: durationSec
                            };
                            if (!targetObj.history) targetObj.history = [];   // 兜底
                            targetObj.history.push(logEntry);
                            // 保留最多 7 条记录，超出的旧记录丢弃
                            if (targetObj.history.length > 7) {
                                targetObj.history = targetObj.history.slice(-7);
                            }

                            // 只改 cdTime，其余字段（含 history）保持
                            targetObj.cdTime = newTimestamp.toISOString();
                            await file.writeText(recordFilePath,
                                JSON.stringify(Array.from(cdMap.values()), null, 2));

                            // 清空本次记录
                            state.runPickupLog = [];

                            log.info(`本任务执行大于3秒，cd信息已更新，下一次可用时间为 ${newTimestamp.toLocaleString()}`);
                        }
                    }
                    log.info(`路径组${groupNumber} 的所有任务运行完成`);
                } catch (error) {
                    log.error(`读取路径组文件时出错: ${error}`);
                }
            }
        }

    } catch (error) {
        log.error(`操作失败: ${error}`);
    }

    //伪造js开始的日志
    await fakeLog("采集cd管理", true, true, 0);
})();

async function recognizeAndInteract() {
    let lastcenterYF = 0, lastItemName = "", thisMoveUpTime = 0, lastMoveDown = 0, blacklistCounter = 0;
    gameRegion = captureGameRegion();
    let lastCheckItemFull = new Date();
    let checkTask = null;

    while (state.running) {
        let time1 = new Date();
        gameRegion.dispose();
        gameRegion = captureGameRegion();

        if (new Date() - lastCheckItemFull > 2500 && !checkTask) {
            lastCheckItemFull = new Date();
            checkTask = checkItemFullAndOCR();
        }

        let time2 = new Date();
        const centerYF = await findFIcon();
        if (!centerYF) {
            if (await isMainUI()) {
                if (new Date() - lastRoll >= 200) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                    lastRoll = new Date();
                }
            }
            if (checkTask) {
                try { await checkTask; }
                catch (e) { log.error('背包满检查异常:', e); }
                finally { checkTask = null; }
            }
            continue;
        }
        let time3 = new Date();
        let itemName = null;
        itemName = await performTemplateMatch(centerYF);
        if (itemName) {
            if (Math.abs(lastcenterYF - centerYF) <= 20 && lastItemName === itemName) {
                await sleep(160);
                lastcenterYF = -20;
                lastItemName = null;
                if (checkTask) {
                    try { await checkTask; }
                    catch (e) { log.error('背包满检查异常:', e); }
                    finally { checkTask = null; }
                }
                continue;
            }
            if (!blacklistSet.has(itemName)) {
                keyPress("F");
                log.info(`交互或拾取："${itemName}"`);
                let time4 = new Date();
                /* >>> 提到最前 begin >>> */
                const idx = targetItems.findIndex(it => it.itemName === itemName);
                if (idx > 0) {
                    const [it] = targetItems.splice(idx, 1);
                    targetItems.unshift(it);
                }
                /* <<< 提到最前 end <<< */
                state.runPickupLog.push(itemName);

                lastcenterYF = centerYF;
                lastItemName = itemName;
                let time5 = new Date();
                //log.info(`调试-截图用时${time2 - time1},找f用时${time3 - time2}，匹配用时${time4 - time3}，后处理用时${time5 - time4}`);
                await sleep(pickupDelay);
            }
        } else {
            lastItemName = "";
        }
        const currentTime = Date.now();
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
        if (checkTask) {
            try { await checkTask; }
            catch (e) { log.error('背包满检查异常:', e); }
            finally { checkTask = null; }
        }
    }
}

async function findFIcon() {
    try {
        const r = gameRegion.find(FiconRo);
        if (r.isExist()) return Math.round(r.y + r.height / 2);
    } catch (e) {
        log.error(`findFIcon:${e.message}`);
    }
    await sleep(checkDelay);
    return null;
}

async function performTemplateMatch(centerYF) {
    /* 一次性切 6 种宽度（0-5 汉字） */
    const regions = [];
    for (let cn = 0; cn <= 6; cn++) {   // 0~5 共 6 档
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

async function isMainUI() {
    for (let i = 0; i < 1 && state.running; i++) {
        if (!gameRegion) gameRegion = captureGameRegion();
        try {
            if (gameRegion.find(mainUiRo).isExist()) {
                return true;
            }
        } catch (e) {
            log.error(`isMainUI:${e.message}`);
        }
        await sleep(checkDelay);
    }
    return false;
}

async function checkItemFullAndOCR() {
    const fullRoi = RecognitionObject.TemplateMatch(itemFullTemplate, 0, 0, 1920, 1080);
    try {
        if (!gameRegion.find(fullRoi).isExist()) return;
    } catch (e) { return; }
    const TEXT_X = 560, TEXT_Y = 450, TEXT_W = 800, TEXT_H = 170;
    let ocrText = null;
    try {
        const list = gameRegion.findMulti(RecognitionObject.ocr(TEXT_X, TEXT_Y, TEXT_W, TEXT_H));
        if (list.count) {
            let longest = list[0];
            for (let i = 1;
                i < list.count;
                i++) if (list[i].text.length > longest.text.length) longest = list[i];
            ocrText = longest.text.replace(/[^\u4e00-\u9fa5]/g, '');
        }
    } catch (e) {
        log.error(`OCR:${e.message}`);
    } if (!ocrText) return;
    log.info(`背包满OCR:${ocrText}`);

    function calcMatchRatio(cnPart, txt) {
        if (!cnPart || !txt) return 0;
        const len = cnPart.length;
        let maxMatch = 0;
        for (let i = 0; i <= txt.length - len; i++) {
            let match = 0;
            for (let j = 0; j < len; j++) {
                if (txt[i + j] === cnPart[j]) match++;
                maxMatch = Math.max(maxMatch, match);
            }
        }
        return maxMatch / len;
    }
    const ratioMap = new Map();
    for (const it of targetItems) {
        const candNames = [it.itemName, ...(it.otherName || [])];
        let maxRatioThisItem = 0;
        for (const name of candNames) {
            const ratio = calcMatchRatio(name.replace(/[^\u4e00-\u9fa5]/g, ''), ocrText);
            if (ratio > maxRatioThisItem) maxRatioThisItem = ratio;
        }
        if (maxRatioThisItem > 0.75) {
            const oldMax = ratioMap.get(it.itemName) || 0;
            if (maxRatioThisItem > oldMax) ratioMap.set(it.itemName, maxRatioThisItem);
        }
    }
    if (ratioMap.size === 0) return;
    const maxRatio = Math.max(...ratioMap.values());
    const names = [...ratioMap.entries()].filter(([, r]) => r === maxRatio).map(([n]) => n).sort();
    log.warn(`背包满，黑名单加入:${names.join('、')}（${(maxRatio * 100).toFixed(1)}%）`);
    for (const n of names) {
        blacklistSet.add(n);
        blacklist.push(n);
    }
    await loadBlacklist(false);
}

// 加载拾取物图片
async function loadTargetItems() {
    const targetItemPath = "assets/targetItems/";

    const items = await readFolder(targetItemPath, false);

    for (const it of items) {
        try {
            it.template = file.ReadImageMatSync(it.fullPath);
            it.itemName = it.fileName.replace(/\.png$/i, '');
            it.roi = RecognitionObject.TemplateMatch(it.template);

            /* ---------- 1. 解析小括号阈值 ---------- */
            const match = it.fullPath.match(/[（(](.*?)[)）]/);
            const itsThreshold = (match => {
                if (!match) return 0.85;
                const v = parseFloat(match[1]);
                return !isNaN(v) && v >= 0 && v <= 1 ? v : 0.85;
            })(match);
            it.roi.Threshold = itsThreshold;
            it.roi.InitTemplate();

            /* ---------- 2. 解析中括号内容 ---------- */
            const otherNames = [];
            const bracketMatch = it.fullPath.matchAll(/\[(.*?)\]/g);
            for (const m of bracketMatch) {
                if (m[1].trim()) otherNames.push(m[1].trim());
            }
            it.otherName = otherNames;   // 始终返回数组，无则为空数组

        } catch (error) {
            log.error(`[loadTargetItems] ${it.fullPath}: ${error.message}`);
        }
    }
    return items;
}

async function loadBlacklist(writeBack) {
    try {
        const raw = await file.readText(`blacklists/${accountName}.json`);
        blacklist = [...new Set([...blacklist, ...JSON.parse(raw)])];
    } catch { /* 文件不存在就跳过 */ }
    blacklistSet = new Set(blacklist);

    // 仅把 blacklist 中的中文部分合并到内存中的 settings.disableJsons
    const chineseParts = blacklist
        .map(name => name.replace(/[^\u4e00-\u9fa5]/g, ''))
        .filter(Boolean);

    const existing = settings.disableJsons
        ? settings.disableJsons.split('；').map(s => s.trim()).filter(Boolean)
        : [];

    const merged = [...new Set([...existing, ...chineseParts])].sort().join('；');
    settings.disableJsons = merged;

    if (writeBack) {
        await file.writeText(`blacklists/${accountName}.json`, JSON.stringify(blacklist, null, 2), false);
    }
    // 实时同步禁用关键词数组
    disableArray = settings.disableJsons.split('；').map(s => s.trim()).filter(Boolean);
}

// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看

async function fakeLog(name, isJs, isStart, duration) {
    await sleep(1);
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

// 定义自定义函数 basename，用于获取文件名
function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\'); // 或者使用 '/'，取决于你的路径分隔符
    return filePath.substring(lastSlashIndex + 1);
}

// 定义自定义函数 removeJsonSuffix，用于移除文件名中的 .json 后缀
function removeJsonSuffix(fileName) {
    if (fileName.endsWith('.json')) {
        return fileName.substring(0, fileName.length - 5); // 移除 .json 后缀
    }
    return fileName;
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

/**
* 食材加工主函数，用于自动前往指定地点进行食材或料理的加工制作
* 
* 该函数会根据 Foods 和 foodCount 数组中的食材名称和数量，依次查找并制作对应的料理/食材
* 支持两种类型：普通料理（需滚动查找）和调味品类食材（直接在“食材加工”界面查找）
* 
* @returns {Promise<void>} 无返回值，执行完所有加工流程后退出
*/
async function ingredientProcessing() {
    /**
* 文字OCR识别封装函数（测试中，未封装完成，后续会优化逻辑）
* @param text 要识别的文字，默认为"空参数"
* @param timeout 超时时间，单位为秒，默认为10秒
* @param afterBehavior 点击模式，0表示不点击，1表示点击识别到文字的位置，2表示输出模式，默认为0
* @param debugmodel 调试代码，0表示输入判断模式，1表示输出位置信息，2表示输出判断模式，默认为0
* @param x OCR识别区域的起始X坐标，默认为0
* @param y OCR识别区域的起始Y坐标，默认为0
* @param w OCR识别区域的宽度，默认为1920
* @param h OCR识别区域的高度，默认为1080
* @returns 包含识别结果的对象，包括识别的文字、坐标和是否找到的结果
*/
    async function textOCR(text = "空参数", timeout = 10, afterBehavior = 0, debugmodel = 0, x = 0, y = 0, w = 1920, h = 1080) {
        const startTime = new Date();
        let Outcheak = 0
        for (let ii = 0; ii < 10; ii++) {
            // 获取一张截图
            let captureRegion = captureGameRegion();
            let res1
            let res2
            let conuntcottimecot = 1;
            let conuntcottimecomp = 1;
            // 对整个区域进行 OCR
            let resList = captureRegion.findMulti(RecognitionObject.ocr(x, y, w, h));
            //log.info("OCR 全区域识别结果数量 {len}", resList.count);
            if (resList.count !== 0) {
                for (let i = 0; i < resList.count; i++) { // 遍历的是 C# 的 List 对象，所以要用 count，而不是 length
                    let res = resList[i];
                    res1 = res.text
                    conuntcottimecomp++;
                    if (res.text.includes(text) && debugmodel == 3) { return result = { text: res.text, x: res.x, y: res.y, found: true }; }
                    if (res.text.includes(text) && debugmodel !== 2) {
                        conuntcottimecot++;
                        if (debugmodel === 1 & x === 0 & y === 0) { log.info("全图代码位置：({x},{y},{h},{w})", res.x - 10, res.y - 10, res.width + 10, res.Height + 10); }
                        if (afterBehavior === 1) { await sleep(1000); click(res.x, res.y); } else { if (debugmodel === 1 & x === 0 & y === 0) { log.info("点击模式:关") } }
                        if (afterBehavior === 2) { await sleep(100); keyPress("F"); } else { if (debugmodel === 1 & x === 0 & y === 0) { log.info("F模式:关"); } }
                        if (conuntcottimecot >= conuntcottimecomp / 2) { return result = { text: res.text, x: res.x, y: res.y, found: true }; } else { return result = { found: false }; }
                    }
                    if (debugmodel === 2) {
                        if (res1 === res2) { conuntcottimecot++; res2 = res1; }
                        //log.info("输出模式：全图代码位置：({x},{y},{h},{w},{string})", res.x-10, res.y-10, res.width+10, res.Height+10, res.text);
                        if (Outcheak === 1) { if (conuntcottimecot >= conuntcottimecomp / 2) { return result = { text: res.text, x: res.x, y: res.y, found: true }; } else { return result = { found: false }; } }
                    }
                }
            }
            const NowTime = new Date();
            if ((NowTime - startTime) > timeout * 1000) { if (debugmodel === 2) { if (resList.count === 0) { return result = { found: false }; } else { Outcheak = 1; ii = 2; } } else { Outcheak = 0; if (debugmodel === 1 & x === 0 & y === 0) { log.info(`${timeout}秒超时退出，"${text}"未找到`) }; return result = { found: false }; } }
            else { ii = 2; if (debugmodel === 1 & x === 0 & y === 0) { log.info(`"${text}"识别中……`); } }
            await sleep(100);
        }
    }
    if (Foods.length == 0) { log.error("未选择要加工的料理/食材"); return; }
    if (Foods.length != foodCount.length) { log.error("请检查料理与对应的数量是否一致！"); return; }
    const stove = "蒙德炉子";
    log.info(`正在前往${stove}进行食材加工`);

    try {
        let filePath = `assets/${stove}.json`;
        await pathingScript.runFile(filePath);
    } catch (error) {
        log.error(`执行 ${stove} 路径时发生错误`);
        return;
    }

    const res1 = await textOCR("烹饪", 5, 0, 0, 1150, 460, 155, 155);
    if (res1.found) {
        await sleep(10);
        keyDown("VK_MENU");
        await sleep(500);
        click(res1.x + 15, res1.y + 15);
    } else {
        log.warn("烹饪按钮未找到，正在寻找……");
        let attempts = 0;
        const maxAttempts = 3;
        let foundInRetry = false;
        while (attempts < maxAttempts) {
            log.info(`第${attempts + 1}次尝试寻找烹饪按钮`);
            keyPress("W");
            const res2 = await textOCR("烹饪", 5, 0, 0, 1150, 460, 155, 155);
            if (res2.found) {
                await sleep(10);
                keyDown("VK_MENU");
                await sleep(500);
                click(res2.x + 15, res2.y + 15);
                foundInRetry = true;
                break;
            } else {
                attempts++;
                await sleep(500);
            }
        }
        if (!foundInRetry) {
            log.error("多次未找到烹饪按钮，放弃寻找");
            return;
        }
    }

    await sleep(800);
    keyUp("VK_MENU");
    await sleep(1000);

    for (let i = 0; i < Foods.length; i++) {
        const targetFoods = new Set([
            "面粉", "兽肉", "鱼肉", "神秘的肉", "黑麦粉", "奶油", "熏禽肉",
            "黄油", "火腿", "糖", "香辛料", "酸奶油", "蟹黄", "果酱",
            "奶酪", "培根", "香肠"
        ]);
        if (targetFoods.has(Foods[i])) {//调味品就点到对应页面
            const res3 = await textOCR("食材加工", 1, 0, 0, 140, 30, 115, 30);
            if (!res3.found) {
                await sleep(500);
                click(1010, 55);
                await sleep(500);
            }

            const res = await textOCR("全部领取", 1, 0, 0, 195, 1000, 120, 40);
            if (res.found) {
                click(res.x, res.y);
                await sleep(800);
                click(960, 750);
                await sleep(500);
            }

            const res1 = await textOCR(Foods[i], 1, 0, 3, 116, 116, 1165, 505);

            if (res1.found) {
                log.info(`${Foods[i]}已找到`);
                await click(res1.x + 50, res1.y - 60);
            } else {
                await sleep(500);
                let ra = captureGameRegion();

                try {
                    const ocrResult = ra.findMulti(RecognitionObject.ocr(115, 115, 1150, 502));
                    const foodItems = []; // 存储找到的相关项目

                    // 收集所有包含"分钟"或"秒"的项目
                    for (let j = 0; j < ocrResult.count; ++j) {
                        if (ocrResult[j].text.endsWith("分钟") || ocrResult[j].text.endsWith("秒")) {
                            foodItems.push({
                                index: j,
                                x: ocrResult[j].x,
                                y: ocrResult[j].y
                            });
                        }
                    }

                    log.debug("检查到的正在加工食材的数量：" + foodItems.length);

                    // 依次筛选这些项目
                    for (const item of foodItems) {
                        // 点击该项目
                        click(item.x, item.y);
                        await sleep(150);
                        click(item.x, item.y);
                        await sleep(800);

                        let res2 = await textOCR("", 0.5, 0, 2, 1320, 100, 150, 50);
                        log.debug("当前项目：" + res2.text);
                        log.debug(item.x + "," + item.y);
                        await sleep(1000);

                        if (res2.text === Foods[i]) {
                            ra?.dispose();
                            res1.found = true;
                            log.info(`从正在加工的食材中找到了：${Foods[i]}`);
                            break;
                        }
                    }
                    if (!res1.found) {
                        log.error(`未找到目标食材: ${Foods[i]}`);
                        ra?.dispose();
                        continue;
                    }
                } finally {
                    ra?.dispose();
                }
            }

            await sleep(1000);
            click(1700, 1020);// 制作
            await sleep(800);
            click(960, 460);
            await sleep(800);
            inputText(foodCount[i]);
            log.info(`尝试制作${Foods[i]} ${foodCount[i]}个`);
            log.warn("由于受到队列和背包食材数量限制，实际制作数量与上述数量可能不一致！");
            await sleep(800);
            click(1190, 755);
            await sleep(800);
        } else {
            const res3 = await textOCR("料理制作", 1, 0, 0, 140, 30, 115, 30);
            if (!res3.found) {
                await sleep(500);
                click(910, 55);
                await sleep(500);
            }

            click(145, 1015);// 筛选
            await sleep(800);

            click(195, 1015);// 重置
            await sleep(800);

            click(500, 1020);// 确认筛选
            await sleep(800);

            //滚轮预操作
            await moveMouseTo(1287, 131);
            await sleep(100);
            await leftButtonDown();
            await sleep(100);
            await moveMouseTo(1287, 161);

            let YOffset = 0; // Y轴偏移量，根据需要调整
            const maxRetries = 20; // 最大重试次数
            let retries = 0; // 当前重试次数
            while (retries < maxRetries) {
                const res2 = await textOCR(Foods[i], 1, 0, 3, 116, 116, 1165, 880);
                if (res2.found) {
                    await leftButtonUp();
                    await sleep(500);
                    await click(res2.x + 50, res2.y - 60);
                    await sleep(1000);

                    await sleep(1000);
                    click(1700, 1020);// 制作
                    await sleep(1000);

                    await textOCR("自动烹饪", 5, 1, 0, 725, 1000, 130, 45);
                    await sleep(800);
                    click(960, 460);
                    await sleep(800);
                    inputText(foodCount[i]);
                    await sleep(800);
                    click(1190, 755);
                    await sleep(2500); // 等待烹饪完成

                    keyPress("ESCAPE")
                    await sleep(500);
                    keyPress("ESCAPE")
                    await sleep(1500);

                    break;
                } else {
                    retries++; // 重试次数加1
                    //滚轮操作
                    YOffset += 50;
                    await sleep(500);
                    if (retries === maxRetries || 161 + YOffset > 1080) {
                        await leftButtonUp();
                        await sleep(100);
                        await moveMouseTo(1287, 131);
                        await sleep(800);
                        leftButtonClick();
                        log.error(`料理/食材：${Foods[i]} 未找到！请检查料理名称是否正确！`);
                        continue;
                    }
                    await moveMouseTo(1287, 161 + YOffset);
                    await sleep(300);
                }
            }

        }
    }
    await genshin.returnMainUi();
}