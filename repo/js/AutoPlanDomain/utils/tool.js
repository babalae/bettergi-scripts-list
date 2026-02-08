/**
 * 对指定区域进行OCR文字识别
 * @param {number} x - 区域左上角x坐标，默认为0
 * @param {number} y - 区域左上角y坐标，默认为0
 * @param {number} w - 区域宽度，默认为1920
 * @param {number} h - 区域高度，默认为1080
 * @returns {Promise<string|null>} 返回识别到的文本内容，如果识别失败则返回null
 */
async function ocrRegion(x = 0,
                         y = 0,
                         w = 1920,
                         h = 1080) {
    // 创建OCR识别对象，使用指定的坐标和尺寸
    let recognitionObjectOcr = RecognitionObject.Ocr(x, y, w,h);
    // 捕获游戏区域图像
    let region3 = captureGameRegion()
    try {
        // 在捕获的区域中查找OCR识别对象
        let res = region3.find(recognitionObjectOcr);
        // 返回识别到的文本内容，如果不存在则返回undefined
        return res?.text
    } catch (e) {
        // 捕获并记录错误信息
        log.error("识别异常:{1}", e.message)
        return null
    } finally {
        // 确保释放区域资源
        region3.Dispose()
    }
}

export {
    ocrRegion
}