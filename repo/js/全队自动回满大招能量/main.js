(async function () {

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
        if (!res1.isEmpty() || !res2.isEmpty()){
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

//一直行动，直到检测到指定文字await autoNavigateToReward();
const autoNavigateToReward = async () => {
        const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测
        let advanceNum = 0;
            while (true) {
        // 1. 优先检查是否已到达领奖点
        let captureRegion = captureGameRegion();
        let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
        let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
        // 检测到特点文字则结束！！！
        if (rewardResult.text == "启动") {
            log.info("已到达指定位置，检测到文字: " + rewardResult.text);
            await sleep(100);
            return;
        }
        else if(advanceNum > 30){
        throw new Error('前进时间超时');
        }
                // 前进一小步
        keyDown("w");
        await sleep(500);
        keyUp("w");
        await sleep(100); // 等待角色移动稳定
    }
}

//执行战斗并检测结束																		
async function autoFightAndEndDetection() {
    // 定义两个检测区域

    const region2 = RecognitionObject.ocr(840, 935, 230, 40);//区域二 成功倒计时
    const region3 = RecognitionObject.ocr(1690, 230, 75, 350);//区域三 队伍名称
    let challengeTime = 0;

    //2分钟兜底
    while (challengeTime < 4000) {
        // 捕获游戏区域
        let capture = captureGameRegion();
        // 检测两个区域的OCR结果

        let res2 = capture.find(region2);
        let res3 = capture.find(region3);
        let hasText2 = !res2.isEmpty() && res2.text.trim().length > 0;
        let hasText3 = !res3.isEmpty() && res3.text.trim().length > 0;
        // 情况1: 区域2无文字 且 区域3有文字 → 执行AutoFight
        if (!hasText2 && hasText3) {
            keyPress("1"); 
            await sleep(500);
            leftButtonClick();
            await sleep(400);
            keyPress("e"); 
            await sleep(1000);
            keyPress("2"); 
            await sleep(500);
            leftButtonClick();
            await sleep(400);
            keyPress("e"); 
            await sleep(1000);
            keyPress("3"); 
            await sleep(500);
            leftButtonClick();
            await sleep(400);
            keyPress("e"); 
            await sleep(1000);
            keyPress("4"); 
            await sleep(500);
            leftButtonClick();
            await sleep(400);
            keyPress("e"); 
            await sleep(1000);
            challengeTime = challengeTime + 200;
        } 
        // 情况2: 区域2有文字且 区域3有文字 → 结束循环
        else if (hasText2 && hasText3) {
            log.info("检测到挑战成功");
            break;
        }


        challengeTime = challengeTime + 1;
        // 每次检测间隔100毫秒，避免CPU占用过高
        await sleep(100);
    }
}

await genshin.tp(-1559.08,2492.51);//传送到副本
await sleep(1000);
keyDown("w");
await sleep(3000);
keyUp("w");
await sleep(1000);
keyPress("F"); 
await sleep(5000);
click( 380,190 );//选择难度最低的关卡
await sleep(1000);
click( 1700,1000 );//单人挑战
await sleep(200);
click( 1100,750 );//避免没有体力掐死
await sleep(1000);
click( 1700,1000 );//开始挑战
await tpEndDetection();
await autoNavigateToReward();
keyPress("F"); 
await autoFightAndEndDetection();//一直战斗直到检测到结束
await sleep(1000);
await pathingScript.runFile("assets/recover.json");
await sleep(1000);
log.info("能量充满，任务结束");

})();
