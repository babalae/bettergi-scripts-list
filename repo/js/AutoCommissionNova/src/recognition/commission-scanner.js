/**
 * 委托扫描共享模块
 * 提取 commission-recognizer.js 和 commission-finder.js 中的公共逻辑
 * 避免代码重复，提高可维护性
 */
import { OCR_REGIONS, MIN_TEXT_LENGTH, COMMISSION_POSITIONING_BUTTONS } from "../config/index.js";
import { bvPageOcrRegion, bvPageOcrRegionText, isAdventureEncountersEnabled, pageScroll, RO } from "../vision/index.js";
import { cleanText } from "../utils/text-utils.js";
import { getPositionWithVoting } from "../navigation/position-utils.js";
import { standardizeCommissionName } from "./commission-standardizer.js";

/**
 * 根据冒险历练启用状态选择委托名 OCR 区域
 *
 * @returns {Promise<OpenCvSharp.OpenCvSharp.Rect[]>} 委托名 OCR 区域列表
 */
export async function resolveCommissionNameOcrRegions() {
    const enabled = await isAdventureEncountersEnabled();
    log.debug(enabled ? "冒险历练已解锁" : "冒险历练未解锁");
    return enabled
        ? OCR_REGIONS.COMMISSION_NAME_ADVENTURE_ENCOUNTERS_ENABLED
        : OCR_REGIONS.COMMISSION_NAME_ADVENTURE_ENCOUNTERS_DISABLED;
}

/**
 * 扫描指定位置的委托名称
 * 
 * 对委托界面指定位置进行OCR识别，返回识别到的委托名称
 * 
 * @param {number} positionIndex - 委托位置索引（0-3）
 * @returns {Promise<string|null>} 识别到的委托名称，失败返回null
 */
export async function scanCommissionAtPosition(positionIndex) {
    // 第4个委托需要翻页
    if (positionIndex === 3) {
        await pageScroll(1);
    }

    const commissionNameRegions = await resolveCommissionNameOcrRegions();
    const region = commissionNameRegions[positionIndex];

    try {
        const results = bvPageOcrRegion(region);

        for (let i = 0; i < results.count; i++) {
            const text = cleanText(results[i].text);

            // 过滤掉太短的文本（可能是误识别）
            if (text && text.length >= MIN_TEXT_LENGTH) {
                return text;
            }
        }
    } catch (error) {
        log.error("识别第{index}个委托区域时出错: {error}", positionIndex + 1, error.message);
    }

    return null;
}

/**
 * 查找指定委托在界面中的位置索引
 * 
 * 遍历委托界面的4个位置，查找匹配的委托名称
 * 返回位置索引（0-3），未找到返回-1
 * 
 * @param {string} targetName - 目标委托名称
 * @returns {Promise<number>} 委托位置索引（0-3），未找到返回-1
 */
export async function findCommissionIndex(targetName) {
    const commissionNameRegions = await resolveCommissionNameOcrRegions();

    for (let positionIndex = 0; positionIndex < 4; positionIndex++) {

        // 第4个委托需要翻页
        if (positionIndex === 3) { await pageScroll(1); }

        //ocr委托名称然后标准化名称
        const name = standardizeCommissionName(
            bvPageOcrRegionText(commissionNameRegions[positionIndex])
        );
        if (name === targetName) {
            log.info("找到委托 {name} 在位置 {index}", targetName, positionIndex + 1);
            return positionIndex;
        }
    }
    return -1;
}


/**
 * 退出委托详情界面
 * 
 * 通过模拟ESC按键操作退出当前详情界面
 * 包含按键按下、延迟、按键释放的完整流程
 * 
 * @param {number} [waitMs=1200] - 退出后等待的毫秒数，默认1200
 * @returns {Promise<void>}
 */
export async function exitCommissionDetail(waitMs = 1200) {
    keyDown("VK_ESCAPE");
    await sleep(300);
    keyUp("VK_ESCAPE");
    await sleep(waitMs);
}

/**
 * 获取当前委托的地图坐标
 *
 * 进入委托详情后，通过投票定位算法获取委托在游戏地图中的坐标
 * 用于战斗委托流程的距离匹配
 *
 * @returns {Promise<Object|null>} 坐标对象 {x, y}，失败返回null
 */
export async function getCommissionPosition() {
    try {
        return await getPositionWithVoting();
    } catch (error) {
        log.error("获取委托坐标时出错: {error}", error.message);
        return null;
    }
}

/**
 * 点击委托定位按钮并打开大地图，等待 TrackButton 出现
 *
 * 抽出 commission-recognizer 与 commission-locator 共用的"点击委托追踪→等大地图"步骤，
 * 避免两处分别维护 TemplateMatch / withRetryAction 逻辑
 *
 * @param {Object} page - BvPage 实例（调用方持有以复用）
 * @param {number} index - 委托位置索引（0-3）
 */
export async function clickCommissionAndOpenMap(page, index) {
    const button = COMMISSION_POSITIONING_BUTTONS[index];
    await page.locator(RO.track).withRetryAction(async () => {
        click(button.x, button.y);
        await sleep(1500); // 打开大地图跳转有些微延迟
    }).waitFor();
}
