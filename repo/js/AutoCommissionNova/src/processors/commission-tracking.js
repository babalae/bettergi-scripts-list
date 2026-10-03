/**
 * 追踪委托步骤处理器
 */
import { DIALOG_REGIONS } from "../config/index.js";
import { isInTalkUI, bvPageOcrRegion, RO } from "../vision/index.js";
import { defineStep } from "./define-step.js";

/**
 * 根据 iconType 取对应的 RO 模板。
 */
function pickIconRo(iconType) {
    if (iconType === "Base") {
        log.info("使用基础委托图标");
        return RO.iconBaseFull;
    } else if (iconType === "Question") {
        log.info("使用问号任务图标");
        return RO.iconQuestion;
    } else if (iconType === "Task") {
        log.info("使用任务图标");
        return RO.iconTask;
    }
    throw new Error("不支持的追踪图标类型: " + iconType);
}

function parseDistance(text) {
    const match = String(text || "").replace(/[oO]/g, "0").match(/(\d+)\s*m/i);
    return match ? Number(match[1]) : null;
}

function updateDistanceCacheUnderIcon(cap, iconRes, state) {
    const area = cap.DeriveCrop(
        Math.round(iconRes.x - 55),
        Math.round(iconRes.y + 32),
        130,
        45
    );
    try {
        const result = area.find(RecognitionObject.ocrThis);
        const text = result && result.text ? result.text.trim() : "";
        const distance = parseDistance(text);
        if (distance !== null) {
            state.distance = distance;
            state.missingDistanceCount = 0;
        } else {
            state.missingDistanceCount++;
            if (state.missingDistanceCount >= 10) {
                state.distance = null;
            }
        }
        return state.distance;
    } finally {
        area.Dispose();
    }
}

async function clickMatchedNpcFromOcr(targetText) {
    if (!targetText) return false;

    const results = bvPageOcrRegion(DIALOG_REGIONS.DIALOG_OPTIONS);
    for (let i = 0; i < results.count; i++) {
        const item = results[i];
        if (!item.text || !item.text.includes(targetText)) continue;

        log.info("检测到目标交互项，点击进入对话: {text}", item.text);
        keyDown("VK_MENU");
        try {
            await sleep(200);
            item.click();
            await sleep(100);
            leftButtonClick();
        } finally {
            keyUp("VK_MENU");
        }
        return true;
    }

    return false;
}

/**
 * 自动导航到 NPC 对话位置
 *
 * 通过地图图标匹配和前进检测，自动导航到目标NPC位置
 * 支持多种图标类型和到达后自动对话功能
 *
 * 坐标说明（基于1920×1080分辨率）：
 * - 屏幕中心约在 (960, 540)
 * - 图标在 (900-1020, <540) 范围内认为视角已调正
 * - 图标Y坐标 >= 520 时说明目标在镜头背后，需大幅调整X轴转身
 *
 * @param {Object} options - 配置选项
 * @param {string} [options.npcName] - 目标 NPC 名称
 * @param {string} [options.iconType] - 图标类型 "Base"|"Question"|"Task"
 * @param {boolean} [options.autoTalk] - 到达后是否自动对话
 * @returns {Promise<void>}
 */
async function autoNavigateToTalk(options = {}) {
    const { npcName = "", iconType = "", autoTalk = false } = options;

    // 目标NPC名称（用于到达检测）
    const targetText = npcName;
    const iconTemplateRO = pickIconRo(iconType);

    // 前进次数计数器（用于超时检测）
    let forwardAttemptCount = 0;
    let lookedDownOnce = false;
    const navigationState = { icon: null, distance: null, missingDistanceCount: 0 };

    middleButtonClick();
    await sleep(800);

    // 停止信号（用于终止后台异步任务）
    const cancel = { flag: false };

    const recognitionTask = async () => {
        let failCount = 0;
        while (!cancel.flag) {
            await sleep(100);
            try {
                const cap = captureGameRegion();
                try {
                    const iconRes = cap.Find(iconTemplateRO);

                    // 识别失败处理
                    if (iconRes.isEmpty()) {
                        failCount++;
                        navigationState.icon = null;
                        log.warn("图标识别失败，连续失败次数: {count}/5", failCount);
                        keyPress("v");
                        await sleep(200);
                        if (failCount >= 5) {
                            log.error("图标连续识别失败5次");
                            cancel.flag = true;
                            return;
                        }
                        continue;
                    }

                    // 识别成功，重置失败计数
                    failCount = 0;
                    navigationState.icon = { x: iconRes.x, y: iconRes.y };

                    updateDistanceCacheUnderIcon(cap, iconRes, navigationState);
                } finally { cap.Dispose(); }
            } catch (e) {
                log.error("图标/距离识别异常: {e}", e);
            }
        }
    };

    /**
     * 持续微调视角的异步任务。
     * @param {Object} [options]
     * @param {number|null} [options.maxAdjustCount] - 最大调整次数，null 表示持续调整
     * @param {boolean} [options.stopWhenAligned] - 连续稳定后是否提前返回
     * @param {boolean} [options.pathingTurn] - 寻路中使用更大的转头幅度
     * @returns {Promise<boolean>} 是否在未取消状态下结束
     */
    const adjustTask = async ({ maxAdjustCount = null, stopWhenAligned = false, pathingTurn = false } = {}) => {
        let adjustCount = 0;
        let stableCount = 0;
        while (!cancel.flag && (maxAdjustCount === null || adjustCount < maxAdjustCount)) {
            adjustCount++;
            await sleep(250);
            const icon = navigationState.icon;
            if (!icon) {
                stableCount = 0;
                continue;
            }

            if (Math.abs(icon.x - 960) <= 80 && icon.y < 540) {
                stableCount++;
                if (stopWhenAligned && stableCount >= 2) return true;
                continue;
            }
            stableCount = 0;

            if (icon.y >= 520 && !lookedDownOnce) {
                lookedDownOnce = true;
                log.debug("图标位于画面下方，先下拉镜头后重新判断");
                moveMouseBy(0, 520);
                continue;
            }

            const offsetX = icon.x - 960;
            const yFactor = Math.max(0, Math.min(1, (icon.y - 360) / 420));
            const useAcceleratedTurn = pathingTurn && navigationState.distance === null;
            const gain = useAcceleratedTurn
                ? 1.6 + yFactor * 2.0
                : 0.55 + yFactor * 0.55;
            const maxMove = useAcceleratedTurn
                ? 900 + yFactor * 1100
                : 320 + yFactor * 360;
            const moveX = Math.round(Math.max(-maxMove, Math.min(maxMove, offsetX * gain)));
            if (moveX !== 0) moveMouseBy(moveX, 0);
        }
        return !cancel.flag;
    };

    // === 异步：持续前进 ===
    const moveTask = async () => {
        let jump = 1;
        let clickedInCloseRange = false;
        while (!cancel.flag) {
            if (navigationState.distance !== null && navigationState.distance <= 3) {
                keyUp("w");
                if (!clickedInCloseRange) {
                    keyPress("w");
                    leftButtonClick(); 
                    await sleep(500)
                    keyPress("w");
                    await sleep(50)
                    keyPress("w");
                    clickedInCloseRange = true;
                }
                await sleep(200);
                continue;
            }

            clickedInCloseRange = false;
            if (navigationState.distance !== null && navigationState.distance < 5) {
                keyDown("w");
                await sleep(600);
                keyUp("w");
                await sleep(100);
                forwardAttemptCount++;
                continue;
            }

            jump++;
            keyDown("w");
            await sleep(1000);
            if (jump % 2 === 0) {
                keyPress("VK_SPACE");
                await sleep(100);
            }

            keyUp("w");
            await sleep(200);
            forwardAttemptCount++;
        }
    };

    // 距离/图标识别高频刷新缓存，镜头校正低频读取缓存，避免频繁转头。
    recognitionTask();

    // 先执行预对准，连续稳定后提前开始前进，避免启动前来回摆动。
    await adjustTask({
        maxAdjustCount: 24,
        stopWhenAligned: true,
    });
    if (cancel.flag) return;

    // === 启动并行异步任务 ===
    adjustTask({ pathingTurn: true });
    moveTask();

    // === 阶段2：OCR 到达检测主循环 ===
    while (!cancel.flag) {
        await sleep(500);
        try {
            if (autoTalk) {
                await clickMatchedNpcFromOcr(targetText);
            }

            if (isInTalkUI()) {
                log.info("已进入对话界面");
                cancel.flag = true;
            } else if (forwardAttemptCount > 300) {
                cancel.flag = true;
                throw new Error("前进时间超时");
            }
        } catch (error) {
            if (cancel.flag) throw error;
            log.warn("目标交互OCR检测异常: {error}", error.message || error);
        }
    }
}

const run = async (step) => {
    const targetNpc = step.data.npc || "";
    const iconType = step.data.iconType;
    const autoTalk = step.data.autoTalk;

    log.info("执行追踪委托，目标NPC: {target}，图标类型: {type}", targetNpc, iconType);
    await autoNavigateToTalk({ npcName: targetNpc, iconType: iconType, autoTalk: autoTalk });
    log.info("追踪委托执行完成");
};

export default defineStep({
    type: "追踪委托",
    category: "交互方法",
    dataSpec: {
        kind: "object",
        fields: {
            npc: {
                type: "string",
                label: "交互名称",
                nonEmpty: true,
                alwaysVisible: true,
                hint: "填写要匹配的 NPC 名称或交互项文字，例如“采摘”。",
            },
            iconType: {
                type: "string",
                label: "追踪图标",
                default: "Base",
                alwaysVisible: true,
                options: [
                    { value: "Base", label: "基础委托（Base）" },
                    { value: "Question", label: "问号任务（Question）" },
                    { value: "Task", label: "任务（Task）" },
                ],
            },
            autoTalk: {
                type: "boolean",
                label: "自动点击交互项",
                default: false,
                alwaysVisible: true,
            },
        },
        validate: data => data.autoTalk && !data.npc?.trim() ? "追踪委托启用 autoTalk 时必须填写 data.npc" : "",
    },
    run,
});
