/**
 * 按当前委托配置切换战斗队伍或元素采集队伍。
 */
import { loadPartyConfigForContext, resolvePartySelection } from "../loaders/party-config.js";
import { switchPartyByName, switchPartyWithRoles } from "../core/commission-party-switcher.js";
import { defineStep } from "./define-step.js";

export default defineStep({
    type: "切换委托队伍",
    category: "战斗与队伍",
    dataSpec: { kind: "string", label: "队伍用途", options: ["战斗", "元素采集"] },
    run: async (step, context) => {
        log.info("执行切换委托队伍操作");
        if (step.data !== "战斗" && step.data !== "元素采集") {
            throw new Error(`切换委托队伍步骤 data 只能是 "战斗" 或 "元素采集"，收到: ${step.data}`);
        }

        const configBundle = loadPartyConfigForContext(context);
        const channel = step.data === "战斗" ? "battle" : "collect";
        const resolved = resolvePartySelection(configBundle, channel);

        if (resolved.mode === "roles") {
            if (!resolved.customTeamName) {
                throw new Error(`${step.data}队伍使用角色模式，但当前委托未配置 customTeamName`);
            }

            log.debug("切换至{kind}自定义承载队伍: {team}", step.data, resolved.customTeamName);
            const switched = await switchPartyWithRoles(resolved.customTeamName, resolved.roles);
            if (!switched) {
                throw new Error(`${step.data}队伍角色重组失败: ${resolved.customTeamName}`);
            }
            return true;
        }

        const teamName = resolved.teamName;
        if (!teamName || teamName.trim() === "") {
            log.warn("{kind}队伍未配置队伍名称，跳过切换队伍", step.data);
            return true;
        }

        const success = await switchPartyByName(teamName);
        if (!success) throw new Error(`队伍切换失败: ${teamName}`);
        await sleep(300);
        return true;
    },
});
