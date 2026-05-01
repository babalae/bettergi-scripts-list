/**
 * 语义化版本比对，判断当前版本是否满足最低要求
 * 支持带预发布标识的版本号（如 0.60.2-alpha.2），自动提取主版本号进行比较
 *
 * @param {string} version - 当前版本号
 * @param {string} minVersion - 最低要求版本号，默认 '0.60.2'
 * @returns {boolean} 当前版本是否 >= 最低要求版本
 */
function checkVersion(version, minVersion = '0.60.2') {
  const normalizeVersion = (v) => {
    const match = String(v).match(/^(\d+\.\d+\.\d+)/)
    return match ? match[1] : '0.0.0'
  }

  const currentParts = normalizeVersion(version).split('.').map(Number)
  const minParts = normalizeVersion(minVersion).split('.').map(Number)

  const maxLength = Math.max(currentParts.length, minParts.length)

  while (currentParts.length < maxLength) currentParts.push(0)
  while (minParts.length < maxLength) minParts.push(0)

  for (let i = 0; i < maxLength; i++) {
    if (currentParts[i] > minParts[i]) return true
    if (currentParts[i] < minParts[i]) return false
  }

  return true
}

export { checkVersion };
