//作者：夜雨l星辰
// 质变仪模块：打开背包部署参量质变仪、交互进入放入材料界面、检测与等待质变完成

import { config } from "../config.js";
import { handleExpiredItems, textOCREnhanced, imageRecognitionEnhanced } from "./vision.js";
import { writeLastTransformTime } from "./cooldown.js";

// ===== 打开背包并部署参量质变仪 =====
export async function deployTransformer() {
    await sleep(500);
    await keyPress("B");        // 打开背包
    await sleep(1000);
    await handleExpiredItems();
    await sleep(1000);
    await click(1067, 57);      // 点开背包小道具页
    const bagOk = await textOCREnhanced("小道具", 3, 0, 0, 126, 17, 99, 53);
    if (!bagOk.found) { log.error("未打开小道具页面，请确认背包已正确打开"); return false; }
    await sleep(500);
    const ZbyResult = await imageRecognitionEnhanced(config.zhibianyiImg, 1, 1, 0); // 识别参量质变仪小道具
    if (!ZbyResult.found) {
        log.warn("质变仪CD中或未找到质变仪!");
        await keyPress("VK_ESCAPE"); // 关闭背包
        await sleep(500);
        return false;
    }
    await sleep(1000);
    await click(1699, 1004);    // 点击部署
    await sleep(1200);
    log.info("参量质变仪已部署");
    return true;
}

// ===== 交互参量质变仪，进入放入材料界面 =====
// 增强：OCR检测区域放大到屏幕中部，避免目标不在准星正中央时抓不到F提示；
// 每次锁定失败后转动视角约90°再重试（最多4个朝向覆盖360°），
// 解决路径终点落点有偏差、固定视角下 middleButtonClick 永远锁不到目标的问题
export async function enterMaterialPage() {
    for (let attempt = 1; attempt <= 4; attempt++) {
        if (attempt > 1) {
            // 交替按 D / A 转向约90°（450ms 时长可实测微调），换朝向重新锁定
            const turnKey = (attempt % 2 === 0) ? "D" : "A";
            await keyDown(turnKey);
            await sleep(450);
            await keyUp(turnKey);
            await sleep(600);
            log.info("已转动视角换朝向（第" + attempt + "次尝试）");
        }
        await middleButtonClick();   // 中键锁定参量质变仪
        await sleep(1000);
        let fFound = false;
        try {
            const fMenu = await textOCREnhanced("参量质变仪", 2, 0, 0, 0, 250, 1920, 550);
            fFound = fMenu.found;
        } catch (e) {
            log.warn("OCR检测F提示失败(可忽略): " + e.message);
        }
        if (fFound) {
            await keyPress("F");
            await sleep(1200);
            try {
                const startTransform = await textOCREnhanced("进行质变", 3, 0, 0, 1675, 994, 150, 50);
                if (startTransform.found) {
                    log.info("已进入放入材料界面");
                    return true;
                }
            } catch (e) {
                log.warn("OCR检测进行质变失败(可忽略): " + e.message);
            }
        }
        log.info("第" + attempt + "次交互未进入放入材料界面，重试");
        await sleep(1000);
    }
    log.warn("多次尝试后仍未进入放入材料界面");
    return false;
}

// ===== 检测质变是否完成并收取（OCR 检测结果文本）=====
export async function checkTransformDone() {
    const ocrRes = await textOCREnhanced("参量质变产生了以下物品", 0.7, 1, 0, 539, 251, 800, 425);
    if (ocrRes.found) {
        click(970, 760); // 点击确认收取
        await sleep(500);
        log.info("点击屏幕中心下方25%处确认画面切换");
        click(960, 810);
        await sleep(300);
        if (config.enableCooldown) {
            await writeLastTransformTime();
            log.info("已记录本次质变完成时间");
        }
        log.info("参量质变完成，已收取");
        return true;
    }
    return false;
}

// ===== 等待参量质变完成（OCR 检测结果文本）=====
export async function waitTransformer() {
    var startTime = new Date();
    while ((new Date() - startTime) < config.waitTimeout * 1000) {
        if (await checkTransformDone()) return true;
        await sleep(1500);
    }
    log.warn("等待参量质变完成超时");
    return false;
}

// ===== 分片等待指定毫秒，期间定期检查质变是否完成（完成则立即返回true）=====
export async function waitWithCheck(totalMs) {
    const stepMs = 2000;
    let waited = 0;
    while (waited < totalMs) {
        await sleep(stepMs);
        waited += stepMs;
        if (await checkTransformDone()) return true;
    }
    return false;
}
