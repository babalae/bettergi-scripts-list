// 游戏日与活动窗口判定（design §1 / §3.1）。
//
// 本文件**不认识配置文件**，也**不含任何时刻字面量**：入参是 config.toSegments() 摊平出来的
// 段数组与换日小时。4 点换日、10 点幽境、11/18 点全开全在全局 clocks 里，想纠正口径改配置即可。

import { DEFAULT_CLOCKS, fmtDate } from "./utils.js";

/** 日型判定顺序（design §1.5）。真实排期不会同日命中两类，录错时按此取靠前者 */
const KIND_ORDER = ["stygian", "leyline", "materials", "artifact"];

/** 给人看的名字，日志与通知直接念 reason，下游不再翻译一遍 */
const KIND_CN = {
  stygian: "幽境爆发期",
  leyline: "地脉移涌",
  materials: "盛材移涌",
  artifact: "祝圣移涌"
};
const CAT_CN = { weapon: "武器", talent: "天赋", artifact: "圣遗物" };

/** 游戏日 → 星期，1=周一 … 7=周日（§1.4：用折叠后的日期取星期，不是按时钟） */
function weekdayOf(y, m, d) {
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 ? 7 : wd;
}

/**
 * 把「此刻」折成游戏日。
 * 返回 `{ gameDay: "YYYY-MM-DD", weekday: 1–7 }`。只做「减掉换日小时再取日期」，不判活动。
 */
export function foldGameDay(now, dayStart) {
  const h = Number.isInteger(dayStart) ? dayStart : DEFAULT_CLOCKS.dayStart;
  const at = now instanceof Date ? now : new Date(now);
  const t = new Date(at.getTime() - h * 3600 * 1000);
  return {
    gameDay: fmtDate(t),
    weekday: weekdayOf(t.getFullYear(), t.getMonth() + 1, t.getDate())
  };
}

/**
 * 判定今天是什么日型（design §1.5 的顺序）。
 *
 * `now` 只用来和段的 `[fromMs, toMs)` 比时间戳——折叠成日期再比会给幽境起始日
 * 单独开一个特例，反而更容易错。`gameDay` 只用于输出与算星期。
 *
 * 段数组里的毛病（没勾、半截、倒置、多段、类别认不出）已经由 config.toSegments
 * 剔除并警告过了，这里只处理「段为空」和「全不命中」两种正常情形。
 *
 * 唯一会抛的是 `segments` 不是数组——那是调用方代码写错了，继续跑会用错日型。
 */
export function judgeDay(now, segments, dayStart) {
  if (!Array.isArray(segments)) {
    throw new Error("judgeDay 的 segments 必须是数组（由 config.toSegments 摊平后传入）");
  }
  const at = now instanceof Date ? now : new Date(now);
  const ms = at.getTime();
  const { gameDay, weekday } = foldGameDay(at, dayStart);

  if (!segments.length) {
    log.warn("全局配置没有可用的活动段，按普通日执行");
    return { kind: "normal", gameDay, weekday, hits: [], reason: "无可用的活动段，按普通日执行" };
  }

  // open 不进日型链（§1.2）：它可能与任何日型并存，只给 schedule 查
  const live = segments.filter((s) => s && typeof s === "object" && s.kind !== "open");
  const hitOf = (kind) => live.filter((s) => s.kind === kind && ms >= s.fromMs && ms < s.toMs);

  let picked = null;
  for (const kind of KIND_ORDER) {
    const hit = hitOf(kind);
    if (hit.length) {
      picked = { kind, hit };
      break;
    }
  }

  if (!picked) {
    return { kind: "normal", gameDay, weekday, hits: [], reason: gapNote(live, gameDay, ms) || "无活动，按普通日执行" };
  }

  // 同日命中多类只可能是录错：取顺序靠前的，其余忽略并警告（§1.7）
  const later = KIND_ORDER.slice(KIND_ORDER.indexOf(picked.kind) + 1).filter((k) => hitOf(k).length);
  if (later.length) {
    log.warn(`今日同时命中 ${[picked.kind].concat(later).map((k) => KIND_CN[k]).join(" / ")}，按 ${KIND_CN[picked.kind]} 执行，其余忽略`);
  }

  const cats = [];
  for (const seg of picked.hit) {
    if (seg.cat && cats.indexOf(seg.cat) === -1) cats.push(seg.cat);
  }
  const seg = picked.hit[0];
  const label = picked.kind === "materials"
    ? KIND_CN.materials + `（${cats.map((c) => CAT_CN[c] || c).join("·")}）`
    : KIND_CN[picked.kind];
  // lazy 段（勾了「禁用日期判定」）说清楚是「不看日期」，免得看日志以为日期填错了
  const lazy = picked.hit.some((s) => s && s.lazy === true);
  const tail = lazy
    ? (seg.from
      ? `（禁用日期判定，按版本期每天执行） ${shortMoment(seg.from)}～${shortMoment(seg.to)}`
      : "（禁用日期判定，每天执行）")
    : ` ${shortMoment(seg.from)}～${shortMoment(seg.to)}`;

  return {
    kind: picked.kind,
    gameDay,
    weekday,
    hits: cats,
    reason: `${label}${tail}`
  };
}

/**
 * 幽境起始日的缺口（§1.6）：今天就是爆发期首日，但还没到开启时刻。
 * 不写特例改日型，只在 reason 里说明一句——`kind` 仍是 normal，执行链不必知道这回事。
 * 时刻从段本身取（段已补过时刻），所以这里也没有字面量。
 */
function gapNote(live, gameDay, ms) {
  for (const s of live) {
    if (s.kind !== "stygian") continue;
    if (String(s.from).slice(0, 10) !== gameDay) continue;
    if (ms < s.fromMs) return `幽境爆发期今日 ${String(s.from).slice(11)} 开启，按普通日执行`;
  }
  return "";
}

/** "2026-11-11 10:00" → "11/11 10:00"；给日志看，不参与判定 */
function shortMoment(m) {
  const s = String(m === null || m === undefined ? "" : m);
  return s.length >= 16 ? `${s.slice(5, 7)}/${s.slice(8, 10)} ${s.slice(11, 16)}` : s;
}
