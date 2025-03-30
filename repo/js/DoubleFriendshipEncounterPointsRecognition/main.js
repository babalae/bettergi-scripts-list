const FriendsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Friends.png"));
const AdventurerHandbookRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Adventurer Handbook.png"));
const EncounterPointsStageRewardsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Encounter Points Stage Rewards.png"));
const CoOpModeRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Co-Op Mode.png"));
const LeavetheSereniteaPotRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Leave the Serenitea Pot.png"));
const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/paimon_menu.png"));

/**
 * @returns {Promise<void>}
 */
(async function () {
	// 切换队伍
	for (let n = 0 ; n < 10 ; n++) {
		log.warn("提示：队伍中小于等于两人时，才会触发双倍奖励");
	}
	await sleep(2000);

	if (!!settings.partyName) {
		try {
			log.info("正在传送回七天神像切换队伍");
			await genshin.tp(2297.60, -824.45);
			await sleep(3000);
			log.info("正在尝试切换至" + settings.partyName);
			await genshin.switchParty(settings.partyName);
		} catch {
			log.warn("队伍切换失败，可能处于联机模式或其他不可切换状态");
			await genshin.returnMainUi();
		}
	} else {
		log.warn("没有设置切换队伍，使用当前队伍进入尘歌壶");
		await genshin.returnMainUi();
	}

	// 进尘歌壶领历练点奖励后返回大世界
	let request_times = settings.request_times * 2;
	let total_clicks = request_times ? request_times : 14;
	if(!!settings.appointFriendName) {
		let enterState = await AppointFriendRequestToVisitSereniteaPot();
		if (enterState) {
			await claimEncounterPointsRewards();
			await ReturnToBigWorld();
		} else {
			log.warn("好友列表未能识别出设置的好友名称");
			log.info("尝试依次进入");
			let enterState = await RequestToVisitSereniteaPot(total_clicks);
			if (enterState) {
				await claimEncounterPointsRewards();
				await ReturnToBigWorld();
			}
		}
	} else if (!settings.appointFriendName) {
		log.warn("未设置指定好友，执行依次进入");
		let enterState = await RequestToVisitSereniteaPot(total_clicks);
		if (enterState) {
			await claimEncounterPointsRewards();
			await ReturnToBigWorld();
		}
	} else {
		log.warn("出现异常，请检查自定义参数和日志，也可能是没有好友开放尘歌壶");
	}

	// 模板匹配&OCR进指定好友尘歌壶
	async function AppointFriendRequestToVisitSereniteaPot() {
		let enterState = false;
		keyPress("VK_ESCAPE");
		await sleep(2000);
	
		let FriendsBotton = captureGameRegion().find(FriendsRo);
		if (FriendsBotton.isExist()) {
			log.info("识别到好友按钮,尝试点击");
			FriendsBotton.click();
			await sleep(2000);
		} else {
			log.info("未识别到按钮,使用坐标点击");
			click(680, 550);
			await sleep(2000);
		}

		// 点击好友头像
		let captureRegion = captureGameRegion();
		let resList = captureRegion.findMulti(RecognitionObject.ocr(250, 120, 500, 840));
		for (let i = 0; i < resList.count; i++) {
			let res = resList[i];
			if (res.text.includes(settings.appointFriendName)) {
				log.info("指定好友名字位置:({x},{y},{h},{w}), 文本{text}", res.x, res.y, res.width, res.Height, res.text);
				click(res.x - 100, res.y + 50);
				await sleep(2000);

				// 申请造访尘歌壶
				let captureRegion = captureGameRegion();
				let resList = captureRegion.findMulti(RecognitionObject.ocr(250, 220, 425, 380));
				for (let i = 0; i < resList.count; i++) {
					let res = resList[i];
					if (res.text.includes("申请造访") || res.text.includes("visit Serenitea Pot") || res.text.includes("申請造訪")) {
						log.info("申请造访尘歌壶位置:({x},{y},{h},{w}), 文本{text}", res.x, res.y, res.width, res.Height, res.text);
						res.click();

						// 模板匹配的方式等待加载
						log.info("等待界面响应");
						for (let i = 0; i < 10; i++) {
							let captureRegion = captureGameRegion();
							let res = captureRegion.Find(paimonMenuRo);
							if (res.isEmpty()) {
								await click(960, 540);
							} else if (res.isExist()) {
								log.info("已进入好友尘歌壶");
								enterState = true;
								break;
							} else {
								log.warn("出现异常情况，请检查");
								enterState = false;
							}
							await sleep(2000);
						}
						break;
					}
				}
				break;
			}
		}
		return enterState;
	}

	// 好友列表递增坐标进尘歌壶
	async function RequestToVisitSereniteaPot(total_clicks) {
		let enterState = false;
		keyPress("VK_ESCAPE");
		await sleep(2000);
		let FriendsBotton = captureGameRegion().find(FriendsRo);
		if (FriendsBotton.isExist()) {
			log.info("识别到好友按钮,尝试点击");
			FriendsBotton.click();
			await sleep(2000);
		} else {
			log.info("未识别到按钮,使用坐标点击");
			// click(1020,840);
			click(680, 550);
			await sleep(2000);
		}

		let y_avatar = 178;		//好友头像按钮起始Y坐标
		let y_request = 245;	//申请造访按钮起始Y坐标
		const x_avatar = 208;
		const x_request = 460;
		const avatar_increment = 125;		//两按钮相隔坐标
		const request_increment = 124;		//两按钮相隔坐标
		const request_fixed_value = 560;	//第四~七位好友申请造访按钮Y坐标
		let request_count = 0;
		
		// 先申请造访首位好友的尘歌壶
		log.info("正在申请造访第 1 位好友尘歌壶");
		click(x_avatar, y_avatar);
		await sleep(1000);
		click(x_request, y_request);
		await sleep(1000);

		// 依次申请造访第 2 ~ 7 位好友的尘歌壶
		for (let i = 2; i < total_clicks; i++) { 
			if (i % 2 === 0) { 
				// 偶数索引，递增 y_avatar
				y_avatar += avatar_increment;
				log.info(`正在申请造访第 ${i/2+1} 位好友尘歌壶`);
				click(x_avatar, y_avatar);
				await sleep(1000);
			} else { 
				// 奇数索引，递增 y_request
				if (request_count < 3) {  
					// 前 3 次递增 249
					y_request += request_increment;
				} else {  
					// 第四次及以后设为 1118
					y_request = request_fixed_value;
				}
				request_count++;
				click(x_request, y_request);
				await sleep(1000);
			}
		}
		// 模板匹配的方式等待加载
		log.info("等待界面响应");
		for (let i = 0; i < 10; i++) {
			let captureRegion = captureGameRegion();
			let res = captureRegion.Find(paimonMenuRo);
			if (res.isEmpty()) {
				await click(1920, 1080);
			} else if (res.isExist()) {
				log.info("已进入好友尘歌壶");
				enterState = true;
				break;
			} else {
				log.warn("出现异常情况，请检查");
				enterState = false;
			}
			await sleep(2000);
		}
		return enterState;
	}

	async function pageDown() {
		//暂无计划，还是联系一下好友开放尘歌壶吧
	}

	// 模板匹配领取历练点奖励
	async function claimEncounterPointsRewards() {
		log.info("正在打开冒险之证领取历练点奖励");
		await sleep(2000);
		keyPress("VK_ESCAPE");
		await sleep(2000);

		let AdventurerHandbookButton = captureGameRegion().find(AdventurerHandbookRo);
		if (AdventurerHandbookButton.isExist()) {
			log.info("识别到冒险之证按钮,尝试点击");
			AdventurerHandbookButton.click();

			// 委托按钮
			await sleep(2000);
			click(300, 350);

			let EncounterPointsStageRewardsButton = captureGameRegion().find(EncounterPointsStageRewardsRo);
			if (EncounterPointsStageRewardsButton.isExist()) {
				log.info("识别到历练点领取按钮,尝试点击");
				EncounterPointsStageRewardsButton.click();
				await sleep(2000);
				log.info("已领取历练点奖励");
				keyPress("Escape");
			}
		await genshin.returnMainUi();
		await sleep(2000);
		}
	}

	// 模板匹配退出尘歌壶回到大世界
	async function ReturnToBigWorld() {
		log.info("正在返回大世界");
		keyPress("VK_ESCAPE");
		await sleep(2000);

		let CoOpModeButton = captureGameRegion().find(CoOpModeRo);
		if (CoOpModeButton.isExist()) {
			log.info("识别到多人游戏按钮,尝试点击");
			CoOpModeButton.click();
			await sleep(2000);
			let LeavetheSereniteaPotButton = captureGameRegion().find(LeavetheSereniteaPotRo);
			if (LeavetheSereniteaPotButton.isExist()) {
				log.info("识别到离开尘歌壶按钮,尝试点击");
				LeavetheSereniteaPotButton.click();
				await sleep(2000);
			}
			// 模板匹配的方式等待加载
			log.info("等待界面响应");
			for (let i = 0; i < 10; i++) {
				let captureRegion = captureGameRegion();
				let res = captureRegion.Find(paimonMenuRo);
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
})();