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
    let previousNameList = [];  // 上一次识别到的文本列表
    let currentNameList = [];   // 当前识别到的文本列表

    let region = null;
    await drawBox(settings.debug,regionConfig,200,new Pen(Color.Cyan, 2))
    const mapRegion={
        x: 20+20,
        y: 148+150,
    }
    log.info(`move to {x}, {y}`, mapRegion.x, mapRegion.y)
    await moveMouseTo(mapRegion.x, mapRegion.y)
    try {
        do{
            // 捕获游戏区域并创建OCR识别对象
            region = captureGameRegion();
            let recognitionObject = RecognitionObject.Ocr(regionConfig.x, regionConfig.y, regionConfig.width, regionConfig.height);
            // 执行多目标OCR识别
            let resList = region.findMulti(recognitionObject);
            // if (!resList || !resList.length) {
            //     return jsonList;
            // }
            // 清空当前列表，准备收集本次识别结果
            currentNameList = [];
            // 遍历识别结果并匹配任务名称
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                log.debug(`[-]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
                // 记录本次识别到的原始文本，用于尾部对比
                currentNameList.push(res.text);
                let json = {
                    ok: false,
                    text: undefined
                };

                // 检查当前识别文本是否包含任一任务名称
                let matchedMission = null;
                for (const missionName of missionNameList) {
                    if (res.text.trim().includes(missionName)) {
                        matchedMission = missionName;
                       /* break;*/
                    }
                }

                if (matchedMission) {
                    log.debug(`识别成功=>${matchedMission}->${res.text}`);
                    json.ok = true;
                    json.text = res.text.trim();
                }

                jsonList.push(json);

            }
            // 判断是否到底：如果上一次列表存在，且当前列表最后一个元素与上一次列表最后一个元素相同，说明滚动后内容未变化
            if (previousNameList.length > 0 && currentNameList.length > 0 &&
                currentNameList[currentNameList.length - 1] === previousNameList[previousNameList.length - 1]) {
                log.info(`识别到相同结果，退出循环`);
                break;
            }

            // 保存当前列表为“上一次列表”，供下一次循环比较使用
            previousNameList = [...currentNameList];
            log.info(`鼠标滚轮滚动...`);
            // 滑动鼠标滚轮，继续查看下方内容
            for (let i = 0; i < 4; i++) {
                log.debug(`scroll ${i}`);
                await verticalScroll(-1);
            }
        } while (true); // 退出由break控制
    } catch (e) {
        log.error('OCR识别过程出错:', e.message);
        throw e;
    } finally {
        // 确保资源始终被释放
        if (region) {
            region.Dispose();
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