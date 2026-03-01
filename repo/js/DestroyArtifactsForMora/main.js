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

	const ro1 = captureGameRegion();
	let ArtifactsButton = ro1.find(ArtifactsButtonRo);
	ro1.dispose();
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
			const ro2 = captureGameRegion();
			ro2.find(DeleteButtonRo).click();// 点击摧毁
			ro2.dispose();
			await sleep(600);
			const ro3 = captureGameRegion();
			ro3.find(AutoAddButtonRo).click();// 点击自动添加
			ro3.dispose();
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

			const ro4 = captureGameRegion();
			ro4.find(ConfirmButtonRo).click();// 点击快捷放入
			ro4.dispose();
			await sleep(600);
			const ro5 = captureGameRegion();
			ro5.find(DestoryButtonRo).click();// 点击摧毁
			ro5.dispose();
			await sleep(600);
			const ro6 = captureGameRegion();
			ro6.find(MidDestoryButtonRo).click();// 弹出页面点击摧毁
			ro6.dispose();
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