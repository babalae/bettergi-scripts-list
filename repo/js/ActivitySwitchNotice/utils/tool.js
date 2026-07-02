/**
 * 通用找文本（OCR）
 * @param {string|string[]} text 目标文本（单个文本或文本列表，列表时需全部匹配）
 * @param {number} [x=0] OCR 区域左上角 X
 * @param {number} [y=0] OCR 区域左上角 Y
 * @param {number} [w=1920] OCR 区域宽度
 * @param {number} [h=1080] OCR 区域高度
 * @param {number} [attempts=5] OCR 尝试次数
 * @param {number} [interval=50] 每次 OCR 之间的等待间隔（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
export async function findText(
    text,
    x = 0,
    y = 0,
    w = 1920,
    h = 1080,
    attempts = 5,
    interval = 50
) {
    const keywords = (Array.isArray(text) ? text : [text])
        .map(t => t.toLowerCase());

    for (let i = 0; i < attempts; i++) {
        const gameRegion = captureGameRegion();
        try {
            const ro = RecognitionObject.Ocr(x, y, w, h);
            const results = gameRegion.findMulti(ro);

            for (let j = 0; j < results.count; j++) {
                const res = results[j];
                if (!res.isExist() || !res.text) continue;

                const ocrText = res.text.toLowerCase();
                const matched = keywords.every(k => ocrText.includes(k));
                if (matched) {
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
export async function findTextAndClick(
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
 * 通用找图/找RO（支持图片文件路径、Mat）
 * @param {string|Mat} target 图片路径或已构造的 Mat
 * @param {number} [x=0] 识别区域左上角 X
 * @param {number} [y=0] 识别区域左上角 Y
 * @param {number} [w=1920] 识别区域宽度
 * @param {number} [h=1080] 识别区域高度
 * @param {number} [timeout=1000] 识别时间上限（毫秒）
 * @param {number} [interval=50] 每次识别之间的等待间隔（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
export async function findImg(
    target,
    x = 0,
    y = 0,
    w = 1920,
    h = 1080,
    timeout = 1000,
    interval = 50
) {
    const ro =
        typeof target === 'string'
            ? RecognitionObject.TemplateMatch(
                file.readImageMatSync(target),
                x, y, w, h
            )
            : RecognitionObject.TemplateMatch(
                target,
                x, y, w, h
            );

    const start = Date.now();

    while (Date.now() - start <= timeout) {
        const gameRegion = captureGameRegion();
        try {
            const res = gameRegion.find(ro);
            if (!res.isEmpty()) {
                return res;
            }
        } catch (e) {
            log.error(e.toString());
        } finally {
            gameRegion.dispose();
        }

        await sleep(interval);
    }

    return null;
}


/**
 * 通用找图并点击（支持图片文件路径、Mat）
 * @param {string|Mat} target 图片路径或已构造的 Mat
 * @param {number} [x=0] 识别区域左上角 X
 * @param {number} [y=0] 识别区域左上角 Y
 * @param {number} [w=1920] 识别区域宽度
 * @param {number} [h=1080] 识别区域高度
 * @param {number} [timeout=1000] 识别时间上限（毫秒）
 * @param {number} [interval=50] 每次识别之间的等待间隔（毫秒）
 * @param {number} [preClickDelay=50] 点击前等待时间（毫秒）
 * @param {number} [postClickDelay=50] 点击后等待时间（毫秒）
 *
 * @returns
 * - RecognitionResult | null
 */
export async function findImgAndClick(
    target,
    x = 0,
    y = 0,
    w = 1920,
    h = 1080,
    timeout = 1000,
    interval = 50,
    preClickDelay = 50,
    postClickDelay = 50
) {
    const ro =
        typeof target === 'string'
            ? RecognitionObject.TemplateMatch(
                file.readImageMatSync(target),
                x, y, w, h
            )
            : RecognitionObject.TemplateMatch(
                target,
                x, y, w, h
            );

    const start = Date.now();

    while (Date.now() - start <= timeout) {
        const gameRegion = captureGameRegion();
        try {
            const res = gameRegion.find(ro);
            if (!res.isEmpty()) {
                await sleep(preClickDelay);
                res.click();
                await sleep(postClickDelay);
                return res;
            }
        } finally {
            gameRegion.dispose();
        }

        await sleep(interval);
    }

    return null;
}


/**
 * 使用OCR技术在指定区域内查找文本
 * @param {number} x - 区域左上角x坐标
 * @param {number} y - 区域左上角y坐标
 * @param {number} width - 区域宽度
 * @param {number} height - 区域高度
 * @returns {Promise<Region|null>} 返回找到的文本，如果没有找到则返回null
 */
export async function OcrFind(x, y, width, height) {
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    try {
        // 创建OCR识别对象，指定识别区域
        const recognitionObject = RecognitionObject.Ocr(x, y, width, height);
        // 在截图上执行OCR识别
        const result = captureRegion.find(recognitionObject);
        // 返回识别到的文本，如果未识别到则返回undefined
        return result
    } finally {
        // 确保截图资源被正确释放，防止内存泄漏
        if (captureRegion) {
            captureRegion.dispose(); // 释放截图资源
        }
    }
}

/**
 * 使用OCR技术在指定区域内查找文本内容
 * @param {number} x - 区域左上角x坐标
 * @param {number} y - 区域左上角y坐标
 * @param {number} width - 区域宽度
 * @param {number} height - 区域高度
 * @returns {Promise<Region[]>} 返回找到的文本内容数组
 */
export async function OcrFindList(x, y, width, height) {
    let captureRegion = captureGameRegion(); // 获取游戏区域截图
    try {
        // 创建OCR识别对象，指定识别区域
        const recognitionObject = RecognitionObject.Ocr(x, y, width, height);
        // 在截图区域中查找多个匹配项
        const resList = captureRegion.findMulti(recognitionObject);
        return resList // 返回找到的文本列表
    } finally {
        // 确保释放截图资源，防止内存泄漏
        if (captureRegion) {
            captureRegion.dispose(); // 释放截图资源
        }
    }
}

/**
 * 获取当前日期的星期信息
 * @param {boolean} [calibrationGameRefreshTime=true] 是否进行游戏刷新时间校准
 * @returns {Object} 返回包含星期数字和星期名称的对象
 */
export async function getDayOfWeek(calibrationGameRefreshTime = true) {
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

// 判断是否在主界面的函数
export const isInMainUI = () => {
    let captureRegion = captureGameRegion();

    try {
        const res = captureRegion.Find(RecognitionObject.TemplateMatch(
            file.ReadImageMatSync("assets/paimon_menu.png"),
            0,
            0,
            640,
            216
        ));
        return !res.isEmpty();
    } finally {
        if (captureRegion) {
            captureRegion.dispose();
        }
    }
};

export async function toMainUi() {
    let ms = 300
    let index = 1
    await sleep(ms);
    while (!isInMainUI()) {
        await sleep(ms);
        await genshin.returnMainUi(); // 如果未启用，则返回游戏主界面
        await sleep(ms);
        if (index > 3) {
            throw new Error(`多次尝试返回主界面失败`);
        }
        index += 1
    }
}


/**
 * 打开背包（检测过期物品）
 */
export async function openBag() {
    const openBagKey = settings.openBagKey || "B";
    await toMainUi();
    await keyPress(openBagKey);
    await sleep(500);
    const expiredText = await findText("物品过期", 870, 280, 170, 40, 2);
    if (expiredText) {
        log.info("检测到过期物品，关闭弹窗");
        await sleep(500);
        await click(980, 750);
    }
    await sleep(50);
}
