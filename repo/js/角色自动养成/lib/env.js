// lib/env.js —— 环境、日志、通知（只在这一层碰 BGI 全局对象）
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

/** 开启 BGI 内置的「自动跳过」触发器：弹窗/对话是卡住的头号原因 */
export function enableAutoSkip() {
  try {
    if (typeof RealtimeTimer !== 'function') return { ok: false, reason: 'BGI 不支持 RealtimeTimer' };
    dispatcher.addTimer(new RealtimeTimer('AutoSkip'));
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message || String(e) }; }
}

/** 开启 BGI 内置「自动拾取」触发器：只走路不拾取 = 采集/打怪全白跑 */
export function enableAutoPick() {
  try {
    if (typeof RealtimeTimer !== 'function') return { ok: false, reason: 'BGI 不支持 RealtimeTimer' };
    dispatcher.addTimer(new RealtimeTimer('AutoPick', {}));
    return { ok: true };
  } catch (e) {
    try { dispatcher.addTimer(new RealtimeTimer('AutoPick')); return { ok: true, plain: true }; } catch (e2) { return { ok: false, reason: e2?.message || String(e2) }; }
  }
}

/** 清空实时触发器（脚本结束时调用；你自己开的触发器也会被清，需要时重开一次） */
export function clearTriggers() {
  try { dispatcher.clearAllTriggers(); return true; } catch { return false; }
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

/** 智能拾取：只在屏幕出现「F 提示图标」时按 F（照抄背包材料统计的做法，1080p 坐标） */
export function startPickupLoop(intervalMs = 250) {
  let running = true;
  let ro = null;
  try { ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync('assets/F_Dialogue.png'), 1102, 335, 34, 400); } catch (e) { ro = null; }
  const run = (async () => {
    while (running) {
      if (!ro) break;
      let cap = null;
      try {
        cap = captureGameRegion();
        const res = cap.Find(ro);
        const found = res && (typeof res.isEmpty === 'function' ? !res.isEmpty() : true);
        if (found) { try { keyPress('F'); } catch {} }
        try { res && res.Dispose && res.Dispose(); } catch {}
      } catch (e) { /* 截图失败就等下一轮 */ }
      try { cap && cap.Dispose && cap.Dispose(); } catch {}
      try { await sleep(intervalMs); } catch { break; }
    }
  })();
  return { stop() { running = false; return run; } };
}
