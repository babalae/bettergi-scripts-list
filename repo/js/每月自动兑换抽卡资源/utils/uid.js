
async function saveOnlyNumber(str) {
    str = str ? str : '';
    // 使用正则表达式匹配字符串中的所有数字
    // \d匹配一个或多个数字
    // .join('') 将匹配到的数字数组连接成一个字符串
    // parseInt 将连接后的字符串转换为整数
    // return parseInt(str.match(/\d+/g).join(''));
    const matches = str.match(/\d+/g);
    if (!matches) {
        return 0; // 或抛出错误
    }
    return parseInt(matches.join(''), 10);
}
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
    let recognitionObjectOcr = RecognitionObject.Ocr(x, y, w, h);
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
        region3.dispose()
    }
}
/**
 * OCR识别UID的异步函数
 * 该函数用于通过OCR技术识别屏幕上特定位置的UID文本
 * @returns {Promise<number>} - 异步函数，没有明确的返回值
 */
async function ocrUid() {
    // 定义OCR识别的坐标和尺寸参数
    let uid_json = {
        x: 1683,        // OCR识别区域的左上角x坐标
        y: 1051,        // OCR识别区域的左上角y坐标
        width: 234,     // OCR识别区域的宽度
        height: 28,     // OCR识别区域的高度
    }
    let text = await ocrRegion(uid_json.x, uid_json.y, uid_json.width, uid_json.height);
    return await saveOnlyNumber(text);
}

export {
    ocrUid,
}
