/**
 * Basic流程匹配器模块
 * 负责扫描Basic委托子目录，读取 _path.json 获取目标坐标，计算距离并匹配最近的流程
 */
import { calculateDistance, getCommissionTargetPosition } from "../navigation/index.js";
import { buildProcessBasePath } from "../loaders/process-scope.js";
import { parseLocationDir } from "../utils/location-dir.js";

/**
 * 扫描指定目录下的所有子目录
 * @param {string} dirPath - 目录路径
 * @returns {string[]} 子目录路径列表
 */
function scanSubDirectories(dirPath) {
    try {
        const items = Array.from(file.readPathSync(dirPath));
        const subDirs = [];

        for (const item of items) {
            if (file.isFolder(item)) {
                subDirs.push(item);
            }
        }

        return subDirs;
    } catch (error) {
        log.warn("扫描目录失败: {path}, 错误: {error}", dirPath, error.message);
        return [];
    }
}

/**
 * 匹配最近的Basic委托流程
 * @param {string} commissionName - 委托名
 * @param {string} location - 地点
 * @param {Object} commissionPosition - 委托坐标 {x, y}
 * @returns {Promise<{processPath: string, processDir: string, distance: number}|null>}
 */
export async function findNearestBasicProcess(commissionName, location, commissionPosition, country = "蒙德") {
    const baseDir = `${buildProcessBasePath(country, "BASIC")}/${commissionName}`;
    const subDirs = scanSubDirectories(baseDir);

    const matchedDirs = subDirs.filter(dir => {
        const dirName = dir.split('/').pop().split('\\').pop();
        return parseLocationDir(dirName).location === location;
    });

    if (matchedDirs.length === 0) {
        log.warn("未找到委托 {name} 在 {location} 的子目录", commissionName, location);
        return null;
    }

    // 读取每个目录的 _path.json，计算距离
    let nearest = null;
    let minDistance = Infinity;

    for (const dir of matchedDirs) {
        const pathFile = `${dir}/_path.json`;
        try {
            const targetPos = await getCommissionTargetPosition(pathFile);
            if (targetPos) {
                const distance = calculateDistance(commissionPosition, targetPos);

                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = {
                        processPath: `${dir}/process.json`,
                        processDir: dir,
                        distance
                    };
                }
            }
        } catch (error) {
            log.warn("读取 _path.json 失败: {path}, 错误: {error}", pathFile, error.message);
        }
    }

    if (!nearest) {
        log.warn("所有子目录的 _path.json 均无法获取有效坐标");
        return null;
    }

    return nearest;
}
