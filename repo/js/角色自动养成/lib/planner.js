// lib/planner.js —— 纯逻辑：养成需求 → 材料目标 → 背包缺口 → 可执行任务队列
// 不依赖任何 BGI 全局对象，可在 Node 里单测。

/** 角色等级 → 已完成的突破阶段数（cap: 20/40/50/60/70/80/90） */
export function ascensionStagesForLevel(level) {
  if (!Number.isFinite(level)) return 0;
  const caps = [20, 40, 50, 60, 70, 80, 90];
  let n = 0;
  for (let i = 0; i < caps.length - 1; i++) if (level > caps[i]) n = i + 1;
  return n;
}

/** 从 curLevel 升到 tgtLevel 需要补做哪几阶突破：返回 [startIndex, endIndex) */
export function ascensionStagesBetween(curLevel, tgtLevel) {
  const from = ascensionStagesForLevel(curLevel ?? 1);
  const to = ascensionStagesForLevel(tgtLevel ?? 90);
  return { from: Math.min(from, to), to: Math.max(from, to) };
}

/** 单个天赋等级 → 需要叠加的成本等级行（天赋 1 级 = 无消耗） */
export function talentLevelsFor(targetLevel) {
  const out = [];
  for (let lv = 2; lv <= targetLevel; lv++) out.push(String(lv));
  return out;
}

const addTo = (map, name, n) => { map[name] = (map[name] || 0) + n; };

/**
 * 汇总养成目标
 * @param {object} data {characters, weapons}
 * @param {Array} plan [{character, level, talents:[t1,t2,t3], weapon:{name, level}|null}]
 * @returns {{targets:Object<string,number>, detail:Array, warnings:string[]}}
 */
export function buildTargets(data, plan) {
  const targets = {};
  const detail = [];
  const warnings = [];

  for (const item of plan || []) {
    const ch = data.characters[item.character];
    if (!ch) { warnings.push(`未知角色：${item.character}`); continue; }

    // 1) 角色突破（支持 当前等级→目标等级，只算中间没做的阶段）
    const range = ascensionStagesBetween(item.levelFrom, item.level ?? 90);
    const own = {};
    for (let i = range.from; i < range.to; i++) {
      for (const it of ch.ascensionStages[i] || []) addTo(own, it.name, it.count);
    }
    for (const [n, v] of Object.entries(own)) if (n !== '摩拉') addTo(targets, n, v);
    detail.push({ source: `角色:${item.character}@${item.levelFrom ? item.levelFrom + '→' : ''}${item.level ?? 90}`, materials: { ...own } });

    // 2) 天赋（3 个，支持 当前天赋→目标天赋）
    const talents = Array.isArray(item.talents) ? item.talents : [1, 1, 1];
    const talentsFrom = Array.isArray(item.talentsFrom) ? item.talentsFrom : [1, 1, 1];
    if (ch.talent) {
      const tal = {};
      for (let i = 0; i < 3; i++) {
        const from = Math.max(1, Number(talentsFrom[i] || 1));
        const to = Math.max(from, Number(talents[i] || 1));
        for (let lv = from + 1; lv <= to; lv++) {
          for (const it of ch.talent.levels[String(lv)] || []) addTo(tal, it.name, it.count);
        }
      }
      for (const [n, v] of Object.entries(tal)) if (n !== '摩拉') addTo(targets, n, v);
      detail.push({ source: `天赋:${item.character}@${talentsFrom.join('/')}→${talents.join('/')}`, materials: { ...tal } });
    } else if (talents.some((t) => (t ?? 1) > 1)) {
      warnings.push(`${item.character} 缺少天赋数据，已忽略天赋需求`);
    }

    // 3) 武器突破
    if (item.weapon && item.weapon.name) {
      const wp = data.weapons[item.weapon.name];
      if (!wp) { warnings.push(`未知武器：${item.weapon.name}`); continue; }
      const wRange = ascensionStagesBetween(item.weapon.levelFrom ?? 1, item.weapon.level ?? 90);
      const wo = {};
      for (let i = wRange.from; i < wRange.to; i++) {
        for (const it of wp.ascensionStages?.[i] || []) addTo(wo, it.name, it.count);
      }
      for (const [n, v] of Object.entries(wo)) if (n !== '摩拉') addTo(targets, n, v);
      detail.push({ source: `武器:${item.weapon.name}@${item.weapon.levelFrom ? item.weapon.levelFrom + '→' : ''}${item.weapon.level ?? 90}`, materials: { ...wo } });
    }
  }
  return { targets, detail, warnings };
}

/**
 * 目标 - 快照 → 缺口
 * @param {Object<string,number>} targets
 * @param {Object<string,number|null>} snapshot  null = 未知（识别失败），绝不当作 0
 * @returns {{shortfall:Object<string,number>, unknown:string[], satisfied:Object<string,number>}}
 */
export function computeShortfall(targets, snapshot) {
  const shortfall = {}, satisfied = {}, unknown = [];
  for (const [name, need] of Object.entries(targets)) {
    const have = snapshot?.[name];
    if (have === null || have === undefined || Number.isNaN(have)) { unknown.push(name); continue; }
    const gap = need - have;
    if (gap > 0) shortfall[name] = gap; else satisfied[name] = have;
  }
  return { shortfall, satisfied, unknown };
}

/** 每 20 体力秘境的期望产出（按材料稀有度档位），可被 options 覆盖 */
export const DEFAULT_DOMAIN_RATES = {
  // 精通秘境（天赋书）20 体力
  talentbook: { 2: 2.2, 3: 1.5, 4: 0.45, 5: 0 },
  // 炼武秘境（武器材料）20 体力
  weaponmat: { 2: 2.6, 3: 1.9, 4: 0.6, 5: 0.18 },
};
/** 世界 BOSS 40 体力：首领素材平均掉落 */
export const DEFAULT_BOSS_YIELD = 2.4;
/** 单次秘境体力 */
export const DOMAIN_RESIN = 20;
export const BOSS_RESIN = 40;

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/** 秘境材料今天是否开放（天赋书/武器材料每周只有 3 天） */
export function isMaterialOpenToday(meta, today) {
  const days = (meta && meta.days) || [];
  if (!days.length) return { open: true, weekday: '' };
  const wd = WEEKDAY[(today || new Date()).getDay()];
  return { open: days.includes(wd), weekday: wd, days };
}

const tierOf = (name, materials) => (materials?.[name]?.rarity || 3);

/** 秘境材料缺口 → 需要刷几次
 *  思路：把各档需求按 3 低 = 1 高 折算成「最高档等价量」，用每趟的最高档等价产出算轮数；
 *        再用最低档（绿）本身的产出上限兜一次，避免「只刷紫、绿不够」。
 */
export function domainRunsNeeded(entries, rates) {
  const need = {};
  for (const e of entries) need[e.rarity] = (need[e.rarity] || 0) + e.count;
  const tiers = Object.keys(rates).map(Number).filter((t) => (rates[t] || 0) > 0).sort((a, b) => b - a);
  if (!tiers.length) return 0;
  const top = tiers[0];
  let needEquiv = 0, runEquiv = 0;
  for (const t of tiers) {
    const factor = Math.pow(3, t - top);      // 高一级 = 3 个低一级
    needEquiv += (need[t] || 0) / factor;
    runEquiv += (rates[t] || 0) / factor;
  }
  const lowest = tiers[tiers.length - 1];
  const byEquiv = runEquiv > 0 ? Math.ceil(needEquiv / runEquiv) : 0;
  const byLowest = (rates[lowest] || 0) > 0 ? Math.ceil((need[lowest] || 0) / rates[lowest]) : 0;
  return Math.max(0, byEquiv, byLowest);
}

/**
 * 缺口 → 任务队列
 * @param {object} data {characters, weapons, materials}
 * @param {Object<string,number>} shortfall
 * @param {object} opts {resinBudget, allowFragileResin, gatherEnabled, fightEnabled, weeklyEnabled, domainRates}
 */
export function buildTasks(data, shortfall, opts = {}) {
  const materials = data.materials || {};
  const o = {
    resinBudget: 200, allowFragileResin: false, gatherEnabled: true, fightEnabled: true,
    weeklyEnabled: false, domainRates: DEFAULT_DOMAIN_RATES, ...opts,
  };
  const tasks = [];
  const skipped = [];

  // 秘境材料按秘境分组（同一秘境一趟刷多种档位最划算）
  const domainGroups = new Map();
  for (const [name, need] of Object.entries(shortfall)) {
    const m = materials[name];
    if (!m) { skipped.push({ material: name, need, reason: '材料未知' }); continue; }
    if (m.kind === 'talentbook' || m.kind === 'weaponmat') {
      const openToday = isMaterialOpenToday(m, o.today);
      if (!openToday.open) {
        skipped.push({ material: name, need, reason: `今天（${openToday.weekday}）不开本，开放：${openToday.days.join('/')}` });
        continue;
      }
      const entrance = m.domainEntrance || m.domain || '';
      const key = entrance || `未知秘境:${name}`;
      if (!domainGroups.has(key)) domainGroups.set(key, { domain: entrance, subDomain: m.domain || '', kind: m.kind, entries: [] });
      domainGroups.get(key).entries.push({ name, count: need, rarity: tierOf(name, materials) });
    }
  }
  for (const [domain, g] of domainGroups) {
    const runs = domainRunsNeeded(g.entries, o.domainRates[g.kind] || {});
    tasks.push({
      type: 'domain', domain, kind: g.kind, runs,
      resin: runs * DOMAIN_RESIN,
      materials: g.entries.map((e) => ({ name: e.name, need: e.count })),
      reason: `${g.kind === 'talentbook' ? '天赋书' : '武器材料'}缺口`,
    });
  }

  // BOSS
  for (const [name, need] of Object.entries(shortfall)) {
    const m = materials[name];
    if (!m || m.kind !== 'boss') continue;
    const runs = Math.ceil(need / DEFAULT_BOSS_YIELD);
    tasks.push({ type: 'boss', bossMaterial: name, runs, resin: runs * BOSS_RESIN, materials: [{ name, need }], reason: '突破首领素材缺口' });
  }

  // 周本 / 宝石 / 摩拉 / 皇冠：只报告
  for (const [name, need] of Object.entries(shortfall)) {
    const m = materials[name];
    if (!m) continue;
    if (m.kind === 'weekly' && !o.weeklyEnabled) { skipped.push({ material: name, need, reason: '周本材料（默认不自动刷）' }); continue; }
    if (m.kind === 'gem') { skipped.push({ material: name, need, reason: '元素晶体：随首领/周本掉落，或自行合成' }); continue; }
    if (m.kind === 'mora') { skipped.push({ material: name, need, reason: '摩拉不采集' }); continue; }
    if (m.kind === 'crown') { skipped.push({ material: name, need, reason: '皇冠不自动刷' }); continue; }
  }

  // 采集（特产）
  const gather = [];
  for (const [name, need] of Object.entries(shortfall)) {
    const m = materials[name];
    if (!m || m.kind !== 'specialty') continue;
    if (!o.gatherEnabled) { skipped.push({ material: name, need, reason: '采集已关闭' }); continue; }
    gather.push({ type: 'gather', material: name, need, region: m.region || '', reason: '区域特产缺口' });
  }
  gather.sort((a, b) => b.need - a.need);

  // 打怪（怪物掉落）
  const fight = [];
  for (const [name, need] of Object.entries(shortfall)) {
    const m = materials[name];
    if (!m || m.kind !== 'monster') continue;
    if (!o.fightEnabled) { skipped.push({ material: name, need, reason: '打怪已关闭' }); continue; }
    fight.push({ type: 'fight', material: name, need, reason: '怪物掉落缺口' });
  }
  fight.sort((a, b) => b.need - a.need);

  // 任务排序：体力任务按「材料数/体力」效率从高到低 → 再采集 → 打怪
  const order = { domain: 0, boss: 0, gather: 1, fight: 2 };
  const efficiency = (t) => {
    const need = (t.materials || []).reduce((s, m) => s + m.need, 0);
    return t.resin > 0 ? need / t.resin : need;
  };
  tasks.push(...gather, ...fight);
  tasks.sort((a, b) => (order[a.type] - order[b.type]) || (efficiency(b) - efficiency(a)));

  // 体力预算截断（优先保留先执行的秘境/首领）
  let spent = 0;
  const budgeted = [];
  for (const t of tasks) {
    if (!t.resin) { budgeted.push(t); continue; }
    if (spent + t.resin <= o.resinBudget) { spent += t.resin; budgeted.push(t); }
    else {
      const remainResin = o.resinBudget - spent;
      const unit = t.type === 'boss' ? BOSS_RESIN : DOMAIN_RESIN;
      const fitRuns = Math.floor(remainResin / unit);
      if (fitRuns > 0) {
        const part = { ...t, runs: fitRuns, resin: fitRuns * unit, partial: true };
        spent += part.resin;
        budgeted.push(part);
      }
      skipped.push({
        material: t.materials.map((m) => m.name).join('/'),
        need: t.materials.reduce((s, m) => s + m.need, 0),
        reason: `体力预算不足（已在 ${o.resinBudget} 体力处截断，可开启脆弱树脂或用更多体力）`,
      });
    }
  }

  return { tasks: budgeted, skipped, resinPlanned: spent };
}

/**
 * 解析「养成计划」文本，每行一个角色：
 *   胡桃 90 9/9/9 护摩之杖 90
 *   芙宁娜 90 10/10/10
 * 规则：第一个中文名是角色，第 1 个纯数字是角色等级，a/b/c 是天赋等级，
 *       第 2 个纯数字是武器等级，天赋后出现的名字是武器名。
 */
export function parsePlanText(text) {
  const plan = [];
  const errors = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const tokens = line.split(/[\s,，;；]+/).filter(Boolean);
    let character = null, level = 90, levelFrom = null, talents = null, talentsFrom = null, weapon = null, weaponLevel = 90, weaponLevelFrom = null;
    let numberSeen = 0, nameSeen = 0;
    for (const tk of tokens) {
      // 天赋区间 6/6/6>9/9/9
      const talRange = tk.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,2})[>→](\d{1,2})\/(\d{1,2})\/(\d{1,2})$/);
      if (talRange) {
        talentsFrom = [Number(talRange[1]), Number(talRange[2]), Number(talRange[3])];
        talents = [Number(talRange[4]), Number(talRange[5]), Number(talRange[6])];
        continue;
      }
      const tal = tk.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/);
      if (tal) { talents = [Number(tal[1]), Number(tal[2]), Number(tal[3])]; continue; }
      // 等级区间 22>90
      const lvRange = tk.match(/^(\d{1,3})[>→](\d{1,3})$/);
      if (lvRange) {
        if (numberSeen === 0 && !weapon) { levelFrom = Number(lvRange[1]); level = Number(lvRange[2]); numberSeen = 1; }
        else { weaponLevelFrom = Number(lvRange[1]); weaponLevel = Number(lvRange[2]); }
        continue;
      }
      if (/^\d{1,3}$/.test(tk)) {
        if (numberSeen === 0 && !weapon) { level = Number(tk); numberSeen = 1; }
        else { weaponLevel = Number(tk); }
        continue;
      }
      if (!character) { character = tk; nameSeen = 1; continue; }
      weapon = tk; nameSeen++;
    }
    if (!character) { errors.push(`第 ${i + 1} 行：缺少角色名`); return; }
    plan.push({
      character, level, levelFrom: levelFrom || undefined,
      talents: talents || [1, 1, 1],
      talentsFrom: talentsFrom || undefined,
      weapon: weapon ? { name: weapon, level: weaponLevel, levelFrom: weaponLevelFrom || undefined } : null,
    });
  });
  return { plan, errors };
}

/**
 * 解析「映射补充」文本，支持两种写法：
 *   材料=敌人;\n材料2=敌人2
 *   "凝云鳞甲": "隐山猊兽",   （从 JSON 里直接粘来的也行）
 */
export function parseMappingText(text) {
  const out = {};
  const bad = [];
  for (const raw of String(text || '').split(/[\n;；,，]+/)) {
    const line = raw.trim().replace(/^["']|["']$/g, '').replace(/\s*[:：]\s*/, '=');
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const m = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (!m) { if (line.length > 1) bad.push(line); continue; }
    const key = m[1].trim().replace(/^["']|["']$/g, '');
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (key && val && val !== '""') out[key] = val;
  }
  return { map: out, bad };
}

/** 名字打错时给建议：包含关系优先，其次编辑距离 ≤2 */
export function suggestName(input, candidates, limit = 3) {
  const s = String(input || '').trim();
  if (!s) return [];
  const lev = (a, b) => {
    const m = a.length, n = b.length;
    if (!m || !n) return Math.max(m, n);
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  };
  const commonPrefix = (a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };
  const scored = [];
  for (const c of candidates || []) {
    if (!c) continue;
    let score = -1;
    if (c === s) score = 1000;
    else if (c.includes(s) || s.includes(c)) score = 100 + Math.min(c.length, s.length);
    else {
      const d = lev(s, c);
      const cp = commonPrefix(s, c);
      if (d <= 2 || cp >= 1) score = cp * 10 + (5 - d); // 共同前缀权重最高（雷神→雷电将军）
    }
    if (score > 0) scored.push([c, score]);
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, limit).map((x) => x[0]);
}

/** 摩拉预估（只提示，不参与刷取）：按 当前→目标 汇总所有阶段的摩拉 */
export function estimateMora(data, plan) {
  let mora = 0;
  for (const item of plan || []) {
    const ch = data.characters[item.character];
    if (!ch) continue;
    const r = ascensionStagesBetween(item.levelFrom, item.level ?? 90);
    for (let i = r.from; i < r.to; i++) for (const it of ch.ascensionStages[i] || []) if (it.name === '摩拉') mora += it.count;
    if (ch.talent) {
      const from = Array.isArray(item.talentsFrom) ? item.talentsFrom : [1, 1, 1];
      const to = Array.isArray(item.talents) ? item.talents : [1, 1, 1];
      for (let k = 0; k < 3; k++) {
        const a = Math.max(1, Number(from[k] || 1)), b = Math.max(a, Number(to[k] || 1));
        for (let lv = a + 1; lv <= b; lv++) for (const it of ch.talent.levels[String(lv)] || []) if (it.name === '摩拉') mora += it.count;
      }
    }
    if (item.weapon && item.weapon.name) {
      const wp = data.weapons[item.weapon.name];
      if (wp) {
        const wr = ascensionStagesBetween(item.weapon.levelFrom ?? 1, item.weapon.level ?? 90);
        for (let i = wr.from; i < wr.to; i++) for (const it of wp.ascensionStages?.[i] || []) if (it.name === '摩拉') mora += it.count;
      }
    }
  }
  return mora;
}

/** 生产人读报告用的汇总 */export function summarize({ targets, shortfall, tasks, skipped }) {
  const lines = [];
  const tgtCount = Object.keys(targets || {}).length;
  lines.push(`目标材料 ${tgtCount} 种，缺口 ${Object.keys(shortfall || {}).length} 种`);
  for (const t of tasks || []) {
    if (t.type === 'domain') lines.push(`秘境 ${t.domain} ×${t.runs}（${t.resin}体）：${t.materials.map((m) => `${m.name}×${m.need}`).join('、')}`);
    else if (t.type === 'boss') lines.push(`首领 ${t.bossMaterial} ×${t.runs}（${t.resin}体）`);
    else if (t.type === 'gather') lines.push(`采集 ${t.material}×${t.need}${t.region ? `（${t.region}）` : ''}`);
    else if (t.type === 'fight') lines.push(`打怪 ${t.material}×${t.need}`);
  }
  for (const s of skipped || []) lines.push(`跳过 ${s.material}×${s.need}：${s.reason}`);
  return lines.join('\n');
}
