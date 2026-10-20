/**
 * 日志排版。BGI 窗口宽度有限，超长行会被截断，所以逐条发送。
 * 全项目只用 logLines：分隔线自身占 2 行（时间戳 + 内容）且零信息，故不提供。
 */

/**
 * 逐条输出。空行跳过 —— 空行不携带信息，却照样占一行窗口高度。
 * 需要分段就在文案里写明分段语义。
 */
export function logLines(lines) {
    for (const line of lines || []) {
        const text = String(line);
        if (text.trim() === "") {
            continue;
        }
        log.info(text);
    }
}
