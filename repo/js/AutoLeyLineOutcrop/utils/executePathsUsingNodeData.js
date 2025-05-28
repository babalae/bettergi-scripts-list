/**
 * 使用节点数据执行路径
 * @param {Object} position - 位置对象
 * @returns {Promise<void>}
 */
this.executePathsUsingNodeData =
async function (position) {
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