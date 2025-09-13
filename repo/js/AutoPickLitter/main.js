// 初始化游戏截图区域
let gameRegion;

// 对话识别区域
const dialogZone = { x: { min: 900, max: 1700 }, y: { min: 380, max: 880 } };




//文字识别,并返回相关信息
async function performOcr(keyWords, xRange, yRange, judge) {
    //截取游戏截图
    gameRegion = captureGameRegion();
    try {
        if (judge) {
            //单个识别
            let ocrResult = gameRegion.find(RecognitionObject.ocr(
                xRange.min, yRange.min,
                xRange.max - xRange.min, yRange.max - yRange.min
            ));
            //释放内存
            gameRegion.dispose();
            if (ocrResult) {
                //识别结果
                let correctedText = ocrResult.text;
                return correctedText; 
            } else {
                // log.warn(`OCR 识别区域未找到内容`);
                return ""; 
            }
        } else {
            //多个识别
            let resList = gameRegion.findMulti(RecognitionObject.ocr(
                xRange.min, yRange.min,
                xRange.max - xRange.min, yRange.max - yRange.min
            ));
            //释放内存
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


//图像识别，并返回相关信息
async function findImgIcon(imagePath, xRange, yRange, judge) {
    // 读取图像模板
    let template = file.ReadImageMatSync(imagePath);
    // 创建识别对象
    let recognitionObject = RecognitionObject.TemplateMatch(template, xRange.min, yRange.min,
        xRange.max - xRange.min, yRange.max - yRange.min);
    let results = [];
    let results1 = [];
    // 捕捉游戏截图
    gameRegion = captureGameRegion();
    // 查找图像
    let result = gameRegion.find(recognitionObject);
    // 释放内存
    gameRegion.dispose();
    try {
        // 如果需要判断
        if (judge) {
            // 如果找到
            if (result.isExist()) {
                // 保存结果
                results.push({ success: true, x: result.x, y: result.y, width: result.width, height: result.height });
                // 点击该位置
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
        } else {
            // 如果找到
            if (result.isExist()) {
                // 保存结果
                results1.push({ success: true, x: result.x, y: result.y, width: result.width, height: result.height });
            } else {
                // log.info("图像识别失败");
            }
            return results1;
        }
        
    } catch (error) {
        log.error(`识别图像时发生异常: ${error.message}`);
    }
}

//添加信息
function writeContentToFile(content, judge) {
    let finalAccountName = settings.accountName || "默认账户";
    try {
        const illegalCharacters = /[\\/:*?"<>|]/;
        const reservedNames = [
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
        ];

        if (finalAccountName === "" ||
            finalAccountName.startsWith(" ") ||
            finalAccountName.endsWith(" ") ||
            illegalCharacters.test(finalAccountName) ||
            reservedNames.includes(finalAccountName.toUpperCase()) ||
            finalAccountName.length > 255
        ) {
            log.error(`账户名 "${finalAccountName}" 不合法，将使用默认值`);
            finalAccountName = "默认账户";
        } 
    } catch (error) {
        // 只在文件完全不存在时创建，避免覆盖
        file.writeTextSync(finalAccountName, content, false);
        log.info(`创建新文件: ${finalAccountName}`);
    }
    

    let filePath = `records/${finalAccountName}.txt`;
    //读取现有内容
    let existingContent = "";
    try {
        existingContent = file.readTextSync(filePath);
    } catch (e) {
    }

    if (judge) {
        runDate = `==========${new Date().getFullYear()}年${String(new Date().getMonth() + 1).padStart(2, '0')}月${String(new Date().getDate()).padStart(2, '0')}日==========`;
        const finalContent1 = runDate + "\n" + existingContent;
        //按行分割，保留最近365条完整记录（按原始换行分割，不过滤）
        const lines = finalContent1.split("\n");
        const keepLines = lines.length > 365 * 5 ? lines.slice(0, 365 * 5) : lines; // 假设每条记录最多5行
        const result1 = file.writeTextSync(filePath, keepLines.join("\n"), false);

        if (result1) {
            log.info(`写入成功: ${filePath}`);
        } else {
            log.error(`写入失败: ${filePath}`);
        }

    } else {

        //拼接
        const finalContent = content + existingContent;
        //按行分割，保留最近365条完整记录（按原始换行分割，不过滤）
        const lines = finalContent.split("\n");
        const keepLines = lines.length > 365 * 5 ? lines.slice(0, 365 * 5) : lines; // 假设每条记录最多5行
        const result = file.writeTextSync(filePath, keepLines.join("\n"), false);

        if (result) {
            log.info(`写入成功: ${filePath}`);
        } else {
            log.error(`写入失败: ${filePath}`);
        }
    }
}

// 滚动页面
// totalDistance: 需要滚动的总距离
// stepDistance: 每次滚动的距离
// delayMs: 两次滚动之间的延迟
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    // 移动鼠标到(999, 750)并按下左键
    moveMouseTo(999, 750);
    await sleep(50);
    leftButtonDown();

    // 估算需要滚动的步数
    const steps = Math.ceil(totalDistance / stepDistance);
    // 依次滚动
    for (let j = 0; j < steps; j++) {
        // 计算本次滚动剩余的距离
        const remainingDistance = totalDistance - j * stepDistance;
        // 如果剩余距离小于 stepDistance，则滚动剩余的距离
        // 否则滚动 stepDistance
        const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        // 滚动
        moveMouseBy(0, -moveDistance);
        // 等待 delayMs ms
        await sleep(delayMs);
    }
    // 等待700ms
    await sleep(700);
    // 释放左键
    leftButtonUp();
    // 等待100ms
    await sleep(100);
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
            let ocrResults = await performOcr("神奇的", dialogZone.x, dialogZone.y, false);
            if (ocrResults.length != 0) {
                await sleep(700);
                await genshin.chooseTalkOption("如何才");
                await sleep(1000);
                leftButtonClick();
                await sleep(1000);
                let recognizedOver = await performOcr("已",{ min: 1482, max: 1630 }, { min: 912, max: 957 }, false)
                if (recognizedOver.length != 0) {
                    log.info("已售罄！！！");
                    // await genshin.returnMainUi();
                } else {
                    let recognizedMora = await performOcr("", { min: 1600, max: 1780 }, { min: 30, max: 60 }, true)
                    if (BigInt(recognizedMora) >= 300) {
                        await sleep(800);
                        await click(1636,1019);
                        await sleep(1000);
                        await click(1168,785);
                        await sleep(1000);
                    } else {
                        log.info("不是哥们，你怎么比我还穷！！！");
                        // await genshin.returnMainUi();
                    };
                };
            };
        // await genshin.returnMainUi();
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
    };

    
    //璃月璃沙娇上香
    if (settings.sticks) {
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/璃月璃沙娇路线.json");
        await sleep(1000);
        //识别区域
        try {
            //识别对话位置，并点击
            // let ocrResults = await performOcr("王平安", { min: 1058, max: 1551 }, { min: 394, max: 680 }, false);
            let ocrResults = await performOcr("王平安", dialogZone.x, dialogZone.y, false);
            if (ocrResults.length != 0) {
                await sleep(700);
                await genshin.chooseTalkOption("能给我几支香吗");
                await sleep(700);
                leftButtonClick();
                await sleep(700);
                leftButtonClick();
                await sleep(1500);
                
                // let ocrResults1 = await performOcr("敬香", { min: 1060, max: 1550 }, { min: 400, max: 680 }, false);
                let ocrResults1 = await performOcr("敬香", dialogZone.x, dialogZone.y, false);
                if(ocrResults1.length != 0){
                    // await sleep(700);
                    await click(1168,785);
                    await sleep(700);
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
            let ocrResults = await performOcr("御神签箱", dialogZone.x, dialogZone.y, false);
            if (ocrResults.length != 0) {
                await sleep(700);
                leftButtonClick();
                await sleep(2000);
                let ocrResults1 = await performOcr("求签吧", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.length != 0) {
                    await sleep(2000);
                    leftButtonClick();
                    await sleep(4000);
                    leftButtonClick();
                    await sleep(3500);
                };

                let ocrResults2 = await performOcr("玄冬林", dialogZone.x, dialogZone.y, false);
                if (ocrResults2.length != 0) {
                    await sleep(1000);
                    leftButtonClick();
                    await sleep(700);
                    let ocrResults3 = await performOcr("我要", dialogZone.x, dialogZone.y, false);
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
                        for(let scroll = 0; scroll <= 22; scroll++){
                            //识别御神签
                            let img = await findImgIcon("assets/RecognitionObject/YuShenQianHalf.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true)
                            if (img.length != 0) {
                                break;
                            };
                            //判断是否到底
                            let img1 = await findImgIcon("assets/RecognitionObject/SliderBottom.png", { min: 1284, max: 1293 }, { min: 916, max: 942 }, false)
                            if (img1.length != 0) {
                                log.info("已到达最后一页！");
                                break;
                            };
                            //滑动背包
                            await scrollPage(680, 10, 5);
                            await sleep(100);
                        };
                        await sleep(2000);
                        await click(1670,1025);
                        await sleep(2500);
                        // 通过图片识别
                        // 大凶or凶
                        let img2 = await findImgIcon("assets/RecognitionObject/BigBad.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                        let img3 = await findImgIcon("assets/RecognitionObject/Bad.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                        // 大吉、中吉、吉、末吉
                        let img4 = await findImgIcon("assets/RecognitionObject/BigLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                        let img5 = await findImgIcon("assets/RecognitionObject/MidLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                        let img6 = await findImgIcon("assets/RecognitionObject/EndLuck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                        let img7 = await findImgIcon("assets/RecognitionObject/Luck.png", { min: 630, max: 830 }, { min: 100, max: 160 }, false);
                        await genshin.returnMainUi();
                        if (img2.length !== 0) {
                            log.info("抽签的结果:大凶");
                            writeContentToFile(`抽签的结果:大凶\n`, false);
                            await pathingScript.runFile("assets/挂签路线.json");
                            await performOcr("御签挂", { min: 900, max: 1700 }, { min: 380, max: 880 }, false);
                            await genshin.chooseTalkOption("挂起来吧");
                            await sleep(700);
                            await click(111,184);
                            await sleep(1000);
                            await click(1250,817);
                            await sleep(1000);
                            await click(1603,1013);
                            await sleep(1500);
                            await genshin.returnMainUi();
                            log.info("事事顺利");
                        } else if (img3.length !== 0) {
                            log.info("抽签的结果:凶");
                            writeContentToFile(`抽签的结果:凶\n`, false);
                            await pathingScript.runFile("assets/挂签路线.json");
                            await performOcr("御签挂", { min: 900, max: 1700 }, { min: 380, max: 880 }, false);
                            await sleep(700);
                            await genshin.chooseTalkOption("挂起来吧");
                            await click(111,184);
                            await sleep(1000);
                            await click(1250,817);
                            await sleep(1000);
                            await click(1603,1013);
                            await sleep(1500);
                            await genshin.returnMainUi();
                            log.info("事事顺利");
                        } else if (img4.length !== 0) {
                            log.info("抽签的结果:大吉");
                            writeContentToFile(`抽签的结果:大吉\n`, false);
                        } else if (img5.length !== 0) {
                            log.info("抽签的结果:中吉");
                            writeContentToFile(`抽签的结果:中吉\n`, false);
                        } else if (img6.length !== 0) {
                            log.info("抽签的结果:末吉");
                            writeContentToFile(`抽签的结果:末吉\n`, false);
                        } else if (img7.length !== 0) {
                            log.info("抽签的结果:吉");
                            writeContentToFile(`抽签的结果:吉\n`, false);
                        } else {
                            log.warn("嘘，快踢作者屁股，修bug！！！");
                            
                        };
                        
                    } else {
                        await sleep(700);
                        await genshin.chooseTalkOption("再见");
                        await sleep(700);
                        leftButtonClick();
                        await sleep(1500);
                        log.info("对话出现再见，默认解签完毕以及查看签操作！！！");
                    };
                    
                };


            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
                // await genshin.returnMainUi();
            }
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
        
    };


    //稻妻踏鞴砂海螺
    if (settings.conchs) {
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/稻妻踏鞴砂路线.json");
        await sleep(700);
        let figure = parseInt(settings.pickupTreasure);
        try {
            let ocrResults = await performOcr("阿敬", dialogZone.x, dialogZone.y, false);
            if (ocrResults.length != 0) {
                await sleep(1000);
                let ocrResults1 = await performOcr("想要", dialogZone.x, dialogZone.y, false);
                if (ocrResults1.length != 0) {
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
                    if (figure != 0) {
                        await pathingScript.runFile(`assets/宝箱${figure}.json`);
                        log.info(`你即将开启${figure}号宝箱`)
                    } else {
                        figure = Math.floor(Math.random() * 3) + 1;
                        log.info(`你即将开启${figure}号宝箱`)
                        await pathingScript.runFile(`assets/宝箱${figure}.json`);
                    }
                } else {
                    log.info("你开过了？look my eyes,回答我！！！");
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
                // await genshin.returnMainUi();
            };
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
    };

    //枫丹梅洛彼得堡领取福利餐
    if(settings.meal){
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/枫丹梅洛彼得堡路线.json");
        await sleep(700);
        try {
            let ocrResults = await performOcr("布兰", dialogZone.x, dialogZone.y, false);
            if (ocrResults.length != 0) {
                await sleep(1000);
                let ocrResults1 = await performOcr("没什么", dialogZone.x, dialogZone.y, false);
                if(ocrResults1.length != 0){
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
                    for(let scroll = 0; scroll <= 10; scroll++){
                        let img = await findImgIcon("assets/RecognitionObject/WelffareMealHalf.png", { min: 99, max: 1295 }, { min: 104, max: 967 }, true)
                        if (img.length != 0) {
                            break;
                        }
                        //滑动背包
                        await sleep(1000);
                        await scrollPage(680, 10, 5);
                        await sleep(1000);
                    };
                    //这里是点击使用
                    await sleep(1000);
                    await click(1670,1025);
                    await sleep(2000);
                    //识别获得的食物名称
                    let recognizedText = await performOcr("", { min: 813, max: 985 }, { min: 585, max: 619 }, true);
                    log.info(`获得:${recognizedText}`);
                    //点击幸运签，并识别内容
                    await sleep(1000);
                    await click(1000,520);
                    await sleep(2000);
                    let recognizedText1 = await performOcr("", { min: 716, max: 1200 }, { min: 631, max: 710 }, true);
                    log.info(`幸运签内容:${recognizedText1}`);
                    writeContentToFile(`获得的食物:${recognizedText}\n幸运签内容:${recognizedText1}\n`, false);
                };

            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
                // await genshin.returnMainUi();
            };
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
    };

    //纳塔悠悠集市
    if(settings.eggs){
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/纳塔悠悠集市路线.json");
        await sleep(1000);
        try {
            let ocrResults = await performOcr("察尔瓦", dialogZone.x, dialogZone.y, false);
            if (ocrResults.length != 0) {
                await sleep(700);
                leftButtonClick();
                await sleep(2000);
                
                let ocrResults1 = await performOcr("让我挑一枚", dialogZone.x, dialogZone.y, false);
                if (ocrResults1 != 0) {
                    await sleep(5000);
                    let figure = 0;
                    //六龙蛋位置
                    let coordinates = [
                        [551, 153],
                        [881, 341],
                        [1087, 161],
                        [1342, 357],
                        [472, 572],
                        [572, 721]
                    ];
                    switch (settings.pickupDragonEgg) {
                        case "闪闪礼蛋·山之血":
                            figure = 1;
                            writeContentToFile("获得的龙蛋:闪闪礼蛋·山之血\n", false);
                            break;
                        case "闪闪礼蛋·太阳的轰鸣":
                            figure = 2;
                            writeContentToFile("获得的龙蛋:闪闪礼蛋·太阳的轰鸣\n", false);
                            break;
                        case "闪闪礼蛋·圣龙君临":
                            writeContentToFile("获得的龙蛋:闪闪礼蛋·圣龙君临\n", false);
                            figure = 3;
                            break;
                        case "闪闪礼蛋·菲耶蒂娜":
                            writeContentToFile("获得的龙蛋:闪闪礼蛋·菲耶蒂娜\n", false);
                            figure = 4;
                            break;
                        case "闪闪礼蛋·献给小酒杯":
                            writeContentToFile("获得的龙蛋:闪闪礼蛋·献给小酒杯\n", false);
                            figure = 5;
                            break;
                        case "闪闪礼蛋·飞澜鲨鲨":
                            writeContentToFile("获得的龙蛋:闪闪礼蛋·飞澜鲨鲨\n", false);
                            figure = 6;
                            break;
                        default:
                            figure = Math.floor(Math.random() * 6) + 1;
                            log.info(`随机到第${figure}个蛋`);
                            switch (figure) {
                                case 1:
                                    writeContentToFile("获得的龙蛋:闪闪礼蛋·山之血\n", false);
                                    break;
                                case 2:
                                    writeContentToFile("获得的龙蛋:闪闪礼蛋·太阳的轰鸣\n", false);
                                    break;
                                case 3:
                                    writeContentToFile("获得的龙蛋:闪闪礼蛋·圣龙君临\n", false);
                                    break;
                                case 4:
                                    writeContentToFile("获得的龙蛋:闪闪礼蛋·菲耶蒂娜\n", false);
                                    break;
                                case 5:
                                    writeContentToFile("获得的龙蛋:闪闪礼蛋·献给小酒杯\n", false);
                                    break;
                                default:
                                    writeContentToFile("获得的龙蛋:闪闪礼蛋·飞澜鲨鲨\n", false);
                                    break;
                            };
                            break;
                    };
                    moveMouseTo(coordinates[figure - 1][0],coordinates[figure - 1][1]);
                    await sleep(100);
                    leftButtonClick();
                    await sleep(3000);
                } else {
                    log.info("你今天已经领取过了");
                };
            } else {
                log.error(`识别图像时发生异常: ${error.message}`);
            };
            

                
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
    };

    //输出日期
    writeContentToFile("", true);

})();