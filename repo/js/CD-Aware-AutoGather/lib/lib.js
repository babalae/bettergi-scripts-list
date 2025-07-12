/**
 * @author Ayaka-Main
 * @link   https://github.com/Patrick-Ze
 * @description 提供一些通用性的功能函数。使用方法: 将此文件放在脚本目录下的 lib 文件夹中，然后在你的脚本开头处执行下面这行:
   eval(file.readTextSync("lib/lib.js"));
 */

let scriptContext = {
    scriptStartTime: new Date(),
    version: "1.1",
};

/**
 * 将 Date 对象格式化为 ISO 8601 字符串，包含本地时区（如：2020-09-28T20:20:20+08:00）
 * @param {Date} date - 要格式化的日期对象
 * @returns {string} 格式化后的字符串
 */
function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());

    // 获取时区偏移（分钟），转换成±HH:MM
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const offsetHour = pad(Math.floor(Math.abs(offset) / 60));
    const offsetMin = pad(Math.abs(offset) % 60);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMin}`;
}

/**
 * 将 Date 对象以本地时区格式化为字符串，格式为 "MM-DD HH:mm:ss"
 * @param {Date} date - 要格式化的日期对象
 * @returns {string} 格式化后的字符串
 */
function formatDateTimeShort(date) {
    const pad = (n) => n.toString().padStart(2, "0");

    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());

    return `${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 判断当前时间是否已达到目标时间（目标时间基于脚本启动时间，支持跨天）。
 * @param {string} targetTimeStr - 目标时间，格式为 "HH:mm"。
 * @returns {boolean} 如果已达到目标时间，返回 true，否则返回 false。
 */
function isTargetTimeReached(targetTimeStr) {
    const now = new Date();
    const [targetHour, targetMinute] = targetTimeStr.split(":").map(Number);

    const target = new Date(scriptContext.scriptStartTime);
    target.setHours(targetHour, targetMinute, 0, 0);

    // 如果目标时间早于脚本启动时间，则认为是第二天
    if (target <= scriptContext.scriptStartTime) {
        target.setDate(target.getDate() + 1);
    }

    return now >= target;
}

/**
 * 判断当前时间是否在给定时间范围内（支持跨天）。
 * @param {*} startStr 起始时间，格式为"HH:mm"
 * @param {*} endStr 结束时间，格式为"HH:mm"
 * @returns {boolean} 如果当前时间在范围内，返回 true，否则返回 false。
 */
function isNowInTimeRange(startStr, endStr) {
    const now = new Date();
    const [startHour, startMinute] = startStr.split(":").map(Number);
    const [endHour, endMinute] = endStr.split(":").map(Number);

    const start = new Date(now);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(now);
    end.setHours(endHour, endMinute, 0, 0);

    // 如果结束时间早于开始时间，表示跨天
    if (end <= start) {
        end.setDate(end.getDate() + 1);
    }
    return now >= start && now <= end;
}

/**
 * 根据上期刷新时间字符串和刷新模式计算下一次的刷新时间。
 *
 * @param {string} lastRefreshTimeStr 上次刷新时间。如果为空或无效，将使用 getDefaultTime()。
 * @param {string} refreshMode 刷新模式，例如 "每X周", "每X天Y点", "每24:05" (表示每24小时零5分), "X小时"
 * @returns {Date | null} 计算出的下一次刷新时间Date对象，如果模式无法解析则返回null。
 * @example 已进行过的测试用例(用例中 GetDefaultTime() 返回 1970-01-01T00:00:00.000+08:00)：
 * calculateNextRefreshTime("2025-06-01T10:00:00.000+08:00", "每1周"); // 2025-06-02T04:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-02T03:00:00.000+08:00", "每1周"); // 2025-06-02T04:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-02T05:00:00.000+08:00", "每1周"); // 2025-06-09T04:00:00.000+08:00
 * calculateNextRefreshTime(null, "每周"); // 1970-01-05T04:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-02T03:00:00.000+08:00", "每2周"); // 2025-06-09T04:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-20T22:00:00.000+08:00", "每天8点"); // 2025-06-21T08:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-21T07:00:00.000+08:00", "每天08点"); // 2025-06-21T08:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-21T09:00:00.000+08:00", "每天08点"); // 2025-06-22T08:00:00.000+08:00
 * calculateNextRefreshTime(null, "每天12点"); // 1970-01-01T12:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-20T10:00:00.000+08:00", "每2天10点"); // 2025-06-22T10:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-20T10:00:00.000+08:00", "每3天0点"); // 2025-06-23T00:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-21T11:00:00.000+08:00", "00:30"); // 2025-06-21T11:30:00.000+08:00
 * calculateNextRefreshTime("2025-06-21T23:00:00.000+08:00", "02:00"); // 2025-06-22T01:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-20T04:00:00.000+08:00", "每24:05"); // 2025-06-21T04:05:00.000+08:00
 * calculateNextRefreshTime(null, "01:00"); // 1970-01-01T01:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-21T10:00:00.000+08:00", "2小时"); // 2025-06-21T12:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-21T23:00:00.000+08:00", "3小时"); // 2025-06-22T02:00:00.000+08:00
 * calculateNextRefreshTime(null, "5小时"); // 1970-01-01T05:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-20T10:00:00.000+08:00", "每1周 每天10点"); // 2025-06-23T04:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-20T10:00:00.000+08:00", "每天10点 02:00 2小时"); // 2025-06-21T10:00:00.000+08:00
 * calculateNextRefreshTime("2025-06-20T10:00:00.000+08:00", "00:30 2小时"); // 2025-06-20T10:30:00.000+08:00
 * calculateNextRefreshTime("2025-06-21T10:00:00.000+08:00", "无效模式"); // null
 */
function calculateNextRefreshTime(lastRefreshTimeStr, refreshMode) {
    let lastRunTime = lastRefreshTimeStr ? new Date(lastRefreshTimeStr) : getDefaultTime();
    let nextRunTime = null;
    const lowerCaseRefreshMode = refreshMode.toLowerCase();

    // 1. 匹配 "每(\d*)周"
    let match = lowerCaseRefreshMode.match(/每(\d*)周/);
    if (match) {
        const weeks = parseInt(match[1] || "1", 10); // 如果没有数字，默认为1周

        nextRunTime = new Date(lastRunTime);
        // 找到 lastRunTime 所在周的周一 04:00
        nextRunTime.setDate(lastRunTime.getDate() - ((lastRunTime.getDay() + 6) % 7)); // 调整到上一个或当前周一
        nextRunTime.setHours(4, 0, 0, 0); // 固定到周一 04:00

        // 确保 nextRunTime 至少晚于 lastRunTime。
        // 如果 lastRunTime 是周一 05:00，而计算出的是周一 04:00，则需要推到下个周期。
        while (nextRunTime <= lastRunTime) {
            nextRunTime.setDate(nextRunTime.getDate() + 7);
        }
        if (weeks > 1) {
            // 如果是多周周期，直接加上 weeks 周
            nextRunTime.setDate(nextRunTime.getDate() + 7 * (weeks - 1));
        }
    }

    // 2. 匹配 "每(\d*)天(\d{1,2})点"
    if (!nextRunTime) {
        match = lowerCaseRefreshMode.match(/每(\d*)天(\d{1,2})点/);
        if (match) {
            const days = parseInt(match[1] || "1", 10); // 如果没有数字，默认为1天
            const hours = parseInt(match[2], 10);

            nextRunTime = new Date(lastRunTime);
            nextRunTime.setHours(hours, 0, 0, 0); // 设置固定小时和分钟

            // 确保 nextRunTime 至少晚于 lastRunTime。
            while (nextRunTime <= lastRunTime) {
                nextRunTime.setDate(nextRunTime.getDate() + days);
            }
        }
    }

    // 3. 匹配 "每(\d\d):(\d\d)" (作为间隔)
    if (!nextRunTime) {
        match = lowerCaseRefreshMode.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            const intervalHours = parseInt(match[1], 10);
            const intervalMinutes = parseInt(match[2], 10);
            const intervalMs = (intervalHours * 60 + intervalMinutes) * 60 * 1000;

            if (intervalMs > 0) {
                // 确保间隔有效
                nextRunTime = new Date(lastRunTime.getTime() + intervalMs);
            }
        }
    }

    // 4. 匹配 "(\d+)小时"
    if (!nextRunTime) {
        match = lowerCaseRefreshMode.match(/(\d+)小时/);
        if (match) {
            const intervalHours = parseInt(match[1], 10);
            const intervalMs = intervalHours * 60 * 60 * 1000;

            if (intervalMs > 0) {
                // 确保间隔有效
                nextRunTime = new Date(lastRunTime.getTime() + intervalMs);
            }
        }
    }

    return nextRunTime;
}

/**
 * 判断任务是否达到刷新时间
 *
 * @param {string} refreshMode 刷新模式，例如 "每X周", "每X天Y点", "X小时", "每24:05" (表示每24小时零5分)
 * @param {string} taskName 任务名称或采集资源名称
 * @param {string} [accountName] 账户名称，可选
 * @returns {{isRefreshed: boolean, lastRunTime: Date | null, nextRunTime: Date | null}}
 * 返回一个对象，包含：
 * - isRefreshed: boolean - 任务是否达到刷新时间。
 * - lastRunTime: Date | null - 任务上次运行的时间（如果未找到，则是getDefaultTime()返回的远古时间）。
 * - nextRunTime: Date | null - 计算出的下一次刷新时间。
 */
function isTaskRefreshed(refreshMode, taskName, accountName = null) {
    let record = {};
    const recordPath = `record/${accountName || "默认账号"}.json`;
    try {
        const content = file.readTextSync(recordPath);
        record = JSON.parse(content);
    } catch (e) {
        log.debug(`无法读取或解析记录文件 ${recordPath}，错误: ${e.message}`);
    }

    taskName = taskName || "默认任务";
    const lastRunTimeStr = record[taskName];
    const currentTime = new Date();
    const nextRunTime = calculateNextRefreshTime(lastRunTimeStr, refreshMode);

    let isRefreshed = false;
    if (!nextRunTime) {
        log.error(`无法解析刷新模式 "{0}"，请检查格式`, refreshMode);
    } else {
        isRefreshed = currentTime >= nextRunTime;
    }

    const lastRunTime = lastRunTimeStr ? new Date(lastRunTimeStr) : getDefaultTime();
    return {
        isRefreshed: isRefreshed,
        lastRunTime: lastRunTime, // 返回实际的 Date 对象
        nextRunTime: nextRunTime,
    };
}

/**
 * 判断任务或资源是否仍然未刷新（对`isTaskRefreshed`的易用封装）
 *
 * @param {string} refreshMode 刷新模式，例如 "每X周", "每X天Y点", "X小时", "每24:05" (表示每24小时零5分)
 * @param {string} taskName 任务名称或采集资源名称，可选
 * @param {string} [accountName] 账户名称，可选
 * @example
 * // 运行结束时调用
 * updateTaskRunTime();
 * // 在脚本开头检查是否已刷新
 * if (taskIsNotRefresh("每天4点")) {
 *   return;
 * }
 */
function taskIsNotRefresh(refreshMode, taskName = null, accountName = null) {
    const { isRefreshed, lastRunTime, nextRunTime } = isTaskRefreshed(refreshMode, taskName, accountName);

    taskName = taskName || "默认任务";
    if (!isRefreshed) {
        log.info("{0}未刷新(上次运行: {1}), 刷新时间: {2}", taskName, formatDateTimeShort(lastRunTime), formatDateTimeShort(nextRunTime));
    }
    return !isRefreshed;
}

/**
 * 更新指定任务的上次运行时间为当前时间。
 *
 * @param {string} taskName 任务名称。
 * @param {string} [accountName=null] 账户名称，可选，默认为null，表示使用默认账户。
 * @returns {boolean} 如果成功更新了任务的上次运行时间则返回true，否则返回false。
 */
function updateTaskRunTime(taskName = null, accountName = null) {
    let record = {};
    taskName = taskName || "默认任务";
    const recordPath = `record/${accountName || "默认账号"}.json`;

    // 1. 读取记录文件
    try {
        const content = file.readTextSync(recordPath);
        record = JSON.parse(content);
    } catch (e) {
        log.debug(`未能读取或解析记录文件 ${recordPath}，将创建新记录。错误: ${e.message}`);
    }

    // 2. 更新指定任务的上次运行时间
    const currentTime = new Date();
    record[taskName] = formatDateTime(currentTime); // 格式化为本地时间字符串，便于人阅读

    // 3. 将更新后的记录写回文件
    try {
        file.writeTextSync(recordPath, JSON.stringify(record, null, 2));
        return true;
    } catch (e) {
        log.error(`写入文件 ${recordPath} 失败: ${e.message}`);
        return false;
    }
}

/**
 * 尝试切换队伍，如果失败则传送到七天神像后重试。
 * @param {string} partyName - 要切换的队伍名
 * @returns {Promise<void>}
 */
async function switchPartySafely(partyName) {
    if (!partyName) return;

    try {
        if (!(await genshin.switchParty(partyName))) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.returnMainUi(); // 确保传送完成
            await genshin.switchParty(partyName);
            await genshin.returnMainUi();
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        await genshin.returnMainUi();
    }
}

/**
 * 获取账号名（通常用于区分不同账号的数据）
 *
 * @async
 * @param {*} multiAccount 是否使用OCR区分多个账号（可以传入一个设置项）
 * @param {boolean} mask 对UID进行掩码，只保留开头和结尾
 * @returns {Promise<string>} 当前账号的UID，如果不区分多账号或OCR失败则返回"默认账号"。
 */
async function getGameAccount(multiAccount = false, mask = true) {
    let account = "默认账号";
    if (!multiAccount) {
        return account;
    }

    // 打开背包避免界面背景干扰
    // await genshin.returnMainUi();
    // keyPress("B");
    // await sleep(1000);

    const region = captureGameRegion();
    const ocrResults = RecognitionObject.ocr(region.width * 0.75, region.height * 0.75, region.width * 0.25, region.height * 0.25);
    const resList = region.findMulti(ocrResults);

    for (let i = 0; i < resList.count; i++) {
        const text = resList[i].text;
        if (text.includes("UID")) {
            const match = text.match(/\d+/);
            if (match) {
                account = match[0];
                if (mask) {
                    // 避免完整UID出现在log中造成意外暴露
                    account = account.replace(/\d*(\d{4})\d{4}/, (match, group1) => match.replace(group1, "xxxx"));
                }
            }
            break;
        }
    }

    if (account === "默认账号") {
        log.error("未能提取到UID");
    }

    return account;
}

/**
 * 获取脚本所在文件夹路径
 * @returns {string|null} 脚本所在文件夹路径，若未获取到则返回 null
 */
function getScriptDirPath() {
    try {
        file.readTextSync(`Ayaka-Main-${Math.random()}.txt`);
    } catch (error) {
        const err_msg = error.toString();
        const match = err_msg.match(/'([^']+)'/);
        const fullPath = match ? match[1] : null;
        const folderPath = fullPath ? fullPath.replace(/\\[^\\]+$/, "") : null;
        return folderPath;
    }
    return null;
}

/**
 * 从 manifest.json 获取脚本自身名称
 * @returns {string} 脚本名称
 */
function getScriptName() {
    const content = file.readTextSync("manifest.json");
    const manifest = JSON.parse(content);
    return manifest.name;
}

/**
 * 从文件路径中提取文件名。
 * @param {string} filePath - 文件路径。
 * @returns {string} - 文件名。
 */
function basename(filePath) {
    const lastSlashIndex = filePath.lastIndexOf("\\"); // 或者使用 '/'
    return filePath.substring(lastSlashIndex + 1);
}

/**
 * 将路径分割为目录和文件名
 * @param {string} path - 文件完整路径
 * @returns {[string, string]} 返回数组，第一个元素是目录路径，第二个是文件名
 * @example
 * const [dir, file] = splitPath('稻妻\\绯樱绣球\\06-绯樱绣球-神里屋敷-10个.json'); // ['稻妻\\绯樱绣球', '06-绯樱绣球-神里屋敷-10个.json']
 */
function splitPath(path) {
    const normalizedPath = path.replace(/\\/g, "/");
    const lastSlashIndex = normalizedPath.lastIndexOf("/");
    if (lastSlashIndex === -1) {
        return ["", path];
    }
    const dir = path.slice(0, lastSlashIndex);
    const file = path.slice(lastSlashIndex + 1);
    return [dir, file];
}

/**
 * 将路径分割为主名和扩展名
 * @param {string} filename - 文件名或路径中的文件部分
 * @returns {[string, string]} 返回数组，第一个是主文件名，第二个是扩展名（含点）
 * @example
 * const [dir, file] = splitPath('稻妻\\绯樱绣球\\06-绯樱绣球-神里屋敷-10个.json'); // ['稻妻\\绯樱绣球\\06-绯樱绣球-神里屋敷-10个', '.json']
 */
function splitExt(filename) {
    const baseName = filename.includes("/") ? filename.slice(filename.lastIndexOf("/") + 1) : filename;
    const lastDotIndex = baseName.lastIndexOf(".");
    if (lastDotIndex <= 0) {
        return [filename, ""];
    }
    return [
        filename.slice(0, filename.length - (baseName.length - lastDotIndex)),
        filename.slice(filename.length - (baseName.length - lastDotIndex)),
    ];
}

/**
 * 如果你需要一个很久以前的时间，作为默认时间
 * @returns {Date} 默认时间的Date对象
 */
function getDefaultTime() {
    const now = new Date();
    const year = now.getFullYear() - 18;
    return new Date(year, 8, 28, 0, 0, 0); // 9月是month=8（0起始）
}

/**
 * 获取指定目录下所有指定后缀的文件列表（不含子文件夹）
 * @param {string} taskDir - 目标目录路径
 * @param {string} [ext=".json"] - 文件后缀名（默认.json）
 * @returns {string[]} 返回符合后缀的文件路径数组
 */
function getFilesByExtension(taskDir, ext = ".json") {
    const allFilesRaw = file.ReadPathSync(taskDir);
    const extFiles = [];

    for (const filePath of allFilesRaw) {
        if (filePath.endsWith(ext)) {
            extFiles.push(filePath);
        }
    }

    return extFiles;
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

// 参考了 mno 大佬的函数
function _fakeLogCore(name, isJs = true, dateIn = null) {
    const isStart = isJs === (dateIn !== null);
    const lastRun = isJs ? new Date() : dateIn;
    const task = isJs ? "JS脚本" : "地图追踪任务";
    let logMessage = "";
    let logTime = new Date();
    if (isJs && isStart) {
        logTime = dateIn;
    }

    const ms = logTime.getMilliseconds().toString().padStart(3, "0");
    // 时间部分从第11位开始，长度是12（"20:20:20"）
    const formattedTime = formatDateTime(logTime).slice(11, 19) + "." + ms;

    if (isStart) {
        logMessage =
            `正在伪造开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行${task}: "${name}"`;
    } else {
        const durationInSeconds = (logTime.getTime() - lastRun.getTime()) / 1000;
        const durationMinutes = Math.floor(durationInSeconds / 60);
        const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数
        logMessage =
            `正在伪造结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
    }
    log.debug(logMessage);
    return logTime;
}

/**
 * 在日志文件中创建可供BGI解析耗时的路径追踪记录，Start和End两个函数需配对使用
 * @param {string} name 要写入到日志的事项名，例如路径追踪的json文件名
 * @returns {Date} 此函数的调用时间的Date对象
 * @example
 * let pathStart = logFakePathStart(fileName);
 * // await pathingScript.runFile(jsonPath);
 * logFakePathEnd(fileName, pathStart);
 */
function logFakePathStart(name) {
    return _fakeLogCore(name, false);
}

/**
 * 在日志文件中创建可供BGI解析耗时的路径追踪记录，Start和End两个函数需配对使用
 * @param {string} name 要写入到日志的事项名，通常传入路径追踪的json文件名
 * @param {Date} startTime 调用`logFakePathStart`时返回的Date对象
 * @example
 * let pathStart = logFakePathStart(fileName);
 * // await pathingScript.runFile(jsonPath);
 * logFakePathEnd(fileName, pathStart);
 */
function logFakePathEnd(name, startTime) {
    return _fakeLogCore(name, false, startTime);
}

/**
 * 在日志文件中创建可供BGI解析耗时的脚本运行记录，Start和End两个函数需配对使用
 * @param {string} scriptName 脚本名，留空时将自动获取
 * @returns {Date} 此函数的调用时间的Date对象
 * @example
 * let startTime = logFakeScriptStart();
 * // do something;
 * logFakeScriptEnd({ startTime: startTime });
 */
function logFakeScriptStart(scriptName = null) {
    if (!scriptName) {
        if (!scriptContext.scriptName) {
            scriptContext.scriptName = getScriptName();
        }
        scriptName = scriptContext.scriptName;
    }
    return _fakeLogCore(scriptName, true);
}

/**
 * 在日志文件中创建可供BGI解析耗时的脚本运行记录，Start和End两个函数需配对使用
 * @param {Object} params
 * @param {string|null} [params.scriptName=null] - 脚本名，留空时将自动获取
 * @param {Date} [params.startTime=new Date()] - 调用`logFakeScriptStart`时返回的Date对象
 * @returns {Date} 此函数的调用时间的Date对象
 * @example
 * let startTime = logFakeScriptStart();
 * // do something;
 * logFakeScriptEnd({ startTime: startTime });
 */
function logFakeScriptEnd({ scriptName = null, startTime = new Date() } = {}) {
    if (!scriptName) {
        if (!scriptContext.scriptName) {
            scriptContext.scriptName = getScriptName();
        }
        scriptName = scriptContext.scriptName;
    }
    return _fakeLogCore(scriptName, true, startTime);
}

/**
 * 等待传送结束
 * @param {Int} timeout 单位为ms
 * @note 参考了七圣召唤七日历练脚本
 */
async function waitTpFinish(timeout = 30000) {
    const region = RecognitionObject.ocr(1690, 230, 75, 350); // 队伍名称区域
    const startTime = Date.now();

    await sleep(500); //点击传送后等待一段时间避免误判
    while (Date.now() - startTime < timeout) {
        let res = captureGameRegion().find(region);
        if (!res.isEmpty()) {
            await sleep(600); //传送结束后有僵直
            return;
        }
        await sleep(100);
    }
    throw new Error("传送时间超时");
}
