// 主函数
(async function () {
    await fakeLog("提瓦特扫描仪", true, true, 0);
    //去七天神像切换到可战斗配队
    await genshin.tpToStatueOfTheSeven();
    await switchPartyIfNeeded(settings.partyName);
    //文件处理
    const pathFolder = "pathing";
    const paths = await readFolder(pathFolder, true);

    for (let i = 0; i < 30; i++) {
        if (await isCompassFree(1)) {
            keyPress("Z");
            break;
        } else {
            log.warn(`第${i + 1}次尝试未找到罗盘图标`);
        }
        if (i === 29) {
            log.warn("请装备罗盘后再启动本js");
            return;
        }
        await sleep(1000);
    }

    if (!isValidAccountName(settings.accountName || "默认账户")) {
        return;
    }

    const recordFilePath = `records/${settings.accountName || "默认账户"}.txt`;

    // 初始化结果对象
    const result = {};

    if (!doFileExist(recordFilePath)) {
        log.warn("对应记录文件不存在，将创建空白文件");
    } else {
        // 读取文件内容
        const content = await file.readText(recordFilePath);

        // 按行分割内容
        const lines = content.split('\n');

        // 当前国家
        let currentCountry = null;

        // 遍历每一行
        for (const line of lines) {
            // 去除行首行尾的空格
            const trimmedLine = line.trim();

            // 如果行以国家名称结尾（冒号），更新当前国家
            if (trimmedLine.endsWith("：")) {
                currentCountry = trimmedLine.slice(0, -1).trim();
                result[currentCountry] = {};
                continue;
            }

            // 如果行以“-”开头，表示路线信息
            if (trimmedLine.startsWith("-")) {
                // 提取路线名称和宝藏信息
                const [routeInfo, treasureInfo] = trimmedLine.slice(1).split("：");
                const routeName = routeInfo.trim();
                const treasures = treasureInfo.split("，").map(t => t.trim());

                // 将路线信息添加到当前国家
                if (currentCountry) {
                    result[currentCountry][routeName] = treasures;
                }
            }
        }

    }

    // 创建一个对象来存储每条路线的文件路径
    const routes = {};

    // 遍历 paths，将文件按路线分类
    for (const file of paths) {
        // 获取文件所在的路线文件夹路径
        const folderPathArray = file.folderPathArray;

        // 确保路径数组长度足够
        if (folderPathArray.length < 2) {
            log.debug(`文件路径 ${file.fullPath} 的层级不足，跳过该文件`);
            continue;
        }

        const routeFolder = folderPathArray[folderPathArray.length - 1]; // 倒数第一个元素是路线文件夹
        const countryFolder = folderPathArray[folderPathArray.length - 2]; // 倒数第二个元素是国家文件夹

        // 如果国家文件夹不存在于 routes 对象中，则初始化
        if (!routes[countryFolder]) {
            routes[countryFolder] = {};
        }

        // 如果路线文件夹不存在于国家文件夹中，则初始化
        if (!routes[countryFolder][routeFolder]) {
            routes[countryFolder][routeFolder] = [];
        }

        // 将文件的完整路径添加到对应的路线文件夹中
        routes[countryFolder][routeFolder].push(file.fullPath);
        log.debug(`找到文件${file.fullPath},在${countryFolder}的${routeFolder}`);
    }

    let currentElement = "";

    if (settings.operationMode != "导航至宝藏地点") {
        log.info("开启扫描模式");
        // 遍历 routes 对象
        for (const country in routes) {
            // 使用 switch 语句判断是否跳过该国家
            // 获取当前国家的所有路线
            const routesForCountry = routes[country];
            // 检查 result 中是否存在多余的路线，并移除
            if (result[country]) {
                const resultRoutes = Object.keys(result[country]);
                for (const resultRoute of resultRoutes) {
                    if (!routesForCountry[resultRoute]) {
                        // 如果 result 中的路线在 routes 中不存在，则移除该路线
                        delete result[country][resultRoute];
                        log.warn(`移除路线: ${resultRoute}，因为该路线在 routes 中不存在`);
                    }
                }
            }

            switch (country) {
                case "蒙德":
                    if (settings.disableMondstadt) {
                        log.info(`跳过国家: ${country}`);
                        continue;
                    }
                    break;
                case "璃月":
                    if (settings.disableLiyue) {
                        log.info(`跳过国家: ${country}`);
                        continue;
                    }
                    break;
                case "稻妻":
                    if (settings.disableInazuma) {
                        log.info(`跳过国家: ${country}`);
                        continue;
                    }
                    break;
                case "须弥":
                    if (settings.disableSumeru) {
                        log.info(`跳过国家: ${country}`);
                        continue;
                    }
                    break;
                case "枫丹":
                    if (settings.disableFontaine) {
                        log.info(`跳过国家: ${country}`);
                        continue;
                    }
                    break;
                case "纳塔":
                    if (settings.disableNatlan) {
                        log.info(`跳过国家: ${country}`);
                        continue;
                    }
                    break;
                default:
                    log.warn(`跳过未知国家: ${country}`);
                    continue;
            }

            log.info(`开始处理 ${country}的路线`);
            for (const route in routes[country]) {
                // 获取当前路线下的文件数量
                const fileCount = routes[country][route].length;

                // 检查 result 中是否存在该路线
                if (result[country] && result[country][route]) {
                    const treasureResults = result[country][route];
                    const allNotExist = treasureResults.every(item => item === "不存在宝藏");

                    // 如果所有项都是“不存在宝藏”且文件数量与项目数量一致，则跳过该路线
                    if (allNotExist && fileCount === treasureResults.length) {
                        log.info(`跳过路线: ${route}，所有点位都已确认不存在宝藏`);
                        continue;
                    }
                }

                // 如果 result 中不存在该路线，或者项目数量与文件数量不一致
                if (!result[country] || !result[country][route] || fileCount !== result[country][route].length) {
                    // 在 result 中新增或修改该路线，项目改为文件数量的“未知”
                    if (!result[country]) {
                        result[country] = {};
                    }
                    result[country][route] = Array(fileCount).fill("未知");
                }

                log.info(`开始处理路线: ${route}`);

                let targetElement = null; // 初始化 targetElement

                // 检查字符串是否以“主”结尾
                if (route.endsWith("主")) {
                    // 获取“主”字前的一个字
                    targetElement = route[route.length - 2]; // 获取倒数第二个字符
                    log.info(`该路线需要${targetElement}系主角`);
                    if (targetElement != currentElement) {
                        currentElement = targetElement;
                        await switchTravelerElement(targetElement);
                    }
                }

                await fakeLog(`${route}.json`, false, true, 0);
                let index = 0; // 添加一个计数器
                let xyCheck = false;
                for (const pathingPath of routes[country][route]) {
                    // 判断是否处于限制运行时间
                    if (await isTimeRestricted(settings.timeRule)) {
                        return;
                    }
                    log.info(`地图追踪：${pathingPath}`);
                    await pathingScript.runFile(pathingPath);
                    try {
                        await sleep(10);
                    } catch (error) {
                        log.error(`终止任务: ${error}`);
                        return;
                    }

                    // 获取 JSON 文件中的最后一个点位坐标及 description
                    const jsonINfo = await checkJson(pathingPath);

                    // 获取当前在小地图上的位置坐标，确保调用之前在主界面
                    const miniMapPosition = await genshin.getPositionFromMap();
                    log.info(`当前小地图坐标: X=${miniMapPosition.X}, Y=${miniMapPosition.Y}`);

                    // 比较坐标
                    const diffX = Math.abs(jsonINfo.lastX - miniMapPosition.X);
                    const diffY = Math.abs(jsonINfo.lastY - miniMapPosition.Y);
                    if (diffX + diffY >= 5 && jsonINfo.description !== "终点处小地图无效") {
                        log.error(`坐标偏差过大，地图追踪可能异常。偏差: X=${diffX}, Y=${diffY}`);
                        xyCheck = true;
                        continue; //跳出该路线
                    } else {
                        log.info(`坐标偏差在允许范围内。偏差: X=${diffX}, Y=${diffY}`);
                    }

                    const compassResult = await checkTreasure();
                    // 根据 compassResult 更新 result 中对应项的信息
                    if (compassResult === "罗盘状态异常，可能在战斗中") {
                        result[country][route][index] = "未知";
                        log.error("出错啦，请检查路线");
                    } else if (compassResult === "未发现宝藏或宝藏相关线索") {
                        result[country][route][index] = "不存在宝藏";
                        log.info("这里的宝箱都找齐啦");
                    } else if (compassResult === "发现宝藏或宝藏相关线索") {
                        result[country][route][index] = "存在宝藏";
                        log.warn("快看，是野生的宝箱");
                    } else {
                        result[country][route][index] = "未知";
                    }
                    // 更新记录文件
                    await writeDataToFile(result, recordFilePath);
                    index++; // 更新计数器
                }
                await fakeLog(`${route}.json`, false, false, 0);
            }
        }
    } else {
        log.info("开启导航模式，将带您前往扫描到宝箱的地点，请到达后使用快捷键暂停bgi，找齐后继续运行，前往下一个地点");
        // 遍历 result 对象
        for (const country in result) {
            for (const country in result) {
                if (Object.keys(result[country]).length === 0) {
                    log.warn(`国家 ${country} 不包含任何路线，将从 result 中删除`);
                    delete result[country];
                }
            }
            //更新记录文件
            await writeDataToFile(result, recordFilePath);
            for (const route in result[country]) {
                const treasures = result[country][route];
                // 检查 routes 中是否存在对应的国家和路线
                if (!routes[country] || !routes[country][route]) {
                    log.warn(`路线 ${route}不存在，从 result 中删除`);
                    delete result[country][route]; // 从 result 中删除对应的路线
                    for (const country in result) {
                        if (Object.keys(result[country]).length === 0) {
                            log.warn(`国家 ${country} 不包含任何路线，将从 result 中删除`);
                            delete result[country];
                        }
                    }
                    //更新记录文件
                    await writeDataToFile(result, recordFilePath);
                    continue;
                }
                const filesForRoute = routes[country][route]; // 获取该路线下的所有文件路径
                for (let i = 0; i < treasures.length; i++) {
                    if (treasures[i] === "存在宝藏") {
                        // 检查字符串是否以“主”结尾
                        if (route.endsWith("主")) {
                            // 获取“主”字前的一个字
                            targetElement = route[route.length - 2]; // 获取倒数第二个字符
                            log.info(`该路线需要${targetElement}系主角`);
                            if (targetElement != currentElement) {
                                currentElement = targetElement;
                                await switchTravelerElement(targetElement);
                            }
                        }
                        // 遍历前 i + 1 个地图追踪文件
                        log.info(`路线${route}第${i + 1}个点位存在宝藏`);
                        for (let j = 0; j <= i; j++) {
                            if (j < filesForRoute.length) {
                                const filePath = filesForRoute[j];
                                await pathingScript.runFile(filePath);
                                try {
                                    await sleep(10);
                                } catch (error) {
                                    log.error(`终止任务: ${error}`);
                                    return;
                                }
                            } else {
                                log.error("路线数量错误，请检查文件");
                                return;
                            }
                        }
                        keyPress("Z");
                        result[country][route][i] = "未知";
                        await writeDataToFile(result, recordFilePath);
                        log.info("到啦，野生的宝箱在召唤你，请在10秒内按下快捷键暂停bgi运行，找齐该点位宝箱后继续运行");
                        await pathingScript.runFile("assets/waitFor10Seconds.json");
                        log.info("已更新记录中对应项目为未知,继续运行");
                    }
                }
            }
        }
        log.info("所有存在宝藏的位置都处理了")
    }
    await fakeLog("提瓦特扫描仪", true, false, 2333);
})();

/**
 * 切换主角元素
 */
async function switchTravelerElement(element) {
    const fullPath = `assets/switchElement/${element}.json`;
    //导航至对应的七天神像
    await pathingScript.runFile(fullPath);
    //点击与某元素共鸣
    log.info(`旅行者正在汲取${element}元素力`);
    for (let i = 0; i < 5; i++) {
        await click(1400, 675);
        await sleep(500);
    }
    //传送离开防止影响后续
    await genshin.returnMainUi();
    await genshin.tpToStatueOfTheSeven();
}

/**
 * 检查罗盘是否处于冷却状态
 * @returns {Promise<boolean>}
 */
async function isCompassFree(totalAttempts = 3) {
    const iconPaths = [
        { path: "assets/icon/Anemo.png", name: "风" },
        { path: "assets/icon/Geo.png", name: "岩" },
        { path: "assets/icon/Electro.png", name: "雷" },
        { path: "assets/icon/Dendro.png", name: "草" },
        { path: "assets/icon/Hydro.png", name: "水" },
        { path: "assets/icon/Pyro.png", name: "火" },
        //{ path: "assets/icon/Cryo.png", name: "冰" }
    ]; // 定义寻宝罗盘图标的路径及名称

    for (let i = 0; i < totalAttempts; i++) {
        // 后续每次暂停 100 毫秒
        if (i > 0) {
            await sleep(100);
        }

        // 遍历所有图标路径
        for (const icon of iconPaths) {
            // 使用图像识别方法查找图标
            const ro = captureGameRegion();
            const iconList = ro.findMulti(
                RecognitionObject.TemplateMatch(file.ReadImageMatSync(icon.path))
            );
            ro.dispose();

            // 判断是否找到图标
            if (iconList && iconList.count > 0) {
                log.debug(`${icon.name}之寻宝罗盘已刷新`);
                return true; // 任意一个图标存在则返回 true
            } else {
            }
        }
    }
    log.debug(`寻宝罗盘未刷新`);
    return false; // 所有图标都不存在则返回 false
}

/**
 * 检查罗盘是否处于冷却状态
 * @returns {Promise<boolean>}
 */
async function isCompassFree(totalAttempts = 3) {
    const iconPaths = [
        { path: "assets/icon/Anemo.png", name: "风" },
        { path: "assets/icon/Geo.png", name: "岩" },
        { path: "assets/icon/Electro.png", name: "雷" },
        { path: "assets/icon/Dendro.png", name: "草" },
        { path: "assets/icon/Hydro.png", name: "水" },
        { path: "assets/icon/Pyro.png", name: "火" },
        //{ path: "assets/icon/Cryo.png", name: "冰" }
    ]; // 定义寻宝罗盘图标的路径及名称

    for (let i = 0; i < totalAttempts; i++) {
        // 后续每次暂停 100 毫秒
        if (i > 0) {
            await sleep(100);
        }

        // 遍历所有图标路径
        for (const icon of iconPaths) {
            // 使用图像识别方法查找图标
            const ro = captureGameRegion();
            const iconList = ro.findMulti(
                RecognitionObject.TemplateMatch(file.ReadImageMatSync(icon.path))
            );
            ro.dispose();

            // 判断是否找到图标
            if (iconList && iconList.count > 0) {
                log.debug(`${icon.name}之寻宝罗盘已刷新`);
                return true; // 任意一个图标存在则返回 true
            } else {
            }
        }
    }
    log.debug(`寻宝罗盘未刷新`);
    return false; // 所有图标都不存在则返回 false
}

/**
 * 检查罗盘是否处于不可用状态
 * @returns {Promise<boolean>}
 */
async function isCompassLocked(totalAttempts = 3) {
    const iconPaths = [
        { path: "assets/icon/Anemo_off.png", name: "风" },
        { path: "assets/icon/Geo_off.png", name: "岩" },
        { path: "assets/icon/Electro_off.png", name: "雷" },
        { path: "assets/icon/Dendro_off.png", name: "草" },
        { path: "assets/icon/Hydro_off.png", name: "水" },
        { path: "assets/icon/Pyro_off.png", name: "火" },
        //{ path: "assets/icon/Cryo_off.png", name: "冰" }
    ]; // 定义寻宝罗盘图标的路径及名称

    for (let i = 0; i < totalAttempts; i++) {
        // 后续每次暂停 100 毫秒
        if (i > 0) {
            await sleep(100);
        }

        // 遍历所有图标路径
        for (const icon of iconPaths) {
            // 使用图像识别方法查找图标
            const iconList = captureGameRegion().findMulti(
                RecognitionObject.TemplateMatch(file.ReadImageMatSync(icon.path))
            );

            // 判断是否找到图标
            if (iconList && iconList.count > 0) {
                log.debug(`${icon.name}之寻宝罗盘处于锁定状态`);
                return true; // 任意一个图标存在则返回 true
            } else {
            }
        }
    }
    log.debug(`寻宝罗盘不处于锁定状态`);
    return false; // 所有图标都不存在则返回 false
}

/**
 * 检查 chest.png 或 flag.png 是否存在
 * @param {number} [totalAttempts=3] - 尝试次数，默认为 3 次
 * @returns {Promise<boolean>} - 如果 chest.png 或 flag.png 存在，则返回 true，否则返回 false
 */
async function doTreasureExist(totalAttempts = 3) {
    const iconPaths = [
        { path: "assets/icon/chest.png", name: "宝箱" },
        { path: "assets/icon/flag.png", name: "旗帜" }
    ]; // 定义图标路径及名称

    for (let i = 0; i < totalAttempts; i++) {
        // 后续每次暂停 100 毫秒
        if (i > 0) {
            await sleep(100);
        }

        // 遍历所有图标路径
        for (const icon of iconPaths) {
            // 使用图像识别方法查找图标
            const ro = captureGameRegion();
            const iconList = ro.findMulti(
                RecognitionObject.TemplateMatch(file.ReadImageMatSync(icon.path))
            );
            ro.dispose();

            // 判断是否找到图标
            if (iconList && iconList.count > 0) {
                log.debug(`${icon.name}图标存在`);
                return true; // 任意一个图标存在则返回 true
            }
        }
    }

    log.debug(`未找到任何图标`);
    return false; // 所有图标都不存在则返回 false
}


/**
 * 检查宝藏状态
 * @returns {Promise<string>} 返回检查结果的描述
 */
async function checkTreasure() {
    let checkTime = 0;
    let compassFree = false;
    let offCount = 0;
    let WaitStartTime = Date.now(); // 记录检查开始时间
    while (checkTime < 31000) {
        // 检查罗盘状态
        const startTime = Date.now(); // 记录调用结束时间
        compassFree = await isCompassFree(1);
        let compassOff = await isCompassLocked(1);
        const endTime = Date.now(); // 记录调用结束时间
        checkTime = endTime - WaitStartTime; // 计算实际调用时间

        if (compassOff) {
            offCount++; //累计失败次数
        }
        if (compassFree) {
            break; // 如果返回 true，则跳出循环
        }
        if (offCount > 2) {
            break;
        }
        //确保每轮循环时间不少于3秒
        await sleep(startTime + 3000 - endTime)
    }

    if (!compassFree) {
        //31秒后罗盘仍然不处于刷新状态，或三次以上处于锁定状态
        return "罗盘状态异常，可能在战斗中";
    }

    // 按下 Z 键两次
    keyPress("Z");
    await sleep(500);
    keyPress("Z");
    await sleep(500);

    checkTime = 0;
    let compassOff = false;
    offCount = 0;
    WaitStartTime = Date.now(); // 记录检查开始时间
    while (checkTime < 10000) {
        // 检查罗盘状态
        const startTime = Date.now(); // 记录调用结束时间
        compassFree = await isCompassFree(1);
        compassOff = await isCompassLocked(1);
        const endTime = Date.now(); // 记录调用结束时间
        checkTime = endTime - WaitStartTime; // 计算实际调用时间

        if (compassOff) {
            offCount++; //累计失败次数
        }
        if (compassFree) {
            break; // 如果返回 true，则跳出循环
        }
        if (offCount > 0) {
            break;
        }
        //确保每轮循环时间不少于3秒
        await sleep(startTime + 3000 - endTime)
    }
    if (compassFree) {
        //罗盘刷新了说明此处没有宝箱
        return "未发现宝藏或宝藏相关线索";
    } else if (checkTime >= 10000) {
        //罗盘10秒内都没有刷新，说明此处有宝箱
        return "发现宝藏或宝藏相关线索";
    } else {
        //识别到罗盘处于锁定状态
        return "罗盘状态异常，可能在战斗中";
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

// 定义 readFolder 函数
/*
该函数可以实现输入要处理的文件夹路径后，将其中所有文件/仅json文件按照原顺序存储在一个对象中，具体使用参考主函数
*/
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

/**
 * 检查当前时间是否处于限制时间内或即将进入限制时间
 * @param {string} timeRule - 时间规则字符串，格式如 "4, 4-6, 10-12"
 * @param {number} [threshold=10] - 接近限制时间的阈值（分钟）
 * @returns {Promise<boolean>} - 如果处于限制时间内或即将进入限制时间，则返回 true，否则返回 false
 */
async function isTimeRestricted(timeRule, threshold = 10) {
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
    log.info(`当前小时数为${currentHour}，分钟数为${currentMinute}`);

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


/**
 * 检查账户名是否合法
 * @param {string} accountName - 账户名
 * @returns {boolean} - 如果账户名合法，返回 true；否则返回 false
 */
function isValidAccountName(accountName) {
    // Windows文件名非法字符列表
    const illegalCharacters = /[\\/:*?"<>|]/;
    // Windows保留设备名称列表
    const reservedNames = [
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];

    // 检查accountName是否为空字符串
    if (accountName === "") {
        log.error(`账户名 "${accountName}" 不合法，为空字符串。`);
        log.error(`请使用合法的名称`);
        return false;
    }
    // 检查accountName是否以空格开头
    else if (accountName.startsWith(" ")) {
        log.error(`账户名 "${accountName}" 不合法，以空格开头。`);
        log.error(`请使用合法的名称`);
        return false;
    }
    // 检查accountName是否以空格结尾
    else if (accountName.endsWith(" ")) {
        log.error(`账户名 "${accountName}" 不合法，以空格结尾。`);
        log.error(`请使用合法的名称`);
        return false;
    }
    // 检查accountName是否包含非法字符
    else if (illegalCharacters.test(accountName)) {
        log.error(`账户名 "${accountName}" 不合法，包含非法字符。`);
        log.error(`请使用合法的名称`);
        return false;
    }
    // 检查accountName是否是保留设备名称
    else if (reservedNames.includes(accountName.toUpperCase())) {
        log.error(`账户名 "${accountName}" 不合法，是保留设备名称。`);
        log.error(`请使用合法的名称`);
        return false;
    }
    // 检查accountName长度是否超过255字符
    else if (accountName.length > 255) {
        log.error(`账户名 "${accountName}" 不合法，账户名过长。`);
        log.error(`请使用合法的名称`);
        return false;
    }
    else {
        log.info(`账户名 "${accountName}" 合法。`);
        return true;
    }
}

/**
 * 将对象内容写入文件
 * @param {Object} data - 要写入的对象
 * @returns {Promise<void>}
 */
async function writeDataToFile(data, recordFilePath) {
    // 初始化内容字符串
    let content = "";

    // 遍历对象，将内容逐行转化为文字
    for (const country in data) {
        content += `${country}：\n`;
        for (const route in data[country]) {
            // 每条路线的最后一项之后没有逗号
            const treasures = data[country][route].join('，').replace(/，$/, '');
            content += `-${route}：${treasures}\n`;
        }
    }

    // 异步写入文件
    await file.writeText(recordFilePath, content);
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

/**
 * 检查指定文件是否存在
 * @param {string} filePath - 文件的完整路径
 * @returns {boolean} - 如果文件存在，返回 true；否则返回 false
 */
function doFileExist(filePath) {
    // 提取文件夹路径和文件名
    const folderPath = filePath.substring(0, filePath.lastIndexOf('/') + 1); // 获取文件夹路径
    log.info(`目标文件夹路径：${folderPath}`)
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1); // 获取文件名
    log.info(`目标文件名：${fileName}`)
    // 读取子文件夹中的所有文件路径
    const filesInSubFolder = file.ReadPathSync(folderPath);

    // 检查指定文件是否存在
    for (const currentFilePath of filesInSubFolder) {
        const currentFileName = currentFilePath.substring(currentFilePath.lastIndexOf('\\') + 1); // 提取文件名
        if (currentFileName === fileName) {
            return true; // 文件存在
        }
    }

    return false; // 文件不存在
}

/**
 * 读取并解析 JSON 文件
 * @param {string} filePath - JSON 文件路径
 * @returns {Promise<Object>} - 包含最后一个点位的 x 和 y 坐标，以及 description 字段
 */
async function checkJson(filePath) {
    try {
        // 使用 file.readText() 读取文件内容
        const content = await file.readText(filePath);

        // 解析 JSON 数据
        const parsedData = JSON.parse(content);

        // 获取最后一个点位的 x 和 y 坐标
        const lastPosition = parsedData.positions[parsedData.positions.length - 1];
        const lastX = lastPosition.x;
        const lastY = lastPosition.y;

        // 获取 description 字段
        const description = parsedData.info.description;

        // 返回结果对象
        return {
            lastX: lastX,
            lastY: lastY,
            description: description
        };
    } catch (error) {
        log.error('读取或解析文件时发生错误：', error);
    }
}