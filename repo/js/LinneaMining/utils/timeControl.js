/**
 * 根据目标运行分钟数计算截止时间戳
 *
 * @param {number|string|null} targetMinutes - 目标运行分钟数
 * @returns {number|null} 截止时间戳，未设置返回 null
 */
function parseRunTimeLimit(targetMinutes) {
  if (!targetMinutes) return null
      const minutes = Number(targetMinutes)
      if (isNaN(minutes) || minutes <= 0) {
        log.warn(`无效的运行时长设置: ${targetMinutes}`)
        return null
      }
    return Date.now() + minutes * 60 * 1000
}

/**
 * 检查是否已到达运行截止时间
 *
 * @param {number|null} runUntilTime - 截止时间戳
 * @returns {boolean}
 */
function isTimeUp(runUntilTime) {
  return runUntilTime !== null && Date.now() >= runUntilTime
}

export {
  parseRunTimeLimit,
  isTimeUp
}
