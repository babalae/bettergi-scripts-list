// 模板数组，用于对比用户设置
const settingsTemplate = [{"name":"check","type":"checkbox","label":"我已阅读 README.md","default":false},{"name":"fast","type":"checkbox","label":"极速模式","default":false},{"name":"图像质量","type":"select","label":"图像质量","options":["默认","极低","低","中","高","自定义"],"default":"默认"},{"name":"帧率","type":"select","label":"帧率","options":["默认","30","45","60"],"default":"默认"},{"name":"垂直同步","type":"select","label":"垂直同步","options":["默认","关闭","打开"],"default":"默认"},{"name":"渲染精度","type":"select","label":"渲染精度","options":["默认","0.6","0.8","0.9","1.0","1.1","1.2","1.3","1.4","1.5"],"default":"默认"},{"name":"阴影质量","type":"select","label":"阴影质量","options":["默认","极低","低","中","高"],"default":"默认"},{"name":"全局光照","type":"select","label":"全局光照","options":["默认","关闭","中","高","非常高"],"default":"默认"},{"name":"后期效果","type":"select","label":"后期效果","options":["默认","极低","低","中","高"],"default":"默认"},{"name":"特效质量","type":"select","label":"特效质量","options":["默认","极低","低","中","高"],"default":"默认"},{"name":"场景细节","type":"select","label":"场景细节","options":["默认","极低","低","中","高","极高"],"default":"默认"},{"name":"抗锯齿","type":"select","label":"抗锯齿","options":["默认","关闭","FSR 2","SMAA"],"default":"默认"},{"name":"体积雾","type":"select","label":"体积雾","options":["默认","关闭","打开"],"default":"默认"},{"name":"反射","type":"select","label":"反射","options":["默认","关闭","打开"],"default":"默认"},{"name":"动态模糊","type":"select","label":"动态模糊","options":["默认","关闭","低","高","非常高"],"default":"默认"},{"name":"Bloom","type":"select","label":"Bloom","options":["默认","关闭","打开"],"default":"默认"},{"name":"人群密度","type":"select","label":"人群密度","options":["默认","低","高"],"default":"默认"},{"name":"多人游戏队友特效","type":"select","label":"多人游戏队友特效","options":["默认","完全屏蔽","部分屏蔽","打开"],"default":"默认"},{"name":"次表面散射","type":"select","label":"次表面散射","options":["默认","关闭","中","高"],"default":"默认"},{"name":"各向异性采样","type":"select","label":"各向异性采样","options":["默认","1x","2x","4x","8x","16x"],"default":"默认"},{"name":"角色动态高精度","type":"select","label":"角色动态高精度","options":["默认","关闭","打开"],"default":"默认"}];
// 用户设置数组，用 Array.from() 获取字面值
const settingsArr = Array.from(settings);

// 载入设置图标和图像设置按钮
const settingsIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/gear.png"));
const graphicsTextRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/graphics.png"));
const volumeTextRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/RecognitionObject/volume.png"));

// 封装好的点击以上两个按钮操作
const findAndClick = async (object) => {
	let gameRegion = captureGameRegion();
	if (!gameRegion) {
		log.error("截图失败");
		return;
	}
	let found = gameRegion.Find(object);
	if (!found) {
		log.error("未能找到目标元素，请确认游戏界面状态");
		return;
	}
	found.click();
	found.click(); // 点两次是因为设置图标有的时候点一次无反应
	gameRegion.Dispose();
};

// 转换音量设置项字符串为整数
const stringToInt = async (str) => {
  if (!/^-?\d+$/.test(str))
    return NaN;
  return Number(str);
}

const buildOcrMap = () => { // 硬编码按钮坐标，用于极速模式
	let map = new Map([
  ["图像质量", { x: 1500, y: 176 }],
  ["帧率", { x: 1500, y: 426 }],
  ["垂直同步", { x: 1500, y: 502 }],
  ["渲染精度", { x: 1500, y: 570 }],
  ["阴影质量", { x: 1500, y: 638 }],
  ["全局光照", { x: 1500, y: 704 }],
  ["后期效果", { x: 1500, y: 772 }],
  ["特效质量", { x: 1500, y: 98 }],
  ["场景细节", { x: 1500, y: 164 }],
  ["抗锯齿", { x: 1500, y: 226 }],
  ["体积雾", { x: 1500, y: 294 }],
  ["反射", { x: 1500, y: 354 }],
  ["动态模糊", { x: 1500, y: 434 }],
  ["Bloom", { x: 1500, y: 498 }],
  ["人群密度", { x: 1500, y: 564 }],
  ["多人游戏队友特效", { x: 1500, y: 638 }],
  ["次表面散射", { x: 1500, y: 701 }],
  ["各向异性采样", { x: 1500, y: 770 }],
  ["角色动态高精度", { x: 1500, y: 840 }]
]);
	return map;
};

// 封装好的 OCR 寻找选项功能
const findOption = async (optionName) => {
	let gameRegion = captureGameRegion();
	let ocrList = gameRegion.findMulti(RecognitionObject.ocrThis);
	gameRegion.Dispose();
	for(let i = 0;i < ocrList.count; i++)
		if(ocrList[i].Text === optionName)
			return ocrList[i];
};

// 普通模式点击选项
const chooseOption = async (optionName, order) => {
	if(order === 0)
		return; // 默认选项，跳过
	let res = await findOption(optionName);
	let x = res.x, y = res.y;
	click(x + 1000, y + 25); // 点击选项的下拉栏，依赖选项名称的相对位置
	await sleep(100);
	click(x + 1000, y + 25 + order * 50); // 点击具体选项
	await sleep(150);
	click(1000, 39);
	click(1000, 39); // 双击空白处，关闭可能弹出的“部分图像设置需要重启游戏后生效”
};

// 极速模式点击选项
const chooseOptionFast = async (optionName, order, ocrMap) => {
	if(order === 0)
		return; // 默认选项，跳过
	let res = ocrMap.get(optionName);
	if(!res) {
		log.error("未能找到选项：{name}", optionName);
		return;
	}
	let x = res.x, y = res.y;
	click(x, y + 25); // 点击选项的下拉栏，依赖选项名称的相对位置
	await sleep(20);
	click(x, y + 25 + order * 50); // 点击具体选项
	await sleep(150);
	if((optionName === "图像质量") || (optionName === "场景细节")){
		click(1000, 39);
		click(1000, 39); // 双击空白处，关闭可能弹出的“部分图像设置需要重启游戏后生效”
		await sleep(500);
	}
	else
		click(1000, 39); // 单击空白处取消关闭下拉菜单的后摇
};

// 拖动音量条
const dragOption = async (optionName, size) => {
	if(size === -1)
		return; // 默认选项，跳过
	if(Number.isNaN(size) || size < 0 || size > 10)
		return; // 音量大小不合法，跳过
	let res = await findOption(optionName);
	let x = res.x, y = res.y;
	for(let i = 25;i <= 39;++i) // 鲁棒性
		click(x + 955 + 32 * size, y + i);
}

(async function () {
	if(!settings.check) {
		log.error("请先阅读 README.md！");
		return;
	}
	log.info("正在尝试回到主界面……");
	await genshin.returnMainUi();
	log.info("回到主界面成功，正在进入设置界面……");
	await sleep(500);
	keyPress("ESCAPE");
	await sleep(1000);
	await findAndClick(settingsIconRo);
	log.info("进入设置界面成功，打开图像页");
	await sleep(1000);
	await findAndClick(graphicsTextRo);
	await sleep(500);

	log.info("开始修改图像设置，请{highlight}", "不要操作");
	if(settings.fast) {
		/* ----------begin 极速模式----------*/
		log.info("已启用{highlight}", "极速模式");
		const ocrMap = buildOcrMap();

		for(let i = 2; i < 9;++i) {
			const options = settingsTemplate[i].options;
			const idx = options.indexOf(settingsArr[i].Value);
			if(idx > 0) {
				log.info("{name}选择{option}", settingsTemplate[i].name, settingsArr[i].Value);
				await chooseOptionFast(settingsTemplate[i].name, idx, ocrMap);
			}
		}

		// 滚动页面
		moveMouseTo(1000, 500);
		for(let i = 0;i < 50;++i)
			verticalScroll(-1);
		await sleep(100);

		for(let i = 9;i < settingsTemplate.length;++i) {
			const options = settingsTemplate[i].options;
			const idx = options.indexOf(settingsArr[i].Value);
			if(idx > 0) {
				log.info("{name}选择{option}", settingsTemplate[i].name, settingsArr[i].Value);
				await chooseOptionFast(settingsTemplate[i].name, idx, ocrMap);
			}
		}
		/* ----------end 极速模式----------*/
	}
	else {
		/* ----------begin 普通模式----------*/
		for(let i = 2; i < 9;++i)
			for(let j = 0; j < Array.from(settingsTemplate[i].options).length;++j)
				if(settingsArr[i].Value === Array.from(settingsTemplate[i].options)[j]) {
					log.info("{name}选择{option}", settingsTemplate[i].name, settingsArr[i].Value);
					await chooseOption(settingsTemplate[i].name, j);
				}

		// 滚动页面
		moveMouseTo(1000, 500);
		for(let i = 0;i < 50;++i)
			verticalScroll(-1);
		await sleep(500);

		for(let i = 9;i < 21;++i)
			for(let j = 0; j < Array.from(settingsTemplate[i].options).length;++j)
				if(settingsArr[i].Value === Array.from(settingsTemplate[i].options)[j]) {
					log.info("{name}选择{option}", settingsTemplate[i].name, settingsArr[i].Value);
					await chooseOption(settingsTemplate[i].name, j);
				}
		/* ----------end 普通模式----------*/
	}

	log.info("修改图像设置完成，正在尝试回到主界面……");
	await genshin.returnMainUi();
	log.info("回到主界面成功，现在开始修改{highlight}", "音量设置");
	keyPress("ESCAPE");
	await sleep(1000);
	await findAndClick(settingsIconRo);
	log.info("进入设置界面成功，打开声音页");
	await sleep(1000);
	await findAndClick(volumeTextRo);
	await sleep(500);

	log.info("正在调整{highlight}", "主音量");
	await dragOption("音量", await stringToInt(settings.mainVolume));
	log.info("正在调整{highlight}", "音乐音量");
	await dragOption("音乐音量", await stringToInt(settings.musicVolume));
	log.info("正在调整{highlight}", "语音音量");
	await dragOption("语音音量", await stringToInt(settings.dialogueVolume));
	log.info("正在调整{highlight}", "音效音量");
	await dragOption("音效音量", await stringToInt(settings.sfxVolume));

	let map = new Map();
	map.set("动态范围", ["默认", "完全", "有限"]);
	map.set("输出设置", ["默认", "立体声", "环绕声"]);
	map.set("最小化时静音", ["默认", "关闭", "打开"]);

	log.info("{name}选择{option}", "动态范围", settings.dynamicRange);
	if(settings.dynamicRange !== "默认")
		for(let i = 0;i < map.get("动态范围").length;++i)
			if(map.get("动态范围")[i] === settings.dynamicRange)
				await chooseOption("动态范围", i);

	log.info("{name}选择{option}", "输出设置", settings.outputSetting);
	if(settings.outputSetting !== "默认")
		for(let i = 0;i < map.get("输出设置").length;++i)
			if(map.get("输出设置")[i] === settings.outputSetting)
				await chooseOption("输出设置", i);

	log.info("{name}选择{option}", "最小化时静音", settings.muteWhenMinimized);
	if(settings.muteWhenMinimized !== "默认")
		for(let i = 0;i < map.get("最小化时静音").length;++i)
			if(map.get("最小化时静音")[i] === settings.muteWhenMinimized)
				await chooseOption("最小化时静音", i);

	log.info("修改音量设置完成，正在尝试回到主界面……");
	await genshin.returnMainUi();
	log.info("回到主界面成功");
})();
