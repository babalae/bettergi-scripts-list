/**
 * 委托数据管理模块
 * 负责委托数据的加载、保存、账号隔离和持久化。
 *
 * 磁盘结构为单文件多账号槽：
 * {
 *   schemaVersion: 2,
 *   activeUid: "当前最近一次使用的 UID",
 *   accounts: {
 *     [uid]: { uid, timestamp, scriptVersion, bgiVersion, commissions }
 *   }
 * }
 *
 * 未配置全局 UID 时，当前 UID 会先与 accounts 中已有 UID 做相似度匹配，
 * 避免 genshin.uid() OCR 抖动导致同一账号创建多个账号槽。
 */
import { PATHS } from "../config/index.js";
import { getCurrentUid } from "../utils/account-utils.js";
import { isCancellationError } from "../utils/error-utils.js";

const DATA_SCHEMA_VERSION = 2;
const SCRIPT_VERSION = "1.0.0";

/**
 * 检查时间戳是否属于当前游戏日（以凌晨四点为分界）
 * @param {string} timestampString - ISO 格式时间戳
 * @returns {boolean}
 */
function isToday(timestampString) {
    try {
        const timestamp = new Date(timestampString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0);
        if (now < today) {
            today.setDate(today.getDate() - 1);
        }
        return timestamp >= today;
    } catch (error) {
        log.error("检查时间戳失败: {error}", error.message);
        return false;
    }
}

/**
 * 检查两组委托的名称集合是否一致
 *
 * 用于同一 UID 同一天复扫时判断是否可沿用首次扫描到的 location / country。
 * 名称集合变化时视为新数据，所有字段都按本次扫描结果写入。
 *
 * @param {Array} a - 旧委托列表
 * @param {Array} b - 新委托列表
 * @returns {boolean}
 */
function sameNameSet(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }
    const an = a.map((c) => `${c.name || ""}::${c.type || ""}`).sort();
    const bn = b.map((c) => `${c.name || ""}::${c.type || ""}`).sort();
    return an.every((name, i) => name === bn[i]);
}

function commissionIdentityKey(commission) {
    return [
        commission?.name || "",
        commission?.type || "",
        commission?.country || "",
        commission?.location || "",
    ].join("::");
}

function commissionGroupKey(commission) {
    return [
        commission?.name || "",
        commission?.type || "",
    ].join("::");
}

function findExistingCommission(existingCommissions, commission, usedIndexes) {
    const exactKey = commissionIdentityKey(commission);
    for (let i = 0; i < existingCommissions.length; i++) {
        if (usedIndexes.has(i)) continue;
        if (commissionIdentityKey(existingCommissions[i]) === exactKey) {
            usedIndexes.add(i);
            return existingCommissions[i];
        }
    }

    const groupKey = commissionGroupKey(commission);
    for (let i = 0; i < existingCommissions.length; i++) {
        if (usedIndexes.has(i)) continue;
        if (commissionGroupKey(existingCommissions[i]) === groupKey) {
            usedIndexes.add(i);
            return existingCommissions[i];
        }
    }

    return null;
}

function matchCommissionRecord(record, target) {
    if (!record || !target || record.name !== target.name) {
        return false;
    }
    if (target.type && record.type !== target.type) {
        return false;
    }
    if (target.country && record.country !== target.country) {
        return false;
    }
    if (target.location && record.location !== target.location) {
        return false;
    }
    return true;
}

/**
 * 创建 v2 空委托数据根对象
 * @param {string} [activeUid=""] - 最近使用的 UID
 * @returns {Object}
 */
function createEmptyData(activeUid = "") {
    return {
        schemaVersion: DATA_SCHEMA_VERSION,
        activeUid,
        accounts: {},
    };
}

/**
 * 规范化委托数据根对象
 *
 * 当前开发阶段不兼容旧顶层 commissions 结构；结构不符合 v2 时直接返回空数据。
 *
 * @param {Object} data - 从磁盘解析出的原始数据
 * @param {string} [activeUid=""] - 默认 activeUid
 * @returns {Object}
 */
function normalizeData(data, activeUid = "") {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return createEmptyData(activeUid);
    }
    if (data.schemaVersion !== DATA_SCHEMA_VERSION || !data.accounts || typeof data.accounts !== "object" || Array.isArray(data.accounts)) {
        return createEmptyData(activeUid);
    }
    if (typeof data.activeUid !== "string") {
        data.activeUid = activeUid;
    }
    return data;
}

/**
 * 读取并规范化 account-state.json。
 * @param {string} [activeUid=""] - 读取失败或结构无效时使用的 activeUid
 * @returns {Object}
 */
function readCommissionsData(activeUid = "") {
    try {
        const data = normalizeData(JSON.parse(file.readTextSync(PATHS.ACCOUNT_STATE)), activeUid);
        for (const account of Object.values(data.accounts || {})) {
            if (!account.branchCompleted || typeof account.branchCompleted !== "object" || Array.isArray(account.branchCompleted)) {
                account.branchCompleted = {};
            }
        }
        return data;
    } catch (error) {
        log.debug("读取委托数据失败，使用空数据: {error}", error.message);
        return createEmptyData(activeUid);
    }
}

/**
 * 写回 account-state.json。
 * @param {Object} data - v2 委托数据根对象
 */
function writeCommissionsData(data) {
    file.createDirectory("Data");
    file.writeTextSync(PATHS.ACCOUNT_STATE, JSON.stringify(data, null, 2));
}

export function loadBranchCompletionState() {
    const data = readCommissionsData();
    const result = {};
    for (const [uid, account] of Object.entries(data.accounts || {})) {
        for (const [commissionName, completed] of Object.entries(account.branchCompleted || {})) {
            if (!result[commissionName]) result[commissionName] = {};
            result[commissionName][uid] = Array.isArray(completed) ? completed : [];
        }
    }
    return result;
}

export function setBranchCompletion(accountUid, commissionName, completed) {
    if (!accountUid || !commissionName) return;
    const data = readCommissionsData(accountUid);
    const account = ensureAccountData(data, accountUid);
    account.branchCompleted[commissionName] = Array.from(new Set(Array.isArray(completed) ? completed : []));
    data.activeUid = accountUid;
    writeCommissionsData(data);
}

export function appendBranchCompletion(accountUid, commissionName, branchKey) {
    if (!accountUid || !commissionName || !branchKey) return false;
    const data = readCommissionsData(accountUid);
    const account = ensureAccountData(data, accountUid);
    const completed = Array.isArray(account.branchCompleted[commissionName])
        ? account.branchCompleted[commissionName]
        : [];
    if (completed.includes(branchKey)) return false;
    completed.push(branchKey);
    account.branchCompleted[commissionName] = completed;
    data.activeUid = accountUid;
    writeCommissionsData(data);
    return true;
}

/**
 * 获取当前数据文件中已经存在的账号 UID 列表
 * @param {Object} data - v2 委托数据根对象
 * @returns {string[]}
 */
function getKnownAccountUids(data) {
    return Object.keys(data.accounts || {});
}

/**
 * 读取当前委托数据文件中的账号 UID 列表
 *
 * 只暴露 UID 列表，供其它模块在未配置全局 UID 时复用已有账号槽做 OCR 纠错。
 *
 * @returns {string[]}
 */
export function loadKnownCommissionUids() {
    return getKnownAccountUids(readCommissionsData());
}

/**
 * 创建单个 UID 的账号槽
 * @param {string} uid - 账号 UID
 * @returns {Object}
 */
function createAccountData(uid) {
    return {
        uid,
        timestamp: "",
        scriptVersion: SCRIPT_VERSION,
        bgiVersion: "",
        commissions: [],
        branchCompleted: {},
    };
}

/**
 * 确保指定 UID 的账号槽存在且 commissions 为数组
 * @param {Object} data - v2 委托数据根对象
 * @param {string} uid - 账号 UID
 * @returns {Object} 指定 UID 的账号槽
 */
function ensureAccountData(data, uid) {
    if (!data.accounts[uid] || typeof data.accounts[uid] !== "object" || Array.isArray(data.accounts[uid])) {
        data.accounts[uid] = createAccountData(uid);
    }
    if (!Array.isArray(data.accounts[uid].commissions)) {
        data.accounts[uid].commissions = [];
    }
    return data.accounts[uid];
}

/**
 * 加载当前 UID 的委托数据
 *
 * 当前 UID 解析会接收已有账号槽 UID 作为候选：
 * - 全局 UID 有配置时优先匹配配置 UID
 * - 全局 UID 未配置时匹配已有账号槽，未命中才使用识别 UID 创建新槽
 *
 * @returns {Promise<{uid: string, data: Object, account: Object}|null>}
 */
export async function loadCurrentCommissionsData() {
    const data = readCommissionsData();
    const uid = await getCurrentUid({ knownUids: getKnownAccountUids(data) });
    if (!uid) {
        return null;
    }

    data.activeUid = uid;
    const account = data.accounts[uid];
    if (!account || !Array.isArray(account.commissions)) {
        log.warn("当前UID没有可用委托数据，请先执行委托识别: {uid}", uid);
        return null;
    }

    return { uid, data, account };
}

/**
 * 保存委托识别结果到当前 UID 的账号槽
 *
 * 委托地点会随流程阶段变化，但 process 文件按「接取地点」组织目录。
 * 同一 UID 同一天复扫且委托名称集合一致时，保留首次扫到的 location / country，
 * 避免后续扫描覆盖成空串或下一阶段的地点。
 *
 * @param {Array} commissions - 委托数据列表
 * @returns {Promise<Array>} 受支持的委托列表
 */
export async function saveCommissionsData(commissions) {
    try {
        const data = readCommissionsData();
        const uid = await getCurrentUid({ knownUids: getKnownAccountUids(data) });
        if (!uid) {
            log.error("无法确认当前UID，跳过委托数据保存");
            return [];
        }

        data.activeUid = uid;
        const account = ensureAccountData(data, uid);

        const canPreserve = account.timestamp
            && isToday(account.timestamp)
            && Array.isArray(account.commissions)
            && sameNameSet(account.commissions, commissions);

        const usedIndexes = new Set();
        const merged = commissions.map((c) => {
            const existing = canPreserve
                ? findExistingCommission(account.commissions, c, usedIndexes)
                : null;
            return {
                ...c,
                location: existing?.location || c.location,
                country: existing?.country || c.country,
            };
        });

        data.activeUid = uid;
        data.accounts[uid] = {
            uid,
            timestamp: new Date().toISOString(),
            scriptVersion: SCRIPT_VERSION,
            bgiVersion: getVersion(),
            commissions: merged,
        };

        writeCommissionsData(data);
        log.debug("委托数据保存完成: {uid}", uid);
        return commissions.filter((c) => c.supported);
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("处理委托数据时出错: {error}", error.message);
        return [];
    }
}

/**
 * 更新当前 UID 下单个委托的状态并回写 account-state.json。
 *
 * 用于委托执行完成后把 status 标记为「已完成」，
 * 避免复用当前 UID 已有数据时重复执行。
 *
 * @param {Object|string} commissionRef - 委托对象或委托名称
 * @param {string} status - 目标状态（取 COMMISSION_STATUS 中的值）
 * @param {string} [accountUid=""] - 已解析的当前账号 UID；传入时不会重新识别 UID
 * @returns {Promise<void>}
 */
export async function updateCommissionStatus(commissionRef, status, accountUid = "") {
    try {
        const data = readCommissionsData();
        const uid = accountUid || (await getCurrentUid({ knownUids: getKnownAccountUids(data) }));
        if (!uid) {
            log.error("无法确认当前UID，跳过委托状态更新: {name}",
                typeof commissionRef === "string" ? commissionRef : commissionRef?.name);
            return;
        }

        data.activeUid = uid;
        const account = data.accounts[uid];
        if (!account || !Array.isArray(account.commissions)) {
            log.warn("当前UID没有委托数据，跳过状态更新: {uid}", uid);
            return;
        }

        const targetRef = typeof commissionRef === "string"
            ? { name: commissionRef }
            : commissionRef;
        const target = account.commissions.find((c) => matchCommissionRecord(c, targetRef));
        if (!target) {
            log.warn("未在当前UID委托数据中找到 {name}，跳过状态更新", targetRef?.name);
            return;
        }
        if (target.status === status) {
            return;
        }

        target.status = status;
        writeCommissionsData(data);
        log.debug("委托 {name} 状态已更新为 {status}，UID: {uid}", target.name, status, uid);
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("更新委托状态时出错: {name}, {error}",
            typeof commissionRef === "string" ? commissionRef : commissionRef?.name,
            error.message);
    }
}
