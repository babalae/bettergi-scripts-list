/**
 * 使用 BetterGI 原生能力重组当前队伍角色。
 */
import { defineStep } from "./define-step.js";
import { isCancellationError } from "../utils/error-utils.js";

/**
 * 解析并校验角色槽位。
 * @param {Object} data - 以 1-4 为键的角色配置
 * @returns {Array<{num: number, name: string}> | null}
 */
export function parseRoles(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        log.warn("切换角色步骤需要对象格式的 data");
        return null;
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
        log.warn("切换角色步骤没有指定任何角色");
        return null;
    }
    if (entries.length > 4) {
        log.warn("切换角色步骤最多只能指定 4 个角色，当前指定了 {count} 个", entries.length);
        return null;
    }

    const names = new Set();
    const roles = [];
    for (const [key, rawName] of entries) {
        if (!/^[1-4]$/.test(key)) {
            log.warn("角色键必须是 1-4 的数字字符串，当前键: {key}", key);
            return null;
        }
        const name = typeof rawName === "string" ? rawName.trim() : "";
        if (!name) {
            log.warn("角色 {key} 的名称无效", key);
            return null;
        }
        if (names.has(name)) {
            log.warn("角色不能重复: {name}", name);
            return null;
        }
        names.add(name);
        roles.push({ num: Number(key), name });
    }
    return roles.sort((a, b) => a.num - b.num);
}

export async function switchRolesByMap(roleMap) {
    const roles = parseRoles(roleMap);
    if (!roles) return false;

    const slots = ["", "", "", ""];
    for (const role of roles) slots[role.num - 1] = role.name;

    log.info("使用 BetterGI 重组队伍角色: {roles}", slots.map(name => name || "-").join(" | "));
    return await genshin.SwitchCharacter(slots[0], slots[1], slots[2], slots[3]);
}

function validateRoleData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: "切换角色步骤需要对象格式的 data" };
    }
    const entries = Object.entries(data);
    if (entries.length < 1 || entries.length > 4) {
        return { ok: false, error: "切换角色必须配置 1 至 4 个角色" };
    }

    const names = new Set();
    const normalized = {};
    for (const [slot, rawName] of entries) {
        const name = typeof rawName === "string" ? rawName.trim() : "";
        if (!/^[1-4]$/.test(slot)) return { ok: false, error: "角色槽位只能是 1 至 4: " + slot };
        if (!name) return { ok: false, error: "角色 " + slot + " 的名称不能为空" };
        if (names.has(name)) return { ok: false, error: "角色不能重复: " + name };
        names.add(name);
        normalized[slot] = name;
    }
    return { ok: true, value: normalized };
}

export default defineStep({
    type: "切换角色",
    category: "战斗与队伍",
    dataSpec: {
        kind: "custom",
        editor: "roles",
        label: "角色槽位",
        validate: validateRoleData,
    },
    run: async (step) => {
        try {
            const success = await switchRolesByMap(step.data);
            if (!success) throw new Error("BetterGI 角色重组失败");
            return true;
        } catch (error) {
            if (isCancellationError(error)) throw error;
            log.error("执行切换角色步骤时出错: {error}", error.message);
            log.debug("详情: {error}", error.stack);
            throw error;
        }
    },
});
