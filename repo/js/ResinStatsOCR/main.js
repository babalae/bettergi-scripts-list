/**
 * 树脂统计（OCR）· 入口
 * 调 resin.js 的 collectResin() 拿数据 → 回主界面 → 打印结果并通知
 * 使用说明见 README.md，实现细节见 docs/OCRCountResin.md
 */

import { collectResin } from "./src/resin.js";
import {
    CONFIG,
    RESIN_LABELS,
    RESIN_ORDER,
    formatCount,
    formatNotifyCount,
    formatExpireReminder,
    readNickname,
    disposeResources,
    logDebug
} from "./src/utils.js";

// ==================== 通知 ====================

// 发送通知，只受 settings.notify 控制；能否弹出还取决于调度器通知权限与 manifest 配置
function notify(message, isError) {
    const asError = isError === true;
    if (typeof settings !== "undefined" && settings && settings.notify === false) {
        return;
    }
    try {
        if (asError) {
            notification.error(message);
        } else {
            notification.send(message);
        }
        logDebug(`已发送${asError ? "错误" : ""}通知`);
    } catch (e) {
        log.warn(`发送通知失败（请检查调度器「JS 通知权限」与 manifest 的 allow_js_notification）: ${e.message}`);
    }
}

// ==================== 结果输出 ====================

// 打印统计结果并发送通知
function displayResults(results, nickname) {
    const days = results.transientDays;
    const expireText = days === null ? "" : `（剩余 ${days} 天）`;

    log.info("============ 树脂统计结果 ============");
    log.info(`UID: ${formatCount(results.uid)}    昵称: ${formatCount(nickname)}`);
    for (const kind of RESIN_ORDER) {
        const suffix = kind === "transient" ? expireText : "";
        log.info(`${RESIN_LABELS[kind]}数量: ${formatCount(results.resin[kind])}${suffix}`);
    }
    log.info("====================================");

    const lines = ["树脂统计"];
    const who = [];
    if (nickname) {
        who.push(nickname);
    }
    if (results.uid) {
        who.push(`UID ${results.uid}`);
    }
    if (who.length > 0) {
        lines.push(who.join(" · "));
    }
    lines.push(
        `原粹 ${formatNotifyCount("original", results.resin.original, days)}` +
        ` · 浓缩 ${formatNotifyCount("condensed", results.resin.condensed, days)}`
    );
    lines.push(
        `须臾 ${formatNotifyCount("transient", results.resin.transient, days)}` +
        ` · 脆弱 ${formatNotifyCount("fragile", results.resin.fragile, days)}`
    );

    // 3 天内过期：单独提一行，别让它混在数据行里
    const urgent = formatExpireReminder(days, results.resin.transient);
    if (urgent) {
        lines.push("");
        lines.push(urgent);
    }

    notify(lines.join("\n"), false);
}

// ==================== 脚本入口 ====================

(async function main() {
    let results = null;
    let failure = null;

    try {
        results = await collectResin();
    } catch (error) {
        // collectResin 本身不抛异常，这里只兜运行时意外
        failure = error;
        log.error(`脚本执行失败: ${error.message}`);
        log.error(`错误堆栈: ${error.stack}`);
    } finally {
        disposeResources();
    }

    // 统一退出：不管成功失败，先回主界面，退出之后再发通知
    try {
        await genshin.returnMainUi();
        await sleep(CONFIG.UI_DELAY);
    } catch (finalError) {
        log.error(`返回主界面时发生异常: ${finalError.message}`);
    }

    if (failure) {
        notify(`树脂统计失败\n${failure.message}`, true);
        return;
    }

    if (!results.ok) {
        log.error(`脚本执行失败: ${results.error}`);
        if (results.errorStack) {
            log.error(`错误堆栈: ${results.errorStack}`);
        }
        notify(`树脂统计失败\n${results.error}`, true);
        return;
    }

    displayResults(results, readNickname());

    if (RESIN_ORDER.every(kind => results.resin[kind] === null)) {
        notify("树脂统计失败\n四项都没读到，详见日志", true);
    }
    log.info("树脂统计完成");
})();
