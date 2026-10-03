const ArtifactsButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ArtifactsButton.png"));
const DeleteButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DeleteButton.png"));
const AutoAddButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/AutoAddButton.png"));
const ConfirmButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/ConfirmButton.png"));
const DestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DestoryButton.png"));
const MidDestoryButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/DestoryButton.png"), 900, 600, 500, 300);

/**
 * @returns {Promise<void>}
 */

(async function () {
	await genshin.returnMainUi();
	let mora1 = 0;
	if (settings.moraDiff) {
		mora1 = await canCanNeed();
	}
	await genshin.returnMainUi();
	keyPress("B");
	await sleep(1500);

	const ro1 = captureGameRegion();
	let ArtifactsButton = ro1.find(ArtifactsButtonRo);
	ro1.dispose();
	if (ArtifactsButton.isExist()) {
		log.info("识别到圣遗物按钮");
		ArtifactsButton.click();
		await sleep(1500);
	}

	//计算摧毁次数 
	if (settings.number > 21) {
		times = Math.ceil(settings.number / 100)
	} else if (settings.number <= 21) {
		times = settings.number
	} else {
		times = 1
	}
	try {
		for (let i = 0; i < times; i++) {
			const ro2 = captureGameRegion();
			ro2.find(DeleteButtonRo).click();// 点击摧毁
			ro2.dispose();
			await sleep(600);
			const ro3 = captureGameRegion();
			ro3.find(AutoAddButtonRo).click();// 点击自动添加
			ro3.dispose();
			await sleep(600);

			if (settings.oneStar) {
				await sleep(300);
				click(150, 150);
			}
			if (settings.twoStar) {
				await sleep(300);
				click(150, 220);
			}
			if (settings.threeStar) {
				await sleep(300);
				click(150, 300);
			}
			if (settings.fourStar) {
				await sleep(300);
				click(150, 370);
			}

			const ro4 = captureGameRegion();
			ro4.find(ConfirmButtonRo).click();// 点击快捷放入
			ro4.dispose();
			await sleep(600);
			const ro5 = captureGameRegion();
			ro5.find(DestoryButtonRo).click();// 点击摧毁
			ro5.dispose();
			await sleep(600);
			const ro6 = captureGameRegion();
			ro6.find(MidDestoryButtonRo).click();// 弹出页面点击摧毁
			ro6.dispose();
			await sleep(600);
			click(960, 1000);// 点击空白处
			await sleep(1000);
		}
	} catch (ex) {
		log.info("背包里的圣遗物已摧毁完毕，提前结束")
	} finally {
		await genshin.returnMainUi();
	}

	let mora2 = 0;
	if (settings.moraDiff) {
		mora2 = await canCanNeed();
		let moraDiff = mora2 - mora1;
		log.info(`分解获得摩拉数量：${moraDiff}`)
		notification.send(`分解获得摩拉数量：${moraDiff}`);
	}

})();

async function canCanNeed() {
	let tryTimes = 0;
	let moraRes = -1;
	while ((tryTimes < 2) && (moraRes < 0)) {
		await genshin.returnMainUi();
		await sleep(100);
		keyPress("B");

		await sleep(1000);
		//切换到贵重物品
		const gzwpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/贵重物品.png"));
		const gzwpRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/贵重物品2.png"));
		let trys = 0;
		while (trys < 10) {
			trys++
			let res1 = await findAndClick(gzwpRo, 1);
			let res2 = await findAndClick(gzwpRo2, 2);
			if (res1 || res2) {
				break;
			}
		}
		await sleep(1000);
		if (moraRes < 0) {
			const moraRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Mora.png"), 0, 970, 600, 1080 - 970);
			const gameRegion = captureGameRegion();
			let moraX = 336;
			let moraY = 1004;
			try {
				const result = gameRegion.find(moraRo);
				if (result.isExist()) {
					moraX = result.x;
					moraY = result.y;
				}
			} catch (err) {
			} finally {
				gameRegion.dispose();
			}
			let attempts = 0;
			while (moraRes < 0 && attempts < 5) {
				attempts++;
				moraRes = await numberTemplateMatch("Assets/背包摩拉数字", moraX, moraY, 300, 40, 0.95, 0.85, 10);
			}
			if (moraRes >= 0) {
				log.info(`成功识别到摩拉数值: ${moraRes}`);
			} else {
				log.warn("未能识别到摩拉数值。");
			}
		}
		await sleep(500);
		tryTimes++;
	}
	return moraRes;
}

/**
 * 在指定区域内，用 0-9 的 PNG 模板做「多阈值 + 非极大抑制」数字识别，
 * 最终把检测到的数字按左右顺序拼成一个整数返回。
 *
 * @param {string}  numberPngFilePath - 存放 0.png ~ 9.png 的文件夹路径（不含文件名）
 * @param {number}  x                 - 待识别区域的左上角 x 坐标，默认 0
 * @param {number}  y                 - 待识别区域的左上角 y 坐标，默认 0
 * @param {number}  w                 - 待识别区域的宽度，默认 1920
 * @param {number}  h                 - 待识别区域的高度，默认 1080
 * @param {number}  maxThreshold      - 模板匹配起始阈值，默认 0.95（最高可信度）
 * @param {number}  minThreshold      - 模板匹配最低阈值，默认 0.8（最低可信度）
 * @param {number}  splitCount        - 在 maxThreshold 与 minThreshold 之间做几次等间隔阈值递减，默认 3
 * @param {number}  maxOverlap        - 非极大抑制时允许的最大重叠像素，默认 2；只要 x 或 y 方向重叠大于该值即视为重复框
 *
 * @returns {number} 识别出的整数；若没有任何有效数字框则返回 -1
 *
 * @example
 * const mora = await numberTemplateMatch('摩拉数字', 860, 70, 200, 40);
 * if (mora >= 0) console.log(`当前摩拉：${mora}`);
 */
async function numberTemplateMatch(
	numberPngFilePath,
	x = 0, y = 0, w = 1920, h = 1080,
	maxThreshold = 0.95,
	minThreshold = 0.87,
	splitCount = 10,
	maxOverlap = 2
) {
	let ros = [];
	for (let i = 0; i <= 9; i++) {
		ros[i] = RecognitionObject.TemplateMatch(
			file.ReadImageMatSync(`${numberPngFilePath}/${i}.png`), x, y, w, h);
	}

	function setThreshold(roArr, newThreshold) {
		for (let i = 0; i < roArr.length; i++) {
			roArr[i].Threshold = newThreshold;
			roArr[i].InitTemplate();
		}
	}

	const gameRegion = captureGameRegion();
	const allCandidates = [];

	/* 1. splitCount 次等间隔阈值递减 */
	for (let k = 0; k < splitCount; k++) {
		const curThr = maxThreshold - (maxThreshold - minThreshold) * k / Math.max(splitCount - 1, 1);
		setThreshold(ros, curThr);

		/* 2. 0-9 每个模板跑一遍，所有框都收 */
		for (let digit = 0; digit <= 9; digit++) {
			const res = gameRegion.findMulti(ros[digit]);
			if (res.count === 0) continue;

			for (let i = 0; i < res.count; i++) {
				const box = res[i];
				allCandidates.push({
					digit: digit,
					x: box.x,
					y: box.y,
					w: box.width,
					h: box.height,
					thr: curThr
				});
			}
		}

	}
	gameRegion.dispose();

	/* 3. 无结果提前返回 -1 */
	if (allCandidates.length === 0) {
		return -1;
	}

	/* 4. 非极大抑制（必须 x、y 两个方向重叠都 > maxOverlap 才视为重复） */
	const adopted = [];
	for (const c of allCandidates) {
		let overlap = false;
		for (const a of adopted) {
			const xOverlap = Math.max(0, Math.min(c.x + c.w, a.x + a.w) - Math.max(c.x, a.x));
			const yOverlap = Math.max(0, Math.min(c.y + c.h, a.y + a.h) - Math.max(c.y, a.y));
			if (xOverlap > maxOverlap && yOverlap > maxOverlap) {
				overlap = true;
				break;
			}
		}
		if (!overlap) {
			adopted.push(c);
			//log.info(`在 [${c.x},${c.y},${c.w},${c.h}] 找到数字 ${c.digit}，匹配阈值=${c.thr}`);
		}
	}

	/* 5. 按 x 排序，拼整数；仍无有效框时返回 -1 */
	if (adopted.length === 0) return -1;
	adopted.sort((a, b) => a.x - b.x);

	return adopted.reduce((num, item) => num * 10 + item.digit, 0);
}

async function findAndClick(target, maxAttempts = 20) {
	for (let attempts = 0; attempts < maxAttempts; attempts++) {
		const gameRegion = captureGameRegion();
		try {
			const result = gameRegion.find(target);
			if (result.isExist) {
				await sleep(50);
				result.click();
				await sleep(50);
				return true;                 // 成功立刻返回
			}
			log.warn(`识别失败，第 ${attempts + 1} 次重试`);
		} catch (err) {
		} finally {
			gameRegion.dispose();
		}
		if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
			await sleep(250);
		}
	}
	return false;
}