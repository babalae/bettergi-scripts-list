/**
 * 分支配置加载器
 *
 * 磁盘存储：每个委托一个文件 config/branches/{委托名}.json
 * 运行时结构使用 completedByUid 保存账号隔离后的完成进度：
 * {
 *   descriptions,
 *   conditions,
 *   default,
 *   completedByUid: { [uid]: [branchKey] }
 * }
 *
 * 运行时 composite 仍是 { 委托名: config }，供 step 执行器消费。
 * 配置面板为了复用原 UI 的 completed 数组，会通过 createBranchConfigView /
 * mergeBranchConfigView 在「当前 UID 视图」和「磁盘结构」之间转换。
 */
import { PATHS } from "../config/index.js";
import { loadBranchCompletionState, setBranchCompletion } from "../data/commission-data.js";

/**
 * 取路径最后一级名称，兼容 Windows / POSIX 分隔符
 * @param {string} path
 * @returns {string}
 */
function baseName(path) {
    return path.split("/").pop().split("\\").pop();
}

/**
 * 从分支配置文件名解析委托名
 * @param {string} filename
 * @returns {string}
 */
function commissionNameFromFile(filename) {
    return filename.replace(/\.json$/i, "");
}

/**
 * 构造单个委托分支配置文件路径
 * @param {string} commissionName
 * @returns {string}
 */
function branchFilePath(commissionName) {
    return PATHS.BRANCHES_DIR + "/" + commissionName + ".json";
}

/**
 * 判断是否为普通对象
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

/**
 * 规范化分支配置对象
 *
 * 保证 completedByUid 存在，并清理已废弃的顶层 completed 字段。
 *
 * @param {Object} config - 单个委托的分支配置
 * @returns {Object}
 */
export function sanitizeBranchConfig(config) {
    const next = isPlainObject(config) ? { ...config } : {};
    if (!isPlainObject(next.completedByUid)) {
        next.completedByUid = {};
    }
    delete next.completed;
    delete next.noteLevel;
    return next;
}

function sanitizeStaticBranchConfig(config) {
    const next = sanitizeBranchConfig(config);
    delete next.completedByUid;
    return next;
}

/**
 * 获取指定 UID 已完成的成就分支列表
 * @param {Object} config - 单个委托的分支配置
 * @param {string} accountUid - 当前账号 UID
 * @returns {string[]}
 */
export function getBranchCompletedByUid(config, accountUid) {
    if (!accountUid || !isPlainObject(config?.completedByUid)) {
        return [];
    }
    const completed = config.completedByUid[accountUid];
    return Array.isArray(completed) ? completed : [];
}

/**
 * 收集分支配置中已经存在的账号 UID
 *
 * 用于全局 UID 未配置时给 getCurrentUid 提供候选，避免 UID OCR 抖动
 * 导致同一个账号的 completedByUid 被写到多个相近 UID 下。
 *
 * @param {Object} composite - { commissionName: config }
 * @returns {string[]}
 */
export function getBranchConfigUids(composite) {
    const uids = new Set();
    if (!isPlainObject(composite)) {
        return [];
    }

    for (const commissionName of Object.keys(composite)) {
        const completedByUid = composite[commissionName]?.completedByUid;
        if (!isPlainObject(completedByUid)) {
            continue;
        }
        for (const uid of Object.keys(completedByUid)) {
            if (uid) {
                uids.add(uid);
            }
        }
    }

    return Array.from(uids);
}

/**
 * 为配置面板创建当前 UID 视图
 *
 * 面板仍读写 config.completed 数组；这里把 completedByUid[accountUid]
 * 映射成 completed，并隐藏 completedByUid，避免面板误覆盖其它 UID 的进度。
 *
 * @param {Object} composite - { commissionName: config }
 * @param {string} accountUid - 当前账号 UID
 * @returns {Object}
 */
export function createBranchConfigView(composite, accountUid) {
    const view = {};
    if (!isPlainObject(composite)) {
        return view;
    }

    for (const commissionName of Object.keys(composite)) {
        const config = sanitizeBranchConfig(composite[commissionName]);
        view[commissionName] = {
            ...config,
            completed: getBranchCompletedByUid(config, accountUid),
        };
        delete view[commissionName].completedByUid;
    }
    return view;
}

/**
 * 把配置面板保存的当前 UID 视图合并回磁盘结构
 *
 * 仅更新 completedByUid[accountUid]，其它 UID 的完成进度从 existingComposite 保留。
 *
 * @param {Object} viewComposite - 面板保存的 { commissionName: configWithCompleted }
 * @param {string} accountUid - 当前账号 UID
 * @param {Object} [existingComposite={}] - 当前磁盘配置，用于保留其它 UID 进度
 * @returns {Object}
 */
export function mergeBranchConfigView(viewComposite, accountUid, existingComposite = {}) {
    const composite = {};
    if (!isPlainObject(viewComposite)) {
        return composite;
    }

    for (const commissionName of Object.keys(viewComposite)) {
        const viewConfig = isPlainObject(viewComposite[commissionName]) ? { ...viewComposite[commissionName] } : {};
        const completed = Array.isArray(viewConfig.completed) ? viewConfig.completed : [];
        delete viewConfig.completed;

        const existingConfig = sanitizeBranchConfig(existingComposite[commissionName]);
        const completedByUid = isPlainObject(existingConfig.completedByUid)
            ? { ...existingConfig.completedByUid }
            : {};
        if (accountUid) {
            completedByUid[accountUid] = completed;
            setBranchCompletion(accountUid, commissionName, completed);
        }

        composite[commissionName] = sanitizeBranchConfig({
            ...viewConfig,
            completedByUid,
        });
    }

    return composite;
}

/**
 * 遍历 BRANCHES_DIR 加载所有委托的分支配置，合并成 composite 对象
 *
 * 单个文件解析失败只 log.error 并跳过，不阻断其它委托加载。
 *
 * @returns {Object} { commissionName: config, ... }
 */
export function loadAllBranchConfigs() {
    let paths;
    try {
        paths = Array.from(file.readPathSync(PATHS.BRANCHES_DIR));
    } catch (error) {
        log.warn("分支配置目录不可读，使用空配置: {dir} ({err})", PATHS.BRANCHES_DIR, error.message);
        return {};
    }

    const composite = {};
    const completionState = loadBranchCompletionState();
    for (const p of paths) {
        if (file.isFolder(p)) continue;
        const filename = baseName(p);
        if (!filename.toLowerCase().endsWith(".json")) continue;

        const commissionName = commissionNameFromFile(filename);
        try {
            const raw = file.readTextSync(p);
            const parsed = JSON.parse(raw);
            if (Object.prototype.hasOwnProperty.call(parsed, "completedByUid")) {
                throw new Error("静态分支文件禁止包含 completedByUid，请将进度写入 Data/account-state.json");
            }
            composite[commissionName] = {
                ...sanitizeStaticBranchConfig(parsed),
                completedByUid: completionState[commissionName] || {},
            };
        } catch (error) {
            log.error("分支配置文件解析失败 [{path}]: {err}", p, error.message);
        }
    }
    return composite;
}

/**
 * 写入单个委托的分支配置
 *
 * 调用方负责传完整对象；写入前会通过 sanitizeBranchConfig 清理旧 completed 字段。
 *
 * @param {string} commissionName - 委托名称
 * @param {Object} config - 单个委托的分支配置
 */
export function writeBranchConfig(commissionName, config) {
    const path = branchFilePath(commissionName);
    file.writeTextSync(path, JSON.stringify(sanitizeStaticBranchConfig(config), null, 4));
}

/**
 * 把 composite 对象按委托名拆分写回各自文件
 *
 * UI 编辑器保存 / 整体导入时使用。
 * 注意：本函数不会删除磁盘上 composite 中不存在的委托文件；删除委托配置应单独处理，
 * 避免一次误保存清空其它未编辑的委托。
 *
 * @param {Object} composite - { commissionName: config, ... }
 */
export function writeAllBranchConfigs(composite) {
    if (!isPlainObject(composite)) return;
    for (const commissionName of Object.keys(composite)) {
        try {
            writeBranchConfig(commissionName, composite[commissionName]);
        } catch (error) {
            log.error("写入分支配置失败 [{name}]: {err}", commissionName, error.message);
        }
    }
}
