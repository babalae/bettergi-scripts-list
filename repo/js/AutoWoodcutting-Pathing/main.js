(async function () {
    // 用于求解 垂香木-萃华木-香柏木 路线次数的线性规划求解器, 暴力求解，加一点点剪枝.
    function lpsolve1(y1, y2, y3) {
        let x1max = Math.ceil(y1 / 48);
        let x2max = Math.ceil(y2 / 48);
        let x3max = Math.ceil(y2 / 15);
        let bestObjectiveValue = Infinity;
        let bestSolution;
        let x1, x2, x3, x4, v1, v2, v3, v4;
        for (x1 = 0, v1 = 57 * x1; x1 <= x1max && v1 < bestObjectiveValue; x1++, v1 += 57) {
            for (x2 = Math.max(Math.ceil((y1 - 48 * x1) / 9), 0), v2 = v1 + 191 * x2; x2 <= x2max && v2 < bestObjectiveValue; x2++, v2 += 191) {
                for (x3 = Math.max(Math.ceil((y2 - 6 * x1 - 48 * x2) / 15), 0), v3 = v2 + 59 * x3; x3 <= x3max && v3 < bestObjectiveValue; x3++, v3 += 59) {
                    x4 = Math.max(Math.ceil((y3 - 9 * x2 - 27 * x3) / 72), 0);
                    v4 = v3 + 49 * x4;
                    if (v4 < bestObjectiveValue) {
                        bestObjectiveValue = v4;
                        bestSolution = [x1, x2, x3, x4];
                        break;
                    }
                }
            }
        }
        return bestSolution;
    }

    // 求解 悬铃木-椴木 路线次数.
    function lpsolve2(y1, y2) {
        y1 = Math.max(y1, 0);
        y2 = Math.max(y2, 0);
        if (30 * y1 > 42 * y2) {
            return [Math.ceil(y1 / 42), 0];
        } else if (30 * y1 < 27 * y2) {
            return [0, Math.ceil(y2 / 30)];
        } else {
            return [Math.ceil((10 * y1 - 9 * y2) / 150), Math.ceil((14 * y2 - 10 * y1) / 150)];
        }
    }

    function logRemainingItems() {
        let target = woodCountToStr(woodNumberMap);
        if (target === '') {
            const woodNumberMapCopyObj = Object.fromEntries(woodNumberMapCopy);
            const differenceMap = new Map([...woodNumberMap].map(([key, value]) => {
                return [key, woodNumberMapCopyObj[key] - value];
            }));
            log.info(`自动伐木运行结束, 总共获得${woodCountToStr(differenceMap)}`);
        } else {
            log.info(`剩余${target}`);
        }
    }

    function woodCountToStr(woodCount, runTimes = 1) {
        let result = '';
        for (let [key, value] of woodCount) {
            if (value > 0) {
                result += ` ${key}:${Math.min(value * runTimes, 2000)}`;
            }
        }
        return result;
    }

    async function runPathingNTimes(pathingName, wood, runTimes = null) {
        if ((runTimes === null && woodNumberMap.get(wood) <= 0) || (runTimes !== null && runTimes <= 0)) {
            return;
        }
        let filePathPre = 'assets/AutoPath/';
        let filePathSuf = '.json';
        let pathing = pathingMap[pathingName];
        if ('folderName' in pathing) {
            filePathPre += pathing.folderName + '/';
        }
        log.info(`砍伐 ${pathingName}`);
        let filePath = filePathPre + pathing.fileName[0] + filePathSuf;
        let woodCount = filenameToWoodCountMap(pathing.fileName[0]);
        let j = 0;
        if (pathing.fileName.length > 1 && pathing.fileName[0].includes('大循环')) {
            try {
                log.info(`正在执行 ${pathingName} 大循环路径`);
                await fakeLog(`${pathing.fileName[0]}`, false, true, 0);
                await pathingScript.runFile(filePath);
                await fakeLog(`${pathing.fileName[0]}`, false, false, 0);
                await sleep(1);
                log.info(`完成 ${pathingName} 大循环路径, 获得${woodCountToStr(woodCount)}`);
                woodCount.forEach((value, key) => { woodNumberMap.set(key, woodNumberMap.get(key) - value) });
            } catch (error) {
                log.error(`在砍伐 ${pathingName} 时发生错误: ${error}`);
            }
            woodCount = pathing.fileName.slice(-pathing.fileName.length + 1).reduce((accumulator, currentValue) => {
                return filenameToWoodCountMap(currentValue, accumulator);
            }, new Map());
            j = 1;
        } else if (pathing.fileName.length > 1) {
            woodCount = pathing.fileName.slice(-pathing.fileName.length + 1).reduce((accumulator, currentValue) => {
                return filenameToWoodCountMap(currentValue, accumulator);
            }, woodCount);
        }
        if (runTimes === null) {
            if (!woodCount.has(wood) || woodCount.get(wood) === 0) {
                log.info(`${wood} 路线设置或命名错误`);
                return;
            } else {
                runTimes = Math.ceil(woodNumberMap.get(wood) / woodCount.get(wood));
            }
        }
        await sleep(1);
        try {
            const currentWoodStartTime = Date.now();
            for (let i = 0; i < runTimes; i++) {
                log.info(`正在执行 ${pathingName} 第 ${i + 1}/${runTimes} 次循环`);
                for (let k = j; k < pathing.fileName.length; k++) {
                    filePath = filePathPre + pathing.fileName[k] + filePathSuf;
                    await fakeLog(`${pathing.fileName}`, false, true, 0);
                    await pathingScript.runFile(filePath);
                    await fakeLog(`${pathing.fileName}`, false, false, 0);
                    await sleep(1);
                }
                const jsTimeTaken = logTimeTaken(startTime);
                const estimatedCompletion = calculateEstimatedCompletion(currentWoodStartTime, i + 1, runTimes);
                log.info(`${pathingName} 第 ${i + 1}/${runTimes} 次循环执行完成`);
                log.info(`${pathingName} 预计完成时间: ${estimatedCompletion}, ${jsTimeTaken}`)
            }
            const jsTimeTaken = logTimeTaken(startTime);
            log.info(`完成 ${pathingName} 循环路径, 获得${woodCountToStr(woodCount, runTimes)}, ${jsTimeTaken}`);
            woodCount.forEach((value, key) => {
                woodNumberMap.set(key, woodNumberMap.get(key) - value * runTimes);
            });
            log.info(`${pathingName} 伐木完成, 将执行下一个`);
            logRemainingItems();
        } catch (error) {
            log.error(`在砍伐 ${pathingName} 时发生错误: ${error}`);
        }
    }

    async function woodCutting() {
        logRemainingItems();
        await sleep(1000);
        if (woodNumberMap.get('萃华木') > 0 && woodNumberMap.get('香柏木') > 0) {
            let [x1, x2, x3, x4] = lpsolve1(woodNumberMap.get('垂香木'), woodNumberMap.get('萃华木'), woodNumberMap.get('香柏木'));
            await runPathingNTimes('垂香木', '垂香木', x1);
            await runPathingNTimes('萃华木', '萃华木', x2);
            await runPathingNTimes('香柏木-萃华木', '香柏木', x3);
            await runPathingNTimes('香柏木', '香柏木', x4);
        } else {
            for (let wood of ['垂香木', '香柏木']) {
                await runPathingNTimes(wood, wood);
            }
        }

        if (woodNumberMap.get('悬铃木') > 0 || woodNumberMap.get('椴木') > 0) {
            await runPathingNTimes('悬铃木-椴木-大循环', '', 1);
            let [x1, x2] = lpsolve2(woodNumberMap.get('悬铃木'), woodNumberMap.get('椴木'));
            await runPathingNTimes('悬铃木', '悬铃木', x1);
            await runPathingNTimes('椴木', '椴木', x2);
        }

        for (let wood of singleWoodType) {
            await runPathingNTimes(wood, wood);
        }
    }

    // 如果没有填木材数组默认是全部木材, 如果没有填数量数组默认 2000, 如果数量数组只填了一个数, 那么默认全都刷取这个数目. 
    // 如果木材数组有重复项，或木材数组与数量数组不匹配，都直接退出.
    function mapWoodsToNumbers(woods, numbers, hasItto) {
        if ((new Set(woods)).size !== woods.length) {
            log.error('木材数组存在重复项');
            return;
        }
        let num = numbers.length === 0 ? 2000 : numbers.length === 1 ? Math.min(Math.ceil(numbers[0] / (hasItto ? 1.2 : 1)), 2000) : null;
        if (woods.length === 0) {
            if (num === null) {
                log.error('请在自定义选项输入木材名，用空格隔开');
            } else {
                woodNumberMap.forEach((_, key) => {
                    woodNumberMap.set(key, num);
                });
            }
        } else {
            let unsupportedWoods = [];
            if (num === null) {
                if (woods.length !== numbers.length) {
                    log.error('木材数组长度与数量数组长度不匹配');
                } else {
                    woods.forEach((key, index) => {
                        if (woodNumberMap.has(key)) {
                            woodNumberMap.set(key, numbers[index]);
                        } else {
                            unsupportedWoods.push(key);
                        }
                    });
                }
            } else {
                woods.forEach(key => {
                    if (woodNumberMap.has(key)) {
                        woodNumberMap.set(key, num);
                    } else {
                        unsupportedWoods.push(key);
                    }
                });
            }
            if (unsupportedWoods.length !== 0) {
                log.warn(`${unsupportedWoods.join(", ")} 暂不支持`);
            }
            woodNumberMapCopy = new Map([...woodNumberMap]);
        }
    }

    function filenameToWoodCountMap(str, woodCount = new Map()) {
        let strArray = str.split("-").filter(str => str.trim() !== "");
        for (let i = 0; i < strArray.length - 1; i++) {
            if (woodType.includes(strArray[i])) {
                count = Number(strArray[i + 1].replace(/[^\d]/g, ''));
                if (count !== 0) {
                    if (woodCount.has(strArray[i])) {
                        woodCount.set(strArray[i], count + woodCount.get(strArray[i]));
                    } else {
                        woodCount.set(strArray[i], count);
                    }
                    i++;
                }
            }
        }
        return woodCount;
    }

    async function theElderTree() {
        let theElderTreeStatus = false;
        click(960, 480);
        await genshin.returnMainUi();
        keyDown("VK_Z");
        await sleep(1500)
        keyUp("VK_Z");
        const ro = captureGameRegion();
        let theBoonOfTheElderTree = ro.find(RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/The Boon of the Elder Tree.png"), 550, 450, 900, 300));
        ro.dispose();
        if (theBoonOfTheElderTree.isExist()) {
            log.info("识别到王树瑞佑");
            theBoonOfTheElderTree.click();
            theElderTreeStatus = true;
        }
        else {
            theElderTreeStatus = false;
            notification.error(`未装备有王树瑞佑，伐木结束`);
        }
        return theElderTreeStatus
    }

    // 调用BGI任务读取背包中的木材数量并返回
    async function woodInventory(woodsArray, numbersArray, woodInventoryNumber) {
        log.info("先别急，先别动键盘鼠标，要去一个神秘的地方");
        await genshin.Tp(1581.11, -112.45, "Enkanomiya", true);
        await moveMouseBy(0, -114514);
        await moveMouseBy(0, -1919810);
        await sleep(1000);
        if (woodsArray.length === 0) {
            var resultDict = await dispatcher.runTask(new SoloTask("CountInventoryItem", { "gridScreenName": "Materials", "itemNames": woodType }));
        } else {
            var resultDict = await dispatcher.runTask(new SoloTask("CountInventoryItem", { "gridScreenName": "Materials", "itemNames": woodsArray }));
        }

        const keys = [];
        const values = [];

        try {
            for (const [key, value] of Object.entries(resultDict)) {
                // 尝试将值转换为数字
                const numValue = Number(value);

                // 检查是否为有效数字（NaN 表示不是数字）
                if (isNaN(numValue)) {
                    console.warn(`跳过无效值: key=${key}, value=${value}`);
                    continue;
                }

                // 执行计算逻辑
                const diff = Math.min(woodInventoryNumber, 9999) - numValue; // 限制不超过背包上限
                const result = diff > 0 ? diff : 0;

                keys.push(key);
                values.push(result);
            }
            // log.info("成功检测到的木材" + keys.join(","));
            // log.info("成功检测到的木材砍伐数量" + values.join(","));
            if (keys.length === 0) {
                log.warn("未识别到任何木材，使用预设数据");
                return [woodsArray, numbersArray];
            } else {
                return [keys, values];
            }
        } catch (err) {
            log.warn("处理故障，使用预设数据")
            return [woodsArray, numbersArray];
        }
    }

    function logTimeTaken(startTime) {
        const currentTime = Date.now();
        const totalTimeInSeconds = (currentTime - startTime) / 1000;
        const minutes = Math.floor(totalTimeInSeconds / 60);
        const seconds = totalTimeInSeconds % 60;
        const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
        return `当前运行总时长: ${formattedTime}`;
    }

    function calculateEstimatedCompletion(startTime, current, total) {
        if (current === 0) return "计算中...";
        const elapsedTime = Date.now() - startTime;
        const timePerTask = elapsedTime / current;
        const remainingTasks = total - current;
        const remainingTime = timePerTask * remainingTasks;
        const completionDate = new Date(Date.now() + remainingTime);
        return `${completionDate.toLocaleTimeString()}, 约 ${Math.round(remainingTime / 60000)} 分钟`;
    }

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

    const woodType = ["桦木", "萃华木", "松木", "却砂木", "竹节", "垂香木", "杉木", "梦见木", "枫木", "孔雀木", "御伽木", "辉木", "业果木", "证悟木", "刺葵木", "柽木", "悬铃木", "椴木", "白梣木", "香柏木", "炬木", "白栗栎木", "灰灰楼林木", "燃爆木", "桃椰子木", "银冷杉木", "榛木", "夏栎木", "桤木"];
    const singleWoodType = ["桦木", "萃华木", "松木", "杉木", "竹节", "却砂木", "梦见木", "枫木", "孔雀木", "御伽木", "证悟木", "业果木", "辉木", "刺葵木", "柽木", "白梣木", "炬木", "白栗栎木", "燃爆木", "灰灰楼林木", "桃椰子木", "银冷杉木", "榛木", "夏栎木", "桤木"];

    const woodNumberMap = new Map(woodType.map(key => [key, 0]));
    let woodNumberMapCopy = new Map();

    // 修改路线：除了 垂香木-萃华木-香柏木，悬铃木-椴木 以外，其他木材基本都是单独路线，可以替换 \assets\AutoPath 中的路径追踪脚本，然后修改 pathingMap 中的文件名即可。
    // pathingMap 为木材路径追踪文件路径列表, 键名可以随意命名, 值的 fileName 属性为路线包含路径追踪文件名列表, 文件夹为'assets/AutoPath/', 如果还有子文件夹请添加 folderName 属性. 如果 fileName 数组中有两项以上, 并且第一个文件名包含 '大循环', 则会先执行一次大循环, 剩余的文件名视为循环路径, 将在每次循环中依次执行.
    // 因为要根据文件名来计算循环次数, 所以文件命名必须包含 '木材种类1-数量1-木材种类2-数量2-...', 说明此文件路线中采集的木材种类和数目. 如果没有采集木材(比如单纯跑路的大循环)也请至少添加一种类型, 数量可以填0.
    // 文件名中的木材种类见 woodType 数组, 与游戏保持一致, 数量可以只填数字, 地址和时间等其他信息可以不填, 分隔符用 '-'. 
    const pathingMap = {
        '桦木': { fileName: ['蒙德-星落湖-桦木-75个'] },
        '萃华木': { fileName: ['萃华木-48个-松木-3-垂香木-9-御伽木-9-香柏木-9'] },
        '松木': { fileName: ['蒙德-蒙德城-松木-0个(大循环)', '蒙德-蒙德城-松木-48个(循环)'], folderName: '蒙德-松木' },
        '却砂木': { fileName: ['璃月-归离原-却砂木-0个(大循环)', '璃月-归离原-却砂木-39个(循环)'], folderName: '璃月-却砂木' },
        '竹节': { fileName: ['璃月-轻策庄-竹节-0个(大循环)', '璃月-轻策庄-竹节-78个(循环)'], folderName: '璃月-竹节' },
        '垂香木': { fileName: ['蒙德-风起地-垂香木-48个-萃华木-6个'] },
        '杉木': { fileName: ['蒙德-达达乌帕谷-杉木-0个(大循环)', '蒙德-达达乌帕谷-杉木-69个(循环)'], folderName: '蒙德-杉木' },
        '梦见木': { fileName: ['稻妻-甘金岛-梦见木-0个(大循环)', '稻妻-甘金岛-梦见木-45个(循环)'], folderName: '稻妻-梦见木' },
        '枫木': { fileName: ['稻妻-绯木村-枫木-42个'] },
        '孔雀木': { fileName: ['稻妻-镇守之森-孔雀木-51个-御伽木-9个-萃华木-3个'] },
        '御伽木': { fileName: ['稻妻-水月池-御伽木-18个(大循环)', '稻妻-水月池-御伽木-57个(循环)'], folderName: '稻妻-御伽木' },
        '辉木': { fileName: ['须弥-禅那园-辉木-0个(大循环)', '须弥-禅那园-辉木-48个(循环)'], folderName: '须弥-辉木' },
        '业果木': { fileName: ['须弥-禅那园-业果木-12个-证悟木-3个(大循环)', '须弥-禅那园-业果木-42个-辉木-12个(循环)'], folderName: '须弥-业果木' },
        '证悟木': { fileName: ['须弥-禅那园-证悟木-3个-业果木-6个-辉木-3个(大循环)', '须弥-禅那园-证悟木-57个-业果木-24个(循环)'], folderName: '须弥-证悟木' },
        '刺葵木': { fileName: ['须弥-上下风蚀地-刺葵木-42个'] },
        '柽木': { fileName: ['须弥-阿如村-柽木-42个'] },
        '悬铃木-椴木-大循环': { fileName: ['枫丹-卡布狄斯堡遗迹-悬铃木-51个-椴木-33个(大循环)'], folderName: '枫丹-悬铃木-椴木' },
        '悬铃木': { fileName: ['枫丹-卡布狄斯堡遗迹-悬铃木-42个-椴木-30个(循环)'], folderName: '枫丹-悬铃木-椴木' },
        '椴木': { fileName: ['枫丹-卡布狄斯堡遗迹-悬铃木-27个-椴木-30个(小循环)'], folderName: '枫丹-悬铃木-椴木' },
        '白梣木': { fileName: ['枫丹-苍晶区-白梣木-0个(大循环)', '枫丹-苍晶区-白梣木-75个(循环)'], folderName: '枫丹-白梣木' },
        '香柏木': { fileName: ['枫丹-秋分山西侧-香柏木-0个(大循环)', '枫丹-秋分山西侧-香柏木-72个(循环)'], folderName: '枫丹-香柏木' },
        '香柏木-萃华木': { fileName: ['枫丹-枫丹廷-香柏木-9个(大循环)', '枫丹-枫丹廷-香柏木-27个-萃华木-15个(循环)'], folderName: '枫丹-香柏木-萃华木' },
        '炬木': { fileName: ['枫丹-很明亮的地方-炬木-36个'] },
        // '炬木': { fileName: ['枫丹-很明亮的地方-炬木-36个(大循环)', '枫丹-很明亮的地方-炬木-36个(循环)'], folderName: '枫丹-炬木' },
        '白栗栎木': { fileName: ['纳塔-踞石山-白栗栎木-36个', '纳塔-回声之子-白栗栎木-33个-燃爆木-27个'], folderName: '纳塔-白栗栎木-燃爆木' },
        '灰灰楼林木': { fileName: ['纳塔-奥奇卡纳塔-灰灰楼林木-42个'] },
        '燃爆木': { fileName: ['纳塔-隆崛坡-燃爆木-54个'] },
        // '桃椰子木': { fileName: ['纳塔-浮土静界-桃椰子木-0个(大循环)', '纳塔-浮土静界-桃椰子木-36个(循环)'], folderName: '纳塔-桃椰子木' },
        '桃椰子木': { fileName: ['纳塔-浮土静界-桃椰子木-42个'], folderName: '纳塔-桃椰子木' },
        '银冷杉木': { fileName: ['挪德卡莱-霜月之坊-银冷杉木-54个'] },
        // '榛木': { fileName: ['挪德卡莱-月矩力试验设计局-榛木-57个(稳定)'], folderName: '挪德卡莱-榛木' },
        // '榛木': { fileName: ['挪德卡莱-月矩力试验设计局-榛木-57个(月灵)'], folderName: '挪德卡莱-榛木' },
        '榛木': { fileName: ['挪德卡莱-月矩力试验设计局-榛木-57个(月灵)', '挪德卡莱-月矩力试验设计局-榛木-57个(稳定)'], folderName: '挪德卡莱-榛木' },
        '夏栎木': { fileName: ['挪德卡莱-苔原之隙-夏栎木-0个(大循环)', '挪德卡莱-苔原之隙-夏栎木-36个(循环)'], folderName: '挪德卡莱-夏栎木' },
        '桤木': { fileName: ['挪德卡莱-伦波岛-桤木-87个'] }
    };

    const messages = [
        '确保装备有[王树瑞佑]',
        '确保使用小道具快捷键为Z键',
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(500);
    }

    const startTime = Date.now();
    // 分别将填入的木材名称和数量转成数组
    let woodsArray = settings.woods ? settings.woods.split(/\s+/) : [];
    let numbersArray = settings.numbers ? settings.numbers.split(/\s+/).map(Number).map(num => isNaN(num) ? 0 : num) : [];
    let woodInventoryNumber = settings.woodInventoryNumber ? (isNaN(settings.woodInventoryNumber) ? 2000 : settings.woodInventoryNumber) : 2000;
    let hasItto = settings.hasItto ? settings.hasItto : false;
    let theBoonOfTheElderTreeStatus = settings.theBoonOfTheElderTree ? await theElderTree() : true;
    // 判断是否装备王树瑞佑，如果未装备则跳过伐木
    if (theBoonOfTheElderTreeStatus) {
        // 判断是否开启背包检测，如果未开启或识别失败，则使用设置填入的数据或默认数据
        let [woodsInventory, woodCountInventory] = settings.woodInventory ? await woodInventory(woodsArray, numbersArray, woodInventoryNumber) : [woodsArray, numbersArray];

        // 将识别到的木材种类和所需数量转换为映射表，并计算需要砍伐的次数
        mapWoodsToNumbers(woodsInventory, woodCountInventory, hasItto);
        log.info('自动伐木开始...');
        await woodCutting();
    } else {
        log.error("未装备有王树瑞佑，伐木结束")
    }

})();
