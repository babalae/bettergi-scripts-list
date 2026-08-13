const ARTIFACT_TEST_PREFIX = '单次｜';
const ARTIFACT_FORMAL_PREFIX = '正式｜';
const NO_CHARACTER_SELECTION = '不选择角色';
const NO_TALENT_SELECTION = '不计算天赋材料';
const NO_WEAPON_SELECTION = '不选择武器';
const NO_BOSS_OVERRIDE = '不配置专属 Boss';
const BOSS_OVERRIDE_SLOT_COUNT = 3;
const BOSS_OVERRIDE_ACTIONS = new Set(['继承通用配置', '启用', '禁用']);
const SPLIT_TALENT_FIELDS = [
  ['characterNormalAttackRange', '不培养普通攻击', '普通攻击'],
  ['characterElementalSkillRange', '不培养元素战技', '元素战技'],
  ['characterElementalBurstRange', '不培养元素爆发', '元素爆发'],
];

/** 将紧凑设置页的模式值转换为现有执行器使用的兼容字段。 */
export function normalizeScriptSettings(rawSettings = {}) {
  const normalized = { ...rawSettings };

  applyTargetSelections(normalized, rawSettings);
  applyRouteModes(normalized, rawSettings);
  applyDomainMode(normalized, rawSettings.domainRunMode);
  applyBossMode(normalized, rawSettings.bossRunMode);
  applyArtifactMode(normalized, rawSettings.artifactRunMode);
  applyResinStrategy(normalized, rawSettings.resinStrategy);
  applyBossOverrides(normalized, rawSettings);

  return normalized;
}

/** 将三组结构化 Boss 覆盖转换为执行器使用的名称索引。 */
function applyBossOverrides(settings, rawSettings) {
  const result = {};
  let hasStructuredSetting = false;
  for (let index = 1; index <= BOSS_OVERRIDE_SLOT_COUNT; index += 1) {
    const nameField = `bossOverride${index}Name`;
    const actionField = `bossOverride${index}Action`;
    const partyField = `bossOverride${index}TeamName`;
    const strategyField = `bossOverride${index}StrategyName`;
    const fields = [nameField, actionField, partyField, strategyField];
    if (!fields.some((field) => rawSettings[field] !== undefined)) continue;
    hasStructuredSetting = true;

    const bossName = String(rawSettings[nameField] ?? '').trim();
    const action = String(rawSettings[actionField] ?? '继承通用配置').trim();
    const partyName = String(rawSettings[partyField] ?? '').trim();
    const strategyName = String(rawSettings[strategyField] ?? '').trim();
    if (!BOSS_OVERRIDE_ACTIONS.has(action)) {
      throw new Error(`Boss 专属配置 ${index} 的处理方式无效：“${action}”`);
    }
    if (!bossName || bossName === NO_BOSS_OVERRIDE) {
      if (action !== '继承通用配置' || partyName || strategyName) {
        throw new Error(`Boss 专属配置 ${index} 已填写队伍、策略或处理方式，但没有选择 Boss`);
      }
      continue;
    }
    if (result[bossName]) throw new Error(`Boss 专属配置重复：“${bossName}”`);

    const override = {};
    if (action !== '继承通用配置') override.enabled = action === '启用';
    if (partyName) override.partyName = partyName;
    if (strategyName) override.strategyName = strategyName;
    result[bossName] = override;
  }
  if (hasStructuredSetting) settings.bossOverrides = result;
}

/** 发布版只支持实际执行；未显式确认时必须在任何读写或游戏操作前终止。 */
export function assertExecutionConfirmed(settings = {}) {
  const value = settings.executionConfirmed;
  const confirmed = value === true || value === 1 || value === 'true' || value === '1';
  if (!confirmed) {
    throw new Error('请先勾选“我已确认配置并允许实际执行”；当前未确认，已拒绝运行且不会读取背包或操作游戏');
  }
}

/** 将两个独立路线开关归一化，并兼容旧版总开关。 */
function applyRouteModes(settings, rawSettings) {
  const hasSplitRouteSetting = rawSettings.gatheringRouteExecutionEnabled !== undefined
    || rawSettings.monsterRouteExecutionEnabled !== undefined;
  if (hasSplitRouteSetting) {
    settings.gatheringRouteExecutionEnabled = rawSettings.gatheringRouteExecutionEnabled === true;
    settings.monsterRouteExecutionEnabled = rawSettings.monsterRouteExecutionEnabled === true;
  } else if (rawSettings.routeExecutionEnabled !== undefined) {
    const legacyEnabled = rawSettings.routeExecutionEnabled === true;
    settings.gatheringRouteExecutionEnabled = legacyEnabled;
    settings.monsterRouteExecutionEnabled = legacyEnabled;
  } else {
    return;
  }
  settings.routeExecutionEnabled = settings.gatheringRouteExecutionEnabled
    || settings.monsterRouteExecutionEnabled;
}

/** 将角色/武器下拉选择转换为原有目标文本；自定义模式启用时完全替代下拉选择。 */
function applyTargetSelections(settings, rawSettings) {
  const targetFields = [
    'customTargetsEnabled', 'targetsText', 'selectedCharacter', 'characterLevelRange',
    'characterTalentRange', 'selectedWeapon', 'weaponLevelRange',
    ...SPLIT_TALENT_FIELDS.map(([field]) => field),
  ];
  if (!targetFields.some((field) => rawSettings[field] !== undefined)) return;

  if (rawSettings.customTargetsEnabled === true) {
    settings.targetsText = requireValue(rawSettings.targetsText, '自定义培养目标');
    return;
  }

  const targets = [];
  if (hasValue(rawSettings.selectedCharacter) && rawSettings.selectedCharacter !== NO_CHARACTER_SELECTION) {
    const levelRange = requireValue(rawSettings.characterLevelRange, '所选角色等级');
    const talentRange = buildTalentRange(rawSettings);
    targets.push(`${String(rawSettings.selectedCharacter).trim()}:${levelRange}${talentRange}`);
  }
  if (hasValue(rawSettings.selectedWeapon) && rawSettings.selectedWeapon !== NO_WEAPON_SELECTION) {
    const levelRange = requireValue(rawSettings.weaponLevelRange, '所选武器等级');
    targets.push(`${String(rawSettings.selectedWeapon).trim()}:${levelRange}`);
  }
  const isLegacyConfiguration = rawSettings.customTargetsEnabled === undefined;
  if (isLegacyConfiguration && hasValue(rawSettings.targetsText)) {
    targets.push(String(rawSettings.targetsText).trim());
  }
  settings.targetsText = targets.join('；');
}

/** 将三个独立天赋区间组合为解析器使用的“普攻/战技/爆发”格式。 */
function buildTalentRange(rawSettings) {
  const hasSplitSelection = SPLIT_TALENT_FIELDS.some(([field]) => rawSettings[field] !== undefined);
  if (!hasSplitSelection) {
    return hasValue(rawSettings.characterTalentRange)
      && rawSettings.characterTalentRange !== NO_TALENT_SELECTION
      ? `,${String(rawSettings.characterTalentRange).trim()}`
      : '';
  }

  const ranges = SPLIT_TALENT_FIELDS.map(([field, emptyValue, label]) => (
    parseTalentRange(rawSettings[field], emptyValue, label)
  ));
  if (ranges.every((range) => range === null)) return '';
  const current = ranges.map((range) => range?.current ?? 1);
  const target = ranges.map((range) => range?.target ?? 1);
  return `,${current.join('/')}>${target.join('/')}`;
}

function parseTalentRange(value, emptyValue, label) {
  if (!hasValue(value) || value === emptyValue) return null;
  const match = String(value).trim().match(/^(\d{1,2})>(\d{1,2})$/);
  if (!match) throw new Error(`${label}天赋区间格式错误：“${value}”`);
  const current = Number(match[1]);
  const target = Number(match[2]);
  if (current < 1 || target > 10 || current >= target) {
    throw new Error(`${label}天赋区间必须在 1 到 10 级内递增：“${value}”`);
  }
  return { current, target };
}

function applyDomainMode(settings, mode) {
  if (!hasValue(mode)) return;
  if (mode === '正式运行') settings.domainTestSingleRun = false;
  else if (mode === '单次测试') settings.domainTestSingleRun = true;
  else throw new Error(`未知的培养秘境模式：“${mode}”`);
}

function applyBossMode(settings, mode) {
  if (!hasValue(mode)) return;
  const values = {
    '关闭 Boss': [false, false],
    '单次测试 Boss': [true, true],
    '连续刷取 Boss': [true, false],
  };
  if (!values[mode]) throw new Error(`未知的世界 Boss 模式：“${mode}”`);
  [settings.bossExecutionEnabled, settings.bossTestSingleRun] = values[mode];
}

function applyArtifactMode(settings, mode) {
  if (!hasValue(mode)) return;
  if (mode === '关闭圣遗物填充') {
    settings.artifactDomainEnabled = false;
    settings.artifactTestSingleRun = false;
    return;
  }
  const testSingleRun = mode.startsWith(ARTIFACT_TEST_PREFIX);
  const prefix = testSingleRun ? ARTIFACT_TEST_PREFIX : ARTIFACT_FORMAL_PREFIX;
  if (!mode.startsWith(prefix) || mode.length === prefix.length) {
    throw new Error(`未知的圣遗物填充模式：“${mode}”`);
  }
  settings.artifactDomainEnabled = true;
  settings.artifactTestSingleRun = testSingleRun;
  settings.artifactDomainName = mode.slice(prefix.length);
}

function applyResinStrategy(settings, strategy) {
  if (!hasValue(strategy)) return;
  const values = {
    '浓缩→原粹': [true, true, false, false],
    '仅原粹': [false, true, false, false],
    '仅浓缩': [true, false, false, false],
    '浓缩→原粹→须臾': [true, true, true, false],
    '浓缩→原粹→须臾→脆弱': [true, true, true, true],
  };
  if (!values[strategy]) throw new Error(`未知的树脂策略：“${strategy}”`);
  [
    settings.domainUseCondensedResin,
    settings.domainUseOriginalResin,
    settings.domainUseTransientResin,
    settings.domainUseFragileResin,
  ] = values[strategy];
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function requireValue(value, label) {
  if (!hasValue(value)) throw new Error(`${label}不能为空`);
  return String(value).trim();
}
