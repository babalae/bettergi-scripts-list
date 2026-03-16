/**
 * 通用找文本并点击（OCR）
 * @param {string} text 目标文本（单个文本）
 * @param {number} [x=0] OCR 区域左上角 X
 * @param {number} [y=0] OCR 区域左上角 Y
 * @param {number} [w=1920] OCR 区域宽度
 * @param {number} [h=1080] OCR 区域高度
 * @param {number} [attempts=5] OCR 尝试次数
 * @param {number} [interval=50] 每次 OCR 之间的等待间隔（毫秒）
 * @param {number} [preClickDelay=50] 点击前等待时间（毫秒）
 * @param {number} [postClickDelay=50] 点击后等待时间（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
async function findTextAndClick(
    text,
    x = 0,
    y = 0,
    w = 1920,
    h = 1080,
    attempts = 5,
    interval = 50,
    preClickDelay = 50,
    postClickDelay = 50
) {
    const keyword = text.toLowerCase();

    for (let i = 0; i < attempts; i++) {
        const gameRegion = captureGameRegion();
        try {
            const ro = RecognitionObject.Ocr(x, y, w, h);
            const results = gameRegion.findMulti(ro);

            for (let j = 0; j < results.count; j++) {
                const res = results[j];
                if (
                    res.isExist() &&
                    res.text &&
                    res.text.toLowerCase().includes(keyword)
                ) {
                    await sleep(preClickDelay);
                    res.click();
                    await sleep(postClickDelay);
                    return res;
                }
            }
        } finally {
            gameRegion.dispose();
        }

        await sleep(interval);
    }

    return null;
}

export { findTextAndClick}