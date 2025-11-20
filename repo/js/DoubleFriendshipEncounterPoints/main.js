// Encounter Points
const AdventurerHandbookButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Adventurer Handbook Button.png"), 100, 300, 700, 700);
const EncounterPointsStageRewardsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Encounter Points Stage Rewards.png"), 1500, 700, 100, 100);
// MainUi
const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/paimon_menu.png"), 0, 0, 100, 100);
// Paimon Menu
const FriendsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Friends Button.png"), 0, 300, 700, 780);
const CoOpModeButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Co-Op Mode Button.png"), 100, 300, 700, 780);
// Co-Op Mode Page
const CoOpModeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Co-Op Mode Page.png"), 0, 0, 200, 100);
const MyFriendsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/My Friends Page.png"), 0, 0, 200, 100);
const LeaveButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Leave Button.png"), 1400, 900, 300, 180);
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

// 取得需要离队角色資訊
const removedCharacters1 = typeof (settings.removedCharacters1) === 'undefined' ? false : settings.removedCharacters1;
const removedCharacters2 = typeof (settings.removedCharacters2) === 'undefined' ? false : settings.removedCharacters2;
const removedCharacters3 = typeof (settings.removedCharacters3) === 'undefined' ? false : settings.removedCharacters3;
const removedCharacters4 = typeof (settings.removedCharacters4) === 'undefined' ? false : settings.removedCharacters4;

/**
 * @returns {Promise<void>}
 */
(async function () {
	// 切换队伍
	if (!settings.disableNotice) {
		for (let n = 0; n < 10; n++) {
			log.warn("提示：队伍中小于等于两人时，才会触发双倍奖励");
		}
		await sleep(1000);
	}

	if (!!settings.partyName) {
		try {
			log.info("正在尝试切换至" + settings.partyName);
			if (!settings.disableGoStatue) {
				log.info("正在传送回七天神像切换队伍");
				await genshin.TpToStatueOfTheSeven();
				await SwitchParty(settings.partyName);
			} else {
				await genshin.returnMainUi();
				await SwitchParty(settings.partyName);
			}
		} catch {
			log.warn("\n\n队伍切换失败,可能是：\n1.处于联机模式 \n2.无法正确识别\n3.JS自定义配置中的队伍名称设置错误，请检查!\n");
			await genshin.returnMainUi();
		}
	} else {
		log.warn("没有设置切换队伍，使用当前队伍进入尘歌壶");
		await genshin.returnMainUi();
	}

	// 进尘歌壶领历练点奖励后返回大世界
	let request_times = settings.request_times * 2;
	let total_clicks = request_times ? request_times : 14;
	if (!!settings.appointFriendName) {
		let enterStatus = await AppointFriendRequestToVisitSereniteaPot();
		if (enterStatus) {
			await claimEncounterPointsRewards();
			await ReturnToBigWorld();
		} else {
			log.warn("好友列表未能识别出设置的好友名称");
			log.info("尝试依次进入");
			await pageTop(RightSliderTopRo);
			let enterStatus = await RequestToVisitSereniteaPot(total_clicks);
			if (enterStatus) {
				await claimEncounterPointsRewards();
				await ReturnToBigWorld();
			}
		}
	} else if (!settings.appointFriendName) {
		log.warn("未设置指定好友，执行依次进入");
		let enterStatus = await RequestToVisitSereniteaPot(total_clicks);
		if (enterStatus) {
			await claimEncounterPointsRewards();
			await ReturnToBigWorld();
		}
	} else {
		log.warn("出现异常，请检查自定义参数和日志，也可能是没有好友开放尘歌壶");
	}

	// 以下为可供调用的函数部分

	// 切换队伍
	async function SwitchParty(partyName) {
		let ConfigureStatue = false;
		keyPress("VK_L");

		for (let i = 0; i < 10; i++) {
			let captureRegion = captureGameRegion();
			let QuickSetupButton = captureRegion.find(QuickSetupButtonRo);
			captureRegion.dispose();
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
		captureRegion.dispose();
		for (let i = 0; i < resList.count; i++) {
			let res = resList[i];
			if (settings.enableDebug) {
				log.info("当前队伍名称位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
			}
			if (res.text.includes(partyName)) {
				log.info("当前队伍即为目标队伍，无需切换");
				keyPress("VK_ESCAPE");
				await sleep(500);
			} else {
				await sleep(1000);
				let ConfigureTeamButtonCaptureRegion = captureGameRegion();
				let ConfigureTeamButton = ConfigureTeamButtonCaptureRegion.find(ConfigureTeamButtonRo);
				ConfigureTeamButtonCaptureRegion.dispose();
				if (ConfigureTeamButton.isExist()) {
					log.info("识别到配置队伍按钮");
					ConfigureTeamButton.click();
					await sleep(500);
					await pageTop(LeftSliderTopRo);

					for (let p = 0; p < 4; p++) {
						// 识别当前页
						let captureRegion = captureGameRegion();
						let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 100, 400, 900));
						captureRegion.dispose();
						for (let i = 0; i < resList.count; i++) {
							let res = resList[i];
							if (settings.enableDebug) {
								log.info("文本位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
							}
							if (res.text.includes(partyName)) {
								if (settings.enableDebug) {
									log.info("目标队伍位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
								}
								click(res.x, Math.ceil(res.y + res.Height * 1.35));

								// 找到目标队伍，点击确定、部署
								await sleep(1500);
								let ConfirmButtonCaptureRegion = captureGameRegion();
								let ConfirmButton = ConfirmButtonCaptureRegion.find(ConfirmDeployButtonRo);
								ConfirmButtonCaptureRegion.dispose();
								if (ConfirmButton.isExist()) {
									if (settings.enableDebug) {
										log.info("识别到确定按钮:({x},{y},{w},{h})", ConfirmButton.x, ConfirmButton.y, ConfirmButton.Width, ConfirmButton.Height);
									}
									ConfirmButton.click();
								}
								await sleep(1500);
								let DeployButtonCaptureRegion = captureGameRegion();
								let DeployButton = DeployButtonCaptureRegion.find(ConfirmDeployButtonRo);
								DeployButtonCaptureRegion.dispose();
								if (DeployButton.isExist()) {
									if (settings.enableDebug) {
										log.info("识别到部署按钮:({x},{y},{w},{h})", DeployButton.x, DeployButton.y, DeployButton.Width, DeployButton.Height);
									}
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

	// 模板匹配&OCR进指定好友尘歌壶
	async function AppointFriendRequestToVisitSereniteaPot() {
		let enterStatus = false;
		await sleep(2000);
		keyPress("VK_ESCAPE");
		await sleep(2000);

		let captureRegion = captureGameRegion();
		let FriendsBotton = captureRegion.find(FriendsButtonRo);
		captureRegion.dispose();
		if (FriendsBotton.isExist()) {
			log.info("识别到好友按钮");
			FriendsBotton.click();
			await sleep(2000);
		} else {
			log.warn("未识别到按钮,使用坐标点击");
			click(680, 550);
			await sleep(2000);
		}

		for (let p = 0; p < 5; p++) {
			// 点击好友头像
			let captureRegion = captureGameRegion();
			let resList = captureRegion.findMulti(RecognitionObject.ocr(250, 120, 500, 840));
			captureRegion.dispose();
			for (let i = 0; i < resList.count; i++) {
				let res = resList[i];
				if (res.text.includes(settings.appointFriendName)) {
					if (settings.enableDebug) {
						log.info("指定好友名字位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
					}
					click(res.x - 100, res.y + 50);
					await sleep(1000);

					// 申请造访尘歌壶
					let captureRegion = captureGameRegion();
					let resList = captureRegion.findMulti(RecognitionObject.ocr(250, 220, 425, 380));
					captureRegion.dispose();
					for (let i = 0; i < resList.count; i++) {
						let res = resList[i];
						if (res.text.includes("申请造访") || res.text.includes("visit Serenitea Pot") || res.text.includes("申請造訪")) {
							if (settings.enableDebug) {
								log.info("申请造访尘歌壶位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
							}
							res.click();
						}
					}
				}
			}
			await sleep(1000);
			// 翻页继续尝试&模板匹配的方式等待加载
			let captureRegion_2 = captureGameRegion();
			let SliderBottom = captureRegion_2.find(RightSliderBottomRo);
			captureRegion_2.dispose();
			if (SliderBottom.isExist()) {
				await pageDown(RightSliderBottomRo);
			} else {
				for (let i = 0; i < 10; i++) {
					let captureRegion = captureGameRegion();
					let paimonMenu = captureRegion.Find(paimonMenuRo);
					let CoOpMode = captureRegion.Find(CoOpModeRo);
					let MyFriends = captureRegion.Find(MyFriendsRo);
					captureRegion.dispose();
					if (CoOpMode.isExist() || MyFriends.isExist()) {
						log.info("继续申请");
						break;
					} else if (paimonMenu.isEmpty() && (CoOpMode.isEmpty() || MyFriends.isEmpty())) {
						log.info("正在等待加载");
						await click(960, 540);
						for (let i = 0; i < 30; i++) {
							let captureRegion = captureGameRegion();
							let paimonMenu = captureRegion.Find(paimonMenuRo);
							captureRegion.dispose();
							if (paimonMenu.isExist()) {
								break;
							}
							await sleep(1000);
						}
					} else if (paimonMenu.isExist()) {
						log.info("已进入联机模式");
						enterStatus = true;
						break;
					} else {
						log.warn("出现异常情况，请检查");
						enterStatus = false;
					}
				}
				break;
			}
		}
		return enterStatus;
	}

	// 好友列表递增坐标进尘歌壶(仅第一页)
	async function RequestToVisitSereniteaPot(total_clicks) {
		let enterStatus = false;
		keyPress("VK_ESCAPE");
		await sleep(2000);
		let captureRegion = captureGameRegion();
		let FriendsBotton = captureRegion.find(FriendsButtonRo);
		captureRegion.dispose();
		if (FriendsBotton.isExist()) {
			log.info("识别到好友按钮");
			FriendsBotton.click();
			await sleep(2000);
		} else {
			log.warn("未识别到按钮,使用坐标点击");
			// click(1020,840);
			click(680, 550);
			await sleep(2000);
		}

		let y_avatar = 178; //好友头像按钮起始Y坐标
		let y_request = 310; //申请造访按钮起始Y坐标
		const x_avatar = 208;
		const x_request = 460;
		const avatar_increment = 125; //好友头像两按钮相隔坐标
		const request_increment = 124; //申请造访两按钮相隔坐标
		const request_fixed_value = 560; //第三~七位好友申请造访按钮Y坐标
		let request_count = 0;

		// 先申请造访首位好友的尘歌壶
		log.info("正在申请造访第 1 位好友尘歌壶");
		click(x_avatar, y_avatar);
		await sleep(750);
		click(x_request, y_request);
		await sleep(750);

		// 依次申请造访第 2 ~ 7 位好友的尘歌壶
		for (let i = 2; i < total_clicks; i++) {
			if (i % 2 === 0) {
				// 偶数索引，递增 y_avatar
				y_avatar += avatar_increment;
				log.info(`正在申请造访第 ${i / 2 + 1} 位好友尘歌壶`);
				click(x_avatar, y_avatar);
				await sleep(250);
				click(x_avatar, y_avatar);
				await sleep(750);
			} else {
				// 奇数索引，递增 y_request
				if (request_count < 1) {
					// 前 2 位好友递增
					y_request += request_increment;
				} else {
					// 第 3 位及以后设为 固定值
					y_request = request_fixed_value;
				}
				request_count++;
				click(x_request, y_request);
				await sleep(750);
			}
		}
		// 模板匹配的方式等待加载
		log.info("等待界面响应");
		for (let i = 0; i < 30; i++) {
			let captureRegion = captureGameRegion();
			let res = captureRegion.Find(paimonMenuRo);
			captureRegion.dispose();
			if (res.isEmpty()) {
				await click(960, 540);
			} else if (res.isExist()) {
				log.info("已进入好友尘歌壶");
				enterStatus = true;
				break;
			} else {
				log.warn("出现异常情况，请检查");
				enterStatus = false;
			}
			await sleep(500);
		}
		return enterStatus;
	}

	// 模板匹配领取历练点奖励
	async function claimEncounterPointsRewards() {
		await sleep(2000);
		log.info("正在让指定位置角色离队");
		await removeSpecifiedRole();
		await sleep(2000);
		log.info("正在打开冒险之证领取历练点奖励");
		await sleep(2000);
		keyPress("VK_ESCAPE");

		await sleep(2000);
		let captureRegion = captureGameRegion();
		let AdventurerHandbookButton = captureRegion.find(AdventurerHandbookButtonRo);
		captureRegion.dispose();
		if (AdventurerHandbookButton.isExist()) {
			log.info("识别到冒险之证按钮");
			AdventurerHandbookButton.click();

			await sleep(2000)
			let captureRegion = captureGameRegion();
			let resList = captureRegion.findMulti(RecognitionObject.ocr(200, 300, 200, 100));
			captureRegion.dispose();
			for (let i = 0; i < resList.count; i++) {
				let res = resList[i];
				if (res.text.includes("委托") || res.text.includes("委託") || res.text.includes("Commissions") || res.text.includes("委")) {
					if (settings.enableDebug) {
						log.info("识别到委托选项卡位置:({x},{y},{w},{h}), 识别内容：{text}", res.x, res.y, res.Width, res.Height, res.text);
					}
					res.click();
				} else {
					log.info("未识别到识别到委托选项卡");
				}
			}

			await sleep(2000)
			let captureRegion_2 = captureGameRegion();
			let EncounterPointsStageRewardsButton = captureRegion_2.find(EncounterPointsStageRewardsRo);
			captureRegion_2.dispose();
			if (EncounterPointsStageRewardsButton.isExist()) {
				log.info("识别到历练点领取按钮");
				EncounterPointsStageRewardsButton.click();
				await sleep(2000);
				log.info("已领取历练点奖励");
				keyPress("VK_ESCAPE");
			} else if (EncounterPointsStageRewardsButton.isEmpty()) {
				log.warn("未识别到历练点领取奖励按钮，可能是已领取或未完成");
			}
			await genshin.returnMainUi();
			await sleep(2000);
		}
	}

	// 模板匹配退出尘歌壶回到大世界
	async function ReturnToBigWorld() {
		log.info("正在返回大世界");
		keyPress("VK_F2");
		await sleep(2000);
		let captureRegion = captureGameRegion();
		let CoOpModeButton = captureRegion.find(CoOpModeRo);
		captureRegion.dispose();
		if (CoOpModeButton.isExist()) {
			log.info("识别到多人游戏页面");
			// 
			let captureRegion = captureGameRegion();
			let LeaveButton = captureRegion.find(LeaveButtonRo);
			captureRegion.dispose();
			if (LeaveButton.isExist()) {
				log.info("识别到离开尘歌壶按钮");
				LeaveButton.click();
				await sleep(2000);
			}
			// 模板匹配的方式等待加载
			log.info("等待界面响应");
			for (let i = 0; i < 10; i++) {
				let captureRegion = captureGameRegion();
				let res = captureRegion.Find(paimonMenuRo);
				captureRegion.dispose();
				if (res.isEmpty()) {
					await click(960, 540);
				} else if (res.isExist()) {
					log.info("已离开尘歌壶");
					break;
				} else {
					log.warn("出现异常情况或超时，请检查");
				}
				await sleep(2000);
			}
		}
	}

	// 让指定位置角色离队
	async function removeSpecifiedRole() {
		try {
			if (removedCharacters1 || removedCharacters2 || removedCharacters3 || removedCharacters4) {
				// 打開配隊介面
				keyPress("l");
				await sleep(3500);

				// 让4号位角色离队
				if (removedCharacters4) {
					// 第4名角色位置
					click(1460, 600);
					await sleep(750);
					click(430, 1020);
					await sleep(750);
					log.info("4号位角色已离队");

				}

				// 让3号位角色离队
				if (removedCharacters3) {
					// 第3名角色位置
					click(1130, 600);
					await sleep(750);
					click(430, 1020);
					await sleep(750);
					log.info("3号位角色已离队");
				}

				// 让2号位角色离队
				if (removedCharacters2) {
					// 第2名角色位置
					click(790, 600);
					await sleep(750);
					click(430, 1020);
					await sleep(750);
					log.info("2号位角色已离队");
				}

				// 让1号位角色离队
				if (removedCharacters1) {
					if (removedCharacters4 && removedCharacters3 && removedCharacters2) {
						log.warn("2,3,4号位已离队，1号位角色不能离队");
					} else {
						// 第1名角色位置
						click(480, 600);
						await sleep(750);
						click(430, 1020);
						await sleep(750);
						log.info("1号位角色已离队");
					}
				}

				// 返回主界面
				await genshin.returnMainUi();
			} else {
				log.info("无需让角色离队");
			}
		} catch (error) {
			log.error("出错: {0}", error);
		}
	}

	// 向下一页
	async function pageDown(SliderBottomRo) {
		let captureRegion = captureGameRegion();
		let SliderBottom = captureGameRegion().find(SliderBottomRo);
		captureRegion.dispose();
		if (SliderBottom.isExist()) {
			log.info("当前页面已点击完毕，向下滑动");
			if (settings.enableDebug) {
				log.info("滑块当前位置:({x},{y},{h},{w})", SliderBottom.x, SliderBottom.y, SliderBottom.Width, SliderBottom.Height);
			}
			click(Math.ceil(SliderBottom.x + SliderBottom.Width / 2), Math.ceil(SliderBottom.y + SliderBottom.Height * 3.5));
			await moveMouseTo(0, 0);
			await sleep(100);
		}
	}

	//	回到页面顶部
	async function pageTop(SliderTopRo) {
		let captureRegion = captureGameRegion();
		let SliderTop = captureRegion.find(SliderTopRo);
		captureRegion.dispose();
		if (SliderTop.isExist()) {
			if (settings.enableDebug) {
				log.info("滑条顶端位置:({x},{y},{h},{w})", SliderTop.x, SliderTop.y, SliderTop.Width, SliderTop.Height);
			}
			await moveMouseTo(Math.ceil(SliderTop.x + SliderTop.Width / 2), Math.ceil(SliderTop.y + SliderTop.Height * 1.5));
			leftButtonDown();
			await sleep(500);
			leftButtonUp();
			await moveMouseTo(0, 0);
			await sleep(1000);
		}
	}
})();