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
    ['out_domain', {
        path: `${commonPath}`,
        name: 'out_domain',
        type: '.jpg',
    }],
])
const genshinJson = {
    width: 1920,//genshin.width,
    height: 1080,//genshin.height,
}

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
    try {
        let res = captureRegion.find(paimonMenuRo);
        return !res.isEmpty();
    } finally {
        captureRegion.dispose()
    }

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

const isInOutDomainUI = async () => {
    // // let name = '主界面'
    // let main_ui = getJsonPath('out_domain');
    // // 定义识别对象
    // let paimonMenuRo = RecognitionObject.TemplateMatch(
    //     file.ReadImageMatSync(`${main_ui.path}${main_ui.name}${main_ui.type}`),
    //     0,
    //     0,
    //     genshinJson.width / 3.0,
    //     genshinJson.width / 5.0
    // );
    // let captureRegion = captureGameRegion();
    // try {
    //     let res = captureRegion.find(paimonMenuRo);
    //     return !res.isEmpty();
    // }finally {
    //     captureRegion.dispose()
    // }
    //509, 259, 901, 563
    const text = "退出秘境";
    const ocrRegion = {
        x: 509,
        y: 259,
        w: 901,
        h: 563
    }
    const find = await findText(text, ocrRegion.x, ocrRegion.y, ocrRegion.w, ocrRegion.h)
    log.debug("识别结果:{1}", find)
    return find && find.includes(text)
};

/**
 * 退出秘境的UI处理函数
 * 该函数用于处理退出秘境界面的相关操作，包括点击确认按钮和检测界面状态
 */
async function outDomainUI() {
    log.info(`{0}`,"退出秘境");
    const ocrRegion = {
        x: 509,
        y: 259,
        w: 901,
        h: 563
    }
    let ms = 300
    let index = 1
    let tryMax = false
    let inMainUI = false
    await sleep(ms);
    //点击确认按钮
    await findTextAndClick('地脉异常')
    await sleep(ms);
    while (!await isInOutDomainUI()) {
        if (isInMainUI()) {
            inMainUI = true
            break
        }
        await sleep(ms);
        await keyPress("ESCAPE");
        await sleep(ms * 2);
        if (index > 3) {
            log.error(`多次尝试匹配退出秘境界面失败 假定已经退出处理`);
            tryMax = true
            break
        }
        index += 1
    }
    if ((!tryMax) && (!inMainUI) && await isInOutDomainUI()) {
        try {
            //点击确认按钮
            await findTextAndClick('确认', ocrRegion.x, ocrRegion.y, ocrRegion.w, ocrRegion.h)
        } catch (e) {
            // log.error(`多次尝试点击确认失败 假定已经退出处理`);
        }
    }


}

/**
 * 在指定区域内查找文本内容
 * @param {string} text - 要查找的文本内容
 * @param {number} x - 查找区域的左上角x坐标，默认为0
 * @param {number} y - 查找区域的左上角y坐标，默认为0
 * @param {number} w - 查找区域的宽度，默认为1920
 * @param {number} h - 查找区域的高度，默认为1080
 * @param {number} attempts - 尝试查找的次数，默认为5
 * @param {number} interval - 每次尝试之间的间隔时间(毫秒)，默认为50
 * @returns {Promise<string>} 返回找到的文本内容，如果未找到则返回空字符串
 */
async function findText(
    text,
    x = 0,
    y = 0,
    w = 1920,
    h = 1080,
    attempts = 5,
    interval = 50,
) {
    const keyword = text.toLowerCase(); // 将搜索关键字转换为小写，实现不区分大小写的搜索

    for (let i = 0; i < attempts; i++) { // 循环尝试查找文本，最多尝试attempts次
        const gameRegion = captureGameRegion(); // 捕获游戏区域图像
        try {
            const ro = RecognitionObject.Ocr(x, y, w, h); // 创建OCR识别对象，指定识别区域
            const results = gameRegion.findMulti(ro); // 在区域内查找所有匹配的文本

            // 遍历查找结果
            for (let j = 0; j < results.count; j++) {
                const res = results[j];
                // 检查结果是否存在、包含文本内容，并且文本包含搜索关键字
                if (
                    res.isExist() &&
                    res.text &&
                    res.text.toLowerCase().includes(keyword)
                ) {
                    return res.text; // 找到匹配文本，直接返回
                }
            }
        } finally {
            gameRegion.dispose(); // 确保释放游戏区域资源
        }

        await sleep(interval); // 等待指定的时间后进行下一次尝试
    }

    return ""; // 未找到匹配文本，返回空字符串
}

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
 * 抛出错误函数
 * 该函数用于显示错误通知并抛出错误对象
 * @param {string} msg - 错误信息，将用于通知和错误对象
 */
function throwError(msg, isNotification = false) {
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
    isInOutDomainUI,
    outDomainUI,
    findTextAndClick,
    throwError,
}