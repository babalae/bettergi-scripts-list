//作者：夜雨l星辰
// 冷却模块：读写上次质变完成时间，实现7天质变冷却

import { config } from "../config.js";

// ===== 7天冷却：读取上次质变完成时间（无记录返回null=默认可执行）=====
export async function readLastTransformTime() {
    try {
        const content = await file.readText(config.cdRecordPath);
        const line = (content || "").split('\n')[0];
        const ts = parseInt(String(line).split('::')[1], 10);
        return isNaN(ts) ? null : ts;
    } catch (e) {
        return null; // 文件不存在或读取失败，视为无记录
    }
}

// ===== 7天冷却：写入本次质变完成时间 =====
export async function writeLastTransformTime() {
    try {
        try {
            if (typeof file.mkdir === 'function') file.mkdir('record');
        } catch (e) { /* 目录已存在则忽略 */ }
        await file.writeText(config.cdRecordPath, "last::" + Date.now());
    } catch (e) {
        log.error("写入质变时间记录失败: " + e.message);
    }
}
