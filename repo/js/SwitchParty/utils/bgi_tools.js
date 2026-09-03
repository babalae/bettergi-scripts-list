import {Http, Log} from "./tools";

export class BgiTools {
    /**
     * 获取团队信息
     * @param json
     * @param http_api
     * @param token
     * @returns {id: string,uid: string,team: string,type: string}
     */
    static async getTeam(json={uid:undefined,type:undefined}, http_api, token = {name: "Authorization", value: ''}){
        // 将 json 对象转换为 Map
        const paramsMap = new Map(Object.entries(json));
        // 遍历 Map 构造查询参数
        let queryString = '';
        paramsMap.forEach((value, key) => {
            if (value !== undefined) {
                queryString += `${key}=${value}&`;
            }
        });
        // 去掉末尾多余的 &
        queryString = queryString.slice(0, -1);
        let result = {id: undefined, uid: undefined, team: undefined, type: undefined};
        const headersJson = JSON.stringify({"Content-Type": "application/json", [token.name]: token.value});
        const url = `${http_api}?${queryString}`;
        const {status_code, body} = Http.get(url, headersJson);
        if (status_code !== 200) {
            Log.error(`请求失败, HTTP状态码: {status_code}, 响应: {body}`,status_code,JSON.stringify(body));
            return result
        }
        const { code, message, data } = body;
        if (code === 200){
            return data;
        }else {
            Log.error("请求失败,error:{error}", message)
            return result
        }
    }
}