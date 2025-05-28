/**
 * 原神地脉花自动化脚本 (Genshin Impact Ley Line Outcrop Automation Script)
 *
 * 功能：自动寻找并完成地脉花挑战，领取奖励
 */

// 全局变量
let leyLineX = 0;         // 地脉花X坐标
let leyLineY = 0;         // 地脉花Y坐标
let currentFlower = null; // 当前花的引用
let strategyName = "";    // 任务策略名称
let retryCount = 0;       // 重试次数
let marksStatus = true;   // 自定义标记状态
let currentRunTimes = 0;  // 当前运行次数
let isNotification = false; // 是否发送通知
let config = {};          // 全局配置对象
const ocrRegion1 = { x: 800, y: 200, width: 300, height: 100 };   // 中心区域
const ocrRegion2 = { x: 0, y: 200, width: 300, height: 300 };     // 追踪任务区域
const ocrRegion3 = { x: 1200, y: 520, width: 300, height: 300 };  // 拾取区域

// 预定义识别对象
const openRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/open.png"));
const closeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/close.png"));
const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/paimon_menu.png"), 0, 0, genshin.width / 3.0, genshin.width / 5.0);
const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/box.png"));
const ocrRo1 = RecognitionObject.ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);
const ocrRo2 = RecognitionObject.ocr(ocrRegion2.x, ocrRegion2.y, ocrRegion2.width, ocrRegion2.height);
const ocrRo3 = RecognitionObject.ocr(ocrRegion3.x, ocrRegion3.y, ocrRegion3.width, ocrRegion3.height);
const ocrRoThis = RecognitionObject.ocrThis;
/**
 * 主函数 - 脚本入口点
 */
(async function () {
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    try {
        await runLeyLineOutcropScript();
    } catch (error) {
        log.error("出错了！ {error}", error.message);
        if (isNotification) {
            notification.error("出错了！ {error}", error.message);
        }
        if (!marksStatus) {
            await openCustomMarks();
        }
    }
})();

/**
 * 运行地脉花脚本的主要逻辑
 * @returns {Promise<void>}
 */
async function runLeyLineOutcropScript() {
    // 初始化加载配置和设置并校验
    await initializeGame();
    await loadConfig();
    loadSettings();
    retryCount = 0;

    await prepareForLeyLineRun();

    // 执行地脉花挑战
    await runLeyLineChallenges();

    // 完成后恢复自定义标记
    if (!marksStatus) {
        await openCustomMarks();
    }
}

/**
 * 初始化游戏状态
 * @returns {Promise<void>}
 */
async function initializeGame() {
    await genshin.returnMainUi();
    setGameMetrics(1920, 1080, 1);
}


/**
 * 执行地脉花挑战前的准备工作
 * @returns {Promise<void>}
 */
async function prepareForLeyLineRun() {
    // 开局传送到七天神像
    await genshin.tpToStatueOfTheSeven();

    // 切换战斗队伍
    if (settings.team) {
        log.info(`切换至队伍 ${settings.team}`);
        await genshin.switchParty(settings.team);
    }
}

/**
 * 执行地脉花挑战的主要逻辑
 * @returns {Promise<void>}
 */
async function runLeyLineChallenges() {
    while (currentRunTimes < settings.timesValue) {
        // 寻找地脉花位置
        await findLeyLineOutcrop(settings.country, settings.leyLineOutcropType);

        // 查找并执行对应的策略
        const foundStrategy = await executeMatchingStrategy();

        // 未找到策略的错误处理
        if (!foundStrategy) {
            handleNoStrategyFound();
            return;
        }
    }
}

/**
 * 切换指定的队伍
 * @param {string} teamName - 队伍名称
 * @returns {Promise<void>}
 */
async function switchTeam(teamName) {
    try {
        return await genshin.switchParty(teamName);
    } catch (error) {
        log.error(`切换队伍时出错: ${error.message}`);
        return false;
    }
}

/**
 * 执行匹配的地脉花策略
 * @returns {Promise<boolean>} 是否找到并执行了策略
 */
async function executeMatchingStrategy() {
    let foundStrategy = false;

    // 从配置中查找匹配的位置和策略
    if (config.leyLinePositions[settings.country]) {
        const positions = config.leyLinePositions[settings.country];

        for (const position of positions) {
            if (isNearPosition(leyLineX, leyLineY, position.x, position.y, config.errorThreshold)) {
                foundStrategy = true;
                strategyName = position.strategy;
                order = position.order;
                log.info(`找到匹配的地脉花策略：${strategyName}，次序：${order}`);

                // 使用 LeyLineOutcropData.json 数据处理路径
                await executePathsUsingNodeData(position);
                break;
            }
        }
    }

    return foundStrategy;
}

/**
 * 使用节点数据执行路径
 * @param {Object} position - 位置对象
 * @returns {Promise<void>}
 */
async function executePathsUsingNodeData(position) {
    try {
        const nodeData = await loadNodeData();
        let currentNodePosition = position;
        const targetNode = findTargetNodeByPosition(nodeData, currentNodePosition.x, currentNodePosition.y);

        if (!targetNode) {
            log.error(`未找到与坐标(${currentNodePosition.x}, ${currentNodePosition.y})匹配的目标节点`);
            return;
        }
        // log.info(`找到目标节点: ID ${targetNode.id}, 位置(${targetNode.position.x}, ${targetNode.position.y})`);
        const paths = findPathsToTarget(nodeData, targetNode);

        if (paths.length === 0) {
            log.error(`未找到通向目标节点(ID: ${targetNode.id})的路径`);
            return;
        }

        // 选择最短的路径执行
        const optimalPath = selectOptimalPath(paths);
        // log.info(`选择了含有 ${optimalPath.routes.length} 个路径点的最优路径`);

        // 执行路径
        await executePath(optimalPath);
        currentRunTimes++;

        // 如果达到刷取次数上限，退出循环
        if (currentRunTimes >= settings.timesValue) {
            return;
        }

        // 循环检查并执行当前节点的单一next路径，直到遇到没有next或有多个next的情况
        let currentNode = targetNode;

        while (currentNode.next && currentRunTimes < settings.timesValue) {
            if (currentNode.next.length === 1) {
                // 获取下一个节点的ID 和 路径，并在节点数据中找到下一个节点
                const nextNodeId = currentNode.next[0].target;
                const nextRoute = currentNode.next[0].route;
                const nextNode = nodeData.node.find(node => node.id === nextNodeId);

                if (!nextNode) {
                    return;
                }
                const pathObject = {
                    startNode: currentNode,
                    targetNode: nextNode,
                    routes: [nextRoute]
                };

                log.info(`直接执行下一个节点路径: ${nextRoute}`);
                await executePath(pathObject);

                currentRunTimes++;

                log.info(`完成节点 ID ${nextNodeId}, 已执行 ${currentRunTimes}/${settings.timesValue} 次`);

                // 更新当前节点为下一个节点，继续检查
                currentNode = nextNode;
                currentNodePosition = { x: nextNode.position.x, y: nextNode.position.y };
            }
            else if (currentNode.next.length > 1) {
                // 如果存在分支路线，先打开大地图判断下一个地脉花的位置，根据下一个地脉花的位置选择路线
                log.info("检测到多个分支路线，开始查找下一个地脉花位置");

                // 备份当前地脉花坐标
                const currentLeyLineX = leyLineX;
                const currentLeyLineY = leyLineY;

                // 打开大地图
                await genshin.returnMainUi();
                keyPress("M");
                await sleep(1000);

                // 查找下一个地脉花
                const found = await locateLeyLineOutcrop(settings.leyLineOutcropType);
                await genshin.returnMainUi();

                if (!found) {
                    log.warn("无法在分支点找到下一个地脉花，退出本次循环");
                    return;
                }

                log.info(`找到下一个地脉花，位置: (${leyLineX}, ${leyLineY})`);

                // 计算每个分支节点到地脉花的距离，选择最近的路径
                let closestRoute = null;
                let closestDistance = Infinity;
                let closestNodeId = null;

                for (const nextRoute of currentNode.next) {
                    const nextNodeId = nextRoute.target;
                    const nextNode = nodeData.node.find(node => node.id === nextNodeId);

                    if (!nextNode) continue;

                    const distance = calculate2DDistance(
                        leyLineX, leyLineY,
                        nextNode.position.x, nextNode.position.y
                    );

                    log.info(`路线到地脉花距离: ID ${nextNodeId}, 距离: ${distance.toFixed(2)}`);

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestRoute = nextRoute.route;
                        closestNodeId = nextNodeId;
                    }
                }

                if (!closestRoute) {
                    log.error("无法找到合适的路线，终止执行");
                    // 恢复原始坐标
                    leyLineX = currentLeyLineX;
                    leyLineY = currentLeyLineY;
                    return;
                }

                const nextNode = nodeData.node.find(node => node.id === closestNodeId);
                log.info(`选择最近的路线: ${closestRoute}, 目标节点ID: ${closestNodeId}。`);

                // 创建路径对象并执行
                const pathObject = {
                    startNode: currentNode,
                    targetNode: nextNode,
                    routes: [closestRoute]
                };

                await executePath(pathObject);
                currentRunTimes++;

                // 更新当前节点为下一个节点，继续检查
                currentNode = nextNode;
                currentNodePosition = { x: nextNode.position.x, y: nextNode.position.y };
            }
            else {
                log.info("当前路线完成，退出循环");
                break;
            }
        }
    }
    catch (error) {
        if(error.message.includes("战斗失败")) {
            log.error("战斗失败，重新寻找地脉花后重试");
            return;
        }
        // 其他错误需要向上传播
        log.error(`执行路径时出错: ${error.message}`);
        throw error;
    }
}

/**
 * 加载节点数据
 * @returns {Promise<Object>} 节点数据对象
 */
async function loadNodeData() {
    try {
        const nodeDataText = await file.readText("LeyLineOutcropData.json");
        return JSON.parse(nodeDataText);
    } catch (error) {
        log.error(`加载节点数据失败: ${error.message}`);
        throw new Error("无法加载 LeyLineOutcropData.json 文件");
    }
}

/**
 * 根据位置找到对应的目标节点
 * @param {Object} nodeData - 节点数据
 * @param {number} x - 目标X坐标
 * @param {number} y - 目标Y坐标
 * @returns {Object|null} 找到的节点或null
 */
function findTargetNodeByPosition(nodeData, x, y) {
    const errorThreshold = 50; // 坐标匹配误差范围

    for (const node of nodeData.node) {
        if (node.type === "blossom" &&
            Math.abs(node.position.x - x) <= errorThreshold &&
            Math.abs(node.position.y - y) <= errorThreshold) {
            return node;
        }
    }

    return null;
}

/**
 * 查找到达目标节点的所有可能路径
 * @param {Object} nodeData - 节点数据
 * @param {Object} targetNode - 目标节点
 * @returns {Array} 可行路径数组
 */
function findPathsToTarget(nodeData, targetNode) {
    // 构建节点映射表
    const nodeMap = {};
    nodeData.node.forEach(node => {
        nodeMap[node.id] = node;
    });

    log.info(`目标节点ID: ${targetNode.id}, 类型: ${targetNode.type}, 区域: ${targetNode.region}`);

    // 采用广度优先搜索查找所有可能路径
    return breadthFirstPathSearch(nodeData, targetNode, nodeMap);
}

/**
 * 使用广度优先搜索算法查找从传送点到目标的所有路径
 * @param {Object} nodeData - 节点数据
 * @param {Object} targetNode - 目标节点
 * @param {Object} nodeMap - 节点映射
 * @returns {Array} 找到的所有可行路径
 */
function breadthFirstPathSearch(nodeData, targetNode, nodeMap) {
    // 存储找到的所有有效路径
    const validPaths = [];

    // 获取所有传送点作为起点
    const teleportNodes = nodeData.node.filter(node => node.type === "teleport");
    //log.info(`找到 ${teleportNodes.length} 个传送点作为可能的起点`);

    // 对每个传送点，尝试查找到目标的路径
    for (const startNode of teleportNodes) {
        // 初始化队列，每个元素包含 [当前节点, 路径信息]
        const queue = [[startNode, {
            startNode: startNode,
            routes: [],
            visitedNodes: new Set([startNode.id])
        }]];

        // 广度优先搜索
        while (queue.length > 0) {
            const [currentNode, pathInfo] = queue.shift();

            // 如果已经到达目标节点
            if (currentNode.id === targetNode.id) {
                validPaths.push({
                    startNode: pathInfo.startNode,
                    targetNode: targetNode,
                    routes: [...pathInfo.routes]
                });
                continue; // 找到一条路径，继续搜索其他可能路径
            }

            // 检查当前节点的下一个连接
            if (currentNode.next && currentNode.next.length > 0) {
                for (const nextRoute of currentNode.next) {
                    const nextNodeId = nextRoute.target;

                    // 避免循环
                    if (pathInfo.visitedNodes.has(nextNodeId)) {
                        continue;
                    }

                    const nextNode = nodeMap[nextNodeId];
                    if (!nextNode) {
                        continue;
                    }

                    // 创建新的路径信息
                    const newPathInfo = {
                        startNode: pathInfo.startNode,
                        routes: [...pathInfo.routes, nextRoute.route],
                        visitedNodes: new Set([...pathInfo.visitedNodes, nextNodeId])
                    };

                    // 加入队列
                    queue.push([nextNode, newPathInfo]);
                }
            }
        }
    }

    // 检查是否存在反向路径
    const reversePaths = findReversePathsIfNeeded(nodeData, targetNode, nodeMap, validPaths);
    validPaths.push(...reversePaths);

    log.info(`共找到 ${validPaths.length} 条有效路径`);
    return validPaths;
}

/**
 * 如果需要，尝试查找反向路径（从目标节点的前置节点到传送点再到目标）
 * @param {Object} nodeData - 节点数据 
 * @param {Object} targetNode - 目标节点
 * @param {Object} nodeMap - 节点映射
 * @param {Array} existingPaths - 已找到的路径
 * @returns {Array} 找到的反向路径
 */
function findReversePathsIfNeeded(nodeData, targetNode, nodeMap, existingPaths) {
    // 如果已经找到路径，或者目标节点没有前置节点，则不需要查找反向路径
    if (existingPaths.length > 0 || !targetNode.prev || targetNode.prev.length === 0) {
        return [];
    }

    const reversePaths = [];

    // 检查每个前置节点
    for (const prevNodeId of targetNode.prev) {
        const prevNode = nodeMap[prevNodeId];
        if (!prevNode) continue;

        // 找到从前置节点到传送点的路径
        const pathsToPrevNode = [];

        // 获取所有能从这个前置节点到达的传送点
        const teleportNodes = nodeData.node.filter(node =>
            node.type === "teleport" && node.next.some(route => route.target === prevNode.id)
        );

        for (const teleportNode of teleportNodes) {
            // 寻找传送点到前置节点的路径
            const route = teleportNode.next.find(r => r.target === prevNode.id);
            if (route) {
                // 找到路径从前置节点到目标
                const nextRoute = prevNode.next.find(r => r.target === targetNode.id);
                if (nextRoute) {
                    reversePaths.push({
                        startNode: teleportNode,
                        targetNode: targetNode,
                        routes: [route.route, nextRoute.route]
                    });
                }
            }
        }
    }

    return reversePaths;
}

/**
 * 从多个可行路径中选择最优的一条
 * @param {Array} paths - 路径数组
 * @returns {Object} 最优路径
 */
function selectOptimalPath(paths) {
    if (!paths || paths.length === 0) {
        throw new Error("没有可用路径");
    }

    // 按路径段数从少到多排序
    paths.sort((a, b) => a.routes.length - b.routes.length);

    // 记录路径选择日志
    for (let i = 0; i < Math.min(paths.length, 3); i++) {
        // log.info(`路径选项 ${i + 1}: 起点ID ${paths[i].startNode.id}, ${paths[i].routes.length} 段路径`);
        for (let j = 0; j < paths[i].routes.length; j++) {
            // log.info(`  - 路径 ${j + 1}: ${paths[i].routes[j]}`);
        }
    }

    return paths[0]; // 返回路径段最少的路径
}

/**
 * 执行路径
 * @param {Object} path - 路径对象
 * @returns {Promise<void>}
 */
async function executePath(path) {
    log.info(`开始执行路径，起始点ID: ${path.startNode.id}, 目标点ID: ${path.targetNode.id}`);
    log.info(`路径包含 ${path.routes.length} 个路径段`);

    // 依次执行每个路径段
    for (let i = 0; i < path.routes.length; i++) {
        const routePath = path.routes[i];
        log.info(`执行路径 ${i + 1}/${path.routes.length}: ${routePath}`);

        try {
            // 运行路径文件
            await pathingScript.runFile(routePath);
        } catch (error) {
            log.error(`执行路径 ${i + 1} 时出错: ${error.message}`);
            throw error;
        }
    }
    const routePath = path.routes[path.routes.length - 1];
    const targetPath = routePath.replace('assets/pathing/', 'assets/pathing/target/').replace('-rerun', '');
    await processLeyLineOutcrop(settings.timeout, targetPath);
    await attemptReward();
}

/**
 * 如果需要，切换到好感队
 * @returns {Promise<void>}
 */
async function switchToFriendshipTeamIfNeeded() {
    if (!settings.friendshipTeam) {
        return;
    }

    log.info(`切换至队伍 ${settings.friendshipTeam}`);

    try {
        await genshin.switchParty(settings.friendshipTeam);
    } catch (error) {
        // 切换失败时的恢复策略
        keyPress("ESCAPE");
        await sleep(500);
        keyPress("ESCAPE");
        await sleep(500);
        await genshin.returnMainUi();
        log.info(`再次切换至队伍 ${settings.friendshipTeam}`);
        try {
            await genshin.switchParty(settings.friendshipTeam);
        } catch (error) {
            // 如果切换队伍失败,记录日志并继续执行
            log.warn(`切换队伍失败: ${error.message}`);
            log.warn("跳过切换队伍，直接领取奖励");
        }
    }
}

/**
 * 处理未找到策略的情况
 */
async function handleNoStrategyFound() {
    log.error("未找到对应的地脉花策略，请再次运行脚本");
    log.error("如果仍然不行，请截图{1}游戏界面，并反馈给作者！", "*完整的*");
    log.error("完整的游戏界面！完整的游戏界面！完整的游戏界面！");
    if (isNotification) {
        notification.error("未找到对应的地脉花策略");
        await genshin.returnMainUi();
    }
}

/**
 * 加载配置文件
 * @returns {Promise<void>}
 */
async function loadConfig() {
    try {
        const configData = JSON.parse(await file.readText("config.json"));
        config = configData; // 直接赋值给全局变量
    } catch (error) {
        log.error(`加载配置文件失败: ${error.message}`);
        throw new Error("配置文件加载失败，请检查config.json文件是否存在");
    }
}

/**
 * 加载、验证、输出用户设置
 * @returns {Object} 处理过的设置对象
 */
function loadSettings() {
    try {
        // 直接使用全局settings对象而不是重新创建
        // 这样能保留原始设置内容

        // 验证必要的设置
        if (!settings.start) {
            throw new Error("请仔细阅读脚本介绍，并在{0}内进行配置，如果你是直接运行的脚本，请将脚本加入{0}内运行！", "调度器");
        }

        if (!settings.leyLineOutcropType) {
            throw new Error("请选择你要刷取的地脉花类型（经验书/摩拉）");
        }

        if (!settings.country) {
            throw new Error("请在游戏中确认地脉花的第一个点的位置，然后在js设置中选择地脉花所在的国家。");
        }

        if (settings.friendshipTeam && !settings.team) {
            throw new Error("未配置战斗队伍！当配置了好感队时必须配置战斗队伍！");
        }

        // 为了向后兼容，确保某些设置有默认值
        settings.timeout = settings.timeout * 1000 || 120000;

        // 处理刷取次数
        if (!settings.count || !/^-?\d+\.?\d*$/.test(settings.count)) {
            log.warn(`刷取次数 ${settings.count} 不是数字，使用默认次数6次`);
            settings.timesValue = 6;
        } else {
            // 转换为数字
            const num = parseFloat(settings.count);

            // 范围检查
            if (num < 1) {
                settings.timesValue = 1;
                log.info(`⚠️ 次数 ${num} 小于1，已调整为1`);
            } else {
                // 处理小数
                if (!Number.isInteger(num)) {
                    settings.timesValue = Math.floor(num);
                    log.info(`⚠️ 次数 ${num} 不是整数，已向下取整为 ${settings.timesValue}`);
                } else {
                    settings.timesValue = num;
                }
            }
        }

        // 记录使用的设置
        log.info(`地脉花类型：${settings.leyLineOutcropType}`);
        log.info(`国家：${settings.country}`);

        if (settings.friendshipTeam) {
            log.info(`好感队：${settings.friendshipTeam}`);
        }

        log.info(`刷取次数：${settings.timesValue}`);

        // 设置通知状态
        isNotification = settings.isNotification;

        if (isNotification) {
            notification.send(`全自动地脉花开始运行，以下是本次运行的配置：\n\n地脉花类型：${settings.leyLineOutcropType}\n国家：${settings.country}\n刷取次数：${settings.timesValue}`);
        }
    } catch (error) {
        log.error(`加载设置失败: ${error.message}`);
        throw error;
    }
}

/**
 * 地脉花寻找和定位相关函数
 */

/**
 * 查找地脉花位置
 * @param {string} country - 国家名称
 * @param {string} type - 地脉花类型
 * @returns {Promise<void>}
 */
async function findLeyLineOutcrop(country, type) {
    currentFlower = null;
    keyPress("M");
    await sleep(1000);
    await closeCustomMarks();
    await sleep(1000);
    log.info("开始寻找地脉花");
    if (!config.mapPositions[country] || config.mapPositions[country].length === 0) {
        throw new Error(`未找到国家 ${country} 的位置信息`);
    }

    const positions = config.mapPositions[country];
    await genshin.moveMapTo(positions[0].x, positions[0].y, country);
    const found = await locateLeyLineOutcrop(type);
    await sleep(1000); // 移动后等一下
    if (found) return;
    for (let retryCount = 1; retryCount < positions.length; retryCount++) {
        const position = positions[retryCount];
        log.info(`第 ${retryCount + 1} 次尝试定位地脉花`);
        log.info(`移动到位置：(${position.x}, ${position.y}), ${position.name || '未命名位置'}`);
        await genshin.moveMapTo(position.x, position.y);
        
        const found = await locateLeyLineOutcrop(type);
        if (found) return;
    }

    // 如果到这里还没找到
    throw new Error("寻找地脉花失败，已达最大重试次数");
}


/**
 * 在地图上定位地脉花
 * @param {string} type - 地脉花类型
 * @returns {Promise<boolean>} 是否找到地脉花
 */
async function locateLeyLineOutcrop(type) {
    await sleep(500); // 确保画面稳定
    await genshin.setBigMapZoomLevel(3.0);

    const iconPath = type === "蓝花（经验书）"
        ? "assets/icon/Blossom_of_Revelation.png"
        : "assets/icon/Blossom_of_Wealth.png";

    const flowerList = captureGameRegion().findMulti(RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconPath)));

    if (flowerList && flowerList.count > 0) {
        currentFlower = flowerList[0];
        const flowerType = type === "蓝花（经验书）" ? "经验" : "摩拉";

        const center = genshin.getPositionFromBigMap();
        const mapZoomLevel = genshin.getBigMapZoomLevel();
        const mapScaleFactor = 2.361;

        leyLineX = (960 - currentFlower.x - 25) * mapZoomLevel / mapScaleFactor + center.x;
        leyLineY = (540 - currentFlower.y - 25) * mapZoomLevel / mapScaleFactor + center.y;

        log.info(`找到地脉花的坐标：(${leyLineX}, ${leyLineY})`);
        return true;
    } else {
        log.warn("未找到地脉花");
        return false;
    }
}

/**
 * 判断坐标是否在指定位置附近（误差范围内）
 * @param {number} x - 当前X坐标
 * @param {number} y - 当前Y坐标
 * @param {number} targetX - 目标X坐标
 * @param {number} targetY - 目标Y坐标
 * @param {number} threshold - 误差阈值
 * @returns {boolean} 是否在指定范围内
 */
function isNearPosition(x, y, targetX, targetY, threshold) {
    // 使用配置中的阈值或默认值50
    const errorThreshold = threshold || 50;
    return Math.abs(x - targetX) <= errorThreshold && Math.abs(y - targetY) <= errorThreshold;
}

/**
 * 计算两点之间的二维欧几里得距离
 * @param {number} x1 - 第一个点的X坐标
 * @param {number} y1 - 第一个点的Y坐标
 * @param {number} x2 - 第二个点的X坐标
 * @param {number} y2 - 第二个点的Y坐标
 * @returns {number} 两点之间的距离
 */
function calculate2DDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * 奖励和战斗相关函数
 */

/**
 * 判断是否为地脉花并处理
 * @param {number} timeout - 超时时间
 * @param {string} targetPath - 目标路径
 * @param {number} [retries=0] - 当前函数内重试次数
 * @returns {Promise<void>}
 */
async function processLeyLineOutcrop(timeout, targetPath, retries = 0) {
    // 设置最大重试次数，防止死循环
    const MAX_RETRIES = 3;

    // 如果超过最大重试次数，记录错误并返回，避免死循环
    if (retries >= MAX_RETRIES) {
        log.error(`打开地脉花失败，已重试${MAX_RETRIES}次，终止处理`);
        log.error("我辣么大一个地脉花哪去了？");
        throw new Error("我辣么大一个地脉花哪去了？");
    }

    let captureRegion = captureGameRegion();
    let result = captureRegion.find(ocrRo2);
    let result2 = captureRegion.find(ocrRo3);
    if (result2.text.includes("地脉之花")) {
        log.info("识别到地脉之花");
        await switchToFriendshipTeamIfNeeded();
        return;
    }
    if (result2.text.includes("地脉溢口")) {
        log.info("识别到地脉溢口");
        keyPress("F");
        await sleep(300);
        keyPress("F");     // 两次重试避免开花失败
        await sleep(500);
    } else if (result.text.includes("打倒所有敌人")) {
        log.info("地脉花已经打开，直接战斗");
    } else {
        log.warn(`未识别到地脉花文本，当前重试次数: ${retries + 1}/${MAX_RETRIES}`);
        try {
            await pathingScript.runFile(targetPath);
            await processLeyLineOutcrop(timeout, targetPath, retries + 1);
            return;
        } catch (error) {
            throw new Error(`未识别到地脉花: ${error.message}`);
        }
    }
    if(!await autoFight(timeout)){
        throw new Error("战斗失败");
    }
    await switchToFriendshipTeamIfNeeded();
    await autoNavigateToReward();
}

/**
 * 尝试领取地脉花奖励
 * @returns {Promise<void>}
 */
async function attemptReward() {
    const MAX_RETRY = 5;

    // 超时处理
    if (retryCount >= MAX_RETRY) {
        retryCount = 0;
        throw new Error("超过最大重试次数，领取奖励失败");
    }

    log.info("领取奖励，优先使用浓缩树脂");
    keyPress("F");
    await sleep(500);

    // 识别是否为地脉之花界面
    let resList = captureGameRegion().findMulti(ocrRoThis); // 使用预定义的ocrRoThis对象
    let isValid = false;
    let condensedResin = null;
    let originalResin = null;
    let isResinEmpty = false;
    let dobuleReward = false;

    if (resList && resList.count > 0) {
        // 分析识别到的文本
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            if (res.text.includes("使用浓缩树脂")) {
                isValid = true;
                condensedResin = res;
            } else if (res.text.includes("使用原粹树脂")) {
                isValid = true;
                originalResin = res;
            } else if (res.text.includes("补充原粹树脂")) {
                isValid = true;
                isResinEmpty = true;
            } else if (res.text.includes("产出")) {
                isValid = true;
                dobuleReward = true;
            }
        }

        // 处理不同的树脂情况
        if (originalResin && dobuleReward == true) {
            log.info("选择使用原粹树脂，获得双倍产出");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
        } else if (condensedResin) {
            log.info("选择使用浓缩树脂");
            click(Math.round(condensedResin.x + condensedResin.width / 2), Math.round(condensedResin.y + condensedResin.height / 2));
        } else if (originalResin) {
            log.info("选择使用原粹树脂");
            click(Math.round(originalResin.x + originalResin.width / 2), Math.round(originalResin.y + originalResin.height / 2));
        } else if (isResinEmpty) {
            log.error("识别到补充原粹树脂，看来树脂用完了呢");
            keyPress("VK_ESCAPE");
            throw new Error("树脂已用完");
        }
        if (settings.friendshipTeam) {
            log.info("切换回战斗队伍");
            await sleep(500);
            const switchSuccess = await switchTeam(settings.team);
            // if (!switchSuccess) {
            //     log.warn("切换队伍失败，返回七天神像切换");
            //     await genshin.tpToStatueOfTheSeven();
            //     await genshin.switchParty(settings.team);
            //     throw new Error("切换队伍失败");
            // }
        }
    }

    // 界面不正确，尝试重试
    if (!isValid) {
        log.info("当前界面不是地脉之花界面，重试");
        await genshin.returnMainUi();
        await sleep(1000);
        retryCount++;
        await autoNavigateToReward();
        await attemptReward();
    }
}

/**
 * 打开地脉花
 * @param {string} targetPath - 目标路径
 * @returns {Promise<boolean>} 区域是否出现地脉任务
 */
async function openOutcrop(targetPath) {
    let startTime = Date.now();
    let recognized = false;

    keyPress("F");

    while (Date.now() - startTime < 5000) {
        captureRegion = captureGameRegion();
        if (recognizeFightText(captureRegion)) {
            recognized = true;
            break;
        }
        keyPress("F");
        await sleep(500);
    }

    // 返回识别结果
    return recognized;
}

/**
 * 识别地脉开启进入战斗文本
 * @returns {Promise<boolean>} 区域是否出现战斗文本
 */
function recognizeFightText(captureRegion) {
    try {
        let result = captureRegion.find(ocrRo2);
        let text = result.text;
        keywords = ["打倒", "所有", "敌人"];
        for (let keyword of keywords) {
            if (text.includes(keyword)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        log.error("OCR过程中出错: {0}", error);
    }
}

/**
 * 自动异步战斗
 * @param {number} timeout - 超时时间
 * @returns {Promise<boolean>} 战斗是否成功
 */
async function autoFight(timeout) {
    const cts = new CancellationTokenSource();
    log.info("开始战斗");
    dispatcher.RunTask(new SoloTask("AutoFight"), cts);
    let fightResult = await recognizeTextInRegion(timeout);
    logFightResult = fightResult ? "成功" : "失败";
    log.info(`战斗结束，战斗结果：${logFightResult}`);
    cts.cancel();
    return fightResult;
}

/**
 * 识别战斗结果
 * @param {number} timeout - 超时时间
 * @returns {Promise<boolean>} 战斗是否成功
 */
async function recognizeTextInRegion(timeout) {
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                let startTime = Date.now();
                let noTextCount = 0;
                const successKeywords = ["挑战达成", "战斗胜利", "挑战成功"];
                const failureKeywords = ["挑战失败"];

                // 循环检测直到超时
                while (Date.now() - startTime < timeout) {
                    try {
                        let captureRegion = captureGameRegion();
                        let result = captureRegion.find(ocrRo1);
                        let text = result.text;

                        // 检查成功关键词
                        for (let keyword of successKeywords) {
                            if (text.includes(keyword)) {
                                log.info("检测到战斗成功关键词: {0}", keyword);
                                resolve(true);
                                return;
                            }
                        }

                        // 检查失败关键词
                        for (let keyword of failureKeywords) {
                            if (text.includes(keyword)) {
                                log.warn("检测到战斗失败关键词: {0}", keyword);
                                resolve(false);
                                return;
                            }
                        }


                        let foundText = recognizeFightText(captureRegion);
                        if (!foundText) {
                            noTextCount++;
                            log.info(`检测到可能离开战斗区域，当前计数: ${noTextCount}`);

                            if (noTextCount >= 10) {
                                log.warn("已离开战斗区域");
                                resolve(false);
                                return;
                            }
                        }
                        else {
                            noTextCount = 0; // 重置计数
                        }
                    }
                    catch (error) {
                        log.error("OCR过程中出错: {0}", error);
                    }

                    await sleep(1000); // 检查间隔
                }

                log.warn("在超时时间内未检测到战斗结果");
                resolve(false);
            } catch (error) {
                reject(error);
            }
        })();
    });
}







// 地脉花奖励相关函数
/**
 * 自动导航到地脉花奖励点
 * @returns {Promise<void>}
 */
async function autoNavigateToReward() {
    // 定义识别对象
    const cts = new CancellationTokenSource();
    const MAX_RETRY = 3; // 最大重试次数
    let retryCount = 0;

    try {
        // 调整初始视角为俯视角
        log.info("调整视角...");
        middleButtonClick();
        await sleep(300);

        while (retryCount < MAX_RETRY) {
            try {
                log.info(`开始自动导航到地脉花...(尝试 ${retryCount + 1}/${MAX_RETRY})`);
                let rewardDetectionPromise = startRewardTextDetection(cts);

                // 启动导航任务，添加超时参数
                await Promise.race([
                    navigateTowardReward(60000, cts.token), // 设置60秒超时
                    rewardDetectionPromise
                ]);

                // 取消导航任务
                cts.cancel();
                keyUp("w"); // 确保停止前进
                log.info("已到达领奖点");
                return; // 成功完成
            } catch (error) {
                retryCount++;
                cts.cancel(); // 确保取消旧的令牌
                keyUp("w"); // 确保停止前进

                if (error.message === '前进时间超时') {
                    log.warn(`导航超时，正在重试 (${retryCount}/${MAX_RETRY})`);

                    // 尝试进行恢复操作
                    keyPress("x"); // 尝试重置视角
                    await sleep(500);
                    keyDown("s");
                    await sleep(1000);
                    keyUp("s");
                    await sleep(500);

                    // 创建新的令牌
                    cts = new CancellationTokenSource();
                } else {
                    // 对于其他错误，直接抛出
                    throw error;
                }
            }
        }

        // 如果达到最大重试次数仍然失败
        throw new Error(`导航到地脉花失败，已尝试 ${MAX_RETRY} 次`);
    } catch (error) {
        // 确保清理
        cts.cancel();
        keyUp("w");
        log.error(`导航过程中出错: ${error}`);
        throw error;
    }
}

/**
 * 监测文字区域，检测到地脉之花文字时返回
 * @param {CancellationTokenSource} cts - 取消令牌源
 * @returns {Promise<boolean>} - 是否检测到文字
 */
async function startRewardTextDetection(cts) {
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                while (!cts.token.isCancellationRequested) {
                    // 首先检查异常界面
                    let captureRegion = captureGameRegion();

                    // 检查是否误触发其他页面
                    if (captureRegion.Find(paimonMenuRo).IsEmpty()) {
                        log.info("误触发其他页面，尝试关闭页面");
                        await genshin.returnMainUi();
                        await sleep(300);
                        continue;
                    }

                    // 检查是否已经到达领奖界面
                    let resList = captureRegion.findMulti(ocrRoThis); // 使用预定义的ocrRoThis对象
                    if (resList && resList.count > 0) {
                        for (let i = 0; i < resList.count; i++) {
                            if (resList[i].text.includes("原粹树脂")) {
                                log.info("已到达领取页面，可以领奖");
                                resolve(true);
                                return;
                            }
                        }
                    }

                    let ocrResults = captureRegion.findMulti(ocrRo3);

                    if (ocrResults && ocrResults.count > 0) {
                        for (let i = 0; i < ocrResults.count; i++) {
                            if (ocrResults[i].text.includes("接触") ||
                                ocrResults[i].text.includes("地脉") ||
                                ocrResults[i].text.includes("之花")) {
                                log.info("检测到文字: " + ocrResults[i].text);
                                resolve(true);
                                return;
                            }
                        }
                    }

                    await sleep(200);
                }
            } catch (error) {
                reject(error);
            }
        })();
    });
}

/**
 * 导航向奖励点
 * @param {number} timeout - 超时时间
 * @param {CancellationToken} token - 取消令牌
 * @returns {Promise<void>}
 */
async function navigateTowardReward(timeout, token) {
    let navigateStartTime = Date.now();
    try {
        while (!token.isCancellationRequested) {
            if (await adjustViewForReward(boxIconRo, token)) {
                keyDown("w");
                await sleep(300);
            } else if (!token.isCancellationRequested) { // 如果没有取消，则继续尝试调整
                keyPress("x");
                keyUp("w");
                keyDown("s");
                await sleep(1000);
                keyUp("s");
                keyDown("w");
            }

            if (Date.now() - navigateStartTime > timeout) {
                keyUp("w");
                throw new Error('前进时间超时');
            }

            // 增加短暂延迟以避免过于频繁的检测
            await sleep(100);
        }
    } catch (error) {
        keyUp("w"); // 确保释放按键
        throw error;
    } finally {
        keyUp("w"); // 确保释放按键
    }
}

/**
 * 调整视野直到图标位于正前方
 * @param {Object} boxIconRo - 宝箱图标识别对象
 * @param {CancellationToken} token - 取消令牌
 * @returns {Promise<boolean>}
 */
async function adjustViewForReward(boxIconRo, token) {
    const screenCenterX = 960;
    const screenCenterY = 540;
    const maxAngle = 10; // 最大允许偏离角度（度）

    for (let i = 0; i < 20; i++) {
        // 检查是否取消操作
        if (token && token.isCancellationRequested) {
            log.info("视角调整已取消");
            return false;
        }

        let captureRegion = captureGameRegion();
        let iconRes = captureRegion.Find(boxIconRo);

        if (!iconRes.isExist()) {
            throw new Error('未找到图标，没有地脉花');
        }

        // 计算图标相对于屏幕中心的位置
        const xOffset = iconRes.x - screenCenterX;
        const yOffset = screenCenterY - iconRes.y; // 注意：y坐标向下增加，所以翻转差值

        // 计算图标与中心垂直线的角度
        const angleInRadians = Math.atan2(Math.abs(xOffset), yOffset);
        const angleInDegrees = angleInRadians * (180 / Math.PI);

        // 检查图标是否在中心上方，且角度在允许范围内
        const isAboveCenter = iconRes.y < screenCenterY;
        const isWithinAngle = angleInDegrees <= maxAngle;

        log.info(`图标位置: (${iconRes.x}, ${iconRes.y}), 角度: ${angleInDegrees.toFixed(2)}°`);

        if (isAboveCenter && isWithinAngle) {
            log.info(`视野调整成功，图标角度: ${angleInDegrees.toFixed(2)}°，在${maxAngle}°范围内`);
            return true;
        } else {
            keyUp("w"); // 确保停止前进
            // 调整视野方向，根据图标位置调整鼠标移动
            moveMouseBy(xOffset > 0 ? Math.min(xOffset, 300) : Math.max(xOffset, -300), 0);
            await sleep(100);

            if (!isAboveCenter) {
                log.warn("图标不在屏幕中心上方");
                // 尝试将视角向下调整
                moveMouseBy(0, 500);
                await sleep(100);
            } else if (!isWithinAngle) {
                log.warn(`图标角度${angleInDegrees.toFixed(2)}°不在范围内`);
            }
        }
    }

    log.warn("调整视野20次后仍未成功");
    return false;
}

/**
 * 地图标记相关函数
 */

/**
 * 关闭自定义标记，使用前确保在地图界面
 * @returns {Promise<void>}
 */
async function closeCustomMarks() {
    // await genshin.returnMainUi();
    // keyPress("M");
    await sleep(600);
    click(60, 1020);
    await sleep(600);

    let button = captureGameRegion().find(openRo);
    if (button.isExist()) {
        marksStatus = false;
        log.info("关闭自定义标记");
        click(Math.round(button.x + button.width / 2), Math.round(button.y + button.height / 2));
        await sleep(600);
        keyPress("ESCAPE");
    } else {
        log.error("未找到开关按钮");
    }
}

/**
 * 打开自定义标记，使用前确保在地图界面
 * @returns {Promise<void>}
 */
async function openCustomMarks() {
    await sleep(600);
    click(60, 1020);
    await sleep(600);

    let button = captureGameRegion().find(closeRo);
    if (button.isExist()) {
        for (let i = 0; i < button.count; i++) {
            let b = button[i];
            if (b.y > 280 && b.y < 350) {
                log.info("打开自定义标记");
                marksStatus = true;
                click(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
            }
        }
    } else {
        log.error("未找到开关按钮");
    }
}
