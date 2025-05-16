(async function () {

//吃料理
async function eatFood() {
let foodName = settings.foodName ?? 0;
if(foodName){
await genshin.returnMainUi();
 await sleep(1000);
keyPress("B");//打开背包
await sleep(2000);
click(863, 51);//选择食物
await sleep(1000);
click(170, 1020);//筛选
await sleep(1000);
click(195, 1020);//重置
await sleep(1000);
click(110, 110);//输入名字
await sleep(1000);
inputText(`${foodName}`);
await sleep(500);
click(490, 1020);//确认筛选
await sleep(1000);
click(180, 180);//选择第一个食物
await sleep(1000);
click(1690, 1015);//使用
await sleep(1000);
keyPress("ESCAPE");
await sleep(1500);
await genshin.returnMainUi();
}}

await eatFood();

})();
