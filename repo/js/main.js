(async function () {

        let challengeNum = settings.challengeNum;//挑战次数
        if (challengeNum === undefined || challengeNum === ""){challengeNum = 15; }
        let challengeName = settings.challengeName;//挑战BOSS
        if (challengeName === undefined || challengeName === ""){throw new Error("挑战Boss未配置，请在JS配置中选择...")}
        let Startforward = settings.Startforward*1000 ? settings.Startforward*1000 : 1000;
        var Fighttimeout = settings.timeout * 1000 ? settings.timeout * 1000 : 240000;//战斗超时时间，默认为240秒
        const ocrRegion1 = { x: 643, y: 58, width: 800, height: 400 };   // 上方挑战成功区域
        const ocrRegion2 = { x: 780, y: 406, width: 370, height: 135 };   // 中间挑战失败区域
        const ocrRo1 = RecognitionObject.ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);
        const ocrRo2 = RecognitionObject.ocr(ocrRegion2.x, ocrRegion2.y, ocrRegion2.width, ocrRegion2.height);
        var Rewardsuse = settings.Rewardsuse ? settings.Rewardsuse : "1/2";
        var resinTypes = Rewardsuse.split("/");
        var rewards = [];
        var onerewards, secendrewards, threendrewards, fourdrewards;  
        for (var i = 0; i < resinTypes.length; i++) {
            var resinType = parseInt(resinTypes[i]);
            if (isNaN(resinType) || resinType < 1 || resinType > 4) {
                throw new Error("设定的树脂类型无效或缺失，请重新配置");
            }
            rewards.push(resinType);
        }
        const resinTypeMap = ["","使用1个浓缩树脂，获取2倍产出", "使用20个原粹树脂", "使用1个脆弱树脂，获取3倍产出", "使用1个须臾树脂，获取3倍产出"];
        // 根据 rewards 数组长度，依次赋值给对应的变量
        if (rewards.length > 0) onerewards = resinTypeMap[rewards[0]];
        if (rewards.length > 1) secendrewards = resinTypeMap[rewards[1]];
        if (rewards.length > 2) threendrewards = resinTypeMap[rewards[2]];
        if (rewards.length > 3) fourdrewards = resinTypeMap[rewards[3]];    

        log.info(`使用树脂类型数量：${rewards.length}`);
        log.info(`优先使用的树脂类型：${onerewards} --> ${secendrewards??"无"} --> ${threendrewards??"无"} --> ${fourdrewards??"无"}`);

        const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测
        var advanceNum = 0;//前进次数
        var verticalNum = 0;

    async function Textocr(wenzi="空参数",chaotime=10,clickocr=0,debugcode=0,x=0,y=0,w=1920,h=1080) {
        const startTime = new Date();
        for (let ii = 0; ii < 10; ii++) 
        {    
            // 获取一张截图
            let captureRegion = captureGameRegion();
            let  res1
            // 对整个区域进行 OCR
            let resList = captureRegion.findMulti(RecognitionObject.ocr(x,y,w,h));
            //log.info("OCR 全区域识别结果数量 {len}", resList.count);   
            for (let i = 0; i < resList.count; i++) 
            { // 遍历的是 C# 的 List 对象，所以要用 count，而不是 length
                let res = resList[i];
                res1=res.text
                if (res.text===wenzi) {
                    log.info(`·${res1}·找到`);
                    if (debugcode===1){if (x===0 & y===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);return result = { text: res.text, x: res.x, y: res.y, found: true }}}else{if (x===0 & y===0){log.info("文本OCR完成'{text}'", res.text);}}
                    if (clickocr===1){await sleep(1000);click(res.x, res.y);}else{}  
                    if (clickocr===2){await sleep(100);keyPress("F");}else{}
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
            }
            const NowTime = new Date();
            if (Math.abs(NowTime - startTime)>chaotime*1000){if (x===0 & y===0){log.info(`${chaotime}秒超时退出，"${wenzi}"未找到`);}return result = {found: false };}else{ii=8;if (x !== 861){await keyPress("VK_W");};}
            await sleep(100);
        }   
    }

    //征讨之花领奖
    const autoNavigateToReward = async () => {
            // 定义识别对象
            const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));
            const rewardTextRo = RecognitionObject.Ocr(1210, 515, 200, 50);//领奖区域检测

            advanceNum = 0;//前进次数
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
                if (rewardResult.text == "激活地脉之花") {
                    log.info("已到达领奖点，检测到文字: " + rewardResult.text);
                    return true;
                }
                else if(advanceNum > 80){
                throw new Error('前进时间超时');
                }
                // 2. 未到达领奖点，则调整视野
                for(let i = 0; i < 100; i++){
                captureRegion = captureGameRegion();
                let iconRes = captureRegion.Find(boxIconRo);
                let climbTextArea = captureRegion.DeriveCrop(1808, 1030, 25, 25);
                let climbResult = climbTextArea.find(RecognitionObject.ocrThis);
                // 检查是否处于攀爬状态
                if (climbResult.isEmpty()){
                log.info("检侧到页面错误，尝试脱离");
                let SHU = Textocr("地脉之花", 0.3, 1, 0, 861,265, 194, 265);
                if (SHU.found){return true;}
                await keyDown("w");
                await keyPress("VK_ESCAPE"); 
                await sleep(500);
                await keyDown("w");
                await sleep(5000);
                await keyUp("w");            
                }
                if (iconRes.x >= 920 && iconRes.x <= 980 && iconRes.y <= 540) {    
                    advanceNum++;
                    log.info(`视野已调正，前进第${advanceNum}次`);
                    break;
                } else {
                    // 小幅度调整
                    if(iconRes.y >= 520)  moveMouseBy(0, 920);
                    let adjustAmount = iconRes.x < 920 ? -20 : 20;
                    let distanceToCenter = Math.abs(iconRes.x - 920); // 计算与920的距离
                    let scaleFactor = Math.max(1, Math.floor(distanceToCenter / 50)); // 根据距离缩放，最小为1
                    let adjustAmount2 = iconRes.y < 540 ? scaleFactor : 10;
                    moveMouseBy(adjustAmount * adjustAmount2, 0);
                    await sleep(100);
                }         
                
                if(i > 97) {    
                    if (verticalNum >= 2) {
                        verticalNum = 0;
                        throw new Error('领取超时');              
                    }  
                    log.info("领取超时，重新尝试1次");
                    await genshin.returnMainUi(); await sleep(1000);//退出待写
                    return false;
                } 
            }
            // 3. 前进一小步
            keyDown("w");
            await sleep(600);
            keyUp("w");
            await sleep(100); // 等待角色移动稳定
            let earthlyVeins = await Textocr("地脉之花", 0.1, 0, 0, 861,265, 194, 265)
            if (earthlyVeins.found) {
                return true;
            }
        }
    }

    async function readyFightIn(){
            var startTime = new Date();
            await sleep(500);
            var NowTime = new Date();
            var getshu = 0;
            var lastIncrementTime = 0; // 上次增加getshu的时间
            const intervalTime = 500; // 3秒的时间间隔，单位为毫秒
            while ((NowTime - startTime)<10*1000){
                const result = await Textocr("战斗准备",0.1,0,0,1198,492,150,80);
                const result2 = await Textocr("开始挑战",0.1,0,0,1554,970,360, 105);
                if (result.found || result2.found) {
                    await keyPress("F");await sleep(200); await keyPress("F");
                    const currentTime = new Date().getTime();
                    if (currentTime - lastIncrementTime >= intervalTime) {
                        getshu++;
                        lastIncrementTime = currentTime;        
                    }            
                    return true;  
                }
                await keyDown("w");
                await sleep(200);
                await keyUp("w");
                NowTime = new Date();
            }
        await genshin.returnMainUi();
        return false
    }

    //异步检测战斗，来自D捣蛋&秋云佬的全自动地脉花的代码
    async function autoFight(timeout) {
        const cts = new CancellationTokenSource();
        log.info("开始战斗");
        dispatcher.RunTask(new SoloTask("AutoFight"), cts);
        let fightResult = await recognizeTextInRegion(timeout);
        logFightResult = fightResult ? "成功" : "失败";
        log.info(`战斗结束，战斗结果：${logFightResult}`);
        cts.cancel();
        return fightResult;}


    async function recognizeTextInRegion(timeout) {
        return new Promise((resolve, reject) => {
            (async () => {
                try {
                    let startTime = Date.now();
                    let noTextCount = 0;
                    const successKeywords = ["挑战完成"];
                    const failureKeywords = ["战斗失败"];

                    // 循环检测直到超时
                    while (Date.now() - startTime < timeout) {
                        try {
                            let captureRegion = captureGameRegion();
                            let result = captureRegion.find(ocrRo1);
                            let result2 = captureRegion.find(ocrRo2);
                            let text = result.text;
                            let text2 = result2.text;

                            // 检查成功关键词
                            for (let keyword of successKeywords) {
                                if (text.includes(keyword)) {
                                    log.info("检测到战斗成功关键词: {0}", keyword);
                                    resolve(true);
                                    return;
                                }
                            }

                            // 检查失败关键词--待写
                            for (let keyword of failureKeywords) {
                                if (text2.includes(keyword)) {
                                    log.warn("检测到战斗失败关键词: {0}", keyword);
                                    resolve(false);
                                    return;
                                }
                            }                        
                        }
                        catch (error) {
                            log.error("OCR过程中出错: {0}", error);
                        }

                        await sleep(1000); // 检查间隔
                    }

                    log.warn("在超时时间内未检测到战斗结果");
                    resolve(false);
                } catch (error) {
                    reject(error);
                }
            })();
        });
    }    

    async function claimRewards() {
        log.info(`尝试领取奖励，优先${onerewards}'`);
        let SHUN01 = await Textocr("激活地脉之花",0.6,2,0,1188,358,200,400);
        let SHUN02 = await Textocr("地脉之花", 0.2, 0, 0, 861,265, 194, 265);
        if (SHUN01.found || SHUN02.found) {
            log.info("找到地脉之花，开始领取奖励...");
        }
        else
        {        
            log.warn("未找到地脉之花，尝试向前寻找...")           
            await keyDown("W");await sleep(300);await keyUp("W"); 
            await keyPress("F");      
        }

        await sleep(300);

        for (let j = 0;j < 2;j++) {

            for (let i = 0;i < rewards.length;i++) {
                let SHU =  await Textocr(resinTypeMap[rewards[i]],0.3,0,0,510,380,640,600);
                if (SHU.found){
                    if (resinTypeMap[rewards[i]] == "使用20个原粹树脂")
                    {
                    let BUC =  await Textocr("补充",0.2,0,0,1150,440,210,130);
                        if (BUC.found) {continue;}                                           
                    }
                    await sleep(100);
                    await click(SHU.x+550,SHU.y)
                    await sleep(100);
                    await click(SHU.x+550,SHU.y)
                    await sleep(300);
                    log.info(` ${resinTypeMap[rewards[i]]} 获取奖励...`);
                    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: true }));
                    dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
                    return true;
                }            
            }
            await sleep(500);  
        }
        log.warn("未找到树脂，结束地脉花...");
        dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
        await sleep(1000);        
        await keyPress("VK_ESCAPE");  //退出待写
        await sleep(1000);      
        return false;           
    }

    async function VeinEntrance() {
        for (let i = 0;i < 2;i++) {
            let JIECHU = await Textocr("F",2,2,0,1098,519,35,32);
            if (JIECHU.found)
            {
                await keyPress("F");await dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));await keyPress("F");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
                break;
            }
            else{
                if(i == 1)
                {
                log.warn("没找入口，尝试强制转圈寻找...");  
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("W");await sleep(500);await keyUp("W"); 
                await keyDown("D");await sleep(500);await keyUp("D");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("S");await sleep(500);await keyUp("S");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("A");await sleep(500);await keyUp("A");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("W");await sleep(500);await keyUp("W");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
                break;
            }
            }
        }
        dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
    }
   
    var resinAgain = false;
    log.warn("使用前请在 <<幽境危战>> 中配置好战斗队伍...");
    log.warn("使用前请在 <<幽境危战>> 中配置指定 <<奖励设置>>...");
    log.warn("根目录下有建议加的黑名单的名称，建议加入自动拾取黑名单...");
    log.warn("请保证队伍战斗实力，目前战斗失败会自动退出秘境...");
    log.warn("最好关闭自动拾取功能...");    

    // for (let j = 0;j < 2;j++) {

        await genshin.returnMainUi(); 
        await pathingScript.runFile(`assets/全自动幽境危战.json`);
        await VeinEntrance();
    
        try{    
                //进入
                let intoAction  = await Textocr("单人挑战",10,0,0,1554,970,360, 105);
                if (!intoAction.found) {await genshin.returnMainUi();throw new Error("未进入挑战页面，停止执行...")}
                let adjustmentType  = await Textocr("常规挑战", 2, 0, 0,797,144,223,84);
                if (!adjustmentType.found) {
                    await click(890,191)
                    await sleep(1000); 
                    await click(1096,186);
                    await sleep(1000); 
                    await click(1093,399);
                    await sleep(1000); 
                }
                await sleep(1000);
                await click(intoAction.x,intoAction.y)
                await sleep(1000);
                await click(intoAction.x,intoAction.y)

                //进入秘境
                let enter  = await Textocr("Enter",5,0,0,18,990,156,80);
                if (!enter.found) {await genshin.returnMainUi();throw new Error("未进入秘境，停止执行...")}//退出待写

                //向前走进入挑战
                if (!(await readyFightIn())){await genshin.returnMainUi();throw new Error("未进入准备战斗，停止执行...")}//退出待写
                await sleep(1000);

                //选择挑战怪兽
                log.info(`选择挑战Boss：'${challengeName}' 挑战次数：'${challengeNum}'`);
                log.info(`期间树脂耗尽会自动退出秘境...`);

                switch (challengeName) {
                    case "1":
                        await click(207,349);
                        break;
                    case "2":
                        await click(239,531);
                        break;
                        case "3":
                        await click(227,713);
                        break;
                    default:
                        throw new Error("未知的挑战怪兽类型");
                }
                await Textocr("开始挑战",1,1,0,1554,970,360, 105);               

                var resinexhaustion = false; // 条件1：树脂耗尽

                //开始战斗循环    
                for (let i = 0;i < challengeNum; i++) {
                    //进入秘境
                    let battleBegins  = await Textocr("战斗开始",20,0,0,877,235,164,50);     
                    if (!battleBegins.found){await genshin.returnMainUi();throw new Error("未进入战斗环境，停止执行...")}//退出待写
                    
                    log.info(`进入战斗环境，开始第${i+1}次战斗`);

                    await keyDown("w");
                    await sleep(Startforward);
                    await keyUp("w");

                    try {
                        if(!await autoFight(Fighttimeout)){
                            log.warn("战斗失败,退出秘境...");
                            await sleep(1000);
                            await keyPress("VK_ESCAPE"); 
                            await sleep(1000);
                             await keyPress("VK_ESCAPE"); 
                            await sleep(1000);
                            resinAgain = true;//待开发重试
                            let exitChallenge = await Textocr("退出挑战",2,1,0,866,719,274,86);
                            return false;
                        }   
                    } catch (error) {
                        log.info(`挑战失败，再来一次`);
                        if(!await autoFight(Fighttimeout)){
                            log.warn("战斗超时失败,尝试寻找地脉花入口");
                        }  
                    }    

                    // if (resinAgain == true) 

                    await sleep(1000);
                    await keyPress("VK_ESCAPE"); 
                    await sleep(1000);

                    while((await Textocr("Enter",5,0,0,18,990,156,80).found) == false)
                    {
                        await keyPress("VK_ESCAPE"); 
                        await sleep(1000);
                    }  

                    log.info(`第${i+1}次领奖`);

                    if(!(await autoNavigateToReward())){verticalNum++;continue;}
                
                    await sleep(1000);
                
                    if (!(await claimRewards())) {
                        log.warn("树脂消耗完毕，结束任务");        
                        resinexhaustion = true;
                    }
                    else
                    {
                        if (challengeNum != i+1) 
                        {
                            let challengeAgian  = await Textocr("再次挑战",10,1,0,1094,958,200,70);
                        }
                    }
                    
                    //是否继续
                    if (challengeNum == i+1 || resinexhaustion == true){
                        log.info (`完成 ${i+1} 次战斗或树脂耗尽，退出挑战...`);
                        dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                        await keyPress("VK_ESCAPE"); 
                        await sleep(1000); 

                        var exitTimeout = 0;
                        while(exitTimeout < 20)
                        {
                        let exitChallenge = await Textocr("退出挑战",0.3,0,0,866,719,274,86);
                        if (exitChallenge.found) {
                            await sleep(600);  
                            await click(exitChallenge.x, exitChallenge.y);
                            await sleep(500);  
                            break;
                            }                
                            log.info("尝试退出挑战...");
                            await sleep(1000);  
                            await keyPress("VK_ESCAPE"); 
                            await sleep(1000);  
                            exitTimeout++; 
                        }                        
                        await genshin.returnMainUi();            
                        return false;
                    }

                    await sleep(500);   
                }    
            
        }
        catch (error) {
            log.error(`执行过程中发生错误：${error.message}`);
        }finally{ 
            log.info(`Auto自动幽境危战结束...`);
        }
    // }

})();
