import {UI, Log} from "./utils/tools";
import {BgiTools} from "./utils/bgi_tools";


export const LoadType = Object.freeze({
    input: 'input',//input加载
    bgi_tools: 'bgi_tools',//bgi_tools加载
    fromValue(value) {
        return Object.keys(this).find(key => this[key] === value);
    }
})
export const LoadMap = new Map([
    ['输入加载', LoadType.input],
    ['bgi_tools加载', LoadType.bgi_tools],
])


(async function () {
    const auto_load = settings.auto_load || "输入加载";
    const Load = LoadMap.get(auto_load);
    let team = settings.team;
    switch (Load) {
        case LoadType.input:
            team = settings.team;
            break;
        case LoadType.bgi_tools:
            const uid = await genshin.uid();

            const bgi_tools_token = settings.bgi_tools_token || "Authorization= "
            const token = {name: "Authorization", value: ""};

            const separatorIndex = bgi_tools_token.indexOf("=");
            if (separatorIndex !== -1) {
                token.name = bgi_tools_token.substring(0, separatorIndex).trim();
                token.value = bgi_tools_token.substring(separatorIndex + 1).trim();
            }

            const uidTeam = await BgiTools.getTeam({uid: uid, type: settings.type}, settings.bgi_tools_uid_team_api, token)
            //{id,uid,team,type}
            team = uidTeam.team;
            break;
        default:
            Log.error(`无效的加载方式: ${auto_load}`);
            return;

    }
    // 切换队伍

    if (team) {
        Log.info(`切换至队伍 {team}`, team);
        try {
            Log.info(`正在尝试切换至{team}`, team);
            if (!await genshin.switchParty(team)) {
                Log.info("切换队伍失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                await genshin.switchParty(team);
            }
        } catch {
            Log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
            notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
            await UI.toMainUi();
        }
    }

})();
