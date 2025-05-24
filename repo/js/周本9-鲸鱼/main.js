(async function () {//鲸鱼周本
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
//吃料理
async function eatFood() {
let foodName = settings.foodName ?? 0;
if(foodName){
const foodSum = foodName.split('-');
log.info("开始吃菜");
await sleep(1000);
keyPress("B");//打开背包
await sleep(2000);
click(863, 51);//选择食物
await sleep(1000);
for(let i = 0; i < foodSum.length; i++){
click(170, 1020);//筛选
await sleep(1000);
click(195, 1020);//重置
await sleep(1000);
click(110, 110);//输入名字
await sleep(1000);
inputText(foodSum[i]);
await sleep(500);
click(490, 1020);//确认筛选
await sleep(1000);
click(180, 180);//选择第一个食物
await sleep(1000);
click(1690, 1015);//使用
await sleep(1000);
}
keyPress("ESCAPE");
await sleep(1500);
}}
//检测角色是否阵亡，并前往吃药复活
async function resurgenceDetectionAndEatFood() {
const region1 = RecognitionObject.ocr(1170, 780, 75, 35);// 复活料理区域
const region2 = RecognitionObject.ocr(545, 360, 800, 45);// 料理冷却区域
let recoveryFoodName = settings.recoveryFoodName ?? 0;
let resurgenceFoodName = settings.resurgenceFoodName ?? 0;
if(resurgenceFoodName && recoveryFoodName){
keyPress("1");
await sleep(100);
keyPress("2");
await sleep(100);
keyPress("3");
await sleep(100);
keyPress("4");
await sleep(200);
let capture = captureGameRegion();
let res1 = capture.find(region1);
let res2 = capture.find(region2);
        if (res1.isEmpty()){
            return;
        } 
        else if (!res1.isEmpty() && !res2.isEmpty()) {
            log.info("复活料理处于冷却中");
            keyPress("ESCAPE");
            await sleep(1000);
            await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
            throw new Error('战斗失败');
            return;
        }
        else if (!res1.isEmpty() && res2.isEmpty()) {
            log.info("检测到阵亡角色……复活吧！我的爱人！！！");
            keyPress("ESCAPE");
            await eatResurgenceFood();//满血复活
            return;
        }
}}

//吃料理复活
async function eatResurgenceFood() {
let recoveryFoodName = settings.recoveryFoodName ?? 0;
let resurgenceFoodName = settings.resurgenceFoodName ?? 0;
const region = RecognitionObject.ocr(800, 200, 315, 32);// 复活对象检测
const clickPositions = [
    { x: 760, y: 440 },  // 角色1
    { x: 900, y: 440 },  // 角色2
    { x: 1040, y: 440 }, // 角色3
    { x: 1180, y: 440 }  // 角色4
];
if(resurgenceFoodName && recoveryFoodName){
log.info("开始吃菜");
await sleep(500);
keyPress("B");//打开背包
await sleep(2000);
click(863, 51);//选择食物
await sleep(1000);
click(170, 1020);//筛选
await sleep(1000);
click(195, 1020);//重置
await sleep(1000);
click(110, 110);//输入名字
await sleep(200);
click(110, 110);
await sleep(1000);
inputText(`${resurgenceFoodName}`);
await sleep(500);
click(490, 1020);//确认筛选
await sleep(1000);
click(180, 180);//选择第一个食物
await sleep(1000);
click(1690, 1015);//使用
await sleep(1000);
// 使用 for 循环点击每个位置
for (let i = 0; i < clickPositions.length; i++) {
    const position = clickPositions[i];
    click(position.x, position.y);
    await sleep(800);
    click(1200,770);//确认
    await sleep(800);
    let capture = captureGameRegion();
    let res = capture.find(region);
    if (res.isEmpty()){
        keyPress("ESCAPE");
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(110, 110);//输入名字
        await sleep(1000);
        inputText(`${recoveryFoodName}`);
        await sleep(500);
        click(490, 1020);//确认筛选
        await sleep(1000);
        click(180, 180);//选择第一个食物
        await sleep(1000);
        click(1690, 1015);//使用
        await sleep(500);
        click(position.x, position.y);
        await sleep(500);
        click(1200,770);//吃第一个
        await sleep(500);
        click(1200,770);//吃第二个
        await sleep(500);
        click(1350,290);//退出
        await sleep(500);
        keyPress("ESCAPE");
        await sleep(400);
        log.info("我又好了，嘿嘿");
        break;
        } 
      await sleep(1000);
      }
    }
}

//征讨之花领奖
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
            log.info("已到达领奖点，检测到文字: " + rewardResult.text);
            return;
        }
        else if(advanceNum > 30){
        throw new Error('前进时间超时');
        }
        // 2. 未到达领奖点，则调整视野
        for(let i = 0; i < 100; i++){
        captureRegion = captureGameRegion();
        let iconRes = captureRegion.Find(boxIconRo);
        let climbTextArea = captureRegion.DeriveCrop(1808, 1030, 25, 25);
        let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
        // 检查是否处于攀爬状态
        if (climbResult.isEmpty()){
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
            log.info(`视野已调正，前进第${advanceNum}次`);
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
  if(i > 97) throw new Error('视野调整超时');
    }
        // 3. 前进一小步
        keyDown("w");
        await sleep(500);
        keyUp("w");
        await sleep(200); // 等待角色移动稳定
    }
}

//执行战斗并检测结束																		
async function autoFightAndEndDetection() {
    // 定义两个检测区域
    const region1 = RecognitionObject.ocr(750, 0, 420, 110);//区域一 BOSS名称
    const region2 = RecognitionObject.ocr(840, 935, 230, 40);//区域二 成功倒计时
    const region3 = RecognitionObject.ocr(1690, 230, 75, 350);//区域三 队伍名称
    let challengeTime = 0;
    let challengeNum = 0;
    //12分钟兜底
    while (challengeTime < 6000) {
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
            await resurgenceDetectionAndEatFood();
            challengeNum++;
            await sleep(800);//避免切人冷却，导致角色识别失败
            log.info(`执行第${challengeNum}次战斗`);
            challengeTime = challengeTime + 205;
            try {
                await dispatcher.runTask(new SoloTask("AutoFight"));
                  } catch (error) {
                  log.info("启动战斗失败，尝试重新启动");
                  await sleep(500);
                  }
        } 
        // 情况2: 区域2有文字 且 区域1无文字 且 区域3有文字 → 结束循环
        else if (hasText2 && !hasText1 && hasText3) {
            log.info("检测到挑战成功");
            break;
        }
        // 情况3: 区域2无文字区域1无文字区域3有文字 →BOSS二阶段，需要移动触发
        else if (!hasText2 && !hasText1 && hasText3) {
/*
            log.info("检测到BOSS进入二阶段");
            try {
                await dispatcher.runTask(new SoloTask("AutoFight"));
                  } catch (error) {
                  log.info("启动战斗失败，尝试重新启动");
                  await sleep(500);
                  }
*/
        }
        // 情况4: 三个区域均无文字，可能处于转场动画，尝试点击快进
        else if (!hasText1 && !hasText2 && !hasText3){
/*
        log.info("进入过场动画尝试快进");
        await sleep(400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
*/
        }

        challengeTime = challengeTime + 1;
        // 每次检测间隔100毫秒，避免CPU占用过高
        await sleep(100);
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
await sleep(1000);
keyPress("F");
await sleep(2000);
click(1725, 1020);//单人挑战
await sleep(300);
click(1180, 760);//队伍等级偏低、体力不够可能会出弹窗
await sleep(2000);
click(1725, 1020);//开始挑战
await tpEndDetection();

//副本内前往BOSS处
await eatFood();//嗑药
keyPress("1");
await sleep(1000);//切回固定行走位
await autoFightAndEndDetection();//一直战斗直到检测到结束

//领奖并退出
await autoNavigateToReward();//前往地脉之花
await sleep(1000);
keyPress("F");//领奖
await sleep(1000);
click(950, 750);//使用树脂
await sleep(6000);
click(975, 1000);//退出秘境
await tpEndDetection();
await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
await sleep(1000);
keyPress("M");//展示剩余体力
await sleep(1000);
notification.send('挑战完成');

})();
