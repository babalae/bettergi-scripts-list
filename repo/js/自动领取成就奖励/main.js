(async function () {


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
    try {
        // 获取游戏区域截图
        let captureRegion = captureGameRegion();
        
        // 创建OCR识别对象，指定检测区域
        let ocrRo = RecognitionObject.Ocr(x, y, width, height);
        
        // 在指定区域内进行OCR识别
        let resList = captureRegion.findMulti(ocrRo);
        captureRegion.dispose();
        
        // 如果没有识别到任何结果，返回false
        if (resList.count === 0) {
            log.info("未检测到任何文字");
            return false;
        }
        
        // 获取第一个识别结果
        let firstResult = resList[0];
        let detectedText = firstResult.text;

        // 如果没有传入目标文字，则只要检测到非空内容就算成功
        if (targetText === undefined) {
            return detectedText.trim() !== "" ? detectedText : false;
        }
        
        // 如果传入了目标文字，则进行匹配
        if (detectedText.includes(targetText)) {
            log.info(`检测到目标文字：${targetText}`);
            return detectedText;
        }
        
        log.info(`检测到文字但不匹配：${detectedText} (目标：${targetText})`);
        return false;
    } catch (error) {
        log.info("文字检测出错:", error);
        return false;
    }
}
// 使用示例1：检测特定区域的文字是否为"确认"
/*
 let result = await utils.detectTextInRegion(0, 0, 400, 400, "合成");
 if (result) {
     log.info(`检测到目标文字：${result}`);
 } else {
     log.info("未检测到目标文字");
 }

*/

// 使用示例2：只检测区域是否有文字（不指定目标文字）
// let result = await detectTextInRegion(100, 200, 300, 50);
// if (result) {
//     log.info("检测到文字:", result);
// } else {
//     log.info("未检测到任何文字");
// }

/**
 * 等待图片出现并点击
 * @param {string} imageName 图片名称（不带.png后缀）
 * @param {number} [x=0] 裁剪区域左上角X坐标
 * @param {number} [y=0] 裁剪区域左上角Y坐标
 * @param {number} [width=1920] 裁剪区域宽度
 * @param {number} [height=1080] 裁剪区域高度
 * @param {number} [timeout=10000] 超时时间（毫秒），默认1秒
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
    width = 1920,
    height = 1080,
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
        // 捕获游戏区域
        const captureRegion = captureGameRegion();
        // 查找图片
        const result = captureRegion.Find(recognitionObj);
        captureRegion.dispose();
        
        if (!result.isEmpty()) {
            log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
            result.Click();
            await sleep(300); // 点击后稍作等待
            return;
        }
        
        await sleep(checkInterval);
    }
    
    throw new Error(`等待图片 ${imageName} 超时（${timeout}ms）`);
}
/**
 * 滚动页面
 * @param {number} totalDistance - 总滚动距离
 * @param {number} [stepDistance=10] - 每次滚动的步长
 * @param {number} [delayMs=5] - 每次滚动后的延迟(毫秒)
 * @returns {Promise<void>}
 */
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    moveMouseTo(400, 540);
    await sleep(50);
    leftButtonDown();
    
    const steps = Math.ceil(Math.abs(totalDistance) / stepDistance);
    const direction = Math.sign(totalDistance);
    for (let j = 0; j < steps; j++) {
        const remainingDistance = Math.abs(totalDistance) - j * stepDistance;
        const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        moveMouseBy(0, -moveDistance * direction);  // 注意这里的负号
        await sleep(delayMs);
    }
    
    await sleep(700);
    leftButtonUp();
    await sleep(100);
}

//主流程

await genshin.returnMainUi();
await sleep(1000);
keyPress("ESCAPE"); 
await sleep(1000);
click(670 ,420 );//点击成就
await sleep(2000);
click(200, 300); // 进入详细界面
await sleep(1500);
click(675, 990); // 点到底部
await sleep(1000);
click(675, 990); // 点到底部
await sleep(1000);
click(675, 990); // 点到底部
await sleep(1000);
click(675, 990); // 点到底部
await sleep(1000);
for (let j = 0; j < 500; j++) {

    try {
        await waitAndClickImage("exclamation", 600, 50, 100, 1000, 500);
        await sleep(1000);
        
    } catch (error) {
        await sleep(100);
        let result = await detectTextInRegion(110, 200, 150, 50, "天地");
        if (result) {
            log.info(`检测到目标文字：${result}`);
            await genshin.returnMainUi();
            break;
         } else {
            await sleep(100);
         }
         await scrollPage(-600);
         await sleep(600);
         continue;
    }

  for (let i = 0; i < 1500; i++) {
    try {
        await waitAndClickImage("receive");
        await sleep(500);
        click(870, 420); // 点击任意位置
        await sleep(800);
    } catch (error) {
        await sleep(500);
        break;
    }
  }

}

log.info(`领取结束`);

})();
