eval(file.readTextSync("lib/lib.js"));
eval(file.readTextSync("lib/ocr.js"));
eval(file.readTextSync("lib/inventory.js"));

const settingFile = "settings.json";
const defaultTime = getDefaultTime();
const countryList = ["蒙德", "璃月", "稻妻", "须弥", "枫丹", "纳塔", "挪德卡莱", "至冬"];
const collectAbility = {
    hydro_collect: "水",
    electro_collect: "雷",
    anemo_collect: "风",
    pyro_collect: "火",
    nahida_collect: "纳西妲",
};

let stopAtTime = null;
let currentParty = null;
let currentMap = "Teyvat";
let worldInfo = null;
let partyAbility = {};
let runMode = settings.runMode;

class ReachStopTime extends Error {
    constructor(message) {
        super(message);
        this.name = "ReachStopTime";
    }
}
class UserCancelled extends Error {
    constructor(message) {
        super(message);
        this.name = "UserCancelled";
    }
}

(async function () {
    setGameMetrics(1920, 1080, 1.25);

    if (!file.IsFolder("pathing")) {
        let batFile = "SymLink.bat";
        log.error("{0}文件夹不存在，请在BetterGI中右键点击本脚本，选择{1}。然后双击脚本目录下的{2}文件以创建文件夹链接", "pathing", "打开所在目录", batFile);
        return;
    }
    if (!runMode) {
        const defaultRunMode = "扫描文件夹更新可选材料列表";
        log.warn("运行模式 未选择或无效: {0}，默认为{1}", runMode, defaultRunMode);
        runMode = defaultRunMode;
        await sleep(3000);
    }

    log.info("当前运行模式:{0}", runMode);
    if (runMode === "扫描文件夹更新可选材料列表") {
        await runScanMode();
        settings.runMode = "采集选中的材料";
        log.info("扫描完成，自动更新设置：下次脚本将以{0}模式运行", settings.runMode);
    } else if (runMode === "采集选中的材料") {
        let startTime = logFakeScriptStart();
        await runGatherMode();
        logFakeScriptEnd({ startTime: startTime });
    }
})();

// 扫描文件夹更新可选材料列表
async function runScanMode() {
    // 读取配置模板
    const templateText = readTextSync("assets/settings.template.json");
    let config = JSON.parse(templateText);
    const configMap = {};

    // 扫描地方特产
    const { countryToSpecialties, specialtyToFiles } = scanLocalSpecialty();
    const localSpecialtyByCountry = {};
    for (const [country, specialties] of Object.entries(countryToSpecialties)) {
        localSpecialtyByCountry[country] = {};
        specialties.forEach((specialty) => {
            localSpecialtyByCountry[country][specialty] = specialtyToFiles[specialty] || [];
        });
    }
    configMap["selectLocalSpecialtyByCountry"] = localSpecialtyByCountry;
    const cfgLocalSpecialtyByCountry = Object.keys(localSpecialtyByCountry).map((country, index) => {
        const name = "selectLocalSpecialty_" + country;
        configMap[name] = localSpecialtyByCountry[country];
        return {
            label: (index === 0 ? "\n【单独选择地方特产】\n\n" : "") + `${country}`,
            type: "multi-checkbox",
            name: name,
            options: Object.keys(localSpecialtyByCountry[country]).sort((a, b) => a.localeCompare(b, "zh")),
        };
    });
    config = config.concat(cfgLocalSpecialtyByCountry);

    // 扫描食材与炼金材料
    const otherJsonFiles = scanAndFilterJsonFiles("pathing/食材与炼金");
    const otherMaterialByName = await groupByMaterialName(otherJsonFiles);
    const cfgOtherMaterial = {
        label: "\n【食材与炼金】",
        type: "multi-checkbox",
        name: "selectFoodAndAlchemy",
        options: Object.keys(otherMaterialByName).sort((a, b) => a.localeCompare(b, "zh")),
    };
    const miscEntry = config.find((entry) => entry.name === "selectMiscellaneous");
    const miscOptions = miscEntry && miscEntry.options ? miscEntry.options : [];
    configMap["selectMiscellaneous"] = miscOptions.reduce((acc, k) => {
        if (k in otherMaterialByName) {
            acc[k] = otherMaterialByName[k];
        }
        return acc;
    }, {});
    configMap["selectFoodAndAlchemy"] = otherMaterialByName;

    if (Object.keys(otherMaterialByName).length > 0) {
        config.push({ type: "separator" });
        config.push(cfgOtherMaterial);
    }

    const forgingOreJsonFiles = scanAndFilterJsonFiles("pathing/矿物");
    const forgingOreByname = await groupByMaterialName(forgingOreJsonFiles);
    configMap["selectForgingOre"] = forgingOreByname;
    const flattenedSpecialties = Object.assign({}, ...Object.values(localSpecialtyByCountry));
    const allMaterials = {
        ...flattenedSpecialties,
        ...forgingOreByname,
        ...(otherMaterialByName["晶蝶"] ? { 晶蝶: otherMaterialByName["晶蝶"] } : {}),
        ...otherMaterialByName,
    };

    // 生成按大类选择的配置数据
    configMap["selectByCategory"] = {
        地方特产: specialtyToFiles,
        矿物: forgingOreByname,
        食材与炼金: otherMaterialByName,
    };

    const multiRouteMaterials = {};
    for (const [material, paths] of Object.entries(allMaterials)) {
        const dirs = [...new Set(paths.map((p) => p.substring(0, p.lastIndexOf("\\"))))];
        if (dirs.length <= 1) continue;

        // 1. 计算公共前缀长度
        const sorted = [...dirs].sort();
        let pLen = 0;
        while (pLen < sorted[0].length && sorted[0][pLen] === sorted[sorted.length - 1][pLen]) pLen++;

        const groupMap = {};
        paths.forEach((path) => {
            const dir = path.substring(0, path.lastIndexOf("\\"));

            // 2. 仅去除公共前缀、开头的材料名及反斜杠
            let name = dir.slice(pLen);
            if (name.startsWith(material)) name = name.slice(material.length);
            name = name.replace(/^\\+/, "") || "(根目录)";

            (groupMap[name] ??= []).push(path);
        });

        multiRouteMaterials[material] = groupMap;
    }

    const cfgMultiRouteMaterials = Object.entries(multiRouteMaterials).map(([material, groupMap], idx) => {
        const firstPaths = Object.values(groupMap)[0][0]; // 假设 groupMap 的值是路径数组
        const items = firstPaths.split("\\");
        const mIndex = items.indexOf(material);
        const tip_items = items.slice(1, mIndex + 1);
        const name = "selectRoute_" + material;
        configMap[name] = groupMap;
        return {
            label: (idx === 0 ? "\n【对于具有多版本路线的物品，选择要使用的路线】\n\n" : "") + tip_items.join("\\"),
            type: "multi-checkbox",
            name: name,
            options: Object.keys(groupMap).sort((a, b) => a.localeCompare(b, "zh")),
        };
    });
    if (Object.keys(multiRouteMaterials).length > 0) {
        config.push({ type: "separator" });
        config = config.concat(cfgMultiRouteMaterials);
    }
    // 写入新的配置（格式化输出）
    file.writeTextSync(settingFile, JSON.stringify(config, null, 2));
    return configMap;
}

// 采集选中的材料
async function runGatherMode() {
    if (settings.excludeTimeRange) {
        const { duringRange, nearestStopTime } = checkExecutionExcludeTime(settings.excludeTimeRange);
        if (duringRange) {
            log.info("当前处于设定的不运行时间段: {0}", duringRange);
            return;
        }
        stopAtTime = nearestStopTime;
        log.info("脚本已被配置为达到{0}后停止运行", stopAtTime);
    }

    const configMap = await runScanMode();
    // file.writeTextSync("configMap.json", JSON.stringify(configMap, null, 2));
    const isAllEmpty = Object.values(configMap.selectByCategory).every((value) => Object.keys(value).length === 0);
    if (isAllEmpty) {
        log.error("尚未订阅任何路线，请在BetterGI中订阅需要的路线后再运行");
        return;
    }

    const selectedMaterials = getSelectedMaterials(configMap);
    const materialNames = Object.keys(selectedMaterials);
    if (materialNames.length === 0) {
        log.error("未选择任何材料，请在脚本配置中勾选所需项目");
        return;
    }
    log.info("共选中{0}种材料: {1}", materialNames.length, materialNames.join(", "));

    let account = settings.manualSetAccountName || "";
    if (!account) {
        worldInfo = await getCoOpModeAndHostUid();
        // 使用掩码后的UID作为账户名，避免浮窗和日志等意外暴露用户UID
        account = worldInfo.maskUid;
    }

    const groupedTasks = groupTasksByMaterialsName(selectedMaterials, account);
    const refreshedMaterials = Object.entries(groupedTasks)
        .filter(([name, info]) => info.refreshed === true)
        .map(([name, info]) => name);
    if (refreshedMaterials.length === 0) {
        log.info("所有选中的材料都还在冷却中，无需执行");
        return;
    }

    // 按物品数量计算实际待执行的任务，并按照数量差额从大到小的顺序排序
    updateTargetCountOfTasks(groupedTasks, configMap, account, settings.targetCountOfSelected);
    const groupedTasksToRun = await calculateTodoTasksByCount(groupedTasks);
    const sortedTasksToRun = sortTasksByGap(groupedTasksToRun);
    // file.writeTextSync("sortedTasksToRun.json", JSON.stringify(sortedTasksToRun, null, 2));

    log.info("共{0}种材料需要采集，将从缺失数量最多的材料开始", Object.keys(sortedTasksToRun).length);
    for (const [name, { target, current, tasks }] of Object.entries(sortedTasksToRun)) {
        const coolType = tasks[0].coolType;
        const targetTxt = target === null ? "∞" : target;
        log.info(` - {0} (${coolType}, ${current} -> ${targetTxt})`, name);
        // 短暂地休眠以便用户有机会看清日志。相比大世界随便个动作花的时间，这都不算啥
        await sleep(50);
    }

    log.info("在{0}的世界采集材料并管理CD", account);
    // 传送到神像，回血，安全切换队伍，确保 currentMap 是提瓦特
    log.info("前往神像进行采集前的准备工作");
    await genshin.tpToStatueOfTheSeven();
    if (worldInfo === null) {
        worldInfo = await getCoOpModeAndHostUid();
    }
    if (worldInfo.coOpMode) {
        log.info("当前处于联机模式，不执行队伍切换");
    } else {
        await switchPartySafely(settings.partyName);
        currentParty = settings.partyName;
    }

    // 开始实际采集
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    try {
        for (const [name, taskInfo] of Object.entries(sortedTasksToRun)) {
            await runPathTaskIfCooldownExpired(name, taskInfo);
        }
    } catch (e) {
        if (e instanceof ReachStopTime) {
            log.info("达到设置的停止时间 {0}，终止运行", stopAtTime);
        } else if (e instanceof UserCancelled) {
            log.info("用户取消，终止运行");
        } else {
            throw e;
        }
    }
}

function scanAndFilterJsonFiles(folderPath) {
    const jsonFiles = getFilesBySuffix(folderPath, ".json");
    jsonFiles.sort((a, b) => a.localeCompare(b, "zh", { numeric: true }));

    const filterConfig = settings.filterPathByKeywords;
    if (!filterConfig || !filterConfig.trim()) return jsonFiles;

    let finalRegex;
    // 1. 如果以 regex: 开头，直接解析后面的内容
    if (filterConfig.startsWith("regex:")) {
        const pattern = filterConfig.replace("regex:", "").trim();
        finalRegex = new RegExp(pattern);
    }
    // 2. 如果以 include: 开头，生成“至少包含其一”的正则
    else if (filterConfig.startsWith("include:")) {
        const keywords = filterConfig.replace("include:", "").trim().split(/\s+/);
        // 逻辑：(词A|词B|词C)
        const pattern = `(${keywords.join("|")})`;
        finalRegex = new RegExp(pattern);
    }
    // 3. 否则，生成“不得包含任一”的正则 (排除模式)
    else {
        const keywords = filterConfig.trim().split(/\s+/);
        // 逻辑：使用负向先行断言 ^((?!词A|词B|词C).)*$
        // 这表示从头到尾的任何位置都不能匹配到关键词
        const pattern = `^((?!(?:${keywords.join("|")})).)*$`;
        finalRegex = new RegExp(pattern);
    }

    const result = jsonFiles.reduce(
        (acc, path) => {
            if (finalRegex.test(path)) {
                acc.passed.push(path);
            } else {
                acc.excluded.push(path);
            }
            return acc;
        },
        { passed: [], excluded: [] }
    );

    if (result.excluded.length > 0) {
        log.info(`{0}扫描完成：根据配置排除了${result.excluded.length}条路线，详见日志`, basename(folderPath));
        log.debug("过滤配置: {0}, 排除的文件:\n" + result.excluded.join("\n"), filterConfig);
    }
    return result.passed;
}

function getMaterialCD(name, path = null) {
    let cdType = getItemCD(name);
    if (cdType === null && path !== null) {
        if (path.includes("地方特产")) {
            cdType = "46小时";
        }
    }
    return cdType;
}

function groupTasksByMaterialsName(selectedMaterials, account) {
    const groupedTasks = {};
    const materialRefreshStatus = {};
    for (const [name, jsonFiles] of Object.entries(selectedMaterials)) {
        // 每个材料名下可能有多个不同的目录任务。使用对象暂存，以便按 dirSlug 去重
        const tasksMap = {};
        const coolType = getMaterialCD(name, jsonFiles[0]);
        materialRefreshStatus[name] = false;

        for (const jsonPath of jsonFiles) {
            const parts = jsonPath.split("\\");
            const fileName = parts[parts.length - 1]; // 获取最后一行（文件名）
            // 路径处理：去掉首项(pathing)和末项(文件名)，提取中间目录
            const dirPath = parts.slice(1, parts.length - 1).join("\\");
            const dirSlug = dirPath.replace(/[^\u4e00-\u9fa5\w]+/g, "_");
            const recordFile = `record/${account}/${dirSlug}.txt`;
            // 如果这个分组还没初始化，则初始化
            if (!tasksMap.hasOwnProperty(dirSlug)) {
                const refreshTime = {};
                if (fileExists(recordFile)) {
                    try {
                        const text = readTextSync(recordFile);
                        if (text) {
                            for (const line of text.split("\n")) {
                                const pair = line.trim().split("\t");
                                if (pair.length >= 2) {
                                    const [fName, t] = pair;
                                    refreshTime[fName] = new Date(t);
                                }
                            }
                        }
                    } catch (error) {
                        log.debug("解析运行记录文件时出错: {0}", error.toString());
                    }
                } else {
                    log.debug("记录文件不存在: {0}", recordFile);
                }

                // 将同一目录下的所有 JSON 归纳为一个 Task
                tasksMap[dirSlug] = {
                    label: dirSlug,
                    coolType: coolType,
                    recordFile: recordFile,
                    jsonFiles: [],
                    refreshTime: refreshTime,
                };
            }

            // 将当前 JSON 文件加入到对应分组的 jsonFiles 列表中
            if (!tasksMap[dirSlug].jsonFiles.includes(jsonPath)) {
                tasksMap[dirSlug].jsonFiles.push(jsonPath);
            }
            const nextRefreshTime = tasksMap[dirSlug]['refreshTime'][fileName] || defaultTime;
            if (Date.now() > nextRefreshTime) {
                materialRefreshStatus[name] = true;
            }
        }
        // 将该材料下所有的任务组转为数组存入 groupedTasks
        groupedTasks[name] = { refreshed: false, target: null, current: 0, tasks: Object.values(tasksMap) };
    }
    Object.entries(materialRefreshStatus).forEach(([name, status]) => {
        groupedTasks[name].refreshed = status;
    });
    return groupedTasks;
}

function updateTargetCountOfTasks(groupedTasks, configMap, account, targetCount) {
    const csvFile = `record/${account}/采集目标.csv`;
    if (targetCount) {
        const targetCountText = targetCount.trim().toLowerCase();
        if (targetCountText === "csv") {
            log.info("使用{0}中设置的采集目标", csvFile);
            // 1 基于当前的 configMap 得到结构
            const { hierarchy, materialPaths } = getInitialHierarchy(configMap);
            // 2 与 CSV 文件同步（读取旧值 + 补全缺失 + 写回）
            const syncedData = syncWithCsv(csvFile, hierarchy);
            // 3 计算最终生效的数量：结果将是 { "绯樱绣球": 20, ... }
            const materialsTarget = calculateFinalTargets(syncedData, materialPaths);
            for (const [name, target] of Object.entries(materialsTarget)) {
                if (groupedTasks.hasOwnProperty(name)) {
                    groupedTasks[name].target = target;
                }
            }
        } else {
            const fixedCount = parseInt(targetCountText, 10);
            if (isNaN(fixedCount)) {
                log.error("采集目标数量设置无效{0}，终止运行", targetCount);
                throw new Error("Invalid target count");
            }
            for (const info of Object.values(groupedTasks)) {
                info.target = fixedCount;
            }
        }
    } else {
        log.info("未设置采集目标数量");
    }
}

async function calculateTodoTasksByCount(groupedTasks) {
    // 获取目标不为null的材料的当前数量
    const materialsHasTarget = Object.keys(groupedTasks).filter((name) => groupedTasks[name].target !== null);
    let currentCounts = {};
    if (materialsHasTarget.length === 0) {
        log.info("所有选中材料的采集目标均为空");
    } else {
        currentCounts = await getItemCount(materialsHasTarget);
        const unknownCountMaterials = [];
        Object.entries(currentCounts).forEach(([key, value]) => {
            if (value < 0) {
                unknownCountMaterials.push(key);
            }
            groupedTasks[key].current = value < 0 ? 0 : value;
        });
        if (unknownCountMaterials.length > 0) {
            log.warn("获取以下材料的数量失败，默认视为0: {0}", unknownCountMaterials.join(", "));
        }
    }

    const groupedTasksToRun = {};
    const skippedSummary = { 未刷新: [], 数量已达标: [] };
    for (const [name, info] of Object.entries(groupedTasks)) {
        const { refreshed, target, current } = info;
        let reason = "";
        if (refreshed) {
            if (target !== null && target <= current) {
                log.debug(`{0}的数量已达标 (${current}/${target})`, name);
                reason = "数量已达标";
            }
        } else {
            reason = "未刷新";
        }
        if (reason) {
            skippedSummary[reason].push(name);
        } else {
            groupedTasksToRun[name] = info;
        }
    }
    for (const [reason, names] of Object.entries(skippedSummary)) {
        if (names.length > 0) {
            log.info(`跳过{0}种${reason}的材料: {1}`, names.length, names.join(","));
            await sleep(100);
        }
    }
    return groupedTasksToRun;
}

function scanSpecialCollectMethod(jsonFiles) {
    const actions = jsonFiles.flatMap((filePath) => {
        try {
            const data = JSON.parse(readTextSync(filePath));
            return data.positions
                .map((p) => p.action)
                .filter((a) => a) // 确保 action 存在
                .map((a) => collectAbility[a] ?? a);
        } catch (e) {
            log.warn(`json文件无效: {0}: ${e.message}`, filePath);
            return [];
        }
    });
    return [...new Set(actions)];
}

// 扫描地方特产并按国家排序
function scanLocalSpecialty() {
    const countryToSpecialtiesRaw = {}; // 暂存 国家 -> Set(特产名)
    const specialtyToFiles = {}; // 映射 特产名 -> [路径列表]
    const separator = "\\";

    const jsonFiles = scanAndFilterJsonFiles("pathing/地方特产");
    // 1. 遍历并归类数据
    jsonFiles.forEach((path) => {
        const parts = path.split(separator);
        const idx = parts.indexOf("地方特产");
        if (idx !== -1 && parts[idx + 2]) {
            const country = parts[idx + 1];
            const specialty = parts[idx + 2];
            // 填充 特产名 -> 路径列表
            (specialtyToFiles[specialty] ??= []).push(path);
            // 填充 国家 -> 特产名集合 (使用 Set 自动去重)
            (countryToSpecialtiesRaw[country] ??= new Set()).add(specialty);
        }
    });

    // 2. 按照 countryList 排序国家映射，并将 Set 转换为 Array
    const sortedCountries = Object.keys(countryToSpecialtiesRaw).sort((a, b) => {
        const indexA = countryList.indexOf(a);
        const indexB = countryList.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    const countryToSpecialties = {};
    sortedCountries.forEach((country) => {
        // 将 Set 转换为数组，这样结果就是 { "璃月": ["夜泊石", "星螺"] }
        countryToSpecialties[country] = Array.from(countryToSpecialtiesRaw[country]);
    });

    return {
        countryToSpecialties, // 格式: { "国家名": ["特产1", "特产2"] }
        specialtyToFiles, // 格式: { "特产名": ["路径1.json", "路径2.json"] }
    };
}

async function groupByMaterialName(jsonFiles) {
    const missingCdInfo = new Set();
    const materialPathMap = {};
    const separator = "\\";

    for (const path of jsonFiles) {
        const parts = path.split(separator);
        if (parts.length > 2) {
            const name = parts[2];
            const cdType = getMaterialCD(name, path);
            if (cdType === null) {
                missingCdInfo.add(name);
            } else {
                (materialPathMap[name] || (materialPathMap[name] = [])).push(path);
            }
        }
    }
    if (missingCdInfo.size > 0) {
        log.warn("未获取到以下物品的CD信息: {0}", Array.from(missingCdInfo).join(", "));
        await sleep(200);
    }
    return materialPathMap;
}

/**
 * 1. 生成扁平化层级字典 (带名字映射)
 */
function getInitialHierarchy(configMap) {
    const hierarchy = {};
    const materialPaths = new Set(); // 用于记录哪些路径是叶子节点（材料）

    const nameMapping = {
        selectLocalSpecialtyByCountry: "地方特产",
        selectForgingOre: "矿物",
        selectFoodAndAlchemy: "食材与炼金",
    };

    function traverse(currentObj, currentPath, currentKey) {
        hierarchy[currentPath] = null;

        // 如果是数组，说明 currentPath 是一个具体的材料路径
        if (Array.isArray(currentObj)) {
            materialPaths.add(currentPath);
            return;
        }

        if (typeof currentObj !== "object" || currentObj === null) return;

        for (const key in currentObj) {
            if (Object.prototype.hasOwnProperty.call(currentObj, key)) {
                traverse(currentObj[key], currentPath + "\\" + key, key);
            }
        }
    }

    for (const [apiKey, chineseName] of Object.entries(nameMapping)) {
        if (configMap[apiKey]) traverse(configMap[apiKey], chineseName, chineseName);
    }

    return { hierarchy, materialPaths };
}

/**
 * 2. 同步 CSV 文件并回写
 * 逻辑：保留 CSV 已有的值，新增 configMap 里的新路径，删除已废弃路径
 * 读取时：非法/空内容 -> null
 * 写入时：null -> 空字符串
 */
function syncWithCsv(filePath, configHierarchy) {
    const csvData = {};

    // 1. 读取并解析现有 CSV
    if (fileExists(filePath)) {
        try {
            const content = readTextSync(filePath).replace(/^\ufeff/, "");
            // 使用正则切分行，同时兼容 Windows (\r\n) 和 Linux (\n) 换行符
            const lines = content.split(/\r?\n/).slice(1); // 跳过标题行

            // 匹配 CSV 字段的正则表达式：
            // 1. (?:^|,)  -> 匹配行首或逗号
            // 2. "(?:[^"]|"")*" -> 匹配双引号括起来的内容（允许其中包含连续两个双引号 ""）
            // 3. [^,]* -> 或者匹配不含逗号的普通文本
            const csvRegex = /"(?:[^"]|"")*"|[^,]+/g;

            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return; // 跳过空行

                const parts = [];
                let match;

                // 使用 exec 循环获取所有匹配的字段
                while ((match = csvRegex.exec(trimmedLine)) !== null) {
                    let field = match[0];

                    // 如果字段被双引号包裹，进行还原处理
                    if (field.startsWith('"') && field.endsWith('"')) {
                        // 去掉首尾引号，并将内部的 "" 还原为 "
                        field = field.slice(1, -1).replace(/""/g, '"');
                    }
                    parts.push(field);
                }

                if (parts.length >= 2) {
                    const path = parts[0];
                    const rawVal = parts[1];

                    // 尝试解析为整数
                    const parsedInt = parseInt(rawVal, 10);
                    // 无法解析为 int 的内容（NaN）都视为 null
                    csvData[path] = isNaN(parsedInt) ? null : parsedInt;
                }
            });
        } catch (e) {
            log.debug("读取{0}文件时失败，未正确获取到采集目标 ({1})", filePath, e.toString());
        }
    } else {
        log.info("{0}不存在，建立新文件供用户使用", filePath);
    }

    // 2. 以 configMap 的结构为基准进行合并
    const updatedDict = {};
    Object.keys(configHierarchy).forEach((path) => {
        // 如果 CSV 里有就用 CSV 的解析结果，否则初始化为 null
        updatedDict[path] = csvData.hasOwnProperty(path) ? csvData[path] : null;
    });

    // 3. 排序（按深度从浅到深）
    const sortedKeys = Object.keys(updatedDict).sort((a, b) => {
        const depthA = (a.match(/\\/g) || []).length;
        const depthB = (b.match(/\\/g) || []).length;
        return depthA - depthB || 0;
    });

    // 4. 写回 CSV (UTF-8 BOM)
    let csvContent = "\ufeff物品,目标数量\n";
    sortedKeys.forEach((key) => {
        const val = updatedDict[key];
        // 写入时：null 表达为空字符串
        const displayVal = val === null ? "" : val;

        // 处理路径中可能存在的特殊字符
        let escapedPath = key;
        if (key.includes(",") || key.includes('"')) {
            escapedPath = `"${key.replace(/"/g, '""')}"`;
        }

        csvContent += `${escapedPath},${displayVal}\n`;
    });

    try {
        file.writeTextSync(filePath, csvContent);
        log.info("CSV配置同步成功: {0}", filePath);
    } catch (e) {
        log.info("CSV写入失败: {0} ({1})",filePath, e.toString());
    }

    return updatedDict;
}

/**
 * 计算最终目标数量 (结果只保留材料名称)
 * @param {Object} syncedDict - 从 CSV 同步后的带路径字典
 * @param {Set} materialPaths - 材料路径集合
 */
function calculateFinalTargets(syncedDict, materialPaths) {
    const tempPathResults = {}; // 存储路径到计算值的映射
    const finalMaterialResults = {}; // 存储材料名到计算值的映射

    const sortedPaths = Object.keys(syncedDict);

    sortedPaths.forEach((path) => {
        const currentVal = syncedDict[path];
        let calculatedVal;

        // --- 继承逻辑 ---
        if (currentVal !== null) {
            calculatedVal = currentVal;
        } else {
            // 当前节点为 null，尝试寻找父级
            const lastSlashIndex = path.lastIndexOf("\\");
            if (lastSlashIndex !== -1) {
                const parentPath = path.substring(0, lastSlashIndex);
                // 继承父级的值 (如果父级也是 null，则继续保持 null)
                calculatedVal = tempPathResults.hasOwnProperty(parentPath) ? tempPathResults[parentPath] : null;
            } else {
                // 顶层节点且为 null
                calculatedVal = null;
            }
        }

        // 存入临时表供后代节点参考
        tempPathResults[path] = calculatedVal;

        // --- 核心修改：如果是材料节点，则提取名称存入最终结果 ---
        if (materialPaths.has(path)) {
            const pathParts = path.split("\\");
            const materialName = pathParts[pathParts.length - 1];
            // 最终结果：可能是 数字，也可能是 null
            finalMaterialResults[materialName] = calculatedVal;
        }
    });

    return finalMaterialResults;
}

/**
 * 对待运行任务进行排序：按缺失数量降序，null 排最后
 * @param {Object} tasksToRun - 筛选出的待运行任务字典
 */
function sortTasksByGap(tasksToRun) {
    // 1. 将对象转换为数组 [ [name, info], [name, info], ... ]
    const taskEntries = Object.entries(tasksToRun);

    // 2. 执行排序
    taskEntries.sort((a, b) => {
        const infoA = a[1];
        const infoB = b[1];

        const isANull = infoA.target === null;
        const isBNull = infoB.target === null;

        if (isANull && !isBNull) return 1;
        if (!isANull && isBNull) return -1;
        if (isANull && isBNull) return 0;

        // 正常数值情况：按 (target - current) 降序排列
        const gapA = infoA.target - infoA.current;
        const gapB = infoB.target - infoB.current;

        return gapB - gapA; // 降序：差距大的在前
    });

    // 3. 将排序后的数组重新构建回对象
    const sortedTasks = {};
    taskEntries.forEach(([name, info]) => {
        sortedTasks[name] = info;
    });

    return sortedTasks;
}

function calculateAvatarsAbility(avatars) {
    const elements_map = JSON.parse(readTextSync("assets/avatar_elements.json"));
    const avatar2element = {};
    for (const key in elements_map) {
        if (elements_map.hasOwnProperty(key)) {
            const values = elements_map[key];
            values.forEach((ele) => {
                avatar2element[ele] = key;
            });
        }
    }
    const ability_set = new Set();
    for (const avatar of avatars) {
        if (avatar === "纳西妲") {
            ability_set.add(avatar);
        }
        const element = avatar2element[avatar];
        if (element) {
            ability_set.add(element);
        }
    }
    return [...ability_set];
}

function analysisCharacterRequirement(actions_map) {
    const result = {};
    for (const [key, values] of Object.entries(actions_map)) {
        const newKey = key.replace(/^pathing\\/, "");
        for (const v of values) {
            if (!result[v]) {
                result[v] = [];
            }
            result[v].push(newKey);
        }
    }
    let collect_methods = {};
    for (const [key, value] of Object.entries(result)) {
        if (key.endsWith("_collect") || key === "fight" || key === "combat_script") {
            collect_methods[key] = value;
        }
    }

    collect_methods = Object.fromEntries(Object.entries(collect_methods).sort((a, b) => b[1].length - a[1].length));

    log.info(
        "角色需求: {1}条路线需要纳西妲，{2}条路线需要水元素，{3}条路线需要雷元素，{4}条路线需要风元素，{5}条路线需要火元素；{6}条路线需要执行自动战斗；{7}条路线使用了战斗策略脚本(含挖矿等非战斗用途)",
        collect_methods["nahida_collect"]?.length || 0,
        collect_methods["hydro_collect"]?.length || 0,
        collect_methods["electro_collect"]?.length || 0,
        collect_methods["anemo_collect"]?.length || 0,
        collect_methods["pyro_collect"]?.length || 0,
        collect_methods["fight"]?.length || 0,
        collect_methods["combat_script"]?.length || 0
    );

    const nameMap = {
        nahida_collect: "纳西妲",
        hydro_collect: "水元素",
        electro_collect: "雷元素",
        anemo_collect: "风元素",
        pyro_collect: "火元素",
        fight: "自动战斗",
        combat_script: "战斗策略脚本",
    };

    let analysisResult = {};
    for (const [key, value] of Object.entries(collect_methods)) {
        const name = nameMap[key] || key;
        analysisResult[name] = value;
    }

    const outFile = `各条路线所需角色.txt`;
    let text = "";
    for (const [key, values] of Object.entries(analysisResult)) {
        text += `${key}\n`;
        for (const v of values) {
            text += `  ${v}\n`;
        }
    }
    file.writeTextSync(outFile, text);
    log.info("详细路线需求见{x}，可考虑组两支队伍{0}和{1}以满足采集需要", outFile, "钟纳水雷", "钟纳火风");
}

async function runPathScriptFile(jsonPath) {
    await pathingScript.runFile(jsonPath);
    //捕获任务取消的信息并跳出循环
    try {
        await sleep(10);
    } catch (error) {
        return error.toString();
    }
    return false;
}

async function runPathTaskIfCooldownExpired(material, taskInfo) {
    let { current } = taskInfo;
    const { target, tasks } = taskInfo;
    const totalPathCount = tasks.reduce((sum, t) => sum + t.jsonFiles.length, 0);
    log.info("{0}有{1}组任务，共{2}条路线", material, tasks.length, totalPathCount);

    // 开始执行任务
    const knownAbilities = Object.values(collectAbility);
    const allJsonFiles = tasks.flatMap(task => task.jsonFiles);
    totalLoop: for (const pathTask of tasks) {
        const { coolType, recordFile, jsonFiles, refreshTime } = pathTask;
        for (const jsonPath of jsonFiles) {
            if (stopAtTime && isTargetTimeReached(stopAtTime)) {
                throw new ReachStopTime("达到设置的停止时间，终止运行");
            }

            const fileName = basename(jsonPath);
            const pathName = fileName.split(".")[0];
            const pathRefreshTime = refreshTime[fileName] || defaultTime;
            // 使用indexOf计算进度，避免数数的方法在continue时繁琐的处理
            const progress = `[${allJsonFiles.indexOf(jsonPath)+1}/${totalPathCount}]`;

            if (Date.now() > pathRefreshTime) {
                log.info(`${progress}{0}: 开始执行`, pathName);

                // 队伍采集能力判定
                let avatarAbilities;
                if (currentParty in partyAbility) {
                    avatarAbilities = partyAbility[currentParty];
                } else {
                    avatarAbilities = calculateAvatarsAbility(getAvatars());
                    partyAbility[currentParty] = avatarAbilities;
                }
                const specialMethods = scanSpecialCollectMethod([jsonPath]);
                const requiredAbilities = specialMethods.filter((method) => knownAbilities.includes(method));
                const missingAbilities = requiredAbilities.filter((element) => {
                    return !avatarAbilities.includes(element);
                });
                if (requiredAbilities.length > 0) {
                    log.debug("所需角色: {0}", requiredAbilities.join(", "));
                }
                if (missingAbilities.length > 0 && (! worldInfo.coOpMode)) {
                    // 联机模式下无法自动切换队伍，同时此时BGI本体的报错信息也足够详细，因此也不再打印日志
                    if (settings.partyName && settings.partyName2nd) {
                        let newParty = currentParty === settings.partyName ? settings.partyName2nd : settings.partyName;
                        if (!partyAbility[newParty]) {
                            log.info("当前队伍{0}缺少该路线所需角色{1}，尝试切换到{2}", currentParty, missingAbilities.join(", "), newParty);
                            const teleported = await switchPartySafely(newParty);
                            currentParty = newParty;
                            if (teleported) {
                                currentMap = "Teyvat";
                            }
                            partyAbility[newParty] = calculateAvatarsAbility(getAvatars());
                        }

                        const avatarAbilities = partyAbility[newParty];
                        const missingAbilitiesNew = requiredAbilities.filter((element) => {
                            return !avatarAbilities.includes(element);
                        });
                        if (missingAbilitiesNew.length > 0) {
                            log.warn("另一队伍{0}也缺少该路线所需角色{1}，跳过路线", newParty, missingAbilitiesNew.join(", "));
                            continue;
                        }
                    } else {
                        log.warn("当前队伍缺少该路线要求的采集角色，且用户未配置两支队伍，跳过路线");
                        continue;
                    }
                }

                let pathStart = logFakePathStart(fileName);
                let pathStartPos = await genshin.getPositionFromMap(currentMap);
                // 延迟抛出`UserCancelled`，以便正确更新运行记录
                let cancel = await runPathScriptFile(jsonPath);

                await genshin.returnMainUi();
                let pathEndPos = await genshin.getPositionFromMap(currentMap);
                let distance = calculateDistance(pathStartPos, pathEndPos);
                if (distance >= 5) {
                    const jsonData = JSON.parse(readTextSync(jsonPath));
                    const jsonRegion = jsonData.info?.map_name || "Teyvat";
                    if (jsonRegion !== currentMap) {
                        log.info("当前地图区域: {0}", currentMap);
                        currentMap = jsonRegion;
                    }

                    refreshTime[fileName] = calculateNextRefreshTime(new Date(), coolType);
                    const lines = [];
                    for (const [p, t] of Object.entries(refreshTime)) {
                        lines.push(`${p}\t${formatDateTime(t)}`);
                    }
                    const content = lines.join("\n");
                    file.writeTextSync(recordFile, content);
                    log.info(`${progress}{0}: 已完成，下次刷新: ${formatDateTimeShort(refreshTime[fileName])}`, pathName);
                } else {
                    log.info(`${progress}{0}: 位置几乎未变化，不更新刷新时间`, pathName);
                }
                logFakePathEnd(fileName, pathStart);

                if (cancel) {
                    throw new UserCancelled(cancel);
                }
                // 不嵌套到if-distance里，以确保fake log和cancel得到正确执行
                if (distance >= 5 && target !== null) {
                    const match = pathName.match(/-(\d+)个/);
                    const collectByPath = parseInt(match ? match[1] : null, 10);
                    if (!isNaN(collectByPath) && collectByPath > 0) {
                        current = current + collectByPath;
                        if (current > target) {
                            log.info("{0}可能已达成目标数量，打开背包确认", material);
                            const result = await getItemCount(material);
                            current = result[material] || 0;
                            if (current >= target) {
                                log.info("{0}已达成目标数量({1}>={2})，停止该材料剩余任务", material, current, target);
                                break totalLoop;
                            } else {
                                log.info("{0}实际数量未达标({1}<{2})，更新材料当前数量", material, current, target);
                            }
                        }
                    }
                }
            } else {
                log.info(`${progress}{0}: 已跳过 (${formatDateTimeShort(refreshTime[fileName])}刷新)`, pathName);
            }
        }
    }
}

function getSelectedMaterials(configMap) {
    const configText = readTextSync(settingFile);
    const config = JSON.parse(configText);

    const selectedMaterials = {};
    const knownKeys = ["selectForgingOre", "selectMiscellaneous", "selectFoodAndAlchemy"];

    // 辅助函数：合并路径并记录日志
    const mergeToResult = (materialName, paths) => {
        if (!Array.isArray(paths)) return;
        if (!selectedMaterials[materialName]) {
            selectedMaterials[materialName] = [];
        }
        selectedMaterials[materialName].push(...paths);
    };

    config.forEach((entry) => {
        if (!entry.name || entry.type !== "multi-checkbox") return;

        const { name, label } = entry;
        const options = settings[name] ? Array.from(settings[name]) : [];

        // 2. 处理 selectLocalSpecialtyByCountry
        if (name === "selectByCategory") {
            if (options.length === 0) return;
            const categoryMap = configMap[name];
            if (!categoryMap) return;

            options.forEach((categoryName) => {
                const materialsInCategory = categoryMap[categoryName];
                if (materialsInCategory) {
                    log.debug("选择了{0}下的所有材料: {1}", categoryName, Object.keys(materialsInCategory).join(", "));
                    for (const [materialName, paths] of Object.entries(materialsInCategory)) {
                        mergeToResult(materialName, paths);
                    }
                }
            });
        } else if (name === "selectLocalSpecialtyByCountry") {
            if (options.length === 0) return;
            const countryMap = configMap[name];
            if (!countryMap) return;

            options.forEach((countryName) => {
                const materialsInCountry = countryMap[countryName];
                if (materialsInCountry) {
                    log.debug("选择了{0}的所有地方特产: {1}", countryName, Object.keys(materialsInCountry).join(", "));
                    for (const [materialName, paths] of Object.entries(materialsInCountry)) {
                        mergeToResult(materialName, paths);
                    }
                }
            });
        }
        // 3. 处理已知 key 或以 selectLocalSpecialty_ 开头的项
        else if (knownKeys.includes(name) || name.startsWith("selectLocalSpecialty_")) {
            if (options.length === 0) return;
            const categoryMap = configMap[name];
            if (!categoryMap) return;

            const lines = label.trim().split(/\r?\n/);
            const last_line = lines[lines.length - 1];
            log.debug("选择了{0}分类下的材料: {1}", last_line, options.join(", "));
            options.forEach((materialName) => {
                const paths = categoryMap[materialName];
                if (paths) {
                    mergeToResult(materialName, paths, "分类选择:" + name);
                }
            });
        }
        // 4. 处理 selectRoute_：执行覆盖逻辑并记录日志
        else if (name.startsWith("selectRoute_")) {
            const targetMaterial = name.replace("selectRoute_", "");
            const routeMap = configMap[name];
            if (!routeMap) return;

            let finalRouteKeys = [];
            let logAction = "";

            if (options.length > 0) {
                if (selectedMaterials.hasOwnProperty(targetMaterial)) {
                    // 已存在该材料，使用用户勾选的路线
                    finalRouteKeys = options;
                    logAction = "使用用户勾选的路线";
                } else {
                    log.debug("未选中材料{0}，忽略该材料勾选的路线{1}", targetMaterial, options.join(", "));
                    return;
                }
            } else {
                // 如果 selectRoute 这一项用户什么都没勾，强制选择 entry.options 中的第一项
                if (entry.options && entry.options.length > 0 && selectedMaterials.hasOwnProperty(targetMaterial)) {
                    finalRouteKeys = [entry.options[0]];
                    logAction = "用户未指定路线，自动选择第一组";
                }
            }

            if (finalRouteKeys.length > 0) {
                // 执行取代：先清空，再添加
                selectedMaterials[targetMaterial] = [];
                finalRouteKeys.forEach((routeKey) => {
                    const specificPaths = routeMap[routeKey];
                    if (specificPaths) {
                        selectedMaterials[targetMaterial].push(...specificPaths);
                    }
                });
                log.debug(`{0}: ${logAction} {1}`, targetMaterial, finalRouteKeys.join(", "));
            }
        }
    });

    return selectedMaterials;
}

/**
 * 获取世界主人的UID
 */
async function getCoOpModeAndHostUid() {
    await genshin.returnMainUi();
    keyPress("F2");
    await waitForTextAppear("多人游戏", [130, 20, 129, 57]);
    let uid = await getGameAccount(true, false);
    const coOpMode = !(await isTextExistedInRegion("搜索", [1638, 90, 87, 63]));
    if (coOpMode) {
        const btnText = await getTextInRegion([1560, 992, 191, 55]);
        // 仅在多人模式且非房主时需要
        if (btnText === "离开队伍") {
            log.info("当前处于联机模式，且玩家不是房主");
            click(332, 218);
            await recognizeTextAndClick("查看资料", [555, 182, 118, 49]);
            await waitForTextAppear("角色展柜", [1082, 204, 107, 49]);
            await sleep(100);
            uid = await getTextInRegion([623, 192, 118, 37]);
        } else {
            log.info("当前处于联机模式，玩家是房主");
        }
    } else {
        log.info("当前处于单人模式");
    }
    await genshin.returnMainUi();
    const maskUid = uid.replace(/\d\d(\d{3})\d{4}/, (match, group1) => match.replace(group1, "xxx"));
    return { coOpMode: coOpMode, uid: uid, maskUid: maskUid };
}
