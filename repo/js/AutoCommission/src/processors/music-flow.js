/**
 * 乐流奔引步骤处理器
 * 循环识别 MoonLightIcon，出现后按 T 触发交互，直到 OCR 到委托完成。
 */
import { RO } from "../vision/index.js";
import { bvPageOcrRegionText } from "../vision/ocr-utils.js";
import { defineStep } from "./define-step.js";

const CHECK_INTERVAL_MS = 500;
const COMPLETION_REGION = new OpenCvSharp.OpenCvSharp.Rect(880, 165, 160, 45);

function isCommissionCompleted() {
    try {
        const text = bvPageOcrRegionText(COMPLETION_REGION);
        if (text.includes("委托完成")) {
            log.info("识别到委托完成文本: {text}", text);
            return true;
        }
        return false;
    } catch (error) {
        log.debug("乐流奔引委托完成 OCR 失败: {error}", error.message);
        return false;
    }
}

export default defineStep({
    type: "乐流奔引",
    category: "特定委托对策",
    dataSpec: { kind: "none" },
    run: async () => {
        const page = new BvPage();

        log.info("开始执行乐流奔引步骤，循环检测月光图标");
        while (true) {
            if (isCommissionCompleted()) {
                return true;
            }

            if (page.locator(RO.moonLightIcon).isExist()) {
                log.info("识别到月光图标，按 T 触发");
                keyPress("t");
                await sleep(300);
            }

            await sleep(CHECK_INTERVAL_MS);
        }
    },
});
