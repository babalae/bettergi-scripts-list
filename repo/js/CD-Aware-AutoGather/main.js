const CooldownType = {
    Unknown: "未配置刷新机制",
    Every1DayMidnight: "每1天的0点",
    Every2DaysMidnight: "每2天的0点",
    Every3DaysMidnight: "每3天的0点",
    Daily4AM: "每天凌晨4点",
    Every12Hours: "12小时刷新",
    Every24Hours: "24小时刷新",
    Every46Hours: "46小时刷新",
};

const CooldownDataBase = {
    沉玉仙茗: CooldownType.Every24Hours,
    发光髓: CooldownType.Every12Hours,
    蝴蝶翅膀: CooldownType.Every12Hours,
    晶核: CooldownType.Every12Hours,
    鳗肉: CooldownType.Every12Hours,
    螃蟹: CooldownType.Every12Hours,
    禽肉: CooldownType.Every12Hours,
    青蛙: CooldownType.Every12Hours,
    鳅鳅宝玉: CooldownType.Every12Hours,
    神秘的肉: CooldownType.Every12Hours,
    兽肉: CooldownType.Every12Hours,
    蜥蜴尾巴: CooldownType.Every12Hours,
    鱼肉: CooldownType.Every12Hours,
    白萝卜: CooldownType.Every1DayMidnight,
    薄荷: CooldownType.Every1DayMidnight,
    澄晶实: CooldownType.Every1DayMidnight,
    墩墩桃: CooldownType.Every1DayMidnight,
    海草: CooldownType.Every1DayMidnight,
    红果果菇: CooldownType.Every1DayMidnight,
    胡萝卜: CooldownType.Every1DayMidnight,
    金鱼草: CooldownType.Every1DayMidnight,
    堇瓜: CooldownType.Every1DayMidnight,
    烬芯花: CooldownType.Every1DayMidnight,
    久雨莲: CooldownType.Every1DayMidnight,
    颗粒果: CooldownType.Every1DayMidnight,
    苦种: CooldownType.Every1DayMidnight,
    莲蓬: CooldownType.Every1DayMidnight,
    烈焰花花蕊: CooldownType.Every1DayMidnight,
    马尾: CooldownType.Every1DayMidnight,
    蘑菇: CooldownType.Every1DayMidnight,
    茉洁草: CooldownType.Every1DayMidnight,
    鸟蛋: CooldownType.Every1DayMidnight,
    泡泡桔: CooldownType.Every1DayMidnight,
    苹果: CooldownType.Every1DayMidnight,
    日落果: CooldownType.Every1DayMidnight,
    树莓: CooldownType.Every1DayMidnight,
    松果: CooldownType.Every1DayMidnight,
    松茸: CooldownType.Every1DayMidnight,
    甜甜花: CooldownType.Every1DayMidnight,
    汐藻: CooldownType.Every1DayMidnight,
    香辛果: CooldownType.Every1DayMidnight,
    星蕈: CooldownType.Every1DayMidnight,
    须弥蔷薇: CooldownType.Every1DayMidnight,
    枣椰: CooldownType.Every1DayMidnight,
    竹笋: CooldownType.Every1DayMidnight,
    烛伞蘑菇: CooldownType.Every1DayMidnight,
    沉玉仙茗: CooldownType.Every24Hours,
    晶蝶: CooldownType.Daily4AM,

    铁块: CooldownType.Every1DayMidnight,
    白铁块: CooldownType.Every2DaysMidnight,
    电气水晶: CooldownType.Every2DaysMidnight,
    星银矿石: CooldownType.Every2DaysMidnight,
    萃凝晶: CooldownType.Every3DaysMidnight,
    水晶块: CooldownType.Every3DaysMidnight,
    紫晶块: CooldownType.Every3DaysMidnight,
    奇异的龙牙: CooldownType.Every46Hours,
    冰雾花: CooldownType.Every46Hours,
    烈焰花: CooldownType.Every46Hours,
    地方特产: CooldownType.Every46Hours,
};

const settingFile = "settings.json";
const baseTime = getBaseTime();

const baseTimeStr = baseTime.toISOString();
const timeOffset = Date.parse(baseTimeStr) - Date.parse(baseTimeStr.slice(0, -1)); // 计算时区偏移量
const timeOffsetStr = offsetToTimezone(timeOffset);
let stopTime = null;

class ReachStopTime extends Error {
  constructor(message) {
    super(message);
    this.name = "ReachStopTime";
  }
}

(async function () {
    if (! file.IsFolder("pathing")) {
        let batFile = "SymLink.bat";
        try {
            file.readTextSync(`Ayaka-Main-${Math.random()}.txt`);
        } catch (error) {
            const err_msg = error.toString();
            const match = err_msg.match(/'([^']+)'/);
            const fullPath = match ? match[1] : null;
            const folderPath = fullPath ? fullPath.replace(/\\[^\\]+$/, '') : null;
            if (folderPath) {
                batFile = `${folderPath}\\${batFile}`;
            }
        }

        log.error("{0}文件夹不存在，请双击运行下列位置的脚本以创建文件夹链接\n{1}", "pathing", batFile);
        return;
    }
    const runMode = settings.runMode;

    const scriptName = getScriptItselfName();
    // 结束真正由BGI产生的那次开始记录
    startTime = fakeLogCore(scriptName, true);

    log.info("当前运行模式:{0}", runMode);
    if (runMode === "扫描文件夹更新可选材料列表") {
        await runScanMode();
    } else if (runMode === "采集选中的材料") {
        await runGatherMode();
    } else if (runMode === "清除运行记录（重置材料刷新时间）") {
        await runClearMode();
    } else {
        log.warn("未选择运行模式或运行模式无效: {0}\n这可能是你的首次运行，将为你执行{1}模式", runMode, "扫描文件夹更新可选材料列表");
        await sleep(3000);
        await runScanMode();
    }
    // 重新开始一条记录，与BGI产生的结束记录配对
    fakeLogCore(scriptName, true, startTime);
})();

// 扫描文件夹更新可选材料列表
async function runScanMode() {
    // 1. 扫描所有最底层路径
    const focusFolders = ["地方特产", "矿物", "食材与炼金"];
    const pathList = focusFolders.flatMap(fd => getLeafFolders(`pathing/${fd}`));

    // 2. 读取配置模板
    const templateText = file.readTextSync("settings.template.json");
    let config = JSON.parse(templateText);

    // 3. 处理每个路径
    let count = 0;
    for (const path of pathList) {
        const info = getCooldownInfoFromPath(path);
        if (info.coolType !== CooldownType.Unknown) {
            config.push({
                name: info.name,
                label: "⬇️ " + info.label,
                type: "checkbox"
            });
            count += 1;
        } else {
            log.warn("路径{0}未找到对应的刷新机制，跳过", path);
        }
    }
    // 4. 写入新的配置（格式化输出）
    file.writeTextSync(settingFile, JSON.stringify(config, null, 2));
    log.info("共{0}组有效路线，请在脚本配置中勾选需要采集的材料", count);

}


// 采集选中的材料
async function runGatherMode() {
    const selectedMaterials = getSelectedMaterials();

    if (selectedMaterials.length === 0) {
        log.error("未选择任何材料，请在脚本配置中勾选所需项目");
        return;
    }
    if (settings.stopAtTime) {
        stopTime = calcStopTime(settings.stopAtTime);
        log.info("脚本已被配置为达到{0}后停止运行", strftime(stopTime, true));
    }

    log.info("共{0}组材料路线待执行:", selectedMaterials.length);
    for (const item of selectedMaterials) {
        const info = getCooldownInfoFromPath(item.label);
        log.info(` - {0} (${info.coolType})`, item.label || item.name);
    }

    let account = await getCurrentAccount();
    log.info("为{0}采集材料并管理CD", account);

    if (settings.partyName) {
        try {
            if (!(await genshin.switchParty(settings.partyName))) {
                log.info("切换队伍失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                await sleep(1000);
                await genshin.switchParty(settings.partyName);
            }
        } catch {
            log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
            await genshin.returnMainUi();
        }
    }

    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    // 可在此处继续处理 selectedMaterials 列表
    try {
        for (const pathTask of selectedMaterials) {
            await runPathTaskIfCooldownExpired(account, pathTask);
        }
    } catch (e) {
        if (e instanceof ReachStopTime) {
            log.info("达到设置的停止时间 {0}，终止运行", strftime(stopTime, true));
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
    const resetTime = strftime(baseTime);
    let account = await getCurrentAccount();
    for (const pathTask of selectedMaterials) {
        const jsonFiles = filterFilesInTaskDir(pathTask);
        const recordFile = getRecordFilePath(account, pathTask);
        const lines = jsonFiles.map((filePath) => {
            return `${basename(filePath)}\t${resetTime}`;
        });
        const content = lines.join("\n");
        file.writeTextSync(recordFile, content);
        log.info("已重置{0}的刷新时间", pathTask.label);
    }
    log.info("已重置{0}组刷新时间。如需重置所有材料刷新时间，请直接删除record目录下对应账号的文件夹", selectedMaterials.length);
}

function getRecordFilePath(account, pathTask) {
    const taskName = pathTask.name.replace(/^OPT_/, "");
    return `record/${account}/${taskName}.txt`;
}

function filterFilesInTaskDir(pathTask, ext=".json") {
    const taskDir = pathTask.label;
    const allFilesRaw = file.ReadPathSync("pathing\\" + taskDir);
    const extFiles = [];

    for (const filePath of allFilesRaw) {
        if (filePath.endsWith(ext)) {
            extFiles.push(filePath);
        }
    }

    return extFiles;
}


async function runPathTaskIfCooldownExpired(account, pathTask) {
    const recordFile = getRecordFilePath(account, pathTask);
    const jsonFiles = filterFilesInTaskDir(pathTask);

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
        const lastTime = recordMap[fileName] || baseTime;
        const pathName = fileName.split(".")[0];
        const progress = `[${i + 1}/${jsonFiles.length}]`;

        if (stopTime && Date.now() >= stopTime) {
            throw new ReachStopTime("达到设置的停止时间，终止运行");
        }

        if (Date.now() > lastTime) {
            let pathStart = addFakePathLog(fileName);
            log.info(`${progress}{0}: 开始执行`, pathName);

            let pathStartTime = new Date();
            try {
                await pathingScript.runFile(jsonPath);
            } catch (error) {
                log.error(`${progress}{0}: 文件不存在或执行失败: {1}`, pathName, error.toString());
                addFakePathLog(fileName, pathStart);
                continue; // 跳过当前任务
            }

            // 更新记录
            if (new Date() - pathStartTime > 5000) {
                recordMap[fileName] = calculateNextRunTime(new Date(), jsonPath);
                const lines = [];
                
                for (const [p, t] of Object.entries(recordMap)) {
                    lines.push(`${p}\t${strftime(t)}`);
                }
                const content = lines.join("\n");
                file.writeTextSync(recordFile, content);
                log.info(`${progress}{0}: 已完成，下次刷新: ${strftime(recordMap[fileName], true)}`, pathName);
            } else {
                log.info(`${progress}{0}: 执行时间过短，不更新记录`, pathName);
            }
            addFakePathLog(fileName, pathStart);
        } else {
            log.info(`${progress}{0}: 已跳过 (${strftime(recordMap[fileName], true)}刷新)`, pathName);
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
    let cooldown = CooldownType.Unknown;
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
    const {coolType} = getCooldownInfoFromPath(fullPath);
    let nextTime = baseTime;

    switch (coolType) {
        case CooldownType.Every1DayMidnight: {
            const next = new Date(base.getTime() + 1 * 24 * 60 * 60 * 1000);
            next.setHours(0, 0, 0, 0);
            nextTime = next;
            break;
        }

        case CooldownType.Every2DaysMidnight: {
            const next = new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000);
            next.setHours(0, 0, 0, 0);
            nextTime = next;
            break;
        }

        case CooldownType.Every3DaysMidnight: {
            const next = new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000);
            next.setHours(0, 0, 0, 0);
            nextTime = next;
            break;
        }

        case CooldownType.Daily4AM: {
            const next = new Date(base);
            next.setHours(4, 0, 0, 0);
            if (base.getHours() >= 4) {
                // 如果已过今天凌晨4点，则设为明天的4点
                next.setDate(next.getDate() + 1);
            }
            nextTime = next;
            break;
        }

        case CooldownType.Every12Hours: {
            nextTime = new Date(base.getTime() + 12 * 60 * 60 * 1000);
            break;
        }

        case CooldownType.Every24Hours: {
            nextTime = new Date(base.getTime() + 24 * 60 * 60 * 1000);
            break;
        }

        case CooldownType.Every46Hours: {
            nextTime = new Date(base.getTime() + 46 * 60 * 60 * 1000);
            break;
        }

        default:
            throw new Error(`未识别的冷却类型: ${coolType}`);
    }

    return nextTime;
}


/**
 * 获取指定路径下所有最底层的文件夹（即不包含任何子文件夹的文件夹）
 * @param {string} folderPath - 要遍历的根文件夹路径
 * @param {string[]} result - 用于收集最底层文件夹路径的数组
 * @returns {Promise<string[]>} 所有最底层文件夹的路径
 */
function getLeafFolders(folderPath, result = []) {
    const filesInSubFolder = file.ReadPathSync(folderPath);
    let hasSubFolder = false;

    for (const filePath of filesInSubFolder) {
        if (file.IsFolder(filePath)) {
            hasSubFolder = true;
            // 递归查找子文件夹
            getLeafFolders(filePath, result);
        }
    }

    // 如果没有发现任何子文件夹，则当前为最底层文件夹
    if (!hasSubFolder) {
        result.push(folderPath);
    }

    return result;
}

async function getCurrentAccount() {
    let account = "默认账号";

    if (settings.iHaveMultipleAccounts) {
        // 打开背包避免界面背景干扰
        await genshin.returnMainUi();
        keyPress("B");
        await sleep(1000);

        const region = captureGameRegion();
        const ocrResults = RecognitionObject.ocr(region.width * 0.75, region.height * 0.75, region.width * 0.25, region.height * 0.25);
        const resList = region.findMulti(ocrResults);

        for (let i = 0; i < resList.count; i++) {
            const text = resList[i].text;
            if (text.includes("UID")) {
                const match = text.match(/\d+/);
                if (match) {
                    account = match[0];
                }
                break;
            }
        }

        if (account === "默认账号") {
            log.error("未能提取到UID");
        }
    }

    return account;
}

function getSelectedMaterials() {
    const configText = file.readTextSync(settingFile);
    const config = JSON.parse(configText); // 配置数组

    const selectedMaterials = [];

    for (const entry of config) {
        if (
            entry.name &&
            entry.name.startsWith("OPT_") &&
            entry.type === "checkbox"
        ) {
            if (settings[entry.name] === true) {
                entry.label = entry.label.split(" ")[1]; // 去除⬇️指示
                selectedMaterials.push(entry);
            }
        }
    }

    return selectedMaterials;
}


// Happy Birthday
function getBaseTime() {
  const now = new Date();
  const year = now.getFullYear() - 18;
  return new Date(year, 8, 28, 0, 0, 0); // 9月是month=8（0起始）
}


function strftime(dateObj, shortFormat = false) {
  const timestamp = dateObj.getTime() + timeOffset;
  const newDate = new Date(timestamp);
  let s = newDate.toISOString();
  s = s.replace("Z", timeOffsetStr);

  if (shortFormat) {
    // 截取出 MM-DD HH:MM:SS
    const [datePart, timePart] = s.split("T");
    const [year, month, day] = datePart.split("-");
    const time = timePart.split(".")[0]; // 去掉毫秒部分
    s = `${month}-${day} ${time}`;
  }

  return s;
}

function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('\\');
    return filePath.substring(lastSlashIndex + 1);
}

function offsetToTimezone(offsetMs) {
  const totalMinutes = offsetMs / (1000 * 60);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(totalMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const minutes = String(absMinutes % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function calcStopTime(timeStr) {
  const match = timeStr.match(/\b\d{2}[:：]\d{2}\b/); // 匹配 HH:mm
  if (!match) {
    return new Date(0xFFFFFFFF * 1000); // 不停止
  }

  const [hour, minute] = match[0].split(":").map(Number);
  const now = new Date();
  const next = new Date(now);

  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function getScriptItselfName() {
    const content = file.readTextSync("manifest.json");
    const manifest = JSON.parse(content);
    return manifest.name;
}

// 参考了 mno 大佬的函数

function fakeLogCore(name, isJs = true, dateIn = null) {
    const isStart = (isJs === (dateIn !== null));
    const lastRun = isJs ? new Date() : dateIn;
    const task = isJs ? "JS脚本" : "地图追踪任务";
    let logMessage = "";
    let logTime = new Date();
    if (isJs && isStart) {
        logTime = dateIn;
    }

    const logTimeWithOffset = new Date(logTime.getTime() + timeOffset);
    const formattedTime = logTimeWithOffset.toISOString().split("T")[1].replace("Z", "");

    if (isStart) {
        logMessage = `正在伪造开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行${task}: "${name}"`;
    } else {
        const durationInSeconds = (logTime.getTime() - lastRun.getTime()) / 1000;
        const durationMinutes = Math.floor(durationInSeconds / 60);
        const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数
        logMessage = `正在伪造结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
    }
    log.debug(logMessage);
    return logTime;
}

function addFakePathLog(name, lastRun = null) {
    return fakeLogCore(name, false, lastRun);
}
