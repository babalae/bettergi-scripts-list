/**
 * Basic 委托流程文件加载器
 * 加载并解析 process.json 流程文件
 */

/**
 * 加载并解析 Basic 流程文件
 * @param {string} processPath - 流程文件路径
 * @returns {Promise<Array|null>} 步骤数组，失败返回 null
 */
export async function loadBasicProcess(processPath) {
    try {
        const processContent = file.readTextSync(processPath);

        try {
            const jsonData = JSON.parse(processContent);
            if (Array.isArray(jsonData)) {
                return jsonData;
            }
            log.error("流程文件格式错误，应为数组: {path}", processPath);
            return null;
        } catch (parseError) {
            log.error("流程文件 JSON 解析失败: {path}, 错误: {error}", processPath, parseError.message);
            return null;
        }
    } catch (error) {
        log.warn("未找到流程文件: {path}, 错误: {error}", processPath, error.message);
        return null;
    }
}
