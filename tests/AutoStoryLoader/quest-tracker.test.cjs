const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../../repo/js/AutoStoryLoader');
const source = fs.readFileSync(path.join(root, 'quest-tracker.js'), 'utf8');
const lib = vm.runInNewContext(source);
const name = '星火交汇于冻原';
const row = (text, x = 120, y = 200) => ({text, x, y, width: 230, height: 30});

function scenario(config = {}) {
  let time = 0, page = config.initialPage || 0, selected = config.selected || '其他任务';
  let tracked = !!config.tracked, journal = !!config.journal, readyAt = 0;
  let trackingReadyAt = Infinity;
  let paimon = !!config.paimon;
  const pages = config.pages || [[name]];
  const calls = {track: 0, select: 0, selectedYs: [], scroll: 0, open: 0, close: 0, info: [], warnings: []};
  const io = {
    now: () => time,
    sleep: async ms => { time += ms; },
    info: message => calls.info.push(message), warn: message => calls.warnings.push(message),
    returnMainUi: async () => { journal = false; paimon = false; calls.close++; },
    press: async key => { assert.equal(key, 'VK_J'); journal = true; readyAt = time + (config.delayOpenMs || 0); calls.open++; },
    read: async area => {
      if (paimon && area === 'menu') return ['队伍配置','角色','成就','任务'].map((text,i)=>row(text,150+i*100,400));
      if (!journal || time < readyAt || config.badJournal) return [];
      if (area === 'chrome') return config.noHeader ? [] : [row('任务')];
      if (area === 'footer' || area === 'menu') return [];
      if (area === 'list') {
        const rows = pages[page].map((title, index) => row(title, 120, 200 + index * 110));
        return config.reverseOcr ? rows.reverse() : rows;
      }
      if (area === 'title') return [row(selected, 830, 80)];
      if (area === 'detail') return [row('角色被其他任务占用', 850, 300)];
      if (area === 'buttons') {
        if (time >= trackingReadyAt) tracked = true;
        if (config.splitStop && tracked) return [
          {...row('停止',1550,977),width:60}, {...row('追踪',1615,975),width:60}];
        return config.noButton ? [] : [row(tracked ? '停止追踪' : '追踪目标', 1550, 975)];
      }
      throw new Error('Unknown area ' + area);
    },
    click: async item => {
      if (paimon && item.text === '任务') { paimon = false; journal = true; return; }
      if (item.text === '停止追踪') throw new Error('Must never untrack');
      if (item.text === '追踪目标') {
        calls.track++;
        if (!config.noEffect) {
          if (config.delayTrackMs) trackingReadyAt = time + config.delayTrackMs;
          else tracked = true;
        }
        if (config.opensMap) journal = false;
      } else {
        calls.select++;
        calls.selectedYs.push(item.y);
        selected = config.wrongTitle ? '不是目标任务' : item.text;
      }
    },
    scroll: async amount => {
      calls.scroll++;
      page = Math.max(0, Math.min(pages.length - 1, page + (amount > 0 ? -1 : 1)));
    }
  };
  return {io, calls, isJournal: () => journal};
}

test('selects full title, tracks once, verifies state, returns to world', async () => {
  const s = scenario();
  assert.equal(await lib.create(s.io).run(name), true);
  assert.equal(s.calls.select, 1);
  assert.equal(s.calls.track, 1);
  assert.equal(s.calls.open, 1);
  assert.equal(s.isJournal(), false);
});
test('an already tracked target is never toggled off', async () => {
  const s = scenario({selected: name, tracked: true});
  await lib.create(s.io).run(name);
  assert.equal(s.calls.track, 0);
  assert.equal(s.calls.select, 0);
});
test('starts in middle, rewinds then searches later pages', async () => {
  const s = scenario({initialPage: 1, pages: [['序章'], ['间章'], [name]]});
  await lib.create(s.io).run(name);
  assert.equal(s.calls.track, 1);
  assert.ok(s.calls.scroll > 2);
});
test('does not confuse a containing title with the requested task', async () => {
  const s = scenario({pages: [[name + '后续']]});
  await assert.rejects(lib.create(s.io).run(name), /未找到/);
  assert.equal(s.calls.track, 0);
  assert.equal(s.calls.select, 0);
  assert.ok(s.calls.scroll <= 48);
});
test('mismatched details after selecting a row prevent tracking', async () => {
  const s = scenario({wrongTitle: true});
  await assert.rejects(lib.create(s.io).run(name), /详情标题不匹配/);
  assert.equal(s.calls.track, 0);
});
test('two exact names select the lower child task and track it', async () => {
  const s = scenario({pages: [[name, name]]});
  await lib.create(s.io).run(name);
  assert.deepEqual(s.calls.selectedYs, [310]);
  assert.equal(s.calls.track, 1);
});
test('two exact names use screen position even when OCR order is reversed', async () => {
  const s = scenario({pages: [[name, name]], reverseOcr: true});
  await lib.create(s.io).run(name);
  assert.deepEqual(s.calls.selectedYs, [310]);
  assert.equal(s.calls.track, 1);
});
test('matching current details still select the lower duplicate without untracking', async () => {
  const s = scenario({pages: [[name, name]], selected: name, tracked: true});
  await lib.create(s.io).run(name);
  assert.deepEqual(s.calls.selectedYs, [310]);
  assert.equal(s.calls.track, 0);
});
test('the lower duplicate must still pass the detail title check', async () => {
  const s = scenario({pages: [[name, name]], wrongTitle: true});
  await assert.rejects(lib.create(s.io).run(name), /详情标题不匹配/);
  assert.deepEqual(s.calls.selectedYs, [310]);
  assert.equal(s.calls.track, 0);
});
test('more than two exact names fail without selecting a row', async () => {
  const s = scenario({pages: [[name, name, name]]});
  await assert.rejects(lib.create(s.io).run(name), /超过两个同名/);
  assert.equal(s.calls.select, 0);
  assert.equal(s.calls.track, 0);
});
test('map transition never reopens J and reports the unverified result honestly', async () => {
  const s = scenario({opensMap: true});
  assert.equal(await lib.create(s.io).run(name), false);
  assert.equal(s.calls.open, 1);
  assert.equal(s.calls.select, 1);
  assert.equal(s.calls.track, 1);
  assert.equal(s.calls.warnings.length, 1);
  assert.match(s.calls.warnings[0], /结果未核验/);
  assert.equal(s.calls.info.some(message => message.startsWith('已确认追踪任务')), false);
});
test('duplicate names plus a screen transition perform only one round of actions', async () => {
  const s = scenario({pages: [[name, name]], opensMap: true});
  assert.equal(await lib.create(s.io).run(name), false);
  assert.equal(s.calls.open, 1);
  assert.deepEqual(s.calls.selectedYs, [310]);
  assert.equal(s.calls.track, 1);
});
test('delayed confirmation only polls and does not repeat the selection', async () => {
  const s = scenario({pages: [[name, name]], delayTrackMs: 1800});
  assert.equal(await lib.create(s.io).run(name), true);
  assert.equal(s.calls.open, 1);
  assert.deepEqual(s.calls.selectedYs, [310]);
  assert.equal(s.calls.track, 1);
  assert.equal(s.calls.warnings.length, 0);
});
test('leaving the journal without proof is never reported as confirmed tracking', async () => {
  const s = scenario({opensMap: true, noEffect: true});
  assert.equal(await lib.create(s.io).run(name), false);
  assert.equal(s.calls.open, 1);
  assert.equal(s.calls.select, 1);
  assert.equal(s.calls.track, 1);
  assert.equal(s.calls.info.some(message => message.startsWith('已确认追踪任务')), false);
});
test('click without a verified result fails instead of reporting success or clicking twice', async () => {
  const s = scenario({noEffect: true, pages: [[name, name]]});
  await assert.rejects(lib.create(s.io).run(name), /点击后未确认/);
  assert.equal(s.calls.track, 1);
  assert.equal(s.calls.open, 1);
  assert.deepEqual(s.calls.selectedYs, [310]);
});
test('blocked task leaves the detail visible and reports why', async () => {
  const s = scenario({noButton: true});
  await assert.rejects(lib.create(s.io).run(name), /角色被其他任务占用/);
  assert.equal(s.calls.track, 0);
  assert.equal(s.isJournal(), true);
});
test('a failed J open never searches or clicks', async () => {
  const s = scenario({badJournal: true});
  await assert.rejects(lib.create(s.io).run(name), /未确认任务界面/);
  assert.equal(s.calls.open, 1);
  assert.equal(s.calls.track + s.calls.select + s.calls.scroll, 0);
});
test('blank target is rejected before input; timeout bounds the search', async () => {
  const s = scenario();
  await assert.rejects(lib.create(s.io).run(' '), /完整名称/);
  assert.equal(s.calls.open, 0);
  await assert.rejects(lib.create(s.io, {timeoutMs: 1}).run(name), /超时/);
});
test('punctuation normalization and split OCR line work without fuzzy name matching', () => {
  const target = lib.normalize('「星火」交汇于冻原');
  assert.equal(target, lib.normalize(name));
  assert.equal(lib.matches([
    {...row('星火交汇', 120, 200), width: 120},
    {...row('于冻原', 245, 202), width: 90}
  ], target).length, 1);
  assert.equal(lib.matches([row('星火交汇干冻原')], target).length, 0);
});
test('title fragments with the right fragment 2px higher still match', () => {
  assert.equal(lib.matches([
    {...row('星火交汇',120,202),width:120}, {...row('于冻原',245,200),width:90}
  ],lib.normalize(name)).length,1);
});
test('split stop-tracking label never produces a tracking click', async () => {
  const s = scenario({selected:name,tracked:true,splitStop:true});
  await lib.create(s.io).run(name);
  assert.equal(s.calls.track,0);
  assert.equal(s.calls.select,0);
});
test('an unmerged negative label still blocks the bare tracking fragment', () => {
  const state=lib.trackingState([row('停止',1440,925),row('追踪',1700,975)]);
  assert.equal(state.tracked,false);
  assert.equal(state.button,null);
});
test('journal without the fixed upper-left header is recognized from detail and button',async()=>{
  const s=scenario({noHeader:true});
  await lib.create(s.io).run(name);
  assert.equal(s.calls.track,1);
  assert.equal(s.calls.open,1);
});
test('already open journal is preserved without pressing J or returning to the world first',async()=>{
  const s=scenario({journal:true,noHeader:true});
  await lib.create(s.io).run(name);
  assert.equal(s.calls.open,0);
  assert.equal(s.calls.close,1);
});
test('slow menu animation exceeding two seconds does not cause false failure',async()=>{
  const s=scenario({delayOpenMs:3500,noHeader:true});
  await lib.create(s.io).run(name);
  assert.equal(s.calls.open,1);
  assert.equal(s.calls.track,1);
});
test('paimon menu uses the observed task entry without relying on J',async()=>{
  const s=scenario({paimon:true});
  await lib.create(s.io).run(name);
  assert.equal(s.calls.open,0);
  assert.equal(s.calls.track,1);
});

test('BGI adapter rescales ROIs, disposes captures, restores prior metrics on failure', async () => {
  let disposed = 0, captures = 0, metrics = [];
  const rois=Object.values(lib.REGIONS).map(roi=>Array.from(roi).map(n=>Math.round(n*4/3)));
  const sandbox = {
    captureGameRegion: () => {captures++;return {width: 2560, height: 1440, dispose() {disposed++;},
      findMulti: roi => {assert.ok(rois.some(expected=>JSON.stringify(expected)===JSON.stringify(roi))); return [];}}},
    RecognitionObject: {ocr: (...args) => args},
    getGameMetrics: () => [2560, 1440, 1.5], setGameMetrics: (...args) => metrics.push(args),
    log: {info() {}}, genshin: {returnMainUi: async () => {}},
    keyDown() {}, keyUp() {}, sleep: async () => {},
    moveMouseTo() {}, verticalScroll() {}, click() {}
  };
  const adapter = vm.runInNewContext(source, sandbox).createBgi();
  await assert.rejects(adapter.run(name), /未确认任务界面/);
  assert.ok(captures>0);
  assert.equal(disposed, captures);
  assert.deepEqual(metrics, [[1920, 1080, 1], [2560, 1440, 1.5]]);
});
