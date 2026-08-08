const manifest = JSON.parse(file.readTextSync("manifest.json"));
const scriptName = "七圣召唤七日历练全自动";
const scriptVersion = manifest.version;
const headers = JSON.stringify({ "Content-Type": "application/json", "User-Agent": `BetterGI-Script TCG-Weekly-Player/${scriptVersion}` });

const API_ENDPOINT = "https://api.ayaka20.ggff.net/tcg";

/**
 * 上报脚本任务的执行效率与结果日志
 *
 * @param {string} task_name - 任务/对手名称（例如："神里绫华"）
 * @param {string} task_config - 任务配置或出战阵容描述（例如："雷神柯莱刻晴"）
 * @param {number|boolean} is_win - 是否获胜（`1` 或 `true` 表示胜利，`0` 或 `false` 表示失败）
 * @param {number} duration - 任务耗时（单位：秒）
 * @param {string} [script_name=null] - 脚本名称，若不传或为 null 则默认使用 manifest.json 中的 name
 * @returns {Promise<object>} API 响应的 body 数据
 */async function reportEffiency(task_name, task_config, is_win, duration, script_name = null) {
    if (script_name === null) {
        script_name = scriptName;
    }
    const body = JSON.stringify({
        script_name: script_name,
        script_version: scriptVersion,
        task_name: task_name,
        task_config: task_config,
        is_win: is_win,
        duration: duration,
    });
    const response = await http.request("POST", `${API_ENDPOINT}/logs`, body, headers);
    return response.body;
}

/**
 * 查询指定任务的胜率/效率排行榜数据
 *
 * @param {string} task_name - 要查询的任务/对手名称（例如："神里绫华"）
 * @param {number} [min_matches=1] - 筛选的最少匹配/对局次数，默认为 1
 * @param {string|null} [script_name=null] - 脚本名称，若不传或为 null 则默认使用全局变量 scriptName
 * @returns {Promise<{success: boolean, data: Array<object>}>} 解析后的排行榜 JSON 对象；若解析失败则返回 `{ success: false, data: [] }`
 */
async function queryEffiency(task_name, min_matches = 1, script_name = null) {
    if (script_name === null) {
        script_name = scriptName;
    }
    const url = `${API_ENDPOINT}/rankings?task_name=${task_name}&min_matches=${min_matches}&sort_by=win_efficiency`;
    const response = await http.request("GET", url, headers);
    try {
        return JSON.parse(response.body);
    } catch (err) {
        log.error("解析云端返回数据失败: {0}, 原始数据: {1}", err, response.body);
        return { 'success': false, 'data': [] };
    }
}

export { reportEffiency, queryEffiency };
