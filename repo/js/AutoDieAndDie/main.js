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
    if(settings.lookHere){
        await genshin.returnMainUi();
        await pathingScript.runFile("assets/忘却之峡副本.json");
        await sleep(4000);
        await click(1600,1015);
        await sleep(1000);
        await click(1600,1015);
        await sleep(7000);
        leftButtonClick();
        await sleep(1000);
        try {
             log.info("先die一下");
            keyDown("A");
            await sleep(3000);
            keyUp("A");
            await sleep(3000);
            log.info("打开背包");
            await keyPress("B");
            await sleep(1000);
            //点击食物栏
            await click(860,50);
            await sleep(1000);
            const img = await findImgIcon(`assets/RecognitionObject/${settings.food}.png`, { min: 100, max: 1200 }, { min: 100, max: 400 }, true);
            await click(1600,1015);
            await sleep(1000);
            for (let index = 0; index < settings.foodNum; index++) {
                await click(1250,630);
                await sleep(30);
            };
            await sleep(1000);
            await click(1015,777);
            await sleep(1000);
            await keyPress("ESCAPE");
            await sleep(1000);
            await keyPress("ESCAPE");
            await sleep(1000);
            keyDown("A");
            await sleep(3000);
            keyUp("A");
            await sleep(3000);

            for (let index = 0; index < settings.runNum -1; index++) {
                await keyPress("B");
                await sleep(1000);
                //点击食物栏
                await click(860,50);
                await sleep(1000);
                await click(img[0].x,img[0].y);
                await sleep(1500);
                await click(1600,1015);
                await sleep(1000);
                for (let index1 = 0; index1 < settings.foodNum -1; index1++) {
                    await click(1250,630);
                    await sleep(30);
                };
                await sleep(1000);
                await click(1015,777);
                await sleep(1000);
                await keyPress("ESCAPE");
                await sleep(1000);
                await keyPress("ESCAPE");
                await sleep(1000);
                keyDown("A");
                await sleep(3000);
                keyUp("A");
                await sleep(3000);
                
            };
            await genshin.tp(2297.890625, -824.24365234375);
            await sleep(5000);
        
        } catch (error) {
            log.error(`识别图像时发生异常: ${error.message}`);
        };
        await genshin.returnMainUi();
    }else{
        log.error(`亲，这面邀请您打开脚本目录找到AutoDieAndDie文件并打开然后去阅读README！！！`);
        log.error(`亲，这面邀请您打开脚本目录找到AutoDieAndDie文件并打开然后去阅读README！！！`);
        log.error(`亲，这面邀请您打开脚本目录找到AutoDieAndDie文件并打开然后去阅读README！！！`);
    };


    //输出日期
    // writeContentToFile("", true);

    // await sleep(400);
    // log.info("你好");
    // for (let index = 0; index < settings.foodNum; index++) {
    //     await click(1250,630);
    //     await sleep(20);
    // };

})();