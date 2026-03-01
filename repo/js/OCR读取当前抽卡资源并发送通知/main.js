// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};

// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
//let CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Wish.png"), 0, 0, 1920, 1080);

// 定义一个函数用于识别图像
async function recognizeImage(recognitionObject, timeout = 5000) {
    let startTime = Date.now();
    await sleep(500); // 短暂延迟，避免过快
    try {
        // 尝试识别图像
        const ro = captureGameRegion();
        let imageResult = ro.find(recognitionObject);
        ro.dispose();
        if (imageResult && imageResult.x != 0 && imageResult.y != 0) {
            log.info(`成功识别图像，坐标: x=${imageResult.x}, y=${imageResult.y}`);
            log.info(`图像尺寸: width=${imageResult.width}, height=${imageResult.height}`);
            return { success: true, x: imageResult.x, y: imageResult.y };
        }
    } catch (error) {
        log.error(`识别图像时发生异常: ${error.message}`);
    }
    log.warn(`无法识别图像`);
    return { success: false };
}


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
                return null; // 如果 OCR 未识别到内容，返回 null
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 数识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}

(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    const notify = settings.notify || false;

    // 按下 F3 键
    keyPress("F3");
    await sleep(1500);

    let recognized = true;

    // 识别“常驻祈愿”图标
    let startTime = Date.now();
    let targetText = "奔行世间";
    let ocrRegion = { x: 349, y: 300, width: 326, height: 88 }; // 设置对应的识别区域
    let retryCount = 0; // 重试计数
    //先判断是否为常驻卡池
    try {

        let recognizedText = await recognizeTextInRegion(ocrRegion);
        log.info(`识别到的卡池为符为：${recognizedText}`);
        recognizedText = recognizedText.replace(/[^\u4e00-\u9fa5]/g, '')// 使用正则表达式匹配并保留中文字符
        if (targetText === recognizedText) {
            await sleep(100); // 短暂延迟，避免过快
            recognized = false;                ;
            await click(1845, 540);//尝试切换卡池
            await sleep(500); // 短暂延迟，避免过快
        } 
    } catch (error) {
        log.warn(`页面标志识别失败`);
    }
    //检验是否切换成功
    while (Date.now() - startTime < 6000 && !recognized) {
        try {
   
            let recognizedText = await recognizeTextInRegion(ocrRegion);
            log.info(`识别到的卡池为符为：${recognizedText}`);
            recognizedText = recognizedText.replace(/[^\u4e00-\u9fa5]/g, '')// 使用正则表达式匹配并保留中文字符
            if (targetText === recognizedText) {
                await click(1845, 540);//继续尝试切换卡池
            } else {
                log.info(`切换卡池成功`);
                recognized = true;
                break;
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`切换失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(1000); // 短暂延迟，避免过快循环
    }



    // 如果识别到了“常驻祈愿”图标，则识别“原石以及纠缠之缘到数值”
    if (recognized) {
        //原石
        let ocrRegionYuanShi = { x: 1470, y: 25, width: 180, height: 46 }; // 设置对应的识别区域
        let recognizedText1 = await recognizeTextInRegion(ocrRegionYuanShi);
        //纠缠之缘
        let ocrRegionInterwinedFate = { x: 1650, y: 25, width: 140, height: 46 }; // 设置对应的识别区域
        let recognizedText2 = await recognizeTextInRegion(ocrRegionInterwinedFate);


        if (recognizedText1 && recognizedText2) {
            recognizedText1 = recognizedText1.replace(/\D/g, '');
            recognizedText2 = recognizedText2.replace(/\D/g, '');
            log.info(`成功识别到原石数值: ${recognizedText1} `);
            log.info(`成功识别到纠缠之缘数值: ${recognizedText2} `);
            log.info(`总价值: ${parseInt(recognizedText2, 10) * 160 + parseInt(recognizedText1, 10)}原石   ————  ${parseInt(recognizedText2, 10) + (parseInt(recognizedText1, 10) / 160) | 0}抽`);
            if (notify) {
                notification.Send(`原石数值: ${recognizedText1}`);
                notification.Send(`纠缠之缘数值: ${recognizedText2}`);
                if (!isNaN(recognizedText1) && recognizedText1.trim() !== "" && !isNaN(recognizedText2) && recognizedText2.trim() !== "") {
                    notification.Send(`总价值: ${parseInt(recognizedText2, 10) * 160 + parseInt(recognizedText1, 10)}原石   ————  ${parseInt(recognizedText2, 10) + (parseInt(recognizedText1, 10) / 160) | 0}抽`);
                } else {
                    notification.Send(`总价值转换失败`);
                }
            }

            // 获取当前时间
            const now = new Date();
            const formattedTime = now.toLocaleString(); // 使用本地时间格式化


            // 写入本地文件
            const filePath = "Resources_log.txt";
            const logContent = `${formattedTime} —— 原石数值: ${recognizedText1} —— 纠缠之缘数值: ${recognizedText2} —— 总价值: ${parseInt(recognizedText2, 10) * 160 + parseInt(recognizedText1, 10)}原石   ————  ${parseInt(recognizedText2, 10) + (parseInt(recognizedText1, 10) / 160) | 0}抽\n`;
            const result = file.WriteTextSync(filePath, logContent, true); // 追加模式
            if (result) {
                log.info("成功将原石以及纠缠之缘数值写入日志文件");
            } else {
                log.error("写入日志文件失败");
            }
        } else {
            log.warn("未能识别原石以及纠缠之缘到数值。");
        }
    } else {
        log.warn("未能识别到了“常驻祈愿”图标，跳过识别“原石以及纠缠之缘到数值”。");
    }
    await sleep(500); 
    await genshin.returnMainUi();
})();

