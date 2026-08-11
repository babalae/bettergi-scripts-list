/**
 * 委托执行前的战斗队伍切换与本次运行队伍名缓存。
 *
 * 名称模式只切换队伍；角色模式切换自定义承载队伍并按槽位重组角色。
 */
import { PATHS } from "../config/index.js";
import { loadPartyConfigForContext, resolvePartySelection, validateCompleteRoles } from "../loaders/party-config.js";

let currentPartyName = "";
let currentPartyRoles = null;
let battlePartyWhitelist = null;

/**
 * 读取需要在委托流程前自动切换战斗队伍的委托名。
 */
function loadBattlePartyWhitelist() {
    if (battlePartyWhitelist) return battlePartyWhitelist;
    try {
        const catalog = JSON.parse(file.readTextSync(PATHS.COMMISSION_CATALOG));
        const parsed = catalog.switchBattleParty;
        if (!Array.isArray(parsed)) throw new Error("switchBattleParty 必须是委托名数组");
        battlePartyWhitelist = new Set(parsed.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim()));
    } catch (error) {
        log.error("读取战斗队伍白名单失败: {error}", error.message);
        battlePartyWhitelist = new Set();
    }
    return battlePartyWhitelist;
}

/**
 * 按队伍名称切换，并在成功后更新本次运行的当前队伍名。
 * @param {string} teamName - BetterGI 队伍配置中的队伍名称
 * @returns {Promise<boolean>} 已处于目标队伍或切换成功时返回 true
 */
export async function switchPartyByName(teamName) {
    const normalizedName = typeof teamName === "string" ? teamName.trim() : "";
    if (!normalizedName) return false;
    if (normalizedName === currentPartyName) {
        log.debug("当前已是目标队伍，跳过换队: {team}", normalizedName);
        return true;
    }

    log.info("切换队伍: {team}", normalizedName);
    const switched = await genshin.switchParty(normalizedName);
    if (switched) {
        currentPartyName = normalizedName;
        currentPartyRoles = null;
    }
    return switched;
}

/**
 * 切换到角色模式的承载队伍，并在角色配置变化时重组四个槽位。
 * @param {string} teamName - 角色模式使用的自定义承载队伍名称
 * @param {Object} roles - 以 1-4 为键的角色配置
 * @returns {Promise<boolean>} 队伍切换及角色重组均成功时返回 true
 */
export async function switchPartyWithRoles(teamName, roles) {
    const normalizedName = typeof teamName === "string" ? teamName.trim() : "";
    if (!normalizedName) throw new Error("角色模式未配置自定义承载队伍名称");

    const roleResult = validateCompleteRoles(roles);
    if (!roleResult.ok) throw new Error(`角色模式队伍配置无效: ${roleResult.error}`);

    const partyChanged = normalizedName !== currentPartyName;
    const switched = await switchPartyByName(normalizedName);
    if (!switched) return false;

    const normalizedRoles = roleResult.roles;
    const rolesMatch = currentPartyRoles && ["1", "2", "3", "4"].every((slot) => currentPartyRoles[slot] === normalizedRoles[slot]);
    if (rolesMatch) {
        log.debug("当前队伍角色与目标配置一致，跳过重组: {team}", normalizedName);
        return true;
    }

    if (partyChanged) await sleep(300);
    log.info("重组队伍角色: {team}", normalizedName);
    const roleSwitched = await genshin.SwitchCharacter(
        normalizedRoles["1"],
        normalizedRoles["2"],
        normalizedRoles["3"],
        normalizedRoles["4"]
    );
    if (roleSwitched) currentPartyRoles = { ...normalizedRoles };
    return roleSwitched;
}

/**
 * 白名单命中时，在委托首步骤前切换到该委托配置的战斗队伍。
 * @param {Object} context - 当前委托执行上下文
 * @returns {Promise<boolean>} 未命中白名单、无需换队或换队成功时返回 true
 */
export async function prepareCommissionBattleParty(context) {
    if (!loadBattlePartyWhitelist().has(context.commissionName)) return true;

    const resolved = resolvePartySelection(loadPartyConfigForContext(context), "battle");
    if (resolved.mode === "roles") {
        const switched = await switchPartyWithRoles(resolved.customTeamName, resolved.roles);
        if (!switched) throw new Error(`委托 ${context.commissionName} 重组战斗队伍失败: ${resolved.customTeamName}`);
        return true;
    }

    if (!resolved.teamName) throw new Error(`委托 ${context.commissionName} 未配置可用的战斗队伍名称`);
    const switched = await switchPartyByName(resolved.teamName);
    if (!switched) throw new Error(`委托 ${context.commissionName} 切换战斗队伍失败: ${resolved.teamName}`);
    return true;
}
