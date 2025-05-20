
	// 尝试打开任务菜单
	async function TryOpenQuestMenu() {
		keyPress("J");
		await sleep(1500);
	}
	// 恢复任务菜单按键
	async function KeyBindlings() {
		await genshin.returnMainUi();
		await sleep(2000);
		keyPress("ESCAPE");
		await sleep(2000);

		let SettingsButton = captureGameRegion().find(SettingsButtonRo);
		if (SettingsButton.isExist()) {
			log.info("识别到设置按钮");
			SettingsButton.click();
			await sleep(2000);

			let captureRegion = captureGameRegion();
			let resList = captureRegion.findMulti(RecognitionObject.ocr(100, 100, 300, 300));
			for (let i = 0; i < resList.count; i++) {
				let res = resList[i];
				if (res.text.includes("Key") || res.text.includes("Bindings") || res.text.includes("按键") || res.text.includes("按鍵")) {
					log.info("按键选项卡位置:({x},{y},{h},{w}), 文本{text}", res.x, res.y, res.width, res.Height, res.text);
					res.click();
					await sleep(2000);

					let RestoreButton = captureGameRegion().find(RestoreButtonRo);
					if (RestoreButton.isExist()) {
						log.info("识别到恢复默认按钮");
						RestoreButton.click();
						await sleep(1500);

						let ConfirmButton = captureGameRegion().find(ConfirmButtonRo);
						if (ConfirmButton.isExist()) {
							log.info("识别到确认按钮");
							ConfirmButton.click();
							await sleep(1500);
						}
					}
				}
			}
		}