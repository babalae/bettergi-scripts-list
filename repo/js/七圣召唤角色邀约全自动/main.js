(async function () {
    
//读取配置
let letterNumber = settings.letterNumber != undefined && ~~settings.letterNumber >= 0 ? ~~settings.letterNumber : 0;
let challengeNumber = settings.challengeNumber != undefined && ~~settings.challengeNumber > 0 ? ~~settings.challengeNumber : 1;

//检测传送结束
async function tpEndDetection() {
    const region = RecognitionObject.ocr(1690, 230, 75, 350); // 队伍名称区域
    let tpTime = 0;
    await sleep(500); //点击传送后等待一段时间避免误判
    //最多30秒传送时间
    while (tpTime < 300) {
        let capture = captureGameRegion();
        let res = capture.find(region);
        capture.dispose();
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

//函数：找小王子买邀请函
    async function BuyLetter(){
await sleep(700);
keyDown("w");
await sleep(1400);
keyUp("w");
await sleep(2000);
keyPress("F");
await sleep(2000);
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(1000);
click(1355,650);//进入商店
await sleep(1000);
click(160, 245);//选择邀请函
await sleep(1000);
click(610, 360);//点击邀请函
await sleep(1000);
click(747,628 );//只买一个
await sleep(1000);
click(1185,755 );//点击购买
await sleep(1000);
click(1185,755 );//点击空白处
await sleep(1000);
keyPress("ESCAPE");
await sleep(3000);
click(1355, 800);
await sleep(3000);
    }

//函数：邀请版选择角色挑战
    async function chooseCharacter() {
await sleep(1000);
keyPress("F");
await sleep(1500);
click(446, 413);//选择角色1
await sleep(1000);
click(1435, 224);//选择认真胜负
await sleep(6000);
click(1443, 875);//开始
await sleep(1000);
click(1175, 754);//确认
await sleep(1000);
    }

//函数：对话和打牌
   async function Playcards() {    
await autoConversation();
await sleep(1000);
await dispatcher.runTask(new SoloTask("AutoGeniusInvokation"));
await sleep(3000);
click(754,915 );//退出挑战
await sleep(1000);
await autoConversation();
    }

//通过f和空格自动对话，对话标志消失时停止await autoConversation();
async function autoConversation() {
    await sleep(2500); //点击后等待一段时间避免误判
    const talkRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/talkSymbol.png"));
    let talkTime = 0;
    let talkTimes = 0;
    log.info("开始对话");
    //最多10次对话
    while (talkTime < 30) {
    let ro = captureGameRegion();
    let talk = ro.find(talkRo);
    ro.dispose();
    if (talk.isExist()) {
            await sleep(300);
            keyPress("VK_SPACE");
            await sleep(300);
            keyPress("F");
            talkTimes++;
        await sleep(1500);
    }
    else if(talkTimes){
    log.info("对话结束");
    return ;
    }
    talkTime++;
    await sleep(1500);
}
    throw new Error("对话时间超时");
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
    //放大地图
    await genshin.setBigMapZoomLevel(1.0);
    await sleep(400);

    click(1000, 645); //猫尾酒馆
    await sleep(600);
    let ro = captureGameRegion();
    let tavern = ro.find(tavernRo);
    ro.dispose();
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

//函数：前往邀请版(酒馆内)
    async function gotoBoard1() {
await sleep(1000);
keyDown("a");
await sleep(2000);
keyUp("a");
await sleep(600);
keyDown("w");
await sleep(600);
keyUp("w");
await sleep(500);
keyPress("F");
await sleep(1500);
keyDown("s");
await sleep(300);
keyUp("s");
await sleep(1000);
    }

//函数：前往邀请版(洞天内)
    async function gotoBoard2() {
await sleep(1000);
keyDown("s");
await sleep(1000);
keyUp("s");
await sleep(1000);
    }



//主流程
await genshin.returnMainUi();
log.info(`开始执行角色邀约挑战`);
for (let i = 0; i < challengeNumber; i++) {
   await gotoTavern();
   if (letterNumber <= i) {
       log.info(`购买第${i+1}次`);
       await BuyLetter();
       letterNumber++;
    }
   await gotoBoard1();
   await chooseCharacter();
   await Playcards();
   await gotoBoard2();
   await chooseCharacter();
   await Playcards();
   log.info(`完成挑战第${i+1}次`);
}

})();
