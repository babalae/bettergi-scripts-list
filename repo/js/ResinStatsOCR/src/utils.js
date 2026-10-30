/**
 * 树脂统计（OCR）· 常量、纯函数与模板资源
 * 不访问游戏界面：识别与点击都在 resin.js，本文件只管数值解析、校验与文案拼接
 */

// ==================== 常量 ====================

// 声明脚本环境为 16:9 / 1080P（BGI 会按实际窗口自动适配）
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// 合法上限：原粹可溢出（见 validateCount），浓缩 5，须臾 9，脆弱 999
export const RESIN_LIMITS = {
    original: 200,
    condensed: 5,
    transient: 9,
    fragile: 999
};

export const RESIN_LABELS = {
    original: "原粹树脂",
    condensed: "浓缩树脂",
    transient: "须臾树脂",
    fragile: "脆弱树脂"
};

// 统计顺序
export const RESIN_ORDER = ["original", "condensed", "transient", "fragile"];

// 昵称回退值：设置里没填昵称时使用
export const FALLBACK_NICKNAME = "旅行者";

// 通知里只给真上限：原粹 200、浓缩 5
export const NOTIFY_CAPS = {
    original: 200,
    condensed: 5
};

// 界面元素比例（0~1），只用于限定 OCR 搜索范围，不是点击坐标
export const RATIO = {
    // 冒险之证左侧竖排标签列：见闻 / 委托 / 秘境 / 讨伐 / 向导 / 备战
    HANDBOOK_TABS: { x: 0.1115, y: 0.0352, w: 0.0661, h: 0.9093 },
    // ESC 菜单里的「冒险之证」条目
    BOOK_ITEM_IN_ESC: { x: 0.0776, y: 0.7972, w: 0.0490, h: 0.0380 },
    // 点击「冒险之证」时的纵向偏移（相对画面高度）
    BOOK_ITEM_OFFSET_Y: -0.0463,
    // 浓缩数字区 = 图标右侧紧邻的同尺寸框
    CONDENSED_NUM_WIDTH_SCALE: 1.0,
    CONDENSED_NUM_HEIGHT_SCALE: 1.0,
    // 须臾 / 脆弱数字区 = 图标正下方、同宽，高度为图标高的 0.75
    OTHER_NUM_HEIGHT_SCALE: 0.75
};

export const CONFIG = {
    SLEEP_INTERVAL: 300,            // 模板匹配轮询间隔（毫秒）
    UI_DELAY: 1200,                 // 常规 UI 操作后的等待（毫秒）
    BOOK_OPEN_DELAY: 2200,          // 冒险手册打开后的等待（毫秒）
    DIALOG_DELAY: 1500,             // 加号点击后的弹窗等待（毫秒）
    RETRY: 3,                       // OCR 重试次数
    TEXT_RETRY_DELAY: 700,          // OCR 重试间隔（毫秒）
    COUNT_RETRY: 3,                 // 读数校验失败后的最大尝试次数（含首次）
    COUNT_RETRY_DELAY: 600,         // 读数重试间隔（毫秒）
    TEMPLATE_TIMEOUT: 3000,         // 模板匹配超时（毫秒）

    KEYWORDS: {
        // 左侧竖排标签至少命中 2 个即认为冒险手册已打开
        HANDBOOK: ["见闻", "委托", "秘境", "讨伐", "向导", "备战"],
        SECRET_TAB: ["秘境"],
        BOOK_ITEM: ["冒险之证"]
    }
};

// 数字模板命中门槛
export const DIGIT_MATCH_MIN = 0.78;

// ==================== 通用工具 ====================

export function safeDispose(obj) {
    try {
        if (obj && typeof obj.dispose === "function") {
            obj.dispose();
        }
    } catch (e) {
        // 释放失败不影响主流程
    }
}

// 详细日志，仅 settings.debug 打开时输出
export function logDebug(message) {
    if (typeof settings !== "undefined" && settings && settings.debug === true) {
        log.info(message);
    }
}

// findMulti 返回 C# 集合，兼容 count / Count / length 三种取长度方式
export function listCount(list) {
    if (!list) {
        return 0;
    }
    const keys = ["count", "Count", "length"];
    for (const key of keys) {
        try {
            const value = list[key];
            if (typeof value === "number") {
                return value;
            }
        } catch (e) {
            // 该属性不存在，试下一个
        }
    }
    return 0;
}

// 识别结果是否为空，兼容 isEmpty() 与旧版 isExist()
export function isEmptyResult(result) {
    if (!result) {
        return true;
    }
    try {
        if (typeof result.isEmpty === "function") {
            return result.isEmpty();
        }
        if (typeof result.isExist === "function") {
            return !result.isExist();
        }
    } catch (e) {
        // 落到下面的兜底判断
    }
    return !(result.width > 0);
}

export function findTextIn(items, keywords) {
    for (const item of items) {
        for (const keyword of keywords) {
            if (item.text.indexOf(keyword) >= 0) {
                return item;
            }
        }
    }
    return null;
}

// ==================== 文本与数字 ====================

// 在整屏文本里按正则找第一个数字
export function findNumberByPattern(items, pattern, label) {
    for (const item of items) {
        const match = item.text.match(pattern);
        if (!match) {
            continue;
        }
        const value = parseInt(match[1], 10);
        if (!isNaN(value)) {
            logDebug(`${label}按 "x/上限" 格式读到 ${value}（原文 "${item.text}"）`);
            return value;
        }
    }
    return null;
}

// 原粹按「21/200」格式读，界面里没有树脂名称文字，不做名称匹配
export function readOriginalCount(items) {
    return findNumberByPattern(items, /(\d{1,4})\s*[\/／]\s*200/, RESIN_LABELS.original);
}

// 全角转半角
export function toHalfWidth(text) {
    return String(text).replace(/[\uFF01-\uFF5E]/g,
        ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

// 从 OCR 文本里抠数字：全角转半角，斜杠取前段，其余字符丢掉
// 抠不出 1~3 位数字返回 null，交给数字模板
export function extractNumberFromText(text) {
    if (text === null || text === undefined) {
        return null;
    }
    let raw = toHalfWidth(text).replace(/\s/g, "");
    if (!raw) {
        return null;
    }

    // 「0/5」这种当前/上限的写法，取斜杠前面那段（冒号多半是斜杠被认歪）
    if (/[\/／:：]/.test(raw)) {
        raw = raw.split(/[\/／:：]/)[0];
    }

    const digits = raw.replace(/\D/g, "");
    if (!/^\d{1,3}$/.test(digits)) {
        return null;
    }
    return { value: parseInt(digits, 10) };
}

// 从 OCR 结果里取数字候选，按到数字区中心的距离打分（0~1），降序返回
export function pickClosestNumber(items, rect) {
    const candidates = [];
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // 半对角线：框中心到框角的距离，用来把距离归一化成 0~1
    const norm = Math.max(1, Math.hypot(rect.width / 2, rect.height / 2));

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const info = extractNumberFromText(item.text);
        if (!info) {
            continue;
        }
        // OCR 结果可能给绝对坐标（相对截图），也可能给相对识别区域的坐标（从 0,0 起），统一成框内坐标
        const localX = item.x >= rect.x - 4 ? item.x - rect.x : item.x;
        const localY = item.y >= rect.y - 4 ? item.y - rect.y : item.y;
        const cx = localX + item.width / 2;
        const cy = localY + item.height / 2;
        const distance = Math.hypot(cx - centerX, cy - centerY);
        candidates.push({
            value: info.value,
            text: String(item.text),
            x: localX,
            y: localY,
            score: Math.max(0, 1 - distance / norm)
        });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}

// ==================== 校验与文案 ====================

// 数量校验：合法返回数值，需要重试返回 null
// 原粹可溢出，第 2 次起读到 200 < x < 999 也算有效（attempt 从 1 开始）
export function validateCount(kind, value, attempt) {
    const label = RESIN_LABELS[kind];
    if (value === null || value === undefined) {
        return null;  // 压根没读到，不打日志（调用方会说明）
    }

    const num = Number(value);
    if (!isFinite(num) || isNaN(num) || !Number.isInteger(num)) {
        log.warn(`${label}识别结果非法（${value}），需要重试`);
        return null;
    }
    if (num < 0) {
        log.warn(`${label}识别值 ${num} 低于 0，需要重试`);
        return null;
    }

    const max = RESIN_LIMITS[kind];
    if (num <= max) {
        return num;
    }

    // 原粹可溢出：第 2 次（含）以后读到 200 < x < 999，按正确值采用
    if (kind === "original" && attempt >= 2 && num < 999) {
        log.info(`${label}超出上限，第 ${attempt} 次读到 ${num}（200 < ${num} < 999），按正确值采用`);
        return num;
    }

    log.warn(`${label}识别值 ${num} 超出上限 ${max}，需要重试`);
    return null;
}

export function formatCount(value) {
    return value === null || value === undefined ? "未知" : String(value);
}

// 数量写法：未知 / 17/200 / 须臾带天数 1（9天）
export function formatNotifyCount(kind, value, days) {
    if (value === null || value === undefined) {
        return "未知";
    }
    const cap = NOTIFY_CAPS[kind];
    const text = cap ? `${value}/${cap}` : String(value);
    if (kind === "transient" && days !== null && days !== undefined) {
        return `${text}（${days}天）`;
    }
    return text;
}

// 须臾快到期提醒，持有且不足 3 天时才返回文案
export function formatExpireReminder(days, count) {
    if (days === null || !(count > 0) || days >= 3) {
        return null;
    }
    if (days <= 0) {
        return "！！！须臾树脂今天过期，记得用掉！！！";
    }
    return `！！！须臾树脂 ${days} 天后过期，记得用掉！！！`;
}

// 从弹窗文字里解析须臾的剩余天数：认「9天后过期」，不足一天按 0 天算，读不到返回 null
export function parseTransientExpireDays(items) {
    const text = items.map(item => String(item.text || "")).join("").replace(/\s/g, "");
    const byDay = text.match(/(\d{1,3})天后过期/);
    if (byDay) {
        return parseInt(byDay[1], 10);
    }
    const byHour = text.match(/(\d{1,2})小时后过期/);
    if (byHour) {
        return 0;
    }
    return null;
}

// 昵称：设置里填的名字，留空回退「旅行者」
export function readNickname() {
    const raw = (typeof settings !== "undefined" && settings) ? settings.nickname : null;
    const name = (raw === null || raw === undefined) ? "" : String(raw).trim();
    if (name.length > 0) {
        logDebug(`当前昵称: ${name}（来自设置）`);
        return name;
    }
    logDebug(`当前昵称: ${FALLBACK_NICKNAME}（设置里没填）`);
    return FALLBACK_NICKNAME;
}

// ==================== 模板资源 ====================

// 原粹树脂右侧的圆形「+」按钮、浓缩树脂图标：模板 Mat 懒加载，脚本结束统一释放
const REPLENISH_BUTTON_PATH = "assets/icon/replenish_resin_button.png";
const CONDENSED_ICON_PATH = "assets/icon/condensed_resin.png";

let replenishButtonMat = null;
let condensedIconMat = null;

export function getReplenishButtonRo() {
    if (!replenishButtonMat) {
        replenishButtonMat = file.readImageMatSync(REPLENISH_BUTTON_PATH);
    }
    return RecognitionObject.templateMatch(replenishButtonMat);
}

export function getCondensedIconRo() {
    if (!condensedIconMat) {
        condensedIconMat = file.readImageMatSync(CONDENSED_ICON_PATH);
    }
    return RecognitionObject.templateMatch(condensedIconMat);
}

// 浓缩数字模板（白色 0~5，覆盖浓缩上限）；字体字号固定，比 OCR 稳
const CONDENSED_DIGIT_TEMPLATES = [
    { value: 0, path: "assets/icon/num0_white.png" },
    { value: 1, path: "assets/icon/num1_white.png" },
    { value: 2, path: "assets/icon/num2_white.png" },
    { value: 3, path: "assets/icon/num3_white.png" },
    { value: 4, path: "assets/icon/num4_white.png" },
    { value: 5, path: "assets/icon/num5_white.png" }
];

let condensedDigitMats = null;

export function getCondensedDigitMats() {
    if (condensedDigitMats) {
        return condensedDigitMats;
    }
    condensedDigitMats = [];
    for (const item of CONDENSED_DIGIT_TEMPLATES) {
        try {
            condensedDigitMats.push({ value: item.value, mat: file.readImageMatSync(item.path) });
        } catch (e) {
            log.warn(`数字模板读取失败 ${item.path}: ${e.message}`);
        }
    }
    return condensedDigitMats;
}

// 弹窗里的数字模板：底色偏亮，深色数字 1~4 与白色 0/5 都试
const DIALOG_DIGIT_TEMPLATES = [
    { value: 0, path: "assets/icon/num0_white.png" },
    { value: 1, path: "assets/icon/num1.png" },
    { value: 2, path: "assets/icon/num2.png" },
    { value: 3, path: "assets/icon/num3.png" },
    { value: 4, path: "assets/icon/num4.png" },
    { value: 5, path: "assets/icon/num5_white.png" }
];

let dialogDigitMats = null;

export function getDialogDigitMats() {
    if (dialogDigitMats) {
        return dialogDigitMats;
    }
    dialogDigitMats = [];
    for (const item of DIALOG_DIGIT_TEMPLATES) {
        try {
            dialogDigitMats.push({ value: item.value, mat: file.readImageMatSync(item.path) });
        } catch (e) {
            log.warn(`数字模板读取失败 ${item.path}: ${e.message}`);
        }
    }
    return dialogDigitMats;
}

// 须臾 / 脆弱树脂图标，用来定位图标下方的数字
const OTHER_RESIN_ICONS = {
    transient: "assets/icon/transient_resin.png",
    fragile: "assets/icon/fragile_resin.png"
};

let otherResinIconMats = null;

export function getOtherResinIconMats() {
    if (otherResinIconMats) {
        return otherResinIconMats;
    }
    otherResinIconMats = {};
    for (const kind of Object.keys(OTHER_RESIN_ICONS)) {
        try {
            otherResinIconMats[kind] = file.readImageMatSync(OTHER_RESIN_ICONS[kind]);
        } catch (e) {
            log.warn(`树脂图标读取失败 ${OTHER_RESIN_ICONS[kind]}: ${e.message}`);
        }
    }
    return otherResinIconMats;
}

// 脚本结束统一释放全部模板 Mat
export function disposeResources() {
    safeDispose(replenishButtonMat);
    safeDispose(condensedIconMat);
    replenishButtonMat = null;
    condensedIconMat = null;

    if (condensedDigitMats) {
        for (const item of condensedDigitMats) {
            safeDispose(item.mat);
        }
        condensedDigitMats = null;
    }

    if (dialogDigitMats) {
        for (const item of dialogDigitMats) {
            safeDispose(item.mat);
        }
        dialogDigitMats = null;
    }

    if (otherResinIconMats) {
        for (const kind of Object.keys(otherResinIconMats)) {
            safeDispose(otherResinIconMats[kind]);
        }
        otherResinIconMats = null;
    }
}
