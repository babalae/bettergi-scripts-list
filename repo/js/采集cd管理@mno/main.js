// 定义目标文件夹路径和记录文件路径
const recordFolder = "record"; // 存储记录文件的文件夹路径
const timestamp = "::2000-01-01T00:00:00.000Z"; // 固定的时间戳

// 从 settings 中读取用户配置，并设置默认值
const userSettings = {
    operationMode: settings.operationMode || "执行任务（若不存在索引文件则自动创建）",
    pathGroup1CdType: settings.pathGroup1CdType || "",
    pathGroup2CdType: settings.pathGroup2CdType || "",
    pathGroup3CdType: settings.pathGroup3CdType || "",
    otherPathGroupsCdTypes: settings.otherPathGroupsCdTypes || "",
    partyNames: settings.partyNames || "",
    skipTimeRanges: settings.skipTimeRanges || "",
    infoFileName: settings.infoFileName || ""
};

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
        userSettings.partyNames,
        userSettings.skipTimeRanges
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

        // 根据用户配置选择操作模式
        if (userSettings.operationMode === "重新生成索引文件（用于强制刷新CD或更新文件）" || !indexDoExist) {
            if (userSettings.operationMode === "重新生成索引文件（用于强制刷新CD或更新文件）") {
                log.info("重新生成索引文件模式，将覆盖现有索引文件");
            } else {
                log.info("路径组1.txt 文件不存在，将生成文件");
            }

            // 循环处理多个路径组
            for (let i = 1; ; i++) {
                const targetFolder = `pathing/路径组${i}`; // 动态生成目标文件夹路径
                const filePaths = file.ReadPathSync(targetFolder);

                // 检查当前路径组的 cdtype 是否为空
                const currentCdType = pathGroupCdType[i - 1] || "";
                if (!currentCdType) {
                    log.info(`路径组${i} 的 cdtype 为空，停止处理`);
                    break;
                }

                // 如果文件夹为空，退出循环
                if (filePaths.length === 0) {
                    log.info(`路径组${i} 文件夹为空，停止处理`);
                    break;
                }

                // 用于存储符合条件的文件名的数组
                const jsonFileNames = [];

                // 遍历文件路径数组并提取文件名
                for (const filePath of filePaths) {
                    const fileName = basename(filePath); // 提取文件名
                    if (fileName.endsWith('.json')) { // 检查文件名是否以 .json 结尾
                        const fileNameWithoutSuffix = removeJsonSuffix(fileName); // 移除 .json 后缀
                        jsonFileNames.push(`${fileNameWithoutSuffix}${timestamp}`); // 添加时间戳并存储
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
            }
        } else {
            // 如果用户选择的不是“重新生成索引文件”且文件已存在，则输出特定日志信息
            log.debug("奶龙");
        }

        // 新增逻辑：当选择“执行任务（若不存在索引文件则自动创建）”时，执行类似路径执行的逻辑
if (userSettings.operationMode === "执行任务（若不存在索引文件则自动创建）") {
             log.info("启用自动拾取的实时任务");
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
     // 获取子文件夹内的所有文件路径
    const recordFiles = file.ReadPathSync(subFolderPath);
    // 直接获取文件数量作为路径组数量
    const totalPathGroups = recordFiles.length;

    // 外层循环：依次处理每个路径组
    for (let groupNumber = 1; groupNumber <= totalPathGroups; groupNumber++) {
        const pathGroupFilePath = `${subFolderPath}/路径组${groupNumber}.txt`; // 动态生成路径组文件路径

genshin.returnMainUi();

//切换到指定配队
 if   (partyNamesArray[groupNumber - 1] !== "") {
await genshin.switchParty(partyNamesArray[groupNumber - 1])
}

genshin.returnMainUi();
        
try {
            let pathGroupContent = await file.readText(pathGroupFilePath);
            let pathGroupEntries = pathGroupContent.trim().split('\n');
            for (let i = 0; i < pathGroupEntries.length; i++) {
                const entryWithTimestamp = pathGroupEntries[i].trim();
                const [entryName, entryTimestamp] = entryWithTimestamp.split('::');

                // 构造路径文件路径
                const pathingFilePath = `pathing/路径组${groupNumber}/${entryName}.json`;

                // 获取开始时间
                const startTime = new Date();

                // 比较当前时间戳与任务的时间戳
                const entryDate = new Date(entryTimestamp);
                if (startTime <= entryDate) {
                    log.info(`当前任务 ${entryName} 未刷新，跳过任务 ${i + 1}/${pathGroupEntries.length} 个`);
                    continue; // 跳过当前任务
                }

                // 新增校验：若当前时间的小时数和 skipTimeRanges 一致，则跳过任务
                const currentHour = startTime.getHours(); // 获取当前时间的小时数
                const skipHours = userSettings.skipTimeRanges.split(';').map(Number); // 将 skipTimeRanges 转换为数字数组
                if (skipHours.includes(currentHour)) {
                    log.info(`当前时间的小时数为 ${currentHour}，在跳过时间范围内，跳过任务 ${entryName}`);
                    continue; // 跳过当前任务
                }

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

                // 获取结束时间
                const endTime = new Date();

                // 比较开始时间与结束时间
                const timeDiff = endTime.getTime() - startTime.getTime(); // 时间差（毫秒）
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
log.info(`本任务执行大于10秒，cd信息已更新，下一次可用时间为 ${nextAvailableTime}`);
                }
            }
            log.info(`路径组${groupNumber} 的所有任务运行完成`);
        } catch (error) {
            log.error(`读取路径组文件 ${pathGroupFilePath} 时出错: ${error}`);
        }
    }
    log.info('所有路径组的任务运行完成');
}
    } catch (error) {
        log.error(`操作失败: ${error}`);
    }
})();
