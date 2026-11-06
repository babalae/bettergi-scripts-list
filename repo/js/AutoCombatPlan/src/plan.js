// 决策（design §2 / §3.6）：只回答「下一步打什么」，不执行、不读盘、不碰游戏。
//
// 一条运行里要做的决定只有四种：今天从哪个阶段开始、双倍阶段打哪个本、
// 日常阶段打哪个本、地脉之后补不补补刷。这里全部做成纯函数，输入是已经算好的
// 日型、账户、已打列表与树脂快照，输出是一个「步骤描述符」——交给 main 去执行。
//
// 描述符里不带任何 BGI 参数名（那是 tasks 的事，§3.4），只带语义：
// `exhaust: true` 表示打到没树脂、`roundNum` 表示打几次。
// 这样三个副本的接口怎么变，都改在 tasks 一处。

import { rotationToday } from "./config.js";
import { domainCat, materialToDomain } from "./schedule.js";

/** 双倍次数兜底：全局配置里那一行缺失或非正数时用它（§2.3） */
const ROUNDS_DEFAULT = 3;

const KIND_CN = {
  stygian: "幽境爆发期",
  leyline: "地脉移涌",
  materials: "盛材移涌",
  artifact: "祝圣移涌",
  normal: "普通日"
};
const CAT_CN = { weapon: "武器", talent: "天赋", artifact: "圣遗物" };

/** 摊平结果里 `kind:"open"` 的那几段；缺项一律当没有 */
export function openSegmentsOf(cal) {
  const segs = cal && Array.isArray(cal.segments) ? cal.segments : [];
  return segs.filter((s) => s && s.kind === "open");
}

/**
 * 双倍次数：从段上取（`config.toSegments` 会把该行的 `rounds` 带下来）。
 * 取不到就用 3——写死一个兜底值，总比打成 0 轮回强。
 */
export function roundsOf(cal, kind, cat) {
  const segs = cal && Array.isArray(cal.segments) ? cal.segments : [];
  for (const s of segs) {
    if (!s || s.kind !== kind) continue;
    if (cat && s.cat && s.cat !== cat) continue;
    const n = Number(s.rounds);
    if (n >= 1) return n;
    break;
  }
  return ROUNDS_DEFAULT;
}

// ---------------------------------------------------------------------------
// 步骤描述符（§3.6）
// ---------------------------------------------------------------------------

/** 地脉：`count` 与 `exhaust` 二选一 */
function leylineStep(o) {
  const tag = o.tag;
  return {
    type: "leyline",
    tag,
    label: o.country ? `${o.flower}·${o.country}` : o.flower,
    reason: o.reason,
    params: o.exhaust
      ? { flower: o.flower, country: o.country, exhaust: true }
      : { flower: o.flower, country: o.country, count: o.count }
  };
}

/** 秘境：`roundNum` 与 `exhaust` 二选一；`pick` 恒为材料所属组号，无组本为 null */
function domainStep(o) {
  const cat = o.cat ? CAT_CN[o.cat] || o.cat : "";
  const params = {
    domain: o.domain,
    pick: o.pick === undefined ? null : o.pick,
    // 本的类型带到 tasks：圣遗物本不读奖励（`runDomain` 据此关 `RewardRecognitionEnabled`）
    cat: o.cat || ""
  };
  if (o.exhaust) params.exhaust = true;
  else params.roundNum = o.roundNum;
  return {
    type: "domain",
    tag: o.tag,
    label: cat ? `${cat}·${o.domain}` : o.domain,
    reason: o.reason,
    params
  };
}

/**
 * 幽境没有轮数概念（`BossNum` 决定打第几场，树脂次数由「指定用量」表达），
 * 所以只带 `boss`。§3.4 里写的 `rounds` 待接入时校正。
 */
function stygianStep(o) {
  return {
    type: "stygian",
    tag: "stygian",
    label: `幽境·第 ${o.boss} 场`,
    reason: o.reason,
    params: { boss: o.boss }
  };
}

// ---------------------------------------------------------------------------
// 阶段一：今天从哪开始（§2.1）
// ---------------------------------------------------------------------------

/**
 * 今天先跑哪个阶段。
 *
 * - `double`  —— 地脉 / 盛材 / 祝圣：先按次数吃双倍，结束再重读树脂进日常
 * - `stygian` —— 幽境日且角色养成材料不可打：今天只打幽境，之后照常进日常
 * - `daily`   —— 普通日，或幽境日但角色养成材料可打（今天让天赋/武器吃掉树脂，不出幽境）
 *
 * 注意幽境日那条是**二选一、不是串联**（§2.1 要点 2）：不存在「角色养成材料也打、幽境也打」。
 */
export function planFirstStage(ctx) {
  const kind = ctx && ctx.today && ctx.today.kind ? ctx.today.kind : "normal";
  if (kind === "stygian") {
    const p1 = materialsStep(ctx);
    if (p1.step) {
      return { stage: "daily", reason: "幽境日但角色养成材料可打：今日以天赋/武器消耗树脂，不打幽境" };
    }
    return { stage: "stygian", reason: `幽境日，角色养成材料不可打（${p1.skip}）→ 打幽境` };
  }
  if (kind === "normal") return { stage: "daily", reason: "普通日，直接进日常分析" };
  return {
    stage: "double",
    reason: `${KIND_CN[kind] || kind}，先按次数完成双倍，结束后重读树脂并进入日常`
  };
}

// ---------------------------------------------------------------------------
// 双倍阶段（§2.3）
// ---------------------------------------------------------------------------

/**
 * 双倍阶段打什么。**没有目标就不打**——不为了蹭满双倍换一个没配的本。
 * 返回 `{ step, skip }`，二者必有一个是 null。
 *
 * 三种日型的目标来源不同：地脉取 `account.leyline`、盛材取角色养成材料里今天这一类命中的
 * 那一条、祝圣取 `account.artifact`（固定套装，不走轮换，§5.4）。
 */
export function planDouble(ctx) {
  const today = ctx.today || {};
  const account = ctx.account || {};
  if (today.kind === "leyline") return planDoubleLeyline(ctx, account, today);
  if (today.kind === "materials") return planDoubleMaterials(ctx, account, today);
  if (today.kind === "artifact") return planDoubleArtifact(ctx, account, today);
  return { step: null, skip: `${KIND_CN[today.kind] || today.kind}没有双倍阶段` };
}

function planDoubleLeyline(ctx, account, today) {
  const ly = account.leyline || {};
  const flower = String(ly.type || "").trim();
  const country = String(ly.country || "").trim();
  if (!flower || !country) {
    return { step: null, skip: "账户未配置地脉花型或国家，放弃今日双倍" };
  }
  const count = roundsOf(ctx.cal, "leyline", "leyline");
  return {
    step: leylineStep({
      flower,
      country,
      count,
      tag: "double",
      reason: `地脉双倍按次数打 ${count} 次（不吃耗尽模式，§2.2）`
    }),
    skip: null
  };
}

function planDoubleMaterials(ctx, account, today) {
  const hits = Array.isArray(today.hits) ? today.hits : [];
  if (!hits.length) return { step: null, skip: "盛材日无可用类别（活动段 cat 无法识别），放弃双倍" };

  // 角色养成材料 → 候补：前者里今天这一类全不可打时才往后找（§2.3）
  const stages = [
    { name: "角色养成材料", list: Array.isArray(account.Materials) ? account.Materials : [] },
    { name: "角色养成材料（候补）", list: Array.isArray(account.MaterialsBackup) ? account.MaterialsBackup : [] }
  ];
  let firstClosed = "";
  let sawEntry = false;
  for (let si = 0; si < stages.length; si++) {
    const st = stages[si];
    for (const entry of st.list) {
      if (!entry || hits.indexOf(entry.kind) === -1) continue;
      sawEntry = true;
      const r = materialToDomain({
        target: entry.material,
        now: ctx.now,
        gameDay: today.gameDay,
        weekday: today.weekday,
        hits,
        openSegments: openSegmentsOf(ctx.cal)
      });
      if (r.ok && r.openNow) {
        const count = roundsOf(ctx.cal, "materials", entry.kind);
        const from = si === 0 ? "" : `${st.name}，`;
        return {
          step: domainStep({
            domain: r.domain,
            cat: entry.kind,
            pick: r.pick,
            roundNum: count,
            tag: "double",
            reason: `${CAT_CN[entry.kind] || entry.kind}双倍按次数打 ${count} 次（${from}${r.reason}）`
          }),
          skip: null
        };
      }
      if (!firstClosed) firstClosed = `${st.name}：${r.reason || entry.material + " 打不了"}`;
    }
  }
  return {
    step: null,
    skip: !sawEntry
      ? "角色养成材料与候补里没有今天这一类的条目，放弃双倍"
      : `角色养成材料与候补中今日无可用条目（${firstClosed}），放弃双倍`
  };
}

function planDoubleArtifact(ctx, account, today) {
  const art = account.artifact || {};
  const domain = String(art.domain || "").trim();
  if (!domain) return { step: null, skip: "账户未配置祝圣固定套装本，放弃今日双倍" };
  const count = roundsOf(ctx.cal, "artifact", "artifact");
  return {
    step: domainStep({
      domain,
      cat: "artifact",
      pick: null,
      roundNum: count,
      tag: "double",
      reason: `祝圣双倍按次数打 ${count} 次，打固定套装（不走轮换，§5.4）`
    }),
    skip: null
  };
}

// ---------------------------------------------------------------------------
// 幽境阶段（§2.1 二选一里的那一支）
// ---------------------------------------------------------------------------

/**
 * 幽境日且角色养成材料不可打时打幽境。
 * **没有轮数概念**：`BossNum` 只决定打第几场，树脂用量按耗尽语义走（§3.4）。
 * `stygian.boss` 为**空 = 该账号不使用幽境**，直接跳过；
 * 超出 1–3 的野值按第 1 场兜底。
 */
export function planStygian(ctx) {
  const account = ctx.account || {};
  const raw = account.stygian && account.stygian.boss;
  if (raw === "" || raw === undefined || raw === null) {
    return { step: null, skip: "账号未指定幽境场次（空 = 不使用幽境），跳过" };
  }
  const n = Number(raw);
  const boss = n >= 1 && n <= 3 ? Math.floor(n) : 1;
  return {
    step: stygianStep({
      boss,
      reason: "幽境日且角色养成材料不可打，今天打幽境（完成后剩余树脂照常进入日常）"
    }),
    skip: null
  };
}

// ---------------------------------------------------------------------------
// 日常阶段（§2.4）
// ---------------------------------------------------------------------------

/**
 * 日常阶段的下一步（§2.4 两阶段）。
 *
 * 阶段 1 命中就**只打它**，打完当日结束，不进阶段 2；阶段 1 全不可打才取轮换。
 * 返回里的 `rotate` 只在轮换这条路上有值：`basePlayed` 是「这一轮开始前的已打列表」
 * （已处理好「一轮走完清空」），**成功打完才**用它配 `markPlayed` 写盘（§4.4）。
 */
export function planDaily(ctx) {
  const p1 = materialsStep(ctx);
  if (p1.step) return { step: p1.step, source: "materials", rotate: null, skip: null };

  const account = ctx.account || {};
  const t = rotationToday(account.rotation, ctx.played);
  if (!t.target) {
    return { step: null, source: "none", rotate: null, skip: "轮换列表为空，今天没有目标" };
  }

  const step = entryStep(t.target, account, ctx.today);
  if (!step) {
    return {
      step: null,
      source: "rotation",
      rotate: null,
      skip: `轮换里取到的条目不可用（${JSON.stringify(t.target)}），今天没有目标`
    };
  }
  return {
    step,
    source: "rotation",
    rotate: { target: t.target, basePlayed: t.played, roundOver: t.roundOver },
    skip: null
  };
}

/** 角色养成材料（俗称优先级 1）：按顺序找第一条「日期对 + 库里有这个材料」的，只取这一条 */
function materialsStep(ctx) {
  const today = ctx.today || {};
  const account = ctx.account || {};
  const list = Array.isArray(account.Materials) ? account.Materials : [];
  if (!list.length) return { step: null, skip: "角色养成材料为空" };

  const openSegments = openSegmentsOf(ctx.cal);
  let firstReason = "";
  for (const entry of list) {
    // 空 kind / 空材料都是「还没填」的占位行，跳过。kind 单独判是因为面板允许把类型清空后
    // 留着一行（保存时不再丢），手改 json 也可能造出「有材料没类型」——那种行没有类别，
    // 打哪个本都说不清
    if (!entry || !entry.kind || !entry.material) continue;
    const r = materialToDomain({
      target: entry.material,
      now: ctx.now,
      gameDay: today.gameDay,
      weekday: today.weekday,
      hits: Array.isArray(today.hits) ? today.hits : [],
      openSegments
    });
    if (!r.ok) {
      // 库里没有 / 只写了本名：这是配置问题，换下一条也没用，但也不该因此判「今天没目标」
      if (!firstReason) firstReason = r.reason;
      continue;
    }
    if (!r.openNow) {
      if (!firstReason) firstReason = r.reason;
      continue;
    }
    return {
      step: domainStep({
        domain: r.domain,
        cat: domainCat(r.domain) || entry.kind,
        pick: r.pick,
        exhaust: true,
        tag: "daily",
        reason: `角色养成材料第 ${list.indexOf(entry) + 1} 条可打（${r.reason}），直至树脂耗尽`
      }),
      skip: null
    };
  }
  return { step: null, skip: firstReason || "角色养成材料里的条目今天都不可打" };
}

/** 轮换条目 → 步骤（只有两种形状，§4.3） */
function entryStep(entry, account, today) {
  if (entry.kind === "leyline") {
    const flower = String(entry.type || "").trim();
    const country = String(entry.country || "").trim();
    if (!flower || !country) return null;
    // 日常地脉**同样走耗尽模式**（`exhaust:true` → `IsResinExhaustionMode`，`Count` 给 0），
    // 不按次数停、由本体在树脂不足时自己停——与双倍阶段「按次数」正好相反（§2.3 / §2.4）。
    // 但地脉的耗尽不可靠（已知项：设了也不保证打完，会提前结束），所以打完要重读树脂，
    // 由 planFallback 判要不要补秘境（§2.5）
    return leylineStep({
      flower,
      country,
      exhaust: true,
      tag: "daily",
      reason: "轮换取到地脉：过程由本体自行停止，之后重读树脂决定是否补刷"
    });
  }
  if (entry.kind === "artifact") {
    const domain = String(entry.domain || "").trim();
    if (!domain) return null;
    return domainStep({
      domain,
      cat: "artifact",
      pick: null,
      exhaust: true,
      tag: "daily",
      reason: "轮换取到圣遗物：秘境耗尽模式，耗尽即结束当日"
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// 收尾补刷（§2.5）
// ---------------------------------------------------------------------------

/**
 * 只在「打完地脉 / 幽境、且重读树脂后还打得动」时调用（判据在 main 用 `spendable`）。
 * 补刷**不消耗轮换位**，打完就结束。
 *
 * 补刷副本不限圣遗物本：材料本要传组号才可控，组号取 `fallback.pick`；
 * 空则交给 BGI 自选那一组——补刷场景没有「材料」输入，脚本无从反查。
 * 没配本时 `account.fallback` 整段不存在。
 *
 * @param source 「地脉」/「幽境」——只用于 reason 文案，判定不看它
 */
export function planFallback(ctx, source) {
  const account = ctx.account || {};
  const fb = account.fallback && typeof account.fallback === "object" ? account.fallback : {};
  const domain = String(fb.domain || "").trim();
  if (!domain) return { step: null, skip: "账户未配置补刷本" };
  const cat = domainCat(domain);
  const isMaterial = cat === "talent" || cat === "weapon";
  return {
    step: domainStep({
      domain,
      cat,
      pick: isMaterial ? String(fb.pick || "") || null : null,
      exhaust: true,
      tag: "fallback",
      reason: `${source || "地脉"}未耗尽树脂，以秘境补尾（不占轮换位）`
    }),
    skip: null
  };
}

// ---------------------------------------------------------------------------
// 圣遗物分解（§3.7）
// ---------------------------------------------------------------------------

/**
 * 今天要不要执行圣遗物分解、按几星。
 *
 * 口径：**本日打过圣遗物本或幽境危战就拆**。圣遗物本不看 tag——轮换（daily）、
 * 双倍祝圣（double）、补刷（fallback）都算，判据统一看 `run.cat === "artifact"`
 * （三类步骤都由 `domainStep` 构造，cat 必带）；双倍地脉 / 盛材（cat 为空）不拆。
 *
 * 三道闸，任一不过就不拆：
 * ① `salvage.on === false`（账户 json，面板「其他」#3）；② `salvage.maxStar` 为空＝不限星级；
 * ③ 本日没打过圣遗物本、也没打幽境危战。
 *
 * @param runs 只含打成功的场次（`main.exec` 里 push，失败进 `failed` 不进这里）
 * @returns `{ on, star, reason? }`：`reason` **只在 `on:false` 时给**（跳过原因，日志用）；
 *          要拆时只回 `star`，不再解释「为什么拆」
 */
export function planSalvage(runs, account) {
  const sv = (account && account.salvage) || {};
  const star = String(sv.maxStar === undefined || sv.maxStar === null ? "" : sv.maxStar).trim();

  if (sv.on === false) {
    return { on: false, star, reason: "账户已关闭圣遗物分解（salvage.on=false）" };
  }
  if (!star) {
    return { on: false, star, reason: "未设星级上限（不限星级），不执行自动分解" };
  }

  const list = Array.isArray(runs) ? runs : [];
  const artifact = list.some((r) => r && r.cat === "artifact");
  const stygian = list.some((r) => r && r.tag === "stygian");
  if (!artifact && !stygian) {
    return { on: false, star, reason: "未执行圣遗物或幽境危战" };
  }
  // 要拆时不带 reason：日志只打星级，跳过时才需要解释
  return { on: true, star };
}

// ---------------------------------------------------------------------------
// 还打得动吗（requirement §0.1）
// ---------------------------------------------------------------------------

/** 浓缩 → 原粹，与游戏里自动支付的顺位一致 */
const RESIN_SEQ = ["condensed", "original"];

/**
 * 按树脂顺位还能不能付一次 20 树脂。
 * - `true`  打得动
 * - `false` 打不动了
 * - `null`  **判不了**（读数失败、或顺位里那一种没读到）——调用方按 §2.6 处理：
 *           地脉之后的补刷**无条件跑**，宁可多一趟空传送，也不要剩着树脂不用
 */
export function spendable(snap) {
  if (!snap || snap.ok !== true || !snap.resin) return null;
  for (const key of RESIN_SEQ) {
    const v = snap.resin[key];
    if (v === null || v === undefined || isNaN(Number(v))) return null;
    // 原粹按「够 20 才算一次」判，其它树脂按「有 1 个就算一次」
    if (key === "original" ? Number(v) >= 20 : Number(v) >= 1) return true;
  }
  return false;
}
