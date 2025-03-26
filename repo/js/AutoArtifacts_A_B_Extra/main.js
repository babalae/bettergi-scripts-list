(async function () {

    const folderA = 'assets/狗粮A线@Yang-z/';
    const folderB = 'assets/狗粮B线@Yang-z/';
    const folderE = 'assets/狗粮额外@Yang-z/';

    const pathingA = [
        "狗粮-蒙德-龙脊雪山-西-3个-f.json",
        "狗粮-璃月-碧水源-盐中之地-3个-f.json",
        "狗粮-璃月-珉林-东北-9个-f.json",
        "狗粮-璃月-珉林-北-5个.json",
        "狗粮-璃月-珉林-奥藏山南-2个／3个-f.json",
        "狗粮-璃月-珉林-绝云间-3个-m.json",
        "（恢复）狗粮-璃月-琼玑野.json",
        "狗粮-璃月-琼玑野-绿华池-3个-f.json",
        "狗粮-须弥-须弥城-4个.json",
        "狗粮-须弥-二净甸-七天神像-4个／8个.json",
        "狗粮-须弥-二净甸-觉王之殿南-6个／7个-f.json",
        "（恢复）狗粮-须弥-失落的苗圃.json",
        "狗粮-须弥-失落的苗圃-南-8个-f.json",
        "狗粮-纳塔-万火之瓯-竞技场东-2个／4个-f.json",
        "狗粮-纳塔-涌流地-流泉之众-4个.json",
        "（恢复）狗粮-纳塔-涌流地.json",
        "狗粮-纳塔-镜璧山-南-9个-f.json",
        "狗粮-纳塔-镜璧山-七天神像下-3个-f.json",
        "狗粮-纳塔-翘枝崖-北-6个-f.json",
        "狗粮-纳塔-奥奇卡纳塔-七天神像-14个.json",
        "狗粮-纳塔-奥奇卡纳塔-流灰之街-4个-f.json",
        "狗粮-纳塔-奥奇卡纳塔-托佐兹之岛-6个-f.json",
        "（恢复）狗粮-稻妻-神无冢.json",
        "【收尾】狗粮-稻妻-神无冢-踏鞴砂①-6个／21个-f.json",
        "【收尾】狗粮-稻妻-神无冢-踏鞴砂②-7个／21个-f.json",
        "【收尾】狗粮-稻妻-神无冢-踏鞴砂③-8个／21个-f.json"
    ]; // 98+21个

    const pathingB = [
        "狗粮-枫丹-枫丹庭区-3个.json",
        "狗粮-枫丹-白露区-秋分山东侧-2个-f~m.json",
        "狗粮-枫丹-伊黎耶林区-欧庇克莱歌剧院东南-2个-f.json",
        "（恢复）狗粮-枫丹-研究院区.json",
        "狗粮-枫丹-研究院区-学术会堂-1个／2个-f.json",
        "狗粮-枫丹-研究院区-中央实验室遗址-北侧屋内-4个.json",
        "狗粮-枫丹-研究院区-新枫丹科学院-东南侧-8个-f.json",
        "狗粮-枫丹-研究院区-西南偏南-6个-m-f.json",
        "狗粮-枫丹-研究院区-西南偏西-4个-f.json",
        "狗粮-枫丹-研究院区-西北-6个／7个.json",
        "狗粮-枫丹-研究院区-中部塔内-9个.json",
        "（恢复）狗粮-枫丹-黎翡区.json",
        "狗粮-枫丹-黎翡区-七天神像-3个／5个.json",
        "狗粮-枫丹-黎翡区-芒索斯山东-3个-f.json",
        "狗粮-稻妻-神无冢-堇色之庭-4个.json",
        "狗粮-稻妻-神无冢-九条阵屋-2个／3个-f.json",
        "狗粮-稻妻-神无冢-东-5个／6个-f.json",
        "（恢复）狗粮-稻妻-神无冢.json",
        "狗粮-稻妻-海祇岛-东方小岛-2个-f.json",
        "狗粮-稻妻-海祇岛-珊瑚宫东北-6个-f.json",
        "狗粮-稻妻-海祇岛-望泷村西南-4个-f.json",
        "狗粮-稻妻-清籁岛-浅濑神社-3个-f.json",
        "狗粮-稻妻-清籁岛-越石村-8个-f.json",
        "狗粮-稻妻-清籁岛-平海砦西-8个-f.json",
        "狗粮-稻妻-鹤观-东偏中-2个-f.json",
        "狗粮-稻妻-鹤观-南-2个-f.json",
        "（恢复）狗粮-稻妻-清籁岛.json",
        "【收尾】狗粮-稻妻-清籁岛-清籁丸-20个-f.json"
    ]; // 97+20个

    const pathingE = [
        "【额外】狗粮-纳塔-鸡屁股+8个／9个-f.json", // 12小时刷新
    ]; // 7个

    const pathingE_A = [
        "【额外】狗粮-须弥-水天丛林+7个-f.json", // 24小时刷新
        "【额外】狗粮-枫丹-研究院区-新枫丹科学院周边+3个-f.json", // 24小时刷新
    ];  // 10个

    const pathingE_B = [
        "【额外】狗粮-纳塔-灵谜纹+13个.json" // 24小时刷新
    ];  // 13个

    // 每日拾取点位数及耗时
    // A: (98 + 21) + (8 + 10) = 137    ~   31 + 10 = 41 minutes
    // B: (97 + 20) + (8 + 13) = 138    ~   32 + 11 = 43 minutes


    // 读取用户设置
    let path = settings.path != undefined ? settings.path : '';
    let swapPath = settings.swapPath != undefined && settings.swapPath != '否' ? true : false;
    let extra = settings.extra != undefined && settings.extra != '是' ? false : true;
    let extraAB = settings.extraAB != undefined && settings.extraAB != '是' ? false : true;
    let autoSalvage = settings.autoSalvage != undefined && settings.autoSalvage != '是' ? false : true;
    let autoSalvage4 = settings.autoSalvage4 != undefined && settings.autoSalvage4 != '否' ? true : false;
    let autoSalvageSpan = settings.autoSalvageSpan != undefined && ~~settings.autoSalvageSpan > 0 ? ~~settings.autoSalvageSpan : 10;
    let activeRestore = settings.activeRestore != undefined && settings.activeRestore != '是' ? false : true;


    log.debug(`path: ${path}; swapPath: ${swapPath}; extra: ${extra}; extraAB: ${extraAB}; autoSalvage: ${autoSalvage}; autoSalvage4: ${autoSalvage4}; autoSalvageSpan: ${autoSalvageSpan}; activeRestore: ${activeRestore};`);
    // await sleep(30000);

    // 路线
    function determinePath() {
        if (path != 'A' && path != 'B') {
            const benchmark = new Date("2024-11-20T04:00:00");
            const now = new Date();
            const delta = now - benchmark;
            const days = delta / (1000 * 60 * 60 * 24);
            path = days % 2 < 1 ? 'A' : 'B';

            if (swapPath) path = path == 'A' ? 'B' : 'A';
        }
    }

    // 初始化
    async function init(shouldRestore = true, shouldResizeMap = false) {
        // close forced interaction just in case..
        dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));

        // restore and alignment
        if (shouldRestore) await genshin.tp("1468.0732421875", "1998.04443359375"); await sleep(3000);

        // resize map here (not necessary after bgi v0.41.0)
        if (shouldResizeMap) await resizeMap();
    }

    // 调整地图
    async function resizeMap(level = 1) {
        await genshin.returnMainUi();

        keyPress("M"); await sleep(1000);
        for (let i = 5; i > 0; --i) {
            click(46, 436); await sleep(500); // zoom in
        }
        for (let i = 0; i < level; ++i) {
            click(46, 630); await sleep(500); // zoom out
        }
        // keyPress("M"); await sleep(1000);
    }

    // 拖拽地图
    async function dragMap(byX, byY) {
        await genshin.returnMainUi();

        let byL = Math.sqrt(byX * byX + byY * byY);
        let d = 5;

        let dx = Math.round(d * byX / byL);
        let dy = Math.round(d * byY / byL);

        let times = Math.round(byX / dx * genshin.screenDpiScale);

        log.debug(`byL: ${byL}; dx: ${dx}; dy: ${dy}; times: ${times}; genshin.screenDpiScale: ${genshin.screenDpiScale};`);

        keyPress("M"); await sleep(1000);
        moveMouseBy(-byX, -byY); await sleep(300);

        leftButtonDown(); await sleep(300);
        for (let i = 0; i < times; ++i) {
            moveMouseBy(dx, dy); await sleep(30);
        }
        leftButtonUp(); await sleep(300);
    }

    // 就近传送（传送脚本文件中的第一个点）
    async function tpNearby(filePath) {
        const raw = file.ReadTextSync(filePath);
        const data = JSON.parse(raw);
        await genshin.tp(data['positions'][0]['x'], data['positions'][0]['y']);
    }

    // 分解圣遗物
    async function salvage() {
        if (!autoSalvage) return;

        await genshin.returnMainUi();

        keyPress("B"); await sleep(2000);
        click(670, 40); await sleep(1000); // 圣遗物
        click(660, 1010); await sleep(1000); // 分解
        click(300, 1020); await sleep(1000); // 快速选择

        // click(200, 140); await sleep(500); // 1
        // click(200, 220); await sleep(500); // 2
        // click(200, 300); await sleep(500); // 3
        if (!autoSalvage4) { click(200, 380); await sleep(500); } // 4

        click(340, 1000); await sleep(1000); // 确认选择
        click(1720, 1015); await sleep(1500); // 分解
        click(1180, 750); await sleep(1000); // 进行分解

        click(1840, 45); await sleep(1500); // 取消
        click(1840, 45); await sleep(1000); // 取消
        click(1840, 45); await sleep(1000); // 取消
    }

    // 单一脚本执行
    let count = 0;
    async function runFile(filePath, times = 2) {
        try {
            --times;

            // 如关闭主动去神像恢复，则依赖队伍配置持续恢复角色，及bgi的低血量被动恢复
            let isToRestore = filePath.search("（恢复）") != -1;
            if (isToRestore && !activeRestore) return;

            // 暂不支持关闭自动拾取
            // if (isToRestore) dispatcher.removeTimer(...);
            // else...

            // 分解圣遗物
            if (!isToRestore && count++ % autoSalvageSpan == 0) await salvage();

            // 调整地图缩放 (bgi[v0.41.0]后不需要)
            // let shouldResizeMap = filePath.search("-m") != -1;
            // if (shouldResizeMap) await resizeMap();

            // 配置自动拾取，根据文件名指定信息，确定是否强制交互（快速拾取）
            let forceInteraction = filePath.search("-f") != -1; //
            dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": forceInteraction }));

            //执行路径追踪脚本
            log.info(filePath);
            await pathingScript.runFile(filePath);

            // 地图缩放按键同某些地图标识重叠，导致识别失败(bgi[v0.43.0]后引入)
            // // 完成路径后，放大地图，脚本中调用就近传送。仍可能被缩小回去。不可行
            // let shouldResizeMap_after = filePath.search("~m") != -1;
            // if (shouldResizeMap_after) {
            //     await resizeMap(0);
            //     await tpNearby(filePath);
            // }
            // 完成路径后，拖拽地图，脚本中调用就近传送。可行
            let shouldDragMap_after = filePath.search("~m") != -1;
            if (shouldDragMap_after) {
                await dragMap(-50, 50);
                await tpNearby(filePath);
            }

        }
        catch (error) { // bgi已捕获可预期异常，此处仅做兜底
            log.error(error.toString());
            await sleep(3000);
            if (times > 0) await runFile(filePath, times);
        }
    }

    // 批量执行
    async function batch(folder, files) {
        for (let file of files) {
            const filePath = folder + file;
            await runFile(filePath);
        }
    }


    // main
    setGameMetrics(1920, 1080, 1);
    determinePath();

    // A or B
    await init();
    log.info(`开始执行${path}线路。`);
    if (path == 'A') await batch(folderA, pathingA);
    else await batch(folderB, pathingB);

    // Extra
    if (extra) {
        await init();
        log.info(`开始执行额外线路。`);

        // 12小时刷新的额外点位每天拾取
        await batch(folderE, pathingE);

        // 24小时刷新的额外点位隔天拾取，避免空跑
        if (path == 'A' || extraAB == false) await batch(folderE, pathingE_A);
        if (path == 'B' || extraAB == false) await batch(folderE, pathingE_B);
    }

    await init();
    log.info(`今日狗粮拾取任务完成。拾取路线：${path}${extra ? '+E' : ''}`);
    await sleep(1000);

})();