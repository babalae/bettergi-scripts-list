(async function () {

        let challengeNum = settings.challengeNum;//挑战次数
        if (challengeNum === undefined || challengeNum === ""){challengeNum = 15; }
        let challengeName = settings.challengeName;//挑战BOSS
        if (challengeName === undefined || challengeName === ""){throw new Error("挑战Boss未配置，请在JS配置中选择...")}
        let Startforward = settings.Startforward*1000 ? settings.Startforward*1000 : 1000;
        var Fighttimeout = settings.timeout * 1000 ? settings.timeout * 1000 : 240000;//战斗超时时间，默认为240秒
        const ocrRegion1 = { x: 643, y: 58, width: 800, height: 800 };   // 上方挑战成功区域
        const ocrRegion2 = { x: 780, y: 406, width: 370, height: 135 };   // 中间挑战失败区域
        // const ocrRegion3 = { x: 1782, y: 1023, width: 64, height: 29 };   // 右下角space区域
        const ocrRo1 = RecognitionObject.ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);
        const ocrRo2 = RecognitionObject.ocr(ocrRegion2.x, ocrRegion2.y, ocrRegion2.width, ocrRegion2.height);
        // const ocrRo3 = RecognitionObject.ocr(ocrRegion3.x, ocrRegion3.y, ocrRegion3.width, ocrRegion3.height);
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

        var Artifacts = settings.Artifacts ? settings.Artifacts : "保持圣遗物奖励不变"; 

        //建立一个数值映射所有圣遗物对应需要识别的图片
        var artifactImageMap = {            
            "长夜之誓 / 深廊终曲": "assets/Artifacts/artifact_1.bmp",
            "黑曜秘典 / 烬城勇者绘卷": "assets/Artifacts/artifact_2.bmp",
            "谐律异想断章 / 未竟的遐思": "assets/Artifacts/artifact_3.bmp",
            "回声之林夜话 / 昔时之歌": "assets/Artifacts/artifact_4.bmp",
            "逐影猎人 / 黄金剧团": "assets/Artifacts/artifact_5.bmp",
            "水仙之梦 / 花海甘露之光": "assets/Artifacts/artifact_6.bmp",
            "乐园遗落之花 / 沙上楼阁史话": "assets/Artifacts/artifact_7.bmp",
            "深林的记忆 / 饰金之梦": "assets/Artifacts/artifact_8.bmp",
            "来歆余响 / 辰砂往生录": "assets/Artifacts/artifact_9.bmp",
            "华馆梦醒形骸记 / 海染砗磲": "assets/Artifacts/artifact_10.bmp",
            "绝缘之旗印 / 追忆之注连": "assets/Artifacts/artifact_11.bmp",
            "昔日宗室之仪 / 染血的骑士道": "assets/Artifacts/artifact_12.bmp",
            "渡过烈火的贤人 / 炽烈的炎之魔女": "assets/Artifacts/artifact_13.bmp",
            "悠古的磐岩 / 逆飞的流星": "assets/Artifacts/artifact_14.bmp",
            "千岩牢固 / 苍白之火": "assets/Artifacts/artifact_15.bmp",
            "冰风迷途的勇士 / 沉沦之心": "assets/Artifacts/artifact_16.bmp",
            "翠绿之影 / 被怜爱的少女": "assets/Artifacts/artifact_17.bmp",
            "如雷的盛怒 / 平息鸣雷的尊者": "assets/Artifacts/artifact_18.bmp"        
        };

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
                    log.info(`识别到 ·${res1}·`);
                    if (debugcode===1){if (x===0 & y===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);return result = { text: res.text, x: res.x, y: res.y, found: true }}}else{if (x===0 & y===0){log.info("文本OCR完成'{text}'", res.text);}}
                    if (clickocr===1){await sleep(1000);click(res.x, res.y);}else{}  
                    if (clickocr===2){await sleep(100);keyPress("F");}else{}
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
            }
            const NowTime = new Date();
            if (Math.abs(NowTime - startTime)>chaotime*1000){if (x===0 & y===0){log.info(`${chaotime}秒超时退出，"${wenzi}"未找到`);}return result = {found: false };}else{ii=8;if (x !== 861){if(debugcode!==3){await keyPress("VK_W");}};}
            await sleep(100);
        }   
    }

    async function imageRecognition(imagefilePath="空参数",timeout=10,afterBehavior=0,debugmodel=0,xa=0,ya=0,wa=1920,ha=1080) {
        const startTime = new Date();
        const Imagidentify = RecognitionObject.TemplateMatch(file.ReadImageMatSync(imagefilePath));
        for (let ii = 0; ii < 10; ii++) {    
            captureRegion = captureGameRegion();  // 获取一张截图
            res = captureRegion.DeriveCrop(xa, ya, wa, ha).Find(Imagidentify);
        if (res.isEmpty()) {
            if (debugmodel===1 & xa===0 & ya===0){log.info("未识别页面元素")};
        } else {
          if (afterBehavior===1){if (xa===0 & ya===0){log.info("点击模式:开");}await sleep(1000);click(res.x+xa, res.y+ya);}else{if (debugmodel===1 & xa===0 & ya===0){log.info("点击模式:关")}}
          if (afterBehavior===2){if (xa===0 & ya===0){log.info("F模式:开");}await sleep(1000);keyPress("F");}else{if (debugmodel===1 & xa===0 & ya===0){log.info("F模式:关")}}
          if (debugmodel===1 & xa===0 & ya===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x+xa, res.y+ya, res.width+wa, res.Height+ha);}else{ log.info("识别到页面元素");}
          return result = { x: res.x+xa, y: res.y+ya, w:res.width+wa,h:res.Height+ha,found: true }
        }
        const NowTime = new Date();
        if ((NowTime - startTime)>timeout*1000){if (debugmodel===1 & xa===0 & ya===0){log.info(`${timeout}秒超时退出，未找到图片`);}return result = {found: false };}else{ii=8}
        await sleep(200); 
        }
        await sleep(1200); 
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
            keyDown("w");   
            while ((NowTime - startTime)<10*1000){
                const result = await Textocr("战斗准备",0.1,0,3,1198,492,150,80);
                const result2 = await Textocr("开始挑战",0.1,0,3,1554,970,360, 105);
                if (result.found || result2.found) {
                    await keyUp("w");
                    await keyPress("F");await sleep(200); await keyPress("F");        
                    return true;  
                }
                keyDown("w"); 
                keyPress("F");    
                NowTime = new Date();
            }
        await keyUp("w");
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
                    const successKeywords = ["挑战完成","战斗完成"];
                    const failureKeywords = ["战斗失败","挑战失败"];

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

                            // 检查失败关键词--
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
    
    // 领取奖励更换
    async function selectionHolyRelics() { 

        let artifactImagePath = artifactImageMap[Artifacts];
        // 检查artifactImagePath是否存在
        if (!artifactImagePath) {
            throw new Error(`未找到与Artifacts值'${Artifacts}'对应的图片路径`);
        }
        let modifiedPath = artifactImagePath.slice(0, -4);
        let newImagePath = modifiedPath + "in.bmp";

        await sleep(500);
        await click(116,980) // 领取奖励切换按钮
        await sleep(100);
        await click(116,980) // 领取奖励切换按钮
        await sleep(100);
        
        let rewardSettings  = await Textocr("奖励设置",15,0,0,882,34,161,52);//这个时候有人申请进入世界会遮住，真是尴尬啊，不过不影响大局。
        if (!rewardSettings.found) {await genshin.returnMainUi();return false;}
        await click(1642,159);
        await sleep(100);
        await click(1642,159);
        await sleep(100);
        
        let YOffset = 0; // Y轴偏移量，根据需要调整

         //滚轮预操作
         await moveMouseTo(1642,159);
         await sleep(100);
         await leftButtonDown();
         await sleep(100);
         await moveMouseTo(1642,155);
         
         const maxRetries = 15; // 最大重试次数
         let retries = 0; // 当前重试次数
         while (retries < maxRetries) {
             let result1 = await imageRecognition(newImagePath, 1, 0, 0,1178,148,87,857);//
             if (result1.found) {
                 await leftButtonUp();
                 await sleep(500);
                 await click(result.x-200,result.y); 
                 await sleep(1000);
                 await  keyPress("VK_ESCAPE");
                 return true   
             }
             retries++; // 重试次数加1
             //滚轮操作
             YOffset += 200;
             if (retries === maxRetries || retries+YOffset > 1920) {
                await leftButtonUp();
                await sleep(100); 
                await  keyPress("VK_ESCAPE");
                await genshin.returnMainUi(); 
                return false;}
             await moveMouseTo(1642,155+YOffset);
             await sleep(500);              
        }              

        return true;
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
        log.warn("未找到树脂，结束领取奖励...");
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
    log.warn("根目录下有建议加的黑名单的名称，建议加入自动拾取黑名单...");
    log.warn("请保证队伍战斗实力，战斗失败或执行错误，会重试一次...");
    log.warn("使用前请在 <<幽境危战>> 中配置好战斗队伍...");
    log.warn("最好关闭自动拾取功能...");  
    log.info(`圣遗物奖励选择：'${Artifacts}'`);  

    //重试两次
    for (let j = 0;j < 2;j++) {  

        resinAgain = false; //重试标志

        try{    
                await genshin.returnMainUi(); 
                await pathingScript.runFile(`assets/全自动幽境危战.json`);
                await VeinEntrance();

                // 进入-选择难道
                let intoAction  = await Textocr("单人挑战",10,0,0,1554,970,360, 105);
                if (!intoAction.found) {await genshin.returnMainUi();throw new Error("未进入挑战页面，停止执行...")}
                let adjustmentType  = await Textocr("常规挑战", 2, 0, 0,797,144,223,84);
                if (!adjustmentType.found) {
                    log.warn("未找到常规挑战，尝试切换...")
                    await sleep(500);
                    await click(890,191)                    
                }
                let hardMode  = await Textocr("困难", 2, 0, 0,1049,157,72,47);
                if (!hardMode.found) {
                    log.warn("未找到困难模式，尝试切换...")
                    await sleep(500); 
                    await click(1096,186);
                    await sleep(500); 
                    await click(1093,399);                  
                }

                //圣遗物奖励选择                
                if (Artifacts != "保持圣遗物奖励不变"){                   
                    let artifact = await imageRecognition(artifactImageMap[Artifacts],0.2,0,0,186,972,71,71);
                    if (!artifact.found) {
                        log.warn("圣遗物奖励和设定不一致，尝试切换...")
                        if (!await selectionHolyRelics()){throw new Error("圣遗物奖励设置错误，停止执行...")}
                    }
                    else
                    {                        
                        log.warn("圣遗物奖励一致，无需切换...")
                    }                    
                }

                //多点击一次，保证进入挑战页面
                await sleep(500);
                await click(intoAction.x,intoAction.y)
                await sleep(1000);
                await click(intoAction.x,intoAction.y)

                //进入秘境
                let enter  = await Textocr("Enter",10,0,0,18,990,156,71,71);
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
                        throw new Error("未知的挑战Boss类型");
                }

                //选择队员-苏婷老师-待写
                // log.warn("队伍选择功能等伟大的苏苏老师考完试做...")

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
                            let exitChallenge = await Textocr("退出挑战",2,1,0,866,719,274,86);
                            await sleep(1000); 
                            throw new Error("战斗失败，停止执行...");
                        }   
                    } catch (error) {
                        resinAgain = true;
                        if (j==0)log.info(`挑战失败，再来一次...`);
                    }    

                    if (resinAgain != true) {   
                        
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
                    }

                    //是否继续
                    if (challengeNum == i+1 || resinexhaustion == true){
                        log.info (`完成 ${i+1} 次战斗或树脂耗尽，退出挑战...`);
                        dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                        await keyPress("VK_ESCAPE"); 
                        await sleep(1000); 

                        var exitTimeout = 0;
                        while(exitTimeout < 20) {
                        let exitChallenge = await Textocr("退出挑战",0.3,0,0,866,719,274,86);
                        if (exitChallenge.found) {
                            await sleep(1500);  
                            await click(exitChallenge.x, exitChallenge.y);
                            await sleep(500);  
                            break;
                            } 
                            let exitChallenge2 = await Textocr("退出挑战",0.3,1,0,866,719,274,86);               
                            log.info("尝试退出挑战...");
                            await sleep(1500);  
                            await keyPress("VK_ESCAPE"); 
                            await sleep(1000);  
                            exitTimeout++; 
                        }                        
                        await genshin.returnMainUi(); 
                        if (resinAgain == true){throw new Error("执行错误，重试一次...")}        
                        return true;
                    }
                    await sleep(500);   
                }      
            }
        catch (error) {            
            log.error(`执行过程中发生错误：${error.message}`);
            resinAgain = true;
            await genshin.returnMainUi(); 
            continue;
        }finally{ 
            await genshin.returnMainUi();
            if (resinAgain == false) log.info(`Auto自动幽境危战结束...`);
        }
    }

})();
