const commonPath = 'assets/'
const commonMap = new Map([
    ['main_ui', {
        path: `${commonPath}`,
        name: 'paimon_menu',
        type: '.png',
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
    getJsonPath,
    isInMainUI,
    toMainUi,
    throwError,
}