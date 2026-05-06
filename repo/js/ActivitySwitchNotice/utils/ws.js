import {ocrUID} from "./uid";

const actionType = Object.freeze({
    send_private_msg: 'send_private_msg',//私聊
    send_group_msg: 'send_group_msg',//群聊
    fromValue(value) {
        return Object.keys(this).find(key => this[key] === value);
    }
})

const textType = Object.freeze({
    text: 'text',//文本
    at: 'at',//@某人
    image: 'image',//图片
    face: 'face',//表情
    json: 'json',//卡片消息
    record: 'record',//语音
    video: 'video',//视频
    dice: 'dice',//骰子
    rps: 'rps',//猜拳
    file: 'file',//文件
    node: 'node',//节点
    // 添加反向映射（可选）
    fromValue(value) {
        return Object.keys(this).find(key => this[key] === value);
    }
});
const actionMap = new Map([
    ["私聊", actionType.send_private_msg],
    ["群聊", actionType.send_group_msg]
]);
// const templateMap = new Map([
//     [textType.text, {type: textType.text, data: {text: ""}}],
//     [textType.at, {type: textType.at, data: {qq: ""}}],
// ]);

let configWs = {
    action: actionMap.get(settings.action),
    group_id: settings.send_id,
    user_id: settings.send_id,
    ws_proxy_url: settings.ws_proxy_url,
    ws_url: settings.ws_url,
    ws_token: settings.ws_token,
    at_list: settings.at_list ? settings.at_list.split(",") : []
}
let local = {
    token: null,
    uid: null,
}

/**
 * 构建初始化配置设置函数
 * 该函数用于初始化WebSocket配置和本地配置信息
 */
async function buildInitConfigSettings() {
    // 初始化WebSocket配置对象
    configWs = {
        action: actionMap.get(settings.action), // 从actionMap中获取对应的操作映射
        group_id: settings.send_id,            // 设置群组ID
        user_id: settings.send_id,             // 设置用户ID
        ws_proxy_url: settings.ws_proxy_url,   // 设置WebSocket代理URL
        ws_url: settings.ws_url,               // 设置WebSocket连接URL
        ws_token: settings.ws_token,           // 设置WebSocket连接令牌
        at_list: settings.at_list ? settings.at_list.split(",") : [] // 处理@用户列表，如果存在则按逗号分割，否则为空数组
    }
    // 初始化本地配置对象
    local = {
        token: null,  // 初始化token为null
        uid: null,    // 初始化用户ID为null
    }
}
/**
 *
 *
 * 初始化函数
 * 该函数是一个异步函数，用于执行程序的初始化操作
 * 目前函数体为空，可以根据实际需求添加初始化逻辑
 */
async function init() {
    await buildInitConfigSettings()
    const uid = await ocrUID()
    local.token = await getToken()
    local.uid = uid
    if (settings.wsNoticeType === "自定义通知") {
        configWs = {
            action: actionMap.get(settings.action),
            group_id: settings.send_id,
            user_id: settings.send_id,
            ws_proxy_url: settings.ws_proxy_url,
            ws_url: settings.ws_url,
            ws_token: settings.ws_token,
            at_list: settings.at_list ? settings.at_list.split(",") : []
        }
    } else {
        //从bgi-tools获取ws信息
        const configWsT = await pullAccessWsProxyConfig(local.uid, settings.http_api_access_ws_proxy)
        if (!configWsT) {
            // log.error("获取ws信息失败")
            throw new Error("获取ws授权信息失败")
        }
        configWs = configWsT
        configWs.at_list = configWsT.at_list ? configWsT.at_list.split(",") : []
    }
    log.debug(`configWs:{configWs}`, JSON.stringify(configWs))
    log.info('ws init success')
}

async function getToken() {
    let token = {
        name: "",
        value: ""
    }
    const bgi_tools_token = settings.bgi_tools_token || "Authorization= "
    // const list = Array.from(bgi_tools_token.split("=")).map(item => item.trim());
    // config.bgi_tools.token.name = list[0]
    // config.bgi_tools.token.value = list[1]

    const separatorIndex = bgi_tools_token.indexOf("=");
    if (separatorIndex !== -1) {
        token.name = bgi_tools_token.substring(0, separatorIndex).trim();
        token.value = bgi_tools_token.substring(separatorIndex + 1).trim();
    } else {
        token.name = bgi_tools_token.trim();
        token.value = "";
    }
    try {
        return token;
    } finally {
        local.token = token;
    }
}

export async function pullAccessWsProxyConfig(uid, http_api) {
    let token = local.token;
    let value = {
        "Content-Type": "application/json",
        [token.name]: token.value
    };
    http_api += "?uid=" + uid
    // 发送HTTP请求
    const httpResponse = await http.request("GET", http_api, JSON.stringify({}), JSON.stringify(value));
    // 检查响应状态码
    if (httpResponse.status_code != 200) {
        // 错误日志输出服务器响应
        log.error(`服务器返回状态${httpResponse.headers} ${httpResponse.body}`);
    } else {
        let result_json = JSON.parse(httpResponse.body);
        if (result_json?.code === 200) {
            return result_json?.data
        }
    }
    return undefined;
}

/**
 * 发送消息的异步函数
 * @param {string} wsProxyUrl - WebSocket代理URL
 * @param {string} wsUrl - WebSocket URL
 * @param {string} wsToken - WebSocket令牌
 * @param {string} action - 动作类型（群发或私聊）
 * @param {number} group_id - 群号
 * @param {number} user_id - 用户QQ号
 * @param {Array} textList - 文本消息列表
 * @param {Array} atList - @用户列表
 * @returns {Promise<void>} 无返回值
 */
export async function send(wsProxyUrl, wsUrl, wsToken, action, group_id, user_id, textList, atList) {
    const uid = local.uid
    // 构建基础JSON对象
    let json = {
        action: action,//send_group_msg群发、send_private_msg私聊
        // params: {
        //     group_id: group_id,//群号
        //     user_id: user_id,//QQ号
        //     message: []
        // }
        uid: uid
    }
    // 根据动作类型设置不同的参数
    switch (action) {
        case actionType.send_group_msg:
            json.params = {
                group_id: group_id,//群号
                message: []
            };
            break;
        case actionType.send_private_msg:
            json.params = {
                user_id: user_id,//QQ号
                message: []
            }
            break;
        default:
            break;
    }
    // 添加文本消息到消息列表
    for (let text of textList) {
        json.params.message.push({
            type: textType.text,
            data: {
                text: `${text}`
            }
        })
    }

    // 添加@消息到消息列表
    for (let at of atList) {
        //@qq
        json.params.message.push({
            type: textType.at,
            data: {
                qq: `${at}`
            }
        })
    }
    let token = local.token;
    // 构建请求体
    let body = {
        url: wsUrl,
        token: wsToken,
        bodyJson: JSON.stringify(json)
    }
    // 调试日志输出请求体
    log.debug(`body:{key}`, JSON.stringify(body))
    // 信息日志记录HTTP请求开始
    log.info('http request start')
    let value = {
        "Content-Type": "application/json",
        [token.name]: token.value
    };

    // 发送HTTP请求
    const httpResponse = await http.request("POST", wsProxyUrl, JSON.stringify(body), JSON.stringify(value));
    // 检查响应状态码
    if (httpResponse.status_code != 200) {
        // 错误日志输出服务器响应
        log.error(`服务器返回状态${httpResponse.headers} ${httpResponse.body}`);
        return;
    }
}

export async function sendText(text) {
    await init();
    let action = configWs.action;
    let group_id = configWs.group_id;
    let user_id = configWs.user_id;
    let wsUrl = configWs.ws_url
    let wsProxyUrl = configWs.ws_proxy_url;
    let ws_token = configWs.ws_token;
    let textList = [text]
    let atList = configWs.at_list

    await send(wsProxyUrl, wsUrl, ws_token, action, group_id, user_id, textList, atList)
}

// export {
//     send,
//     sendText
// }