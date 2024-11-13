(async function () {
    setGameMetrics(1920, 1080, 2);

    async function logTaskStart() {
        const messages = [
            '确保地图的按键为M键',
            '左上角派蒙头像未被其他悬浮窗遮挡',
            '运行时默认使用常用路径追踪队伍',
            '请于【路径追踪】选项卡自行配置',
            '【自动】将以每天4点为界限交替运行'
        ];

        for (let message of messages) {
            log.info(message); 
            await sleep(1000);
        }
    }
    async function resetMap() {
        log.info("重置地图大小...");
        await sleep(1000);
        keyPress("M");
        await sleep(1000);
        click(1840, 1010);
        await sleep(1000);
        click(1450, 460);
        await sleep(1000);
        click(1840, 1010);
        await sleep(1000);
        click(1450, 140);
        await sleep(1000);
        keyPress("M");
        log.info("重置地图大小完成");
    }

    async function AutoPathA(locationName) {
        log.info(`前往 ${locationName}`);
        try {
        let filePath = `assets/AutoArtifacts(A)/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        await sleep(2000);
    }
    async function AutoPathB(locationName) {
        log.info(`前往 ${locationName}`);
        try {
        let filePath = `assets/AutoArtifacts(B)/${locationName}.json`;
            await pathingScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationName} 路径时发生错误`);
        }
        await sleep(2000);
    }

    function logTimeTaken(startTime) {
        const currentTime = Date.now();
        const totalTimeInSeconds = (currentTime - startTime) / 1000;
        const minutes = Math.floor(totalTimeInSeconds / 60);
        const seconds = totalTimeInSeconds % 60;
        const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
        log.info(`当前运行总时长：${formattedTime}`);
    }

    //判断AB线
    async function runAlternateTasks() {
        const dayDifference = Math.floor((Date.now() + 1000 * 60 * 60 * 4) / (1000 * 60 * 60 * 24));
        if (settings.selectway === undefined){
            log.info('未设置自定义选项，将默认【自动】选择路线');
        }
        if ((dayDifference % 2 == 0 && (settings.selectway == "自动" || settings.selectway === undefined)) || settings.selectway == "A线") {
            log.info("{xx}","---今天运行A线---");
            // 执行 A 的代码
            await logTaskStart();

            await resetMap();//重置地图大小避免传错

            log.info('前往地区：璃月');
            await AutoPathA('狗粮-璃月-沉玉谷上谷-东-2个');
            await AutoPathA('狗粮-璃月-沉玉谷南陵-3个（另一个太远）');
            await AutoPathA('狗粮-璃月-珉林-东北-9个');
            await AutoPathA('狗粮-璃月-珉林-北-5个');
            await AutoPathA('狗粮-璃月-珉林-天道谷-3个');
            await AutoPathA('狗粮-璃月-珉林-奥藏山南-3个');
            await resetMap();//重置地图大小避免传错
            await AutoPathA('狗粮-璃月-珉林-绝云间-3个');//会传到太山府。已解决
            await AutoPathA('狗粮-璃月-琼玑野-绿华池-3个');
            await AutoPathA('狗粮-璃月-碧水源-望舒客栈-1个');
            await AutoPathA('狗粮-璃月-碧水源-盐中之地-3个');
            await AutoPathA('狗粮-璃月-碧水源-轻策庄-3个');
            logTimeTaken(startTime);

            log.info('前往地区：须弥');
            await AutoPathA('狗粮-须弥-上风蚀地-东北营地-2个');
            await AutoPathA('狗粮-须弥-下风蚀地-阿如村-4个');
            await AutoPathA('狗粮-须弥-下风蚀地-阿如村-北-1个');
            await AutoPathA('狗粮-须弥-二净甸-七天神像-4个(重兵把守，其余不拿)');
            await AutoPathA('狗粮-须弥-二净甸-觉王之殿南-6个');
            await AutoPathA('狗粮-须弥-千壑沙地-圣显厅西-3个');
            await AutoPathA('狗粮-须弥-千壑沙地-塔尼特露营地-3个');
            await AutoPathA('狗粮-须弥-千壑沙地-神的棋盘-1个（只拿前一个）');
            await AutoPathA('狗粮-须弥-失落的苗圃-南-8个');
            await AutoPathA('狗粮-须弥-护世森-卡萨扎莱宫南-2个');
            await AutoPathA('狗粮-须弥-浮罗囿-甘露花海北-4个');
            await AutoPathA('狗粮-须弥-道成林-化城郭-西-3个');
            await AutoPathA('狗粮-须弥-须弥城-3个（有一个剧烈摇晃，不拿）');
            logTimeTaken(startTime);

            log.info('前往地区：纳塔');
            await AutoPathA('狗粮-纳塔-万火之瓯-竞技场东-4个');
            await AutoPathA('狗粮-纳塔-坚岩隘谷-回声之子南-7个');
            await AutoPathA('狗粮-纳塔-涌流地-流泉之众-4个');
            logTimeTaken(startTime);

            log.info('前往地区：稻妻');
            await AutoPathA('【收尾】狗粮-稻妻-神无冢-踏鞴砂-21个');//飞行体力不够，被火深渊法师击落，爬墙卡死，冲刺摔落。已解决：删除了两个调查点位
            logTimeTaken(startTime);
            // 计算并输出总时长
            const endTime = Date.now();
            const totalTimeInSeconds = (endTime - startTime) / 1000;
            const minutes = Math.floor(totalTimeInSeconds / 60);
            const seconds = totalTimeInSeconds % 60;
            const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
            log.info(`自动狗粮运行总时长：${formattedTime}`);
        }
        else {
            log.info("{xx}","---今天运行B线---");

            await logTaskStart();
            await resetMap();//重置地图大小避免传错

            log.info('前往地区：枫丹');
            await AutoPathB('狗粮-枫丹-伊黎耶林区-欧庇克莱歌剧院东南-2个');
            //await AutoPathB('狗粮-枫丹-白露区-秋分山东侧-2个');//有役人，点位过多，或许可删除。已删除
            await AutoPathB('狗粮-枫丹-白露区-秋分山西侧-北-2个');
            await AutoPathB('狗粮-枫丹-研究院区-东-3个');
            await AutoPathB('狗粮-枫丹-研究院区-中央实验室遗址-北侧屋内-4个');
            await AutoPathB('狗粮-枫丹-研究院区-学术会堂-1个（另一个太远）');
            await AutoPathB('狗粮-枫丹-研究院区-新枫丹科学院-东南侧-8个');
            await AutoPathB('狗粮-枫丹-研究院区-西北-6个(有一个不拿，有干扰)');
            await AutoPathB('狗粮-枫丹-研究院区-西南偏南-6个');
            await AutoPathB('狗粮-枫丹-研究院区-西南偏西-4个');
            await AutoPathB('狗粮-枫丹-莫尔泰区-七天神像-1个');
            await AutoPathB('狗粮-枫丹-黎翡区-七天神像-5个');
            await AutoPathB('狗粮-枫丹-黎翡区-芒索斯山东-3个');
            logTimeTaken(startTime);

            log.info('前往地区：稻妻');
            await AutoPathB('狗粮-稻妻-海祇岛-东方小岛-2个');
            await AutoPathB('狗粮-稻妻-海祇岛-望泷村西南-4个');
            await AutoPathB('狗粮-稻妻-海祇岛-珊瑚宫东北-6个');
            await AutoPathB('狗粮-稻妻-清籁岛-平海砦西-8个');
            await AutoPathB('狗粮-稻妻-清籁岛-浅濑神社-3个');
            await AutoPathB('狗粮-稻妻-清籁岛-越石村-8个');
            await AutoPathB('狗粮-稻妻-神无冢-东-5个（最后一个不拿，重兵把守）');
            await AutoPathB('狗粮-稻妻-神无冢-九条阵屋-3个');//有概率被挡住导致只能捡一个。忽略。
            await AutoPathB('狗粮-稻妻-神无冢-堇色之庭-4个');
            await AutoPathB('狗粮-稻妻-神无冢-无相之火-4个（第5个有干扰，不拿）');
            await AutoPathB('狗粮-稻妻-鹤观-东-3个');
            await AutoPathB('【收尾】狗粮-稻妻-清籁岛-清籁丸-20个');
            logTimeTaken(startTime);

            // 计算并输出总时长
            const endTime = Date.now();
            const totalTimeInSeconds = (endTime - startTime) / 1000;
            const minutes = Math.floor(totalTimeInSeconds / 60);
            const seconds = totalTimeInSeconds % 60;
            const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
            log.info(`自动狗粮运行总时长：${formattedTime}`);
        }
    };

    const startTime = Date.now();
    await runAlternateTasks();
})();