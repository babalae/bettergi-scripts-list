import { loadUserConfig, writeUserConfig } from "./user-config.js";
import { requireActiveAccountUid } from "../utils/account-utils.js";

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeGlobalConfig(config) {
    const next = isPlainObject(config) ? config : {};
    return {
        skipSafeTeleport: next.skipSafeTeleport === true,
        checkEncounterPoints: next.checkEncounterPoints === true,
    };
}

export function loadGlobalConfig(uid = requireActiveAccountUid()) {
    return normalizeGlobalConfig(loadUserConfig(uid).settings);
}

export function writeGlobalConfig(config, uid = requireActiveAccountUid()) {
    const userConfig = loadUserConfig(uid);
    Object.assign(userConfig.settings, normalizeGlobalConfig(config));
    writeUserConfig(userConfig);
}
