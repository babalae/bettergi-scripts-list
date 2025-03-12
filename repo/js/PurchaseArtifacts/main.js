(async function () {
    
 async function Purchase(locationName) {       
        let filePath = `assets/${locationName}.json`;
        await pathingScript.runFile(filePath);
    }

//读取配置
let holdingState = settings.holdingState ?? 0;

//基本购买流程
   async function Shopping() {
        await sleep(1500);
        for (let j = 0; j < 4; j++) {
    keyPress("F"); await sleep(1800);//对话
         }
        for (let i = 0; i < 5; i++) {
  click(1690, 1020); await sleep(500); // 购买
  click(1170, 780); await sleep(400); // 确定
  click(1690, 1020); await sleep(200); // 点击空白处
        }
        keyPress("ESCAPE"); await sleep(2000);
    }

await Purchase('蒙德购买狗粮');
await Shopping();

//调整时间
    await sleep(1500);
    keyPress("ESCAPE"); await sleep(1500);
    click(45, 715); await sleep(1500);
    moveMouseTo(1440,510 );
    leftButtonDown(); await sleep(1500);
    moveMouseTo(1290,590 );await sleep(1000);
    moveMouseTo(1440,330 );await sleep(1000);
    moveMouseTo(1580,590 );await sleep(1000);
    leftButtonUp();await sleep(500);
    click(1440, 1025); await sleep(16000);
    keyPress("ESCAPE"); await sleep(1000);
    keyPress("ESCAPE"); await sleep(1000);

    await Purchase('璃月购买狗粮1');
    await Shopping();

    await Purchase('璃月购买狗粮2');
    await sleep(1000);
    keyDown("w");
    await sleep(600);
    keyUp("w");
    await sleep(1000);
    keyPress("F"); await sleep(1200);
    keyPress("F"); await sleep(1800);
  if (holdingState) keyPress("s");
    await sleep(500);
    keyPress("F"); await sleep(1200);
    keyPress("F"); await sleep(1800);
    click(1690, 1020); await sleep(500); 
    for (let i = 0; i < 5; i++) {
  click(1690, 1020); await sleep(500); // 购买
  click(1170, 780); await sleep(400); // 确定
  click(1690, 1020); await sleep(200); // 点击空白处
        }
    keyPress("ESCAPE"); await sleep(2000);

    await Purchase('稻妻购买狗粮');
    await sleep(1500);
        for (let j = 0; j < 5; j++) {
    keyPress("F"); await sleep(1800);//对话
         }
        click(200, 400); await sleep(500); // 选择狗粮
        for (let i = 0; i < 5; i++) {
  click(1690, 1020); await sleep(500); // 购买
  click(1170, 780); await sleep(400); // 确定
  click(1690, 1020); await sleep(200); // 点击空白处
        }
        keyPress("ESCAPE"); await sleep(2000);

    await Purchase('须弥购买狗粮');
    await Shopping();

    await Purchase('枫丹购买狗粮');
    await sleep(1000);
    keyDown("d");
    await sleep(2000);
    keyUp("d");
    keyDown("a");
    await sleep(300);
    keyUp("a");
    keyDown("w");
    await sleep(6000);
    keyUp("w");
    keyDown("s");
    await sleep(2000);
    keyPress("SPACE");
    await sleep(600);
    keyUp("s");
    await Shopping();

    await Purchase('纳塔购买狗粮');
    await sleep(1000);
    keyDown("a");
    await sleep(500);
    keyUp("a");
    await Shopping();
})();
