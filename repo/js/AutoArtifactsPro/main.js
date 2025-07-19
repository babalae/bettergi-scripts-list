const DEFAULT_OCR_TIMEOUT_SECONDS = 10;
const DEFAULT_FIGHT_TIMEOUT_SECONDS = 120;
// 初始化变量并赋予默认值
let lastRunDate = "未知"; // 默认值
let lastEndTime = new Date(); // 默认值为当前时间
let lastRunRoute = "未知"; // 默认值
let records = new Array(7).fill("");
let finished = false;
const accountName = settings.accountName || "默认账户";
let version = "default";
let runnedToday = false;
let artifactExperienceDiff = 0;
let moraDiff = 0;
let pathIndex = 0;

//预处理
const minIntervalTime = settings.minIntervalTime || "5";
const waitTimePeriod = settings.waitTimePeriod || "4:05-4:45";
const friendshipPartyName = settings.friendshipPartyName || "好感";
const grindPartyName = settings.grindPartyName || "狗粮";
const operationType = settings.operationType || "不卡时间，ab交替运行";
const runActivatePath = settings.runActivatePath || false;
let enemyType = "无";

(async function () {
    setGameMetrics(1920, 1080, 1);
    //伪造js结束记录
    await fakeLog("自动狗粮重制版", true, true, 0);

    //处理操作模式信息
    switch (operationType) {
        case "盗宝团好感卡时间":
            enemyType = "盗宝团";
            break;

        case "愚人众好感卡时间":
            enemyType = "愚人众";
            break;

        case "鳄鱼好感卡时间":
            enemyType = "鳄鱼";
            break;

        case "干等卡时间":
            // 干等卡时间的逻辑
            break;

        case "不卡时间，ab交替运行":
            // 不卡时间，ab交替运行的逻辑
            break;

        default:
            // 其他情况的逻辑
            log.error("未知的操作类型: " + operationType);
            break;
    }

    //处理记录文件路径
    // 获取子文件夹路径

    // Windows文件名非法字符列表
    const illegalCharacters = /[\\/:*?"<>|]/;
    // Windows保留设备名称列表
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    // 检查accountName是否为空字符串
    if (accountName === "") {
        log.error(`账户名 "${accountName}" 不合法，为空字符串。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查accountName是否以空格开头
    else if (accountName.startsWith(" ")) {
        log.error(`账户名 "${accountName}" 不合法，以空格开头。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查accountName是否以空格结尾
    else if (accountName.endsWith(" ")) {
        log.error(`账户名 "${accountName}" 不合法，以空格结尾。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查accountName是否包含非法字符
    else if (illegalCharacters.test(accountName)) {
        log.error(`账户名 "${accountName}" 不合法，包含非法字符。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查accountName是否是保留设备名称
    else if (reservedNames.includes(accountName.toUpperCase())) {
        log.error(`账户名 "${accountName}" 不合法，是保留设备名称。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    // 检查accountName长度是否超过255字符
    else if (accountName.length > 255) {
        log.error(`账户名 "${accountName}" 不合法，账户名过长。`);
        log.error(`将终止程序，请使用合法的名称`);
        await sleep(5000);
        return;
    }
    else {
        log.info(`账户名 "${accountName}" 合法。`);
    }
    let subFolderPath = `records/`;
    let recordFilePath = `records/${accountName}.txt`;
    // 读取子文件夹中的所有文件路径
    const filesInSubFolder = file.ReadPathSync(subFolderPath);
    // 检查记录文件是否存在
    let indexDoExist = false;
    for (const filePath of filesInSubFolder) {
        if (filePath === `records\\${accountName}.txt`) {
            indexDoExist = true;
            break;
        }
    }
    if (indexDoExist) {
        log.info(`records\\${accountName}.txt 存在`);
    } else {
        recordFilePath = `record.txt`;
        subFolderPath = ``;
        // 读取子文件夹中的所有文件路径
        const filesInSubFolder = file.ReadPathSync(subFolderPath);
        // 检查记录文件是否存在
        for (const filePath of filesInSubFolder) {
            if (filePath === `record.txt`) {
                indexDoExist = true;
                break;
            }
        }
        if (indexDoExist) {
            log.info(`record.txt 存在`);
        } else {
            log.warn(`无记录文件，将使用默认数据`);
            recordFilePath = `assets\\BackUp\\record.txt`;
        }
    }
    await sleep(1000);

    //处理卡时间信息
    // 异步读取文件内容
    const content = await file.readText(recordFilePath);

    // 按行分割内容
    const lines = content.split('\n');
    let recordIndex = 0;

    // 逐行处理
    for (const line of lines) {
        // 跳过空行
        if (line.trim() === '') continue;

        // 检查每行的起始部分
        if (line.startsWith("上次运行完成日期:")) {
            lastRunDate = line.substring("上次运行完成日期:".length).trim();
        }

        if (line.startsWith("上次结束时间:")) {
            const timeString = line.substring("上次结束时间:".length).trim();
            if (timeString) {
                lastEndTime = new Date(timeString);
                if (isNaN(lastEndTime.getTime())) {
                    throw new Error(`无效的时间值: ${timeString}`);
                }
            }
        }

        if (line.startsWith("上次运行路线:")) {
            lastRunRoute = line.substring("上次运行路线:".length).trim();
        }

        if (line.startsWith("上次运行是否完成: t")) {
            finished = true;
        }

        if (line.startsWith("日期") && recordIndex < records.length) {
            records[recordIndex] = line.trim(); // 直接使用 line.trim()
            recordIndex++;
        }
    }

    // 输出变量值
    log.info(`上次运行完成日期: ${lastRunDate}`);
    log.info(`上次狗粮开始时间: ${lastEndTime.toISOString()}`);
    log.info(`上次运行路线: ${lastRunRoute}`);
    log.info(`上次运行是否完成: ${finished}`);


    try {
        // 读取 manifest.json 文件的内容
        const content = await file.readText("manifest.json");

        // 解析 JSON 内容为对象
        const manifest = JSON.parse(content);

        // 获取 version 字段的值
        version = manifest.version;

        log.info(`当前js版本：${version}`);

    } catch (error) {
        // 如果发生错误，记录错误信息
        log.error("读取或解析 manifest.json 文件时出错:", error);
    }


    // 拆分 lastRunDate 为年、月、日
    const [year, month, day] = lastRunDate.split('/').map(Number);

    // 生成这个日期凌晨四点的时间
    const lastRunMidnight = new Date(year, month - 1, day, 4, 0, 0);

    // 获取当前时间
    const now = new Date();

    // 计算当前时间与 lastRunMidnight 之间的时间差（单位：毫秒）
    const timeDifference = now - lastRunMidnight;

    // 如果当前时间减去 lastRunMidnight 小于 24 小时（24 * 60 * 60 * 1000 毫秒），则终止狗粮程序运行

    if (timeDifference < 24 * 60 * 60 * 1000) {
        log.info("今日已经运行过狗粮路线");
        runnedToday = true;
    }

    let endTime = await getEndTime(minIntervalTime, lastEndTime);

    // 解析 waitTimePeriod
    const [startTimeStr, endTimeStr] = waitTimePeriod.split('-').map(time => time.trim());

    // 将时间字符串转换为小时和分钟
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);

    // 获取当前日期
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 将时间设置为当天的午夜

    // 创建等待时间段的开始时间和结束时间的 Date 对象
    let waitStartTime = new Date(today);
    waitStartTime.setHours(startHour, startMinute, 0, 0);
    let waitEndTime = new Date(today);
    waitEndTime.setHours(endHour, endMinute, 0, 0);

    let runRouteA = lastRunRoute === "A";

    log.info(`卡时间时间段为${waitStartTime.toTimeString()}-${waitEndTime.toTimeString()}`);

    // 获取当前时间
    const timeNow = new Date();

    if (!runnedToday || !runActivatePath) {
        runRouteA = true;
        // 检查 endTime 是否晚于当天的结束时间
        if (endTime > waitEndTime) {
            // 如果 endTime 晚于当天的结束时间，则将其改为当天的开始时间
            endTime = new Date(waitStartTime);
            // 同时将 runRouteA 改为 false，今天运行B路线
            runRouteA = false;
        }

        // 检查 lastRunRoute 是否为 "B"
        if (lastRunRoute === "B" && operationType !== "不卡时间，ab交替运行") {
            // 如果 lastRunRoute 为 "B"，则将 endTime 改为当天的开始时间
            endTime = new Date(waitStartTime);
            // 同时将 runRouteA 改为 true
            runRouteA = true;
        }

        if (operationType === "不卡时间，ab交替运行") {
            // 定义 1970-01-01T20:00:00.000Z 的时间对象
            const epochTime = new Date('1970-01-01T20:00:00.000Z');

            // 根据当前时间与 1970-01-01T20:00:00.000Z 的天数差的奇偶性给布尔变量 runRouteA 赋值
            runRouteA = Math.floor((now - epochTime) / (24 * 60 * 60 * 1000)) % 2 === 0;
        }
    }

    // 启用自动拾取的实时任务
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    //切换至好感队
    await switchPartyIfNeeded(friendshipPartyName);

    let runnedTimes = 0;

    wait: {
        if (runnedToday) {
            break wait;
        }
        if (operationType !== "不卡时间，ab交替运行") {
            // 输出结果
            log.info(`预期开始狗粮时间: ${endTime.toTimeString().slice(0, 8)}`);
            // 检查当前时间是否晚于 endTime
            if (timeNow > endTime) {
                log.warn('无需卡时间')
            } else {
                if (operationType !== "干等卡时间") {
                    //准备环节
                    if (enemyType === "盗宝团") {
                        log.info(`清理原住民...`);
                        await AutoPath('盗宝团-准备');
                    }
                    if (enemyType === "愚人众") {
                        log.info(`导航到愚人众触发点...`);
                        await AutoPath('愚人众-准备');
                    }
                    if (enemyType === "鳄鱼") {
                        log.info(`导航到盗宝团触发点...`);
                        await AutoPath('鳄鱼-准备');
                    }
                    //好感卡时间

                    // 验证超时设置
                    const ocrTimeout = validateTimeoutSetting(settings.ocrTimeout, DEFAULT_OCR_TIMEOUT_SECONDS, "OCR");
                    const fightTimeout = validateTimeoutSetting(settings.fightTimeout, DEFAULT_FIGHT_TIMEOUT_SECONDS, "战斗");

                    // 好感循环开始	
                    runnedTimes = await AutoFriendshipDev(50, ocrTimeout, fightTimeout, enemyType, endTime);
                }
            }

            // 获取当前时间
            const waitStartNow = new Date();

            // 计算 endTime 与当前时间的差值（单位：毫秒）,以防好感度运行完了还没到时间
            const timeDiff = endTime - waitStartNow;
            if (timeDiff > 0) {
                log.info(`当前时间与预期时间的差值为 ${timeDiff} 毫秒，等待该时间`);
                await sleep(timeDiff);
            } else {
                log.info("当前时间已晚于预期时间，无需等待");
            }
        }
    }

    //更新运行数据
    refresh: {
        if ((runnedToday && finished) || (runnedToday && runActivatePath)) {
            break refresh;
        }
        // 获取当前日期和时间
        const finishDate = new Date();

        // 格式化当前日期为 "YYYY/MM/DD" 格式
        const currentDateString = `${finishDate.getFullYear()}/${String(finishDate.getMonth() + 1).padStart(2, '0')}/${String(finishDate.getDate()).padStart(2, '0')}`;

        // 根据 runRouteA 的值更新 lastRunRoute
        lastRunRoute = runRouteA ? "A" : "B";

        if (settings.useABE) {
            lastRunRoute = `abe${lastRunRoute}`;
        }


        // 更新 lastRunDate 为当前日期
        lastRunDate = currentDateString;

        // 更新 lastEndTime 为当前时间
        lastEndTime = new Date(); // 使用 new Date() 获取当前时间

        //按格式输出今日狗粮路线信息
        log.info(`今日运行狗粮路线：${runRouteA ? 'A' : 'B'}，开始时间：${lastEndTime.toLocaleString()}`);
    }

    //运行前按自定义配置清理狗粮
    if (settings.decomposeMode === "分解（经验瓶）") {
        await processArtifacts(21);
    } else {
        artifactExperienceDiff -= await processArtifacts(21);
    }

    moraDiff -= await mora();
    artifacts: {
        if (runnedToday && finished) {
            break artifacts;
        }

        // 开始运行狗粮路线
        let runArtifactsResult = true;
        runArtifactsResult = await runArtifactsPaths(runRouteA, grindPartyName, settings.useABE);
        artifactExperienceDiff += await processArtifacts(21);
        moraDiff += await mora();
        log.info(`狗粮路线获取摩拉: ${moraDiff}`);
        log.info(`狗粮路线获取狗粮经验: ${artifactExperienceDiff}`);

        //修改records
        for (let i = records.length - 1; i > 0; i--) {
            records[i] = records[i - 1];
        }
        records[0] = `日期:${lastRunDate}，运行路线${lastRunRoute}，狗粮经验${artifactExperienceDiff}，摩拉${moraDiff}`;

        if (runArtifactsResult) {
            //修改文件内容
            log.info('修改记录文件');
            await writeRecordFile(lastRunDate, lastEndTime, lastRunRoute, records, `records/${accountName}.txt`, version, true);
        }
    }

    //完成剩下好感

    if (runnedTimes < settings.minTimesForFirendship) {

        //切换至好感队
        await switchPartyIfNeeded(friendshipPartyName);

        // 验证超时设置
        const ocrTimeout = validateTimeoutSetting(settings.ocrTimeout, DEFAULT_OCR_TIMEOUT_SECONDS, "OCR");
        const fightTimeout = validateTimeoutSetting(settings.fightTimeout, DEFAULT_FIGHT_TIMEOUT_SECONDS, "战斗");
        //准备环节
        if (enemyType === "盗宝团") {
            log.info(`清理原住民...`);
            await AutoPath('盗宝团-准备');
        }
        if (enemyType === "愚人众") {
            log.info(`导航到愚人众触发点...`);
            await AutoPath('愚人众-准备');
        }
        if (enemyType === "鳄鱼") {
            log.info(`导航到鳄鱼触发点...`);
            await AutoPath('鳄鱼-准备');
        }
        // 好感循环开始	
        await AutoFriendshipDev(settings.minTimesForFirendship - runnedTimes, ocrTimeout, fightTimeout, enemyType, endTime + 24 * 60 * 60 * 1000);
    }

    //伪造js开始记录
    await fakeLog("自动狗粮重制版", true, false, 0);
})();

// 异步函数，用于将变量内容写回到文件
async function writeRecordFile(lastRunDate, lastEndTime, lastRunRoute, records, recordFilePath, version, finished) {
    try {
        // 构造要写入文件的内容
        const content = [
            `上次运行完成日期: ${lastRunDate}`,
            `上次结束时间: ${lastEndTime.toISOString()}`,
            `上次运行路线: ${lastRunRoute}`,
            `上次运行是否完成: ${finished}`,
            `js版本: ${version}`,
            "历史收益："
        ].concat(records).join('\n');

        // 异步写入文件
        const result = await file.writeText(recordFilePath, content, false); // 覆盖写入
        if (result) {
            log.info("文件写入成功");
        } else {
            log.error("文件写入失败");
        }
    } catch (error) {
        log.error(`写入文件时出错: ${error}`);
    }
}

//运行狗粮路线的逻辑
async function runArtifactsPaths(runRouteA, grindPartyName, useABE) {
    // 根据 runRouteA 的值给 runningRoute 赋值
    const runningRoute = runRouteA ? "A" : "B";

    // 定义文件夹路径
    const folderName = `${runningRoute}路线`;

    let ArtifactsPath = "abeArtifactsPath";

    if (!useABE) {
        ArtifactsPath = "ArtifactsPath";
        log.info("使用新路线中");
    } else {
        log.warn("使用老abe路线中");
    }

    const filePathNormal = `assets/${ArtifactsPath}/${folderName}/01普通`;
    const filePathEnding = `assets/${ArtifactsPath}/${folderName}/02收尾`;
    const filePathExtra = `assets/${ArtifactsPath}/${folderName}/03额外`;
    const filePathPreparation = `assets/${ArtifactsPath}/${folderName}/00准备`;
    const filePathActivate = `assets/${ArtifactsPath}/${folderName}/-1激活`;

    // 将每组路线的逻辑抽取为公用函数
    async function runPathGroups(filePathDir, subTaskName) {
        // 读取文件夹中的文件名并处理
        const filePaths = file.readPathSync(filePathDir);
        const jsonFilePaths = [];

        for (const filePath of filePaths) {
            if (filePath.endsWith('.json')) { // 检查文件名是否以 .json 结尾
                jsonFilePaths.push(filePath); // 存储文件名
            }
        }

        let currentTask = 0; // 当前任务计数器

        // 执行地图追踪文件
        for (const fileName of jsonFilePaths) {
            pathIndex++;
            if ((pathIndex % 5 === 0) && settings.autoSalvage && settings.decomposeMode != "保留") {
                artifactExperienceDiff += await processArtifacts(1);
            }
            const fullPath = fileName;
            await fakeLog(fileName, false, true, 0);
            currentTask += 1; // 更新当前任务计数器
            log.info(`当前进度：${fullPath}为${subTaskName}${folderName}第${currentTask}/${jsonFilePaths.length}个`);
            await pathingScript.runFile(fullPath);
            //捕获任务取消的信息并跳出循环
            try {
                await sleep(10); // 假设 sleep 是一个异步函数，休眠 10 毫秒
            } catch (error) {
                log.error(`发生错误: ${error}`);
                throw new Error("任务被取消");
            }
            await fakeLog(fileName, false, false, 0);
        }
    }

    //运行激活路线
    if (settings.runActivatePath && !runnedToday) {
        await runPathGroups(filePathActivate, "激活");
    }

    if (!((runnedToday && finished) || (runnedToday && runActivatePath))) {
        //修改文件内容
        log.info('修改记录文件');
        await writeRecordFile(lastRunDate, lastEndTime, lastRunRoute, records, `records/${accountName}.txt`, version, false);
    }
    // 运行准备路线（关闭拾取）
    dispatcher.ClearAllTriggers();
    await runPathGroups(filePathPreparation, "准备");

    // 启用自动拾取的实时任务
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));

    //切换至狗粮队
    await switchPartyIfNeeded(grindPartyName);

    // 运行普通路线
    await runPathGroups(filePathNormal, "普通");

    await genshin.tpToStatueOfTheSeven();

    // 运行收尾路线
    await runPathGroups(filePathEnding, "收尾");

    // 运行额外路线
    await runPathGroups(filePathExtra, "额外");

    return true;
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

//用于获取结束时间
async function getEndTime(minIntervalTime, lastEndTime) {
    const minIntervalTimeInMs = minIntervalTime * 60 * 1000; // 将分钟转换为毫秒
    return new Date(lastEndTime.getTime() + 24 * 60 * 60 * 1000 + minIntervalTimeInMs);
}

// 执行 好感度的 path 任务
async function AutoPath(locationName) {
    try {
        const filePath = `assets/AutoPath/${locationName}.json`;
        await pathingScript.runFile(filePath);
    } catch (error) {
        log.error(`执行 ${locationName} 路径时发生错误: ${error.message}`);
    }
}

//好感度任务的逻辑
async function AutoFriendshipDev(times, ocrTimeout, fightTimeout, enemyType = "盗宝团", endTime) {
    let friendTimes = 0;
    for (let i = 0; i < times; i++) {

        if (enemyType === "无") {
            log.info(`不进行好感`);
            return 0;
        }

        // 获取当前时间
        const now = new Date();

        // 比较当前时间与 endTime，若晚于 endTime 则跳出循环
        if (now > endTime) {
            log.info("当前时间已晚于预期时间，终止好感任务");
            break;
        }

        await fakeLog(`第${i + 1}次好感`, false, true, 0);
        friendTimes = friendTimes + 1;
        await AutoPath(`${enemyType}-触发点`);
        // 启动路径导航任务
        let pathTaskPromise = AutoPath(`${enemyType}-战斗点`);

        // 根据敌人类型设置不同的OCR检测关键词
        const ocrKeywords = getOcrKeywords(enemyType);

        // OCR检测
        let ocrStatus = false;
        let ocrStartTime = Date.now();
        while (Date.now() - ocrStartTime < ocrTimeout * 1000 && !ocrStatus) {
            let captureRegion = captureGameRegion();
            let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 200, 300, 300));
            for (let o = 0; o < resList.count; o++) {
                let res = resList[o];
                for (let keyword of ocrKeywords) {
                    if (res.text.includes(keyword)) {
                        ocrStatus = true;
                        log.info("检测到突发任务触发");
                        break;
                    }
                }
                if (ocrStatus) break;
            }
            if (!ocrStatus) {
                await sleep(1000);
            }
        }

        if (ocrStatus) {
            const cts = new CancellationTokenSource();
            try {                // 设置最大等待时间为15秒
                const maxWaitTime = 15000;
                const waitStartTime = Date.now();

                // 根据敌人类型设置不同的目标坐标
                const targetCoords = getTargetCoordinates(enemyType);
                const maxDistance = 10; // 10米距离判定

                // 等待角色到达指定位置附近
                let isNearTarget = false;
                let pathTaskFinished = false;

                // 简单监控路径任务完成
                pathTaskPromise.then(() => {
                    pathTaskFinished = true;
                    log.info("路径任务已完成");
                }).catch(error => {
                    pathTaskFinished = true;
                    log.error(`路径任务出错: ${error}`);
                });
                // 等待角色到达目标位置或超时
                while (!isNearTarget && !pathTaskFinished && (Date.now() - waitStartTime < maxWaitTime)) {
                    const pos = genshin.getPositionFromMap();
                    if (pos) {
                        const distance = Math.sqrt(Math.pow(pos.x - targetCoords.x, 2) + Math.pow(pos.y - targetCoords.y, 2));
                        if (distance <= maxDistance) {
                            isNearTarget = true;
                            log.info(`已到达目标点附近，距离: ${distance.toFixed(2)}米`);
                            break;
                        }
                    }
                    await sleep(1000);
                } log.info("开始战斗...");
                const battleTask = dispatcher.RunTask(new SoloTask("AutoFight"), cts);
                const fightResultPromise = waitForBattleResult(fightTimeout * 1000, enemyType, cts);

                // 使用 Promise.all 等待两个任务完成
                const [battleResult, fightResult] = await Promise.all([
                    battleTask.catch(error => {
                        return { success: false, error: error };
                    }),
                    fightResultPromise // 不捕获超时错误，让它直接抛到外层
                ]);
                await pathTaskPromise; // 等待路径任务完成
                cts.cancel();
            } catch (error) {
                cts.cancel();
                if (error.message && error.message.includes("战斗超时")) {
                    log.error(`战斗超时，终止整个任务: ${error.message}`);
                    await genshin.tpToStatueOfTheSeven(); // 超时回到七天神像终止任务
                    throw error; // 重新抛出超时错误，终止整个任务
                }
                log.error(`执行过程中出错: ${error}`);
            }
        } else {
            notification.send(`未识别到突发任务，${enemyType}好感结束`);
            log.info(`未识别到突发任务，${enemyType}好感结束`);
            return false;
        }

        // 特殊处理：鳄鱼战斗后需要拾取
        if (enemyType === "鳄鱼") {
            await AutoPath('鳄鱼-拾取');
        }

        await fakeLog(`第${i + 1}次好感`, false, false, 0);
    }
    log.info(`${enemyType}好感运行了${friendTimes}次`);
    await genshin.tpToStatueOfTheSeven();

    return friendTimes;
}

// 验证输入是否是正整数
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

// 根据敌人类型获取OCR关键词
function getOcrKeywords(enemyType) {
    if (enemyType === "愚人众") {
        return ["买卖", "不成", "正义存", "愚人众", "禁止", "危险", "运输", "打倒", "盗宝团", "丘丘人", "今晚", "伙食", "所有人"];
    }
    else if (enemyType === "盗宝团") {
        return ["岛上", "无贼", "消灭", "鬼鬼祟祟", "盗宝团"];
    }
    else if (enemyType === "鳄鱼") {
        return ["张牙", "舞爪", "恶党", "鳄鱼", "打倒", "所有", "鳄鱼"];
    }
    else {
        return ["突发", "任务", "打倒", "消灭", "敌人", "所有"]; // 兜底关键词
    }
}

// 根据敌人类型获取目标战斗点坐标
function getTargetCoordinates(enemyType) {
    if (enemyType === "愚人众") {
        return { x: 4840.55, y: -3078.01 };
    } else if (enemyType === "盗宝团") {
        // 盗宝团战斗点坐标
        return { x: -2757.28, y: -3468.43 };
    } else if (enemyType === "鳄鱼") {
        // 鳄鱼战斗点坐标
        return { x: 3578.08, y: -500.75 };
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

//等待战斗结果
async function waitForBattleResult(timeout = 2 * 60 * 1000, enemyType = "盗宝团", cts = new CancellationTokenSource()) {
    let fightStartTime = Date.now();
    const successKeywords = ["事件", "完成"];
    const failureKeywords = ["失败"];
    const eventKeywords = getOcrKeywords(enemyType);
    let notFind = 0;

    while (Date.now() - fightStartTime < timeout) {
        try {
            // 简化OCR检测，只使用一个try-catch块
            let captureRegion = captureGameRegion();
            let result = captureRegion.find(RecognitionObject.ocr(850, 150, 200, 80));
            let result2 = captureRegion.find(RecognitionObject.ocr(0, 200, 300, 300));
            let text = result.text;
            let text2 = result2.text;

            // 检查成功关键词
            for (let keyword of successKeywords) {
                if (text.includes(keyword)) {
                    log.info("检测到战斗成功关键词: {0}", keyword);
                    log.info("战斗结果：成功");
                    cts.cancel(); // 取消任务
                    return true;
                }
            }

            // 检查失败关键词
            for (let keyword of failureKeywords) {
                if (text.includes(keyword)) {
                    log.warn("检测到战斗失败关键词: {0}", keyword);
                    log.warn("战斗结果：失败，回到七天神像重试");
                    cts.cancel(); // 取消任务
                    await genshin.tpToStatueOfTheSeven();
                    if (enemyType === "愚人众") {
                        await AutoPath('愚人众-准备');
                    }
                    return false;
                }
            }

            // 检查事件关键词
            let find = 0;
            for (let keyword of eventKeywords) {
                if (text2.includes(keyword)) {
                    find++;
                }
            }

            if (find === 0) {
                notFind++;
                log.info("未检测到任务触发关键词：{0} 次", notFind);
            } else {
                notFind = 0;
            }

            if (notFind > 10) {
                log.warn("不在任务触发区域，战斗失败");
                cts.cancel(); // 取消任务
                if (enemyType === "愚人众") {
                    log.warn("回到愚人众准备点");
                    await AutoPath('愚人众-准备');
                }
                return false;

            }
        }
        catch (error) {
            log.error("OCR过程中出错: {0}", error);
            // 出错后继续循环，不进行额外嵌套处理
        }

        // 统一的检查间隔
        await sleep(1000);
    }

    log.warn("在超时时间内未检测到战斗结果");
    cts.cancel(); // 取消任务
}

/**
 * 验证超时时间设置
 * @param {number|string} value - 用户设置的超时时间（秒）
 * @param {number} defaultValue - 默认超时时间（秒）
 * @param {string} timeoutType - 超时类型名称
 * @returns {number} - 验证后的超时时间（秒）
 */
function validateTimeoutSetting(value, defaultValue, timeoutType) {
    // 转换为数字
    const timeout = Number(value);

    // 检查是否为有效数字且大于0
    if (!isFinite(timeout) || timeout <= 0) {
        log.warn(`${timeoutType}超时设置无效，必须是大于0的数字，将使用默认值 ${defaultValue} 秒`);
        return defaultValue;
    }

    log.info(`${timeoutType}超时设置为 ${timeout} 秒`);
    return timeout;
}

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
let CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CharacterMenu.png"), 60, 991, 38, 38);

// 定义一个函数用于识别图像
async function recognizeImage(recognitionObject, timeout = 5000) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试识别图像
            let imageResult = captureGameRegion().find(recognitionObject);
            if (imageResult) {
                // log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
                // log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
                return { success: true, x: imageResult.x, y: imageResult.y };
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别图像`);
    return { success: false };
}

// 定义一个函数用于识别文字并点击
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 3000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试 OCR 识别
            let resList = captureGameRegion().findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)); // 指定识别区域
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                let correctedText = res.text;
                if (correctedText.includes(targetText)) {
                    // 如果找到目标文本，计算并点击文字的中心坐标
                    let centerX = Math.round(res.x + res.width / 2);
                    let centerY = Math.round(res.y + res.height / 2);
                    await click(centerX, centerY);
                    await sleep(500); // 确保点击后有足够的时间等待
                    return { success: true, x: centerX, y: centerY };
                }
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`页面标志识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(1000); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别文字: ${targetText},尝试点击默认中心位置`);
    let centerX = Math.round(ocrRegion.x + ocrRegion.width / 2);
    let centerY = Math.round(ocrRegion.y + ocrRegion.height / 2);
    await click(centerX, centerY);
    await sleep(1000);
    return { success: false };
}

// 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 在指定区域进行 OCR 识别
            let ocrResult = captureGameRegion().find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            if (ocrResult) {
                let correctedText = ocrResult.text;
                return correctedText; // 返回识别到的内容
            } else {
                log.warn(`OCR 识别区域未找到内容`);
                return null; // 如果 OCR 未识别到内容，返回 null
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}

async function decomposeArtifacts() {
    keyPress("B");
    await sleep(1000);
    await click(670, 45);
    await sleep(500);

    await recognizeTextAndClick("分解", { x: 635, y: 991, width: 81, height: 57 });
    await sleep(1000);

    //识别已储存经验（1570-880-1650-930）
    let regionToCheck1 = { x: 1570, y: 880, width: 80, height: 50 };
    let initialNum = await recognizeTextInRegion(regionToCheck1);
    let initialValue = 0;

    if (initialNum && !isNaN(parseInt(initialNum, 10))) {
        initialValue = parseInt(initialNum, 10);
        log.info(`已储存经验识别成功: ${initialValue}`);
    } else {
        log.warn(`在指定区域未识别到有效数字: ${initialValue}`);
    }
    let regionToCheck3 = { x: 100, y: 885, width: 170, height: 50 };
    let decomposedNum = 0;
    let firstNumber = 0;
    let firstNumber2 = 0;

    if (settings.keep4Star) {
        await recognizeTextAndClick("快速选择", { x: 248, y: 996, width: 121, height: 49 });
        moveMouseTo(960, 540);
        await sleep(1000);

        await click(370, 1020); // 点击“确认选择”按钮
        await sleep(1500);

        decomposedNum = await recognizeTextInRegion(regionToCheck3);

        // 使用正则表达式提取第一个数字
        const match = decomposedNum.match(/已选(\d+)/);

        // 检查是否匹配成功
        if (match) {
            // 将匹配到的第一个数字转换为数字类型并存储在变量中
            firstNumber = Number(match[1]);
            log.info(`1-4星总数量: ${firstNumber}`);
        } else {
            log.info("识别失败");
        }
        keyPress("VK_ESCAPE");


        await recognizeTextAndClick("分解", { x: 635, y: 991, width: 81, height: 57 });
        await sleep(1000);
    }
    await recognizeTextAndClick("快速选择", { x: 248, y: 996, width: 121, height: 49 });
    moveMouseTo(960, 540);
    await sleep(1000);

    if (settings.keep4Star) {
        await click(370, 370);//取消选择四星
        await sleep(1000);
    }
    await click(370, 1020); // 点击“确认选择”按钮
    await sleep(1500);

    let decomposedNum2 = await recognizeTextInRegion(regionToCheck3);

    // 使用正则表达式提取第一个数字
    const match2 = decomposedNum2.match(/已选(\d+)/);

    // 检查是否匹配成功
    if (match2) {
        // 将匹配到的第一个数字转换为数字类型并存储在变量中
        firstNumber2 = Number(match2[1]);
        log.info(`分解总数是: ${firstNumber2}`);
    } else {
        log.info("识别失败");
    }
    //识别当前总经验
    let regionToCheck2 = { x: 1500, y: 900, width: 150, height: 100 };
    let newNum = await recognizeTextInRegion(regionToCheck2);
    let newValue = 0;

    if (newNum && !isNaN(parseInt(newNum, 10))) {
        newValue = parseInt(newNum, 10);
        log.info(`当前总经验识别成功: ${newValue}`);
    } else {
        log.warn(`在指定区域未识别到有效数字: ${newValue}`);
    }

    if (settings.decomposeMode === "分解（经验瓶）") {
        log.info(`用户选择了分解，执行分解`);
        // 根据用户配置，分解狗粮
        await sleep(1000);
        await click(1620, 1020); // 点击分解按钮
        await sleep(1000);

        // 4. 识别"进行分解"按钮
        await click(1340, 755); // 点击进行分解按钮

        await sleep(1000);

        // 5. 关闭确认界面
        await click(1340, 755);
        await sleep(1000);
    }
    else {
        log.info(`用户未选择分解，不执行分解`);
    }

    // 7. 计算分解获得经验=总经验-上次剩余
    const resinExperience = Math.max(newValue - initialValue, 0);
    log.info(`分解可获得经验: ${resinExperience}`);
    let fourStarNum = firstNumber - firstNumber2;
    if (settings.keep4Star) {
        log.info(`保留的四星数量: ${fourStarNum}`);
    }
    let resultExperience = resinExperience;
    if (resultExperience === 0) {
        resultExperience = initialValue;
    }
    const result = resultExperience;
    await genshin.returnMainUi();
    return result;
}

/**
 * 摧毁圣遗物换摩拉
 */
async function destroyArtifacts(times = 1) {
    const ArtifactsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ArtifactsButton.png"));
    const DeleteButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DeleteButton.png"));
    const AutoAddButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/AutoAddButton.png"));
    const ConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ConfirmButton.png"));
    const DestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DestoryButton.png"));
    const MidDestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DestoryButton.png"), 900, 600, 500, 300);
    await genshin.returnMainUi();
    keyPress("B");
    await sleep(1500);

    let ArtifactsButton = captureGameRegion().find(ArtifactsButtonRo);
    if (ArtifactsButton.isExist()) {
        log.info("识别到圣遗物按钮");
        ArtifactsButton.click();
        await sleep(1500);
    }

    try {
        for (let i = 0; i < times; i++) {
            captureGameRegion().find(DeleteButtonRo).click();// 点击摧毁
            await sleep(600);
            captureGameRegion().find(AutoAddButtonRo).click();// 点击自动添加
            await sleep(600);
            await sleep(300);
            click(150, 150);
            await sleep(300);
            click(150, 220);
            await sleep(300);
            click(150, 300);
            if (!settings.keep4Star) {
                await sleep(300);
                click(150, 370);
            }
            captureGameRegion().find(ConfirmButtonRo).click();// 点击快捷放入
            await sleep(600);
            captureGameRegion().find(DestoryButtonRo).click();// 点击摧毁
            await sleep(600);
            captureGameRegion().find(MidDestoryButtonRo).click();// 弹出页面点击摧毁
            await sleep(600);
            click(960, 1000);// 点击空白处
            await sleep(1000);
        }
    } catch (ex) {
        log.info("背包里的圣遗物已摧毁完毕，提前结束")
    } finally {
        await genshin.returnMainUi();
    }

}

async function processArtifacts(times = 1) {
    await genshin.returnMainUi();
    let result = 0;
    try {
        if (settings.decomposeMode === "销毁（摩拉）") {
            result = await destroyArtifacts(times);
        } else {
            result = await decomposeArtifacts();
        }
    } catch (error) {
        log.error(`处理狗粮分解时发生异常: ${error.message}`);
    }
    await genshin.returnMainUi();
    return result;
}

async function mora() {
    let result = 0;
    let tryTimes = 0;
    while (result === 0 && tryTimes < 3) {
        await genshin.returnMainUi();
        log.info("开始尝试识别摩拉");
        // 按下 C 键
        keyPress("C");
        await sleep(1500);
        let recognized = false;
        // 识别“角色菜单”图标或“天赋”文字
        let startTime = Date.now();
        while (Date.now() - startTime < 5000) {
            // 尝试识别“角色菜单”图标
            let characterMenuResult = await recognizeImage(CharacterMenuRo, 5000);
            if (characterMenuResult.success) {
                await click(177, 433);
                await sleep(500);
                recognized = true;
                break;
            }

            // 尝试识别“天赋”文字
            let targetText = "天赋";
            let ocrRegion = { x: 133, y: 395, width: 115, height: 70 }; // 设置对应的识别区域
            let talentResult = await recognizeTextAndClick(targetText, ocrRegion);
            if (talentResult.success) {
                log.info(`点击天赋文字，坐标: x=${talentResult.x}, y=${talentResult.y}`);
                recognized = true;
                break;
            }

            await sleep(1000); // 短暂延迟，避免过快循环
        }

        let recognizedText = "";

        // 如果识别到了“角色菜单”或“天赋”，则识别“摩拉数值”
        if (recognized) {
            let ocrRegionMora = { x: 1620, y: 25, width: 152, height: 46 }; // 设置对应的识别区域
            recognizedText = await recognizeTextInRegion(ocrRegionMora);
            if (recognizedText) {
                log.info(`成功识别到摩拉数值: ${recognizedText}`);
                result = recognizedText;
            } else {
                log.warn("未能识别到摩拉数值。");
            }
        } else {
            log.warn("未能识别到角色菜单或天赋");
        }
        await sleep(500);
        tryTimes++;
        await genshin.returnMainUi();
    }
    return Number(result);
}