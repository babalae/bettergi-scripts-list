(async function () {
    
await genshin.returnMainUi();

dispatcher.addTimer(new RealtimeTimer("AutoPick"));

//传送1地上
await sleep(1000);
keyPress("M");
await sleep(1500);
click(1841, 1015);//地图选择
await sleep(1000);
click(1460, 350);//枫丹
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
click(48, 636);//缩小地图
await sleep(500);
click(48, 636);//缩小地图
await sleep(500);
click(550, 510);//点击传送点
await sleep(500);
click(1707, 1010);//确认
await sleep(8000);


//采集1/3
keyDown("w");
await sleep(15000);
keyUp("w");
keyDown("d");
await sleep(6500);
keyUp("d");
keyDown("w");
await sleep(1000);
keyUp("w");
keyDown("VK_LCONTROL");
await sleep(4000);
keyUp("VK_LCONTROL");
await sleep(2000);
leftButtonClick();
await sleep(4000);
keyDown("d");
await sleep(1200);
keyUp("d");
keyDown("w");
await sleep(11500);
keyUp("w");
keyDown("a");
await sleep(3000);
keyUp("a");
keyDown("w");
await sleep(10000);
keyUp("w");

//传送2地上
await sleep(1000);
keyPress("M");
await sleep(1500);
click(1841, 1015);//地图选择
await sleep(1000);
click(1460, 350);//枫丹
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
click(48, 636);//缩小地图
await sleep(500);
click(48, 636);//缩小地图
await sleep(500);
click(625, 590);//点击传送点
await sleep(500);
click(1707, 1010);//确认
await sleep(8000);
//采集2/4
keyDown("a");
await sleep(1700);
keyUp("a");
keyDown("d");
await sleep(900);
keyUp("d");
keyDown("w");
await sleep(7000);
keyUp("w");
keyDown("a");
await sleep(1200);
keyUp("a");
keyDown("w");
await sleep(4000);
keyUp("w");
keyDown("d");
await sleep(1000);
keyUp("d");
keyDown("a");
await sleep(2300);
keyUp("a");

//传送2地上
await sleep(1000);
keyPress("M");
await sleep(1500);
click(1841, 1015);//地图选择
await sleep(1000);
click(1460, 350);//枫丹
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
click(48, 636);//缩小地图
await sleep(500);
click(48, 636);//缩小地图
await sleep(500);
click(625, 590);//点击传送点
await sleep(500);
click(1707, 1010);//确认
await sleep(8000);

//采集3/2
keyDown("a");
await sleep(1700);
keyUp("a");
keyDown("d");
await sleep(900);
keyUp("d");
keyDown("w");
await sleep(7000);
keyUp("w");
keyDown("a");
await sleep(1200);
keyUp("a");
keyDown("w");
await sleep(2000);
keyUp("w");
keyDown("a");
await sleep(1500);
keyUp("a");
keyDown("w");
await sleep(8000);
keyUp("w");
keyDown("d");
await sleep(2000);
keyUp("d");
keyDown("w");
await sleep(3500);
keyUp("w");
keyDown("d");
await sleep(3200);
keyUp("d");
keyDown("s");
await sleep(3500);
keyUp("s");

//传送2地上
await sleep(1000);
keyPress("M");
await sleep(1500);
click(1841, 1015);//地图选择
await sleep(1000);
click(1460, 350);//枫丹
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
click(48, 636);//缩小地图
await sleep(500);
click(48, 636);//缩小地图
await sleep(500);
click(625, 590);//点击传送点
await sleep(500);
click(1707, 1010);//确认
await sleep(8000);
//采集4/2
keyDown("a");
await sleep(900);
keyUp("a");
keyDown("s");
await sleep(2000);
keyUp("s");
keyDown("a");
await sleep(3700);
keyUp("a");
keyDown("w");
await sleep(4000);
keyUp("w");
keyDown("a");
await sleep(900);
keyUp("a");

})();
