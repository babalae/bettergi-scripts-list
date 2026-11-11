// 角色自动养成 —— 主流程
// 输入：角色名 + 等级 + 天赋等级 (+ 武器) → 汇总材料目标 → 读背包存量 → 算缺口 → 体力优先执行
import { parsePlanText, buildTargets, computeShortfall, buildTasks, summarize, parseMappingText, suggestName, estimateMora } from './lib/planner.js';
import { countItems } from './lib/inventory.js';
import { loadData, loadState, saveState, readPlanFile, loadRouteShards, saveAllRouteShards } from './lib/store.js';
import { info, warn, err, notify, flush, bootMetrics, checkVersion, isCancelled, isCancellationError, enableAutoSkip, enableAutoPick } from './lib/env.js';
import { runDomain, runBoss, runRouteTask, calibrateEnemies, getRouteIndex, runLeyLine } from './lib/executor.js';

const TAG = '[角色养成]';

function setting(name, def) {
  try {
    const v = settings[name];
    if (v === undefined || v === null || v === '') return def;
    return v;
  } catch { return def; }
}
function intSetting(name, def) {
  const v = parseInt(String(setting(name, def)), 10);
  return Number.isFinite(v) ? v : def;
}
function yesSetting(name, def = true) {
  const v = String(setting(name, def ? '是' : '否'));
  return v === '是' || v === 'true' || v === '1';
}

function readConfig() {
  const dryRun = String(setting('runMode', '演练（不执行）')) !== '执行';
  let planText = String(setting('planText', '') || '');
  if (!planText.trim()) planText = readPlanFile();
  return {
    dryRun,
    planText,
    resinBudget: intSetting('resinBudget', 200),
    allowFragileResin: yesSetting('allowFragileResin', false),
    gatherEnabled: yesSetting('gatherEnabled', true),
    fightEnabled: yesSetting('fightEnabled', true),
    partyName: String(setting('partyName', '') || '').trim(),
    bossPartyName: String(setting('bossPartyName', '') || '').trim(),
    strategyName: String(setting('combatStrategyName', '') || '').trim(),
    gatherTeam: String(setting('gatherTeam', '') || '').trim(),
    fightTeam: String(setting('fightTeam', '') || '').trim(),
    forceSwitchTeam: yesSetting('forceSwitchTeam', false),
    autoSkipPopup: yesSetting('autoSkipPopup', true),
    routeLimit: intSetting('routeLimit', 8),
    bossTimeoutSec: Math.max(60, intSetting('bossTimeoutSec', 240)),
    leyLineCountry: String(setting('leyLineCountry', '') || '').trim(),
    leyLineWealthRuns: Math.max(0, Math.min(20, intSetting('leyLineWealthRuns', 0))),
    leyLineRevelationRuns: Math.max(0, Math.min(20, intSetting('leyLineRevelationRuns', 0))),
    expBookTarget: Math.max(0, intSetting('expBookTarget', 0)),
    leyLineExpPerRun: Math.max(1, Number(setting('leyLineExpPerRun', 4.5)) || 4.5),
    moraPerWealthRun: Math.max(1000, intSetting('moraPerWealthRun', 57000)),
    autoWealthFromMora: yesSetting('autoWealthFromMora', false),
    routeStuckTimeoutMin: Math.max(1, intSetting('routeStuckTimeoutMin', 8)),
    skipStuckDays: Math.max(0, intSetting('skipStuckDays', 3)),
    maxConsecutiveFailures: Math.max(1, intSetting('maxConsecutiveFailures', 3)),
    maxRunMinutes: Math.max(5, intSetting('maxRunMinutes', 90)),
    calibrateDirs: Math.max(0, Math.min(20, intSetting('calibrateDirs', 0))),
    fallbackPickup: yesSetting('fallbackPickup', true),
    useNahidaRoutes: yesSetting('useNahidaRoutes', true),
    unknownPolicy: String(setting('unknownPolicy', '跳过')), 
    maxRounds: Math.min(10, Math.max(1, intSetting('maxRounds', 3))),
    cdSpecialtyHours: intSetting('cdSpecialtyHours', 48),
    cdMonsterHours: intSetting('cdMonsterHours', 12),
    allowLowConfidenceBoss: false,
  };
}

async function snapshot(names, materials) {
  // 只统计「会去刷」的材料；并按游戏的两个页签分组，各查一次（比让 BGI 自己多页扫描快很多）
  const PAGE_A = new Set(['talentbook', 'weaponmat', 'boss', 'weekly', 'crown', 'gem']);  // 养成道具
  const PAGE_B = new Set(['specialty', 'monster']);                                       // 材料
  const countNames = names.filter((n) => PAGE_A.has(materials?.[n]?.kind) || PAGE_B.has(materials?.[n]?.kind));
  const skipNames = names.filter((n) => !countNames.includes(n));
  const groupA = countNames.filter((n) => PAGE_A.has(materials[n]?.kind));
  const groupB = countNames.filter((n) => PAGE_B.has(materials[n]?.kind));

  const merged = {};
  const unknown = [];
  const run = async (page, list) => {
    if (!list.length) return;
    const r = await countItems(list, { gridScreenName: page });
    Object.assign(merged, r.counts);
    unknown.push(...r.unknown);
    info(`${TAG} 背包统计（${page}）：${list.length - r.unknown.length}/${list.length} 项`);
  };
  await run('CharacterDevelopmentItems', groupA);
  await run('Materials', groupB);

  for (const n of skipNames) merged[n] = 0;   // 不刷的类别按 0 处理，后续会以「跳过」形式出现
  info(`${TAG} 背包统计完成：有效 ${countNames.length - unknown.length}/${countNames.length}`
    + (skipNames.length ? `，另 ${skipNames.length} 项不刷的材料未统计` : '')
    + (unknown.length ? `，未识别 ${unknown.length} 项` : ''));
  if (unknown.length) warn(`${TAG} 未识别（本轮视为「未知」，不参与刷取，不重试）：${unknown.join('、')}`);
  return { counts: merged, unknown };
}

(async function main() {
  const startedAt = Date.now();
  let autoSkipOn = false;
  try {
    bootMetrics();
    const cfg = readConfig();
    const data = loadData();
    cfg.data = data;
    cfg.bossMap = data.bossMap;
    // 供「打怪映射自学习」做前后对比的全量怪物材料名单
    data.monsterMaterials = Object.entries(data.materials).filter(([, v]) => v.kind === 'monster').map(([k]) => k);
    const state0 = loadState();
    // 上次被强关（BGI 关闭/结束进程）会留下 running 标记 → 告诉用户丢到哪了
    if (state0.running && state0.running.at) {
      const r = state0.running;
      warn(`${TAG} 上次运行没有正常结束（BGI 被关/进程被杀/异常退出）：第 ${r.round} 轮、任务 ${r.taskIndex}/${r.totalTasks}（${r.taskType || '?'}${r.material ? ' ' + r.material : ''}），`
        + `时间 ${new Date(r.at).toLocaleString()}。已完成路线的 CD 已落盘，不会重复跑。`);
      state0.running = null;
    }

    // 设置里直接填的补映射（比改 JSON 方便）：材料=敌人 / 素材=首领
    const monsterExtra = parseMappingText(setting('monsterMapExtraText', ''));
    const bossExtra = parseMappingText(setting('bossMapExtraText', ''));
    let appliedExtra = 0;
    for (const [m, enemy] of Object.entries(monsterExtra.map)) {
      if (data.materials[m]) { data.monsterMap[m] = { enemy, confidence: 'user' }; appliedExtra++; }
      else warn(`${TAG} 补映射里的材料「${m}」不在材料表里，已忽略`);
    }
    for (const [m, boss] of Object.entries(bossExtra.map)) {
      data.bossMap[m] = { boss, confidence: 'user' };
      appliedExtra++;
    }
    if (appliedExtra) info(`${TAG} 已应用设置里的补映射 ${appliedExtra} 条`);
    const learnedCount = Object.keys(state0.learned || {}).length;
    if (learnedCount) {
      let applied = 0;
      for (const [m, v] of Object.entries(state0.learned)) {
        if (!v || !v.enemy) continue;
        const cur = data.monsterMap[m];
        const confident = (v.hits || 1) >= 2;
        if (confident || !cur || !cur.enemy || cur.confidence === 'none') {
          data.monsterMap[m] = { enemy: v.enemy, confidence: 'learned', hits: v.hits || 1 };
          applied++;
        }
      }
      info(`${TAG} 载入自学习映射：记录 ${learnedCount} 条，生效 ${applied} 条（未二次确认的不覆盖 wiki/人工表）`);
    }

    const ver = checkVersion(0, 66);
    info(`${TAG} BetterGI 版本：${ver.version}${ver.reason ? '（' + ver.reason + '）' : ''}`);
    if (!ver.ok) { notify(`❌ ${ver.reason}`, { immediate: true }); return; }
    info(`${TAG} 战斗完全交给 BGI：秘境/首领用内置自动秘境与自动首领，怪由地图追踪的 fight 点触发；`
      + `秘境队伍${cfg.partyName ? `「${cfg.partyName}」` : '沿用 BGI'}、首领队伍${cfg.bossPartyName ? `「${cfg.bossPartyName}」` : '沿用 BGI'}、`
      + `采集队伍${cfg.gatherTeam ? `「${cfg.gatherTeam}」` : '不切'}、打怪队伍${cfg.fightTeam ? `「${cfg.fightTeam}」` : '不切'}、`
      + `策略${cfg.strategyName ? `「${cfg.strategyName}」` : '沿用 BGI'}`);

    // 只走路不捡东西 = 采集/打怪白跑 → 跑起来就开 BGI 自动拾取
    if (!cfg.dryRun && (cfg.gatherEnabled || cfg.fightEnabled)) {
      const rp = enableAutoPick();
      if (rp.ok) info(`${TAG} 已开启 BGI 自动拾取（不然只走路不捡东西）`);
      else warn(`${TAG} 开启自动拾取失败：${rp.reason}，请在 BGI 里手动开「自动拾取」`);
    } else if (cfg.dryRun) {
      info(`${TAG} 【演练】执行时会开启 BGI 自动拾取（只走路不捡 = 白跑）`);
    }

    // 防卡住：弹窗/对话是头号原因，跑起来就用 BGI 内置 AutoSkip 顶着
    if (cfg.autoSkipPopup && !cfg.dryRun) {
      const r = enableAutoSkip();
      autoSkipOn = r.ok;
      if (r.ok) info(`${TAG} 已开启 BGI 自动跳过（弹窗/对话不再挡路）`);
      else warn(`${TAG} 开启自动跳过失败：${r.reason}（可手动在 BGI 里开）`);
      // 立刻发一条开始通知：万一本进程被强关，至少留下「开始了」的痕迹
      notify(`▶ 角色自动养成 开始执行：${String(cfg.planText || '').trim().slice(0, 40)}…`, { immediate: true });
    } else if (cfg.autoSkipPopup && cfg.dryRun) {
      info(`${TAG} 【演练】执行时会开启 BGI 自动跳过（防弹窗卡住）`);
    }

    const parsed = parsePlanText(cfg.planText);
    if (parsed.errors.length) {
      for (const e of parsed.errors) err(`${TAG} 计划格式错误：${e}`);
    }
    if (!parsed.plan.length) {
      notify(`❌ 没有可执行的养成计划。请在脚本设置里填「角色名 等级 天赋a/b/c」，或编辑 record/plan.txt`, { immediate: true });
      return;
    }

    const unknownChars = parsed.plan.filter((p) => !data.characters[p.character]);
    if (unknownChars.length) {
      const lines = unknownChars.map((p) => {
        const s = suggestName(p.character, Object.keys(data.characters));
        return `「${p.character}」${s.length ? ' → 是不是：' + s.join(' / ') : '（没有相近的角色名）'}`;
      });
      notify(`❌ 认不出这些角色：\n${lines.join('\n')}\n请写全名（如 雷电将军、芙宁娜、枫原万叶）`, { immediate: true });
      return;
    }
    const badWeapon = parsed.plan.filter((p) => p.weapon?.name && !data.weapons[p.weapon.name]);
    if (badWeapon.length) {
      const lines = badWeapon.map((p) => {
        const s = suggestName(p.weapon.name, Object.keys(data.weapons));
        return `「${p.weapon.name}」${s.length ? ' → 是不是：' + s.join(' / ') : ''}`;
      });
      notify(`❌ 认不出这些武器：\n${lines.join('\n')}\n武器要写全名（如 护摩之杖、雾切之回光）；不想刷武器就把武器名去掉`, { immediate: true });
      return;
    }

    const built = buildTargets(data, parsed.plan);
    for (const w of built.warnings) warn(`${TAG} ${w}`);
    const targetNames = Object.keys(built.targets);

    // 供给预检：本地订阅的路线覆盖情况（不做任何游戏操作）
    try {
      const { index } = getRouteIndex();
      info(`${TAG} 路线覆盖：地方特产 ${index.specialty.size} 种、敌人 ${index.enemies.size} 个、其它采集 ${index.gatherOther.size} 种`);
      const needSpec = targetNames.filter((n) => data.materials[n]?.kind === 'specialty');
      const missSpec = needSpec.filter((n) => !index.specialty.has(n) && !index.gatherOther.has(n));
      if (missSpec.length) warn(`${TAG} 这些特产本地没有路线（会被跳过）：${missSpec.join('、')}`);
      const needMon = targetNames.filter((n) => data.materials[n]?.kind === 'monster');
      const noMap = needMon.filter((n) => {
        const e = data.monsterMap[n];
        return !e || !e.enemy || !index.enemies.has(e.enemy);
      });
      if (noMap.length) warn(`${TAG} 这些怪物掉落没有可用映射/路线（会被跳过）：${noMap.join('、')}（可在设置里补「材料=敌人」）`);
      const thin = [...index.enemies.entries()].filter(([e, ps]) => ps.length <= 2 && needMon.some((n) => data.monsterMap[n]?.enemy === e)).map(([e, ps]) => `${e}(${ps.length}条)`);
      if (thin.length) warn(`${TAG} 这些敌人路线极少，一轮打不满：${thin.join('、')}`);
    } catch (e) {
      warn(`${TAG} 供给预检跳过：${e?.message || e}`);
    }

    info(`${TAG} 计划：${parsed.plan.map((p) => {
      const lv = p.levelFrom ? `${p.levelFrom}→${p.level}` : `${p.level}`;
      const tal = p.talentsFrom ? `${p.talentsFrom.join('/')}→${p.talents.join('/')}` : p.talents.join('/');
      const wp = p.weapon ? ` +${p.weapon.name}${p.weapon.levelFrom ? ` ${p.weapon.levelFrom}→${p.weapon.level}` : ` ${p.weapon.level}`}` : '';
      return `${p.character} ${lv}级 天赋${tal}${wp}`;
    }).join(' | ')}`);
    info(`${TAG} 目标材料 ${targetNames.length} 种，共 ${Object.values(built.targets).reduce((a, b) => a + b, 0)} 个`);

    const state = loadState();
    // CD 记录改成分片读取（record/cd/<材料>.json）；旧版单文件会自动迁移一次
    const shards = loadRouteShards();
    if (shards.shards === 0 && state.routes && Object.keys(state.routes).length) {
      const n = saveAllRouteShards(state.routes);
      info(`${TAG} 已把旧版 CD 记录迁移到 ${n} 个分片文件`);
    }
    state.routes = shards.routes;
    const budget = cfg.allowFragileResin ? 99999 : cfg.resinBudget;
    let round = 0;
    let lastShortfallCount = Number.MAX_SAFE_INTEGER;
    const executionLog = [];

    while (round < cfg.maxRounds) {
      round++;
      info(`\n${TAG} ===== 第 ${round} 轮 =====`);

      // 打怪映射自学习：先校准几个还没校准过的敌人目录，学到的映射本轮就能用
      if (cfg.calibrateDirs > 0 && !cfg.dryRun) {
        try {
          const cal = await calibrateEnemies(cfg, state, cfg.calibrateDirs);
          if (cal.done) info(`${TAG} 本轮校准了 ${cal.done} 个敌人目录，还剩 ${cal.remaining} 个待校准`);
        } catch (e) { warn(`${TAG} 校准异常（不影响主流程）：${e?.message || e}`); }
        saveState(state);
      } else if (cfg.calibrateDirs > 0 && cfg.dryRun && round === 1) {
        await calibrateEnemies(cfg, state, cfg.calibrateDirs);
      }
      try { await sleep(3000); } catch {}
      const snap = await snapshot(targetNames, data.materials);
      if (round === 1 && cfg.unknownPolicy === '刷一轮' && snap.unknown.length) {
        for (const n of snap.unknown) snap.counts[n] = 0;
        warn(`${TAG} 未识别 ${snap.unknown.length} 项按「缺全额」试刷一轮（设置：刷一轮）`);
      }
      if (Object.keys(snap.counts).length && snap.unknown.length === Object.keys(snap.counts).length) {
        err(`${TAG} 本轮背包统计全部失败（可能是 BGI 截图器/任务被取消），直接停止，避免误判已满足`);
        notify('❌ 背包统计全部失败，已停止（检查 BGI 是否被取消/游戏窗口是否丢失）', { immediate: true });
        break;
      }
      const { shortfall, unknown, satisfied } = computeShortfall(built.targets, snap.counts);
      const shortfallCount = Object.keys(shortfall).length;
      info(`${TAG} 已满足 ${Object.keys(satisfied).length} 种，缺口 ${shortfallCount} 种`
        + `，还有 ${Object.values(shortfall).reduce((a, b) => a + b, 0)} 个材料要刷`);

      if (!shortfallCount) {
        info(`${TAG} 所有材料已满足 🎉`);
        notify(`✅ 养成目标已全部达成：${parsed.plan.map((p) => p.character).join('、')}`);
        break;
      }

      const { tasks, skipped, resinPlanned } = buildTasks(data, shortfall, {
        resinBudget: budget,
        allowFragileResin: cfg.allowFragileResin,
        gatherEnabled: cfg.gatherEnabled,
        fightEnabled: cfg.fightEnabled,
      });

      if (cfg.dryRun) {
        info(`${TAG} 【演练】计划如下（不会点任何东西）：`);
        for (const line of summarize({ targets: built.targets, shortfall, tasks, skipped }).split('\n')) info(`${TAG}   ${line}`);
        if (tasks.some((t) => t.type === 'gather')) info(`${TAG}   采集队伍：${cfg.gatherTeam || '不切队'}（执行时会先切过去）`);
        if (tasks.some((t) => t.type === 'fight')) info(`${TAG}   打怪队伍：${cfg.fightTeam || '不切队'}（执行时会先切过去）`);
        if (tasks.some((t) => t.type === 'domain')) info(`${TAG}   秘境队伍：${cfg.partyName || '沿用 BGI 配置'}`);
        if (tasks.some((t) => t.type === 'boss')) info(`${TAG}   首领队伍：${cfg.bossPartyName || '沿用 BGI 配置'}`);
        if (cfg.leyLineWealthRuns > 0) info(`${TAG}   地脉花·藏金之花（摩拉）×${cfg.leyLineWealthRuns}（约 ${cfg.leyLineWealthRuns * 20} 体力）`);
        if (cfg.leyLineRevelationRuns > 0) info(`${TAG}   地脉花·启示之花（经验）×${cfg.leyLineRevelationRuns}（约 ${cfg.leyLineRevelationRuns * 20} 体力）`);
        notify(`🧪 演练完成：缺口 ${shortfallCount} 种，计划消耗约 ${resinPlanned} 体力。把运行模式改成「执行」即可真跑。`);
        break;
      }

      if (!tasks.length) {
        warn(`${TAG} 没有可执行的任务；跳过原因：${skipped.map((s) => `${s.material}:${s.reason}`).join('；') || '无'}`);
        break;
      }

      let executed = 0;
      let consecutiveFailures = 0;
      let stopped = false;
      const runLimitMs = cfg.maxRunMinutes * 60 * 1000;

      // 地脉花（摩拉/经验书）
      if (round === 1) {
        // 摩拉：只做预估（摩拉不是背包物品，读不到存量）
        let moraNeed = 0;
        try { moraNeed = estimateMora(data, parsed.plan); } catch { moraNeed = 0; }
        if (moraNeed > 0) {
          const runs = Math.ceil(moraNeed / cfg.moraPerWealthRun);
          info(`${TAG} 摩拉预估：本次养成约需 ${(moraNeed / 10000).toFixed(1)} 万，`
            + `按每次藏金之花 ${(cfg.moraPerWealthRun / 10000).toFixed(1)} 万算 ≈ ${runs} 次（${runs * 20} 体力）；摩拉存量读不到，需要就自己填次数`);
          const autoWealth = cfg.leyLineWealthRuns > 0 ? cfg.leyLineWealthRuns : (cfg.autoWealthFromMora ? runs : 0);
          if (autoWealth > 0 && !cfg.dryRun) { await runLeyLine('藏金之花', autoWealth, cfg); saveState(state); }
        } else if (cfg.leyLineWealthRuns > 0 && !cfg.dryRun) {
          await runLeyLine('藏金之花', cfg.leyLineWealthRuns, cfg); saveState(state);
        }

        // 经验书：识别背包现有本数 → 缺口 → 启示之花次数
        let revelationRuns = cfg.leyLineRevelationRuns;
        if (cfg.expBookTarget > 0) {
          let have = 0;
          try { have = (await countItems(['大英雄的经验'])).counts['大英雄的经验'] || 0; } catch { have = 0; }
          const gap = Math.max(0, cfg.expBookTarget - have);
          const needRuns = Math.ceil(gap / cfg.leyLineExpPerRun);
          info(`${TAG} 经验书：目标 ${cfg.expBookTarget} 本，背包现有 ${have} 本，缺口 ${gap} 本`
            + ` → 启示之花约 ${needRuns} 次（${needRuns * 20} 体力）`);
          revelationRuns = cfg.leyLineRevelationRuns > 0 ? cfg.leyLineRevelationRuns : needRuns;
        }
        if (revelationRuns > 0 && !cfg.dryRun) { await runLeyLine('启示之花', revelationRuns, cfg); saveState(state); }
        else if (revelationRuns === 0 && cfg.expBookTarget > 0) info(`${TAG} 经验书已够，跳过启示之花`);
      }

      for (let ti = 0; ti < tasks.length; ti++) {
        const task = tasks[ti];
        // 防卡死第 1 层：每个任务前检查「用户是否已停止」和「总时长预算」
        if (isCancelled()) { warn(`${TAG} 检测到 BGI 已停止，退出任务队列`); stopped = true; break; }
        if (Date.now() - startedAt > runLimitMs) { warn(`${TAG} 已超过总时长上限 ${cfg.maxRunMinutes} 分钟，停止后续任务`); break; }

        // 断点标记先落盘：万一 BGI 被关掉，下次能知道断在哪        state.running = { at: Date.now(), round, taskIndex: ti + 1, totalTasks: tasks.length, taskType: task.type, material: task.material || task.domain || task.bossMaterial || '' };
        saveState(state);

        let r = null;
        try {
          if (task.type === 'domain') { r = await runDomain(task, cfg); executionLog.push({ round, task: 'domain', domain: task.domain, r }); executed++; }
          else if (task.type === 'boss') { r = await runBoss(task, cfg); executionLog.push({ round, task: 'boss', mat: task.bossMaterial, r }); if (!r.skipped) executed++; }
          else if (task.type === 'gather' || task.type === 'fight') {
            r = await runRouteTask(task, cfg, state);
            executionLog.push({ round, task: task.type, mat: task.material, r });
            if (!r.skipped) executed++;
          }
        } catch (e) {
          if (isCancellationError(e)) { warn(`${TAG} 任务被停止：${e?.message || e}`); stopped = true; break; }
          err(`${TAG} 任务异常：${e?.message || e}`);
          r = { error: String(e?.message || e) };
        }

        // 防卡死第 2 层：连续失败熔断（卡住/报错不会无限重试）
        const failed = !!(r && (r.error || (r.failed > 0 && !r.ok)));
        consecutiveFailures = failed ? consecutiveFailures + 1 : 0;
        if (consecutiveFailures >= cfg.maxConsecutiveFailures) {
          err(`${TAG} 连续 ${consecutiveFailures} 个任务失败/卡住，熔断退出（检查游戏是否掉线、路线是否卡墙）`);
          stopped = true;
          break;
        }
        if (task.partial) info(`${TAG} 本任务因体力预算只跑了一部分`);
      }
      saveState(state);
      if (stopped) break;

      if (executed === 0) {
        warn(`${TAG} 本轮没有真正执行任何任务，退出`);
        break;
      }
      if (shortfallCount >= lastShortfallCount) {
        warn(`${TAG} 缺口没有下降（${lastShortfallCount} → ${shortfallCount}），熔断退出`);
        break;
      }
      lastShortfallCount = shortfallCount;
      if (Date.now() - startedAt > runLimitMs) { warn(`${TAG} 已运行 ${cfg.maxRunMinutes} 分钟，安全退出`); break; }
    }

    state.lastRun = { at: Date.now(), plan: parsed.plan, rounds: round, log: executionLog.slice(-20) };
    state.running = null;
    state.history = (state.history || []).slice(-30).concat([{ at: Date.now(), plan: parsed.plan.map((p) => p.character), rounds: round }]);
    saveState(state);
    notify(`${cfg.dryRun ? '🧪 演练' : '✅ 执行'}结束：${parsed.plan.map((p) => p.character).join('、')}，共 ${round} 轮，用时 ${Math.round((Date.now() - startedAt) / 60000)} 分钟`);
  } catch (e) {
    if (isCancellationError(e)) {
      warn(`${TAG} 已被手动停止`);
      notify(`⏹ 角色自动养成 已停止`, { immediate: true });
    } else {
      err(`${TAG} 脚本异常：${e?.message || e}`);
      if (e?.stack) err(String(e.stack).split('\n').slice(0, 6).join('\n'));
      notify(`❌ 角色自动养成 出错：${e?.message || e}`, { immediate: true });
    }
  } finally {
    if (autoSkipOn) {
      // 不做清理：清空触发器会连带把你手动开的东西一起关掉，属于副作用
      info(`${TAG} 本次开启的 BGI 自动跳过保持启用（脚本不清理，避免改到你的 BGI 设置；想关就在 BGI 里关）`);
    }
    flush();
  }
})();
