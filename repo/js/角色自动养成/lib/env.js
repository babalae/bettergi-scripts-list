// lib/env.js —— 环境、日志、通知（只在这一层碰 BGI 全局对象）
import { buildTriggerPlan, applyTriggerPlan } from './triggers.js';
export const buffer = [];
let bufferTimer = null;

// 日志按天分文件 + 追加写。
// 旧写法是「读回整个文件 → 拼上 → 整体重写」，长跑时是 O(n²) I/O；
// BGI 的 file.writeTextSync(path, content, append) 第三个参数就是追加，直接用它。
function logFilePath() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `record/运行日志-${stamp}.log`;
}
function appendLog(level, msg) {
  const line = `[${new Date().toLocaleString()}] [${level}] ${msg}\n`;
  const p = logFilePath();
  try {
    if (file.writeTextSync(p, line, true)) return;
  } catch { /* 落到下面的兼容路径 */ }
  // 兼容没有 append 参数的旧版 BGI
  try {
    let cur = '';
    try { cur = file.readTextSync(p); } catch { cur = ''; }
    file.writeTextSync(p, cur + line);
  } catch { /* 落盘失败不影响主流程 */ }
}

export function info(msg) { appendLog('INFO', msg); try { log.info(msg); } catch { console.log(msg); } }
export function warn(msg) { appendLog('WARN', msg); try { log.warn(msg); } catch { console.log(msg); } }
export function err(msg) { appendLog('ERROR', msg); try { log.error(msg); } catch { console.log(msg); } }

export function notify(msg, { immediate = false } = {}) {
  if (immediate) { send(msg); return; }
  buffer.push(msg);
}

function send(msg) {
  try { notification.send(msg); return; } catch { /* 旧签名 */ }
  try { notification.Send(msg); } catch { /* 无通知能力则只记日志 */ }
}

export function flush() {
  bufferTimer = null;
  if (!buffer.length) return;
  const text = buffer.join('\n');
  buffer.length = 0;
  send(text);
}

/** 15 秒内同名消息只发一次，避免刷屏 */
const lastSent = new Map();
export function notifyThrottled(key, msg, windowMs = 15000) {
  const now = Date.now();
  if (lastSent.has(key) && now - lastSent.get(key) < windowMs) return;
  lastSent.set(key, now);
  notify(msg);
}

export function sleepMs(ms) { try { sleep(ms); } catch { /* noop */ } }

/**
 * 装配脚本运行期间要用的 BGI 触发器（AutoPick / AutoSkip）。
 *
 * 注意两件事：
 *   1) BGI 在任务/脚本运行期间会停用「用户自己开启」的触发器，脚本必须自己加回来；
 *   2) dispatcher.addTimer() 会先 ClearAllTriggers 再加，连调两次会互相顶掉
 *      （旧版连开 AutoPick 和 AutoSkip，结果只有后者留下，自动拾取等于被关掉）。
 *      所以这里先清一次，之后全部用 addTrigger 追加。
 * @param {{autoPick?:boolean, autoSkip?:boolean, autoEat?:boolean}} want
 */
export function enableRuntimeAssist(want = {}) {
  const plan = buildTriggerPlan(want);
  if (!plan.length) return { added: [], failed: [], plan, append: true };
  if (typeof RealtimeTimer !== 'function') {
    return { added: [], failed: plan.map((p) => ({ name: p.name, reason: 'BGI 不支持 RealtimeTimer' })), plan, append: false };
  }
  try {
    const r = applyTriggerPlan(dispatcher, plan, RealtimeTimer);
    if (!r.append && r.added.length > 1) {
      warn('当前 BGI 没有 dispatcher.addTrigger，后加的触发器会把先加的顶掉；建议升级 BetterGI ≥ 0.66');
    }
    return { ...r, plan };
  } catch (e) {
    return { added: [], failed: plan.map((p) => ({ name: p.name, reason: String(e?.message || e) })), plan, append: false };
  }
}

/** BGI 是否已请求停止（用户按了停止键） */
export function isCancelled() {
  try {
    const t = dispatcher.getLinkedCancellationToken();
    if (!t) return false;
    return !!(t.isCancellationRequested ?? t.IsCancellationRequested);
  } catch { return false; }
}

/** 异常是否是「用户主动停止」而不是真出错 */
export function isCancellationError(e) {
  return /cancel|取消|已停止|abort|stopped/i.test(String(e?.message || e || ''));
}

/** 让 BGI 内部坐标体系固定为 1920x1080，避免分辨率换算错乱 */
export function bootMetrics() {
  try { setGameMetrics(1920, 1080, 1); } catch (e) { warn('setGameMetrics 失败：' + (e?.message || e)); }
}

export function bgiVersion() {
  try { if (typeof getVersion === 'function') return String(getVersion()); } catch { /* noop */ }
  return '';
}

/** 版本门槛：CountInventoryItem / AutoDomainParam 需要 0.66+ */
export function checkVersion(minMajor = 0, minMinor = 66) {
  const v = bgiVersion();
  if (!v) return { ok: true, version: '(未知)', reason: '无法读取 BGI 版本，跳过校验' };
  const m = v.match(/(\d+)\.(\d+)/);
  if (!m) return { ok: true, version: v, reason: '版本号格式无法解析' };
  const major = Number(m[1]), minor = Number(m[2]);
  const ok = major > minMajor || (major === minMajor && minor >= minMinor);
  return { ok, version: v, reason: ok ? '' : `本脚本需要 BetterGI ≥ ${minMajor}.${minMinor}，当前 ${v}` };
}

// 拾取安全阀：F 图标本身不分「拾取 / 对话」（同一个 F），所以必须看 F 右边的文字。
//   - 是目标材料名 → 按
//   - 是动作词（拾取/采集…）→ 按
//   - 是对话/商店/锻造等交互，或是人名 → 不按（这就是以前反复触发 NPC 对话的原因）
//   - OCR 读不到 → 默认不按（交回 BGI 自带的自动拾取）
const PICKUP_ACTION = /拾取|采集|收获|收集|摘取|剪取|采集物/;
const INTERACT_BLACKLIST = /对话|交谈|打听|委托|商店|锻造|烹饪|合成|炼金|转化|派遣|参量|加工|制作|购买|出售|学习|回忆|调查|开启|提交|供奉|进入|离开|挑战/;

/**
 * 单次拾取决策（纯函数，可单测）
 * @param {string} text F 图标右边那行文字
 * @param {string[]} wanted 目标材料名
 * @param {boolean} pressWhenNoText OCR 读不到文字时是否还是按
 * @returns {{press:boolean, why:'no-text'|'interact'|'action'|'wanted'|'not-wanted'}}
 */
export function pickupDecision(text, wanted = [], pressWhenNoText = false) {
  const t = String(text || '').trim();
  if (!t) return { press: !!pressWhenNoText, why: 'no-text' };
  if (INTERACT_BLACKLIST.test(t)) return { press: false, why: 'interact' };
  if (PICKUP_ACTION.test(t)) return { press: true, why: 'action' };
  const hit = wanted.some((w) => {
    const name = String(w || '').trim();
    if (!name) return false;
    return t.includes(name) || (name.length >= 2 && name.includes(t));
  });
  return { press: hit, why: hit ? 'wanted' : 'not-wanted' };
}

/**
 * 智能拾取（兜底）。优先用 BGI 自带的自动拾取；只有那条路不通时才开这个。
 * @param {{intervalMs?:number, wanted?:string[], pressWhenNoText?:boolean}|number} opts
 */
export function startPickupLoop(opts = {}) {
  const o = typeof opts === 'number' ? { intervalMs: opts } : (opts || {});
  const intervalMs = Math.max(300, Number(o.intervalMs) || 1200);
  const wanted = (o.wanted || []).map((s) => String(s || '').trim()).filter(Boolean);
  const pressWhenNoText = !!o.pressWhenNoText;

  let running = true;
  let ro = null;
  try { ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/F_Dialogue.png'), 1102, 335, 34, 400); } catch (e) { ro = null; }

  const stats = { pressed: 0, skippedDialogue: 0, skippedNotWanted: 0, skippedNoText: 0, stoppedByCap: false };
  let lastPressedText = '';
  let lastPressedAt = 0;
  let windowStart = Date.now();
  let windowPresses = 0;
  let warnedNpc = false;

  /** 决定这一次要不要按 F */
  const decide = (text) => pickupDecision(text, wanted, pressWhenNoText);

  /** 读 F 图标旁边那行文字（与 F 竖直居中对齐的那条 OCR 结果） */
  function readLabel(cap, fRes) {
    if (!cap || typeof RecognitionObject?.Ocr !== 'function' || typeof cap.findMulti !== 'function') return '';
    const fy = Number(fRes.y ?? fRes.Y) || 0;
    const fh = Number(fRes.height ?? fRes.Height) || 0;
    const fCenterY = fy + fh / 2;
    let list = [];
    try { list = cap.findMulti(RecognitionObject.Ocr(1180, 320, 300, 430)) || []; } catch (e) { return ''; }
    let best = null, bestDiff = Infinity;
    for (const r of list) {
      const text = String(r.text ?? r.Text ?? '').trim();
      if (!text) continue;
      const cy = (Number(r.y ?? r.Y) || 0) + (Number(r.height ?? r.Height) || 0) / 2;
      const diff = Math.abs(cy - fCenterY);
      if (diff < bestDiff) { bestDiff = diff; best = text; }
    }
    // 竖直方向差太多说明不是同一行的提示，宁可不认
    return bestDiff <= Math.max(10, fh) ? (best || '') : '';
  }

  const run = (async () => {
    while (running) {
      if (!ro) break;
      let cap = null;
      try {
        cap = captureGameRegion();
        const res = cap.Find(ro);
        const found = res && (typeof res.isEmpty === 'function' ? !res.isEmpty() : true);
        if (!found) {
          lastPressedText = '';           // 提示消失 → 允许下次同名物品再按
        } else {
          const text = readLabel(cap, res);
          const d = decide(text);
          if (!d.press) {
            if (d.why === 'interact') { stats.skippedDialogue++; if (!warnedNpc) { warnedNpc = true; info(`拾取跳过交互项「${text}」（NPC/商店等，不按 F）`); } }
            else if (d.why === 'no-text') stats.skippedNoText++;
            else { stats.skippedNotWanted++; }
          } else {
            const now = Date.now();
            if (now - windowStart > 60000) { windowStart = now; windowPresses = 0; }
            const samePrompt = text && text === lastPressedText && now - lastPressedAt < 4000;
            if (!samePrompt) {
              try { keyPress('F'); stats.pressed++; windowPresses++; lastPressedText = text; lastPressedAt = now; } catch (e) { /* 按键失败下一轮再试 */ }
            }
            if (windowPresses > 20) {   // 一分钟按 20 次还没走 → 多半卡在反复交互
              stats.stoppedByCap = true;
              warn('智能拾取：一分钟内按键超过 20 次，疑似卡在反复交互，已自动停止拾取循环');
              running = false;
            }
          }
        }
        try { res && res.Dispose && res.Dispose(); } catch (e) { /* noop */ }
      } catch (e) { /* 截图失败就等下一轮 */ }
      try { cap && cap.Dispose && cap.Dispose(); } catch (e) { /* noop */ }
      try { await sleep(intervalMs); } catch { break; }
    }
  })();
  return { stop() { running = false; return run; }, stats };
}
