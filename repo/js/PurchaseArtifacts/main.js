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
    await Shopping();

    await Purchase('纳塔购买狗粮');
    await sleep(1000);
    keyDown("a");
    await sleep(500);
    keyUp("a");
    await Shopping();

    await Purchase('挪德卡莱购买狗粮');
    await Shopping();
})();
