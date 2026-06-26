/**
 * 稳定的圣遗物展示辅助逻辑。
 *
 * 本文件刻意不依赖爬取到的 miao-plugin 数据。五星副词条档位表和展示规则
 * 足够稳定，适合放在这里维护；角色权重仍然保留在自动生成的评分模块中。
 */

const SUB_STAT_ROLLS = {
  hpPlus: [209.13, 239, 268.88, 298.75],
  hp: [4.08, 4.66, 5.25, 5.83],
  atkPlus: [13.62, 15.56, 17.51, 19.45],
  atk: [4.08, 4.66, 5.25, 5.83],
  defPlus: [16.2, 18.52, 20.83, 23.15],
  def: [5.1, 5.83, 6.56, 7.29],
  recharge: [4.53, 5.18, 5.83, 6.48],
  mastery: [16.32, 18.65, 20.98, 23.31],
  cpct: [2.72, 3.11, 3.5, 3.89],
  cdmg: [5.44, 6.22, 6.99, 7.77]
}

const AVG_ROLL_FACTOR = 0.85
const MAX_ESTIMATED_ROLLS = 6

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return 0
  const base = 10 ** digits
  return Math.round(value * base) / base
}

function getRollSums(rolls, count) {
  let sums = [{ sum: 0, combo: [] }]
  for (let idx = 0; idx < count; idx++) {
    const next = []
    for (const current of sums) {
      for (const roll of rolls) {
        next.push({
          sum: current.sum + roll,
          combo: [...current.combo, roll]
        })
      }
    }
    sums = next
  }
  return sums
}

/**
 * 估算副词条命中次数。
 *
 * 这里沿用 miao-plugin MysPanel 备用逻辑的思路：枚举合法档位组合，
 * 选择最接近最终显示数值的一组。BetterGI 只能看到最终值，因此命中次数
 * 是在所有可能次数中估算出来的。
 */
export function estimateSubStatRolls(key, value) {
  const rolls = SUB_STAT_ROLLS[key]
  if (!rolls || !Number.isFinite(value) || value <= 0) {
    return null
  }

  let best = null
  for (let count = 1; count <= MAX_ESTIMATED_ROLLS; count++) {
    for (const candidate of getRollSums(rolls, count)) {
      const error = Math.abs(candidate.sum - value)
      if (!best) {
        best = { count, value: candidate.sum, rolls: candidate.combo, error }
        continue
      }
      // 误差在 0 以内视为相近，优先取更保守的估计（更多次数）
      if (Math.abs(error - best.error) <= 0) {
        if (count > best.count) {
          best = { count, value: candidate.sum, rolls: candidate.combo, error }
        }
      } else if (error < best.error) {
        best = { count, value: candidate.sum, rolls: candidate.combo, error }
      }
    }
  }

  if (!best) return null
  const maxRoll = rolls[rolls.length - 1]
  return {
    count: best.count,
    effective: round(best.value / maxRoll / AVG_ROLL_FACTOR, 1),
    matchedValue: round(best.value, key.endsWith("Plus") || key === "mastery" ? 0 : 1),
    error: round(best.error, 2)
  }
}

export function getAttrUseState(weight = 0) {
  const value = Number(weight) || 0
  if (value >= 79.9) return "great"
  if (value > 0) return "useful"
  return "nouse"
}

export function formatScore(value) {
  if (!Number.isFinite(value)) return ""
  const rounded = round(value, 1)
  if (Math.abs(rounded) < 0.05) return ""
  return rounded.toFixed(1)
}

export function formatRollCount(estimate) {
  if (!estimate) return ""
  const count = Math.max(estimate.count - 1, 0)
  return count > 0 ? `≈${count}词` : ""
}

function cloneArtifactWithSubs(artifact, subs) {
  return {
    ...artifact,
    subs: { ...subs }
  }
}

function scoreOne(calcArtifactScore, charName, artifact, options) {
  const result = calcArtifactScore(charName, [artifact], options)
  return result.artifacts[0]?.score || 0
}

/**
 * 将单件圣遗物评分拆分为主词条和副词条贡献。
 *
 * 角色权重仍然来自自动生成的 miao 数据；这里仅复用当前评分器，
 * 并把偏展示侧的逻辑稳定地收拢在一起。
 */
export function getArtifactScoreBreakdown({
  calcArtifactScore,
  scoreData,
  charName,
  artifact,
  options = {}
}) {
  if (!charName || !artifact || typeof calcArtifactScore !== "function") {
    return null
  }

  const fullScore = scoreOne(calcArtifactScore, charName, artifact, options)
  const mainScore = scoreOne(
    calcArtifactScore,
    charName,
    cloneArtifactWithSubs(artifact, {}),
    options
  )
  const subs = artifact.subs || {}
  const weights = scoreData?.usefulAttr?.[charName] || {}
  const subDetails = Object.entries(subs).map(([key, value]) => {
    const reducedSubs = { ...subs }
    delete reducedSubs[key]
    const withoutScore = scoreOne(
      calcArtifactScore,
      charName,
      cloneArtifactWithSubs(artifact, reducedSubs),
      options
    )
    return {
      key,
      value,
      weight: weights[key] || 0,
      score: round(fullScore - withoutScore, 1)
    }
  })

  return {
    score: fullScore,
    main: {
      key: artifact.mainKey,
      weight: weights[artifact.mainKey] || 0,
      score: round(mainScore, 1)
    },
    subs: subDetails
  }
}
