/**
 * 位置工具模块
 * 距离计算、投票定位等位置相关工具
 */
import { isCancellationError } from "../utils/error-utils.js";

/**
 * 计算两点之间的欧几里得距离
 * 
 * @param {Object} point1 - 点1坐标 { X, Y } 或 { x, y }
 * @param {Object} point2 - 点2坐标 { X, Y } 或 { x, y }
 * @returns {number} 两点间距离，无效数据返回 Infinity
 */
export function calculateDistance(point1, point2) {
    if (!point1 || !point2) return Infinity;
    const x1 = point1.X || point1.x;
    const y1 = point1.Y || point1.y;
    const x2 = point2.X || point2.x;
    const y2 = point2.Y || point2.y;
    if (typeof x1 !== "number" || typeof y1 !== "number" || typeof x2 !== "number" || typeof y2 !== "number") {
        return Infinity;
    }
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

/**
 * 使用投票机制获取最可靠的地图位置
 * 
 * 通过多次识别不同缩放级别的地图坐标，使用聚类投票算法选出最可信的位置
 * 
 * 算法流程：
 * 1. 从2.0倍缩放开始，每次增加0.3，目标3次成功识别（每次失败会追加一次识别）
 * 2. 每次识别后将坐标加入位置列表
 * 3. 对所有位置进行聚类：距离小于5像素的点归为同一簇
 * 4. 选择点数最多的簇的第一个位置作为最终结果
 *
 * @returns {Promise<Object>} 位置对象 { x, y }
 * @throws {Error} 无法从大地图中识别位置时抛出异常
 */
export async function getPositionWithVoting() {
    let scale = 2.0;
    const positions = [];

    while (positions.length < 3 && scale <= 5.0) {
        try {
            await genshin.setBigMapZoomLevel(scale);
            await sleep(100);
            const position = genshin.getPositionFromBigMap();
            positions.push(position);
        } catch (error) {
            if (isCancellationError(error)) { throw error; }
            log.debug('缩放:{0}, error:{1}', scale, error.message);
        }
        scale += 0.3;
        await sleep(1);
    }

    if (positions.length > 0) {
        // 聚类算法：将距离小于5像素的点归为同一簇
        const clusters = [];
        for (const pos of positions) {
            let added = false;
            for (const cluster of clusters) {
                const distance = Math.sqrt(Math.pow(cluster[0].x - pos.x, 2) + Math.pow(cluster[0].y - pos.y, 2));
                if (distance < 5) { cluster.push(pos); added = true; break; }
            }
            if (!added) clusters.push([pos]);
        }
    
        // 选择点数最多的簇
        clusters.sort((a, b) => b.length - a.length);
        if (clusters.length > 0) {
            const bestPosition = clusters[0][0];
            log.debug('位置识别成功: ({x}, {y})', Math.round(bestPosition.x), Math.round(bestPosition.y));
            return bestPosition;
        }
    }
    throw new Error('无法从大地图中识别位置');
}

/**
 * 从路径追踪文件获取目标坐标
 * 
 * 读取 _path.json 文件，提取最后一个路径点的坐标
 * 用于战斗委托流程的距离匹配
 * 
 * @param {string} scriptPath - 路径追踪文件路径（_path.json）
 * @returns {Promise<Object|null>} 目标坐标 { x, y }，失败返回null
 */
export async function getCommissionTargetPosition(scriptPath) {
    try {
        const scriptContent = file.readTextSync(scriptPath);
        const pathData = JSON.parse(scriptContent);
        if (!pathData.positions || pathData.positions.length === 0) {
            log.warn("路径追踪文件 {path} 中没有有效的坐标数据", scriptPath);
            return null;
        }
        const lastPosition = pathData.positions[pathData.positions.length - 1];
        if (!lastPosition.x || !lastPosition.y) {
            log.warn("路径追踪文件 {path} 的最后一个路径点缺少坐标数据", scriptPath);
            return null;
        }
        log.debug("从脚本路径 {path} 获取到目标坐标: ({x}, {y})",
            scriptPath, Math.round(lastPosition.x), Math.round(lastPosition.y));
        return { x: lastPosition.x, y: lastPosition.y };
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("获取委托目标坐标时出错: {error}", error.message);
        return null;
    }
}
