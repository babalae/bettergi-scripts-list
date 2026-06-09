async function keyMaintain(key, duration) {
  keyDown(key);
  await sleep(duration);
  keyUp(key);
}

/**
 * 检测指定图片是否存在
 * @param {string} imagePath - 图片路径（自动添加assets/前缀和.png后缀）
 * @param {number} [x=0] - 检测区域X坐标（可选）
 * @param {number} [y=0] - 检测区域Y坐标（可选）
 * @param {number} [width=0] - 检测区域宽度（0表示全屏）（可选）
 * @param {number} [height=0] - 检测区域高度（0表示全屏）（可选）
 * @param {number} [threshold=0.8] - 匹配阈值（0-1）（可选）
 * @returns {Promise<boolean>} 如果检测到图片返回true，否则返回false
 */
async function detectImage(imagePath, x = 0, y = 0, width = 0, height = 0, threshold = 0.9) {
    let captureRegion = null;
    let templateImage = null;
    let recognitionObject = null;
    let searchRegion = null;
    let result = null;
    
    try {
        // 自动处理路径：添加assets/前缀和.png后缀
        let fullPath = imagePath;
        
        // 1. 确保有assets/前缀
        if (!fullPath.startsWith('assets/')) {
            fullPath = `assets/${fullPath}`;
        }
        
        // 2. 确保有.png后缀
        if (!fullPath.toLowerCase().endsWith('.png')) {
            fullPath = `${fullPath}.png`;
        }
        
        
        // 3. 加载模板图片
        templateImage = file.ReadImageMatSync(fullPath);
        if (!templateImage) {
            log.error(`无法加载图片: ${fullPath}`);
            return false;
        }
        
        // 4. 捕获游戏区域
        captureRegion = captureGameRegion();
        
        // 5. 创建识别对象
        if (width > 0 && height > 0) {
            // 指定区域检测
            recognitionObject = RecognitionObject.TemplateMatch(
                templateImage, 
                x, 
                y, 
                width, 
                height
            );
        } else {
            // 全屏检测
            recognitionObject = RecognitionObject.TemplateMatch(templateImage);
        }
        
        // 设置匹配阈值
        recognitionObject.Threshold = threshold;
        
        // 6. 确定检测区域
        if (width > 0 && height > 0) {
            // 如果指定了区域，则裁剪检测区域
            searchRegion = captureRegion.DeriveCrop(x, y, width, height);
        } else {
            searchRegion = captureRegion;
        }
        
        // 7. 执行检测
        result = searchRegion.Find(recognitionObject);
        const detected = !result.IsEmpty();
        
        if (detected) {
            log.info(`✅ 检测到图片: ${imagePath}, 位置: (${result.X}, ${result.Y})`);
        } else {

        }
        
        return detected;
        
    } catch (error) {
        log.error(`检测图片时发生错误: ${error.message}`);
        return false;
        
    } finally {
        // 8. 确保释放所有资源（内存管理）
        try {
            // 释放结果对象
            if (result) {
                result.Dispose();
            }
            
            // 释放裁剪的区域（如果是独立创建的）
            if (searchRegion && searchRegion !== captureRegion) {
                searchRegion.Dispose();
            }
            
            // 释放识别对象内部资源
            if (recognitionObject) {
                recognitionObject.InitTemplate();
            }
            
            // 释放模板图片
            if (templateImage) {
                templateImage.Dispose();
            }
            
            // 释放截图区域
            if (captureRegion) {
                captureRegion.Dispose();
            }
            
        } catch (disposeError) {
            log.warn(`释放资源时出错: ${disposeError.message}`);
        }
    }
}
/**
 * 等待图片出现并点击
 * @param {string} imageName 图片名称（不带.png后缀且在assets文件中）
 * @param {number} [timeout=20000] 超时时间（毫秒），默认20秒
 * @param {number} [checkInterval=500] 检查间隔（毫秒），默认500毫秒
 * @returns {Promise<void>}
 * @throws 如果超时未找到图片则抛出错误
 */
// 使用示例：
// await waitAndClickImage("paimon_menu");
// await waitAndClickImage("confirm_button",false,9000);
//
// (2) 自定义偏移量和是否点击，可以用于检测是否有图片
// await waitAndClickImage("confirm_button",false,7000);
//滚动查询偏移点击
// await waitAndClickImage("confirm_button",true,20000,758,60,true,1);
const waitAndClickImage = async (
    imageName,
	ifClick = true,
    timeout = 20000,
    extraWidth = 10,
    extraHeight = 10,
	ifScroll = false,
	scrollNum = 3,
    checkInterval = 500,
    threshold = 0.9 // 新增阈值参数，默认值0.8
) => {
    const startTime = Date.now();
    const imagePath = `assets/${imageName}.png`;
    
    // 读取模板图片
    const templateMat = file.ReadImageMatSync(imagePath);
    const recognitionObj = RecognitionObject.TemplateMatch(templateMat, 0, 0, 1920, 1080);
    recognitionObj.threshold = threshold;
    
    // 使用 try-finally 确保模板图像被释放
    try {
        while (Date.now() - startTime < timeout) {
            // 捕获游戏区域


            const captureRegion = captureGameRegion();
            
            // 使用 try-finally 确保每次循环的资源被释放
            try {
                // 查找图片
                const result = captureRegion.Find(recognitionObj);
                
                // 使用 try-finally 确保结果对象被释放
                try {
                    if (!result.isEmpty()) {
                        
						await sleep(400); // 点击前稍作等待
                        if (ifClick){
						    click(result.x+extraWidth, result.y+extraHeight);
						    log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})，正在点击...`);
						} 
						else log.info(`找到图片 ${imageName}，位置(${result.x}, ${result.y})`);
                        await sleep(200); // 点击后稍作等待
                        return true;
                    }
                } finally {
                    // 释放结果对象
                    if (result && result.Dispose) {
                        result.Dispose();
                    }
                }
            } finally {
                // 释放捕获区域
                if (captureRegion && captureRegion.Dispose) {
                    captureRegion.Dispose();
                }
            }
            
            await sleep(checkInterval);
			
			if(ifScroll){
                for (let i = 0; i < scrollNum; i++) {
                await keyMouseScript.runFile("assets/滚轮下滑.json");
				await sleep(800);
                }						
			}
        }
    } finally {
        // 释放模板图像
        if (templateMat && templateMat.Dispose) {
            templateMat.Dispose();
        }
    }
    
    throw new Error(`等待图片 ${imageName} 超时`);
}

/**
 * 检测当前血量是否为红色（低血量）
 * @returns {Promise<boolean>} - 红血返回 true，否则返回 false
 * 非常感谢 mno 和 汐 在锄地一条龙中提到的血量检测方法！！！
 */
async function isHealthRed() {
    // 内嵌配置和管理器
    const GAME_REGION_CACHE_SIZE = 5;
    const gameRegionManager = {
        cache: [],
        lastCapture: new Date(),
        isDisposing: false,
        isCapturing: false
    };
    
    // 内嵌模板图片加载（使用立即执行函数确保初始化）
    let imageMat, img;
    (function initTemplate() {
        imageMat = file.ReadImageMatSync("assets/三色血条.png");
        img = new ImageRegion(imageMat, 0, 0);
    })();

    // 内嵌截图获取函数
    async function getGameRegion(minInterval = 17, asyncDispose = false) {
        async function disposeOldGameRegion() {
            gameRegionManager.isDisposing = true;
            try {
                while (gameRegionManager.cache.length > GAME_REGION_CACHE_SIZE) {
                    const oldestRegion = gameRegionManager.cache.shift();
                    if (oldestRegion) {
                        oldestRegion.dispose();
                    }
                }
            } catch (error) {
                log.error(`释放旧游戏区域截图失败: ${error.message}`);
            } finally {
                gameRegionManager.isDisposing = false;
            }
        }

        while (gameRegionManager.isCapturing) {
            await sleep(1);
        }

        gameRegionManager.isCapturing = true;
        try {
            if (new Date() - gameRegionManager.lastCapture >= minInterval || gameRegionManager.cache.length === 0) {
                while (gameRegionManager.isDisposing) {
                    await sleep(1);
                }
                gameRegionManager.lastCapture = new Date();
                const newRegion = captureGameRegion(); // 假设 captureGameRegion 已全局存在
                gameRegionManager.cache.push(newRegion);

                if (asyncDispose) {
                    disposeOldGameRegion();
                } else {
                    await disposeOldGameRegion();
                }
            }
        } catch (error) {
            log.error(`获取游戏区域截图失败: ${error.message}`);
        } finally {
            gameRegionManager.isCapturing = false;
            return gameRegionManager.cache[gameRegionManager.cache.length - 1];
        }
    }

    // 主检测逻辑
    try {
        const gameRegion = await getGameRegion();
        const checkRegion = gameRegion.DeriveCrop(824 - 9, 1014 - 9, 8, 8);
        const checkMat = checkRegion.SrcMat;
        
        const ro = RecognitionObject.TemplateMatch(checkMat);
        ro.use3Channels = true;
        ro.Threshold = 0.4;
        ro.InitTemplate();
        
        const result = img.find(ro);
        
        if (!result.isEmpty()) {
            return result.x <= 14;
        }
        return false;
    } catch (error) {
        log.error(`血量检测失败: ${error.message}`);
        return false;
    }
}

async function switchToFoodBag() {
    await genshin.returnMainUi();
    await sleep(1500);
    
    keyDown("z");
    await sleep(1500);
    keyUp("z");
    
    try {
        await waitAndClickImage("食物袋");
        log.info("道具成功切换为食物袋");
        return true;
    } catch (error) {
        log.error(`食物袋切换失败: ${error.message}`);
        return false;
    }
}

/**
 * 自动导航直到检测到指定文字
 * @param {Object} options 配置选项
 * @param {number} [options.x=1210] 检测区域左上角x坐标
 * @param {number} [options.y=515] 检测区域左上角y坐标
 * @param {number} [options.width=200] 检测区域宽度
 * @param {number} [options.height=50] 检测区域高度
 * @param {string|RegExp} [options.targetText="奖励"] 要检测的目标文字
 * @param {number} [options.maxSteps=100] 最大检查次数
 * @param {number} [options.stepDuration=200] 每步前进持续时间(ms)
 * @param {number} [options.waitTime=10] 单次等待时间(ms)
 * @param {string} [options.moveKey="w"] 前进按键
 * @param {boolean} [options.ifClick=false] 是否点击
 * @returns {Promise<void>}
 * await repeatOperationUntilTextFound();  默认F区域检测到任何文字即停止前进
 * await repeatOperationUntilTextFound({targetText: "日落果"});  F区域检测到指定文字即停止前进
 *await repeatOperationUntilTextFound({x: 10,y: 10,width: 100,height: 100,targetText: "奖励",stepDuration: 0,waitTime: 100,ifClick: true});//用来等待点击文字,10s等待
 */
const repeatOperationUntilTextFound = async (
  {
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
  } = {}
) => {
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

//执行战斗并检测结束																		
async function restoredEnergyAutoFightAndEndDetection() {
  await genshin.tp(178.55, 384.4);
  await repeatOperationUntilTextFound();//
  keyPress("F");
  await repeatOperationUntilTextFound({
    x: 1650,
    y: 1000,
    width: 160,
    height: 45,
    targetText: "单人挑战",
    stepDuration: 0,
    waitTime: 100,
    ifClick: true
  });
  //等待点击单人挑战
  await sleep(200);
  click(1180, 760);//队伍等级偏低、体力不够可能会出弹窗
  await repeatOperationUntilTextFound({
    x: 1650,
    y: 1000,
    width: 160,
    height: 45,
    targetText: "开始挑战",
    stepDuration: 0,
    waitTime: 100,
    ifClick: true
  });//等待点击开始挑战
  await sleep(2000);
  await tpEndDetection();
  keyDown("w");
  await sleep(200);
  keyDown("SHIFT");
  await sleep(300);
  keyUp("SHIFT");
  await sleep(500);
  keyDown("SHIFT");
  await sleep(300);
  keyUp("SHIFT");
  await sleep(1000);
  keyDown("SHIFT");
  await sleep(300);
  keyUp("SHIFT");
  await sleep(500);
  keyUp("w");
  let challengeTime = 0;
  //2分钟兜底
  while (challengeTime < 5000) {
    for (let i = 1; i < 5; i++) {
      keyPress(i.toString());
      await sleep(300);
      leftButtonClick();
      await sleep(400);
      keyDown("e");
      await sleep(400);
      keyUp("e");
      await sleep(500);
      leftButtonClick();
      await sleep(100);
      const ro = captureGameRegion();
      let res = ro.find(RecognitionObject.ocr(840, 935, 230, 40));
      ro.dispose();
      if (res.text.includes("自动退出")) {
        log.info("检测到挑战成功");
        return;
      }
    }
    challengeTime = challengeTime + 200;
    await sleep(100);
  }
  log.info("挑战超时，可能充能失败");
}

async function restoredEnergy() {
  await genshin.returnMainUi();
  await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像，避免有倒下的角色
  await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
  await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
  log.info("能量充满，任务结束");
  await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
}

//检测传送结束  await tpEndDetection();
async function tpEndDetection() {
  const region1 = RecognitionObject.ocr(1690, 230, 75, 350);// 队伍名称区域
  const region2 = RecognitionObject.ocr(872, 681, 180, 30);// 点击任意处关闭
  let tpTime = 0;
  await sleep(1500);//点击传送后等待一段时间避免误判
  //最多30秒传送时间
  while (tpTime < 300) {

    let capture = captureGameRegion();
    let res1 = capture.find(region1);
    let res2 = capture.find(region2);
    capture.dispose();
    if (!res1.isEmpty() || !res2.isEmpty()) {
      log.info("传送完成");
      await sleep(1000);//传送结束后有僵直
      click(960, 810);//点击任意处
      await sleep(500);
      return;
    }
    tpTime++;
    await sleep(100);
  }
  throw new Error('传送时间超时');
}

//吃料理
async function eatFood() {
  let foodName = settings.foodName ?? 0;
  if (foodName) {
    const foodSum = foodName.split('-');
    log.info("开始吃菜");
    await sleep(1000);
    keyPress("B");//打开背包
    await sleep(2000);
    click(863, 51);//选择食物
    await sleep(1000);
    for (let i = 0; i < foodSum.length; i++) {
      click(170, 1020);//筛选
      await sleep(1000);
      click(195, 1020);//重置
      await sleep(1000);
      click(110, 110);//输入名字
      await sleep(1000);
      inputText(foodSum[i]);
      await sleep(500);
      click(490, 1020);//确认筛选
      await sleep(1000);
      click(180, 180);//选择第一个食物
      await sleep(1000);
      click(1690, 1015);//使用
      await sleep(1000);
    }
    keyPress("ESCAPE");
    await sleep(1500);
  }
}

//检测角色是否阵亡，并前往吃药复活
async function resurgenceDetectionAndEatFood() {
  const region1 = RecognitionObject.ocr(1170, 780, 75, 35);// 复活料理区域
  const region2 = RecognitionObject.ocr(545, 360, 800, 45);// 料理冷却区域
  let recoveryFoodName = settings.recoveryFoodName ?? 0;
  let resurgenceFoodName = settings.resurgenceFoodName ?? 0;
  if (1) {
    keyPress("1");
    await sleep(60);
    keyPress("2");
    await sleep(60);
    keyPress("3");
    await sleep(60);
    keyPress("4");
    await sleep(1100);
    let capture = captureGameRegion();
    let res1 = capture.find(region1);
    let res2 = capture.find(region2);
    if (res1.isEmpty()) {
      return;
    } else if (!res1.isEmpty() && !res2.isEmpty()) {
      keyPress("ESCAPE");
      await sleep(1000);
      await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
      throw new Error('复活料理处于冷却中，战斗失败');
      return;
    } else if (!res1.isEmpty() && res2.isEmpty()) {
      log.info("检测到阵亡角色……复活吧！我的爱人！！！");
      if (resurgenceFoodName && recoveryFoodName) {
        keyPress("ESCAPE");
        await eatResurgenceFood();//满血复活
        return;
      } else {
        keyPress("ESCAPE");
        await sleep(1000);
        await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
        throw new Error('未填写复活及恢复料理，复活失败T^T');
        return;
      }
    }
  }
}

//吃料理复活
async function eatResurgenceFood() {
  let recoveryFoodName = settings.recoveryFoodName ?? 0;
  let resurgenceFoodName = settings.resurgenceFoodName ?? 0;
  const region = RecognitionObject.ocr(800, 200, 315, 32);// 复活对象检测
  const clickPositions = [
    {x: 760, y: 440},  // 角色1
    {x: 900, y: 440},  // 角色2
    {x: 1040, y: 440}, // 角色3
    {x: 1180, y: 440}  // 角色4
  ];
  if (resurgenceFoodName && recoveryFoodName) {
    log.info("开始吃菜");
    await sleep(500);
    keyPress("B");//打开背包
    await sleep(2000);
    click(863, 51);//选择食物
    await sleep(1000);
    click(170, 1020);//筛选
    await sleep(1000);
    click(195, 1020);//重置
    await sleep(1000);
    click(110, 110);//输入名字
    await sleep(200);
    click(110, 110);
    await sleep(1000);
    inputText(`${resurgenceFoodName}`);
    await sleep(500);
    click(490, 1020);//确认筛选
    await sleep(1000);
    click(180, 180);//选择第一个食物
    await sleep(1000);
    click(1690, 1015);//使用
    await sleep(1000);
    // 使用 for 循环点击每个位置
    for (let i = 0; i < clickPositions.length; i++) {
      const position = clickPositions[i];
      click(position.x, position.y);
      await sleep(800);
      click(1200, 770);//确认
      await sleep(800);
      let capture = captureGameRegion();
      let res = capture.find(region);
      if (res.isEmpty()) {
        keyPress("ESCAPE");
        await sleep(1000);
        click(170, 1020);//筛选
        await sleep(1000);
        click(195, 1020);//重置
        await sleep(1000);
        click(110, 110);//输入名字
        await sleep(1000);
        inputText(`${recoveryFoodName}`);
        await sleep(500);
        click(490, 1020);//确认筛选
        await sleep(1000);
        click(180, 180);//选择第一个食物
        await sleep(1000);
        click(1690, 1015);//使用
        await sleep(500);
        click(position.x, position.y);
        await sleep(500);
        click(1200, 770);//吃第一个
        await sleep(500);
        click(1200, 770);//吃第二个
        await sleep(500);
        click(1350, 290);//退出
        await sleep(500);
        keyPress("ESCAPE");
        await sleep(400);
        log.info("我又好了，嘿嘿");
        break;
      }
      await sleep(1000);
    }
  }
}


//异步调用战斗
async function autoFightAsync() {
    try {
        const cts = new CancellationTokenSource();
        dispatcher.RunTask(new SoloTask("AutoFight"), cts);
		let checkTimes = parseInt(settings.challengeTime, 10);
		
		for (let i = 0;i < 2*checkTimes; i++) {
		  if(await detectImage("复活药")){log.info("检测到复活标志，尝试一次复活");keyPress("Z");}
		  if (await isHealthRed()&& await detectImage("小道具标志")) {
            log.info("检测到血量过低");
		    if(settings.ifAutoEatFood){
			log.info("尝试一次吃药");
			keyPress("Z");
			}
        }
          await sleep(490);
		}
		
		if(settings.challengeTime != checkTimes) await sleep(1000*(settings.challengeTime-checkTimes));
		
        cts.cancel();
    } catch (error) {
      log.info("启动战斗失败，尝试重新启动");
    }
}

async function queryStaminaValue() {
  try {
    await genshin.returnMainUi();
    await sleep(1000);
    keyPress("F1");
    await sleep(2000);
    click(300, 540);
    await sleep(1000);
    click(1570, 203);
    await sleep(1500);
    let captureRegion = captureGameRegion();
    let stamina = captureRegion.find(RecognitionObject.ocr(1580, 20, 210, 55));
    log.info(`OCR原始文本：${stamina.text}`);
    const staminaText = stamina.text.replace(/\s/g, ''); // 移除所有空格
    const standardMatch = staminaText.match(/(\d+)/);
    if (standardMatch) {
      const currentValue = standardMatch[1];
      let validatedStamina = positiveIntegerJudgment(currentValue);
      if (validatedStamina > 11200) validatedStamina = (validatedStamina - 1200) / 10000;
      return validatedStamina;
    }
  } catch (error) {
    log.error(`体力识别失败：${error.message}，默认为零`);
    await genshin.returnMainUi();
    return 0;
  }
}

//检查是否为正整数
function positiveIntegerJudgment(testNumber) {
  // 如果输入是字符串，尝试转换为数字
  if (typeof testNumber === 'string') {
    // 移除可能存在的非数字字符（如空格、百分号等）
    const cleaned = testNumber.replace(/[^\d]/g, '');
    testNumber = parseInt(cleaned, 10);
  }

  // 检查是否为有效的数字
  if (typeof testNumber !== 'number' || isNaN(testNumber)) {
    throw new Error(`无效的值: ${testNumber} (必须为数字)`);
  }

  // 检查是否为整数
  if (!Number.isInteger(testNumber)) {
    throw new Error(`必须为整数: ${testNumber}`);
  }

  return testNumber;
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
      await file.writeText(filePath, "");
      shouldRefresh = true;
    }

    if (shouldRefresh) {
      //刷新返回true
      return true;
    } else {
      //未刷新返回false
      return false;
    }

  } catch (error) {
    // 如果文件不存在，创建新文件并返回true(视为需要刷新)
    const createResult = await file.writeText(filePath, '');
    if (createResult) {
      log.info("创建新时间记录文件成功，执行脚本");
      return true;
    } else throw new Error(`创建新文件失败`);
  }
}

//征讨之花领奖(图标识别)
const autoNavigateToReward = async () => {
  // 定义识别对象
  const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));
  const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测
  let advanceNum = 0;//前进次数
  //调整为俯视视野
  middleButtonClick();
  await sleep(800);
  moveMouseBy(0, 1030);
  await sleep(400);
  moveMouseBy(0, 920);
  await sleep(400);
  moveMouseBy(0, 710);
  log.info("开始领奖");
  while (true) {
    // 1. 优先检查是否已到达领奖点
    let captureRegion = captureGameRegion();
    let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
    let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
    // 检测到特点文字则结束！！！
    if (rewardResult.text == "接触征讨之花") {
      log.info(`总计前进第${advanceNum}次`);
      log.info("已到达领奖点，检测到文字: " + rewardResult.text);
      return;
    } else if (advanceNum > 150) {
      log.info(`总计前进第${advanceNum}次`);
      throw new Error('前进时间超时');
    }
    // 2. 未到达领奖点，则调整视野
    for (let i = 0; i < 100; i++) {
      captureRegion = captureGameRegion();
      let iconRes = captureRegion.Find(boxIconRo);
      let climbTextArea = captureRegion.DeriveCrop(1685, 1030, 65, 25);
      let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
      // 检查是否处于攀爬状态
      if (climbResult.text == "Space") {
        log.info("检侧进入攀爬状态，尝试脱离");
        keyPress("x");
        await sleep(1000);
        keyDown("a");
        await sleep(800);
        keyUp("a");
        keyDown("w");
        await sleep(800);
        keyUp("w");
      }
      if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {
        advanceNum++;
        break;
      } else {
        // 小幅度调整
        if (iconRes.y >= 520) moveMouseBy(0, 920);
        let adjustAmount = iconRes.x < 920 ? -20 : 20;
        let distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
        let scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
        let adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
        moveMouseBy(adjustAmount * adjustAmount2, 0);
        await sleep(100);
      }
      if (i > 20) throw new Error('视野调整超时');
    }
    // 3. 前进一小步
    keyDown("w");
    await sleep(200);
    keyUp("w");

  }
}

//征讨之花领奖(无图标前进检测)
const autoNavigateToRewardNoIcon = async (step = 150, maxStep = 150) => {
  const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测
  let advanceNum = 0;
  while (true) {
    // 1. 优先检查是否已到达领奖点
    let captureRegion = captureGameRegion();
    let rewardTextArea = captureRegion.DeriveCrop(1210, 515, 200, 50);
    let rewardResult = rewardTextArea.find(RecognitionObject.ocrThis);
    // 检测到特点文字则结束！！！
    if (rewardResult.text == "接触征讨之花") {
      log.info("已到达领奖点，检测到文字: " + rewardResult.text);
      log.info(`总计前进步数：${advanceNum}`);
      return;
    } else if (advanceNum > maxStep) {
      await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
      log.info(`总计前进步数：${advanceNum}`);
      throw new Error('前进时间超时');
    }
    // 前进一小步
    if ((advanceNum % (step * 2)) < step) {
      keyDown("w");
      await sleep(200);
      keyUp("w");
    } else if ((advanceNum % (step * 2)) > step) {
      keyDown("s");
      await sleep(200);
      keyUp("s");
    } else {
      keyDown("d");
      await sleep(600);
      keyUp("d");

    }
    advanceNum++;
  }
}

//执行战斗并检测结束																	
async function autoFightAndEndDetection(extraFightAction) {
  // 定义两个检测区域
  const region1 = RecognitionObject.ocr(700, 0, 450, 100);//区域一 BOSS名称
  const region2 = RecognitionObject.ocr(820, 935, 280, 50);//区域二 成功倒计时
  const paimonMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/paimon_menu.png"), 0, 0, 640, 216);
  const teamRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/team1.png"), 1820, 240, 80, 400);
  const teamRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/team2.png"), 1820, 240, 80, 400);
  let challengeTime = 0;
  let challengeNum = 0;
  let skipMovie = 0;
  //10分钟兜底
  while (challengeTime < 600000) {
    await resurgenceDetectionAndEatFood();//检查吃药复活
    challengeTime = challengeTime + 1000;
    // 捕获游戏区域
    let capture = captureGameRegion();
    // 检测两个区域的OCR结果
    let res1 = capture.find(region1);
    let res2 = capture.find(region2);
    let teamRes1 = capture.find(teamRo1);
    let teamRes2 = capture.find(teamRo2);
    let hasText1 = !res1.isEmpty() && res1.text.trim().length > 0;
    let hasText2 = res2.text.includes("自动退出");
    let hasText3 = teamRes1.isExist() || teamRes2.isExist();
    let paimon = capture.find(paimonMenuRo);
    if (paimon.isExist()) throw new Error('复活次数用尽,挑战失败');
    // 情况1: 区域1有文字 且 区域2无文字 且 区域3有文字 → 执行AutoFight
    if (hasText1 && !hasText2 && hasText3) {
      challengeNum++;
      challengeTime = challengeTime + 1000 * settings.challengeTime;
      log.info(`执行第${challengeNum}次战斗`);
      await autoFightAsync();
      await extraFightAction(1);
    }
    // 情况2: 区域2有文字 且 区域1无文字 且 区域3有文字 → 结束循环
    else if (hasText2 && hasText3) {
      await sleep(500);
      log.info("检测到挑战成功");
      break;
    }
    // 情况3: 区域2无文字区域1无文字区域3有文字 →BOSS二阶段，需要移动触发
    else if (!hasText2 && !hasText1 && hasText3) {
      await extraFightAction(2);
    }
    // 情况4: 三个区域均无文字，可能处于转场动画，尝试点击快进
	if (skipMovie > 9) {
	  throw new Error('多次未能成功跳过动画，结束本次挑战');
	}
	
    else if (!hasText2 && !hasText3) {
	  skipMovie++;
      await extraFightAction(3);
    }
    challengeTime = challengeTime + 100;
    // 每次检测间隔100毫秒，避免CPU占用过高
    await sleep(100);
  }
}

async function goToChallenge() {
  //检验输入参数
  if (!settings.challengeTime) throw new Error('未输入单轮战斗时长');
  if (!settings.teamName) throw new Error('未输入队伍名称');
  //通用：前往副本(副本外)
  await genshin.returnMainUi();
  //切换队伍
  await genshin.switchParty(settings.teamName);
  //切换小道具
  if(settings.ifAutoEatFood) await switchToFoodBag();
  //前往充满能量
  if (settings.energyMax) await restoredEnergy();
  else await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
  switch (settings.monsterName) {
    case "风魔龙":
      await genshin.tp(122.626, 2657.63,);//传送到周本
      break;
    case "公子":
      await genshin.tp(254.45, -904.58,);//传送到周本
      break;
    case "若陀龙王":
      await genshin.tp(1753.89, 614.28);//传送到周本
      break;
    case "女士":
      await genshin.tp(-4561.248046875, -3353.7587890625);//传送到周本
      break;
    case "雷神":
      await genshin.tp(-4403.830078125, -2481.962890625,);//传送到周本
      break;
    case "散兵":
      await genshin.tp(2537.87, -522.9,);//传送到周本
      break;
    case "阿佩普":
      await genshin.tp(5747.71533203125, -210.318359375);//传送到周本
      break;
    case "吞星之鲸":
      await genshin.tp(4022.01171875, 3063.54931640625);//传送到周本
      break;
    case "仆人":
      await genshin.tp(4935.07861328125, 4183.38818359375);//传送到周本
      break;
    case "源焰之主":
      await genshin.tp(9481.6123046875, -1931.45166015625,);//传送到周本
      break;
    case "门扉前的弈局":
      await genshin.tp(-1608.205078125, 1730.2724609375, true);//传送到周本
      break;
    case "博士":
      await genshin.tp(9533.977415460497,6392.802705966171,true);
      break;
    case "世界树博士":
      await genshin.tp(2917.732421875,216.9765625,true);
      break;	  
    default:
      break;
  }
  await sleep(1000);
  await repeatOperationUntilTextFound();
  await sleep(500);
  keyPress("F");
  await sleep(2000);
  await repeatOperationUntilTextFound({
    x: 1650,
    y: 1000,
    width: 160,
    height: 45,
    targetText: "单人挑战",
    stepDuration: 0,
    waitTime: 100
  });//等待点击单人挑战
  await sleep(1500);
  if (settings.monsterName != "风魔龙") click(300, settings.difficulty * 110 + 90);

  if (!settings.fightMode) {
    let capture = captureGameRegion();
    const region = RecognitionObject.ocr(1320, 10, 290, 80);//领奖次数区域
    let res = capture.find(region);
    if (res.text.includes("倒计时")) {
      log.info("领奖次数耗尽，任务结束");
      await file.writeText(`assets/${settings.monsterName}.txt`, new Date().toISOString());
      throw new Error(`周本${settings.monsterName}已经领过奖了`);
    } else log.info("检测到还有领奖次数，开始挑战");
    await sleep(500);
  }
  click(1725, 1020);//点击单人挑战
  await sleep(200);
  click(1180, 760);//队伍等级偏低、体力不够可能会出弹窗
  await repeatOperationUntilTextFound({
    x: 1650,
    y: 1000,
    width: 160,
    height: 45,
    targetText: "开始挑战",
    stepDuration: 0,
    waitTime: 100,
    ifClick: true
  });//等待点击开始挑战
  await sleep(2000);
  await tpEndDetection();
}

async function claimAndExit() {
  await sleep(1000);
  keyPress("F");//领奖
  await sleep(1000);
  click(950, 750);//使用树脂
  await sleep(6000);
  click(975, 1000);//退出秘境
  await tpEndDetection();
  await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
  await sleep(1000);
  log.info(`周本${settings.monsterName}挑战完成`);
}

async function checkDate(main) {
  if (settings.fightMode) {
    log.info("已启用战斗模式，不检测刷新周期和体力值");//不检测刷新周期和体力值，但没领过奖还是会领奖
    try {
      log.info(`开始挑战周本${settings.monsterName}`);
      await main();
    } catch (error) {
      notification.send(`周本${settings.monsterName}挑战失败，错误信息: ${error}`);
      await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
    }
  } else if (await isTaskRefreshed(`assets/${settings.monsterName}.txt`, {
    refreshType: 'weekly',
    weeklyDay: 1,
    weeklyHour: 4
  }) && !settings.fightMode) {
    let afterStamina = await queryStaminaValue();
    let beforeStamina = afterStamina;//获取挑战前的体力值
    if (afterStamina >= 60) {
      try {
        notification.send(`周本${settings.monsterName}已经刷新，开始挑战，当前体力${afterStamina}`);
        await main();
        afterStamina = await queryStaminaValue();//获取挑战后的体力值
        if (beforeStamina - afterStamina > 0) await file.writeText(`assets/${settings.monsterName}.txt`, new Date().toISOString());
        else notification.send(`周本${settings.monsterName}领奖失败，请检查相关设置`);
        notification.send(`周本${settings.monsterName}挑战结束，剩余体力${afterStamina}`);
      } catch (error) {
        notification.send(`周本${settings.monsterName}挑战失败，错误信息: ${error}`);
        await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
      }
    } else {
      notification.send(`体力值为${afterStamina},周本${settings.monsterName}可能无法领取奖励`);
    }
  } else log.info(`当前周本${settings.monsterName}冷却未刷新`);
}

//北风狼
async function weeklyBoss1() {

  async function autoFightAndEndDetection() {
    // 定义两个检测区域
    const region1 = RecognitionObject.ocr(700, 0, 450, 100);//区域一 BOSS名称
    const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));//领奖图标
    const teamRo1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/team1.png"), 1820, 240, 80, 400);
    const teamRo2 = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/team2.png"), 1820, 240, 80, 400);
    let challengeTime = 0;
    let challengeNum = 0;
    //10分钟兜底
    while (challengeTime < 600000) {
      await resurgenceDetectionAndEatFood();//检查吃药复活
      challengeTime = challengeTime + 1000;
      // 捕获游戏区域
      let capture = captureGameRegion();
      // 检测两个区域的OCR结果
      let res1 = capture.find(region1);
      let res2 = capture.find(boxIconRo);
      let teamRes1 = capture.find(teamRo1);
      let teamRes2 = capture.find(teamRo2);
      let hasText1 = !res1.isEmpty() && res1.text.trim().length > 0;
      let hasText2 = res2.isExist();
      let hasText3 = teamRes1.isExist() || teamRes2.isExist();
      // 情况1: 区域1有文字 且 区域2无文字 且 区域3有文字 → 执行AutoFight
      if (hasText1 && !hasText2 && hasText3) {
        challengeNum++;
        challengeTime = challengeTime + 1000 * settings.challengeTime;
        log.info(`执行第${challengeNum}次战斗`);
        await autoFightAsync();
      }
      // 情况2: 区域2有文字 且 区域1无文字 且 区域3有文字 → 结束循环
      else if (hasText2) {
        await sleep(500);
        log.info("检测到挑战成功");
        break;
      }
      challengeTime = challengeTime + 100;
      // 每次检测间隔100毫秒，避免CPU占用过高
      await sleep(100);
    }
  }

  async function main() {
    //检验输入参数
    if (!settings.challengeTime) throw new Error('未输入单轮战斗时长');
    if (!settings.teamName) throw new Error('未输入队伍名称');
    //通用：前往副本(副本外)
    await genshin.returnMainUi();
    //切换队伍
    await genshin.switchParty(settings.teamName);
    //前往充满能量
    if (settings.energyMax) await restoredEnergy();
    else await genshin.tp(2297.6201171875, -824.5869140625);//传送到神像回血
    await pathingScript.runFile("assets/前往狼王.json");
    await eatFood();//嗑药
    await sleep(1000);
    keyPress("F");
    await sleep(13000);
    await autoFightAndEndDetection();//一直战斗直到检测到结束
    await sleep(1000);
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

//风魔龙
async function weeklyBoss2() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:

        break;
      case 2:

        break;
      case 3:

        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    keyDown("w");
    await sleep(4000);
    keyUp("w");
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    //领奖并退出
    keyDown("s");
    await sleep(1000);
    keyUp("s");
    keyDown("d");
    await sleep(300);
    keyUp("d");
    await autoNavigateToRewardNoIcon();
    await claimAndExit();
  }

  await checkDate(main);
}

//公子
async function weeklyBoss3() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:
        await sleep(200);
        keyDown("s");
        await sleep(1000);
        keyUp("s");
        break;
      case 2:

        break;
      case 3:
        log.info("进入过场动画尝试快进");
        await sleep(1500);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        await sleep(4000);
        keyDown("s");
        await sleep(2500);
        keyUp("s");
        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    keyDown("s");
    await sleep(2400);
    keyUp("s");
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    //领奖并退出
    keyDown("s");
    await sleep(2400);
    keyUp("s");
    await autoNavigateToRewardNoIcon(70, 4200);
    await claimAndExit();
  }

  await checkDate(main);
}

//若陀龙王
async function weeklyBoss4() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:

        break;
      case 2:

        break;
      case 3:

        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    await sleep(500);
    keyDown("w");
    await sleep(2000);
    keyUp("w");
    await sleep(10000);
    keyDown("s");
    await sleep(500);
    keyDown("SHIFT");
    await sleep(1000);
    keyUp("SHIFT");
    await sleep(500);
    keyUp("s");
    await sleep(800);
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

//女士
async function weeklyBoss5() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:
        await sleep(200);
        keyDown("s");
        await sleep(1000);
        keyUp("s");
        break;
      case 2:

        break;
      case 3:
        log.info("进入过场动画尝试快进");
        await sleep(1400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        await sleep(400);
        keyDown("s");
        await sleep(2000);
        keyUp("s");
        await autoFightAsync();
        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    keyPress("1");
    await sleep(1000);//切回固定行走位
    keyDown("w");
    await sleep(1500);
    keyUp("w");
    await sleep(8500);
    keyDown("s");
    await sleep(200);
    keyDown("SHIFT");
    await sleep(300);
    keyUp("SHIFT");
    await sleep(400);
    keyUp("s");
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    //领奖并退出
    await sleep(1000);
    keyDown("s");
    await sleep(4000);
    keyUp("s");
    await sleep(4000);
    keyDown("a");
    await sleep(300);
    keyUp("a");
    await autoNavigateToRewardNoIcon(50, 1250);
    await claimAndExit();
  }

  await checkDate(main);
}

//雷神
async function weeklyBoss6() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:
        await sleep(200);
        keyDown("s");
        await sleep(1000);
        keyUp("s");
        break;
      case 2:

        break;
      case 3:

        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    keyPress("1");
    await sleep(1000);//切回固定行走位
    keyDown("s");
    await sleep(300);
    keyDown("SHIFT");
    await sleep(300);
    keyUp("SHIFT");
    await sleep(1000);
    keyUp("s");
    await autoFightAsync();
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    //领奖并退出
    keyDown("s");
    await sleep(4000);
    keyUp("s");
    await autoNavigateToRewardNoIcon(70, 4200);
    await claimAndExit();
  }

  await checkDate(main);
}

//散兵
async function weeklyBoss7() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:
        await sleep(200);
        keyDown("s");
        await sleep(1000);
        keyUp("s");
        break;
      case 2:
        await sleep(200);
        keyDown("s");
        await sleep(1000);
        keyUp("s");
        break;
      case 3:
        log.info("进入过场动画尝试快进");
        await sleep(1400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        await sleep(4000);
        keyDown("s");
        await sleep(2500);
        keyUp("s");
        break;
      default:
        break;
    }
  }


  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    await sleep(1000);
    await repeatOperationUntilTextFound({
      x: 700,
      y: 0,
      width: 450,
      height: 100,
      targetText: "七叶",
      stepDuration: 300
    });//前进直到出现BOSS名字
    await sleep(6000);
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    //领奖并退出
    keyDown("s");
    await sleep(5000);
    keyUp("s");
    await autoNavigateToRewardNoIcon();
    await claimAndExit();
  }

  await checkDate(main);
}

//草龙
async function weeklyBoss8() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:

        break;
      case 2:

        break;
      case 3:
        log.info("进入过场动画尝试快进");
        await sleep(1400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        await sleep(1000);
        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    keyPress("1");
    await sleep(1000);//切回固定行走位
    await repeatOperationUntilTextFound({
      x: 700,
      y: 0,
      width: 450,
      height: 100,
      targetText: "绿",
      stepDuration: 300
    });//前进直到出现BOSS名字
    await sleep(6500);
    keyDown("e");
    await sleep(1000);//钟离开盾
    keyUp("e");
    await sleep(200);
    keyDown("a");
    await sleep(2200);
    keyUp("a");
    keyDown("w");
    await sleep(3600);
    keyUp("w");
    keyDown("d");
    await sleep(3600);
    keyUp("d");
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

//吞星之鲸
async function weeklyBoss9() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:

        break;
      case 2:

        break;
      case 3:

        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    await sleep(500);
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

//仆人
async function weeklyBoss10() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:

        break;
      case 2:
        log.info("检测到BOSS进入二阶段");
        keyDown("w");
        await sleep(1000);
        keyDown("VK_SHIFT");
        await sleep(200);
        keyUp("VK_SHIFT");
        await sleep(400);
        keyDown("VK_SHIFT");
        await sleep(200);
        keyUp("VK_SHIFT");
        keyUp("w");
        await sleep(1000);
        await autoFightAsync();
        break;
      case 3:
        log.info("进入过场动画尝试快进");
        await sleep(1400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        await sleep(1000);
        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    await repeatOperationUntilTextFound({
      x: 700,
      y: 0,
      width: 450,
      height: 100,
      targetText: "仆人",
      stepDuration: 300
    });//前进直到出现BOSS名字
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

//源焰之主
async function weeklyBoss11() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:

        break;
      case 2:

        break;
      case 3:

        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    keyPress("1");
    await sleep(1000);//切回固定行走位
    keyDown("s");
    await sleep(200);
    keyUp("s");
    keyDown("e");
    await sleep(1000);
    keyDown("e");
    keyDown("w");
    await sleep(1000);
    keyDown("VK_SHIFT");
    await sleep(200);
    keyUp("VK_SHIFT");
    await sleep(1000);
    keyDown("VK_SHIFT");
    await sleep(200);
    keyUp("VK_SHIFT");
    await sleep(1000);
    keyDown("VK_SHIFT");
    await sleep(200);
    keyUp("VK_SHIFT");
    await sleep(1000);
    keyDown("VK_SHIFT");
    await sleep(200);
    keyUp("VK_SHIFT");
    await sleep(1000);
    keyUp("w");
    keyDown("d");
    await sleep(500);
    keyUp("d");
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

//门扉前的弈局
async function weeklyBoss12() {

  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1:

        break;
      case 2:
        log.info("检测到BOSS进入二阶段");
        keyDown("w");
        await sleep(1000);//多前进一段位置，避免无法触发冻结反应，建议使用丝柯克
        keyUp("w");
        await autoFightAsync();
        break;
      case 3:
        log.info("进入过场动画尝试快进");
        await sleep(1400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
        log.info("等待技能CD");
        await sleep(15000);
        keyPress("1");
        await sleep(300);
        keyDown("s");
        await sleep(300);
        keyUp("s");
        await sleep(400);
        keyDown("e");
        await sleep(1000);//护盾角色开盾
        keyUp("e");
        await sleep(14000);
        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    keyPress("1");
    await sleep(300);
    keyDown("s");
    await sleep(300);
    keyUp("s");
    await sleep(400);
    keyDown("e");
    await sleep(1000);//护盾角色开盾
    keyUp("e");
    await sleep(12000);
    keyDown("w");
    await sleep(500);
    keyDown("SHIFT");
    await sleep(300);
    keyUp("SHIFT");
    await sleep(500);
    keyDown("SHIFT");
    await sleep(300);
    keyUp("SHIFT");
    await sleep(500);
    keyUp("w");
    await autoFightAsync();
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

async function weeklyBoss13() {
  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1://单次调用战斗任务后

        break;
      case 2:  //未出现boss名称但有队伍名称

        break;
      case 3://全无，可能是过程动画


        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药
    //前进触发战斗，然后前往柱子处躲避
    keyPress("1");
    await sleep(500);//切换钟离
    await keyMaintain("w", 2000);
    await keyMaintain("s", 3500);
    await keyMaintain("d", 4500);
    await keyMaintain("e", 1000);
    await sleep(5000);
    keyDown("w");
    await sleep(700);
    keyDown("SHIFT");
    await sleep(400);
    keyUp("SHIFT");
    await sleep(700);
    keyUp("w");
    keyDown("d");
    await sleep(200);
    keyDown("w");
    await sleep(700);
    keyUp("w");
    keyUp("d");
    await autoFightAsync();
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

async function weeklyBoss14() {
  async function extraFightAction(fight = 0) {
    switch (fight) {
      case 1://单次调用战斗任务后

        break;
      case 2:  //未出现boss名称但有队伍名称

        break;
      case 3://全无，可能是过程动画
        log.info("进入过场动画尝试快进");
        await sleep(1400);
        click(1765, 55);
        await sleep(400);
        click(1765, 55);
		await sleep(400);
        click(1765, 55);
        await sleep(4000);
        await keyMouseScript.runFile(`assets/世界树博士战斗.json`);
        break;
      default:
        break;
    }
  }

  async function main() {
    await goToChallenge();
    //副本内前往BOSS处
    await eatFood();//嗑药

	keyDown("w");
	await sleep(700);
	keyDown("SHIFT");
	await sleep(400);
	keyUp("SHIFT");
	await sleep(1000);
	keyUp("w");
	
    await autoFightAsync();
    await autoFightAndEndDetection(extraFightAction);//一直战斗直到检测到结束
    await autoNavigateToReward();
    await claimAndExit();
  }

  await checkDate(main);
}

this.utils = {
  weeklyBoss1,
  weeklyBoss2,
  weeklyBoss3,
  weeklyBoss4,
  weeklyBoss5,
  weeklyBoss6,
  weeklyBoss7,
  weeklyBoss8,
  weeklyBoss9,
  weeklyBoss10,
  weeklyBoss11,
  weeklyBoss12,
  weeklyBoss13,
  weeklyBoss14,
};
