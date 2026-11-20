/**
 * 加载 Boss 配置文件
 * @description 读取 assets/config/config.json 文件，解析为 JSON 数组，校验格式
 * @returns {Array} 有效的 Boss 配置数组，失败时返回空数组并记录日志
 */
function loadConfig() {
    try {
        const config = JSON.parse(file.readTextSync("assets/config/config.json"));
        if (!Array.isArray(config)) {
            log.error("配置文件格式不正确，已重置为空数组");
            return [];
        }
        return config;
    } catch (error) {
        log.error(`读取配置文件失败: ${error}`);
        log.info(`初始化配置`);
        return [];
    }
}

/**
 * 保存 Boss 配置文件
 * @description 将配置数组写入 assets/config/config.json，格式化为 JSON（缩进4空格）
 * @param {Array} config - 要保存的 Boss 配置数组
 */
function saveConfig(config) {
    file.writeTextSync("assets/config/config.json", JSON.stringify(config, null, 4));
}

export { loadConfig, saveConfig };
