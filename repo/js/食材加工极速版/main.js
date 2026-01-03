

let ingredientProcessingFood = settings.ingredientProcessingFood;
let foodCounts = settings.foodCount;

let checkInterval = +settings.checkInterval || 50;

let Foods = [];
let foodCount = [];

(async function () {
    if (typeof ingredientProcessingFood === 'string' && ingredientProcessingFood.trim()) {
        Foods = ingredientProcessingFood
            .split(/[,，;；\s]+/)          // 支持中英文逗号、分号、空格
            .map(word => word.trim())
            .filter(word => word.length > 0);
    }

    if (typeof foodCounts === 'string' && foodCounts.trim()) {
        foodCount = foodCounts
            .split(/[,，;；\s]+/)
            .map(word => word.trim())
            .filter(word => word.length > 0);
    }
    await ingredientProcessing();
})();


/**
* 食材加工主函数，用于自动前往指定地点进行食材的加工
*
* 该函数会根据 Foods 和 foodCount 数组中的食材名称和数量，依次查找并制作对应的料食材
* 支持调味品类食材（直接在“食材加工”界面查找）
*
* @returns {Promise<void>} 无返回值，执行完所有加工流程后退出
*/
async function ingredientProcessing() {
    const targetFoods = [
        "面粉", "兽肉", "鱼肉", "神秘的肉", "黑麦粉", "奶油", "熏禽肉",
        "黄油", "火腿", "糖", "香辛料", "酸奶油", "蟹黄", "果酱",
        "奶酪", "培根", "香肠"
    ];
    if (Foods.length == 0) { log.error("未选择要加工的食材"); return; }
    if (Foods.length != foodCount.length) { log.error("请检查食材与对应的数量是否一致！"); return; }
    const taskList = Foods.map((name, i) => `${name}*${foodCount[i]}`).join("，");
    const tasks = Foods.map((name, idx) => ({
        name,
        count: Number(foodCount[idx]) || 0,
        done: false
    }));
    log.info(`本次加工食材：${taskList}`);
    const stove = "蒙德炉子";
    log.info(`正在前往${stove}进行食材加工`);

    try {
        let filePath = `assets/${stove}.json`;
        await pathingScript.runFile(filePath);
    } catch (error) {
        log.error(`执行 ${stove} 路径时发生错误`);
        return;
    }

    const res1 = await findPNG("交互烹饪锅");
    if (res1) {
        keyPress("F");
    } else {
        log.warn("烹饪按钮未找到，正在寻找……");
        let attempts = 0;
        const maxAttempts = 3;
        let foundInRetry = false;
        while (attempts < maxAttempts) {
            log.info(`第${attempts + 1}次尝试寻找烹饪按钮`);
            keyPress("W");
            const res2 = await findPNG("交互烹饪锅");
            if (res2) {
                keyPress("F");
                foundInRetry = true;
                break;
            } else {
                attempts++;
                await sleep(500);
            }
        }
        if (!foundInRetry) {
            log.error("多次未找到烹饪按钮，放弃");
            return;
        }
    }
    await clickPNG("食材加工");

    /* ===== 1. 公共加工流程 ===== */
    async function doCraft(i) {
        await clickPNG("制作");
        await sleep(300);

        /* ---------- 1. 队列已满 ---------- */
        if (await findPNG("队列已满", 1)) {
            log.warn(`检测到${tasks[i].name}队列已满，等待图标消失`);
            while (await findPNG("队列已满", 1)) {
                log.warn(`检测到${tasks[i].name}队列已满，等待图标消失`);
                await sleep(300);
            }
            if (await clickPNG("全部领取", 3)) {
                await clickPNG("点击空白区域继续");
                await findPNG("食材加工2");
                await sleep(100);
            }
            return false;
        }

        /* ---------- 2. 材料不足 ---------- */
        if (await findPNG("材料不足", 1)) {
            log.warn(`检测到${tasks[i].name}材料不足，等待图标消失`);
            while (await findPNG("材料不足", 1)) {
                log.warn(`检测到${tasks[i].name}材料不足，等待图标消失`);
                await sleep(300);
            }
            if (await clickPNG("全部领取", 3)) {
                await clickPNG("点击空白区域继续");
                await findPNG("食材加工2");
                await sleep(100);
            }
            Foods.splice(i, 1);
            foodCount.splice(i, 1);

            return false;
        }

        /* ---------- 3. 正常加工流程 ---------- */
        await findPNG("选择加工数量");
        click(960, 460);
        await sleep(800);
        inputText(String(tasks[i].count));

        log.info(`尝试制作${tasks[i].name} ${tasks[i].count}个`);
        await clickPNG("确认加工");
        await sleep(500);

        /* ---------- 4. 已不能持有更多 ---------- */
        if (await findPNG("已不能持有更多", 1)) {
            log.warn(`检测到${tasks[i].name}已满，等待图标消失`);
            while (await findPNG("已不能持有更多", 1)) {
                log.warn(`检测到${tasks[i].name}已满，等待图标消失`);
                await sleep(300);
            }
            if (await clickPNG("全部领取", 3)) {
                await clickPNG("点击空白区域继续");
                await findPNG("食材加工2");
                await sleep(100);
            }
            Foods.splice(i, 1);
            foodCount.splice(i, 1);

            return false;
        }

        await sleep(200);
        /* 正常完成：仅领取，不移除 */
        if (await clickPNG("全部领取", 3)) {
            await clickPNG("点击空白区域继续");
            await findPNG("食材加工2");
            await sleep(100);
        }
    }

    /* ===== 2. 两轮扫描 ===== */
    // 进入界面先领取一次
    if (await clickPNG("全部领取", 3)) {
        await clickPNG("点击空白区域继续");
        await findPNG("食材加工2");
        await sleep(100);
    }

    let lastSuccess = true;
    for (let i = 0; i < tasks.length; i++) {
        if (!targetFoods.includes(tasks[i].name)) continue;

        const retry = lastSuccess ? 5 : 1;
        if (await clickPNG(`${tasks[i].name}1`, retry)) {
            log.info(`${tasks[i].name}已找到`);
            await doCraft(i);
            tasks[i].done = true;
            lastSuccess = true;   // 记录成功
        } else {
            lastSuccess = false;  // 记录失败
        }
    }

    const remain1 = tasks.filter(t => !t.done).map(t => `${t.name}*${t.count}`).join("，") || "无";
    log.info(`剩余待加工食材：${remain1}`);

    if (remain1 === "无") {
        log.info("所有食材均已加工完毕，跳过第二轮扫描");
        await genshin.returnMainUi();
        return;
    }

    /* ---------- 第二轮：无限轮询，直到全部完成或本轮零进展 ---------- */
    let allDone;          // 本轮是否全部完成
    let progress;         // 本轮是否至少完成 1 个

    while (true) {
        allDone = tasks.every(t => t.done);
        if (allDone) break;            // 条件 1

        progress = false;              // 先假设本轮零进展

        const rg = captureGameRegion();
        const foodItems = [];
        try {
            for (const flag of ['已加工0个', '已加工1个']) {
                const mat = file.ReadImageMatSync(`assets/RecognitionObject/${flag}.png`);
                const res = rg.findMulti(RecognitionObject.TemplateMatch(mat));
                for (let k = 0; k < res.count; ++k) {
                    foodItems.push({ x: res[k].x, y: res[k].y });
                }
                mat.dispose();
            }
        } finally { rg.dispose(); }

        log.info(`识别到${foodItems.length}个加工中食材`);

        for (const item of foodItems) {
            click(item.x, item.y); await sleep(1 * checkInterval);
            click(item.x, item.y); await sleep(6 * checkInterval);

            for (let round = 0; round < 5; round++) {
                const rg = captureGameRegion();
                try {
                    let hit = false;

                    /* 直接扫 tasks，模板已挂在 task.ro */
                    for (const task of tasks) {
                        if (task.done) continue;
                        if (!targetFoods.includes(task.name)) continue;

                        /* 首次使用再加载，避免重复 IO */
                        if (!task.ro) {
                            task.ro = RecognitionObject.TemplateMatch(
                                file.ReadImageMatSync(`assets/RecognitionObject/${task.name}2.png`)
                            );
                            task.ro.Threshold = 0.9;
                            task.ro.InitTemplate();
                        }

                        if (!task.ro) {
                            log.warn(`${task.name}2.png 不存在，跳过识别`);
                            continue;
                        }
                        const res = rg.find(task.ro);
                        if (res.isExist()) {
                            log.info(`${task.name}已找到`);
                            await doCraft(tasks.indexOf(task));
                            task.done = true;
                            hit = true;
                            progress = true;   // 本轮有进展
                            break;             // 一轮只处理一个
                        }
                    }

                    if (hit) break;            // 本轮已命中，跳出 round
                } finally {
                    rg.dispose();
                }
            }
        }

        const remain = tasks.filter(t => !t.done).map(t => `${t.name}*${t.count}`).join("，") || "无";
        log.info(`剩余待加工食材：${remain}`);

        if (!progress) {              // 条件 2：本轮零进展
            log.info("本轮未再完成任何食材，结束第二轮");
            break;
        }

        if (settings.disableRetry) {
            break;
        }
    }

    await genshin.returnMainUi();
}


async function clickPNG(png, maxAttempts = 20) {
    //log.info(`调试-点击目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.9;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, true, maxAttempts);
}

async function findPNG(png, maxAttempts = 20) {
    //log.info(`调试-识别目标${png},重试次数${maxAttempts}`);
    const pngRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/RecognitionObject/${png}.png`));
    pngRo.Threshold = 0.9;
    pngRo.InitTemplate();
    return await findAndClick(pngRo, false, maxAttempts);
}

async function findAndClick(target, doClick = true, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { await sleep(checkInterval * 2 + 50); if (doClick) { res.click(); } return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(checkInterval);
    }
    return false;
}