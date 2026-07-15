import { isCancellationError } from "./utils.js";

/**
 * 将路径中的反斜杠统一转换为正斜杠（用于 Windows 兼容性）
 * @param {string} path - 原始路径
 * @returns {string} 转换后的路径
 */
function normalizePath(path) {
    return path.replace(/\\/g, '/');
}

/**
 * 递归转换树形结构中所有节点的 path 为正斜杠
 * @param {Array} tree - 树形结构数组
 * @returns {Array} 转换后的树形结构
 */
function convertPathSlashes(tree) {
    if (!tree) return [];
    const result = [];
    for (let i = 0; i < tree.length; i++) {
        const node = {
            name: normalizePath(tree[i].name),
            type: tree[i].type,
            children: convertPathSlashes(tree[i].children)
        };
        result.push(node);
    }
    return result;
}

/**
 * 转换扁平节点数组中的 path 为正斜杠
 * @param {Array} nodes - 节点数组
 * @returns {Array} 转换后的节点数组
 */
function convertPathSlashesArray(nodes) {
    if (!nodes) return [];
    const result = [];
    for (let i = 0; i < nodes.length; i++) {
        result.push({
            name: normalizePath(nodes[i].name),
            type: nodes[i].type
        });
    }
    return result;
}

/**
 * 读取 Boss 配置列表（从外部 JSON 文件加载）
 * @returns {Object} 包含 cascadeData 和 unsupportedBosses 的对象
 */
function loadBossConfig() {
    const content = file.readTextSync('assets/config/boss-list.json');
    return JSON.parse(content);
}

/**
 * 打开 BOSS 配置编辑器，阻塞等待用户保存并关闭
 * @description 通过 HTML 遮罩显示编辑器，注册 ~ 键监听切换显示状态，
 * 处理 /loadConfig、/loadStrategyTree 和 /saveAndClose 消息，用户保存后关闭编辑器
 * @async
 */
async function openBossEditor() {
    if (settings.showEditorOnStart == false) {
        return;
    }
    const hook = new KeyMouseHook();
    try {
        log.info("打开 BOSS 配置编辑器...");

        const windowId = htmlMask.show("assets/html/BOSS配置编辑器.html", "boss-editor");
        log.debug("编辑器窗口已打开，窗口 ID: {0}", windowId);

        htmlMask.setClickThrough(windowId, false);
        log.info("已切换为可交互模式");

        // 获取取消令牌（用于检测脚本是否被取消）
        const cancelToken = dispatcher.getLinkedCancellationToken();
        log.debug("已获取取消令牌");

        
        let isMaskVisible = true;
        let originalClickThrough = false;

        hook.onKeyDown(function (keyCode) {
            if (keyCode === "Oem3") {
                if (isMaskVisible) {
                    originalClickThrough = htmlMask.getClickThrough(windowId);
                    htmlMask.setClickThrough(windowId, true);
                    htmlMask.send(windowId, '/toggleVisibility', JSON.stringify({ visible: false }));
                    log.info("隐藏设置界面");
                } else {
                    htmlMask.setClickThrough(windowId, originalClickThrough);
                    htmlMask.send(windowId, '/toggleVisibility', JSON.stringify({ visible: true }));
                    log.info("显示设置界面");
                }
                isMaskVisible = !isMaskVisible;
            }
        });

        log.info("使用 ~ 键可以切换界面显示状态");

        while (htmlMask.exists(windowId)) {
            // 检查取消状态
            if (cancelToken.isCancellationRequested) {
                htmlMask.close(windowId);
                break;
            }

            const message = await htmlMask.receive(windowId, 1000);
            if (message) {
                const msgObj = JSON.parse(message);
                // log.info("收到HTML消息: {0}", msgObj.url);

                if (msgObj.url === '/loadConfig') {
                    try {
                        const configContent = file.readTextSync('assets/config/config.json');
                        const configData = JSON.parse(configContent);
                        log.info("已读取配置: {0} 个Boss", configData.length);

                        htmlMask.send(windowId, '/loadConfig', JSON.stringify(configData));

                        // 读取 boss 列表配置并发送到 HTML
                        const bossConfig = loadBossConfig();
                        htmlMask.send(windowId, '/bossList', JSON.stringify(bossConfig));
                    } catch (err) {
                        // 先检查是否为取消异常
                        if (isCancellationError(err)) {
                            htmlMask.close(windowId);
                            break;
                        }
                        log.warn("读取配置文件失败: {0}", err.message);
                        htmlMask.send(windowId, '/loadConfig', JSON.stringify([]));
                    }
                } else if (msgObj.url === '/loadStrategyTree') {
                    try {
                        const strategyTree = readStrategyDirectory('./');
                        const treeData = {
                            name: 'AutoFight',
                            type: 'folder',
                            children: convertPathSlashes(strategyTree)
                        };
                        htmlMask.send(windowId, '/strategyTreeData', JSON.stringify(treeData));
                        log.info("已加载策略文件树");
                    } catch (err) {
                        // 先检查是否为取消异常
                        if (isCancellationError(err)) {
                            htmlMask.close(windowId);
                            break;
                        }
                        log.warn("读取策略文件目录失败: {0}", err.message);
                        htmlMask.send(windowId, '/strategyTreeData', JSON.stringify({
                            name: 'AutoFight',
                            type: 'folder',
                            children: []
                        }));
                    }
                } else if (msgObj.url === '/loadStrategyChildren') {
                    try {
                        const childPath = msgObj.data && msgObj.data.path ? msgObj.data.path : './';
                        const children = convertPathSlashesArray(readStrategyChildren(childPath));
                        htmlMask.send(windowId, '/strategyChildrenData', JSON.stringify({
                            path: childPath.replace(/\\/g, '/'),
                            children: children
                        }));
                    } catch (err) {
                        // 先检查是否为取消异常
                        if (isCancellationError(err)) {
                            htmlMask.close(windowId);
                            break;
                        }
                        log.warn("读取策略子目录失败: {0}", err.message);
                        htmlMask.send(windowId, '/strategyChildrenData', JSON.stringify({
                            path: msgObj.data && msgObj.data.path ? msgObj.data.path.replace(/\\/g, '/') : './',
                            children: []
                        }));
                    }
                } else if (msgObj.url === '/saveAndClose') {
                    try {
                        const content = msgObj.data.content;
                        file.writeTextSync('assets/config/config.json', content);
                        log.info("配置已保存");

                        if (msgObj.requestId) {
                            htmlMask.send(windowId, '/saveAndClose', JSON.stringify({
                                requestId: msgObj.requestId,
                                data: { status: 'ok' }
                            }));
                        }

                        htmlMask.close(windowId);
                        log.info("编辑器窗口已关闭");
                    } catch (err) {
                        // 先检查是否为取消异常
                        if (isCancellationError(err)) {
                            htmlMask.close(windowId);
                            break;
                        }
                        log.error("保存配置失败: {0}", err.message);
                        if (msgObj.requestId) {
                            htmlMask.send(windowId, '/saveAndClose', JSON.stringify({
                                requestId: msgObj.requestId,
                                data: { status: 'error', message: err.message }
                            }));
                        }
                    }
                }
            }
            await sleep(1);
        }
    } catch (error) {
        // 最外层 catch：检查是否为取消异常
        if (isCancellationError(error)) {
            return;
        }
        log.error(`BOSS配置编辑器执行异常: ${error.message}`);
    } finally {
        log.debug("释放键鼠钩子...");
        hook.dispose();
    }
}

/**
 * 递归读取策略文件目录
 * @param {string} path - 相对于AutoFight根目录的路径
 * @returns {Array} 目录树结构数组
 */
function readStrategyDirectory(path) {
    const result = [];
    
    try {
        const paths = strategyFile.readPathSync(path);
        if (!paths || paths.length === 0) {
            return result;
        }

        for (let i = 0; i < paths.length; i++) {
            const item = paths[i];
            // readPathSync 返回的 item 已经是相对于根目录的完整路径，无需拼接
            const node = {
                name: item,
                type: '',
                children: []
            };

            if (strategyFile.isFolder(item)) {
                node.type = 'folder';
                node.children = readStrategyDirectory(item);
                result.push(node);
            } else if (strategyFile.isFile(item)) {
                // 只包含 .txt 和 .json 文件
                if (item.endsWith('.txt') || item.endsWith('.json')) {
                    node.type = 'file';
                    result.push(node);
                }
            }
        }
    } catch (e) {
        log.warn("读取目录 {0} 失败: {1}", path, e.message);
    }

    return result;
}

/**
 * 读取指定目录的子节点（非递归，用于动态加载）
 * @param {string} path - 相对于AutoFight根目录的路径
 * @returns {Array} 子节点数组
 */
function readStrategyChildren(path) {
    const result = [];
    
    try {
        const paths = strategyFile.readPathSync(path);
        if (!paths || paths.length === 0) {
            return result;
        }

        for (let i = 0; i < paths.length; i++) {
            const item = paths[i];
            
            if (strategyFile.isFolder(item)) {
                result.push({ name: item, type: 'folder' });
            } else if (strategyFile.isFile(item)) {
                if (item.endsWith('.txt') || item.endsWith('.json')) {
                    result.push({ name: item, type: 'file' });
                }
            }
        }
    } catch (e) {
        log.warn("读取目录子节点 {0} 失败: {1}", path, e.message);
    }

    return result;
}

export { openBossEditor };
