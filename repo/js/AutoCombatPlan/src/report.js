// 汇总与通知（design §2.8）——用途：一次运行只在**结束时**说一句话。
//
// 中间过程不发通知：只有「人必须知道、且知道后可能要去改配置」的才发（§2.8 的判据）。
// 日志与通知共用同一份文本（`log.info(render(ctx))`）；面板不读它，别指望改这里能改面板文案。
//
// 限制（BGI 硬约束）：单条 ≤500 字符、1 分钟最多 5 条、禁 HTML 与 URL。

/** 通知正文上限（BGI 硬约束） */
const TEXT_LIMIT = 500;

const KIND_CN = {
  stygian: "幽境日",
  leyline: "地脉日",
  materials: "盛材日",
  artifact: "祝圣日",
  normal: "普通日"
};

const WEEK_CN = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const TAG_CN = {
  double: "双倍",
  daily: "日常",
  fallback: "补刷",
  stygian: "幽境"
};

/** 只有原粹、浓缩有真上限；须臾上限随持有天数变、脆弱没有上限，都不写分母 */
const RESIN_CAP = { original: 200, condensed: 5 };

/**
 * 建一块可缺项的汇总板。**字段全部可缺**：某阶段没跑就不写，不造占位值
 * （`doubles` 缺 = 今天没有双倍阶段；`resin` 两项都是 null = 没读到）。
 */
export function createCtx(seed) {
  const s = seed || {};
  return {
    account: s.account || null,
    day: s.day || null,
    doubles: null,
    resin: { before: null, after: null, full: null },
    runs: [],
    failed: [],
    aborted: null
  };
}

function dayLine(ctx) {
  const d = ctx.day;
  if (!d) return "";
  const kind = KIND_CN[d.kind] || d.kind;
  const week = WEEK_CN[d.weekday] || "";
  let line = week ? `${kind}（${week}）` : kind;

  const parts = [];
  if (ctx.doubles) {
    parts.push(
      ctx.doubles.done === null || ctx.doubles.done === undefined
        ? `双倍 ?/${ctx.doubles.total}`
        : `双倍 ${ctx.doubles.done}/${ctx.doubles.total}`
    );
  }
  const before = ctx.resin && ctx.resin.before;
  const after = ctx.resin && ctx.resin.after;
  if (before !== null && before !== undefined && after !== null && after !== undefined) {
    parts.push(`树脂 ${before}→${after}`);
  } else if (before !== null && before !== undefined) {
    parts.push(`树脂 ${before}→?`);
  } else if (after !== null && after !== undefined) {
    parts.push(`树脂 ?→${after}`);
  }

  if (parts.length) line += `：${parts.join(" · ")}`;
  return line;
}

/** 单项：有上限写「12/200」，没上限写裸数字；读不到写「未知」，不写 NaN */
function countText(kind, value) {
  if (value === null || value === undefined) return "未知";
  const cap = RESIN_CAP[kind];
  return cap ? `${value}/${cap}` : String(value);
}

/**
 * 最终读数那次读的四项（reference §2.6.1）→ 两行。
 * `full` 缺（没开「结束后树脂通知」/ 当天没打成一场 / 读数失败）就一行不出，不造占位。
 * 须臾带剩余天数：数字没读到时天数也不写，免得出现「须臾 未知（余 5 天）」。
 */
function resinLines(ctx) {
  const full = ctx.resin && ctx.resin.full;
  if (!full) return [];
  const hasTransient = full.transient !== null && full.transient !== undefined;
  const days = hasTransient && full.days !== null && full.days !== undefined ? `（余 ${full.days} 天）` : "";
  return [
    `原粹 ${countText("original", full.original)} · 浓缩 ${countText("condensed", full.condensed)}`,
    `须臾 ${countText("transient", full.transient)}${days} · 脆弱 ${countText("fragile", full.fragile)}`
  ];
}

function runLine(run) {
  const tag = TAG_CN[run.tag] || run.tag || "";
  const rounds = run.rounds === null || run.rounds === undefined ? "" : ` ×${run.rounds}`;
  const tail = tag ? `（${tag}）` : "";
  return `· ${run.label}${rounds}${tail}`;
}

/** 首行。账号名可能为空（早退时还没读到昵称）：空就只剩「自动战斗计划」，不拖一个悬空的「·」 */
function headLine(c) {
  const name = c.account.name || c.account.uid || "";
  let head = name ? `自动战斗计划 · ${name}` : "自动战斗计划";
  if (c.failed && c.failed.length) head += " · 有失败";
  return head;
}

/**
 * 拼正文。缺哪段跳哪段；`aborted` 非空时只报中止原因，不列 `runs` / `failed`。
 * 超长的砍法见 `fit`：先砍 `runs`，再砍日型行细节与四项树脂行；`aborted` 行只在整句超限时截断。
 */
export function render(ctx) {
  const c = ctx || {};
  const lines = [];

  if (c.account) lines.push(headLine(c));

  if (c.aborted) {
    lines.push(`已中止：${c.aborted}`);
    return fit(lines.join("\n"), c);
  }

  const dl = dayLine(c);
  if (dl) lines.push(dl);
  lines.push(...resinLines(c));

  for (const run of c.runs || []) lines.push(runLine(run));
  for (const f of c.failed || []) lines.push(`✗ ${f.label}：${f.error}`);

  return fit(lines.join("\n"), c);
}

/** 超长时把 runs 收成一句「共 N 个目标」；还不够就去掉日型行里的细节段与四项树脂行 */
function fit(text, ctx) {
  if (text.length <= TEXT_LIMIT) return text;
  const c = ctx || {};

  // 中止时正文只有头部 + 中止原因两行，超长只能是原因本身太长：不重建行，最后才截断它
  if (c.aborted) {
    const ab = [];
    if (c.account) ab.push(headLine(c));
    ab.push(`已中止：${c.aborted}`);
    const out = ab.join("\n");
    return out.length <= TEXT_LIMIT ? out : out.slice(0, TEXT_LIMIT - 1) + "…";
  }

  const lines = [];

  if (c.account) lines.push(headLine(c));
  const dl = dayLine(c);
  if (dl) lines.push(dl);
  lines.push(...resinLines(c));
  const n = (c.runs || []).length;
  if (n) lines.push(`· 共 ${n} 个目标（明细见日志）`);
  for (const f of c.failed || []) lines.push(`✗ ${f.label}：${f.error}`);

  let out = lines.join("\n");
  if (out.length <= TEXT_LIMIT) return out;

  // 仍然超长：日型行去掉「：双倍 … · 树脂 …」那一段，四项树脂两行整块不出（明细见日志）
  const slim = [];
  if (c.account) slim.push(headLine(c));
  if (dl) slim.push(dl.split("：")[0]);
  if (n) slim.push(`· 共 ${n} 个目标（明细见日志）`);
  for (const f of c.failed || []) slim.push(`✗ ${f.label}：${f.error}`);
  out = slim.join("\n");

  return out.length <= TEXT_LIMIT ? out : out.slice(0, TEXT_LIMIT - 1) + "…";
}

/**
 * 发通知：有失败或中止走 `error()`，否则 `send()`。
 * 发送失败只记日志——通知发不出去不该影响「已经打完了」这件事。
 */
export function notify(ctx) {
  const text = render(ctx);
  const isError = !!((ctx && ctx.failed && ctx.failed.length) || (ctx && ctx.aborted));
  try {
    if (typeof notification === "undefined" || !notification) {
      log.warn("通知组件不可用，跳过发送");
      return text;
    }
    if (isError) {
      if (typeof notification.error === "function") notification.error(text);
      else notification.send(text);
    } else if (typeof notification.send === "function") {
      notification.send(text);
    }
  } catch (e) {
    log.error(`通知发送失败（不影响结果）：${e && e.message ? e.message : e}`);
  }
  return text;
}
