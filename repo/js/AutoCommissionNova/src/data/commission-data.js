/**
 * 委托数据管理模块。
 * 委托记录与分支完成度保存在当前 UID 的独立账号文件中。
 */
import { getCurrentUid, requireActiveAccountUid } from "../utils/account-utils.js";
import { listAccountUids, loadUserConfig, writeUserConfig } from "../loaders/user-config.js";
import { isCancellationError } from "../utils/error-utils.js";

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

export function loadBranchCompletionState() {
    const result = {};
    for (const uid of listAccountUids()) {
        try {
            const account = loadUserConfig(uid);
            for (const [commissionName, completed] of Object.entries(account.branchCompleted)) {
                if (!result[commissionName]) result[commissionName] = {};
                result[commissionName][uid] = Array.isArray(completed) ? completed : [];
            }
        } catch (error) {
            log.warn("读取账号分支进度失败 [{uid}]: {error}", uid, error.message);
        }
    }
    return result;
}

export function setBranchCompletion(accountUid, commissionName, completed) {
    if (!accountUid || !commissionName) return;
    const account = loadUserConfig(accountUid, { create: true });
    account.branchCompleted[commissionName] = Array.from(new Set(Array.isArray(completed) ? completed : []));
    writeUserConfig(account);
}

export function appendBranchCompletion(accountUid, commissionName, branchKey) {
    if (!accountUid || !commissionName || !branchKey) return false;
    const account = loadUserConfig(accountUid, { create: true });
    const completed = Array.isArray(account.branchCompleted[commissionName])
        ? account.branchCompleted[commissionName]
        : [];
    if (completed.includes(branchKey)) return false;
    completed.push(branchKey);
    account.branchCompleted[commissionName] = completed;
    writeUserConfig(account);
    return true;
}

/**
 * 读取当前委托数据文件中的账号 UID 列表
 *
 * 只暴露 UID 文件列表，供其它模块复用已有账号做 OCR 纠错。
 *
 * @returns {string[]}
 */
export function loadKnownCommissionUids() {
    return listAccountUids();
}

/**
 * 加载当前 UID 的委托数据
 *
 * 当前 UID 解析会使用账号目录中的文件名作为可信候选。
 *
 * @returns {Promise<{uid: string, data: Object, account: Object}|null>}
 */
export async function loadCurrentCommissionsData() {
    const uid = await getCurrentUid({ knownUids: listAccountUids() });
    if (!uid) {
        return null;
    }
    const account = loadUserConfig(uid);
    if (!account.commissions.length) {
        log.warn("当前UID没有可用委托数据，请先执行委托识别: {uid}", uid);
        return null;
    }
    return { uid, data: account, account };
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
        const uid = requireActiveAccountUid();
        if (!uid) {
            log.error("无法确认当前UID，跳过委托数据保存");
            return [];
        }

        const account = loadUserConfig(uid, { create: true });

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

        account.timestamp = new Date().toISOString();
        account.scriptVersion = SCRIPT_VERSION;
        account.bgiVersion = getVersion();
        account.commissions = merged;
        writeUserConfig(account);
        log.debug("委托数据保存完成: {uid}", uid);
        return commissions.filter((c) => c.supported);
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("处理委托数据时出错: {error}", error.message);
        return [];
    }
}

/**
 * 更新当前 UID 文件中单个委托的状态并写回同一账号文件。
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
        const uid = accountUid || requireActiveAccountUid();
        if (!uid) {
            log.error("无法确认当前UID，跳过委托状态更新: {name}",
                typeof commissionRef === "string" ? commissionRef : commissionRef?.name);
            return;
        }

        const account = loadUserConfig(uid);
        if (!account.commissions.length) {
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
        writeUserConfig(account);
        log.debug("委托 {name} 状态已更新为 {status}，UID: {uid}", target.name, status, uid);
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("更新委托状态时出错: {name}, {error}",
            typeof commissionRef === "string" ? commissionRef : commissionRef?.name,
            error.message);
    }
}
