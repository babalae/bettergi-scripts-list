
/*********************** 配置与常量 ***********************/

// 用户输入，格式如："2,3;4,5"
const queue1 = settings.queue1 || "";
const queue2 = settings.queue2 || "";
const queue3 = settings.queue3 || "";
const queue4 = settings.queue4 || "";

const queueList = [
    { queue: queue1, seconds: 300 },
    { queue: queue2, seconds: 900 },
    { queue: queue3, seconds: 1800 },
    { queue: queue4, seconds: 1500 }
];

// 用户配置
let isBusy = false; // 全局互斥锁，控制界面操作互斥
let eatQueue = [];  // 全局吃药队列，所有任务都往这里推送目标

/*********************** 工具函数 ***********************/

// 解析用户输入，返回目标数组，得到所有目标行列
function parseTargets(queue) {
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
4.分割行列并转数字
    .map(pair => pair.split(/[，,]/).map(s => Number(s.trim())))
    支持中英文逗号分割，并把每个数字字符串转为数字类型。
    也会去除数字前后的空格。
5.只保留合法的行列对
    .filter(arr => arr.length === 2 && arr.every(n => !isNaN(n)))
    只保留长度为2且都是数字的数组，防止用户输入 "1,," 或 "a,b" 这样的无效内容。
6.转为对象格式
    .map(([row, col]) => ({ row, col }))
    最终输出为 { row: 1, col: 2 } 这样的对象，方便后续处理。
*/
    return queue
        .split(/[;；]/)                                                // ① 按中英文分号分割每组
        .map(pair => pair.trim())                                      // ② 去除每组前后空格
        .filter(pair => pair.length > 0)                               // ③ 过滤掉空字符串（防止多余分隔符导致空项）
        .map(pair => pair.split(/[，,]/).map(s => Number(s.trim())))   // ④ 按中英文逗号分割，并转为数字
        .filter(arr => arr.length === 2 && arr.every(n => !isNaN(n)))  // ⑤ 只保留合法的 [row, col] 数组
        .map(([row, col]) => ({ row, col }));                          // ⑥ 转为对象格式 {row, col}
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
                const ProcessingX = Math.round(182.5 + (col - 1) * 145);
                const ProcessingY = Math.round(197.5 + (row - 1) * 175);
                gridCoordinates.push({ row, col, x: ProcessingX, y: ProcessingY });
            }
        }
        return gridCoordinates;
    } catch (error) {
        log.error(`计算料理图标的坐标时发生异常: ${error.message}`);
    }

}

/*********************** 主要逻辑函数 ***********************/

// 定时将本组要吃的药加入全局队列
async function runQueueTask(queue, seconds) {
    const targets = parseTargets(queue);
    while (true) {
        // 极端保护：队列过长时报警并强制清空
        if (eatQueue.length > 1000) {
            log.error("警告：eatQueue 长度超过1000，已强制清空！");
            eatQueue = [];
        }
        // 到点时把本组要吃的药加入全局队列
        eatQueue.push(...targets);
        //log.info(`eatQueue 当前长度: ${eatQueue.length}`); // 日志监控
        await sleep(seconds * 1000);
    }
}

// 吃药调度器，批量处理所有吃药请求
async function eatDispatcher() {
    while (true) {
        if (eatQueue.length === 0) {
            await sleep(500);
            continue;
        }

        // 合并短时间内的请求，等待1.5秒收集更多任务
        await sleep(1500);

        // 再次检查队列，合并所有1.5秒内的请求
        while (isBusy) await sleep(200); // 等待空闲
        isBusy = true; // 上锁
        try {
            keyPress("B"); await sleep(1000);//开启背包
            click(865, 50); await sleep(100);//点击料理区域

            // 取出所有要吃的药，去重，保证每个 row,col 只点一次
            const uniqueMap = new Map();
            for (const t of eatQueue) {
                if (typeof t.row === 'number' && typeof t.col === 'number') {
                    uniqueMap.set(`${t.row},${t.col}`, { row: t.row, col: t.col });
                }
            }
            const batch = Array.from(uniqueMap.values());
            eatQueue = []; // 清空全局队列，准备下一轮

            const gridCoordinates = computeGridCoordinates(batch);

            // 点击料理图标并使用。遍历目标，查找并点击对应坐标
            for (const target of batch) {
                const coord = gridCoordinates.find(g => g.row === target.row && g.col === target.col);
                if (coord) {
                    click(coord.x, coord.y); await sleep(50);  // 点击料理图标
                    click(1760, 1025); await sleep(50);        // 点击使用
                }
            }
            await genshin.returnMainUi();  // 返回主界面
        } catch (error) {
            log.error(`批量吃药时发生异常: ${error.message}`);
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
        ...queueList.map(({ queue, seconds }) => runQueueTask(queue, seconds))    // 启动各组任务

    ]);
})();

