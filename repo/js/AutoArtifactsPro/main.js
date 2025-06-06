const DEFAULT_OCR_TIMEOUT_SECONDS = 10;
const DEFAULT_FIGHT_TIMEOUT_SECONDS = 120;

(async function () {
    //伪造js结束记录
    await fakeLog("自动狗粮重制版", true, true, 0);

    //预处理
    //settings 获取自定义配置
    const minIntervalTime = settings.minIntervalTime;
    const waitTimePeriod = settings.waitTimePeriod;
    const friendshipPartyName = settings.friendshipPartyName;
    const grindPartyName = settings.grindPartyName;
    const operationType = settings.operationType || "盗宝团";

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


    //处理卡时间信息
    // 异步读取文件内容
    const content = await file.readText("record.txt");

    // 初始化变量并赋予默认值
    let lastRunDate = "未知"; // 默认值
    let lastEndTime = new Date(); // 默认值为当前时间
    let lastRunRoute = "未知"; // 默认值

    // 按行分割内容
    const lines = content.split('\n');

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
    }

    // 输出变量值
    log.info(`上次运行完成日期: ${lastRunDate}`);
    log.info(`上次狗粮开始时间: ${lastEndTime.toISOString()}`);
    log.info(`上次运行路线: ${lastRunRoute}`);
    // 拆分 lastRunDate 为年、月、日
    const [year, month, day] = lastRunDate.split('/').map(Number);

    // 生成这个日期凌晨四点的时间
    const lastRunMidnight = new Date(year, month - 1, day, 4, 0, 0);

    // 获取当前时间
    const now = new Date();

    // 计算当前时间与 lastRunMidnight 之间的时间差（单位：毫秒）
    const timeDifference = now - lastRunMidnight;

    // 如果当前时间减去 lastRunMidnight 小于 24 小时（24 * 60 * 60 * 1000 毫秒），则终止程序运行
    if (timeDifference < 24 * 60 * 60 * 1000) {
        log.info("今日已经运行过狗粮路线，终止程序运行");
        return; // 提前退出函数
    }

    // 如果时间差大于或等于 24 小时，程序继续运行
    log.info("今日还没有运行过狗粮路线，程序运行");

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
    const waitStartTime = new Date(today);
    waitStartTime.setHours(startHour, startMinute, 0, 0);

    const waitEndTime = new Date(today);
    waitEndTime.setHours(endHour, endMinute, 0, 0);

    // 新增变量，初始值为 true，用于标识今天跑的路线
    let runRouteA = true;

    // 获取当前时间
    const timeNow = new Date();

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

    if (operationType === "不卡时间，ab交替运行" && lastRunRoute === "A") {
        runRouteA = false;
    }

    // 根据 runRouteA 的值给 runningRoute 赋值
    const runningRoute = runRouteA ? "A" : "B";
    const folderName = `${runningRoute}路线`;
    const filePathPreparation = `assets/ArtifactsPath/${folderName}/00准备`;
    // 运行准备路线
    {
        //切换至好感队
        await switchPartyIfNeeded(friendshipPartyName);

        // 读取文件夹中的文件名并处理
        const filePaths = file.readPathSync(filePathPreparation);
        const jsonFileNames = [];

        for (const filePath of filePaths) {
            const fileName = basename(filePath); // 提取文件名
            if (fileName.endsWith('.json')) { // 检查文件名是否以 .json 结尾
                jsonFileNames.push(fileName); // 存储文件名
            }
        }

        let currentTask = 0; // 当前任务计数器

        // 执行准备路线的地图追踪文件
        for (const fileName of jsonFileNames) {
            const fullPath = fileName;
            await fakeLog(fileName, false, true, 0);
            currentTask += 1; // 更新当前任务计数器
            log.info(`当前进度：准备${folderName}第${currentTask}/${jsonFileNames.length}个`);
            await pathingScript.runFile(fullPath);
            //捕获任务取消的信息并跳出循环
            try {
                await sleep(10); // 假设 sleep 是一个异步函数，休眠 10 毫秒
            } catch (error) {
                log.error(`发生错误: ${error}`);
                return false; // 终止循环
            }
            await fakeLog(fileName, false, false, 0);
        }
    }

    // 启用自动拾取的实时任务
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));


    if (operationType !== "不卡时间，ab交替运行") {
        // 输出结果
        log.info(`预期开始狗粮时间: ${endTime.toTimeString().slice(0, 8)}`);

        // 检查当前时间是否晚于 endTime
        if (timeNow > endTime) {
            log.warn('无需卡时间')
            didPreparation = false;
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
                await AutoFriendshipDev(50, ocrTimeout, fightTimeout, enemyType, endTime);
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
    //切换至狗粮队
    await switchPartyIfNeeded(grindPartyName);

    //更新运行数据
    {
        // 获取当前日期和时间
        const finishDate = new Date();

        // 格式化当前日期为 "YYYY/MM/DD" 格式
        const currentDateString = `${finishDate.getFullYear()}/${String(finishDate.getMonth() + 1).padStart(2, '0')}/${String(finishDate.getDate()).padStart(2, '0')}`;

        // 根据 runRouteA 的值更新 lastRunRoute
        lastRunRoute = runRouteA ? "A" : "B";

        // 更新 lastRunDate 为当前日期
        lastRunDate = currentDateString;

        // 更新 lastEndTime 为当前时间
        lastEndTime = new Date(); // 使用 new Date() 获取当前时间

        //按格式输出今日狗粮路线信息
        log.info(`今日运行狗粮路线：${runRouteA ? 'A' : 'B'}，开始时间：${lastEndTime.toLocaleString()}`);
    }

    // 开始运行狗粮路线
    let runArtifactsResult = true;
    runArtifactsResult = await runArtifactsPaths(runRouteA);

    if (runArtifactsResult) {
        //修改文件内容
        log.info('尝试修改记录文件');
        await writeRecordFile(lastRunDate, lastEndTime, lastRunRoute);
    }

    //完成剩下好感

    if (settings.completeRemainingFriendship) {
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
            log.info(`导航到盗宝团触发点...`);
            await AutoPath('鳄鱼-准备');
        }
        // 好感循环开始	
        await AutoFriendshipDev(50, ocrTimeout, fightTimeout, enemyType, endTime + 24 * 60 * 60 * 1000);
    }
    //伪造js开始记录
    await fakeLog("自动狗粮重制版", true, false, 0);
})();

// 异步函数，用于将变量内容写回到文件
async function writeRecordFile(lastRunDate, lastEndTime, lastRunRoute) {
    try {
        // 构造要写入文件的内容
        const content = [
            `上次运行完成日期: ${lastRunDate}`,
            `上次结束时间: ${lastEndTime.toISOString()}`,
            `上次运行路线: ${lastRunRoute}`
        ].join('\n');

        // 异步写入文件
        const result = await file.writeText("record.txt", content, false); // 覆盖写入
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
async function runArtifactsPaths(runRouteA) {
    // 根据 runRouteA 的值给 runningRoute 赋值
    const runningRoute = runRouteA ? "A" : "B";

    // 定义文件夹路径
    const folderName = `${runningRoute}路线`;

    const filePathNormal = `assets/ArtifactsPath/${folderName}/01普通`;
    const filePathEnding = `assets/ArtifactsPath/${folderName}/02收尾`;
    const filePathExtra = `assets/ArtifactsPath/${folderName}/03额外`;

    // 运行普通路线
    {
        // 读取文件夹中的文件名并处理
        const filePaths = file.readPathSync(filePathNormal);
        const jsonFileNames = [];

        for (const filePath of filePaths) {
            const fileName = basename(filePath); // 提取文件名
            if (fileName.endsWith('.json')) { // 检查文件名是否以 .json 结尾
                jsonFileNames.push(fileName); // 存储文件名
            }
        }

        let currentTask = 0; // 当前任务计数器

        // 执行普通路线的地图追踪文件
        for (const fileName of jsonFileNames) {
            const fullPath = fileName;
            await fakeLog(fileName, false, true, 0);
            currentTask += 1; // 更新当前任务计数器
            log.info(`当前进度：普通${folderName}第${currentTask}/${jsonFileNames.length}个`);
            await pathingScript.runFile(fullPath);
            //捕获任务取消的信息并跳出循环
            try {
                await sleep(10); // 假设 sleep 是一个异步函数，休眠 10 毫秒
            } catch (error) {
                log.error(`发生错误: ${error}`);
                return false; // 终止循环
            }
            await fakeLog(fileName, false, false, 0);
        }
    }

    // 运行收尾路线
    {
        // 读取文件夹中的文件名并处理
        const filePaths = file.readPathSync(filePathEnding);
        const jsonFileNames = [];

        for (const filePath of filePaths) {
            const fileName = basename(filePath); // 提取文件名
            if (fileName.endsWith('.json')) { // 检查文件名是否以 .json 结尾
                jsonFileNames.push(fileName); // 存储文件名
            }
        }

        let currentTask = 0; // 当前任务计数器

        // 执行收尾路线的地图追踪文件
        for (const fileName of jsonFileNames) {
            const fullPath = fileName;
            await fakeLog(fileName, false, true, 0);
            currentTask += 1; // 更新当前任务计数器
            log.info(`当前进度：收尾${folderName}第${currentTask}/${jsonFileNames.length}个`);
            await pathingScript.runFile(fullPath);
            //捕获任务取消的信息并跳出循环
            try {
                await sleep(10); // 假设 sleep 是一个异步函数，休眠 10 毫秒
            } catch (error) {
                log.error(`发生错误: ${error}`);
                return false; // 终止循环
            }
            await fakeLog(fileName, false, false, 0);
        }
    }

    // 运行额外路线
    {
        // 读取文件夹中的文件名并处理
        const filePaths = file.readPathSync(filePathExtra);
        const jsonFileNames = [];

        for (const filePath of filePaths) {
            const fileName = basename(filePath); // 提取文件名
            if (fileName.endsWith('.json')) { // 检查文件名是否以 .json 结尾
                jsonFileNames.push(fileName); // 存储文件名
            }
        }

        let currentTask = 0; // 当前任务计数器

        // 执行额外路线的地图追踪文件
        for (const fileName of jsonFileNames) {
            const fullPath = fileName;
            await fakeLog(fileName, false, true, 0);
            currentTask += 1; // 更新当前任务计数器
            log.info(`当前进度：额外${folderName}第${currentTask}/${jsonFileNames.length}个`);
            await pathingScript.runFile(fullPath);
            //捕获任务取消的信息并跳出循环
            try {
                await sleep(10); // 假设 sleep 是一个异步函数，休眠 10 毫秒
            } catch (error) {
                log.error(`发生错误: ${error}`);
                return false; // 终止循环
            }
            await fakeLog(fileName, false, false, 0);
        }
    }

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

// 辅助函数：提取文件名
function basename(filePath) {
    return filePath.split('/').pop();
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
    for (let i = 0; i < times; i++) {

        // 获取当前时间
        const now = new Date();

        // 比较当前时间与 endTime，若晚于 endTime 则跳出循环
        if (now > endTime) {
            log.info("当前时间已晚于预期时间，终止好感任务");
            break;
        }

        await fakeLog(`第${i + 1}次好感`, false, true, 0);

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
    log.info(`${enemyType}好感已完成`);
    await genshin.tpToStatueOfTheSeven();

    return true;
}

// 验证输入是否是正整数
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

// 根据敌人类型获取OCR关键词
function getOcrKeywords(enemyType) {
    if (enemyType === "愚人众") {
        return ["买卖", "不成", "正义存", "愚人众", "禁止", "危险", "运输", "打倒", "盗宝团"];
    }
    else if (enemyType === "盗宝团") {
        return ["岛上", "无贼", "消灭", "鬼鬼祟祟", "盗宝团"];
    }
}

// 根据敌人类型获取目标战斗点坐标
function getTargetCoordinates(enemyType) {
    if (enemyType === "愚人众") {
        // 愚人众战斗点坐标（需要根据实际位置调整）
        return { x: 4840.55, y: -3078.01 }; // 这里需要替换为实际的愚人众战斗点坐标
    } else {
        // 盗宝团战斗点坐标
        return { x: -2757.281, y: -3468.437 };
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
            let result = captureGameRegion().find(RecognitionObject.ocr(850, 150, 200, 80));
            let result2 = captureGameRegion().find(RecognitionObject.ocr(0, 200, 300, 300));
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
    throw new Error("战斗超时，未检测到结果");
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

