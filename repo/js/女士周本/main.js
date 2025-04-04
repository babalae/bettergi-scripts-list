(async function () {
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
keyDown("s");
await sleep(1000);
keyUp("s");
await dispatcher.runTask(new SoloTask("AutoFight"));
keyPress("1");
await sleep(1000);//切回钟离

keyDown("s");
await sleep(2000);
keyUp("s");

keyDown("w");
await sleep(3600);
keyUp("w");

keyDown("a");
await sleep(400);
keyUp("a");

await sleep(1000);
keyPress("F");//领奖
await sleep(1000);
click(950, 750);//使用树脂
await sleep(6000);
click(975, 1000);//退出秘境
await sleep(10000);
})();
