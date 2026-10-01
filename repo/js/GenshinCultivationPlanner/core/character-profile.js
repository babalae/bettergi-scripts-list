import { parseLevelRange } from './level-state.js';

const PROFILE_MODES = new Set(['自动档案仅预览', '自动档案识别后执行']);
const CULTIVATION_MODE_ALIASES = Object.freeze({
  '培养角色和当前佩戴武器': '培养角色和当前佩戴武器',
  '培养角色和指定武器': '培养角色和指定武器',
  '仅培养角色': '仅培养角色',
  '仅培养指定武器': '仅培养指定武器',
  // 兼容升级前已保存的三种武器处理方式。
  '自动读取当前佩戴武器并培养': '培养角色和当前佩戴武器',
  '手动指定武器': '培养角色和指定武器',
  '不培养武器': '仅培养角色',
});
const NO_CHARACTER_SELECTION = '不选择角色';
const NO_WEAPON_SELECTION = '不选择武器';
const NO_TALENT_TARGET = '不培养';
const LEVEL_LIMITS = new Set([20, 40, 50, 60, 70, 80, 90]);
const TARGET_LIMITS = new Map([
  [20, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 90],
]);

export function isAutomaticProfileMode(settings = {}) {
  return PROFILE_MODES.has(settings.targetInputMode);
}

/** 在操作游戏前校验自动档案设置，并生成读取请求。 */
export function prepareAutomaticProfileRequest(settings, rulebook) {
  if (!isAutomaticProfileMode(settings)) throw new Error('当前不是自动档案模式');
  const cultivationMode = resolveCultivationMode(settings.autoWeaponMode);
  const includesCharacter = cultivationMode !== '仅培养指定武器';
  const usesAutomaticWeapon = cultivationMode === '培养角色和当前佩戴武器';
  const usesManualWeapon = cultivationMode === '培养角色和指定武器'
    || cultivationMode === '仅培养指定武器';
  let characterName = null;
  if (includesCharacter) {
    characterName = String(settings.selectedCharacter ?? '').trim();
    if (!characterName || characterName === NO_CHARACTER_SELECTION) throw new Error('当前培养内容必须选择角色');
    if (!rulebook.characters?.[characterName]) throw new Error(`角色“${characterName}”不在当前规则库中`);
    parseTargetLevel(settings.autoCharacterTargetLevel, '角色目标等级');
    for (const [field, label] of [
      ['autoNormalAttackTargetLevel', '普通攻击目标等级'],
      ['autoElementalSkillTargetLevel', '元素战技目标等级'],
      ['autoElementalBurstTargetLevel', '元素爆发目标等级'],
    ]) parseTalentTarget(settings[field], label);
  }
  if (usesAutomaticWeapon) {
    parseTargetLevel(settings.autoWeaponTargetLevel, '武器目标等级');
  }
  if (usesManualWeapon) validateManualWeaponSettings(settings, rulebook);

  return {
    characterName,
    categories: usesAutomaticWeapon ? '属性;武器;天赋' : includesCharacter ? '属性;天赋' : null,
    requiresProfile: includesCharacter,
    previewOnly: settings.targetInputMode === '自动档案仅预览',
    cultivationMode,
  };
}

/** 调用 BetterGI 档案接口，并转换为可安全序列化的普通对象。 */
export async function readCharacterProfile(service, request, now = new Date()) {
  if (!service || typeof service.GetCharacter !== 'function') {
    throw new Error('当前 BetterGI 未提供 characterDevelopmentTask.GetCharacter()；本脚本仅支持 BetterGI 0.64.0 或更高版本，请升级后重试');
  }
  let raw;
  try {
    raw = await service.GetCharacter(request.characterName, request.categories);
  } catch (error) {
    const message = error?.message ?? String(error);
    const wrapped = new Error(`${message}；若角色、等级、武器或天赋文字识别异常，请确认 BetterGI 已使用 OCR V6 后重试`);
    wrapped.cause = error;
    throw wrapped;
  }
  if (!raw) throw new Error(`BetterGI 未返回角色“${request.characterName}”的档案`);
  return normalizeCharacterProfile(raw, request.characterName, now);
}

/** 把 BetterGI 结果规范化；字段存在性在生成具体目标时按所选模式检查。 */
export function normalizeCharacterProfile(raw, expectedCharacterName, now = new Date()) {
  const characterName = textValue(raw.CharacterName);
  if (!characterName) throw new Error('角色档案缺少 CharacterName');
  if (characterName !== expectedCharacterName) {
    throw new Error(`角色档案返回“${characterName}”，与所选角色“${expectedCharacterName}”不一致`);
  }
  const normalized = {
    characterName,
    elementType: nullableTextValue(raw.ElementType),
    character: {
      level: nullableInteger(raw.Level),
      levelLimit: nullableInteger(raw.LevelLimit),
    },
    weapon: {
      name: nullableTextValue(raw.WeaponName),
      level: nullableInteger(raw.WeaponLevel),
      levelLimit: nullableInteger(raw.WeaponLevelLimit),
    },
    talents: {
      normal: normalizeRawTalent(raw.AttackLevel, raw.AttackHasBonus),
      skill: normalizeRawTalent(raw.SkillLevel, raw.SkillHasBonus),
      burst: normalizeRawTalent(raw.BurstLevel, raw.BurstHasBonus),
    },
    scannedAt: now.toISOString(),
    source: 'BetterGI characterDevelopmentTask.GetCharacter',
  };
  normalized.raw = {
    CharacterName: characterName,
    ElementType: normalized.elementType,
    Level: normalized.character.level,
    LevelLimit: normalized.character.levelLimit,
    WeaponName: normalized.weapon.name,
    WeaponLevel: normalized.weapon.level,
    WeaponLevelLimit: normalized.weapon.levelLimit,
    AttackLevel: normalized.talents.normal.displayLevel,
    AttackHasBonus: normalized.talents.normal.hasBonus,
    SkillLevel: normalized.talents.skill.displayLevel,
    SkillHasBonus: normalized.talents.skill.hasBonus,
    BurstLevel: normalized.talents.burst.displayLevel,
    BurstHasBonus: normalized.talents.burst.hasBonus,
  };
  return normalized;
}

/** 用规范化档案与用户目标生成现有材料计算器可直接消费的目标。 */
export function buildAutomaticProfileTargets(profile, settings, rulebook, request = null, profileError = null) {
  const targets = [];
  const targetOutcomes = [];
  const summary = [];
  const cultivationMode = request?.cultivationMode ?? resolveCultivationMode(settings.autoWeaponMode);
  const includesCharacter = cultivationMode !== '仅培养指定武器';
  if (includesCharacter) {
    if (profileError || !profile) {
      const message = profileError?.message ?? '未读取到角色档案';
      targetOutcomes.push({ kind: 'character', component: 'profile', status: 'failed', name: request?.characterName ?? null, message });
      summary.push(`角色 ${request?.characterName ?? '未确认'}：档案读取失败（${message}）`);
    } else {
      const generatedCharacter = buildCharacterTarget(profile, settings);
      if (generatedCharacter.target) targets.push(generatedCharacter.target);
      targetOutcomes.push(...generatedCharacter.outcomes);
      summary.push(...generatedCharacter.summary);
    }
  }

  let ignoredWeaponReason = null;
  if (cultivationMode === '培养角色和当前佩戴武器') {
    const weaponName = profile.weapon.name;
    try {
      if (!weaponName) throw new Error('BetterGI 档案未返回当前佩戴武器名称');
      const weaponRule = rulebook.weapons?.[weaponName];
      if (!weaponRule) throw new Error(`当前佩戴武器“${weaponName}”不在规则库中，不能猜测培养材料`);
      if (weaponRule.rarity === 1) {
        ignoredWeaponReason = `当前佩戴的是一星初始武器“${weaponName}”，已按规则忽略武器培养`;
        targetOutcomes.push({ kind: 'weapon', component: 'level', status: 'skipped', name: weaponName, message: ignoredWeaponReason });
        summary.push(`武器 ${weaponName}：一星初始武器，已忽略`);
      } else {
        const current = requireProgress(profile.weapon, '武器等级');
        const target = buildTargetProgress(settings.autoWeaponTargetLevel, '武器目标等级');
        const pending = compareProgress(current, target) < 0;
        targetOutcomes.push({
          kind: 'weapon', component: 'level', status: pending ? 'pending' : 'completed', name: weaponName,
          current, target, message: pending ? '需要培养' : '当前进度已达到或超过目标',
        });
        summary.push(`武器 ${weaponName}：${formatProgress(current.level, current.levelLimit)} → ${formatProgress(target.level, target.levelLimit)}${pending ? '' : '（已达到，跳过）'}`);
        if (pending) {
          targets.push({
            kind: 'weapon', name: weaponName,
            level: {
              current: current.level, currentLimit: current.levelLimit,
              target: target.level, targetLimit: target.levelLimit,
            },
          });
        }
      }
    } catch (error) {
      const message = error?.message ?? String(error);
      targetOutcomes.push({ kind: 'weapon', component: 'level', status: 'failed', name: weaponName ?? null, message });
      summary.push(`当前佩戴武器：读取失败（${message}）`);
    }
  } else if (cultivationMode === '培养角色和指定武器' || cultivationMode === '仅培养指定武器') {
    const manualTarget = buildManualWeaponTarget(settings, rulebook);
    const pending = compareManualProgress(manualTarget.level) < 0;
    targetOutcomes.push({
      kind: 'weapon', component: 'level', status: pending ? 'pending' : 'completed', name: manualTarget.name,
      current: manualTarget.level.current, target: manualTarget.level.target,
      message: pending ? '需要培养' : '当前进度已达到目标',
    });
    summary.push(`指定武器 ${manualTarget.name}：${formatManualProgress(manualTarget.level, 'current')} → ${formatManualProgress(manualTarget.level, 'target')}${pending ? '' : '（已达到，跳过）'}`);
    if (pending) targets.push(manualTarget);
  }

  return {
    targets,
    targetOutcomes,
    ignoredWeaponReason,
    summary,
  };
}

function buildCharacterTarget(profile, settings) {
  const outcomes = [];
  const summary = [];
  const characterTarget = buildTargetProgress(settings.autoCharacterTargetLevel, '角色目标等级');
  let characterCurrent = null;
  let levelPending = false;
  try {
    characterCurrent = requireProgress(profile.character, '角色等级');
    levelPending = compareProgress(characterCurrent, characterTarget) < 0;
    outcomes.push({
      kind: 'character', component: 'level', status: levelPending ? 'pending' : 'completed', name: profile.characterName,
      current: characterCurrent, target: characterTarget,
      message: levelPending ? '需要培养' : '当前进度已达到或超过目标',
    });
    summary.push(`角色 ${profile.characterName}：${formatProgress(characterCurrent.level, characterCurrent.levelLimit)} → ${formatProgress(characterTarget.level, characterTarget.levelLimit)}${levelPending ? '' : '（已达到，跳过等级）'}`);
  } catch (error) {
    const message = error?.message ?? String(error);
    outcomes.push({ kind: 'character', component: 'level', status: 'failed', name: profile.characterName, message });
    summary.push(`角色 ${profile.characterName}：等级读取失败（${message}）`);
  }

  const talents = {};
  const talentSummaries = [];
  const talentSettings = [
    ['normal', 'autoNormalAttackTargetLevel', '普通攻击', '普攻'],
    ['skill', 'autoElementalSkillTargetLevel', '元素战技', '战技'],
    ['burst', 'autoElementalBurstTargetLevel', '元素爆发', '爆发'],
  ];
  for (const [name, field, label, shortLabel] of talentSettings) {
    const target = parseTalentTarget(settings[field], `${label}目标等级`);
    if (target == null) {
      const current = optionalTalentLevel(profile.talents[name]);
      outcomes.push({ kind: 'character', component: name, status: 'skipped', name: profile.characterName, message: '用户选择不培养' });
      talentSummaries.push(`${shortLabel}${current ?? ''}（不培养）`);
      continue;
    }
    try {
      const current = requireTalentLevel(profile.talents[name], label);
      const pending = target > current;
      outcomes.push({
        kind: 'character', component: name, status: pending ? 'pending' : 'completed', name: profile.characterName,
        current, target, message: pending ? '需要培养' : '当前进度已达到或超过目标',
      });
      talentSummaries.push(`${shortLabel}${current}→${target}${pending ? '' : '（已达到）'}`);
      if (pending) talents[name] = { current, target };
    } catch (error) {
      const message = error?.message ?? String(error);
      outcomes.push({ kind: 'character', component: name, status: 'failed', name: profile.characterName, message });
      talentSummaries.push(`${shortLabel}读取失败`);
    }
  }
  summary.push(`天赋：${talentSummaries.join('，')}`);

  const hasPendingTalent = Object.keys(talents).length > 0;
  if (!levelPending && !hasPendingTalent) return { target: null, outcomes, summary };
  const effectiveCurrent = characterCurrent ?? characterTarget;
  return {
    target: {
      kind: 'character', name: profile.characterName,
      level: levelPending ? {
        current: characterCurrent.level, currentLimit: characterCurrent.levelLimit,
        target: characterTarget.level, targetLimit: characterTarget.levelLimit,
      } : {
        current: effectiveCurrent.level, currentLimit: effectiveCurrent.levelLimit,
        target: effectiveCurrent.level, targetLimit: effectiveCurrent.levelLimit,
      },
      talents,
    },
    outcomes,
    summary,
  };
}

/** 手动目标使用的当前→目标摘要。 */
export function buildTargetSummary(targets = [], extraMessage = null) {
  const lines = [];
  for (const target of targets) {
    const current = formatProgress(target.level?.current, target.level?.currentLimit);
    const desired = formatProgress(target.level?.target, target.level?.targetLimit);
    if (target.kind === 'character') {
      lines.push(`角色 ${target.name}：${current} → ${desired}`);
      const talents = [
        ['normal', '普攻'], ['skill', '战技'], ['burst', '爆发'],
      ].filter(([key]) => target.talents?.[key])
        .map(([key, label]) => `${label}${target.talents[key].current}→${target.talents[key].target}`);
      if (talents.length > 0) lines.push(`天赋：${talents.join('，')}`);
    } else if (target.kind === 'weapon') {
      lines.push(`武器 ${target.name}：${current} → ${desired}`);
    }
  }
  if (extraMessage) lines.push(extraMessage);
  return lines;
}

function validateManualWeaponSettings(settings, rulebook) {
  const name = String(settings.selectedWeapon ?? '').trim();
  if (!name || name === NO_WEAPON_SELECTION) throw new Error('手动指定武器模式必须选择武器');
  if (!rulebook.weapons?.[name]) throw new Error(`武器“${name}”不在当前规则库中`);
  parseManualRange(settings.weaponLevelRange, `武器“${name}”等级`);
}

function buildManualWeaponTarget(settings, rulebook) {
  validateManualWeaponSettings(settings, rulebook);
  const name = String(settings.selectedWeapon).trim();
  return { kind: 'weapon', name, level: parseManualRange(settings.weaponLevelRange, `武器“${name}”等级`) };
}

function normalizeRawTalent(displayLevel, hasBonus) {
  return {
    displayLevel: nullableInteger(displayLevel),
    hasBonus: typeof hasBonus === 'boolean' ? hasBonus : null,
  };
}

function requireTalentLevel(talent, label) {
  if (!Number.isInteger(talent?.displayLevel) || typeof talent?.hasBonus !== 'boolean') {
    throw new Error(`${label}档案字段不完整；请确认 OCR V6 后重新识别`);
  }
  const level = talent.displayLevel - (talent.hasBonus ? 3 : 0);
  if (level < 1 || level > 10) {
    throw new Error(`${label}命座加成还原后的实际等级无效：界面 ${talent.displayLevel}，HasBonus=${talent.hasBonus}`);
  }
  return level;
}

function optionalTalentLevel(talent) {
  if (!Number.isInteger(talent?.displayLevel) || typeof talent?.hasBonus !== 'boolean') return null;
  const level = talent.displayLevel - (talent.hasBonus ? 3 : 0);
  return level >= 1 && level <= 10 ? level : null;
}

function requireProgress(value, label) {
  const level = value?.level;
  const levelLimit = value?.levelLimit;
  if (!Number.isInteger(level) || !Number.isInteger(levelLimit)) {
    throw new Error(`${label}档案字段不完整；请确认 OCR V6 后重新识别`);
  }
  if (level < 1 || level > 90 || !LEVEL_LIMITS.has(levelLimit) || level > levelLimit) {
    throw new Error(`${label}档案无效：${level}/${levelLimit}`);
  }
  return { level, levelLimit };
}

function buildTargetProgress(value, label) {
  const level = parseTargetLevel(value, label);
  return { level, levelLimit: TARGET_LIMITS.get(level) };
}

function compareProgress(current, target) {
  if (current.level !== target.level) return current.level - target.level;
  return current.levelLimit - target.levelLimit;
}

function compareManualProgress(progress) {
  if (progress.current !== progress.target) return progress.current - progress.target;
  return Number(progress.currentAscended) - Number(progress.targetAscended);
}

function formatManualProgress(progress, prefix) {
  const level = progress[prefix];
  const ascended = progress[`${prefix}Ascended`];
  return `${level}${ascended ? '（已突破）' : ''}`;
}

function resolveCultivationMode(value) {
  const label = String(value ?? '培养角色和当前佩戴武器').trim();
  const mode = CULTIVATION_MODE_ALIASES[label];
  if (!mode) throw new Error(`未知的培养内容：“${label}”`);
  return mode;
}

function parseTargetLevel(value, label) {
  const match = String(value ?? '').trim().match(/^(20|40|50|60|70|80|90)(?:\D|$)/);
  if (!match) throw new Error(`${label}无效：“${value ?? ''}”`);
  return Number(match[1]);
}

function parseTalentTarget(value, label) {
  const text = String(value ?? NO_TALENT_TARGET).trim();
  if (!text || text === NO_TALENT_TARGET || text.startsWith('不培养')) return null;
  if (!/^\d{1,2}$/.test(text)) throw new Error(`${label}无效：“${text}”`);
  const target = Number(text);
  if (target < 2 || target > 10) throw new Error(`${label}必须在 2 到 10 级之间，或选择“不培养”`);
  return target;
}

function parseManualRange(value, label) {
  return parseLevelRange(value, label, 90);
}

function formatProgress(level, levelLimit) {
  if (!Number.isInteger(level)) return '未确认';
  return Number.isInteger(levelLimit) ? `${level}/${levelLimit}` : String(level);
}

function textValue(value) {
  const text = String(value ?? '').trim();
  return text;
}

function nullableTextValue(value) {
  const text = textValue(value);
  return text || null;
}

function nullableInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}
