/**
 * NPC 委托流程文件加载器
 * 从 process/{国家}/NPC/{name}/{location}/{file} 读取并解析流程
 */
import { COMMISSION_TYPE } from "../config/index.js";
import { buildProcessBasePath } from "./process-scope.js";

/**
 * 读取并解析 NPC 流程文件
 * @param {string} commissionName - 委托名称
 * @param {string} location - 委托地点
 * @param {string} processFileName - 流程文件名，默认为 "process.json"
 * @param {string} [country="蒙德"] - 委托国家
 * @returns {Promise<Array|null>} 步骤数组，失败返回 null
 */
export async function loadNpcProcessFile(commissionName, location, processFileName = "process.json", country = "蒙德") {
    const processFilePath = buildProcessBasePath(country, COMMISSION_TYPE.NPC) + "/" + commissionName + "/" + location + "/" + processFileName;
    try {
        const processContent = file.readTextSync(processFilePath);
        const jsonData = JSON.parse(processContent);
        if (Array.isArray(jsonData)) {
            return jsonData;
        }
        log.error("NPC委托 {name} 在 {location} 的流程文件格式错误（应为数组）: {path}", commissionName, location, processFilePath);
        return null;
    } catch (error) {
        log.error("NPC委托 {name} 在 {location} 的流程文件解析错误: {path}", commissionName, location, processFilePath);
        return null;
    }
}
