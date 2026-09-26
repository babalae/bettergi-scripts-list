/**
 * 委托名称/地点标准化模块
 * 使用编辑距离算法将 OCR 识别结果标准化为已知委托名称和地点
 */
import { COMMISSION_TYPE, THRESHOLDS } from "../config/index.js";
import { getClosestMatch } from "./text-similarity.js";
import { loadSupportedCommissions } from "../data/index.js";
import { isCancellationError } from "../utils/error-utils.js";
import { scanCommissionScopes } from "../loaders/process-scope.js";

const referenceData = { basic: {}, npc: {} };

/**
 * 初始化委托名称和地点参考数据
 * 
 * 构建 用于将 OCR 识别的原始文本标准化为已知的委托名称和地点的数据
 * 
 * @param {Object} [supportedCommissions] - 支持的委托列表
 * @param {string[]} [supportedCommissions.basic] - Basic 委托名称列表，不传则从数据源加载
 * @param {string[]} [supportedCommissions.npc] - NPC 委托名称列表，不传则从数据源加载
 * @param {Array} [commissionScopes] - 可复用的流程范围快照；不传时扫描一次流程目录
 */
export async function initReferenceData(supportedCommissions, commissionScopes) {
    try {
        const scopes = commissionScopes ?? scanCommissionScopes().list;
        if (!supportedCommissions) {
            supportedCommissions = await loadSupportedCommissions(scopes);
        }
        referenceData.basic = await buildBasicReferenceMap(supportedCommissions.basic, scopes);
        referenceData.npc = await buildNpcReferenceMap(supportedCommissions.npc, scopes);
        log.debug("Basic委托参考数据: {count} 个委托", Object.keys(referenceData.basic).length);
        log.debug("NPC委托参考数据: {count} 个委托", Object.keys(referenceData.npc).length);
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("初始化委托参考数据时出错: {error}", error.message);
    }
}

/**
 * 将一个国家和地点加入指定委托的参考数据，并保持列表去重。
 */
function addReferenceLocation(target, commissionName, country, location) {
    if (!target[commissionName]) {
        target[commissionName] = { all: [], countries: {} };
    }

    if (!target[commissionName].all.includes(location)) {
        target[commissionName].all.push(location);
    }

    if (!Array.isArray(target[commissionName].countries[country])) {
        target[commissionName].countries[country] = [];
    }
    if (!target[commissionName].countries[country].includes(location)) {
        target[commissionName].countries[country].push(location);
    }
}

/**
 * 根据单次目录快照构建 Basic 委托参考数据。
 * @param {string[]} basicCommissions - 已启用的 Basic 委托名称
 * @param {Array} scopes - 本次识别复用的流程范围快照
 * @returns {Promise<Object>} Basic 委托名称到地点信息的映射表
 */
async function buildBasicReferenceMap(basicCommissions, scopes) {
    const basicList = {};
    try {
        const supported = new Set(basicCommissions);
        for (const scope of scopes) {
            if (scope.type !== COMMISSION_TYPE.BASIC || !supported.has(scope.commissionName)) {
                continue;
            }
            addReferenceLocation(basicList, scope.commissionName, scope.country, scope.location);
        }
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("构建Basic委托参考数据时出错: {error}", error.message);
    }
    return basicList;
}

/**
 * 构建NPC委托名称到地点列表的映射表
 * 
 * @param {string[]} npcCommissions - NPC 委托名称列表
 * @param {Array} scopes - 本次识别复用的流程范围快照
 * @returns {Object} NPC 委托名称到地点列表的映射表，格式为 { "委托名": ["地点1", "地点2", ...] }
 */
async function buildNpcReferenceMap(npcCommissions, scopes) {
    const npcList = {};
    try {
        const supported = new Set(npcCommissions);
        for (const scope of scopes) {
            if (scope.type !== COMMISSION_TYPE.NPC || !supported.has(scope.commissionName)) {
                continue;
            }
            addReferenceLocation(npcList, scope.commissionName, scope.country, scope.location);
        }
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("构建NPC委托参考数据时出错: {error}", error.message);
    }
    return npcList;
}

/**
 * 标准化委托名称
 * 
 * 使用编辑距离算法将 OCR 识别的原始名称与已知委托列表进行模糊匹配，
 * 找到最接近的已知委托名称作为标准化结果。
 *
 * @param {string} rawName - OCR 识别的原始委托名称，可能包含识别错误
 * @returns {Promise<string>} 标准化后的委托名称，如果未找到匹配或相似度低于阈值则返回原始名称
 */
export function standardizeCommissionName(rawName) {
    const allNames = [...Object.keys(referenceData.basic), ...Object.keys(referenceData.npc)];
    const match = getClosestMatch(rawName, allNames, THRESHOLDS.COMMISSION_NAME);
    if (match && match !== rawName) {
        log.debug('委托名称标准化: {raw} -> {standard}', rawName, match);
    }
    return match || rawName;
}

/**
 * 标准化委托地点
 * 
 * 根据已知委托名称和对应的地点列表，使用编辑距离算法将 OCR 识别的原始地点标准化为已知地点。
 * 
 * @param {string} commissionName - 标准化后的委托名称（已通过 standardizeCommissionName 处理）
 * @param {string} rawLocation - OCR 识别的原始地点名称，可能包含识别错误
 * @returns {string} 标准化后的地点名称，如果未找到匹配或相似度低于阈值则返回原始地点
 */
export function standardizeCommissionLocation(commissionName, rawLocation, country = "") {
    let entry = null;
    if (referenceData.basic[commissionName]) {
        entry = referenceData.basic[commissionName];
    } else if (referenceData.npc[commissionName]) {
        entry = referenceData.npc[commissionName];
    }

    const candidates = entry?.countries?.[country]?.length
        ? entry.countries[country]
        : (entry?.all || []);

    if (candidates.length === 0) {
        log.warn("没有找到委托 {name} 的参考地点列表", commissionName);
        return rawLocation;
    }
    const closestLocation = getClosestMatch(rawLocation, candidates, THRESHOLDS.LOCATION);
    if (closestLocation && closestLocation !== rawLocation) {
        log.debug('地点标准化: {raw} -> {standard}', rawLocation, closestLocation);
    }
    if (closestLocation) {
        return closestLocation;
    }
    log.warn("地点相似度未达阈值，保持原地点: {raw}", rawLocation);
    return rawLocation;
}
