
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
                    try {
                        tempRa.dispose();
                    } catch (e) {
                        log.debug(`释放临时截图失败（可能已释放）: ${e.message}`);
                    }
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
            try {
                tempRa.dispose();
            } catch (e) {
                log.debug(`释放临时截图失败（可能已释放）: ${e.message}`);
            }
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

// 定义一个异步函数来绘制红框并延时清除
async function drawAndClearRedBox(searchRegion, ra, delay = 500) {
    let drawRegion = null;
    try {
        // 创建绘制区域
        drawRegion = ra.DeriveCrop(
            searchRegion.x, searchRegion.y,
            searchRegion.width, searchRegion.height
        );
        drawRegion.DrawSelf("icon"); // 绘制红框
        
        // 等待指定时间
        await sleep(delay);
        
        // 清除红框 - 使用更可靠的方式
        if (drawRegion && typeof drawRegion.DrawSelf === 'function') {
            // 可能需要使用透明绘制来清除，或者绘制一个0大小的区域
            ra.DeriveCrop(0, 0, 0, 0).DrawSelf("icon");
        }
    } catch (e) {
        log.error("红框绘制异常：" + e.message);
    } finally {
        // 正确释放资源，如果dispose方法存在的话
        if (drawRegion && typeof drawRegion.dispose === 'function') {
            drawRegion.dispose();
        }
    }
}
