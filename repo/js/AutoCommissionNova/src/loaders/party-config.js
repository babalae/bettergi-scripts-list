import { buildCommissionScope, buildCommissionScopeFromContext } from "./process-scope.js";
import { deleteUserPartyScope, getUserPartyScope, loadUserConfig, setUserPartyScope, writeUserConfig } from "./user-config.js";

export const DEFAULT_BATTLE_STRATEGY = "根据队伍自动选择";

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeRoles(roles) {
    const next = {};
    for (const key of ["1", "2", "3", "4"]) {
        const value = roles && typeof roles[key] === "string" ? roles[key].trim() : "";
        next[key] = value;
    }
    return next;
}

/**
 * 严格校验角色模式的四人配置。
 * @param {Object} roles - 以 1-4 为键的角色配置。
 * @returns {{ok: boolean, error?: string, roles?: Object}}
 */
export function validateCompleteRoles(roles) {
    if (!isPlainObject(roles)) return { ok: false, error: "roles 必须是对象" };
    const expectedKeys = ["1", "2", "3", "4"];
    const actualKeys = Object.keys(roles);
    if (actualKeys.length !== expectedKeys.length || actualKeys.some(key => !expectedKeys.includes(key))) {
        return { ok: false, error: "roles 必须且只能包含 1、2、3、4 四个槽位" };
    }

    const normalized = {};
    for (const key of expectedKeys) {
        if (typeof roles[key] !== "string" || !roles[key].trim()) {
            return { ok: false, error: `roles.${key} 必须是非空角色名` };
        }
        normalized[key] = roles[key].trim();
    }
    if (new Set(Object.values(normalized)).size !== expectedKeys.length) {
        return { ok: false, error: "四个槽位的角色名不能重复" };
    }
    return { ok: true, roles: normalized };
}

function normalizeTeamSelectionConfig(config, fallbackMode = "global") {
    const next = isPlainObject(config) ? { ...config } : {};
    return {
        mode: next.mode === "custom" ? "custom" : fallbackMode,
        teamMode: next.teamMode === "roles" ? "roles" : "teamName",
        teamName: typeof next.teamName === "string" ? next.teamName.trim() : "",
        customTeamName: typeof next.customTeamName === "string" ? next.customTeamName.trim() : "",
        roles: normalizeRoles(next.roles),
    };
}

function normalizeBattleScopeConfig(config, fallbackMode = "global") {
    const next = normalizeTeamSelectionConfig(config, fallbackMode);
    return {
        ...next,
        strategy: typeof config?.strategy === "string" && config.strategy.trim()
            ? config.strategy.trim()
            : DEFAULT_BATTLE_STRATEGY,
    };
}

export function normalizeGlobalPartyConfig(config) {
    const next = isPlainObject(config) ? { ...config } : {};
    return {
        battleTeamName: typeof next.battleTeamName === "string" && next.battleTeamName.trim()
            ? next.battleTeamName.trim()
            : "",
        elementTeamName: typeof next.elementTeamName === "string" && next.elementTeamName.trim()
            ? next.elementTeamName.trim()
            : "",
        customBattleTeamName: typeof next.customBattleTeamName === "string" && next.customBattleTeamName.trim()
            ? next.customBattleTeamName.trim()
            : "",
        customElementTeamName: typeof next.customElementTeamName === "string" && next.customElementTeamName.trim()
            ? next.customElementTeamName.trim()
            : "",
        battleStrategy: typeof next.battleStrategy === "string" && next.battleStrategy.trim()
            ? next.battleStrategy.trim()
            : DEFAULT_BATTLE_STRATEGY,
    };
}

export function normalizeScopePartyConfig(config) {
    const next = isPlainObject(config) ? { ...config } : {};
    return {
        battle: normalizeBattleScopeConfig(next.battle, "global"),
        collect: normalizeTeamSelectionConfig(next.collect, "global"),
    };
}

function hasRoleValue(roles) {
    for (const key of ["1", "2", "3", "4"]) {
        if (roles && typeof roles[key] === "string" && roles[key].trim()) {
            return true;
        }
    }
    return false;
}

function hasTeamSelectionValue(config) {
    return (typeof config.teamName === "string" && config.teamName.trim())
        || (typeof config.customTeamName === "string" && config.customTeamName.trim())
        || hasRoleValue(config.roles);
}

function shouldPersistScopeConfig(config) {
    const normalized = normalizeScopePartyConfig(config);
    const battleCustom = normalized.battle.mode === "custom";
    const collectCustom = normalized.collect.mode === "custom";

    if (!battleCustom && !collectCustom) {
        return false;
    }

    return (battleCustom && hasTeamSelectionValue(normalized.battle))
        || (collectCustom && hasTeamSelectionValue(normalized.collect));
}

export function loadGlobalPartyConfig() {
    try {
        const userConfig = loadUserConfig();
        const json = userConfig.party.global;
        if (!json) {
            return normalizeGlobalPartyConfig({});
        }
        return normalizeGlobalPartyConfig(json);
    } catch (error) {
        log.debug("读取全局队伍配置失败，使用默认值: {err}", error.message);
        return normalizeGlobalPartyConfig({});
    }
}

export function loadScopePartyConfig(scope) {
    try {
        const userConfig = loadUserConfig();
        const json = getUserPartyScope(userConfig, buildCommissionScope(scope));
        if (!json) {
            return normalizeScopePartyConfig({});
        }
        return normalizeScopePartyConfig(json);
    } catch (error) {
        log.debug("读取委托队伍配置失败 [{key}]，使用默认值: {err}", scope?.key, error.message);
        return normalizeScopePartyConfig({});
    }
}

export function loadPartyConfigForContext(context) {
    const scope = buildCommissionScopeFromContext(context);
    return {
        scope,
        global: loadGlobalPartyConfig(),
        local: scope ? loadScopePartyConfig(scope) : normalizeScopePartyConfig({}),
    };
}

export function resolvePartySelection(configBundle, channel) {
    const globalConfig = configBundle?.global || normalizeGlobalPartyConfig({});
    const localConfig = configBundle?.local || normalizeScopePartyConfig({});
    const config = channel === "collect" ? localConfig.collect : localConfig.battle;

    if (config.mode !== "custom") {
        if (channel === "collect") {
            return {
                mode: "teamName",
                teamName: globalConfig.elementTeamName || "",
                customTeamName: globalConfig.customElementTeamName || "",
                roles: {},
                strategy: "",
            };
        }
        return {
            mode: "teamName",
            teamName: globalConfig.battleTeamName || "",
            customTeamName: globalConfig.customBattleTeamName || "",
            roles: {},
            strategy: globalConfig.battleStrategy || DEFAULT_BATTLE_STRATEGY,
        };
    }

    if (config.teamMode === "roles") {
        return {
            mode: "roles",
            teamName: "",
            customTeamName: config.customTeamName || "",
            roles: config.roles,
            strategy: channel === "battle" ? (config.strategy || DEFAULT_BATTLE_STRATEGY) : "",
        };
    }

    return {
        mode: "teamName",
        teamName: config.teamName || "",
        customTeamName: config.customTeamName || "",
        roles: {},
        strategy: channel === "battle" ? (config.strategy || DEFAULT_BATTLE_STRATEGY) : "",
    };
}

export function resolveBattleStrategy(configBundle) {
    const globalConfig = configBundle?.global || normalizeGlobalPartyConfig({});
    const localConfig = configBundle?.local || normalizeScopePartyConfig({});
    return localConfig.battle.mode === "custom"
        ? (localConfig.battle.strategy || DEFAULT_BATTLE_STRATEGY)
        : (globalConfig.battleStrategy || DEFAULT_BATTLE_STRATEGY);
}

export function createPartyConfigView(scopesByCommission) {
    const view = {};
    const global = loadGlobalPartyConfig();

    for (const [commissionName, scopes] of Object.entries(scopesByCommission || {})) {
        view[commissionName] = (scopes || []).map((scope) => ({
            ...scope,
            config: loadScopePartyConfig(scope),
        })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
    }

    return { global, scopesByCommission: view };
}

export function writePartyConfigView(view) {
    if (!isPlainObject(view)) {
        return;
    }

    const scopesByCommission = isPlainObject(view.scopesByCommission) ? view.scopesByCommission : {};
    const userConfig = loadUserConfig();
    let changed = false;

    for (const scopeList of Object.values(scopesByCommission)) {
        if (!Array.isArray(scopeList)) continue;
        for (const scopeEntry of scopeList) {
            if (!scopeEntry || !scopeEntry.key || !scopeEntry.config) continue;
            const scope = buildCommissionScope(scopeEntry);
            const exists = Boolean(getUserPartyScope(userConfig, scope));
            const normalizedConfig = normalizeScopePartyConfig(scopeEntry.config);
            const shouldPersist = shouldPersistScopeConfig(normalizedConfig);

            if (shouldPersist) {
                setUserPartyScope(userConfig, scope, normalizedConfig);
                changed = true;
                continue;
            }

            if (exists) {
                deleteUserPartyScope(userConfig, scope);
                changed = true;
            }
        }
    }

    if (isPlainObject(view.global)) {
        userConfig.party.global = normalizeGlobalPartyConfig(view.global);
        changed = true;
    }
    if (changed) writeUserConfig(userConfig);
}
