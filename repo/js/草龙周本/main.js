(async function () {
const food = 'yueliang';
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
await sleep(2000);
click(1725, 1020);//开始挑战
await sleep(15000);
keyPress("ESCAPE");//点击任意处
await sleep(2000);
keyPress("1");
await sleep(1000);//切回钟离
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
for (const char of food) {
  keyPress(char);
  await sleep(500);
}
keyPress("SPACE");
await sleep(500);
click(490, 1020);//确认筛选
await sleep(1000);
click(180, 180);//选择第一个食物
await sleep(1000);
click(1690, 1015);//使用
await sleep(1000);
keyPress("ESCAPE");
await sleep(1500);
keyDown("w");
await sleep(8500);
keyUp("w");
await sleep(6500);
keyDown("e");
await sleep(1000);//钟离开盾
keyUp("e");
keyDown("a");
await sleep(2000);
keyUp("a");
keyDown("w");
await sleep(3500);
keyUp("w");
keyDown("d");
await sleep(3500);
keyUp("d");
await dispatcher.runTask(new SoloTask("AutoFight"));
await sleep(30000);//等待柱子碎裂
keyPress("1");
await sleep(1000);//切回钟离

keyDown("s");
await sleep(6000);
keyUp("s");
keyDown("w");
await sleep(4000);
keyUp("w");
keyPress("F");//领奖
await sleep(1000);
click(950, 750);//使用树脂
await sleep(6000);
click(975, 1000);//退出秘境
await sleep(10000);
})();
