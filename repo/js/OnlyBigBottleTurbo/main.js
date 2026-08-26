const oneStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/一星.png`), 46, 209, 1338 - 46, 831 - 209);
oneStarRo.Threshold = +settings.Threshold1 || 0.97;
//oneStarRo.Use3Channels = true;
oneStarRo.InitTemplate();

const twoStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/二星.png`), 46, 209, 1338 - 46, 831 - 209);
twoStarRo.Threshold = +settings.Threshold1 || 0.97;
//twoStarRo.Use3Channels = true;
twoStarRo.InitTemplate();

const threeStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/三星.png`), 46, 209, 1338 - 46, 831 - 209);
threeStarRo.Threshold = +settings.Threshold1 || 0.97;
//threeStarRo.Use3Channels = true;
threeStarRo.InitTemplate();

const fourStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/四星.png`), 46, 209, 1338 - 46, 831 - 209);
fourStarRo.Threshold = +settings.Threshold1 || 0.97;
//fourStarRo.Use3Channels = true;
fourStarRo.InitTemplate();

// 五星模板只用于保护，永远不会进入可点击候选列表。
// 使用不高于 0.95 的阈值，让保护识别比普通点击识别更保守。
const fiveStarRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/五星.png`), 46, 209, 1338 - 46, 831 - 209);
fiveStarRo.Threshold = Math.min(+settings.Threshold1 || 0.97, 0.95);
fiveStarRo.InitTemplate();

let pngRo1;
let pngRo2;

let bigBottleCount = 0;
let smallBottleCount = 0;
let oneStarCount = 0;
let twoStarCount = 0;
let threeStarCount = 0;
let fourStarCount = 0;
let inferredFirstCount = 0;
let temponeStarCount = 0;
let temptwoStarCount = 0;
let tempthreeStarCount = 0;
let tempfourStarCount = 0;
let tempInferredFirstCount = 0;

// 点击速度参数来自自定义配置，并限制在安全范围内。
// 默认值 2/20/40ms 在速度与稳定性之间取平衡。
const FAST_CLICK_MOVE_DELAY_MS = readBoundedNumber(settings.fastClickMoveDelayMs, 2, 0, 100);
const FAST_CLICK_HOLD_MS = readBoundedNumber(settings.fastClickHoldMs, 20, 10, 100);
const FAST_CLICK_SETTLE_MS = readBoundedNumber(settings.fastClickSettleMs, 40, 20, 200);

const MAX_ALLOWED_STAR = Math.max(1, Math.min(4, +settings.maxStar || 1));

const STAR_DEFINITIONS = [
    { level: 4, name: "四星", ro: fourStarRo, addTemp: () => tempfourStarCount++ },
    { level: 3, name: "三星", ro: threeStarRo, addTemp: () => tempthreeStarCount++ },
    { level: 2, name: "二星", ro: twoStarRo, addTemp: () => temptwoStarCount++ },
    { level: 1, name: "一星", ro: oneStarRo, addTemp: () => temponeStarCount++ }
];

// 只从最高星级设置允许的范围生成点击候选。
const ALLOWED_STAR_DEFINITIONS = STAR_DEFINITIONS.filter(item => item.level <= MAX_ALLOWED_STAR);

// 高于设置上限的星级全部作为保护项；五星无条件加入保护。
const PROTECTED_STAR_DEFINITIONS = [
    { level: 5, name: "五星", ro: fiveStarRo },
    ...STAR_DEFINITIONS.filter(item => item.level > MAX_ALLOWED_STAR)
];

let artifactCandidateQueue = [];

// 缓存通用按钮模板，避免每轮分解都重新从磁盘读取并初始化同一张图片。
const templateRoCache = Object.create(null);

(async function () {
    //先回到主界面
    await genshin.returnMainUi();
    //await genshin.tpToStatueOfTheSeven();
    keyPress("B");
    //切换到圣遗物界面

    await findAndClick(["Assets/RecognitionObject/狗粮界面1.png", "Assets/RecognitionObject/狗粮界面2.png"]);

    if (settings.autoSwitchCount) {
        log.info(`填写了临界小瓶数量为${(+settings.autoSwitchCount)},开始识别`);

        await findAndClick("Assets/RecognitionObject/筛选.png");
        await sleep(200);
        click(30, 30);
        await sleep(100);
        await findAndClick("Assets/RecognitionObject/重置.png");
        await sleep(200);
        await findAndClick("Assets/RecognitionObject/祝圣之霜定义.png");
        await sleep(200);
        await findAndClick("Assets/RecognitionObject/未装备.png");
        await sleep(200);
        await findAndClick("Assets/RecognitionObject/未锁定.png");
        await sleep(200);
        await findAndClick("Assets/RecognitionObject/确认.png");
        await sleep(200);
        click(30, 30);
        await sleep(100);
        {
            const smallBottleRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/背包小瓶.png`));
            const bigBottleRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/背包大瓶.png`));
            smallBottleRo.InitTemplate();
            bigBottleRo.InitTemplate();
            let digitsSmall = -1;
            let digitsBig = -1;
            for (let i = 0; i < 5; i++) {
                if (digitsSmall >= 0) {
                    break;
                }
                const rg = captureGameRegion();
                try {
                    const res = rg.find(smallBottleRo);

                    if (res.isExist()) {
                        digitsSmall = await numberTemplateMatch("Assets/RecognitionObject/背包物品数字", res.x, res.y + 110, 122, 30);
                        log.info(`识别到小瓶数量为${digitsSmall}`);
                    }

                } finally { rg.dispose(); }
                if (i < 5 - 1) await sleep(50);
            }
            if (digitsSmall < 0) {
                log.info(`未识别到小瓶数量，视为0`);
                digitsSmall = 0;
            }
            if (digitsSmall >= settings.autoSwitchCount) {
                settings.bottleType = "只要大瓶";
            } else {
                settings.bottleType = "只要小瓶";
            }
            log.info(`当前分解模式为${settings.bottleType}`);
            if (settings.recognizeBig) {
                //点击小瓶防止大瓶图标闪烁
                await findAndClick("Assets/RecognitionObject/背包小瓶.png");
                await sleep(300);

                for (let i = 0; i < 5; i++) {
                    if (digitsBig >= 0) {
                        break;
                    }
                    const rg = captureGameRegion();
                    try {
                        const res = rg.find(bigBottleRo);

                        if (res.isExist()) {
                            digitsBig = await numberTemplateMatch("Assets/RecognitionObject/背包物品数字", res.x, res.y + 110, 122, 30);
                            log.info(`识别到大瓶，数量为${digitsBig}`);
                        }

                    } finally { rg.dispose(); }
                    if (i < 5 - 1) await sleep(50);
                }
                if (digitsBig < 0) {
                    log.info(`未识别到大瓶数量，视为0`);
                    digitsBig = 0;
                }
                notification.send(`当前背包大瓶数量为${digitsBig}，小瓶数量为${digitsSmall}`);
            }
        }
    }

    if (settings.bottleType != "只要小瓶") {
        pngRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/大瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo1.Threshold = +settings.Threshold2 || 0.99;
        pngRo1.Use3Channels = true;
        pngRo1.InitTemplate();

        pngRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/大瓶和小瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo2.Threshold = +settings.Threshold2 || 0.99;
        pngRo2.Use3Channels = true;
        pngRo2.InitTemplate();
    } else {
        pngRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/三个小瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo1.Threshold = +settings.Threshold2 || 0.99;
        pngRo1.Use3Channels = true;
        pngRo1.InitTemplate();

        pngRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/大瓶.png`), 1670, 900, 1890 - 1670, 980 - 900);
        pngRo2.Threshold = +settings.Threshold2 || 0.99;
        pngRo2.Use3Channels = true;
        pngRo2.InitTemplate();
    }

    //点击分解
    await findAndClick("Assets/RecognitionObject/分解.png");
    await sleep(500);
    await findAndClick("Assets/RecognitionObject/分解筛选.png");
    await sleep(200);
    await findAndClick("Assets/RecognitionObject/分解未锁定.png");
    await findAndClick("Assets/RecognitionObject/分解确认.png");
    //点击倒序
    await findAndClick("Assets/RecognitionObject/倒序.png");
    resetSelectionPlan();

    while (true) {
        let reward = null;
        let selectionExhausted = false;
        let cancelled = false;

        while (true) {
            try {
                await sleep(1);
            } catch (error) {
                log.info(`分解时出现错误${error.message}`);
                cancelled = true;
                break;
            }

            const frame = captureGameRegion();
            try {
                // 必须每次点击后重新检查目标，避免快速点击导致越过目标数量。
                reward = detectBottleReward(frame);
                if (reward) {
                    break;
                }

                if (!await selectOneArtifact(frame)) {
                    selectionExhausted = true;
                    break;
                }
            } finally {
                frame.dispose();
            }
        }

        if (cancelled) {
            break;
        }

        if (!reward) {
            if (selectionExhausted) {
                log.info("所有指定星级选择后不足以分解出目标");
            }
            log.info("结束分解");
            break;
        }

        log.info(`成功选出分解所需狗粮：${reward.big}个大瓶，${reward.small}个小瓶`);

        const executeClicked = await findAndClick("Assets/RecognitionObject/执行分解.png");
        const confirmClicked = executeClicked
            && await findAndClick("Assets/RecognitionObject/进行分解.png");

        if (!executeClicked || !confirmClicked) {
            log.error("分解按钮识别失败，本轮不计入统计并停止，避免继续误操作");
            break;
        }

        // 只有确认执行成功后才提交统计，避免按钮识别失败时虚增数量。
        commitTempArtifactCounts();
        bigBottleCount += reward.big;
        smallBottleCount += reward.small;

        await sleep(700);
        click(30, 30);
        await sleep(300);

        // 分解后物品网格会重新排布，新露出的高级材料必须重新获得最高优先级。
        resetSelectionPlan();
    }

    await genshin.returnMainUi();

    const parts = ['分解了'];
    if (oneStarCount > 0) parts.push(`${oneStarCount}个一星，`);
    if (twoStarCount > 0) parts.push(`${twoStarCount}个二星，`);
    if (threeStarCount > 0) parts.push(`${threeStarCount}个三星，`);
    if (fourStarCount > 0) parts.push(`${fourStarCount}个四星，`);
    if (inferredFirstCount > 0) parts.push(`${inferredFirstCount}个首格推定材料，`);

    parts.push('获得');
    if (bigBottleCount > 0) parts.push(`${bigBottleCount}个大瓶`);
    if (smallBottleCount > 0) {
        if (bigBottleCount > 0) parts.push('，');
        parts.push(`${smallBottleCount}个小瓶`);
    }

    if (parts.length > 2) {
        log.info(parts.join(''));
        notification.send(parts.join(''));
    } else {
        log.info('没有分解任何物品。');
        notification.send('没有分解任何物品。');
    }


})();

function resetSelectionPlan() {
    artifactCandidateQueue = [];
}

/**
 * 检查当前已选材料是否已经达到本轮分解目标。
 * 只返回结果，不直接修改全局统计；统计会在确认分解成功后提交。
 */
function detectBottleReward(frame) {
    const primaryRes = frame.find(pngRo1);
    if (primaryRes.isExist()) {
        return settings.bottleType === "只要大瓶"
            ? { big: 1, small: 0 }
            : { big: 0, small: 3 };
    }

    const secondaryRes = frame.find(pngRo2);
    if (secondaryRes.isExist()) {
        return settings.bottleType === "只要大瓶"
            ? { big: 1, small: 1 }
            : { big: 1, small: 0 };
    }

    return null;
}

/**
 * 收集某个星级的全部匹配坐标。
 */
function collectStarCandidates(frame, starDef) {
    const multiRes = frame.findMulti(starDef.ro);
    const candidates = [];

    for (let i = 0; i < multiRes.count; i++) {
        const res = multiRes[i];
        const point = {
            x: Math.round(res.x + res.width / 2),
            y: Math.round(res.y + res.height / 2),
            starDef: starDef
        };

        // 极少数情况下 findMulti 可能返回非常接近的重复框，先做一次轻量去重。
        const duplicated = candidates.some(item =>
            Math.abs(item.x - point.x) <= 6 && Math.abs(item.y - point.y) <= 6);
        if (!duplicated) {
            candidates.push(point);
        }
    }

    return candidates;
}

function isSameArtifact(a, b) {
    return Math.abs(a.x - b.x) <= 60 && Math.abs(a.y - b.y) <= 60;
}

/**
 * 按界面网格顺序排列：从上到下，每行从左到右。
 * 同一行模板纵坐标有少量差异，因此先按 50px 容差聚合成行。
 */
function sortCandidatesTopLeft(candidates) {
    const byY = [...candidates].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const rows = [];

    for (const candidate of byY) {
        let row = rows.find(item => Math.abs(item.anchorY - candidate.y) <= 50);
        if (!row) {
            row = { anchorY: candidate.y, items: [] };
            rows.push(row);
        }
        row.items.push(candidate);
    }

    return rows.flatMap(row => row.items.sort((a, b) => a.x - b.x));
}

/**
 * 仅收集设置允许的星级，并排除与任何受保护高星级重叠的候选。
 * 若识别存在冲突，宁可跳过该圣遗物，也绝不冒险点击。
 */
function collectSafeArtifactCandidates(frame) {
    const protectedCandidates = PROTECTED_STAR_DEFINITIONS.flatMap(starDef =>
        collectStarCandidates(frame, starDef));
    const allowedCandidates = ALLOWED_STAR_DEFINITIONS.flatMap(starDef =>
        collectStarCandidates(frame, starDef));
    const safeCandidates = [];

    for (const candidate of allowedCandidates) {
        if (protectedCandidates.some(item => isSameArtifact(candidate, item))) {
            log.warn(`跳过疑似受保护高星圣遗物：位置(${candidate.x}, ${candidate.y})`);
            continue;
        }

        // 多个星级模板命中同一格时视为识别冲突，直接跳过。
        const conflict = allowedCandidates.some(item =>
            item !== candidate
            && item.starDef.level !== candidate.starDef.level
            && isSameArtifact(candidate, item));
        if (conflict) {
            log.warn(`跳过星级识别冲突的圣遗物：位置(${candidate.x}, ${candidate.y})`);
            continue;
        }

        if (!safeCandidates.some(item => isSameArtifact(candidate, item))) {
            safeCandidates.push(candidate);
        }
    }

    const orderedCandidates = sortCandidatesTopLeft(safeCandidates);
    return prependInferredFirstCandidate(orderedCandidates);
}

/**
 * 当前排序下，第一格星级只会与第二格相同或更低。
 * 若首个安全候选明确位于第一行第二格，则推定第一格也不超过星级上限，
 * 在队首补入第一格；其他布局一律不推定。
 */
function prependInferredFirstCandidate(orderedCandidates) {
    if (orderedCandidates.length === 0) {
        return orderedCandidates;
    }

    const second = orderedCandidates[0];
    const expectedSecondX = 253;
    const expectedFirstX = 114;
    const expectedFirstRowY = 254;
    const positionTolerance = 25;

    const isFirstRowSecondCell =
        Math.abs(second.x - expectedSecondX) <= positionTolerance
        && Math.abs(second.y - expectedFirstRowY) <= positionTolerance;
    if (!isFirstRowSecondCell) {
        return orderedCandidates;
    }

    const alreadyHasFirst = orderedCandidates.some(item =>
        Math.abs(item.x - expectedFirstX) <= positionTolerance
        && Math.abs(item.y - second.y) <= positionTolerance);
    if (alreadyHasFirst) {
        return orderedCandidates;
    }

    const inferredStarDef = {
        level: second.starDef.level,
        name: `推定不高于${second.starDef.name}`,
        addTemp: () => tempInferredFirstCount++
    };
    return [{
        x: expectedFirstX,
        y: second.y,
        starDef: inferredStarDef
    }, ...orderedCandidates];
}

/**
 * 比 Region.click() 更快的材料点击。
 * finally 中强制抬起鼠标，脚本被取消时也不会留下按住状态。
 */
async function fastClickAt(x, y) {
    moveMouseTo(x, y);
    if (FAST_CLICK_MOVE_DELAY_MS > 0) {
        await sleep(FAST_CLICK_MOVE_DELAY_MS);
    }

    leftButtonDown();
    try {
        await sleep(FAST_CLICK_HOLD_MS);
    } finally {
        leftButtonUp();
    }

    if (FAST_CLICK_SETTLE_MS > 0) {
        await sleep(FAST_CLICK_SETTLE_MS);
    }
}

/**
 * 只在允许星级中按界面位置选择：从左上角开始，逐行向右、向下。
 * 每点击一个材料后，调用方都会重新检查是否已经凑够目标经验瓶。
 */
async function selectOneArtifact(frame) {
    if (artifactCandidateQueue.length === 0) {
        artifactCandidateQueue = collectSafeArtifactCandidates(frame);
        if (artifactCandidateQueue.length === 0) {
            return false;
        }
        log.info(`按左上到右下顺序选择，当前安全候选${artifactCandidateQueue.length}个，最高允许${MAX_ALLOWED_STAR}星`);
    }

    const candidate = artifactCandidateQueue.shift();
    await fastClickAt(candidate.x, candidate.y);
    candidate.starDef.addTemp();
    return true;
}

function readBoundedNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, number));
}

function commitTempArtifactCounts() {
    oneStarCount += temponeStarCount;
    twoStarCount += temptwoStarCount;
    threeStarCount += tempthreeStarCount;
    fourStarCount += tempfourStarCount;
    inferredFirstCount += tempInferredFirstCount;

    temponeStarCount = 0;
    temptwoStarCount = 0;
    tempthreeStarCount = 0;
    tempfourStarCount = 0;
    tempInferredFirstCount = 0;
}

function getCachedTemplateRo(path) {
    if (!templateRoCache[path]) {
        const ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(path));
        ro.InitTemplate();
        templateRoCache[path] = ro;
    }
    return templateRoCache[path];
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
    preClickDelay = 16,
    postClickDelay = 16) {
    try {
        // 1. 统一转成 RecognitionObject 数组
        let ros = [];
        if (Array.isArray(target)) {
            ros = target.map(t =>
                (typeof t === 'string')
                    ? getCachedTemplateRo(t)
                    : t
            );
        } else {
            ros = [(typeof target === 'string')
                ? getCachedTemplateRo(target)
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

async function findPNG(png, maxAttempts = 20) {
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`Assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.9;
    pngRo.InitTemplate();
    return await findWithoutClick(pngRo, maxAttempts);
}

async function findWithoutClick(target, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(50);
    }
    return false;
}

/**
 * 在指定区域内，用 0-9 的 PNG 模板做「多阈值 + 非极大抑制」数字识别，
 * 最终把检测到的数字按左右顺序拼成一个整数返回。
 *
 * @param {string}  numberPngFilePath - 存放 0.png ~ 9.png 的文件夹路径（不含文件名）
 * @param {number}  x                 - 待识别区域的左上角 x 坐标，默认 0
 * @param {number}  y                 - 待识别区域的左上角 y 坐标，默认 0
 * @param {number}  w                 - 待识别区域的宽度，默认 1920
 * @param {number}  h                 - 待识别区域的高度，默认 1080
 * @param {number}  maxThreshold      - 模板匹配起始阈值，默认 0.95（最高可信度）
 * @param {number}  minThreshold      - 模板匹配最低阈值，默认 0.8（最低可信度）
 * @param {number}  splitCount        - 在 maxThreshold 与 minThreshold 之间做几次等间隔阈值递减，默认 3
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
    minThreshold = 0.87,
    splitCount = 10,
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

    const gameRegion = captureGameRegion();
    const allCandidates = [];

    /* 1. splitCount 次等间隔阈值递减 */
    for (let k = 0; k < splitCount; k++) {
        const curThr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
        setThreshold(ros, curThr);

        /* 2. 0-9 每个模板跑一遍，所有框都收 */
        for (let digit = 0; digit <= 9; digit++) {
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
        }

    }
    gameRegion.dispose();

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
