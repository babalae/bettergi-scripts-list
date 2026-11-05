// 配置读写：三份文件、三种写者（design §4.1）
//   config/_global.json      纯时间表（版本 / 移涌四行 / 幽境 / 限时全开），面板写
//   config/{uid}.json        账户配置，面板写
//   config/{uid}.state.json  轮换已打列表（played），脚本独占写——面板只读来显示「本轮已打」
// 运行端合并顺序：默认模板 <- _global.json <- {uid}.json。只有这里碰文件。

import { DEFAULT_CLOCKS, deepMerge, normalizePeriods } from "./utils.js";

export const CONFIG_DIR = "config";
export const GLOBAL_FILE = `${CONFIG_DIR}/_global.json`;

/**
 * 「默认」模板账户。不是账号，是新建账号时照抄的那一份。
 * 用下划线开头：listAccounts 只认纯数字文件名，所以它天然不进账号列表，
 * 也不会被任何按 UID 遍历的地方误当成一个号去执行。
 */
export const TEMPLATE_UID = "_default";
export const TEMPLATE_FILE = `${CONFIG_DIR}/${TEMPLATE_UID}.json`;

export function configPath(uid) {
  return `${CONFIG_DIR}/${uid}.json`;
}

/** 运行状态（轮换已打列表）。面板 readonly，脚本独占写 */
export function statePath(uid) {
  return `${CONFIG_DIR}/${uid}.state.json`;
}

/**
 * 写盘前先把 config/ 建出来。
 * 首次跑的时候目录还不存在，直接 writeTextSync 会失败；createDirectory 在目录已存在时
 * 返回 true，所以每次无脑调它没有代价。
 */
export function ensureConfigDir() {
  let ok = false;
  try {
    ok = file.createDirectory(CONFIG_DIR);
  } catch (e) {
    ok = false;
  }
  if (!ok) throw new Error(`建不了配置目录 ${CONFIG_DIR}/，脚本目录可能没有写权限`);
  return true;
}

/** 统一的写盘口径：先保证目录、再写、结尾补一个换行。所有配置文件都走这里 */
function writeJson(p, obj) {
  ensureConfigDir();
  file.writeTextSync(p, JSON.stringify(obj, null, 2) + "\n", false);
  return p;
}

// ---------------------------------------------------------------------------
// 账户配置（{uid}.json，design §4.3）
// ---------------------------------------------------------------------------

/** 角色养成材料（俗称优先级 1）只收天赋 / 武器两类 —— 摩拉、经验书、圣遗物不进（requirement §5.1） */
export const PRIORITY1_KINDS = ["talent", "weapon"];

/** 圣遗物星级上限：空 = 不限，只认 1–4；BGI 参数要求字符串 */
export const ARTIFACT_STARS = ["", "1", "2", "3", "4"];

/**
 * 秘境组号（BGI 的 SundaySelectedValue）：材料本分 1/2/3 组，圣遗物本没有组。
 * 空 = 不指定，交给 BGI 自选；「其他」区的兜底副本用它指定打哪一组材料。
 */
export const DOMAIN_PICKS = ["", "1", "2", "3"];

/** 账号层默认（跟号有关的全部字段）。不含任何游戏名词，全部由面板填 */
export function defaultAccount(uid, name) {
  return {
    uid: String(uid || ""),
    name: name || "",
    /**
     * 队伍与战斗策略：**四行同构**，`global` 是默认值，场景行为空时逐字段回落它。
     * 现阶段只落 `global`；`leyline` / `stygian` / `domain` 三个场景键还没有入口，
     * 加的时候要同时改 `pickAccountFields`——它对 `teams` 是整段替换，白名单漏了会被清空。
     * `friendship` 只有 `global` 有（本体只在地脉参数给了 `FriendshipTeam`）。
     */
    teams: {
      global: {
        combat: "",
        friendship: "",
        /** 战斗配置：BGI 策略**文件名（带 .txt / .json）**，原样存；空 = 跟随 BGI 当前设置 */
        strategy: ""
      }
    },
    /** 双倍日打哪种花。日常打哪种花由轮换列表决定，两者互不覆盖 */
    leyline: { type: "", country: "" },
    /**
     * 角色养成材料：盛材移涌日、幽境日和普通日（符合日期时）优先挑战该条目首条。
     * **默认空列表**：新建账号与新增条目都给空行、不预选材料；
     * 模板里写了 Materials 就照模板；行 `material` 为空 = 占位，执行端跳过。
     */
    Materials: [],
    /** 角色养成材料（候补）：仅消耗双倍次数时使用（§2.3） */
    MaterialsBackup: [],
    /** 阶段 2：取用按完成模式，成功才写盘（.state.json） */
    rotation: [],
    /**
     * 圣遗物：`domain` = 祝圣移涌 #2 打哪个本。
     * 分解相关不在这里，见下面的 `salvage`。
     */
    artifact: { domain: "" },
    /**
     * 圣遗物分解（独立字段，与祝圣本无关）：
     * `on` = 要不要执行分解。**模板与种子都给 false**——分解不可逆，新号默认不拆；
     * 读盘时字段缺失仍按 true（`pickAccountFields`）。
     * `maxStar` = 全账号一套的分解星级上限，**新建与模板默认 "4"**，空串是「不限」。
     * 设了 `maxStar` 且本日打过圣遗物产出才真正会跑（planSalvage 三道闸，§3.7）。
     */
    salvage: { on: false, maxStar: "4" },
    /**
     * 地脉条目的收尾兜底副本（任意秘境，不限圣遗物）：
     * `domain` = 打哪个本；`pick` = 材料本打第几组（"1"–"3"，空 = 由 BGI 自选，圣遗物本不认）。
     * **`domain` 为空时整段不落盘**——没配兜底就没有这个键，不留半截。
     */
    fallback: { domain: "", pick: "" },
    /** 幽境打第几场；**空 = 不使用幽境**；开放期取全局 */
    stygian: { boss: "" },
    /**
     * 全部战斗结束后要不要再读一次树脂，把真值写进通知。
     * **模板与种子都给 false**（新号默认不读，省一次界面往返）；字段缺失时读盘仍按 true。
     */
    resinAfterRun: false
  };
}

/**
 * 角色养成材料列表清洗（Materials / MaterialsBackup 同一套）：kind 只到 talent / weapon，
 * 顺序即优先，空材料留着交给校验拦。
 *
 * **空 kind 也留着**：面板上把「类型」清空后那一行仍在列表里（`ui/src/store.js` 的 `cleanList`
 * 也保留它），保存后重开必须还是那一行——所见即所得。跳过它是执行侧的事，`plan` 里空 kind
 * 直接 `continue`。kind 写了别的值（手改 json 写错）才丢，那是真认不出。
 */
function cleanPriorityList(list) {
  const out = [];
  for (const it of Array.isArray(list) ? list : []) {
    if (!it || typeof it !== "object") continue;
    const kind = String(it.kind || "").trim();
    if (kind && PRIORITY1_KINDS.indexOf(kind) < 0) continue;
    out.push({ kind, material: String(it.material === undefined || it.material === null ? "" : it.material).trim() });
  }
  return out;
}

/**
 * 轮换列表清洗。**键序由这里统一生成**——`played` 与 `rotation` 靠 JSON.stringify 判「同一条」，
 * 手改 json 换了键序会被当成不同条目（可接受，最坏多轮一次）。
 * 半截条目（地脉没填国家、圣遗物没填本名）留着不清——面板保存前会拦（界面篇 §5.3）。
 */
function cleanRotation(list) {
  const out = [];
  for (const it of Array.isArray(list) ? list : []) {
    if (!it || typeof it !== "object") continue;
    const kind = String(it.kind || "").trim();
    if (kind === "leyline") {
      out.push({ kind, type: str(it.type), country: str(it.country) });
    } else if (kind === "artifact") {
      out.push({ kind, domain: str(it.domain) });
    }
  }
  return out;
}

/** 星级上限：只认空或 "1"–"4" 字符串，其余（含 "5"）收敛成空 */
function cleanStar(v) {
  const s = str(v);
  return ARTIFACT_STARS.indexOf(s) >= 0 ? s : "";
}

/** 组号：只认 "1"–"3"，空表示不指定 */
function cleanPick(v) {
  const s = str(v);
  return DOMAIN_PICKS.indexOf(s) >= 0 ? s : "";
}

function str(v) {
  return String(v === undefined || v === null ? "" : v).trim();
}

/** 双倍次数上限：面板输入框 max 同一个值，保存时也按它挡一道 */
export const ROUNDS_MAX = 99;

/** 限时全开最多两段（design §4.2） */
export const MAX_OPEN_SEGMENTS = 2;

/**
 * 写账号文件时只写账号层字段，别把全局字段抄进每个号。
 * 只按结构生成，认不出的键不会被抄进来。
 */
export function pickAccountFields(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  return {
    uid: str(c.uid),
    name: c.name || "",
    teams: {
      global: {
        combat: str(c.teams && c.teams.global && c.teams.global.combat),
        friendship: str(c.teams && c.teams.global && c.teams.global.friendship),
        strategy: str(c.teams && c.teams.global && c.teams.global.strategy)
      }
    },
    leyline: {
      type: str(c.leyline && c.leyline.type),
      country: str(c.leyline && c.leyline.country)
    },
    Materials: cleanPriorityList(c.Materials),
    MaterialsBackup: cleanPriorityList(c.MaterialsBackup),
    rotation: cleanRotation(c.rotation),
    artifact: {
      domain: str(c.artifact && c.artifact.domain)
    },
    salvage: {
      // 只有明确写成 false 才关；缺字段 / 其它任何值都当 true
      on: !(c.salvage && c.salvage.on === false),
      maxStar: cleanStar(c.salvage && c.salvage.maxStar)
    },
    fallback: { domain: str(c.fallback && c.fallback.domain), pick: cleanPick(c.fallback && c.fallback.pick) },
    stygian: { boss: cleanBoss(c.stygian && c.stygian.boss) },
    // 只有明确写成 false 才关；缺字段按开
    resinAfterRun: !(c.resinAfterRun === false)
  };
}

function cleanBoss(v) {
  // 空 = 不使用幽境；1–3 原样，认不出的值不兜回 1
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  return n >= 1 && n <= 3 ? Math.floor(n) : "";
}

/** 全局层的键。账号文件与模板里绝不能出现，否则每个号都背着一份全局数据 */
export const GLOBAL_KEYS = ["versions", "activeVersion", "clocks", "ui"];

// ---------------------------------------------------------------------------
// 时刻表（clocks，design §4.2）—— 全局唯一时刻来源
// ---------------------------------------------------------------------------

/**
 * 全局配置里的 `clocks`：所有开闭时刻都写在这里，判定逻辑里不出现任何字面量。
 * 单位是**整点小时**（0–23）。想改时刻（比如官方把幽境改成 10:30 之外的口径、
 * 或者我们理解错了换日时间）只改配置，不改代码。
 *
 * 三条语义：
 *   `end` = **结束日该小时起关闭**，即半开区间 `[起始日 start:00, 结束日 end:00)`；
 *   `start === end`（如 double 的 4/4）= 从起始日该点开到结束日同一点，跨满一天；
 *   前提是结束日**晚于**起始日，两端同一天会折成零长度、按空段报错；
 *   `open` 有两个起点：首期祈愿 11:00、二期祈愿 18:00（规则篇 规则 14）。
 */
/** 0–23 的整数才算合法时刻，其余一律回落到默认值 */
function hourOf(v, def) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : def;
}

function spanOf(v, def) {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  return { start: hourOf(o.start, def.start), end: hourOf(o.end, def.end) };
}

/** 把任意输入收成完整 clocks：缺项补默认、坏值回落默认，不抛异常（读盘要能容错） */
export function normalizeClock(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const op = o.open && typeof o.open === "object" && !Array.isArray(o.open) ? o.open : {};
  const d = DEFAULT_CLOCKS;
  return {
    dayStart: hourOf(o.dayStart, d.dayStart),
    version: spanOf(o.version, d.version),
    double: spanOf(o.double, d.double),
    stygian: spanOf(o.stygian, d.stygian),
    open: {
      firstStart: hourOf(op.firstStart, d.open.firstStart),
      secondStart: hourOf(op.secondStart, d.open.secondStart),
      end: hourOf(op.end, d.open.end)
    }
  };
}

/** 取某份全局配置的 clocks，缺了就用默认——任何时候都返回完整对象 */
export function clockOf(g) {
  return normalizeClock(g && g.clocks);
}

/**
 * 面板外观（全局配置的 ui 段）。目前只有主题一项。
 * 不放 settings.json：那是 BGI 设置表单的「定义」，值存在配置组里，面板既读不到也写不回。
 * 也不参与判定与校验——外观不该拦住保存，读盘缺了就给默认。
 */
export const UI_THEME_DEFAULT = "dark";
export const UI_THEMES = ["dark", "light"];

export function normalizeUi(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const t = String(o.theme || "");
  return { theme: UI_THEMES.indexOf(t) >= 0 ? t : UI_THEME_DEFAULT };
}

/** "YYYY-MM-DD" 加 n 天；格式不对返回空串，由调用方当「推不出来」处理 */
function addDays(dateStr, n) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str(dateStr));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 二期祈愿恒在版本起始日 +20 天开启（规则篇 规则 14） */
export const SECOND_WISH_OFFSET_DAYS = 20;

/**
 * 限时全开某一段用哪个起点小时：首期 11:00、二期 18:00。
 * 判法：段起点 == 版本起始日 → 首期；== 版本起始日 +20 天 → 二期；
 * 推不出来（版本期没填、或日期对不上）→ 按段序兜底（第 1 段首期、第 2 段二期）+ 警告。
 */
function openClockFor(clocks, startDate, versionStart, index, onWarn) {
  const o = clocks.open;
  const clock = { start: o.firstStart, end: o.end };
  if (versionStart) {
    if (startDate === versionStart) return clock;
    if (startDate === addDays(versionStart, SECOND_WISH_OFFSET_DAYS)) {
      return { start: o.secondStart, end: o.end };
    }
  }
  if (index !== 0) clock.start = o.secondStart;
  if (onWarn) {
    onWarn(
      versionStart
        ? `限时全开第 ${index + 1} 段（${startDate}）既不是版本起始日、也不是 +${SECOND_WISH_OFFSET_DAYS} 天，按${index === 0 ? "首期" : "二期"}口径补时刻`
        : `版本起始日没填，限时全开第 ${index + 1} 段（${startDate}）按${index === 0 ? "首期" : "二期"}口径补时刻`
    );
  }
  return clock;
}

/**
 * 老形状搬迁（幂等）：`teams.{combat,friendship}` 两个字符串 + 顶层 `strategy`
 * → `teams.global.{combat,friendship,strategy}`。已经是新形状就原样吐回来。
 *
 * 必须放在 `deepMerge(模板, 全局, 账号)` **之后**：模板给一半、账号给一半时，
 * 合并结果会同时带 `teams.combat` 与 `teams.global`，只有这里能收干净。
 * 新形状优先：两处都有值时取 `global` 里的。
 */
function migrateTeams(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const t = src.teams && typeof src.teams === "object" && !Array.isArray(src.teams) ? src.teams : {};
  const g = t.global && typeof t.global === "object" ? t.global : {};
  /** 新形状有非空值就用它，否则退回老键 */
  const pick = (a, b) => (typeof a === "string" && a !== "" ? a : typeof b === "string" ? b : "");
  return {
    global: {
      combat: pick(g.combat, t.combat),
      friendship: pick(g.friendship, t.friendship),
      strategy: pick(g.strategy, src.strategy)
    }
  };
}

/** 整份账号的搬迁入口：把 `teams` 换成新形状，其余键原样带走 */
function migratedAccount(acc) {
  const a = acc && typeof acc === "object" && !Array.isArray(acc) ? acc : {};
  return Object.assign({}, a, { teams: migrateTeams(a) });
}

/**
 * 账号落盘口径：**白名单清洗已知字段，黑名单剔全局键，其余原样带走**。
 * 未知键不丢（面板以后加的字段不用回来改这里），代价是历史脏键也会一直留着。
 */
function accountOut(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const k of Object.keys(src)) {
    if (GLOBAL_KEYS.indexOf(k) < 0) out[k] = src[k];
  }
  // 老形状（teams.combat + 顶层 strategy）先搬成 teams.global；已是新形状则是恒等变换
  out.teams = migrateTeams(out);
  // 顶层 strategy 已搬进 teams.global，不再落键（老存档里那份在这里消失）
  delete out.strategy;
  // 已知字段整体换成清洗后的值：leyline / stygian / resin 段里的多余子键一并消失
  const known = pickAccountFields(out);
  for (const k of Object.keys(known)) out[k] = known[k];
  // 树脂顺序已无配置入口，旧存档的键不随白名单带下去
  delete out.resinOrder;
  // 兜底副本没选本 = 没配：整段不落键，否则会留下 {domain:"",pick:"2"} 这种半截
  if (!out.fallback || !str(out.fallback.domain)) delete out.fallback;
  return out;
}

/** 写账号文件：清洗结构后落盘 */
export function saveConfig(uid, cfg) {
  const out = accountOut(cfg);
  out.uid = String(uid);
  return writeJson(configPath(uid), out);
}

// ---------------------------------------------------------------------------
// 运行状态（{uid}.state.json，design §4.4）—— 本脚本唯一写盘的状态
// 存「已打」不存「剩余」：打完是加法，增删条目不会和它混淆。
// ---------------------------------------------------------------------------

/**
 * 读已打列表。文件不存在 / 读坏 → `[]`（首跑即一整轮的开头），不报错。
 * **只读不写**：写盘只发生在「成功打完」那一刻。
 *
 * 返回**数组**，不要包一层对象——`rotationToday` / `markPlayed` 要的就是这个数组，
 * 中间隔一层的话调用方容易把整包当数组递下去（`cleanRotation` 对非数组一律当空，
 * 结果就是「已打列表永远为空、轮换永远从第一条开始」，而且静态看起来一切正常）。
 */
export function loadState(uid) {
  const p = statePath(uid);
  if (!fileExists(p)) return [];
  let raw = null;
  try {
    raw = readJson(p, "轮换状态");
  } catch (e) {
    log.warn(`轮换状态读取失败，按整轮重新开始：${e && e.message ? e.message : e}`);
    return [];
  }
  return raw && Array.isArray(raw.played) ? cleanRotation(raw.played) : [];
}

/**
 * 成功结束才调它：把当日目标追加进 `played` 后写盘（调用方拿 §4.4.1 的 `markPlayed`）。
 * 写盘前剔掉「轮换列表里已找不到 / 超出出现次数」的项，文件不会越攒越长。
 * 文件里留 `played` 这个键（给人和面板看都明确），但读进来的只有一个数组。
 */
export function saveState(uid, played, rotation) {
  return writeJson(statePath(uid), { played: prunePlayed(played, rotation) });
}

/** 在 rotation 里按顺序找第一条「还没打够次数」的条目，返回下标；-1 = 本轮已走完 */
export function nextRotationIndex(rotation, played) {
  const rot = cleanRotation(rotation);
  const done = countBy(cleanRotation(played));
  const seen = {};
  for (let i = 0; i < rot.length; i++) {
    const k = keyOf(rot[i]);
    seen[k] = (seen[k] || 0) + 1;
    // 按出现次数比：`[A, A, B]` 打完一个 A 后，第二个 A 仍算没打
    if ((done[k] || 0) < seen[k]) return i;
  }
  return -1;
}

/**
 * 当日目标（design §4.4.1）。纯函数：给 rotation 与 played，返回今天打哪条。
 * 返回的 `played` 已经处理好「一轮走完就清空」，调用方成功后才拿它去 saveState。
 * `target` 为空表示轮换列表为空（不是「已走完」——那种情况会自动清空重来）。
 */
export function rotationToday(rotation, played) {
  const rot = cleanRotation(rotation);
  if (!rot.length) return { target: null, index: -1, played: [], roundOver: false };
  let done = prunePlayed(played, rot);
  let idx = nextRotationIndex(rot, done);
  const roundOver = idx < 0;
  if (roundOver) {
    done = [];
    idx = 0;
  }
  return { target: rot[idx], index: idx, played: done, roundOver };
}

/** 打完一条：把目标追加进 played（不改入参） */
export function markPlayed(played, target) {
  const out = cleanRotation(played);
  if (target) out.push(cleanRotation([target])[0] || target);
  return out;
}

/** 剔掉 rotation 里已不存在、或超出 rotation 出现次数的项；rot 省略时只做去脏不成型 */
function prunePlayed(played, rotation) {
  const done = cleanRotation(played);
  const rot = cleanRotation(rotation);
  if (!rot.length) return done;
  const limit = countBy(rot);
  const used = {};
  const out = [];
  for (const d of done) {
    const k = keyOf(d);
    const cap = limit[k] || 0;
    if (!cap) continue; // 这条已被用户从轮换列表删掉
    used[k] = (used[k] || 0) + 1;
    if (used[k] > cap) continue; // 超出轮换列表里的出现次数
    out.push(d);
  }
  return out;
}

function keyOf(item) {
  return JSON.stringify(item);
}

function countBy(list) {
  const bag = {};
  for (const it of list) {
    const k = keyOf(it);
    bag[k] = (bag[k] || 0) + 1;
  }
  return bag;
}

// ---------------------------------------------------------------------------
// 全局配置（_global.json，design §4.2）
// ---------------------------------------------------------------------------

/** 版本号限定 x.x，两侧各 1~2 位数字 */
export const VERSION_RE = /^(\d{1,2})\.(\d{1,2})$/;

/** 版本号比大小：6.10 排在 6.2 之后，10.1 排在 6.x 之前 */
export function versionNum(k) {
  const m = VERSION_RE.exec(String(k || ""));
  return m ? Number(m[1]) * 100 + Number(m[2]) : -1;
}

/**
 * 今天落在哪个版本的日期里。只认真的填了日期段的版本，没填的一律不参与判定。
 * 命中多个取编号最大的（最新那版）；一个都不命中返回空串，由调用方保持原来的选择。
 * **只给面板显示「当前版本」用**——日型判定不读它（design §1.3）。
 */
export function resolveVersion(g) {
  if (!g || typeof g !== "object") return "";
  const vs = g.versions;
  if (!vs || typeof vs !== "object") return "";
  const clock = clockOf(g).version;
  let best = "";
  let bestNum = -1;
  for (const k of Object.keys(vs)) {
    const segs = (vs[k] || {}).periods;
    if (!Array.isArray(segs) || !segs.length) continue;
    let hit = false;
    try {
      hit = periodsHit(segs, clock);
    } catch (e) {
      hit = false; // 日期写坏了，当没命中，不拦整张表
    }
    if (!hit) continue;
    const n = versionNum(k);
    if (n > bestNum) {
      bestNum = n;
      best = k;
    }
  }
  return best;
}

/** 首次生成全局文件时预置的版本号 */
export const DEFAULT_VERSION = "7.3";

/** 全局层默认：预置一版 7.3，四行移涌齐、日期全空、时刻用默认口径 */
export function defaultGlobal() {
  const versions = {};
  versions[DEFAULT_VERSION] = {
    periods: null,
    doubles: makeDoubles(),
    stygian: { enabled: false, daily: false, periods: null, bosses: ["", "", ""] },
    open: { on: [], periods: null }
  };
  return {
    activeVersion: DEFAULT_VERSION,
    versions: versions,
    clocks: normalizeClock(DEFAULT_CLOCKS),
    ui: normalizeUi(null)
  };
}

/**
 * 移涌四行，行数固定、顺序固定，不让人增删（design §4.2）。
 * 盛材移涌是官方一个活动，但天赋（精通秘境）与武器（炼武秘境）是两类副本：
 * 开放规则相同、副本种类不同，所以分开两行建模。
 * id 直接等于类别名：版本之间、增删顺序都不会错位，下游可以直接按它做键。
 */
export const DOUBLE_CATS = [
  { cat: "leyline", name: "地脉移涌", scope: "leyline" },
  { cat: "weapon", name: "盛材移涌（武器素材）", scope: "domain" },
  { cat: "talent", name: "盛材移涌（天赋素材）", scope: "domain" },
  { cat: "artifact", name: "祝圣移涌（圣遗物）", scope: "domain" }
];

/** 认出一行属于哪一类：只认 cat / id 里的现名，认不出返回空串（该行按没配处理） */
function catOf(d) {
  const raw = str(d && (d.cat || d.id));
  return DOUBLE_CATS.some((x) => x.cat === raw) ? raw : "";
}

/**
 * 新建版本时的四行骨架：默认不勾、次数 3、日期不填。
 * 认不出的 `cat`（如 `material` 合并类）按没配处理——跳过 + 警告，不猜。
 */
export function makeDoubles() {
  return DOUBLE_CATS.map((c) => ({
    id: c.cat,
    cat: c.cat,
    scope: c.scope,
    enabled: false,
    daily: false,
    rounds: 3,
    periods: null
  }));
}

/**
 * 把某版本的 doubles 收成固定四行，顺序按 DOUBLE_CATS。
 * 同一类别写重复时取先填的那份，别让后一行的空值盖掉前面；认不出类别的行直接丢，
 * 不按行号去对号——写错 cat 就该看见它消失，而不是被悄悄挪到别的行上。
 */
export function normalizeDoubles(list) {
  const old = Array.isArray(list) ? list : [];
  const bag = {};
  old.forEach((d) => {
    if (!d || typeof d !== "object") return;
    const c = catOf(d);
    if (!c) return;
    const t = bag[c];
    if (!t) {
      bag[c] = Object.assign({}, d);
      return;
    }
    if (d.enabled === true) t.enabled = true;
    if (d.daily === true) t.daily = true;
    if (!Array.isArray(t.periods) || !t.periods.length) {
      if (Array.isArray(d.periods) && d.periods.length) t.periods = d.periods;
    }
    if (!(Number(t.rounds) >= 1) && Number(d.rounds) >= 1) t.rounds = d.rounds;
  });
  return DOUBLE_CATS.map((c) => {
    const d = bag[c.cat] || {};
    const r = Number(d.rounds);
    return {
      id: c.cat,
      cat: c.cat,
      scope: c.scope,
      // 默认不勾：勾了才要求日期，没勾的整行不参与执行
      enabled: d.enabled === undefined ? false : !!d.enabled,
      // 每天：勾上就不看日期，天天都算，与填日期互斥（四行移涌 + 幽境里只能勾一个）
      daily: d.daily === true,
      rounds: r >= 1 ? r : 3,
      periods: d.periods === undefined ? null : d.periods
    };
  });
}

/**
 * 幽境那一节：只认显式勾选。
 * 缺 `enabled` 一律按「不勾」读——日期留着但不生效；要跑就在面板里勾上。
 */
function normalizeStygian(sy) {
  const o = sy && typeof sy === "object" && !Array.isArray(sy) ? sy : {};
  return {
    enabled: o.enabled === true,
    // 每天：勾上就不看日期，优先于 periods；日期字段原样留着，不清空
    daily: o.daily === true,
    periods: o.periods === undefined ? null : o.periods,
    /**
     * 三场怪物名：随版本保存，只用来给面板「幽境场次」下拉显示 `1·<名字>`，
     * 不参与执行。存够三串、缺的补空，多出来的截掉。
     */
    bosses: bossList(o.bosses)
  };
}

/** 幽境三场名字：固定三串，trim，非字符串一律当空 */
export const BOSS_SLOTS = 3;

function bossList(v) {
  const arr = Array.isArray(v) ? v : [];
  const out = [];
  for (let i = 0; i < BOSS_SLOTS; i += 1) out.push(str(arr[i]));
  return out;
}

/**
 * 限时全开（design §4.2）：**不产生活动日**，只给日常分析判「今天天赋/武器本能不能打」，
 * 所以没有 rounds、也不参与「只能勾一个」的互斥。最多两段。
 */
function normalizeOpen(op) {
  const o = op && typeof op === "object" && !Array.isArray(op) ? op : {};
  /** 每段一个开关（版式稿 #5/#6 各一个勾），按下标与 `periods` 对齐 */
  const on = Array.isArray(o.on) ? o.on.map((x) => x === true) : [];
  return {
    on,
    // 超两段原样留着——读盘时静默截断等于偷偷吃掉用户填的东西
    periods: o.periods === undefined ? null : o.periods
  };
}

/**
 * 一个版本的完整骨架：缺什么补什么，认不出的字段原样留着。
 * 写盘前走一遍，生成的文件就是齐全的，不会出现「有的版本有 periods、有的没有」。
 */
function normalizeVersion(v) {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const out = Object.assign({}, o);
  out.periods = o.periods === undefined ? null : o.periods;
  out.doubles = normalizeDoubles(o.doubles);
  out.stygian = normalizeStygian(o.stygian);
  out.open = normalizeOpen(o.open);
  return out;
}

export function assignVersionIds(g) {
  if (!g || typeof g !== "object") return g;
  const vs = g.versions;
  if (!vs || typeof vs !== "object") return g;
  for (const k of Object.keys(vs)) {
    vs[k] = normalizeVersion(vs[k]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 配置 → 段数组（design §3.1）—— 判定层唯一的输入
// ---------------------------------------------------------------------------

/**
 * 双倍次数：取该行的 `rounds`，缺失或非正数回落 3（§2.3）。
 */
function roundsOfRow(d) {
  const n = Number(d && d.rounds);
  if (!(n >= 1)) return 3;
  return n > ROUNDS_MAX ? ROUNDS_MAX : Math.floor(n);
}

/**
 * 把全局配置摊平成**纯日期段数组**，交给 `gameclock.judgeDay(now, segments)`。
 *
 * 判定函数不认识 versions / doubles / enabled / rounds / activeVersion 任何结构，
 * 也不含任何时刻字面量；配置里的结构毛病（没勾、半截、倒置、双倍多段）全在这一层消化掉。
 * 换了时刻口径（全局 clocks）或判断规则，改配置即可，不用碰判定代码。
 *
 * 输出：`{ dayStart, segments: [{ kind, cat, from, to, fromMs, toMs, rounds, lazy }] }`
 *   kind   : stygian / leyline / materials / artifact / open（顺序按 design §1.5）
 *   cat    : 细分（weapon / talent 都归 materials，靠 cat 区分 hits）
 *   from/to: "YYYY-MM-DD HH:mm"（已补整点，给人看）
 *   *Ms    : 判定用时间戳，**半开区间 `[fromMs, toMs)`**
 *   rounds : 双倍次数上限（只对移涌四行有意义，其余为 null）；缺失或非正数回落 3
 *   lazy   : 该行勾了「禁用日期判定」，段区间取自版本期而非自己的日期（给人看，判定层不用）
 */
export function toSegments(g, onWarn) {
  const warn = typeof onWarn === "function" ? onWarn : (m) => log.warn(m);
  const clocks = clockOf(g);
  const vs = g && g.versions && typeof g.versions === "object" && !Array.isArray(g.versions) ? g.versions : {};
  const out = [];

  /** 取首段；多段/半截/形状不对都在这里降级成「跳过」并说一声，不抛 */
  const firstSeg = (periods, label) => {
    if (!Array.isArray(periods) || !periods.length) return null;
    if (periods.length > 1) warn(`${label} 填了 ${periods.length} 段，业务上只有一段，取第一段、忽略其余`);
    const s = periods[0];
    if (!Array.isArray(s) || s.length !== 2) {
      warn(`${label} 第 1 段不是 [起始, 结束]，跳过`);
      return null;
    }
    const a = str(s[0]);
    const b = str(s[1]);
    if (!a || !b) {
      warn(`${label} 第 1 段只填了一端，跳过`);
      return null;
    }
    return [a, b];
  };

  const add = (kind, cat, periods, clock, label, rounds) => {
    const seg = firstSeg(periods, label);
    if (!seg) return;
    try {
      const n = normalizePeriods([seg], label, clock)[0];
      out.push({ kind, cat, from: n.from, to: n.to, fromMs: n.fromMs, toMs: n.toMs, rounds: rounds || null });
    } catch (e) {
      // normalizePeriods 的 message 已带 label，不再重复拼
      warn(e && e.message ? e.message : `${label} 无法解析`);
    }
  };

  /**
   * 懒人段：勾了「禁用日期判定」的行不看自己填的日期，按**版本期**整段当这种日型——
   * 「懒得填活动日期，但游戏里这期已经开了」的用法，版本一换自动失效。
   * 版本期没填就给一段不限日期的区间兜底并说一声，免得界面勾了却不生效。
   */
  const addLazy = (kind, cat, verPeriods, rounds, tag) => {
    const clock = { start: clocks.dayStart, end: clocks.dayStart };
    const p = Array.isArray(verPeriods) && Array.isArray(verPeriods[0]) ? verPeriods[0] : null;
    const a = str(p && p[0]);
    const b = str(p && p[1]);
    if (a && b) {
      try {
        const n = normalizePeriods([[a, b]], tag, clock)[0];
        out.push({ kind, cat, from: n.from, to: n.to, fromMs: n.fromMs, toMs: n.toMs, rounds: rounds || null, lazy: true });
        return;
      } catch (e) {
        warn(`${tag} 的版本期 ${a}～${b} 无法解析，按不限日期处理`);
      }
    } else {
      warn(`${tag} 勾了「禁用日期判定」但版本期没填，按不限日期处理`);
    }
    out.push({
      kind,
      cat,
      from: "",
      to: "",
      fromMs: -Number.MAX_SAFE_INTEGER,
      toMs: Number.MAX_SAFE_INTEGER,
      rounds: rounds || null,
      lazy: true
    });
  };

  for (const k of Object.keys(vs)) {
    const v = vs[k] && typeof vs[k] === "object" ? vs[k] : {};
    const label = (name) => `版本 ${k} 的${name}`;

    // 幽境：勾了「禁用日期判定」按版本期天天算幽境期，否则看自己的开放期
    const sy = v.stygian;
    if (sy && typeof sy === "object" && sy.enabled === true) {
      if (sy.daily === true) {
        addLazy("stygian", "stygian", v.periods, null, label("幽境开放期"));
      } else if (!Array.isArray(sy.periods) || !sy.periods.length) {
        warn(label("幽境开放期") + " 已启用但没填日期，跳过");
      } else {
        add("stygian", "stygian", sy.periods, clocks.stygian, label("幽境开放期"));
      }
    }

    // 移涌四行：按 DOUBLE_CATS 顺序遍历，认不出的行丢掉（写错 cat 就该看不见它）
    const list = Array.isArray(v.doubles) ? v.doubles : [];
    for (const d of list) {
      if (!d || typeof d !== "object") continue;
      if (d.enabled !== true) continue;
      const cat = catOf(d);
      if (!cat) {
        warn(`版本 ${k} 有一行移涌的类别认不出，跳过`);
        continue;
      }
      const kind = cat === "leyline" ? "leyline" : cat === "artifact" ? "artifact" : "materials";
      const tag = label(`${cat} 移涌`);
      // 勾了「禁用日期判定」：不看这一行的日期，版本期内天天算这一天型
      if (d.daily === true) {
        addLazy(kind, cat, v.periods, roundsOfRow(d), tag);
        continue;
      }
      if (!Array.isArray(d.periods) || !d.periods.length) {
        warn(`${tag} 已启用但没填日期，跳过`);
        continue;
      }
      add(kind, cat, d.periods, clocks.double, tag, roundsOfRow(d));
    }

    // 限时全开：每段起点不同（首期 11:00 / 二期 18:00），按 规则篇 规则 14 推
    const op = v.open;
    // 每段一个开关
    const openOn = op && typeof op === "object" && Array.isArray(op.on) ? op.on : [];
    if (op && typeof op === "object" && openOn.some((x) => x === true)) {
      if (!Array.isArray(op.periods) || !op.periods.length) {
        warn(label("限时全开") + " 已启用但没填日期，跳过");
      } else {
        const verStart = Array.isArray(v.periods) && Array.isArray(v.periods[0]) ? str(v.periods[0][0]) : "";
        // 限时全开机制上只有首期 / 二期两段；第 3 段起只可能来自手改存档，说一声再丢，不静默吃掉
        for (let i = MAX_OPEN_SEGMENTS; i < openOn.length; i++) {
          if (openOn[i] === true) warn(label(`限时全开第 ${i + 1} 段`) + " 超出两段上限（首期 / 二期），忽略");
        }
        op.periods.slice(0, MAX_OPEN_SEGMENTS).forEach((s, i) => {
          if (openOn[i] !== true) return;   // 这一段没勾，不参与判定
          const tag = label(`限时全开第 ${i + 1} 段`);
          if (!Array.isArray(s) || s.length !== 2) {
            warn(`${tag} 不是 [起始, 结束]，跳过`);
            return;
          }
          const a = str(s[0]);
          const b = str(s[1]);
          if (!a || !b) {
            warn(`${tag} 只填了一端，跳过`);
            return;
          }
          const clock = openClockFor(clocks, a, verStart, i, warn);
          try {
            const n = normalizePeriods([[a, b]], tag, clock)[0];
            out.push({ kind: "open", cat: "open", from: n.from, to: n.to, fromMs: n.fromMs, toMs: n.toMs, rounds: null });
          } catch (e) {
            warn(e && e.message ? e.message : `${tag} 无法解析`);
          }
        });
      }
    }
  }

  // 判定顺序（design §1.5）：幽境先判，时刻问题最早暴露；全开不在日型链上，排最后
  const rank = { stygian: 0, leyline: 1, materials: 2, artifact: 3, open: 4 };
  out.sort((a, b) => (rank[a.kind] - rank[b.kind]) || (a.fromMs - b.fromMs));

  return { dayStart: clocks.dayStart, segments: out };
}

export function exists(uid) {
  return fileExists(configPath(uid));
}

function readJson(p, what) {
  if (!fileExists(p)) throw new Error(`${what}不存在：${p}`);
  const txt = file.readTextSync(p);
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error(`${what}解析失败：${p}（${e}）`);
  }
}

/**
 * 读全局配置。文件不存在就写一份默认的并提示——空版本不会把体力打错地方，
 * 跟账号文件「找不到就中止」的处理相反。
 */
export function loadGlobal() {
  if (!fileExists(GLOBAL_FILE)) {
    const def = defaultGlobal();
    writeJson(GLOBAL_FILE, def);
    log.warn(`已生成全局默认配置 ${GLOBAL_FILE}，请先在配置面板里新建一个版本并填日期。`);
    return def;
  }
  const g = readJson(GLOBAL_FILE, "全局配置");
  if (!g || typeof g !== "object" || Array.isArray(g)) {
    throw new Error(`全局配置结构不对（应为对象）：${GLOBAL_FILE}`);
  }
  if (!g.versions || typeof g.versions !== "object" || Array.isArray(g.versions)) g.versions = {};
  assignVersionIds(g);
  // 缺 clocks：读盘时按默认补上（写盘校验要求写对，读盘只求能跑）
  g.clocks = normalizeClock(g.clocks);
  // 缺 ui：同样补默认，缺主题不影响任何判定
  g.ui = normalizeUi(g.ui);
  return g;
}

/** 写全局配置：补齐 id 与默认段后落盘 */
export function saveGlobal(cfg) {
  assignVersionIds(cfg);
  cfg.clocks = normalizeClock(cfg.clocks);
  cfg.ui = normalizeUi(cfg.ui);
  return writeJson(GLOBAL_FILE, cfg);
}

/**
 * 只改主题，不碰其他字段、也不走整表校验——外观设置不该被别处的半截输入挡住。
 * 前提是 _global.json 已存在：面板模式下 init 一定先读过它。
 */
export function setUiTheme(theme) {
  const t = String(theme || "");
  if (UI_THEMES.indexOf(t) < 0) throw new Error(`认不出的主题「${theme}」`);
  const g = loadGlobal();
  g.ui = normalizeUi({ theme: t });
  return writeJson(GLOBAL_FILE, g);
}

/**
 * 只改 activeVersion，不碰其他字段。
 * 走 saveGlobal 会带上整表校验，版本没填日期时切不动——切换动作本身不该被别处的半截输入挡住。
 */
export function setActiveVersion(v) {
  const g = loadGlobal();
  const key = String(v || "");
  if (!g.versions || !g.versions[key]) throw new Error(`版本「${key || "空"}」不存在，未切换`);
  g.activeVersion = key;
  writeJson(GLOBAL_FILE, g);
  return key;
}

// ---------------------------------------------------------------------------
// 三层合并
// ---------------------------------------------------------------------------

/** 读账号原始内容；不存在抛异常，由调用方决定怎么办 */
export function loadRaw(uid) {
  return readJson(configPath(uid), "配置文件");
}

/**
 * 账户侧统一收敛：合并结果里跑一遍清洗，认不出的键不参与执行。
 * 全局段（versions / activeVersion）补回去——运行端从同一个 cfg 里读日型表。
 */
function settleAccount(uid, merged) {
  const cfg = accountOut(merged);
  cfg.versions = merged.versions;
  cfg.activeVersion = merged.activeVersion;
  // 时刻表一并带上：运行端 toSegments(cfg) 需要它，别让下游再读一次文件
  cfg.clocks = clockOf(merged);
  cfg.uid = String(uid);
  return cfg;
}

/** 三层合并后的最终配置：**默认模板** <- _global.json <- {uid}.json */
export function loadConfig(uid) {
  const g = loadGlobal();
  const raw = loadRaw(uid);
  // **每层先各自搬成新形状再合并**：模板和账号若一个新一个老，直接合会同时出现
  // `teams.global.combat` 与 `teams.combat`，搬迁时按「谁优先」判不清，账号值会被模板盖掉
  const merged = deepMerge(deepMerge(migratedAccount(loadTemplate()), g), migratedAccount(raw));
  return settleAccount(uid, merged);
}

/** 面板用：只取三层合并结果，不抛「文件不存在」 */
export function readForPanel(uid) {
  const g = loadGlobal();
  let raw = {};
  if (fileExists(configPath(uid))) {
    try {
      raw = readJson(configPath(uid), "配置文件");
    } catch (e) {
      raw = {};
    }
  }
  // **每层先各自搬成新形状再合并**：模板和账号若一个新一个老，直接合会同时出现
  // `teams.global.combat` 与 `teams.combat`，搬迁时按「谁优先」判不清，账号值会被模板盖掉
  const merged = deepMerge(deepMerge(migratedAccount(loadTemplate()), g), migratedAccount(raw));
  return { cfg: settleAccount(uid, merged), global: g };
}

/** 列出 config/ 下的 UID（纯数字文件名），_global.json 与 {uid}.state.json 都被排除 */
export function listAccounts() {
  let arr = [];
  try {
    arr = Array.from(file.readPathSync(CONFIG_DIR));
  } catch (e) {
    return [];
  }
  const uids = [];
  for (const p of arr) {
    try {
      if (file.isFolder(p)) continue;
    } catch (e) {
      continue;
    }
    const base = String(p).replace(/\\/g, "/").split("/").pop();
    if (!/\.json$/i.test(base)) continue;
    const uid = base.replace(/\.json$/i, "");
    if (/\.state$/i.test(uid)) continue; // 运行状态不是账号
    if (/^\d+$/.test(uid)) uids.push(uid);
  }
  return uids.sort();
}

export function listAccountsWithName() {
  return listAccounts().map((uid) => {
    let name = "";
    try {
      name = String(loadRaw(uid).name || "");
    } catch (e) {
      name = "";
    }
    return { uid, name };
  });
}

/** 调度器的设置页定义。它的 select 选项是写死的数组，没有动态来源，只能由脚本重写 */
export const SETTINGS_FILE = "settings.json";

/**
 * 让设置页里的「UID」跟着 config/ 的账号走：把该项改成 select，选项＝现有账号。
 *
 * 重写文件的原因：settings.json 的 `options` 只能是静态字符串数组，BGI 不提供
 * 「从别处取选项」的写法。所以账号一有增减，就在这里把这份定义重写一次；
 * BGI 在下次读到这份定义时才看到新选项，面板开着的这一刻不会变。
 *
 * uid 是否合法（9 位纯数字）由调用方把关，这里只负责把已有账号列进选项。
 * `current` 排第一：面板刚按 OCR 建出来 / 认出来的号，通常就是要点开的那一个。
 *
 * 读不出来、不是数组、找不到 uid 项：一律只警告不动手。拿不准就保持原样，
 * 好过写一份坏的设置页出来。
 */
export function syncUidOptions(current) {
  const cur = /^\d+$/.test(str(current)) ? str(current) : "";
  const order = [];
  if (cur) order.push(cur);
  for (const u of listAccounts()) if (order.indexOf(u) < 0) order.push(u);
  if (!order.length) return "";

  let form = null;
  try {
    const parsed = JSON.parse(String(file.readTextSync(SETTINGS_FILE) || ""));
    if (Array.isArray(parsed)) form = parsed;
  } catch (e) {
    log.warn(`settings.json 读取失败，跳过 UID 下拉同步：${e && e.message ? e.message : e}`);
    return "";
  }
  if (!form) {
    log.warn("settings.json 不是数组，跳过 UID 下拉同步");
    return "";
  }

  const item = form.filter((x) => x && x.name === "uid")[0];
  if (!item) {
    log.warn("settings.json 里没有 uid 这一项，跳过 UID 下拉同步");
    return "";
  }

  // 选项、类型、默认值都一致就不写盘：面板每开一次都调它，不做无意义的文件重写
  const same =
    item.type === "select" &&
    item.default === order[0] &&
    Array.isArray(item.options) &&
    item.options.length === order.length &&
    item.options.every((v, i) => String(v) === order[i]);
  if (same) return "";

  item.type = "select";
  item.options = order;
  // default 必须是选项里的一项，否则 BGI 读出来是 undefined
  item.default = order[0];
  file.writeTextSync(SETTINGS_FILE, JSON.stringify(form, null, 2) + "\n", false);
  return SETTINGS_FILE;
}

/**
 * 文件是否存在。
 * 不能用「试着读一次、读不到就当不存在」——BGI 会在读到失败时往日志里打一条
 * ReadTextSync 异常，每次开面板都刷两条红字，看着像出错了。改用列目录比对文件名。
 */
export function fileExists(p) {
  const path = String(p || "").replace(/\\/g, "/");
  const cut = path.lastIndexOf("/");
  const dir = cut < 0 ? "." : path.slice(0, cut);
  const name = cut < 0 ? path : path.slice(cut + 1);
  let arr = [];
  try {
    arr = Array.from(file.readPathSync(dir));
  } catch (e) {
    return false; // 目录都不存在，文件自然没有
  }
  for (const it of arr) {
    const base = String(it).replace(/\\/g, "/").split("/").pop();
    if (base === name) return true;
  }
  return false;
}

/** 供 resolveVersion 用：此刻是否命中（不抛）。没填日期＝不在期内 */
function periodsHit(periods, clock) {
  if (periods === null || periods === undefined) return false;
  if (!Array.isArray(periods)) return false;
  let segs;
  try {
    segs = normalizePeriods(periods, "periods", clock);
  } catch (e) {
    return false;
  }
  if (!segs.length) return false;
  const now = Date.now();
  // 半开 `[fromMs, toMs)`：结束整点即视为已结束，与 gameclock.judgeDay / schedule 同一判据。
  // 写成 `<=` 会让版本命中比日型判定多算整点那一毫秒，出现「面板标在期内、运行按普通日走」
  return segs.some((s) => now >= s.fromMs && now < s.toMs);
}

/** UID 位数上限（国服 9 位），超了必是笔误 */
export const UID_MAX_LEN = 9;

/**
 * UID 校验。硬拦的返回 ok:false；位数不符 / 前导 0 只进 warns，照样能存。
 * 各区服位数未必统一，按 9 位硬拦会把正常账号挡在门外。
 */
export function checkUid(uid) {
  const u = str(uid);
  if (!u) return { ok: false, msg: "UID 不能为空" };
  if (!/^\d+$/.test(u)) return { ok: false, msg: "UID 只能是数字" };
  if (u.length > UID_MAX_LEN) return { ok: false, msg: `UID 最多 ${UID_MAX_LEN} 位` };
  const warns = [];
  if (u.length !== UID_MAX_LEN) warns.push(`UID 不是 ${UID_MAX_LEN} 位（当前 ${u.length} 位），请核对`);
  if (u.charAt(0) === "0") warns.push("UID 以 0 开头，请核对");
  return { ok: true, warns };
}

/**
 * 读「默认」模板。**这是账户层数据的唯一默认来源**：
 * 读账号、新建账号都以它为底，`defaultAccount()` 不参与运行时合并——
 * 它只剩一个用途：模板文件不存在时当**种子**生成 `_default.json`（见下）。
 * 文件不存在或读坏了退回空骨架 + 顺手固化种子，不拦新建——模板只是抄写底稿。
 */
export function loadTemplate() {
  let raw = {};
  if (fileExists(TEMPLATE_FILE)) {
    try {
      raw = readJson(TEMPLATE_FILE, "默认模板");
    } catch (e) {
      log.warn(`默认模板读取失败，按空模板处理：${e && e.message ? e.message : e}`);
      raw = {};
    }
  } else {
    // 首跑种子：没有模板文件时把代码默认固化成模板，此后「默认」只有模板一处
    try {
      const seed = accountOut(defaultAccount("", ""));
      seed.uid = "";
      seed.name = "";
      writeJson(TEMPLATE_FILE, seed);
      log.warn(`默认模板不存在，已按代码默认生成种子 ${TEMPLATE_FILE}；此后改默认值请改模板`);
      raw = seed;
    } catch (e) {
      log.warn(`种子模板写入失败，按空模板处理：${e && e.message ? e.message : e}`);
      raw = {};
    }
  }
  const t = accountOut(raw);
  // uid 与昵称不属于模板：一个模板套到任何号上都得用那个号自己的
  t.uid = "";
  t.name = "";
  return t;
}

export function saveTemplate(cfg) {
  const t = accountOut(cfg || {});
  t.uid = "";
  t.name = "";
  return writeJson(TEMPLATE_FILE, t);
}

/**
 * 面板：新建账号（先查重，不覆盖）。
 * **以「默认」模板为底原样照抄**：模板没写的键就是空，不回代码默认。
 * 只有 uid 和昵称用这次填的。
 */
export function createAccount(uid, name) {
  const chk = checkUid(uid);
  if (!chk.ok) throw new Error(chk.msg);
  const u = String(uid).trim();
  if (exists(u)) throw new Error(`账号 ${u} 已存在，未覆盖`);
  const cfg = loadTemplate();
  cfg.uid = u;
  cfg.name = String(name || "").trim();
  // 兜底本初值 = 祝圣套装，只在这一刻对齐，之后改一个不动另一个（design §4.5）
  if (!cfg.fallback || typeof cfg.fallback !== "object") cfg.fallback = { domain: "", pick: "" };
  if (!str(cfg.fallback.domain)) cfg.fallback.domain = str(cfg.artifact && cfg.artifact.domain);
  writeJson(configPath(u), accountOut(cfg));
  return cfg;
}
