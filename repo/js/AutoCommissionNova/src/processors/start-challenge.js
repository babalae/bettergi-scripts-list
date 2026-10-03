/**
 * HSV 识别挑战入口并开启挑战
 */
import { bvPageOcrRegionText } from "../vision/ocr-utils.js";
import { isCancellationError } from "../utils/error-utils.js";
import { defineStep } from "./define-step.js";

const cv = OpenCvSharp.OpenCvSharp;

const START_CHALLENGE_CONFIG = {
    timeoutMs: 45 * 1000,
    minArea: 800,
    target: { x: 960, topY: 0 },
    alignTolerance: { x: 90, y: 40 },
    initialTurnX: 300,
    searchTurnX: 300,
    forwardMs: 500,
    alignSleepMs: 220,
    searchSleepMs: 300,
    promptRect: new cv.Rect(1010, 380, 620, 320),
    hsvLower: new cv.Scalar(118, 164, 0),
    hsvUpper: new cv.Scalar(179, 255, 255),
    excludeRects: [
        new cv.Rect(1563, 219, 354, 377),
        new cv.Rect(1322, 0, 598, 106),
        new cv.Rect(0, 0, 390, 236),
        new cv.Rect(749, 947, 370, 77),
        new cv.Rect(876, 398, 175, 419),
    ],
};

/**
 * 将需要释放的宿主资源加入当前资源列表。
 * @param {Object|null|undefined} value - BetterGI/C# 暴露的可释放对象。
 * @param {Object[]} resources - 当前函数拥有的资源列表。
 * @returns {Object|null|undefined} 原对象，便于内联赋值。
 */
function own(value, resources) {
    if (value) resources.push(value);
    return value;
}

/**
 * 释放资源列表中的 BetterGI/C# 对象，兼容 dispose/Dispose 两种命名。
 * @param {Object[]} resources - 由 own 收集的资源列表。
 */
function disposeAll(resources) {
    for (let i = resources.length - 1; i >= 0; i--) {
        try {
            const item = resources[i];
            if (typeof item.dispose === "function") item.dispose();
            else if (typeof item.Dispose === "function") item.Dispose();
        } catch (e) { }
    }
}

/**
 * 根据 HSV 阈值生成挑战目标 mask，并应用排除区域与闭运算。
 * @param {Mat} srcMat - captureGameRegion 返回的游戏截图 Mat。
 * @param {Object[]} resources - 资源列表，用于统一释放中间 Mat。
 * @returns {Mat} 二值 mask。
 */
function makeMask(srcMat, resources) {
    const hsv = own(new Mat(), resources);
    const mask = own(new Mat(), resources);
    cv.Cv2.CvtColor(srcMat, hsv, cv.ColorConversionCodes.BGR2HSV);
    cv.Cv2.InRange(hsv, START_CHALLENGE_CONFIG.hsvLower, START_CHALLENGE_CONFIG.hsvUpper, mask);

    for (const rect of START_CHALLENGE_CONFIG.excludeRects) {
        const x = Math.max(0, Math.min(mask.cols, rect.x));
        const y = Math.max(0, Math.min(mask.rows, rect.y));
        const width = Math.max(0, Math.min(rect.width, mask.cols - x));
        const height = Math.max(0, Math.min(rect.height, mask.rows - y));
        if (width <= 0 || height <= 0) continue;

        const roi = own(new Mat(mask, new cv.Rect(x, y, width, height)), resources);
        roi.setTo(cv.Scalar.All(0));
    }

    const kernel = own(cv.Cv2.GetStructuringElement(
        cv.MorphShapes.Rect,
        new cv.Size(17, 17)
    ), resources);
    cv.Cv2.MorphologyEx(mask, mask, cv.MorphTypes.Close, kernel);
    return mask;
}

/**
 * 在 mask 中查找面积最大的挑战目标区域。
 * @param {Mat} mask - HSV 分割后的二值 mask。
 * @returns {{x:number,y:number,width:number,height:number,area:number,centerX:number,centerY:number}|null}
 * 面积大于阈值的最大外接矩形，未找到时返回 null。
 */
function findLargestTarget(mask) {
    const contoursVar = host.newVarOfArr(cv.Point, 2);
    const hierarchyVar = host.newVarOfArr(cv.HierarchyIndex, 1);
    cv.Cv2.FindContours(
        mask,
        contoursVar.out,
        hierarchyVar.out,
        cv.RetrievalModes.External,
        cv.ContourApproximationModes.ApproxSimple
    );

    const contours = Array.from(contoursVar.value || []);
    let best = null;
    for (const contour of contours) {
        const area = cv.Cv2.ContourArea(contour);
        if (area <= START_CHALLENGE_CONFIG.minArea) continue;
        if (best && area <= best.area) continue;

        const rect = cv.Cv2.BoundingRect(contour);
        best = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area,
            centerX: rect.x + rect.width / 2,
            centerY: rect.y + rect.height / 2,
        };
    }
    return best;
}

/**
 * 截取当前游戏画面并识别挑战目标区域。
 * @returns {{x:number,y:number,width:number,height:number,area:number,centerX:number,centerY:number}|null}
 * 当前帧中面积最大的目标区域。
 */
function findChallengeTarget() {
    const resources = [];
    try {
        const cap = own(captureGameRegion(), resources);
        const mask = makeMask(cap.srcMat || cap.SrcMat, resources);
        return findLargestTarget(mask);
    } finally {
        disposeAll(resources);
    }
}

/**
 * OCR 读取右侧交互提示区域文本。
 * @returns {string} OCR 文本，失败时返回空字符串。
 */
function readChallengePrompt() {
    try {
        return bvPageOcrRegionText(START_CHALLENGE_CONFIG.promptRect);
    } catch (error) {
        log.debug("开启挑战 OCR 失败: {error}", error.message);
        return "";
    }
}

/**
 * 判断当前画面是否出现“开启挑战”交互提示。
 * @returns {boolean} 出现提示时返回 true。
 */
function hasChallengePrompt() {
    const text = readChallengePrompt();
    if (text.includes("开启挑战")) {
        log.info("识别到交互提示: {text}", text);
        return true;
    }
    return false;
}

/**
 * 调整视角，使目标中心横向对齐屏幕中心，并使目标顶部对齐窗口顶部。
 * @param {{x:number,y:number,width:number,height:number,centerX:number}} target - 当前识别到的目标区域。
 * @returns {boolean} 已对齐时返回 true，否则执行一次鼠标微调并返回 false。
 */
function alignToTarget(target) {
    const dx = target.centerX - START_CHALLENGE_CONFIG.target.x;
    const dy = target.y - START_CHALLENGE_CONFIG.target.topY;
    const aligned = Math.abs(dx) <= START_CHALLENGE_CONFIG.alignTolerance.x
        && Math.abs(dy) <= START_CHALLENGE_CONFIG.alignTolerance.y;

    if (aligned) return true;

    const moveX = Math.round(dx * 0.8);
    const moveY = Math.round(dy * 0.6);
    if (moveX !== 0 || moveY !== 0) {
        moveMouseBy(moveX, moveY);
    }
    return false;
}

/**
 * 按住 W 前进一个短步，并确保结束时释放 W。
 * @returns {Promise<void>}
 */
async function walkForwardOnce() {
    keyDown("w");
    try {
        await sleep(START_CHALLENGE_CONFIG.forwardMs);
    } finally {
        keyUp("w");
    }
}

/**
 * 执行一次右转搜索动作；转动前点按 S，避免角色待机动画带来额外干扰像素。
 * @param {number} distanceX - 鼠标向右相对移动量。
 * @returns {Promise<void>}
 */
async function rotateRightForSearch(distanceX) {
    keyPress("s");
    await sleep(120);
    moveMouseBy(distanceX, 0);
}

/**
 * 主流程：归位视角、搜索 HSV 目标、对齐后前进，直到出现并触发“开启挑战”。
 * @returns {Promise<boolean>} 成功触发挑战时返回 true，超时返回 false。
 */
async function startChallenge() {
    const startTime = Date.now();
    middleButtonClick();
    await sleep(500);
    await rotateRightForSearch(START_CHALLENGE_CONFIG.initialTurnX);
    await sleep(START_CHALLENGE_CONFIG.searchSleepMs);

    while (Date.now() - startTime < START_CHALLENGE_CONFIG.timeoutMs) {
        keyUp("w");

        if (hasChallengePrompt()) {
            keyPress("f");
            await sleep(500);
            return true;
        }

        const target = findChallengeTarget();
        if (!target) {
            log.debug("未识别到挑战目标区域，继续向右旋转搜索");
            await rotateRightForSearch(START_CHALLENGE_CONFIG.searchTurnX);
            await sleep(START_CHALLENGE_CONFIG.searchSleepMs);
            continue;
        }

        log.debug(
            "识别到挑战目标区域 x={x}, y={y}, w={w}, h={h}, area={area}",
            target.x,
            target.y,
            target.width,
            target.height,
            Math.round(target.area)
        );

        if (!alignToTarget(target)) {
            await sleep(START_CHALLENGE_CONFIG.alignSleepMs);
            continue;
        }

        await walkForwardOnce();
    }

    log.warn("开启挑战步骤超时，未识别到“开启挑战”提示");
    return false;
}

export default defineStep({
    type: "开启挑战",
    category: "交互方法",
    dataSpec: { kind: "none" },
    retryOn: "return-false",
    /**
     * 开启挑战步骤入口，负责日志、取消异常透传与最终释放 W。
     * @returns {Promise<boolean>} 成功开启挑战时返回 true。
     */
    run: async () => {
        try {
            log.info("开始执行开启挑战步骤");
            const result = await startChallenge();
            if (result) {
                log.info("开启挑战步骤完成");
            }
            return result;
        } catch (error) {
            if (isCancellationError(error)) throw error;
            log.error("执行开启挑战步骤时出错: {error}", error.message);
            log.debug("详情: {error}", error.stack);
            throw error;
        } finally {
            keyUp("w");
        }
    },
});
