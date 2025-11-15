let userName = settings.userName || "默认账户";
(async function () {
    // 定义一个函数用于模拟按键操作
    async function simulateKeyOperations(key, duration) {
        keyDown(key);
        await sleep(duration);
        keyUp(key);
        await sleep(500); // 释放按键后等待 500 毫秒
    }

    // 检验账户名
    async function getUserName() {
        userName = userName.trim();
    //数字，中英文，长度在20个字符以内
        if (!userName || !/^[\u4e00-\u9fa5A-Za-z0-9]{1,20}$/.test(userName)) {
            log.error(`账户名${userName}违规，暂时使用默认账户名，请查看readme后修改`)
            userName = "默认账户";
        }
        return userName;
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
	await sleep(2000);
	await genshin.returnMainUi();
    }

    /**
     * 判断任务是否已刷新
     * @param {string} filePath - 存储最后完成时间的文件路径
     * @param {object} options - 配置选项
     * @param {string} [options.refreshType] - 刷新类型: 'hourly'|'daily'|'weekly'|'monthly'|'custom'
     * @param {number} [options.customHours] - 自定义小时数(用于'custom'类型)
     * @param {number} [options.dailyHour=4] - 每日刷新的小时(0-23)
     * @param {number} [options.weeklyDay=1] - 每周刷新的星期(0-6, 0是周日)
     * @param {number} [options.weeklyHour=4] - 每周刷新的小时(0-23)
     * @param {number} [options.monthlyDay=1] - 每月刷新的日期(1-31)
     * @param {number} [options.monthlyHour=4] - 每月刷新的小时(0-23)
     * @returns {Promise<boolean>} - 是否已刷新
     */
    async function isTaskRefreshed(filePath, options = {}) {
        const {
            refreshType = 'hourly', // 默认每小时刷新
            customHours = 24,       // 自定义刷新小时数默认24
            dailyHour = 4,          // 每日刷新默认凌晨4点
            weeklyDay = 1,          // 每周刷新默认周一(0是周日)
            weeklyHour = 4,         // 每周刷新默认凌晨4点
            monthlyDay = 1,         // 每月刷新默认第1天
            monthlyHour = 4          // 每月刷新默认凌晨4点
        } = options;

        try {
            // 读取文件内容
            let content = await file.readText(filePath);
            const lastTime = new Date(content);
            const nowTime = new Date();


            let shouldRefresh = false;


            switch (refreshType) {
                case 'hourly': // 每小时刷新
                    shouldRefresh = (nowTime - lastTime) >= 3600 * 1000;
                    break;

                case 'daily': // 每天固定时间刷新
                    // 检查是否已经过了当天的刷新时间
                    const todayRefresh = new Date(nowTime);
                    todayRefresh.setHours(dailyHour, 0, 0, 0);

                    // 如果当前时间已经过了今天的刷新时间，检查上次完成时间是否在今天刷新之前
                    if (nowTime >= todayRefresh) {
                        shouldRefresh = lastTime < todayRefresh;
                    } else {
                        // 否则检查上次完成时间是否在昨天刷新之前
                        const yesterdayRefresh = new Date(todayRefresh);
                        yesterdayRefresh.setDate(yesterdayRefresh.getDate() - 1);
                        shouldRefresh = lastTime < yesterdayRefresh;
                    }
                    break;

                case 'weekly': // 每周固定时间刷新
                    // 获取本周的刷新时间
                    const thisWeekRefresh = new Date(nowTime);
                    // 计算与本周指定星期几的差值
                    const dayDiff = (thisWeekRefresh.getDay() - weeklyDay + 7) % 7;
                    thisWeekRefresh.setDate(thisWeekRefresh.getDate() - dayDiff);
                    thisWeekRefresh.setHours(weeklyHour, 0, 0, 0);

                    // 如果当前时间已经过了本周的刷新时间
                    if (nowTime >= thisWeekRefresh) {
                        shouldRefresh = lastTime < thisWeekRefresh;
                    } else {
                        // 否则检查上次完成时间是否在上周刷新之前
                        const lastWeekRefresh = new Date(thisWeekRefresh);
                        lastWeekRefresh.setDate(lastWeekRefresh.getDate() - 7);
                        shouldRefresh = lastTime < lastWeekRefresh;
                    }
                    break;

                case 'monthly': // 每月固定时间刷新
                    // 获取本月的刷新时间
                    const thisMonthRefresh = new Date(nowTime);
                    // 设置为本月指定日期的凌晨
                    thisMonthRefresh.setDate(monthlyDay);
                    thisMonthRefresh.setHours(monthlyHour, 0, 0, 0);

                    // 如果当前时间已经过了本月的刷新时间
                    if (nowTime >= thisMonthRefresh) {
                        shouldRefresh = lastTime < thisMonthRefresh;
                    } else {
                        // 否则检查上次完成时间是否在上月刷新之前
                        const lastMonthRefresh = new Date(thisMonthRefresh);
                        lastMonthRefresh.setMonth(lastMonthRefresh.getMonth() - 1);
                        shouldRefresh = lastTime < lastMonthRefresh;
                    }
                    break;

                case 'custom': // 自定义小时数刷新
                    shouldRefresh = (nowTime - lastTime) >= customHours * 3600 * 1000;
                    break;

                default:
                    throw new Error(`未知的刷新类型: ${refreshType}`);
            }

            // 如果文件内容无效或不存在，视为需要刷新
            if (!content || isNaN(lastTime.getTime())) {
                await file.writeText(filePath, '');
                shouldRefresh = true;
            }

            if (shouldRefresh) {
                notification.send(`购买狗粮已经刷新，执行脚本`);


                return true;
            } else {
                log.info(`购买狗粮未刷新`);
                return false;
            }

        } catch (error) {
            // 如果文件不存在，创建新文件并返回true(视为需要刷新)
            const createResult = await file.writeText(filePath, '');
            if (createResult) {
                log.info("创建新时间记录文件成功，执行脚本");
                return true;
            }
            else throw new Error(`创建新文件失败`);
        }
    }

    // 购买圣遗物
    async function purChase(locationName) {
        // 寻路
        log.info(`加载路径文件: ${locationName}`);
        let filePath = `assets/Pathing/${locationName}.json`;
        await pathingScript.runFile(filePath);
        await sleep(1000);

        // 定义模板
        let fDialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/F_Dialogue.png"), 1050, 400, 100, 400);
        let shopDialogueRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/Shopping.png"), 1259, 540, 100, 400);
        let shopDialogueRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/Shopping2.png"), 0, 0, 150, 100);
        let conFirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Picture/Confirm.png"), 1585, 1005, 31, 31);

        // 定义一个函数识别并交互 NPC
        async function checkFAlignment(fDialogueRo) {
            let ra = captureGameRegion();
            let fRes = ra.find(fDialogueRo);
            ra.dispose();
            if (!fRes.isExist()) {
                let f_attempts = null; // 初始化尝试次数
                while (f_attempts < 6) { // 最多尝试 5 次
                    f_attempts++;
                    log.info(`当前尝试次数：${f_attempts}`);
                    if (f_attempts <= 3) {
                        // 第 1-3 次尝试
                        await simulateKeyOperations("S", 200); // 后退 200 毫秒
                        await sleep(200);
                        await simulateKeyOperations("W", 400); // 前进 400 毫秒
                        await sleep(500);
                    } else if (f_attempts <= 5) {
                        // 第 4-5 次尝试
                        log.info("重新加载路径文件");
                        await pathingScript.runFile(filePath);
                        await sleep(500);
                    } else {
                        // 第 6 次尝试，尝试次数已达上限
                        log.warn("尝试次数已达上限");
                        break; // 找到后退出循环
                    }

                    // 检查是否找到 F 图标
                    ra = captureGameRegion();
                    fRes = ra.find(fDialogueRo); // 重新查找 F 图标
                    ra.dispose();
                    if (fRes.isExist()) {
                        log.info("找到 F 图标");
                        break; // 找到后退出循环
                    }
                    log.warn(`尝试 ${f_attempts}：寻找 F 图标`);
                }

                // 如果尝试次数用完仍未找到 F 图标，返回 false
                if (!fRes.isExist()) {
                    log.warn("经过多次尝试后仍未找到 F 图标");
                    return false;
                }
            }
            return true
        }
        let isAligned = await checkFAlignment(fDialogueRo);
        if(isAligned){
            // 进入对话选项
            for (let i = 0; i < 5; i++) {
                // 最多 F 5次
                let captureRegion = captureGameRegion();  // 获取一张截图
                let res = captureRegion.Find(shopDialogueRo);
                captureRegion.dispose();
                if (res.isEmpty()) {
                  keyPress("F");
                  await sleep(1000);
                } else {
                  res.click();
                  log.info("已到达对话选项界面，点击商店图标({x},{y},{h},{w})", res.x, res.y, res.width, res.Height);
                  break;
                }
                await sleep(500);
            }
            // 进入商店界面
            for (let i = 0; i < 5; i++) {
                // 最多 F 5次
                let captureRegion = captureGameRegion();  // 获取一张截图
                let res = captureRegion.Find(shopDialogueRo2);
                captureRegion.dispose();
                if (res.isEmpty()) {
                  keyPress("F");
                  await sleep(1000);
                } else {
                  log.info("已到达商店界面");
                  break;
                }
                await sleep(500);
            }
            if (locationName=='稻妻购买狗粮'){
                click(200, 400); await sleep(500); // 选择狗粮
            }
            // 购买狗粮
            for (let i = 0; i < 5; i++) {
                // 最多购买5次
                let captureRegion = captureGameRegion();  // 获取一张截图
                let res = captureRegion.Find(conFirmRo);
                captureRegion.dispose();
                if (res.isEmpty()) {
                    log.info('圣遗物已售罄');
                    break;
                }else{
                    // 识别到购买标识，模拟购买操作的后续点击
                    await click(1600, 1020);
                    await sleep(1000); // 购买
                    await click(1320, 780);
                    await sleep(1000); // 最终确认
                    await click(1320, 780);
                    await sleep(1000); // 点击空白
                }
                await sleep(500);
            }
            await genshin.returnMainUi();
        }
    }

    async function main() {
    await genshin.returnMainUi();
    if(settings.select1){
    await purChase('蒙德购买狗粮');
    }

    if(settings.select2){
    await purChase('璃月购买狗粮1');
    }

    if(settings.select3){
    await setTime(19,00)
    await purChase('璃月购买狗粮2');
    }

    if(settings.select4){
    await purChase('稻妻购买狗粮');
       }
    if(settings.select5){
    await purChase('须弥购买狗粮');
    }

    if(settings.select6){
    await purChase('枫丹购买狗粮');
    }

    if(settings.select7){
    await purChase('纳塔购买狗粮');
    }

    if(settings.select8){
    await purChase('挪德卡莱购买狗粮');
    }

    await file.writeText(recordPath, new Date().toISOString());
}

    userName = await getUserName();
    const recordPath = `assets/${userName}.txt`;
    //每周四4点刷新
    if( await isTaskRefreshed(recordPath, {
        refreshType: 'weekly',
        weeklyDay: 4, // 周四
        weeklyHour: 4 // 凌晨4点
    })|| settings.select9){
    await main();
    }
})();
