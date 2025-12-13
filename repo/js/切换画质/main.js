// 定义所有图标的图像识别对象，每个图片都有自己的识别区域
let ReturnRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Return.png"), 30, 30, 36, 36);
let ControlDevicesRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/ControlDevices.png"), 507, 197, 100, 27);
let RenderingPrecisionRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RenderingPrecision.png"), 507, 591, 99, 27);
let CompatibilityModeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/CompatibilityMode.png"), 507, 979, 100, 28);
let ComfirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Comfirm.png"), 994, 741, 33, 33);
let TipRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Tip.png"), 749, 524, 58, 30);
// 定义名称和图片文件名的映射表
const IconMap = {
    "派蒙": "Return.png",
    "设置": "ControlDevices.png",
    "渲染精度": "RenderingPrecision.png",
    "兼容模式": "CompatibilityMode.png",
    "确定": "Comfirm.png",
    "设置生效": "Tip.png",
    // 可以继续添加更多食材的映射
};

// 定义替换映射表
const replacementMap = {
    "监": "盐",
    "卵": "卯"
};

// 定义一个函数用于识别图像
async function recognizeAndClick(recognitionObject, iconName, timeout = 5000) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            log.info(`尝试识别图标: ${iconName}`);
            // 设置识别阈值和通道
            recognitionObject.threshold = 0.85; // 设置识别阈值为 0.85
            // recognitionObject.Use3Channels = true; // 使用三通道匹配，可能会受原神Bloom自带饱和度影响

            const ro = captureGameRegion();
            let imageResult = ro.find(recognitionObject);
            ro.dispose();
            if (imageResult) {
                // 计算中心坐标
                let centerX = imageResult.x + imageResult.width / 2;
                let centerY = imageResult.y + imageResult.height / 2;
                if (centerX === 0 && centerY === 0) {
                    log.warn(`图标 ${iconName} 尚未出现？`);
                    await sleep(1000); // 避免过快log
                    continue; // 跳过本次循环，继续尝试
                }
                // log.info(`识别图标: x=${imageResult.x}, y=${imageResult.y}, width=${imageResult.width}, height=${imageResult.height}`);

                // log.info(`成功识别图标: ${iconName}，点击坐标: x=${centerX}, y=${centerY}`);
                // await click(centerX, centerY); // 执行点击图片操作
                await sleep(500); // 确保点击后有足够的时间等待
                return true;
            }
        } catch (error) {
            log.error(`识别图标时发生异常: ${error.message}`);
            if (error.message.includes("PrevConverter is null")) {
                log.error("识别对象的 PrevConverter 属性未正确初始化，请检查识别对象的定义");
            }
            break; // 如果发生异常，退出循环
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别图标: ${iconName}`);
    return false;
}

// 定义一个函数用于识别文字并点击
async function recognizeTextAndClick(targetText, ocrRegion, timeout = 5000) {
    let startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            // 尝试 OCR 识别
            const ro = captureGameRegion();
            let resList = ro.findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height)); // 指定识别区域
            ro.dispose();
            // 遍历识别结果，检查是否找到目标文本
            for (let res of resList) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = res.text;
                for (let [wrongChar, correctChar] of Object.entries(replacementMap)) {
                    correctedText = correctedText.replace(new RegExp(wrongChar, 'g'), correctChar);
                }

                if (correctedText.includes(targetText)) {
                    // 如果找到目标文本，计算并点击文字的中心坐标
                    let centerX = Math.round(res.x + res.width / 2);
                    let centerY = Math.round(res.y + res.height / 2);
                    log.info(`通过 OCR 识别找到文字: ${targetText}`);
                    log.info(`中心坐标: x=${centerX}, y=${centerY}`);
                    await click(centerX, centerY); // 执行点击操作
                    await sleep(1000); // 确保点击后有足够的时间等待
                    return true;
                }
            }
        } catch (error) {
            log.error(`OCR 识别时发生异常: ${error.message}`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.warn(`经过多次尝试，仍然无法识别文字: ${targetText}`);
    return false;
}

(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    Rendering = settings.Rendering || "0.6";
    Quality = settings.Quality || "兼容模式"; // 获取或设置默认值
    MotionBlur = settings.MotionBlur || false;
    Bloom = settings.Bloom || false;
    keyPress("Escape");
    await sleep(1000);

    // 定义一个函数用于等待识别
    async function waitForRecognition(recognitionObject, iconName, timeout = 5000) {
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (await recognizeAndClick(recognitionObject, iconName, timeout)) {
                return true;
            }
            await sleep(500); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法识别图标: ${iconName}`);
        return false;
    }

    // 定义一个函数用于等待OCR识别
    async function waitForTextRecognition(targetText, ocrRegion, timeout = 5000) {
        let startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (await recognizeTextAndClick(targetText, ocrRegion, timeout)) {
                return true;
            }
            await sleep(500); // 短暂延迟，避免过快循环
        }
        log.warn(`经过多次尝试，仍然无法识别文字: ${targetText}`);
        return false;
    }

    // 根据识别到的图标名称，执行相应的点击操作
    if (await waitForRecognition(ReturnRo, "派蒙")) {
        click(45, 820); // 识别到派蒙，点击
    } else {
        log.warn("无法识别派蒙图标，尝试继续执行后续步骤...");
    }

    if (await waitForRecognition(ControlDevicesRo, "设置")) {
        click(165, 290); // 识别到设置，点击
    } else {
        log.warn("无法识别设置图标，尝试继续执行后续步骤...");
    }

    // 处理画质设置
    if (await waitForRecognition(RenderingPrecisionRo, "图像")) {
        // 根据 Quality 的值执行不同的操作
        if (Quality === "兼容模式") {
            moveMouseTo(1821, 1014);
            await sleep(50);
            leftButtonDown();
            await sleep(400);
            leftButtonUp();
            await sleep(50);

            // 兼容模式的逻辑
            if (await waitForRecognition(CompatibilityModeRo, "兼容模式")) {
                click(1770, 995); // 识别到兼容模式，点击
            } else {
                log.warn("无法识别兼容模式图标，尝试继续执行后续步骤...");
            }

            // 只有在兼容模式下才点击确定
            if (await waitForRecognition(ComfirmRo, "确定")) {
                click(994, 741); // 点击确定
                await sleep(500);
            } else {
                log.warn("无法识别确定图标，尝试继续执行后续步骤...");
            }
        } else if (Quality === "中" || Quality === "高") {
            // 中质量或高质量模式的逻辑
            click(1625, 210);
            await sleep(1000);
            click(1625, Quality === "中" ? 360 : 405);
            await sleep(500);
        } else {
            log.warn("未知的 图像画质: ", Quality);
        }
    } else {
        log.warn("无法识别图像图标，尝试继续执行后续步骤...");
    }

    // 检查设置是否生效
    if (await waitForRecognition(TipRo, "设置生效", 2000)) {
        log.info("部分设置生效重启生效"); // 识别到设置生效，记录日志
        click(1821, 139);
        await sleep(50);
        click(1821, 139);
        await sleep(50);
        moveMouseTo(1821, 139);
        await sleep(50);
        leftButtonDown();
        await sleep(400);
        leftButtonUp();
        await sleep(50);
    } else {
        log.warn("未能识别 部分设置生效重启生效，可能需要进一步检查");
    }

    // 处理渲染精度
    if (await waitForRecognition(RenderingPrecisionRo, "渲染精度")) {
        click(1625, 465); // 点击帧率选项
        await sleep(500);
        click(1625, 615); // 点击60
        await sleep(1000);

        if (Rendering === "1.0") {
            click(1625, 615); // 点击精度
            await sleep(1000);
            click(1625, 800); // 调整到1.0
            await sleep(1000);
            log.info("已切换至1.0渲染精度");
        } else {
            click(1625, 615); // 点击精度
            await sleep(1000);
            click(1625, 650); // 调整到默认0.6
            await sleep(1000);
            log.warn("采用默认0.6渲染精度");
        }

    } else {
        log.warn("无法识别渲染精度图标，尝试继续执行后续步骤...");
    }

    // 处理额外设置
    if (Quality !== "兼容模式" && (!MotionBlur || !Bloom)) {
        moveMouseTo(1821, 1014);
        await sleep(100);
        leftButtonDown();
        await sleep(400);
        leftButtonUp();
        await sleep(50);

        if (await waitForRecognition(CompatibilityModeRo, "额外设置")) {
            if (!MotionBlur) {
                click(1625, 465);
                await sleep(1000);
                click(1625, 520);
                await sleep(500);
                log.info("已关闭动态模糊");
            }
            if (!Bloom) {
                click(1625, 535);
                await sleep(1000);
                click(1625, 580);
                await sleep(500);
                log.info("已关闭Bloom");
            }
        } else {
            log.warn("无法识别额外设置，尝试继续执行后续步骤...");
        }
    }

    await sleep(500);
    await genshin.returnMainUi();
})();

