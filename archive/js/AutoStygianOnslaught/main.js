(async function () {

        let challengeNum = settings.challengeNum;//挑战次数
        if (challengeNum === undefined || challengeNum === ""){challengeNum = 15; }//挑战次数
        let challengeName = settings.challengeName;//挑战BOSS
        if (challengeName === undefined || challengeName === ""){throw new Error("挑战Boss未配置，请在JS配置中选择...")}//初始化处理
        let Startforward = settings.Startforward*1000 ? settings.Startforward*1000 : 1000;//开始战斗的前进时间
        var Fighttimeout = settings.timeout * 1000 ? settings.timeout * 1000 : 240000;//战斗超时时间，默认为240秒
        const ocrRegion1 = { x: 643, y: 58, width: 800, height: 800 };   // 上方挑战成功区域
        const ocrRegion2 = { x: 780, y: 406, width: 370, height: 135 };   // 中间挑战失败区域
        const ocrRo1 = RecognitionObject.ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);//上方挑战成功区域OCR对象
        const ocrRo2 = RecognitionObject.ocr(ocrRegion2.x, ocrRegion2.y, ocrRegion2.width, ocrRegion2.height);//中间挑战失败区域OCR对象
        var Rewardsuse = settings.Rewardsuse ? settings.Rewardsuse : "1/2";//树脂使用类型，默认为1/2，即浓缩树脂和原粹树脂
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
        const resinTypeMap = ["","使用1个浓缩树脂，获取2倍产出", "使用20个原粹树脂", "使用1个脆弱树脂，获取3倍产出", "使用1个须臾树脂，获取3倍产出"];//识别树脂领奖文字
        const golbalRewards = ["","浓缩树脂","原粹树脂","脆弱树脂","须臾树脂"]; // 对应四种树脂
        // 根据 rewards 数组长度，依次赋值给对应的变量
        if (rewards.length > 0) onerewards = golbalRewards[rewards[0]];
        if (rewards.length > 1) secendrewards = golbalRewards[rewards[1]];
        if (rewards.length > 2) threendrewards = golbalRewards[rewards[2]];
        if (rewards.length > 3) fourdrewards = golbalRewards[rewards[3]];
        const golbalRewardText = [onerewards, secendrewards, threendrewards, fourdrewards].filter(Boolean);//过滤树脂使用类型

        var advanceNum = 0;//前进寻找地脉之花次数
        var verticalNum = 0;//重试寻找地脉之花次数
        var resinAgain = false;//是否重试标志

        var Artifacts = settings.Artifacts ? settings.Artifacts : "保持圣遗物奖励不变"; 

        //映射所有圣遗物对应需要识别的图片
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

        //树脂识别图片
        var condensedResin = "assets/condensed_resin_count.png";
        var originalResin = "assets/original_resin_count.png";
        var fragileResin = "assets/fragile_resin_count.png";
        var momentResin = "assets/moment_resin_count.png";
        var oneResin = "assets/one.png";

    //文字识别封装函数
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
                    if (clickocr===1){await sleep(1000);await click(res.x, res.y);}else{}  
                    if (clickocr===2){await sleep(100);await keyPress("F");}else{}
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
                if (debugcode===2 && !res.isEmpty()){
                    // log.info("({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
            }
            const NowTime = new Date();
            if (Math.abs(NowTime - startTime)>chaotime*1000){if (x===0 & y===0){log.info(`${chaotime}秒超时退出，"${wenzi}"未找到`);}return result = {found: false };}else{ii=8;if (x !== 861){if(debugcode!==3){await keyPress("VK_W");}};}
            await sleep(100);
        }   
    }

    // 图片识别封装函数
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
          if (debugmodel===1 & xa===0 & ya===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x+xa, res.y+ya, res.width, res.Height);}else{ log.info("识别到页面元素");}
          
          return result = { x: res.x+xa, y: res.y+ya, w:res.width,h:res.Height,found: true }
        }
        const NowTime = new Date();
        if ((NowTime - startTime)>timeout*1000){if (debugmodel===1 & xa===0 & ya===0){log.info(`${timeout}秒超时退出，未找到图片`);}return result = {found: false };}else{ii=8}
        await sleep(200); 
        }
        await sleep(1200); 
    }

    //树脂数量获取函数
    async function getRemainResinStatus() {
        var condensedResinCount = 0; // 浓缩树脂
        var originalResinCount = 0; // 原粹树脂
        var fragileResinCount = 0; // 脆弱树脂 
        var momentResinCount = 0; // 须臾树脂

        var originalResinCountRa = await imageRecognition(originalResin,0.3, 0, 0,1500,0,200,90);
        if (originalResinCountRa.found) {  
            // await moveMouseTo(originalResinCountRa.x,originalResinCountRa.y);   
            let countArea = await Textocr("",1, 0, 2,originalResinCountRa.x+originalResinCountRa.w,originalResinCountRa.y,originalResinCountRa.w*3,originalResinCountRa.h);//
            if (countArea.found){
                log.info("原粹树脂识别数量结果："+ countArea.text);
                let match = countArea.text.match(/(\d+)\s*[/1]\s*(2|20|200)/);
                if (match) {
                    originalResinCount = match[1];
                    // log.info("脆弱树脂识别数量提取："+ originalResinCount);
                }
                else{
                    log.info("原粹树脂识别数量提取失败");
                }                
            }
            else{
                log.info("原粹树脂识别数量结果：：无");
            }

        } else {
            log.info("未检测到原粹树脂图标");
        }

        // 浓缩树脂
        var condensedResinCountRa = await imageRecognition(condensedResin,0.1, 0, 0,960,0,800,100);
        if (condensedResinCountRa.found) {  
            // await moveMouseTo(condensedResinCountRa.x,condensedResinCountRa.y);   
            let countArea = await Textocr("",0.5, 0, 2,condensedResinCountRa.x+condensedResinCountRa.w,condensedResinCountRa.y,condensedResinCountRa.w,condensedResinCountRa.h);//
            if (countArea.found){
                // log.info("浓缩树脂识别数量结果： "+ countArea.text);
                condensedResinCount = countArea.text
            }
            else{
                condensedResinCount = "1";
                log.info("浓缩树脂识别数量结果：1");//不知道为什么，1无法识别，0是不显示图标的，所以就当时1了，反正也没啥影响
            }

        } else {
            log.info("未检测到浓缩树脂图标");
        }       

        var momentResinCountRa = await imageRecognition(momentResin,0.1, 0, 1,1170,0,300,100);
        if (momentResinCountRa.found) {  
            // await moveMouseTo(momentResinCountRa.x,momentResinCountRa.y);   
            let countArea = await Textocr("",0.5, 0, 2,momentResinCountRa.x+momentResinCountRa.w+20,momentResinCountRa.y-15,60,40);//
            if (countArea.found){
                //log.info("须臾树脂识别数量结果："+ countArea.text);
                momentResinCount = countArea.text                
            }
            else{                
                var oneRa = await imageRecognition(oneResin,0.1, 0, 1,momentResinCountRa.x+momentResinCountRa.w+20,momentResinCountRa.y-15,60,40);
                if (oneRa.found){
                    momentResinCount = "1";
                 }else{
                    log.info("须臾树脂强制为 1 ");
                    momentResinCount = "1";
                }
            }
            log.info("脆弱树脂强制为 1 ");//须臾树脂出现，脆弱树脂不显示，强制设置为1，情况非常少，大不了打多一次
            fragileResinCount = "1";
        }else
        { 
            var fragileResinCountRa = await imageRecognition(fragileResin,0.1, 0, 1,1170,0,300,100);
            if (fragileResinCountRa.found) {  
                // await moveMouseTo(fragileResinCountRa.x+fragileResinCountRa.w+20,fragileResinCountRa.y-15);   
                let countArea = await Textocr("",0.5, 0, 2,fragileResinCountRa.x+fragileResinCountRa.w+20,fragileResinCountRa.y-15,60,40);//
                if (countArea.found){
                    // log.info("脆弱树脂识别数量结果："+ countArea.text);
                    fragileResinCount = countArea.text
                }
                else{
                    var oneRa = await imageRecognition(oneResin,0.1, 0, 1,fragileResinCountRa.x+fragileResinCountRa.w+20,fragileResinCountRa.y-15,60,40);
                    if (oneRa.found){
                        fragileResinCount = "1";
                    }else{
                        fragileResinCount = "1";
                        log.info("脆弱树脂识别强制为 1 ");//有图标说明至少为1
                    }
                }
            } 
            else {
                 log.info("未检测到脆弱树脂图标");          
            }
        }

        log.info("树脂状态：浓缩{0} 原粹{1} 脆弱{2} 须臾{3}", condensedResinCount, originalResinCount, fragileResinCount,momentResinCount)
        return {condensedResinCount,originalResinCount,fragileResinCount,momentResinCount}
    }
    
    //征讨之花领奖寻找函数
    const autoNavigateToReward = async () => {
        // 定义识别对象
        const boxIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/box.png"));
        
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
            else if(advanceNum > 40){
                await getOut();
                await await genshin.returnMainUi();
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
                    let SHU = Textocr("地脉之花", 0.3, 1, 0, 840,225, 230, 125);
                    if (SHU.found){
                        return true;
                    }
                    log.info("检侧到页面错误，尝试脱离");
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
                        await getOut();
                        await await genshin.returnMainUi();
                        throw new Error('领取超时');              
                    }  
                    log.info("领取超时，重新尝试1次");
                    await sleep(1000);
                    return false;
                } 
            }
            // 3. 前进一小步
            keyDown("w");
            await sleep(600);
            keyUp("w");
            await sleep(100); // 等待角色移动稳定
            let earthlyVeins = await Textocr("地脉之花", 0.1, 0, 0, 840,225, 230, 125)
            if (earthlyVeins.found) {
                return true;
            }
        }
    }

    //向前寻找钥匙函数
    async function readyFightIn(){
            var startTime = new Date();
            await sleep(500);
            var NowTime = new Date();
            keyDown("w");   
            while ((NowTime - startTime)<15*1000){
                const result =  await Textocr("战斗准备",0,0,3,1198,492,150,80);
                const result2 =  await Textocr("开始挑战",0,0,3,1554,970,360, 105);
                if (result.found || result2.found) {                    
                    keyPress("F");keyPress("F");keyPress("F");keyPress("F");       
                    keyUp("w");      
                    return true;  
                }
                keyDown("w"); 
                keyPress("F");    
                NowTime = new Date();
            }
        await keyUp("w");
        return false
    }

    //异步检测战斗执行函数，来自D捣蛋&秋云佬的全自动地脉花的代码
    async function autoFight(timeout) {
        const cts = new CancellationTokenSource();
        log.info("开始战斗");
        dispatcher.RunTask(new SoloTask("AutoFight"), cts);
        let fightResult = await recognizeTextInRegion(timeout);
        logFightResult = fightResult ? "成功" : "失败";
        log.info(`战斗结束，战斗结果：${logFightResult}`);
        cts.cancel();
        return fightResult;
    }

    //异步检测战斗结果函数
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
    
    //圣遗物奖励更换函数
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
         
         const maxRetries = 9; // 最大重试次数
         let retries = 0; // 当前重试次数
         while (retries < maxRetries) {
             let result1 = await imageRecognition(newImagePath,1, 0, 0,1166,141,210,857);//
             if (result1.found) {
                 await leftButtonUp();
                 await sleep(500);
                 await click(result.x-500,result.y); 
                 await sleep(1000);
                 await  keyPress("VK_ESCAPE");
                 return true   
             }
             retries++; // 重试次数加1
             //滚轮操作
             YOffset += 100;
             if (retries === maxRetries || retries+YOffset > 1080) {
                await leftButtonUp();
                await sleep(100); 
                await  keyPress("VK_ESCAPE");
                await genshin.returnMainUi(); 
                return false;
            }
             await moveMouseTo(1642,155+YOffset);
             await sleep(500);              
         }              

        return true;
    }

    // 领取奖励函数
    async function claimRewards() {
        // log.info(`尝试领取奖励，优先${onerewards}'`);
        let SHUN01 = await Textocr("激活地脉之花",0.6,2,0,1188,358,200,400);
        let SHUN02 = await Textocr("地脉之花", 0.2, 1, 0, 840,225, 230, 125);
        if (SHUN01.found || SHUN02.found) {
            log.info("找到地脉之花，开始领取奖励...");
        }
        else
        {        
            log.warn("未找到地脉之花，尝试向前寻找...")           
            await keyDown("W");await sleep(300);await keyUp("W"); 
            await keyPress("F");
            await sleep(1000);       
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
                    log.info(`${resinTypeMap[rewards[i]]} 获取奖励...`);
                    
                    await Textocr("锁定辅助",10,0,0,1768,0,115,90);
                    let { condensedResinCount, originalResinCount, fragileResinCount , momentResinCount} = await getRemainResinStatus();                        
                    let shouldExit = true;
                
                    if (resinTypes.includes("1"))
                    {
                        shouldExit &= (parseInt(condensedResinCount, 10) == 0);
                    }
                    if (resinTypes.includes("2"))
                    {
                        shouldExit &= (parseInt(originalResinCount, 10) < 20);
                    }
                    if (resinTypes.includes("3"))
                    {
                        shouldExit &= (parseInt(fragileResinCount, 10)  == 0);
                    }
                    if (resinTypes.includes("4"))
                    {
                        shouldExit &= (parseInt(momentResinCount, 10)  == 0);
                    }

                    if (shouldExit) 
                    {
                        await sleep(1000);        
                        await keyPress("VK_ESCAPE"); 
                        await sleep(1000);      
                        return false;     
                    }               
                    log.warn("还有树脂...");          
                    return true;
                }        
            }
            await sleep(500);  
        }
        log.warn("未找到树脂，结束领取奖励...");
        await sleep(1000);        
        await keyPress("VK_ESCAPE"); 
        await sleep(1000);      
        return false;           
    }

    // 进入秘境入口函数
    async function VeinEntrance() {
        for (let i = 0;i < 2;i++) {
            let JIECHU = await Textocr("F",2,2,0,1098,519,35,32);
            if (JIECHU.found)
            {
                await keyPress("F");
                await keyPress("F");
                break;
            }
            else
            {
                if(i == 1){
                log.warn("没找入口，尝试强制转圈寻找...");  
                await keyDown("W");keyPress("F");await sleep(500);keyPress("F");await keyUp("W"); 
                await keyDown("D");keyPress("F");await sleep(500);keyPress("F");await keyUp("D");
                await keyDown("S");keyPress("F");await sleep(500);keyPress("F");await keyUp("S");
                await keyDown("A");keyPress("F");await sleep(500);keyPress("F");await keyUp("A");
                await keyDown("W");keyPress("F");await sleep(500);keyPress("F");await keyUp("W");
                break;
                }
            }
        }
    }  
   
    //秘境内退出函数
    async function getOut() {

        for (let i = 0;i < 2;i++){
            log.info("尝试退出挑战...");   
            await keyPress("VK_ESCAPE"); 
            await sleep(1000);
            let exitChallenge0 = await Textocr("退出挑战",0.5,1,0,866,719,274,86);
            await sleep(1000);
            await keyPress("VK_ESCAPE"); 
            await sleep(1000);                                 
            let exitChallenge1 = await Textocr("退出挑战",0.5,1,0,866,719,274,86);
            await sleep(1000);
            await keyPress("VK_ESCAPE");
            await sleep(1000); 
            let exitChallenge2 = await Textocr("退出挑战",0.5,1,0,866,719,274,86);
            if (!exitChallenge2.found){break}
        }   

    }

    log.warn("自动幽境危战版本：v1.6");
    log.warn("请保证队伍战斗实力，战斗失败或执行错误，会重试两次...");
    log.warn("使用前请在 <<幽境危战>> 中配置好战斗队伍...");
    log.info("使用树脂类型数量：{0} ", rewards.length)
    log.info(`使用树脂顺序：${golbalRewardText.join(" ->")}`);     
    log.info("圣遗物奖励选择：{0} ", Artifacts)

    //重试两次
    for (let j = 0;j < 2;j++) {  

        resinAgain = false; //重试标志

        try{    
                //1.导航进入页面
                await genshin.returnMainUi(); 
                await pathingScript.runFile(`assets/全自动幽境危战.json`);
                await VeinEntrance();

                //2.难度确认和选择
                let intoAction  = await Textocr("单人挑战",10,0,0,1554,970,360, 105);
                if (!intoAction.found){
                    await genshin.returnMainUi();
                    throw new Error("未进入挑战页面，停止执行...")
                }
                let adjustmentType  = await Textocr("至危挑战", 1, 0, 0,797,144,223,84);
                if (adjustmentType.found) {
                    log.warn("找到至危挑战，尝试切换...")
                    await sleep(500);
                    await click(adjustmentType.x,adjustmentType.y) 
                    await sleep(500);                    
                }
                let hardMode  = await Textocr("困难", 0.3, 0, 0,1049,157,72,47);
                let hardMode2  = await Textocr("困难", 0.2, 0, 0,805,156,83,47);
                if (hardMode.found || hardMode2.found) {
                    log.warn("确认困难模式...")
                }
                else{
                    log.warn("未找到困难模式，尝试切换...")
                    await sleep(500); 
                    await click(1096,186);
                    await sleep(500); 
                    await click(1093,399);  
                }

                //3.圣遗物奖励选择                
                if (Artifacts != "保持圣遗物奖励不变"){                   
                    let artifact = await imageRecognition(artifactImageMap[Artifacts],0.2,0,0,186,972,71,71);
                    if (!artifact.found) {
                        log.warn("圣遗物奖励和设定不一致，尝试切换...")
                        if (!await selectionHolyRelics()){await genshin.returnMainUi();throw new Error("圣遗物奖励设置错误，停止执行...")}
                    }
                    else{    
                        log.warn("圣遗物奖励一致，无需切换 {0} ", Artifacts)                 
                    }                    
                }

                //4.进入秘境
                await sleep(500);
                await click(intoAction.x,intoAction.y)
                await sleep(1000);
                await click(intoAction.x,intoAction.y)
                let enter  = await Textocr("Enter",15,0,0,18,990,156,71,71);
                if (!enter.found){
                    await genshin.returnMainUi();
                    throw new Error("未进入秘境，停止执行...")
                }

                //5.向前走进入挑战
                if (!(await readyFightIn())){
                    await getOut();
                    await genshin.returnMainUi();
                    throw new Error("未进入准备战斗，停止执行...")
                }
                await sleep(1000);

                //6.选择挑战boss
                log.info("选择挑战Boss：'{0}' 挑战次数：'{1}'", challengeName,challengeNum)
                log.info(`期间树脂耗尽会自动退出秘境...`);
                const clickCoordinates = [ { x: 207, y: 349 }, { x: 239, y: 531 }, { x: 227, y: 713 } ]; // Boss坐标1~3            
                await click(clickCoordinates[challengeName - 1].x, clickCoordinates[challengeName - 1].y);
                             
                //6.5选择队员-苏婷老师-待写
                //log.warn("队伍选择功能等伟大的苏苏老师考完试做...")

                //7.开始挑战
                await Textocr("开始挑战",1,1,0,1554,970,360, 105);               
                var resinexhaustion = false; // 条件1：树脂耗尽

                //8.战斗循环    
                for (let i = 0;i < challengeNum; i++) {

                    log.info("进入战斗环境，开始第 {0} 次战斗", i+1)  

                    //8.1自动战斗                                  
                    for (let fightCount = 0; fightCount < 3; fightCount++) {

                        let battleBegins  = await Textocr("战斗开始",20,0,0,877,235,164,50);     
                        if (!battleBegins.found){
                            await getOut();
                            throw new Error("未进入战斗环境，停止执行...")
                        }

                        try {
                            await keyDown("w");
                            await sleep(Startforward);
                            await keyUp("w");

                            if(!await autoFight(Fighttimeout)){

                                resinAgain = true;

                                if (fightCount >= 2){
                                    await sleep(1000);
                                    await keyPress("VK_ESCAPE"); 
                                    await sleep(1000); 
                                    break;
                                }
                                else
                                {                                    
                                    let Again = await Textocr("再次挑战",10,1,0,1059,920,177,65);
                                    if (!Again.found)break;                                       
                                    await sleep(1000); 
                                    log.warn("战斗失败，第 {0} 次重试...", fightCount+1)  
                                    throw new Error(`战斗失败，第 ${fightCount+1} 次重试...`)
                                }  

                            }else
                            {
                                resinAgain= false;
                                break;
                            }
                        } catch (error) {                            
                            if (fightCount < 2)continue;
                            else break;
                        }   
                    }

                    //8.2领取奖励                   
                    if (resinAgain != true) {   
                        
                        await sleep(1000);
                        await keyPress("VK_ESCAPE"); 
                        await sleep(1000);

                        while((await Textocr("Enter",5,0,0,18,990,156,80).found) == false)
                        {
                            await keyPress("VK_ESCAPE"); 
                            await sleep(1000);
                        }  

                        log.info("幽境危战：第 {0} 次领奖...", i+1) 

                        if(!(await autoNavigateToReward())){verticalNum++;continue;}
                    
                        await sleep(1000);
                    
                        if (!(await claimRewards())) {       
                            resinexhaustion = true;
                        }
                        else
                        {
                            if (challengeNum != i+1) 
                            {   
                                let challengeAgian  = await Textocr("再次挑战",10,0,0,1094,958,200,70);
                                if (!challengeAgian.found){
                                    await getOut();
                                    throw new Error("未找到·再次挑战·按键，停止执行...")
                                }
                                for (let retry = 0; retry < 5 && challengeAgian.found; retry++) {
                                    challengeAgian  = await Textocr("再次挑战",0.2,0,0,1094,958,200,70);
                                    if (challengeAgian.found){                                    
                                    await sleep(500);  
                                    await click(challengeAgian.x, challengeAgian.y);
                                    await sleep(1000);  
                                    } 
                                    await sleep(200);                                                                                          
                                } 
                                let resinTips  = await Textocr("提示",2,0,0,840,225, 230, 125);
                                if (resinTips.found){
                                    await sleep(1000); 
                                    await keyPress("VK_ESCAPE"); 
                                    await sleep(200);
                                    log.info(`树脂提示已耗尽，...`);                                    
                                    resinexhaustion = true;                                                                               
                                }
                            }
                        }
                    }

                    //8.3判断继续或退出
                    if (challengeNum == i+1 || resinexhaustion == true || resinAgain == true ){
                        log.info(resinAgain ? "累计战斗失败 3 次，退出秘境..." 
                        :  (challengeNum == i+1) ? `完成 ${i+1}/${challengeNum} 次战斗，退出挑战...`: `树脂耗尽，退出挑战...`);
                        await sleep(1000); 
                        await keyPress("VK_ESCAPE"); 
                        await sleep(1000); 

                        var exitTimeout = 0;
                        while(exitTimeout < 20) {
                            let exitChallenge = await Textocr("退出挑战",0.3,0,0,866,719,274,86);
                            if (exitChallenge.found) {
                                await sleep(1000);  
                                await click(exitChallenge.x, exitChallenge.y);
                                await sleep(1000);  
                                break;
                            } 
                                let exitChallenge2 = await Textocr("退出挑战",0.3,1,0,866,719,274,86);               
                                log.info("尝试退出挑战...");
                                await sleep(1000);  
                                await keyPress("VK_ESCAPE"); 
                                await sleep(1000);  
                                exitTimeout++; 
                        }                        
                        await genshin.returnMainUi(); 
                        if (resinAgain == true){throw new Error("执行重试错误...")}        
                        return true;
                    }

                    await sleep(500);   
                }      
            }
        catch (error) {
            //9.执行错误，重试处理            
            log.error(`执行过程中发生错误：${error.message}`);
            resinAgain = true;
            await genshin.returnMainUi(); 
            continue;
        }finally{
            //10.结束脚本 
            await genshin.returnMainUi();
            if (resinAgain == false) log.info(`Auto自动幽境危战结束...`);
        }
    }

})();
