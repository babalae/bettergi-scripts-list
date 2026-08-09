/** 将培养目标转换为可写入计划、历史和邮件的统一档案快照。 */
export function buildProfileSnapshot(targets, {
  source = 'manual-settings',
  capturedAt = new Date().toISOString(),
  entries = null,
} = {}) {
  return {
    schemaVersion: 1,
    source,
    capturedAt,
    entries: entries ?? (targets ?? []).map(targetToProfileEntry),
  };
}

/** 邮件、日志共用的单行档案文案。 */
export function formatProfileEntry(entry) {
  if (entry.kind === 'character') {
    const level = `Lv.${entry.level.current}→${entry.level.target}`;
    const talentText = entry.talents
      ? `天赋 ${formatTalentValues(entry.talents, 'current')}→${formatTalentValues(entry.talents, 'target')}${formatTalentBonus(entry.talents)}`
      : '天赋未提供（本次不计算）';
    return `${entry.name} ${level}｜${talentText}`;
  }
  const owner = entry.equippedBy ? `（${entry.equippedBy}佩戴）` : '';
  const ignored = entry.ignored ? `｜${entry.ignoreReason || '已忽略培养'}` : '';
  return `${entry.name}${owner} Lv.${entry.level.current}→${entry.level.target}${ignored}`;
}

function targetToProfileEntry(target) {
  return {
    kind: target.kind,
    name: target.name,
    level: { ...target.level },
    talents: target.talents ? cloneTalents(target.talents) : null,
    equippedBy: target.equippedBy ?? null,
    ignored: target.ignored === true,
    ignoreReason: target.ignoreReason ?? null,
  };
}

function cloneTalents(talents) {
  return Object.fromEntries(Object.entries(talents).map(([name, range]) => [name, { ...range }]));
}

function formatTalentValues(talents, key) {
  return ['normal', 'skill', 'burst'].map((name) => talents[name]?.[key] ?? '-').join('/');
}

function formatTalentBonus(talents) {
  const labels = { normal: '普攻', skill: '战技', burst: '爆发' };
  const boosted = Object.entries(talents)
    .filter(([, value]) => value?.hasBonus === true)
    .map(([name]) => labels[name]);
  return boosted.length > 0 ? `（${boosted.join('、')}含命座+3，已按实际等级计算）` : '';
}
