#!/usr/bin/env node
/**
 * 圣遗物评分模块生成器
 *
 * 从 miao-plugin 拉取角色词条权重、基础属性、元素与特殊规则，生成 ArtifactScore
 * 运行时使用的 utils/artis-score-standalone.js。仅需 Node.js 18+。
 * 用法: node tools/crawl-standalone.js [--branch master]
 *
 * 生成结果包含角色定向评分、普通评分和角色排行榜。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'utils')
const OUT = resolve(OUT_DIR, 'artis-score-standalone.js')
const BASE = 'https://raw.githubusercontent.com/yoimiya-kokomi/miao-plugin'
const BRANCH = process.argv.includes('--branch')
  ? process.argv[process.argv.indexOf('--branch') + 1] : 'master'

// ============================================================
//  HTTP helpers
// ============================================================

async function fetchRaw(path) {
  const url = `${BASE}/${BRANCH}/${path}`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`HTTP ${res.status} for ${path}`)
  }
  return res.text()
}

async function fetchJson(path) {
  const text = await fetchRaw(path)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch (e) {
    console.error(`  Failed to parse JSON: ${path}`)
    return null
  }
}

/** 节流: 限制并发数 */
async function poolLimit(tasks, limit = 10) {
  const results = new Array(tasks.length)
  let idx = 0

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      try { results[i] = await tasks[i]() } catch (e) { results[i] = { _error: e.message } }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ============================================================
//  Parsers
// ============================================================

/**
 * 在文本中从 startPos 开始提取"平衡括号"包裹的内容
 * 支持 {}、[]、()  —— 遇到同类型括号深度归零即停止
 */
function extractBracketed(text, startPos, open, close) {
  let depth = 1
  let i = startPos + 1
  let inString = false, stringChar = '', inTemplate = false
  while (i < text.length && depth > 0) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') { i++ }
      else if (ch === stringChar) { inString = false }
    } else if (inTemplate) {
      if (ch === '\\') { i++ }
      else if (ch === '`') { inTemplate = false }
      else if (ch === '$' && text[i+1] === '{') {
        // Skip template expression: find matching }
        let subDepth = 1, j = i + 2
        let ss = false, sc = ''
        while (j < text.length && subDepth > 0) {
          const c = text[j]
          if (ss) { if (c === '\\') j++; else if (c === sc) ss = false }
          else if (c === "'" || c === '"' || c === '`') { ss = true; sc = c }
          else if (c === '{') subDepth++
          else if (c === '}') subDepth--
          j++
        }
        i = j
        continue
      }
    } else {
      if (ch === "'" || ch === '"') { inString = true; stringChar = ch }
      else if (ch === '`') { inTemplate = true }
      else if (ch === '/' && text[i+1] === '/') {
        const end = text.indexOf('\n', i)
        i = end === -1 ? text.length : end
        continue
      }
      else if (ch === '/' && text[i+1] === '*') {
        const end = text.indexOf('*/', i + 2)
        i = end === -1 ? text.length : end + 2
        continue
      }
      else if (ch === open) { depth++ }
      else if (ch === close) { depth-- }
    }
    i++
  }
  return text.slice(startPos, i)
}

/**
 * 从 JS 源码中提取 export const NAME = VALUE
 * 支持: 对象字面量、数组、数字、带 .split() 的字符串、嵌套表达式
 */
function parseExportValue(text, name) {
  // 找到 export const NAME = 的位置
  const declRe = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*`)
  const m = text.match(declRe)
  if (!m) return undefined

  const startIdx = m.index + m[0].length
  const firstChar = text[startIdx]

  let val
  if (firstChar === '{') {
    val = extractBracketed(text, startIdx, '{', '}')
  } else if (firstChar === '[') {
    val = extractBracketed(text, startIdx, '[', ']')
  } else if (firstChar === '(') {
    val = extractBracketed(text, startIdx, '(', ')')
  } else {
    // 简单值: 数字、字符串 (含 .split() 等需要 eval 的表达式)
    // 匹配到下一个 ; 或 \nexport 或 \n\n
    const endRe = /[;\n]/
    const endM = text.slice(startIdx).match(endRe)
    if (endM) {
      val = text.slice(startIdx, startIdx + endM.index)
    } else {
      val = text.slice(startIdx)
    }
  }

  val = val.trim()
  if (val.endsWith(';')) val = val.slice(0, -1).trim()

  try {
    return new Function('return ' + val)()
  } catch (e) {
    console.warn(`  [WARN] Cannot eval export ${name}: ${e.message.slice(0, 60)}`)
    return val
  }
}

/**
 * 从 artis-mark.js 解析 usefulAttr
 */
function parseUsefulAttr(text) {
  // 去掉注释
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  const declRe = /export\s+const\s+usefulAttr\s*=\s*/
  const m = clean.match(declRe)
  if (!m) throw new Error('Cannot find usefulAttr in artis-mark.js')
  const startIdx = m.index + m[0].length
  const obj = extractBracketed(clean, startIdx, '{', '}')
  try {
    return new Function('return ' + obj)()
  } catch (e) {
    throw new Error(`Failed to parse usefulAttr: ${e.message}`)
  }
}

/**
 * 从 ArtisMarkCfg.js 解析 weaponCfg + 西风 regex
 */
function parseWeaponCfg(text) {
  // 匹配 const weaponCfg = { ... }
  const declRe = /const\s+weaponCfg\s*=\s*/
  const m = text.match(declRe)
  let wCfg = {}
  if (m) {
    const startIdx = m.index + m[0].length
    const obj = extractBracketed(text, startIdx, '{', '}')
    try { wCfg = new Function('return ' + obj)() } catch { /* keep default */ }
  }
  // 匹配西风 regex
  const rx = text.match(/(\/\^西风[^)]+\)\/)/)
  const xifengRegex = rx ? rx[1].replace(/\\\\/g, '\\') : '/^西风(长枪|大剑|剑|猎弓|秘典)$/'
  return { weaponCfg: wCfg, xifengRegex }
}

// ============================================================
//  Artis.js Transformer helpers
// ============================================================

/**
 * 替换 return FUNCNAME(args) 调用
 * 使用括号计数来精确匹配参数边界
 * cb 接收 (titleExpr, weightExpr) 两个字符串参数，返回替换字符串
 */
function replaceRuleCall(code, funcName, cb) {
  const pattern = new RegExp(`return\\s+${funcName}\\(`, 'g')
  let result = ''
  let lastIdx = 0
  let m

  while ((m = pattern.exec(code)) !== null) {
    result += code.slice(lastIdx, m.index)
    const parenStart = m.index + m[0].length

    // 括号计数找匹配的 )
    const rest = code.slice(parenStart)
    let depth = 1, i = 0, inString = false, strChar = '', inTemplate = false

    while (i < rest.length && depth > 0) {
      const ch = rest[i]
      if (inString) {
        if (ch === '\\') i++
        else if (ch === strChar) inString = false
      } else if (inTemplate) {
        if (ch === '\\') i++
        else if (ch === '`') inTemplate = false
        else if (ch === '$' && rest[i+1] === '{') {
          let subDepth = 1, j = i + 2, ss = false, sc = ''
          while (j < rest.length && subDepth > 0) {
            const c = rest[j]
            if (ss) { if (c === '\\') j++; else if (c === sc) ss = false }
            else if (c === "'" || c === '"' || c === '`') { ss = true; sc = c }
            else if (c === '{') subDepth++
            else if (c === '}') subDepth--
            j++
          }
          i = j
          continue
        }
      } else {
        if (ch === "'" || ch === '"') { inString = true; strChar = ch }
        else if (ch === '`') { inTemplate = true }
        else if (ch === '(') depth++
        else if (ch === ')') depth--
      }
      i++
    }

    const args = rest.slice(0, i - 1)  // raw args without outer parens

    // Split args by comma (respecting brackets and strings)
    const commaIdx = findTopLevelComma(args)
    if (commaIdx === -1) {
      result += cb(args.trim(), 'undefined')
    } else {
      const title = args.slice(0, commaIdx).trim()
      const weight = args.slice(commaIdx + 1).trim()
      result += cb(title, weight)
    }

    lastIdx = parenStart + i
  }

  result += code.slice(lastIdx)
  return result
}

/** 找到第一个"顶层"逗号的位置 (不在字符串/模板/括号内) */
function findTopLevelComma(str) {
  let depth = 0  // {[( increases, }]) decreases
  let inString = false, strChar = '', inTemplate = false

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === strChar) inString = false
    } else if (inTemplate) {
      if (ch === '\\') i++
      else if (ch === '`') inTemplate = false
      else if (ch === '$' && str[i+1] === '{') {
        let subDepth = 1, j = i + 2, ss = false, sc = ''
        while (j < str.length && subDepth > 0) {
          const c = str[j]
          if (ss) { if (c === '\\') j++; else if (c === sc) ss = false }
          else if (c === "'" || c === '"' || c === '`') { ss = true; sc = c }
          else if (c === '{') subDepth++
          else if (c === '}') subDepth--
          j++
        }
        i = j - 1
        continue
      }
    } else {
      if (ch === "'" || ch === '"') { inString = true; strChar = ch }
      else if (ch === '`') { inTemplate = true }
      else if ('{[('.includes(ch)) depth++
      else if ('}])'.includes(ch)) depth--
      else if (ch === ',' && depth === 0) return i
    }
  }
  return -1
}

// ============================================================
//  Artis.js Transformer
// ============================================================

/**
 * 将原始 artis.js 源码转换为 charSpecialRules 的条目
 * @returns {{ code: string, defWeights: object|null }}
 *   - code:  转换后的函数代码 (不含 key 引号)
 *   - defWeights: 从 def() 调用中提取的默认权重对象, null 表示使用 usefulAttr
 */
function transformArtisJs(source, charName) {
  let code = source

  // 0. 尝试提取 def() 调用中的权重 (用于 artisDefaultWeights)
  const defWeights = extractDefWeights(code, charName)

  // 1. 删除 import 语句
  code = code.replace(/^import\s+.*?;?\s*$/gm, '')

  // 2. 转换函数签名
  code = transformSignature(code, charName)

  // 3. 替换 property accesses
  code = code.replace(/attr\.(\w+)/g, '(charAttrs?.$1 || 0)')
  code = code.replace(/weapon\.name/g, 'weaponName')
  code = code.replace(/weapon\.affix/g, 'weaponAffix')

  // 4. 替换 artis.is() 调用
  code = replaceArtisIs(code)

  // 5. 替换 rule() 调用
  // 使用函数替换，配合括号计数精确匹配
  code = replaceRuleCall(code, 'rule',
    (title, weightExpr) => `return { title: ${title}, attrWeight: ${weightExpr}, useDefaultPipeline: false }`
  )

  // 6. 替换 def() 调用
  code = replaceRuleCall(code, 'def',
    () => 'return null'
  )

  // 7. 清理多余空行
  code = code.replace(/\n{3,}/g, '\n\n')

  return { code: code.trim(), defWeights }
}

/** 转换函数签名: export default function ({...}) { → 'charName': ({...}) => { */
function transformSignature(code, charName) {
  const sigRe = /export\s+default\s+function\s*\((\s*\{[^}]*\})/
  const m = code.match(sigRe)
  if (!m) {
    console.warn(`  [WARN] Cannot parse function signature for ${charName}, keeping original`)
    return code
  }

  let params = m[1]
  // 提取参数名
  const hasAttr = /\battr\b/.test(params)
  const hasWeapon = /\bweapon\b/.test(params)
  const hasArtis = /\bartis\b/.test(params)
  const hasCons = /\bcons\b/.test(params)
  const hasElem = /\belem\b/.test(params)

  // 构建新参数列表
  const newParams = []
  if (hasCons) newParams.push('cons')
  if (hasWeapon) { newParams.push('weaponName'); newParams.push('weaponAffix') }
  if (hasAttr) newParams.push('charAttrs')
  if (hasArtis) { newParams.push('artisSets'); newParams.push('artifacts') }
  if (hasElem) newParams.push('elem')

  const newSig = `'${charName}': ({ ${newParams.join(', ')} }) =>`
  return code.replace(
    /export\s+default\s+function\s*\(\s*\{[^}]*\}\s*\)/,
    newSig
  )
}

/** 替换 artis.is() 调用 */
function replaceArtisIs(code) {
  // Single arg: artis.is('setName4') or artis.is('setName')
  // → (artisSets||[]).includes('setName')
  code = code.replace(
    /artis\.is\((['"])([^'"]*?)(\d)?\1\)/g,
    (match, quote, name, digit) => {
      if (digit) {
        // Has trailing digit (4-piece set indicator) — strip it
        return `(artisSets||[]).includes('${name}')`
      }
      // Check if it looks like a set name check (not a stat name)
      if (/冰套|绝缘|宗室|角斗|魔女|如雷|乐团/.test(name)) {
        return `(artisSets||[]).includes('${name}')`
      }
      // Otherwise, keep as-is (probably a stat check that we handle differently)
      return match
    }
  )

  // Two args: artis.is('stat1,stat2', pos) or artis.is('stat', 'pos1,pos2')
  // Transform to position-based check on artifacts array
  code = code.replace(
    /artis\.is\((['"])([^'"]+)\1\s*,\s*([^)]+)\)/g,
    (match, quote, statList, posExpr) => {
      const stats = statList.split(',').map(s => s.trim())
      const pos = posExpr.trim().replace(/['"]/g, '')

      if (pos.includes(',')) {
        // Multi-position: artis.is('hp', '3,4,5')
        const positions = pos.split(',').map(p => (+p - 1))  // to 0-based
        const statsStr = JSON.stringify(stats)
        return `(artifacts||[]).some(a => [${positions.join(',')}].includes(a.pos) && ${statsStr}.includes(a.mainKey||''))`
      } else {
        // Single position: artis.is('dmg', 4)
        const pos0 = +pos - 1  // to 0-based
        const statsStr = JSON.stringify(stats)

        if (stats.some(s => ['dmg', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro', 'phy'].includes(s))) {
          // Elemental dmg check: need isElem() helper for dmg
          if (stats.length === 1 && stats[0] === 'dmg') {
            return `((artifacts||[]).find(a=>a.pos===${pos0})?.mainKey||'') && (artifacts.find(a=>a.pos===${pos0}).mainKey==='dmg'||isElem(artifacts.find(a=>a.pos===${pos0}).mainKey||''))`
          }
          return `((a=>a&&${statsStr}.includes(a.mainKey||''))(artifacts?.find(a=>a.pos===${pos0})))`
        }
        return `((a=>a&&${statsStr}.includes(a.mainKey||''))(artifacts?.find(a=>a.pos===${pos0})))`
      }
    }
  )

  return code
}

/** 从 artis.js 提取 def() 调用中的默认权重 */
function extractDefWeights(code, charName) {
  // 匹配 return def({ ... })
  const defObj = code.match(/return\s+def\(\s*(\{[^}]*\})\s*\)/)
  if (defObj) {
    try {
      return new Function('return ' + defObj[1])()
    } catch { /* fall through */ }
  }
  // 匹配 return def(usefulAttr['X']) — 使用 usefulAttr 中的权重
  const defUA = code.match(/return\s+def\(\s*usefulAttr\s*\[\s*['"]([^'"]+)['"]\s*\]\s*\)/)
  if (defUA) {
    return null  // 与 usefulAttr 相同，不需要单独记录
  }
  // 复杂表达式 (如 JSON.parse(JSON.stringify(...))) — 无法静态提取
  const defComplex = code.match(/return\s+def\(/)
  if (defComplex) {
    return null  // 无法安全提取，fallback 到 usefulAttr
  }
  return null
}

// ============================================================
//  Template generation
// ============================================================

function generateStandalone(data) {
  const {
    usefulAttr, baseAttrMap, charElemMap, attrMapBase, attrPct, basicNum,
    mainAttr, subAttr, weaponCfg, xifengRegex,
    artisDefaultWeights, charRulesCode
  } = data

  // 将 mainAttr 键为 3/4/5 的格式转为 1-5 位置格式
  const mainAttrOptions = {
    1: JSON.stringify(['hpPlus']),
    2: JSON.stringify(['atkPlus']),
    3: JSON.stringify(mainAttr[3] || ['atk','def','hp','mastery','recharge']),
    4: JSON.stringify(mainAttr[4] || ['atk','def','hp','mastery','dmg','phy']),
    5: JSON.stringify(mainAttr[5] || ['atk','def','hp','mastery','heal','cpct','cdmg'])
  }

  const subAttrList = JSON.stringify(subAttr)
  const attrPctJson = JSON.stringify(attrPct, null, 2)
  const attrMapBaseJson = JSON.stringify(attrMapBase, null, 2)
  const usefulAttrJson = JSON.stringify(usefulAttr, null, 2)
  const baseAttrMapJson = JSON.stringify(baseAttrMap, null, 2)
  const charElemMapJson = JSON.stringify(charElemMap, null, 2)
  const weaponCfgJson = JSON.stringify(weaponCfg, null, 2)
  const artisDefaultWeightsJson = JSON.stringify(artisDefaultWeights, null, 2)
  const xifengPatternStr = JSON.stringify(xifengRegex.replace(/^\//, '').replace(/\/$/, ''))

  const template = `/**
 * ============================================================
 *  原神圣遗物评分 — 独立计算模块 (auto-generated)
 *  Genshin Impact Artifact Score — Standalone Calculator
 *
 *  Generated by: node tools/crawl-standalone.js
 *  Source: yoimiya-kokomi/miao-plugin (branch: ${BRANCH})
 *  Date: ${new Date().toISOString().split('T')[0]}
 * ============================================================
 *
 * 评分说明:
 *   - 角色定向评分会应用角色词条权重、角色特殊规则、元素、武器与套装选项
 *   - 单件分数按该部位的理论上限归一化，通常位于 0~66
 *   - 多件结果同时返回总分和平均分，档位按平均分计算
 *   - analyzeArtifact() 的普通评分为所有角色单件分数前 50% 的平均值
 *
 * 使用示例:
 *   import { analyzeArtifact, calcArtifactScore } from './utils/artis-score-standalone.js'
 *
 *   const result = calcArtifactScore('玛薇卡', [
 *     { pos: 0, mainKey: 'hpPlus', mainValue: 4780, subs: { cpct: 3.5, cdmg: 7.8, ... } },
 *     // ... 位置 1~4
 *   ], { elem: 'pyro', charAttrs: { mastery: 120 } })
 *
 *   console.log(result.totalScore, result.totalGrade)
 */

// ============================================================================
//  1. 基础数据 (from extra.js)
// ============================================================================

const basicNum = ${basicNum}

const attrPct = ${attrPctJson}

const attrMapBase = ${attrMapBaseJson}

// 构建完整 attrMap (含 value, valueMin, type, base, text)
const attrMap = {}
for (const [key, attr] of Object.entries(attrMapBase)) {
  const pct = attrPct[key]
  if (pct === undefined) continue
  const value = basicNum * pct
  const base = { hpPlus: 'hp', atkPlus: 'atk', defPlus: 'def' }[key]
  attrMap[key] = {
    ...attr,
    value,
    valueMin: basicNum * pct * 0.7,
    type: base ? 'plus' : 'normal',
    base: base || undefined
  }
}

const mainAttrOptions = {
  1: ${mainAttrOptions[1]},
  2: ${mainAttrOptions[2]},
  3: ${mainAttrOptions[3]},
  4: ${mainAttrOptions[4]},
  5: ${mainAttrOptions[5]}
}

const subAttrList = ${subAttrList}

const elemMap = { pyro: 1, electro: 2, cryo: 3, hydro: 4, anemo: 5, geo: 6, dendro: 7 }
const travelerElements = {
  anemo: '风', geo: '岩', electro: '雷', dendro: '草', hydro: '水', pyro: '火'
}

// ============================================================================
//  2. 角色默认词条权重 (from artis-mark.js)
//     ${Object.keys(usefulAttr).length} 个角色
// ============================================================================

const usefulAttr = ${usefulAttrJson}

// ============================================================================
//  3. 角色基础属性 (from character/{name}/data.json)
// ============================================================================

const baseAttrMap = ${baseAttrMapJson}

// ============================================================================
//  3b. 角色元素 (from character/{name}/data.json)
// ============================================================================

const charElemMap = ${charElemMapJson}

// ============================================================================
//  4. 武器特效配置 (from ArtisMarkCfg.js)
// ============================================================================

const weaponCfg = ${weaponCfgJson}

const xifengWeaponPattern = new RegExp(${xifengPatternStr})

// ============================================================================
//  5. 角色 artis.js 的 def() 默认权重
//     (与 usefulAttr 不同的情况，否则不记录)
// ============================================================================

const artisDefaultWeights = ${artisDefaultWeightsJson}

// ============================================================================
//  6. 角色特殊评分配置 (from character/{name}/artis.js 自动转换)
// ============================================================================

const charSpecialRules = {
${charRulesCode}
}

// ============================================================================
//  7. 默认通用权重 & 辅助函数
// ============================================================================

const defaultAttrWeight = { atk: 75, cpct: 100, cdmg: 100, dmg: 100, phy: 100 }

function sameElem(key1, key2) {
  return elemMap[key1] === elemMap[key2]
}

// 部分自动转换的角色规则会用它判断元素伤害主词条。
function isElem(key) {
  return !!elemMap[key]
}

// ============================================================================
//  8. 核心计算
// ============================================================================

function getAttrWeight(charName, options = {}) {
  const { cons = 0, weaponName = '', weaponAffix = 1,
          charAttrs = {}, artisSets = [], artifacts = [], elem = '' } = options

  let baseWeight
  let title

  // 8a. 角色特殊规则 (rule() 路径)
  const specialRule = charSpecialRules[charName]
  if (specialRule) {
    const result = specialRule({ cons, weaponName, weaponAffix, charAttrs, artisSets, artifacts, elem })
    if (result && !result.useDefaultPipeline) {
      return { title: result.title, attrWeight: result.attrWeight }
    }
    if (result && result.useDefaultPipeline) {
      baseWeight = { ...result.attrWeight }
      title = result.title
    }
  }

  // 8b. 默认权重
  if (!baseWeight) {
    if (artisDefaultWeights[charName]) {
      baseWeight = { ...artisDefaultWeights[charName] }
    } else if (usefulAttr[charName]) {
      baseWeight = { ...usefulAttr[charName] }
    } else {
      baseWeight = { ...defaultAttrWeight }
    }
  }

  if (!title) title = charName + '-通用'

  const weight = { ...baseWeight }

  // 8c. 武器特效
  const wn = weaponName || ''
  if ((weight.atk || 0) > 0 && weaponCfg[wn]) {
    const wCfg = weaponCfg[wn]
    const maxAffix = wCfg.max || 20, minAffix = wCfg.min || 10
    const key = wCfg.attr || ''
    if (key && (weight[key] || 0) < 100) {
      const plus = minAffix + (maxAffix - minAffix) * (weaponAffix - 1) / 4
      weight[key] = Math.min(Math.round((weight[key] || 0) + plus), 100)
      title = (wCfg.abbr || wn) + '加成'
    }
  }

  // 8d. 绝缘4
  if ((artisSets || []).includes('绝缘') && (weight.recharge || 0) > 0) {
    const maxWeight = Math.max(weight.atk || 0, weight.hp || 0, weight.def || 0, weight.mastery || 0)
    if ((weight.recharge || 0) < maxWeight) {
      weight.recharge = Math.min(maxWeight, 75)
      title = title.endsWith('-通用') ? '绝缘4' : title + '+绝缘4'
    }
  }

  // 8e. 西风
  if (xifengWeaponPattern.test(wn) && (weight.cpct || 0) < 100) {
    weight.cpct = 100
    title = title.endsWith('-通用') ? '西风' : title + '+西风'
  }

  if (title.endsWith('-通用')) title = charName + '-通用'
  return { title, attrWeight: weight }
}

function buildAttrs(attrWeight, baseAttr = { hp: 14000, atk: 230, def: 700 }, weaponAtkPlus = 520) {
  const attrs = {}
  for (const [key, attr] of Object.entries(attrMap)) {
    const k = attr.base || ''
    const weight = attrWeight[k || key]
    if (!weight || weight * 1 === 0) continue

    const ret = { ...attr, weight, fixWeight: weight, mark: weight / attr.value }

    if (!k) {
      ret.mark = weight / attr.value
    } else {
      const plus = k === 'atk' ? weaponAtkPlus : 0
      const baseAttrK = baseAttr[k] || 1
      ret.mark = weight / attrMap[k].value / (baseAttrK + plus) * 100
      ret.fixWeight = weight * attr.value / attrMap[k].value / (baseAttrK + plus) * 100
    }
    attrs[key] = ret
  }
  return attrs
}

function getMaxAttr(attrs, list, maxLen = 1, banAttr = '') {
  let tmp = []
  for (const attr of list) {
    if (attr === banAttr) continue
    if (!attrs[attr]) continue
    tmp.push({ attr, mark: attrs[attr].fixWeight })
  }
  tmp.sort((a, b) => b.mark - a.mark)
  return tmp.slice(0, maxLen).map(d => d.attr)
}

function getMaxMark(attrs) {
  const ret = {}
  for (let idx = 1; idx <= 5; idx++) {
    let totalMark = 0, mMark = 0, mAttr = ''
    if (idx === 1) {
      mAttr = 'hpPlus'
    } else if (idx === 2) {
      mAttr = 'atkPlus'
    } else {
      const best = getMaxAttr(attrs, mainAttrOptions[idx] || [])
      if (best.length > 0) {
        mAttr = best[0]
        mMark = attrs[mAttr]?.fixWeight || 0
        totalMark += mMark * 2
      }
    }
    const bestSubs = getMaxAttr(attrs, subAttrList, 4, mAttr)
    bestSubs.forEach((attr, aIdx) => {
      totalMark += (attrs[attr]?.fixWeight || 0) * (aIdx === 0 ? 6 : 1)
    })
    ret[idx] = totalMark
    ret['m' + idx] = mMark
  }
  return ret
}

export function getMarkClass(mark) {
  const scoreMap = [
    ['D', 7], ['C', 14], ['B', 21], ['A', 28], ['S', 35],
    ['SS', 42], ['SSS', 49], ['ACE', 56], ['MAX', 70]
  ]
  for (const [grade, threshold] of scoreMap) {
    if (mark < threshold) return grade
  }
  return 'MAX'
}

function getMark(charCfg, idx, arti, elem = '', charId = 0) {
  const { attrs, posMaxMark } = charCfg
  const mainKey = arti.mainKey
  const mainValue = arti.mainValue || 0
  const subs = arti.subs || {}
  if (!mainKey) return 0

  let ret = 0, fixPct = 1
  const posIdx = idx + 1

  if (posIdx >= 3) {
    let effectiveKey = mainKey
    if (mainKey !== 'recharge') {
      if (posIdx === 4 && (sameElem(elem, mainKey) || charId === 10000128)) {
        effectiveKey = 'dmg'
      }
      const mMark = posMaxMark['m' + posIdx]
      if (mMark > 0) {
        fixPct = Math.max(0, Math.min(1, (attrs[effectiveKey]?.weight || 0) / mMark))
      }
      if (['atk', 'hp', 'def'].includes(effectiveKey) && (attrs[effectiveKey]?.weight || 0) >= 75) {
        fixPct = 1
      }
    }
    ret += (attrs[effectiveKey]?.mark || 0) * mainValue / 4
  }

  for (const [key, value] of Object.entries(subs)) {
    ret += (attrs[key]?.mark || 0) * (value || 0)
  }

  const maxMark = posMaxMark[posIdx] || 1
  return ret * (1 + fixPct) / 2 / maxMark * 66
}

export function calcArtifactScore(charName, artifacts = [], options = {}) {
  const {
    cons = 0, weaponName = '', weaponAffix = 1,
    charAttrs = {}, artisSets = [], elem = '', charId = 0
  } = options

  const { title, attrWeight } = getAttrWeight(charName, {
    cons, weaponName, weaponAffix, charAttrs, artisSets, artifacts, elem
  })

  const charBaseAttr = baseAttrMap[charName] || { hp: 14000, atk: 230, def: 700 }

  const attrs = buildAttrs(attrWeight, charBaseAttr)
  const posMaxMark = getMaxMark(attrs)
  const charCfg = { attrs, posMaxMark }

  const scoredArtifacts = artifacts.map((arti, i) => {
    const pos = arti.pos ?? i
    const score = getMark(charCfg, pos, arti, elem, charId)
    return {
      pos, mainKey: arti.mainKey, mainValue: arti.mainValue,
      subs: arti.subs, setName: arti.setName || '',
      score: Math.round(score * 10) / 10,
      grade: getMarkClass(score)
    }
  })

  const totalScore = scoredArtifacts.reduce((sum, a) => sum + a.score, 0)
  const avgScore = scoredArtifacts.length > 0 ? totalScore / scoredArtifacts.length : 0

  return {
    charName, title,
    totalScore: Math.round(totalScore * 10) / 10,
    avgScore: Math.round(avgScore * 10) / 10,
    totalGrade: getMarkClass(avgScore),
    artifacts: scoredArtifacts
  }
}

export function quickScore(charName, artifacts, options = {}) {
  return calcArtifactScore(charName, artifacts, options).totalScore
}

// ============================================================================
//  9. 单件普通评分与角色排行榜
// ============================================================================

/** 副词条中文别名 → key (大小属性严格区分) */
const SUBS_ALIAS = {
  // 百分比 (带%的属性)
  '暴击率': 'cpct', '暴击': 'cpct', 'cpct': 'cpct',
  '暴击伤害': 'cdmg', '爆伤': 'cdmg', 'cdmg': 'cdmg',
  '大攻击': 'atk', 'atk': 'atk',                              // 攻击力+5.8%
  '大防御': 'def', 'def': 'def',                              // 防御力+7.3%
  '大生命': 'hp', 'hp': 'hp',                                 // 生命值+5.8%
  '元素充能效率': 'recharge', '充能': 'recharge', 'recharge': 'recharge',
  // 固定值 (不带%的数字)
  '小攻击': 'atkPlus', 'atkPlus': 'atkPlus',                  // 攻击力+19
  '小防御': 'defPlus', 'defPlus': 'defPlus',                  // 防御力+23
  '小生命': 'hpPlus', 'hpPlus': 'hpPlus',                     // 生命值+299
  '元素精通': 'mastery', '精通': 'mastery', 'mastery': 'mastery' // 固定值
}

/** 固定主词条: pos0=花(hpPlus), pos1=羽(atkPlus) */
const FIXED_MAIN = { 0: 'hpPlus', 1: 'atkPlus' }

/** 主词条简称映射: 中文/别名 → key */
const MAIN_ALIAS = {
  // 沙漏
  '攻击': 'atk', '攻击力': 'atk', '大攻击': 'atk', 'atk': 'atk',
  '防御': 'def', '防御力': 'def', '大防御': 'def', 'def': 'def',
  '生命': 'hp', '生命值': 'hp', '大生命': 'hp', 'hp': 'hp',
  '精通': 'mastery', '元素精通': 'mastery', 'mastery': 'mastery',
  '充能': 'recharge', '元素充能效率': 'recharge', 'recharge': 'recharge',
  // 杯
  '火伤': 'pyro', '火元素伤害加成': 'pyro', 'pyro': 'pyro',
  '水伤': 'hydro', '水元素伤害加成': 'hydro', 'hydro': 'hydro',
  '冰伤': 'cryo', '冰元素伤害加成': 'cryo', 'cryo': 'cryo',
  '雷伤': 'electro', '雷元素伤害加成': 'electro', 'electro': 'electro',
  '风伤': 'anemo', '风元素伤害加成': 'anemo', 'anemo': 'anemo',
  '岩伤': 'geo', '岩元素伤害加成': 'geo', 'geo': 'geo',
  '草伤': 'dendro', '草元素伤害加成': 'dendro', 'dendro': 'dendro',
  '物伤': 'phy', '物理伤害加成': 'phy', 'phy': 'phy',
  // 头
  '暴击': 'cpct', '暴击率': 'cpct', 'cpct': 'cpct',
  '爆伤': 'cdmg', '暴击伤害': 'cdmg', 'cdmg': 'cdmg',
  '治疗': 'heal', '治疗加成': 'heal', 'heal': 'heal'
}

/**
 * 根据位置 + 主词条描述(中文/英文) → 解析出准确 key
 * 花(pos=0)和羽(pos=1)不需要传 main，自动识别
 */
function resolveMainKey(pos, main) {
  if (pos === 0 || pos === 1) return FIXED_MAIN[pos]
  if (!main) return ''
  return MAIN_ALIAS[main] || MAIN_ALIAS[main.toLowerCase()] || String(main)
}

/**
 * 计算单件圣遗物的普通评分与角色排行榜。
 *
 * arti.main 可用值, 花羽不传, 中英文均可:
 *   atk,大攻击  def,大防御  hp,大生命  mastery,精通  recharge,充能
 *   pyro,火伤  hydro,水伤  cryo,冰伤  electro,雷伤  anemo,风伤  geo,岩伤  dendro,草伤  phy,物伤
 *   cpct,暴击  cdmg,爆伤  heal,治疗
 *
 * arti.subs 可用 key, 中英文均可:
 *   cpct,暴击  cdmg,爆伤  atk,大攻击  def,大防御  hp,大生命  recharge,充能
 *   atkPlus,小攻击  defPlus,小防御  hpPlus,小生命  mastery,精通
 *
 * @param {object} arti
 * @param {number} arti.pos       0花 1羽 2沙 3杯 4头
 * @param {string} [arti.main]    主词条key
 * @param {number} arti.value     主词条数值
 * @param {object} arti.subs      副词条键值对
 * @param {object} [opts]
 * @param {number} [opts.topN=10] 返回前N个最匹配角色
 * @param {string} [opts.travelerElem] 指定旅行者元素；不传时取旅行者各元素最高分
 * @returns {{ score:number, characters:Array<{name:string,score:number}> }}
 *
 * @example
 * analyzeArtifact({ pos: 3, main: '火伤', value: 46.6, subs: { cpct: 10.5, cdmg: 7, mastery: 23, hp: 5.8 } })
 */
export function analyzeArtifact(artifact, options = {}) {
  const { pos = 0, main = '', value = 0, subs = {} } = artifact
  const { topN = 10, travelerElem = '' } = options

  const mainKey = resolveMainKey(pos, main)
  const mainValue = value
  // 副词条 key 标准化 (中文→英文)
  const normSubs = {}
  for (const [k, v] of Object.entries(subs)) {
    normSubs[SUBS_ALIAS[k] || k] = v
  }
  const arti = { pos, mainKey, mainValue, subs: normSubs }

  const charNames = Object.keys(usefulAttr)
  const allScores = []

  for (const charName of charNames) {
    const elems = charName === '旅行者'
      ? (travelerElem && travelerElements[travelerElem]
          ? [travelerElem]
          : Object.keys(travelerElements))
      : [charElemMap[charName] || '']

    let best = null
    for (const elem of elems) {
      const { attrWeight } = getAttrWeight(charName, { artifacts: [arti], elem })
      const baseAttr = baseAttrMap[charName] || { hp: 14000, atk: 230, def: 700 }
      const attrs = buildAttrs(attrWeight, baseAttr)
      const posMaxMark = getMaxMark(attrs)
      const raw = getMark({ attrs, posMaxMark }, arti.pos, arti, elem)
      const candidate = {
        name: charName === '旅行者' ? '旅行者（' + travelerElements[elem] + '）' : charName,
        score: Math.round(raw * 10) / 10
      }
      if (!best || candidate.score > best.score) best = candidate
    }
    if (best) allScores.push(best)
  }

  allScores.sort((a, b) => b.score - a.score)

  // 常规评分 = Top50% 均值
  const sorted = allScores.map(c => c.score).sort((a, b) => b - a)
  const half = sorted.slice(0, Math.ceil(sorted.length / 2))
  const score = half.length > 0
    ? Math.round(half.reduce((s, v) => s + v, 0) / half.length * 10) / 10
    : 0

  return {
    score,
    characters: allScores.slice(0, topN)
  }
}

export default {
  calcArtifactScore,
  quickScore,
  analyzeArtifact,
  getMarkClass,
  usefulAttr,
  charElemMap,
  attrMap,
  weaponCfg
}
`

  return template
}

function validateGeneratedModule(mod) {
  const requiredFunctions = ['calcArtifactScore', 'quickScore', 'analyzeArtifact', 'getMarkClass']
  for (const name of requiredFunctions) {
    if (typeof mod[name] !== 'function') throw new Error(`Missing export: ${name}`)
  }
  if (!mod.default?.usefulAttr || Object.keys(mod.default.usefulAttr).length === 0) {
    throw new Error('Generated character weights are empty')
  }
  if (!mod.default?.charElemMap || Object.keys(mod.default.charElemMap).length === 0) {
    throw new Error('Generated character element map is empty')
  }

  const traveler = '旅行者'
  const artifact = {
    pos: 2,
    mainKey: 'recharge',
    mainValue: 51.8,
    subs: { mastery: 93, recharge: 13, cpct: 3.9, cdmg: 7.8 }
  }
  const geo = mod.calcArtifactScore(traveler, [artifact], { elem: 'geo' })
  const electro = mod.calcArtifactScore(traveler, [artifact], { elem: 'electro' })
  if (geo.title === electro.title) throw new Error('Traveler element rules were not applied')

  const artifactInput = {
    pos: 2,
    main: '充能',
    value: 51.8,
    subs: artifact.subs
  }
  const analysis = mod.analyzeArtifact(artifactInput, {
    topN: Object.keys(mod.default.usefulAttr).length,
    travelerElem: 'geo'
  })
  const topTen = mod.analyzeArtifact(artifactInput, { topN: 10 })
  if (!Number.isFinite(analysis.score) || topTen.characters.length !== 10) {
    throw new Error('Artifact analysis smoke test failed')
  }
  if (!analysis.characters.some(item => item.name === '旅行者（岩）')) {
    throw new Error('Traveler ranking label smoke test failed')
  }
}

// ============================================================
//  Main
// ============================================================

async function main() {
  console.log('========================================')
  console.log('  Artifact Score Standalone Builder')
  console.log(`  Repo: yoimiya-kokomi/miao-plugin@${BRANCH}`)
  console.log('========================================\n')

  // ---- Phase 1: Core data files ----
  console.log('[1/5] Fetching core data files...')
  const [artisMarkText, extraText, weaponCfgText] = await Promise.all([
    fetchRaw('resources/meta-gs/artifact/artis-mark.js'),
    fetchRaw('resources/meta-gs/artifact/extra.js'),
    fetchRaw('models/artis/ArtisMarkCfg.js')
  ])

  if (!artisMarkText || !extraText || !weaponCfgText) {
    throw new Error('Failed to fetch core data files')
  }

  // ---- Phase 2: Parse core data ----
  console.log('\n[2/5] Parsing core data...')
  const usefulAttr = parseUsefulAttr(artisMarkText)
  console.log(`  usefulAttr: ${Object.keys(usefulAttr).length} characters`)

  const attrMapBase = parseExportValue(extraText, 'attrMap')
  const attrPct = parseExportValue(extraText, 'attrPct')
  const basicNum = parseExportValue(extraText, 'basicNum')
  const mainAttr = parseExportValue(extraText, 'mainAttr')
  const subAttr = parseExportValue(extraText, 'subAttr')
  console.log(`  attrMap: ${Object.keys(attrMapBase).length} stats`)
  console.log(`  basicNum: ${basicNum}`)

  const { weaponCfg, xifengRegex } = parseWeaponCfg(weaponCfgText)
  console.log(`  weaponCfg: ${Object.keys(weaponCfg).length} weapons`)

  // ---- Phase 3: Character data (concurrent) ----
  console.log(`\n[3/5] Fetching character data for ${Object.keys(usefulAttr).length} characters...`)
  const charNames = Object.keys(usefulAttr)
  let dataJsonFetched = 0, dataJsonFailed = 0
  let artisJsFetched = 0, artisJsSkipped = 0

  const baseAttrMap = {}
  const charElemMap = {}
  const artisDefaultWeights = {}
  const charRulesEntries = []

  // Build fetch tasks for all characters
  const tasks = charNames.map(name => async () => {
    const encoded = encodeURIComponent(name)

    // Fetch data.json
    const dj = await fetchJson(`resources/meta-gs/character/${encoded}/data.json`)
    if (dj?.['baseAttr']) {
      baseAttrMap[name] = dj['baseAttr']
      if (dj['elem']) charElemMap[name] = dj['elem']
      dataJsonFetched++
    } else {
      dataJsonFailed++
    }

    // Fetch artis.js
    const artisSrc = await fetchRaw(`resources/meta-gs/character/${encoded}/artis.js`)
    if (artisSrc) {
      artisJsFetched++
      const { code, defWeights } = transformArtisJs(artisSrc, name)
      if (code) {
        charRulesEntries.push(code)
      }
      if (defWeights) {
        artisDefaultWeights[name] = defWeights
      }
    } else {
      artisJsSkipped++
    }
  })

  // Run with limited concurrency
  await poolLimit(tasks, 15)

  console.log(`  data.json: ${dataJsonFetched} ok, ${dataJsonFailed} skipped`)
  console.log(`  artis.js:  ${artisJsFetched} found, ${artisJsSkipped} skipped`)
  console.log(`  artisDefaultWeights: ${Object.keys(artisDefaultWeights).length} entries`)
  console.log(`  charSpecialRules: ${charRulesEntries.length} entries`)

  // ---- Phase 4: Generate ----
  console.log('\n[4/5] Generating standalone file...')
  const output = generateStandalone({
    usefulAttr, baseAttrMap, charElemMap, attrMapBase, attrPct, basicNum,
    mainAttr, subAttr, weaponCfg, xifengRegex,
    artisDefaultWeights,
    charRulesCode: charRulesEntries.map(c => '  ' + c.replace(/\n/g, '\n  ')).join(',\n')
  })

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT, output, 'utf-8')
  console.log(`  Written: ${OUT} (${(output.length / 1024).toFixed(1)} KB)`)

  // ---- Phase 5: Validate ----
  console.log('\n[5/5] Validating...')
  try {
    const generatedModule = await import(`file://${OUT.replace(/\\/g, '/')}?t=${Date.now()}`)
    validateGeneratedModule(generatedModule)
    console.log('  Import OK')
    console.log('  API smoke tests OK')
  } catch (e) {
    console.error(`  Import FAILED: ${e.message}`)
    process.exit(1)
  }

  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) })
