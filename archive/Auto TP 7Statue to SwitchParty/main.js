(async function () {
	async function SwitchCurrentParty() {
		setGameMetrics(3840, 2160, 2);
		await genshin.tp(2297.60, -824.45);
		await sleep(3000);
		await genshin.returnMainUi();
		await sleep(2000);
		keyPress("L");
		await sleep(4500);
		click(100, 2050);
		await sleep(800);
		
		for(let i = 0; i < 2; i++){
			await keyMouseScript.runFile(`assets/Team.json`);
			await sleep(800);
		}
		
		click(100, 300);
		await sleep(800);
		click(100, 2050);
		await sleep(800);
		
		for(let i = 1; i < settings.n; i++){
			click(3684, 1078);
			await sleep(800);
		}
		
		click(3200, 2050);
		await sleep(1000);
		keyPress("Escape");
		await sleep(1000);

		log.info("已切换至第"+ settings.n +"队");
	}

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
		if (isNaN(settings.n)) {
			log.warn("不是戈门，你连几号队伍都还没设置，你想让BetterGI切换成啥啊？赶紧去设置一下。如果不会，那就去去看看《BetterGI快速入门》，认真学习一下怎么“修改JS脚本自定义设置”吧，要是这都学不会的话还是去宛平南路600号看看");
		}else if (settings.n <= 0 || settings.n > 15){
			log.warn("不是戈门，你...你设置了个啥啊，BetterGI这也没法切啊");
		}else{
			await SwitchCurrentParty();
		}
	}
})();