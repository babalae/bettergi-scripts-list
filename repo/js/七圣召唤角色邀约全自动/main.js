(async function () {
    
//读取配置
let letterNumber = settings.letterNumber != undefined && ~~settings.letterNumber >= 0 ? ~~settings.letterNumber : 0;
let challengeNumber = settings.challengeNumber != undefined && ~~settings.challengeNumber > 0 ? ~~settings.challengeNumber : 1;

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
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(1000);
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(1000);
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(1000);
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(1000);
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(1000);
click(900, 1000);//对话
await sleep(500);
click(900, 1000);//对话
await sleep(1000);
keyPress("F"); 
await sleep(8000);
await dispatcher.runTask(new SoloTask("AutoGeniusInvokation"));
await sleep(3000);
click(754,915 );//退出挑战
await sleep(10000);     
click(900, 1000);//对话
await sleep(1500);
click(900, 1000);//对话
await sleep(1500);
click(900, 1000);//对话
await sleep(1500);
click(900, 1000);//对话
await sleep(1500);
    }

//函数：打开地图前往猫尾酒馆
    async function gotoTavern() {
await sleep(1000);
keyPress("M");
await sleep(1500);
click(1841, 1015);//地图选择
await sleep(1000);
click(1460, 140);//蒙德
await sleep(1000);
click(48, 441);//放大地图
await sleep(500);
click(48, 441);//放大地图
await sleep(500);
click(48, 441);//放大地图
await sleep(500);
click(48, 441);//放大地图
await sleep(500);
click(48, 441);//放大地图
await sleep(500);
click(1000, 645);//猫尾酒馆
await sleep(500);
click(1345, 690);//猫尾酒馆
await sleep(500);
click(1707, 1010);//猫尾酒馆
await sleep(8000);
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

//函数：打开自动剧情
    async function autoPlot() {
await sleep(1000);
keyPress("ESCAPE");
await sleep(1500);
click(45, 820);
await sleep(1500);
click(175, 710);
await sleep(1500);
click(1628, 275);
await sleep(1500);
click(1628, 330);
await sleep(1500);
keyPress("ESCAPE");
await sleep(1000);
keyPress("ESCAPE");
await sleep(1000);
    }

//主流程
//await pathingScript.runFile(`assets/1.json`);用不来从其他界面强制回到大世界，只能用这个
log.info(`开始执行。`);
for (let i = 0; i < challengeNumber; i++) {
   await gotoTavern();
   await sleep(2000);
   if (challengeNumber-letterNumber > 0) {
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
