
/**
 * 拉取对应uid的Json数据
 * @param uid
 * @param http_api
 * @returns {Promise<HttpResponse>}
 */
async function pullJsonConfig(uid, http_api) {
    http_api += "?uid=" + uid
    const res = await http.request("GET", http_api
        // , JSON.stringify({"Content-Type": "application/json"})
    )
    log.debug(`[{0}]res=>{1}`, 'next', JSON.stringify(res))
    if (res.status_code === 200 && res.body) {
        let result_json = JSON.parse(res.body);
        if (result_json?.code === 200) {
            return result_json?.data
        }
        throw new Error("请求失败,error:" + result_json?.message)
    }
    // return undefined
}

/**
 * 推送全部Json数据
 * @param Json
 * @param http_api
 * @returns {Promise<HttpResponse>}
 */
async function pushAllJsonConfig(list = [], http_api,token={name: "Authorization", value: ''}) {
    log.info(`list:{1},http:{2}`, list, http_api)
    let value = {
        "Content-Type": "application/json",
        [token.name]: token.value
    };

    const res = await http.request("POST", http_api, JSON.stringify({json: JSON.stringify(list)}), JSON.stringify(value))

    log.debug(`[{0}]res=>{1}`, 'next', JSON.stringify(res))
    if (res.status_code === 200 && res.body) {
        let result_json = JSON.parse(res.body);
        if (result_json?.code === 200) {
            return result_json?.data
        }
        throw new Error("请求失败,error:" + result_json?.message)
    }
    // return undefined
}

/**
 * 推送全部国家Json数据
 * @param list
 * @param http_api
 * @param token
 * @returns {Promise<undefined|*>}
 */
async function pushAllCountryConfig(list = [], http_api,token={name: "Authorization", value: ''}) {
    log.info(`list:{1},http:{2}`, list, http_api)
    let value = {
        "Content-Type": "application/json",
        [token.name]: token.value
    };

    const res = await http.request("POST", http_api, JSON.stringify({json: JSON.stringify(list)}), JSON.stringify(value))

    log.debug(`[{0}]res=>{1}`, 'next', JSON.stringify(res))
    if (res.status_code === 200 && res.body) {
        let result_json = JSON.parse(res.body);
        if (result_json?.code === 200) {
            return result_json?.data
        }
        throw new Error("请求失败,error:" + result_json?.message)
    }
    return undefined
}
export {
    pullJsonConfig,
    pushAllJsonConfig,
    pushAllCountryConfig
}