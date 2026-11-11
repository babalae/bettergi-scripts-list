// lib/executor.js —— 执行器：秘境 / 首领 / 采集 / 打怪
import { info, warn, err, isCancellationError, startPickupLoop } from './env.js';
import { countItems } from './inventory.js';
import { routesForMaterial, pickRunnable, indexRoutes, markStuck, markDone } from './routes.js';
import { listJsonRecursive, findAutoPathingRoot, saveRouteShard, saveAllRouteShards, listAutoPathingJson, readAutoPathingText } from './store.js';

/** 兼容 camelCase / PascalCase 两种属性写法 */
function setProp(obj, name, value) {
  const cands = [name, name[0].toUpperCase() + name.slice(1)];
  for (const k of cands) {
    try { obj[k] = value; return true; } catch { /* next */ }
  }
  try { obj[name] = value; return true; } catch { return false; }
}

/**
 * 跑一条地图追踪路线。
 * 关键：pathingScript.runFile 是相对「脚本目录」读文件，跑 AutoPathing 里的路径必须用 runFileFromUser，
 * 否则 C# 内部吞掉"文件不存在"的异常直接返回 → 看起来成功、实际什么都没跑。
 */
async function runPath(relPath) {
  if (typeof pathingScript.runFileFromUser === 'function') return await pathingScript.runFileFromUser(relPath);
  return await pathingScript.runFile(relPath);
}

const routeJsonCache = new Map();
/** 读路线 json（缓存），给 CD 指纹用；读失败返回 null，退化成路径 key */
function loadRouteJson(p) {
  if (routeJsonCache.has(p)) return routeJsonCache.get(p);
  let o = null;
  try { o = JSON.parse(file.readTextSync(p)); } catch { o = null; }
  if (!o) { try { const t = readAutoPathingText(p); if (t) o = JSON.parse(t); } catch { o = null; } }
  routeJsonCache.set(p, o);
  return o;
}

function makeParam(Ctor, fields) {
  const p = new Ctor();
  for (const [k, v] of Object.entries(fields)) setProp(p, k, v);
  return p;
}

/** 战斗策略：留空就完全沿用 BGI 自动战斗里选的那套（默认「根据队伍自动选择」） */
function applyStrategy(param, cfg) {
  const name = (cfg.strategyName || '').trim();
  if (!name) return false;
  for (const fn of ['setCombatStrategyPath', 'SetCombatStrategyPath']) {
    try { if (typeof param[fn] === 'function') { param[fn](name); return true; } } catch { /* next */ }
  }
  setProp(param, 'strategyName', name);
  return true;
}

/** 秘境：返回 BGI 的奖励识别字典（材料名 → 数量） */
export async function runDomain(task, cfg) {
  info(`▶ 秘境「${task.domain}」×${task.runs} 次（约 ${task.resin} 体力）  需求：${task.materials.map((m) => `${m.name}×${m.need}`).join('、')}`);
  if (cfg.dryRun) return { dryRun: true };
  if (!task.domain) { err('秘境名为空，跳过（材料→秘境映射缺失）'); return { skipped: true }; }

  const fields = {
    domainName: task.domain,
    domainRoundNum: task.runs,
    specifyResinUse: true,
    originalResinUseCount: task.runs,
    rewardRecognitionEnabled: true,
  };
  if (cfg.partyName) fields.partyName = cfg.partyName;
  if (cfg.allowFragileResin) fields.fragileResinUseCount = task.runs;

  try {
    const param = makeParam(AutoDomainParam, fields);
    applyStrategy(param, cfg);
    const rewards = await dispatcher.runAutoDomainTask(param);
    info(`✔ 秘境完成，奖励识别：${JSON.stringify(rewards || {})}`);
    return { rewards };
  } catch (e) {
    err(`秘境执行失败：${e?.message || e}`);
    return { error: String(e?.message || e) };
  }
}

/** 首领：需要 boss-map.json 里的高置信映射 */
export async function runBoss(task, cfg) {
  const entry = cfg.bossMap?.[task.bossMaterial];
  const bossName = entry?.boss;
  const trusted = !!bossName && ['high', 'wiki', 'user', 'learned'].includes(entry.confidence || 'high');
  if (!trusted) {
    warn(`⏭ 首领素材「${task.bossMaterial}」缺少可信的首领映射，跳过（在 record/boss-map-extra.json 里填一行 {"素材名":"首领名"} 即可）`);
    return { skipped: true, reason: 'no-boss-mapping' };
  }
  info(`▶ 首领「${bossName}」×${task.runs} 次（约 ${task.resin} 体力）  素材：${task.bossMaterial}`);
  if (cfg.dryRun) return { dryRun: true };

  const fields = {
    bossName,
    specifyRunCount: true,
    runCount: task.runs,
    useFragileResin: !!cfg.allowFragileResin,
    rewardRecognitionEnabled: true,
    timeout: cfg.bossTimeoutSec || 240,
  };
  if (cfg.bossPartyName) fields.teamName = cfg.bossPartyName;
  try {
    const param = makeParam(AutoBossParam, fields);
    applyStrategy(param, cfg);
    const rewards = await dispatcher.runAutoBossTask(param);
    info(`✔ 首领完成，奖励识别：${JSON.stringify(rewards || {})}`);
    return { rewards };
  } catch (e) {
    err(`首领执行失败：${e?.message || e}`);
    return { error: String(e?.message || e) };
  }
}

/** 切队伍：采集队 / 打怪队分开配置，切换前先看记录里是不是已经在目标队伍 */
export async function ensureParty(name, cfg, state, label = '') {
  const team = (name || '').trim();
  if (!team) return { switched: false, reason: 'no-team' };
  if (!cfg.forceSwitchTeam && state && state.lastParty === team) {
    info(`   ${label}队伍已是「${team}」，跳过切换`);
    return { switched: false, reason: 'already' };
  }
  if (cfg.dryRun) { info(`   【演练】会切到${label}队伍「${team}」`); return { switched: false, reason: 'dry-run' }; }
  try {
    const ok = await genshin.switchParty(team);
    if (ok && state) state.lastParty = team;
    if (ok) info(`   ↔ 已切换到${label}队伍「${team}」`);
    else warn(`   ⚠ 切换到${label}队伍「${team}」失败：队伍名对吗？（BGI 队伍界面里的自定义队伍名）`);
    return { switched: !!ok };
  } catch (e) {
    warn(`   ⚠ 切队伍异常：${e?.message || e}`);
    return { switched: false, error: String(e?.message || e) };
  }
}

/** 打怪映射自学习：跑某敌人目录前后对比背包，涨了的材料就是它掉的 */
export async function calibrateEnemies(cfg, state, maxDirs = 3) {
  const names = cfg.data.monsterMaterials || [];
  if (!names.length) return { done: 0, remaining: 0 };
  let index;
  try { index = getRouteIndex().index; } catch (e) { err(`校准失败，路线索引不可用：${e?.message || e}`); return { done: 0, remaining: 0 }; }

  if (cfg.dryRun) {
    const todo = [...index.enemies.keys()].filter((e) => !(state.calibrated && state.calibrated[e]));
    info(`【演练】可校准的敌人目录 ${todo.length} 个，本轮会校准 ${Math.min(maxDirs, todo.length)} 个：${todo.slice(0, maxDirs).join('、')}`);
    return { done: 0, remaining: todo.length, dryRun: true };
  }

  state.calibrated = state.calibrated || {};
  state.learned = state.learned || {};
  const todo = [...index.enemies.keys()].filter((e) => !state.calibrated[e]);
  let done = 0;
  for (const enemy of todo.slice(0, maxDirs)) {
    const paths = index.enemies.get(enemy) || [];
    if (!paths.length) { state.calibrated[enemy] = Date.now(); continue; }
    const pick = pickRunnable(paths, state.routes, loadRouteJson, cfg.cdMonsterHours, 2);
    if (!pick.picked.length) { warn(`校准「${enemy}」：路线都在 CD 内，跳过`); continue; }

    try { await ensureParty(cfg.fightTeam, cfg, state, '打怪'); } catch { /* 切队失败不阻塞校准 */ }
    const before = (await countItems(names)).counts;
    let okRoutes = 0;
    for (const p of pick.picked) {
      try {
        await runPath(p.path);
        state.routes[p.key] = { at: Date.now(), path: p.path, enemy };
        okRoutes++;
      } catch (e) { warn(`校准路线失败：${e?.message || e}`); }
    }
    if (!okRoutes) {
      warn(`校准「${enemy}」全部路线都失败/卡住，本次不标记已校准（下次再试）`);
      continue;
    }
    const after = (await countItems(names)).counts;
    const gained = {};
    for (const n of names) {
      const d = (after[n] || 0) - (before[n] || 0);
      if (d > 0) gained[n] = d;
    }
    const keys = Object.keys(gained);
    if (keys.length) {
      for (const m of keys) {
        const prev = state.learned[m];
        const sameEnemy = prev && prev.enemy === enemy;
        const hits = sameEnemy ? (prev.hits || 1) + 1 : 1;
        state.learned[m] = { enemy, hits, at: Date.now(), lastGain: gained[m] };
        // 保守：要么本来没映射，要么同一条映射被实测确认过 2 次，才真正覆盖
        const cur = cfg.data.monsterMap[m];
        if (!cur || !cur.enemy || hits >= 2 || cur.confidence === 'none') {
          cfg.data.monsterMap[m] = { enemy, confidence: 'learned', hits };
        }
      }
      info(`🧪 校准「${enemy}」→ 实测获得：${keys.map((m) => `${m}×${gained[m]}`).join('、')}`);
    } else {
      warn(`🧪 校准「${enemy}」前后背包没变化（没打怪/没拾取/或掉落已被过滤），本目录标记已校准`);
    }
    state.calibrated[enemy] = Date.now();
    saveAllRouteShards(state.routes);   // 校准跑过的路线也立刻分片落盘
    done++;
  }
  return { done, remaining: todo.length - done };
}

let routeIndexCache = null;
let routeRootUsed = null;
const fightPointCache = new Map();

/** 路线里有没有 action=fight 的点（战斗由 BGI 原生执行，本脚本只做判断提示） */
export function routeHasFightPoint(p) {
  if (fightPointCache.has(p)) return fightPointCache.get(p);
  let has = false;
  try {
    const o = JSON.parse(file.readTextSync(p));
    const pos = o.positions || o.Positions || [];
    has = pos.some((x) => String(x.action || x.Action || '').toLowerCase().includes('fight'));
  } catch { has = false; }
  fightPointCache.set(p, has);
  return has;
}

export function getRouteIndex() {
  if (routeIndexCache) return { index: routeIndexCache, root: routeRootUsed };
  const root = findAutoPathingRoot();
  if (!root) throw new Error('找不到地图追踪目录，请先在 BGI 里订阅「地图追踪」任务');
  const files = root === '(pathingScript)' ? listAutoPathingJson() : listJsonRecursive(root);
  info(`扫描地图追踪路线 ${files.length} 个 json`);
  routeIndexCache = indexRoutes(files, { excludeKeywords: ['锄地', '整活', '测试'] });
  routeRootUsed = root;
  return { index: routeIndexCache, root };
}

/** 地脉花：藏金之花=摩拉，启示之花=经验书 */
export async function runLeyLine(leyType, runs, cfg) {
  info(`▶ 地脉花「${leyType}」×${runs} 次（约 ${runs * 20} 体力）`);
  if (cfg.dryRun) return { dryRun: true };
  const fields = {
    count: runs,
    leyLineOutcropType: leyType,
    useFragileResin: !!cfg.allowFragileResin,
    isResinExhaustionMode: false,
    timeout: cfg.bossTimeoutSec || 120,
  };
  if (cfg.leyLineCountry) fields.country = cfg.leyLineCountry;
  if (cfg.leyLineTeam) fields.team = cfg.leyLineTeam;
  try {
    const param = makeParam(AutoLeyLineOutcropParam, fields);
    await dispatcher.runAutoLeyLineOutcropTask(param);
    info(`✔ 地脉花「${leyType}」完成 ${runs} 次`);
    return { ok: true };
  } catch (e) {
    err(`地脉花执行失败：${e?.message || e}`);
    return { error: String(e?.message || e) };
  }
}

/** 采集 / 打怪：跑地图追踪路线 */
export async function runRouteTask(task, cfg, state) {
  const label = task.type === 'gather' ? '采集' : '打怪';
  let routes;
  try { routes = getRouteIndex().index; } catch (e) { err(`路线索引失败：${e?.message || e}`); return { skipped: true }; }

  const m = cfg.data.materials[task.material] || {};
  const hit = routesForMaterial(routes, task.material, m, cfg.data.monsterMap);
  if (!hit.matched) {
    warn(`⏭ ${label}「${task.material}」×${task.need}：${hit.reason || '无可用路线'}`);
    return { skipped: true, reason: hit.reason };
  }
  // 纳西妲路线分类：路径含「有草神」或 action 里带 nahida_collect
  const isNahidaRoute = (p) => {
    if (/有草神|草神|纳西妲|nahida/i.test(p)) return true;
    const o = loadRouteJson(p) || {};
    const pos = o.positions || o.Positions || [];
    return pos.some((x) => String(x.action || x.Action || '').includes('nahida_collect'));
  };
  const allPaths = hit.paths;
  const nahidaPaths = allPaths.filter(isNahidaRoute);
  const plainPaths = allPaths.filter((p) => !isNahidaRoute(p));
  let usePaths = allPaths;
  if (cfg.useNahidaRoutes === false) usePaths = plainPaths;
  else if (cfg.useNahidaRoutes === true) usePaths = nahidaPaths.length ? nahidaPaths : plainPaths;
  info(`   路线分类：纳西妲 ${nahidaPaths.length} 条 / 普通 ${plainPaths.length} 条 → 本轮用 ${usePaths.length} 条`
    + (cfg.useNahidaRoutes === false ? '（设置：不用纳西妲路线）' : '（纳西妲路线优先）'));
  if (!usePaths.length) { warn(`⏭ ${label}「${task.material}」没有符合设置的路线，跳过`); return { skipped: true, reason: 'no-route-for-mode' }; }
  const cdHours = task.type === 'gather' ? cfg.cdSpecialtyHours : cfg.cdMonsterHours;
  if (hit.confidence === 'med' || hit.confidence === 'low') {
    warn(`   注意：${task.material} → 敌人「${hit.enemy}」的映射未完全证实，若跑完数量没涨请修正 data/monster-map.json`);
  }
  const { picked, deferred, remaining, pickedYield, totalYield, stuckSkipped } =
    pickRunnable(usePaths, state.routes, loadRouteJson, cdHours, cfg.routeLimit, Date.now(), {
      byYield: task.type === 'gather',
      skipStuckDays: cfg.skipStuckDays ?? 3,
    });
  info(`▶ ${label}「${task.material}」需 ${task.need}：命中 ${hit.paths.length} 条路线，本轮可跑 ${picked.length} 条`
    + (deferred.length ? `（${deferred.length} 条在 CD 内）` : '') + (remaining ? `，还有 ${remaining} 条下轮` : '')
    + (stuckSkipped.length ? `，跳过 ${stuckSkipped.length} 条最近卡住过的` : '')
    + '；战斗/队伍/策略全部由 BGI 自带（地图追踪里的 fight 点 + 自动战斗配置）');
  if (stuckSkipped.length) {
    const names = stuckSkipped.slice(0, 3).map((x) => x.path.split('/').pop()).join('、');
    warn(`   卡死黑名单：${names}${stuckSkipped.length > 3 ? ` 等 ${stuckSkipped.length} 条` : ''}（${cfg.skipStuckDays ?? 3} 天后再试；想立刻重试就删 record/state.json 里对应条目）`);
  }
  if (task.type === 'gather' && (pickedYield || totalYield)) {
    info(`   产量估算：本轮约 ${pickedYield} 个，订阅路线全部可采约 ${totalYield} 个，目标还差 ${task.need} 个`
      + (totalYield && totalYield < task.need ? `（一轮跑不满，预计需 ${Math.ceil(task.need / totalYield)} 轮，注意 ${cdHours}h 刷新 CD）` : ''));
  }
  if (task.type === 'fight') {
    const learned = state.learned && state.learned[task.material];
    const perPass = learned && learned.lastGain ? learned.lastGain : null;
    info(`   路线存量：该敌人共 ${hit.paths.length} 条路线`
      + (perPass ? `，实测上一趟约 ${perPass} 个 → 目标 ${task.need} 个约需 ${Math.ceil(task.need / perPass)} 趟` : '，还没实测过产量（打开「打怪映射自学习」跑一次就会记录）'));
    if (hit.paths.length <= 2) warn(`   ⚠「${hit.enemy}」只有 ${hit.paths.length} 条路线，一轮大概率打不满，需要多轮或自己补路线`);
  }
  // 战斗由 BGI 地图追踪自行处理（遇敌即战），不再据此告警
  if (cfg.dryRun) {
    for (const p of picked.slice(0, 5)) info(`   · ${p.path}`);
    await ensureParty(task.type === 'gather' ? cfg.gatherTeam : cfg.fightTeam, cfg, state, label);
    return { dryRun: true, picked: picked.length };
  }

  // 采集与打怪用两套队伍：批次开始前先切好
  // 路线若用「纳西妲采集(nahida_collect)」就不需要按 F；只有纯手动拾取路线才开 F 循环
  const needF = !!cfg.fallbackPickup && picked.length > 0 && !picked.some((it) => { const o = loadRouteJson(it.path) || {}; return (o.positions || o.Positions || []).some((x) => String(x.action || x.Action || "").includes("nahida_collect")); });
  const picker = needF ? startPickupLoop(1200) : { stop: async () => {} };
  if (needF) info('   已开启智能拾取：屏幕出现 F 提示时才按（照背包材料统计的做法）');
  await ensureParty(task.type === 'gather' ? cfg.gatherTeam : cfg.fightTeam, cfg, state, label);

  let ok = 0, failed = 0, stuckMarked = 0;
  const stuckMs = (cfg.routeStuckTimeoutMin || 8) * 60 * 1000;
  const costs = [];
  // 撞墙检测（事后判据）：整批跑完这个材料一点没涨 → 说明那条路线白跑了，多半卡在墙上
  let matBefore = null;
  try { matBefore = (await countItems([task.material])).counts[task.material]; } catch { matBefore = null; }
  for (const item of picked) {
    const t0 = Date.now();
    try {
      info(`   → 路跑：${item.path.split('/').pop()}`);
      await runPath(item.path);
      const costMs = Date.now() - t0;
      if (costMs < 3000) {
        failed++; stuckMarked++;
        markStuck(state.routes, item.key, item.path, costMs);
        saveRouteShard(state.routes, item.key, item.path);
        warn('   路线 ' + Math.round(costMs) + ' 毫秒就返回（疑似被取消/内部异常被 BGI 吞掉），本批中止');
        break;
      }
      const cost = Math.round(costMs / 1000);
      costs.push({ item, costMs });
      if (costMs > stuckMs) {
        // 跑完了但耗时异常 → 当可疑路线关小黑屋
        markStuck(state.routes, item.key, item.path, costMs);
        stuckMarked++;
        warn(`   这条路线跑了 ${cost} 秒（超过 ${Math.round(stuckMs / 60000)} 分钟阈值），已加入卡死黑名单，${cfg.skipStuckDays ?? 3} 天内不再排它`);
      } else {
        markDone(state.routes, item.key, item.path, costMs, { material: task.material });
      }
      ok++;
      saveRouteShard(state.routes, item.key, item.path);   // 分片落盘：崩溃最多丢这一片
    } catch (e) {
      failed++;
      if (isCancellationError(e)) {
        // 你按停止多半就是因为这条卡住了 → 一并拉黑，下次不再排它
        markStuck(state.routes, item.key, item.path, Date.now() - t0);
        stuckMarked++;
        saveRouteShard(state.routes, item.key, item.path);
        warn(`   检测到 BGI 停止请求：当前路线已拉黑（${cfg.skipStuckDays ?? 3} 天内跳过），结束本次批次`);
        break;
      }
      markStuck(state.routes, item.key, item.path, Date.now() - t0);
      stuckMarked++;
      saveRouteShard(state.routes, item.key, item.path);
      warn(`   路线失败（已加入卡死黑名单，${cfg.skipStuckDays ?? 3} 天内跳过）：${e?.message || e}`);
    }
  }
  try { await picker.stop(); } catch {}
  if (stuckMarked) warn(`   本轮有 ${stuckMarked} 条路线被拉黑；如果拉黑太多，检查游戏分辨率/弹窗/队伍`);

  // 撞墙/空跑检测：跑完了但目标材料一个没涨 → 把最耗时那条拉黑，下一轮换别的路线
  if (matBefore !== null && ok > 0 && costs.length) {
    let matAfter = null;
    try { matAfter = (await countItems([task.material])).counts[task.material]; } catch { matAfter = null; }
    const batchMs = costs.reduce((s, c) => s + c.costMs, 0);
    // 只有「跑了很久（>3分钟）还一点没涨」才判撞墙，避免误伤（拾取过滤/材料已够等）
    if (matAfter !== null && matAfter <= matBefore && costs.length >= 2 && batchMs > 180000) {
      const worst = costs.reduce((a, b) => (b.costMs > a.costMs ? b : a), costs[0]);
      markStuck(state.routes, worst.item.key, worst.item.path, worst.costMs);
      stuckMarked++;
      warn(`   跑了 ${ok} 条路线但「${task.material}」${matBefore}→${matAfter} 完全没涨：已把最耗时的「${worst.item.path.split('/').pop()}」拉黑`
        + `（很可能是撞墙/卡地形白跑；${cfg.skipStuckDays ?? 3} 天内不再排它）`);
    } else if (matAfter !== null) {
      info(`   本批实测产出：${task.material} ${matBefore} → ${matAfter}`);
    }
  }
  return { ok, failed, stuckMarked, deferred: deferred.length, remaining, stuckSkipped: stuckSkipped.length };
}
