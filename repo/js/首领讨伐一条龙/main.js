(async function () {
let challengeNum= settings.challengeNum ?? 1;//挑战次数
let challengeName = settings.challengeName ?? 0;//挑战首领名称
let resinNum = settings.resinNum ?? 0;//使用树脂数量
let samePlace = settings.samePlace ?? 1;//是否原地连续挑战
if(challengeName =="纯水精灵" || challengeName =="歌裴莉娅的葬送" ||challengeName =="科培琉司的劫罚") samePlace = 1;//这些 boss 挑战后不会原地刷新
const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));
const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测
let advanceNum = 0;//前进次数

const autoNavigateToReward = async () => {
        middleButtonClick();
        await sleep(1000);
        moveMouseBy(0, 1030);//调整为俯视视野
        await sleep(500);
        moveMouseBy(0, 920);//调整为俯视视野
        await sleep(500);
        moveMouseBy(0, 710);//调整为俯视视野
    while (true) {
        // 1. 优先检查是否已到达领奖点
        let captureRegion = captureGameRegion();
        let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
        let ocrResults = rewardTextArea.findMulti(RecognitionObject.ocrThis);
        
        // 仅检测到文字则结束！！！
        if (ocrResults.count > 0 && ocrResults[0].text.trim().length > 0) {
            log.info("已到达领奖点，检测到文字: " + ocrResults[0].text);
            return;
        }
        else if(advanceNum > 80){
        throw new Error('前进时间超时');
        }
        // 2. 未到达领奖点，则调整视野
        await adjustViewForReward();
        
        // 3. 前进一小步
        keyDown("w");
        await sleep(800);
        keyUp("w");
        await sleep(100); // 等待角色移动稳定
    }
};

/**
 * 调整视野直到图标位于正前方
 */
const adjustViewForReward = async () => {


     
        for(let i = 0; i < 100; i++){
        let captureRegion = captureGameRegion();
        let iconRes = captureRegion.Find(boxIconRo);
        
        if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {    
            advanceNum++;
            log.info(`视野已调正，前进第${advanceNum}次`);
            return;
        } else {
            // 小幅度调整
            let adjustAmount = iconRes.x < 920 ? -20 : 20;
            let adjustAmount2 = iconRes.y < 540 ?  1 : 10;
            moveMouseBy(adjustAmount*adjustAmount2, 0);
            await sleep(100);
        }       
    }

throw new Error('视野调整超时');
};


//主流程
if(!settings.confirm) throw new Error('请阅读使用说明后，在调度器中调用JS脚本，并设置好相关参数');
if(challengeName){
    //使用树脂
if (resinNum){
    await genshin.returnMainUi();
    keyPress("M");//打开地图
    await sleep(1200);
    click(2476/2, 96/2);// 点击添加体力
    await sleep(600);
    click(1660/2, 950/2)// 选择脆弱树脂
    await sleep(600);
    click(2350/2, 1550/2);// 点击使用
    await sleep(600);
        for (let i = 1; i < resinNum; ++i) {
            click(2586/2, 1296/2);// 点击使用数量
            await sleep(600);
        }
    }
    click(2350/2, 1550/2);// 点击使用
    await sleep(600);
    click(1920/2, 1500/2);// 点击空白处
    await sleep(600);
    keyPress("VK_ESCAPE");//关闭地图
}
if(samePlace == "YES" ) log.info(`已启用原地连续挑战模式`);
log.info(`前往第1次恢复状态`);
await pathingScript.runFile("assets/recover.json");//回复状态
log.info(`前往第1次讨伐${challengeName}`);
await pathingScript.runFile(`assets/${challengeName}前往.json`);
await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
for (let i = 0;i < challengeNum; i++) {
 await sleep(1000);
if(samePlace != "YES" && i > 0){
log.info(`前往第${i+1}次恢复状态`);
await pathingScript.runFile("assets/recover.json");//回复状态
log.info(`前往第${i+1}次讨伐${challengeName}`);
await pathingScript.runFile(`assets/${challengeName}前往.json`);
await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
}
log.info(`开始第${i+1}次战斗`);
try {
await dispatcher.runTask(new SoloTask("AutoFight"));
} catch (error) {
//失败后最多只挑战一次，因为两次都打不过，基本上没戏，干脆直接报错结束
log.info(`挑战失败，再来一次`);
await pathingScript.runFile("assets/recover.json");//回复状态
await pathingScript.runFile(`assets/${challengeName}前往.json`);
await keyMouseScript.runFile(`assets/${challengeName}前往键鼠.json`);
await dispatcher.runTask(new SoloTask("AutoFight"));
}

log.info(`等待一会儿，避免钟离柱子害人`);
await sleep(10000);
log.info(`第${i+1}次领奖`);
await autoNavigateToReward();//前往地脉之花
//await pathingScript.runFile(`assets/${challengeName}领奖.json`);
await sleep(600);

keyPress("F");
await sleep(800);
click(968, 759);//消耗树脂领取
await sleep(3000);
click(975, 1000);//点击空白区域
await sleep(5000);//等待 boss 刷新

   
}
await pathingScript.runFile("assets/recover.json");//回复状态
log.info(`首领讨伐结束`);
})();
