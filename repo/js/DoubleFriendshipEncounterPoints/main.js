(async function () {

	async function RequestToVisitSereniteaPot() {
		setGameMetrics(3840, 2160, 1.5);
		await sleep(2000);
		keyPress("VK_ESCAPE");
		await sleep(2000);
		click(1020,840);
		await sleep(2000);

		let y_avatar = 355;		//好友头像按钮起始Y坐标
		let y_request = 489;	//申请造访按钮起始Y坐标
		const x_avatar = 415;
		const x_request = 920;
		const avatar_increment = 250;		//两按钮相隔坐标
		const request_increment = 249;		//两按钮相隔坐标
		const request_fixed_value = 1118;	//第四~七位好友申请造访按钮Y坐标
		const total_clicks = 14;
		let request_count = 0;
		
		// 先申请造访首位好友的尘歌壶
		log.info("正在申请造访第 1 位好友尘歌壶");
		click(x_avatar, y_avatar);
		await sleep(1000);
		click(x_request, y_request);
		await sleep(1000);
		
		// 依次申请造访第二~七位好友的尘歌壶
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
		log.info("等待界面响应");
		await sleep(10000);
	}

	async function pageDown() {
		//暂无计划，还是联系一下好友开放尘歌壶吧
	}

	async function claimEncounterPointsRewards() {
		setGameMetrics(3840, 2160, 1.5);
		log.info("正在打开冒险之证领取历练点奖励");
		await sleep(2000);
		keyPress("VK_ESCAPE");
		await sleep(2000);
		click(400,1650);
		await sleep(2000);

		setGameMetrics(3840, 2160, 2); //领历练点这小节是抄来的
		click(580, 680);
		await sleep(1000);
		click(3110, 1508);
		await sleep(1000);
		click(3110, 1508);
		await sleep(1500);
		keyPress("Escape");
		log.info("已领取历练点奖励");
	}

	async function ReturnToBigWorld() {
		setGameMetrics(3840, 2160, 1.5);
		log.info("正在返回大世界");
		await sleep(2000);
		keyPress("VK_ESCAPE");
		await sleep(2000);
		click(1330,1660);
		await sleep(2000);
		click(3300,2030);
		await sleep(20000);
	}

	log.warn("注意：队伍中小于等于两人时，才会触发双倍奖励");
	await sleep(1500);
	log.warn("注意：队伍中小于等于两人时，才会触发双倍奖励");
	await sleep(1500);
	log.warn("注意：队伍中小于等于两人时，才会触发双倍奖励");
	await sleep(1500);
	
	if (!!settings.partyName) {
		try {
			log.info("正在传送回七天神像切换队伍");
			await genshin.tp(2297.60, -824.45);
			log.info("正在尝试切换至" + settings.partyName);
			await genshin.switchParty(settings.partyName);
		} catch {
			log.warn("队伍切换失败，可能处于联机模式或其他不可切换状态");
			await genshin.returnMainUi();
		}
	} else {
		await genshin.returnMainUi();
	}
	await RequestToVisitSereniteaPot();
	await claimEncounterPointsRewards();
	await sleep(1500);
	await genshin.returnMainUi();
	await ReturnToBigWorld();
})();