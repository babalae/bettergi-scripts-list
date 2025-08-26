//初始化
let gameRegion;

//对话识别区域
xZone = { min: 900, max: 1700 }; 
yZone = { min: 380, max: 880 };




//文字识别,并返回相关信息
async function performOcr(keyWords, xRange, yRange,judge) {
    gameRegion = captureGameRegion();
    try {
        if (judge == "true") {
            let ocrResult = gameRegion.find(RecognitionObject.ocr(
                xRange.min, yRange.min,
                xRange.max - xRange.min, yRange.max - yRange.min
            ));
            if (ocrResult) {
                let correctedText = ocrResult.text;
                return correctedText; 
            } else {
                // log.warn(`OCR 识别区域未找到内容`);
                return ""; 
            }
        } else {
            
            let resList = gameRegion.findMulti(RecognitionObject.ocr(
                xRange.min, yRange.min,
                xRange.max - xRange.min, yRange.max - yRange.min
            ));
            gameRegion.dispose();
            // 遍历识别结果，检查是否找到目标文本
            let results = [];
            for (let i = 0; i < resList.count; i++) {
                let res = resList[i];
                let correctedText = res.text;
                if (correctedText.includes(keyWords)) {
                    results.push({ text: correctedText, x: res.x, y: res.y, width: res.width, height: res.height });
                    //点击中心
                    // await click(Math.round(res.x +res.width/2),Math.round(res.y + res.height/2));          
                    keyDown("VK_MENU");
                    await sleep(500);
                    moveMouseTo(res.x, res.y);
                    leftButtonClick();
                    await sleep(800);
                    keyUp("VK_MENU");
                    await sleep(1000);
                    leftButtonClick();
                    break;
                }
            }
            return results;
        }
    } catch (error) {
        log.error(`识别图像时发生异常: ${error.message}`);
        return null;
    }

}


//图标识别，并返回相关信息
async function findImgIcon(imagePath, xRange, yRange) {
    let template = file.ReadImageMatSync(imagePath);
    let recognitionObject = RecognitionObject.TemplateMatch(template, xRange.min, yRange.min,
            xRange.max - xRange.min, yRange.max - yRange.min);
    let results = [];
    try {
        gameRegion = captureGameRegion();
        let result = gameRegion.find(recognitionObject);
        if (result.isExist()) {
            results.push({ success: true, x: result.x, y: result.y, width: result.width, height: result.height });
            keyDown("VK_MENU");
            await sleep(500);
            moveMouseTo(result.x, result.y);
            leftButtonClick();
            await sleep(800);
            keyUp("VK_MENU");
        } else {
            // log.info("图像识别失败");
        }
        return results;
    } catch (error) {
        log.error(`识别图像时发生异常: ${error.message}`);
    }
}





(async function() {
    //蒙德清泉镇圣水
    if (settings.water) {
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/霍普金斯.json");
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/蒙德清泉镇路线.json");
        await sleep(1000);
        //识别区域
        try {
            //识别对话位置，并点击
            let ocrResults = await performOcr("神奇的", xZone, yZone, "false");
            if (ocrResults.length != 0) {
                await genshin.chooseTalkOption("如何才能获得强大的力量");
                await sleep(1000);
                leftButtonClick();
                await sleep(1000);
                let recognizedOveer = await performOcr("已",{ min: 1482, max: 1630 }, { min: 912, max: 957 }, "false")
                if (recognizedOveer.length != 0) {
                    log.info("已售罄！！！");
                    await genshin.returnMainUi();
                } else {
                    let recognizedMora = await performOcr("", { min: 1600, max: 1780 }, { min: 30, max: 60 }, "true")
                    if (BigInt(recognizedMora) >= 300) {
                        await sleep(800);
                        await click(1636,1019);
                        await sleep(1000);
                        await click(1168,785);
                        await sleep(1000);
                    } else {
                        log.info("不是哥们，你怎么比我还穷！！！");
                        await genshin.returnMainUi();
                    };
                };
            };
        await genshin.returnMainUi();
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
    };

    
    //璃月璃沙娇上香
    if (settings.sticks) {
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/璃月璃沙娇路线.json");
        await sleep(1000);
        //识别区域
        try {
            //识别对话位置，并点击
            // let ocrResults = await performOcr("王平安", { min: 1058, max: 1551 }, { min: 394, max: 680 },"false");
            let ocrResults = await performOcr("王平安", xZone, yZone,"false");
            if (ocrResults.length != 0) {
                await genshin.chooseTalkOption("能给我几支香吗");
                await sleep(700);
                leftButtonClick();
                await sleep(700);
                leftButtonClick();
                await sleep(1500);
                
                // let ocrResults1 = await performOcr("敬香", { min: 1060, max: 1550 }, { min: 400, max: 680 },"false");
                let ocrResults1 = await performOcr("敬香", xZone, yZone,"false");
                if(ocrResults1.length != 0){
                    await sleep(1000);
                    await click(1168,785);
                    await sleep(1000);
                } else {
                    log.error(`未识别到对话`);
                    await genshin.returnMainUi();
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        await genshin.returnMainUi();
    };

    //稻妻鸣神大社抽签
    if (settings.lots) {
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/稻妻鸣神大社路线.json");
        await sleep(1000);
        //识别区域
        try {
            //识别对话位置，并点击
            let ocrResults = await performOcr("御神签箱", xZone, yZone, "false");
            if (ocrResults.length != 0) {
                await sleep(700);
                leftButtonClick();
                await sleep(2000);
                let ocrResults1 = await performOcr("求签吧", xZone, yZone, "false");
                if (ocrResults1.length != 0) {
                    await sleep(3000);
                    leftButtonClick();
                    await sleep(5000);
                    leftButtonClick();
                    await sleep(3000);
                };

                let ocrResults2 = await performOcr("玄冬林", xZone, yZone,"false");
                if (ocrResults2.length != 0) {
                    await sleep(700);
                    leftButtonClick();
                    await sleep(3000);
                    let ocrResults3 = await performOcr("我要", xZone, yZone, "false");
                    if (ocrResults3.length != 0) {
                        await sleep(700);
                        leftButtonClick();
                        await sleep(1500);
                        //交互道具，直接选择位置点击
                        await click(111,184);
                        await sleep(1000);
                        await click(1250,817);
                        await sleep(1000);
                        await click(1603,1013);
                        await sleep(1500);
                        await genshin.returnMainUi();
                        //打开背包找签
                        await keyPress("B");
                        await sleep(1000);
                        await click(1150,50);
                        await sleep(700);
                        for(let i = 0; i <= 4; i++){
                            //{ min: 93, max: 1283 }, { min: 99, max: 823 }
                            let img = await findImgIcon("assets/RecognitionObject/YuShenQian.png", { min: 99, max: 1295 }, { min: 104, max: 967 })
                            if (img.length != 0) {
                                break;
                            }
                            await keyMouseScript.runFile(`assets/移动4行.json`);
                        };
                        await sleep(2000);
                        await click(1670,1025);
                        await sleep(2000);
                        let recognizedText = await performOcr("", { min: 720, max: 790 }, { min: 111, max: 155 }, "true");
                        if(recognizedText == "大凶" || recognizedText == "凶-"){
                                await genshin.returnMainUi();
                                await pathingScript.runFile("assets/挂签路线.json");
                                await performOcr("挂起来吧", { min: 900, max: 1700 }, { min: 380, max: 880 }, "false");
                                await sleep(700);
                                leftButtonClick();
                                log.info("事事顺利");
                        };
                    } else {
                        await genshin.chooseTalkOption("再见");
                        await sleep(700);
                        leftButtonClick();
                        await sleep(1500);
                        log.info("对话出现再见，默认解签完毕以及查看签操作！！！");
                    };
                    
                };


            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
                await genshin.returnMainUi();
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        await genshin.returnMainUi();
        
    };


    //枫丹梅洛彼得堡领取福利餐
    if(settings.meal){
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/枫丹梅洛彼得堡路线.json");
        await sleep(1000);
        try {
            let ocrResults = await performOcr("布兰", xZone, yZone, "false");
            if (ocrResults.length != 0) {
                await sleep(1000);
                let ocrResults1 = await performOcr("没什么", xZone, yZone, "false");
                if(ocrResults1.length != 0){
                    await sleep(700);
                    log.info("对话出现没什么，默认领取和使用过！！！");
                } else{
                    await genshin.chooseTalkOption("给我一份福利餐");
                    await sleep(1000);
                    leftButtonClick();
                    await sleep(1000);
                    leftButtonClick();
                    await sleep(1500);
                    //打开背包找签
                    log.info("打开背包");
                    await keyPress("B");
                    await sleep(1000);
                    await click(1250,50); 
                    await sleep(1000);
                    for(let i = 0; i <= 2; i++){
                        let img = await findImgIcon("assets/RecognitionObject/WelffareMeal.png", { min: 99, max: 1295 }, { min: 104, max: 967 })
                        if (img.length != 0) {
                            break;
                        }
                        await keyMouseScript.runFile(`assets/移动4行.json`);
                    };
                    //这里是点击使用
                    await sleep(1000);
                    await click(1670,1025);
                    await sleep(2000);
                    //识别获得的食物名称
                    let recognizedText = await performOcr("", { min: 813, max: 985 }, { min: 585, max: 619 }, "true");
                    log.info(`获得：${recognizedText}`);
                    //点击幸运签，并识别内容
                    await sleep(1000);
                    await click(1000,520);
                    await sleep(2000);
                    let recognizedText1 = await performOcr("", { min: 716, max: 1200 }, { min: 631, max: 710 }, "true");
                    log.info(`幸运签内容：${recognizedText1}`);
                };

            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
                await genshin.returnMainUi();
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        await genshin.returnMainUi();
    };

    //纳塔悠悠集市
    if(settings.eggs){
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/纳塔悠悠集市路线.json");
        await sleep(1000);
        try {
            let ocrResults = await performOcr("察尔瓦", xZone, yZone, "false");

                await sleep(700);
                leftButtonClick();
                await sleep(2000);
                
                let ocrResults1 = await performOcr("让我挑一枚", xZone, yZone, "false");
                if (ocrResults1 != 0) {
                    await sleep(5000);
                    let figure = 0;
                    //六龙蛋位置
                    let coordinates = [
                        [551, 153],
                        [1087, 161],
                        [881, 341],
                        [1342, 357],
                        [472, 572],
                        [572, 721]
                    ];
                    switch (settings.pickupDragonEgg) {
                        case "闪闪礼蛋·山之血":
                            figure = 1;
                            break;
                        case "闪闪礼蛋·太阳的轰鸣":
                            figure = 2;
                            break;
                        case "闪闪礼蛋·圣龙君临":
                            figure = 3;
                            break;
                        case "闪闪礼蛋·菲耶蒂娜":
                            figure = 4;
                            break;
                        case "闪闪礼蛋·献给小酒杯":
                            figure = 5;
                            break;
                        case "闪闪礼蛋·飞澜鲨鲨":
                            figure = 6;
                            break;
                        default:
                            figure = Math.floor(Math.random() * 6) + 1;
                            log.info(`随机到第${figure}个蛋`);
                            break;
                    };
                    moveMouseTo(coordinates[figure - 1][0],coordinates[figure - 1][1]);
                    await sleep(100);
                    leftButtonClick();
                    await sleep(3000);
                } else {
                    log.info("你今天已经领取过了");
                };
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        }
        await genshin.returnMainUi();
    };




})();