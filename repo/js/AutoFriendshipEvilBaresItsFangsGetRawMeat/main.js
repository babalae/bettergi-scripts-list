(async function() {

	function logTimeTaken(startTime) {
		const currentTime = Date.now();
		const totalTimeInSeconds = (currentTime - startTime) / 1000;
		const minutes = Math.floor(totalTimeInSeconds / 60);
		const seconds = totalTimeInSeconds % 60;
		const formattedTime = `${minutes}分${seconds.toFixed(0).padStart(2, '0')}秒`;
		log.info(`当前运行总时长：${formattedTime}`);
	}

	// powered by 秋云
	function calculateEstimatedCompletion(startTime, current, total) {
		if (current === 0) return "计算中...";
		const elapsedTime = Date.now() - startTime;
		const timePerTask = elapsedTime / current;
		const remainingTasks = total - current;
		const remainingTime = timePerTask * remainingTasks;
		const completionDate = new Date(Date.now() + remainingTime);
		return `${completionDate.toLocaleTimeString()} (约 ${Math.round(remainingTime / 60000)} 分钟)`;
	}

	async function AutoPath(locationName) {
		try {
			let filePath = `Assets/AutoPath/${locationName}.json`;
			await pathingScript.runFile(filePath);
		} catch (error) {
			log.error(`执行 ${locationName} 路径时发生错误`);
			log.error(error.message);
		}
		await sleep(1000);
	}

	async function comparePosition() {
		const targetPosition = {
			X: 3615.48,
			Y: -521.27
		};
		const maxDistance = 20;
		let currentPosition;

		try {
			// 优先使用小地图坐标
			await genshin.returnMainUi();
			currentPosition = genshin.getPositionFromMap();
			// log.info(`当前小地图坐标: X=${currentPosition.X}, Y=${currentPosition.Y}`);
		} catch (error) {
			// 如果失败，使用大地图坐标
			log.warn(`获取小地图坐标失败，使用大地图坐标。错误信息: ${error}`);
			await genshin.returnMainUi();
			keyPress("M");
			await sleep(2000);
			currentPosition = genshin.getPositionFromBigMap();
			// log.info(`当前大地图坐标: X=${currentPosition.X}, Y=${currentPosition.Y}`);
			keyPress("Escape");
		}

		// 计算欧氏距离
		const dx = currentPosition.X - targetPosition.X;
		const dy = currentPosition.Y - targetPosition.Y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		// 判断距离是否在允许范围内
		if (distance <= maxDistance) {
			log.info(`距离：${distance} 在突发任务范围内，循环继续`);
			return true;
		} else {
			log.warn("距离超出突发任务范围，执行触发线路");
			return false;
		}
	}

	// 好感核心函数
	async function AutoFriendship(runTimes, statueTimes, getMeatMode, delayTime, startTime, ocrTimeout) {
		for (let i = 0; i < runTimes; i++) {
			if ((i + 1) % statueTimes === 0) { // 判断当前循环次数否达到去神像设置值
				await genshin.tpToStatueOfTheSeven();
				await AutoPath(`好感-张牙舞爪的恶党-触发位置(二净甸)`);
			} else if (!await comparePosition()) { // 对比触发位置坐标，如果不符合预期坐标则重新执行触发线路
				log.info(`导航至突发任务（张牙舞爪的恶党）触发位置(二净甸)`);
				await AutoPath(`好感-张牙舞爪的恶党-触发位置(二净甸)`);
				await sleep(delayTime);
				notification.send(`已抵达突发任务“张牙舞爪的恶党”触发位置`);
			}

			await genshin.relogin();

			// 判断游戏重上后是否在任务触发位置，如果在就进行OCR，如果不在则退回次数并重新执行触发路线
			if (await comparePosition()) {
				// OCR识别是否触发任务（默认30秒超时）
				let ocrStatus = false;
				let ocrStartTime = Date.now();
				while (Date.now() - ocrStartTime < ocrTimeout && !ocrStatus) {
					let captureRegion = captureGameRegion();
					let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 200, 300, 300));
					for (let o = 0; o < resList.count; o++) {
						let res = resList[o];
						if (res.text.includes("张牙") || res.text.includes("舞爪") || res.text.includes("恶党") || res.text.includes("打倒") || res.text.includes("所有") || res.text.includes("鳄鱼")) {
							ocrStatus = true;
							break;
						}
					}
				}

				if (ocrStatus) {
					log.info(`当前次数：${i + 1}/${runTimes}`);

					// 开启急速拾取
					dispatcher.addTimer(new RealtimeTimer("AutoPick", {
						"forceInteraction": true
					}));

					await AutoPath(`好感-张牙舞爪的恶党-循环${getMeatMode ? '(二净甸刷肉版)' : '(二净甸)'}`);

					// 关闭急速拾取
					dispatcher.addTimer(new RealtimeTimer("AutoPick", {
						"forceInteraction": false
					}));

					// 根据是否回到触发位置，判定本轮循环是否执行完毕
					if (await comparePosition()) {
						log.info(`已完成次数：${i + 1}/${runTimes}`);
					} else {
						i = i - 1; // 退回这次次数
						log.warn(`判定本轮循环执行失败，退回本轮执行次数：${i + 1}/${runTimes}`);
					}
				} else {
					notification.send(`未识别到突发任务（张牙舞爪的恶党），兽肉好感结束`);
					break;
				}
			} else {
				i = i - 1; // 退回这次次数
				log.warn(`判定本轮循环执行失败，退回本轮执行次数：${i + 1}/${runTimes}`);
			}


			const estimatedCompletion = calculateEstimatedCompletion(startTime, i + 1, runTimes);
			logTimeTaken(startTime);
			log.info(`预计完成时间：${estimatedCompletion}`);
		}
		log.info('兽肉好感已完成');
	}

	// 刷肉相关参数
	let getMeatMode = settings.getMeatMode ? settings.getMeatMode : false;
	let inputValue = settings.inputValue ? settings.inputValue : 300;
	let runTimes = getMeatMode ? (isNaN(inputValue) ? 50 : Math.ceil(inputValue / 6)) : 10;
	// 神像相关参数
	let goStatue = settings.goStatue ? settings.goStatue : false;
	let statueTimes = goStatue ? (isNaN(settings.statueTimes) ? 5 : settings.statueTimes) : 0;
	// 延迟相关
	let delayTime = settings.delayTime ? settings.delayTime * 1000 : 10000;
	let ocrTimeout = settings.ocrTimeout ? settings.ocrTimeout * 1000 : 30000;
	// 卡时间相关参数
	if (settings.waitTimeMode) {
		let maxTimes = settings.maxTimes ? settings.maxTimes : runTimes;
		let waitTimeModeDay = settings.waitTimeModeDay
		const datePattern = /^\d{4}-\d{2}-\d{2}$/; // 日期正则
		if (!datePattern.test(settings.waitTimeModeDay)) {
			log.error(`检测到基准日期格式错误，当前输入值为：${waitTimeModeDay}`);
			waitTimeModeDay = "2025-03-31";
			log.info(`使用的基准日期为：${waitTimeModeDay}`);
		}
		const now = new Date();
		const benchmark = new Date(waitTimeModeDay + "T04:00:00");
		const timeDiff = now.getTime() - benchmark.getTime();
		const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
		let period = Number(settings.waitTimeModePeriod);
		if (isNaN(period)) {
			log.warn(`错误的卡时间模式周期 ${period}！使用 7 天作为周期。`);
			period = 7.0;
		}
		if (period < 1 || period > 48) {
			log.warn(`卡时间模式周期 ${period} 超过范围！使用 7 天作为周期。`);
			period = 7.0;
		}
		const daysNormalized = daysDiff >= 0 ? daysDiff : period - (Math.abs(daysDiff) % period);
		runTimes = Math.ceil(maxTimes / period) * (daysNormalized % period + 1);
	}

	// Main
	let messages = [
		'请确保队伍满员，并为队伍配置相应的战斗策略',
		`使用的七天神像周期为： ${statueTimes}`,
		`计算后的运行次数为： ${runTimes}`,
	];
	for (let message of messages) {
		log.info(message);
		await sleep(500);
	}
	log.info('兽肉好感开始...');

	//  切换队伍
	if (!!settings.partyName) {
		try {
			await genshin.tpToStatueOfTheSeven();
			await sleep(2000);
			log.info("正在尝试切换至" + settings.partyName);
			await genshin.switchParty(settings.partyName);
		} catch {
			log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
			notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
			await genshin.returnMainUi();
		}
	} else {
		await genshin.returnMainUi();
	}

	const startTime = Date.now();
	await AutoFriendship(runTimes, statueTimes, getMeatMode, delayTime, startTime, ocrTimeout);

})();