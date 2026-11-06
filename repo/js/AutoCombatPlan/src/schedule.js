// 材料 → 秘境 + 组号 + 今天能不能打（design §3.2）。
//
// 本本身天天开，轮换的是「今天出哪份材料」——所以要指定的是材料，不是星期。
// 只有天赋 / 武器两类有组；圣遗物与其它本天天开，没有组，根本进不来组号表。
//
// 组号既是「第几组材料」，也是全开时在秘境 UI 上选第几项（BGI 的 SundaySelectedValue）：
// 传组号，不让 BGI 自己挑，否则周日与全开期会挑错本。

const OPTIONS_FILE = "assets/options.json";

/** 组号 → 开放的游戏星期（1=周一 … 7=周日，与 gameclock 的 weekday 同一口径） */
export const GROUP_DAYS = {
  1: [1, 4],
  2: [2, 5],
  3: [3, 6]
};

const WEEK_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** 1–7 与 0–6 都认，只用于显示 */
export function weekName(day) {
  const d = Number(day);
  return WEEK_CN[d % 7] || `星期${day}`;
}

const CAT_CN = { weapon: "武器", talent: "天赋", artifact: "圣遗物" };

/** options.json 的 type → 日型细分。BlessDomain 是圣遗物本，天天开、无组 */
const TYPE_CAT = { MasteryDomain: "talent", ForgeryDomain: "weapon", BlessDomain: "artifact" };

/**
 * 读一次候选库。`assets/options.json` 是唯一数据源，**不在代码里抄表**——
 * 抄一份就有两个来源，官方加本时必有一边漏。
 * 读不到就回空并警告：排班算不出来属于「配置没就绪」，不该让整个脚本炸掉。
 */
function loadDb() {
  const domains = {};
  const openGroups = {};
  try {
    const raw = JSON.parse(file.readTextSync(OPTIONS_FILE));
    const list = Array.isArray(raw.domains) ? raw.domains : [];
    for (const d of list) {
      if (!d || !d.name) continue;
      domains[d.name] = {
        name: d.name,
        type: d.type || "",
        country: d.country || "",
        rewards: Array.isArray(d.rewards) ? d.rewards : []
      };
      if (d.groups && typeof d.groups === "object") {
        const g = {};
        for (const k of ["1", "2", "3"]) {
          if (d.groups[k]) g[Number(k)] = d.groups[k];
        }
        if (Object.keys(g).length) openGroups[d.name] = g;
      }
    }
  } catch (e) {
    log.warn(`${OPTIONS_FILE} 读取失败，排班表按空处理：${e && e.message ? e.message : e}`);
  }
  return { domains, openGroups };
}

/**
 * 候选库惰性读：模块顶层**不碰** `file`。
 *
 * 单文件产物只有一个 chunk，rollup 会把动态 import 进来的模块铺平到顶层——
 * 面板前端在浏览器里加载时，这里若直接 `loadDb()`，那里既没有 `file` 也没有 `log`，
 * 整页当场抛错。改成第一次用到才读，在线（node 侧）与离线（页面里）都能安全求值。
 * 读库的时机从「模块加载」挪到「第一次排班」，对调用方没有可见差别。
 */
let DB = null;
let MM = null;

function db() {
  if (!DB) DB = loadDb();
  return DB;
}

/** 秘境名 → 基本信息（类型 / 国家 / 奖励） */
function domains() {
  return db().domains;
}

/** 秘境名 → { 组号: 材料名 }，来自库里的 `groups` 字段，不手抄 */
function openGroups() {
  return db().openGroups;
}

/** 材料名 → { domain, group }：由组号表反推，配置里写材料也能直接认 */
function buildMaterialMap(of) {
  const m = {};
  for (const name of Object.keys(of)) {
    const sch = of[name];
    for (const g of [1, 2, 3]) {
      if (sch[g]) m[sch[g]] = { domain: name, group: g };
    }
  }
  return m;
}

function materialMap() {
  if (!MM) MM = buildMaterialMap(openGroups());
  return MM;
}

/** 本的类型：weapon / talent / artifact；认不出返回空串 */
export function domainCat(name) {
  const d = domains()[name];
  return d ? TYPE_CAT[d.type] || "" : "";
}

/** 今天是第几组。周日全开，没有「第几组」可言，返回 0；认不出的星期返回 -1 */
export function todayGroup(day) {
  const d = Number(day);
  if (d === 7 || d === 0) return 0;
  for (const g of [1, 2, 3]) {
    if (GROUP_DAYS[g].indexOf(d) !== -1) return g;
  }
  return -1;
}

/**
 * 把配置里的一个目标解析成 `{ name, material, group, known }`。
 *   known=true  —— 这个本在排班表里（天赋 / 武器），必须写材料名才能定位「今天出哪份」；
 *                  只写本名的 group 为 0，调用方按配置错误处理，不再放行。
 *   known=false —— 不在表里（圣遗物与其它天天开的本），写本名就是全部信息，group 恒 0。
 */
export function resolveTarget(raw) {
  const s = String(raw === null || raw === undefined ? "" : raw).trim();
  if (!s) return null;
  const hit = materialMap()[s];
  if (hit) return { name: hit.domain, material: s, group: hit.group, known: true };
  return { name: s, material: "", group: 0, known: Object.prototype.hasOwnProperty.call(openGroups(), s) };
}

/**
 * 目标是天赋 / 武器本却只写了本名 —— 排班表里查得到它，却不知道要哪份材料。
 * 这种情况只可能是配置没填全（每个版本都要重配一遍，不兼容旧写法）。
 */
export function needsMaterial(t) {
  return !!t && t.known === true && t.group === 0;
}

/** 失败一律走这里：`ok:false` + 一句原因，不猜本、不兜底到第一个本 */
function fail(reason) {
  return { ok: false, domain: "", group: null, pick: null, openNow: false, reason };
}

/** 今天是否落在某段限时全开期内；没有 open 段或 now 无效都算否 */
function hitOpen(openSegments, now) {
  if (!Array.isArray(openSegments) || !openSegments.length) return null;
  const at = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
  if (isNaN(at.getTime())) return null;
  const ms = at.getTime();
  for (const seg of openSegments) {
    if (!seg || seg.kind !== "open") continue;
    if (ms >= seg.fromMs && ms < seg.toMs) return seg;
  }
  return null;
}

/**
 * 材料 → 本名 + 组号 + 今天能不能打（design §3.2）。
 *
 * 入参全是纯数据：`gameDay` / `weekday` / `hits` 来自 `gameclock.judgeDay`，
 * `openSegments` 是摊平后 `kind:"open"` 的那几段。`now` 只用来和全开段比时间戳，
 * 不参与游戏日计算——那件事只由 gameclock 做。
 *
 * `doubleKind` 本函数**不用**：今天该优先打哪类本由编排层（§2）决定，
 * 这里只回答「这个本今天开不开」。
 *
 * 三条短路按序走（§3.2）：限时全开 → 移涌全开 → 星期与组号。
 * `pick` 恒为该材料在秘境 UI 的序号（= 材料所属组号），全开与否都要传，
 * 否则 BGI 会自己挑一个；圣遗物等无组本为 `null`。
 */
export function materialToDomain(input) {
  const s = input || {};
  const t = resolveTarget(s.target);
  if (!t) return fail("未指定目标");

  if (needsMaterial(t)) {
    return fail(`「${t.name}」是天赋 / 武器本，要写材料名——今天出哪份由组号定`);
  }
  if (!domains()[t.name]) {
    return fail(`未收录：「${String(s.target)}」不在 ${OPTIONS_FILE} 里`);
  }

  const cat = domainCat(t.name);
  const pick = t.group || null;
  const hasGroup = pick !== null;

  // ① 限时全开：整本放开，不看组号
  const op = hasGroup ? hitOpen(s.openSegments, s.now) : null;
  if (op) {
    return { ok: true, domain: t.name, group: "all", pick, openNow: true, reason: `限时全开 ${op.from}～${op.to}` };
  }

  // ② 移涌全开：只放开今天命中的那一类，别的类照旧按组号
  const hits = Array.isArray(s.hits) ? s.hits : [];
  if (hasGroup && cat && hits.indexOf(cat) !== -1) {
    return {
      ok: true,
      domain: t.name,
      group: "all",
      pick,
      openNow: true,
      reason: `${CAT_CN[cat] || cat}移涌期间全开`
    };
  }

  // ③ 无组的本（圣遗物等）天天开，不受排班限制
  if (!hasGroup) {
    return { ok: true, domain: t.name, group: "all", pick: null, openNow: true, reason: "该本不受组号限制" };
  }

  // ④ 按游戏日的星期查组
  const g = todayGroup(s.weekday);
  if (g === 0) {
    return { ok: true, domain: t.name, group: "all", pick, openNow: true, reason: "周日全开" };
  }
  if (g === pick) {
    return { ok: true, domain: t.name, group: pick, pick, openNow: true, reason: `组 ${pick} 今天开放` };
  }
  if (g < 0) {
    return { ok: true, domain: t.name, group: pick, pick, openNow: false, reason: `星期认不出（${s.weekday}），不判开放` };
  }
  return {
    ok: true,
    domain: t.name,
    group: pick,
    pick,
    openNow: false,
    reason: `今天开组 ${g}，该材料属组 ${pick}（${weekName(s.weekday)}）`
  };
}
