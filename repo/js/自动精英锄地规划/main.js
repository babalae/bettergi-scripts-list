(async function () {
    // 初始化配置
    const operationType = settings.operationType || "生成路径组文件"; // 操作模式
    let excludeTagsForPathGroup1 = settings.excludeTagsForPathGroup1 || ""; // 路径组1排除标签
    let selectTagsForPathGroup2 = settings.selectTagsForPathGroup2 || ""; // 路径组2选择标签
    let selectTagsForPathGroup3 = settings.selectTagsForPathGroup3 || ""; // 路径组3选择标签
    const disableAutoPickup = settings.disableAutoPickup || false; // 是否禁用自动拾取
    const enableRouteCdCheck = settings.enableRouteCdCheck || false; // 是否启用路线CD检测
    const requiredMonsterCount = parseInt(settings.requiredMonsterCount, 10) || 405; // 目标怪物数量
    const minSecPerMonster = parseFloat(settings.minSecPerMonster) || 0.1; // 最低秒均

    // 新增全局排除关键词的配置
    const excludeTagsForAll = settings.excludeTagsForAll || ""; // 全局排除关键词
    const excludeTagsForAllArray = excludeTagsForAll.split('；').map(tag => tag.trim()).filter(tag => tag !== "");

    // 生成默认的文件夹/文件名
    let outputFolderName = `${requiredMonsterCount}-${excludeTagsForPathGroup1}-${selectTagsForPathGroup2}-${selectTagsForPathGroup3}-${minSecPerMonster}`;

    // 日志输出配置信息
    log.info(`配置信息：操作类型=${operationType}, 路径组1排除标签=${excludeTagsForPathGroup1}, 路径组2选择标签=${selectTagsForPathGroup2}, 路径组3选择标签=${selectTagsForPathGroup3}, 是否禁用自动拾取=${disableAutoPickup}, 是否启用路线CD检测=${enableRouteCdCheck}, 目标怪物数量=${requiredMonsterCount}, 最低秒均=${minSecPerMonster}, 全局排除关键词=${excludeTagsForAll}`);
    log.info(`解析的全局排除关键词：${excludeTagsForAllArray.join(', ')}`);

    // 定义六个运行时变量，初始值分别为 2000、1000、0、0、0、0
    let runtime1 = 2000;
    let runtime2 = 1000;
    let runtime3 = 0;
    let runtime4 = 0;
    let runtime5 = 0;
    let runtime6 = 0;

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

                // 更新 runtime 变量
                runtime6 = runtime5;
                runtime5 = runtime4;
                runtime4 = runtime3;
                runtime3 = runtime2;
                runtime2 = runtime1;
                runtime1 = now.getTime();

                // 检查时间差条件
                if ((runtime1 - runtime2) < 500 &&
                    (runtime2 - runtime3) < 500 &&
                    (runtime3 - runtime4) < 500 &&
                    (runtime4 - runtime5) < 500 &&
                    (runtime5 - runtime6) < 500) {
                    log.info(`连续五次时间差小于 500 毫秒，循环终止。`);
                    break; // 如果连续五次时间差小于 500 毫秒，退出循环
                }

                // 如果启用了路线CD检测，检查当前时间是否不早于附加时间戳
                if (enableRouteCdCheck) {
                    const pathCDDate = new Date(pathCD); // 将附加时间戳转换为Date对象
                    if (now < pathCDDate) {
                        log.info(`当前路线 ${pathName} 为第 ${i + 1}/${pathLines.length} 个，当前路线未刷新，放弃该路径`);
                        await sleep(500);
                        continue; // 放弃该路径
                    }
                }

                log.info(`当前路线 ${pathName} 为第 ${i + 1}/${pathLines.length} 个，当前路线已刷新或未启用cd检测，执行路径`);

                // 执行路径文件
                await pathingScript.runFile(pathFilePath);

                // 获取结束时间
                const endTime = new Date();
                const endTimeISO = endTime.toISOString(); // 获取结束时间

                // 检查执行时间是否超过10秒
                const executionTime = endTime.getTime() - now.getTime();

                // 如果启用了CD检测，且结束时间与开始时间相差超过10秒，则更新附加时间戳为开始时间后的第一个凌晨四点
                if (enableRouteCdCheck && executionTime > 10000) {
                    // 计算开始时间后的第一个晚上八点
                    const nextEveningEight = new Date(startTime);
                    nextEveningEight.setHours(4, 0, 0, 0); // 设置时间为凌晨四点0分0秒0毫秒
                    if (nextEveningEight <= new Date(startTime)) {
                        // 如果设置的时间小于等于开始时间，说明需要取下一个晚上八点
                        nextEveningEight.setHours(4 + 24, 0, 0, 0); // 设置时间为下一个晚上八点0分0秒0毫秒
                    }

                    // 转换为北京时间（UTC+8）
                    const nextEveningEightBeijing = new Date(nextEveningEight.getTime() + 8 * 3600 * 1000);
                    const nextEveningEightBeijingFormatted = `${nextEveningEightBeijing.getFullYear()}-${String(nextEveningEightBeijing.getMonth() + 1).padStart(2, '0')}-${String(nextEveningEightBeijing.getDate()).padStart(2, '0')} ${String(nextEveningEightBeijing.getHours()).padStart(2, '0')}:${String(nextEveningEightBeijing.getMinutes()).padStart(2, '0')}:${String(nextEveningEightBeijing.getSeconds()).padStart(2, '0')}`;

                    // 更新路径组文件中的附加时间戳
                    pathLines[i] = `${pathName}::${nextEveningEight.toISOString()}`;
                    log.info(`当前路线 ${pathName} 执行完成，下一次可用时间更新为：${nextEveningEightBeijingFormatted}`);

                    // 将更新后的内容写回路径组文件
                    const updatedPathGroupContent = pathLines.join('\n');
                    await file.writeText(pathGroupFilePath, updatedPathGroupContent);
                } else {
                    log.info(`当前路线 ${pathName} 执行完成，但不更新可用时间，因为执行时间不足10秒或未启用cd检测。`);
                }
            }
        } catch (error) {
            log.error(`读取路径组文件失败：${error}`);
            process.exit(1); // 退出程序
        }

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

