import {config} from "../config/config";

/**
 * 拉取对应uid的Json数据
 * @param uid
 * @param http_api
 * @returns {Promise<HttpResponse>}
 */
async function pullJsonConfig(uid, http_api = config.bgi_tools.api.httpPullJsonConfig) {
    const result = http.request("GET", http_api, JSON.stringify({
            uid: uid,
        })
        // , JSON.stringify({"Content-Type": "application/json"})
    ).then(res => {
        log.debug(`[{0}]res=>{1}`, 'next', JSON.stringify(res))
        if (res.status_code === 200 && res.body) {
            let result_json = JSON.parse(res.body);
            if (result_json?.code === 200) {
                return result_json?.data
            }
            throw new Error("请求失败,error:" + result_json?.message)
        }
        return undefined
    })
    return result
}

/**
 * 推送全部Json数据
 * @param Json
 * @param http_api
 * @returns {Promise<void>}
 */
async function pushAllJsonConfig(Json = "[]", http_api = config.bgi_tools.api.httpPushAllJsonConfig) {
    const result = http.request("POST", http_api, Json
        , JSON.stringify({"Content-Type": "application/json"})
    ).then(res => {
        log.debug(`[{0}]res=>{1}`, 'next', JSON.stringify(res))
        if (res.status_code === 200 && res.body) {
            let result_json = JSON.parse(res.body);
            if (result_json?.code === 200) {
                return result_json?.data
            }
            throw new Error("请求失败,error:" + result_json?.message)
        }
        return undefined
    })
}