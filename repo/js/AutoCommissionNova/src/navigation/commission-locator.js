/**
 * 委托目标查找/追踪模块
 * - findCommissionTarget: 激活追踪 + 识别并返回大地图坐标
 * - trackCommission:      仅激活追踪，不识别坐标（executor 启动时使用）
 */
import { OCR_REGIONS } from "../config/index.js";
import { enterCommissionScreen } from "../vision/index.js";
import { findCommissionIndex, getCommissionPosition, clickCommissionAndOpenMap } from "../recognition/index.js";

/**
 * 寻找委托目标位置并追踪
 * @param {string} commissionName - 委托名称
 * @returns {Promise<Object|null>} 位置对象
 */
export async function findCommissionTarget(commissionName) {
    try {
        const page = new BvPage();
        log.info("开始寻找委托目标位置: {name}", commissionName);
        await genshin.returnMainUi();

        await enterCommissionScreen();

        const foundIndex = await findCommissionIndex(commissionName);
        if (foundIndex === -1) {
            log.warn("未找到委托: {name}", commissionName);
            return null;
        }

        let currentCommissionPosition = null;

        await clickCommissionAndOpenMap(page, foundIndex);

        await page.locator("停止追踪", OCR_REGIONS.COMMISSION_TRACKING).withRetryInterval(1000).withRetryAction(() => click(1693, 1000)).waitFor();
        await page.locator("停止追踪", OCR_REGIONS.COMMISSION_TRACKING).withRetryInterval(1000).withRetryAction(() => keyPress("VK_ESCAPE")).waitForDisappear();

        currentCommissionPosition = await getCommissionPosition();
        await genshin.returnMainUi();

        return currentCommissionPosition;
    } catch (error) {
        log.error("寻找委托目标位置时出错: {error}", error.message);
        log.debug("错误详情:", error);
        return null;
    }
}

/**
 * 仅激活委托追踪，不识别坐标
 * 委托坐标在 OCR 识别阶段已存入 commission.commissionPosition，executor 启动时
 * 只需要激活追踪点供后续寻路使用，不需要再读一次大地图
 * @param {string} commissionName - 委托名称
 * @returns {Promise<boolean>} 是否成功激活追踪
 */
export async function trackCommission(commissionName) {
    try {
        const page = new BvPage();
        log.debug("开始追踪委托: {name}", commissionName);
        await genshin.returnMainUi();

        await enterCommissionScreen();

        const foundIndex = await findCommissionIndex(commissionName);
        if (foundIndex === -1) {
            log.warn("未找到委托: {name}", commissionName);
            return false;
        }

        await clickCommissionAndOpenMap(page, foundIndex);

        await page.locator("停止追踪", OCR_REGIONS.COMMISSION_TRACKING).withRetryInterval(1000).withRetryAction(() => click(1693, 1000)).waitFor();
        await page.locator("停止追踪", OCR_REGIONS.COMMISSION_TRACKING).withRetryInterval(1000).withRetryAction(() => keyPress("VK_ESCAPE")).waitForDisappear();

        await genshin.returnMainUi();

        return true;
    } catch (error) {
        log.error("追踪委托时出错: {error}", error.message);
        log.debug("错误详情:", error);
        return false;
    }
}
