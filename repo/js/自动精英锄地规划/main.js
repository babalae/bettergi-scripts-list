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
// Removed redundant type and integer checks for `currentTime`.
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
        log.info(logMessage);
    }
    if (isJs && !isStart) {
        // 处理 isJs = true 且 isStart = false 的情况
        const logMessage = `正在伪造js结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.info(logMessage);
    }
    if (!isJs && isStart) {
        // 处理 isJs = false 且 isStart = true 的情况
        const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 开始执行地图追踪任务: "${name}"`;
        log.info(logMessage);
    }
    if (!isJs && !isStart) {
        // 处理 isJs = false 且 isStart = false 的情况
        const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
            `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
            `------------------------------`;
        log.info(logMessage);
    }
}


(async function () {
    // 初始化配置
    const operationType = settings.operationType || "生成路径组文件"; // 操作模式
    let excludeTagsForPathGroup1 = settings.excludeTagsForPathGroup1 || ""; // 路径组1排除标签
    let selectTagsForPathGroup2 = settings.selectTagsForPathGroup2 || ""; // 路径组2选择标签
    let selectTagsForPathGroup3 = settings.selectTagsForPathGroup3 || ""; // 路径组3选择标签
    const disableAutoPickup = settings.disableAutoPickup || false; // 是否禁用自动拾取
    const disableRouteCdCheck = settings.disableRouteCdCheck || false; // 是否禁用路线CD检测
    const requiredMonsterCount = parseInt(settings.requiredMonsterCount, 10) || 405; // 目标怪物数量
    const minSecPerMonster = parseFloat(settings.minSecPerMonster) || 0.1; // 最低秒均
    const accountName = settings.accountName || "一个账户名"; // 账户名

    // 新增全局排除关键词的配置
    const excludeTagsForAll = settings.excludeTagsForAll || ""; // 全局排除关键词
    const excludeTagsForAllArray = excludeTagsForAll.split('；').map(tag => tag.trim()).filter(tag => tag !== "");

    // 生成默认的文件夹/文件名，现在默认为 accountName
    let outputFolderName = accountName;

    // 日志输出配置信息
    log.info(`配置信息：操作类型=${operationType}, 路径组1排除标签=${excludeTagsForPathGroup1}, 路径组2选择标签=${selectTagsForPathGroup2}, 路径组3选择标签=${selectTagsForPathGroup3}, 是否禁用自动拾取=${disableAutoPickup}, 是否禁用路线CD检测=${disableRouteCdCheck}, 目标怪物数量=${requiredMonsterCount}, 最低秒均=${minSecPerMonster}, 全局排除关键词=${excludeTagsForAll}, 账户名=${accountName}`);
    log.info(`解析的全局排除关键词：${excludeTagsForAllArray.join(', ')}`);

    // 根据 disableRouteCdCheck 的值设置 enableRouteCdCheck
    const enableRouteCdCheck = !disableRouteCdCheck; // 如果 disableRouteCdCheck 为 true，则 enableRouteCdCheck 为 false，反之亦然

    //当用户所有自定义配置均为默认时警告用户
    if (
        operationType === "生成路径组文件" &&
        excludeTagsForPathGroup1 === "" &&
        selectTagsForPathGroup2 === "" &&
        selectTagsForPathGroup3 === "" &&
        disableAutoPickup === false &&
        disableRouteCdCheck === false &&
        requiredMonsterCount === 405 &&
        minSecPerMonster === 0.1 &&
        accountName === "一个账户名" &&
        excludeTagsForAll === ""
    ) {
        log.warn("所有配置项均为默认状态，请检查是否需要调整配置。你没有修改自定义配置，请在配置组界面中右键本js以修改自定义配置。");
    }


    // 初始化文件路径（直接内置生成）
    const indexPath = 'index.txt';
    const pathingDir = 'pathing/';
    const routeDir = 'route/';

    // 定义需要检查的字段
    const tags = ["水免", "次数盾", "传奇", "高危"];

    // 标准化 excludeTagsForPathGroup1
    excludeTagsForPathGroup1 = tags.filter(tag => excludeTagsForPathGroup1.includes(tag)).join('.');

    // 标准化 selectTagsForPathGroup2
    selectTagsForPathGroup2 = tags.filter(tag => selectTagsForPathGroup2.includes(tag)).join('.');

    // 标准化 selectTagsForPathGroup3
    selectTagsForPathGroup3 = tags.filter(tag => selectTagsForPathGroup3.includes(tag)).join('.');

    // 初始化一个变量，用于判断是否是执行路径组文件的模式
    let executePathGroupMode = 0;

    // 分别检验是否是执行路径组文件1、执行路径组文件2、执行路径组文件3
    if (operationType === "执行路径组文件1") {
        executePathGroupMode = 1;
    } else if (operationType === "执行路径组文件2") {
        executePathGroupMode = 2;
    } else if (operationType === "执行路径组文件3") {
        executePathGroupMode = 3;
    }

    // 如果是执行路径组文件的模式
    if (executePathGroupMode > 0) {
        // 检查是否禁用了自动拾取
        if (!disableAutoPickup) {
            // 启用自动拾取
            dispatcher.addTimer(new RealtimeTimer("AutoPick"));
        } else {
            // 禁用自动拾取
            log.warn("自动拾取已禁用");
        }

        //伪造js结束的记录
        await fakeLog("自动精英锄地规划", true, false, 1);

        // 根据 executePathGroupMode 获取路径组编号
        const pathGroupNumber = executePathGroupMode;

        // 构造路径组文件路径
        const pathGroupFilePath = `${routeDir}路径组${pathGroupNumber}-${outputFolderName}.txt`;

        try {
            // 读取路径组文件内容
            const pathGroupContent = await file.readText(pathGroupFilePath);
            const pathLines = pathGroupContent.trim().split('\n'); // 定义 pathLines 变量

            // 遍历路径名称列表，依次执行每个路径
            for (let i = 0; i < pathLines.length; i++) {
                const pathLine = pathLines[i];
                // 解析路径名称和后面的 ISO 时间字符串
                const [pathName, pathCD] = pathLine.split('::').map(part => part.trim());
                const pathFilePath = `${pathingDir}${pathName}.json`;

                // 获取当前时间
                const now = new Date();
                const startTime = now.toISOString(); // 获取开始时间

                // 如果启用了路线CD检测，检查当前时间是否不早于附加时间戳
                if (enableRouteCdCheck) {
                    const pathCDDate = new Date(pathCD); // 将附加时间戳转换为Date对象
                    if (now < pathCDDate) {
                        log.info(`当前路线 ${pathName} 为第 ${i + 1}/${pathLines.length} 个，当前路线未刷新，放弃该路径`);
                        await sleep(10);
                        continue; // 放弃该路径
                    }
                }

                log.info(`当前路线 ${pathName} 为第 ${i + 1}/${pathLines.length} 个，当前路线已刷新或未启用cd检测，执行路径`);

                //伪造地图追踪开始的日志记录
                await fakeLog(pathName + ".json", false, true, 0); // 开始时 duration 通常为 0

                // 执行路径文件
                await pathingScript.runFile(pathFilePath);

                //捕获任务取消的错误并跳出循环
                try {
                    await sleep(10); 
                } catch (error) {
                    log.error(`发生错误: ${error}`);
                    break; // 终止循环
                }

                // 获取结束时间
                const endTime = new Date();
                const endTimeISO = endTime.toISOString(); // 获取结束时间

                // 检查执行时间是否超过3秒
                const executionTime = endTime.getTime() - now.getTime();

                //伪造地图追踪结束的记录
                await fakeLog(pathName + ".json", false, false, executionTime);


                // 如果启用了CD检测，且结束时间与开始时间相差超过3秒，则更新附加时间戳为开始时间后的第一个凌晨四点
                if (enableRouteCdCheck && executionTime > 3000) {
                    // 计算开始时间后的第一个凌晨四点
                    const nextFourClock = new Date(startTime);
                    nextFourClock.setHours(4, 0, 0, 0); // 设置时间为凌晨四点
                    if (nextFourClock <= new Date(startTime)) {
                        // 如果设置的时间小于等于开始时间，说明需要取下一个凌晨四点
                        nextFourClock.setHours(4 + 24, 0, 0, 0); // 设置时间为下一个凌晨四点
                    }

                    // 转换为北京时间（UTC+8）
                    const nextFourClockBeijing = new Date(nextFourClock.getTime());
                    const nextFourClockFormatted = `${nextFourClockBeijing.getFullYear()}-${String(nextFourClockBeijing.getMonth() + 1).padStart(2, '0')}-${String(nextFourClockBeijing.getDate()).padStart(2, '0')} ${String(nextFourClockBeijing.getHours()).padStart(2, '0')}:${String(nextFourClockBeijing.getMinutes()).padStart(2, '0')}:${String(nextFourClockBeijing.getSeconds()).padStart(2, '0')}`;

                    // 更新路径组文件中的附加时间戳
                    pathLines[i] = `${pathName}::${nextFourClock.toISOString()}`;
                    log.info(`当前路线 ${pathName} 执行完成，可用时间更新为：${nextFourClockFormatted}`);

                    // 将更新后的内容写回路径组文件
                    const updatedPathGroupContent = pathLines.join('\n');
                    await file.writeText(pathGroupFilePath, updatedPathGroupContent);
                } else {
                    log.info(`当前路线 ${pathName} 执行完成，但不更新可用时间，因为执行时间不足10秒或未启用cd检测。`);
                }
            }
        } catch (error) {
            log.error(`读取路径组文件失败：${error}`);
            return;
        }

        //伪造一个js开始的记录
        await fakeLog("自动精英锄地规划", true, true, 0);

        // 执行完成后退出程序
        return;
    }

    // 否则：进行排序、筛选和选取路径
    let totalMonsterCount = 0;

    try {
        const indexContent = await file.readText(indexPath);
        const pathingFiles = indexContent.trim().split('\n').slice(1).map(line => {
            const data = line.trim().split('\t');
            if (data.length !== 11) { // 假设列数为11
                log.warn(`不符合预期格式的行：${line}`);
                return null;
            }
            const keywords = data[0].trim(); // 新的第一列是关键词信息
            return {
                keywords: keywords,
                legendary: parseInt(data[1], 10) === 1,
                waterFree: parseInt(data[2], 10) === 1,
                timeshield: parseInt(data[3], 10) === 1,
                highRisk: parseInt(data[4], 10) === 1,
                monsterCount: parseFloat(data[5]),
                secPerMonster: parseFloat(data[9]),
                name: data[10].trim(),
                group: 0 // 新增 group 参数，初始值为 0
            };
        }).filter(route => route !== null);

        // 筛选和排序路径
        const priority600Routes = pathingFiles
            .filter(route => route.name.includes('600') && !excludeTagsForAllArray.some(tag => route.name.includes(tag) || route.keywords.includes(tag)))
            .sort((a, b) => {
                if (a.secPerMonster === b.secPerMonster) {
                    return a.monsterCount - b.monsterCount; // 次要排序依据：怪物数量升序
                }
                return b.secPerMonster - a.secPerMonster; // 主要排序依据：秒均降序
            });

        const priority400Routes = pathingFiles
            .filter(route => route.name.includes('400') && !excludeTagsForAllArray.some(tag => route.name.includes(tag) || route.keywords.includes(tag)))
            .sort((a, b) => {
                if (a.secPerMonster === b.secPerMonster) {
                    return a.monsterCount - b.monsterCount; // 次要排序依据：怪物数量升序
                }
                return b.secPerMonster - a.secPerMonster; // 主要排序依据：秒均降序
            });

        const remainingRoutes = pathingFiles
            .filter(route => !priority600Routes.includes(route) && !priority400Routes.includes(route) && !excludeTagsForAllArray.some(tag => route.name.includes(tag) || route.keywords.includes(tag)))
            .sort((a, b) => {
                if (a.secPerMonster === b.secPerMonster) {
                    return a.monsterCount - b.monsterCount; // 次要排序依据：怪物数量升序
                }
                return b.secPerMonster - a.secPerMonster; // 主要排序依据：秒均降序
            });

        // 合并所有路径
        const sortedRoutes = [...priority600Routes, ...priority400Routes, ...remainingRoutes];

        // 分配路径到路径组
        const pathGroups = [[], [], []];
        for (const path of sortedRoutes) {
            if (totalMonsterCount >= requiredMonsterCount) {
                break;
            }

            // 为每个路径组生成一个对应的字符串
            const excludeTags1 = excludeTagsForPathGroup1.split('.');
            const excludeTags1String = excludeTags1.map(tag => {
                switch (tag) {
                    case "传奇":
                        return path.legendary ? '1' : '0';
                    case "水免":
                        return path.waterFree ? '1' : '0';
                    case "次数盾":
                        return path.timeshield ? '1' : '0';
                    case "高危":
                        return path.highRisk ? '1' : '0';
                    default:
                        return '0';
                }
            }).join('');

            const selectTags2 = selectTagsForPathGroup2.split('.');
            const selectTags2String = selectTags2.map(tag => {
                switch (tag) {
                    case "传奇":
                        return path.legendary ? '1' : '0';
                    case "水免":
                        return path.waterFree ? '1' : '0';
                    case "次数盾":
                        return path.timeshield ? '1' : '0';
                    case "高危":
                        return path.highRisk ? '1' : '0';
                    default:
                        return '0';
                }
            }).join('');

            const selectTags3 = selectTagsForPathGroup3.split('.');
            const selectTags3String = selectTags3.map(tag => {
                switch (tag) {
                    case "传奇":
                        return path.legendary ? '1' : '0';
                    case "水免":
                        return path.waterFree ? '1' : '0';
                    case "次数盾":
                        return path.timeshield ? '1' : '0';
                    case "高危":
                        return path.highRisk ? '1' : '0';
                    default:
                        return '0';
                }
            }).join('');

            // 检查路径是否符合路径组1的条件
            const excludeTags1Mask = excludeTags1.map(tag => tag === '1' ? '1' : '0').join('');
            if (excludeTags1String === excludeTags1Mask) { // 反转逻辑：如果路径包含任何排除标签，则入选路径组1
                path.group = 1;
                pathGroups[0].push(path);
                totalMonsterCount += path.monsterCount;
                continue;
            }

            // 检查路径是否符合路径组2的条件
            const selectTags2Mask = selectTags2.map(tag => tag === '1' ? '1' : '0').join('');
            if (selectTags2String !== selectTags2Mask) { // 反转逻辑：如果路径不包含任何选择的标签，则入选路径组2
                path.group = 2;
                pathGroups[1].push(path);
                totalMonsterCount += path.monsterCount;
                continue;
            }

            // 检查路径是否符合路径组3的条件
            const selectTags3Mask = selectTags3.map(tag => tag === '1' ? '1' : '0').join('');
            if (selectTags3String !== selectTags3Mask) { // 反转逻辑：如果路径不包含任何选择的标签，则入选路径组3
                path.group = 3;
                pathGroups[2].push(path);
                totalMonsterCount += path.monsterCount;
                continue;
            }
        }

        // 再次根据 operationType 决定生成路径组文件还是输出地图追踪文件
        if (operationType === "生成路径组文件") {
            // 生成路径组文件的逻辑
            for (let i = 0; i < 3; i++) {
                const pathGroup = pathGroups[i];
                const pathGroupFilePath = `${routeDir}路径组${i + 1}-${outputFolderName}.txt`;
                if (pathGroup.length > 0) {
                    // 按照 index.txt 中的顺序输出路径，并在每个路径名称后添加 "2000-01-01T00:00:00.000Z",以初始化cd信息
                    const sortedPathNames = pathingFiles
                        .filter(path => pathGroup.some(groupPath => groupPath.name === path.name))
                        .map(path => `${path.name}::2000-01-01T00:00:00.000Z`);
                    const pathGroupContent = sortedPathNames.join('\n');
                    await file.writeText(pathGroupFilePath, pathGroupContent);
                    log.info(`生成并刷新路径组${i + 1}文件成功，路径数：${sortedPathNames.length}`);
                }
            }
            log.info(`怪物总数${totalMonsterCount}，请修改js自定义配置中的操作模式以执行文件`);
        } else if (operationType === "输出地图追踪文件") {
            // 输出地图追踪文件的逻辑
            for (let i = 0; i < 3; i++) {
                const pathGroup = pathGroups[i];
                const outputFolder = `pathingout/${outputFolderName}/路径组${i + 1}`;
                let successCount = 0;
                let failCount = 0;
                for (const path of pathGroup) {
                    const sourceFilePath = `${pathingDir}${path.name}.json`;
                    const targetFilePath = `${outputFolder}/${path.name}.json`;
                    try {
                        const fileContent = await file.readText(sourceFilePath);
                        await file.writeText(targetFilePath, fileContent);
                        successCount++;
                    } catch (error) {
                        log.warn(`复制 ${sourceFilePath} 到 ${targetFilePath} 失败：${error}`);
                        failCount++;
                    }
                }
                log.info(`路径组${i + 1}复制完成：成功 ${successCount} 个，失败 ${failCount} 个`);
            }
            log.info(`怪物总数${totalMonsterCount}，请前往pathingout文件夹提取文件`);
        }
    } catch (error) {
        log.error(`读取索引文件失败：${error}`);
    }
})();

