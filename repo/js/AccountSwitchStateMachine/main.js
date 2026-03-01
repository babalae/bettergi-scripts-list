// 全局状态机配置对象
let stateMachineConfig = null;

// 全局游戏画面区域
let gameRegion = null;

// 主逻辑
(async function () {
    // 读取状态配置文件
    let statesData;
    try {
        const statesJsonText = file.readTextSync('assets/states.json');
        statesData = JSON.parse(statesJsonText);
    } catch (e) {
        log.error(`读取 states.json 失败：${e.message}，状态机无法正常工作`);
        throw e;
    }

    if (!statesData || !Array.isArray(statesData)) {
        const errorMsg = 'states.json 格式错误：应为状态对象数组';
        log.error(errorMsg);
        throw new Error(errorMsg);
    }

    // 将状态数组转换为对象，以状态名称为key
    stateMachineConfig = {};
    for (const state of statesData) {
        stateMachineConfig[state.name] = state;
    }
    log.info(`成功加载 ${statesData.length} 个状态配置`);

    // 检查是否进入截图模式
    if (settings.screenshotMode) {
        await handleScreenshotMode();
        return;
    }

    // 检查是否需要UID校验
    if (settings.verifyUid) {
        log.info('开始：验证当前账号UID');
        const currentUid = await verifyCurrentUid();
        if (isUidMatch(currentUid, settings.targetUid)) {
            log.info(`当前账号UID ${currentUid} 与目标UID ${settings.targetUid} 匹配，无需切换`);
            notification.Send(`当前账号UID ${currentUid} 与目标UID ${settings.targetUid} 匹配，无需切换`);
            return;
        }
    }

    // 根据是否开启UID校验决定最大尝试次数
    let attempts = 0;
    const maxAttempts = settings.verifyUid ? 2 : 1;
    let switchSuccess = false;
    let notificationMessage = null;

    while (attempts < maxAttempts) {
        attempts++;
        log.info(`开始第 ${attempts} 次账号切换尝试`);

        // 用于保存通知消息
        let currentNotificationMessage = null;
        let currentSwitchSuccess = false;

        // 判断是否跳过搜索，直接使用账号密码
        let useAccountPassword = settings.skipSearch;
        
        if (!useAccountPassword) {
            // 尝试预加载账号图片模板
            let accountImageMat = null;
            const accountImagePath = `accounts/${settings.targetUid}.png`;
            
            try {
                accountImageMat = file.ReadImageMatSync(accountImagePath);
                log.info(`成功预加载账号图片：${accountImagePath}`);
            } catch (e) {
                log.warn(`预加载账号图片失败：${accountImagePath}，错误：${e.message}`);
                log.warn('将使用账号密码方式登录');
                useAccountPassword = true;
            }
            
            // 如果图片预加载成功，尝试使用图片查找方式
            if (!useAccountPassword) {
                // 尝试查找账号图片分支
                log.info('开始：尝试使用账号图片查找方式');
                
                // 首先定位到"进入游戏或登录其他账号"状态
                log.info('开始：尝试切换到 enterGame 状态');
                const enterGameResult = await goToState('enterGame');
                if (!enterGameResult) {
                    log.warn('失败：未能到达 enterGame 状态，将尝试使用账号密码方式');
                    useAccountPassword = true;
                } else {
                    log.info('成功到达 enterGame 状态');
                    
                    // 检查当前界面是否存在目标账号图片（适用于只有一个账号的情况）
                    log.info(`尝试在 enterGame 状态查找账号图片：${accountImagePath}`);
                    const uidFoundInEnterGame = await findAndClickByMat(accountImageMat, false, 1000);
                    
                    if (uidFoundInEnterGame) {
                        log.info(`在 enterGame 状态找到账号图片：${settings.targetUid}.png`);
                        // 点击进入游戏按钮
                        await findAndClick('assets/RecognitionObjects/EnterGame.png', true, 1000);
                        
                        // 定位到主界面
                        log.info('开始：尝试切换到 mainUI 状态');
                        const mainUIResult = await goToState('mainUI');
                        if (mainUIResult) {
                            log.info('成功到达 mainUI 状态，账号切换完成');
                            currentSwitchSuccess = true;
                            currentNotificationMessage = `使用账号图片方式成功切换到uid为${settings.targetUid}的账号`;
                        } else {
                            log.warn('失败：未能到达 mainUI 状态，将尝试使用账号密码方式');
                            useAccountPassword = true;
                        }
                    } else {
                        log.info('在 enterGame 状态未找到账号图片，尝试展开账号列表');
                        
                        // 定位到选择账号界面
                        log.info('开始：尝试切换到 selectAccount 状态');
                        const selectAccountResult = await goToState('selectAccount');
                        if (!selectAccountResult) {
                            log.warn('失败：未能到达 selectAccount 状态，将尝试使用账号密码方式');
                            useAccountPassword = true;
                        } else {
                            log.info('成功到达 selectAccount 状态');
                            
                            // 使用预加载的图片模板进行查找
                            log.info(`尝试查找并点击账号图片：${accountImagePath}`);
                            const uidFound = await findAndClickByMat(accountImageMat, true, 5000);
                            
                            if (uidFound) {
                                log.info(`成功点击账号图片：${settings.targetUid}.png`);
                                
                                // 定位到主界面
                                log.info('开始：尝试切换到 mainUI 状态');
                                const mainUIResult = await goToState('mainUI');
                                if (mainUIResult) {
                                    log.info('成功到达 mainUI 状态，账号切换完成');
                                    currentSwitchSuccess = true;
                                    currentNotificationMessage = `使用账号图片方式成功切换到uid为${settings.targetUid}的账号`;
                                } else {
                                    log.warn('失败：未能到达 mainUI 状态，将尝试使用账号密码方式');
                                    useAccountPassword = true;
                                }
                            } else {
                                log.warn(`未找到账号图片：${settings.targetUid}.png，将尝试使用账号密码方式`);
                                useAccountPassword = true;
                            }
                        }
                    }
                }
            }
        } else {
            log.info('已勾选跳过搜索，直接使用账号密码登录');
        }

        // 账号密码分支
        if (useAccountPassword) {
            log.info('开始：使用账号密码登录方式');
            
            // 检查账号密码是否为空
            if (!settings.account || !settings.password) {
                log.error('账号或密码为空，无法使用账号密码方式登录');
                log.error(`账号：${settings.account ? '已设置' : '未设置'}，密码：${settings.password ? '已设置' : '未设置'}`);
                currentNotificationMessage = '切换失败，账号或密码为空';
            } else {
                // 切换到"输入账号密码"状态
                log.info('开始：尝试切换到 enterAccountAndPassword 状态');
                const result = await goToState('enterAccountAndPassword');
                if (!result) {
                    log.warn('失败：未能到达 enterAccountAndPassword 状态');
                    currentNotificationMessage = '切换失败，未能到达输入账号密码界面';
                } else {
                    log.info('成功到达 enterAccountAndPassword 状态');

                    // 循环点击同意按钮，直到找不到为止
                    log.info('开始循环点击同意按钮');
                    let agreeFound = true;
                    while (agreeFound) {
                        // 创建带阈值的识别对象
                        const agreeRo = RecognitionObject.TemplateMatch(
                            file.ReadImageMatSync('assets/RecognitionObjects/Agree.png'),
                            0, 0, 1920, 1080
                        );
                        agreeRo.Threshold = 0.9;
                        agreeFound = await findAndClick(agreeRo, true, 1000);
                        if (agreeFound) {
                            log.info('点击了同意按钮，继续查找');
                            await sleep(500);
                        } else {
                            log.info('未找到同意按钮，循环结束');
                        }
                    }

                    // 输入账号
                    log.info('开始输入账号');
                    let accountInputFound = true;
                    while (accountInputFound) {
                        accountInputFound = await findAndClick('assets/RecognitionObjects/EnterAccount.png', true, 1000);
                        if (accountInputFound) {
                            log.info('点击了账号输入框');
                            await sleep(100);
                            // 输入账号
                            inputText(settings.account);
                            log.info('已输入账号');
                            await sleep(500);
                            // 检查输入框是否还存在（验证输入是否成功）
                            const checkRo = RecognitionObject.TemplateMatch(
                                file.ReadImageMatSync('assets/RecognitionObjects/EnterAccount.png'),
                                0, 0, 1920, 1080
                            );
                            const tempRegion = captureGameRegion();
                            accountInputFound = tempRegion.find(checkRo).isExist();
                            tempRegion.dispose();
                            if (accountInputFound) {
                                log.warn('账号输入框仍然存在，可能输入失败，重试');
                            } else {
                                log.info('账号输入完成');
                            }
                        } else {
                            log.warn('未找到账号输入框');
                        }
                    }

                    // 输入密码
                    log.info('开始输入密码');
                    let passwordInputFound = true;
                    while (passwordInputFound) {
                        passwordInputFound = await findAndClick('assets/RecognitionObjects/EnterPassword.png', true, 1000);
                        if (passwordInputFound) {
                            log.info('点击了密码输入框');
                            await sleep(100);
                            // 输入密码
                            inputText(settings.password);
                            log.info('已输入密码');
                            await sleep(500);
                            // 检查输入框是否还存在（验证输入是否成功）
                            const checkRo = RecognitionObject.TemplateMatch(
                                file.ReadImageMatSync('assets/RecognitionObjects/EnterPassword.png'),
                                0, 0, 1920, 1080
                            );
                            const tempRegion = captureGameRegion();
                            passwordInputFound = tempRegion.find(checkRo).isExist();
                            tempRegion.dispose();
                            if (passwordInputFound) {
                                log.warn('密码输入框仍然存在，可能输入失败，重试');
                            } else {
                                log.info('密码输入完成');
                            }
                        } else {
                            log.warn('未找到密码输入框');
                        }
                    }

                    // 点击进入游戏按钮，直到消失
                    log.info('开始点击进入游戏按钮');
                    let enterGame2Found = true;
                    while (enterGame2Found) {
                        enterGame2Found = await findAndClick('assets/RecognitionObjects/EnterGame2.png', true, 1000);
                        if (enterGame2Found) {
                            log.info('点击了进入游戏按钮，继续查找');
                            await sleep(500);
                        } else {
                            log.info('未找到进入游戏按钮，循环结束');
                        }
                    }

                    // 切换到主界面
                    log.info('开始：尝试切换到 mainUI 状态');
                    const mainUIResult = await goToState('mainUI');
                    if (mainUIResult) {
                        log.info('成功到达 mainUI 状态，账号切换完成');
                        currentSwitchSuccess = true;
                        currentNotificationMessage = `使用账号密码方式成功切换到uid为${settings.targetUid}的账号`;
                    } else {
                        log.warn('失败：未能到达 mainUI 状态');
                        currentNotificationMessage = '切换失败，未能到达主界面';
                    }
                }
            }
        }

        // 统一处理：回到主界面
        if (!currentSwitchSuccess) {
            log.info('尝试返回主界面');
            const backToMainResult = await goToState('mainUI');
            if (backToMainResult) {
                log.info('已返回主界面');
            } else {
                log.warn('未能返回主界面');
            }
        }

        // 检查是否需要UID校验
        if (settings.verifyUid) {
            log.info('开始：验证切换后的账号UID');
            const currentUid = await verifyCurrentUid();
            if (isUidMatch(currentUid, settings.targetUid)) {
                log.info(`切换后的账号UID ${currentUid} 与目标UID ${settings.targetUid} 匹配，切换成功`);
                currentSwitchSuccess = true;
                if (!currentNotificationMessage) {
                    currentNotificationMessage = `成功切换到uid为${settings.targetUid}的账号`;
                }
            } else {
                log.warn(`切换后的账号UID ${currentUid} 与目标UID ${settings.targetUid} 不匹配，需要重新尝试`);
                currentSwitchSuccess = false;
                currentNotificationMessage = `切换失败，当前账号UID ${currentUid} 与目标UID ${settings.targetUid} 不匹配`;
            }
        }

        // 如果切换成功，跳出循环
        if (currentSwitchSuccess) {
            switchSuccess = true;
            notificationMessage = currentNotificationMessage;
            break;
        }

        // 如果是最后一次尝试，保存失败消息
        if (attempts === maxAttempts) {
            notificationMessage = currentNotificationMessage;
        }
    }

    // 发送通知
    if (notificationMessage) {
        if (switchSuccess) {
            notification.Send(notificationMessage);
        } else {
            notification.error(notificationMessage);
        }
    }
})();

/**
 * 判断当前所属状态
 * 使用广度优先遍历(BFS)从上一个状态开始查找，提高查找效率
 *
 * @param {string|null} previousState - 上一个状态，null表示首次运行或未知状态
 * @returns {string|null} 当前状态标识，如果无法确定则返回null
 */
async function determineCurrentState(previousState = null) {
    if (!stateMachineConfig) {
        log.error('状态机配置未加载');
        return null;
    }

    // 构建BFS遍历序列
    const stateSequence = buildBFSSequence(previousState);

    // 最多尝试3次
    const maxAttempts = 30;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // 捕获游戏画面
        gameRegion = captureGameRegion();

        // 遍历所有状态进行匹配
        for (const stateName of stateSequence) {
            const state = stateMachineConfig[stateName];
            if (!state || !state.detection) continue;

            // 评估该状态的检测条件
            if (await evaluateDetectionConditions(state.detection)) {
                return stateName;
            }
        }

        if (attempt < maxAttempts) {
            log.warn(`第 ${attempt} 次尝试未识别到当前状态，1秒后重试...`);
            await sleep(1000);
        }
    }

    log.error(`经过 ${maxAttempts} 次尝试仍无法识别当前状态`);
    return null;
}

/**
 * 构建BFS遍历序列
 * 从previousState开始广度优先遍历，然后处理剩余未遍历节点
 *
 * @param {string|null} previousState - 起始状态
 * @returns {string[]} 状态遍历序列
 */
function buildBFSSequence(previousState = null) {
    if (!stateMachineConfig) {
        log.error('状态机配置未加载');
        return [];
    }

    const allStates = Object.keys(stateMachineConfig);
    if (allStates.length === 0) return [];

    const visited = new Set();
    const sequence = [];
    const queue = [];

    // 如果有指定起始状态，从它开始BFS
    if (previousState && stateMachineConfig[previousState]) {
        queue.push(previousState);
        visited.add(previousState);
    }

    // BFS遍历
    while (queue.length > 0) {
        const currentState = queue.shift();
        sequence.push(currentState);

        const state = stateMachineConfig[currentState];
        if (state && state.transitions) {
            for (const transition of state.transitions) {
                const targetState = transition.targetState;
                if (targetState && !visited.has(targetState) && stateMachineConfig[targetState]) {
                    visited.add(targetState);
                    queue.push(targetState);
                }
            }
        }
    }

    // 处理未遍历到的节点（从第一个未遍历节点开始继续BFS）
    for (const stateName of allStates) {
        if (!visited.has(stateName)) {
            // 从这个未遍历节点开始新的BFS
            const subQueue = [stateName];
            visited.add(stateName);

            while (subQueue.length > 0) {
                const currentState = subQueue.shift();
                sequence.push(currentState);

                const state = stateMachineConfig[currentState];
                if (state && state.transitions) {
                    for (const transition of state.transitions) {
                        const targetState = transition.targetState;
                        if (targetState && !visited.has(targetState) && stateMachineConfig[targetState]) {
                            visited.add(targetState);
                            subQueue.push(targetState);
                        }
                    }
                }
            }
        }
    }

    return sequence;
}

/**
 * 评估状态的检测条件
 * 根据配置中的conditions和logic表达式判断当前是否处于该状态
 *
 * @param {Object} detection - 检测配置对象，包含conditions数组和logic表达式
 * @returns {boolean} 是否匹配该状态
 */
async function evaluateDetectionConditions(detection) {
    if (!detection || !detection.conditions || detection.conditions.length === 0) {
        return false;
    }

    // 计算每个条件的值
    const conditionValues = {};

    for (const condition of detection.conditions) {
        const { id, template, region } = condition;

        // 移动鼠标到安全位置（避免遮挡识别区域）
        const safeX = 10;
        const safeY = 10;
        moveMouseTo(safeX, safeY);
        await sleep(50);

        // 创建识别对象
        const templatePath = template;
        const ro = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(templatePath),
            region.x, region.y, region.width, region.height
        );

        // 执行识别
        const result = gameRegion.find(ro);
        conditionValues[id] = result.isExist();


    }

    // 使用logic表达式计算最终结果
    // 将logic表达式中的条件ID替换为实际值
    let logicExpression = detection.logic;
    for (const [key, value] of Object.entries(conditionValues)) {
        // 使用正则替换完整的条件名，避免部分匹配
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        logicExpression = logicExpression.replace(regex, value);
    }

    // 计算逻辑表达式
    try {
        const result = eval(logicExpression);
        return result;
    } catch (e) {
        log.error(`逻辑表达式计算失败: ${detection.logic} -> ${logicExpression}, 错误: ${e.message}`);
        return false;
    }
}

/**
 * 前往指定状态
 * 判断当前状态后，执行相应操作前往目标状态，每步执行后重新判断当前状态
 *
 * @param {string} targetState - 目标状态名称
 * @param {string|null} previousState - 上一个状态（可选），用于判断状态起点
 * @returns {boolean} 是否成功到达目标状态
 */
async function goToState(targetState, previousState = null) {
    if (!stateMachineConfig) {
        log.error('状态机配置未加载');
        return false;
    }

    if (!stateMachineConfig[targetState]) {
        log.error(`目标状态 ${targetState} 不存在于配置中`);
        return false;
    }

    const maxSteps = 20; // 最大步骤数，防止无限循环
    let currentState = previousState;
    let steps = 0;

    // 防护机制：记录每个状态的尝试次数
    const stateAttemptCount = new Map();
    const maxStateAttempts = 5; // 同一状态最多尝试5次

    while (steps < maxSteps) {
        // 判断当前状态
        const detectedState = await determineCurrentState(currentState);

        if (!detectedState) {
            log.error('无法识别当前状态，停止状态切换');
            return false;
        }

        // 检查是否已到达目标状态
        if (detectedState === targetState) {
            log.info(`已到达目标状态: ${targetState}`);
            return true;
        }

        // 防护机制：检查当前状态的尝试次数
        const attemptCount = stateAttemptCount.get(detectedState) || 0;
        if (attemptCount >= maxStateAttempts) {
            log.error(`状态 ${detectedState} 已连续尝试 ${attemptCount} 次，超过最大限制，停止状态切换`);
            log.error('可能陷入状态循环，请检查状态配置或界面状态');
            return false;
        }
        stateAttemptCount.set(detectedState, attemptCount + 1);

        // 查找从当前状态到目标状态的路径
        const path = findPath(detectedState, targetState);
        if (!path || path.length === 0) {
            log.error(`无法找到从 ${detectedState} 到 ${targetState} 的路径`);
            return false;
        }

        // 执行路径中的第一步
        const nextState = path[0];
        const transition = stateMachineConfig[detectedState].transitions.find(
            t => t.targetState === nextState
        );

        if (!transition) {
            log.error(`从 ${detectedState} 到 ${nextState} 的转移未定义`);
            return false;
        }

        // 只在第一次尝试或重试时显示转移信息
        if (attemptCount === 0) {
            log.info(`${detectedState} -> ${nextState} (目标: ${targetState})`);
        } else {
            log.warn(`重试: ${detectedState} -> ${nextState} (第 ${attemptCount + 1} 次)`);
        }
        try {
            // 使用 new Function 创建异步函数并执行
            const actionFunc = new Function('return (async () => { ' + transition.action + ' })()');
            await actionFunc();
        } catch (e) {
            log.error(`执行转移操作失败: ${e.message}`);
            return false;
        }

        // 等待一小段时间让界面响应
        await sleep(500);

        currentState = detectedState;
        steps++;
    }

    log.error(`超过最大步骤数 ${maxSteps}，停止状态切换`);
    return false;
}

/**
 * 查找从起始状态到目标状态的路径
 * 使用BFS算法查找最短路径
 *
 * @param {string} startState - 起始状态
 * @param {string} targetState - 目标状态
 * @returns {string[]|null} 路径数组（不包含起始状态，包含目标状态），如果无法到达则返回null
 */
function findPath(startState, targetState) {
    if (!stateMachineConfig[startState] || !stateMachineConfig[targetState]) {
        return null;
    }

    if (startState === targetState) {
        return [];
    }

    // BFS查找最短路径
    const queue = [[startState]];
    const visited = new Set([startState]);

    while (queue.length > 0) {
        const path = queue.shift();
        const currentState = path[path.length - 1];

        const state = stateMachineConfig[currentState];
        if (!state || !state.transitions) continue;

        for (const transition of state.transitions) {
            const nextState = transition.targetState;

            if (nextState === targetState) {
                // 找到路径
                return [...path.slice(1), nextState];
            }

            if (!visited.has(nextState) && stateMachineConfig[nextState]) {
                visited.add(nextState);
                queue.push([...path, nextState]);
            }
        }
    }

    return null; // 无法到达目标状态
}

/**
 * 查找并点击指定图片
 * 支持传入图片路径或RecognitionObject对象
 *
 * @param {string|RecognitionObject} target - 图片路径或识别对象
 * @param {boolean} click - 是否点击，默认为true
 * @param {number} timeout - 超时时间（毫秒），默认30000
 * @returns {boolean} 是否找到并点击
 */
async function findAndClick(target, click = true, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        gameRegion = captureGameRegion();

        let result;
        if (typeof target === 'string') {
            // 传入的是图片路径
            const ro = RecognitionObject.TemplateMatch(
                file.ReadImageMatSync(target),
                0, 0, 1920, 1080
            );
            result = gameRegion.find(ro);
        } else {
            // 传入的是RecognitionObject对象
            result = gameRegion.find(target);
        }

        if (result.isExist()) {
            if (click) {
                // 获取识别结果的中心点，使用最远的备用点（50x50点阵）
                const x = result.x + result.width / 2;
                const y = result.y + result.height / 2;

                // 计算点阵中距离最远的点
                let farthestX = x;
                let farthestY = y;
                let maxDistance = 0;

                for (let px = 10; px <= 1910; px += 50) {
                    for (let py = 10; py <= 1070; py += 50) {
                        const distance = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
                        if (distance > maxDistance) {
                            maxDistance = distance;
                            farthestX = px;
                            farthestY = py;
                        }
                    }
                }

                // 先移动到最远点，再点击目标
                moveMouseTo(farthestX, farthestY);
                await sleep(50);
                result.click();
                await sleep(50);
            }
            return true;
        }

        await sleep(200);
    }

    return false;
}
// 将函数挂载到 globalThis，供 new Function 创建的作用域访问
globalThis.findAndClick = findAndClick;

/**
 * 使用预加载的图片矩阵查找并点击
 * 避免重复加载图片，提高性能
 *
 * @param {Mat} imageMat - 预加载的图片矩阵
 * @param {boolean} click - 是否点击，默认为true
 * @param {number} timeout - 超时时间（毫秒），默认30000
 * @returns {boolean} 是否找到并点击
 */
async function findAndClickByMat(imageMat, click = true, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        gameRegion = captureGameRegion();

        // 使用预加载的图片矩阵创建识别对象
        const ro = RecognitionObject.TemplateMatch(
            imageMat,
            0, 0, 1920, 1080
        );
        const result = gameRegion.find(ro);

        if (result.isExist()) {
            if (click) {
                // 获取识别结果的中心点，使用最远的备用点（50x50点阵）
                const x = result.x + result.width / 2;
                const y = result.y + result.height / 2;

                // 计算点阵中距离最远的点
                let farthestX = x;
                let farthestY = y;
                let maxDistance = 0;

                for (let px = 10; px <= 1910; px += 50) {
                    for (let py = 10; py <= 1070; py += 50) {
                        const distance = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
                        if (distance > maxDistance) {
                            maxDistance = distance;
                            farthestX = px;
                            farthestY = py;
                        }
                    }
                }

                // 先移动到最远点，再点击目标
                moveMouseTo(farthestX, farthestY);
                await sleep(50);
                result.click();
                await sleep(50);
            }
            return true;
        }

        await sleep(200);
    }

    return false;
}
// 将函数挂载到 globalThis，供 new Function 创建的作用域访问
globalThis.findAndClickByMat = findAndClickByMat;

/**
 * 数字模板匹配
 *
 * @param {string}  numberPngFilePath - 存放 0.png ~ 9.png 的文件夹路径（不含文件名）
 * @param {number}  x                 - 待识别区域的左上角 x 坐标，默认 0
 * @param {number}  y                 - 待识别区域的左上角 y 坐标，默认 0
 * @param {number}  w                 - 待识别区域的宽度，默认 1920
 * @param {number}  h                 - 待识别区域的高度，默认 1080
 * @param {number}  maxThreshold      - 模板匹配起始阈值，默认 0.95（最高可信度）
 * @param {number}  minThreshold      - 模板匹配最低阈值，默认 0.8（最低可信度）
 * @param {number}  splitCount        - 在 maxThreshold 与 minThreshold 之间做几次等间隔阈值递减，默认 5
 * @param {number}  maxOverlap        - 非极大抑制时允许的最大重叠像素，默认 2；只要 x 或 y 方向重叠大于该值即视为重复框
 *
 * @returns {number} 识别出的整数；若没有任何有效数字框则返回 -1
 */
async function numberTemplateMatch(
    numberPngFilePath,
    x = 0, y = 0, w = 1920, h = 1080,
    maxThreshold = 0.95,
    minThreshold = 0.8,
    splitCount = 5,
    maxOverlap = 2
) {
    let ros = [];
    for (let i = 0; i <= 9; i++) {
        ros[i] = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(`${numberPngFilePath}/${i}.png`), x, y, w, h);
    }

    function setThreshold(roArr, newThreshold) {
        for (let i = 0; i < roArr.length; i++) {
            roArr[i].Threshold = newThreshold;
            roArr[i].InitTemplate();
        }
    }

    let gameRegion;
    const allCandidates = [];

    try {
        gameRegion = captureGameRegion();

        /* 1. splitCount 次等间隔阈值递减 */
        for (let k = 0; k < splitCount; k++) {
            const curThr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
            setThreshold(ros, curThr);

            /* 2. 9-0 每个模板跑一遍，所有框都收 */
            for (let digit = 9; digit >= 0; digit--) {
                try {
                    const res = gameRegion.findMulti(ros[digit]);
                    if (res.count === 0) continue;

                    for (let i = 0; i < res.count; i++) {
                        const box = res[i];
                        allCandidates.push({
                            digit: digit,
                            x: box.x,
                            y: box.y,
                            w: box.width,
                            h: box.height,
                            thr: curThr
                        });
                    }
                } catch (e) {
                    log.error(`识别数字 ${digit} 时出错：${e.message}`);
                }
            }
        }
    } catch (error) {
        log.error(`识别数字过程中出现错误：${error.message}`);
    } finally {
        if (gameRegion) gameRegion.dispose();
    }

    /* 3. 无结果提前返回 -1 */
    if (allCandidates.length === 0) {
        return -1;
    }

    /* 4. 非极大抑制（必须 x、y 两个方向重叠都 > maxOverlap 才视为重复） */
    const adopted = [];
    for (const c of allCandidates) {
        let overlap = false;
        for (const a of adopted) {
            const xOverlap = Math.max(0, Math.min(c.x + c.w, a.x + a.w) - Math.max(c.x, a.x));
            const yOverlap = Math.max(0, Math.min(c.y + c.h, a.y + a.h) - Math.max(c.y, a.y));
            if (xOverlap > maxOverlap && yOverlap > maxOverlap) {
                overlap = true;
                break;
            }
        }
        if (!overlap) {
            adopted.push(c);
        }
    }

    /* 5. 按 x 排序，拼整数；仍无有效框时返回 -1 */
    if (adopted.length === 0) return -1;
    adopted.sort((a, b) => a.x - b.x);

    return adopted.reduce((num, item) => num * 10 + item.digit, 0);
}

/**
 * 计算两个字符串的相似度
 * 使用Levenshtein距离算法
 * 
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} 相似度，范围0-1
 */
function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // 创建距离矩阵
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    // 初始化第一行和第一列
    for (let i = 0; i <= len1; i++) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    
    // 计算距离
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // 删除
                matrix[i][j - 1] + 1,      // 插入
                matrix[i - 1][j - 1] + cost // 替换
            );
        }
    }
    
    // 计算相似度
    const maxLen = Math.max(len1, len2);
    const distance = matrix[len1][len2];
    const similarity = 1 - (distance / maxLen);
    
    return similarity;
}

/**
 * 检查UID是否匹配
 * 考虑到识别误差，当相似度大于等于8/9时认为匹配成功
 * 
 * @param {number} currentUid - 当前识别的UID
 * @param {string} targetUid - 目标UID
 * @returns {boolean} 是否匹配成功
 */
function isUidMatch(currentUid, targetUid) {
    if (currentUid < 0) {
        return false;
    }
    
    const currentUidStr = currentUid.toString();
    const targetUidStr = targetUid.toString();
    
    // 计算相似度
    const similarity = calculateSimilarity(currentUidStr, targetUidStr);
    
    // 输出相似度信息
    log.info(`UID相似度：${(similarity * 100).toFixed(2)}% (${currentUidStr} vs ${targetUidStr})`);
    
    // 相似度大于等于8/9时认为匹配成功
    return similarity >= 8/9;
}

/**
 * 校验当前账号UID
 * 
 * @returns {number} 当前账号UID，若识别失败返回-1
 */
async function verifyCurrentUid() {
    try {
        // 尝试返回主界面
        await genshin.returnMainUi();

        // 尝试使用状态机进入主界面
        await goToState('mainUI');

        // 无论尝试是否成功，按一次G键
        keyPress('VK_G');
        await sleep(1000);

        // 识别UID，识别区域是1727 1050 160 30
        const uid = await numberTemplateMatch('assets/uid图片', 1727, 1050, 160, 30);

        if (uid >= 0) {
            log.info(`成功识别当前账号UID：${uid}`);
        } else {
            log.warn('未能识别当前账号UID');
        }
        await genshin.returnMainUi();
        return uid;
    } catch (e) {
        log.error(`校验UID时出错：${e.message}`);
        return -1;
    }
}

/**
 * 处理截图模式
 * 前往主界面识别UID，然后前往"进入游戏或登录其他账号"界面，截图保存对应UID图片
 */
async function handleScreenshotMode() {
    try {
        log.info('进入截图模式');
        
        // 1. 确定要使用的UID
        let uidStr = settings.targetUid;
        
        if (!uidStr) {
            log.info('未设置目标UID，尝试识别当前账号UID');
            const currentUid = await verifyCurrentUid();
            
            if (currentUid < 0) {
                log.error('未能识别当前账号UID，截图模式失败');
                notification.error('截图模式失败：未能识别当前账号UID');
                return;
            }
            
            uidStr = currentUid.toString();
            log.info(`识别到当前账号UID：${uidStr}`);
        } else {
            log.info(`使用设置的目标UID：${uidStr}`);
        }
        
        // 2. 前往"进入游戏或登录其他账号"界面
        log.info('开始：前往进入游戏或登录其他账号界面');
        
        // 直接尝试进入enterGame状态
        const enterGameResult = await goToState('enterGame');
        
        if (!enterGameResult) {
            log.error('未能到达进入游戏或登录其他账号界面，截图模式失败');
            notification.error('截图模式失败：未能到达进入游戏或登录其他账号界面');
            return;
        }
        
        log.info('成功到达进入游戏或登录其他账号界面');
        
        // 3. 截图保存对应UID图片
        log.info('开始：截图保存账号图片');
        
        // 截图区域：780 481 150 27
        const CAP_X = 780;
        const CAP_Y = 481;
        const CAP_W = 150;
        const CAP_H = 27;
        
        // 捕获游戏画面
        gameRegion = captureGameRegion();
        try {
            const mat = gameRegion.DeriveCrop(CAP_X, CAP_Y, CAP_W, CAP_H).SrcMat;
            
            // 保存路径
            const TARGET_DIR = 'accounts';
            const fullPath = TARGET_DIR + '/' + uidStr + '.png';
            
            // 保存图片
            file.WriteImageSync(fullPath, mat);
            mat.dispose();
        } finally {
            gameRegion.dispose();
            gameRegion = null;
        }
        
        log.info(`成功保存账号图片：${fullPath}`);
        notification.Send(`截图模式成功：已保存账号图片 ${uidStr}.png`);
        
        // 4. 返回主界面
        log.info('开始：返回主界面');
        await goToState('mainUI');
        log.info('已返回主界面');
        
    } catch (e) {
        log.error(`截图模式出错：${e.message}`);
        notification.error(`截图模式失败：${e.message}`);
    }
}
