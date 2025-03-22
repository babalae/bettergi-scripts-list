(async function () {
await pathingScript.runFile("assets/前往狼王.json");
await sleep(1000);
keyPress("F");
await sleep(13000);
await dispatcher.runTask(new SoloTask("AutoFight"));
await sleep(1000);
await pathingScript.runFile("assets/领取奖励.json");
keyPress("F");
await sleep(5000);
click(968, 759);//消耗树脂领取
await sleep(1000);
click(975, 1000);//点击空白区域
await sleep(1000);
})();
