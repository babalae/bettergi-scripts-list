/**
 * 《诊断报告》：把调试数据聚成一份，**只落盘，不进日志窗口**。
 *
 * 恒开（v0.10.4 起不再是设置项）：每轮攒一份完整报告
 * （①侦察连拍 ②数量区域 ③数量系数 ④最终采用值与理由）。
 *
 * 不往窗口打的原因：一份 40~50 行，而 BGI 窗口会截断长行、也会滚掉前面的内容 ——
 * 打出来既看不全，又把流程台词淹没（实测一轮 104 行里报告占 50 行）。
 * 报告写进 `debug/日期_时段.txt`，窗口由调用方用一句 [征收须知] 报落点。
 *
 * 本模块只管"攒数据 + 输出"，采集点：
 *   ① actions.js  reconFoodTarget（候选表）
 *   ②③ digits.js runScan（区域表 / 系数表）
 *   ④ digits.js  readItemCount（采用值与理由）
 */
import { dbgBlock } from "./debuglog.js";

let enabled = false;
const sections = { recon: null, region: null, scale: null, verdict: null };

const ORDER = [
    ["recon", "① 侦察连拍（开点前，一次都不点）"],
    ["region", "② 数量区域扫描（数字在图标下方多少）"],
    ["scale", "③ 数量系数扫描（模板该缩放多少）"],
    ["verdict", "④ 最终采用值与理由"]
];

export function setDiagEnabled(on) {
    enabled = !!on;
    resetDiag();
}

export function isDiagEnabled() {
    return enabled;
}

/** 每轮开头清一次，避免上一轮数据混入 */
export function resetDiag() {
    sections.recon = null;
    sections.region = null;
    sections.scale = null;
    sections.verdict = null;
}

/** 追加小节内容（同一小节可被追加多次，如侦察每抬一档阈值追加一行） */
export function putDiag(key, lines) {
    if (!lines || lines.length === 0) {
        return;
    }
    sections[key] = (sections[key] || []).concat(lines);
}

export function hasDiagData() {
    return !!(sections.recon || sections.region || sections.scale || sections.verdict);
}

/**
 * 攒一份完整报告并写进排障文件（不往窗口打，理由见文件头）。
 *
 * @returns {string|null} 落点路径（如 `debug/2026-09-26_1355.txt`）；
 *                        无数据、或写不进磁盘时返回 null
 */
export function printDiagReport(title) {
    if (!hasDiagData()) {
        return null;
    }
    const out = [];
    for (const [key, heading] of ORDER) {
        const body = sections[key];
        out.push(heading);
        if (!body || body.length === 0) {
            out.push("  （本轮未采集到）");
        } else {
            for (const line of body) {
                out.push(`  ${line}`);
            }
        }
        out.push("");
    }
    return dbgBlock(title || "诊断报告", out);
}
