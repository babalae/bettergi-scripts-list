(async function () {


//检测传送结束  await tpEndDetection();
async function tpEndDetection() {
    const region = RecognitionObject.ocr(1690, 230, 75, 350);// 队伍名称区域
    let tpTime = 0;
    await sleep(1500);//点击传送后等待一段时间避免误判
    //最多30秒传送时间
    while (tpTime < 300) {
        let capture = captureGameRegion();
        let res = capture.find(region);
        if (!res.isEmpty()){
            log.info("传送完成");
            await sleep(1200);//传送结束后有僵直
            return;
        } 
        tpTime++;
        await sleep(100);
    }
    throw new Error('传送时间超时');
}
 
await genshin.tp(3650.85,2909.78);
await sleep(2000);
await keyMouseScript.runFile(`assets/前往遗迹.json`);
await sleep(1000);
keyPress("F"); 
await sleep(1000);
click(1700 , 1000);
await sleep(2000);
click(1700 , 1000);
await tpEndDetection();
keyPress("5"); //保证是爱可菲
await sleep(1000);
keyDown("e");
await sleep(2000);//长按技能
keyUp("e");
await sleep(1000);
keyPress("1"); //切换芭芭拉
await sleep(1000);

//我的做菜资格用完了，我也不知道要平 a 多久，等下周更改一下
keyDown("e");
await sleep(200);
keyUp("e");
for (let i = 0;i < 100; i++) {
leftButtonClick();
await sleep(300);
 }
await sleep(1000);
keyDown("e");
await sleep(200);
keyUp("e");
for (let i = 0;i < 100; i++) {
leftButtonClick();
await sleep(300);
 }
await sleep(1000);
keyDown("e");
await sleep(200);
keyUp("e");
for (let i = 0;i < 100; i++) {
leftButtonClick();
await sleep(300);
 }

//返回原来的地方
await genshin.tp(3650.85,2909.78);
await sleep(2000);

})();
