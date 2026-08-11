import { PATHS } from "../config/index.js";

const SCHEMA_VERSION = 2;

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

function emptyConfig() {
    return {
        schemaVersion: SCHEMA_VERSION,
        migrations: { autoCommission098: false },
        uids: [],
        skipSafeTeleport: false,
        party: { global: {}, scopes: {} },
    };
}

function normalize(config) {
    const source = isPlainObject(config) ? config : {};
    const migrations = isPlainObject(source.migrations) ? source.migrations : {};
    const party = isPlainObject(source.party) ? source.party : {};
    return {
        schemaVersion: SCHEMA_VERSION,
        migrations: {
            autoCommission098: migrations.autoCommission098 === true,
        },
        uids: Array.isArray(source.uids) ? source.uids : [],
        skipSafeTeleport: source.skipSafeTeleport === true,
        party: {
            global: isPlainObject(party.global) ? party.global : {},
            scopes: isPlainObject(party.scopes) ? party.scopes : {},
        },
    };
}

function readJson(path) {
    if (!file.isFile(path)) return null;
    const raw = file.readTextSync(path);
    return raw ? JSON.parse(raw) : null;
}

function scopeKey(scope) {
    return [scope.country, scope.typeDir, scope.commissionName, scope.locationDir].join("/");
}

export function loadUserConfig() {
    try {
        const current = readJson(PATHS.USER_CONFIG);
        return normalize(current || emptyConfig());
    } catch (error) {
        throw new Error(`统一用户配置解析失败，请修复 ${PATHS.USER_CONFIG}: ${error.message}`);
    }
}

export function writeUserConfig(config) {
    file.createDirectory("Data");
    file.writeTextSync(PATHS.USER_CONFIG, JSON.stringify(normalize(config), null, 4));
}

export function getUserPartyScope(config, scope) {
    return config.party.scopes[scopeKey(scope)];
}

export function setUserPartyScope(config, scope, value) {
    config.party.scopes[scopeKey(scope)] = value;
}

export function deleteUserPartyScope(config, scope) {
    delete config.party.scopes[scopeKey(scope)];
}
