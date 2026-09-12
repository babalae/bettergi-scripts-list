const manifest = JSON.parse(file.readTextSync("manifest.json"));
const scriptName = "七圣召唤七日历练全自动";
const scriptVersion = manifest.version;
const headers = JSON.stringify({ "Content-Type": "application/json", "User-Agent": `BetterGI-Script TCG-Weekly-Player/${scriptVersion}` });
const PENDING_FILE_PATH = "牌组策略/待上报的对战结果.json";

const API_ENDPOINT = "https://api.ayaka20.ggff.net/tcg";

/** ClearScript 没有crypto库，手动实现一个普通的uuid函数 */
function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 辅助函数：追加失败的数据记录到本地 JSON
function saveFailedReport(data) {
    try {
        let pendingList = [];
        if (file.isExists(PENDING_FILE_PATH)) {
            const content = file.readTextSync(PENDING_FILE_PATH);
            if (content && content.trim() !== "") {
                pendingList = JSON.parse(content);
            }
        }
        pendingList.push(data);
        file.writeTextSync(PENDING_FILE_PATH, JSON.stringify(pendingList, null, 2));
        log.info("已将上报失败的数据保存至本地文件: {0}", PENDING_FILE_PATH);
    } catch (e) {
        log.error("保存失败数据至本地 JSON 发生错误: {0}", e.toString());
    }
}

/**
 * 上报脚本任务的执行效率与结果日志
 *
 * @param {string} task_name - 任务/对手名称（例如："神里绫华"）
 * @param {string} task_config - 任务配置或出战阵容描述（例如："雷神柯莱刻晴"）
 * @param {number|boolean} is_win - 是否获胜（`1` 或 `true` 表示胜利，`0` 或 `false` 表示失败）
 * @param {number} duration - 任务耗时（单位：秒）
 * @param {string} [script_name=null] - 脚本名称，若不传或为 null 则默认使用 manifest.json 中的 name
 * @returns {Promise<object>} API 响应的 body 数据
 */
async function reportEffiency(task_name, task_config, is_win, duration, script_name = null, max_retries = 3) {
    if (script_name === null) {
        script_name = scriptName;
    }
    const payload = {
        script_name: script_name,
        script_version: scriptVersion,
        task_name: task_name,
        task_config: task_config,
        is_win: is_win,
        duration: duration,
        uuid: generateUUID(),
    };
    const body = JSON.stringify(payload);

    for (let attempt = 1; attempt <= max_retries; attempt++) {
        try {
            log.info("报告打牌结果: 使用策略{0}与{1}对战，耗时{2}秒，是否胜利:{3}", task_config, task_name, duration, is_win);
            const response = await http.request("POST", `${API_ENDPOINT}/logs`, body, headers);
            log.debug("Reponse: {0}", response.body);
            return response.body;
        } catch (err) {
            log.warn(`向云端汇报统计数据失败 (第${attempt}/${max_retries}次尝试): {0}`, err.toString());
            if (attempt < max_retries) {
                await sleep(1000);
            } else {
                log.error("向云端汇报统计数据失败，已达最大重试次数: {0}", err.toString());
            }
        }
    }

    // 重试均失败，将数据对象写入本地本地文件
    saveFailedReport(payload);
    return null;
}

// 新增函数：读取本地记录并重新上报
async function retryFailedReports() {
    if (!file.isExists(PENDING_FILE_PATH)) {
        return;
    }
    let pendingList = [];
    try {
        const content = file.readTextSync(PENDING_FILE_PATH);
        if (!content || content.trim() === "") return;
        pendingList = JSON.parse(content);
    } catch (e) {
        log.error("读取待上报文件失败: {0}", e.toString());
        return;
    }

    if (!Array.isArray(pendingList) || pendingList.length === 0) {
        return;
    }

    // 每次只补报一条，避免集中请求
    const item = pendingList[0];
    try {
        log.info("尝试补报单条历史记录 (UUID: {0})，剩余队列: {1} 条", item.uuid, pendingList.length);
        const response = await http.request("POST", `${API_ENDPOINT}/logs`, JSON.stringify(item), headers);
        log.info("单条补报成功 (UUID: {0})", item.uuid);

        // 成功后移除第一条
        pendingList.shift();

        // 根据剩余数量更新或删除文件
        if (pendingList.length === 0) {
            file.writeTextSync(PENDING_FILE_PATH, JSON.stringify([], null, 2));
            log.info("待上报队列已清空");
        } else {
            file.writeTextSync(PENDING_FILE_PATH, JSON.stringify(pendingList, null, 2));
        }
    } catch (err) {
        log.warn("单条补报失败 (UUID: {0}): {1}，保留记录下次重试", item.uuid, err.toString());
        // 失败时不修改队列，直接退出，等待下次调用
    }
}

/**
 * 查询指定任务的胜率/效率排行榜数据
 *
 * @param {string} task_name - 要查询的任务/对手名称（例如："神里绫华"）
 * @param {string|null} [script_name=null] - 脚本名称，若不传或为 null 则默认使用全局变量 scriptName
 * @returns {Promise<{success: boolean, data: Array<object>}>} 解析后的排行榜 JSON 对象；若解析失败则返回 `{ success: false, data: [] }`
 */
async function queryEffiency(task_name, script_name = null) {
    if (script_name === null) {
        script_name = scriptName;
    }
    const url = `${API_ENDPOINT}/rankings?task_name=${task_name}&sort_by=win_efficiency`;
    const response = await http.request("GET", url, null, headers);
    try {
        return JSON.parse(response.body);
    } catch (err) {
        log.error("解析云端返回数据失败: {0}, 原始数据: {1}", err, response.body);
        return { success: false, data: [] };
    }
}

export { reportEffiency, queryEffiency, retryFailedReports };
