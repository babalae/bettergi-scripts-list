const ARTIFACT_TEST_PREFIX = '单次｜';
const ARTIFACT_FORMAL_PREFIX = '正式｜';
const TARGET_INPUT_MODE_ALIASES = Object.freeze({
  '预览目标（不执行）': '自动档案仅预览',
  '读取档案并执行': '自动档案识别后执行',
  '自动档案仅预览': '自动档案仅预览',
  '自动档案识别后执行': '自动档案识别后执行',
  // 旧版公开过手动模式；升级后自动迁移到正式的档案读取流程。
  '手动填写当前与目标': '自动档案识别后执行',
});
const BOSS_OVERRIDE_SLOT_COUNT = 3;
const BOSS_OVERRIDE_ACTIONS = new Set(['继承通用配置', '启用', '禁用']);

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

/** 优先读取紧凑文本；旧版三组结构化配置仅用于兼容已保存的设置。 */
function applyBossOverrides(settings, rawSettings) {
  if (rawSettings.bossOverridesEnabled !== undefined || rawSettings.bossOverridesText !== undefined) {
    settings.bossOverrides = rawSettings.bossOverridesEnabled === true
      ? parseBossOverrides(requireValue(rawSettings.bossOverridesText, 'Boss 专属配置'))
      : {};
    return;
  }

  applyLegacyBossOverrideSlots(settings, rawSettings);
}

/** 推荐格式：Boss:队伍=名称,策略=名称；也可填写 Boss:禁用。 */
function parseBossOverrides(text) {
  const result = {};
  const entries = String(text).split(/[；;\r\n]+/).map((item) => item.trim()).filter(Boolean);
  for (const entry of entries) {
    const match = entry.match(/^([^=：:]+?)\s*[=：:]\s*(.+)$/);
    if (!match) throw new Error(`Boss 专属配置格式错误：“${entry}”`);
    const bossName = match[1].trim();
    if (result[bossName]) throw new Error(`Boss 专属配置重复：“${bossName}”`);

    const value = match[2].trim();
    if (value === '禁用') {
      result[bossName] = { enabled: false };
      continue;
    }

    if (/(?:^|[,，])\s*(?:队伍|策略)\s*[=：:]/.test(value)) {
      result[bossName] = parseNamedBossOverride(bossName, value);
      continue;
    }

    // 兼容旧版“Boss=队伍|策略”记录。
    const parts = value.split('|').map((item) => item.trim());
    if (parts.length < 1 || parts.length > 3) {
      throw new Error(`Boss“${bossName}”应填写“队伍|策略”或“禁用”`);
    }
    const [partyName = '', strategyName = '', legacyAction = ''] = parts;
    if (legacyAction && !['启用', '禁用'].includes(legacyAction)) {
      throw new Error(`Boss“${bossName}”旧版处理方式只能填写“启用”或“禁用”`);
    }
    if (!partyName && !strategyName && !legacyAction) {
      throw new Error(`Boss“${bossName}”没有填写专属队伍、策略或“禁用”`);
    }
    const override = {};
    if (partyName) override.partyName = partyName;
    if (strategyName) override.strategyName = strategyName;
    if (legacyAction === '禁用') override.enabled = false;
    result[bossName] = override;
  }
  return result;
}

function parseNamedBossOverride(bossName, value) {
  const override = {};
  const seen = new Set();
  for (const part of value.split(/[,，]/).map((item) => item.trim()).filter(Boolean)) {
    const match = part.match(/^(队伍|策略)\s*[=：:]\s*(.+)$/);
    if (!match) throw new Error(`Boss“${bossName}”的专属配置无法识别：“${part}”`);
    const field = match[1];
    const fieldValue = match[2].trim();
    if (seen.has(field)) throw new Error(`Boss“${bossName}”重复填写了${field}`);
    seen.add(field);
    if (field === '队伍') override.partyName = fieldValue;
    else override.strategyName = fieldValue;
  }
  if (!override.partyName && !override.strategyName) {
    throw new Error(`Boss“${bossName}”没有填写专属队伍、策略或“禁用”`);
  }
  return override;
}

/** 兼容 0.9.0 的三组结构化 Boss 配置槽。 */
function applyLegacyBossOverrideSlots(settings, rawSettings) {
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
    if (!bossName || bossName === '不配置专属 Boss') {
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

/** 自由文本仍需校验名称，避免拼写错误导致专属配置静默失效。 */
export function validateBossOverrideNames(settings = {}, catalog = {}) {
  const knownBosses = new Set(catalog.bosses ?? []);
  for (const bossName of Object.keys(settings.bossOverrides ?? {})) {
    if (!knownBosses.has(bossName)) {
      throw new Error(`Boss 专属配置中的“${bossName}”不是当前 BetterGI 支持的世界 Boss 名称`);
    }
  }
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

/** 公开设置只保留自动档案；旧版手动模式会迁移到正式档案读取。 */
function applyTargetSelections(settings, rawSettings) {
  const targetFields = [
    'customTargetsEnabled', 'targetsText', 'selectedCharacter', 'selectedWeapon', 'weaponLevelRange',
    'targetInputMode', 'autoCharacterTargetLevel', 'autoNormalAttackTargetLevel',
    'autoElementalSkillTargetLevel', 'autoElementalBurstTargetLevel',
    'autoWeaponMode', 'autoWeaponTargetLevel',
  ];
  if (!targetFields.some((field) => rawSettings[field] !== undefined)) return;

  const modeLabel = String(rawSettings.targetInputMode ?? '读取档案并执行').trim();
  const targetInputMode = TARGET_INPUT_MODE_ALIASES[modeLabel];
  if (!targetInputMode) throw new Error(`未知的运行方式：“${modeLabel}”`);
  settings.targetInputMode = targetInputMode;
  settings.targetsText = '';
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
