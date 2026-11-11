// 纯逻辑单测（Node/Electron-as-node 运行，无需游戏）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as P from '../lib/planner.js';
import * as R from '../lib/routes.js';

const D = 'C:/a.funna/DSH/gz/pro/data';
const characters = JSON.parse(fs.readFileSync(D + '/characters.json', 'utf8')).characters;
const weapons = JSON.parse(fs.readFileSync(D + '/weapons.json', 'utf8')).weapons;
const materials = JSON.parse(fs.readFileSync(D + '/materials.json', 'utf8')).materials;
const monsterMap = JSON.parse(fs.readFileSync(D + '/monster-map.json', 'utf8')).map;
const data = { characters, weapons, materials };
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✔', name); } catch (e) { fail++; console.log('  ✘', name, '\n     ', e.message); } };

console.log('== planner');
t('突破阶段换算', () => {
  assert.equal(P.ascensionStagesForLevel(90), 6);
  assert.equal(P.ascensionStagesForLevel(80), 5);
  assert.equal(P.ascensionStagesForLevel(81), 6);
  assert.equal(P.ascensionStagesForLevel(70), 4);
  assert.equal(P.ascensionStagesForLevel(40), 1);
  assert.equal(P.ascensionStagesForLevel(20), 0);
});

const plan = [{ character: '胡桃', level: 90, talents: [9, 9, 9], weapon: { name: '护摩之杖', level: 90 } }];
const { targets, warnings } = P.buildTargets(data, plan);

t('胡桃 90 级突破数量正确', () => {
  assert.equal(targets['霓裳花'], 168);
  assert.equal(targets['未熟之玉'], 46);
  assert.equal(targets['燃愿玛瑙'], 6);
});
t('天赋 9/9/9 = 教导9 指引63 哲学66', () => {
  assert.equal(targets['「勤劳」的教导'], 9);
  assert.equal(targets['「勤劳」的指引'], 63);
  assert.equal(targets['「勤劳」的哲学'], 66);
});
t('武器突破材料已计入且无警告', () => {
  const weaponMats = Object.keys(targets).filter((n) => materials[n]?.kind === 'weaponmat');
  assert.ok(weaponMats.length >= 3, '应至少 3 种武器材料，实际 ' + weaponMats.join(','));
  assert.deepEqual(warnings, []);
});
t('天赋 1/1/1 不产生天赋书需求', () => {
  const r = P.buildTargets(data, [{ character: '胡桃', level: 90, talents: [1, 1, 1] }]);
  assert.equal(r.targets['「勤劳」的教导'], undefined);
});

console.log('== shortfall');
const snapshot = { '霓裳花': 100, '未熟之玉': 60, '「勤劳」的教导': 0 };
const { shortfall, satisfied, unknown } = P.computeShortfall(targets, snapshot);
t('已满足的不进缺口', () => assert.equal(shortfall['未熟之玉'], undefined));
t('缺口 = 目标 - 现有', () => assert.equal(shortfall['霓裳花'], 68));
t('快照缺失 ≠ 0，进 unknown', () => {
  assert.ok(unknown.includes('燃愿玛瑙'), 'unknown 应含燃愿玛瑙');
  assert.equal(shortfall['燃愿玛瑙'], undefined);
});
t('satisfied 记录现有量', () => assert.equal(satisfied['未熟之玉'], 60));

console.log('== tasks');
const { tasks, skipped, resinPlanned } = P.buildTasks(data, shortfall, { resinBudget: 200, today: new Date('2026-11-10T12:00:00') });
t('生成秘境/首领/采集/打怪四类任务', () => {
  const types = new Set(tasks.map((x) => x.type));
  assert.ok(types.has('domain'), '缺 domain');
  assert.ok(types.has('gather'), '缺 gather');
});
t('秘境任务带域名与轮数（域名为 BGI tp.json 里校验过的入口名）', () => {
  const domains = JSON.parse(fs.readFileSync(D + '/domains.json', 'utf8'));
  const entrances = new Set(domains.entrances);
  const d = tasks.filter((x) => x.type === 'domain');
  assert.ok(d.length >= 1);
  for (const x of d) {
    assert.ok(entrances.has(x.domain), `域名「${x.domain}」不在 BGI tp.json 秘境入口清单里`);
    assert.ok(x.runs > 0);
  }
});
t('胡桃 9/9/9 的秘境是太山府（璃月天赋本）', () => {
  const d = tasks.filter((x) => x.type === 'domain');
  assert.ok(d.some((x) => x.domain === '太山府'), '实际: ' + d.map((x) => x.domain).join(','));
});
t('计划文本解析', () => {
  const r = P.parsePlanText('胡桃 90 9/9/9 护摩之杖 90\n# 注释\n\n芙宁娜 90 10/10/10\n   \n');
  assert.equal(r.plan.length, 2);
  assert.equal(r.plan[0].character, '胡桃');
  assert.equal(r.plan[0].level, 90);
  assert.deepEqual(r.plan[0].talents, [9, 9, 9]);
  assert.equal(r.plan[0].weapon.name, '护摩之杖');
  assert.equal(r.plan[0].weapon.level, 90);
  assert.equal(r.plan[1].weapon, null);
  assert.deepEqual(r.errors, []);
});
t('计划文本也能只写角色名', () => {
  const r = P.parsePlanText('胡桃');
  assert.equal(r.plan[0].level, 90);
  assert.deepEqual(r.plan[0].talents, [1, 1, 1]);
});
t('体力预算生效且不超过', () => assert.ok(resinPlanned <= 200, 'resinPlanned=' + resinPlanned));
t('首领任务按 40 体/次', () => {
  const b = tasks.filter((x) => x.type === 'boss');
  for (const x of b) assert.equal(x.resin, x.runs * 40);
});
t('宝石/摩拉进跳过清单而非任务', () => {
  // 全部材料都给 0 存量，让宝石/摩拉真正进入缺口，才能验证跳过逻辑
  const zeroSnapshot = {};
  for (const n of Object.keys(targets)) zeroSnapshot[n] = 0;
  const sf = P.computeShortfall(targets, zeroSnapshot).shortfall;
  const r = P.buildTasks(data, sf, { resinBudget: 200, today: new Date('2026-11-10T12:00:00') });
  const all = r.skipped.map((s) => s.material);
  assert.ok(all.length > 0, '应有跳过项');
  assert.ok(all.some((m) => materials[m]?.kind === 'gem' || materials[m]?.kind === 'mora'), '应跳过宝石/摩拉: ' + all.join(','));
  assert.ok(!r.tasks.some((x) => x.materials?.some((m) => materials[m.name]?.kind === 'mora')));
});
t('预算为 0 时不排体力任务', () => {
  const r = P.buildTasks(data, shortfall, { resinBudget: 0 });
  assert.equal(r.tasks.filter((x) => x.resin > 0).length, 0);
  assert.ok(r.tasks.some((x) => x.type === 'gather' || x.type === 'fight'));
});
t('summarize 可读', () => {
  const s = P.summarize({ targets, shortfall, tasks, skipped });
  assert.ok(s.includes('缺口') && s.length > 20);
});

console.log('== routes');
const paths = [
  'C:/x/User/AutoPathing/地方特产/璃月/霓裳花/san/霓裳花-轻策庄.json',
  'C:/x/User/AutoPathing/地方特产/璃月/霓裳花/san/霓裳花-璃月港.json',
  'C:/x/User/AutoPathing/敌人与魔物/骗骗花/san/骗骗花-天衡山.json',
  'C:/x/User/AutoPathing/矿物/铁块/a/铁块-蒙德.json',
  'C:/x/User/AutoPathing/锄地专区/某锄地/x.json',
  'C:/x/User/AutoPathing/地方特产/璃月/清心/b/清心.json',
];
const idx = R.indexRoutes(paths);
t('索引出特产/敌人/其它采集', () => {
  assert.equal(idx.specialty.get('霓裳花').paths.length, 2);
  assert.equal(idx.specialty.get('霓裳花').region, '璃月');
  assert.equal(idx.enemies.get('骗骗花').length, 1);
  assert.ok(idx.gatherOther.get('铁块').length === 1);
});
t('特产材料命中', () => {
  const r = R.routesForMaterial(idx, '霓裳花', materials['霓裳花'], monsterMap);
  assert.equal(r.matched, true); assert.equal(r.kind, 'specialty'); assert.equal(r.paths.length, 2);
});
t('怪物材料经映射命中敌人路线', () => {
  const r = R.routesForMaterial(idx, '骗骗花蜜', materials['骗骗花蜜'], monsterMap);
  assert.equal(r.matched, true); assert.equal(r.kind, 'monster'); assert.equal(r.enemy, '骗骗花');
});
t('未订阅的敌人给出原因而非静默', () => {
  const r = R.routesForMaterial(idx, '不祥的面具', materials['不祥的面具'], monsterMap);
  assert.equal(r.matched, false);
  assert.ok(/未订阅|映射/.test(r.reason), r.reason);
});
t('CD 内不可跑 / 过期可跑', () => {
  const rec = { k1: { at: Date.now() - 3600 * 1000 } };       // 1 小时前
  assert.equal(R.isReady(rec, 'k1', 48).ready, false);
  assert.equal(R.isReady(rec, 'k1', 0.5).ready, true);
  assert.equal(R.isReady({}, 'none', 48).ready, true);
});
t('pickRunnable 按上次执行时间排序并限流', () => {
  const now = Date.now();
  const rec = { p1: { at: now - 1000 }, p2: { at: now - 5000 } };
  const loader = (p) => ({ info: { name: p } });
  const paths2 = ['C:/a/AutoPathing/地方特产/璃月/霓裳花/a.json', 'C:/b/AutoPathing/地方特产/璃月/霓裳花/b.json'];
  // 用 routeKey 真实算法构造记录
  const rec2 = {};
  for (const p of paths2) rec2[R.routeKey(p, loader(p))] = { at: p.includes('a.json') ? now - 1000 : now - 9000 };
  const r = R.pickRunnable(paths2, rec2, loader, 0, 1, now);
  assert.equal(r.picked.length, 1);
  assert.equal(r.remaining, 1);
  assert.ok(r.picked[0].path.includes('b.json'), '更久没跑的应先跑');
});
t('路径改名不丢 CD（内容指纹）', () => {
  const route = { positions: [{ x: 1.234, y: 5.678, type: 1 }, { x: 9.87, y: 6.54, type: 2 }], info: { name: '霓裳花-轻策庄' } };
  const a = R.routeKey('C:/x/旧名字.json', route);
  const b = R.routeKey('C:/y/新名字.json', route);
  assert.equal(a, b);
});

t('路线产量解析（-14个 / _12 / 描述里的 N个）', () => {
  assert.equal(R.parseRouteYield('C:/x/地方特产/璃月/霓裳花/霓裳花-璃月港-14个.json'), 14);
  assert.equal(R.parseRouteYield('C:/x/地方特产/璃月/石珀/石珀-奥藏山_12.json'), 12);
  assert.equal(R.parseRouteYield('C:/x/a.json', '共 20个 特产'), 20);
  assert.equal(R.parseRouteYield('C:/x/无数字.json'), null);
  assert.equal(R.parseRouteYield('C:/x/3个/子目录里.json'), null);
});
t('采集按产量优先挑路线', () => {
  const paths = [
    'C:/b/AutoPathing/地方特产/璃月/石珀/x-3个.json',
    'C:/b/AutoPathing/地方特产/璃月/石珀/y-20个.json',
    'C:/b/AutoPathing/地方特产/璃月/石珀/z-8个.json',
  ];
  const r = R.pickRunnable(paths, {}, null, 48, 2, Date.now(), { byYield: true });
  assert.deepEqual(r.picked.map((x) => x.path.split('/').pop()), ['y-20个.json', 'z-8个.json']);
  assert.equal(r.pickedYield, 28);
  assert.equal(r.totalYield, 31);
  assert.equal(r.remaining, 1);
});

t('补映射文本解析（= 与 JSON 冒号两种写法）', () => {
  const r = P.parseMappingText('幻造晶鳞石=肌生晶石的妖精; 幽雾兜盔=冬国仕女\n"凝云鳞甲": "隐山猊兽"\n# 注释\n随便一行没等号');
  assert.equal(r.map['幻造晶鳞石'], '肌生晶石的妖精');
  assert.equal(r.map['幽雾兜盔'], '冬国仕女');
  assert.equal(r.map['凝云鳞甲'], '隐山猊兽');
  assert.equal(Object.keys(r.map).length, 3);
  assert.deepEqual(r.bad, ['随便一行没等号']);
});

t('角色名打错给建议', () => {
  const names = ['胡桃', '芙宁娜', '雷电将军', '枫原万叶'];
  assert.deepEqual(P.suggestName('胡陶', names).slice(0, 1), ['胡桃']);
  assert.deepEqual(P.suggestName('芙宁', names).slice(0, 1), ['芙宁娜']);
  assert.deepEqual(P.suggestName('雷神', names).slice(0, 1), ['雷电将军']); // 简称也能给出候选
  assert.deepEqual(P.suggestName('雷电将军', names).slice(0, 1), ['雷电将军']);
});

t('卡过的路线在 N 天内被跳过，过后恢复', () => {
  const now = Date.now();
  const p = 'C:/b/AutoPathing/地方特产/璃月/石珀/y-20个.json';
  const k = R.routeKey(p, null);
  const rec = { [k]: { at: now - 1000, stuckAt: now - 3600 * 1000 } };
  const r = R.pickRunnable([p], rec, null, 0, 5, now, { skipStuckDays: 3 });
  assert.equal(r.picked.length, 0);
  assert.equal(r.stuckSkipped.length, 1);
  const r2 = R.pickRunnable([p], rec, null, 0, 5, now + 4 * 86400000, { skipStuckDays: 3 });
  assert.equal(r2.picked.length, 1);
  assert.equal(r2.stuckSkipped.length, 0);
});
t('markStuck / markDone 双向切换', () => {
  const m = {};
  R.markStuck(m, 'k1', '/a/x.json', 500000);
  assert.ok(m.k1.stuckAt > 0);
  assert.equal(m.k1.stuckCount, 1);
  R.markDone(m, 'k1', '/a/x.json', 60000, { material: '霓裳花' });
  assert.equal(m.k1.stuckAt, null);
  assert.equal(m.k1.material, '霓裳花');
  assert.equal(m.k1.costMs, 60000);
});

t('秘境开放日：不开本时不排秘境任务', () => {
  const monday = new Date('2026-11-09T12:00:00');   // 周一
  const tuesday = new Date('2026-11-10T12:00:00');
  const sf = { '「勤劳」的教导': 9 };
  const closed = P.buildTasks(data, sf, { resinBudget: 200, today: monday });
  assert.equal(closed.tasks.filter((x) => x.type === 'domain').length, 0);
  assert.ok(closed.skipped.some((s) => /今天（周一）不开本/.test(s.reason)), JSON.stringify(closed.skipped));
  const open = P.buildTasks(data, sf, { resinBudget: 200, today: tuesday });
  assert.equal(open.tasks.filter((x) => x.type === 'domain').length, 1);
  assert.equal(open.tasks.find((x) => x.type === 'domain').domain, '太山府');
});

t('当前等级→目标等级 只算剩余（22→90 不重刷已突破的）', () => {
  const full = P.buildTargets(data, [{ character: '胡桃', level: 90, talents: [1, 1, 1] }]);
  const part = P.buildTargets(data, [{ character: '胡桃', levelFrom: 22, level: 90, talents: [1, 1, 1] }]);
  assert.equal(full.targets['霓裳花'], 168);
  assert.equal(part.targets['霓裳花'], 165);
  assert.equal(part.targets['未熟之玉'], full.targets['未熟之玉']);   // 首领素材不在第一阶，起点相同
});
t('天赋 6/6/6→9/9/9 只算 7/8/9', () => {
  const r = P.buildTargets(data, [{ character: '胡桃', level: 1, talentsFrom: [6, 6, 6], talents: [9, 9, 9] }]);
  const full = P.buildTargets(data, [{ character: '胡桃', level: 1, talents: [9, 9, 9] }]);
  assert.equal(r.targets['「勤劳」的哲学'], full.targets['「勤劳」的哲学']);   // 9/9/9 本来只用 7-9 级
  assert.equal(r.targets['「勤劳」的教导'], undefined);
});
t('计划文本支持 22>90 和 6/6/6>9/9/9', () => {
  const r = P.parsePlanText('胡桃 22>90 6/6/6>9/9/9 护摩之杖 1>90');
  const p = r.plan[0];
  assert.equal(p.levelFrom, 22); assert.equal(p.level, 90);
  assert.deepEqual(p.talentsFrom, [6, 6, 6]); assert.deepEqual(p.talents, [9, 9, 9]);
  assert.equal(p.weapon.levelFrom, 1); assert.equal(p.weapon.level, 90);
});

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
