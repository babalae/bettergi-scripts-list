/**
 * 使用 BetterGI 核心换队任务。核心会根据界面状态轮询并在超时后返回，
 * 避免在脚本层依赖固定等待时间。
 *
 * BetterGI 0.45.1 起会返回明确的换队结果。
 *
 * @param {string} partyName
 * @param {string} scene
 * @returns {Promise<{success: boolean, reason: string}>}
 */
async function trySwitchParty(partyName, scene) {
	try {
		log.info(`正在${scene}尝试切换至队伍：${partyName}`);
		const result = await genshin.switchParty(partyName);
		if (!result) {
			const reason = "BetterGI 核心换队返回失败";
			log.warn(`${scene}换队失败：${reason}`);
			return { success: false, reason };
		}

		return { success: true, reason: "" };
	} catch (error) {
		const reason = error && error.message ? error.message : String(error);
		log.warn(`${scene}换队异常：${reason}`);
		return { success: false, reason };
	}
}

/**
 * @returns {Promise<void>}
 */
(async function () {
	const partyName = String(settings.partyName || "").trim();

	if (!partyName) {
		const message = "没有设置切换队伍";
		log.error(message);
		notification.error(message);
		await genshin.returnMainUi();
		throw new Error(message);
	}

	try {
		let switchResult;

		if (!settings.disableGoStatue) {
			log.info("强制传送到七天神像切换队伍");
			await genshin.TpToStatueOfTheSeven();
			switchResult = await trySwitchParty(partyName, "七天神像");
		} else {
			await genshin.returnMainUi();
			switchResult = await trySwitchParty(partyName, "当前位置");

			if (!switchResult.success) {
				log.info("当前位置换队失败，传送到七天神像重试");
				await genshin.TpToStatueOfTheSeven();
				switchResult = await trySwitchParty(partyName, "七天神像");
			}
		}

		if (!switchResult.success) {
			throw new Error(`未能切换至队伍【${partyName}】：${switchResult.reason}`);
		}

		genshin.clearPartyCache();
		notification.send(`已确认队伍：${partyName}`);
	} catch (error) {
		const reason = error && error.message ? error.message : String(error);
		const message = `队伍切换失败：${reason}`;
		log.error(message);
		notification.error(message);
		await genshin.returnMainUi();
		throw error;
	}
})();
