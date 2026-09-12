import {Http, Log} from "./tools";

/**
 * 接口响应结果封装
 * 结构参考：
 * {
 *   code: 200,          // 状态码，200 表示成功
 *   message: "操作成功", // 提示信息
 *   resultTime: 1788862644334, // 服务器时间戳
 *   data: object        // 具体业务数据
 * }
 */
export class Result{
    /**
     * @param {number} code 状态码
     * @param {string} message 提示信息
     * @param {number} resultTime 服务器时间戳
     * @param {object|null} data 业务数据
     */
    constructor({ code = 0, message = '', resultTime = 0, data = null } = {}) {
        this.code = code;
        this.message = message;
        this.resultTime = resultTime;
        this.data = data;
    }

    /**
     * 判断当前响应是否成功
     * @returns {boolean}
     */
    isSuccess() {
        return this.code === 200;
    }

    /**
     * 从 JSON 字符串或对象创建一个 Result 实例
     * @param {string|object} response 接口返回的 JSON 字符串或已解析的对象
     * @returns {Result}
     */
    static fromJson(response) {
        if (typeof response === 'string') {
            response = JSON.parse(response);
        }
        return new Result(response || {});
    }
}

export class BgiTools {
    /**
     * 获取团队信息
     * @param json
     * @param http_api
     * @param token
     * @returns {id: string,uid: string,team: string,type: string}
     */
    static async getTeam(json={uid:undefined,type:undefined}, http_api, token = {name: "Authorization", value: ''}){
        const headersJson = JSON.stringify({"Content-Type": "application/json", [token.name]: token.value});
        const url = `${http_api}`;
        const  body = await Http.get(url,json, headersJson);
        if (!body) {
            throw new Error("请求失败");
        }
        // 使用 Result 统一解析并判断成功
        const result = Result.fromJson(body);
        if (result.isSuccess()) {
            return result.data;
        } else {
            Log.error("请求失败,error:{error}", result.message);
            throw new Error("请求失败");
        }
    }
}