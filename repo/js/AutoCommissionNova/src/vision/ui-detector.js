/**
 * UI 检测与操作工具
 * 使用 BvPage 检测游戏界面状态，提供通用 UI 操作
 */
import { COMMISSION_STATUS, UI_REGIONS } from "../config/index.js";
import { RO } from "./templates/index.js";

/**
 * 检测是否在主界面
 *
 * @returns {boolean} 是否在主界面
 */
export function isInMainUI() {
    return new BvPage().locator(RO.inMainUI).isExist();
}

/**
 * 检测是否在对话界面
 *
 * @returns {boolean} 是否在对话界面
 */
export function isInTalkUI() {
    return new BvPage().locator(RO.inTalk).isExist();
}

/**
 * 检测冒险历练是否启用
 *
 * 委托页出现"长效历练点"时，委托名区域使用当前 ROI；未出现时使用备用 ROI。
 * 检测异常时默认启用，保持既有识别行为。
 *
 * @returns {Promise<boolean>} 是否启用冒险历练
 */
export async function isAdventureEncountersEnabled() {
    try {
        const page = new BvPage();
        for (let i = 0; i < 3; i++) {
            if (page.locator("长效历练点", UI_REGIONS.ADVENTURE_ENCOUNTERS_ENABLED_INDICATOR).isExist()) {
                return true;
            }
            await sleep(200);
        }
        return false;
    } catch (error) {
        log.warn("检测冒险历练启用状态失败，默认使用当前委托名 OCR 区域: {error}", error.message);
        return true;
    }
}

/**
 * 检测委托完成状态（使用图像识别）
 * @param {number} buttonIndex - 委托按钮索引（0-3）
 * @returns {Promise<string>} COMMISSION_STATUS.COMPLETED / UNCOMPLETED / UNKNOWN
 */
export async function detectCommissionStatusByImage(buttonIndex) {
    try {
        const page = new BvPage();
        if (page.locator(RO.commissionCompleted(buttonIndex)).isExist()) return COMMISSION_STATUS.COMPLETED;
        if (page.locator(RO.commissionUncompleted(buttonIndex)).isExist()) return COMMISSION_STATUS.UNCOMPLETED;
        return COMMISSION_STATUS.UNKNOWN;
    } catch (error) {
        log.error("检测第{x}个委托完成状态时出错：{error}", buttonIndex + 1, error.message);
        return COMMISSION_STATUS.UNKNOWN;
    }
}

/**
 * 进入委托界面（F1快捷键 + 点击委托标签）
 *
 * 通过 F1 键打开冒险之证，并点击委托标签进入委托界面
 *
 * @returns {Promise<boolean>} 是否成功进入委托界面
 */
export async function enterCommissionScreen() {
    try {
        const page = new BvPage();

        await page.locator("委托", UI_REGIONS.COMMISSION_TAB).withRetryAction(() => keyPress("VK_F1")).waitFor();

        await page.locator("每日委托奖励", UI_REGIONS.DAILY_COMMISSION_REWARD).withRetryAction(() => click(300, 350)).waitFor();
        log.info("已进入委托界面");
        return true;
    } catch (error) {
        log.error("进入委托界面失败: {error}", error.message);
        return false;
    }
}

/**
 * 委托列表翻页（模拟鼠标拖拽）
 *
 * 通过鼠标拖拽操作实现委托列表页面的滚动
 *
 * @param {number} scrollCount - 滚动次数
 * @returns {Promise<boolean>} 是否成功
 */
export async function pageScroll(scrollCount) {
    try {
        const clickX = 950;
        const clickY = 600;
        const totalDistance = 200;
        const stepDistance = 10;
        for (let i = 0; i < scrollCount; ++i) {
            moveMouseTo(clickX, clickY);
            await sleep(100);
            leftButtonDown();
            const steps = totalDistance / stepDistance;
            for (let j = 0; j < steps; j++) {
                moveMouseBy(0, -stepDistance);
                await sleep(10);
            }
            await sleep(100);
            leftButtonUp();
            await sleep(300);
        }
        return true;
    } catch (error) {
        log.error("执行滑动操作时发生错误：{error}", error.message);
        return false;
    }
}
