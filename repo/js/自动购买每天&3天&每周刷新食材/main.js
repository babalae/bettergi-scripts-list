const AFK = parseInt(settings.AKF) || 1; // 从settings读取用户选择的购买日
const AFKDay = AFK === 7 ? 0 : AFK; // 将7转换为0（周日）

const npcData = {
	"莎拉": {
		"name": "莎拉",
		"enable": true,
		"page": 4,
		"time": "night",
		"path": "assets/path/莎拉.json",
		"_7d_foods": ["蟹黃"]
	},
	"神奇的霍普金斯": {
		"name": "神奇的霍普金斯",
		"enable": true,
		"page": 2,
		"time": "day",
		"path": "assets/path/神奇的霍普金斯.json",
		"_1d_foods": ["圣水"]
	},
	"ChefMao": {
		"name": "香菱爹",
		"enable": true,
		"page": 5,
		"time": "any",
		"path": "assets/path/卯师父.json",
		"_1d_foods": ["螃蟹"],
		"_3d_foods": ["胡梦卜", "松茸"]
	},
	"UncleSun": {
		"name": "奸商老孙",
		"enable": true,
		"page": 1,
		"time": "day",
		"path": "assets/path/老孙.json",
		"_1d_foods": ["螃蟹"],
	},
	"阿桂": {
		"name": "阿桂",
		"enable": true,
		"page": 2,
		"time": "night",
		"path": "assets/path/阿桂.json",
		"_3d_foods": ["清心", "琉璃袋"]
	},
	"菲尔戈黛特": {
		"name": "菲尔戈黛特",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/菲尔戈黛特.json",
		"_3d_foods": ["松茸", "琉璃袋"]
	},
	"丰泰": {
		"name": "丰泰",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/丰泰.json",
		"_3d_foods": ["沉玉仙茗", "琉璃袋"],
		"_7d_foods": ["蟹黃"]
	},
	"连芳": {
		"name": "连芳",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/连芳.json",
		"_3d_foods": ["沉玉仙茗"]
	},
	"Obata": {
		"name": "小畑",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/小畑.json",
		"_1d_foods": ["螃蟹"],

	},
	"ShimuraKanbei": {
		"name": "志村勘兵卫",
		"enable": true,
		"page": 4,
		"time": "any",
		"path": "assets/path/志村勘兵卫.json",
		"_1d_foods": ["螃蟹"],
		"_3d_foods": ["堇瓜"]
	},
	"Zhute": {
		"name": "朱特",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/朱特.json",
		"_3d_foods": ["帕蒂沙兰"]
	},
	"Butrus": {
		"name": "布特罗斯",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/布特罗斯.json",
		"_1d_foods": ["螃蟹"],

	},
	"Pam": {
		"name": "珀姆",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/珀姆.json",
		"_1d_foods": ["螃蟹"],

	},
	"Lambad": {
		"name": "兰巴德",
		"enable": true,
		"page": 3,
		"time": "any",
		"path": "assets/path/兰巴德.json",
		"_1d_foods": ["螃蟹"],
	},
	"巴巴克": {
		"name": "巴巴克",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/巴巴克.json",
		"_3d_foods": ["清心", "琉璃袋"]
	},
	"Antman": {
		"name": "安特曼",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/安特曼.json",
		"_1d_foods": ["螃蟹"],
		"_3d_foods": ["海露花","汐藻"]
	},
	"钦特利": {
		"name": "钦特利",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/钦特利.json",
		"_3d_foods": ["青蜜梅", "苦种"]
	},
	"夏安卡": {
		"name": "夏安卡",
		"enable": true,
		"page": 3,
		"time": "any",
		"path": "assets/path/夏安卡.json",
		"_7d_foods": ["蟹黃"]
	}
	// // 參考
	// ,
	// "新卖食物NPC": {	// NPC名字
	// 	"name": "新卖食物NPC",	// NPC名字	
	// 	"enable": true,
	// 	"page": 1,	// 商人卖的物品页数
	// 	"time": "any",	//any 不调时间,day 早上8点, night 晚上8点
	// 	"path": "assets/path/新卖食物NPC.json", //写入 卖食物NPC路径名
	// 	"_3d__3d_foods": ["新食材"]// 写入 新加入 的 食材名字
	// }

}

const foodsData = {
	"huMengbu": {
		"id": "huMengbu",
		"name": "胡梦卜",
		"file": "assets/images/huMengbu.png"
	},
	"viola": {
		"id": "viola",
		"name": "堇瓜",
		"file": "assets/images/viola.png"
	},
	"romaritimeFlower": {
		"id": "romaritimeFlower",
		"name": "海露花",
		"file": "assets/images/romaritimeFlower.png"
	},
	"Padisarah": {
		"id": "Padisarah",
		"name": "帕蒂沙兰",
		"file": "assets/images/Padisarah.png"
	},
	"松茸": {
		"id": "松茸",
		"name": "松茸",
		"file": "assets/images/松茸.png"
	},
	"沉玉仙茗": {
		"id": "沉玉仙茗",
		"name": "沉玉仙茗",
		"file": "assets/images/沉玉仙茗.png"
	},
	"青蜜梅": {
		"id": "青蜜梅",
		"name": "青蜜梅",
		"file": "assets/images/青蜜梅.png"
	},
	"苦种": {
		"id": "苦种",
		"name": "苦种",
		"file": "assets/images/苦种.png"
	},
	"清心": {
		"id": "清心",
		"name": "清心",
		"file": "assets/images/清心.png"
	},
	"琉璃袋": {
		"id": "琉璃袋",
		"name": "琉璃袋",
		"file": "assets/images/琉璃袋.png"
	},
	"蟹黃": {
		"id": "蟹黃",
		"name": "蟹黃",
		"file": "assets/images/蟹黃.png"
	},
	"crab": {
		"id": "crab",
		"name": "螃蟹",
		"file": "assets/images/crab.png"
	},
	"tidalga": {
		"id": "tidalga",
		"name": "汐藻",
		"file": "assets/images/tidalga.png"
	}
	// // 參考
	// ,
	// "新食材": {
	// 	"id": "新食材",
	// 	"name": "新食材",
	// 	"file": "assets/images/新食材.png"
	// }
};

const translationList = {};

const enableFoods = new Set([]);

const othrtRo = {
	"buy": {
		"name": "购买按钮",
		"file": "assets/images/buyBtn.png"
	}
}

// ==================== 新增函数：判断是否是刷新日 ====================

function isRefreshDay() {
	// 1. 计算基准刷新时间的 UTC 毫秒值
	//    2025-08-09 04:00 (GMT+8) == 2025-08-08 20:00Z
	const baseUtcMs = Date.UTC(2025, 7, 8, 20, 0, 0);

	// 2. 获取当前时间的 UTC 毫秒
	const now = new Date();
	const utcNowMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;

	// 3. 构造 GMT+8 的时间对象
	const gmt8Ms = utcNowMs + 8 * 60 * 60 * 1000;
	const gmt8Date = new Date(gmt8Ms);

	// 4. 如果还没到“当天”凌晨 4 点，算作前一天
	if (gmt8Date.getHours() < 4) {
		gmt8Date.setDate(gmt8Date.getDate() - 1);
		// 加12小時，避免常作前一天0:0至4:0
		gmt8Date.setTime(gmt8Date.getTime() + 12 * 60 * 60 * 1000);
	}

	// 5. 计算天数差并判断是否为 3 的倍数
	const daysDiff = Math.floor((gmt8Date.getTime() - baseUtcMs) / (24 * 60 * 60 * 1000));
	return daysDiff >= 0 && daysDiff % 3 === 0;
}

// 获取游戏内时间（考虑4点刷新）
function getGameTime() {
	const now = new Date();
	const utcNowMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
	const gmt8Ms = utcNowMs + 8 * 60 * 60 * 1000;
	const gmt8Date = new Date(gmt8Ms);

	// 如果还没到凌晨4点，算作前一天
	if (gmt8Date.getHours() < 4) {
		gmt8Date.setDate(gmt8Date.getDate() - 1);
	}

	return gmt8Date;
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
async function nextFoodsPage() {
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
	for (let i = 0; i < count; i++) {
		keyPress("VK_F");
		await sleep(1300);
	}
}

// 购买逻辑
async function buyFoods(npcName) {
	// 设置脚本环境的游戏分辨率和DPI缩放
	setGameMetrics(3840, 2160, 1.5);

	let tempFoods = [...npcData[npcName].enableFoods];

	// 多页购买
	for (let i = 0; i < npcData[npcName].page; i++) {
		log.info("购买列表: {foods}", [...tempFoods].join(", "));

		// 获取一张截图
		let captureRegion = captureGameRegion();

		// 记录已经购买的物品
		let boughtFoods = new Set([]);

		// 匹配商品
		for (let item of tempFoods) {
			let resList = captureRegion.FindMulti(foodsData[item].ro);
			for (let res of resList) {
				log.info("找到物品: {i} 位置({x},{y},{h},{w})", foodsData[item].name, res.x, res.y, res.width, res.height);
				// 移除已购买的物品
				boughtFoods.add(item);
				// 点击商品
				click(res.x * 2 + res.width, res.y * 2 + res.height);
				if (await qucikBuy()) {
					log.info("购买成功: {item}", foodsData[item].name);
					await sleep(1000);
					// 重新截图
					captureRegion = captureGameRegion();
				}
				else {
					log.info("购买失败: {item}, 背包已经满或商品已售罄", foodsData[item].name);
				}
			}
		}

		// 从已购买物品中移除
		tempFoods = tempFoods.filter(item => !boughtFoods.has(item));


		// 若不是最后一页且还有未购买的物品
		if (tempFoods.length > 0 && i !== npcData[npcName].page - 1) {
			log.info("切换到下一页商品");
			await nextFoodsPage();

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
	// 获取游戏内时间（考虑4点刷新）
	const gameTime = getGameTime();
	const gameDay = gameTime.getDay(); // 游戏内的星期几（0-6）

	// log.info(`游戏内时间: ${gameTime}, 星期: ${gameDay}, 用户选择的购买日: ${AFKDay}`);

	for (let [key, npc] of Object.entries(npcData)) {

		// 翻译物品名称
		let npcFoods = new Set([]);

		// 添加每天刷新周期的商品（如果存在）
		if (npc._1d_foods && npc._1d_foods.length > 0) {
			npc._1d_foods.forEach(item => {
				npcFoods.add(translationList[item]);
			});
		}

		// ==================== 检查是否是刷新日 ====================
		if (isRefreshDay()) {
			// 添加3天刷新周期的商品（如果存在）
			if (npc._3d_foods && npc._3d_foods.length > 0) {
				npc._3d_foods.forEach(item => {
					npcFoods.add(translationList[item]);
				});
			}
		}

		// ==================== 检查是否是用户选择的购买日 ====================
		if (gameDay === AFKDay) {
			// 添加7天刷新周期的商品（如果存在）
			if (npc._7d_foods && npc._7d_foods.length > 0) {
				npc._7d_foods.forEach(item => {
					npcFoods.add(translationList[item]);
				});
			}
		}

		// 筛选已启用的商品
		npc.enableFoods = [...enableFoods].filter(item => npcFoods.has(item));

		// 如果没有启用的商品, 则不启用该NPC
		if (npc.enableFoods.length === 0) {
			npc.enable = false;
		}
	}
}

// 加载识别对象
async function initRo() {
	try {
		// 加载识别对象
		for (let [key, item] of Object.entries(foodsData)) {
			// 填充中英文对照表
			translationList[item.name] = item.id;
			// 判断启动商品、加载识别对象
			if (settings[item.id]) {
				enableFoods.add(item.id);
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
			await buyFoods(key);
			// 返回主界面
			await genshin.returnMainUi();
			log.info("完成购买NPC: {npcName}", npc.name);
		}
		else {
			log.info("跳过未启用的NPC: {npcName}", npc.name);
		}
	}
})();