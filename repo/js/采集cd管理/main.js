
/* ===== 强制模板匹配拾取（BEGIN） ===== */
let targetItems = [];
let blacklist = [];
let blacklistSet = new Set();
let gameRegion;
let state = { running: true, currentPathing: null };
const rollingDelay = 25;
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
        }
    );

    /* 5.4 路径组节点（整体移到最后） */
    for (let g = 1; g <= groupCount; g++) {
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

        /* 文件夹 */
        newSettings.push({
            name: `pathGroup${g}FolderName`,
            type: "select",
            label: `选择路径组${g}文件夹（pathing下第一层）`,
            options: ["", ...uniqueDirs]
        });

        /* 队伍名 */
        newSettings.push({
            name: `pathGroup${g}PartyName`,
            type: "input-text",
            label: `输入路径组${g}使用配队名称`
        });
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
        const subFolderName = userSettings.infoFileName; // 使用设置后的 infoFileName
        const subFolderPath = `${recordFolder}/${subFolderName}`;

        // 读取子文件夹中的所有文件路径
        const filesInSubFolder = file.ReadPathSync(subFolderPath);

        // 检查record.txt文件是否存在
        let indexDoExist = false;
        for (const filePath of filesInSubFolder) {
            const fileName = basename(filePath); // 提取文件名
            if (fileName === "record.txt") {
                indexDoExist = true;
                break;
            }
        }

        if (userSettings.operationMode === "重新生成索引文件（用于强制刷新CD）") {
            log.info("重新生成索引文件模式，将覆盖现有索引文件");
        }
        if (!indexDoExist) {
            log.info("record.txt 文件不存在，将尝试生成索引文件");
        }
        /* 禁用BGI原生拾取，强制模板匹配 */
        targetItems = await loadTargetItems();
        await loadBlacklist(true);
        state.running = true;

        await fakeLog("采集cd管理", true, false, 1000);

        // 统一的 record.txt 文件路径
        const recordFilePath = `${subFolderPath}/record.txt`;

        // 读取 pathing 文件夹下的所有 .json 文件
        const pathingFolder = "pathing";
        const files = await readFolder(pathingFolder, true);
        const filePaths = files.map(file => file.fullPath);

        // 用于存储符合条件的文件名的数组
        const jsonFileNames = [];
        const entryMap = {};

        // 如果 record.txt 文件存在，则读取对应的原文件
        if (indexDoExist) {
            let pathGroupContent = await file.readText(recordFilePath);
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
            log.info(`未找到符合条件的 .json 文件，record.txt 将为空`);
        }

        // 将文件名数组转换为字符串，每个文件名占一行
        const fileNamesContent = jsonFileNames.join("\n");

        // 将文件名写入记录文件
        const writeResult = file.writeTextSync(recordFilePath, fileNamesContent);

        if (writeResult) {
            log.info(`文件名已成功写入: ${recordFilePath}`);
        } else {
            log.error(`写入文件失败: ${recordFilePath}`);
        }

        {

            // 循环处理多个路径组
            for (let i = 1; i <= groupCount; i++) {
                const currentCdType = settings[`pathGroup${i}CdType`] || "";
                if (!currentCdType) continue; // 跳过本组

                const folder = folderNames[i - 1] || `路径组${i}`;
                const targetFolder = `pathing/${folder}`;

                // 读取统一的 record.txt 文件内容
                let recordContent = await file.readText(recordFilePath);
                let recordEntries = recordContent.trim().split('\n');

                // 创建一个对象来存储 entryName 和 entryTimestamp 的映射
                const entryMap = {};
                for (let j = 0; j < recordEntries.length; j++) {
                    const entryWithTimestamp = recordEntries[j].trim();
                    const [entryName, entryTimestamp] = entryWithTimestamp.split('::');
                    entryMap[entryName] = entryTimestamp;
                }

                // 读取路径组文件夹中的任务文件
                const files = await readFolder(targetFolder, true);

                if (userSettings.operationMode === "执行任务（若不存在索引文件则自动创建）") {
                    let groupNumber = i;
                    await genshin.returnMainUi();

                    try {
                        const filePaths = files.map(file => file.fullPath);

                        // 读取 record.txt 文件内容
                        let recordContent = await file.readText(recordFilePath);
                        let recordEntries = recordContent.trim().split('\n');
                        let changedParty = false;

                        for (const filePath of filePaths) {
                            const fileName = basename(filePath).replace('.json', '');
                            const entry = recordEntries.find(e => e.startsWith(`${fileName}::`));
                            const entryTimestamp = entry ? entry.split('::')[1] : null;
                            const entryDate = entryTimestamp ? new Date(entryTimestamp) : new Date(0); // 未记录的任务视为已刷新

                            const startTime = new Date();
                            if (startTime <= entryDate) {
                                log.info(`当前任务 ${fileName} 未刷新，跳过任务`);
                                continue; // 跳过当前任务
                            }

                            if (await isTimeRestricted(settings.timeRule, 10)) {
                                break;
                            }

                            let doSkip = false;
                            for (const keyword of disableArray) {
                                if (filePath.includes(keyword)) {
                                    log.info(`路径文件 ${filePath} 包含禁用关键词 "${keyword}"，跳过任务 ${fileName}`);
                                    doSkip = true;
                                    break;
                                }
                            }
                            if (doSkip) continue;

                            // 切换到指定配队
                            if (!changedParty) {
                                await switchPartyIfNeeded(partyNames[groupNumber - 1]);
                                changedParty = true;
                            }
                            // 伪造地图追踪开始的日志
                            await fakeLog(fileName, false, true, 0);

                            /* 并发拾取：与路线任务同生命周期 */
                            state.currentPathing = { items: [] };
                            state.running = true;
                            const pickupTask = recognizeAndInteract(); // 直接并发，无需包裹函数

                            // 日志输出当前任务信息
                            log.info(`当前进度：路径组${i} ${folder} ${fileName} 为第 ${filePaths.indexOf(filePath) + 1}/${filePaths.length} 个`);

                            // 执行路径文件
                            try {
                                await pathingScript.runFile(filePath);
                                log.info(`执行任务: ${fileName}`);
                            } catch (error) {
                                log.error(`路径文件 ${filePath} 不存在或执行失败: ${error}`);
                                continue; // 跳过当前任务
                            }

                            // 捕获任务取消的信息并跳出循环
                            try {
                                await sleep(1);
                            } catch (error) {
                                log.error(`发生错误: ${error}`);
                                break; // 终止循环
                            }

                            // 获取结束时间
                            const endTime = new Date();

                            // 比较开始时间与结束时间
                            const timeDiff = endTime.getTime() - startTime.getTime(); // 时间差（毫秒）

                            // 伪造地图追踪结束的日志
                            await fakeLog(fileName, false, false, timeDiff);
                            state.running = false; // 停止拾取
                            await pickupTask;      // 等待拾取线程结束

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
                                        break;

                                    case "2次0点刷新":
                                        // 将任务文件中对应的时间戳改为下下个0点
                                        const dayAfterTomorrow = new Date(startTime.getTime() + 48 * 60 * 60 * 1000);
                                        dayAfterTomorrow.setHours(0, 0, 0, 0); // 设置为下下个0点
                                        newTimestamp = dayAfterTomorrow.toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        break;

                                    case "3次0点刷新":
                                        // 将任务文件中对应的时间戳改为下下下个0点
                                        const twoDaysAfterTomorrow = new Date(startTime.getTime() + 72 * 60 * 60 * 1000);
                                        twoDaysAfterTomorrow.setHours(0, 0, 0, 0); // 设置为下下下个0点
                                        newTimestamp = twoDaysAfterTomorrow.toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
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
                                        break;

                                    case "12小时刷新":
                                        // 将任务文件中对应的时间戳改为开始时间后12小时0分0秒
                                        newTimestamp = new Date(startTime.getTime() + 12 * 60 * 60 * 1000).toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        break;

                                    case "24小时刷新":
                                        // 将任务文件中对应的时间戳改为开始时间后24小时0分0秒
                                        newTimestamp = new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        break;

                                    case "46小时刷新":
                                        // 将任务文件中对应的时间戳改为开始时间后46小时0分0秒
                                        newTimestamp = new Date(startTime.getTime() + 46 * 60 * 60 * 1000).toISOString();
                                        nextAvailableTime = new Date(newTimestamp).toLocaleString(); // 转换为本地时间格式
                                        break;

                                    default:
                                        log.warn(`路径组${groupNumber} 的 cdtype 是 ${currentCdType}，执行默认操作`);
                                        // 默认操作：将下一个可用时间设置为开始时间
                                        newTimestamp = startTime.toISOString();
                                        nextAvailableTime = startTime.toLocaleString(); // 转换为本地时间格式
                                        break;
                                }

                                // 更新任务文件中的时间戳
                                const updatedEntry = `${fileName}::${newTimestamp}`;
                                if (entry) {
                                    recordEntries[recordEntries.indexOf(entry)] = updatedEntry;
                                } else {
                                    recordEntries.push(updatedEntry);
                                }

                                // 写回 record.txt
                                const updatedRecordContent = recordEntries.join('\n');
                                await file.writeText(recordFilePath, updatedRecordContent);
                                log.info(`本任务执行大于3秒，cd信息已更新，下一次可用时间为 ${nextAvailableTime}`);
                            }
                        }
                        log.info(`路径组${groupNumber} 的所有任务运行完成`);
                    } catch (error) {
                        log.error(`读取路径组文件时出错: ${error}`);
                    }
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
    while (state.running) {
        gameRegion.dispose();
        gameRegion = captureGameRegion();
        if (++blacklistCounter % 33 === 0) {
            await checkItemFullAndOCR();
        }
        const centerYF = await findFIcon();
        if (!centerYF) {
            if (await isMainUI()) {
                await keyMouseScript.runFile(`assets/滚轮下翻.json`);
            }
            continue;
        }
        let itemName = null;
        itemName = await performTemplateMatch(centerYF);
        if (itemName) {
            if (Math.abs(lastcenterYF - centerYF) <= 20 && lastItemName === itemName) {
                await sleep(160);
                lastcenterYF = -20;
                lastItemName = null;
                continue;
            }
            if (!blacklistSet.has(itemName)) {
                keyPress("F");
                log.info(`交互或拾取："${itemName}"`);
                if (state.currentPathing) {
                    state.currentPathing.items.push(itemName);
                    state.currentPathing.items = [...new Set(state.currentPathing.items)].slice(-20);
                }
                lastcenterYF = centerYF;
                lastItemName = itemName;
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
    }
}

async function findFIcon() {
    const roi = RecognitionObject.TemplateMatch(fIcontemplate, 1102, 335, 34, 400);
    roi.Threshold = 0.95;
    roi.InitTemplate();
    try {
        const r = gameRegion.find(roi);
        if (r.isExist()) return Math.round(r.y + r.height / 2);

    } catch (e) {
        log.error(`findFIcon:${e.message}`);
    }
    await sleep(50);
    return null;
}

async function performTemplateMatch(centerYF) {
    try {
        for (const it of targetItems) {
            const cnLen = Math.min([...it.itemName].filter(c => c >= '\u4e00' && c <= '\u9fff').length, 5);
            const roi = RecognitionObject.TemplateMatch(it.template, 1219, centerYF - 15, 12 + 28 * cnLen + 2, 30);
            roi.Threshold = it.Threshold;
            roi.InitTemplate();
            if (gameRegion.find(roi).isExist()) {
                return it.itemName;
            }
        }
    } catch (e) {
        log.error(`performTemplateMatch:${e.message}`);
    }
    return null;
}

async function isMainUI() {
    const roi = RecognitionObject.TemplateMatch(mainUITemplate, 0, 0, 150, 150);
    for (let i = 0; i < 1 && state.running; i++) {
        if (!gameRegion) gameRegion = captureGameRegion();
        try {
            if (gameRegion.find(roi).isExist()) {
                return true;
            }
        } catch (e) {
            log.error(`isMainUI:${e.message}`);
        }
        await sleep(50);
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
        const ratio = calcMatchRatio(it.itemName.replace(/[^\u4e00-\u9fa5]/g, ''), ocrText);
        if (ratio > 0.75) {
            ratioMap.set(it.itemName, ratio);
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
    let targetItemPath;

    targetItemPath = "assets/targetItems/";

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
