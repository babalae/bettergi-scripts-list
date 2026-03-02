// ======================== 全局工具函数（只定义1次，所有函数共用）========================
// 1. 路径标准化函数（统一处理，消除重复）
function normalizePath(path) {
    if (!path || typeof path !== 'string') return '';
    let standardPath = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    return standardPath.endsWith('/') ? standardPath.slice(0, -1) : standardPath;
}

// 2. 提取路径最后一级名称
function basename(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const normalizedPath = normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    return lastSlashIndex !== -1 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
}

function pathExists(path) {
    try {
        return file.isFolder(path);
    } catch {
        return false;
    }
}

/*
// 如果路径存在且返回的是数组，则认为是目录Folder
function pathExists(path) {
    try { return file.readPathSync(path)?.length >= 0; }
    catch { return false; }
}
// 判断文件是否存在（非目录且能读取）
function fileExists(filePath) {
    try {
        // 先排除目录（是目录则不是文件）
        if (file.isFolder(filePath)) {
            return false;
        }
        // 尝试读取文件（能读则存在）
        file.readTextSync(filePath);
        return true;
    } catch {
        return false;
    }
}
*/

// 判断文件是否存在（基于readPathSync + 已有工具函数，不读取文件内容）
function fileExists(filePath) {
    // 1. 基础参数校验（复用已有逻辑）
    if (!filePath || typeof filePath !== 'string') {
        log.debug(`[文件检查] 路径无效：${filePath}`);
        return false;
    }

    try {
        // 2. 路径标准化（复用已有normalizePath，统一分隔符）
        const normalizedFilePath = normalizePath(filePath);

        // 3. 拆分「文件所在目录」和「文件名」（核心步骤）
        // 3.1 提取纯文件名（复用已有basename）
        const fileName = basename(normalizedFilePath);
        // 3.2 提取文件所在的目录路径（基于标准化路径拆分）
        // 修复：当没有目录结构时，使用'.'表示当前目录，而不是'/'（避免越界访问）
        const dirPath = normalizedFilePath.lastIndexOf('/') !== -1
            ? normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'))
            : '.';

        // 4. 先判断目录是否存在
        if (!pathExists(dirPath)) {
            log.debug(`[文件检查] 文件所在目录不存在：${dirPath}`);
            return false;
        }

        // 5. 用readPathSync读取目录下的所有一级子项
        const dirItems = file.readPathSync(dirPath);
        if (!dirItems || dirItems.length === 0) {
            log.debug(`[文件检查] 目录为空，无目标文件：${dirPath}`);
            return false;
        }

        let isFileExist = false;
        for (let i = 0; i < dirItems.length; i++) {
            const item = dirItems[i];
            const normalizedItem = normalizePath(item);
            if (pathExists(normalizedItem)) {
                continue;
            }
            const itemFileName = basename(normalizedItem);
            if (normalizedItem === normalizedFilePath || itemFileName === fileName) {
                isFileExist = true;
                break;
            }
        }

        // 7. 日志反馈结果
        if (isFileExist) {
            // log.debug(`[文件检查] 文件存在：${filePath}`);
        } else {
            // log.debug(`[文件检查] 文件不存在：${filePath}`);
        }
        return isFileExist;

    } catch (error) {
        // 捕获目录读取失败等异常
        log.debug(`[文件检查] 检查失败：${filePath}，错误：${error.message}`);
        return false;
    }
}
/**
 * 安全读取文本文件（封装存在性校验+异常处理）
 * @param {string} filePath - 文件路径
 * @param {any} defaultValue - 读取失败/文件不存在时的默认返回值（默认空字符串）
 * @returns {any} 文件内容（成功）| defaultValue（失败）
 */
function safeReadTextSync(filePath, defaultValue = "") {
    try {
        // 第一步：校验文件是否存在
        if (!fileExists(filePath)) {
            log.debug(`${CONSTANTS.LOG_MODULES.RECORD}文件不存在，跳过读取: ${filePath}`);
            return defaultValue;
        }
        // 第二步：读取文件（捕获读取异常）
        const content = file.readTextSync(filePath);
        // log.debug(`${CONSTANTS.LOG_MODULES.RECORD}成功读取文件: ${filePath}`);
        return content;
    } catch (error) {
        log.debug(`${CONSTANTS.LOG_MODULES.RECORD}读取文件失败: ${filePath} → 原因：${error.message}`);
        return defaultValue;
    }
}

// 带深度限制的非递归文件夹读取
function readAllFilePaths(dir, depth = 0, maxDepth = 3, includeExtensions = ['.png', '.json', '.txt'], includeDirs = false) {
    if (!pathExists(dir)) {
        log.error(`目录 ${dir} 不存在`);
        return [];
    }

    try {
        const filePaths = [];
        const stack = [[dir, depth]]; // 存储(路径, 当前深度)的栈

        while (stack.length > 0) {
            const [currentDir, currentDepth] = stack.pop();
            const entries = file.readPathSync(currentDir);

            for (const entry of entries) {
                const isDirectory = pathExists(entry);
                if (isDirectory) {
                    if (includeDirs) filePaths.push(entry);
                    if (currentDepth < maxDepth) stack.push([entry, currentDepth + 1]);
                } else {
                    const ext = entry.substring(entry.lastIndexOf('.')).toLowerCase();
                    if (includeExtensions.includes(ext)) filePaths.push(entry);
                }
            }
        }
        // log.info(`完成目录 ${dir} 的递归读取，共找到 ${filePaths.length} 个文件`);
        return filePaths;
    } catch (error) {
        log.error(`读取目录 ${dir} 错误: ${error}`);
        return [];
    }
}
// 新记录在最上面20250531 isAppend默认就是true追加
function writeFile(filePath, content, isAppend = true, maxRecords = 36500) {
    try {
        if (isAppend) {
            // 读取现有内容，处理文件不存在的情况
            let existingContent = "";
            try {
                existingContent = safeReadTextSync(filePath);
            } catch (err) {
                // 文件不存在时视为空内容
                existingContent = "";
            }

            // 分割现有记录并过滤空记录
            const records = existingContent.split("\n\n").filter(Boolean);

            // 新内容放在最前面，形成完整记录列表
            const allRecords = [content, ...records];

            // 只保留最新的maxRecords条（超过则删除最老的）
            const keptRecords = allRecords.slice(0, maxRecords);

            // 拼接记录并写入文件
            const finalContent = keptRecords.join("\n\n");
            const result = file.writeTextSync(filePath, finalContent, false);

            // log.info(result ? `[追加] 成功写入: ${filePath}` : `[追加] 写入失败: ${filePath}`);
            return result;
        } else {
            // 覆盖模式直接写入
            const result = file.writeTextSync(filePath, content, false);
            // log.info(result ? `[覆盖] 成功写入: ${filePath}` : `[覆盖] 写入失败: ${filePath}`);
            return result;
        }
    } catch (error) {
        // 出错时尝试创建/写入文件
        const result = file.writeTextSync(filePath, content, false);
        log.info(result ? `[新建/恢复] 成功处理: ${filePath}` : `[新建/恢复] 处理失败: ${filePath}`);
        return result;
    }
}

