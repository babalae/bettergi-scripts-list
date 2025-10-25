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
    infoFileName: settings.infoFileName || "",
    disableJsons: settings.disableJsons || ""
};

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

async function readFolder(folderPath, onlyJson) {
    log.info(`开始读取文件夹：${folderPath}`);

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

(async function () {
    try {
        // 获取子文件夹路径
        const subFolderName = userSettings.infoFileName; // 使用设置后的 infoFileName
        const subFolderPath = `${recordFolder}/${subFolderName}`;

        // 读取子文件夹中的所有文件路径
        const filesInSubFolder = file.ReadPathSync(subFolderPath);

        // 检查路径组1.txt文件是否存在
        let indexDoExist = false;
        for (const filePath of filesInSubFolder) {
            const fileName = basename(filePath); // 提取文件名
            if (fileName === "路径组1.txt") {
                indexDoExist = true;
                break;
            }
        }
        log.debug(`路径组1.txt 是否存在: ${indexDoExist}`);

        {
            if (userSettings.operationMode === "重新生成索引文件（用于强制刷新CD）") {
                log.info("重新生成索引文件模式，将覆盖现有索引文件");
            }
            if (!indexDoExist) {
                log.info("路径组1.txt 文件不存在，将尝试生成索引文件");
            }
            dispatcher.addTimer(new RealtimeTimer("AutoPick"));
            await fakeLog("采集cd管理", true, false, 1000);
            // 循环处理多个路径组
            for (let i = 1; ; i++) {
                // 检查当前路径组的 cdtype 是否为空
                const currentCdType = pathGroupCdType[i - 1] || "";
                if (!currentCdType) {
                    log.info(`路径组${i} 的 cdtype 为空，停止处理`);
                    break;
                }

                const targetFolder = `pathing/路径组${i}`; // 动态生成目标文件夹路径
                const files = await readFolder(targetFolder, true);
                const filePaths = files.map(file => file.fullPath);
                // 如果文件夹为空，退出循环
                if (filePaths.length === 0) {
                    log.info(`路径组${i} 文件夹为空，停止处理`);
                    break;
                }
                // 用于存储符合条件的文件名的数组
                const jsonFileNames = [];
                const entryMap = {};
                // 如果 indexDoExist 为 true，则读取对应的原文件
                if (indexDoExist) {
                    const pathGroupFilePath = `${subFolderPath}/路径组${i}.txt`; // 使用外层循环的变量 i
                    let pathGroupContent = await file.readText(pathGroupFilePath);
                    let pathGroupEntries = pathGroupContent.trim().split('\n');

                    // 创建一个对象来存储 entryName 和 entryTimestamp 的映射
                    for (let j = 0; j < pathGroupEntries.length; j++) {
                        const entryWithTimestamp = pathGroupEntries[j].trim();
                        const [entryName, entryTimestamp] = entryWithTimestamp.split('::');
                        entryMap[entryName] = entryTimestamp;
                    }
                }

                // 遍历文件路径数组并提取文件名
                for (const filePath of filePaths) {
                    const fileName = basename(filePath); // 提取文件名
                    if (fileName.endsWith('.json')) { // 检查文件名是否以 .json 结尾
                        const fileNameWithoutSuffix = removeJsonSuffix(fileName); // 移除 .json 后缀

                        // 给 routeTimeStamp 赋值为 defaultTimeStamp
                        let routeTimeStamp = defaultTimeStamp;

                        if (indexDoExist && userSettings.operationMode !== "重新生成索引文件（用于强制刷新CD）" && entryMap[fileNameWithoutSuffix]) {
                            routeTimeStamp = entryMap[fileNameWithoutSuffix];
                        }

                        routeTimeStamp = `::${routeTimeStamp}`;
                        // 添加时间戳并存储
                        jsonFileNames.push(`${fileNameWithoutSuffix}${routeTimeStamp}`);
                    }
                }

                // 如果没有找到符合条件的文件，跳过当前路径组
                if (jsonFileNames.length === 0) {
                    //log.info(`路径组${i} 中未找到符合条件的 .json 文件，跳过`);
                    continue;
                }

                // 将文件名数组转换为字符串，每个文件名占一行
                const fileNamesContent = jsonFileNames.join("\n");

                // 定义记录文件的完整路径
                const recordFilePath = `${subFolderPath}/路径组${i}.txt`;

                // 将文件名写入记录文件
                const writeResult = file.writeTextSync(recordFilePath, fileNamesContent);

                if (writeResult) {
                    log.info(`文件名已成功写入: ${recordFilePath}`);
                } else {
                    log.error(`写入文件失败: ${recordFilePath}`);
                }
                //当选择“执行任务（若不存在索引文件则自动创建）”时，执行类似路径执行的逻辑
                if (userSettings.operationMode === "执行任务（若不存在索引文件则自动创建）") {
                    log.info("启用自动拾取的实时任务");

                    let groupNumber = i;
                    const pathGroupFilePath = `${subFolderPath}/路径组${groupNumber}.txt`; // 动态生成路径组文件路径

                    await genshin.returnMainUi();

                    try {
                        let pathGroupContent = await file.readText(pathGroupFilePath);
                        let pathGroupEntries = pathGroupContent.trim().split('\n');
                        let changedParty = false;
                        for (let i = 0; i < pathGroupEntries.length; i++) {
                            const entryWithTimestamp = pathGroupEntries[i].trim();
                            const [entryName, entryTimestamp] = entryWithTimestamp.split('::');

                            // 查找对应的完整路径
                            const fileEntry = files.find(file => file.fileName === `${entryName}.json`);
                            const pathingFilePath = fileEntry.fullPath;

                            // 获取开始时间
                            const startTime = new Date();

                            // 比较当前时间戳与任务的时间戳
                            const entryDate = new Date(entryTimestamp);
                            if (startTime <= entryDate) {
                                log.info(`当前任务 ${entryName} 未刷新，跳过任务 ${i + 1}/${pathGroupEntries.length} 个`);
                                continue; // 跳过当前任务
                            }

                            // 新增校验：若当前时间的小时数和 skipTimeRanges 一致，则跳过任务
                            let currentHour = startTime.getHours(); // 获取当前时间的小时数
                            const currentMin = startTime.getMinutes(); // 获取当前分钟数
                            const skipHours = userSettings.skipTimeRanges.split(';').map(Number); // 将 skipTimeRanges 转换为数字数组

                            // 10分钟内等待逻辑
                            const nextHour = (currentHour + 1) % 24;
                            if (skipHours.includes(nextHour) && currentMin >= 50) {
                                const waitMin = 60 - currentMin;
                                log.info(`接近目标时间，开始等待${waitMin}分钟`);
                                await sleep(waitMin * 60 * 1000);
                                currentHour = nextHour;
                                break; // 只等待一次
                            }

                            // 原跳过判断
                            if (skipHours.includes(currentHour)) {
                                log.info(`当前时间的小时数为 ${currentHour}，在跳过时间范围内，跳过任务 ${i + 1}/${pathGroupEntries.length} 个`);
                                await sleep(10);
                                break; // 跳过当前任务
                            }

                            let doSkip = false;

                            // 禁用名单跳过（includes 子串匹配）
                            for (k = 0; k < disableArray.length; k++) {
                                if (pathingFilePath.includes(disableArray[k])) {
                                    log.info('路径文件 ' + pathingFilePath + ' 包含禁用关键词 "' + disableArray[k] + '"，跳过任务 ' + entryName);
                                    doSkip = true;   // 立即进入下一轮任务
                                    break;
                                }
                            }

                            if (doSkip) continue;

                            //切换到指定配队
                            if (!changedParty) {
                                if (partyNamesArray[groupNumber - 1] !== "") {
                                    await switchPartyIfNeeded(partyNamesArray[groupNumber - 1]);
                                }
                                changedParty = true;
                            }
                            //伪造地图追踪开始的日志
                            await fakeLog(entryName, false, true, 0);

                            // 日志输出当前任务信息
                            log.info(`当前任务 ${entryName} 为第 ${i + 1}/${pathGroupEntries.length} 个`);

                            // 执行路径文件
                            try {
                                await pathingScript.runFile(pathingFilePath);
                                log.info(`执行任务: ${entryName}`);
                            } catch (error) {
                                log.error(`路径文件 ${pathingFilePath} 不存在或执行失败: ${error}`);
                                continue; // 跳过当前任务
                            }

                            //捕获任务取消的信息并跳出循环
                            try {
                                await sleep(1); // 假设 sleep 是一个异步函数，休眠 1 毫秒
                            } catch (error) {
                                log.error(`发生错误: ${error}`);
                                break; // 终止循环
                            }

                            // 获取结束时间
                            const endTime = new Date();

                            // 比较开始时间与结束时间
                            const timeDiff = endTime.getTime() - startTime.getTime(); // 时间差（毫秒）

                            //伪造地图追踪结束的日志
                            await fakeLog(entryName, false, false, timeDiff);

                            if (timeDiff > 3000) { // 时间差大于3秒
                                // 获取当前路径组的 cdtype
                                const currentCdType = pathGroupCdType[groupNumber - 1] || "未知类型";

                                // 初始化 newTimestamp 和 nextAvailableTime
                                let newTimestamp;
                                let nextAvailableTime;

                                // 根据 cdtype 执行不同的操作
                                switch (currentCdType) {
                                    case "1次0点刷新":
                                        // 将任务文件中对应的时间戳改为下一个0点
                                        const tomorrow = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
                                        tomorrow.setHours(0, 0, 0, 0); // 设置为下一个0点
                                        newTimestamp = tomorrow.toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        //log.info(`下一次可用时间为 ${nextAvailableTime}`);
                                        break;

                                    case "2次0点刷新":
                                        // 将任务文件中对应的时间戳改为下下个0点
                                        const dayAfterTomorrow = new Date(startTime.getTime() + 48 * 60 * 60 * 1000);
                                        dayAfterTomorrow.setHours(0, 0, 0, 0); // 设置为下下个0点
                                        newTimestamp = dayAfterTomorrow.toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        //log.info(`下一次可用时间为 ${nextAvailableTime}`);
                                        break;

                                    case "3次0点刷新":
                                        // 将任务文件中对应的时间戳改为下下下个0点
                                        const twoDaysAfterTomorrow = new Date(startTime.getTime() + 72 * 60 * 60 * 1000);
                                        twoDaysAfterTomorrow.setHours(0, 0, 0, 0); // 设置为下下下个0点
                                        newTimestamp = twoDaysAfterTomorrow.toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        //log.info(`下一次可用时间为 ${nextAvailableTime}`);
                                        break;

                                    case "4点刷新":
                                        // 将任务文件中对应的时间戳改为下一个4点
                                        const next4AM = new Date(startTime.getTime());
                                        next4AM.setHours(4, 0, 0, 0); // 设置为当天的4点
                                        if (next4AM <= startTime) {
                                            next4AM.setDate(next4AM.getDate() + 1); // 如果当前时间已过4点，则设置为下一天的4点
                                        }
                                        newTimestamp = next4AM.toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        //log.info(`下一次可用时间为 ${nextAvailableTime}`);
                                        break;

                                    case "12小时刷新":
                                        // 将任务文件中对应的时间戳改为开始时间后12小时0分0秒
                                        newTimestamp = new Date(startTime.getTime() + 12 * 60 * 60 * 1000).toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        //log.info(`下一次可用时间为 ${nextAvailableTime}`);
                                        break;

                                    case "24小时刷新":
                                        // 将任务文件中对应的时间戳改为开始时间后24小时0分0秒
                                        newTimestamp = new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        //log.info(`下一次可用时间为 ${nextAvailableTime}`);
                                        break;

                                    case "46小时刷新":
                                        // 将任务文件中对应的时间戳改为开始时间后46小时0分0秒
                                        newTimestamp = new Date(startTime.getTime() + 46 * 60 * 60 * 1000).toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        //log.info(`下一次可用时间为 ${nextAvailableTime}`);
                                        break;

                                    default:
                                        log.warn(`路径组${groupNumber} 的 cdtype 是 ${currentCdType}，执行默认操作`);
                                        // 默认操作：将下一个可用时间设置为开始时间
                                        newTimestamp = startTime.toISOString();
                                        nextAvailableTime = startTime.toLocaleString(); // 转换为本地时间格式
                                        break;
                                }

                                // 更新任务文件中的时间戳
                                // 首先根据newTimestamp修改pathGroupEntries中对应项
                                pathGroupEntries = pathGroupEntries.map(entry => {
                                    const [name, timestamp] = entry.split('::');
                                    if (name === entryName) {
                                        return `${name}::${newTimestamp}`;
                                    }
                                    return entry;
                                });

                                // 然后根据pathGroupEntries修改pathGroupContent
                                pathGroupContent = pathGroupEntries.join('\n');

                                // 最后将pathGroupContent写回原文件
                                await file.writeText(pathGroupFilePath, pathGroupContent);
                                log.info(`本任务执行大于3秒，cd信息已更新，下一次可用时间为 ${nextAvailableTime}`);
                            }
                        }
                        log.info(`路径组${groupNumber} 的所有任务运行完成`);
                    } catch (error) {
                        log.error(`读取路径组文件 ${pathGroupFilePath} 时出错: ${error}`);
                    }
                }
            }
        }

    } catch (error) {
        log.error(`操作失败: ${error}`);
    }

    //伪造js开始的日志
    await fakeLog("采集cd管路", true, true, 0);
})();
