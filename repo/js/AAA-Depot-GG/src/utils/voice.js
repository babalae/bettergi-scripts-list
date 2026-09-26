/**
 * 用户可见文案集中表。业务代码调 say / notice / accident，不内嵌字符串。
 *
 * 前缀三类：
 *   [愚人众]   流程节点（info）
 *   [征收须知] 影响结果的降级、需人工处理的提示、排障落点（warn）
 *   [征收事故] 本轮失败（error）
 *
 * 说话人只有 [愚人众] 一个；另两类是提示标签，不是角色，不参与剧情口吻。
 * 禁用：冰之女皇、愚人众以外的阵营梗。
 *
 * 日志窗口行数 = 条数 × 2（一条 log.info 占时间戳 + 内容两行），
 * 所以新增窗口输出前先算行数，机械信息一律走 dbg()（见 utils/debuglog.js）。
 */
import { dbg, dbgError } from "./debuglog.js";

/** 说话人前缀。只有愚人众在说话，另两类是提示标签 */
export const WHO = {
    fatui: "[愚人众]",
    notice: "[征收须知]",
    accident: "[征收事故]"
};

/** 流程台词（info） */
export function say(who, text) {
    log.info(`${who} ${text}`);
}

/** 提示（warn）：影响结果的降级、需要人工处理、排障落点。同步落盘 */
export function notice(text) {
    log.warn(`${WHO.notice} ${text}`);
    dbg(`[提示] ${text}`);
    return text;
}

/** 出错（error）：本轮失败。同步落盘，带堆栈 */
export function accident(text, error) {
    log.error(`${WHO.accident} ${text}`);
    if (error) {
        dbgError(text, error);
    } else {
        dbg(`[事故] ${text}`);
    }
    return text;
}

/**
 * 流程台词表。用函数是为了拼接变量，同时保证同一环节全代码只有一种说法。
 * 改文案只改本文件，业务代码不动。
 */
export const LINES = {
    // 开场 / 收尾
    start: () => "寄物装置，开始营业",
    cycles: (n) => `本次征收：${n} 轮`,
    roundStart: (i) => `第 ${i} 轮征收 · 出发`,
    roundDone: () => "本轮征收结束，摩拉不找零",
    allDone: (n) => `全部寄完，共 ${n} 轮`,

    // 补热能。游戏机制：传送至七天神像自动恢复 60% 热能
    tpStatue: () => "回七天神像，把热能续上",

    // 清场 / 架设
    clearing: () => "先清场，把场上的旧装置挪走",
    cleared: () => "场地干净，本执行官很满意",
    building: () => "正在架设愚人众寄物装置",
    placed: () => "装置落地，开始收租",
    openDevice: () => "凑上去，撬开它",

    // 排障：报告只落盘，窗口只给落点
    diagSaved: (where) => `本轮《诊断报告》已收进 ${where}`,
    diagLost: () => "本轮《诊断报告》未能落盘（debug/ 目录不可写）",

    // 找货 / 清点
    tab: (category) => `翻到「${category}」这一栏`,
    pageMiss: (n) => `这一页没有，往下翻（第 ${n} 页）`,
    listBottom: () => "翻到底了，这排货架里没有它",
    alike: () => "长得像的还挺多，本执行官再认认",
    found: () => "找到了，就在此处",
    count: (n) => `清点战利品：${n} 个`,
    countZero: () => "一个都不剩，这轮没得寄",

    // 搬运
    selecting: () => "正在选择寄存物品",
    shifted: () => "这排货架自己挪了一下，重新对准",
    unstable: (n) => `连着 ${n} 次位置都在变，这列表不对劲，先停手`,
    hauling: (n) => `愚人众正在搬运…（${n} 趟）`,
    full: () => "装置塞满了，装不下",

    // 寄存 / 收工。「寄」是刻意玩的梗，不改书面语
    confirmAccess: () => "要寄啦要寄啦（慌）",
    confirm: () => "真的寄了（悲报）",
    leaving: () => "收工，撤",
    demolish: () => "销毁证据——不，是拆除装置",
    demolished: () => "装置拆掉了，场地恢复原样"
};
