/**
 * 语义化版本比对，判断当前版本是否满足最低要求
 * 支持带预发布标识的版本号（如 0.60.2-alpha.2）
 * 规则：前缀相同时，有预发布标识的版本 < 无预发布标识的版本
 *
 * @param {string} version - 当前版本号
 * @param {string} minVersion - 最低要求版本号
 * @returns {boolean} 当前版本是否 >= 最低要求版本
 */
function checkVersion(version, minVersion) {
  const re = /^(\d+)\.(\d+)\.(\d+)(?:[-.](.+))?$/

  const pick = (/** @type {string} */ v, /** @type {number} */ i) => Number(v.match(re)?.[i] ?? 0)
  const pre = (/** @type {string} */ v) => v.match(re)?.[4] ?? null

  for (const i of [1, 2, 3]) {
    if (pick(version, i) > pick(minVersion, i)) return true
    if (pick(version, i) < pick(minVersion, i)) return false
  }

  const a = pre(version), b = pre(minVersion)
  if (a === null && b === null) return true
  if (a === null) return true
  if (b === null) return false

  return a >= b
}

export { checkVersion }
