import { PATHS } from "../config/index.js";
import { loadUserConfig, writeUserConfig } from "../loaders/user-config.js";

const MIGRATION_KEY = "autoCommission098";

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

function readRawUserConfig() {
    if (!file.isFile(PATHS.USER_CONFIG)) return null;
    const raw = file.readTextSync(PATHS.USER_CONFIG);
    return raw ? JSON.parse(raw) : null;
}

function normalizeLegacyTeamName(value) {
    return typeof value === "string" ? value.trim() : "";
}

/**
 * 将 AutoCommission 0.98.x 的 BGI 自定义设置一次性迁移到统一用户配置。
 *
 * 新版配置始终优先：队伍只补空值，安全传送只在原始用户配置尚未显式设置时继承。
 * skipRecognition 是旧版开发者选项，不参与迁移。
 *
 * @param {Object} setting - getSetting() 返回的入口设置与旧版兼容字段。
 * @returns {Promise<boolean>} 本次是否实际迁移了至少一个字段。
 */
export async function migrateLegacyAutoCommissionSettings(setting = {}) {
    const rawConfig = readRawUserConfig();
    const config = loadUserConfig();
    if (config.migrations?.[MIGRATION_KEY] === true) return false;

    const migrated = [];
    const globalParty = config.party.global;
    const battleTeamName = normalizeLegacyTeamName(setting.team);
    const elementTeamName = normalizeLegacyTeamName(setting.elementTeam);

    if (!normalizeLegacyTeamName(globalParty.battleTeamName) && battleTeamName) {
        globalParty.battleTeamName = battleTeamName;
        migrated.push(`战斗队伍：${battleTeamName}`);
    }

    if (!normalizeLegacyTeamName(globalParty.elementTeamName) && elementTeamName) {
        globalParty.elementTeamName = elementTeamName;
        migrated.push(`元素队伍：${elementTeamName}`);
    }

    const hasExplicitSafeTeleport = isPlainObject(rawConfig)
        && typeof rawConfig.skipSafeTeleport === "boolean";
    if (setting.prepare === true && !hasExplicitSafeTeleport) {
        config.skipSafeTeleport = true;
        migrated.push("安全传送设置：已继承");
    }

    config.migrations[MIGRATION_KEY] = true;
    writeUserConfig(config);

    if (migrated.length > 0) {
        log.info([
            "检测到 AutoCommission 0.98.x 配置，已自动迁移：",
            ...migrated,
            "",
            "无需重新配置。",
        ].join("\n"));
    }

    return migrated.length > 0;
}
