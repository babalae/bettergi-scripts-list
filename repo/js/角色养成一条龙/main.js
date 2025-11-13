const COMPLETED_TASKS_FILE = "./completed_tasks.json";
let skipCheckStamina = 1;//为0时跳过检查体力
let messageBuffer = '';
// 累积消息函数
function addNotification(message) {
    messageBuffer += message + '\n';
}

// 发送累积的消息
function sendBufferedNotifications() {
    if (messageBuffer.trim()) {
        notification.send(messageBuffer.trim());
        messageBuffer = ''; // 清空缓冲区
    }
}

// 添加函数来读写已完成任务记录
async function loadCompletedTasks() {
    try {
        if (file.isFolder(COMPLETED_TASKS_FILE)) {
            return {};
        }
        const content = await file.readText(COMPLETED_TASKS_FILE);
        return JSON.parse(content);
    } catch (error) {
        // 如果文件不存在或其他错误，返回空对象
        return {};
    }
}

async function saveCompletedTasks(tasks) {
    try {
        await file.writeText(COMPLETED_TASKS_FILE, JSON.stringify(tasks, null, 2));
        log.info("已保存完成任务记录");
    } catch (error) {
        log.error(`保存任务记录失败: ${error}`);
    }
}

async function addCompletedTask(materialType, materialName, requireCounts) {
    const tasks = await loadCompletedTasks();
    const taskKey = `${materialType}_${materialName}`;
    
    tasks[taskKey] = {
        materialType,
        materialName,
        requireCounts,
        completedAt: new Date().toISOString()
    };
    
    await saveCompletedTasks(tasks);
    log.info(`已标记 ${materialName} 为完成`);
}

async function isTaskCompleted(materialType, materialName, currentRequireCounts) {
    const tasks = await loadCompletedTasks();
    const taskKey = `${materialType}_${materialName}`;
    
    if (!tasks[taskKey]) {
        return false;
    }
    
    // 检查需求数量是否相同
    const previousRequireCounts = tasks[taskKey].requireCounts;
    if (Array.isArray(previousRequireCounts) && Array.isArray(currentRequireCounts)) {
        return previousRequireCounts.join(',') === currentRequireCounts.join(',');
    } else {
        return previousRequireCounts === currentRequireCounts;
    }
}

//获取BOSS材料数量
async function getBossMaterialCount(bossName) {
await genshin.returnMainUi();
await sleep(500);
keyPress("F1");
await repeatOperationUntilTextFound({x: 250,y: 520,width: 100,height: 60,targetText: "讨伐",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await repeatOperationUntilTextFound({x: 380,y: 180,width: 100,height: 50,targetText: "全部",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await repeatOperationUntilTextFound({x: 400,y: 360,width: 100,height: 50,targetText: "精英",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await sleep(500);
await repeatOperationUntilTextFound({x: 380,y: 180,width: 100,height: 50,targetText: "精英",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await sleep(500);
await repeatOperationUntilTextFound({x: 400,y: 420,width: 100,height: 50,targetText: "首领",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
await sleep(500);
click(956,844);await sleep(500);//点到最后
click(956,844);await sleep(500);//点到最后
await waitAndClickImage('boss/wolf');//点击狼王图标，避免其他图标识别失败
click(958,286);await sleep(500);//返回最上边
click(958,286);await sleep(500);//返回最上边
log.info(`正在查询数量`);
        try {
            const targetImageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/boss/${bossName}.png`), 0, 0, 1920,1080);
            targetImageRo.Threshold = 0.95;
            const stopImageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/boss/无相之风.png"), 0, 0, 1920,1080);
            stopImageRo.Threshold = 0.95;
            await findAndClickWithScroll(targetImageRo, stopImageRo, {maxAttempts: 30,scrollNum: 9});
            if(bossName == '冰风组曲-科培琉司的劫罚') await waitAndClickImage("好感图标", 160, 30);
            else await waitAndClickImage("好感图标", 80, 30);
            await sleep(800);
            const result = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
            if (result !== false) {
                const quantity = positiveIntegerJudgment(result);
                log.info(`识别到${bossName}材料数量: ${quantity}`);
                return quantity;
            } else {
                log.warn(`${bossName}材料识别失败，请检查相关设置`);
            }
        } catch (error) {
        notification.send(`${bossName}材料刷取失败，错误信息: ${error}`);
        return 0;
        }
}

/**
 * 寻找特定图片并点击，未找到则滚动画面
 * @param {RecognitionObject} targetRo - 要寻找并点击的目标图片识别对象
 * @param {RecognitionObject} stopRo - 终止条件的图片识别对象(遇到此图片则停止)
 * @param {Object} options - 配置选项
 * @param {number} [options.maxAttempts=10] - 最大尝试次数
 * @param {number} [options.scrollDelay=1000] - 滚动后的等待时间(毫秒)
 * @param {number} [options.clickDelay=500] - 点击后的等待时间(毫秒)
 * @returns {Promise<void>}
 * @throws {Error} 当达到最大尝试次数或遇到终止图片时抛出错误
 */
async function findAndClickWithScroll(targetRo, stopRo, options = {}) {
    const {
        maxAttempts = 10,
        scrollNum = 9,
        clickDelay = 500
    } = options;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 1. 捕获当前游戏区域
        const captureRegion = captureGameRegion();
        
        // 3. 寻找目标图片
        const targetResult = captureRegion.find(targetRo);
        if (!targetResult.isEmpty()) {
            // 找到目标，点击并返回
            log.info(`找到目标图片，位置: (${targetResult.x}, ${targetResult.y})`);
            targetResult.click();
            captureRegion.dispose();
            await sleep(clickDelay);
            return;
        }

        // 4. 未找到目标，滚动画面
        log.info(`第 ${attempt + 1} 次尝试未找到目标图片，将滚动画面...`);
        for (let i = 0; i < scrollNum; i++) {
            await keyMouseScript.runFile("assets/滚轮下滑.json");
        }

        // 2. 检查是否遇到终止图片
        const stopResult = captureRegion.find(stopRo);
        captureRegion.dispose();
        if (!stopResult.isEmpty()) {
            throw new Error(`遇到终止图片，停止寻找目标图片。终止位置: (${stopResult.x}, ${stopResult.y})`);
        }
    }
    
    // 达到最大尝试次数仍未找到
    throw new Error(`在 ${maxAttempts} 次尝试后仍未找到目标图片`);
}

//执行战斗并检测结束																		
async function restoredEnergyAutoFightAndEndDetection() {
await genshin.tp(178.55,384.4);
await repeatOperationUntilTextFound();//
keyPress("F"); 
await repeatOperationUntilTextFound({x: 1650,y: 1000,width: 160,height: 45,targetText: "单人挑战",stepDuration: 0,waitTime: 100,ifClick: true});//等待点击单人挑战
await sleep(200);
click(1180, 760);//队伍等级偏低、体力不够可能会出弹窗
await repeatOperationUntilTextFound({x: 1650,y: 1000,width: 160,height: 45,targetText: "开始挑战",stepDuration: 0,waitTime: 100,ifClick: true});//等待点击开始挑战
await sleep(2000);
await tpEndDetection();
keyDown("w");
await sleep(200);
keyDown("SHIFT");
await sleep(300);
keyUp("SHIFT");
await sleep(500);
keyDown("SHIFT");
await sleep(300);
keyUp("SHIFT");
await sleep(1000);
keyDown("SHIFT");
await sleep(300);
keyUp("SHIFT");
await sleep(500);
keyUp("w");
let challengeTime = 0;
    //2分钟兜底
    while (challengeTime < 5000) {
            for (let i = 1;i < 5; i++) {
            keyPress(i.toString()); 
            await sleep(300);
            leftButtonClick();
            await sleep(400);
            keyDown("e"); 
            await sleep(400);
            keyUp("e"); 
            await sleep(500);
            leftButtonClick();
            await sleep(100);
            let ro = captureGameRegion();
            let res = ro.find(RecognitionObject.ocr(840, 935, 230, 40));
            ro.dispose();
            if (res.text.includes("自动退出")) {
                     log.info("检测到挑战成功");
                     return;
                }
            }
        challengeTime = challengeTime + 200;
        await sleep(100);
        } 
log.info("挑战超时，可能充能失败");
}

async function restoredEnergy() {
await genshin.returnMainUi();
await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像，避免有倒下的角色
await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
 log.info("能量充满，任务结束");
await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
}
//征讨之花领奖(图标识别)
const autoNavigateToReward = async () => {
        // 定义识别对象
        const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));
        const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测
        let advanceNum = 0;//前进次数
        //调整为俯视视野
        middleButtonClick();
        await sleep(800);
        moveMouseBy(0, 1030);
        await sleep(400);
        moveMouseBy(0, 920);
        await sleep(400);
        moveMouseBy(0, 710);
        log.info("开始领奖");
    while (true) {
        // 1. 优先检查是否已到达领奖点
        let captureRegion = captureGameRegion();
        let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
        let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
        // 检测到特点文字则结束！！！ 
        if (rewardResult.text == "接触征讨之花") {
            log.info(`总计前进第${advanceNum}次`);
            log.info("已到达领奖点，检测到文字: " + rewardResult.text);
            captureRegion.dispose();
            return;
        }
        else if(advanceNum > 150){
            log.info(`总计前进第${advanceNum}次`);
            captureRegion.dispose();
            throw new Error('前进时间超时');
        }
        // 2. 未到达领奖点，则调整视野
        for(let i = 0; i < 100; i++){
            captureRegion = captureGameRegion();
            let iconRes = captureRegion.Find(boxIconRo);
            let climbTextArea = captureRegion.DeriveCrop(1685, 1030, 65, 25);
            let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
            captureRegion.dispose();
            climbTextArea.dispose();
            // 检查是否处于攀爬状态
            if (climbResult.text == "Space"){
            log.info("检侧进入攀爬状态，尝试脱离");
            keyPress("x");
            await sleep(1000);
            keyDown("a");
            await sleep(800);
            keyUp("a");
            keyDown("w");
            await sleep(800);
            keyUp("w");
            }
            if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {
                advanceNum++;
                break;
            } else {
                // 小幅度调整
                if(iconRes.y >= 520)  moveMouseBy(0, 920);
                let adjustAmount = iconRes.x < 920 ? -20 : 20;
                let distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
                let scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
                let adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
                moveMouseBy(adjustAmount * adjustAmount2, 0);
                await sleep(100);
            }
            if(i > 20) {
                throw new Error('视野调整超时');
            }
    }
        // 3. 前进一小步
        keyDown("w");
        await sleep(200);
        keyUp("w");

    }
}

//检查是否为正整数
function positiveIntegerJudgment(testNumber) {
    // 如果输入是字符串，尝试转换为数字
    if (typeof testNumber === 'string') {
        // 移除可能存在的非数字字符（如空格、百分号等）
        const cleaned = testNumber.replace(/[^\d]/g, '');
        testNumber = parseInt(cleaned, 10);
    }
    
    // 检查是否为有效的数字
    if (typeof testNumber !== 'number' || isNaN(testNumber)) {
        throw new Error(`无效的值: ${testNumber} (必须为数字)`);
    }
    
    // 检查是否为整数
    if (!Number.isInteger(testNumber)) {
        throw new Error(`必须为整数: ${testNumber}`);
    }
    
    return testNumber;
}

async function queryStaminaValue() {
    try {
        await genshin.returnMainUi();
        await sleep(2500);
        keyPress("F1"); 
        await sleep(1800);
        click(300, 540);
        await sleep(500);
        click(1570, 203);
        await sleep(800);
        let captureRegion = captureGameRegion();
        let stamina = captureRegion.find(RecognitionObject.ocr(1580, 20, 210, 55));
        captureRegion.dispose();
        log.info(`OCR原始文本：${stamina.text}`);
        const staminaText = stamina.text.replace(/\s/g, ''); // 移除所有空格
         const standardMatch = staminaText.match(/(\d+)/);
            if (standardMatch) {
                const currentValue = standardMatch[1];
                let validatedStamina = positiveIntegerJudgment(currentValue);
                if (validatedStamina > 11200) validatedStamina = (validatedStamina-1200)/10000;
           log.info(`返回体力值：${validatedStamina}`);
           return validatedStamina;
            }
    } catch (error) {
        log.error(`体力识别失败：${error.message}，默认为零`);
        await genshin.returnMainUi();
        return 0;
    }      
}

//检测传送结束  await tpEndDetection();
async function tpEndDetection() {
    const region1 = RecognitionObject.ocr(1690, 230, 75, 350);// 队伍名称区域
    const region2 = RecognitionObject.ocr(872, 681, 180, 30);// 点击任意处关闭
    let tpTime = 0;
    await sleep(1500);//点击传送后等待一段时间避免误判
    //最多30秒传送时间
    while (tpTime < 300) {

        let capture = captureGameRegion();
        let res1 = capture.find(region1);
        let res2 = capture.find(region2);
        capture.dispose();
        if (!res1.isEmpty()|| !res2.isEmpty()){
            log.info("传送完成");
            await sleep(1000);//传送结束后有僵直
            click(960, 810);//点击任意处
            await sleep(500);
            return;
        }
        tpTime++;
        await sleep(100);
    }
    throw new Error('传送时间超时');
}

/**
 * 自动导航直到检测到指定文字
 * @param {Object} options 配置选项
 * @param {number} [options.x=1210] 检测区域左上角x坐标
 * @param {number} [options.y=515] 检测区域左上角y坐标
 * @param {number} [options.width=200] 检测区域宽度
 * @param {number} [options.height=50] 检测区域高度
 * @param {string|RegExp} [options.targetText="奖励"] 要检测的目标文字
 * @param {number} [options.maxSteps=100] 最大检查次数
 * @param {number} [options.stepDuration=200] 每步前进持续时间(ms)
 * @param {number} [options.waitTime=10] 单次等待时间(ms)
 * @param {string} [options.moveKey="w"] 前进按键
 * @param {boolean} [options.ifClick=false] 是否点击
 * @returns {Promise<void>}
 * await repeatOperationUntilTextFound();  默认F区域检测到任何文字即停止前进
 * await repeatOperationUntilTextFound({targetText: "日落果"});  F区域检测到指定文字即停止前进
 *await repeatOperationUntilTextFound({x: 10,y: 10,width: 100,height: 100,targetText: "奖励",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
 */
const repeatOperationUntilTextFound = async ({
    //默认区域为单个F图标右边的文字，最多6个
    x = 1210,
    y = 515,
    width = 200,
    height = 50,
    targetText = null,
    maxSteps = 100,
    stepDuration = 200,
    waitTime = 10,
    moveKey = "w",
    ifClick = false,
} = {}) => {
    /**
     * 转义正则表达式中的特殊字符
     * @param {string} string 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // 预编译正则表达式（如果是字符串则转换并转义）
    const textPattern = typeof targetText === 'string' 
        ? new RegExp(escapeRegExp(targetText)) 
        : targetText;
    
    let stepsTaken = 0;
    
    while (stepsTaken <= maxSteps) {
        // 1. 捕获游戏区域并裁剪出检测区域
        const captureRegion = captureGameRegion();
        const textArea = captureRegion.DeriveCrop(x, y, width, height);
        
        // 2. 执行OCR识别
        const ocrResult = textArea.find(RecognitionObject.ocrThis);
        captureRegion.dispose();
        textArea.dispose();
        
        const hasAnyText = ocrResult.text.trim().length > 0;
        const matchesTarget = targetText === null 
            ? hasAnyText 
            : textPattern.test(ocrResult.text);

        if (matchesTarget) {
            log.info(`检测到${targetText === null ? '文字' : '目标文字'}: ${ocrResult.text}`);
            await sleep(500);
            if (ifClick) click(Math.round(x + width / 2), Math.round(y + height / 2));
            return true;
        }

        // 4. 检查步数限制
        if (stepsTaken >= maxSteps) {
            throw new Error(`检查次数超过最大限制: ${maxSteps}，未查询到文字"${targetText}"`);
        }
        
        // 5. 前进一小步
        if (stepDuration != 0) {
        keyDown(moveKey);
        await sleep(stepDuration);
        keyUp(moveKey);
        }
        await sleep(waitTime);
        stepsTaken++;
    }
}

/**
 * 等待图片出现并点击
 * @param {string} imageName 图片名称（不带.png后缀且在assets文件中）
 * @param {number} [timeout=10000] 超时时间（毫秒），默认10秒
 * @param {number} [checkInterval=500] 检查间隔（毫秒），默认500毫秒
 * @returns {Promise<void>}
 * @throws 如果超时未找到图片则抛出错误
 */
// 使用示例：
// await waitAndClickImage("paimon_menu");
//
// (2) 自定义偏移量
// await waitAndClickImage("confirm_button", 700, 0);
const waitAndClickImage = async (
    imageName,
    extraWidth = 0,
    extraHeight = 0,
    ifClick = true,
    timeout = 10000,
    checkInterval = 500,
threshold = 0.8 // 新增阈值参数，默认值0.8
) => {
    const startTime = Date.now();
    const imagePath = `assets/${imageName}.png`;
    
    // 读取模板图片
    const templateMat = file.ReadImageMatSync(imagePath);
    // 创建识别对象，使用默认阈值0.8
    const recognitionObj = RecognitionObject.TemplateMatch(templateMat, 0, 0, 1920, 1080);
    recognitionObj.threshold = threshold;
    while (Date.now() - startTime < timeout) {
        // 捕获游戏区域
        const captureRegion = captureGameRegion();
        // 查找图片
        const result = captureRegion.Find(recognitionObj);
        captureRegion.dispose();
        
        if (!result.isEmpty()) {
            log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
            if (ifClick) click(result.x+extraWidth,result.y+extraHeight);
            await sleep(300); // 点击后稍作等待
            return true;
        }

        await sleep(checkInterval);
    }
    
    throw new Error(`等待图片 ${imageName} 超时`);
}

/**
 * 在游戏画面中查找指定图片并在其附近进行OCR识别
 * @param {string} imagePath - 模板图片路径
 * @param {number} ocrWidth - OCR区域宽度
 * @param {number} ocrHeight - OCR区域高度
 * @param {number} offsetX - OCR区域相对于模板匹配结果的X偏移
 * @param {number} offsetY - OCR区域相对于模板匹配结果的Y偏移
 * @returns {Promise<string|boolean>} - 返回OCR识别结果，失败返回false
 */
async function findImageAndOCR(imagePath, ocrWidth, ocrHeight, offsetX, offsetY) {
    try {
        // 1. 读取模板图片并创建识别对象
        const templateMat = file.ReadImageMatSync(imagePath);
        const templateRo = RecognitionObject.TemplateMatch(templateMat);
        
        // 2. 捕获游戏区域并查找模板图片
        const captureRegion = captureGameRegion();
        const foundRegion = captureRegion.Find(templateRo);
        
        if (foundRegion.isEmpty()) {
            log.info(`未找到模板图片: ${imagePath}`);
            captureRegion.dispose();
            return false;
        }
        
        log.info("找到模板图片，位置({x},{y})", foundRegion.x, foundRegion.y);
        
        // 3. 计算OCR区域位置（基于模板匹配结果的位置+偏移量）
        const ocrX = foundRegion.x + offsetX;
        const ocrY = foundRegion.y + offsetY;
        
        // 4. 创建OCR识别对象并识别
        const ocrRo = RecognitionObject.Ocr(ocrX, ocrY, ocrWidth, ocrHeight);
        const ocrResult = captureRegion.Find(ocrRo);
        captureRegion.dispose();
        
        if (ocrResult.isEmpty() || !ocrResult.text || ocrResult.text.trim() === "") {
            log.info("OCR未识别到内容");
            return false;
        }
        
        log.info("OCR识别结果: {text}", ocrResult.text);
        return ocrResult.text.trim();
        
    } catch (error) {
        log.error("识别过程中出错: {error}", error);
        return false;
    }
}


//前往刷天赋书或者武器(必须保证在材料介绍页面)await gotoAutoDomain(imageName = "weaponDomain");
async function gotoAutoDomain(imageName = "bookDomain") {
await sleep(1000);

 //拖动操作，避免文本描述太长，导致副本传送图标消失
moveMouseTo(960, 580);//重置鼠标位置,居中
leftButtonDown();
await sleep(500);
moveMouseTo(965, 700);
await sleep(500);
moveMouseTo(961, 300);
await sleep(500);
leftButtonUp();
await sleep(500);
moveMouseTo(50, 50);//移动鼠标到左上角，避免检测失败
await sleep(400);
    
await waitAndClickImage(imageName);
    try {
 await repeatOperationUntilTextFound({x: 1640,y: 960,width: 200,height: 100,targetText: "传送",stepDuration: 0, maxSteps:25, waitTime:100,ifClick: true});//用来等待点击文字,10s等待
    } catch (error) {
     log.info("秘境未开启");
     await genshin.returnMainUi();
     throw new Error(`秘境未在开启时间，跳过执行`);
 } 
log.info("开始前往天赋本秘境");
await sleep(1000);
await tpEndDetection();
await sleep(3000);//枫丹天赋材料本门口有水晶碟，可能影响
await repeatOperationUntilTextFound();
keyPress("F");
await repeatOperationUntilTextFound({x: 1650,y: 1000,width: 160,height: 45,targetText: "单人挑战",stepDuration: 0,waitTime: 100});//等待点击单人挑战
await dispatcher.runTask(new SoloTask("AutoDomain", {  SpecifyResinUse: true,  
// 原粹树脂刷取次数  
OriginalResinUseCount: 1,   
// 浓缩树脂刷取次数    
CondensedResinUseCount: 0,  
// 须臾树脂刷取次数  
TransientResinUseCount: 0,   
// 脆弱树脂刷取次数  
FragileResinUseCount: 0  
}));
}
// 技能书与国家、行列位置的映射
const bookToPosition = {
    // 蒙德
    "自由": {country: "蒙德天赋", row: 0},
    "抗争": {country: "蒙德天赋", row: 1},
    "诗文": {country: "蒙德天赋", row: 2},
    // 璃月
    "繁荣": {country: "璃月天赋", row: 0},
    "勤劳": {country: "璃月天赋", row: 1},
    "黄金": {country: "璃月天赋", row: 2},
    // 稻妻
    "浮世": {country: "稻妻天赋", row: 0},
    "风雅": {country: "稻妻天赋", row: 1},
    "天光": {country: "稻妻天赋", row: 2},
    // 须弥
    "净言": {country: "须弥天赋", row: 0},
    "巧思": {country: "须弥天赋", row: 1},
    "笃行": {country: "须弥天赋", row: 2},
    // 枫丹
    "公平": {country: "枫丹天赋", row: 0},
    "正义": {country: "枫丹天赋", row: 1},
    "秩序": {country: "枫丹天赋", row: 2},
    // 纳塔
    "角逐": {country: "纳塔天赋", row: 0},
    "焚燔": {country: "纳塔天赋", row: 1},
    "纷争": {country: "纳塔天赋", row: 2},
    //挪德卡莱
    "浪迹": {country: "挪德卡莱天赋", row: 2},
    "乐园": {country: "挪德卡莱天赋", row: 1},
    "月光": {country: "挪德卡莱天赋", row: 0}

};

// 品质对应的列位置
const qualityPositions = [
    {x: 1101, y: 0}, // 绿色 (0,0)
    {x: 1180, y: 0}, // 蓝色 (0,1)
    {x: 1260, y: 0}  // 紫色 (0,2)
];

// 武器材料与国家、行列位置的映射
const weaponMaterialToPosition = {
    // 蒙德
    "高塔孤王": {country: "蒙德武器", row: 0},
    "凛风奔狼": {country: "蒙德武器", row: 1},
    "狮牙斗士": {country: "蒙德武器", row: 2},
    // 璃月
    "孤云寒林": {country: "璃月武器", row: 0},
    "雾海云间": {country: "璃月武器", row: 1},
    "漆黑陨铁": {country: "璃月武器", row: 2},
    // 稻妻
    "远海夷地": {country: "稻妻武器", row: 0},
    "鸣神御灵": {country: "稻妻武器", row: 1},
    "今昔剧话": {country: "稻妻武器", row: 2},
    // 须弥
    "谧林涓露": {country: "须弥武器", row: 0},
    "绿洲花园": {country: "须弥武器", row: 1},
    "烈日威权": {country: "须弥武器", row: 2},
    // 枫丹
    "幽谷弦音": {country: "枫丹武器", row: 0},
    "纯圣露滴": {country: "枫丹武器", row: 1},
    "无垢之海": {country: "枫丹武器", row: 2},
    // 纳塔
    "贡祭炽心": {country: "纳塔武器", row: 0},
    "谵妄圣主": {country: "纳塔武器", row: 1},
    "神合秘烟": {country: "纳塔武器", row: 2},
    //挪德卡莱
    "终北遗嗣": {country: "挪德卡莱武器", row: 2},
    "长夜燧火": {country: "挪德卡莱武器", row: 1},
    "奇巧秘器": {country: "挪德卡莱武器", row: 0}
};

// 武器材料品质对应的列位置和品质名称（4种品质）
const weaponQualityPositions = [
    {x: 1096, y: 0, quality: "绿色"}, // (0,0)
    {x: 1178, y: 0, quality: "蓝色"}, // (0,1)
    {x: 1259, y: 0, quality: "紫色"}, // (0,2)
    {x: 1341, y: 0, quality: "金色"}  // (0,3)
];


/**
 * 获取指定技能书的材料数量
 * @param {string} bookName 技能书名称
 * @returns {Array<number>} 返回一个包含三个数字的数组，分别代表绿色、蓝色、紫色品质的材料数量
 */
async function getMaterialCount(bookName) {
    // 检查输入的技能书名称是否有效
    if (!bookToPosition.hasOwnProperty(bookName)) {
        log.error("无效的技能书名称: " + bookName);
        return [0, 0, 0];
    }
    
    const {country, row} = bookToPosition[bookName];
    const results = [0, 0, 0];
    
    try {
        await genshin.returnMainUi();
        await sleep(500);
        keyPress("F1");
        await repeatOperationUntilTextFound({x: 250,y: 420,width: 100,height: 60,targetText: "秘境",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
        await repeatOperationUntilTextFound({x: 415,y: 390,width: 300,height: 80,targetText: "天赋",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
        // 1. 进入对应国家的副本
        log.info(`正在点击${country}副本...`);
        try {
        await waitAndClickImage(country, 700, 35, true, 1000);
        } catch (error) {
        await sleep(500);
        moveMouseTo(1600, 300);
        leftButtonDown();
        await sleep(500);
       moveMouseTo(1600, 700);
        await sleep(500);
        moveMouseTo(1600, 500);
        await sleep(100);
        leftButtonUp();
        await sleep(1000);
        await waitAndClickImage(country, 700, 35, true, 3000);
        }
        // 等待加载
        await sleep(500);
        
        // 2. 遍历三种品质的材料
        for (let col = 0; col < 3; col++) {
            // 计算点击位置 (使用你提供的点位信息)
            const clickX = qualityPositions[col].x;
            const clickY = 504 + row * 105; // 每行间隔约105像素
            
            // 点击材料
            log.info(`点击位置: (${clickX}, ${clickY})`);
            click(clickX, clickY);
            
            // 等待材料详情界面加载
            await sleep(400);
            
            // 3. OCR识别数量
            const result = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
            if (result !== false) {
                const quantity = positiveIntegerJudgment(result);
                results[col] = quantity;
                log.info(`识别到${["绿色", "蓝色", "紫色"][col]}品质材料数量: ${quantity}`);
            } else {
                log.warn("识别失败，将重试...");
                // 简单重试机制
                click(clickX, clickY);
                await sleep(1500);
                const retryResult = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                results[col] = retryResult !== false ? positiveIntegerJudgment(retryResult) : 0;
            }
            
            // 4. 点击空白处返回
            if( col != 2 ) click(800, 10);
            await sleep(1000);
        }
        
        return results;
    } catch (error) {
        log.error("获取材料数量时出错: " + error);
        // 出错时尝试返回
        return results;
    }
}



/**
 * 获取指定武器材料的数量
 * @param {string} materialName 武器材料名称
 * @returns {Array<number>} 返回一个包含四个数字的数组，分别代表绿色、蓝色、紫色、金色品质的材料数量
 */
async function getWeaponMaterialCount(materialName) {
    // 检查输入的武器材料名称是否有效
    if (!weaponMaterialToPosition.hasOwnProperty(materialName)) {
        log.error("无效的武器材料名称: " + materialName);
        return [0, 0, 0, 0];
    }
    
    const {country, row} = weaponMaterialToPosition[materialName];
    const results = [0, 0, 0, 0];
    
    try {
        await genshin.returnMainUi();
        await sleep(500);
        keyPress("F1");
        await repeatOperationUntilTextFound({x: 250,y: 420,width: 100,height: 60,targetText: "秘境",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
        await repeatOperationUntilTextFound({x: 415,y: 300,width: 300,height: 80,targetText: "武器",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
        // 1. 进入对应国家的副本
        log.info(`正在点击${country}副本...`);
        try {
        await waitAndClickImage(country, 700, 35, true, 1000);
        } catch (error) {
        await sleep(500);
        moveMouseTo(1600, 300);
        leftButtonDown();
        await sleep(500);
       moveMouseTo(1600, 700);
        await sleep(500);
        moveMouseTo(1600, 500);
        await sleep(100);
        leftButtonUp();
        await sleep(1000);
        await waitAndClickImage(country, 700, 35, true, 3000);
        }
        // 等待加载
        await sleep(500);
        
        // 2. 遍历四种品质的材料
        for (let col = 0; col < 4; col++) {
            const {x, y, quality} = weaponQualityPositions[col];
            const clickX = x;
            const clickY = 502 + row * 107; // 每行间隔约107像素
            
            // 点击材料
            log.info(`点击${quality}品质材料位置: (${clickX}, ${clickY})`);
            click(clickX, clickY);
            
            // 等待材料详情界面加载
            await sleep(400);
            
            // 3. OCR识别数量
            const result = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
            if (result !== false) {
                const quantity = positiveIntegerJudgment(result);
                results[col] = quantity;
                log.info(`识别到${quality}品质材料数量: ${quantity}`);
            } else {
                log.warn(`${quality}品质识别失败，将重试...`);
                // 简单重试机制
                click(clickX, clickY);
                await sleep(1500);
                const retryResult = await findImageAndOCR("assets/itemQuantityDetection.png", 200, 50, 0, 0);
                results[col] = retryResult !== false ? positiveIntegerJudgment(retryResult) : 0;
            }
            
            // 4. 点击空白处返回
            if( col != 3 ) click(800, 10);
            await sleep(500);
        }
        
        return {
            green: results[0],  // 绿色
            blue: results[1],   // 蓝色
            purple: results[2], // 紫色
            gold: results[3]    // 金色
        };
    } catch (error) {
        log.error("获取武器材料数量时出错: " + error);
        await sleep(1000);
        return {
            green: 0,
            blue: 0,
            purple: 0,
            gold: 0
        };
    }
}

//去刷天赋书
async function getTalentBook(materialName,bookRequireCounts) {
while(1){
log.info(`准备刷取天赋书，开始检查体力`);
let afterStamina = 0;
let res = 9999999;
if(skipCheckStamina)afterStamina = await queryStaminaValue();
if(afterStamina< 20) skipCheckStamina = 0;
    if ( afterStamina >= 20 ){       
             try {
             log.info(`体力充足，开始检测物品数量`);
             let bookCounts = await getMaterialCount(materialName);
             res = 0.12*(bookRequireCounts[0]-bookCounts[0])+0.36*(bookRequireCounts[1]-bookCounts[1])+(bookRequireCounts[2]-bookCounts[2]);
             if(res>0){
              log.info(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
              await gotoAutoDomain();
             } 
             else {
             addNotification(`${materialName}天赋书数量已经满足要求！！！`);
             await addCompletedTask("talent", materialName, bookRequireCounts);
             return;
              }
             }
             catch (error) {  
             notification.send(`${materialName}天赋书刷取失败，错误信息: ${error}`);
             await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
             if (error.message != '秘境未在开启时间，跳过执行'){
             let bookCounts = await getMaterialCount(materialName);
             res = 0.12*(bookRequireCounts[0]-bookCounts[0])+0.36*(bookRequireCounts[1]-bookCounts[1])+(bookRequireCounts[2]-bookCounts[2]);
             }
              addNotification(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
             return;
       }
     }
       else{
             log.info(`体力值为${afterStamina},可能无法刷取${materialName}天赋书`);
             const bookCounts = await getMaterialCount(materialName);
             let res = 0.12*(bookRequireCounts[0]-bookCounts[0])+0.36*(bookRequireCounts[1]-bookCounts[1])+(bookRequireCounts[2]-bookCounts[2]);
             if(res <= 0){
             await addCompletedTask("talent", materialName, bookRequireCounts);
             addNotification(`${materialName}天赋书数量已经满足要求！！！`);
             } 
             else addNotification(`${materialName}天赋书大约还差${res.toFixed(2)}本紫色品质没有刷取`);
             return;
         }
}
}

//去刷武器材料
async function getWeaponMaterial(materialName,weaponRequireCounts) {
while(1){
log.info(`准备刷取武器材料，开始检查体力`);
let afterStamina = 0;
let res = 99999999;
if(skipCheckStamina)afterStamina = await queryStaminaValue();
if(afterStamina< 20) skipCheckStamina = 0;
    if ( afterStamina >= 20 ){       
             try {
             log.info(`体力充足，开始检测物品数量`);
             let weaponCounts = await getWeaponMaterialCount(materialName);
             res = 0.12*(weaponRequireCounts[0]-weaponCounts.green)+0.36*(weaponRequireCounts[1]-weaponCounts.blue)+(weaponRequireCounts[2]-weaponCounts.purple)+3*(weaponRequireCounts[3]-weaponCounts.gold);
             if(res>0){
              log.info(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
              await gotoAutoDomain("weaponDomain");
             } 
             else {
             addNotification(`武器材料${materialName}数量已经满足要求！！！`);
             await addCompletedTask("wepon", materialName, weaponRequireCounts);
             return;
             }
             }
             catch (error) {  
             addNotification(`武器材料${materialName}刷取失败，错误信息: ${error}`);
             await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
             if (error.message != '秘境未在开启时间，跳过执行'){
             const weaponCounts = await getWeaponMaterialCount(materialName);
             res = 0.12*(weaponRequireCounts[0]-weaponCounts.green)+0.36*(weaponRequireCounts[1]-weaponCounts.blue)+(weaponRequireCounts[2]-weaponCounts.purple)+3*(weaponRequireCounts[3]-weaponCounts.gold);
             }
             addNotification(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
             return;
             }
       }
       else{
             log.info(`体力值为${afterStamina},可能无法刷取武器材料${materialName}`);
             const weaponCounts = await getWeaponMaterialCount(materialName);
             let res = 0.12*(weaponRequireCounts[0]-weaponCounts.green)+0.36*(weaponRequireCounts[1]-weaponCounts.blue)+(weaponRequireCounts[2]-weaponCounts.purple)+3*(weaponRequireCounts[3]-weaponCounts.gold);
             if(res <= 0){
             await addCompletedTask("wepon", materialName, weaponRequireCounts);
             addNotification(`武器材料${materialName}数量已经满足要求！！！`);
             } 
             else addNotification(`武器材料${materialName}大约还差${res.toFixed(2)}个紫色品质没有刷取`);
             return;
         }
}
}

//去刷boss材料
async function getBossMaterial(bossName,bossRequireCounts) {
while(1){
log.info(`准备刷取 boss 材料，开始检查体力`);
let afterStamina = 0;
let res = 99999999;
if(skipCheckStamina)afterStamina = await queryStaminaValue();
if(afterStamina< 20) skipCheckStamina = 0;
    if ( afterStamina >= 40 ){       
             try {
             log.info(`体力充足，开始检测物品数量`);
             let bossCounts = await getBossMaterialCount(bossName);
             res = bossRequireCounts-bossCounts;
             if(res>0){
                     log.info(`${bossName}还差${res}个材料没有刷取`);
                     if(!settings.teamName) throw new Error('未输入队伍名称');
                     await genshin.returnMainUi();
                     await genshin.switchParty(settings.teamName);
                     if(settings.energyMax) await restoredEnergy();
                     else await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
                     log.info(`前往讨伐${bossName}`);
                     await pathingScript.runFile(`assets/goToBoss/${bossName}前往.json`);
                     await sleep(1000);
                     log.info(`开始战斗`);
                     try {
                         await dispatcher.runTask(new SoloTask("AutoFight"));
                     } catch (error) {
                         //失败后最多只挑战一次，因为两次都打不过，基本上没戏，干脆直接报错结束
                         log.info(`挑战失败，再来一次`);
                         await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
                         await pathingScript.runFile(`assets/goToBoss/${bossName}前往.json`);
                         await dispatcher.runTask(new SoloTask("AutoFight"));
                     }
                     await sleep(1000);
                     log.info(`战斗结束，开始领奖`);
                     await autoNavigateToReward();//前往地脉之花
                     await sleep(600);
                     keyPress("F");
                     await sleep(800);
                     click(968, 759);//消耗树脂领取
                     await sleep(3000);
                     click(975, 1000);//点击空白区域
                     await sleep(1000);//等待 boss 刷新
                     await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
                     log.info(`首领讨伐结束`);
             }
             else {
                     addNotification(`${bossName}材料数量已经满足要求！！！`);
                     await addCompletedTask("boss", bossName, bossRequireCounts);
                     return;
                     }
             }
             catch (error) {  
             addNotification(`${bossName}刷取失败，错误信息: ${error}`);
             await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
             return;
             }
       }
       else{
             log.info(`体力值为${afterStamina},可能无法刷取首领材料${bossName}`);
             const bossCounts = await getBossMaterialCount(bossName);
             let res = bossRequireCounts-bossCounts;
             if(res>0) addNotification(`${bossName}还差${res}个材料没有刷取`);
             else {
                     addNotification(`${bossName}材料数量已经满足要求！！！`);
                     await addCompletedTask("boss", bossName, bossRequireCounts);
             }
             return;
         }
}
}
function parseAndValidateCounts(input, expectedCount) {
    // 检查输入是否为字符串
    if (typeof input !== 'string') {
        throw new Error(`Input must be a string, got ${typeof input}`);
    }

    // 分割字符串
    const parts = input.split('-');
    
    // 初始化结果数组
    const result = [];
    
    // 处理每个部分
    for (let i = 0; i < expectedCount; i++) {
        if (i < parts.length) {
            // 尝试转换为数字
            const num = parseInt(parts[i], 10);
            
            // 验证是否为有效正整数（包括0）
            if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
                throw new Error(`Invalid number at position ${i}: '${parts[i]}'. Must be a non-negative integer.`);
            }
            
            result.push(num);
        } else {
            // 不足的部分补0
            result.push(0);
        }
    }
    
    return result;
}


(async function () {

if(!settings.unfairContractTerms) throw new Error('未签署霸王条款，无法使用');
const completedTasks = await loadCompletedTasks();
log.info(`已加载 ${Object.keys(completedTasks).length} 个已完成任务记录`);

for (let i = 0; i < 3; i++) {

const talentBookName = eval(`settings.talentBookName${i}`);
if(talentBookName != "无" && talentBookName){
try{
let bookRequireCounts = parseAndValidateCounts(eval(`settings.talentBookRequireCounts${i}`), 3);
log.info(`天赋书${i+1}方案解析成功: ${bookRequireCounts.join(', ')}`);
const isCompleted = await isTaskCompleted("talent", talentBookName, bookRequireCounts);
if (isCompleted){addNotification(`天赋书${talentBookName} 已刷取至目标数量，跳过执行`);} 
else await getTalentBook(talentBookName,bookRequireCounts);
// 刷取完成后标记为完成
//await addCompletedTask("talent", talentBookName, bookRequireCounts);
}
catch (error) {  notification.send(`天赋书${talentBookName}刷取失败，错误信息: ${error}`);}
}
else log.info(`没有选择刷取天赋书${i+1}，跳过执行`);
}


for (let i = 0; i < 3; i++) {
const weaponName = eval(`settings.weaponName${i}`);
if(weaponName != "无" && weaponName){
try{
weaponRequireCounts = parseAndValidateCounts(eval(`settings.weaponMaterialRequireCounts${i}`), 4);
log.info(`武器材料${i+1}方案解析成功: ${weaponRequireCounts.join(', ')}`);
const isCompleted = await isTaskCompleted("wepon", weaponName, weaponRequireCounts);
if (isCompleted){addNotification(`武器材料${weaponName} 已刷取至目标数量，跳过执行`);} 
else await getWeaponMaterial(weaponName,weaponRequireCounts);
}
catch (error) {  notification.send(`武器材料${weaponName}刷取失败，错误信息: ${error}`);}
}
else log.info(`没有选择刷取武器材料${i+1}，跳过执行`);
}

for (let i = 0; i < 3; i++) {
const bossName = eval(`settings.bossName${i}`);
if(bossName != "无" && bossName){
try{
bossRequireCounts = eval(`settings.bossRequireCounts${i}`);
const isCompleted = await isTaskCompleted("boss", bossName, bossRequireCounts);
if (isCompleted){addNotification(`首领材料${bossName} 已刷取至目标数量，跳过执行`);} 
else await getBossMaterial(bossName,bossRequireCounts);
}
catch (error) {  notification.send(`首领材料${bossName}刷取失败，错误信息: ${error}`);}
}
else log.info(`没有选择挑战首领${i+1}，跳过执行`);
}

sendBufferedNotifications();//发送累积的完成信息

})();


