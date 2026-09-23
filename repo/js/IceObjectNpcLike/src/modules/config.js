import { DEFAULT_TIMINGS } from "../constants.js";
import { errorText } from "../utils/common.js";

let runtimeTDelayExtra = 0;

export function readCheckbox(name, fallback) {
    const raw = settings[name];
    if (raw === undefined || raw === null || raw === "") {
        return fallback;
    }
    return raw === true || String(raw).toLowerCase() === "true";
}

export function readInteger(name, fallback, min, max) {
    const raw = settings[name];
    if (raw === undefined || raw === null || raw === "") {
        return fallback;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
        log.warn(`[Config] ${name}=${raw} 无效，使用默认值 ${fallback}`);
        return fallback;
    }

    return Math.round(value);
}

export function readSelect(name, fallback, allowedValues) {
    const raw = String(settings[name] || fallback).trim();
    if (allowedValues.includes(raw)) {
        return raw;
    }
    log.warn(`[Config] ${name}=${raw} 无效，使用默认值 ${fallback}`);
    return fallback;
}

export function readDelay(name) {
    return readInteger(name, DEFAULT_TIMINGS[name], 0, 600000);
}

function readGameResolution() {
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
        log.warn(`[Environment] 无法读取游戏窗口尺寸：${errorText(error)}`);
    }

    return null;
}

export function configureRuntimeTimings() {
    const forceCompensation = readCheckbox("forceTDelayCompensationEnabled", false);
    const configuredExtraDelay = readDelay("fourKExtraTDelay");
    const resolution = readGameResolution();
    if (!resolution) {
        runtimeTDelayExtra = forceCompensation ? configuredExtraDelay : 0;
        if (forceCompensation) {
            log.warn(
                `[Environment] 未能确认游戏分辨率，已按手动设置启用 T 后额外等待 ${runtimeTDelayExtra}ms`
            );
        } else {
            log.warn("[Environment] 未能确认游戏分辨率，不启用 T 后额外等待");
        }
        return;
    }

    log.info(`[Environment] 游戏窗口分辨率：${resolution.width}x${resolution.height}`);

    const isFourK = resolution.width >= 3840 && resolution.height >= 2160;
    runtimeTDelayExtra = isFourK || forceCompensation ? configuredExtraDelay : 0;

    if (isFourK && runtimeTDelayExtra > 0) {
        log.info(`[Environment] 已启用 4K 时序补偿：每次 T 后、左键前额外等待 ${runtimeTDelayExtra}ms`);
    } else if (isFourK) {
        log.info("[Environment] 检测到 4K，4K 时序补偿已设为 0ms");
    } else if (forceCompensation && runtimeTDelayExtra > 0) {
        log.info(`[Environment] 当前不是 4K，已按手动设置启用 T 后额外等待 ${runtimeTDelayExtra}ms`);
    } else if (forceCompensation) {
        log.info("[Environment] 当前不是 4K，手动时序补偿已开启，但额外等待设为 0ms");
    } else {
        log.info("[Environment] 当前不是 4K，且未手动启用时序补偿");
    }
}

export function readTTransitionDelay(name) {
    return readDelay(name) + runtimeTDelayExtra;
}

export function parsePointIntegerOverrides(settingName, min, max) {
    const result = {};
    const raw = String(settings[settingName] || "").trim();
    if (!raw) {
        return result;
    }

    const entries = raw.split(/[,，;；]+/);
    for (const entry of entries) {
        const trimmed = entry.trim();
        if (!trimmed) {
            continue;
        }

        const match = /^(\d+)\s*=\s*(-?\d+)$/.exec(trimmed);
        if (!match) {
            log.warn(`[Config] ${settingName} 中的“${trimmed}”格式无效，已忽略`);
            continue;
        }

        const pointNumber = Number(match[1]);
        const value = Number(match[2]);
        if (pointNumber < 1 || value < min || value > max) {
            log.warn(`[Config] ${settingName} 中的“${trimmed}”超出范围，已忽略`);
            continue;
        }

        result[pointNumber] = Math.round(value);
    }

    return result;
}

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
