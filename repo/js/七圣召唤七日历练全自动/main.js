// 切换到指定的队伍
async function switchCardTeam(Name) {
    let captureRegion = captureGameRegion();
    let teamName = captureRegion.find(RecognitionObject.ocr(1305, 793, 206, 46));
    log.info("当前队伍名称: {text}", teamName.text);
    if (teamName.text != Name) {
        click(1312, 812); //点击队伍名称的糟糕UI
        await sleep(1000);

        moveMouseTo(100, 200);
        leftButtonDown();
        // 不能一次移动太多,否则会丢拖动
        for (let i = 1; i <= 9; i++) {
            await sleep(50);
            moveMouseTo(200 * i, 200);
        }
        await sleep(200);
        leftButtonUp();
        await sleep(1000);

        captureRegion = captureGameRegion();
        for (let i = 0; i < 4; i++) {
            let x = 135 + 463 * i;
            let res = captureRegion.find(RecognitionObject.ocr(x, 762, 230, 46));
            if (res.text == Name) {
                log.info("切换至队伍: {text}", res.text);
                res.click();
                await sleep(500);
                click(1164, 1016); // 选择
                await sleep(4000); // 等待"出战牌组"的强制延时框消失
                break;
            }
        }
    }
}

(async function () {
    // 存储挑战玩家信息
    let textArray = [];
    let skipNum = 0;

//检查挑战结果   await checkChallengeResults();
async function checkChallengeResults() {
    const region1 = RecognitionObject.ocr(785, 890, 340, 82); // 对话区域
    let capture = captureGameRegion();
    let res1 = capture.find(region1);
    if (res1.isEmpty()) {
        await sleep(1000);
        click(960, 540);
        await sleep(500);
        click(1860, 50); //避免失败卡死
        await sleep(1000);
        click(1600, 260);
        await sleep(1000);
        click(1180, 756);
        await sleep(6000);
        click(754, 915); //退出挑战
        await sleep(4000);
        await autoConversation();
        await sleep(1000);
        return;
    } else {
        await sleep(1000);
        click(754, 915); //退出挑战
        await sleep(4000);
        await autoConversation();
        await sleep(1000);
        return;
    }
}

//自动对话，直到出现选项框   await autoConversation();
async function autoConversation() {
    await sleep(2500); //点击后等待一段时间避免误判
    const region1 = RecognitionObject.ocr(785, 890, 340, 82); // 对话区域
    const region2 = RecognitionObject.ocr(1250, 400, 660, 440); // 选项区域
    let talkTime = 0;
    //最多10次对话
    while (talkTime < 20) {
        let capture = captureGameRegion();
        let res1 = capture.find(region1);
        let res2 = capture.find(region2);
        if (!res1.isEmpty() && res2.isEmpty()) {
            talkTime++;
            keyPress("VK_SPACE");
            await sleep(500);
            keyPress("VK_SPACE");
            await sleep(500);
        } else if (!res1.isEmpty() && !res2.isEmpty()) {
            await sleep(1000);
            keyPress("F");
            await sleep(400);
            keyPress("F");
            log.info("已选择谈话内容");
            return;
        } else if (res1.isEmpty() && !res2.isEmpty()) {
            log.info("谈话完成");
            await sleep(1000);
            return;
        }
        talkTime++;
        await sleep(1500);
    }
    throw new Error("对话时间超时");
}

//检测传送结束
async function tpEndDetection() {
    const region = RecognitionObject.ocr(1690, 230, 75, 350); // 队伍名称区域
    let tpTime = 0;
    await sleep(500); //点击传送后等待一段时间避免误判
    //最多30秒传送时间
    while (tpTime < 300) {
        let capture = captureGameRegion();
        let res = capture.find(region);
        if (!res.isEmpty()) {
            log.info("传送完成");
            await sleep(1200); //传送结束后有僵直
            return;
        }
        tpTime++;
        await sleep(100);
    }
    throw new Error("传送时间超时");
}

// 打开地图，查看玩家位置，并前往相应位置
const cardPlayerRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/cardPlayer.png"));
const detectCardPlayer = async () => {
    // 定义要检测的6个点位及对应的处理函数
    let i = 0;
    let findNum = 0;
    const checkPoints = [
        { x: 640, y: 750, action: async () => await gotoTable1() }, // 点位1
        { x: 810, y: 790, action: async () => await gotoTable2() }, // 点位2
        { x: 810, y: 600, action: async () => await gotoTable3() }, // 点位3
        { x: 610, y: 360, action: async () => await gotoTable4() }, // 点位4
        { x: 700, y: 5, action: async () => await gotoTable5() }, // 点位5
        { x: 290, y: 530, action: async () => await gotoTable6() }, // 点位6
    ];

    keyPress("M");
    await sleep(1200);
    click(48, 441); //放大地图
    await sleep(300);
    click(48, 441); //放大地图
    await sleep(300);
    click(48, 441); //放大地图
    await sleep(300);

    //地图拖动到指定位置
    moveMouseTo(200, 200);
    leftButtonDown();
    await sleep(500);
    moveMouseTo(170, 288);
    await sleep(500);
    moveMouseTo(104, 1000);
    await sleep(500);
    leftButtonUp();
    await sleep(500);

    // 获取游戏区域截图
    const captureRegion = captureGameRegion();

    for (const point of checkPoints) {
        i++;
        // 遍历所有检测点位
        const cropRegion = captureRegion.DeriveCrop(point.x, point.y, 160, 160);

        // 在裁剪区域中查找卡片
        const result = cropRegion.Find(cardPlayerRo);

        // 如果找到卡片
        if (!result.IsEmpty()) {
            findNum++;
            if (findNum - skipNum == 1) {
                log.info(`在点位${i}找到玩家，执行对应操作`);
                await sleep(1000);
                keyPress("ESCAPE");
                await sleep(1500);
                await point.action(); // 调用该点位对应的函数
                return true; // 返回true表示已找到并处理
            }
        }
    }

    // 所有点位都未找到
    log.info("未在任何检测点找到玩家");
    textArray.length = 0;
    return false;
};

//获取挑战对象名称
async function captureAndStoreTexts() {
    // 清空数组
    textArray = [];
    // 四个固定位置坐标
    const positions = [
        { x: 450, y: 620 },
        { x: 760, y: 620 },
        { x: 1070, y: 620 },
        { x: 1380, y: 620 },
    ];

    // 截取区域大小
    const width = 240;
    const height = 100;
    await sleep(500);
    keyPress("F6");
    await sleep(1000);
    click(300, 370); //点击七日历练
    await sleep(1000);
    // 获取游戏区域截图
    const captureRegion = captureGameRegion();

    // 遍历四个位置进行OCR识别
    for (const pos of positions) {
        // 创建OCR识别区域
        const ocrRo = RecognitionObject.ocr(pos.x, pos.y, width, height); //挑战者名字区域
        const ocrRo2 = RecognitionObject.ocr(pos.x, pos.y + 100, width, height); //挑战是否完成
        // 在指定区域进行OCR识别
        const result = captureRegion.find(ocrRo);
        const result2 = captureRegion.find(ocrRo2);
        if (!result.isEmpty() && result.text) {
            // 存储识别结果和对应位置
            if (result2.text == "追踪") {
                log.info(`识别到文本: ${result.text} 位置: (${pos.x}, ${pos.y})`);
                textArray.push({
                    text: result.text.trim(),
                    x: pos.x + width / 2, // 点击中心位置
                    y: pos.y + height / 2,
                });
            }
        } else {
            log.warn(`位置 (${pos.x}, ${pos.y}) 未识别到文本`);
        }
    }

    log.info(`剩余挑战人数:${textArray.length}`);
    keyPress("ESCAPE");
    await sleep(1000);
}

//检查是否有对应的挑战对手
async function searchAndClickTexts() {
    middleButtonClick();
    await sleep(800);
    moveMouseBy(0, 1030);
    await sleep(800);
    moveMouseBy(0, 1030);
    await sleep(800);
    // 限定区域坐标和大小
    const searchX = 1210;
    const searchY = 440;
    const searchWidth = 150;
    const searchHeight = 195;

    // 获取游戏区域截图
    const captureRegion = captureGameRegion();

    // 在限定区域内进行OCR识别
    const ocrRo = RecognitionObject.ocr(searchX, searchY, searchWidth, searchHeight);
    const results = captureRegion.findMulti(ocrRo);

    // 遍历OCR结果
    for (let i = 0; i < results.count; i++) {
        const res = results[i];
        const resText = res.text.trim();

        // 在存储的文本数组中查找匹配项
        const index = textArray.findIndex((item) => item.text === resText);

        if (index !== -1) {
            // 找到匹配项，点击对应位置

            log.info(`找到匹配文本: ${resText}`);
            skipNum = 0;
            // 点击存储的位置
            await keyMouseScript.runFile(`assets/ALT点击.json`);
            await sleep(500);
            res.click();
            await sleep(500);
            await keyMouseScript.runFile(`assets/ALT释放.json`);
            await Playcards();

            // 从数组中移除已处理的文本
            textArray.splice(index, 1);

            return true;
        }
    }
    log.info(`未找到匹配文本`);
    skipNum++;
    return false;
}

//函数：打开地图前往猫尾酒馆
async function gotoTavern() {
    const tavernRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/tavern.png"));
    await genshin.returnMainUi();
    await sleep(1000);
    keyPress("m");
    await sleep(1500);
    click(1841, 1015); //地图选择
    await sleep(1000);
    click(1460, 140); //蒙德
    await sleep(1200);
    click(48, 441); //放大地图
    await sleep(400);
    click(48, 441); //放大地图
    await sleep(400);
    click(48, 441); //放大地图
    await sleep(400);
    click(48, 441); //放大地图
    await sleep(400);
    click(48, 441); //放大地图
    await sleep(400);

    click(1000, 645); //猫尾酒馆
    await sleep(600);
    let tavern = captureGameRegion().find(tavernRo);
    if (tavern.isExist()) {
        tavern.click();
        await sleep(500);
    } else {
        throw new Error("未能找到猫尾酒馆");
    }
    click(1707, 1010); //确认传送
    await sleep(1000);
    await tpEndDetection();
}

//函数：对话和打牌
async function Playcards() {
    await sleep(800); //略微俯视，避免名字出现在选项框附近，导致错误点击
    moveMouseBy(0, 1030);
    await sleep(1000);
    await autoConversation();
    log.info("对话完成");
    await sleep(1500);
    if (settings.partyName != undefined) {
        await switchCardTeam(settings.partyName);
    }
    click(1610, 900); //点击挑战
    await sleep(8000);
    await dispatcher.runTask(new SoloTask("AutoGeniusInvokation"));
    await sleep(3000);
    await checkChallengeResults();
    await sleep(1000);
}

//前往一号桌
async function gotoTable1() {
    log.info(`前往1号桌`);
    keyDown("d");
    await sleep(1500);
    keyUp("d");
    keyDown("w");
    await sleep(400);
    keyUp("w");
    keyDown("d");
    keyDown("w");
    await sleep(1200);
    keyUp("d");
    keyUp("w");
    await sleep(700);
}
//前往二号桌
async function gotoTable2() {
    log.info(`前往2号桌`);
    keyDown("d");
    await sleep(1500);
    keyUp("d");
    keyDown("w");
    await sleep(400);
    keyUp("w");
    keyDown("d");
    keyDown("w");
    await sleep(1200);
    keyUp("d");
    keyUp("w");
    keyDown("s");
    await sleep(700);
    keyUp("s");
    await sleep(700);
}
//前往三号桌
async function gotoTable3() {
    log.info(`前往3号桌`);
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    keyDown("d");
    await sleep(5000);
    keyUp("d");
    keyDown("a");
    await sleep(1500);
    keyUp("a");
    await sleep(700);
}
//前往四号桌
async function gotoTable4() {
    log.info(`前往4号桌`);
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    keyDown("d");
    await sleep(5000);
    keyUp("d");
    keyDown("a");
    await sleep(1500);
    keyUp("a");
    keyDown("d");
    await sleep(200);
    keyUp("d");
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    await sleep(700);
}
//前往一号包间
async function gotoTable5() {
    log.info(`前往1号包间`);
    keyDown("w");
    await sleep(2500);
    keyUp("w");
    keyDown("d");
    await sleep(200);
    keyUp("d");
    await sleep(500);
    keyPress("ESCAPE");
    await sleep(1500);
    keyPress("ESCAPE");
    await sleep(1500);
    keyDown("w");
    await sleep(5900);
    keyUp("w");
    await sleep(700);
}
//前往二号包间
async function gotoTable6() {
    log.info(`前往2号包间`);
    await sleep(1500);
    keyDown("d");
    await sleep(1500);
    keyUp("d");
    keyDown("w");
    keyDown("d");
    await sleep(4000);
    keyUp("d");
    keyUp("w");
    keyDown("a");
    await sleep(1500);
    keyUp("a");
    keyDown("w");
    await sleep(3000);
    keyPress("VK_SPACE");
    await sleep(1000);
    keyUp("w");
    keyDown("s");
    await sleep(1000);
    keyPress("VK_SPACE");
    await sleep(700);
    keyUp("s");
    await sleep(500);
}

async function openMap() {
    await gotoTavern();
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    keyDown("d");
    await sleep(5000);
    keyUp("d");
    await sleep(700);
}


//主流程
log.info(`前往猫尾酒馆`);
await gotoTavern();
await captureAndStoreTexts();
if (textArray.length != 0) {
    await detectCardPlayer();
    await searchAndClickTexts();
}
for (let i = 0; i < 20; i++) {
    //循环兜底，避免角色未到达指定位置
    if (textArray.length === 0) break;
    await gotoTavern();
    await detectCardPlayer();
    await searchAndClickTexts();
}
await genshin.returnMainUi();
await sleep(500);
keyPress("F6");
await sleep(1000);
click(300, 370); //点击七日历练
await sleep(1000);
log.info(`打牌结束`);

})();
