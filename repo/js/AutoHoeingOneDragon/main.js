//拾取时上下滑动的时间
const timeMoveUp = 500;
const timeMoveDown = 1000;
const pickupMode = settings.pickupMode || "js拾取，默认只拾取狗粮和晶蝶";
if (settings.activeDumperMode) { //处理泥头车信息
    dumpers = settings.activeDumperMode.split('，').map(Number).filter(num => num === 1 || num === 2 || num === 3 || num === 4);
} else {
    dumpers = [];
}

(async function () {
    //自定义配置处理
    const operationMode = settings.operationMode || "运行锄地路线";
    let k = settings.efficiencyIndex || 0.5;
    k = k;
    let targetEliteNum = (+settings.targetEliteNum || 400);
    targetEliteNum += 5;//预留漏怪
    let targetMonsterNum = (+settings.targetMonsterNum + 1 || 2000);
    targetMonsterNum += 25;//预留漏怪
    const partyName = settings.partyName || "";

    // 获取 settings 中的标签，如果没有则使用默认值
    const group1Settings = settings.tagsForGroup1 || "蕈兽";
    const group2Settings = settings.tagsForGroup2 || "";
    const group3Settings = settings.tagsForGroup3 || "";
    const group4Settings = settings.tagsForGroup4 || "";
    let group1Tags = group1Settings.split("，").filter(Boolean);
    const group2Tags = group2Settings.split("，").filter(Boolean);
    const group3Tags = group3Settings.split("，").filter(Boolean);
    const group4Tags = group4Settings.split("，").filter(Boolean);
    // 将 group2Tags、group3Tags 和 group4Tags 的内容添加到 group1Tags 中，并去除重复项
    group1Tags = [...new Set([...group1Tags, ...group2Tags, ...group3Tags, ...group4Tags])];

    const priorityTags = (settings.priorityTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);
    const excludeTags = (settings.excludeTags || "").split("，").map(tag => tag.trim()).filter(tag => tag.length > 0);
    const accountName = settings.accountName || "默认账户";
    // 拾取黑白名单处理
    const ocrPickupContent = await file.readText("assets/拾取名单.json");
    const ocrPickupJson = JSON.parse(ocrPickupContent);
    const whitelistKeywords = ocrPickupJson["白名单"];
    const blacklistKeywords = ocrPickupJson["黑名单"];

    if (!settings.accountName) {
        for (let i = 0; i < 120; i++) {
            // 原始文本
            let originalMessage = "   请先阅读js文件夹中的【README.md】后使用";
            // 计算轮替的偏移量，每次循环偏移一位
            let offset = i % originalMessage.length; // 每次循环偏移一位
            // 构造轮替后的文本
            let message = originalMessage.slice(-offset) + originalMessage.slice(0, -offset);
            // 输出内容
            log.error(message);
            await sleep(500);
        }
    }

    //预处理路线并建立对象
    pathings = await processPathings();
    //优先使用index中的数据
    await updatePathings("assets/index1.json");
    await updatePathings("assets/index2.json");

    //加载路线cd信息
    await initializeCdTime(pathings, accountName);

    //按照用户配置标记路线
    await markPathings(pathings, group1Tags, group2Tags, group3Tags, group4Tags, priorityTags, excludeTags);

    //找出最优组合
    await findBestRouteGroups(pathings, k, targetEliteNum, targetMonsterNum);

    //分配到不同路径组
    await assignGroups(pathings, group1Tags, group2Tags, group3Tags, group4Tags);
    /*
        //分配结果输出
        pathings.forEach((pathing, index) => {
            log.info(`路径 ${index + 1}:`);
            log.info(`  fullPath: ${pathing.fullPath}`);
            log.info(`  fileName: ${pathing.fileName}`);
            log.info(`  group: ${pathing.group}`);
            log.info(`  cdTime: ${pathing.cdTime}`);
            log.info(`  tags: ${pathing.tags.join(', ')}`);
            log.info(`  available: ${pathing.available}`);
            log.info(`  selected: ${pathing.selected}`);
            log.info(`  预计用时: ${pathing.t} 秒`);
            log.info(`  普通怪物数量: ${pathing.m}`);
            log.info(`  精英怪物数量: ${pathing.e}`);
            log.info(`  普通怪物摩拉值: ${pathing.mora_m}`);
            log.info(`  精英怪物摩拉值: ${pathing.mora_e}`);
            log.info(`  是否使用index数据: ${pathing.usingIndex}`);
            log.info(''); // 空行分隔每个路径的信息
        });
    */
    //根据操作模式选择不同的处理方式
    if (operationMode === "输出地图追踪文件") {
        log.info("开始复制并输出地图追踪文件\n请前往js文件夹查看");
        await copyPathingsByGroup(pathings);
    } else if (operationMode === "运行锄地路线") {
        await switchPartyIfNeeded(partyName)
        log.info("开始运行锄地路线");
        await processPathingsByGroup(pathings, whitelistKeywords, blacklistKeywords, accountName);
    } else {
        log.info("强制刷新所有路线CD");
        await initializeCdTime(pathings, "");
        await updateCdTimeRecord(pathings, accountName);
    }
})();

//预处理路线，建立对象
async function processPathings() {
    // 读取怪物信息
    const monsterInfoContent = await file.readText("assets/monsterInfo.json");
    const monsterInfoObject = JSON.parse(monsterInfoContent);

    // 读取路径文件夹中的所有文件
    let pathings = await readFolder("pathing", true);

    // 定义解析 description 的函数
    function parseDescription(desc) {
        const routeInfo = {
            time: 60, // 预计用时初始化为60秒
            monsterInfo: {}
        };

        // 正则表达式匹配预计用时
        const timeMatch = desc.match(/预计用时([\d\.]+)秒/);
        if (timeMatch) {
            routeInfo.time = parseFloat(timeMatch[1]);
        }

        // 正则表达式匹配怪物信息
        const monsterMatch = desc.match(/包含以下怪物：(.*?)。/);
        if (monsterMatch) {
            const monsterList = monsterMatch[1].split('、');
            monsterList.forEach(monsterStr => {
                const [countStr, monsterName] = monsterStr.split('只');
                const count = parseInt(countStr.trim(), 10);
                routeInfo.monsterInfo[monsterName.trim()] = count;
            });
        }

        return routeInfo;
    }
    let index = 0
    // 遍历每个路径文件并处理
    for (const pathing of pathings) {
        pathing.usingIndex = false;
        index++;
        pathing.index = index;
        const pathingContent = await file.readText(pathing.fullPath);
        const parsedContent = JSON.parse(pathingContent);
        const description = parsedContent.info?.description || "";
        pathing.description = description;
        pathing.tags = parsedContent.info?.tags || [];

        // 解析 description 获取预计用时和怪物信息
        const routeInfo = parseDescription(description);

        // 初始化 pathing 对象的属性
        pathing.t = routeInfo.time; // 预计用时初始化为60秒，如果 description 中有值则覆盖
        pathing.m = 0; // 普通怪物数量
        pathing.e = 0; // 精英怪物数量
        pathing.mora_m = 0; // 普通怪物摩拉值
        pathing.mora_e = 0; // 精英怪物摩拉值

        // 处理怪物信息
        for (const [monsterName, count] of Object.entries(routeInfo.monsterInfo)) {
            const monster = monsterInfoObject.find(m => m.name === monsterName);

            if (monster) {
                if (monster.type === "普通") {
                    pathing.m += count; // 增加普通怪物数量
                    pathing.mora_m += count * 40.5 * monster.moraRate; // 增加普通怪物摩拉值
                } else if (monster.type === "精英") {
                    pathing.e += count; // 增加精英怪物数量
                    pathing.mora_e += count * 200 * monster.moraRate; // 增加精英怪物摩拉值
                }

                // 添加标签
                if (monster.tags && monster.tags.length > 0) {
                    pathing.tags.push(...monster.tags);
                }
            }
        }

        // 去除重复标签
        pathing.tags = [...new Set(pathing.tags)];
        // 处理 map_name 属性
        pathing.map_name = parsedContent.info?.map_name || "Teyvat"; // 如果有 map_name，则使用其值，否则默认为 "Teyvat"
    }
    return pathings; // 返回处理后的 pathings 数组
}

async function markPathings(pathings, group1Tags, group2Tags, group3Tags, group4Tags, priorityTags, excludeTags) {
    // 找出存在于 group1Tags 中且不在其他组标签中的标签
    const uniqueTags = group1Tags.filter(tag => {
        return !group2Tags.includes(tag) && !group3Tags.includes(tag) && !group4Tags.includes(tag);
    });

    pathings.forEach(pathing => {
        // 初始化 pathing.tags 和 pathing.monsterInfo 以确保它们存在
        pathing.tags = pathing.tags || [];
        pathing.monsterInfo = pathing.monsterInfo || {};

        // 初始化 pathing.prioritized 为 false
        pathing.prioritized = false;

        // 检查路径的 tags 是否包含 uniqueTags
        const containsUniqueTag = uniqueTags.some(uniqueTag => pathing.tags.includes(uniqueTag));

        // 检查 fullPath、tags 或 monsterInfo 是否包含 excludeTags 中的任意一个子字符串
        const containsExcludeTag = excludeTags.some(excludeTag => {
            // 检查 fullPath 是否包含 excludeTag
            const fullPathContainsExcludeTag = pathing.fullPath && pathing.fullPath.includes(excludeTag);
            // 检查 tags 是否包含 excludeTag
            const tagsContainExcludeTag = pathing.tags.some(tag => tag.includes(excludeTag));
            // 检查 monsterInfo 的键是否包含 excludeTag
            const monsterInfoContainsExcludeTag = Object.keys(pathing.monsterInfo).some(monsterName => monsterName.includes(excludeTag));

            // 返回是否包含任意一个 excludeTag
            return fullPathContainsExcludeTag || tagsContainExcludeTag || monsterInfoContainsExcludeTag;
        });

        // 检查 fullPath、tags 或 monsterInfo 是否包含 priorityTags 中的任意一个子字符串
        const containsPriorityTag = priorityTags.some(priorityTag => {
            // 检查 fullPath 是否包含 priorityTag
            const fullPathContainsPriorityTag = pathing.fullPath && pathing.fullPath.includes(priorityTag);
            // 检查 tags 是否包含 priorityTag
            const tagsContainPriorityTag = pathing.tags.some(tag => tag.includes(priorityTag));
            // 检查 monsterInfo 的键是否包含 priorityTag
            const monsterInfoContainsPriorityTag = Object.keys(pathing.monsterInfo).some(monsterName => monsterName.includes(priorityTag));

            // 返回是否包含任意一个 priorityTag
            return fullPathContainsPriorityTag || tagsContainPriorityTag || monsterInfoContainsPriorityTag;
        });

        // 如果包含 uniqueTags 或 excludeTags，则标记为 false，否则标记为 true
        pathing.available = !(containsUniqueTag || containsExcludeTag);

        // 如果包含 priorityTags，则标记为 true
        pathing.prioritized = containsPriorityTag;
    });
}

async function findBestRouteGroups(pathings, k, targetEliteNum, targetMonsterNum) {
    // 初始化变量
    let currentTargetEliteNum = targetEliteNum; // 当前目标精英怪数量
    let iterationCount = 0; // 循环次数

    // 初始化统计变量
    let totalSelectedElites = 0; // 总精英怪数量
    let totalSelectedMonsters = 0; // 总普通怪数量
    let totalGainCombined = 0; // 总收益
    let totalTimeCombined = 0; // 总耗时

    let maxE1 = 0;
    let maxE2 = 0;

    // 遍历 pathings，计算并添加 G1、G2、E1 和 E2 属性
    pathings.forEach(pathing => {
        pathing.selected = false; // 初始化 selected 属性为 false
        const G1 = pathing.mora_e + pathing.mora_m; // 进入一组的收益
        pathing.G1 = G1;
        const G2 = pathing.mora_m; // 进入二组的收益
        pathing.G2 = G2;
        pathing.E1 = pathing.e === 0 ? 0 : ((G1 - G2 * (targetEliteNum / (targetEliteNum + targetMonsterNum))) / pathing.e) ** k * (G1 / pathing.t); // 进入一组的效率
        pathing.E2 = pathing.m === 0 ? 0 : (G2 / pathing.m) ** k * (G2 / pathing.t); // 进入二组的效率

        if (maxE1 < pathing.E1) {
            maxE1 = pathing.E1;
        }
        if (maxE2 < pathing.E2) {
            maxE2 = pathing.E2;
        }

    });

    pathings.forEach(pathing => {
        if (pathing.prioritized) {
            pathing.E1 = maxE1 + 1;
            pathing.E2 = maxE2 + 1;
        }

    });

    // 封装第一轮选择逻辑
    function selectRoutesByEliteTarget(targetEliteNum) {
        // 重置选中状态和统计变量
        pathings.forEach(pathing => pathing.selected = false); // 每轮循环前重置选中状态
        totalSelectedElites = 0; // 重置总精英怪数量
        totalSelectedMonsters = 0; // 重置总普通怪数量
        totalGainCombined = 0; // 重置总收益
        totalTimeCombined = 0; // 重置总耗时

        // 按 E1 从高到低排序
        pathings.sort((a, b) => b.E1 - a.E1);

        // 第一轮选择：根据当前目标精英怪数量选择路径
        for (const pathing of pathings) {
            if (pathing.E1 > 0 && pathing.available && totalSelectedElites < targetEliteNum) {
                pathing.selected = true;
                totalSelectedElites += pathing.e;
                totalSelectedMonsters += pathing.m;
                totalGainCombined += pathing.G1;
                totalTimeCombined += pathing.t;
            }
        }
    }

    // 封装第二轮选择逻辑
    function selectRoutesByMonsterTarget(targetMonsterNum) {
        // 按 E2 从高到低排序
        pathings.sort((a, b) => b.E2 - a.E2);

        // 第二轮选择：根据剩余的普通怪数量目标选择路径
        for (const pathing of pathings) {
            if (pathing.E2 > 0 && pathing.available && !pathing.selected && totalSelectedMonsters < targetMonsterNum) {
                pathing.selected = true;
                totalSelectedElites += pathing.e; // 第二轮选择中也可能包含精英怪
                totalSelectedMonsters += pathing.m;
                totalGainCombined += pathing.G2;
                totalTimeCombined += pathing.t;
            }
        }
    }

    // 循环调整目标精英怪数量
    while (iterationCount < 10) {
        // 第一轮选择
        selectRoutesByEliteTarget(currentTargetEliteNum);

        // 第二轮选择：直接传入剩余的小怪数量目标
        selectRoutesByMonsterTarget(targetMonsterNum);

        // 检查精英怪总数是否满足条件
        const diff = totalSelectedElites - targetEliteNum;
        currentTargetEliteNum -= Math.round(0.5 * diff); // 调整目标精英怪数量，乘以系数并取整

        if (totalSelectedElites === targetEliteNum) {
            break; // 如果满足目标，直接终止循环
        }

        if ((totalSelectedElites > targetEliteNum) && iterationCount >= 5) {
            break; // 如果满足目标，直接终止循环
        }

        iterationCount++; // 增加循环次数
    }

    // 为最终选中且精英怪数量为0的路线添加小怪标签
    pathings.forEach(pathing => {
        // 检查是否包含 "传奇" 或 "高危" 标签
        const hasLegendOrHighRisk = pathing.tags.includes("传奇") || pathing.tags.includes("高危");

        // 如果路径被选中、没有精英怪物且不包含 "传奇" 或 "高危" 标签，则添加 "小怪" 标签
        if (pathing.selected && pathing.e === 0 && !hasLegendOrHighRisk) {
            pathing.tags.push("小怪");
        }
    });

    // 按原始索引排序
    pathings.sort((a, b) => a.index - b.index);

    // 输出日志信息
    log.info(`总精英怪数量: ${totalSelectedElites.toFixed(0)}`);
    log.info(`总普通怪数量: ${totalSelectedMonsters.toFixed(0)}`);
    log.info(`总收益: ${totalGainCombined.toFixed(0)} 摩拉`);

    // 将总用时转换为时、分、秒表示
    const hours = Math.floor(totalTimeCombined / 3600);
    const minutes = Math.floor((totalTimeCombined % 3600) / 60);
    const seconds = totalTimeCombined % 60;

    log.info(`预计总用时: ${hours} 时 ${minutes} 分 ${seconds.toFixed(0)} 秒`);
}

async function assignGroups(pathings, group1Tags, group2Tags, group3Tags, group4Tags) {
    // 初始化记录各组路线数量的对象
    const groupCounts = {
        0: 0, // 默认组
        1: 0, // 不包含 group1Tags 的组
        2: 0, // 包含 group1Tags 且包含 group2Tags 的组
        3: 0, // 包含 group1Tags 但不包含 group2Tags，包含 group3Tags 的组
        4: 0  // 包含 group1Tags 但不包含 group2Tags 和 group3Tags，包含 group4Tags 的组
    };

    // 遍历 pathings 数组
    pathings.forEach(pathing => {
        // 只处理 selected 为 true 的项
        if (pathing.selected) {
            // 默认 group 为 0
            pathing.group = 0;

            // 如果 tags 不包含 group1Tags 中的任意一个，则改为 1
            if (!group1Tags.some(tag => pathing.tags.includes(tag))) {
                pathing.group = 1;
            } else {
                // 如果包含 group1Tags 中的任意一个，则检查 group2Tags
                if (group2Tags.some(tag => pathing.tags.includes(tag))) {
                    pathing.group = 2;
                } else {
                    // 如果包含 group1Tags 但不包含 group2Tags，则检查 group3Tags
                    if (group3Tags.some(tag => pathing.tags.includes(tag))) {
                        pathing.group = 3;
                    } else {
                        // 如果包含 group1Tags 但不包含 group2Tags 和 group3Tags，则检查 group4Tags
                        if (group4Tags.some(tag => pathing.tags.includes(tag))) {
                            pathing.group = 4;
                        }
                    }
                }
            }

            // 更新对应的组计数
            groupCounts[pathing.group]++;
        }
    });

    // 返回组计数对象
    return groupCounts;
}

async function runPath(pathFilePath, map_name, whitelistKeywords, blacklistKeywords) {
    let thisMoveUpTime = 0;
    let lastMoveDown = 0;
    let lastPickupTime = new Date();
    let lastPickupItem = "";
    // 定义状态变量
    let state = { completed: false, cancelRequested: false, atMainUi: false, lastCheckMainUi: new Date() };
    // 定义图像路径和目标文本列表
    const imagePath = `assets/F_Dialogue.png`;
    const textxRange = { min: 1210, max: 1412 };
    const texttolerance = 30; // Y 坐标容错范围

    //检查是否在主界面
    async function isMainUI() {
        // 修改后的图像路径
        const imagePath = "assets/MainUI.png";

        // 修改后的识别区域（左上角区域）
        const xMin = 0;
        const yMin = 0;
        const width = 150; // 识别区域宽度
        const height = 150; // 识别区域高度

        // 尝试次数设置为 2 次
        const maxAttempts = 2;

        let attempts = 0;
        while (attempts < maxAttempts && !state.cancelRequested) {
            try {
                let template = file.ReadImageMatSync(imagePath);
                let recognitionObject = RecognitionObject.TemplateMatch(template, xMin, yMin, width, height);
                let result = captureGameRegion().find(recognitionObject);
                if (result.isExist()) {
                    return true; // 如果找到图标，返回 true
                }
            } catch (error) {
                log.error(`识别图像时发生异常: ${error.message}`);
                if (state.cancelRequested) {
                    break; // 如果请求了取消，则退出循环
                }
                return false; // 发生异常时返回 false
            }
            attempts++; // 增加尝试次数
            await sleep(2); // 每次检测间隔 2 毫秒
        }
        if (state.cancelRequested) {
            log.info("图像识别任务已取消");
        }
        return false; // 如果尝试次数达到上限或取消，返回 false
    }

    // 定义一个函数用于执行路径文件
    async function executePathFile(filePath) {
        try {
            await pathingScript.runFile(filePath);
            await sleep(1);
        } catch (error) {
            log.error(`执行路径文件时发生错误：${error.message}`);
            state.cancelRequested = true; // 修改状态变量
        }
        state.completed = true; // 修改状态变量
    }

    // 定义一个函数用于执行OCR识别和交互
    async function performOcrAndInteract(imagePath, whitelistKeywords, textxRange, texttolerance) {
        async function performOcr(whitelistKeywords, xRange, yRange, timeout = 200) {
            let startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                try {
                    // 在捕获的区域内进行OCR识别
                    let ra = captureGameRegion();
                    let resList = ra.findMulti(RecognitionObject.ocr(
                        xRange.min, yRange.min,
                        xRange.max - xRange.min, yRange.max - yRange.min
                    ));

                    // 遍历识别结果，检查是否找到目标文本
                    let results = [];
                    for (let i = 0; i < resList.count; i++) {
                        let res = resList[i];
                        let correctedText = res.text;

                        // 如果 whitelistKeywords 为空，则直接将所有文本视为匹配
                        if (whitelistKeywords.length === 0) {
                            results.push({ text: correctedText, x: res.x, y: res.y, width: res.width, height: res.height });
                        } else {
                            // 否则，检查是否包含目标文本
                            for (let targetText of whitelistKeywords) {
                                if (correctedText.includes(targetText)) {
                                    results.push({ text: correctedText, x: res.x, y: res.y, width: res.width, height: res.height });
                                    break; // 匹配到一个目标文本后即可跳出循环
                                }
                            }
                        }
                    }
                    return results;
                } catch (error) {
                    log.error(`识别文字时发生异常: ${error.message}`);
                    return [];
                }
            }
            log.warn("OCR识别超时");
            return [];
        }

        while (!state.completed && !state.cancelRequested) {
            // 尝试找到 F 图标并返回其坐标
            async function findFIcon(imagePath, xMin, yMin, width, height, timeout = 500) {
                let startTime = Date.now();
                while (Date.now() - startTime < timeout && !state.cancelRequested) {
                    try {
                        let template = file.ReadImageMatSync(imagePath);
                        let recognitionObject = RecognitionObject.TemplateMatch(template, xMin, yMin, width, height);
                        let result = captureGameRegion().find(recognitionObject);
                        if (result.isExist()) {
                            return { success: true, x: result.x, y: result.y, width: result.width, height: result.height };
                        }
                    } catch (error) {
                        log.error(`识别图像时发生异常: ${error.message}`);
                        if (state.cancelRequested) {
                            break; // 如果请求了取消，则退出循环
                        }
                        return null;
                    }
                    await sleep(2); // 每次检测间隔 2 毫秒
                }
                if (state.cancelRequested) {
                    log.info("图像识别任务已取消");
                }
                return null;
            }

            // 尝试找到 F 图标
            let fRes = await findFIcon(imagePath, 1102, 335, 34, 400, 200);
            if (!fRes) {
                state.atMainUi = await isMainUI();
                state.lastCheckMainUi = new Date();
                if (state.atMainUi) {
                    //log.info("在主界面，尝试下滑");
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);
                }
                continue;
            }

            // 获取 F 图标的中心点 Y 坐标
            let centerYF = fRes.y + fRes.height / 2;

            // 在当前屏幕范围内进行 OCR 识别
            let ocrResults = await performOcr(whitelistKeywords, textxRange, { min: fRes.y - texttolerance, max: fRes.y + fRes.height + texttolerance * 2 }, 200);

            // 检查所有目标文本是否在当前页面中
            let foundTarget = false;
            for (let ocrResult of ocrResults) {
                // 检查是否包含黑名单关键词
                let containsBlacklistKeyword = blacklistKeywords.some(blacklistKeyword => ocrResult.text.includes(blacklistKeyword));
                if (containsBlacklistKeyword) {
                    continue;
                }

                if ((new Date() - lastPickupTime) > 1000 || ocrResult.text != lastPickupItem) {
                    log.info(`交互或拾取："${ocrResult.text}"`);
                    lastPickupTime = new Date();
                    lastPickupItem = ocrResult.text;
                }

                // 计算目标文本的中心Y坐标
                let centerYTargetText = ocrResult.y + ocrResult.height / 2;
                if (Math.abs(centerYTargetText - centerYF) <= texttolerance) {
                    keyPress("F"); // 执行交互操作
                    await sleep(5); // 操作后暂停 5 毫秒
                    foundTarget = true;
                    break;
                }
            }

            // 如果在当前页面中没有找到任何目标文本，则根据时间决定滚动方向
            if (!foundTarget) {
                const currentTime = new Date().getTime(); // 获取当前时间（毫秒）

                // 如果距离上次下翻超过timeMoveUp秒，则执行下翻
                if (currentTime - lastMoveDown > timeMoveUp) {
                    await keyMouseScript.runFile(`assets/滚轮下翻.json`);

                    // 如果这是第一次下翻，记录这次下翻的时间
                    if (thisMoveUpTime === 0) {
                        thisMoveUpTime = currentTime; // 记录第一次上翻的时间
                    }

                    // 检查是否需要更新 lastMoveDown
                    if (currentTime - thisMoveUpTime >= timeMoveDown) {
                        lastMoveDown = currentTime; // 更新 lastMoveDown 为第一次下翻的时间
                        thisMoveUpTime = 0; // 重置 thisMoveUpTime，以便下一次下翻时重新记录
                    }
                } else {
                    // 否则执行下翻
                    await keyMouseScript.runFile(`assets/滚轮上翻.json`);
                }
            }

            if (state.cancelRequested) {
                break;
            }
        }
    }

    //处理泥头车模式
    async function dumper(pathFilePath, map_name) {
        let lastDumperTimer = 0;
        const dumperCD = 10000;
        try {
            const pathingContent = await file.readText(pathFilePath);
            const parsedContent = JSON.parse(pathingContent);
            const positions = parsedContent.positions;
            // 初始化 hasT 为 false
            let hasT = false;

            // 初始化 fightPositions 数组
            let fightPositions = [];

            // 遍历 positions 数组
            for (const pos of positions) {
                // 检查 action_params 是否包含 keypress(T)
                if (pos.action_params && pos.action_params.includes('keypress(T)')) {
                    hasT = true;
                }

                // 如果 action 是 "fight"，则添加到 fightPositions
                if (pos.action === "fight") {
                    fightPositions.push({
                        x: pos.x,
                        y: pos.y,
                        used: false
                    });
                }
            }
            if (!hasT) {
                while (!state.completed && !state.cancelRequested) {
                    await sleep(2011);
                    if ((new Date() - state.lastCheckMainUi) >= 2011) {
                        state.atMainUi = await isMainUI();
                        //log.info(`检查主界面,结果为${state.atMainUi}`);
                        state.lastCheckMainUi = new Date();
                    }
                    if (state.atMainUi) {
                        //在主界面才尝试获取坐标
                        let dumperDistance = 0;
                        try {
                            let shouldPressKeys = false;
                            const currentPosition = await genshin.getPositionFromMap(map_name);
                            for (let i = 0; i < fightPositions.length; i++) {
                                const fightPos = fightPositions[i];

                                if (fightPos.used) {
                                    continue;
                                }

                                const distance = Math.sqrt(
                                    Math.pow(currentPosition.x - fightPos.x, 2) +
                                    Math.pow(currentPosition.y - fightPos.y, 2)
                                );

                                if (distance <= 30) {
                                    fightPositions[i].used = true;
                                }

                                if (distance > 5 && distance <= 30) {
                                    if ((new Date() - lastDumperTimer) > dumperCD) {
                                        shouldPressKeys = true;
                                        lastDumperTimer = new Date();
                                        dumperDistance = distance;
                                    }
                                }
                            }

                            if (shouldPressKeys) {
                                log.info(`距离下个战斗地点距离${dumperDistance.toFixed(2)}，启用泥头车`);
                                for (const key of dumpers) {
                                    log.info(`[泥头车]:尝试切换${key}号角色施放e技能`)
                                    keyPress(String(key));
                                    await sleep(400);
                                    keyPress('e');
                                    await sleep(400);
                                    keyPress('e');
                                    await sleep(400);
                                    keyPress('e');
                                    await sleep(400);
                                }
                            }
                        } catch (error) {
                        }
                    }
                    if (state.cancelRequested) {
                        break;
                    }
                }
            } else {
                log.info("当前路线含有按键T，不启用泥头车");
            }
        } catch (error) {
            log.error(`执行泥头车时出现异常: ${error.message}`);
        }
    }

    // 启动路径文件执行任务
    const pathTask = executePathFile(pathFilePath);

    // 根据条件决定是否启动 OCR 检测和交互任务
    let ocrTask = null;
    if (pickupMode === "js拾取，默认只拾取狗粮和晶蝶") {
        ocrTask = performOcrAndInteract(imagePath, whitelistKeywords, textxRange, texttolerance);
    }

    // 启动泥头车
    let dumperTask = null;
    if (dumpers.length > 0) { // 检查 dumpers 是否不为空
        dumperTask = dumper(pathFilePath, map_name); // 调用 dumper 函数
    }

    // 等待所有任务完成
    try {
        await Promise.allSettled([pathTask, ocrTask, dumperTask]);
    } catch (error) {
        console.error(`执行任务时发生错误：${error.message}`);
        state.cancelRequested = true; // 设置取消标志
    } finally {
        state.completed = true; // 确保任务标记为完成
        state.cancelRequested = true; // 设置取消标志
    }
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

async function copyPathingsByGroup(pathings) {
    // 遍历 pathings 数组
    for (const pathing of pathings) {
        // 只处理 selected 为 true 的项
        if (pathing.selected) {
            // 读取文件内容
            const content = await file.readText(pathing.fullPath);
            // 构造目标路径
            const groupFolder = `pathingOut/group${pathing.group}`;
            const targetPath = `${groupFolder}/${pathing.fullPath}`;
            // 写入文件内容
            await file.writeText(targetPath, content, false);
        }
    }
}

async function processPathingsByGroup(pathings, whitelistKeywords, blacklistKeywords, accountName) {
    let lastX = 0;
    let lastY = 0;
    let runningFailCount = 0;
    // 定义路径组名称到组号的映射
    const groupMapping = {
        "路径组一": 1,
        "路径组二": 2,
        "路径组三": 3,
        "路径组四": 4
    };
    // 从全局 settings 中获取用户选择的路径组名称
    const selectedGroupName = settings.groupIndex || "路径组一"; // 默认值为 "路径组一"

    // 将路径组名称映射到组号
    const targetGroup = groupMapping[selectedGroupName];

    // 初始化变量，用于标记当前路径是该组的第几个
    let groupPathCount = 0;

    // 获取该组的总路径数
    const totalPathsInGroup = pathings.filter(pathing => pathing.group === targetGroup).length;

    if (pickupMode === "bgi原版拾取") {
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    }

    // 初始化统计变量
    let totalElites = 0; // 总精英怪数量
    let totalMonsters = 0; // 总小怪数量
    let totalGain = 0; // 总收益
    let totalEstimatedTime = 0; // 预计总时间

    // 遍历 pathings 数组，计算当前组的总计精英怪数量、小怪数量、总计收益和预计总时间
    for (const pathing of pathings) {
        if (pathing.group === targetGroup) {
            totalElites += pathing.e || 0; // 精英怪数量
            totalMonsters += pathing.m || 0; // 小怪数量
            totalGain += pathing.G1 || 0; // 收益
            totalEstimatedTime += pathing.t || 0; // 预计时间
        }
    }

    // 输出当前组的总计信息
    log.info(`当前组 ${selectedGroupName} 的总计信息：`);
    log.info(`精英怪数量: ${totalElites.toFixed(0)}`);
    log.info(`小怪数量: ${totalMonsters.toFixed(0)}`);
    log.info(`预计收益: ${totalGain.toFixed(0)} 摩拉`);

    // 将预计总时间转换为时、分、秒表示
    const hours = Math.floor(totalEstimatedTime / 3600);
    const minutes = Math.floor((totalEstimatedTime % 3600) / 60);
    const seconds = totalEstimatedTime % 60;
    log.info(`预计用时: ${hours} 时 ${minutes} 分 ${seconds.toFixed(0)} 秒`);

    const groupStartTime = new Date();
    let remainingEstimatedTime = totalEstimatedTime;
    let skippedTime = 0;

    // 遍历 pathings 数组
    for (const pathing of pathings) {
        // 检查路径是否属于指定的组
        if (pathing.group === targetGroup) {
            // 增加路径计数
            groupPathCount++;

            // 输出当前路径的序号信息
            log.info(`开始处理第 ${targetGroup} 组第 ${groupPathCount}/${totalPathsInGroup} 个${pathing.fileName}`);

            // 获取当前时间
            const now = new Date();

            // 检查 cdTime 是否晚于当前时间
            const cdTime = new Date(pathing.cdTime);
            if (cdTime > now) {
                log.info(`该路线未刷新，跳过。`);
                skippedTime += pathing.t;
                remainingEstimatedTime -= pathing.t;
                continue;
            }

            if (await isTimeRestricted(settings.timeRule)) {
                break;
            }

            // 输出路径已刷新并开始处理的信息
            log.info(`该路线已刷新，开始处理。`);
            await fakeLog(`${pathing.fileName}`, false, true, 0);
            // 调用 runPath 函数处理路径
            await runPath(pathing.fullPath, pathing.map_name, whitelistKeywords, blacklistKeywords);
            try {
                await sleep(1);
            } catch (error) {
                break;
            }
            await fakeLog(`${pathing.fileName}`, false, false, 0);

            try {
                await genshin.returnMainUi();
                const miniMapPosition = await genshin.getPositionFromMap(pathing.map_name);
                // 比较坐标
                const diffX = Math.abs(lastX - miniMapPosition.X);
                const diffY = Math.abs(lastY - miniMapPosition.Y);
                lastX = miniMapPosition.X;
                lastY = miniMapPosition.Y;
                if ((diffX + diffY) < 5) {
                    runningFailCount++;
                } else {
                    runningFailCount = 0;
                }
                //log.info(`当前位于${pathing.map_name}地图的（${miniMapPosition.X}，${miniMapPosition.Y}，距离上次距离${(diffX + diffY)}`);
            } catch (error) {
                log.error(`执行任务时发生错误：${error.message}`);
                runningFailCount++;
            }

            if (runningFailCount >= 1) {
                log.error("连续两条路线终止时坐标不变，不记录运行数据");
                continue;
            }

            // 计算下一个 UTC 时间的晚上 8 点（即北京时间凌晨四点）
            const nextEightClock = new Date(now);
            nextEightClock.setUTCHours(20, 0, 0, 0); // 设置为 UTC 时间的 20:00
            if (nextEightClock <= now) {
                // 如果设置的时间小于等于当前时间，说明需要取下一个晚上 8 点
                nextEightClock.setUTCHours(20 + 24, 0, 0, 0); // 设置为下一个 UTC 时间的 20:00
            }

            // 更新路径的 cdTime
            pathing.cdTime = nextEightClock.toLocaleString();

            remainingEstimatedTime -= pathing.t;
            const actualUsedTime = (new Date() - groupStartTime) / 1000;
            const predictRemainingTime = remainingEstimatedTime * actualUsedTime / (totalEstimatedTime - remainingEstimatedTime - skippedTime);
            // 将预计剩余时间转换为时、分、秒表示
            const remaininghours = Math.floor(predictRemainingTime / 3600);
            const remainingminutes = Math.floor((predictRemainingTime % 3600) / 60);
            const remainingseconds = predictRemainingTime % 60;
            log.info(`当前进度：第 ${targetGroup} 组第 ${groupPathCount}/${totalPathsInGroup} 个  ${pathing.fileName}已完成，该组预计剩余: ${remaininghours} 时 ${remainingminutes} 分 ${remainingseconds.toFixed(0)} 秒`);

            await updateCdTimeRecord(pathings, accountName);
        }
    }
}


//加载cd信息
async function initializeCdTime(pathings, accountName) {
    try {
        // 构造文件路径
        const filePath = `records/${accountName}.json`;

        // 尝试读取文件内容
        const fileContent = await file.readText(filePath);

        // 解析 JSON 数据
        const cdTimeData = JSON.parse(fileContent);

        // 遍历 pathings 数组
        pathings.forEach(pathing => {
            // 找到对应的 cdTime 数据
            const cdTimeEntry = cdTimeData.find(entry => entry.fileName === pathing.fileName);

            // 如果找到对应的项，则更新 cdTime
            if (cdTimeEntry) {
                pathing.cdTime = new Date(cdTimeEntry.cdTime).toLocaleString();
            } else {
                // 如果没有找到对应的项，则使用默认值 new Date(0)
                pathing.cdTime = new Date(0).toLocaleString();
            }
        });
    } catch (error) {
        pathings.forEach(pathing => {
            pathing.cdTime = new Date(0).toLocaleString();
        });
    }
}

async function updateCdTimeRecord(pathings, accountName) {
    try {
        // 构造文件路径
        const filePath = `records/${accountName}.json`;

        // 构造要写入文件的 JSON 数据
        const cdTimeData = pathings.map(pathing => ({
            fileName: pathing.fileName,
            //description: pathing.description,
            //精英数量: pathing.e,
            //小怪数量: pathing.m,
            标签: pathing.tags,
            cdTime: pathing.cdTime
        }));

        // 将更新后的内容写回文件
        await file.writeText(filePath, JSON.stringify(cdTimeData, null, 2), false);

    } catch (error) {
        // 捕获并记录错误
        log.error(`更新 cdTime 时出错: ${error.message}`);
    }
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

// 更新 pathings 的函数，接受索引文件路径作为参数
async function updatePathings(indexFilePath) {
    try {
        // 读取文件内容
        const fileContent = await file.readText(indexFilePath);
        // 将文件内容解析为 JSON 格式
        const data = JSON.parse(fileContent);

        // 遍历解析后的 JSON 数据
        for (const item of data) {
            // 检查 pathings 中是否存在某个对象的 fileName 属性与 item.fileName 相同
            const existingPathing = pathings.find(pathing => pathing.fileName === item.fileName);

            if (existingPathing) {
                existingPathing.usingIndex = true;

                // 直接覆盖其他字段，但先检查是否存在有效值
                if (item.时间 !== undefined) existingPathing.t = item.时间;
                if (item.精英摩拉 !== undefined) existingPathing.mora_e = item.精英摩拉;
                if (item.小怪摩拉 !== undefined) existingPathing.mora_m = item.小怪摩拉;
                if (item.小怪数量 !== undefined) existingPathing.m = item.小怪数量;
                if (item.精英数量 !== undefined) existingPathing.e = item.精英数量;

                // 使用 Set 来存储 tags，避免重复项
                const tagsSet = new Set(existingPathing.tags);
                for (const key in item) {
                    if (key !== "fileName" && key !== "时间" && key !== "精英摩拉" && key !== "小怪摩拉" && key !== "小怪数量" && key !== "精英数量") {
                        if (item[key] === 1) {
                            tagsSet.add(key);
                        }
                    }
                }
                existingPathing.tags = Array.from(tagsSet);
            }
        }
    } catch (error) {
        log.error("Error:", error);
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

/**
 * 检查当前时间是否处于限制时间内或即将进入限制时间
 * @param {string} timeRule - 时间规则字符串，格式如 "4, 4-6, 10-12"
 * @param {number} [threshold=5] - 接近限制时间的阈值（分钟）
 * @returns {Promise<boolean>} - 如果处于限制时间内或即将进入限制时间，则返回 true，否则返回 false
 */
async function isTimeRestricted(timeRule, threshold = 5) {
    // 如果输入的时间规则为 undefined 或空字符串，视为不进行时间处理，返回 false
    if (timeRule === undefined || timeRule === "") {
        return false;
    }

    // 初始化 0-23 小时为可用状态
    const hours = Array(24).fill(false);

    // 解析时间规则
    const rules = timeRule.split('，').map(rule => rule.trim());

    // 校验输入的字符串是否符合规则
    for (const rule of rules) {
        if (rule.includes('-')) {
            // 处理时间段，如 "4-6"
            const [startHour, endHour] = rule.split('-').map(Number);
            if (isNaN(startHour) || isNaN(endHour) || startHour < 0 || startHour >= 24 || endHour <= startHour || endHour > 24) {
                // 如果时间段格式不正确或超出范围，则报错并返回 true
                log.error("时间填写不符合规则，请检查");
                return true;
            }
            for (let i = startHour; i < endHour; i++) {
                hours[i] = true; // 标记为不可用
            }
        } else {
            // 处理单个时间点，如 "4"
            const hour = Number(rule);
            if (isNaN(hour) || hour < 0 || hour >= 24) {
                // 如果时间点格式不正确或超出范围，则报错并返回 true
                log.error("时间填写不符合规则，请检查");
                return true;
            }
            hours[hour] = true; // 标记为不可用
        }
    }

    // 获取当前时间
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 检查当前时间是否处于限制时间内
    if (hours[currentHour]) {
        log.warn("处于限制时间内");
        return true; // 当前时间处于限制时间内
    }

    // 检查当前时间是否即将进入限制时间
    for (let i = 0; i < 24; i++) {
        if (hours[i]) {
            const nextHour = i;
            const timeUntilNextHour = (nextHour - currentHour - 1) * 60 + (60 - currentMinute);
            if (timeUntilNextHour > 0 && timeUntilNextHour <= threshold) {
                // 如果距离下一个限制时间小于等于阈值，则等待到限制时间开始
                log.warn("接近限制时间，开始等待");
                await sleep(timeUntilNextHour * 60 * 1000);
                return true;
            }
        }
    }
    log.info("不处于限制时间");
    return false; // 当前时间不在限制时间内
}



