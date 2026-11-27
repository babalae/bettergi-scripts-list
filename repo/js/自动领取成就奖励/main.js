/**
 * 原神成就奖励自动领取脚本
 * 流程：打开成就界面 → 循环查找奖励图标 → 点击领取 → 滚动查找 → 到达底部后退出
 * 附加功能：统计"领取"按钮的点击次数，领取结束后输出总数
 */
(async function () {

// ==================== 常量定义 ====================

const SCREEN_WIDTH = 1920;                 // 默认截图区域宽度
const SCREEN_HEIGHT = 1080;                // 默认截图区域高度
const IMAGE_EXCLAIMATION = "exclamation";  // 成就奖励图标（感叹号）
const IMAGE_RECEIVE = "receive";           // 领取按钮
const SCROLL_START_X = 400;                // 滚动起点 X 坐标
const SCROLL_START_Y = 540;                // 滚动起点 Y 坐标
const SCROLL_DISTANCE = 600;               // 单次滚动距离
const LOOP_MAX_OUTER = 500;                // 外层循环最大次数
const LOOP_MAX_INNER = 1500;               // 内层循环最大次数
const BOTTOM_SCROLL_CLICKS = 4;            // 快速滚动到底部的点击次数

// ==================== 工具函数 ====================

/**
 * 检测指定区域的文字内容
 * @param {number} x - 区域的X坐标
 * @param {number} y - 区域的Y坐标
 * @param {number} width - 区域的宽度
 * @param {number} height - 区域的高度
 * @param {string|undefined} targetText - 需要匹配的目标文字（可选）
 * @returns {Promise<string|false>} - 返回检测到的文字或false
 */
async function detectTextInRegion(x, y, width, height, targetText) {
    let captureRegion;
    try {
        // 获取游戏区域截图
        captureRegion = captureGameRegion();

        // 创建OCR识别对象，指定检测区域
        const ocrRo = RecognitionObject.Ocr(x, y, width, height);

        // 在指定区域内进行OCR识别
        const resList = captureRegion.findMulti(ocrRo);

        // 如果没有识别到任何结果，返回false
        if (resList.count === 0) {
            log.info("未检测到任何文字");
            return false;
        }

        // 获取第一个识别结果
        const firstResult = resList[0];
        const detectedText = firstResult.text;

        // 如果没有传入目标文字，则只要检测到非空内容就算成功
        if (targetText === undefined) {
            return detectedText.trim() !== "" ? detectedText : false;
        }

        // 如果传入了目标文字，则进行匹配
        if (detectedText.includes(targetText)) {
            //log.info(`检测到目标文字：${targetText}`);
            return detectedText;
        }

        // log.info(`检测到文字但不匹配：${detectedText} (目标：${targetText})`);
        return false;
    } catch (error) {
        log.info("文字检测出错:", error);
        return false;
    } finally {
        // 资源释放统一到 try/finally，确保任何路径都释放
        if (captureRegion) {
            captureRegion.dispose();
        }
    }
}



/**
 * 等待图片出现并点击
 * @param {string} imageName 图片名称（不带.png后缀）
 * @param {number} [x=0] 裁剪区域左上角X坐标
 * @param {number} [y=0] 裁剪区域左上角Y坐标
 * @param {number} [width=1920] 裁剪区域宽度
 * @param {number} [height=1080] 裁剪区域高度
 * @param {number} [timeout=500] 超时时间（毫秒）
 * @param {number} [checkInterval=500] 检查间隔（毫秒），默认500毫秒
 * @returns {Promise<void>}
 * @throws 如果超时未找到图片则抛出错误
 */
// 使用示例：
// (1) 使用默认裁剪区域(0,0,1920,1080)
// await waitAndClickImage("paimon_menu");
//
// (2) 自定义裁剪区域和超时时间
// await waitAndClickImage("confirm_button", 100, 100, 800, 600, 500);
const waitAndClickImage = async (
    imageName,
    x = 0,
    y = 0,
    width = SCREEN_WIDTH,
    height = SCREEN_HEIGHT,
    timeout = 500,
    checkInterval = 500
) => {
    const startTime = Date.now();
    const imagePath = `assets/${imageName}.png`;

    // 读取模板图片
    const templateMat = file.ReadImageMatSync(imagePath);
    // 创建识别对象，使用默认阈值0.8
    const recognitionObj = RecognitionObject.TemplateMatch(templateMat, x, y, width, height);

    while (Date.now() - startTime < timeout) {
        let captureRegion;
        try {
            // 捕获游戏区域
            captureRegion = captureGameRegion();
            // 查找图片
            const result = captureRegion.Find(recognitionObj);

            if (!result.isEmpty()) {
                // log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
                result.Click();
                await sleep(300); // 点击后稍作等待
                return;
            }
        } finally {
            // 资源释放统一到 try/finally，确保任何路径都释放
            if (captureRegion) {
                captureRegion.dispose();
            }
        }

        await sleep(checkInterval);
    }

    throw new Error(`等待图片 ${imageName} 超时（${timeout}ms）`);
};

/**
 * 通过按住鼠标左键拖动来滚动页面
 * @param {number} totalDistance - 总滚动距离
 * @param {number} [stepDistance=10] - 每次滚动的步长
 * @param {number} [delayMs=5] - 每次滚动后的延迟(毫秒)
 * @returns {Promise<void>}
 */
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    moveMouseTo(SCROLL_START_X, SCROLL_START_Y);
    await sleep(50);
    leftButtonDown();

    const steps = Math.ceil(Math.abs(totalDistance) / stepDistance);
    const direction = Math.sign(totalDistance);
    for (let j = 0; j < steps; j++) {
        const remainingDistance = Math.abs(totalDistance) - j * stepDistance;
        const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        moveMouseBy(0, -moveDistance * direction); // 注意负号：向下滚动需要 y 取反
        await sleep(delayMs);
    }

    await sleep(700);
    leftButtonUp();
    await sleep(100);
}

// ==================== 主流程 ====================

// 1. 返回主界面，打开成就菜单，进入成就详细列表
log.info(`请自行确保游戏窗口为全屏，否则可能遗漏奖励！！！`);
log.info(`开始领取成就奖励`);
await genshin.returnMainUi();
await sleep(1000);
keyPress("ESCAPE");
await sleep(1000);
click(670, 420); // 点击成就入口
await sleep(2000);
click(200, 300); // 进入详细界面
await sleep(1500);

// 2. 快速滚动到列表底部（连续点击 BOTTOM_SCROLL_CLICKS 次底部区域）
for (let k = 0; k < BOTTOM_SCROLL_CLICKS; k++) {
    click(675, 990);
    await sleep(1000);
}

// 3. 循环查找可领取的成就奖励，最多尝试 LOOP_MAX_OUTER 次
let receiveClickCount = 0; // 统计"领取"按钮的点击次数
for (let j = 0; j < LOOP_MAX_OUTER; j++) {
    try {
        // 查找成就奖励图标（感叹号）并点击
        await waitAndClickImage(IMAGE_EXCLAIMATION, 600, 50, 100, 1000, 500);
        await sleep(1000);
    } catch (error) {
        // 未找到奖励图标，检查是否已到达列表底部
        await sleep(100);
        const result = await detectTextInRegion(110, 190, 150, 60, "地万象");
        if (result) {
            // 检测到结束标记，返回主界面并退出循环
			log.info(`已到达列表顶部，且无奖励图标，结束领奖`);
            await genshin.returnMainUi();
            break;
        } else {
            await sleep(100);
            // 未到顶部，向上滚动继续查找
            await scrollPage(-SCROLL_DISTANCE);
            await sleep(600);
            continue;
        }
    }

    // 4. 找到奖励图标后，循环点击"领取"按钮直到无更多奖励
    for (let i = 0; i < LOOP_MAX_INNER; i++) {
        try {
            await waitAndClickImage(IMAGE_RECEIVE);
            receiveClickCount++; // 每点击一次"领取"，计数一次
            await sleep(300);
            click(870, 420); // 关闭弹窗
            await sleep(400);
        } catch (error) {
            await sleep(400);
            break; // 无更多可领取奖励，跳出内层循环
        }
    }
}


log.info(`本次领取共点击"领取"按钮 ${receiveClickCount} 次`);


			
})();
