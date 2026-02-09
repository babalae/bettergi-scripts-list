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
/**
 * 获取当前日期的星期信息
 * @returns {Object} 返回包含星期数字和星期名称的对象
 */
async function getDayOfWeek() {
    // 获取当前日期对象
    const today = new Date();
    // 获取当前日期是星期几（0代表星期日，1代表星期一，以此类推）
    const day = today.getDay();
    // 创建包含星期名称的数组
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    let weekDay = `${weekDays[day]}`;

    log.debug(`今天是[{day}]`, day)
    log.debug(`今天是[{weekDays}]`, weekDay)
    // 返回包含星期数字和对应星期名称的对象
    return {
        day: day,
        dayOfWeek: weekDay
    }
}
const commonPath = 'assets/'
const commonMap = new Map([
    ['main_ui', {
        path: `${commonPath}`,
        name: 'paimon_menu',
        type: '.png',
    }],
    ['yue', {
        path: `${commonPath}`,
        name: 'yue',
        type: '.png',
    }],
    ['200', {
        path: `${commonPath}`,
        name: '200',
        type: '.png',
    }],
    ['add_button', {
        path: `${commonPath}`,
        name: 'add_button',
        type: '.jpg',
    }],
])
/**
 * 根据键值获取JSON路径
 * @param {string} key - 要查找的键值
 * @returns {any} 返回与键值对应的JSON路径值
 */
function getJsonPath(key) {
    return commonMap.get(key); // 通过commonMap的get方法获取指定键对应的值
}

// 判断是否在主界面的函数
const isInMainUI = () => {
    // let name = '主界面'
    let main_ui = getJsonPath('main_ui');
    // 定义识别对象
    let paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync(`${main_ui.path}${main_ui.name}${main_ui.type}`),
        0,
        0,
        genshinJson.width / 3.0,
        genshinJson.width / 5.0
    );
    let captureRegion = captureGameRegion();
    let res = captureRegion.find(paimonMenuRo);
    captureRegion.Dispose()
    return !res.isEmpty();
};

async function toMainUi() {
    let ms = 300
    let index = 1
    await sleep(ms);
    while (!isInMainUI()) {
        await sleep(ms);
        await genshin.returnMainUi(); // 如果未启用，则返回游戏主界面
        await sleep(ms);
        if (index > 3) {
            throwError(`多次尝试返回主界面失败`);
        }
        index += 1
    }

}
/**
 * 抛出错误函数
 * 该函数用于显示错误通知并抛出错误对象
 * @param {string} msg - 错误信息，将用于通知和错误对象
 */
function throwError(msg,isNotification=false) {
    // 使用notification组件显示错误通知
    // notification.error(`${msg}`);
    if (isNotification) {
        notification.error(`${msg}`);
    }
    // 抛出一个包含错误信息的Error对象
    throw new Error(`${msg}`);
}

export {
    ocrRegion,
    getDayOfWeek,
    getJsonPath,
    isInMainUI,
    toMainUi,
    throwError,
}