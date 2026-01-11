let manifest = {};
async function init() {
    let utils=[
        "uid",
        "ws",
        "notice",
        "campaignArea",
        "activity",
    ]
    for (let util of utils) {
        eval(file.readTextSync(`utils/${util}.js`));
    }
    manifest = JSON.parse(file.readTextSync("manifest.json"));
    log.debug("main 初始化完成");
}
// 判断是否在主界面的函数
const isInMainUI = () => {
    let captureRegion = captureGameRegion();
    let res = captureRegion.Find(RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/paimon_menu.png"),
        0,
        0,
        640,
        216
    ));
    captureRegion.dispose();
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
            throw new Error(`多次尝试返回主界面失败`);
        }
        index += 1
    }
}

(async function () {
    await init();
    log.info(`版本:{version}`,manifest.version)
    if (settings.toMainUi){
        await toMainUi();
    }
    await main();
    await toMainUi();
})();

/**
 * @returns {Promise<void>}
 */
async function main() {
    await campaignAreaUtil.campaignAreaMain()
    await toMainUi()
    await activityUtil.activityMain()
}