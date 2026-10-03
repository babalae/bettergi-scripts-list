/**
 * Basic 委托子目录命名解析
 *
 * 约定：Basic 委托的子目录命名为 `{location}-{ordinal}` 形式（同地点多条路径时附加序号）
 * NPC 委托的子目录直接以地点名命名，无 -N 后缀
 *
 * 用例：
 *   parseLocationDir("千风神殿-1") → { location: "千风神殿", ordinal: 1 }
 *   parseLocationDir("蒙德城")     → { location: "蒙德城", ordinal: null }
 */

const LOCATION_DIR_RE = /^(.+?)-(\d+)$/;

/**
 * 解析子目录名为 { location, ordinal }
 * @param {string} dirName - 已剥除路径的目录名（basename）
 * @returns {{ location: string, ordinal: number|null }}
 */
export function parseLocationDir(dirName) {
    const m = LOCATION_DIR_RE.exec(dirName);
    if (m) {
        return { location: m[1], ordinal: parseInt(m[2], 10) };
    }
    return { location: dirName, ordinal: null };
}
