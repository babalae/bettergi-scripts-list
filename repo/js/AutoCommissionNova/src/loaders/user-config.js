/**
 * UID 账号文件存储。
 *
 * 每个数字 UID 对应 Data/user-config/<uid>.json，本模块只负责账号文件的
 * 规范化、枚举和持久化，不负责识别当前游戏账号。
 */
import { PATHS } from "../config/index.js";

const SCRIPT_VERSION = "1.0.0";

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeUid(value) {
    const uid = String(value ?? "").trim();
    return /^\d+$/.test(uid) ? uid : "";
}

function accountPath(uid) {
    const normalizedUid = normalizeUid(uid);
    if (!normalizedUid) throw new Error(`无效 UID: ${uid}`);
    return `${PATHS.ACCOUNT_CONFIG_DIR}/${normalizedUid}.json`;
}

function emptySettings() {
    return {
        skipSafeTeleport: false,
        checkEncounterPoints: false,
        party: { global: {}, scopes: {} },
    };
}

export function createAccountConfig(uid) {
    const normalizedUid = normalizeUid(uid);
    if (!normalizedUid) throw new Error(`无效 UID: ${uid}`);
    return {
        uid: normalizedUid,
        timestamp: "",
        scriptVersion: SCRIPT_VERSION,
        bgiVersion: "",
        settings: emptySettings(),
        commissions: [],
        branchCompleted: {},
    };
}

export function normalizeAccountConfig(value, uid) {
    const normalizedUid = normalizeUid(uid);
    if (!normalizedUid) throw new Error(`无效 UID: ${uid}`);
    const source = isPlainObject(value) ? value : {};
    const settings = isPlainObject(source.settings) ? source.settings : {};
    const party = isPlainObject(settings.party) ? settings.party : {};
    return {
        uid: normalizedUid,
        timestamp: typeof source.timestamp === "string" ? source.timestamp : "",
        scriptVersion: typeof source.scriptVersion === "string" ? source.scriptVersion : SCRIPT_VERSION,
        bgiVersion: typeof source.bgiVersion === "string" ? source.bgiVersion : "",
        settings: {
            skipSafeTeleport: settings.skipSafeTeleport === true,
            checkEncounterPoints: settings.checkEncounterPoints === true,
            party: {
                global: isPlainObject(party.global) ? party.global : {},
                scopes: isPlainObject(party.scopes) ? party.scopes : {},
            },
        },
        commissions: Array.isArray(source.commissions) ? source.commissions : [],
        branchCompleted: isPlainObject(source.branchCompleted) ? source.branchCompleted : {},
    };
}

export function listAccountUids() {
    if (!file.isFolder(PATHS.ACCOUNT_CONFIG_DIR)) return [];
    return Array.from(file.readPathSync(PATHS.ACCOUNT_CONFIG_DIR) || [])
        .filter((path) => file.isFile(path))
        .map((path) => String(path).replace(/\\/g, "/").split("/").pop() || "")
        .filter((name) => /^\d+\.json$/.test(name))
        .map((name) => name.slice(0, -5))
        .sort((a, b) => a.localeCompare(b));
}

export function loadUserConfig(uid, options = {}) {
    const path = accountPath(uid);
    if (!file.isFile(path)) {
        const account = createAccountConfig(uid);
        if (options.create === true) writeUserConfig(account);
        return account;
    }
    const raw = file.readTextSync(path);
    if (!raw) throw new Error(`账号配置为空，请修复 ${path}`);
    try {
        const parsed = JSON.parse(raw);
        if (String(parsed?.uid ?? "") !== normalizeUid(uid)) {
            throw new Error("文件名与内部 UID 不一致");
        }
        return normalizeAccountConfig(parsed, uid);
    } catch (error) {
        throw new Error(`账号配置解析失败，请修复 ${path}: ${error.message}`);
    }
}

export function writeUserConfig(config) {
    const uid = normalizeUid(config?.uid);
    if (!uid) throw new Error("账号配置缺少有效 UID");
    file.createDirectory(PATHS.ACCOUNT_CONFIG_DIR);
    const written = file.writeTextSync(accountPath(uid), JSON.stringify(normalizeAccountConfig(config, uid), null, 4), false);
    if (!written) throw new Error(`写入账号配置失败: ${accountPath(uid)}`);
}

function scopeKey(scope) {
    return [scope.country, scope.typeDir, scope.commissionName, scope.locationDir].join("/");
}

export function getUserPartyScope(config, scope) {
    return config.settings.party.scopes[scopeKey(scope)];
}

export function setUserPartyScope(config, scope, value) {
    config.settings.party.scopes[scopeKey(scope)] = value;
}

export function deleteUserPartyScope(config, scope) {
    delete config.settings.party.scopes[scopeKey(scope)];
}
