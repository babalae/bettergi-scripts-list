const SettingsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/SettingsButton.png"), 0, 650, 100, 300);
const RestoreButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/RestoreButton.png"), 1400, 950, 130, 130);
const MaterialsRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Materials.png"), 900, 0, 100, 100);
const MaterialsSelectedRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/MaterialsSelected.png"), 900, 0, 100, 100);
const SliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/SliderBottom.png"), 1280, 110, 25, 845);
const CabbageRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Cabbage.png"), 110, 90, 1170, 875);
const RadishRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Radish.png"), 110, 90, 1170, 875);
const AbandonCurrentHangoutEventButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/AbandonCurrentHangoutEventButton.png"), 1400, 950, 130, 130);
const ConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ConfirmButton.png"));
const StoryQuestsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/StoryQuestsButton.png"), 90, 900, 150, 150);
const InProgressButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/InProgressButton.png"), 700, 0, 500, 100);
const InProgressButtonSelectedRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/InProgressButtonSelected.png"), 700, 0, 500, 100);
const HangoutEventButtonSelected1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/HangoutEventButtonSelected1.png"), 800, 0, 350, 100);
const HangoutEventButtonSelected2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/HangoutEventButtonSelected2.png"), 800, 0, 350, 100);
const HangoutEventButtonSelected3Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/HangoutEventButtonSelected3.png"), 800, 0, 350, 100);
const PlusButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/PlusButton.png"), 0, 325, 140, 200);
const MaxRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Max.png"), 0, 325, 140, 200);
const LocationButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/LocationButton.png"), 1300, 0, 450, 100);


/**
 * @returns {Promise<void>}
 */

(async function () {
	// 留空或曾经设定后删除运行30轮，否则为设定值
	let runTimes = isNaN(settings.runTimes) || settings.runTimes === '' ? 50 : settings.runTimes;
	const messages = [
		'1.请使用0.44.0或版本号更高的BetterGI运行本JS',
		`2.确保完成班尼特邀约任务`,
		`3.行走位最好是E恢复角色`,
		`4.关闭E技能回血'${settings.disableHealHP ? "是" : "否"}'`,
		`5.预期执行轮数'${runTimes}'`,
	];
	for (let message of messages) {
		log.info(message);
		await sleep(100);
	}
	const startTime = Date.now();
	await genshin.returnMainUi();
	// 实时拾取极速版
	dispatcher.addTimer(new RealtimeTimer("AutoPick", {
		"forceInteraction": true
	}));
	// 拾取状态检测
	let pickStatus = await UpperLimitPreciousChest(); // 没超过返回true，超过返回false
	// 默认按键状态检测
	let keyStatus = await CheckKeyBindlings(); // 正常返回true，异常返回false
	log.warn(`启动预检测结束，本机当前状态：${keyStatus ? "正常" : "异常"}，系统当前状态：${pickStatus ? "正常" : "异常"}`);
	if (keyStatus && pickStatus) {
		// 获取等效摩拉计算所需的物品初始数量
		if (settings.mora) {
			const StartNum = await CabbageRadishNum();
			RadishStartNum = StartNum.RadishNum;
			CabbageStartNum = StartNum.CabbageNum;
		}
		log.info(`开始刷取珍贵宝箱`);
		if (!settings.enableSimplifyMode) {
			await AutoPath(`前往地点${settings.disableFullMode ? "(工程模式)" : ""}`);
		}
		// let prePickStatus = true; // 测试用
		let prePickStatus = await UpperLimitPreciousChest(); // 到达地点时检查一次
		log.warn(`检查点检测结束，系统当前状态：${prePickStatus ? "正常" : "异常"}`);
		if (prePickStatus) {
			await AbandonHangoutEvent(0); // 防止之前没删任务，先删一遍
			// 刷宝箱循环
			const estimatedStartTime = Date.now();
			for (let i = 0; i < runTimes; i++) {
				// 滑动接取邀约任务
				await ReceiveHangoutEvent(i);
				// 路径执行前检查一次
				await sleep(500);
				let pickStatusBefore = await UpperLimitPreciousChest();
				log.warn(`第 ${i + 1} 次预检测结束，系统当前状态 ${pickStatus ? "正常" : "异常"}`);
				if (!pickStatusBefore) {
					log.warn("本次预检测到超过 3 次宝箱未成功拾取，推测已触发系统风控，主动终止运行");
					break;
				}
				// 执行拾取宝箱路径
				await AutoPath(`宝箱(${settings.disableHealHP ? "" : "HP版"}循环)`);
				// 路径完成后检查一次
				let pickStatusAfter = await UpperLimitPreciousChest();
				if (!pickStatusAfter) {
					log.warn(`第 ${i + 1} 次循环执行完成，本轮检测到超过 3 次宝箱未成功拾取，推测已触发系统风控，主动终止运行`);
					break;
				}
				// 统计用时
				log.info(`已完成循环：${i + 1}/${runTimes}`);
				logTimeTaken(startTime);
				if (i > 1) {
					const estimatedCompletion = calculateEstimatedCompletion(estimatedStartTime, i + 1, runTimes);
					log.info(`预计完成时间：${estimatedCompletion}`);
				}
				// 开启任务菜单放弃邀约任务
				await AbandonHangoutEvent(i + 1);
			}
			// 统计摩拉
			if (settings.mora) {
				const EndNum = await CabbageRadishNum();
				RadishEndNum = EndNum.RadishNum;
				CabbageEndNum = EndNum.CabbageNum;
				let totalSeconds = logTimeTaken(startTime);
				RadishMora = Math.ceil(RadishEndNum - RadishStartNum) * 315
				CabbageMora = Math.ceil(CabbageEndNum - CabbageStartNum) * 105
				log.info(`获得白萝卜：${RadishEndNum - RadishStartNum}，卷心菜：${CabbageEndNum - CabbageStartNum}`);
				log.info(`等效摩拉：${RadishMora + CabbageMora}，摩拉效率：${((RadishMora + CabbageMora) / totalSeconds).toFixed(2)} 摩拉/秒`);
			}
		} else {
			log.warn("检查点检测结束，检测未能通过: 宝箱未成功拾取，推测当前刷取的宝箱数量已触发风控，被系统禁止拾取，主动终止运行");
		}
	} else if (!keyStatus) {
		log.warn("按键或识别出现异常，可能卡在某个交互页面中，请自行检查");
	} else if (!pickStatus) {
		log.warn("当前刷取的宝箱已触发风控，被系统禁止拾取，主动终止运行");
	} else {
		log.warn("按键或识别出现异常，请自行检查");
	}
	// 以下部分为封装函数
	// 默认按键检测
	async function CheckKeyBindlings() {
		let keyStatus = false;
		for (let i = 0; i < 2; i++) {
			await TryOpenQuestMenu(0);
			const ro1 = captureGameRegion();
			let StoryQuestsButton = ro1.find(StoryQuestsButtonRo);
			ro1.dispose();
			if (StoryQuestsButton.isExist()) {
				log.info("检测到任务菜单已开启，按键正常");
				await sleep(1000);
				keyStatus = true;
			} else {
				log.info("检测到任务菜单没有开启，推测快捷键不是默认值，尝试恢复");
				await KeyBindlings(); // 恢复默认键位
				await TryOpenQuestMenu(0);
				const ro2 = captureGameRegion();
				let StoryQuestsButton = ro2.find(StoryQuestsButtonRo);
				ro2.dispose();
				if (StoryQuestsButton.isExist()) {
					log.info("识别到传说任务按钮，按键正常");
					await sleep(1000);
					keyStatus = true;
				} else {
					log.warn("尝试恢复任务菜单快捷键默认值失败");
					keyStatus = false;
				}
			}
			break;
		}
		await genshin.returnMainUi();
		await sleep(1000);
		return keyStatus;
	}
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

		const ro3 = captureGameRegion();
		let SettingsButton = ro3.find(SettingsButtonRo);
		ro3.dispose();
		if (SettingsButton.isExist()) {
			log.info("识别到设置按钮");
			SettingsButton.click();
			await sleep(2000);

			let captureRegion = captureGameRegion();
			let resList = captureRegion.findMulti(RecognitionObject.ocr(100, 100, 300, 300));
			captureRegion.dispose();
			for (let i = 0; i < resList.count; i++) {
				let res = resList[i];
				if (res.text.includes("Key") || res.text.includes("Bindings") || res.text.includes("按键") || res.text.includes("按鍵")) {
					log.info("按键选项卡位置:({x},{y},{h},{w}), 文本{text}", res.x, res.y, res.width, res.Height, res.text);
					res.click();
					await sleep(2000);

					const ro4 = captureGameRegion();
					let RestoreButton = ro4.find(RestoreButtonRo);
					ro4.dispose();
					if (RestoreButton.isExist()) {
						log.info("识别到恢复默认按钮");
						RestoreButton.click();
						await sleep(1500);

						const ro5 = captureGameRegion();
						let ConfirmButton = ro5.find(ConfirmButtonRo);
						ro5.dispose();
						if (ConfirmButton.isExist()) {
							log.info("识别到确认按钮");
							ConfirmButton.click();
							await sleep(1500);
						}
					}
				}
			}
		}
		await genshin.returnMainUi();
	}
	// 识别卷心菜、白萝卜数量
	async function CabbageRadishNum() {
		setGameMetrics(1920, 1080, 1);
		await genshin.returnMainUi();
		await sleep(1000);
		keyPress("B");
		await sleep(1500);
		let RadishNum = 0
		let CabbageNum = 0

		const ro6 = captureGameRegion();
		let Materials = ro6.find(MaterialsRo);
		let MaterialsSelected = ro6.find(MaterialsSelectedRo);
		ro6.dispose();
		if (Materials.isExist()) {
			log.info("识别到材料按钮");
			Materials.click();
			await sleep(1500);
		} else if (MaterialsSelected.isExist()) {
			log.info("识别到材料按钮");
			MaterialsSelected.click();
			await sleep(1500);
		}

		for (let i = 0; i < 10; i++) {
			const ro7 = captureGameRegion();
			let Radish = ro7.find(RadishRo);
			ro7.dispose();
			if (Radish.isExist()) {
				// log.info("识别到白萝卜,进行OCR获取数量");
				const ro8 = captureGameRegion();
				let resList = ro8.findMulti(RecognitionObject.ocr(Radish.x, Radish.y + Radish.width, Radish.Width, Radish.Height));
				ro8.dispose();
				for (let i = 0; i < resList.count; i++) {
					let Radish = resList[i];
					log.info("白萝卜识别结果:({x},{y},{h},{w}), 数量：{text}", Radish.x, Radish.y, Radish.Width, Radish.Height, Radish.text);
					RadishNum = Radish.text
					break;
				}
			}
			const ro9 = captureGameRegion();
			let Cabbage = ro9.find(CabbageRo);
			ro9.dispose();
			if (Cabbage.isExist()) {
				// log.info("识别到卷心菜,进行OCR获取数量");
				const ro10 = captureGameRegion();
				let resList = ro10.findMulti(RecognitionObject.ocr(Cabbage.x, Cabbage.y + Cabbage.width, Cabbage.Width, Cabbage.Height));
				ro10.dispose();
				for (let i = 0; i < resList.count; i++) {
					let Cabbage = resList[i];
					log.info("卷心菜识别结果:({x},{y},{h},{w}), 数量：{text}", Cabbage.x, Cabbage.y, Cabbage.Width, Cabbage.Height, Cabbage.text);
					CabbageNum = Cabbage.text
					break;
				}
				break;
			}
			const ro11 = captureGameRegion();
			let SliderBottom = ro11.find(SliderBottomRo);
			ro11.dispose();
			if (SliderBottom.isExist()) {
				log.info("识别到滑块，当前页面没有目标物品，向下滑动");
				// log.info("滑块当前位置:({x},{y},{h},{w})", SliderBottom.x, SliderBottom.y, SliderBottom.Width, SliderBottom.Height);
				click(Math.ceil(SliderBottom.x + SliderBottom.Width / 2), Math.ceil(SliderBottom.y + SliderBottom.Height + SliderBottom.Height / 2));
				await moveMouseTo(0, 0)
				await sleep(250);

			}
		}
		await genshin.returnMainUi();
		// log.info(`白萝卜数量：${RadishNum}，卷心菜数量： ${CabbageNum}`)
		return {
			RadishNum,
			CabbageNum
		};
	}
	// 接取任务
	async function ReceiveHangoutEvent(times) {
		setGameMetrics(3840, 2160, 2);
		for (let r = 0; r < 7; r++) {
			await sleep(500);
			click(3724, 786); // 切角色邀约,第七次切到班尼特
		}

		await sleep(1000);
		click(3120, 920);

		if (times == 0) {
			await sleep(500);
			await moveMouseTo(105, 787)

			for (let p = 0; p < 40; p++) {
				let captureRegion = captureGameRegion();
				let MaxStatus = captureRegion.Find(MaxRo);
				captureRegion.dispose();
				if (MaxStatus.isEmpty()) {
					click(105, 787); // 调整缩放到最大
				} else if (MaxStatus.isExist()) {
					log.info("缩放已调整至最大");
					break;
				}
				await sleep(40);
			}
		}

		if (times == 0) {
			const ro12 = captureGameRegion();
			let LocationButton = ro12.find(LocationButtonRo);
			ro12.dispose();
			if (LocationButton.isExist()) {
				log.info("识别到定位当前节点按钮");
				LocationButton.click();
				await sleep(1000);
			}
		}

		await sleep(1000);
		click(3500, 1330); // 蒲公英原始坐标

		await sleep(500);
		click(3500, 2030); // 继续按钮
	}
	// 开任务列表删任务
	async function AbandonHangoutEvent(times) {
		keyPress("J");
		await sleep(1500);

		if (times == 0) {
			const ro13 = captureGameRegion();
			let InProgressButton = ro13.find(InProgressButtonRo);
			ro13.dispose();
			if (InProgressButton.isExist()) {
				log.info("识别到进行中任务按钮");
				InProgressButton.click();
				await sleep(1500);
			}
		}

		const ro14 = captureGameRegion();
		let AbandonCurrentHangoutEventButton = ro14.find(AbandonCurrentHangoutEventButtonRo);
		ro14.dispose();
		if (AbandonCurrentHangoutEventButton.isExist()) {
			log.info("识别到放弃按钮");
			AbandonCurrentHangoutEventButton.click();
			await sleep(1500);
		}

		const ro15 = captureGameRegion();
		let ConfirmButton = ro15.find(ConfirmButtonRo);
		ro15.dispose();
		if (ConfirmButton.isExist()) {
			log.info("识别到确认按钮");
			ConfirmButton.click();
			await sleep(1500);
		}

		const ro16 = captureGameRegion();
		let StoryQuestsButton = ro16.find(StoryQuestsButtonRo);
		ro16.dispose();
		if (StoryQuestsButton.isExist()) {
			log.info("识别到传说任务按钮");
			StoryQuestsButton.click();
			await sleep(1500);
		}

		if (times == 0) {
			let captureRegion = captureGameRegion();
			let HangoutEventButtonSelected1 = captureRegion.find(HangoutEventButtonSelected1Ro);
			let HangoutEventButtonSelected2 = captureRegion.find(HangoutEventButtonSelected2Ro);
			let HangoutEventButtonSelected3 = captureRegion.find(HangoutEventButtonSelected3Ro);
			captureRegion.dispose();
			if (HangoutEventButtonSelected1.isExist()) {
				log.info("识别到邀约事件选项卡按钮");
				HangoutEventButtonSelected1.click();
				await sleep(1500);
			} else if (HangoutEventButtonSelected2.isExist()) {
				log.info("识别到邀约事件选项卡按钮");
				HangoutEventButtonSelected2.click();
				await sleep(1500);
			} else if (HangoutEventButtonSelected3.isExist()) {
				log.info("识别到邀约事件选项卡按钮");
				HangoutEventButtonSelected3.click();
				await sleep(1500);
			}
		}
	}
	// 检测宝箱是否已到上限
	async function UpperLimitPreciousChest() {
		let pickStatus = true;
		let failureCount = 0; // 计数检测到宝箱失败的次数
		for (let p = 0; p < 5; p++) {
			let captureRegion = captureGameRegion();
			let resList = captureRegion.findMulti(RecognitionObject.ocr(960, 0, 650, 1080));
			captureRegion.dispose();
			for (let i = 0; i < resList.count; i++) {
				let res = resList[i];
				if (res.text.includes("Precious") || res.text.includes("Chest") || res.text.includes("箱") || res.text.includes("珍貴") || res.text.includes("珍贵")) {
					failureCount++;
					log.warn(`检测到宝箱未被拾取 (${failureCount}/5) 次`);
					if (failureCount >= 3) {
						// log.warn("检测到超过 3 次宝箱未成功拾取，推测已触发系统风控，主动终止运行");
						pickStatus = false;
						break;
					}
				}
			}
		}
		return pickStatus;
	}
	// 执行路径
	async function AutoPath(locationName) {
		try {
			let filePath = `assets/AutoPath/${locationName}.json`;
			await pathingScript.runFile(filePath);
		} catch (error) {
			log.error(`执行 ${locationName} 路径时发生错误`);
			log.error(error.message);
		}
		await sleep(2000);
	}
	// 运行用时
	function logTimeTaken(startTime) {
		const currentTime = Date.now();
		const totalTimeInSeconds = (currentTime - startTime) / 1000;
		const minutes = Math.floor(totalTimeInSeconds / 60);
		const seconds = totalTimeInSeconds % 60;
		const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
		log.info(`当前运行总时长：${formattedTime}`);
		return totalTimeInSeconds;
	}
	// 预估时间
	function calculateEstimatedCompletion(estimatedStartTime, current, total) {
		if (current === 0) return "计算中...";
		const elapsedTime = Date.now() - estimatedStartTime;
		const timePerTask = elapsedTime / current;
		const remainingTasks = total - current;
		const remainingTime = timePerTask * remainingTasks;
		const completionDate = new Date(Date.now() + remainingTime);
		return `${completionDate.toLocaleTimeString()} (约 ${Math.round(remainingTime / 60000)} 分钟)`;
	}
})();