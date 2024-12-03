(async function () {
    const defaultExitDelay = 10000;
    const defaultLoadingDelay = 13000;
    const seen = new Set();

    function validateAndSetDefaults(exitDelay, loadingDelay) {
        if (isNaN(exitDelay) || exitDelay <= 0) {
            log.warn("你没有设置退出延迟，将使用默认值");
            exitDelay = defaultExitDelay;
        }
        if (isNaN(loadingDelay) || loadingDelay <= 0) {
            log.warn("你没有设置加载延迟，将使用默认值");
            loadingDelay = defaultLoadingDelay;
        }
        return { exitDelay, loadingDelay };
    }

    async function runGameActionsMultipleTimes(times, locationName) {
        for (let i = 0; i < times; i++) {
            await sleep(1000);
            keyPress("ESCAPE");
            await sleep(1000);
            click(50, 1030);
            await sleep(1000);
            click(1000, 750);
            await sleep(validatedExitDelay);
            click(1000, 550);
            await sleep(validatedLoadingDelay);
            keyPress("z");
            log.info(`${locationName} 循环次数：${i + 1}/${times}`);
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

    async function KeyMouse(locationNameEx) {
        log.info(`前往 ${locationNameEx}`);
        let tpPath = `assets/AutoPath/tp/${locationNameEx}tp.json`;
        let filePath = `assets/KeyMouse/${locationNameEx}.json`;

        try {
            await pathingScript.runFile(tpPath);
            await sleep(1000);
            await keyMouseScript.runFile(filePath);
        } catch (error) {
            log.error(`执行 ${locationNameEx} 脚本时发生错误: ${error}`);
        }
        await sleep(1000);
    }

    async function woodcutting(locationName) {
        log.info(`砍伐 ${locationName}`);
        if (!map[locationName]) {
            log.info(`未找到 ${locationName} 对应的木材`);
            return;
        }

        const { description, available, times } = map[locationName];
        if (description === 'NULL' || !description) {
            log.info(`${locationName} 暂不支持`);
            return;
        }

        if (Array.from(seen).some(item => item.includes(locationName))) {
            log.info(`${locationName} 已经砍伐过，将执行下一个`);
            return;
        }

        log.info(`前往 ${description}`);
        await sleep(1000);

        try {
            if (locationName === "炬木" || locationName === "桃椰子木") {
                await KeyMouse(description);
            } else {
                const filePath = `assets/AutoPath/${description}.json`;
                await pathingScript.runFile(filePath);
            }

            await sleep(1000);

            if (!available) {
                await runGameActionsMultipleTimes(times, description);
            } else {
                await dispatcher.runTask(new SoloTask("AutoWood"));
            }

            seen.add(map[locationName].description);
            log.info(`${locationName} 伐木完成，将执行下一个`);
            log.info(`已运行木材: ${[...seen].join(", ")}`);
        } catch (error) {
            log.error(`在砍伐 ${locationName} 时发生错误: ${error}`);
        }
    }

    // Set game environment settings
    setGameMetrics(1920, 1080, 1);

    const map = {
        '桦木': { description: '桦木15个', available: true, times: 134 },
        '萃华木': { description: '萃华木6个(垂香木3个)', available: true, times: 334 },
        '松木': { description: '松木24个', available: true, times: 84 },
        '却砂木': { description: '却砂木12个', available: true, times: 167 },
        '竹节': { description: '竹节30个', available: true, times: 67 },
        '垂香木': { description: '垂香木15个', available: true, times: 134 },
        '杉木': { description: '杉木12个', available: true, times: 167 },
        '梦见木': { description: '梦见木12个', available: true, times: 167 },
        '枫木': { description: '枫木9个', available: true, times: 223 },
        '孔雀木': { description: '御伽木9个(孔雀木6个)', available: false, times: 334 },//利用手动重置仇恨
        '御伽木': { description: '御伽木9个(孔雀木6个)', available: false, times: 334 },//利用手动重置仇恨
        '辉木': { description: '业果木15个(辉木15个)', available: true, times: 134 },
        '业果木': { description: '业果木15个(辉木15个)', available: true, times: 134 },
        '证悟木': { description: '证悟木15个(业果木6个)', available: true, times: 334 },
        '刺葵木': { description: '刺葵木6个', available: true, times: 334 },
        '柽木': { description: '柽木15个', available: false, times: 134 },
        '悬铃木': { description: '悬铃木18个', available: true, times: 112 },
        '椴木': { description: '椴木9个', available: true, times: 223 },
        '白梣木': { description: '白梣木15个', available: true, times: 134 },
        '香柏木': { description: '香柏木27个', available: true, times: 75 },
        '炬木': { description: '炬木15个', available: true, times: 134 },
        '白栗栎木': { description: '燃爆木6个(白栗栎木6个)', available: false, times: 334 },
        '灰灰楼林木': { description: '灰灰楼木6个', available: false, times: 334 },
        '燃爆木': { description: '燃爆木15个', available: false, times: 134 },
        '桃椰子木': { description: '桃椰子木12个', available: false, times: 167 }
    };

    let exitdelay = Number(settings.exitdelay);
    let loadingdelay = Number(settings.loadingdelay);
    const { exitDelay: validatedExitDelay, loadingDelay: validatedLoadingDelay } = validateAndSetDefaults(exitdelay, loadingdelay);

    const messages = [
        '确保装备有[王树瑞佑]',
        '确保使用小道具快捷键为Z键',
        '确保开启了BGI独立任务中自动伐木的“启用OCR伐木数量限制”',
        '若要运行炬木或桃椰子木：',
        '运行时是琳妮特前台且拥有双风共鸣',
        '元素共鸣需要四个角色组队触发，仅两个风系角色无效',
        '不要带其他有移速加成的角色'
    ];
    for (let message of messages) {
        log.info(message);
        await sleep(1000);
    }

    log.info('自动伐木开始...');
    log.info(`退出延迟: ${validatedExitDelay}毫秒, 加载延迟: ${validatedLoadingDelay}毫秒`);

    let woodsArray = settings.woods.split(" ");
    await resetMap();
    for (const wood of woodsArray) {
        if (wood.trim()) {
            await woodcutting(wood);
        } else {
            log.info('请在自定义选项输入木材名，用空格隔开');
        }
    }
})();
