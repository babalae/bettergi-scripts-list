// 纯函数工具：日期、多段开放期判定、深合并。不碰文件、不碰游戏。

/**
 * 各类活动开闭时刻的**默认值**，单位是整点小时（design §4.2）。
 * 真正生效的值在全局配置的 `clocks` 段——这里只是「配置缺项 / 读不到」时的兜底。
 * 判定逻辑里不出现 04:00 / 10:00 / 11:00 这类字面量，时刻只有这一个来源。
 *
 * 语义（三条都必须记住）：
 *   `end` = **结束日该小时起关闭**，区间是半开的 `[起始日 start:00, 结束日 end:00)`
 *   起止同值（double 的 4 → 4）时窗口＝起始日 04:00 → 结束日 04:00，即跨满一天；
 *   **结束日必须晚于起始日**，两端写同一天会折成零长度，规范化时按空段报错
 *   `dayStart` = 游戏日换日小时（国服 04:00，规则篇 规则 1）
 */
export const DEFAULT_CLOCKS = {
  dayStart: 4,
  version: { start: 11, end: 6 },
  double: { start: 4, end: 4 },
  stygian: { start: 10, end: 4 },
  open: { firstStart: 11, secondStart: 18, end: 4 }
};
/** 没指定类型时按双倍口径（起始日 04:00 → 结束日 04:00），最接近「一整天」的直觉 */
const CLOCK_FALLBACK = DEFAULT_CLOCKS.double;

/** 允许 "YYYY-MM-DD" 与 "YYYY-MM-DD HH:mm"（空格或 T 分隔都认）；后者供手改 json 用 */
const MOMENT_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/;

/** 按游戏日换日小时把「此刻」折成游戏日；dayStart 缺省 04:00 */
export function gameNow(dayStart) {
  const h = Number.isInteger(dayStart) ? dayStart : DEFAULT_CLOCKS.dayStart;
  return new Date(Date.now() - h * 3600 * 1000);
}

/** 本地日期 -> "YYYY-MM-DD" */
export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 本地日期时间 -> "YYYY-MM-DD HH:mm" */
export function fmtMoment(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(d)} ${hh}:${mm}`;
}

export function today(dayStart) {
  return fmtDate(gameNow(dayStart));
}

/**
 * 解析日期（或手写的日期时间），返回 Date。
 * 只写了日期时按 clock 补整点，clock 形如 `{ start: 11, end: 6 }`（单位：小时）。
 * clock 不传就用双倍口径兜底——调用方有自己的时刻来源时**必须**传进来。
 * 格式错、日期不存在（2 月 30）、时刻越界都抛异常，绝不静默当成某天。
 */
export function parseMoment(s, which, clock) {
  const raw = String(s === null || s === undefined ? "" : s).trim();
  const m = MOMENT_RE.exec(raw);
  if (!m) throw new Error(`日期格式错误：「${s}」，应为 YYYY-MM-DD`);
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) {
    throw new Error(`日期不存在：「${s}」`);
  }
  if (m[4] !== undefined) {
    const h = Number(m[4]), mi = Number(m[5]);
    if (h > 23 || mi > 59) throw new Error(`时刻不存在：「${s}」`);
    dt.setHours(h, mi, 0, 0);
    return dt;
  }
  const c = clock || CLOCK_FALLBACK;
  const h = which === "end" ? c.end : c.start;
  dt.setHours(Number.isInteger(h) ? h : 0, 0, 0, 0);
  return dt;
}

/**
 * 校验并规范化每个日期段，返回 [{from, to, fromMs, toMs}]。
 * from / to 是补齐整点后的 "YYYY-MM-DD HH:mm"，给日志和界面看；
 * 判定一律用 *Ms 时间戳，避免「日期字符串比大小」的坑。
 * 区间半开：结束日 end 点之后不再算在期内。
 */
export function normalizePeriods(periods, label, clock) {
  const name = label || "模块";
  if (!Array.isArray(periods)) throw new Error(`${name} 的 periods 必须是数组`);
  const out = [];
  for (const p of periods) {
    if (!Array.isArray(p) || p.length !== 2) {
      throw new Error(`${name} 的 periods 里每一项必须是 [起始, 结束]，当前：${JSON.stringify(p)}`);
    }
    let from, to;
    try {
      from = parseMoment(p[0], "start", clock);
      to = parseMoment(p[1], "end", clock);
    } catch (e) {
      throw new Error(`${name} 第 ${out.length + 1} 段：${e.message}`);
    }
    if (from.getTime() >= to.getTime()) {
      throw new Error(`${name} 的日期段为空或起始晚于结束：${fmtMoment(from)} → ${fmtMoment(to)}`);
    }
    out.push({ from: fmtMoment(from), to: fmtMoment(to), fromMs: from.getTime(), toMs: to.getTime() });
  }
  return out;
}

/** 仅为对象做递归合并，数组整体覆盖（不做元素级合并） */
export function deepMerge(base, override) {
  if (override === null || override === undefined) return clone(base);
  if (Array.isArray(base) || Array.isArray(override)) return clone(override);
  if (typeof base !== "object" || typeof override !== "object") return clone(override);
  const out = {};
  for (const k of Object.keys(base)) out[k] = clone(base[k]);
  for (const k of Object.keys(override)) {
    out[k] = k in base ? deepMerge(base[k], override[k]) : clone(override[k]);
  }
  return out;
}

function clone(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(clone);
  if (typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) o[k] = clone(v[k]);
    return o;
  }
  return v;
}
