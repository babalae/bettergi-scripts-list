const repeatOperationUntilTextFound = async ({
    //默认区域为单个F图标右边的文字，最多6个
    x = 1210,
    y = 515,
    width = 200,
    height = 50,
    targetText = null,
    maxSteps = 100,
    stepDuration = 200,
    waitTime = 10,
    moveKey = "w",
    ifClick = false,
} = {}) => {
    /**
     * 转义正则表达式中的特殊字符
     * @param {string} string 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // 预编译正则表达式（如果是字符串则转换并转义）
    const textPattern = typeof targetText === 'string' 
        ? new RegExp(escapeRegExp(targetText)) 
        : targetText;
    
    let stepsTaken = 0;
    
    while (stepsTaken <= maxSteps) {
        // 1. 捕获游戏区域并裁剪出检测区域
        const captureRegion = captureGameRegion();
        const textArea = captureRegion.DeriveCrop(x, y, width, height);
        
        // 2. 执行OCR识别
        const ocrResult = textArea.find(RecognitionObject.ocrThis);
        captureRegion.dispose();
        textArea.dispose();
        
        const hasAnyText = ocrResult.text.trim().length > 0;
        const matchesTarget = targetText === null 
            ? hasAnyText 
            : textPattern.test(ocrResult.text);

        if (matchesTarget) {
            log.info(`检测到${targetText === null ? '文字' : '目标文字'}: ${ocrResult.text}`);
            await sleep(1000);
            if (ifClick) click(Math.round(x + width / 2), Math.round(y + height / 2));
            return true;
        }

        // 4. 检查步数限制
        if (stepsTaken >= maxSteps) {
            throw new Error(`检查次数超过最大限制: ${maxSteps}，未查询到文字"${targetText}"`);
        }
        
        // 5. 前进一小步
        if (stepDuration != 0) {
        keyDown(moveKey);
        await sleep(stepDuration);
        keyUp(moveKey);
        }
        await sleep(waitTime);
        stepsTaken++;
    }
}

// Party Setup
const PanduanRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/panduan.png"),0, 0, 1920, 1080);
const QuickSetupButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Quick Setup Button.png"), 1100, 900, 400, 180);
const ConfigureTeamButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Configure Team Button.png"), 0, 900, 200, 180);
const ConfirmDeployButtonRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Confirm Deploy Button.png"), 0, 900, 1920, 180);
// Slider
const LeftSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 650, 50, 100, 100);
const LeftSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 650, 100, 100, 900);
const MiddleSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 1250, 50, 100, 200);
const MiddleSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 1250, 100, 100, 900);
const RightSliderTopRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Top.png"), 1750, 100, 100, 100);
const RightSliderBottomRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("Assets/RecognitionObject/Slider Bottom.png"), 1750, 100, 100, 900);

(async function () {
	// 翻页
	async function pageDown(SliderBottomRo) {
		let captureRegion = captureGameRegion();
		let SliderBottom = captureRegion.find(SliderBottomRo);
		captureRegion.dispose();
		if (SliderBottom.isExist()) {
			log.info("当前页面已识别&点击完毕，向下滑动");
			// log.info("滑块当前位置:({x},{y},{h},{w})", SliderBottom.x, SliderBottom.y, SliderBottom.Width, SliderBottom.Height);
			click(Math.ceil(SliderBottom.x + SliderBottom.Width / 2), Math.ceil(SliderBottom.y + SliderBottom.Height * 2));
			await moveMouseTo(0, 0);
			await sleep(100);
		}
	}

	//	滑条顶端
	async function pageTop(SliderTopRo) {
		let captureRegion = captureGameRegion();
		let SliderTop = captureRegion.find(SliderTopRo);
		captureRegion.dispose();
		if (SliderTop.isExist()) {
			log.info("识别到滑条顶端位置:({x},{y},{h},{w})", SliderTop.x, SliderTop.y, SliderTop.Width, SliderTop.Height);
			await moveMouseTo(Math.ceil(SliderTop.x + SliderTop.Width / 2), Math.ceil(SliderTop.y + SliderTop.Height * 1));
			leftButtonDown();
			await sleep(1000);
			leftButtonUp();
			await moveMouseTo(0, 0);
			await sleep(100);
		}
	}

	async function waitUntilTemplateFound({
        ro,
        maxRetry = 50,
        interval = 200
    }) {
        for (let i = 0; i < maxRetry; i++) {
            let captureRegion = captureGameRegion();
            let res = captureRegion.find(ro);
            captureRegion.dispose();

            if (res.isExist()) {
                log.info("检测到进入周本，继续执行后续逻辑");
                return true;
            }

            await sleep(interval);
        }

        throw new Error("等待判定模板超时，未识别到进入周本");
    }

	async function goToWeeklyBossAndEnter() {
        // 确保主界面
        await genshin.returnMainUi();
        
		await genshin.tp(9530.678, 6394.4453);
		
		// 等待传送完成
        await sleep(1000);

        // 靠近副本门口，直到可交互
        await repeatOperationUntilTextFound();

        await sleep(500);

        // 打开挑战界面
        keyPress("F");

        await sleep(2000);

        // 等待「单人挑战」按钮出现
        await repeatOperationUntilTextFound({
            x: 1650,
            y: 1000,
            width: 160,
            height: 45,
            targetText: "单人挑战",
            stepDuration: 0,
            waitTime: 100
        });

        // 点击「单人挑战」
        click(1725, 1020);

        await sleep(300);

        // 处理可能出现的提示弹窗
        click(1180, 760);

        // 等待并点击「开始挑战」
        await repeatOperationUntilTextFound({
            x: 1650,
            y: 1000,
            width: 160,
            height: 45,
            targetText: "开始挑战",
            stepDuration: 0,
            waitTime: 100,
            ifClick: true
        });
        log.info(`已进入周本`);
		await sleep(500);

        await waitUntilTemplateFound({
            ro: PanduanRo,
            maxRetry: 60,      // 最多等 60 次
            interval: 200      // 每 200ms 检查一次
        });

		await sleep(2000);
		log.info("开始充能");

        await keyMouseScript.runFile("222.json");

        log.info("充能完成");
    }

	// 切换队伍
	async function SwitchParty(partyName) {
		let ConfigureStatue = false;

		let foundQuickSetup = false;
		for (let j = 0; j < 2; j++) {  // 尝试两次
			keyPress("VK_L");
			await sleep(2000);
			for (let i = 0; i < 2; i++) {
				let captureRegion = captureGameRegion();
				let QuickSetupButton = captureRegion.find(QuickSetupButtonRo);
				captureRegion.dispose();
				if (QuickSetupButton.isExist()) {
					log.info("已进入队伍配置页面");
					foundQuickSetup = true;
					break;
				} else {
					await sleep(1000);
				}
			}
			if (foundQuickSetup) {
				break;  // 第一次找到就退出循环
			}
		}

		if (!foundQuickSetup) {
			log.error("两次尝试都未能进入队伍配置页面");
			return false;
		}
		// 识别当前队伍
		let captureRegion = captureGameRegion();
		let resList = captureRegion.findMulti(RecognitionObject.ocr(100, 900, 300, 180));
		captureRegion.dispose();
		let currentPartyFound = false;

		for (let i = 0; i < resList.count; i++) {
			let res = resList[i];
			log.info("当前队伍名称位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
			if (res.text.includes(partyName)) {
				log.info("当前队伍即为目标队伍，无需切换");
				notification.send(`当前队伍即为目标队伍：${partyName}，无需切换`);
				keyPress("VK_ESCAPE");
				await sleep(500);
				currentPartyFound = true;
				break;
			}
		}
		if (!currentPartyFound) {
			await sleep(1000);
			let captureRegion = captureGameRegion();
			let ConfigureTeamButton = captureRegion.find(ConfigureTeamButtonRo);
			captureRegion.dispose();
			if (ConfigureTeamButton.isExist()) {
				log.info("识别到配置队伍按钮");
				ConfigureTeamButton.click();
				await sleep(500);
				await pageTop(LeftSliderTopRo);

				for (let p = 0; p < 4; p++) {
					// 识别当前页
					let captureRegion = captureGameRegion();
					let resList = captureRegion.findMulti(RecognitionObject.ocr(0, 100, 400, 900));
					captureRegion.dispose();
					for (let i = 0; i < resList.count; i++) {
						let res = resList[i];

						if (res.text.includes(partyName)) {
							log.info("目标队伍位置:({x},{y},{w},{h}), 识别结果：{text}", res.x, res.y, res.Width, res.Height, res.text);
							click(Math.ceil(res.x + 360), res.y + Math.ceil(res.Height / 2));

							// 找到目标队伍，点击确定、部署
							await sleep(1500);
							let ConfirmButtonCaptureRegion = captureGameRegion();
							let ConfirmButton = ConfirmButtonCaptureRegion.find(ConfirmDeployButtonRo);
							ConfirmButtonCaptureRegion.dispose();
							if (ConfirmButton.isExist()) {
								log.info("识别到确定按钮:({x},{y},{w},{h})", ConfirmButton.x, ConfirmButton.y, ConfirmButton.Width, ConfirmButton.Height);
								ConfirmButton.click();
							}
							await sleep(1500);
							let DeployButtonCaptureRegion = captureGameRegion();
							let DeployButton = DeployButtonCaptureRegion.find(ConfirmDeployButtonRo);
							DeployButtonCaptureRegion.dispose();
							if (DeployButton.isExist()) {
								log.info("识别到部署按钮:({x},{y},{w},{h})", DeployButton.x, DeployButton.y, DeployButton.Width, DeployButton.Height);
								DeployButton.click();
								await sleep(100);
								notification.send(`寻找到目标队伍：${partyName}`);
								ConfigureStatue = true;
								break;
							}
						}
					}
					if (ConfigureStatue) {
						await genshin.returnMainUi();
						break;
					} else {
						await pageDown(LeftSliderBottomRo);
					}
				}
				if (!ConfigureStatue) {
					// 没找到指定队伍名称的队伍，抛出异常
					log.error(`没有找到指定队伍名称：${partyName}`);
					notification.error(`没有找到指定队伍名称：${partyName}`);
					await genshin.returnMainUi();
					throw new Error(`没有找到指定队伍名称：${partyName}`);
				}
			} else {	
				await genshin.returnMainUi();
			}
		} else {
			// 当前队伍就是目标队伍，设置成功状态
			ConfigureStatue = true;
		}
		return ConfigureStatue;
	}

	// Main
	if (!!settings.partyName) {
		try {
			log.info("传送到七天神像切换队伍");
			await genshin.TpToStatueOfTheSeven();
				
			log.info("正在尝试切换至" + settings.partyName);
			await SwitchParty(settings.partyName);
			await goToWeeklyBossAndEnter();
			await genshin.TpToStatueOfTheSeven();
			genshin.clearPartyCache();

		} catch (error) {
			log.error("队伍切换失败：" + error.message);
			notification.error("队伍切换失败：" + error.message);
			await genshin.returnMainUi();
		}
	} else {
		log.error("没有设置切换队伍");
		notification.error("没有设置切换队伍");
		await genshin.returnMainUi();
	}
})();
