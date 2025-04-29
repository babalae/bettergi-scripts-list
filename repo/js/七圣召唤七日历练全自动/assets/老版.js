(async function () {
    
// 存储识别到的文本信息
let textArray = [];

//获取挑战对象名称
async function captureAndStoreTexts() {
    // 清空数组
    textArray = [];   
    // 四个固定位置坐标
    const positions = [
        {x: 450, y: 620},
        {x: 760, y: 620},
        {x: 1070, y: 620},
        {x: 1380, y: 620}
    ];
    // 截取区域大小
    const width = 210;
    const height = 60;
    await sleep(500);
    keyPress("F6")
    await sleep(1000);
    click(300, 370);//点击七日历练
    await sleep(1000);
    // 获取游戏区域截图
    const captureRegion = captureGameRegion();
    
    // 遍历四个位置进行OCR识别
    for (const pos of positions) {
        // 创建OCR识别区域
        const ocrRo = RecognitionObject.ocr(pos.x, pos.y, width, height);
        
        // 在指定区域进行OCR识别
        const result = captureRegion.find(ocrRo);
        
        if (!result.isEmpty() && result.text) {
            // 存储识别结果和对应位置
            textArray.push({
                text: result.text.trim(),
                x: pos.x + width / 2,  // 点击中心位置
                y: pos.y + height / 2
            });
            
            log.info(`识别到文本: ${result.text} 位置: (${pos.x}, ${pos.y})`);
        } else {
            log.warn(`位置 (${pos.x}, ${pos.y}) 未识别到文本`);
        }
    }
    
    log.info(`已存储的文本数量: ${textArray.length}`);
    keyPress("ESCAPE");
    await sleep(1000);
}

//局部搜索并点击匹配的文本
async function searchAndClickTexts() {
    // 限定区域坐标和大小
    const searchX = 1210;
    const searchY = 440;
    const searchWidth = 150;
    const searchHeight = 195;
    
    // 获取游戏区域截图
    const captureRegion = captureGameRegion();
    
    // 在限定区域内进行OCR识别
    const ocrRo = RecognitionObject.ocr(searchX, searchY, searchWidth, searchHeight);
    const results = captureRegion.findMulti(ocrRo);
    
    // 遍历OCR结果
    for (let i = 0; i < results.count; i++) {
        const res = results[i];
        const resText = res.text.trim();
        
        // 在存储的文本数组中查找匹配项
        const index = textArray.findIndex(item => item.text === resText);
        
        if (index !== -1) {
            // 找到匹配项，点击对应位置
       
            log.info(`找到匹配文本: ${resText}`);
            
            // 点击存储的位置
          await keyMouseScript.runFile(`assets/ALT点击.json`);
           await sleep(500);
            res.click();
            await sleep(500);
          await keyMouseScript.runFile(`assets/ALT释放.json`);
            await Playcards();
         
            // 从数组中移除已处理的文本
            textArray.splice(index, 1);
            
            return true;
        }
    }
    return false;
}

//函数：打开地图前往猫尾酒馆
    async function gotoTavern() {
log.info(`前往猫尾酒馆`);
await sleep(1000);
keyPress("m");
await sleep(1500);
click(1841, 1015);//地图选择
await sleep(1000);
click(1460, 140);//蒙德
await sleep(1200);
click(48, 441);//放大地图
await sleep(400);
click(48, 441);//放大地图
await sleep(400);
click(48, 441);//放大地图
await sleep(400);
click(48, 441);//放大地图
await sleep(400);
click(48, 441);//放大地图
await sleep(400);
click(1000, 645);//猫尾酒馆
await sleep(600);
click(1345, 690);//猫尾酒馆
await sleep(600);
click(1707, 1010);//猫尾酒馆
await sleep(7000);
    }

//函数：对话和打牌
   async function Playcards() {    
for (let i = 0;i < 5; i++) {
keyPress("VK_SPACE");
await sleep(500);
keyPress("VK_SPACE");//对话
await sleep(1000);
         }
keyPress("F"); 
await sleep(1500);
click(1610,900 );//点击挑战
await sleep(8000);
await dispatcher.runTask(new SoloTask("AutoGeniusInvokation"));
await sleep(3000);
click(1860,50 );//避免失败卡死：点击设置
await sleep(1000);    
click(1600,260 );//避免失败卡死：退出对局
await sleep(1000);    
click(1180,756 );//避免失败卡死：确认
await sleep(6000);    
click(754,915 );//退出挑战
await sleep(10000);     
for (let i = 0;i < 3; i++) {
keyPress("VK_SPACE");
await sleep(500);
keyPress("VK_SPACE");//对话
await sleep(900);
         }
    }

//前往一号桌
    async function gotoTable1() {
   log.info(`前往1号桌`);
keyDown("d");
await sleep(1500);
keyUp("d");
keyDown("w");
await sleep(400);
keyUp("w");
keyDown("d");
keyDown("w");
await sleep(1200);
keyUp("d");
keyUp("w");
await sleep(700);
    }
//前往二号桌
    async function gotoTable2() {
log.info(`前往2号桌`);
keyDown("d");
await sleep(1500);
keyUp("d");
keyDown("w");
await sleep(400);
keyUp("w");
keyDown("d");
keyDown("w");
await sleep(1200);
keyUp("d");
keyUp("w");
keyDown("s");
await sleep(700);
keyUp("s");
await sleep(700);
    }
//前往三号桌
    async function gotoTable3() {
log.info(`前往3号桌`);
keyDown("w");
await sleep(2000);
keyUp("w");
keyDown("d");
await sleep(5000);
keyUp("d");
keyDown("a");
await sleep(1500);
keyUp("a");
await sleep(700);
    }
//前往四号桌
    async function gotoTable4() {
log.info(`前往4号桌`);
keyDown("w");
await sleep(2000);
keyUp("w");
keyDown("d");
await sleep(5000);
keyUp("d");
keyDown("a");
await sleep(1500);
keyUp("a");
keyDown("d");
await sleep(200);
keyUp("d");
keyDown("w");
await sleep(2000);
keyUp("w");
await sleep(700);
    }
//前往一号包间
    async function gotoTable5() {
log.info(`前往1号包间`);
keyDown("w");
await sleep(2500);
keyUp("w");
keyDown("d");
await sleep(200);
keyUp("d");
await sleep(500);
keyPress("ESCAPE"); 
await sleep(1500);
keyPress("ESCAPE"); 
await sleep(1500);
keyDown("w");
await sleep(5900);
keyUp("w");
await sleep(700);
    }
//前往二号包间
    async function gotoTable6() {
log.info(`前往2号包间`);
await sleep(1500);
keyDown("d");
await sleep(1500);
keyUp("d");
keyDown("w");
keyDown("d");
await sleep(4000);
keyUp("d");
keyUp("w");
keyDown("a");
await sleep(1500);
keyUp("a");
keyDown("w");
await sleep(3000);
keyPress("VK_SPACE"); 
await sleep(1000);
keyUp("w");
keyDown("s");
await sleep(1000);
keyPress("VK_SPACE"); 
await sleep(700);
keyUp("s");
await sleep(500);

    }

//主流程
await genshin.returnMainUi();
await gotoTavern();
await sleep(4000);
await captureAndStoreTexts();
    for (let i = 0;i < 6; i++) {

    if (textArray.length === 0) break;
    if (i != 0)await gotoTavern();
    await gotoTable1();
    await searchAndClickTexts();
    if (textArray.length === 0) break;
    await gotoTavern();
    await gotoTable2();
    await searchAndClickTexts();
    if (textArray.length === 0) break;
    await gotoTavern();
    await gotoTable3();
    await searchAndClickTexts();
    if (textArray.length === 0) break;
    await gotoTavern();
    await gotoTable4();
    await searchAndClickTexts();
    if (textArray.length === 0) break;
    await gotoTavern();
    await gotoTable5();
    await searchAndClickTexts();
    if (textArray.length === 0) break;
    await gotoTavern();
    await gotoTable6();
    await searchAndClickTexts();
    if (textArray.length === 0) break;
         }

 })();
