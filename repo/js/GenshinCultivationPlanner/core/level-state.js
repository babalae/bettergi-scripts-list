export const ASCENSION_LEVELS = Object.freeze([20, 40, 50, 60, 70, 80]);

export function isAscensionLevel(level) {
  return ASCENSION_LEVELS.includes(Number(level));
}

/** 解析“80”“80前”“80级（突破后）”等等级写法。 */
export function parseLevelToken(value, label, max = 90, defaultAscended = false) {
  const text = String(value ?? '').trim();
  const normalized = text
    .replace(/[（(]\s*(?:已)?突破前\s*[）)]/g, '前')
    .replace(/[（(]\s*(?:已)?突破后\s*[）)]/g, '后')
    .replace(/级/g, '')
    .replace(/突破前/g, '前')
    .replace(/(?:已)?突破后/g, '后')
    .replace(/\s+/g, '');
  const match = /^(\d{1,2})(前|后)?$/.exec(normalized);
  if (!match) throw new Error(`${label}格式错误：“${text}”`);
  const level = Number(match[1]);
  if (!Number.isInteger(level) || level < 1 || level > max) throw new Error(`${label}必须是 1 到 ${max} 级`);
  if (match[2] && !isAscensionLevel(level)) throw new Error(`${label}的 ${level} 级不是突破临界等级，不能标记突破前后`);
  return {
    level,
    ascended: match[2] === '后' || (!match[2] && defaultAscended && isAscensionLevel(level)),
  };
}

export function parseLevelRange(value, label, max = 90) {
  const text = String(value ?? '').trim().replace(/[＞→]/g, '>');
  const parts = text.split('>');
  if (parts.length !== 2 || parts.some((part) => !part.trim())) {
    throw new Error(`${label}格式错误，应为“当前等级>目标等级”`);
  }
  const current = parseLevelToken(parts[0], `${label}当前等级`, max);
  const target = parseLevelToken(parts[1], `${label}目标等级`, max);
  if (current.level > target.level
    || (current.level === target.level && current.ascended && !target.ascended)) {
    throw new Error(`${label}不能倒退`);
  }
  return {
    current: current.level,
    target: target.level,
    currentAscended: current.ascended,
    targetAscended: target.ascended,
  };
}
