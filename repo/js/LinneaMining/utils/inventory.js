import {openBag} from "../../../../packages/utils/tool"
import crystal_chunk from "../assets/images/crystal_chunk.png"
import amethyst_lump from "../assets/images/amethyst_lump.png"
import condessence_crystal from "../assets/images/condessence_crystal.png"
import rainbowdrop_crystal from "../assets/images/rainbowdrop_crystal.png"
import white_iron_chunk from "../assets/images/white_iron_chunk.png"
import iron_chunk from "../assets/images/iron_chunk.png"

const ORES = [
  { name: "水晶块", mat: crystal_chunk },
  { name: "紫晶块", mat: amethyst_lump },
  { name: "萃凝晶", mat: condessence_crystal },
  { name: "虹滴晶", mat: rainbowdrop_crystal },
  { name: "白铁块", mat: white_iron_chunk },
  { name: "铁块", mat: iron_chunk },
]

/**
 * 检测背包中各类矿石的数量
 * 流程: 打开背包 -> 切换素材页 -> 模板匹配矿石图标 -> OCR 读取数量
 *
 * @returns {Object} 各矿石数量，键为矿石中文名，无法识别的数量为 0
 */
async function getInventory() {
  await genshin.returnMainUi()
  await openBag()
  click(964, 53)
  await sleep(500)

  const result = Object.fromEntries(ORES.map(o => [o.name, 0]))
  const gameRegion = captureGameRegion()

  for (const ore of ORES) {
    const ro = RecognitionObject.TemplateMatch(ore.mat)
    ro.threshold = 0.8
    ro.UseMask = true
    const res = gameRegion.find(ro)

    if (!res.isEmpty()) {
      log.debug(`Found ${ore.name} at (${res.x}, ${res.y})`)

      const ocrRes = gameRegion.find(
        RecognitionObject.ocr(res.x, res.y + 120, 120, 40)
      )
      if (ocrRes) {
        if (!isNaN(count) && count >= 0) {
          result[ore.name] = count
        } else {
          log.warn(`OCR 识别矿石数量失败: ${ore.name}, 文本: ${ocrRes.text}`)
        }
      }
    }
  }

  gameRegion.dispose()
  await genshin.returnMainUi()
  return result
}

/**
 * 计算两次背包检测结果之间的矿石总增量
 *
 * @param {Object} current - 当前检测结果
 * @param {Object} previous - 之前检测结果
 * @returns {number} 总增量
 */
function calcYield(current, previous) {
  let total = 0
  for (const key of Object.keys(current)) {
    total += (current[key] || 0) - (previous[key] || 0)
  }
  return total
}

/**
 * 格式化矿石变化量为可读字符串
 * 仅输出有变化的矿石，无变化时返回 "无收获"
 *
 * @param {Object} current  - 当前检测结果
 * @param {Object} previous - 之前检测结果
 * @returns {string} 例如 "水晶块+5，萃凝晶+3"
 */
function formatYieldDiff(current, previous) {
  const parts = []
  for (const ore of ORES) {
    const diff = (current[ore.name] || 0) - (previous[ore.name] || 0)
    if (diff !== 0) {
      parts.push(`${ore.name}${diff > 0 ? "+" : ""}${diff}`)
    }
  }
  return parts.length > 0 ? parts.join("，") : "无收获"
}

/**
 * 格式化矿石数量为日志字符串
 *
 * @param {Object} inventory - 检测结果，键为矿石中文名
 * @returns {string} 例如 "水晶块10个，紫晶块5个"
 */
function formatInventory(inventory) {
  return ORES
    .filter(o => inventory[o.name] !== undefined)
    .map(o => `${o.name}${inventory[o.name]}个`)
    .join("，")
}

export {
  getInventory,
  calcYield,
  formatYieldDiff,
  formatInventory
}
