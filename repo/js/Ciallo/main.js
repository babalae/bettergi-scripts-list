/*******************************************************
 *  完整文件：进入/退出世界循环脚本
 *  所有函数均在此文件内，直接覆盖原文件即可运行
 *******************************************************/

/* ---------- 匹配模板 ---------- */
const friendRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/friend.png"));
const chatTemplate = file.ReadImageMatSync("assets/RecognitionObject/chat.png");
/* ---------- 主流程 ---------- */
(async function () {
    const ciallo = settings.ciallo || "Ciallo～(∠・ω< )⌒☆";
    await genshin.returnMainUi();
    await sleep(1000);
    keyPress("VK_ESCAPE");
    await sleep(1000);
    await findAndClick(friendRo);
    //依次点击七个好友并进行对话
    for (let i = 0; i < 7; i++) {
        const yStart = 119 + i * 124;
        const yEnd = 243 + i * 124;

        const recognitionObj = RecognitionObject.TemplateMatch(
            chatTemplate,
            0,       // x 起始
            yStart,  // y 起始
            1920,    // x 范围（宽度）
            yEnd - yStart // y 范围（高度）
        );
        await sleep(1000);
        await findAndClick(recognitionObj);
        await sleep(1000);
        keyPress("VK_RETURN");
        await sleep(1000);
        inputText(ciallo);
        await sleep(500);
        keyPress("VK_RETURN");
        await sleep(500);
        keyPress("VK_ESCAPE");
    }
    await genshin.returnMainUi();

})();

/** 通用点击，默认最多5次 */
async function findAndClick(target, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        const rg = captureGameRegion();
        try {
            const res = rg.find(target);
            if (res.isExist()) { res.click(); return true; }
        } finally { rg.dispose(); }
        if (i < maxAttempts - 1) await sleep(250);
    }
    return false;
}
