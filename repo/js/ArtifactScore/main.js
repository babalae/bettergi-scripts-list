/**
 * 工作流程：
 * 1. 在角色圣遗物页识别并缓存当前角色及元素。
 * 2. 通过返回按钮模板和“对比”文字确认圣遗物详情页。
 * 3. 对右侧详情区域做一次 OCR，并按坐标解析部位、主词条和四条副词条。
 * 4. 计算普通评分、当前角色评分和角色排行榜，再更新 HTML 遮罩。
 * 所有坐标均基于 BetterGI 的 1920x1080 标准截图。
 */
import scoreData, {analyzeArtifact, calcArtifactScore, getMarkClass} from "./utils/artis-score-standalone.js"
import {
  estimateSubStatRolls,
  formatRollCount,
  formatScore,
  getArtifactScoreBreakdown,
  getAttrUseState
} from "./utils/artis-score-utils.js"

const MASK_PATH = "assets/score-mask.html"
const MASK_ID_PREFIX = "artiscope-score"
const BACK_TEMPLATE = "assets/images/back.png"
const POLL_INTERVAL = 200

const REGIONS = {
  back: [1780, 0, 140, 105],
  compare: [1600, 10, 210, 75],
  characterHeader: [105, 10, 310, 75],
  artifactTab: [90, 245, 250, 100],
  artifactPanel: [1450, 150, 430, 345],
  position: [1450, 160, 230, 48],
  mainName: [1450, 205, 230, 52],
  mainValue: [1680, 205, 210, 52],
  subStats: [
    [1450, 342, 420, 38],
    [1450, 376, 420, 38],
    [1450, 410, 420, 38],
    [1450, 444, 420, 38]
  ]
}

const POSITION_NAMES = ["生之花", "死之羽", "时之沙", "空之杯", "理之冠"]
const MAIN_STAT_NAMES = [
  "攻击力", "防御力", "生命值", "元素精通", "元素充能效率",
  "火元素伤害加成", "水元素伤害加成", "冰元素伤害加成",
  "雷元素伤害加成", "风元素伤害加成", "岩元素伤害加成",
  "草元素伤害加成", "物理伤害加成", "治疗加成", "暴击率", "暴击伤害"
]
const SUB_STAT_NAMES = [
  "暴击率", "暴击伤害", "攻击力", "防御力", "生命值",
  "元素精通", "元素充能效率"
]
const CHARACTER_NAMES = Object.keys(scoreData.usefulAttr).sort((a, b) => b.length - a.length)
const CHARACTER_ELEMENT_MAP = scoreData.charElemMap || {}
const ELEMENTS = [
  { label: "风元素", key: "anemo", name: "风" },
  { label: "岩元素", key: "geo", name: "岩" },
  { label: "雷元素", key: "electro", name: "雷" },
  { label: "草元素", key: "dendro", name: "草" },
  { label: "水元素", key: "hydro", name: "水" },
  { label: "火元素", key: "pyro", name: "火" },
  { label: "冰元素", key: "cryo", name: "冰" }
]

const MAIN_KEYS = {
  "攻击力": "atk", "防御力": "def", "生命值": "hp",
  "元素精通": "mastery", "元素充能效率": "recharge",
  "火元素伤害加成": "pyro", "水元素伤害加成": "hydro",
  "冰元素伤害加成": "cryo", "雷元素伤害加成": "electro",
  "风元素伤害加成": "anemo", "岩元素伤害加成": "geo",
  "草元素伤害加成": "dendro", "物理伤害加成": "phy",
  "治疗加成": "heal", "暴击率": "cpct", "暴击伤害": "cdmg"
}
const SUB_KEYS = {
  "暴击率": "cpct", "暴击伤害": "cdmg",
  "大攻击": "atk", "小攻击": "atkPlus",
  "大防御": "def", "小防御": "defPlus",
  "大生命": "hp", "小生命": "hpPlus",
  "元素精通": "mastery", "元素充能效率": "recharge"
}

let maskWindowId = null
let maskInstanceNumber = 0
let cachedCharacter = null
let backTemplateMat = null

function getBackTemplateMat() {
  if (!backTemplateMat) backTemplateMat = file.readImageMatSync(BACK_TEMPLATE)
  return backTemplateMat
}

function findBackButton() {
  const gameRegion = captureGameRegion()
  try {
    const ro = RecognitionObject.TemplateMatch(getBackTemplateMat(), ...REGIONS.back)
    const result = gameRegion.find(ro)
    return !result.isEmpty()
  } finally {
    gameRegion.dispose()
  }
}

function readOcrItems(x, y, w, h) {
  const gameRegion = captureGameRegion()
  try {
    const ro = RecognitionObject.Ocr(x, y, w, h)
    const results = gameRegion.findMulti(ro)
    const items = []

    for (let index = 0; index < results.count; index++) {
      const result = results[index]
      if (!result.isExist() || !result.text) continue
      items.push({
        text: result.text.trim(),
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height
      })
    }

    return items.sort((a, b) => (a.y - b.y) || (a.x - b.x))
  } finally {
    gameRegion.dispose()
  }
}

function readOcrText(x, y, w, h) {
  return readOcrItems(x, y, w, h).map(item => item.text).join(" ")
}

function hasOcrText(keyword, region) {
  const candidates = Array.isArray(keyword) ? keyword : [keyword]
  return !!matchKnownText(readOcrText(...region), candidates)
}

/**
 * 安全检查遮罩句柄；UI 线程正在关闭窗口时按不存在处理。
 */
function scoreMaskExists() {
  if (!maskWindowId) return false
  try {
    return htmlMask.exists(maskWindowId)
  } catch {
    maskWindowId = null
    return false
  }
}

/**
 * 创建评分遮罩；已经存在时复用原窗口。
 */
async function showScoreMask() {
  if (scoreMaskExists()) {
    try {
      htmlMask.send(maskWindowId, "/visibility", JSON.stringify({ visible: true }))
      return
    } catch {
      maskWindowId = null
    }
  }

  const instanceId = `${MASK_ID_PREFIX}-${Date.now()}-${++maskInstanceNumber}`
  maskWindowId = htmlMask.show(MASK_PATH, instanceId)
  if (!maskWindowId) throw new Error("无法创建圣遗物评分遮罩")

  await sleep(200)
  htmlMask.setClickThrough(maskWindowId, true)
}

/**
 * 运行期间只隐藏遮罩，不关闭 WPF Window。
 * 已关闭的 WPF Window 不能再次 Show，反复 close/show 会触发 InvalidOperationException。
 */
function hideScoreMask() {
  if (!maskWindowId) return
  try {
    if (scoreMaskExists()) {
      htmlMask.send(maskWindowId, "/visibility", JSON.stringify({ visible: false }))
    } else {
      maskWindowId = null
    }
  } catch {
    maskWindowId = null
  }
}

/**
 * 将一次完整评分结果发送给遮罩。
 */
function sendMaskData(data) {
  try {
    if (!scoreMaskExists()) return false
    htmlMask.send(maskWindowId, "/score", JSON.stringify(data))
    return true
  } catch {
    maskWindowId = null
    return false
  }
}

/**
 * 仅在脚本结束时关闭遮罩，关闭后不得再次调用 show。
 */
function closeScoreMask() {
  const windowId = maskWindowId
  maskWindowId = null
  if (!windowId) return
  try {
    if (htmlMask.exists(windowId)) htmlMask.close(windowId)
  } catch {
    // 窗口可能已被用户手动关闭，无需再次处理。
  }
}

/**
 * 将一次区域 OCR 的结果与候选词匹配，不再为每个候选词重复 OCR。
 */
function matchKnownText(text, candidates) {
  const normalized = String(text || "").replace(/\s/g, "")
  return candidates.find(candidate => normalized.includes(candidate.replace(/\s/g, ""))) || ""
}

function readArtifactSnapshot() {
  const items = readOcrItems(...REGIONS.artifactPanel)
  return {
    items,
    text: items.map(item => item.text).join(" ")
  }
}

function rowText(items, [x, y, w, h], options = {}) {
  const { minX = x, maxX = x + w } = options
  return items
    .filter(item => {
      const centerX = item.x + item.width / 2
      const centerY = item.y + item.height / 2
      return centerX >= minX && centerX <= maxX && centerY >= y && centerY <= y + h
    })
    .sort((a, b) => a.x - b.x)
    .map(item => item.text)
    .join(" ")
}

function readArtifactPositionFromSnapshot(snapshot) {
  const text = rowText(snapshot.items, REGIONS.position)
  const name = matchKnownText(text, POSITION_NAMES)
  if (!name) return null

  return {
    name,
    pos: POSITION_NAMES.indexOf(name)
  }
}

/**
 * 从一次标题 OCR 结果中匹配角色名，避免对每个候选角色重复截图和识别。
 */
async function scanCharacterNames(region) {
  const text = readOcrText(...region)
  const keyword = matchKnownText(text, CHARACTER_NAMES)
  return keyword ? { keyword, text } : null
}

/**
 * 读取圣遗物部位，并转换为评分模块使用的 0~4 索引。
 */
async function readArtifactPosition(snapshot = null) {
  if (snapshot) return readArtifactPositionFromSnapshot(snapshot)

  const text = readOcrText(...REGIONS.position)
  const name = matchKnownText(text, POSITION_NAMES)
  if (!name) return null

  return {
    name,
    pos: POSITION_NAMES.indexOf(name)
  }
}

/**
 * 返回按钮模板和“对比”文字用于确认详情页；已确认后可跳过文字复核以降低 OCR 频率。
 */
async function isArtifactPage(skipCompareCheck = false) {
  const hasBackButton = findBackButton()
  if (!hasBackButton) return false
  if (skipCompareCheck) return true

  return hasOcrText("对比", REGIONS.compare)
}

/**
 * 从“元素 / 角色名”OCR 文本中截取角色名。
 */
function parseHeaderCharacter(text, element = null) {
  const compact = String(text || "").replace(/\s/g, "")
  const knownName = CHARACTER_NAMES.find(name => compact.includes(name))
  if (knownName) return knownName

  const travelerAlias = ["空", "荧"].find(name => compact.includes(name))
  if (travelerAlias) return "旅行者"

  const separatorIndex = Math.max(compact.indexOf("/"), compact.indexOf("／"))
  if (separatorIndex < 0) return ""

  const suffix = compact.slice(separatorIndex + 1).replace(/[^\u3400-\u9fff·]/g, "")
  if (!suffix || (element && suffix === element.label)) return ""
  return suffix
}

/**
 * 写入角色缓存，并在角色或元素变化时输出一条必要信息。
 */
function saveCharacterCache(characterName, element = null, ocrName = characterName) {
  if (characterName === "空" || characterName === "荧") characterName = "旅行者"

  const elementKey = element?.key || ""
  const displayName = characterName === "旅行者" && element?.name
    ? `旅行者（${element.name}）`
    : characterName
  const changed = !cachedCharacter ||
    cachedCharacter.name !== characterName ||
    cachedCharacter.elem !== elementKey

  cachedCharacter = {
    name: characterName,
    ocrName,
    displayName,
    elem: elementKey,
    elementName: element?.name || ""
  }

  if (changed) log.info(`已缓存角色：${displayName}`)
  return true
}

/**
 * 兼容“圣遗物 / 角色名”的圣遗物角色选择页。
 */
async function updateCharacterFromSelectionPage(headerResult) {
  let characterName = parseHeaderCharacter(headerResult.text)

  if (!characterName && cachedCharacter) {
    if (matchKnownText(headerResult.text, [cachedCharacter.ocrName])) {
      characterName = cachedCharacter.name
    }
  }

  if (!characterName) {
    const characterResult = await scanCharacterNames(REGIONS.characterHeader)
    if (characterResult) characterName = characterResult.keyword
  }

  if (!characterName) return false

  const elemKey = CHARACTER_ELEMENT_MAP[characterName] || ""
  const element = ELEMENTS.find(item => item.key === elemKey) ||
    (cachedCharacter?.name === characterName
      ? ELEMENTS.find(item => item.key === cachedCharacter.elem)
      : null)
  return saveCharacterCache(characterName, element)
}

/**
 * 在角色圣遗物页刷新角色缓存；未识别到新角色时保留旧缓存。
 */
async function updateCachedCharacter() {
  const headerText = readOcrText(...REGIONS.characterHeader)
  if (matchKnownText(headerText, ["圣遗物"])) {
    return updateCharacterFromSelectionPage({ text: headerText })
  }

  const tabText = readOcrText(...REGIONS.artifactTab)
  if (!matchKnownText(tabText, ["圣遗物"])) return false

  const elementKeyword = matchKnownText(headerText, ELEMENTS.map(item => item.label))
  if (!elementKeyword) return false

  const element = ELEMENTS.find(item => item.label === elementKeyword)
  let characterName = parseHeaderCharacter(headerText, element)
  let travelerAlias = null

  if (!characterName && cachedCharacter) {
    if (cachedCharacter.name === "旅行者") {
      const aliasKeyword = matchKnownText(headerText, ["空", "荧"])
      if (aliasKeyword) {
        travelerAlias = aliasKeyword
        characterName = "旅行者"
      }
    } else {
      if (matchKnownText(headerText, [cachedCharacter.ocrName])) {
        characterName = cachedCharacter.name
      }
    }
  }

  if (!characterName) {
    const characterResult = await scanCharacterNames(REGIONS.characterHeader)
    if (characterResult) characterName = characterResult.keyword
  }

  if (!characterName) {
    const aliasKeyword = matchKnownText(headerText, ["空", "荧"])
    if (aliasKeyword) {
      travelerAlias = aliasKeyword
      characterName = "旅行者"
    }
  }

  if (!characterName) return false
  return saveCharacterCache(characterName, element, travelerAlias || characterName)
}

/**
 * 将 OCR 数字常见误识别（O/〇、千位逗号）归一化后转为数值。
 */
function parseNumber(text) {
  const normalized = String(text || "")
    .replace(/[Oo〇○]/g, "0")
    .replace(/[，,]/g, "")
  const match = normalized.match(/[+-]?\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : Number.NaN
}

/**
 * 生成与游戏界面接近的词条数值文本。
 */
function formatStatValue(value, hasPercent = false, showPlus = false) {
  if (!Number.isFinite(value)) return "--"
  const sign = showPlus && value >= 0 ? "+" : ""
  return `${sign}${value}${hasPercent ? "%" : ""}`
}

/**
 * 区分攻击/防御/生命的百分比词条与固定值词条。
 */
function getSubStatKey(name, hasPercent) {
  if (name === "攻击力") return hasPercent ? "大攻击" : "小攻击"
  if (name === "防御力") return hasPercent ? "大防御" : "小防御"
  if (name === "生命值") return hasPercent ? "大生命" : "小生命"
  return name
}

/**
 * 读取一条副词条；待激活和未识别项以 0 分占位。
 */
async function readSubStat(region, index, snapshot = null) {
  const text = snapshot
    ? rowText(snapshot.items, region)
    : readOcrText(...region)
  if (text.includes("待激活")) {
    return {
      key: `待激活${index + 1}`,
      statKey: "",
      value: 0,
      name: "待激活",
      displayValue: "0"
    }
  }

  const statName = matchKnownText(text, SUB_STAT_NAMES)
  if (!statName) {
    return {
      key: `未识别${index + 1}`,
      statKey: "",
      value: 0,
      name: "未识别",
      displayValue: "--"
    }
  }

  const value = parseNumber(text)
  if (!Number.isFinite(value)) {
    return {
      key: `未识别${index + 1}`,
      statKey: "",
      value: 0,
      name: statName,
      displayValue: "--"
    }
  }

  const hasPercent = /[%％]/.test(text)
  const key = getSubStatKey(statName, hasPercent)
  return {
    key,
    statKey: SUB_KEYS[key] || "",
    value,
    name: statName,
    displayValue: formatStatValue(value, hasPercent, true)
  }
}

/**
 * 从同一次右侧详情区域 OCR 结果中解析一件圣遗物。
 */
async function readArtifactFromOcr(position, snapshot) {
  const mainRowText = rowText(snapshot.items, [REGIONS.mainName[0], REGIONS.mainName[1], REGIONS.artifactPanel[2], REGIONS.mainName[3]])
  const mainNameText = rowText(snapshot.items, REGIONS.mainName, { maxX: REGIONS.mainValue[0] - 1 }) || mainRowText
  const mainName = matchKnownText(mainNameText, MAIN_STAT_NAMES)
  const mainValueText = rowText(snapshot.items, REGIONS.mainValue, { minX: REGIONS.mainValue[0] - 10 }) || mainRowText
  if (!mainName || !mainValueText) return null

  const mainValue = parseNumber(mainValueText)
  if (!Number.isFinite(mainValue)) return null

  const subs = {}
  const subStats = []
  for (let index = 0; index < REGIONS.subStats.length; index++) {
    const subStat = await readSubStat(REGIONS.subStats[index], index, snapshot)
    subs[subStat.key] = subStat.value
    subStats.push({
      key: subStat.statKey,
      name: subStat.name,
      value: subStat.displayValue,
      rawValue: subStat.value
    })
  }

  return {
    pos: position.pos,
    main: mainName,
    value: mainValue,
    mainDisplayValue: formatStatValue(mainValue, /[%％]/.test(mainValueText)),
    subs,
    subStats
  }
}

/**
 * 将 OCR 结构转换为角色定向评分 API 所需的标准键名。
 */
function toCalculatorArtifact(artifact) {
  const mainKey = artifact.pos === 0
    ? "hpPlus"
    : artifact.pos === 1
      ? "atkPlus"
      : MAIN_KEYS[artifact.main] || artifact.main

  const subs = {}
  for (const [key, value] of Object.entries(artifact.subs)) {
    const normalizedKey = SUB_KEYS[key]
    if (normalizedKey) subs[normalizedKey] = value
  }

  return {
    pos: artifact.pos,
    mainKey,
    mainValue: artifact.value,
    subs
  }
}

/**
 * 保留给数据传输使用；当前遮罩不直接渲染该文本。
 */
function formatArtifactMeta(artifact) {
  return [POSITION_NAMES[artifact.pos], artifact.main].filter(Boolean).join(" · ")
}

function isSupportedCharacter(character) {
  if (!character) return false
  return Boolean(scoreData.usefulAttr?.[character.name])
}

function getDisplayStateKey(artifact) {
  return JSON.stringify({
    artifact,
    character: cachedCharacter
      ? {
          name: cachedCharacter.name,
          displayName: cachedCharacter.displayName,
          elem: cachedCharacter.elem
        }
      : null
  })
}

function enrichArtifactStats(artifact, scoreBreakdown = null) {
  const subDetailMap = new Map((scoreBreakdown?.subs || []).map(item => [item.key, item]))
  const main = {
    name: artifact.main,
    value: artifact.mainDisplayValue,
    score: scoreBreakdown?.main ? formatScore(scoreBreakdown.main.score) : "",
    state: scoreBreakdown?.main ? getAttrUseState(scoreBreakdown.main.weight) : ""
  }
  const subs = artifact.subStats.map(item => {
    const detail = item.key ? subDetailMap.get(item.key) : null
    const estimate = item.key ? estimateSubStatRolls(item.key, item.rawValue) : null
    const state = item.name === "未识别"
      ? "unrecognized"
      : item.name === "待激活"
        ? "pending"
        : detail
          ? getAttrUseState(detail.weight)
          : ""
    return {
      ...item,
      score: detail ? formatScore(detail.score) : "",
      rollCount: estimate && estimate.count > 1 ? String(estimate.count - 1) : "",
      rollText: formatRollCount(estimate),
      effective: estimate ? estimate.effective.toFixed(1) : "",
      state
    }
  })

  return { main, subs }
}

/**
 * 计算评分并一次性更新遮罩，避免各字段分批刷新。
 */
async function displayArtifactScore(artifact) {
  const result = analyzeArtifact(artifact, {
    topN: 10,
    travelerElem: cachedCharacter?.name === "旅行者" ? cachedCharacter.elem : ""
  })
  const calcArtifact = toCalculatorArtifact(artifact)

  // 角色定向评分；未识别到角色时用通用权重兜底，保证词条分始终有值
  let scoreBreakdown
  let character
  let displayScore

  if (isSupportedCharacter(cachedCharacter)) {
    scoreBreakdown = getArtifactScoreBreakdown({
      calcArtifactScore,
      scoreData,
      charName: cachedCharacter.name,
      artifact: calcArtifact,
      options: { elem: cachedCharacter.elem }
    })
    character = {
      name: cachedCharacter.displayName,
      score: scoreBreakdown.score
    }
    displayScore = character.score
  } else {
    // 无角色或角色未收录时，使用通用基准角色计算词条分
    const elem = cachedCharacter?.elem || ""
    scoreBreakdown = getArtifactScoreBreakdown({
      calcArtifactScore,
      scoreData,
      charName: "香菱",
      artifact: calcArtifact,
      options: { elem }
    })
    character = null
    displayScore = result.score
  }

  await showScoreMask()
  sendMaskData({
    name: "当前圣遗物",
    meta: formatArtifactMeta(artifact),
    score: result.score,
    grade: getMarkClass(displayScore),
    character,
    artifactStats: enrichArtifactStats(artifact, scoreBreakdown),
    characters: result.characters
  })
}

/**
 * 持续监控页面并按稳定顺序刷新评分，直到调度器请求取消。
 */
async function runScoreLoop(cancellationToken) {
  let lastDisplayStateKey = ""
  let lastPosition = null
  let wasArtifactPage = false

  while (!cancellationToken.isCancellationRequested) {
    const artifactPage = await isArtifactPage(wasArtifactPage)

    if (!artifactPage) {
      await updateCachedCharacter()
      lastDisplayStateKey = ""
      lastPosition = null
      wasArtifactPage = false
      hideScoreMask()
      await sleep(POLL_INTERVAL)
      continue
    }
    wasArtifactPage = true

    let snapshot = readArtifactSnapshot()
    let position = await readArtifactPosition(snapshot)
    if (!position) {
      if (!await isArtifactPage(false)) {
        await updateCachedCharacter()
        lastDisplayStateKey = ""
        lastPosition = null
        wasArtifactPage = false
        hideScoreMask()
      }
      await sleep(POLL_INTERVAL)
      continue
    }

    if (position.pos !== lastPosition) {
      lastPosition = position.pos
      lastDisplayStateKey = ""
    }

    const artifact = await readArtifactFromOcr(position, snapshot)
    if (!artifact) {
      await sleep(POLL_INTERVAL)
      continue
    }

    const displayStateKey = getDisplayStateKey(artifact)
    const maskClosed = !scoreMaskExists()
    if (displayStateKey !== lastDisplayStateKey || maskClosed) {
      lastDisplayStateKey = displayStateKey
      await displayArtifactScore(artifact)
    }

    await sleep(POLL_INTERVAL)
  }
}

let cancellationToken

(async function () {
  try {
    setGameMetrics(1920, 1080, 1)
    cancellationToken = dispatcher.getLinkedCancellationToken()
    await runScoreLoop(cancellationToken)
  } catch (error) {
    if (!cancellationToken?.isCancellationRequested) {
      log.error(`圣遗物评分运行失败：${error.message || error}`)
    }
  } finally {
    closeScoreMask()
  }
})()
