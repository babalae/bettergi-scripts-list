// 三类副本任务的薄封装（design §3.4）——用途：把决策层说出的「打哪个本、打几次」
// 翻译成本体三个任务对象的参数并调用。
//
// 只干三件事：装配参数 → 调 `dispatcher.runXxxTask` → 把异常收成返回值。
// **不做决策、不读配置、不重试、不管下一阶段**：打哪个本由 `plan` 决定，
// 是否继续由 `main` 决定。接口怎么变都只改这一个文件。
//
// 参数坑全封在这里：`0 → 9999` 只发生在本体构造函数里，构造后属性赋 0 是真 0 轮，
// 所以耗尽模式**不给 `DomainRoundNum` 赋值**、`SundaySelectedValue` 必须字符串、
// 地脉与幽境没有返回值、地脉不设树脂优先级（本体自管）。
// **树脂模式按阶段分**：日常/补刷走本体自动（`SpecifyResinUse = false`——本体 OCR 实时读，
// 浓缩优先、原粹 ≥ 20，耗尽当轮就判出「最后一轮」直接退）；双倍才指定（只给原粹 40/20 两档，
// 浓缩与须臾都不给）。`ResinPriorityList` 在 0.66.0 没有消费方，树脂先后由本体写死。
// 秘境 `roundNum` 缺失或非法且未开耗尽时**报错返回**，不静默转 0——0 轮会进本
// 但不进战斗循环，「参数错悄悄变成最重行为」。
// **圣遗物分解不在这里**：三个入口一律关掉本体自带的分解，改由 `src/salvage.js`
// 在本日结束后独立跑一次（design §3.7）。

/**
 * 树脂次数的「给满」值。0.66.0 里 `ResinUseRecord.BuildFromDomainParam` 只按
 * `*UseCount > 0` 决定树脂用不用，次数本身不参与轮数判定（轮数由 `DomainRoundNum` 管），
 * 所以给一个大数就等于「允许用到没树脂」。
 */
const RESIN_ALWAYS = 9999;

function toInt(v, fallback) {
  const n = Math.floor(Number(v));
  return isFinite(n) && n > 0 ? n : fallback;
}

/**
 * 策略值 → 本体入参。面板存的是**文件名（带扩展名）**，本体三个入口要的却是
 * **不带扩展名的策略名**，只有后缀能切 JSON 引擎，所以格式必须在这里拆出来。
 * 无扩展名的值（手填）按纯策略名处理，交给本体自行解析。
 */
function parseStrategy(v) {
  const raw = String(v || "").trim();
  const m = /\.(txt|json)$/i.exec(raw);
  if (!m) return { name: raw, ext: "" };
  return { name: raw.slice(0, raw.length - m[0].length), ext: m[1].toLowerCase() };
}

/**
 * `.json` 策略的绝对路径。
 *
 * 本体按后缀切 JSON 引擎，而路径是从 `Global.Absolute` 拼起的 → **必须是绝对路径**。
 * 但 `strategyFile.readPathSync` 给的是**相对** `User\AutoFight` 的名字——`LimitedFile.ReadPathSync`
 * 末尾做了 `Path.GetRelativePath(rootPath, path)`，拿到的只是 `xxx.json`，没有盘符也没有目录前缀，
 * 直接传给 `CombatStrategyPath` 会找不到文件、静默退回默认策略。
 *
 * 所以不去反查目录，改借 `SetCombatStrategyPath`：它给的是
 * `Global.Absolute(@"User\AutoFight\" + strategyName + ".txt")`，把后缀换成 `.json` 就是答案。
 *
 * @param txtPath `SetCombatStrategyPath` 返回（或写进属性）的 `.txt` 绝对路径
 * @param name    策略名（不带扩展名）
 * @returns 绝对路径；拿不到、或确认文件不存在时返回 `null`，调用方退回 `.txt`
 */
function jsonPathOf(txtPath, name) {
  const s = String(txtPath || "");
  // 空名与「根据队伍自动选择」给的是 `User\AutoFight\` 目录，不带 .txt，换不了后缀
  if (!/\.txt$/i.test(s)) return null;
  try {
    // 有 strategyFile 才验存在性（它的 rootPath 就是 User\AutoFight，能解析这个相对名）；
    // 没有这个接口时无从验证，照传——文件真不存在时本体自己会报，比静默换 .txt 更诚实
    if (typeof strategyFile !== "undefined" && strategyFile && !strategyFile.isFile(`${name}.json`)) {
      return null;
    }
  } catch (e) {
    return null;
  }
  return s.replace(/\.txt$/i, ".json");
}

/** 秘境的六个树脂次数字段（`*Count`），顺序即本体 `ResinUseRecord` 的建表顺序 */
const RESIN_COUNT_FIELDS = [
  "OriginalResinUseCount",
  "OriginalResin20UseCount",
  "OriginalResin40UseCount",
  "CondensedResinUseCount",
  "TransientResinUseCount",
  "FragileResinUseCount"
];

/**
 * 把 `*Count` 全写 0，`keep` 里的跳过。
 *
 * `SetDefault()` 会把 BGI 全局的次数灌进来，漏一个就等于让全局参与判定：指定模式下
 * 全局开着脆弱就会真用掉脆弱，全局有 `OriginalResinUseCount` 就会多一条不带档位的
 * 「原粹树脂」记录、点界面当前档位，绕过 40 优先。所以指定模式必须逐个封口。
 * 自动模式（`SpecifyResinUse = false`）本体根本不读这些字段——`BuildFromDomainParam`
 * 直接返回空表——清零只为「哪天开关被改坏也不会把全局带进来」。
 */
function resetResinCounts(p, keep) {
  for (const f of RESIN_COUNT_FIELDS) {
    if (keep && keep.indexOf(f) >= 0) continue;
    p[f] = 0;
  }
}

/** 任务结束回主界面：下一步要从干净界面开始，失败不影响结果 */
async function backToMainUi() {
  try {
    await genshin.returnMainUi();
  } catch (e) {
    log.warn(`tasks：回主界面失败（不影响本次结果）：${e && e.message ? e.message : e}`);
  }
}

/** C# 字典 → 普通对象；拿不到键就返回 undefined */
function toPlainRewards(raw) {
  if (!raw) return undefined;
  const out = {};
  try {
    // `raw` 是 C# 字典的 ClearScript 包装对象：`Object.keys` 列出的除了真实条目，
    // 还有 21 个 .NET 成员名（Add/Clear/TryGetValue…）——方法名取 Number() 得 NaN，
    // JSON.stringify 又把 NaN 打成 null，日志里就是一串 "Add":null 垃圾。
    // 所以三条都要滤：函数、字典自身成员、非有限数。全滤空返回 undefined（圣遗物本空字典走这条）。
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (typeof v === "function") continue;
      if (k === "Count" || k === "Item") continue;
      const n = Number(v);
      if (Number.isFinite(n)) out[String(k)] = n;
    }
  } catch (e) {
    return undefined;
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------------
// 地脉（藏金之花 / 经验书之花）
// ---------------------------------------------------------------------------

/**
 * @param params `{ flower, country, count }` 或 `{ flower, country, exhaust: true }`
 *   `flower` = 花型（`LeyLineOutcropType`），`country` = 国家；二选一的是「打几次」与「打到没树脂」
 * @param opts   `{ combatTeam, friendshipTeam, strategy }`
 * @returns `{ ok, error? }`（本体这个任务没有返回值，恒无 rewards）
 */
export async function runLeyline(params, opts) {
  const p0 = params || {};
  const o = opts || {};
  const flower = String(p0.flower || "").trim();
  const country = String(p0.country || "").trim();
  if (!flower || !country) {
    return { ok: false, error: "地脉参数不全：花型或国家为空" };
  }

  try {
    const p = new AutoLeyLineOutcropParam();
    p.Country = country;
    p.LeyLineOutcropType = flower;
    // 耗尽模式：本体不看次数，Count 传 0 表示不指定
    p.IsResinExhaustionMode = p0.exhaust === true;
    p.Count = p.IsResinExhaustionMode ? 0 : toInt(p0.count, 3);

    p.Team = String(o.combatTeam || "");
    // 好感队空就是空：本体把非空理解成「每轮领奖后切好感队、打完再切回战斗队」，
    // 补成战斗队等于每轮白切两次队
    p.FriendshipTeam = String(o.friendshipTeam || "");

    // `OpenModeCountMin` 必须关：为 true 时取 `min(OCR, 1)`，耗尽模式永远只打一次。
    // `IsGoToSynthesizer` 在 0.66.0 是死字段（Task 无消费点），写 false 只为写明意图。
    p.OpenModeCountMin = false;
    p.IsGoToSynthesizer = false;

    // 须臾 / 脆弱显式关掉：`SetDefault()` 会灌入 BGI 全局开关，不关就会跟着全局走——
    // 全局开着时真的消耗这两种，`CalCountByResin()` 还会把它们算进总次数。
    p.UseFragileResin = false;
    p.UseTransientResin = false;

    // 地脉 0.66.0 没有 SetCombatStrategyPath：策略只认 `FightConfig.StrategyName`（空白时本体
    // 回退全局 `AutoFightConfig`）。名字不带扩展名——本体 `ResolveStrategyPath()` 同名优先 `.json`
    // 再回退 `.txt`，这里传不了格式。
    // `SetDefault()` 灌进来的是**全局配置对象的引用**，直接改会污染本次运行的全局配置，
    // 所以只在调用期间覆盖、finally 还原。
    const st = parseStrategy(o.strategy);
    const fc = p.FightConfig;
    const prevStrategy = fc ? fc.StrategyName : undefined;

    const how = p.IsResinExhaustionMode ? "打到本体自己停" : `${p.Count} 次`;
    log.info(`地脉：${country} / ${flower} ${how}，队伍「${p.Team}」`);

    try {
      if (fc && st.name) fc.StrategyName = st.name;
      await dispatcher.runAutoLeyLineOutcropTask(p);
    } finally {
      if (fc && st.name) fc.StrategyName = prevStrategy;
    }
    log.info("地脉：完成");
    await backToMainUi();
    return { ok: true };
  } catch (e) {
    const error = e && e.message ? e.message : String(e);
    log.error(`地脉：失败 ${error}`);
    return { ok: false, error };
  }
}

// ---------------------------------------------------------------------------
// 秘境
// ---------------------------------------------------------------------------

/**
 * @param params `{ domain, roundNum | exhaust, pick, cat }`
 *   `exhaust:true` 表示打到没树脂：不赋轮数（留构造的 9999），树脂走本体自动模式。
 *   `cat` 是本的类型（`artifact` / `talent` / `weapon` / 空）：只用来决定要不要读奖励。
 * @param opts   `{ combatTeam, strategy }`
 * @returns `{ ok, error?, rewards? }`；`rewards` = 奖励名 → 数量（需 1920×1080，圣遗物本恒无）
 */
export async function runDomain(params, opts) {
  const p0 = params || {};
  const o = opts || {};
  const domain = String(p0.domain || "").trim();
  if (!domain) return { ok: false, error: "秘境参数不全：本名为空" };

  try {
    const p = new AutoDomainParam();
    p.DomainName = domain;
    p.PartyName = String(o.combatTeam || "");

    // 耗尽**不赋轮数**：`0 → 9999` 只发生在本体构造函数里，构造后再赋 0 是真 0 轮
    // （本体 `for (i=0; i<0)` 一次不跑，进本点开始后不战斗不领奖不退出）。
    // 构造默认已是 9999，耗尽靠「领不到奖励就 break」自然停（reusable §4）。
    // 非耗尽时 roundNum 必须是正整数，缺参报错而不是静默打 9999 轮
    const exhaust = p0.exhaust === true;
    if (!exhaust) {
      const n = Math.floor(Number(p0.roundNum));
      if (!isFinite(n) || n <= 0) {
        return { ok: false, error: "秘境参数不全：roundNum 缺失或非法（未开耗尽时必须是正整数轮数）" };
      }
      p.DomainRoundNum = n;
    }
    // 树脂：**只有双倍指定，日常交给本体自动**。
    //  - 耗尽（日常/补刷）：`SpecifyResinUse = false`，本体 OCR 实时读树脂，浓缩优先、原粹 ≥ 20，
    //    耗尽当轮就判出 `isLastTurn` 点退出——不多打一轮，也不打那条「次数过多」的 warning
    //  - 双倍：指定原粹 40/20 两档，40 优先，切 40 失败（剩 20~39）本体自己 continue 到 20；
    //    其余四项（含不带档位的「原粹树脂」和脆弱）全给 0，否则全局值会渗进列表
    // 两条路都必须覆盖：`SetDefault()` 会把全局 `AutoDomainConfig` 整份灌进来。
    if (exhaust) {
      p.SpecifyResinUse = false;
      resetResinCounts(p);
    } else {
      p.SpecifyResinUse = true;
      p.OriginalResin40UseCount = RESIN_ALWAYS;
      p.OriginalResin20UseCount = RESIN_ALWAYS;
      resetResinCounts(p, ["OriginalResin40UseCount", "OriginalResin20UseCount"]);
    }

    // 全开 / 周日要选第几项：材料所属组号，传字符串；无组本为 null 就不传，让本体自己挑
    if (p0.pick !== null && p0.pick !== undefined && p0.pick !== "") {
      p.SundaySelectedValue = String(p0.pick);
    }

    // 圣遗物分解不在这里做：秘境任务一律关掉，本日全部战斗结束后由
    // `src/salvage.js` 独立跑一次。**必须显式设 false**——`AutoDomainParam` 的
    // `SetDefault()` 会把本体全局「自动分解圣遗物」配置带进来，不关就会一次运行拆两遍。
    p.AutoArtifactSalvage = false;

    // 奖励识别（仅 1920×1080 有效，其它分辨率返回空对象，不报错）
    // 圣遗物本不开：掉的一串圣遗物名对判据没用，日志与通知里纯属噪音。
    // 类型由 `plan.domainStep` 带过来（`p0.cat`），缺省按「读」处理，保持老行为。
    p.RewardRecognitionEnabled = String(p0.cat || "") !== "artifact";

    // 策略：本体按后缀切引擎，`.txt` 与 `.json` 都要绝对路径。
    // 秘境这个版本**有返回值**（幽境那个是 void 版、内部自己写），不接返回值等于没传。
    const st = parseStrategy(o.strategy);
    if (typeof p.SetCombatStrategyPath === "function") {
      const txtPath = p.SetCombatStrategyPath(st.name);
      const jsonPath = st.ext === "json" ? jsonPathOf(txtPath, st.name) : null;
      p.CombatStrategyPath = jsonPath || txtPath;
      if (st.ext === "json" && !jsonPath) {
        log.warn(`秘境：未找到策略文件「${st.name}.json」，改用 .txt`);
      }
    }
    const resinText = exhaust ? "本体自动（浓缩优先）" : "原粹 40 → 原粹 20";
    const how = exhaust ? "直至树脂耗尽" : `${p.DomainRoundNum} 轮`;
    log.info(`秘境：${domain} ${how}，队伍「${p.PartyName}」，树脂 ${resinText}`);

    const raw = await dispatcher.runAutoDomainTask(p);
    log.info("秘境：完成");
    await backToMainUi();
    return { ok: true, rewards: toPlainRewards(raw) };
  } catch (e) {
    const error = e && e.message ? e.message : String(e);
    log.error(`秘境：失败 ${error}`);
    return { ok: false, error };
  }
}

// ---------------------------------------------------------------------------
// 幽境危战
// ---------------------------------------------------------------------------

/**
 * @param params `{ boss }`：`boss` 是第几场（本体 `BossNum`），**没有轮数概念**；树脂走自动模式
 * @param opts   `{ combatTeam, strategy }`
 * @returns `{ ok, error? }`（本体这个任务没有返回值）
 */
export async function runStygian(params, opts) {
  const p0 = params || {};
  const o = opts || {};

  try {
    const p = new AutoStygianOnslaughtParam();
    p.BossNum = toInt(p0.boss, 1);
    p.FightTeamName = String(o.combatTeam || "");
    // 耗尽语义：打到底，不指定各树脂用量。四个 `*Count` 一并清零——自动模式本体不读
    // （`BuildFromDomainParam` 在 `SpecifyResinUse == false` 时直接返回空表），
    // 清零只为「开关被改坏时也不会把全局次数带进来」。
    p.SpecifyResinUse = false;
    p.OriginalResinUseCount = 0;
    p.CondensedResinUseCount = 0;
    p.TransientResinUseCount = 0;
    p.FragileResinUseCount = 0;
    p.AutoArtifactSalvage = false;

    // 策略：幽境那个是 **void** 版，内部把 `Global.Absolute(@"User\AutoFight\" + name + ".txt")`
    // 写进 `CombatScriptBagPath`——先调它，`.json` 再改属性里的后缀。
    const st = parseStrategy(o.strategy);
    if (typeof p.SetCombatStrategyPath === "function") {
      p.SetCombatStrategyPath(st.name);
      if (st.ext === "json") {
        const jsonPath = jsonPathOf(p.CombatScriptBagPath, st.name);
        if (jsonPath) p.CombatScriptBagPath = jsonPath;
        else log.warn(`幽境：未找到策略文件「${st.name}.json」，改用 .txt`);
      }
    }
    // 幽境按耗尽语义打到底，不指定树脂次数（本体自动：浓缩优先，须臾/脆弱不参与）
    log.info(`幽境：第 ${p.BossNum} 场，队伍「${p.FightTeamName}」`);

    await dispatcher.runAutoStygianOnslaughtTask(p);
    log.info("幽境：完成");
    await backToMainUi();
    return { ok: true };
  } catch (e) {
    const error = e && e.message ? e.message : String(e);
    log.error(`幽境：失败 ${error}`);
    return { ok: false, error };
  }
}

// ---------------------------------------------------------------------------
// 按描述符分发
// ---------------------------------------------------------------------------

/**
 * 执行 `plan` 产出的一个步骤。
 * @param step `{ type, tag, label, reason, params }`（design §3.6）
 * @param opts `{ combatTeam, friendshipTeam, strategy }`
 * @returns `{ ok, error?, rewards? }`；`type` 认不出时 `ok:false`，不猜
 */
export async function runStep(step, opts) {
  const s = step || {};
  const params = s.params || {};
  if (s.type === "leyline") return runLeyline(params, opts);
  if (s.type === "domain") return runDomain(params, opts);
  if (s.type === "stygian") return runStygian(params, opts);
  return { ok: false, error: `认不出的任务类型「${s.type}」` };
}
