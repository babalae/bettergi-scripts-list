(async function () {

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
        if (!res1.isEmpty() || !res2.isEmpty()){
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

//执行战斗并检测结束																		
async function restoredEnergyAutoFightAndEndDetection() {
await genshin.tp(178.55,384.4);
await repeatOperationUntilTextFound();//
keyPress("F"); 
await repeatOperationUntilTextFound({x: 1650,y: 1000,width: 160,height: 45,targetText: "单人挑战",stepDuration: 0,waitTime: 100,ifClick: true});//等待点击单人挑战
await sleep(200);
click(1180, 760);//队伍等级偏低、体力不够可能会出弹窗
await repeatOperationUntilTextFound({x: 1650,y: 1000,width: 160,height: 45,targetText: "开始挑战",stepDuration: 0,waitTime: 100,ifClick: true});//等待点击开始挑战
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
            for (let i = 1;i < 5; i++) {
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
 if(settings.teamName) await genshin.switchParty(settings.teamName);
await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像，避免有倒下的角色
await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
await restoredEnergyAutoFightAndEndDetection();//一直战斗直到检测到结束
 log.info("能量充满，任务结束");
await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
}

await restoredEnergy();
})();
