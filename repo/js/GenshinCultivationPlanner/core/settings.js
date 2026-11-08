const ARTIFACT_TEST_PREFIX = '单次｜';
const ARTIFACT_FORMAL_PREFIX = '正式｜';
const TARGET_INPUT_MODE_ALIASES = Object.freeze({
  '预览目标（不执行）': '自动档案仅预览',
  '读取档案并执行': '自动档案识别后执行',
  '自动档案仅预览': '自动档案仅预览',
  '自动档案识别后执行': '自动档案识别后执行',
});

/** 用途先分流，独立圣遗物模式不解析无关培养、Boss或树脂配置。 */
export function resolveRunPurpose(settings = {}) {
  const purpose = settings.runPurpose ?? '正常培养';
  if (!['正常培养', '仅刷角色圣遗物'].includes(purpose)) {
    throw new Error(`未知的运行用途：“${purpose}”`);
  }
  return purpose;
}

/** 独立圣遗物用途只校验相关设置，不解析培养等级、武器或Boss覆盖。 */
export function normalizeRoleArtifactSettings(raw = {}) {
  const characterName = String(raw.selectedCharacter ?? '').trim();
  if (!characterName || characterName === '不选择角色') throw new Error('请先选择圣遗物目标角色');
  const source = raw.roleArtifactSource ?? '提升指南第一项推荐';
  if (!['提升指南第一项推荐', '手动指定套装'].includes(source)) throw new Error('未知的圣遗物套装来源');
  const mode = raw.roleArtifactRunMode ?? '按树脂规则';
  if (!['按树脂规则', '单次（20原粹）'].includes(mode)) throw new Error('未知的角色圣遗物刷取模式');
  if (source === '手动指定套装' && (!raw.roleArtifactSet || raw.roleArtifactSet === '未选择套装')) {
    throw new Error('请选择手动圣遗物套装');
  }
  const normalized = { ...raw, selectedCharacter: characterName, roleArtifactSource: source,
    artifactDomainEnabled: true, artifactTestSingleRun: mode === '单次（20原粹）' };
  applyResinStrategy(normalized, raw.resinStrategy);
  return normalized;
}

/** 将当前设置页的选项转换为执行器参数。 */
export function normalizeScriptSettings(rawSettings = {}) {
  if (rawSettings.appendTrainingGuide === true) {
    throw new Error('公开版暂不支持提升指南批量培养目标，请选择角色与培养内容');
  }
  const normalized = { ...rawSettings };
  if (rawSettings.roleArtifactFillEnabled != null && typeof rawSettings.roleArtifactFillEnabled !== 'boolean') {
    throw new Error('角色圣遗物填充开关必须是布尔值');
  }
  if (rawSettings.allowUnowned != null && typeof rawSettings.allowUnowned !== 'boolean') {
    throw new Error('允许预刷必须是布尔值');
  }

  applyTargetSelections(normalized, rawSettings);
  applyRouteModes(normalized, rawSettings);
  applyDomainMode(normalized, rawSettings.domainRunMode);
  applyBossMode(normalized, rawSettings.bossRunMode);
  applyArtifactMode(normalized, rawSettings.artifactRunMode);
  applyResinStrategy(normalized, rawSettings.resinStrategy);
  applyBossOverrides(normalized, rawSettings);

  return normalized;
}

/** Boss 专属配置只使用当前命名格式。 */
function applyBossOverrides(settings, rawSettings) {
  settings.bossOverrides = rawSettings.bossOverridesEnabled === true
    ? parseBossOverrides(requireValue(rawSettings.bossOverridesText, 'Boss 专属配置')) : {};
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

    result[bossName] = parseNamedBossOverride(bossName, value);
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

/** 自由文本仍需校验名称，避免拼写错误导致专属配置静默失效。 */
export function validateBossOverrideNames(settings = {}, catalog = {}, materials = {}) {
  const knownBosses = new Set(catalog.bosses ?? []);
  if (settings.allowUnowned === true) {
    for (const material of Object.values(materials)) {
      if (material.executionType === 'boss' && typeof material.bossName === 'string' && material.bossName.trim()) {
        knownBosses.add(material.bossName);
      }
    }
  }
  for (const bossName of Object.keys(settings.bossOverrides ?? {})) {
    if (!knownBosses.has(bossName)) {
      throw new Error(`Boss 专属配置中的“${bossName}”不是当前 BetterGI 支持的世界 Boss 名称`);
    }
  }
}

/** 所有用途（含目标预览）都须先确认，未确认时在任何读写或游戏操作前终止。 */
export function assertExecutionConfirmed(settings = {}) {
  const value = settings.executionConfirmed;
  const confirmed = value === true || value === 1 || value === 'true' || value === '1';
  if (!confirmed) {
    throw new Error('请先勾选“我已确认配置并允许实际执行”；当前未确认，已拒绝运行且不会读取背包或操作游戏');
  }
}

/** 采集与怪物路线分别启用。 */
function applyRouteModes(settings, rawSettings) {
  const hasSplitRouteSetting = rawSettings.gatheringRouteExecutionEnabled !== undefined
    || rawSettings.monsterRouteExecutionEnabled !== undefined;
  if (hasSplitRouteSetting) {
    settings.gatheringRouteExecutionEnabled = rawSettings.gatheringRouteExecutionEnabled === true;
    settings.monsterRouteExecutionEnabled = rawSettings.monsterRouteExecutionEnabled === true;
  } else {
    return;
  }
  settings.routeExecutionEnabled = settings.gatheringRouteExecutionEnabled
    || settings.monsterRouteExecutionEnabled;
}

/** 公开设置只保留自动档案，指定武器仍由独立选项提供。 */
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
