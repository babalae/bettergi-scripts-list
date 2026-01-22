const ocrRegionConfig = {
    mapMission: {x: 6, y: 8, width: 395, height: 977},//地图任务识别区域坐标和尺寸
}

/**
 * OCR地图任务识别函数
 * 通过OCR技术在游戏区域中识别指定的任务名称
 *
 * @param {string} missionName - 要识别的任务名称
 * @param {object} recognitionObject - OCR识别对象配置
 * @returns {boolean} - 识别成功返回true，失败返回false
 */
async function ocrMapMission(missionName, recognitionObject= ocrRegionConfig.mapMission) {
    let region = captureGameRegion()
    try {
        // 执行多目标OCR识别
        let resList = region.findMulti(recognitionObject);
        for (let i = 0; i < resList.count; i++) {
            let res = resList[i];
            log.debug(`[-]识别结果: ${res.text}, 原始坐标: x=${res.x}, y=${res.y},width:${res.width},height:${res.height}`);
            if (res.text.trim().includes(missionName)) {
                log.debug(`识别成功=>{0}->{1}`, missionName, res.text);
                return true
            }
        }
    } catch (e) {
        region.Dispose()
    }
    return false
}


// 通过地图识别任务

this.mapUtil = {
    ocrMapMission
}