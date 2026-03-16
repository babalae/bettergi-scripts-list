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
/**
 * 获取当前日期的星期信息
 * @param {boolean} [calibrationGameRefreshTime=true] 是否进行游戏刷新时间校准
 * @returns {Object} 返回包含星期数字和星期名称的对象
 */
async function getDayOfWeek(calibrationGameRefreshTime = true) {
    // 获取当前日期对象
    let today = new Date();//4点刷新 所以要减去4小时
    if (calibrationGameRefreshTime) {
        today.setHours(today.getHours() - 4); // 减去 4 小
    }
    // 获取当前日期是星期几（0代表星期日，1代表星期一，以此类推）
    const day = today.getDay();
    // 创建包含星期名称的数组
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    let weekDay = `${weekDays[day]}`;

    log.debug(`今天是[{day}]`, day)
    log.debug(`今天是[{weekDays}]`, weekDay)
    // 返回包含星期数字和对应星期名称的对象
    return {
        day: day,
        dayOfWeek: weekDay
    }
}
export { findTextAndClick,getDayOfWeek}