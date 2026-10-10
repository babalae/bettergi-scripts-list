/**
 * 设置读取工具
 * 从 BGI settings 全局对象读取用户配置
 *
 * settings 全局对象在脚本启动后不会变化，首次读取后缓存在模块级变量中，
 * 后续调用直接返回缓存，避免重复构造对象。
 */

const DEFAULT_SETTING = {
    runMode: "运行自动每日委托",
    showConfigEditor: true,
};

let cachedSetting = null;

/**
 * 获取用户设置配置（首次调用读取 settings 全局对象，后续调用返回缓存）
 * @returns {Object} 设置对象
 */
export function getSetting() {
    if (cachedSetting) return cachedSetting;
    try {
        cachedSetting = {
            runMode: ["编辑委托流程", "录制地图路径"].includes(settings.runMode)
                ? settings.runMode
                : "运行自动每日委托",
            // 未设置时默认显示(与 settings.json 中的 default: true 保持一致)
            showConfigEditor: settings.showConfigEditor !== false,
        };
        log.debug("setting:{index}", cachedSetting);
        return cachedSetting;
    } catch (error) {
        log.error("执行 getSetting 时出错，将使用默认配置");
        cachedSetting = { ...DEFAULT_SETTING };
        return cachedSetting;
    }
}
