const bottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/到底了.png"), 1282, 934, 1296 - 1282, 945 - 934);
bottomRo.Threshold = 0.9;
bottomRo.InitTemplate();
const newRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/新.png"), 184, 132, 1285 - 184, 953 - 132);
newRo.Threshold = 0.8;
newRo.InitTemplate();
let newCount = 0;
(async function () {
    await genshin.tpToStatueOfTheSeven();
    await genshin.returnMainUi();
    keyPress("B");

    let types = Array.from(settings.executingTypes);
    if (types.includes("全选")) {
        types = ["武器",
            "圣遗物",
            "养成道具",
            "食物",
            "材料",
            "小道具",
            "任务",
            "贵重道具",
            "摆设"]
    }
    for (let type of types) {

        if (await findAndClick([`assets/RecognitionObject/背包界面/${type}1.png`, `assets/RecognitionObject/背包界面/${type}2.png`])) {
            log.info(`成功进入${type}界面，开始执行`);
        } else {
            await genshin.returnMainUi();
            keyPress("B");
            if (await findAndClick([`assets/RecognitionObject/背包界面/${type}1.png`, `assets/RecognitionObject/背包界面/${type}2.png`])) {
                log.info(`成功进入${type}界面，开始执行`);
            } else {
                log.info(`进入${type}界面失败`);
                continue;
            }
        }
        if (type === "圣遗物") {
            await findAndClick([`assets/RecognitionObject/筛选1.png`, `assets/RecognitionObject/筛选2.png`]);
            await sleep(300);
            moveMouseTo(960, 540);
            await findAndClick(`assets/RecognitionObject/重置.png`);
            await sleep(300);
            await findAndClick(`assets/RecognitionObject/确认.png`);
            await sleep(300);
        }
        let scrolls = 0;
        while (scrolls < 200) {
            scrolls++
            try { await sleep(1) } catch (e) { break; }
            while (true) {
                let newRes = await findAndClick(newRo, true, 300, 16, 1, 50, 50);
                if (newRes) {
                    newRes.click();
                    log.info(`在${newRes.x},${newRes.y}找到一个新`);
                    newCount++;
                } else {
                    break;
                }
            }
            let bottomres = await findAndClick(bottomRo, false, 2, 3, 1);
            if (bottomres) {
                moveMouseTo(139, 910);
                await scrollDown(2);
                bottomres = await findAndClick(bottomRo, false, 2, 3, 1);
                if (bottomres) {
                    log.info(`到底了,${type}类型处理完毕`);
                    break;
                }
            }
            moveMouseTo(139, 910);
            await scrollDown(2);
        }
    }
    log.info(`本次运行共点击 ${newCount} 个新`);
})();

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
                            await sleep(preClickDelay);
                            res.click();
                            await sleep(postClickDelay);
                        }
                        break;                     // 成功即跳出 for
                    }
                }
                if (found) break;                  // 成功即跳出 while
            } finally {
                gameRegion.dispose();
            }
            await sleep(interval);                 // 没找到时等待
        }

        // 3. 按需返回
        return retType === 0 ? !!found : (found || null);

    } catch (error) {
        log.error(`执行通用识图时出现错误：${error.message}`);
        return retType === 0 ? false : null;
    }
}

/**
 * 向下滚动lines行（调用一次滚轮下翻脚本）
 * @param {number} [lines=1]  需要滚动的行数，默认 1 行
 * @returns {Promise<void>}
 */
async function scrollDown(lines = 1) {
    lines = lines * 10;
    for (let i = 0; i < lines; i++) {
        await keyMouseScript.runFile(`assets/滚轮下翻.json`);
    }
}