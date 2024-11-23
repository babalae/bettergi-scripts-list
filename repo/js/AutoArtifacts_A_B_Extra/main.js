(async function () {

    const folderA = 'assets/狗粮A线@Yang-z/';
    const folderB = 'assets/狗粮B线@Yang-z/';
    const folderE = 'assets/狗粮额外@Yang-z/';

    const pathingA = [
        "狗粮-璃月-珉林-北-5个.json",
        "狗粮-璃月-珉林-东北-9个.json",
        "狗粮-璃月-珉林-绝云间-3个.json",
        "（恢复）狗粮-璃月-琼玑野.json",
        "狗粮-璃月-琼玑野-绿华池-3个.json",
        "狗粮-璃月-碧水源-盐中之地-3个.json",
        "狗粮-须弥-道成林-化城郭-西-3个.json",
        "狗粮-须弥-二净甸-觉王之殿南-6个.json",
        "（恢复）狗粮-须弥-二净甸.json",
        "狗粮-须弥-失落的苗圃-南-8个.json",
        "狗粮-须弥-上风蚀地-东北营地-2个.json",
        "狗粮-须弥-下风蚀地-阿如村-4个.json",
        "狗粮-须弥-千壑沙地-塔尼特露营地-3个／5个.json",
        "狗粮-须弥-浮罗囿-甘露花海北-4个.json",
        "狗粮-纳塔-坚岩隘谷-回声之子南-4个／7个 .json",
        "狗粮-纳塔-万火之瓯-竞技场东-4个.json",
        "狗粮-纳塔-涌流地-流泉之众-4个.json",
        "（恢复）狗粮-纳塔-镜璧山.json",
        "狗粮-纳塔-镜璧山-南-9个.json",
        "狗粮-纳塔-翘枝崖-北-6个.json",
        "狗粮-纳塔-奥奇卡纳塔-七天神像-12个.json",
        "狗粮-纳塔-奥奇卡纳塔-托佐兹之岛-5个／6个.json",
        "（恢复）狗粮-稻妻-神无冢.json",
        "【收尾】狗粮-稻妻-神无冢-踏鞴砂-21个.json",
        "（恢复）狗粮-须弥-二净甸.json",
    ]; // 97+21个

    const pathingB = [
        "狗粮-枫丹-白露区-秋分山东侧-2个.json",
        "狗粮-枫丹-白露区-秋分山西侧-北-2个.json",
        "狗粮-枫丹-莫尔泰区-七天神像-1个.json",
        "狗粮-枫丹-伊黎耶林区-欧庇克莱歌剧院东南-2个.json",
        "狗粮-枫丹-研究院区-东-3个.json",
        "（恢复）狗粮-枫丹-研究院区.json",
        "狗粮-枫丹-研究院区-学术会堂-1个／2个.json",
        "狗粮-枫丹-研究院区-中央实验室遗址-北侧屋内-4个.json",
        "狗粮-枫丹-研究院区-新枫丹科学院-东南侧-8个.json",
        "狗粮-枫丹-研究院区-西南偏南-6个.json",
        "狗粮-枫丹-研究院区-西南偏西-4个.json",
        "狗粮-枫丹-研究院区-西北-6个／7个.json",
        "（恢复）狗粮-枫丹-黎翡区.json",
        "狗粮-枫丹-黎翡区-七天神像-5个.json",
        "狗粮-枫丹-黎翡区-芒索斯山东-3个.json",
        "狗粮-稻妻-神无冢-堇色之庭-4个.json",
        "狗粮-稻妻-神无冢-九条阵屋-3个.json",
        "狗粮-稻妻-神无冢-无相之火-4个／5个.json",
        "狗粮-稻妻-神无冢-东-5个／6个.json",
        "（恢复）狗粮-稻妻-神无冢.json",
        "狗粮-稻妻-海祇岛-东方小岛-2个.json",
        "狗粮-稻妻-海祇岛-珊瑚宫东北-6个.json",
        "狗粮-稻妻-海祇岛-望泷村西南-4个.json",
        "狗粮-稻妻-清籁岛-浅濑神社-3个.json",
        "狗粮-稻妻-清籁岛-越石村-8个.json",
        "狗粮-稻妻-清籁岛-平海砦西-8个.json",
        "狗粮-稻妻-鹤观-东-3个.json",
        "（恢复）狗粮-稻妻-清籁岛.json",
        "【收尾】狗粮-稻妻-清籁岛-清籁丸-20个.json",
        "（恢复）狗粮-稻妻-清籁岛.json",
    ]; // 97+20个

    const pathingE = [
        "【额外】狗粮-纳塔+7个.json", // 凌晨刷新
        "【额外】狗粮-须弥-水天丛林+7个.json", // 24小时刷新
        "【额外】狗粮-枫丹-研究院区-新枫丹科学院周边+3个.json" // 24小时刷新
    ]; // 17个（其中纳塔第2个似乎是一次性的）


    let tryTimes = 2; // 尝试次数
    function updateTryTimes() {
        try {
            tryTimes = ~~settings.tryTimes ? ~~settings.tryTimes : 2;
        } catch (error) {
            log.error(error.toString());
        }
        log.debug(`全局尝试次数：${tryTimes}`);
    }

    let path = ''; // 路线
    function determinePath() {
        try {
            path = settings.path;
        } catch (error) {
            log.error(error.toString());
        }

        if (path != 'A' && path != 'B') {
            const benchmark = new Date("2024-11-20T04:00:00");
            const now = new Date();
            const delta = now - benchmark;
            const days = delta / (1000 * 60 * 60 * 24);
            path = days % 2 < 1 ? 'A' : 'B';
        }
    }

    // 准备
    async function init() {
        // restore and alignment
        await genshin.tp("253.146484375", "1285.14306640625"); await sleep(3000);

        // zoom map to 75%
        keyPress("M"); await sleep(1000);
        for (let i = 0; i < 5; i++) {
            click(42, 420); await sleep(500); // zoom in
        }
        click(42, 645); await sleep(1000); // zoom out
        keyPress("M"); await sleep(1000);
    }

    // 分解圣遗物
    async function salvage() {
        keyPress("B"); await sleep(2000);
        click(670, 40); await sleep(1000); // 圣遗物
        click(660, 1010); await sleep(1000); // 分解
        click(300, 1020); await sleep(1000); // 快速选择

        click(200, 150); await sleep(500); // 1
        click(200, 220); await sleep(500); // 2
        click(200, 300); await sleep(500); // 3
        // click(200, 380); await sleep(3000); // 4

        click(340, 1000); await sleep(1000); // 确认选择
        click(1720, 1015); await sleep(1500); // 分解
        click(1180, 750); await sleep(1000); // 进行分解

        click(1840, 45); await sleep(1500); // 取消
        click(1840, 45); await sleep(1000); // 取消
        click(1840, 45); await sleep(1000); // 取消
    }

    // 单一脚本执行
    async function runFile(filePath, times = tryTimes) {
        log.info(filePath);
        try {
            times--;
            await pathingScript.runFile(filePath);
        }
        catch (error) {
            log.error(error.toString());
            await sleep(3000);
            if (times > 0) await runFile(filePath, times);
        }
    }

    // 批量执行
    async function batch(folder, files, forceInteraction = false) {
        // 打开自动拾取
        dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": forceInteraction }));

        for (let i = 0; i < files.length; i++) {
            if (i % 10 == 0) await salvage();
            const filePath = folder + files[i];
            await runFile(filePath);
        }
    }

    // main
    updateTryTimes();
    determinePath();
    await init();

    // A or B
    log.info(`开始执行${path}线路。`);
    if (path == 'A') await batch(folderA, pathingA);
    else await batch(folderB, pathingB);

    // Extra
    log.info(`开始执行额外线路。`);
    await batch(folderE, pathingE, true); // 强制交互

    log.info(`今日狗粮拾取任务完成。拾取路线：${path}+E`);
    await sleep(3000);

})();