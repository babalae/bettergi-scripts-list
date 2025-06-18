const ArtifactsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ArtifactsButton.png"));
const DeleteButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DeleteButton.png"));
const AutoAddButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/AutoAddButton.png"));
const ConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ConfirmButton.png"));
const DestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DestoryButton.png"));
const MidDestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DestoryButton.png"), 900, 600, 500, 300);

/**
 * @returns {Promise<void>}
 */

(async function () {
	await genshin.returnMainUi();
	keyPress("B");
	await sleep(1500);

	let ArtifactsButton = captureGameRegion().find(ArtifactsButtonRo);
	if (ArtifactsButton.isExist()) {
		log.info("识别到圣遗物按钮");
		ArtifactsButton.click();
		await sleep(1500);
	}

	//计算摧毁次数 
	if (settings.number > 21) {
		times = Math.ceil(settings.number / 100)
	} else if (settings.number <= 21) {
		times = settings.number
	} else {
		times = 1
	}
	try {
		for (let i = 0; i < times; i++) {
			captureGameRegion().find(DeleteButtonRo).click();// 点击摧毁
			await sleep(600);
			captureGameRegion().find(AutoAddButtonRo).click();// 点击自动添加
			await sleep(600);

			if (settings.oneStar) {
				await sleep(300);
				click(150, 150);
			}
			if (settings.twoStar) {
				await sleep(300);
				click(150, 220);
			}
			if (settings.threeStar) {
				await sleep(300);
				click(150, 300);
			}
			if (settings.fourStar) {
				await sleep(300);
				click(150, 370);
			}

			captureGameRegion().find(ConfirmButtonRo).click();// 点击快捷放入
			await sleep(600);
			captureGameRegion().find(DestoryButtonRo).click();// 点击摧毁
			await sleep(600);
			captureGameRegion().find(MidDestoryButtonRo).click();// 弹出页面点击摧毁
			await sleep(600);
			click(960, 1000);// 点击空白处
			await sleep(1000);
		}
	} catch (ex) {
		log.info("背包里的圣遗物已摧毁完毕，提前结束")
	} finally {
		await genshin.returnMainUi();
	}

})();