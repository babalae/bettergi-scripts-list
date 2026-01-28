const replacementMap = {
    "监": "盐",
    "卵": "卯"
};

// 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 在指定区域进行 OCR 识别
            const ro = captureGameRegion();
            let ocrResult = ro.find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            ro.dispose();
            if (ocrResult) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = ocrResult.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }
                return correctedText; // 返回识别到的内容
            } else {
                log.warn(`OCR 识别区域未找到内容`);
                await sleep(500);
                return null; // 如果 OCR 未识别到内容，返回 null
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            await sleep(500);
            log.warn(`OCR 数识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}

// 获取并判断原石数量的函数
async function checkAndExchangeYuanShi() {

    // 获取原石数量的OCR区域
    let ocrRegionYuanShi = { x: 1585, y: 25, width: 180, height: 46 }; // 设置原石的OCR区域
    let recognizedText1 = await recognizeTextInRegion(ocrRegionYuanShi);
    
    if (recognizedText1) {
        // 提取有效的数字（只保留数字部分）
        recognizedText1 = recognizedText1.replace(/\D/g, '');
        log.info(`成功识别到原石数值: ${recognizedText1}`);

        // 判断原石数量是否足够兑换一个粉球（160原石）
        if (parseInt(recognizedText1, 10) >= 160) {
            log.info(`原石数量充足，执行兑换操作...`);
            return true;  // 返回 true 表示原石数量足够，继续兑换
        } else {
            log.warn(`原石数量不足，跳过兑换`);
            return false;  // 如果未识别到原石数量，返回 false
        }
    } else {
        log.warn(`未能识别到原石数量，跳过兑换`);
        return false;  // 如果未识别到原石数量，返回 false
    }
}

// 执行兑换操作的函数
async function executeExchange() {
    let continueExchanging = true;  // 用于控制是否继续兑换

    while (continueExchanging) {

        // 模板匹配粉球并进行兑换
        const pinkBallRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/pinkBall.png"));
        let ro1 = captureGameRegion();  // 获取游戏区域
        let pinkBall = ro1.find(pinkBallRo);  // 使用模板匹配查找粉球按钮
        ro1.dispose();  // 清理资源

        if (pinkBall.isExist()) {
            pinkBall.click(); await sleep(1000);  // 点击粉球按钮
            click(1164, 782); await sleep(500);  // 确认兑换
            click(960, 754); await sleep(1000);  // 点击空白处继续

            // 每次兑换后检查原石数量
            continueExchanging = await checkAndExchangeYuanShi();  // 如果原石不足，继续为 false，停止兑换

            // 如果原石不足，不需要继续兑换
            if (!continueExchanging) {
                break;
            }

        } else {
            log.warn("未能找到粉球按钮，跳过兑换");
            continueExchanging = false;  // 如果没有找到粉球按钮，停止兑换
        }
    }
}

async function exchangeGoods() {

    await genshin.returnMainUi();await sleep(1000);// 返回主界面
    keyPress("ESCAPE"); await sleep(2000);//呼叫派蒙
    click(198,416);await sleep(2000);//点击商城

    // 如果原石数量充足，继续进行尘辉兑换
    click(127,434);await sleep(1000);//尘辉兑换
    let canExchange = await checkAndExchangeYuanShi();  // 获取原石数量并判断是否足够
    if (!canExchange) {
        log.warn("原石不足，跳过商城兑换");
        return;  // 如果原石不足，直接退出，不执行后续操作
    }
    click(1230,120);await sleep(1000);//原石购买
    await executeExchange();

    // 通知完成
    notification.send(`商城抽卡资源兑换完成`);
}


    
(async function () {
    await exchangeGoods();  // 调用兑换函数
})();
