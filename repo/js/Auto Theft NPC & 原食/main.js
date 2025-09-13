const npcData = {
	"Blanche": {
		"name": "布兰琪",
		"enable": true,
		"page": 2,
		"time": "night",
		"path": "assets/path/布兰琪.json",
		"goods": ["盐", "胡椒", "洋葱", "牛奶", "番茄", "卷心菜", "土豆", "小麦"]
	},
	"DongSheng": {
		"name": "东升",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/东升.json",
		"goods": ["洋葱", "牛奶", "卷心菜", "土豆", "小麦", "稻米", "虾仁", "豆腐", "杏仁", "盐", "胡椒", "番茄"]
	},
	"ChefMao": {
		"name": "香菱爹",
		"enable": true,
		"page": 5,
		"time": "any",
		"path": "assets/path/卯师父.json",
		"goods": ["鱼肉", "螃蟹"]
	},
	"UncleSun": {
		"name": "奸商老孙",
		"enable": true,
		"page": 1,
		"time": "day",
		"path": "assets/path/老孙.json",
		"goods": ["鱼肉", "螃蟹", "虾仁"]
	},
	"UncleGao": {
		"name": "奸商老高",
		"enable": true,
		"page": 1,
		"time": "day",
		"path": "assets/path/老高.json",
		"goods": ["鱼肉"]
	},
	"Aoi": {
		"name": "葵",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/葵.json",
		"goods": ["洋葱", "牛奶", "卷心菜", "土豆", "小麦", "稻米", "虾仁", "豆腐", "盐", "胡椒", "番茄"]
	},
	"ShimuraKanbei": {
		"name": "志村勘兵卫",
		"enable": true,
		"page": 4,
		"time": "any",
		"path": "assets/path/志村勘兵卫.json",
		"goods": ["鱼肉", "螃蟹"]
	},
	"Butrus": {
		"name": "布特罗斯",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/布特罗斯.json",
		"goods": ["鱼肉", "螃蟹", "虾仁"]
	},
	"Pam": {
		"name": "珀姆",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/珀姆.json",
		"goods": ["鱼肉", "螃蟹", "虾仁"]
	},
	"Hamawi": {
		"name": "哈马维",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/哈马维.json",
		"goods": ["洋葱", "牛奶", "卷心菜", "土豆", "小麦", "稻米", "虾仁", "豆腐", "盐", "胡椒", "番茄"]
	},
	"Enteka": {
		"name": "恩忒卡",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/恩忒卡.json",
		"goods": ["咖啡豆"]
	}
	,
	"Azalai": {
		"name": "阿扎莱",
		"enable": true,
		"page": 2,
		"time": "night",
		"path": "assets/path/阿扎莱.json",
		"goods": ["鱼肉", "兽肉", "秃秃豆"]
	},
	"Boucicaut": {
		"name": "布希柯",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/布希柯.json",
		"goods": ["枫达", "洋葱", "牛奶", "卷心菜", "土豆", "小麦", "秃秃豆", "杏仁", "发酵果实汁", "盐", "胡椒", "番茄"]
	},
	"Arouet": {
		"name": "阿鲁埃",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/阿鲁埃.json",
		"goods": ["咖啡豆", "枫达"]
	},
	"Bunama": {
		"name": "布纳马",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/布纳马.json",
		"goods": ["盐", "小麦", "胡椒", "洋葱", "牛奶", "番茄", "卷心菜", "土豆", "秃秃豆"]
	}
}

const goodsData = {
	"salt": {
		"id": "salt",
		"name": "盐",
		"file": "assets/images/salt.png"
	},
	"pepper": {
		"id": "pepper",
		"name": "胡椒",
		"file": "assets/images/pepper.png"
	},
	"onion": {
		"id": "onion",
		"name": "洋葱",
		"file": "assets/images/onion.png"
	},
	"milk": {
		"id": "milk",
		"name": "牛奶",
		"file": "assets/images/milk.png"
	},
	"tomato": {
		"id": "tomato",
		"name": "番茄",
		"file": "assets/images/tomato.png"
	},
	"potato": {
		"id": "potato",
		"name": "土豆",
		"file": "assets/images/potato.png"
	},
	"wheat": {
		"id": "wheat",
		"name": "小麦",
		"file": "assets/images/wheat.png"
	},
	"rice": {
		"id": "rice",
		"name": "稻米",
		"file": "assets/images/rice.png"
	},
	"shrimp": {
		"id": "shrimp",
		"name": "虾仁",
		"file": "assets/images/shrimp.png"
	},
	"almond": {
		"id": "almond",
		"name": "杏仁",
		"file": "assets/images/almond.png"
	},
	"cabbage": {
		"id": "cabbage",
		"name": "卷心菜",
		"file": "assets/images/cabbage.png"
	},
	"tofu": {
		"id": "tofu",
		"name": "豆腐",
		"file": "assets/images/tofu.png"
	},
	"fish": {
		"id": "fish",
		"name": "鱼肉",
		"file": "assets/images/fish.png"
	},
	"crab": {
		"id": "crab",
		"name": "螃蟹",
		"file": "assets/images/crab.png"
	},
	"coffeeBeans": {
		"id": "coffeeBeans",
		"name": "咖啡豆",
		"file": "assets/images/coffeeBeans.png"
	},
	"glabrousBeans": {
		"id": "glabrousBeans",
		"name": "秃秃豆",
		"file": "assets/images/glabrousBeans.png"
	},
	"rawMeat": {
		"id": "rawMeat",
		"name": "兽肉",
		"file": "assets/images/rawMeat.png"
	},
	"fermentedJuice": {
		"id": "fermentedJuice",
		"name": "发酵果实汁",
		"file": "assets/images/fermentedJuice.png"
	},
	"fonta": {
		"id": "fonta",
		"name": "枫达",
		"file": "assets/images/fonta.png"
	}
};

const translationList = {};

const enableGoods = new Set([]);

const othrtRo = {
	"buy": {
		"name": "购买按钮",
		"file": "assets/images/buyBtn.png"
	}
}

// 设置游戏时间
async function setTime(hour, minute) {
	// 关于setTime
	// 原作者: Tim
	// 脚本名称: SetTimeMinute - 精确调整游戏时间到分钟
	// 脚本版本: 1.0
	// Hash: f5c2547dfc286fc643c733d630f775e8fbf12971

	// 设置游戏分辨率和DPI缩放
	setGameMetrics(1920, 1080, 1);
	// 圆心坐标
	const centerX = 1441;
	const centerY = 501.6;
	// 半径
	const r1 = 30;
	const r2 = 150;
	const r3 = 300;
	const stepDuration = 50;

	function getPosition(r, index) {
		let angle = index * Math.PI / 720;
		return [Math.round(centerX + r * Math.cos(angle)), Math.round(centerY + r * Math.sin(angle))];
	}
	async function mouseClick(x, y) {
		moveMouseTo(x, y);
		await sleep(50);
		leftButtonDown();
		await sleep(50);
		leftButtonUp();
		await sleep(stepDuration);
	}
	async function mouseClickAndMove(x1, y1, x2, y2) {
		moveMouseTo(x1, y1);
		await sleep(50);
		leftButtonDown();
		await sleep(50);
		moveMouseTo(x2, y2);
		await sleep(50);
		leftButtonUp();
		await sleep(stepDuration);
	}
	async function setTime(hour, minute) {
		const end = (hour + 6) * 60 + minute - 20;
		const n = 3;
		for (let i = - n + 1; i < 1; i++) {
			let [x, y] = getPosition(r1, end + i * 1440 / n);
			await mouseClick(x, y);
		}
		let [x1, y1] = getPosition(r2, end + 5);
		let [x2, y2] = getPosition(r3, end + 20 + 0.5);
		await mouseClickAndMove(x1, y1, x2, y2);
	}

	let h = Math.floor(hour + minute / 60);
	const m = Math.floor(hour * 60 + minute) - h * 60;
	h = ((h % 24) + 24) % 24;
	log.info(`设置时间到 ${h} 点 ${m} 分`);
	await keyPress("Escape");
	await sleep(1000);
	await click(50, 700);
	await sleep(2000);
	await setTime(h, m);
	await sleep(1000);
	await click(1500, 1000);//确认
	await sleep(18000);
	await keyPress("Escape");
	await sleep(2000);
	await keyPress("Escape");
	await sleep(2000);
}

// 地图追踪
async function autoPath(locationPath) {
	try {
		let filePath = locationPath;
		await pathingScript.runFile(filePath);
		sleep(2000);

		return true;
	} catch (error) {
		log.error(`执行 ${locationName} 路径时发生错误`);
		log.error(error.message);
	}

	return false;
}

// 平滑过渡函数（缓动效果）
function smoothStep(t) {
	return t * t * (3 - 2 * t);
}

// 模拟鼠标移动到指定位置（带曲线路径）
async function naturalMove(initX, initY, targetX, targetY, duration, wiggle = 30) {

	// 生成控制点（使路径形成曲线）
	const controlX = (initX + targetX) / 2 + (Math.random() * wiggle * 2 - wiggle);
	const controlY = (initY + targetY) / 2 + (Math.random() * wiggle * 2 - wiggle);

	const steps = Math.max(duration / 20, 10); // 计算步数

	for (let i = 0; i <= steps; i++) {
		const progress = i / steps;
		const t = smoothStep(progress); // 使用平滑过渡

		// 二次贝塞尔曲线计算
		const x = (1 - t) * (1 - t) * initX + 2 * (1 - t) * t * controlX + t * t * targetX;
		const y = (1 - t) * (1 - t) * initY + 2 * (1 - t) * t * controlY + t * t * targetY;

		moveMouseTo(Math.trunc(x), Math.trunc(y));

		// 随机延迟使移动更自然
		await sleep(Math.trunc(duration / steps * (0.8 + Math.random() * 0.4)));
	}

	// 确保最终位置准确
	moveMouseTo(targetX, targetY);
}

// 切换下一页商品
async function nextGoodsPage() {
	//设置脚本环境的游戏分辨率和DPI缩放
	setGameMetrics(3840, 2160, 1.5);

	let [initX, initY] = [1500, 1850];
	let [targetX, targetY] = [1800, 260];

	moveMouseTo(initX, initY);
	leftButtonDown();
	await naturalMove(initX, initY, targetX, targetY, 300);

	// 按住了, 防止弹太远
	await sleep(520);
	leftButtonUp();
}

// 快速购买
async function qucikBuy() {
	//设置脚本环境的游戏分辨率和DPI缩放
	setGameMetrics(3840, 2160, 1.5);

	let [buyBtnX, buyBtnY] = [3200, 2045];
	let [confirmBtnX, confirmBtnY] = [2025, 1570];
	let [addNumX, addNumY] = [2060, 1208];

	// 等待界面切换
	await sleep(200);

	// 查找购买按钮
	let captureRegion = captureGameRegion();
	let buyBtn = captureRegion.Find(othrtRo.buy.ro);
	if (buyBtn.isEmpty()) {
		return false;
	}
	// 点击购买按钮
	click(buyBtn.x * 2 + buyBtn.width, buyBtn.y * 2 + buyBtn.height);
	// 等待购买窗口弹出
	await sleep(300);

	// 增加数量至最大
	leftButtonDown();
	await naturalMove(addNumX, addNumY, addNumX + 666, addNumY - 233, 100);
	leftButtonUp();

	// 点击确认按钮
	click(confirmBtnX, confirmBtnY);
	// 等待购买完成
	await sleep(200);
	// 点击空白关闭
	click(buyBtnX, buyBtnY);
	await sleep(200);

	return true;
}

// 跳过对话
async function spikChat(npcName) {
	count = 5
	await sleep(1000);
	if (npcName == "布纳马") {

		await sleep(1000);
		// 设置游戏分辨率和DPI缩放
		setGameMetrics(1920, 1080, 1);
	
		// 交互
		for (let i = 0; i < 3; i++) {
			keyPress("VK_F");
			await sleep(1500);
		}

		// 点击有什么卖的
		let captureRegion = captureGameRegion()
		let resList = captureRegion.findMulti(RecognitionObject.ocrThis);
		for (let i = 0; i < resList.count; i++) {
			if (resList[i].text.includes("有什么卖的")) {
				await sleep(500);
				click(resList[i].x + 30, resList[i].y + 30); // 点击有什么卖的
				await sleep(500);

				// 使用完后释放资源
				captureRegion.dispose();
			}
		}

		await sleep(1500);
		keyPress("VK_F");
		await sleep(1500);
	} else {
		for (let i = 0; i < count; i++) {
			keyPress("VK_F");
			await sleep(1300);
		}
	}
	await sleep(1000);
}

// 购买逻辑
async function buyGoods(npcName) {
	// 设置脚本环境的游戏分辨率和DPI缩放
	setGameMetrics(3840, 2160, 1.5);

	let tempGoods = [...npcData[npcName].enableGoods];

	// 多页购买
	for (let i = 0; i < npcData[npcName].page; i++) {
		log.info("购买列表: {goods}", [...tempGoods].join(", "));

		// 获取一张截图
		let captureRegion = captureGameRegion();

		// 记录已经购买的物品
		let boughtGoods = new Set([]);

		// 匹配商品
		for (let item of tempGoods) {
			let resList = captureRegion.FindMulti(goodsData[item].ro);
			for (let res of resList) {
				log.info("找到物品: {i} 位置({x},{y},{h},{w})", goodsData[item].name, res.x, res.y, res.width, res.height);
				// 移除已购买的物品
				boughtGoods.add(item);
				// 点击商品
				click(res.x * 2 + res.width, res.y * 2 + res.height);
				if (await qucikBuy()) {
					log.info("购买成功: {item}", goodsData[item].name);
					await sleep(500);
					// 重新截图
					captureRegion = captureGameRegion();
				}
				else {
					log.info("购买失败: {item}, 背包已经满或商品已售罄", goodsData[item].name);
				}
			}
		}

		// 从已购买物品中移除
		tempGoods = tempGoods.filter(item => !boughtGoods.has(item));


		// 若不是最后一页且还有未购买的物品
		if (tempGoods.length > 0 && i !== npcData[npcName].page - 1) {
			log.info("切换到下一页商品");
			await nextGoodsPage();

			// 最后一次切换界面, 等待UI回弹
			if (i === npcData[npcName].page - 2) {
				log.info("等待界面回弹");
				await sleep(500);
			}
		}
	}
}

// 初始化NPC商品
async function initNpcData() {
	for (let [key, npc] of Object.entries(npcData)) {

		// 翻译物品名称
		let npcGoods = new Set([]);
		Object.entries(npc.goods).forEach(([count, item]) => {
			npcGoods.add(translationList[item]);
		});

		// 筛选已启用的商品
		npc.enableGoods = [...enableGoods].filter(item => npcGoods.has(item));

		// 如果没有启用的商品, 则不启用该NPC
		if (npc.enableGoods.length === 0) {
			npc.enable = false;
		}
	}
}

// 加载识别对象
async function initRo() {
	try {
		// 加载识别对象
		for (let [key, item] of Object.entries(goodsData)) {
			// 填充中英文对照表
			translationList[item.name] = item.id;
			// 判断启动商品、加载识别对象
			if (settings[item.id]) {
				enableGoods.add(item.id);
				item.ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(item.file));
				item.ro.Threshold = 0.75;
				item.ro.Use3Channels = true;
			}
		}
		// 加载其他识别对象
		for (let [key, item] of Object.entries(othrtRo)) {
			item.ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(item.file));
			item.ro.Threshold = 0.85;
		}
		return true;
	}
	catch (error) {
		log.error("加载识别对象时发生错误: {error}", error.message);
		throw error;
	}
}

(async function () {
	// ==================== 初始化识别对象 ====================
	await initRo();
	log.info("识别对象初始化完成");

	// ==================== 初始化NPC数据 ====================
	await initNpcData();
	log.info("NPC数据初始化完成");

	// ==================== 自动购买 ====================
	for (let [key, npc] of Object.entries(npcData)) {
		if (npc.enable) {
			await genshin.returnMainUi();
			log.info("开始购买NPC: {npcName}", npc.name);
			// 设置游戏时间
			if (npc.time === "night") {
				await setTime(20, 0); // 设置为晚上8点
			}
			else if (npc.time === "day") {
				await setTime(8, 0); // 设置为早上8点
			}
			await autoPath(npc.path);
			await spikChat(npc.name);
			await buyGoods(key);
			// 返回主界面
			await genshin.returnMainUi();
			log.info("完成购买NPC: {npcName}", npc.name);
		}
		else {
			log.info("跳过未启用的NPC: {npcName}", npc.name);
		}
	}
})();


