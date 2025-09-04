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
 * 1. 全局异常处理，记录日志并发送通知
 */
(async function () {
    try {
        await runLeyLineOutcropScript();
    }
    catch (error) {
        // 全局错误捕获，记录并发送错误日志
        log.error("出错了: {error}", error.message);
        if (isNotification) {
            notification.error(`出错了: ${error.message}`);
        }
    }
    finally {
        if (!marksStatus) {
            // 任何时候都确保自定义标记处于打开状态
            await openCustomMarks();
        }
        log.info("全自动地脉花运行结束");
    }
})();

/**
 * 运行地脉花脚本的主要逻辑
 * @returns {Promise<void>}
 */
async function runLeyLineOutcropScript() {
    // 初始化加载配置和设置并校验
    initialize();
    await prepareForLeyLineRun();

    // 执行地脉花挑战
    await runLeyLineChallenges();
}

/**
 * 初始化
 * @returns {Promise<void>}
 */
function initialize() {
    // 预定义工具函数
    try {
        const utils = [
            "attemptReward.js",
            "breadthFirstPathSearch.js",
            "executePathsUsingNodeData.js",
            "findLeyLineOutcrop.js",
            "findLeyLineOutcropByBook.js",
            "loadSettings.js",
            "processLeyLineOutcrop.js",
            "recognizeTextInRegion.js"
        ]; 
        for (const fileName of utils) {
            eval(file.readTextSync(`utils/${fileName}`));
        }
    } catch (error) {
        throw new Error(`JS文件缺失: ${error.message}`); 
    }
    // 2. 加载配置文件
    try {
        config = JSON.parse(file.readTextSync("config.json"));
        loadSettings();
    } catch (error) {
        throw new Error("配置文件加载失败，请检查config.json文件是否存在");
    }
}


/**
 * 执行地脉花挑战前的准备工作
 * 1. 传送七天神像和切换战斗队伍
 * 2. 关闭自定义标记
 * 3. 添加自动拾取实时任务
 * 注意：该函数运行结束之后位于大地图界面
 * @returns {Promise<void>}
 */
async function prepareForLeyLineRun() {
    // 0. 回到主界面
    await genshin.returnMainUi();  // 回到主界面
    setGameMetrics(1920, 1080, 1); // 看起来没什么用
    // 1. 开局传送到七天神像
    // TODO：考虑添加选项禁用这个特性，看起来有点浪费时间，需要提示风险
    await genshin.tpToStatueOfTheSeven(); 

    // 2. 切换战斗队伍
    if (settings.team) {
        log.info(`切换至队伍 ${settings.team}`);
        await genshin.switchParty(settings.team);
    }
    // 3. 关闭自定义标记
    if (!settings.useAdventurerHandbook) {
        await closeCustomMarks();
    }
    // 4. 添加自动拾取实时任务
    // TODO: 个性化拾取策略
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
}

/**
 * 执行地脉花挑战的主要逻辑
 * @returns {Promise<void>}
 */
async function runLeyLineChallenges() {
    while (currentRunTimes < settings.timesValue) {
        // 寻找地脉花位置
        // 数据保存在全局变量中 leyLineX，leyLineY
        if (settings.useAdventurerHandbook) {
            await findLeyLineOutcropByBook(settings.country, settings.leyLineOutcropType);
        } else {
            await findLeyLineOutcrop(settings.country, settings.leyLineOutcropType);
        }

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
 * 加载节点数据
 * @returns {Promise<Object>} 节点数据对象
 */
async function loadNodeData() {
    try {
        const nodeDataText = await file.readText("LeyLineOutcropData.json");
        const rawData = JSON.parse(nodeDataText);
        
        // 适配数据结构：将原始数据转换为代码期望的格式
        return adaptNodeData(rawData);
    } catch (error) {
        log.error(`加载节点数据失败: ${error.message}`);
        throw new Error("无法加载 LeyLineOutcropData.json 文件");
    }
}

/**
 * 适配数据结构：将原始数据转换为代码期望的格式
 * @param {Object} rawData - 原始JSON数据
 * @returns {Object} 适配后的节点数据
 */
function adaptNodeData(rawData) {
    const adaptedData = {
        node: [],
        indexes: rawData.indexes
    };
    
    // 添加传送点，设置type为"teleport"
    if (rawData.teleports) {
        for (const teleport of rawData.teleports) {
            adaptedData.node.push({
                ...teleport,
                type: "teleport",
                next: [],
                prev: []
            });
        }
    }
    
    // 添加地脉花节点，设置type为"blossom"
    if (rawData.blossoms) {
        for (const blossom of rawData.blossoms) {
            adaptedData.node.push({
                ...blossom,
                type: "blossom",
                next: [],
                prev: []
            });
        }
    }
    
    // 根据edges构建next和prev关系
    if (rawData.edges) {
        for (const edge of rawData.edges) {
            const sourceNode = adaptedData.node.find(node => node.id === edge.source);
            const targetNode = adaptedData.node.find(node => node.id === edge.target);
            
            if (sourceNode && targetNode) {
                sourceNode.next.push({
                    target: edge.target,
                    route: edge.route
                });
                targetNode.prev.push(edge.source);
            }
        }
    }
    
    log.debug(`适配数据完成：传送点 ${rawData.teleports ? rawData.teleports.length : 0} 个，地脉花 ${rawData.blossoms ? rawData.blossoms.length : 0} 个，边缘 ${rawData.edges ? rawData.edges.length : 0} 个`);
    
    return adaptedData;
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
        log.debug(`路径选项 ${i + 1}: 起点ID ${paths[i].startNode.id}, ${paths[i].routes.length} 段路径`);
        for (let j = 0; j < paths[i].routes.length; j++) {
            log.debug(`  - 路径 ${j + 1}: ${paths[i].routes[j]}`);
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
 * 地脉花寻找和定位相关函数
 */

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
            captureRegion.dispose();
            break;
        }
        captureRegion.dispose();
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
    let fightTask = dispatcher.RunTask(new SoloTask("AutoFight"), cts);
    let fightResult = await recognizeTextInRegion(timeout);
    logFightResult = fightResult ? "成功" : "失败";
    log.info(`战斗结束，战斗结果：${logFightResult}`);
    cts.cancel();
    
    try {
        await fightTask;
    } catch (error) {
        // 忽略取消任务产生的异常
        if (error.message && error.message.includes("取消")) {
            log.debug("战斗任务已正常取消");
        } else {
            log.warn(`战斗任务结束时出现异常: ${error.message}`);
        }
    }
    
    return fightResult;
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

                    try {
                        // 检查是否误触发其他页面
                        if (captureRegion.Find(paimonMenuRo).IsEmpty()) {
                            log.debug("误触发其他页面，尝试关闭页面");
                            await genshin.returnMainUi();
                            await sleep(300);
                            continue;
                        }

                        // 检查是否已经到达领奖界面
                        let resList = captureRegion.findMulti(ocrRoThis); // 使用预定义的ocrRoThis对象
                        if (resList && resList.count > 0) {
                            for (let i = 0; i < resList.count; i++) {
                                if (resList[i].text.includes("原粹树脂")) {
                                    log.debug("已到达领取页面，可以领奖");
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
                                    log.debug("检测到文字: " + ocrResults[i].text);
                                    resolve(true);
                                    return;
                                }
                            }
                        }
                    } finally {
                        captureRegion.dispose();
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
        captureRegion.dispose();
        if (!iconRes.isExist()) {
            log.warn("未找到图标，等待一下");
            await sleep(1000); 
            continue; // 没有找到图标等一秒再继续
            // throw new Error('未找到图标，没有地脉花');
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

        log.debug(`图标位置: (${iconRes.x}, ${iconRes.y}), 角度: ${angleInDegrees.toFixed(2)}°`);

        if (isAboveCenter && isWithinAngle) {
            log.debug(`视野调整成功，图标角度: ${angleInDegrees.toFixed(2)}°，在${maxAngle}°范围内`);
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
 * 关闭自定义标记
 * @returns {Promise<void>}
 */
async function closeCustomMarks() {
    await genshin.returnMainUi();
    keyPress("M");
    await sleep(1000);
    click(60, 1020);
    await sleep(600);

    let captureRegion1 = captureGameRegion();
    let button = captureRegion1.find(openRo);
    captureRegion1.dispose();
    if (button.isExist()) {
        marksStatus = false;
        log.info("关闭自定义标记");
        click(Math.round(button.x + button.width / 2), Math.round(button.y + button.height / 2));
        await sleep(600);
        keyPress("ESCAPE");
    } else {
        log.error("未找到开关按钮");
        keyPress("ESCAPE");
    }
}

/**
 * 打开自定义标记
 * @returns {Promise<void>}
 */
async function openCustomMarks() {
    await genshin.returnMainUi();
    keyPress("M");
    await sleep(1000);
    click(60, 1020);
    await sleep(600);

    let captureRegion2 = captureGameRegion();
    let button = captureRegion2.find(closeRo);
    captureRegion2.dispose();
    if (button.isExist()) {
        for (let i = 0; i < button.count; i++) {
            let b = button[i];
            if (b.y > 280 && b.y < 350) {
                log.info("打开自定义标记");
                click(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
            }
        }
    } else {
        log.error("未找到开关按钮");
        genshin.returnMainUi();
    }
}
