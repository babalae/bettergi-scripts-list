// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);（可以不加）
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
    // 初始化所有用到的参数
    const operationMode = settings.operationMode || "生成路径文件"; // 默认值为“生成路径文件”
    const requiredMonsterCount = parseInt(settings.requiredMonsterCount || 1750, 10); // 默认值为1800
    const excludeWaterFree = !!settings.excludeWaterFree; // 默认值为false（默认不排除）
    const excludeHighRisk = !!settings.excludeHighRisk; // 默认值为false（默认不排除）
    const weight = parseFloat(settings.weight || 2); // 默认值为2
    const disableAutoPick = !!settings.disableAutoPick; // 默认值为false（默认不禁用）
    const disableCooldownCheck = !!settings.disableCooldownCheck; // 默认值为false（默认不禁用CD检测）
    const accountName = settings.accountName || "一个账户名"; // 新增账户名，默认值为“默认账户”
    const pathingDir = 'pathing/'; // 初始化pathingDir参数
    const enableCooldownCheck = !disableCooldownCheck; // 如果 disableCooldownCheck 未设置或为 false，则 enableCooldownCheck 为 true

    // 初始化全局排除关键词配置
    let globalExclusionKeywords = settings.globalExclusionKeywords || "不跑"; // 默认为不跑

    const exclusionKeywordsArray = globalExclusionKeywords.split("；").map(keyword => keyword.trim()).filter(Boolean); // 使用中文分号分隔，并去除空格和空字符串

    // 初始化用于计数的变量
    let outputFolderName = accountName; // 初始化为空
    let totalMonsterCount = 0; // 筛选出的怪物总数
    let selectedRoutes = []; // 筛选出的路线数组
    let successCount = 0; // 成功复制的文件数量
    let failCount = 0; // 失败复制的文件数量
    let routeIndex = 0; // 当前筛选的路线序号

    // 日志输出配置参数
    log.info(
        `自动小怪锄地规划 - 配置信息：` +
        `操作模式=${operationMode}（默认：生成路径文件），` +
        `怪物数量=${requiredMonsterCount}（默认1750），` +
        `${excludeWaterFree ? '排除水免（默认：不排除）' : '包含水免（默认）'}，` +
        `${excludeHighRisk ? '排除高危（默认：不排除）' : '包含高危（默认）'}，` +
        `权重=${weight}（默认2），` +
        `自动拾取=${disableAutoPick ? '禁用' : '启用'}，` +
        `CD检测=${disableCooldownCheck ? '禁用' : '启用'}，` +
        `账户名=${accountName}`
    );

    // 在日志中输出全局排除关键词配置信息
    log.info(`全局排除关键词=${globalExclusionKeywords ? exclusionKeywordsArray.join("；") : "无"}`);

    // 检查是否所有配置都是默认状态
    const isDefaultConfig = (
        operationMode === "生成路径文件" &&
        requiredMonsterCount === 1750 &&
        !excludeWaterFree &&
        !excludeHighRisk &&
        weight === 2 &&
        !disableAutoPick &&
        enableCooldownCheck &&
        accountName === "一个账户名"
    );

    if (isDefaultConfig) {
        log.warn(`你没有修改自定义配置，请在配置组界面中右键本js以修改自定义配置`);
    }


    // 验证配置参数
    if (
        isNaN(requiredMonsterCount) ||
        requiredMonsterCount < 0 ||
        requiredMonsterCount > 3000 ||
        !Number.isInteger(requiredMonsterCount)
    ) {
        log.warn(`怪物数量 ${requiredMonsterCount} 不符合要求，必须为0到3000之间的整数`);
        return;
    }
    if (isNaN(weight) || weight < 0) {
        log.warn(`权重 ${weight} 不符合要求，必须为0及以上的数`);
        return;
    }

    // 根据自定义配置，如果没有禁用自动拾取，则启用自动拾取
    if (!disableAutoPick) {
        log.info("启用自动拾取的实时任务");
        dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    }

    // 判断操作模式是否为“执行路径文件”，若是则执行路径文件
    if (operationMode === "执行路径文件") {
        try {
            //伪造js已经结束的记录
            await fakeLog("自动小怪锄地规划", true, false, 1);
            // 定义路径组文件的路径，使用 outputFolderName
            const pathGroupFilePath = `route/${outputFolderName}.txt`;

            const pathGroupContent = await file.readText(pathGroupFilePath);
            const savedRoutes = pathGroupContent.trim().split('\n');
            for (let i = 0; i < savedRoutes.length; i++) {
                const routeWithTimestamp = savedRoutes[i].trim();
                const [routeName, routeTimestamp] = routeWithTimestamp.split('::');
                log.info(`当前进度：${routeName}为第 ${i + 1}/${savedRoutes.length} 个`);
                const now = new Date(); // 获取开始时间
                const startTime = now.toISOString();

                if (enableCooldownCheck && startTime < routeTimestamp) {
                    log.info(`当前路线 ${routeName} 未刷新，跳过任务`);
                    await sleep(10);
                    continue; // 跳过当前循环
                }
                log.info(`当前路线 ${routeName} 已刷新或未启用CD检测，执行任务`);

                // 拼接路径文件的完整路径
                const pathingFilePath = `pathing/${routeName}.json`;

                //伪造地图追踪开始的日志记录
                await fakeLog(routeName + ".json", false, true, 0); // 开始时 duration 通常为 0

                // 执行路径文件
                await pathingScript.runFile(pathingFilePath);

                const endTime = new Date(); // 获取结束时间
                const timeDiff = endTime - now; // 计算时间差（单位：毫秒）

                //伪造地图追踪结束的日志记录
                await fakeLog(routeName + ".json", false, false, timeDiff);

                //尝试捕获任务取消的错误，捕获后终止循环
                try {
                    await sleep(10);
                } catch (error) {
                    log.error(`发生错误: ${error}`);
                    return; // 终止循环
                }

                // 如果启用了CD检测
                if (enableCooldownCheck) {
                    if (timeDiff > 3000) { // 如果时间差大于3秒（3000毫秒）
                        // 计算新的时间戳，增加12小时
                        const newTimestamp = new Date(startTime).getTime() + 12 * 60 * 60 * 1000;
                        const formattedNewTimestamp = new Date(newTimestamp).toISOString();
                        const nextAvailableTime = new Date(formattedNewTimestamp).toLocaleString(); // 转换为本地时间格式
                        log.info(`任务 ${routeName} 运行超过10秒且当前启用刷新CD检测，下一次可用时间为 ${nextAvailableTime}`);
                        log.info(`新的时间戳为：${formattedNewTimestamp}`);

                        // 更新 savedRoutes 中对应部分的时间戳
                        savedRoutes[i] = `${routeName}::${formattedNewTimestamp}`;

                        // 立即将更新后的内容写回文件
                        const updatedContent = savedRoutes.join('\n');
                        await file.writeText(pathGroupFilePath, updatedContent);
                    }
                }
            }
        } catch (error) {
            log.error(`读取或写入路径组文件时出错: ${error}`);
        }

        //伪造一个js开始的记录（实际上没必要）
        //await fakeLog("自动精英锄地规划", true, true, 0);
        return;
    }

    // 筛选、排序并选取路线
    const indexPath = `index.txt`;
    try {
        const indexContent = await file.readText(indexPath);
        const pathingFiles = indexContent.trim().split('\n').map(line => {
            const parts = line.trim().split('\t');
            return {
                name: parts[0],
                monsterCount: parseFloat(parts[1]),
                secPerMonster: parseFloat(parts[2]),
                monsterPerSec: parseFloat(parts[3]),
                isWaterFree: parseInt(parts[4], 10) === 1,
                isHighRisk: parseInt(parts[5], 10) === 1,
                efficiency: weight >= 5 ? parseFloat(parts[2]) : Math.pow(parseFloat(parts[2]), weight) * parseFloat(parts[3]),
                selected: 0
            };
        }).filter(route => !isNaN(route.monsterCount) && route.monsterCount > 0 && Number.isInteger(route.monsterCount));

        const sortedPathingFiles = [...pathingFiles];
        sortedPathingFiles.sort((a, b) => b.efficiency - a.efficiency || a.monsterCount - b.monsterCount);

        for (const route of sortedPathingFiles) {
            routeIndex++; // 每次循环时递增
            const meetsKeywordCondition = exclusionKeywordsArray.every(keyword => !route.name.toLowerCase().includes(keyword));
            const meetsWaterFreeCondition = !excludeWaterFree || !route.isWaterFree;
            const meetsHighRiskCondition = !excludeHighRisk || !route.isHighRisk;

            // 修改后的日志输出，增加当前路线的序号
            log.debug(`筛选路线 ${routeIndex}（${route.name}）：关键词条件 ${meetsKeywordCondition}，水免条件 ${meetsWaterFreeCondition}，高危条件 ${meetsHighRiskCondition}`);

            if (meetsKeywordCondition && meetsWaterFreeCondition && meetsHighRiskCondition) {
                totalMonsterCount += route.monsterCount;
                route.selected = 1;
                selectedRoutes.push(route.name);
                if (totalMonsterCount >= requiredMonsterCount) break;
            }
        }


        if (totalMonsterCount < requiredMonsterCount) {
            log.warn(`数量不足，最多可以包含 ${totalMonsterCount} 只怪物，不满足所需的 ${requiredMonsterCount} 只怪物`);
        }

        // 根据操作模式执行相应的操作
        if (operationMode === "生成路径文件") {
            // 使用 outputFolderName 作为路径组文件的名称，并添加 .txt 扩展名
            const pathGroupName = `${outputFolderName}.txt`;
            const pathGroupFilePath = `route/${pathGroupName}`;


            // 初始化CD信息的时间戳
            const initialCDTimestamp = "::2000-01-01T00:00:00.000Z";

            // 按照 index.txt 中的顺序依次检验每个路线是否需要写入文件
            const resultContent = pathingFiles
                .filter(route => selectedRoutes.includes(route.name))
                .map(route => `${route.name}${initialCDTimestamp}`)
                .join('\n');

            await file.writeText(pathGroupFilePath, resultContent);
            log.info(`生成成功，共计 ${selectedRoutes.length} 条路线，路径组文件已保存到 ${pathGroupFilePath}，请将js自定义配置中操作模式改为执行路径文件以执行`);
        } else if (operationMode === "输出地图追踪文件") {
            const pathingOutDir = `pathingout/${outputFolderName}/`; // 输出文件夹路径

            // 将选中的地图追踪文件复制到对应的输出文件夹
            for (const routeName of selectedRoutes) {
                const sourceFilePath = `${pathingDir}${routeName}.json`;
                const targetFilePath = `${pathingOutDir}${routeName}.json`;
                try {
                    const fileContent = await file.readText(sourceFilePath);
                    await file.writeText(targetFilePath, fileContent);
                    // log.debug(`文件 ${routeName}.json 已复制到 ${pathingOutDir}`);
                    successCount++;
                } catch (error) {
                    log.warn(`复制文件 ${routeName}.json 时出错: ${error}`);
                    failCount++;
                }
            }

            log.info(`筛选完成，共计 ${selectedRoutes.length} 条路线。`);
            log.info(`文件复制完成：成功 ${successCount} 个，失败 ${failCount} 个。`);
        }
    } catch (error) {
        log.error(`读取路径文件索引文件 ${indexPath} 时出错: ${error}`);
    }

    log.info('脚本执行完成');
})();
