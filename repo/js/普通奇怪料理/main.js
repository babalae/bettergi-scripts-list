let clickDelay = 16;
let sleepTimeRate = +settings.sleepTimeRate || 1;

(async function () {
    if (!settings.targetDish) {
        log.info("不填名字我怎么知道你要做啥")
    }
    await enterCook();
    var extraTime = (+settings.extraTime || 0);
    let i = 0;
    let targetNum = +settings.targetNum || 10;
    while (i < targetNum) {
        let text = ""
        if (settings.operationMode === "奇怪料理") {
            text = "奇怪的"
        }
        let progress = `${i + 1}/${targetNum}`;
        let percent = Math.round(((i + 1) / targetNum) * 100);
        log.info(`[${percent}%]正在制作第${progress}个${text}${settings.targetDish}`);
        log.debug(`交互或拾取："${text}${settings.targetDish}"`);
        if (await auto_cooking_bgi(extraTime)) {
            i++;
        }
        else await enterCook();
    }
})();

async function enterCook() {
    const stove = "蒙德炉子";
    let attempts = 0;
    let enterCooking = false;
    try {
        while (attempts < 10) {
            await genshin.returnMainUi();
            let filePath = `assets/${stove}.json`;
            await pathingScript.runFile(filePath);
            keyPress("F");
            if (await findPNG("料理制作")) {
                log.info("成功进入料理制作界面");
                enterCooking = true;
                break;
            }
            log.warn("进入料理制作界面失败，重试");
            attempts++;
            await genshin.returnMainUi();
        }
    } catch (error) {
        log.error(`执行 ${stove} 路径时发生错误`);
        return;
    }
    if (enterCooking) {
        await clickPNG("筛选");
        await clickPNG("重置");
        await clickPNG("搜索");
        inputText(settings.targetDish);
        await sleep(clickDelay * sleepTimeRate);
        //keyPress("VK_RETURN");
        await clickPNG("确认筛选");
        await clickPNG("制作");
    }
}

/**
 *
 * 自动执行手动烹饪(源于JS脚本: 烹饪熟练度一键拉满-(柒叶子-https://github.com/511760049))
 *
 * @param extraTime 
 * @returns {Promise<number>}
 */
async function auto_cooking_bgi(extraTime) {
    let success = false;
    moveMouseTo(400, 750); // 移动到屏幕水平中心，垂直750坐标
    await clickPNG("手动烹饪", 200);

    if (settings.operationMode === "奇怪料理") {
        await findPNG("结束", 10);
        keyPress("VK_SPACE");
        await sleep(50 * sleepTimeRate);
        keyPress("VK_SPACE");
        if (await clickPNG("确认", 20 * 3)) {
            return true;
        }
        else return false;
    }

    await sleep(1000); // 等待画面稳定
    const checkPoints = [
        { x: 741, y: 772 }, // 原始点1
        { x: 758, y: 766 }, // 中间点1-2
        { x: 776, y: 760 }, // 原始点2
        { x: 793, y: 755 }, // 中间点2-3
        { x: 810, y: 751 }, // 原始点3
        { x: 827, y: 747 }, // 中间点3-4
        { x: 845, y: 744 }, // 原始点4
        { x: 861, y: 742 }, // 中间点4-5
        { x: 878, y: 740 }, // 原始点5
        { x: 897, y: 737 }, // 中间点5-6
        { x: 916, y: 735 }, // 原始点6
        { x: 933, y: 735 }, // 中间点6-7
        { x: 950, y: 736 }, // 原始点7
        { x: 968, y: 736 }, // 中间点7-8
        { x: 986, y: 737 }, // 原始点8
        { x: 1002, y: 738 }, // 中间点8-9
        { x: 1019, y: 740 }, // 原始点9
        { x: 1038, y: 742 }, // 中间点9-10
        { x: 1057, y: 744 }, // 原始点10
        { x: 1074, y: 748 }, // 中间点10-11
        { x: 1092, y: 752 }, // 原始点11
        { x: 1107, y: 757 }, // 中间点11-12
        { x: 1122, y: 762 }, // 原始点12
        { x: 1138, y: 766 }, // 中间点12-13
        { x: 1154, y: 770 }, // 原始点13
        { x: 1170, y: 774 }, // 中间点13-14
        { x: 1193, y: 779 } // 原始点14
    ];

    // 区域大小
    const regionSize = 60;

    // 加载模板图片
    const templateMat0 = file.readImageMatSync(`assets/RecognitionObject/best0.png`);
    const templateMat1 = file.readImageMatSync(`assets/RecognitionObject/best1.png`);
    const templateMat2 = file.readImageMatSync(`assets/RecognitionObject/best2.png`);

    // 创建模板匹配识别对象
    const templateRo0 = RecognitionObject.templateMatch(templateMat0);
    const templateRo1 = RecognitionObject.templateMatch(templateMat1);
    const templateRo2 = RecognitionObject.templateMatch(templateMat2);
    templateRo0.threshold = 0.9;
    templateRo0.Use3Channels = true;
    templateRo1.threshold = 0.9;
    templateRo1.Use3Channels = true;
    templateRo2.threshold = 0.9;
    templateRo2.Use3Channels = true;
    // 捕获游戏区域
    const gameRegion = captureGameRegion();

    // 检查每个点
    for (let i = 0; i < checkPoints.length; i++) {
        const point = checkPoints[i];

        // 裁剪出当前检测区域
        const region = gameRegion.deriveCrop(
            point.x - regionSize / 2,
            point.y - regionSize / 2,
            regionSize,
            regionSize
        );

        let result;
        if (i < 9) {
            result = region.find(templateRo0);
        } else if (i >= 18) {
            result = region.find(templateRo2);
        } else {
            result = region.find(templateRo1);
        }
        region.dispose();

        if (!result.isEmpty()) {
            const segmentTime = 66;
            const waitTime = Math.round(i * segmentTime + extraTime);
            //log.info(`找到点位${i}号区域`);
            await sleep(waitTime);
            keyPress("VK_SPACE");
            gameRegion.dispose();
            if (await clickPNG("确认", 20 * 3)) {
                return true;
            }
            else return false;
        }
    }
    gameRegion.dispose();
    return false;
    // log.info(`未找到点位区域，烹饪结束`);
    // keyPress("ESCAPE");
    // await sleep(1000);
    // keyPress("ESCAPE");
    // throw new Error("人家才不是错误呢>_<");
}

async function clickPNG(png, maxAttempts = 100, Threshold = 0.9) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = Threshold;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, true, maxAttempts * 50 * sleepTimeRate);
}

async function findPNG(png, maxAttempts = 100) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.9;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, false, maxAttempts * 50 * sleepTimeRate);
}

/**
 * 通用找图/找RO并可选点击（支持单图片文件路径、单RO、图片文件路径数组、RO数组）
 * @param {string|string[]|RecognitionObject|RecognitionObject[]} target
 * @param {boolean}  [doClick=true]                是否点击
 * @param {number}   [timeout=3000]                识别时间上限（ms）
 * @param {number}   [interval=50]                 识别间隔（ms）
 * @param {number}   [retType=0]                   0-返回布尔；1-返回 Region 结果
 * @param {number}   [preClickDelay=50]            点击前等待
 * @param {number}   [postClickDelay=50]           点击后等待
 * @returns {boolean|Region}  根据 retType 返回是否成功或最终 Region
 */
async function findAndClick(target,
    doClick = true,
    timeout = 3000,
    interval = 50,
    retType = 0,
    preClickDelay = 50,
    postClickDelay = 50) {
    try {
        // 1. 统一转成 RecognitionObject 数组
        let ros = [];
        if (Array.isArray(target)) {
            ros = target.map(t =>
                (typeof t === 'string')
                    ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(t))
                    : t
            );
        } else {
            ros = [(typeof target === 'string')
                ? RecognitionObject.TemplateMatch(file.ReadImageMatSync(target))
                : target];
        }

        const start = Date.now();
        let found = null;

        while (Date.now() - start <= timeout) {
            const gameRegion = captureGameRegion();
            try {
                // 依次尝试每一个 ro
                for (const ro of ros) {
                    const res = gameRegion.find(ro);
                    if (!res.isEmpty()) {          // 找到
                        found = res;
                        if (doClick) {
                            await sleep(preClickDelay * sleepTimeRate);
                            res.click();
                            await sleep(postClickDelay * sleepTimeRate);
                        }
                        break;                     // 成功即跳出 for
                    }
                }
                if (found) break;                  // 成功即跳出 while
            } finally {
                gameRegion.dispose();
            }
            await sleep(interval * sleepTimeRate);                 // 没找到时等待
        }

        // 3. 按需返回
        return retType === 0 ? !!found : (found || null);

    } catch (error) {
        log.error(`执行通用识图时出现错误：${error.message}`);
        return retType === 0 ? false : null;
    }
}