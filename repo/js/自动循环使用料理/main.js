/*********************** 配置与常量 ***********************/

// 用户输入，格式如："2,3;4,5"
const queue1 = settings.queue1 || "";

const queueList = [
    { queue: queue1 }
];

// 用户配置
let isBusy = false; // 全局互斥锁，控制界面操作互斥
let eatQueue = [];  // 全局吃药队列，所有任务都往这里推送目标


// 模板识别对象
const InventoryInterfaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/InventoryInterface.png"),
    0, 0, 140, 100
); // 【背包界面】图标
const DisabledFoodInterfaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/DisabledFoodInterface.png"),
    0, 0, 1920, 100
); // 【食物界面-未处于】图标
const FoodInterfaceRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/FoodInterface.png"),
    0, 0, 1920, 100
); // 【食物界面-已处于】图标

const FilterButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/FilterButton.png"),
    0, 0, 665, 1080
); // 【筛选】图标
const SearchButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/SearchButton.png"),
    0, 0, 665, 1080
); // 【搜索】图标
const ConfirmFilterButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ConfirmFilterButton.png"),
    0, 0, 665, 1080
); // 【确认筛选】按钮
const ResetButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/ResetButton.png"),
    0, 0, 665, 1080
); // 【重置】按钮

const UseButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/UseButton.png"),
    1570, 985, 230, 65
); // 【使用】按钮
const CancelButtonRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("Assets/RecognitionObject/CancelButton.png"),
    510, 740, 905, 100
); // 【取消】按钮



/*********************** 工具函数 ***********************/

// 解析用户输入，返回目标数组，得到所有目标行列

/*
步骤详解：
1.分组
.split(/[;；]/)
支持中英文分号分割，比如 "1,2;3,4；5,6" 都能正确分组。
2.去除空格
.map(pair => pair.trim())
去掉每组前后的空格，防止用户输入 " 1,2 " 这样的内容出错。
3.过滤空项
.filter(pair => pair.length > 0)
如果用户输入多余分号（如 "1,2;;3,4"），会产生空字符串，这里直接过滤掉。
*/
function parseTargets(queue, defaultTime = 300) {
    try {
        const result = [];
        const seenCoord = new Set();   // 只存已经出现过的 "r,c"
        const seenName = new Map();   // key = "name"，value = {idx} 用于覆盖

        const list = queue
            .split(/[;；]/)
            .map(s => s.trim())
            .filter(Boolean)

        for (const s of list) {
            const parts = s.split(/[，,]/).map(v => v.trim());
            // 1. 行列坐标
            if (parts.length >= 2 && /^-?\d+$/.test(parts[0]) && /^-?\d+$/.test(parts[1])) {
                const [row, col, time] = parts.map(Number);
                const key = `${row},${col}`;
                if (!seenCoord.has(key)) {
                    seenCoord.add(key);
                    result.push({
                        type: 'coord',
                        data: { row, col },
                        time: (!isNaN(time) && time > 0) ? time : defaultTime,
                        lastTime: 0
                    });
                }
                continue;
            }

            // 2. 食物名
            if (parts[0]) {
                const name = parts[0];
                let time = defaultTime, nth = 1;
                if (parts.length === 2) {
                    // 只有两个参数时，第二个参数总是 time
                    const t = Number(parts[1]);
                    if (!isNaN(t) && t > 0) time = t;
                } else if (parts.length === 3) {
                    // 三个参数时，第二个是 time，第三个是 nth
                    const t = Number(parts[1]), n = Number(parts[2]);
                    if (!isNaN(t) && t > 0) time = t;
                    if (!isNaN(n) && n >= 1 && n <= 40 && n === Math.floor(n)) nth = n;
                }
                // 后出现的覆盖先出现的
                if (seenName.has(name)) {
                    result[seenName.get(name)] = {
                        type: 'search',
                        data: { name, nth },
                        time,
                        lastTime: 0
                    };
                } else {
                    seenName.set(name, result.length);
                    result.push({
                        type: 'search',
                        data: { name, nth },
                        time,
                        lastTime: 0
                    });
                }
            }
        }
        return result;
    } catch (error) {
        log.error(`解析队列时发生错误: ${error.message}`);
        return []; // 返回空数组表示解析失败
    }
}

/**
 * 清空吃药队列并返回被删除的元素。
 * @returns {Array} 被删除的元素数组，如果清空失败则返回空数组。
 */
function flushEatQueue() {
    try {
        return eatQueue.splice(0);// splice 会原地清空并返回被删元素
    } catch (error) {
        log.error(`清空吃药队列时发生异常: ${error.message}`);
        return []; // 返回空数组表示清空失败
    }
}

// 计算料理图标的坐标，只生成需要的行列
function computeGridCoordinates(targets) {
    const allRows = [...new Set(targets.map(t => t.row))];
    const allCols = [...new Set(targets.map(t => t.col))];
    const gridCoordinates = [];// 存储计算后的坐标
    // 计算料理图标的坐标（行列排列）
    try {
        for (const row of allRows) {
            for (const col of allCols) {
                const ProcessingX = Math.round(185 + (col - 1) * 145);
                const ProcessingY = Math.round(200 + (row - 1) * 175);
                gridCoordinates.push({ row, col, x: ProcessingX, y: ProcessingY });
            }
        }
        return gridCoordinates;
    } catch (error) {
        log.error(`计算料理图标的坐标时发生异常: ${error.message}`);
    }

}

// 模板匹配并点击
async function findAndClick(target) {
    try {
        const gameRegion = captureGameRegion();
        const found = gameRegion.find(target);
        if (found && found.isExist()) {
            found.click();
        }
        gameRegion.dispose();
    } catch (error) {
        log.error(`findAndClick 出错: ${error.message}`);
    }

}

/**
 * 捕获游戏区域并查找指定模板，返回匹配结果对象
 * @param {object} templateRo 模板识别对象
 * @returns {object} 匹配结果对象
 */
function findInGameRegion(templateRo) {
    try {
        const gameRegion = captureGameRegion();
        const result = gameRegion.find(templateRo);
        gameRegion.dispose();
        return result;
    } catch (error) {
        log.error(`findInGameRegion 出错: ${error.message}`);
    }
}
/**
 * 点击“使用”后，检测并处理可能出现的弹窗
 * @param {number} timeout 最长等待时间(ms)
 * @returns {Promise<boolean>} true=检测到弹窗并已点击取消，false=无弹窗
 */
async function handlePopupAfterUse(timeout = 300) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const cancel = findInGameRegion(CancelButtonRo);
        if (cancel.isExist()) {
            log.warn("检测到弹窗，点击【取消】关闭");
            try {
                toast("检测到弹窗，已自动取消");
            } catch (e) { /* 某些环境无 toast，忽略 */ }
            cancel.click();
            await sleep(300);          // 给界面一点时间消失
            return true;
        }
        await sleep(100);
    }
    // 超时未匹配到，视为无弹窗
    return false;
}


/*********************** 主要逻辑函数 ***********************/

// ---------- 算下一次该推送谁 ----------
function nextTick(targets) {
    const now = Date.now();
    // 找出距离下一次推送最近的那条记录
    let minDelay = 1000;           // 默认最小 1 秒
    for (const t of targets) {
        const due = (t.lastPushTime || 0) + t.time * 1000;
        const delay = Math.max(0, due - now);
        if (delay < minDelay) minDelay = delay;
    }
    // 不能为 0，至少给 50 ms
    return Math.max(50, minDelay);
}

// 定时将本组要吃的药加入全局队列
async function runQueueTask(queue) {
    const targets = parseTargets(queue);
    // 立即推一次
    // 给每个目标初始化 lastPushTime
    targets.forEach(t => t.lastPushTime = 0);

    // 把推送逻辑写成内部函数，立即执行一次，再定时执行
    const pushOnce = () => {
        const now = Date.now();
        // 极端保护：队列过长时报警并强制清空
        if (eatQueue.length > 1000) {
            log.error("警告：eatQueue 长度超过1000，已强制清空！");
            flushEatQueue();
        }

        // 把本组目标推送到全局队列（去重）
        for (const t of targets) {
            if (now - (t.lastPushTime || 0) >= t.time * 1000) {
                // 真正到点才推送
                const key = t.type === 'coord'
                    ? `${t.data.row},${t.data.col}`
                    : t.data.name;                       // 同名食物也算重复
                if (!eatQueue.some(e =>
                    (e.type === 'coord' && key === `${e.data.row},${e.data.col}`) ||
                    (e.type === 'search' && key === e.data.name)
                )) {
                    eatQueue.push(t);
                } t.lastPushTime = now;   // 更新上一次推送时间
            }
        }
    };
    // 立即推一次，然后循环
    pushOnce();
    while (true) {
        const wait = nextTick(targets);
        await sleep(wait);
        pushOnce();
    }
}

// 吃药调度器，批量处理所有吃药请求
async function eatDispatcher() {
    let firstRun = true;
    while (true) {
        if (eatQueue.length === 0) {
            await sleep(200);
            continue;
        }

        // 合并短时间内的请求，等待1.5秒收集更多任务
        // 只有非首次才等待 1.5 s 做批量
        if (!firstRun) await sleep(1500);
        firstRun = false;

        // 再次检查队列，合并所有1.5秒内的请求
        while (isBusy) await sleep(200); // 等待空闲
        isBusy = true; // 上锁
        const batch = flushEatQueue();
        try {
            let InventoryInterface = findInGameRegion(InventoryInterfaceRo);
            //开启背包

            if (!InventoryInterface.isExist()) {
                log.info("未检测到背包界面，尝试返回主界面并打开背包");
                await genshin.returnMainUi();
                keyPress("B"); await sleep(1000);
            } else {
                log.info("检测到处于背包界面");
            }

            let FoodInterface = findInGameRegion(FoodInterfaceRo);
            if (!FoodInterface.isExist()) {
                log.info("未处于食物界面，准备点击食物界面图标");
                await findAndClick(DisabledFoodInterfaceRo); await sleep(600);// 点击食物界面图标
            } else {
                log.info("已经处于食物界面，准备点击料理区域");
            }


            // 计算提前补药的时间窗口
            const now = Date.now();
            const PRE_TIME = 5000; // 5秒提前量

            // 只处理5秒内需要补的药
            const coordTasks = batch.filter(t => t.type === 'coord' && (now - (t.lastTime || 0) + PRE_TIME >= t.time * 1000));// 行列
            const searchTasks = batch.filter(t => t.type === 'search' && (now - (t.lastTime || 0) + PRE_TIME >= t.time * 1000));// 食物名

            /* ---------- 2. 处理坐标点击 ---------- */
            if (coordTasks.length) {
                const grid = computeGridCoordinates(
                    coordTasks.map(t => t.data)
                );
                const now = Date.now();
                for (const tk of coordTasks) {
                    if (now - (tk.lastTime || 0) >= tk.time * 1000) {
                        const c = grid.find(g =>
                            g.row === tk.data.row && g.col === tk.data.col);
                        if (c) {
                            click(c.x, c.y); await sleep(50);
                            await findAndClick(UseButtonRo);
                            await handlePopupAfterUse();
                            tk.lastTime = now;
                        }
                    }
                }
            }

            /* ---------- 3. 处理搜索吃药 ---------- */
            for (const tk of searchTasks) {
                const now = Date.now();
                if (now - (tk.lastTime || 0) < tk.time * 1000) continue;
                try {
                    /* 3-2 判断是否已处于搜索界面（通过 SearchButton 是否存在） */
                    let SearchButton = findInGameRegion(SearchButtonRo);
                    if (!SearchButton.isExist()) {
                        log.info("未处于搜索界面，先点【筛选】");
                        await findAndClick(FilterButtonRo);
                        await sleep(300);
                    } else {
                        log.info("已处于搜索界面，直接点击搜索框");
                    }
                    /* 3-3 点击搜索框 -> 输入食物名 -> 确认筛选 */
                    await findAndClick(SearchButtonRo);
                    await sleep(200);
                    if (typeof inputText === 'function') {
                        inputText(tk.data.name); // 推荐：直接输入字符串
                    } else {
                        log.error("请实现 inputText 方法以支持中文输入");
                    }
                    await sleep(200);
                    await findAndClick(ConfirmFilterButtonRo);
                    await sleep(1000);
                    /* 3-4 只有 nth>1 时才需要精确定位并点击，否则直接点第 1 个 */
                    const nth = tk.data.nth || 1;

                    if (nth !== 1) {
                        // 默认第 1 个已高亮，无需再计算坐标
                        // 计算第 n 个食物坐标（一行 8 个）
                        const col = ((nth - 1) % 8) + 1;
                        const row = Math.floor((nth - 1) / 8) + 1;
                        const x = Math.round(182.5 + (col - 1) * 145);
                        const y = Math.round(197.5 + (row - 1) * 175);
                        click(x, y);
                        await sleep(300);
                    }
                    /* 3-5 使用 */
                    await findAndClick(UseButtonRo);
                    await handlePopupAfterUse();
                    /* 3-6 重置筛选 */
                    await findAndClick(FilterButtonRo);
                    await sleep(200);
                    await findAndClick(ResetButtonRo);
                    await sleep(200);

                    tk.lastTime = now;
                } catch (err) {
                    log.error(`搜索吃药流程异常: ${err.message}`);
                }
            }


            log.info("批量吃药完成，准备返回主界面");
            await genshin.returnMainUi();  // 返回主界面
        } catch (error) {
            log.error(`批量吃药时发生异常: ${error.message}`);
            await genshin.returnMainUi();  // 返回主界面
        } finally {
            isBusy = false; // 无论如何都解锁
        }
    }
}

/*********************** 主执行入口 ***********************/

(async function () {
    // 设置游戏基础参数，初始化环境
    setGameMetrics(1920, 1080, 1.25); // 设置编写脚本环境的游戏分辨率和DPI缩放
    await genshin.returnMainUi();     // 返回主界面

    // 启动吃药调度器和各组任务，并等待它们（实际上这些都是死循环，不会退出）
    await Promise.all([
        eatDispatcher(),    // 启动吃药调度器
        ...queueList.map(({ queue }) => runQueueTask(queue))    // 启动各组任务

    ]);
})();

