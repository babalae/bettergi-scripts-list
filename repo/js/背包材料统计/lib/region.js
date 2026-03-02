
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

// 截图保存函数
function imageSaver(mat, saveFile) {
    // 获取当前时间并格式化为 "YYYY-MM-DD_HH-MM-SS"
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

    // 获取当前脚本所在的目录
    const scriptDir = getScriptDirPath();
    if (!scriptDir) {
        log.error("无法获取脚本目录");
        return;
    }

    // 构建完整的目标目录路径和文件名
    const savePath = `${scriptDir}/${saveFile}/screenshot_${timestamp}.png`;
    const tempFilePath = `${scriptDir}/${saveFile}`;

    // 检查临时文件是否存在，如果不存在则创建目录
    try {
        // 尝试读取临时文件
        file.readPathSync(tempFilePath);
        log.info("目录存在，继续执行保存图像操作");
    } catch (error) {
        log.error(`确保目录存在时出错: ${error}`);
        return;
    }

    // 保存图像
    try {
        mat.saveImage(savePath);
        // log.info(`图像已成功保存到: ${savePath}`);
    } catch (error) {
        log.error(`保存图像失败: ${error}`);
    }
}

// 获取脚本目录
function getScriptDirPath() {
    try {
        safeReadTextSync(`temp-${Math.random()}.txt`);
    } catch (e) {
        const match = e.toString().match(/'([^']+)'/);
        return match ? match[1].replace(/\\[^\\]+$/, "") : null;
    }
    return null;
}