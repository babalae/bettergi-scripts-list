const bottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/到底了.png"), 1282, 934, 1296 - 1282, 945 - 934);
bottomRo.Threshold = 0.9;
bottomRo.InitTemplate();
const star1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/一星.png"), 107, 214, 1169, 706);
star1Ro.Threshold = 0.9;
star1Ro.InitTemplate();
const star2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/二星.png"), 107, 214, 1169, 706);
star2Ro.Threshold = 0.9;
star2Ro.InitTemplate();
const delete1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/摧毁图标1.png"), 31, 969, 93, 101);
delete1Ro.Threshold = 0.9;
delete1Ro.Use3Channels = true;
delete1Ro.InitTemplate();
const delete2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/摧毁图标2.png"), 1568, 977, 1920 - 1568, 1080 - 977);
delete2Ro.Threshold = 0.9;
delete2Ro.Use3Channels = true;
delete2Ro.InitTemplate();
const delete3Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/摧毁图标3.png"), 959, 704, 417, 109);
delete3Ro.Threshold = 0.9;
delete3Ro.Use3Channels = true;
delete3Ro.InitTemplate();
let itemCount = 0;
let itemDeleteCount = 0;

let delayScale = Number(settings.delayScale) || 1;
let delay1 = 50 * delayScale;
let delay2 = 150 * delayScale;
let scrollScale = Number(settings.scrollScale) || 10;

(async function () {
    //进入养成道具界面
    await genshin.returnMainUi();
    await genshin.tpToStatueOfTheSeven();
    await genshin.returnMainUi();
    keyPress("B");
    let type = "养成道具";
    const targetNumber = Number(settings.targetNumber) || 9000;
    const startNumber = Number(settings.startNumber) || 9900;
    if (targetNumber >= startNumber) {
        log.error("目标数量必须小于起删数量");
        return;
    }
    if (await findAndClick([`assets/RecognitionObject/背包界面/${type}1.png`, `assets/RecognitionObject/背包界面/${type}2.png`])) {
        log.info(`成功进入${type}界面，开始执行`);
    } else {
        await genshin.returnMainUi();
        keyPress("B");
        if (await findAndClick([`assets/RecognitionObject/背包界面/${type}1.png`, `assets/RecognitionObject/背包界面/${type}2.png`])) {
            log.info(`成功进入${type}界面，开始执行`);
        } else {
            log.info(`进入${type}界面失败`);
            return;
        }
    }
    let scrolls = 0
    while (scrolls < 200) {
        try { await sleep(1) } catch (e) { break; }
        if (await findAndClick(delete2Ro, false, 100, 16)) {
            await findAndClick("assets/RecognitionObject/返回.png");
            await sleep(delay2);
        }
        let findFullRes = null;
        let time4 = new Date();
        const gameRegion = captureGameRegion();
        const allRes1 = gameRegion.findMulti(star2Ro);

        let time5 = new Date();
        log.info(`调试-找出所有2星用时${time5 - time4}`);
        for (let i = 0; i < allRes1.count; i++) {
            const res = allRes1[i];
            const num = await numberTemplateMatch("assets/背包物品数字", res.x + 34, res.y + 16, 59, 30);
            if (num >= startNumber) {
                findFullRes = { x: res.x, y: res.y };
                break;
            }
        }
        let time6 = new Date();
        log.info(`调试-依次核对数量${time6 - time5}`);
        if (!findFullRes) {
            let time1 = new Date();
            const allRes2 = gameRegion.findMulti(star1Ro);
            let time2 = new Date();
            log.info(`调试-找出所有1星用时${time2 - time1}`);
            for (let i = 0; i < allRes2.count; i++) {
                const res = allRes2[i];
                const num = await numberTemplateMatch("assets/背包物品数字", res.x + 34, res.y + 16, 59, 30);
                if (num >= startNumber) {
                    findFullRes = { x: res.x, y: res.y };
                    break;
                }
            }
            let time3 = new Date();
            log.info(`调试-依次核对数量${time3 - time2}`);
        }
        gameRegion.dispose();
        if (findFullRes) {
            //二次确认
            let fullNum = await numberTemplateMatch("assets/背包物品数字", findFullRes.x + 34, findFullRes.y + 16, 59, 30);
            log.info(`找到一个爆仓材料，位置(${findFullRes.x},${findFullRes.y})，数量 ${fullNum} 个`);
            await findAndClick(delete1Ro, true, 200, 16);
            await sleep(delay2);
            click(findFullRes.x + 20, findFullRes.y - 60);
            await sleep(delay2);
            if (!await deleteToTargetNumber(fullNum - targetNumber)) {
                continue;
            }
            await sleep(delay2);
            await findAndClick(delete2Ro);
            await sleep(delay2);
            await findAndClick(delete3Ro);
            itemCount++;
            itemDeleteCount += fullNum - targetNumber;
            continue;
        }
        scrolls++;
        let bottomres = await findAndClick(bottomRo, false, 2, 3, 1);
        if (bottomres) {
            moveMouseTo(139, 910);
            await scrollDown(3);
            bottomres = await findAndClick(bottomRo, false, 2, 3, 1);
            if (bottomres) {
                log.info(`到底了,${type}类型处理完毕`);
                break;
            }
        }
        moveMouseTo(139, 910);
        await scrollDown(3);
    }
    log.info(`删除了${itemCount}种爆仓材料共${itemDeleteCount}个`);
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
    interval = delay1,
    retType = 0,
    preClickDelay = delay1,
    postClickDelay = delay1) {
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
    lines = lines * scrollScale;
    for (let i = 0; i < lines; i++) {
        await keyMouseScript.runFile(`assets/滚轮下翻.json`);
    }
    await sleep(delay1);
}

/**
 * 数字模板匹配
 *
 * @param {string}  numberPngFilePath - 存放 0.png ~ 9.png 的文件夹路径（不含文件名）
 * @param {number}  x                 - 待识别区域的左上角 x 坐标，默认 0
 * @param {number}  y                 - 待识别区域的左上角 y 坐标，默认 0
 * @param {number}  w                 - 待识别区域的宽度，默认 1920
 * @param {number}  h                 - 待识别区域的高度，默认 1080
 * @param {number}  maxThreshold      - 模板匹配起始阈值，默认 0.95（最高可信度）
 * @param {number}  minThreshold      - 模板匹配最低阈值，默认 0.8（最低可信度）
 * @param {number}  splitCount        - 在 maxThreshold 与 minThreshold 之间做几次等间隔阈值递减，默认 5
 * @param {number}  maxOverlap        - 非极大抑制时允许的最大重叠像素，默认 2；只要 x 或 y 方向重叠大于该值即视为重复框
 *
 * @returns {number} 识别出的整数；若没有任何有效数字框则返回 -1
 *
 * @example
 * const mora = await numberTemplateMatch('摩拉数字', 860, 70, 200, 40);
 * if (mora >= 0) console.log(`当前摩拉：${mora}`);
 */
async function numberTemplateMatch(
    numberPngFilePath,
    x = 0, y = 0, w = 1920, h = 1080,
    maxThreshold = 0.95,
    minThreshold = 0.8,
    splitCount = 4,
    maxOverlap = 2
) {
    let ros = [];
    for (let i = 0; i <= 9; i++) {
        ros[i] = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(`${numberPngFilePath}/${i}.png`), x, y, w, h);
    }

    function setThreshold(roArr, newThreshold) {
        for (let i = 0; i < roArr.length; i++) {
            roArr[i].Threshold = newThreshold;
            roArr[i].InitTemplate();
        }
    }

    let gameRegion;
    const allCandidates = [];

    try {
        gameRegion = captureGameRegion();

        /* 1. splitCount 次等间隔阈值递减 */
        for (let k = 0; k < splitCount; k++) {
            const curThr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
            setThreshold(ros, curThr);

            /* 2. 9-0 每个模板跑一遍，所有框都收 */
            for (let digit = 9; digit >= 0; digit--) {
                try {
                    const res = gameRegion.findMulti(ros[digit]);
                    if (res.count === 0) continue;

                    for (let i = 0; i < res.count; i++) {
                        const box = res[i];
                        allCandidates.push({
                            digit: digit,
                            x: box.x,
                            y: box.y,
                            w: box.width,
                            h: box.height,
                            thr: curThr
                        });
                    }
                } catch (e) {
                    log.error(`识别数字 ${digit} 时出错：${e.message}`);
                }
            }
        }
    } catch (error) {
        log.error(`识别数字过程中出现错误：${error.message}`);
    } finally {
        if (gameRegion) gameRegion.dispose();
    }

    /* 3. 无结果提前返回 -1 */
    if (allCandidates.length === 0) {
        return -1;
    }

    /* 4. 非极大抑制（必须 x、y 两个方向重叠都 > maxOverlap 才视为重复） */
    const adopted = [];
    for (const c of allCandidates) {
        let overlap = false;
        for (const a of adopted) {
            const xOverlap = Math.max(0, Math.min(c.x + c.w, a.x + a.w) - Math.max(c.x, a.x));
            const yOverlap = Math.max(0, Math.min(c.y + c.h, a.y + a.h) - Math.max(c.y, a.y));
            if (xOverlap > maxOverlap && yOverlap > maxOverlap) {
                overlap = true;
                break;
            }
        }
        if (!overlap) {
            adopted.push(c);
            //log.info(`在 [${c.x},${c.y},${c.w},${c.h}] 找到数字 ${c.digit}，匹配阈值=${c.thr}`);
        }
    }

    /* 5. 按 x 排序，拼整数；仍无有效框时返回 -1 */
    if (adopted.length === 0) return -1;
    adopted.sort((a, b) => a.x - b.x);

    return adopted.reduce((num, item) => num * 10 + item.digit, 0);
}

/**
 * 将“已选摧毁数量”调节到目标值
 *
 * @param {number} delta - 还需再摧毁的件数（fullNum - targetNumber）
 *                         若 ≤0 则直接返回
 *
 * 逻辑：
 * 1. 循环读取当前已选数量 res
 * 2. res === delta  → 松开按键并立即返回
 * 3. res < delta    → 缺多少补多少
 *    差距 >20 长按“+”按钮（342,923）快速累加
 *    差距 ≤20 单点 click 精确补齐
 * 4. res > delta    → 多多少减多少
 *    差距 >20 长按“-”按钮（168,923）快速递减
 *    差距 ≤20 单点 click 精确减少
 * 5. state 变量记录当前是否正在长按（1 加 / -1 减 / 0 空闲），
 *    切换方向时先 leftButtonUp() 防止事件粘连
 *
 * @returns {Promise<boolean>} 成功调到目标值返回 true；若 delta≤0 直接返回 false
 *
 * @example
 * await deleteToTargetNumber(147);  // 把已选数量调到 147 
 */
async function deleteToTargetNumber(delta) {
    let state = 0;
    if (delta <= 0) {
        return false;
    }
    if (await findAndClick("assets/RecognitionObject/不可摧毁.png", false, 250)) {
        return false;
    }
    if (delta >= 4950) {
        await findAndClick("assets/RecognitionObject/最大.png");
    }
    let lastRes = 1;
    click(342, 923);
    await sleep(delay1);
    while (true) {
        let res = await numberTemplateMatch("assets/摧毁物品数字", 192, 901, 116, 56);
        //log.info(`调试-识别结果为${res}`);
        if (res === -1 || Math.abs(res - lastRes) > 100) {
            state = 0;
            await sleep(1000);
            leftButtonUp();
            for (let i = 0; i < 5; i++) {
                click(342, 923);
                await sleep(10);
            }
            await sleep(delay2);
            let res1 = await numberTemplateMatch("assets/摧毁物品数字", 192, 901, 116, 56);
            if (res1 === -1) {
                continue;
            } else {
                lastRes = res1;
                res = res1;
            }
        } else {
            lastRes = res;
        }
        if (res === delta) {
            leftButtonUp();
            return true;
        }
        if (res < delta) {
            if (delta - res > 20) {
                if (state != 1) {
                    leftButtonUp();
                    await sleep(delay1);
                    moveMouseTo(342, 923);
                    leftButtonDown();
                    state = 1;
                }
            } else {
                if (state != 0) {
                    leftButtonUp();
                    await sleep(delay1);
                    state = 0;
                }
                for (let i = 0; i < delta - res; i++) {
                    click(342, 923);
                    await sleep(10);
                }
            }
        } else {
            if (res - delta > 20) {
                if (state != -1) {
                    leftButtonUp();
                    await sleep(delay1);
                    moveMouseTo(168, 923);
                    leftButtonDown();
                    state = -1;
                }
            } else {
                if (state != 0) {
                    leftButtonUp();
                    await sleep(delay1);
                    state = 0;
                }
                for (let i = 0; i < res - delta; i++) {
                    click(168, 923);
                    await sleep(10);
                }
            }
        }
        await sleep(delay1);
        try { await sleep(1) } catch (e) { break; }
    }
    return true;
}