eval(file.readTextSync("lib/lib.js"));

const settingFile = "settings.json";
const defaultTime = getDefaultTime();
const CooldownDataBase = readRefreshInfo("CooldownData.txt");

let stopAtTime = null;
let currentParty = null;
let runMode = settings.runMode;
let subscribeMode = settings.subscribeMode;

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
    if (!file.IsFolder("pathing")) {
        let batFile = "SymLink.bat";
        const folderPath = getScriptDirPath();
        if (folderPath) {
            batFile = `${folderPath}\\${batFile}`;
        }
        log.error("{0}文件夹不存在，请双击运行下列位置的脚本以创建文件夹链接\n{1}", "pathing", batFile);
        return;
    }
    if (!runMode) {
        const defaultRunMode = "采集选中的材料";
        log.warn("运行模式 未选择或无效: {0}，默认为{1}", runMode, defaultRunMode);
        runMode = defaultRunMode;
    }
    if (!subscribeMode) {
        const defaultSubscribeMode = "每次自动扫描，并采集扫描到的所有材料";
        log.warn("已订阅的任务目录的处理方式 未选择或无效: {0}，默认为{1}", subscribeMode, defaultSubscribeMode);
        subscribeMode = defaultSubscribeMode;
    }
    if (!settings.runMode || !settings.subscribeMode) {
        await sleep(3000);
    }

    log.info("当前运行模式:{0}", runMode);
    if (runMode === "扫描文件夹更新可选材料列表") {
        await runScanMode();
    } else if (runMode === "采集选中的材料") {
        let startTime = logFakeScriptStart();
        log.info("已订阅的任务目录的处理方式：{0}", subscribeMode);
        if (subscribeMode === "每次自动扫描，并采集扫描到的所有材料") {
            await runScanMode();
        }
        await runGatherMode();
        logFakeScriptEnd({ startTime: startTime });
    } else if (runMode === "清除运行记录（重置材料刷新时间）") {
        await runClearMode();
    }
})();

// 扫描文件夹更新可选材料列表
async function runScanMode() {
    // 1. 扫描所有最底层路径
    const focusFolders = ["地方特产", "矿物", "食材与炼金"];
    const pathList = focusFolders.flatMap((fd) => getLeafFolders(`pathing/${fd}`));

    // 2. 读取配置模板
    const templateText = file.readTextSync("settings.template.json");
    let config = JSON.parse(templateText);

    // 将地方特产按照国家顺序排序
    const countryList = ["蒙德", "璃月", "稻妻", "须弥", "枫丹", "纳塔", "挪德卡莱", "至冬"];
    const sortedList = pathList.slice().sort((a, b) => {
        const getRegion = (p) => p.split("\\")[2];
        const aIndex = countryList.indexOf(getRegion(a));
        const bIndex = countryList.indexOf(getRegion(b));
        return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
    });

    // 3. 处理每个路径
    let count = 0;
    actions_map = {};
    for (const path of sortedList) {
        const info = getCooldownInfoFromPath(path);
        const jsonFiles = filterFilesInTaskDir(info.label);

        if (jsonFiles.length === 0) {
            log.info("{0}内无json文件，跳过", path);
        } else if (info.coolType === null) {
            log.warn("路径{0}未匹配到对应的刷新机制，跳过", path);
            await sleep(100);
        } else {
            config.push({
                name: info.name,
                label: "⬇️ " + info.label,
                type: "checkbox",
            });
            count += 1;

            const actions = scanSpecialCollectMethod(jsonFiles);
            if (actions.length > 0) {
                actions_map[path] = actions;
            }
        }
    }
    // 4. 写入新的配置（格式化输出）
    file.writeTextSync(settingFile, JSON.stringify(config, null, 2));
    log.info("共{0}组有效路线，请在脚本配置中勾选需要采集的材料", count);
    // 5. 分析所需角色信息
    analysisCharacterRequirement(actions_map);
    await sleep(3000);
}

// 采集选中的材料
async function runGatherMode() {
    if (settings.stopAtTime) {
        stopAtTime = settings.stopAtTime;
        log.info("脚本已被配置为达到{0}后停止运行", stopAtTime);
    }

    const selectedMaterials = getSelectedMaterials();

    if (selectedMaterials.length === 0) {
        log.error("未选择任何材料，请在脚本配置中勾选所需项目");
        return;
    }

    log.info("共{0}组材料路线待执行:", selectedMaterials.length);
    for (const item of selectedMaterials) {
        const info = getCooldownInfoFromPath(item.label);
        log.info(` - {0} (${info.coolType}刷新)`, item.label || item.name);
    }

    let account = await getGameAccount(settings.iHaveMultipleAccounts);
    log.info("为{0}采集材料并管理CD", account);

    await switchPartySafely(settings.partyName);
    currentParty = settings.partyName;

    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    // 可在此处继续处理 selectedMaterials 列表
    try {
        for (const pathTask of selectedMaterials) {
            await runPathTaskIfCooldownExpired(account, pathTask);
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

// 清除运行记录（重置材料刷新时间）
async function runClearMode() {
    const selectedMaterials = getSelectedMaterials();

    if (selectedMaterials.length === 0) {
        log.error("未选择任何材料，请在脚本配置中勾选所需项目");
    }
    const resetTimeStr = formatDateTime(getDefaultTime());
    let account = await getGameAccount(settings.iHaveMultipleAccounts);
    for (const pathTask of selectedMaterials) {
        const recordFile = getRecordFilePath(account, pathTask);
        const lines = pathTask.jsonFiles.map((filePath) => {
            return `${basename(filePath)}\t${resetTimeStr}`;
        });
        const content = lines.join("\n");
        file.writeTextSync(recordFile, content);
        log.info("已重置{0}的刷新时间", pathTask.label);
    }
    log.info("已重置{0}组刷新时间。如需重置所有材料刷新时间，请直接删除record目录下对应账号的文件夹", selectedMaterials.length);
}

function scanSpecialCollectMethod(jsonFiles) {
    const actions = jsonFiles.flatMap((filePath) => {
        try {
            const data = JSON.parse(file.readTextSync(filePath));
            return data.positions.map((p) => p.action).filter((a) => a);
        } catch (e) {
            log.warn(`json文件无效: {0}: ${e.message}`, filePath);
            return [];
        }
    });
    return [...new Set(actions)];
}

function readRefreshInfo(filePath) {
    const lines = file.readTextSync(filePath).split(/\r?\n/);
    const dict = {};
    for (const line of lines) {
        if (!line.trim()) continue; // 跳过空行
        const [key, value] = line.split(":");
        dict[key.trim()] = value ? value.trim() : "";
    }
    return dict;
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

    const outFile = `${getScriptDirPath()}\\各条路线所需角色.txt`;
    let text = "";
    // text = JSON.stringify(analysisResult, null, 2);
    for (const [key, values] of Object.entries(analysisResult)) {
        text += `${key}\n`;
        for (const v of values) {
            text += `  ${v}\n`;
        }
    }
    file.writeTextSync(outFile, text);
    log.info("详细路线需求见{x}，可考虑组两支队伍{0}和{1}以满足采集需要", outFile, "钟纳水雷", "钟纳火风");
}

function getRecordFilePath(account, pathTask) {
    const taskName = pathTask.name.replace(/^OPT_/, "");
    return `record/${account}/${taskName}.txt`;
}

function filterFilesInTaskDir(taskDir) {
    return getFilesByExtension("pathing\\" + taskDir, ".json");
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

async function runPathTaskIfCooldownExpired(account, pathTask) {
    const recordFile = getRecordFilePath(account, pathTask);
    const jsonFiles = pathTask.jsonFiles;

    log.info("{0}共有{1}条路线", pathTask.label, jsonFiles.length);

    // 2. 读取记录文件（路径 -> 时间）
    const recordMap = {};
    try {
        const text = file.readTextSync(recordFile);
        for (const line of text.split("\n")) {
            const [p, t] = line.trim().split("\t");
            if (p && t) {
                recordMap[p] = new Date(t);
            }
        }
    } catch (error) {
        log.debug(`记录文件{0}不存在或格式错误`, recordFile);
    }

    // 3. 检查哪些 json 文件已过刷新时间
    for (let i = 0; i < jsonFiles.length; i++) {
        const jsonPath = jsonFiles[i];
        const fileName = basename(jsonPath);
        const pathName = fileName.split(".")[0];
        const lastTime = recordMap[fileName] || defaultTime;
        const progress = `[${i + 1}/${jsonFiles.length}]`;

        if (stopAtTime && isTargetTimeReached(stopAtTime)) {
            throw new ReachStopTime("达到设置的停止时间，终止运行");
        }

        if (Date.now() > lastTime) {
            let pathStart = logFakePathStart(fileName);
            log.info(`${progress}{0}: 开始执行`, pathName);

            let pathStartTime = new Date();
            // 延迟抛出`UserCancelled`，以便正确更新运行记录
            const cancel = await runPathScriptFile(jsonPath);

            let diffTime = new Date() - pathStartTime;
            if (diffTime < 1000) {
                // "队伍中没有对应元素角色"的错误不会抛出为异常，只能通过路径文件迅速结束来推测
                if (settings.partyName && settings.partyName2nd) {
                    let newParty = (currentParty === settings.partyName) ? settings.partyName2nd : settings.partyName;
                    log.info("当前队伍{0}缺少该路线所需角色，尝试切换到{1}", currentParty, newParty);
                    await switchPartySafely(newParty);
                    await runPathScriptFile(jsonPath);
                }
            } else if (diffTime > 5000) {
                recordMap[fileName] = calculateNextRunTime(new Date(), jsonPath);
                const lines = [];
                for (const [p, t] of Object.entries(recordMap)) {
                    lines.push(`${p}\t${formatDateTime(t)}`);
                }
                const content = lines.join("\n");
                file.writeTextSync(recordFile, content);
                log.info(`${progress}{0}: 已完成，下次刷新: ${formatDateTimeShort(recordMap[fileName])}`, pathName);
            } else {
                log.info(`${progress}{0}: 执行时间过短，不更新记录`, pathName);
            }
            logFakePathEnd(fileName, pathStart);

            if (cancel) {
                throw new UserCancelled(cancel);
            }
        } else {
            log.info(`${progress}{0}: 已跳过 (${formatDateTimeShort(recordMap[fileName])}刷新)`, pathName);
        }
    }
}

/**
 * 根据路径逐级查找最匹配的物品，返回去除前缀的路径、标准化名称、刷新时间
 * @param {string} fullPath - 单个完整路径（包含公共前缀）
 * @returns {{ label: string, name: string, coolType: string }}
 */
function getCooldownInfoFromPath(fullPath) {
    const parts = fullPath.split(/[\\/]/); // 支持 \ 或 / 分隔符
    let cooldown = null;
    let cleanPart = "";

    for (const part of parts) {
        cleanPart = part.split("@")[0]; // 去除 @ 后缀

        if (CooldownDataBase.hasOwnProperty(cleanPart)) {
            cooldown = CooldownDataBase[cleanPart];
            break;
        }
    }

    const label = parts.slice(1).join("\\"); // 去除公共前缀
    const name = "OPT_" + label.replace(/[^\u4e00-\u9fa5\w]/g, "_"); // 添加前缀并格式化名称

    return {
        label,
        name,
        coolType: cooldown,
    };
}

function calculateNextRunTime(base, fullPath) {
    const { coolType } = getCooldownInfoFromPath(fullPath);
    let nextTime = calculateNextRefreshTime(base, coolType);
    return nextTime;
}

function getSelectedMaterials() {
    const configText = file.readTextSync(settingFile);
    const config = JSON.parse(configText); // 配置数组

    const selectedMaterials = [];

    const selectAllMaterials = subscribeMode.includes("采集扫描到的所有材料");
    for (const entry of config) {
        if (entry.name && entry.name.startsWith("OPT_") && entry.type === "checkbox") {
            if (selectAllMaterials || settings[entry.name] === true) {
                let index = entry.label.indexOf(" ");
                entry.label = entry.label.slice(index + 1); // 去除⬇️指示
                const jsonFiles = filterFilesInTaskDir(entry.label);
                if (jsonFiles.length > 0) {
                    entry.jsonFiles = jsonFiles;
                    selectedMaterials.push(entry);
                } else {
                    log.debug("跳过空文件夹: {0}", entry.label);
                }
            }
        }
    }

    const materialDict = {};
    selectedMaterials.forEach((item) => {
        const label = item.label;
        const match = label.match(/\\(.*?)\\\1/); // \落落莓\落落莓@Author
        let materialName;

        if (match) {
            materialName = match[1];
        } else {
            const parts = label.split("\\");
            materialName = parts[parts.length - 1];
        }

        if (!materialDict[materialName]) {
            materialDict[materialName] = [];
        }
        materialDict[materialName].push(item);
    });

    const firstRoutes = [];
    const multiRoutes = {};
    for (const materialName in materialDict) {
        const routes = materialDict[materialName];
        if (routes.length > 0) {
            firstRoutes.push(routes[0]);
            if (materialDict[materialName].length > 1) {
                multiRoutes[materialName] = materialDict[materialName];
            }
        }
    }
    const countOfMultiRoutes = Object.keys(multiRoutes).length;
    if (countOfMultiRoutes > 0) {
        let text = `${countOfMultiRoutes}种材料存在多个版本的路线:\n`;
        for (const [key, values] of Object.entries(multiRoutes)) {
            text += `${key}\n`;
            for (const v of values) {
                text += `  ${v.label}\n`;
            }
        }
        log.debug(text);
        if (settings.acceptMultiplePathOfSameMaterial) {
            log.warn("{0}种材料选中了多个版本的路线（详见日志文件），根据脚本设置，将执行全部版本", countOfMultiRoutes);
        } else {
            log.warn("{0}种材料选中了多个版本的路线（详见日志文件），默认只执行第一个版本", countOfMultiRoutes);
            return firstRoutes;
        }
    }

    return selectedMaterials;
}
