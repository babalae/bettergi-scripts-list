(async function () {

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



await pathingScript.runFile("assets/前往狼王.json");
await sleep(1000);
await eatFood();//嗑药
keyPress("F");
await sleep(13000);
await dispatcher.runTask(new SoloTask("AutoFight"));
await sleep(1000);
await pathingScript.runFile("assets/领取奖励.json");
keyPress("F");
await sleep(1000);
click(968, 759);//消耗树脂领取
await sleep(5000);
click(975, 1000);//点击空白区域
await sleep(1000);
})();
