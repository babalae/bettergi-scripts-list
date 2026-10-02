/**
 * 排障落盘：只写「出错 + 诊断」，正常流程一行不落。
 *
 * 落点：脚本目录 `debug/YYYY-MM-DD_HHMM.txt`（一次运行一份）。
 * 写不进 `debug/`（权限等）则退回脚本根目录，日志末尾写明实际落点。
 * 目录本身不用我们操心：BGI 的 writeTextSync 会自动建父目录（见 LimitedFile.cs 的 IsValid）。
 *
 * 不劫持全局 `log`：BGI 把 `log` 暴露成只读全局，ES module 严格模式下赋值抛 TypeError。
 * 改为主动调 `dbg()`，调用点见 actions.js / recognition.js / digits.js / config.js。
 *
 * `bodyCount === 0`（一个字都没记上）时不写盘、不提示落点 ——
 * 典型是"启动检查未过就直接停"，那种趟次不该产生只有抬头的空文件。
 */
import { DEBUG_DIR, DEBUG_FLUSH_EVERY } from "../constants.js";
import { WHO } from "./voice.js";

const lines = [];
let enabled = false;   // 只有 initDebugLog() 开过才记；没开就一个字都不写
let fileName = "";
let target = null;   // 真正写成功的路径；写成功一次后固定用它
let warned = false;  // 写失败只提示一次，别刷屏
let bodyCount = 0;   // ★ 实质内容条数（不含开头/收尾那几行固定抬头）

function pad(n) {
    return String(n).padStart(2, "0");
}

/** 文件名 = 日期_时段，例如 2026-09-26_1101.txt */
function makeName() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        + `_${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
}

function stamp() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 开一次运行。返回本次的文件名（不一定写成功，落盘是 flush 时才试） */
export function initDebugLog() {
    lines.length = 0;
    target = null;
    warned = false;
    bodyCount = 0;
    enabled = true;
    fileName = makeName();
    lines.push("AAA愚人众寄物装置·存完就寄 · 排障日志（只记出错与诊断）");
    lines.push(`开始时间：${stamp()}`);
    lines.push("─".repeat(46));
    return fileName;
}

/** 记一行（带时刻）。正常流程别调它，只记排查用得上的东西。 */
export function dbg(text) {
    if (!enabled || !text) {
        return;
    }
    lines.push(`[${stamp()}] ${text}`);
    bodyCount += 1;
    if (lines.length % DEBUG_FLUSH_EVERY === 0) {
        flushDebugLog();
    }
}

/**
 * 记一整块（带标题），《诊断报告》和异常栈都走这里。
 * 返回实际落点路径；没写成功（排障日志没开 / 写不进磁盘）返回 null，
 * 调用方据此决定怎么提示。
 */
export function dbgBlock(title, body) {
    if (!enabled) {
        return null;
    }
    const list = (body || []).map((l) => String(l));
    if (title) {
        lines.push(`【${title}】`);
    }
    for (const l of list) {
        lines.push(`  ${l}`);
    }
    lines.push("");
    bodyCount += 1;
    return flushDebugLog();
}

/** 记一个异常：消息 + 堆栈（有就记），排查"为什么中断"全靠它 */
export function dbgError(where, error) {
    if (!enabled) {
        return;
    }
    const msg = (error && error.message) ? error.message : String(error);
    lines.push(`[${stamp()}] ✗ ${where}：${msg}`);
    bodyCount += 1;
    const stack = (error && error.stack) ? String(error.stack) : "";
    if (stack && stack !== msg) {
        for (const l of stack.split(/\r?\n/).slice(0, 12)) {
            lines.push(`      ${l.trim()}`);
        }
    }
    flushDebugLog();
}

/** 写盘。返回实际写入的路径；没内容 / 没开 / 写不进去返回 null（只提示一次） */
export function flushDebugLog() {
    if (!enabled || bodyCount === 0) {
        return null;
    }
    if (typeof file === "undefined" || typeof file.writeTextSync !== "function") {
        if (!warned) {
            warned = true;
            log.warn(`${WHO.notice} 当前 BetterGI 没有 file.writeTextSync()，排障日志写不进磁盘`);
        }
        return null;
    }

    const body = lines.join("\n");
    const tries = target ? [target] : [`${DEBUG_DIR}/${fileName}`, fileName];
    for (const p of tries) {
        try {
            if (file.writeTextSync(p, body)) {
                target = p;
                return p;
            }
        } catch (error) { /* 换下一个路径再试 */ }
    }

    if (!warned) {
        warned = true;
        log.warn(`${WHO.notice} 排障日志写不进磁盘（试过 ${tries.join(" / ")}），本次只输出到日志窗口`);
    }
    return null;
}

/**
 * 收尾：补结束时间、写盘，然后**彻底关掉**。
 *
 * 关掉这一步不能省：开关是模块级变量，同一次进程里脚本被启动第二次时（BGI 里很常见），
 * 残留的 enabled 会让它继续往上一份日志里追加，把两轮数据串在一起。
 * 关掉后没 init 就一个字都不写。
 */
export function closeDebugLog(reason) {
    if (!enabled) {
        return null;
    }
    // 一个字都没记上（典型的"启动检查没过就直接停"）→ **不写盘也不提示落点**。
    // 以前每次都提示，白占 2 行还给 debug/ 目录塞一堆只有抬头的空文件。
    if (bodyCount === 0) {
        enabled = false;
        lines.length = 0;
        target = null;
        return null;
    }
    lines.push("─".repeat(46));
    lines.push(`结束时间：${stamp()}${reason ? `　（${reason}）` : ""}`);
    const saved = flushDebugLog();
    if (saved) {
        lines.push(`本份排障日志：${saved}`);
        flushDebugLog();
    }
    enabled = false;
    lines.length = 0;
    target = null;
    bodyCount = 0;
    return saved;
}
