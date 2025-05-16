
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
 * 根据两个区域的OCR检测结果执行不同操作的循环函数
 */
async function autoFightAndEndDetection() {
    // 定义两个检测区域
    const region1 = RecognitionObject.ocr(750, 0, 420, 110);//区域一 BOSS名称
    const region2 = RecognitionObject.ocr(840, 935, 230, 40);//区域二 成功倒计时
    const region3 = RecognitionObject.ocr(1690, 230, 75, 350);//区域三 队伍名称
    let challengeTime = 0;
    let challengeNum = 0;
    //12分钟兜底
    while (challengeTime < 1200) {
        // 捕获游戏区域
        let capture = captureGameRegion();
        // 检测两个区域的OCR结果
        let res1 = capture.find(region1);
        let res2 = capture.find(region2);
        let res3 = capture.find(region3);
        let hasText1 = !res1.isEmpty() && res1.text.trim().length > 0;
        let hasText2 = !res2.isEmpty() && res2.text.trim().length > 0;
        let hasText3 = !res3.isEmpty() && res3.text.trim().length > 0;
        // 情况1: 区域1有文字 且 区域2无文字 且 区域3有文字 → 执行AutoFight
        if (hasText1 && !hasText2 && hasText3) {
            challengeNum++;
            log.info(`执行第${challengeNum}次战斗`);
            challengeTime = challengeTime + 40;
            await dispatcher.runTask(new SoloTask("AutoFight"));
        } 
        // 情况2: 区域2有文字 且 区域1无文字 且 区域3有文字 → 结束循环
        else if (hasText2 && !hasText1 && hasText3) {
            log.info("检测到挑战成功");
            break;
        }
        // 其他情况: 什么都不做
        challengeTime = challengeTime + 1;
        // 每次检测间隔500毫秒，避免CPU占用过高
        await sleep(500);
    }
}

//通用：前往副本(副本外)
await sleep(1000);
await pathingScript.runFile("assets/recover.json");
await sleep(5000);
await pathingScript.runFile("assets/tp.json");
await sleep(1000);
keyDown("w");
await sleep(2000);
keyUp("w");
keyPress("F");
await sleep(9000);
click(1725, 1020);//单人挑战
await sleep(2000);
click(1725, 1020);//开始挑战
await tpEndDetection();

//副本内前往BOSS处
keyPress("1");
await sleep(1000);//切回1号位
keyDown("w");
await sleep(4000);
keyUp("w");
await autoFightAndEndDetection();//一直战斗直到检测到结束


log.info(`等待柱子碎裂`);
await sleep(28000);//等待柱子碎裂
keyPress("1");
await sleep(1000);//切回钟离
log.info(`开始领奖`);
keyDown("w");
await sleep(5000);
keyUp("w");
keyDown("s");
await sleep(1400);
keyUp("s");
await sleep(1000);
keyPress("F");//领奖
await sleep(1000);
click(950, 750);//使用树脂
await sleep(6000);
click(975, 1000);//退出秘境
await sleep(10000);
})();
