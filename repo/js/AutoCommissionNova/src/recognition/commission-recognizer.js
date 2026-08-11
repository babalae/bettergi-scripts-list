/**
 * 委托识别主模块
 * 负责委托列表的 OCR 识别、地点识别、详情检测等
 */
import { COMMISSION_TYPE, COMMISSION_STATUS, OCR_REGIONS, UI_REGIONS } from "../config/index.js";
import { bvPageOcrRegion, bvPageOcrRegionText, pageScroll, detectCommissionStatusByImage } from "../vision/index.js";
import { standardizeCommissionName, standardizeCommissionLocation } from "./commission-standardizer.js";
import { getCommissionPosition, clickCommissionAndOpenMap, resolveCommissionNameOcrRegions } from "./commission-scanner.js";
import { isCancellationError } from "../utils/error-utils.js";
import { RO } from "../vision/index.js";

/**
 * 输出单个委托完成识别后的紧凑摘要。
 */
function logCommissionSummary(commission) {
    const type = commission.type === COMMISSION_TYPE.BASIC
        ? "Basic"
        : commission.type === COMMISSION_TYPE.NPC ? "NPC" : "未支持";
    const country = commission.country || "-";
    const location = commission.location || "-";
    const position = commission.commissionPosition;
    const coordinates = Number.isFinite(position?.x) && Number.isFinite(position?.y)
        ? `(${Math.round(position.x)}, ${Math.round(position.y)})`
        : "-";
    log.info(`委托 ${commission.id} | ${commission.name || "-"} | ${commission.status || COMMISSION_STATUS.UNKNOWN} | ${type} | ${country} | ${location} | 坐标: ${coordinates}`);
}

/**
 * 识别委托地点
 * @returns {Promise<string>} 地点名称；OCR 失败时返回空字符串（调用方据此设置 status）
 */
export async function recognizeCommissionLocation(country) {
    try {
        const ocrRegion = country === "挪德卡莱" ? OCR_REGIONS.LOCATION_IN_NOD_KRAI : OCR_REGIONS.LOCATION_IN_OTHER_COUNTRY;
        const location = bvPageOcrRegionText(ocrRegion);

        if (location && location.trim()) {
            return location.trim();
        }

        return "";

    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("识别委托地点时出错: {error}", error.message);
        return "";
    }
}

/**
 * 检测是否进入委托详情界面
 * @returns {Promise<string>} 国家名称或状态
 */
export async function checkDetailPageEntered() {
    try {
        for (let i = 0; i < 3; i++) {
            const results = bvPageOcrRegion(OCR_REGIONS.DETAIL_COUNTRY);
            if (results.count > 0) {
                for (let j = 0; j < results.count; j++) {
                    const text = results[j].text.trim();
                    switch (true) {
                        case text.includes("蒙德"):
                            return "蒙德";
                        case text.includes("璃月"):
                            return "璃月";
                        case text.includes("稻妻"):
                            return "稻妻";
                        case text.includes("须弥"):
                            return "须弥";
                        case text.includes("枫丹"):
                            return "枫丹";
                        case text.includes("纳塔"):
                            return "纳塔";
                        case text.includes("挪德"):
                            return "挪德卡莱";
                        case text.length >= 1:
                            return text;
                    }
                }
            }
            await sleep(500);
        }
        log.info("三次OCR检测后仍未确认委托国家");
        return "未知";
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("检测委托详情界面时出错: {error}", error.message);
        return "错误";
    }
}

/**
 * 识别委托列表（4个委托）
 *
 * 遍历委托界面4个位置，依次识别委托名称、状态和地点
 * 第4个委托需要翻页操作
 *
 * 识别流程：
 * 1. 扫描委托名称（前3个直接识别，第4个需要翻页）
 * 2. 标准化委托名称（使用编辑距离算法匹配已知委托）
 * 3. 检测委托状态（已完成/未完成）
 * 4. 进入详情页识别地点
 * 5. 获取委托地图坐标
 * 6. 退出详情页
 *
 * @param {Object} supportedCommissions - 支持的委托列表
 * @returns {Promise<Array>} 委托信息数组
 */
export async function recognizeCommissions(supportedCommissions) {
    try {
        const allCommissions = [];
        const page = new BvPage();
        const commissionNameRegions = await resolveCommissionNameOcrRegions();
        let commission;
        for (let i = 0; i < 4; i++) {
            try {
                commission = {};
                if (i === 3) { await pageScroll(1) };  // 第4个委托需要翻页
                const id = i + 1;
                const rawName = bvPageOcrRegionText(commissionNameRegions[i]);

                const standardizedName = standardizeCommissionName(rawName);
                const isBasic = supportedCommissions.basic.includes(standardizedName);
                const isNpc = supportedCommissions.npc.includes(standardizedName);
                commission = {
                    id: id,
                    name: standardizedName,
                    supported: isBasic || isNpc,
                    type: isBasic ? COMMISSION_TYPE.BASIC : isNpc ? COMMISSION_TYPE.NPC : "",
                    location: "",
                    status: COMMISSION_STATUS.UNKNOWN,
                };
                allCommissions.push(commission);
                const iconStatus = await detectCommissionStatusByImage(i);
                if (iconStatus === COMMISSION_STATUS.COMPLETED) {
                    commission.status = COMMISSION_STATUS.COMPLETED;
                    logCommissionSummary(commission);
                    await sleep(1);
                    continue;
                }

                await clickCommissionAndOpenMap(page, i);


                const country = await checkDetailPageEntered();
                commission.country = country;

                const rawLocation = await recognizeCommissionLocation(country);
                if (rawLocation) {
                    commission.location = standardizeCommissionLocation(commission.name, rawLocation, country);
                    commission.status = COMMISSION_STATUS.UNCOMPLETED;
                }
                
                //关闭详情页
                await page.locator(RO.track)
                    .withRetryAction(async () => { keyPress("VK_ESCAPE"); await sleep(500); })
                    .waitForDisappear();
                
                const bigMapPosition = await getCommissionPosition();
                commission.commissionPosition = bigMapPosition;

                // 关闭大地图返回委托页
                await page.locator("每日委托奖励", UI_REGIONS.DAILY_COMMISSION_REWARD).withRetryAction(async () => {
                    log.debug("尝试从地图返回委托页面");
                    keyPress("VK_ESCAPE");
                    await sleep(1000);
                }).waitFor();

                logCommissionSummary(commission);

            } catch (error) {
                if (isCancellationError(error)) { throw error; }
                log.error("处理第 {id} 个委托 {name} 时出错: {error}", commission.id, commission.name, error.message);
                log.debug("错误详情:{error}", error);
                commission.country = "未知";

            }
            await sleep(1);
        }

        return allCommissions;
    } catch (error) {
        if (isCancellationError(error)) { throw error; }
        log.error("委托识别出错: {error}", error.message);
        log.debug("错误详情:{error}", error);
        return [];
    }
}
