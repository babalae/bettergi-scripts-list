
// ###########################################################################
// 【核心工具函数】
// ###########################################################################

var globalLatestRa = null;
async function recognizeImage(
    recognitionObject, 
    ra, 
    timeout = 1000, 
    interval = 500, 
    useNewScreenshot = false, 
    iconType = null
) {
    let startTime = Date.now();
    globalLatestRa = ra; 
    const originalRa = ra; 
    let tempRa = null; // 用于管理临时创建的资源

    try {
        while (Date.now() - startTime < timeout) {
            let currentRa;
            if (useNewScreenshot) {
                // 释放之前的临时资源
                if (tempRa) {
                    tempRa.dispose();
                }
                tempRa = captureGameRegion();
                currentRa = tempRa;
                globalLatestRa = currentRa;
            } else {
                // 不使用新截图时直接使用原始ra，不重复释放
                currentRa = originalRa;
            }

            if (currentRa) {
                try {
                    const result = currentRa.find(recognitionObject);
                    if (result.isExist() && result.x !== 0 && result.y !== 0) {
                        return {
                            isDetected: true,
                            iconType: iconType,
                            x: result.x,
                            y: result.y,
                            width: result.width,
                            height: result.height,
                            ra: globalLatestRa,
                            usedNewScreenshot: useNewScreenshot
                        };
                    }
                } catch (error) {
                    log.error(`【${iconType || '未知'}识别异常】: ${error.message}`);
                }
            }

            await sleep(interval);
        }
    } finally {
        // 释放临时资源但保留全局引用的资源
        if (tempRa && tempRa !== globalLatestRa) {
            tempRa.dispose();
        }
    }

    return {
        isDetected: false,
        iconType: iconType,
        x: null,
        y: null,
        width: null,
        height: null,
        ra: globalLatestRa,
        usedNewScreenshot: useNewScreenshot
    };
}
