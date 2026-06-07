export class BgiTools {
    /**
     * 推送所有国家配置信息到服务器
     * @param {Array} list - 国家配置列表，默认为空数组
     * @param {Object} http_api - HTTP API请求对象
     * @param {Object} token - 认证令牌对象，包含name和value属性，默认为{name: "Authorization", value: ''}
     * @returns {Object|undefined} 返回成功响应的数据，如果请求失败则抛出错误或返回undefined
     */
    static async pushAllCountryConfig(list = [], http_api, token = {name: "Authorization", value: ''}) {
        // 记录请求参数日志
        log.info(`list:{1},http:{2}`, list, http_api)
        // 设置请求头信息
        let value = {
            "Content-Type": "application/json",  // 设置内容类型为JSON
            [token.name]: token.value            // 设置认证令牌
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

    /**
     * 批量推送JSON配置的异步函数
     * @param {Array} list - 要推送的配置列表，默认为空数组
     * @param {string} http_api - HTTP API的URL
     * @param {Object} token - 认证令牌对象，包含name和value属性
     * @returns {Promise<any>} 返回解析后的响应数据
     * @throws {Error} 当请求失败或响应状态码非200时抛出错误
     */
    static async pushAllJsonConfig(list = [], http_api, token = {name: "Authorization", value: ''}) {
        // 记录请求信息，包括列表内容和API地址
        log.info(`list:{1},http:{2}`, list, http_api)
        // 设置请求头，包括Content-Type和认证信息
        let value = {
            "Content-Type": "application/json",
            [token.name]: token.value
        };

        // 发送POST请求，将列表转换为JSON字符串后作为参数
        const res = await http.request("POST", http_api, JSON.stringify({json: JSON.stringify(list)}), JSON.stringify(value))

        // 记录响应详情
        log.debug(`[{0}]res=>{1}`, 'next', JSON.stringify(res))
        // 检查响应状态码和响应体
        if (res.status_code === 200 && res.body) {
            // 解析响应体JSON
            let result_json = JSON.parse(res.body);
            // 检查响应状态码是否为200
            if (result_json?.code === 200) {
                // 返回响应数据
                return result_json?.data
            }
            // 抛出错误信息
            throw new Error("请求失败,error:" + result_json?.message)
        }
        // 如果响应状态码不是200或没有响应体，则返回undefined（已注释）
        // return undefined
    }

    /**
     * 静态异步方法，用于拉取JSON格式的配置信息
     * @param {string} http_api - API请求的基础URL
     * @param {string|number} uid - 用户ID，用于请求参数
     * @returns {Promise<any>} 返回解析后的JSON数据
     * @throws {Error} 当请求失败或返回状态码不为200时抛出错误
     */
    static async pullJsonConfig(http_api, uid) {
        // 构建完整的API URL，添加uid和enable参数
        http_api += "?uid=" + uid + "&enable=" + true

        // 发送GET请求获取配置信息
        // 注释掉的代码原本用于设置请求头Content-Type为application/json
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

}