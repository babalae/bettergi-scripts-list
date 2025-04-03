// Party Setup
const QuickSetupButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Quick Setup Button.png"), 1100, 900, 400, 180);
const ConfigureTeamButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Configure Team Button.png"), 0, 900, 200, 180);
const ConfirmDeployButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Confirm Deploy Button.png"), 0, 900, 1920, 180);
// Slider
const LeftSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 650, 50, 100, 100);
const LeftSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 650, 100, 100, 900);
const MiddleSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 1250, 50, 100, 200);
const MiddleSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 1250, 100, 100, 900);
const RightSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 1750, 100, 100, 100);
const RightSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 1750, 100, 100, 900);


/**
 * @returns {Promise<void>}
 */

(async function() {
	// 翻页
	async function pageDown(SliderBottomRo) {
		let SliderBottom = captureGameRegion().find(SliderBottomRo);
		if (SliderBottom.isExist()) {
			log.info("当前页面已识别&点击完毕，向下滑动");
			// log.info("滑块当前位置:({x},{y},{h},{w})", SliderBottom.x, SliderBottom.y, SliderBottom.Width, SliderBottom.Height);
			click(Math.ceil(SliderBottom.x + SliderBottom.Width / 2), Math.ceil(SliderBottom.y + SliderBottom.Height * 2));
			await moveMouseTo(0, 0);
			await sleep(100);
		}
	}

	//	滑条顶端
	async function pageTop(SliderTopRo) {
		let SliderTop = captureGameRegion().find(SliderTopRo);
		if (SliderTop.isExist()) {
			log.info("识别到滑条顶端位置:({x},{y},{h},{w})", SliderTop.x, SliderTop.y, SliderTop.Width, SliderTop.Height);
			await moveMouseTo(Math.ceil(SliderTop.x + SliderTop.Width / 2), Math.ceil(SliderTop.y + SliderTop.Height * 1));
			leftButtonDown();
			await sleep(1000);
			leftButtonUp();
			await moveMouseTo(0, 0);
			await sleep(100);
		}
	}

	// 切换队伍
	async function SwitchParty(partyName) {
		let ConfigureStatue = false;
		keyPress("VK_L");

		for (let i = 0; i < 10; i++) {
			let QuickSetupButton = captureGameRegion().find(QuickSetupButtonRo);
			if (QuickSetupButton.isExist()) {
				log.info("已进入队伍配置页面");
				break;
			} else {
				await sleep(1000);
			}
		}
		// 识别当前队伍
		let captureRegion = captureGameRegion();
		let resList = captureRegion.findMulti(RecognitionObject.ocr(100, 900, 300, 180));
		for (let i = 0; i < resList.count; i++) {
			let res = resList[i];
			log.info("当前队伍名称位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
			if (res.text.includes(partyName)) {
				log.info("当前队伍即为目标队伍，无需切换");
				keyPress("VK_ESCAPE");
				await sleep(500);
			} else {
				await sleep(1000);
				let ConfigureTeamButton = captureGameRegion().find(ConfigureTeamButtonRo);
				if (ConfigureTeamButton.isExist()) {
					log.info("识别到配置队伍按钮");
					ConfigureTeamButton.click();
					await sleep(500);
					await pageTop(LeftSliderTopRo);

					for (let p = 0; p < 4; p++) {
						// 识别当前页
						let captureRegion = captureGameRegion();
						let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 100, 400, 900));
						for (let i = 0; i < resList.count; i++) {
							let res = resList[i];
							if (settings.enableDebug) {
								log.info("文本位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
							}
							if (res.text.includes(partyName)) {
								log.info("目标队伍位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
								click(res.x, Math.ceil(res.y + res.Height * 1.35));

								// 找到目标队伍，点击确定、部署
								await sleep(1500);
								let ConfirmButton = captureGameRegion().find(ConfirmDeployButtonRo);
								if (ConfirmButton.isExist()) {
									log.info("识别到确定按钮:({x},{y},{w},{h})", ConfirmButton.x, ConfirmButton.y, ConfirmButton.Width, ConfirmButton.Height);
									ConfirmButton.click();
								}
								await sleep(1500);
								let DeployButton = captureGameRegion().find(ConfirmDeployButtonRo);
								if (DeployButton.isExist()) {
									log.info("识别到部署按钮:({x},{y},{w},{h})", DeployButton.x, DeployButton.y, DeployButton.Width, DeployButton.Height);
									DeployButton.click();
									ConfigureStatue = true;
									break;
								}
							}
						}
						if (ConfigureStatue) {
							await genshin.returnMainUi();
							break;
						} else {
							await pageDown(LeftSliderBottomRo);
						}
					}
					if (!ConfigureStatue) {
						log.warn("\n\n队伍切换失败,可能是：\n1.处于联机模式 \n2.无法正确识别\n3.JS自定义配置中的队伍名称设置错误，请检查!\n");
						await genshin.returnMainUi();
						break;
					}
				}
			}
		}
	}

	// Main
	if (!!settings.partyName) {
		// try {
		if (!settings.disableGoStatue) {
			log.info("正在传送回七天神像切换队伍");
			await genshin.TpToStatueOfTheSeven();
			log.info("正在尝试切换至" + settings.partyName);
			await SwitchParty(settings.partyName);
		} else {
			await genshin.returnMainUi();
			log.info("正在尝试切换至" + settings.partyName);
			await SwitchParty(settings.partyName);
		}
		// } catch {
		// 	log.warn("队伍切换失败，可能处于联机模式或其他不可切换状态");
		// 	await genshin.returnMainUi();
		// }
	} else {
		log.warn("没有设置切换队伍");
		await genshin.returnMainUi();
	}
})();