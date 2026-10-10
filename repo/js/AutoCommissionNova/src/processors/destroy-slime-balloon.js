/**
 * Basic 危险运输现象 - 摧毁史莱姆气球步骤处理器
 */
import { RO } from "../vision/index.js";
import { isCancellationError } from "../utils/error-utils.js";
import { defineStep } from "./define-step.js";

const SLIME_BALLOON_CONFIG = {
    /** 步骤最长运行时间，超时后交给整体框架做委托完成检测。 */
    timeoutMs: 300 * 1000,
    /** 小于该距离时停止前进并持续普攻。 */
    attackDistance: 3,
    /** 连续找不到任务图标达到该次数后退出步骤。 */
    missingIconLimit: 10,
    /** 距离 OCR 连续失败达到该次数后清空缓存距离。 */
    missingDistanceLimit: 10,
    /** 近距离普攻间隔。 */
    attackIntervalMs: 300,
    /** 靠近时每轮前进时间。 */
    forwardMs: 500,
    /** 找不到图标时按 V 后等待的时间。 */
    retrackWaitMs: 300,
    /** 距离文字 OCR 区域：与追踪委托保持一致，以图标坐标为基准裁剪。 */
    distanceRegion: {
        offsetX: -55,
        offsetY: 32,
        width: 130,
        height: 45,
    },
};

function parseDistance(text) {
    const match = String(text || "").replace(/[oO]/g, "0").match(/(\d+)\s*m/i);
    return match ? Number(match[1]) : null;
}

function readDistanceFromCapture(cap, iconRes) {
    const cfg = SLIME_BALLOON_CONFIG.distanceRegion;
    const area = cap.DeriveCrop(
        Math.round(iconRes.x + cfg.offsetX),
        Math.round(iconRes.y + cfg.offsetY),
        cfg.width,
        cfg.height
    );
    try {
        const result = area.find(RecognitionObject.ocrThis);
        const text = result && result.text ? result.text.trim() : "";
        return parseDistance(text);
    } finally {
        area.Dispose();
    }
}

function updateDistanceCacheUnderIcon(cap, iconRes, state) {
    const distance = readDistanceFromCapture(cap, iconRes);
    if (distance !== null) {
        state.distance = distance;
        state.missingDistanceCount = 0;
    } else {
        state.missingDistanceCount++;
        if (state.missingDistanceCount >= SLIME_BALLOON_CONFIG.missingDistanceLimit) {
            state.distance = null;
        }
    }
    return state.distance;
}

function adjustViewToIcon(iconRes, state) {
    if (Math.abs(iconRes.x - 960) <= 80 && iconRes.y < 540) {
        return true;
    }

    if (iconRes.y >= 520 && !state.lookedDownOnce) {
        state.lookedDownOnce = true;
        log.debug("图标位于画面下方，先下拉镜头后重新判断");
        moveMouseBy(0, 520);
        return false;
    }

    const offsetX = iconRes.x - 960;
    const yFactor = Math.max(0, Math.min(1, (iconRes.y - 360) / 420));
    const gain = 1.6 + yFactor * 2.0;
    const maxMove = 900 + yFactor * 1100;
    const moveX = Math.round(Math.max(-maxMove, Math.min(maxMove, offsetX * gain)));
    if (moveX !== 0) moveMouseBy(moveX, 0);
    return false;
}

async function walkForward(duration) {
    keyDown("w");
    try {
        await sleep(duration);
    } finally {
        keyUp("w");
    }
}

async function destroySlimeBalloon() {
    const startTime = Date.now();
    const state = {
        distance: null,
        missingDistanceCount: 0,
        missingIconCount: 0,
        lookedDownOnce: false,
    };

    middleButtonClick();
    await sleep(800);

    while (Date.now() - startTime < SLIME_BALLOON_CONFIG.timeoutMs) {
        const cap = captureGameRegion();
        try {
            const iconRes = cap.Find(RO.iconBaseFull);
            if (!iconRes || iconRes.isEmpty()) {
                state.missingIconCount++;
                state.distance = null;
                keyUp("w");
                log.warn("史莱姆气球图标识别失败，连续失败次数: {count}/{limit}",
                    state.missingIconCount, SLIME_BALLOON_CONFIG.missingIconLimit);
                keyPress("v");
                if (state.missingIconCount >= SLIME_BALLOON_CONFIG.missingIconLimit) {
                    log.info("连续未找到史莱姆气球图标，退出摧毁史莱姆气球步骤");
                    return;
                }
                await sleep(SLIME_BALLOON_CONFIG.retrackWaitMs);
                continue;
            }

            state.missingIconCount = 0;
            updateDistanceCacheUnderIcon(cap, iconRes, state);

            if (!adjustViewToIcon(iconRes, state)) {
                keyUp("w");
                await sleep(250);
                continue;
            }

            if (state.distance !== null && state.distance < SLIME_BALLOON_CONFIG.attackDistance) {
                keyUp("w");
                leftButtonClick();
                await sleep(SLIME_BALLOON_CONFIG.attackIntervalMs);
                continue;
            }
        } finally {
            cap.Dispose();
        }

        await walkForward(SLIME_BALLOON_CONFIG.forwardMs);
    }

    log.info("摧毁史莱姆气球步骤运行超时，退出并交给整体框架检测完成状态");
}

export default defineStep({
    type: "摧毁史莱姆气球",
    category: "特定委托对策",
    dataSpec: { kind: "none" },
    run: async () => {
        try {
            log.info("开始执行摧毁史莱姆气球步骤");
            await destroySlimeBalloon();
            log.info("摧毁史莱姆气球步骤结束");
        } catch (error) {
            if (isCancellationError(error)) throw error;
            log.error("执行摧毁史莱姆气球步骤时出错: {error}", error.message);
            log.debug("详情: {error}", error.stack);
            throw error;
        } finally {
            keyUp("w");
        }
    },
});
