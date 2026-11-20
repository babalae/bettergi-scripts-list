// 双倍额度判据（design §3.3）——用途：判断「今天的双倍次数还剩几次 / 用完没有」。
//
// BGI 不告诉我们双倍还剩几次，只能拿「阶段开始」与「阶段结束」两次树脂读数相减，
// 按每轮 20 原粹折算成打了几次。**不记账、不落盘、不跨日累积**：漏跑一天只丢当天双倍。
//
// 只认原粹：双倍阶段全程只放原粹（§2.3 已定），浓缩/须臾/脆弱不参与折算。

/** 一轮秘境 / 一朵花的原粹消耗 */
const COST_PER_ROUND = 20;

/** 次数上限缺失或非正数时的兜底（与 §2.3、摊平层同一口径） */
export const ROUNDS_DEFAULT = 3;

/**
 * 「打满」的容差：跑动期间原粹会自然恢复（约 8 分钟 1 点），
 * 所以 3 次的实际差值常在 55～60 之间而非正好 60（requirement §0.1 的 ≥55 判据）。
 */
const TOLERANCE = 5;

/** 快照里取原粹；快照不可信就返回 null（`ok:false` 一律不算） */
function originalOf(snap) {
  if (!snap || snap.ok !== true || !snap.resin) return null;
  const v = snap.resin.original;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normRounds(rounds) {
  const n = Number(rounds);
  return n >= 1 ? Math.floor(n) : ROUNDS_DEFAULT;
}

/**
 * 双倍额度。
 *
 * @param begin 阶段开始前的 `collectResin()` 快照
 * @param end   阶段结束后的快照
 * @param rounds 全局配置里该行的双倍次数上限（缺失回落 3）
 * @returns {{used: number|null, total: number, exhausted: boolean, unknown: boolean, deltaOriginal: number|null}}
 *   `used`：折算打了几次（已按 `total` 截顶）；`unknown:true` 时 `used` 为 null，
 *   调用方**不得据此判断用完没用完**，按 §2.6 继续跑。
 */
export function quota(begin, end, rounds) {
  const total = normRounds(rounds);
  const a = originalOf(begin);
  const b = originalOf(end);

  if (a === null || b === null) {
    return { used: null, total, exhausted: false, unknown: true, deltaOriginal: null };
  }

  const delta = a - b;
  // 四舍五入吸收自然恢复的那点误差；负数（中途吃了树脂补给）一律按 0 次算
  const used = Math.max(0, Math.min(total, Math.round(delta / COST_PER_ROUND)));
  const need = total * COST_PER_ROUND - TOLERANCE;

  return {
    used,
    total,
    exhausted: delta >= need,
    unknown: false,
    deltaOriginal: delta
  };
}

/** 日志用的短句，例：「双倍 3/3（原粹差 58）」「双倍 ?/3（读数失败）」 */
export function summary(q) {
  if (!q || q.unknown) {
    return `双倍 ?/${(q && q.total) || ROUNDS_DEFAULT}（读数失败）`;
  }
  const mark = q.exhausted ? "已用完" : "未满";
  return `双倍 ${q.used}/${q.total}（${mark}，原粹差 ${q.deltaOriginal}）`;
}

/** 未满时的差额提示句（「原粹差 X < Y」），吃满 / 读数失败返回 null；判据只在本文件 */
export function underQuotaMsg(q) {
  if (!q || q.unknown || q.exhausted || q.deltaOriginal === null) return null;
  return `原粹差 ${q.deltaOriginal} < ${q.total * COST_PER_ROUND - TOLERANCE}`;
}
