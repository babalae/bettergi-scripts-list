(async function () {
    const woodType = ["桦木","萃华木","松木","垂香木","杉木","竹节","却砂木","梦见木","枫木","孔雀木","御伽木","证悟木","业果木","辉木","刺葵木","柽木","悬铃木","椴木","白梣木","香柏木","白栗栎木","燃爆木","灰灰楼林木"];
    const singleWoodType = ["桦木","松木","杉木","竹节","却砂木","梦见木","枫木","孔雀木","御伽木","证悟木","业果木","辉木","刺葵木","柽木","白梣木","白栗栎木","燃爆木","灰灰楼林木"];

    const woodNumberMap = new Map(woodType.map(key => [key, 0]));
    let woodNumberMapCopy = new Map();

    // 用于求解 垂香木-萃华木-香柏木 路线次数的线性规划求解器, 暴力求解，加一点点剪枝.
    function lpsolve1(y1,y2,y3) {
        let x1max = Math.ceil(y1 / 48);
        let x2max = Math.ceil(y2 / 48);
        let x3max = Math.ceil(y2 / 15);
        let bestObjectiveValue = Infinity;
        let bestSolution;
        let x1, x2, x3, x4, v1, v2, v3, v4;
        for (x1 = 0, v1 = 57*x1; x1 <= x1max && v1 < bestObjectiveValue; x1++, v1 += 57) {
            for (x2 = Math.max(Math.ceil((y1-48*x1)/9), 0), v2 = v1 + 191*x2; x2 <= x2max && v2 < bestObjectiveValue; x2++, v2 += 191) {
                for (x3 = Math.max(Math.ceil((y2-6*x1-48*x2)/15),0), v3 = v2 + 59*x3; x3 <= x3max && v3 < bestObjectiveValue; x3++, v3 += 59) {
                    x4 = Math.max(Math.ceil((y3-9*x2-27*x3)/72),0);
                    v4 = v3 + 49*x4;
                    if (v4 < bestObjectiveValue) {
                        bestObjectiveValue = v4;
                        bestSolution = [ x1, x2, x3, x4 ];
                        break;
                    }
                }
            }
        }
        return bestSolution;
    }

    // 求解 悬铃木-椴木 路线次数.
    function lpsolve2(y1,y2) {
        y1 = Math.max(y1,0);
        y2 = Math.max(y2,0);
        if (30*y1 > 42*y2) {
            return [Math.ceil(y1 / 42), 0];
        } else if (30* y1 < 27*y2) {
            return [0, Math.ceil(y2 / 30)];
        } else {
            return [Math.ceil((10*y1-9*y2)/150), Math.ceil((14*y2-10*y1)/150)];
        }
    }

    function logRemainingItems() {
        let target = woodCountToStr(woodNumberMap);
        if (target === '') {
            const woodNumberMapCopyObj = Object.fromEntries(woodNumberMapCopy);
            const differenceMap = new Map([...woodNumberMap].map(([key, value]) => {
                return [key, woodNumberMapCopyObj[key]- value];
            }));
            log.info(`自动伐木运行结束, 总共获得${woodCountToStr(differenceMap)}`);
        } else {
            log.info(`剩余${target}`);
        }
    }

    function woodCountToStr(woodCount, n=1) {
        let result = '';
        for (let [key, value] of woodCount) {
            if (value > 0) {
                result += ` ${key}:${Math.min(value * n, 2000)}`;
            }
        }
        return result;
    }

    async function runPathingNTimes(pathingName, wood, n = null) {
        if ((n === null && woodNumberMap.get(wood) <= 0) || (n !== null && n <= 0)) {
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
                await pathingScript.runFile(filePath);
                log.info(`完成 ${pathingName} 大循环路径, 获得${woodCountToStr(woodCount)}`);
                woodCount.forEach((value, key) => {woodNumberMap.set(key, woodNumberMap.get(key)-value)});
            } catch (error) {
                log.error(`在砍伐 ${pathingName} 时发生错误: ${error}`);
            }
            woodCount = pathing.fileName.slice(-pathing.fileName.length+1).reduce((accumulator, currentValue) => {
                return filenameToWoodCountMap(currentValue, accumulator);
            }, new Map());
            j = 1;
        } else if (pathing.fileName.length > 1) {
            woodCount = pathing.fileName.slice(-pathing.fileName.length+1).reduce((accumulator, currentValue) => {
                return filenameToWoodCountMap(currentValue, accumulator);
            }, woodCount);
        }
        if (n === null) {
            if (!woodCount.has(wood) || woodCount.get(wood) === 0) {
                log.info(`${wood} 路线设置或命名错误`);
                return;
            } else {
                n = Math.ceil(woodNumberMap.get(wood) / woodCount.get(wood));
            }
        }
        try {
            for (let i = 0; i < n; i++) {
                log.info(`正在执行 ${pathingName} 第 ${i+1}/${n} 次循环`);
                for (let k = j; k < pathing.fileName.length; k++) {
                    filePath = filePathPre + pathing.fileName[k] + filePathSuf;
                    await pathingScript.runFile(filePath);
                }
                log.info(`${pathingName} 第 ${i+1}/${n} 次循环执行完成`);
                logTimeTaken(startTime);
            }
            log.info(`完成 ${pathingName} 循环路径, 获得${woodCountToStr(woodCount, n)}`);
            logTimeTaken(startTime);
            woodCount.forEach((value, key) => {
                woodNumberMap.set(key, woodNumberMap.get(key)-value*n);});
            log.info(`${pathingName} 伐木完成，将执行下一个`);
            logTimeTaken(startTime);
            logRemainingItems();
        } catch (error) {
            log.error(`在砍伐 ${pathingName} 时发生错误: ${error}`);
        }
    }

    async function woodCutting() {
        logRemainingItems();
        await sleep(1000);
        if (woodNumberMap.get('萃华木') > 0) {
            let [x1,x2,x3,x4] = lpsolve1(woodNumberMap.get('垂香木'),woodNumberMap.get('萃华木'),woodNumberMap.get('香柏木'));
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
            let [x1,x2] = lpsolve2(woodNumberMap.get('悬铃木'),woodNumberMap.get('椴木'));
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
        let num = numbers.length === 0 ? 2000 : numbers.length === 1 ? Math.min(Math.ceil(numbers[0] / (hasItto? 1.2 : 1)), 2000) : null;
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
                log.info(`${unsupportedWoods.join(", ")} 暂不支持`);
            }
            woodNumberMapCopy = new Map([...woodNumberMap]);
        }
    }

    function filenameToWoodCountMap(str, woodCount = new Map()) {
        let strArray = str.split("-").filter(str => str.trim() !== "");
        for (let i = 0; i < strArray.length-1; i++) {
            if (woodType.includes(strArray[i])) {
                count = Number(strArray[i+1].replace(/[^\d]/g, ''));
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

    function logTimeTaken(startTime) {
        const currentTime = Date.now();
        const totalTimeInSeconds = (currentTime - startTime) / 1000;
        const minutes = Math.floor(totalTimeInSeconds / 60);
        const seconds = totalTimeInSeconds % 60;
        const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
        log.info(`当前运行总时长：${formattedTime}`);
    }

    // Set game environment settings
    const startTime = Date.now();
    setGameMetrics(1920, 1080, 1);
    //修改路线：除了 垂香木-萃华木-香柏木，悬铃木-椴木 以外，其他木材基本都是单独路线，可以替换 \assets\AutoPath 中的路径追踪脚本，然后修改 pathingMap 中的文件名即可。
    // pathingMap 为木材路径追踪文件路径列表, 键名可以随意命名, 值的 fileName 属性为路线包含路径追踪文件名列表, 文件夹为'assets/AutoPath/', 如果还有子文件夹请添加 folderName 属性. 如果 fileName 数组中有两项以上, 并且第一个文件名包含 '大循环', 则会先执行一次大循环, 剩余的文件名视为循环路径, 将在每次循环中依次执行.
    // 因为要根据文件名来计算循环次数, 所以文件命名必须包含 '木材种类1-数量1-木材种类2-数量2-...', 说明此文件路线中采集的木材种类和数目. 如果没有采集木材(比如单纯跑路的大循环)也请至少添加一种类型, 数量可以填0.
    // 文件名中的木材种类见 woodType 数组, 与游戏保持一致, 数量可以只填数字, 地址和时间等其他信息可以不填, 分隔符用 '-'. 
    const pathingMap = {
        '桦木':   { fileName: ['蒙德-星落湖-桦木-75个-54秒']},
        '萃华木': { fileName: ['萃华木-48个-松木-3-垂香木-9-御伽木-9-香柏木-9-191秒']},
        '松木':   { fileName: ['蒙德-蒙德城-松木-0个(大循环)', '蒙德-蒙德城-松木-48个-43秒(循环)'], folderName: '蒙德-松木'},
        '却砂木': { fileName: ['璃月-归离原-却砂木-39个(大循环)', '璃月-归离原-却砂木-39个(循环)'], folderName: '璃月-却砂木'},
        '竹节':   { fileName: ['璃月-轻策庄-竹节-0个(大循环)', '璃月-轻策庄-竹节-78个-29秒(循环)'], folderName: '璃月-竹节'},
        '垂香木': { fileName: ['蒙德-风起地-垂香木-48个-萃华木-6个-57秒']},
        '杉木':   { fileName: ['蒙德-达达乌帕谷-杉木-0个(大循环)', '蒙德-达达乌帕谷-杉木-69个-58秒(循环)'], folderName: '蒙德-杉木'},
        '梦见木': { fileName: ['稻妻-甘金岛-梦见木-0个(大循环)', '稻妻-甘金岛-梦见木-45个(循环)'], folderName: '稻妻-梦见木'},
        '枫木':   { fileName: ['稻妻-绯木村-枫木-42个-83秒']},
        '孔雀木': { fileName: ['稻妻-镇守之森-孔雀木-51个-御伽木-9个-萃华木-3个-60秒']},
        '御伽木': { fileName: ['稻妻-水月池-御伽木-18个-90秒(大循环)', '稻妻-水月池-御伽木-57个-64秒(循环)'], folderName: '稻妻-御伽木'},
        '辉木':   { fileName: ['须弥-禅那园-辉木-0个(大循环)', '须弥-禅那园-辉木-48个-29秒(循环)'], folderName: '须弥-辉木'},
        '业果木': { fileName: ['须弥-禅那园-业果木-12个-证悟木-3个(大循环)', '须弥-禅那园-业果木-42个-辉木-12个-23秒(循环)'], folderName: '须弥-业果木'},
        '证悟木': { fileName: ['须弥-禅那园-证悟木-3个-业果木-6个-辉木-3个(大循环)', '须弥-禅那园-证悟木-57个-业果木-24个-62秒(循环)'], folderName: '须弥-证悟木'},
        '刺葵木': { fileName: ['须弥-上下风蚀地-刺葵木-42个']},
        '柽木':   { fileName: ['须弥-阿如村-柽木-42个-65秒']}, 
        '悬铃木-椴木-大循环': {fileName: ['枫丹-卡布狄斯堡遗迹-悬铃木-51个-椴木-33个(大循环)'], folderName: '枫丹-悬铃木-椴木'},
        '悬铃木': { fileName: ['枫丹-卡布狄斯堡遗迹-悬铃木-42个-椴木-30个(循环)'], folderName: '枫丹-悬铃木-椴木'},
        '椴木':   { fileName: ['枫丹-卡布狄斯堡遗迹-悬铃木-27个-椴木-30个(小循环)'], folderName: '枫丹-悬铃木-椴木'},
        '白梣木': { fileName: ['枫丹-苍晶区-白梣木-75个(大循环)', '枫丹-苍晶区-白梣木-75个(循环)'], folderName: '枫丹-白梣木'},
        '香柏木': { fileName: ['枫丹-秋分山西侧-香柏木-0个(大循环)', '枫丹-秋分山西侧-香柏木-72个-49秒(循环)'], folderName: '枫丹-香柏木'},
        // '炬木':  { description: '炬木15个', times: 134 },
        '白栗栎木': { fileName: ['纳塔-踞石山-白栗栎木-36个', '纳塔-回声之子-白栗栎木-33个-燃爆木-27个'], folderName: '纳塔-白栗栎木-燃爆木'},
        '灰灰楼林木': { fileName: ['纳塔-奥奇卡纳塔-灰灰楼林木-42个-79秒']},
        '燃爆木': { fileName: ['纳塔-隆崛坡-燃爆木-54个-105秒']},
        '香柏木-萃华木': { fileName: ['枫丹-枫丹廷-香柏木-9个(大循环)', '枫丹-枫丹廷-香柏木-27个-萃华木-15个-59秒(循环)'], folderName: '枫丹-香柏木-萃华木'},
        // '桃椰子木': { description: '桃椰子木12个', times: 167 }
    };

    const messages = [
        '确保装备有[王树瑞佑]',
        '确保使用小道具快捷键为Z键',
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(500);
    }

    log.info('自动伐木开始...');

    let woodsArray = settings.woods? settings.woods.split(/\s+/): [];
    let numbersArray = settings.numbers? settings.numbers.split(/\s+/).map(Number).map(num => isNaN(num) ? 0 : num): [];
    let hasItto = settings.hasItto? settings.hasItto : false; 
    mapWoodsToNumbers(woodsArray, numbersArray, hasItto);
    await woodCutting();
})();