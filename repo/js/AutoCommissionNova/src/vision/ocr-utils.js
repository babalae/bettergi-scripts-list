/**
 * BvPage 区域 OCR 识别
 *
 * 使用 BvPage 进行区域 OCR 识别，支持指定区域或全屏
 * 适用于需要高性能 OCR 识别的场景，不需要手动管理截图资源
 *
 * @param {Rect} rect - 区域（可选，默认全屏），类型为 OpenCvSharp.OpenCvSharp.Rect 实例
 * @returns {BvPageOcrResult} OCR 结果对象
 */
export function bvPageOcrRegion(rect) {
    const page = new BvPage();
    if (rect) {
        return page.Ocr(rect);
    }
    return page.Ocr();
}

/**
 * BvPage 区域 OCR 识别（返回第一个结果的文本）
 *
 * 对指定游戏区域进行 OCR 识别，仅返回第一个识别到的文本
 * 适用于只需要单个文本结果的场景
 *
 * @param {Rect} rect - 区域（可选，默认全屏），类型为 OpenCvSharp.OpenCvSharp.Rect 实例
 * @returns {string} 识别到的文本，未识别到返回空字符串
 */
export function bvPageOcrRegionText(rect) {
    const results = bvPageOcrRegion(rect);
    if (results.count > 0) {
        return results[0].text.trim();
    }
    return "";
}
