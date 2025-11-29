// fakeLog 函数，使用方法：将本函数放在主函数前,调用时请务必使用await，否则可能出现v8白框报错
//在js开头处伪造该js结束运行的日志信息，如 await fakeLog("js脚本", true, true, 0);
//在js结尾处伪造该js开始运行的日志信息，如 await fakeLog("js脚本", true, false, 2333);
//duration项目仅在伪造结束信息时有效，且无实际作用，可以任意填写，当你需要在日志中输出特定值时才需要，单位为毫秒
//在调用地图追踪前伪造该地图追踪开始运行的日志信息，如 await fakeLog(`地图追踪.json`, false, true, 0);
//在调用地图追踪后伪造该地图追踪结束运行的日志信息，如 await fakeLog(`地图追踪.json`, false, false, 0);
//如此便可以在js运行过程中伪造地图追踪的日志信息，可以在日志分析等中查看
// name: 字符串，表示脚本或地图追踪的名称
// isJs: 布尔值，true表示脚本，false表示地图追踪
// isStart: 布尔值，true表示开始日志，false表示结束日志
// duration: 整数，表示脚本或地图追踪的运行时间（仅在结束日志时使用），单位为毫秒＿基本填０即可
// 示例:
// JS腳本開始
// await fakeLog("js脚本名", true, true, 0);
// JS腳本結束
// await fakeLog("js脚本名", true, false, 0);
// 地图追踪开始
// await fakeLog("地图追踪名", false, true, 0);
// 地图追踪结束
// await fakeLog("地图追踪名", false, false, 0);
// 交互或拾取："XXXX"
// await fakeLog("XXXX", false, false, 9527);

async function fakeLog(name, isJs, isStart, duration) {
	await sleep(10);
	const currentTime = Date.now();
	// 参数检查
	if (typeof name !== 'string') {
		log.error("参数 'name' 必须是字符串类型！");
		return;
	}
	if (typeof isJs !== 'boolean') {
		log.error("参数 'isJs' 必须是布尔型！");
		return;
	}
	if (typeof isStart !== 'boolean') {
		log.error("参数 'isStart' 必须是布尔型！");
		return;
	}
	if (typeof currentTime !== 'number' || !Number.isInteger(currentTime)) {
		log.error("参数 'currentTime' 必须是整数！");
		return;
	}
	if (typeof duration !== 'number' || !Number.isInteger(duration)) {
		log.error("参数 'duration' 必须是整数！");
		return;
	}



	// 将 currentTime 转换为 Date 对象并格式化为 HH:mm:ss.sss
	const date = new Date(currentTime);
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
	const formattedTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

	// 将 duration 转换为分钟和秒，并保留三位小数
	const durationInSeconds = duration / 1000; // 转换为秒
	const durationMinutes = Math.floor(durationInSeconds / 60);
	const durationSeconds = (durationInSeconds % 60).toFixed(3); // 保留三位小数

	// 使用四个独立的 if 语句处理四种情况
	if (isJs && isStart) {
		// 处理 isJs = true 且 isStart = true 的情况
		const logMessage = `正在伪造js开始的日志记录\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`------------------------------\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`→ 开始执行JS脚本: "${name}"`;
		log.debug(logMessage);
	}
	if (isJs && !isStart) {
		// 处理 isJs = true 且 isStart = false 的情况
		const logMessage = `正在伪造js结束的日志记录\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`------------------------------`;
		log.debug(logMessage);
	}
	if (!isJs && isStart) {
		// 处理 isJs = false 且 isStart = true 的情况
		const logMessage = `正在伪造地图追踪开始的日志记录\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`------------------------------\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`→ 开始执行地图追踪任务: "${name}"`;
		log.debug(logMessage);
	}
	if (!isJs && !isStart) {
		// 处理 isJs = false 且 isStart = false 的情况
		const logMessage = `正在伪造地图追踪结束的日志记录\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`→ 脚本执行结束: "${name}", 耗时: ${durationMinutes}分${durationSeconds}秒\n\n` +
			`[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
			`------------------------------`;
		log.debug(logMessage);
	}
	// 交互或拾取："XXXX"
	if (duration == 9527) {
		// const logMessage = `正在 交互或拾取 的日志记录\n\n` +
		//     `[${formattedTime}] [INF] BetterGenshinImpact.Service.ScriptService\n` +
		//     `------------------------------\n\n` +
		//     `[${formattedTime}] [INF] BetterGenshinImpact.Service.AutoPick.AutoPickTrigger\n` +
		//     `交互或拾取："${name}"`;
		// log.debug(logMessage);
		log.info(`交互或拾取："${name}"`);
	}

}

const AFK = parseInt(settings.AKF) || 1; // 从settings读取用户选择的购买日
const AFKDay = AFK === 7 ? 0 : AFK; // 将7转换为0（周日）

const npcData = {
	"神奇的霍普金斯": {
		"name": "神奇的霍普金斯",
		"enable": true,
		"page": 2,
		"time": "day",
		"path": "assets/path/神奇的霍普金斯.json",
		"_1d_foods": ["圣水"]
	},
	"Blanche": {
		"name": "布兰琪",
		"enable": true,
		"page": 2,
		"time": "night",
		"path": "assets/path/布兰琪.json",
		"_1d_foods": ["盐", "胡椒", "洋葱", "牛奶", "番茄", "卷心菜", "土豆", "小麦"]
	},
	"莎拉": {
		"name": "莎拉",
		"enable": true,
		"page": 4,
		"time": "night",
		"path": "assets/path/莎拉.json",
		"_7d_foods": ["蟹黃"]
	},
	"DongSheng": {
		"name": "东升",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/东升.json",
		"_1d_foods": ["洋葱", "牛奶", "卷心菜", "土豆", "小麦", "稻米", "虾仁", "豆腐", "杏仁", "盐", "胡椒", "番茄"]
	},
	"ChefMao": {
		"name": "香菱爹",
		"enable": true,
		"page": 5,
		"time": "any",
		"path": "assets/path/卯师父.json",
		"_1d_foods": ["鱼肉", "螃蟹"],
		"_3d_foods": ["胡梦卜", "松茸", "絶云椒椒"]
	},
	"UncleSun": {
		"name": "奸商老孙",
		"enable": true,
		"page": 1,
		"time": "day",
		"path": "assets/path/老孙.json",
		"_1d_foods": ["鱼肉", "螃蟹", "虾仁"],
	},
	"UncleGao": {
		"name": "奸商老高",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/老高.json",
		"_1d_foods": ["鱼肉"]
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
		"_3d_foods": ["沉玉仙茗", "琉璃袋", "絶云椒椒"],
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
	"Aoi": {
		"name": "葵",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/葵.json",
		"_1d_foods": ["洋葱", "牛奶", "卷心菜", "土豆", "小麦", "稻米", "虾仁", "豆腐", "盐", "胡椒", "番茄"]
	},
	"ShimuraKanbei": {
		"name": "志村勘兵卫",
		"enable": true,
		"page": 4,
		"time": "any",
		"path": "assets/path/志村勘兵卫.json",
		"_1d_foods": ["鱼肉", "螃蟹"],
		"_3d_foods": ["堇瓜"]
	},
	"清子": {
		"name": "清子",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/稻妻-海祇岛-清子.json",
		"_7d_foods": ["牛奶", "番茄", "土豆", "小麦", "豆腐"]
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
		"_1d_foods": ["鱼肉", "螃蟹", "虾仁"],

	},
	"Pam": {
		"name": "珀姆",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/珀姆.json",
		"_1d_foods": ["鱼肉", "螃蟹", "虾仁"],

	},
	"Hamawi": {
		"name": "哈马维",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/哈马维.json",
		"_1d_foods": ["洋葱", "牛奶", "卷心菜", "土豆", "小麦", "稻米", "虾仁", "豆腐", "盐", "胡椒", "番茄"]
	},
	"Lambad": {
		"name": "兰巴德",
		"enable": true,
		"page": 3,
		"time": "any",
		"path": "assets/path/兰巴德.json",
		"_1d_foods": ["鱼肉", "螃蟹"],
	},
	"Enteka": {
		"name": "恩忒卡",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/恩忒卡.json",
		"_1d_foods": ["咖啡豆"]
	}
	,
	"Azalai": {
		"name": "阿扎莱",
		"enable": false,
		"page": 2,
		"time": "night",
		"path": "assets/path/阿扎莱.json",
		"_1d_foods": ["鱼肉", "兽肉", "秃秃豆"]
	},
	"巴巴克": {
		"name": "巴巴克",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/巴巴克.json",
		"_3d_foods": ["清心", "琉璃袋"]
	},
	"Boucicaut": {
		"name": "布希柯",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/布希柯.json",
		"_1d_foods": ["枫达", "洋葱", "牛奶", "卷心菜", "土豆", "小麦", "秃秃豆", "杏仁", "发酵果实汁", "盐", "胡椒", "番茄"]
	},
	"Arouet": {
		"name": "阿鲁埃",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/阿鲁埃.json",
		"_1d_foods": ["咖啡豆", "枫达"]
	},
	"Antman": {
		"name": "安特曼",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/安特曼.json",
		"_1d_foods": ["鱼肉", "螃蟹"],
		"_3d_foods": ["海露花", "汐藻"]
	},
	"皮托": {
		"name": "皮托",
		"enable": true,
		"page": 1,
		"time": "any",
		"path": "assets/path/枫丹-锈坨-皮托.json",
		"_1d_foods": ["牛奶"],
		"_7d_foods": ["培根", "火腿", "香肠", "奶酪"]
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
	},
	"Bunama": {
		"name": "布纳马",
		"enable": true,
		"page": 2,
		"time": "any",
		"path": "assets/path/布纳马.json",
		"_1d_foods": ["盐", "胡椒", "小麦", "洋葱", "牛奶", "番茄", "卷心菜", "土豆", "秃秃豆"]
	}
	,
	"采若": {	// NPC名字
		"name": "采若",	// NPC名字	
		"enable": true,
		"page": 3,	// 商人卖的物品页数
		"time": "any",	//any 不调时间,day 早上8点, night 晚上8点
		"path": "assets/path/挪德卡莱-杂货铺-采若.json", //写入 卖食物NPC路径名
		"_1d_foods": ["黑麦", "盐", "胡椒", "洋葱", "牛奶", "番茄", "卷心菜", "土豆", "小麦"]// 写入 新加入 的 食材名字
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
	},
	"圣水": {
		"id": "圣水",
		"name": "圣水",
		"file": "assets/images/圣水.png"
	},
	"黑麦": {
		"id": "黑麦",
		"name": "黑麦",
		"file": "assets/images/黑麦.png"
	}
	,
	"絶云椒椒": {
		"id": "絶云椒椒",
		"name": "絶云椒椒",
		"file": "assets/images/絶云椒椒.png"
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

	await sleep(200);
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
	captureRegion.dispose();
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
		// 设置脚本环境的游戏分辨率和DPI缩放
		setGameMetrics(1920, 1080, 1);

		await sleep(1000);
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
		keyPress("VK_F");
		await sleep(1500);
	} else {
		for (let i = 0; i < count; i++) {
			keyPress("VK_F");
			await sleep(1300);
		}
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
		await sleep(500);
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
					// 交互或拾取："XXXX"
					await fakeLog(foodsData[item].name, false, false, 9527);
					await sleep(2000);
					// 重新截图
					captureRegion = captureGameRegion();
				}
				else {
					log.info("购买失败: {item}, 背包已经满或商品已售罄", foodsData[item].name);
				}
			}
		}

		captureRegion.dispose();
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

	try {
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
				// log.info("开始购买NPC: {npcName}", npc.name);
				// 地图追踪开始
				await fakeLog(npc.name, false, true, 0);
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
				// 偽造日志任務結東
				await fakeLog(npc.name, false, false, 0);
			}
			else {
				log.info("跳过未启用的NPC: {npcName}", npc.name);
			}
		}
	} catch (error) {
		log.error(`执行时时发生错误`);
		log.error(error.message);
	}
})();