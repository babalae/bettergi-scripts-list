import { loadUserConfig, writeUserConfig } from "./user-config.js";

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeUid(value) {
    const text = String(value ?? "").trim();
    return text.toLowerCase() === "test" ? "test" : text.replace(/\D/g, "");
}

export function normalizeGlobalConfig(config) {
    const next = isPlainObject(config) ? config : {};
    const rawUids = Array.isArray(next.uids)
        ? next.uids
        : (typeof next.uid === "string" ? [next.uid] : []);

    return {
        uids: Array.from(new Set(rawUids.map(normalizeUid).filter(Boolean))),
        skipSafeTeleport: next.skipSafeTeleport === true,
    };
}

export function loadGlobalConfig() {
    return normalizeGlobalConfig(loadUserConfig());
}

export function writeGlobalConfig(config) {
    const userConfig = loadUserConfig();
    Object.assign(userConfig, normalizeGlobalConfig(config));
    writeUserConfig(userConfig);
}
