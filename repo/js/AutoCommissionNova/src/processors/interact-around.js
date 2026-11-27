/**
 * 在地图追踪终点附近逐圈扩大搜索交互目标。
 *
 * 移动轨迹移植自 BetterGI AutoPathing/PickAroundHandler：角色按住 A，
 * 通过周期性中键回正形成近似圆。每圈结束后先返回固定锚点，避免
 * PickAroundHandler 按理论终点增量换圈时将移速与碰撞误差持续累积。
 */
import { bvPageOcrRegion } from "../vision/ocr-utils.js";
import { defineStep } from "./define-step.js";

const cv = OpenCvSharp.OpenCvSharp;

const SEARCH_CONFIG = {
    speed: 1.1,
    ocrIntervalMs: 200,
    circleSegments: 6,
    promptRect: new cv.Rect(1010, 380, 620, 320),
};

const MOVEMENT_KEYS = ["w", "a", "s", "d"];

function releaseMovementKeys() {
    for (const key of MOVEMENT_KEYS) {
        keyUp(key);
    }
}

/**
 * BetterGI CircularMotionCalculator 的 JavaScript 移植。
 */
class CircularMotionCalculator {
    constructor(speed = 1.1) {
        this.circleTime = 33000;
        this.speed = speed;
        this.viewResetTime = 350 * speed;
        this.mixAngle = (this.viewResetTime / this.circleTime + 1 / 4) * 2 * Math.PI;
        [this.mixX, this.mixY] = this.getArcPoint(this.viewResetTime / this.mixAngle, this.mixAngle);
    }

    getArcPoint(radius, angle) {
        return [radius * (1 - Math.cos(angle)), radius * Math.sin(angle)];
    }

    getCircleInfo(index) {
        const edgeTime = 600 + index * 400;
        const angle = (edgeTime / this.circleTime + 1 / 4) * Math.PI;
        const radiusTime = this.circleTime / (2 * Math.PI);
        const [restX, restY] = this.getArcPoint(radiusTime, 2 * angle - this.mixAngle);
        const x = this.mixX - restX;
        const y = this.mixY + restY;
        const smallRadiusTime = Math.sqrt(x * x + y * y) / (2 * Math.sin(angle));
        const endAngle = angle - this.mixAngle + Math.atan2(x, y) + Math.PI / 2;
        return {
            edgeTime: edgeTime / this.speed,
            radiusTime: smallRadiusTime / this.speed,
            endAngle,
        };
    }
}

class InteractionSearch {
    constructor(text) {
        this.text = text;
        this.succeeded = false;
    }

    detectAndInteract() {
        if (this.succeeded) return true;

        try {
            const results = bvPageOcrRegion(SEARCH_CONFIG.promptRect);
            const texts = [];
            for (let i = 0; i < results.count; i++) {
                if (results[i].text) texts.push(results[i].text.trim());
            }
            const text = texts.join(" ");
            if (!text.includes(this.text)) return false;

            log.info("识别到目标交互提示: {text}", text);
            this.succeeded = true;
            releaseMovementKeys();
            keyPress("f");
            return true;
        } catch (error) {
            log.debug("在附近交互 OCR 失败: {error}", error.message || error);
            return false;
        }
    }

    async waitAndDetect(durationMs) {
        const endTime = Date.now() + Math.max(0, durationMs);
        if (this.detectAndInteract()) return true;

        while (Date.now() < endTime) {
            const waitMs = Math.min(
                SEARCH_CONFIG.ocrIntervalMs,
                endTime - Date.now()
            );
            if (waitMs > 0) await sleep(waitMs);
            // OCR 是同步操作，段尾再执行一次会把下一次中键回正持续向后推迟，
            // 破坏 PickAroundHandler 依赖的固定周期并造成圆周轨迹累计漂移。
            if (Date.now() >= endTime) return false;
            if (this.detectAndInteract()) return true;
        }
        return false;
    }

    async moveCircle(edgeTime) {
        let found = false;
        keyDown("a");
        try {
            found = await this.waitAndDetect(30);
            for (let i = 0; i < SEARCH_CONFIG.circleSegments && !found; i++) {
                middleButtonClick();
                found = await this.waitAndDetect(Math.round(edgeTime));
            }
        } finally {
            keyUp("a");
        }
        if (found) return true;
        return this.waitAndDetect(200);
    }

    async moveAfterTurn(turnKey, forwardMs = 0) {
        keyPress(turnKey);
        if (await this.waitAndDetect(200)) return true;
        middleButtonClick();
        if (await this.waitAndDetect(500)) return true;

        if (forwardMs > 0) {
            keyDown("w");
            try {
                if (await this.waitAndDetect(forwardMs)) return true;
            } finally {
                keyUp("w");
            }
            if (await this.waitAndDetect(200)) return true;
        }
        return false;
    }

    async moveAxis(turnKey, durationMs) {
        if (durationMs <= 0) return false;
        return this.moveAfterTurn(turnKey, Math.round(durationMs));
    }

    async moveBetweenRings(oldRadius, newRadius, angle) {
        const x = newRadius - oldRadius * Math.cos(angle);
        const y = oldRadius * Math.sin(angle);

        middleButtonClick();
        if (await this.waitAndDetect(500)) return true;

        // BetterGI 的正向分量映射为 S/A；返回锚点时分量为负，使用 W/D
        // 走完全相反的位移。纵向保留原实现的 200ms 转向补偿。
        const verticalKey = y >= 0 ? "s" : "w";
        const horizontalKey = x >= 0 ? "a" : "d";
        if (await this.moveAxis(verticalKey, Math.abs(y) + 200)) return true;
        return this.moveAxis(horizontalKey, Math.abs(x));
    }
}

export default defineStep({
    type: "在附近交互",
    category: "交互方法",
    dataSpec: {
        kind: "object",
        fields: {
            text: { type: "string", label: "交互文字", required: true, nonEmpty: true },
            turns: { type: "number", label: "搜索圈数", default: 3, integer: true, exclusiveMin: 0 },
        },
    },
    run: async (step) => {
        const { text, turns } = step.data;
        if (!text.trim()) throw new Error("在附近交互的 text 不能为空");
        if (!Number.isInteger(turns) || turns <= 0) {
            throw new Error("在附近交互的 turns 必须是正整数");
        }

        const search = new InteractionSearch(text);
        const calculator = new CircularMotionCalculator(SEARCH_CONFIG.speed);

        log.info("开始在附近交互，目标: {text}，圈数: {turns}", text, turns);
        try {
            if (search.detectAndInteract()) return true;
            for (let i = 0; i < turns; i++) {
                const circle = calculator.getCircleInfo(i);
                log.debug("在附近交互第 {current}/{total} 圈", i + 1, turns);
                if (await search.moveBetweenRings(0, circle.radiusTime, 0)) return true;
                if (await search.moveCircle(circle.edgeTime)) return true;
                if (await search.moveBetweenRings(circle.radiusTime, 0, circle.endAngle)) return true;
            }
            throw new Error(`在附近交互完成 ${turns} 圈，未识别到“${text}”`);
        } finally {
            releaseMovementKeys();
        }
    },
});
