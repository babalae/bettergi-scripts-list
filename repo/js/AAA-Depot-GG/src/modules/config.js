/**
 * 设置读取层。所有读设置的入口都在这里，业务代码不直接读 `settings.xxx`。
 *
 * 三个理由：
 *   1) 面板可能给出非法值（负数、超范围、乱填字符串）→ 在此统一校验，
 *      不合法则退回默认值并提示，脏值不进业务代码；
 *   2) 默认值集中在 constants.js 的 DEFAULT_TIMINGS / DEFAULT_LIMITS，
 *      增删设置项只改那两张表；
 *   3) 按键名统一在此补 `VK_` 前缀，业务层拿到的总是可直接用的虚拟键。
 */
import { DEFAULT_SCREEN, DEFAULT_TIMINGS } from "../constants.js";
import { errorText } from "../utils/common.js";
import { dbg } from "../utils/debuglog.js";
import { notice } from "../utils/voice.js";

/** 读布尔值。空值走 fallback；面板可能给字符串 "true" */
export function readCheckbox(name, fallback) {
    const raw = settings[name];
    if (raw === undefined || raw === null || raw === "") {
        return fallback;
    }
    return raw === true || String(raw).toLowerCase() === "true";
}

/**
 * 读整数并校验范围。超范围或非数字 → 提示后退回 fallback，
 * 避免"填错一个数"引发后面一连串莫名其妙的失败。
 */
export function readInteger(name, fallback, min, max) {
    const raw = settings[name];
    if (raw === undefined || raw === null || raw === "") {
        return fallback;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
        notice(`${name}=${raw} 无效，已按默认值 ${fallback} 处理`);
        return fallback;
    }

    return Math.round(value);
}

/** 读下拉（枚举）值。不在允许列表内则退回 fallback */
export function readSelect(name, fallback, allowedValues) {
    const raw = String(settings[name] || fallback).trim();
    if (allowedValues.includes(raw)) {
        return raw;
    }
    notice(`${name}=${raw} 无效，已按默认值 ${fallback} 处理`);
    return fallback;
}

/** 读延时（毫秒）。默认值取自 DEFAULT_TIMINGS */
export function readDelay(name) {
    return readInteger(name, DEFAULT_TIMINGS[name], 0, 600000);
}

/**
 * 读游戏窗口真实分辨率，读不到返回 null（调用方走兜底）。
 * 所有识图区域（ROI）都按分辨率换算 —— 拿不到真值，后面全偏。
 */
export function readGameResolution() {
    try {
        const metrics = getGameMetrics();
        if (metrics && metrics.length >= 2) {
            const width = Math.round(Number(metrics[0]));
            const height = Math.round(Number(metrics[1]));
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                return { width, height };
            }
        }
    } catch (error) {
        // 读不到不是终点：getScreenSize 会退回手填值并统一提示 → 这里只落盘
        dbg(`[Screen] 读取游戏窗口尺寸失败：${errorText(error)}`);
    }

    return null;
}

/**
 * 屏幕尺寸：优先游戏窗口真实分辨率，读不到才退回设置里的 screenWidth / screenHeight。
 *
 * 正常探测到时**一个字都不记**：它是 ROI 换算基准，正常时排障用不上；
 * 而"启动检查未过直接停"那种空跑会因这一条变成"有内容"，白落一个空文件、多提示一句落点。
 * 只有"读不到、退回手填值"（可能全盘跑偏）才提示。
 */
export function getScreenSize() {
    const detected = readGameResolution();
    if (detected) {
        return detected;
    }

    const fallback = {
        width: readInteger("screenWidth", DEFAULT_SCREEN.width, 640, 7680),
        height: readInteger("screenHeight", DEFAULT_SCREEN.height, 360, 4320)
    };
    dbg(`[Screen] 读不到分辨率，退回手填值 ${fallback.width}x${fallback.height}`);
    notice(`没读到游戏分辨率，按 ${fallback.width}x${fallback.height} 处理（若与实际不符，请填对 screenWidth/screenHeight）`);
    return fallback;
}

/** 按键名补成 BGI 虚拟键名：T → VK_T；已带 VK_ 的原样返回 */
export function normalizeVirtualKey(rawKey, fallback) {
    const value = String(rawKey || fallback).trim().toUpperCase();
    if (value.startsWith("VK_")) {
        return value;
    }
    if (value.length === 1) {
        return `VK_${value}`;
    }
    return value;
}
