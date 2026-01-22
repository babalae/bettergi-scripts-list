const ocrRegionConfig = {
    mapMission: {x: 6, y: 8, width: 395, height: 977},//地图任务识别区域坐标和尺寸
}


/**
 * OCR地图任务识别函数
 * 通过OCR技术识别游戏界面中的任务名称，并与预设的任务名称列表进行匹配
 * @param {Array<string>} [missionNameList=[]] - 需要识别的任务名称列表
 * @param {Object} [regionConfig=ocrRegionConfig.mapMission] - OCR识别区域配置对象，包含x、y、width、height属性
 * @returns {Promise<Array<Object>>} 返回识别结果数组，每个元素包含ok(boolean)和text(string)属性
 */
async function ocrMapMission(missionNameList = [], regionConfig = ocrRegionConfig.mapMission) {
    let jsonList = [];
    let region = null;

    try {
        // 捕获游戏区域并创建OCR识别对象
        region = captureGameRegion();
        let recognitionObject = RecognitionObject.Ocr(regionConfig.x, regionConfig.y, regionConfig.width, regionConfig.height);
        // 执行多目标OCR识别
        let resList = region.findMulti(recognitionObject);
        // if (!resList || !resList.length) {
        //     return jsonList;
        // }

        // 遍历识别结果并匹配任务名称
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            log.debug(`[-]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);

            let json = {
                ok: false,
                text: undefined
            };

            // 检查当前识别文本是否包含任一任务名称
            let matchedMission = null;
            for (const missionName of missionNameList) {
                if (res.text.trim().includes(missionName)) {
                    matchedMission = missionName;
                    break;
                }
            }

            if (matchedMission) {
                log.debug(`识别成功=>${matchedMission}->${res.text}`);
                json.ok = true;
                json.text = res.text.trim();
            }

            jsonList.push(json);
        }
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
async function openMap() {
    const key = settings.mapKey || 'M'
    await sleep(200)
    await keyPress(key)
}

async function mapMission(list = [], toOpenMap = true) {
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
    const uid = await uidUtil.ocrUID()
    let text = ""
    keyJsonList.forEach(item => text += "|< " + item.text + " >\n")
    await noticeUtil.sendText(text, `UID:${uid}\n地图任务`)
}

this.mapUtil = {
    mapMission,
    ocrMapMission,
    openMap,
}