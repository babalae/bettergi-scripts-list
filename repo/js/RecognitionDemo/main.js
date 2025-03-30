const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/paimon_menu.png"), 0, 0, genshin.width / 3.0, genshin.width / 5.0);
const appleRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/apple.png"));
const confirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/confirm.png"));


/**
 * 返回主界面，这里只做demo演示
 * 实际场景下，推荐使用已经包装好了的 `genshin.returnMainUi()`
 * @returns {Promise<void>}
 */
const returnMain = async () => {
    // 获取一张截图
    for (let i = 0; i < 5; i++) {
        // 最多 ESC 5次
        let captureRegion = captureGameRegion();
        let res = captureRegion.Find(paimonMenuRo);
        if (res.isEmpty()) {
            keyPress("ESCAPE");
        } else {
            log.info("已到达主界面，主菜单位置({x},{y},{h},{w})", res.x, res.y, res.width, res.Height);
            break;
        }
        await sleep(500);
    }
}

/**
 * 识别demo
 */
(async function () {

    // 返回到主界面
    await returnMain();

    // 获取一张截图
    let captureRegion = captureGameRegion();

    // 对整个区域进行 OCR
    let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
    log.info("OCR 全区域识别结果数量 {len}", resList.count);
    for (let i = 0; i < resList.count; i++) {
        let res = resList[i];
        log.info("OCR结果:位置({x},{y},{h},{w}), 文本{text}", res.x, res.y, res.width, res.Height, res.text);
    }

    // 对右下角区域进行OCR （这里所有位置建议使用比例或者相对位置，支持不同画面大小的情况）
    let captureRegion2 = captureGameRegion();
    let resList2 = captureRegion2.findMulti(RecognitionObject.ocr(captureRegion2.width / 2.0, captureRegion2.height /  2.0, captureRegion2.width / 2.0, captureRegion2.height /  2.0));
    for (let i = 0; i < resList2.count; i++) {
        if (resList2[i].text.includes("UID")) {
            log.info("找到UID内容：{text}",resList2[i].text);
            break;
        }
    }

    await sleep(200);

    // 打开背包
    keyPress("B");
    await sleep(1000);
    click(867,56);
    await sleep(1000);

    // 吃个日落果
    let apple = captureGameRegion().find(appleRo);
    if (apple.isExist()) {
        apple.click();
        await sleep(500);
        let confirm = captureGameRegion().find(confirmRo);
        if (confirm.isExist()) {
            confirm.click();
        }
    }
})();