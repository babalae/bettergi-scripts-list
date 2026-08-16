import {sendText} from "./notice";
import {drawBox, toMainUi} from "./tool";
const ocrRegionConfig = {
    mapMission: {x: 6, y: 8, width: 395, height: 977},//地图任务识别区域坐标和尺寸
}


/**
 * OCR地图任务识别函数
 * 通过OCR技术识别游戏界面中的任务名称，并与预设的任务名称列表进行匹配
 * @param {Array<string>} [missionNameList=[]] - 需要识别的任务名称列表toMainUi
 * @param {Object} [regionConfig=ocrRegionConfig.mapMission] - OCR识别区域配置对象，包含x、y、width、height属性
 * @returns {Promise<Array<Object>>} 返回识别结果数组，每个元素包含ok(boolean)和text(string)属性
 */
export async function ocrMapMission(missionNameList = [], regionConfig = ocrRegionConfig.mapMission) {
    let jsonList = [];

    await drawBox(settings.debug,regionConfig,200,new Pen(Color.Cyan, 2))
    const mapRegion={
        x: 20+20,
        y: 148+150,
    }
    log.info(`move to {x}, {y}`, mapRegion.x, mapRegion.y)
    await moveMouseTo(mapRegion.x, mapRegion.y)
// ==================== 循环前需定义的变量 ====================
    let previousPageNames = new Set();   // 上一页识别到的所有文本
    let scannedPages = 0;
    const maxPages = 25;                 // 安全上限，防止死循环
    const overlapThreshold = 1;        // 重合率阈值，超过视为重复页

// ==================== 主循环 ====================
    while (scannedPages < maxPages) {
        await sleep(200);
        scannedPages++;
        log.info(`正在扫描第 {scannedPages} 页`, scannedPages);

        let region = null;
        try {
            // 捕获游戏区域并创建OCR识别对象
            region = captureGameRegion();
            let recognitionObject = RecognitionObject.Ocr(
                regionConfig.x, regionConfig.y,
                regionConfig.width, regionConfig.height
            );
            // 执行多目标OCR识别
            let resList = region.findMulti(recognitionObject);

            // 如果本页没有识别到任何文本，说明可能已到底部
            if (!resList || resList.count === 0) {
                log.info("当前页未识别到任何内容，视为已到页面底部");
                break;
            }

            // 收集本页所有识别文本
            const currentPageNames = new Set();
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                currentPageNames.add(res.text.trim());
            }

            // 计算与上一页的重合率，判断是否为重复页
            if (previousPageNames.size > 0) {
                let overlapCount = 0;
                for (let name of currentPageNames) {
                    if (previousPageNames.has(name)) overlapCount++;
                }
                const overlapRatio = overlapCount / previousPageNames.size;

                if (overlapRatio >= overlapThreshold) {
                    log.info(`检测到当前页与上一页高度重复（重合率 ${Math.round(overlapRatio * 100)}%），已到底部，停止扫描`);
                    break;
                }
            }

            // 更新上一页记录
            previousPageNames = currentPageNames;
            log.debug(`当前页识别到的任务名称: {currentPageNames}`,Array.from(currentPageNames).join(", "));
            // 遍历识别结果，匹配任务名称并生成 jsonList
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                log.debug(`[-]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y}, width:${res.width}, height:${res.height}`);

                let json = { ok: false, text: undefined };

                // 检查当前识别文本是否包含任一任务名称
                let matchedMission = null;
                for (const missionName of missionNameList) {
                    if (res.text.trim().includes(missionName)) {
                        matchedMission = missionName;
                        // 注意：此处未 break，会匹配最后一个符合条件的任务名，可根据需求调整
                    }
                }

                if (matchedMission) {
                    log.debug(`识别成功=>${matchedMission}->${res.text}`);
                    json.ok = true;
                    json.text = res.text.trim();
                }
                // 去重：如果列表中不存在相同 text 的项，才添加
                const isExist = jsonList.some(item => item.text === json.text);
                if (!isExist) {
                    jsonList.push(json);
                }
            }

            // 向下滚动一页（一次滚动4格）
            log.info("鼠标滚轮向下滚动4格...");
            for (let i = 0; i <4 ; i++) {
                await verticalScroll(-1);
                await sleep(2);
            }
             // 等待页面稳定（可根据实际情况调整）

        } finally {
            if (region) {
                region.dispose();   // 释放截图资源
            }
        }
    }

    return jsonList;
}


//伴月纪闻任务待完成
// 通过地图识别任务
export async function openMap() {
    const key = settings.mapKey || 'M'
    await sleep(200)
    await keyPress(key)
}

export async function mapMission(list = [], toOpenMap = true) {
    let ms = 600
    if (toOpenMap) {
        await openMap();
        await sleep(ms);
    }
    await sleep(ms * 2);
    let keyJsonList = await ocrMapMission(list);
    keyJsonList = keyJsonList.filter(item => item.ok)
    log.info(`识别到地图任务数量:${keyJsonList.length}`)
    if (keyJsonList.length <= 0) {
        log.warn(`未识别到地图任务`)
        return
    }

    await toMainUi()
    let uid = await genshin.uid()
    let text = ""
    keyJsonList.forEach(item => text += "|< " + item.text + " >\n")
    await sendText(text, `UID:${uid}\n地图任务`)
}


// export {
//     mapMission,
//     ocrMapMission,
//     openMap,
// }