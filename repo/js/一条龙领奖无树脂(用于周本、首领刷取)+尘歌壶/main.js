(async function () {
    
    let delay = 2000;
    let ksl = settings.kslSelect ?? "枫丹";
    async function kslAutoPath(location) {
            let filePath = `assets/${location}.json`;
            await pathingScript.runFile(filePath);
    }

    // 前往_凯瑟琳
    await kslAutoPath(ksl);
    await sleep(1000);

    // 领取邮件
    keyPress("Escape");
    await sleep(1500);
    click(50, 605);
    await sleep(1500);
    click(150, 1015);
    await sleep(1500);
    click(150, 1015);
    await sleep(1500);
    keyPress("Escape");
    await sleep(1500);
    keyPress("Escape");
    log.info("已完成 领取邮件");
    await sleep(delay);



    // 领取历练点
    keyPress("F1");
    await sleep(2500);
    click(290, 345);
    await sleep(1500);
    click(1550, 755);
    await sleep(1500);
    click(1550, 755);
    await sleep(1500);
    // click(1670, 235);
    keyPress("Escape");
    log.info("已领取历练点");
    await sleep(delay);

    // 领取每日委托奖励
    keyPress("F");
    log.info("按下F键");
    await sleep(1500);
    click(960, 540);
    await sleep(1500);
    click(1380, 425);
    await sleep(1500);
    click(960, 540);
    await sleep(2000);
    click(960, 960);
    log.info("已领取每日委托奖励");
    await sleep(delay);

    // 重新探索派遣
    keyPress("F");
    await sleep(2000);
    click(960, 540);
    await sleep(1500);
    click(1400, 580);
    await sleep(1500);
    click(160, 1010);
    await sleep(1500);
    click(1160, 1020);
    await sleep(1500);
    keyPress("Escape");
    log.info("已完成重新探索派遣");
    await sleep(delay);

    // 领取纪行奖励
    keyPress("F4");
    await sleep(1500);
    click(960, 50);
    await sleep(1000);
    click(1720, 980);
    await sleep(2000);
    click(860, 50);
    await sleep(1000);
    click(1720, 980);
    await sleep(1000);
    keyPress("Escape");
    await sleep(1000);
    keyPress("Escape");
    log.info("已领取纪行奖励");
    await sleep(delay);

await pathingScript.runFile("assets/recover.json");
await sleep(5000);//前往神像，避免茶壶放不出来


 let teaPot = settings.teaPot ?? 0;
    await sleep(1000); 

if(teaPot){
    keyPress("B");     
    await sleep(1500); 
    click(1058, 48);   //小道具
    await sleep(800); 
    click(765, 190);   //背包第五个道具
    await sleep(800); 
    click(1700, 1018); //放置
    await sleep(1500);
    keyPress("F");    //进入
    await sleep(20000); 

    if (teaPot == "璃月"){
        keyDown("D");
        await sleep(500);
        keyUp("D");
        await sleep(500);    
    }else if(teaPot == "蒙德"){
        keyDown("A");
        await sleep(1200);
        keyUp("A");
        await sleep(500);     }else if(teaPot == "稻妻"){
        keyDown("A");
        await sleep(1700);
        keyUp("A");
        await sleep(500); 
        keyDown("S");
        await sleep(1700);
        keyUp("S");
        await sleep(500);
    }else if(teaPot == "须弥"){
        keyDown("D");
        await sleep(1300);
        keyUp("D");
        await sleep(500);
    }else if(teaPot == "枫丹"){
        keyDown("S");
        await sleep(1300);
        keyUp("S");
        await sleep(500);
        keyDown("A");
        await sleep(500);
        keyUp("A");
        await sleep(500);
    }else{
    }
  async function buyResin() {
//进入商店
    keyPress("w");    
    await sleep(500);
    keyPress("w");    
    await sleep(500);
    keyPress("w");    
    await sleep(500);
    keyPress("F"); 
    await sleep(2000);
    click(200, 380); //选择树脂
    await sleep(1000);
    click(1750, 1010); //兑换
    await sleep(1000);
    keyPress("ESCAPE");//点击空白处
    await sleep(500);
    keyPress("ESCAPE");//回到对话界面
    await sleep(3000);
}
    keyPress("F");//阿圆对话
    await sleep(2500);
    click(1081, 955); //跳过对话
    await sleep(2500);
// 检测今天是否是周一
const today = new Date();
if (today.getDay() === 1) { // getDay() 返回 0（周日）到 6（周六）
      await buyResin();// 如果是周一则购买树脂
}
    click(1383, 430);//信任等阶
    await sleep(2500);
    click(1081, 955);//宝钱
    await sleep(2500);
    click(1812, 716);//好感度
    await sleep(2500);
    click(1863, 48);; 
    await sleep(5000);
    click(1356, 804); 
    await sleep(2500);
    click(1356, 804);
    await sleep(1500);
await pathingScript.runFile("assets/recover.json");
await sleep(5000);//回归大世界，避免后续部分js脚本没有路径追踪卡死
}

})();
