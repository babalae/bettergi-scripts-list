import {ocrRegion} from './tool.js'

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
