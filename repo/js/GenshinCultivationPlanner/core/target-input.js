/**
 * 解析 BetterGI 设置页中的简洁目标文本。
 * 支持中文/英文标点、全角箭头和换行，例如：
 * 申鹤：70＞90，6／8／8＞9／9／9；和璞鸢:70>90
 */
export function parseTargetText(input, rulebook) {
  const text = normalizeText(input);
  if (!text) throw new Error('未填写角色或武器目标');

  const seenNames = new Set();
  return text.split(';').filter(Boolean).map((entry, index) => {
    const [name, specification, ...extra] = entry.split(':');
    const label = `第 ${index + 1} 项“${entry}”`;
    if (!name || !specification || extra.length > 0) {
      throw new Error(`${label}格式错误，应为“名称:当前等级>目标等级[,普攻/战技/爆发当前>目标]”`);
    }
    if (seenNames.has(name)) throw new Error(`${label}与前面目标重复：${name}`);
    seenNames.add(name);

    const parts = specification.split(',');
    if (parts.length > 2 || parts.some((part) => !part)) {
      throw new Error(`${label}的等级或天赋格式错误`);
    }
    const level = parseRange(parts[0], `${label}的等级`, 90);
    const isCharacter = Boolean(rulebook.characters?.[name]);
    const isWeapon = Boolean(rulebook.weapons?.[name]);
    if (!isCharacter && !isWeapon) {
      throw new Error(`${label}的名称“${name}”不在当前规则库中，请使用游戏内中文名称`);
    }
    if (isCharacter && isWeapon) throw new Error(`${label}的名称“${name}”同时匹配角色和武器，无法判定`);
    if (isWeapon) {
      if (parts.length !== 1) throw new Error(`武器“${name}”不能填写天赋等级`);
      return { kind: 'weapon', name, level };
    }

    const target = { kind: 'character', name, level };
    if (parts.length === 2) target.talents = parseTalents(parts[1], label);
    return target;
  });
}

function normalizeText(input) {
  return String(input ?? '')
    .replace(/[；\n\r]+/g, ';')
    .replace(/[：]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/[＞→]/g, '>')
    .replace(/[／]/g, '/')
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .replace(/^;+|;+$/g, '');
}

function parseRange(value, label, max) {
  const match = /^(\d{1,2})>(\d{1,2})$/.exec(value);
  if (!match) throw new Error(`${label}格式错误，应为“当前>目标”`);
  const current = Number(match[1]);
  const target = Number(match[2]);
  if (current < 1 || target > max || current > target) {
    throw new Error(`${label}无效：当前等级须不低于 1，目标不高于 ${max}，且不能倒退`);
  }
  return { current, target };
}

function parseTalents(value, label) {
  const [currentText, targetText, ...extra] = value.split('>');
  if (!currentText || !targetText || extra.length > 0) {
    throw new Error(`${label}的天赋格式错误，应为“普攻/战技/爆发当前>普攻/战技/爆发目标”`);
  }
  const current = currentText.split('/');
  const target = targetText.split('/');
  if (current.length !== 3 || target.length !== 3) {
    throw new Error(`${label}必须填写三项天赋等级`);
  }
  const names = ['normal', 'skill', 'burst'];
  return Object.fromEntries(names.map((name, index) => [name, parseRange(
    `${current[index]}>${target[index]}`,
    `${label}的${['普攻', '战技', '爆发'][index]}`,
    10,
  )]));
}
