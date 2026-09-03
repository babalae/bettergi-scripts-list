/**
 * 抛出错误函数
 * 该函数用于显示错误通知并抛出错误对象
 * @param {string} msg - 错误信息，将用于通知和错误对象
 */
export function throwError(msg, isNotification = false) {
    // 使用notification组件显示错误通知
    // notification.error(`${msg}`);
    if (isNotification) {
        notification.error(`${msg}`);
    }
    // 抛出一个包含错误信息的Error对象
    throw new Error(`${msg}`);
}

/**
 * UI工具类
 */
export class UI {
    /**
     * 检查当前是否在主界面
     * @returns {boolean} 如果在主界面则返回true，否则返回false
     */
    static isInMainUI() {
        // let name = '主界面'  // 注释掉的变量定义，可能是用于调试的临时变量
        let main_ui = 'assets/ui/main_ui.png';  // 获取主界面的配置信息，包括路径、名称和类型
        // 定义识别对象，使用模板匹配方法来检测主界面特征
        let paimonMenuRo = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(`${main_ui}`),  // 读取模板图片
            0,  // 起始点x坐标
            0,  // 起始点y坐标
            1980 / 3.0,  // 匹配区域的宽度
            1080 / 5.0   // 匹配区域的高度
        );
        let captureRegion = captureGameRegion();  // 获取游戏区域的截图
        try {
            // 在捕获的区域中查找模板匹配的结果
            let res = captureRegion.find(paimonMenuRo);
            return !res.isEmpty();  // 如果找到匹配项则返回true，否则返回false
        } finally {
            // 确保释放资源
            captureRegion.dispose()
        }
    }

    static async toMainUi() {
        let ms = 300
        let index = 1
        await sleep(ms);
        while (!UI.isInMainUI()) {
            await sleep(ms);
            await genshin.returnMainUi(); // 如果未启用，则返回游戏主界面
            await sleep(ms);
            if (index > 3) {
                throwError(`多次尝试返回主界面失败`);
            }
            index += 1
        }
    }
}

/**
 * 红框工具类
 */
export class Box {
    /**
     *
     * @param {boolean} show - 是否显示调试信息
     * @param {Object} result - 目标区域坐标对象，包含 x、y、width、height 属性
     * @param {number} [delay=1000] - 红框显示的延时（毫秒），默认1000ms
     * @param {Pen} [pen=new Pen(Color.Red, 2)] - 红框的画笔对象，默认红色实线
     * @returns {Promise<void>}
     */
    static async draw(show = true, result, delay = 1000, pen) {
        if (!pen) pen = new Pen(Color.Red, 2);
        if (show) {
            await Box.drawAndClear(result, delay, pen);
        }
    }
    /**
     * 在游戏画面上绘制红框并在延时后自动清除
     * 通过截取游戏区域并绘制图标来实现红框标记效果，延时结束后通过重绘同一区域来清除红框
     * @param {Object} result - 目标区域坐标对象，包含 x、y、width、height 属性
     * @param {number} [delay=1000] - 红框显示的延时（毫秒），默认1000ms
     * @param {Pen} [pen=new Pen(Color.Red, 2)] - 红框的画笔对象，默认红色实线
     * @returns {Promise<void>}
     */
    static async drawAndClear(result, delay = 1000, pen) {
        if (!pen) pen = new Pen(Color.Red, 2);

        const ro1 = captureGameRegion();
        try {
            const drawRegion = ro1.DeriveCrop(result.x, result.y, result.width, result.height);
            drawRegion.DrawSelf("icon", pen);
        } finally {
            ro1.dispose();
        }

        await sleep(delay);

        const ro2 = captureGameRegion();
        try {
            const drawRegion2 = ro2.DeriveCrop(result.x, result.y, result.width, result.height);
            try {
                drawRegion2.DrawSelf("icon", pen);
            } finally {
                drawRegion2.dispose();
            }
        } finally {
            ro2.dispose();
        }
    }
}

/**
 * 日志工具类
 */
export class Log{
    static info(message, ...args){
        log.info(message, ...args)
    }
    static error(message, ...args){
        log.error(message, ...args)
    }
    static debug(message, ...args){
        if (settings.debug){
            log.info(`[开发模式] [Debug] ${message}`, ...args)
        }else {
            log.debug(message, ...args)
        }
    }
    static warn(message, ...args){
        log.warn(message, ...args)
    }
}

/**
 * 格式化工具类
 */
export class Format{
    /**
     * 字符串格式化函数，支持类似C语言的格式化占位符
     * @param {string} format - 格式化字符串，包含%占位符
     * @param {...*} args - 可变参数，用于替换格式化字符串中的占位符
     * @returns {string} 格式化后的字符串
     */
    static async String(format, ...args) {
        let argIndex = 0; // 当前使用的参数索引
        // 使用正则表达式匹配格式化占位符，如%s, %d, %f等
        return format.replace(/%(\d*\.?\d*[sdf%])/g, (match, pattern) => {
            // 如果匹配到的是%%，则返回%
            if (pattern === '%') return '%';
            // 如果参数已用完，返回原始匹配字符串
            if (argIndex >= args.length) return match;

            // 获取当前参数
            const val = args[argIndex++];
            // 获取格式化类型（s, d, f）
            const type = pattern.slice(-1);
            // 获取数字格式（如%.2f中的2）
            const numPattern = pattern.slice(0, -1);

            // 根据类型进行格式化
            switch (type) {
                case 's':
                    return String(val);
                case 'd':
                    return parseInt(val).toString();
                case 'f':
                    const dotIdx = numPattern.indexOf('.');
                    const fixed = dotIdx > -1 ? Number(numPattern.slice(dotIdx + 1)) : 6;
                    return Number(val).toFixed(fixed);
                default:
                    return match;
            }
        });
    }
}

/**
 * 找图找文本工具类
 */
export class Find{
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
    static async  findTextAndClick(
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
    static async findImgAndClick(
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
}

/**
 * HTTP请求工具类
 */
export class Http{
    /**
     * 构造查询参数
     * @param json
     * @returns {Promise<string>}
     */
    static async buildParams(json){
        const paramsMap = new Map(Object.entries(json));
        // 遍历 Map 构造查询参数
        let queryString = '';
        paramsMap.forEach((value, key) => {
            if (value !== undefined) {
                queryString += `${key}=${value}&`;
            }
        });
        // 去掉末尾多余的 &
        queryString = queryString.slice(0, -1);
        return queryString;
    }

    /**
     * 发送GET请求
     * @param url
     * @param params
     * @param headersJson
     * @returns {status_code:number,body:object}
     */
    static async get(url, params={}, headersJson) {
        const method = 'GET';
        const queryString = await Http.buildParams(params);
        url += '?' + queryString;
        return Http.request(method, url, null, headersJson)
    }

    /**
     * 发送POST请求
     * @param url
     * @param body
     * @param headersJson
     * @returns {status_code:number,body:object}
     */
    static async post(url, body={}, headersJson) {
        const method = 'POST';
        return Http.request(method, url, body, headersJson)
    }

    /**
     * 发送PUT请求
     * @param url
     * @param body
     * @param headersJson
     * @returns {status_code:number,body:object}
     */
    static async put(url, body={}, headersJson) {
        const method = 'PUT';
        return Http.request(method, url, body, headersJson)
    }

    /**
     * 发送DELETE请求
     * @param url
     * @param params
     * @param headersJson
     * @returns {status_code:number,body:object}
     */
    static async delete(url, params={}, headersJson) {
        const method = 'DELETE';
        const queryString = await Http.buildParams(params);
        url += '?' + queryString;
        return Http.request(method, url, null, headersJson)
    }

    /**
     * 发送HTTP请求
     * @param method
     * @param url
     * @param body
     * @param headersJson
     * @returns {Promise<http.Response>}
     */
    static async request(method, url, body, headersJson) {
        return http.request(method, url, body, headersJson)
    }
}