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


/*
// 如果路径存在且返回的是数组，则认为是目录Folder
function pathExists(path) {
    try { return file.readPathSync(path)?.length >= 0; }
    catch { return false; }
}
*/

function pathExists(path) {
    try {
        return file.isFolder(path);
    } catch {
        return false;
    }
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
                existingContent = file.readTextSync(filePath);
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
            const result = file.WriteTextSync(filePath, finalContent, false);
            
            // log.info(result ? `[追加] 成功写入: ${filePath}` : `[追加] 写入失败: ${filePath}`);
            return result;
        } else {
            // 覆盖模式直接写入
            const result = file.WriteTextSync(filePath, content, false);
            // log.info(result ? `[覆盖] 成功写入: ${filePath}` : `[覆盖] 写入失败: ${filePath}`);
            return result;
        }
    } catch (error) {
        // 出错时尝试创建/写入文件
        const result = file.WriteTextSync(filePath, content, false);
        log.info(result ? `[新建/恢复] 成功处理: ${filePath}` : `[新建/恢复] 处理失败: ${filePath}`);
        return result;
    }
}

