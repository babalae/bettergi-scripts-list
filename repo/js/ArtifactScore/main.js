/**
 * 工作流程：
 * 1. 在角色圣遗物页识别并缓存当前角色及元素。
 * 2. 通过返回按钮模板和“对比”文字确认圣遗物详情页。
 * 3. 按“部位 -> 主词条 -> 四条副词条 -> 部位复核”的顺序读取 OCR。
 * 4. 计算普通评分、当前角色评分和角色排行榜，再更新 HTML 遮罩。
 *
 * 所有坐标均基于 BetterGI 的 1920x1080 标准截图。
 */
import { findImg, findText } from "../../../packages/utils/tool.js"
import scoreData, {
  analyzeArtifact,
  calcArtifactScore,
  getMarkClass
} from "./utils/artis-score-standalone.js"

const MASK_PATH = "assets/score-mask.html"
const MASK_ID_PREFIX = "artiscope-score"
const BACK_TEMPLATE = "assets/images/back.png"
const POLL_INTERVAL = 500
const TYPE_SETTLE_DELAY = 300
const CHARACTER_SCAN_BUDGET = 2000

const REGIONS = {
  back: [1780, 0, 140, 105],
  compare: [1600, 10, 210, 75],
  characterHeader: [105, 10, 310, 75],
  artifactTab: [90, 245, 250, 100],
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
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
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
let characterScanIndex = 0

/** 安全检查遮罩句柄；UI 线程正在关闭窗口时按不存在处理。 */
function scoreMaskExists() {
  if (!maskWindowId) return false
  try {
    return htmlMask.exists(maskWindowId)
  } catch {
    maskWindowId = null
    return false
  }
}

/** 创建评分遮罩；已经存在时复用原窗口。 */
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

/** 将一次完整评分结果发送给遮罩。 */
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

/** 仅在脚本结束时关闭遮罩，关闭后不得再次调用 show。 */
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

/** 在一组已知关键词中依次查找第一个 OCR 命中项。 */
async function findAnyText(keywords, region) {
  for (const keyword of keywords) {
    const result = await findText(keyword, ...region, 1, 0)
    if (result && result.text) return { keyword, text: result.text }
  }
  return null
}

/**
 * 分批扫描角色名。单轮达到时间预算后保存索引，下一轮继续，
 * 防止较慢电脑一次执行上百次 OCR 时表现为长时间卡死。
 */
async function scanCharacterNames(region) {
  const startedAt = Date.now()
  let checked = 0

  while (checked < CHARACTER_NAMES.length && Date.now() - startedAt < CHARACTER_SCAN_BUDGET) {
    const name = CHARACTER_NAMES[characterScanIndex]
    characterScanIndex = (characterScanIndex + 1) % CHARACTER_NAMES.length
    checked++

    const result = await findText(name, ...region, 1, 0)
    if (result?.text) {
      characterScanIndex = 0
      return { keyword: name, text: result.text }
    }
  }

  return null
}

/** 读取圣遗物部位，并转换为评分模块使用的 0~4 索引。 */
async function readArtifactPosition() {
  const result = await findAnyText(POSITION_NAMES, REGIONS.position)
  if (!result) return null

  return {
    name: result.keyword,
    pos: POSITION_NAMES.indexOf(result.keyword)
  }
}

/** 返回按钮模板和“对比”文字必须同时存在，才视为详情页。 */
async function isArtifactPage() {
  const back = await findImg(BACK_TEMPLATE, ...REGIONS.back, 100, 50)
  if (!back) return false

  return !!(await findText("对比", ...REGIONS.compare, 1, 0))
}

/** 从“元素 / 角色名”OCR 文本中截取角色名。 */
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

/** 写入角色缓存，并在角色或元素变化时输出一条必要信息。 */
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

/** 兼容“圣遗物 / 角色名”的圣遗物角色选择页。 */
async function updateCharacterFromSelectionPage(headerResult) {
  let characterName = parseHeaderCharacter(headerResult.text)

  if (!characterName && cachedCharacter) {
    const cachedResult = await findText(cachedCharacter.ocrName, ...REGIONS.characterHeader, 1, 0)
    if (cachedResult) characterName = cachedCharacter.name
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

/** 在角色圣遗物页刷新角色缓存；未识别到新角色时保留旧缓存。 */
async function updateCachedCharacter() {
  const selectionHeader = await findText("圣遗物", ...REGIONS.characterHeader, 1, 0)
  if (selectionHeader) return updateCharacterFromSelectionPage(selectionHeader)

  if (!await findText("圣遗物", ...REGIONS.artifactTab, 1, 0)) return false

  const elementResult = await findAnyText(ELEMENTS.map(item => item.label), REGIONS.characterHeader)
  if (!elementResult) return false

  const element = ELEMENTS.find(item => item.label === elementResult.keyword)
  let characterName = parseHeaderCharacter(elementResult.text, element)
  let travelerAlias = null

  if (!characterName && cachedCharacter) {
    if (cachedCharacter.name === "旅行者") {
      const aliasResult = await findAnyText(["空", "荧"], REGIONS.characterHeader)
      if (aliasResult) {
        travelerAlias = aliasResult.keyword
        characterName = "旅行者"
      }
    } else {
      const cachedResult = await findText(cachedCharacter.ocrName, ...REGIONS.characterHeader, 1, 0)
      if (cachedResult) characterName = cachedCharacter.name
    }
  }

  if (!characterName) {
    const characterResult = await scanCharacterNames(REGIONS.characterHeader)
    if (characterResult) characterName = characterResult.keyword
  }

  if (!characterName) {
    const aliasResult = await findAnyText(["空", "荧"], REGIONS.characterHeader)
    if (aliasResult) {
      travelerAlias = aliasResult.keyword
      characterName = "旅行者"
    }
  }

  if (!characterName) return false
  return saveCharacterCache(characterName, element, travelerAlias || characterName)
}

/** 将 OCR 数字常见误识别（O/〇、千位逗号）归一化后转为数值。 */
function parseNumber(text) {
  const normalized = String(text || "")
    .replace(/[Oo〇○]/g, "0")
    .replace(/[，,]/g, "")
  const match = normalized.match(/[+-]?\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : Number.NaN
}

/** 生成与游戏界面接近的词条数值文本。 */
function formatStatValue(value, hasPercent = false, showPlus = false) {
  if (!Number.isFinite(value)) return "--"
  const sign = showPlus && value >= 0 ? "+" : ""
  return `${sign}${value}${hasPercent ? "%" : ""}`
}

/** 区分攻击/防御/生命的百分比词条与固定值词条。 */
function getSubStatKey(name, hasPercent) {
  if (name === "攻击力") return hasPercent ? "大攻击" : "小攻击"
  if (name === "防御力") return hasPercent ? "大防御" : "小防御"
  if (name === "生命值") return hasPercent ? "大生命" : "小生命"
  return name
}

/** 读取一条副词条；待激活和未识别项以 0 分占位。 */
async function readSubStat(region, index) {
  const pending = await findText("待激活", ...region, 1, 0)
  if (pending) {
    return {
      key: `待激活${index + 1}`,
      value: 0,
      name: "待激活",
      displayValue: "0"
    }
  }

  const stat = await findAnyText(SUB_STAT_NAMES, region)
  if (!stat) {
    return {
      key: `未识别${index + 1}`,
      value: 0,
      name: "未识别",
      displayValue: "--"
    }
  }

  let value = parseNumber(stat.text)
  let valueText = stat.text
  if (!Number.isFinite(value)) {
    const numberResult = await findAnyText(DIGITS, region)
    if (!numberResult) {
      return {
        key: `未识别${index + 1}`,
        value: 0,
        name: stat.keyword,
        displayValue: "--"
      }
    }
    valueText = numberResult.text
    value = parseNumber(valueText)
  }
  if (!Number.isFinite(value)) {
    return {
      key: `未识别${index + 1}`,
      value: 0,
      name: stat.keyword,
      displayValue: "--"
    }
  }

  const hasPercent = /[%％]/.test(`${stat.text}${valueText}`)
  return {
    key: getSubStatKey(stat.keyword, hasPercent),
    value,
    name: stat.keyword,
    displayValue: formatStatValue(value, hasPercent, true)
  }
}

/**
 * 按固定顺序读取一件圣遗物。结束时再次读取部位，
 * 若前后不一致则丢弃本轮，防止切换动画混入新旧数据。
 */
async function readArtifactFromOcr(position) {
  const mainStat = await findAnyText(MAIN_STAT_NAMES, REGIONS.mainName)
  const mainValueResult = await findAnyText(DIGITS, REGIONS.mainValue)
  if (!mainStat || !mainValueResult) return null

  const mainValue = parseNumber(mainValueResult.text)
  if (!Number.isFinite(mainValue)) return null

  const subs = {}
  const subStats = []
  for (let index = 0; index < REGIONS.subStats.length; index++) {
    const subStat = await readSubStat(REGIONS.subStats[index], index)
    subs[subStat.key] = subStat.value
    subStats.push({ name: subStat.name, value: subStat.displayValue })
  }

  // 属性识别耗时较长，结束时复核部位，防止切换过程中拼出新旧混合数据。
  const confirmedPosition = await readArtifactPosition()
  if (!confirmedPosition || confirmedPosition.pos !== position.pos) return null

  const artifact = {
    pos: position.pos,
    main: mainStat.keyword,
    value: mainValue,
    mainDisplayValue: formatStatValue(mainValue, /[%％]/.test(mainValueResult.text)),
    subs,
    subStats
  }
  return artifact
}

/** 将 OCR 结构转换为角色定向评分 API 所需的标准键名。 */
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

/** 保留给数据传输使用；当前遮罩不直接渲染该文本。 */
function formatArtifactMeta(artifact) {
  return [POSITION_NAMES[artifact.pos], artifact.main].filter(Boolean).join(" · ")
}

/** 计算当前圣遗物对指定角色及元素的单件分数。 */
function scoreForCharacter(characterName, artifact, elem = "") {
  const result = calcArtifactScore(
    characterName,
    [toCalculatorArtifact(artifact)],
    { elem }
  )
  return result.artifacts[0]?.score || 0
}

/** 计算评分并一次性更新遮罩，避免各字段分批刷新。 */
async function displayArtifactScore(artifact) {
  const result = analyzeArtifact(artifact, {
    topN: 10,
    travelerElem: cachedCharacter?.name === "旅行者" ? cachedCharacter.elem : ""
  })
  const character = cachedCharacter
    ? {
        name: cachedCharacter.displayName,
        score: scoreForCharacter(cachedCharacter.name, artifact, cachedCharacter.elem)
      }
    : null
  const displayScore = character ? character.score : result.score

  await showScoreMask()
  sendMaskData({
    name: "当前圣遗物",
    meta: formatArtifactMeta(artifact),
    score: result.score,
    grade: getMarkClass(displayScore),
    character,
    artifactStats: {
      main: { name: artifact.main, value: artifact.mainDisplayValue },
      subs: artifact.subStats
    },
    characters: result.characters
  })
}

/** 持续监控页面并按稳定顺序刷新评分，直到调度器请求取消。 */
async function runScoreLoop(cancellationToken) {
  let lastArtifactJson = ""
  let lastPosition = null

  while (!cancellationToken.isCancellationRequested) {
    await sleep(50)
    const artifactPage = await isArtifactPage()

    if (!artifactPage) {
      await updateCachedCharacter()
      lastArtifactJson = ""
      lastPosition = null
      hideScoreMask()
      await sleep(POLL_INTERVAL)
      continue
    }

    let position = await readArtifactPosition()
    if (!position) {
      await sleep(POLL_INTERVAL)
      continue
    }

    // 部位优先：发现类型变化后先等待界面稳定，再确认一次才读取其他属性。
    if (position.pos !== lastPosition) {
      await sleep(TYPE_SETTLE_DELAY)
      const confirmedPosition = await readArtifactPosition()
      if (!confirmedPosition || confirmedPosition.pos !== position.pos) {
        await sleep(POLL_INTERVAL)
        continue
      }
      position = confirmedPosition
      lastPosition = position.pos
      lastArtifactJson = ""
    }

    const artifact = await readArtifactFromOcr(position)
    if (!artifact) {
      await sleep(POLL_INTERVAL)
      continue
    }

    const artifactJson = JSON.stringify(artifact)
    const maskClosed = !scoreMaskExists()
    if (artifactJson !== lastArtifactJson || maskClosed) {
      lastArtifactJson = artifactJson
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
