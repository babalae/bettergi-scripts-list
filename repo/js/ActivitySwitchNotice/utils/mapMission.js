const ocrRegionConfig = {
    mapMission: {x: 6, y: 8, width: 395, height: 977},//地图任务识别区域坐标和尺寸
}


async function ocrMapMission(missionNameList = [], recognitionObject = ocrRegionConfig.mapMission) {
    let jsonList = []
    let region = captureGameRegion()
    try {
        // 执行多目标OCR识别
        let resList = region.findMulti(recognitionObject);
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            log.debug(`[-]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
            let json = {
                ok: false,
                text: undefined
            }
            if (missionNameList.some(missionName => res.text.trim().includes(missionName))) {
                const missionName = missionNameList.find(missionName => res.text.trim().includes(missionName));
                log.debug(`识别成功=>{0}->{1}`, missionName, res.text);
                json.ok = true
                json.text = res.text.trim()
            }
        }
    } catch (e) {
        region.Dispose()
    }
    return jsonList
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
    const keyJsonList = (await ocrMapMission(list))?.filter(item => item.ok);
    if (keyJsonList.length == 0) {
        log.warn(`未识别到地图任务`)
        return
    }
    let text = ""
    keyJsonList.forEach(item => text += "\n|< " + item.text + " >")
    await noticeUtil.sendText(text, "地图任务")
}

this.mapUtil = {
    mapMission,
    ocrMapMission,
    openMap,
}