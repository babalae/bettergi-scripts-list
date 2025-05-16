const PlusButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/PlusButton.png"), 1000, 0, 300, 100);
const FragileResinRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/FragileResin.png"), 800, 400, 200, 200);
const ConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ConfirmButton.png"), 900, 700, 200, 200);
const QuickUsePlusButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/QuickUsePlusButton.png"), 1200, 600, 200, 100);

/**
 * @returns {Promise<void>}
 */

(async function () {

    await genshin.returnMainUi();
    keyPress("M");//打开地图
    await sleep(1200);
    captureGameRegion().find(PlusButtonRo).click();// 点击添加体力
    await sleep(600);
    captureGameRegion().find(FragileResinRo).click();// 选择脆弱树脂
    await sleep(600);
    captureGameRegion().find(ConfirmButtonRo).click();// 点击使用
    await sleep(600);

    let QuickUsePlusButton = captureGameRegion().find(QuickUsePlusButtonRo);
    if (isNaN(settings.times || settings.numberPerUse <= 0)) {
        number = 1
    }else{
        for (let i = 1; i < settings.numberPerUse; ++i) {
            QuickUsePlusButton.click();// 点击使用数量
            await sleep(300);
        }
    }

    captureGameRegion().find(ConfirmButtonRo).click();// 点击使用
    await sleep(600);
    click(960, 1000);// 点击空白处
    await genshin.returnMainUi();

})();
