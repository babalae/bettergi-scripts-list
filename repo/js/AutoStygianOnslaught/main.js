// 战斗取消令牌和状态
let fightCts = null;
let isFighting = false;
// 脚本强制停止标志（替代异常传递）
let shouldForceStop = false;

(async function () {

        var Threshold = genshin.width > 2560 ? 0.65 
        : genshin.width > 1920 ? 0.7 
        : 0.8;

        var Thresholdr = genshin.width > 2560 ? 0.8
        : genshin.width > 1920 ? 0.8
        : 0.9;

        log.warn(`屏幕分辨率${genshin.width}，识别阈值调整为${Threshold}...`);

        let challengeNum = settings.challengeNum;//挑战次数
        if (challengeNum === undefined || challengeNum === ""){challengeNum = 15; }//挑战次数
        let challengeName = settings.challengeName;//挑战BOSS
        if (challengeName === undefined || challengeName === ""){throw new Error("挑战Boss未配置，请在JS配置中选择...")}//初始化处理
        let Startforward = settings.Startforward*1000 ? settings.Startforward*1000 : 1000;//开始战斗的前进时间
        var Fighttimeout = settings.Fighttimeout * 1000 ? settings.Fighttimeout * 1000 : 240000;//战斗超时时间，默认为240秒
        const ocrRegion1 = { x: 643, y: 58, width: 800, height: 800 };   // 上方挑战成功区域
        const ocrRegion2 = { x: 780, y: 406, width: 370, height: 135 };   // 中间挑战失败区域
        const ocrRo1 = RecognitionObject.ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);//上方挑战成功区域OCR对象
        const ocrRo2 = RecognitionObject.ocr(ocrRegion2.x, ocrRegion2.y, ocrRegion2.width, ocrRegion2.height);//中间挑战失败区域OCR对象
        var Rewardsuse = settings.Rewardsuse ? settings.Rewardsuse : "1/2";//树脂使用类型，默认为1/2，即浓缩树脂和原粹树脂
        var resinTypes = Rewardsuse.split("/");
        var rewards = [];
        var onerewards, secendrewards, threendrewards, fourdrewards,fiverewards;   
        for (var i = 0; i < resinTypes.length; i++) {
            var resinType = parseInt(resinTypes[i]);
            if (isNaN(resinType) || resinType < 1 || resinType > 5) {
                throw new Error("设定的树脂类型无效或缺失，请重新配置");
            }
            rewards.push(resinType);
        }
        const resinTypeMap = ["","使用1个浓缩树脂，获取3次产出", "使用40个原粹树脂，获取2次产出", "使用1个脆弱树脂，获取3次产出", "使用1个须臾树脂，获取3次产出","使用20个原粹树脂"];
        const resinTypeMap2 = ["使用50原石，获取3次产出", "使用100原石，获取3次产出", "使用150原石，获取3次产出", "使用200原石，获取3次产出"];

        //原石使用
        var primogemUseCount = settings.primogemUseCount ? settings.primogemUseCount : 0;
        if (primogemUseCount === undefined || primogemUseCount === null) {
            throw new Error("原石使用 参数无效，请设置0到6之间的整数值");
        }
        primogemUseCount = parseInt(primogemUseCount);
        if (isNaN(primogemUseCount) || !Number.isInteger(primogemUseCount) || primogemUseCount < 0 || primogemUseCount > 6) {
            throw new Error("原石使用 数量设置无效，请设置0到6之间的整数值");
        }
        primogemUseCount = (isNaN(primogemUseCount)) ? 0 : primogemUseCount;
        var primogemUseDone = 0;
        var resinDone = false;

        const golbalRewards = ["","浓缩树脂","原粹树脂40","脆弱树脂","须臾树脂","原粹树脂20"]; // 对应四种树脂
        // 根据 rewards 数组长度，依次赋值给对应的变量
        if (rewards.length > 0) onerewards = golbalRewards[rewards[0]];
        if (rewards.length > 1) secendrewards = golbalRewards[rewards[1]];
        if (rewards.length > 2) threendrewards = golbalRewards[rewards[2]];
        if (rewards.length > 3) fourdrewards = golbalRewards[rewards[3]];
        if (rewards.length > 4) fiverewards = golbalRewards[rewards[4]];
        const golbalRewardText = [onerewards, secendrewards, threendrewards, fourdrewards,fiverewards].filter(Boolean);//过滤树脂使用类型
        if(primogemUseCount>0){golbalRewardText.push("原石")}
        // 根据 rewards 数组长度，依次赋值给对应的变量
    
        var firstawards = false;

        var advanceNum = 0;//前进寻找地脉之花次数
        var verticalNum = 0;//重试寻找地脉之花次数
        var resinAgain = false;//是否重试标志

        var Artifacts = settings.Artifacts ? settings.Artifacts : "保持圣遗物奖励不变"; 

        //映射所有圣遗物对应需要识别的图片
        var artifactImageMap = {
            "天之美赐 / 影中沉凝的幻灭": "assets/Artifacts/artifact_20.bmp",
            "晨星与月的晓歌 / 风起之日": "assets/Artifacts/artifact_19.bmp",
            "穹境示现之夜 / 纺月的夜歌": "assets/Artifacts/artifact_0.bmp",             
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
        var enterButton = "assets/enter.png";
        var rewardsButton = "assets/rewards.png";

        var resinImages = [
            "assets/zero.png",
            "assets/one.png",
            "assets/two.png",
            "assets/three.png",
            "assets/four.png",
            "assets/five.png"
        ];

        FightTeam = settings.FightTeam;

        // 战斗策略配置
        let CombatStrategyType = settings.CombatStrategyType || "使用BetterGI战斗配置(下方指定策略无效)";
        let SpecifiedCombatStrategy = (settings.SpecifiedCombatStrategy || "").toString().trim();
        let CombatStrategyPath = "";

        if (CombatStrategyType === "指定战斗策略") {
            if (!SpecifiedCombatStrategy) {
                log.warn("【配置警告】您选择了'指定战斗策略'但未填写策略名称，系统将自动退回'使用BetterGI战斗配置'。");
            } else if (/[/:*?"<>|]/.test(SpecifiedCombatStrategy)) {
                // 只禁止除反斜杠外的非法字符（反斜杠是合法路径分隔符）
                log.warn(`【配置警告】指定的战斗策略名称包含非法字符: ${SpecifiedCombatStrategy}，系统将自动退回'使用BetterGI战斗配置'。`);
            } else {
                let strategyName = SpecifiedCombatStrategy;
                // 自动去除 .txt 后缀（无论用户是否填写，底层都会追加）
                if (strategyName.toLowerCase().endsWith(".txt")) {
                    strategyName = strategyName.substring(0, strategyName.length - 4);
                }
                // 路径分隔符标准化：单反斜杠 → 双反斜杠，已转义则跳过
                if (strategyName.includes("\\") && !strategyName.includes("\\\\")) {
                    CombatStrategyPath = strategyName.replace(/\\/g, "\\\\");
                } else {
                    CombatStrategyPath = strategyName;
                }
                log.info(`战斗策略路径: "${CombatStrategyPath}"`);
            }
        }

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
                    if (debugcode===1){if (x===0 & y===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);
                    captureRegion.dispose();
                    return result = { text: res.text, x: res.x, y: res.y, found: true }}}else{if (x===0 & y===0){log.info("文本OCR完成'{text}'", res.text);}}
                    if (clickocr===1){await sleep(1000);await click(res.x, res.y);}else{}  
                    if (clickocr===2){await sleep(100);await keyPress("F");}else{}
                    captureRegion.dispose();
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
                if (debugcode===2 && !res.isEmpty()){
                    // log.info("({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);
                    captureRegion.dispose();
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
            }
            const NowTime = new Date();
            if (Math.abs(NowTime - startTime)>chaotime*1000){if (x===0 & y===0){log.info(`${chaotime}秒超时退出，"${wenzi}"未找到`);}
            captureRegion.dispose();
            return result = {found: false };}else{ii=8;if (x !== 861){if(debugcode!==3){await keyPress("VK_W");}};}
            await sleep(100);
        }   
    }

    // 图片识别封装函数
    async function imageRecognition(imagefilePath="空参数",timeout=10,afterBehavior=0,debugmodel=0,xa=0,ya=0,wa=1920,ha=1080,tt=0.8) {
        const startTime = new Date();

        const Imagidentify = RecognitionObject.TemplateMatch(file.ReadImageMatSync(imagefilePath),true);
        if (tt !== 0.8){
            Imagidentify.Threshold=tt;
            Imagidentify.InitTemplate();        
        }

        // Imagidentify.Name = "测试";
        // Imagidentify.DrawOnWindow=true;
        // Imagidentify.InitTemplate(); 
                

        for (let ii = 0; ii < 10; ii++) {    
            captureRegion = captureGameRegion();  // 获取一张截图
            res = captureRegion.DeriveCrop(xa, ya, wa, ha).Find(Imagidentify);
        if (res.isEmpty()) {
            if (debugmodel===1 & xa===0 & ya===0){log.info("未识别页面元素")};
        } else {
          if (afterBehavior===1){if (xa===0 & ya===0){log.info("点击模式:开");}await sleep(1000);click(res.x+xa, res.y+ya);}else{if (debugmodel===1 & xa===0 & ya===0){log.info("点击模式:关")}}
          if (afterBehavior===2){if (xa===0 & ya===0){log.info("F模式:开");}await sleep(1000);keyPress("F");}else{if (debugmodel===1 & xa===0 & ya===0){log.info("F模式:关")}}
          if (debugmodel===1 & xa===0 & ya===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x+xa, res.y+ya, res.width, res.Height);}else{ log.info("识别到页面元素");}
          captureRegion.dispose();
          return result = { x: res.x+xa, y: res.y+ya, w:res.width,h:res.Height,found: true }
        }
        const NowTime = new Date();
        if ((NowTime - startTime)>timeout*1000){if (debugmodel===1 & xa===0 & ya===0){log.info(`${timeout}秒超时退出，未找到图片`);}
        captureRegion.dispose();
        return result = {found: false };}else{ii=8}
        await sleep(200); 
        }
        await sleep(1200); 
    }

    //树脂数量获取函数
    async function getRemainResinStatus() {
        var condensedResinCount = 0; // 浓缩树脂
        var originalResinCount = 0; // 原粹树脂
        var fragileResinCount = 0; // 脆弱树脂
        var momentResinCount = 0; //须臾树脂

        // var shuz = []
        // 浓缩树脂
        var condensedResinCountRa = await imageRecognition(condensedResin,0.2, 0, 0,800,15,700,70,Threshold);
        if (condensedResinCountRa.found) { 
            //测试用 
            // log.info("检测到浓缩树脂图标");  
            // await moveMouseTo(condensedResinCountRa.x+condensedResinCountRa.w,condensedResinCountRa.y);
            // log.warn("X{0} Y{1} W{2} H{3}",condensedResinCountRa.x,condensedResinCountRa.y,condensedResinCountRa.w,condensedResinCountRa.h,);
            // if (Math.abs(condensedResinCountRa.x - 1256) > 5 || condensedResinCountRa.y != 33){
            //     throw new Error("浓缩图标错误");
            // }
            // log.warn("T{0}",Thresholdr);
            // log.warn("L{0}",resinImages.length);
            for (let i = 0; i < resinImages.length; i++) {
                if(i==0){await sleep(500);}
                // log.warn("i{0}",i);
                let countArea = await imageRecognition(resinImages[i],0, 0, 0,condensedResinCountRa.x+condensedResinCountRa.w+15,condensedResinCountRa.y,30,32,Thresholdr);
                if (countArea.found){   
                    // await moveMouseTo(countArea.x,countArea.y);            
                    condensedResinCount =i;  
                    // shuz.push(i);
                    break;               
                }
                if (i==5){log.info("未检测到浓缩数量，强制为1"); condensedResinCount=1;}                          
            }
             //测试用
            // log.warn("{0}",shuz);
            // if (shuz.length != 1 || shuz[0] != 0){
            //     // log.warn("错误");
            //     // await sleep(2000);
            //     throw new Error("错误");
            // }
        }else{
            log.info("未检测到浓缩树脂图标");        
        }  

        //脆弱树脂
        var originalResinCountRa = await imageRecognition(originalResin,0.1, 0, 0,1325,0,400,500,Threshold);
        if (originalResinCountRa.found) {  
            // await moveMouseTo(originalResinCountRa.x,originalResinCountRa.y);   
            let countArea = await Textocr("",0.5, 0, 2,originalResinCountRa.x+originalResinCountRa.w,originalResinCountRa.y,originalResinCountRa.w*4,originalResinCountRa.h);//
            if (countArea.found){
                log.info("原粹树脂识别数量结果："+ countArea.text);
                let match = countArea.text.match(/(\d+)\s*[/17]\s*(2|20|200)/);
                if (match) {
                    originalResinCount = match[1];
                    // log.info("脆弱树脂识别数量提取："+ originalResinCount);
                }
                else
                {
                    log.info("原粹树脂识别数量提取失败");
                }                
            }
            else
            {
                log.info("原粹树脂识别数量结果：：无");
            }

        } else {
            log.info("未检测到原粹树脂图标");
        }

        // 须臾树脂
        var momentResinCountRa = await imageRecognition(momentResin,0.1, 0, 1,960,0,500,100,Threshold);
        if (momentResinCountRa.found) {          
                
            for (let i = 0; i < resinImages.length; i++) {
                let countArea = await imageRecognition(resinImages[i],0, 0, 0,momentResinCountRa.x+momentResinCountRa.w+10,momentResinCountRa.y,30,35,Thresholdr);
                if (countArea.found){
                    momentResinCount =i;  
                    break;               
                }
                if (i==5){log.info("未检测到须臾数量，强制为1"); momentResinCount=1;}                          
            } 
            
            fragileResinCount = "1";
            log.info("未检测到脆弱树脂图标,可能被须臾图标覆盖，脆弱树脂强制为 1 ");//有图标说明至少为1       
            
        }else
        { 
            log.info("未检测到须臾树脂图标"); 

            // 脆弱树脂
            var fragileResinCountRa = await imageRecognition(fragileResin,0.1, 0, 1,960,0,500,100,Threshold);
            if (fragileResinCountRa.found) {  
                // await moveMouseTo(fragileResinCountRa.x+fragileResinCountRa.w+20,fragileResinCountRa.y-15);             
            
                let countArea = await Textocr("",0.1, 0, 2,fragileResinCountRa.x+fragileResinCountRa.w,fragileResinCountRa.y,fragileResinCountRa.w*2,fragileResinCountRa.h);//
                if (countArea.found){
                    // log.info("脆弱树脂识别数量结果："+ countArea.text);
                    fragileResinCount = countArea.text
                }
                else{
                    var oneRa = await imageRecognition(resinImages[1],0.1, 0, 1,fragileResinCountRa.x+fragileResinCountRa.w,fragileResinCountRa.y,60,40,Threshold);
                    if (oneRa.found){
                        fragileResinCount = "1";
                    }else{
                        fragileResinCount = "1";
                        log.info("2未检测到脆弱树脂图标,脆弱树脂识别强制为 1 ");//有图标说明至少为1     
                    }
                }
            } 
            else {
                fragileResinCount = "1";
                log.info("未检测到脆弱树脂图标,脆弱树脂识别强制为 1 ");//有图标说明至少为1       
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
            if (rewardResult.text.includes("之花") || rewardResult.text.includes("激活")) {
                log.info("已到达领奖点，检测到文字: " + rewardResult.text);
                captureRegion.dispose();
                rewardTextArea.dispose();
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
                        captureRegion.dispose();
                        throw new Error('领取超时');              
                    }  
                    log.info("领取超时，重新尝试1次");
                    await sleep(1000);
                    captureRegion.dispose();
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
        fightCts = new CancellationTokenSource();
        isFighting = true;
        let fightTask = null;
        log.info("开始战斗");
        
        try {
            // 如果指定了战斗策略，使用带参数的方式
            if (CombatStrategyPath && CombatStrategyPath !== "") {
                log.info(`使用指定战斗策略: ${CombatStrategyPath}`);
                
                // 使用AutoFightParam配置自动战斗
                const autoFightParam = new AutoFightParam(CombatStrategyPath);

                // 设置战斗超时（秒）
                autoFightParam.Timeout = timeout / 1000;
                
                // 禁用内置战斗结束检测
                autoFightParam.FightFinishDetectEnabled = false;

                // 使用runAutoFightTask执行带参数的自动战斗
                fightTask = dispatcher.runAutoFightTask(autoFightParam, fightCts.Token);
            } else {
                // 使用原始方式，不带参数
                fightTask = dispatcher.RunTask(new SoloTask("AutoFight"), fightCts.Token);
            }
            
             //监听战斗线程错误，白名单机制：仅对致命错误设置停止标志
            fightTask.catch(e => {
                const errorMsg = e?.message || String(e);
                // 白名单：只有这三种错误才触发强制停止
                if (errorMsg.includes("战斗策略文件不存在") || 
                    errorMsg.includes("战斗脚本文件不存在") || 
                    errorMsg.includes("未匹配到任何战斗脚本")) {
                    shouldForceStop = true;
                    shouldStop = true;
                    log.error(`战斗任务执行失败（致命错误）: ${errorMsg}`);
                } else {
                    // 其他错误只记录日志，不触发停止
                    log.warn(`战斗任务执行异常（非致命）: ${errorMsg}`);
                }
            });
            
            // OCR检测战斗结束
            let fightResult = await recognizeTextInRegion(timeout);
            logFightResult = fightResult ? "成功" : "失败";
            log.info(`战斗结束，战斗结果：${logFightResult}`);
            
            return fightResult;
        } finally {
            // 确保战斗结束后取消任务
            isFighting = false;
            if (fightCts) {
                try {
                    fightCts.cancel();
                } catch (e) {
                    log.warn(`取消战斗任务时出错: ${e.message}`);
                }
                fightCts = null;
            }
            if (fightTask) {
                await fightTask.catch(e => log.warn(`战斗任务结束异常: ${e?.message || e}`));
            }
        }
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
                        // 检查是否被强制停止
                        if (shouldForceStop) {
                            resolve(false);
                            return;
                        }

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
                                    captureRegion.dispose();
                                    return;
                                }
                            }                          

                            // 检查失败关键词--
                            for (let keyword of failureKeywords) {
                                if (text2.includes(keyword)) {
                                    log.warn("检测到战斗失败关键词: {0}", keyword);
                                    resolve(false);
                                    captureRegion.dispose();
                                    return;
                                }
                            }                        
                        }
                        catch (error) {
                            captureRegion.dispose();
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
             if (retries === maxRetries || 155+YOffset > 1080) {
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
            await keyPress("F");     
            log.warn("未找到地脉之花，尝试向前寻找...")           
            await keyDown("W");await sleep(300);await keyUp("W"); 
            await keyPress("F");
            await sleep(1000);       
        }

        await sleep(300);   
        
        //确保转换按键，根据数字2和5的顺序，判断是否要点
        if(!firstawards){
            let index2 = resinTypes.indexOf("2");
            let index5 = resinTypes.indexOf("5");
            
            if (index2 !== -1 && (index5 === -1 || index2 < index5)) {                
                let SHU = await Textocr(resinTypeMap[5], 0.1, 0, 0, 510, 380, 640, 600);
                if (SHU.found) {
                    await click(SHU.x + 480, SHU.y + 15);
                }
            }else{
                let SHU = await Textocr(resinTypeMap[2], 0.1, 0, 0, 510, 380, 640, 600);
                if (SHU.found) {
                    await click(SHU.x + 480, SHU.y + 15);
                }
            }
            firstawards = true;
        }      
        
        for (let j = 0;j < 2;j++) {

            for (let i = 0;i < rewards.length && !resinDone;i++) {
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

                    await sleep(1000);

                    let { condensedResinCount, originalResinCount, fragileResinCount , momentResinCount} = await getRemainResinStatus();                        
                    let shouldExit = true;
                
                    if (resinTypes.includes("1"))
                    {
                        shouldExit &= (parseInt(condensedResinCount, 10) == 0);
                    }
                    if (resinTypes.includes("2") || resinTypes.includes("5"))
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
                        if(primogemUseCount <= 0){
                            await sleep(1000);        
                            await keyPress("VK_ESCAPE"); 
                            await sleep(1000);      
                            return false;   
                        }
                        else{
                            log.warn("树脂耗尽，后续尝试使用原石 {0} 次...", primogemUseCount);
                            resinDone = true;                         
                        }  
                    }               
                    log.warn("还有树脂...");          
                    return true;
                }        
            }
            await sleep(500);  
        }

        resinDone = true; 
        if(primogemUseCount > 0 && resinDone){

            log.warn("树脂耗尽，尝试使用原石 {0}/{1} ...", primogemUseDone+1, primogemUseCount);
         
            let SHU =  await Textocr("兑换",0,0,0,510,380,800,600);
            if (SHU.found) {
                resinTypeMap2.length = 0;
                log.warn("{t}","原石不足，执行结束...");
            }

            for (let k = 0; k < resinTypeMap2.length; k++) {
                let SHU =  await Textocr(resinTypeMap2[k],0.1,0,0,510,380,640,600);
                if (SHU.found){
                    log.warn("{t}","原石使用啦！！！！！！！！！...");
                    await click(SHU.x+550,SHU.y)

                    let dimai2 = await Textocr("确认",0.5, 0, 0, 960,720, 400, 80);
                    if (dimai2.found) {
                        await click(865,630)//不再提示
                        await sleep(1000);
                        // await moveMouseTo(dimai2.x,dimai2.y+10);
                        await click(dimai2.x,dimai2.y+10)
                    } 

                    primogemUseDone ++;
                    primogemUseCount--;
                    if (primogemUseCount <= 0) {
                        log.warn("原石使用次数耗尽，停止执行...");
                        break; 
                    }
                    return true;                                        
                }else{
                    log.warn("未找到原石使用选项，停止执行...");
                    break;                       
                }
            }    
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
            let JIECHU = await Textocr("F",2,2,0,1095,519,41,36);
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
   
    // OCR 检测函数（活动入口寻路用）
    /*
     *
     * 【红框可视化调试】
     * 在开发模式下会对大部分的OCR区域绘制红框，做到可视化调试
     * 某些没有覆盖到的区域用的可能是老的OCR函数（Textocr），
     * 那是历史代码，改动麻烦且参数复杂，暂时不想处理
     *
     * 【红框回收问题】
     * 目前还没找到正确的资源回收方法，所以在退出路径中是直接绘制一个1×1的红框直接顶掉上一个绘制
     * 开发模式的玩意能用就行，别太较真
     *
     * 【为什么不统一OCR逻辑】
     * 1. Textocr() 是老代码，参数复杂（超时、点击、调试模式等）
     * 2. 改动风险大，影响范围广（战斗/领奖/退出流程全用这个,主要还是炸了改起来麻烦）
     * 3. wipOcrCheckText() 是新版寻路专用封装，接口更简洁
     *
     * 【覆盖范围】
     * ✅ 有红框：navigateViaActivity() 内的所有OCR（活动/幽境危战/传送等）
     * ❌ 无红框：Textocr() 调用点（单人挑战后的战斗/领奖流程）
     *
     * 【返回值说明】
     * 返回增强后的OCR对象，包含原始属性 + 中心点坐标（基于1080P）：
     * - 原始属性：text, x, y, width, height
     * - 新增属性：centerX, centerY（已计算好的中心点，可直接用于点击）
     *
     * @param {Array} roi1080 - 识别区域 [x, y, width, height] (基于1080P坐标)
     * @param {Array} keywords - 匹配关键词列表
     * @param {string} label - 调试标签（用于日志标识）
     * @param {boolean} isDebug - 是否启用调试模式（绘制红框+详细日志）
     */
    function wipOcrCheckText(roi1080, keywords, label, isDebug) {
        let ra = null;
        try {
            const s = genshin.scaleTo1080PRatio;
            const x = Math.round(roi1080[0] * s);
            const y = Math.round(roi1080[1] * s);
            const w = Math.round(roi1080[2] * s);
            const h = Math.round(roi1080[3] * s);

            ra = captureGameRegion();

            // 开发模式：绘制识别区域红框（可视化调试）
            if (isDebug) {
                try {
                    const drawRegion = ra.DeriveCrop(x, y, w, h);
                    drawRegion.DrawSelf("rect");
                } catch (drawErr) {
                    log.warn(`[DEBUG][${label}] 红框绘制异常: ${drawErr.message}`);
                }
            }

            const resList = ra.findMulti(RecognitionObject.ocr(x, y, w, h));
            const count = resList.length !== undefined ? resList.length : resList.count;

            if (isDebug) {
                log.info(`[DEBUG][${label}] ROI(1080P)=(${roi1080.join(',')}) 当前=(${x},${y},${w},${h}) 段数=${count}`);
                for (let i = 0; i < count; i++) {
                    const r = resList[i];
                    if (r) log.info(`[DEBUG][${label}] #${i+1} text="${r.text}" pos=(${r.x},${r.y},${r.width},${r.height})`);
                }
            }

            for (let i = 0; i < count; i++) {
                const r = resList[i];
                if (!r || !r.text) continue;
                for (let k = 0; k < keywords.length; k++) {
                    if (r.text.includes(keywords[k])) {
                        // 返回新的JavaScript对象（避免修改只读的C#对象）
                        return {
                            text: r.text,
                            x: r.x,
                            y: r.y,
                            width: r.width,
                            height: r.height,
                            centerX: Math.round(r.x / s + r.width / s / 2),
                            centerY: Math.round(r.y / s + r.height / s / 2)
                        };
                    }
                }
            }
            return null;
        } catch (e) {
            if (isDebug) {
                log.warn(`[DEBUG][${label}] OCR异常: ${e.message}`);
            }
            return null;
        } finally {
            if (ra) ra.dispose();
        }
    }

    // 新版寻路：通过活动入口进入幽境危战（失败时返回false，回退到pathingScript）
    async function navigateViaActivity(isDebug) {
        log.info("[新版寻路] 开始通过活动入口进入幽境危战");
        const s = genshin.scaleTo1080PRatio;
        
        try {
            // 返回主界面
            try { await genshin.returnMainUi(); } catch(e) { log.warn(`[新版寻路] 返回主界面失败: ${e.message}`); }
            await sleep(100);

            // ESC打开菜单 → OCR识别"活动" → 点击
            keyPress("VK_ESCAPE");
            await sleep(1400);

            let activityHit = null;
            const smallRoi = [633, 718, 62, 42], largeRoi = [98, 346, 651, 708];

            activityHit = wipOcrCheckText(smallRoi, ["活动"], "新版寻路-活动", isDebug);
            if (!activityHit) { log.info('[新版寻路] 活动识别失败，重试1...'); await sleep(2500); activityHit = wipOcrCheckText(smallRoi, ["活动"], "新版寻路-活动-r1", isDebug); }
            if (!activityHit) { log.info('[新版寻路] 活动识别失败，重试2...'); await sleep(2500); activityHit = wipOcrCheckText(smallRoi, ["活动"], "新版寻路-活动-r2", isDebug); }
            if (!activityHit) { log.info('[新版寻路] 小范围失败，尝试大范围...'); activityHit = wipOcrCheckText(largeRoi, ["活动"], "新版寻路-活动-large", isDebug); }
            if (!activityHit) { log.info('[新版寻路] 大范围失败，重新打开ESC...'); try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {} keyPress("VK_ESCAPE"); await sleep(2000); activityHit = wipOcrCheckText(largeRoi, ["活动"], "新版寻路-活动-esc", isDebug); }

            if (activityHit) {
                // 点击"活动"按钮（Y轴偏移-50避免点到其他元素）
                GameCaptureRegion.gameRegion1080PPosClick(activityHit.centerX, activityHit.centerY - 50);
                await sleep(2000);
            } else {
                log.warn('[新版寻路] 活动识别失败，尝试F5快捷键');
                try { await genshin.returnMainUi(); await sleep(1000); } catch(e) {}
                keyPress("VK_F5");
                await sleep(2000);
            }

            // 识别"幽境危战"并点击
            const stygianRoi = [192, 237, 308, 164], stygianLargeRoi = [189, 77, 295, 956];

            let stygianHit = wipOcrCheckText(stygianRoi, ["幽境危战"], "新版寻路-幽境危战", isDebug);

            if (!stygianHit) {
                log.info('[新版寻路] 首次识别失败，等待界面加载');
                await sleep(1300);
                const activityCheck = wipOcrCheckText(smallRoi, ["活动"], "新版寻路-验证活动", isDebug);
                if (activityCheck) {
                    GameCaptureRegion.gameRegion1080PPosClick(activityCheck.centerX, activityCheck.centerY - 50);
                    await sleep(2500);
                    stygianHit = wipOcrCheckText(stygianRoi, ["幽境危战"], "新版寻路-幽境危战-retry", isDebug);
                }
                if (!stygianHit) {
                    log.info('[新版寻路] 尝试大范围识别');
                    stygianHit = wipOcrCheckText(stygianLargeRoi, ["幽境危战"], "新版寻路-幽境危战-large-pre", isDebug);
                }
                if (!stygianHit) {
                    log.info('[新版寻路] 滚动页面重试');
                    await keyDown("VK_W"); await sleep(2000); await keyUp("VK_W");
                    await sleep(300);
                    stygianHit = wipOcrCheckText(stygianLargeRoi, ["幽境危战"], "新版寻路-幽境危战-r1", isDebug);
                }
            }

            if (!stygianHit) {
                log.info('[新版寻路] 未识别，再次滚动');
                await keyDown("VK_W"); await sleep(1000); await keyUp("VK_W");
                await sleep(300);
                stygianHit = wipOcrCheckText(stygianLargeRoi, ["幽境危战"], "新版寻路-幽境危战-r2", isDebug);
            }

            if (!stygianHit) {
                log.warn('[新版寻路] 活动界面未找到幽境危战，回退到路径追踪');
                return false;
            }

            // 点击"幽境危战"
            GameCaptureRegion.gameRegion1080PPosClick(stygianHit.centerX, stygianHit.centerY);
            await sleep(2000);
            
            // 识别"前往挑战"
            const challengeRoi = [1524, 786, 131, 50];
            
            let challengeHit = wipOcrCheckText(challengeRoi, ["前往挑战"], "新版寻路-前往挑战", isDebug);
            if (!challengeHit) {
                log.info('[新版寻路] 首次识别失败，验证上一步元素...');
                const stygianCheck = wipOcrCheckText(stygianRoi, ["幽境危战"], "新版寻路-验证幽境危战", isDebug);
                if (stygianCheck) {
                    GameCaptureRegion.gameRegion1080PPosClick(stygianCheck.centerX, stygianCheck.centerY);
                    await sleep(2000);
                    challengeHit = wipOcrCheckText(challengeRoi, ["前往挑战"], "新版寻路-前往挑战-retry", isDebug);
                }
                if (!challengeHit) {
                    log.info('[新版寻路] 上一步已失效，重试1...');
                    await sleep(1500);
                    challengeHit = wipOcrCheckText(challengeRoi, ["前往挑战"], "新版寻路-前往挑战-r1", isDebug);
                }
            }
            if (!challengeHit) {
                log.info('[新版寻路] 前往挑战识别失败，重试2...');
                await sleep(1500);
                challengeHit = wipOcrCheckText(challengeRoi, ["前往挑战"], "新版寻路-前往挑战-r2", isDebug);
            }

            if (!challengeHit) {
                log.warn('[新版寻路] 未识别到前往挑战，回退到路径追踪');
                return false;
            }

            // 检查爆发期状态
            // 当前逻辑：检测"紊乱爆发期已结束"（非爆发期文本），检测不到则视为在爆发期
            // 爆发期期间改为直接检测爆发期关键词（如"紊乱爆发期"），加快识别效率
            // 不改也能用，两次识别不到非爆发期文本也会被视为在爆发期
            const burstRoi = [659, 765, 180, 32];
            
            let burstHit = wipOcrCheckText(burstRoi, ["紊乱爆发期已结束"], "新版寻路-爆发期", isDebug);
            if (!burstHit) {
                log.info('[新版寻路] 爆发期识别失败，重试1...');
                await sleep(1000);
                burstHit = wipOcrCheckText(burstRoi, ["紊乱爆发期已结束"], "新版寻路-爆发期-r1", isDebug);
            }
            if (!burstHit) {
                log.info('[新版寻路] 爆发期识别失败，重试2...');
                await sleep(1000);
                burstHit = wipOcrCheckText(burstRoi, ["紊乱爆发期已结束"], "新版寻路-爆发期-r2", isDebug);
            }

            let isBurstPeriod = true;  // 记录是否在爆发期
            if (burstHit) {
                if (settings.devMode) {
                    log.warn('[新版寻路][开发模式] 检测到"紊乱爆发期已结束"，但继续执行');
                } else {
                    log.warn('[新版寻路] 检测到"紊乱爆发期已结束"，当前不在爆发期');
                    isBurstPeriod = false;
                    try { await genshin.returnMainUi(); } catch(e) {}
                    return "non_burst";
                }
            } else {
                log.info('[新版寻路] 未检测到爆发期结束提示，视为在爆发期内');
            }

            // 获取剩余时间信息并合并报告（这里其实啥用没有，顺路获取一下信息）
            const timeRemainingRoi = [1146, 353, 270, 34];
            const timeRemainingHit = wipOcrCheckText(timeRemainingRoi, ["剩余时间"], "新版寻路-剩余时间", isDebug);
            if (timeRemainingHit) {
                const burstStatusText = isBurstPeriod ? '在爆发期内' : '不在爆发期';
                // 直接用OCR识别的原始文本（已包含"剩余时间:XXX"），不再添加前缀
                notification.send(`[新版寻路] 当前${burstStatusText}，${timeRemainingHit.text}`);
            }

            // 点击"前往挑战"
            GameCaptureRegion.gameRegion1080PPosClick(challengeHit.centerX, challengeHit.centerY);
            await sleep(2000);

            // 识别"传送"并按F
            const teleportRoi = [1645, 974, 93, 67];
            let teleportHit = wipOcrCheckText(teleportRoi, ["传送"], "新版寻路-传送", isDebug);
            let interactHit = null;  // 初始化交互按钮识别结果（用于距离过近跳过传送的情况）
            if (!teleportHit) {
                log.info('[新版寻路] 首次识别失败，验证上一步元素...');
                const challengeCheck = wipOcrCheckText(challengeRoi, ["前往挑战"], "新版寻路-验证前往挑战", isDebug);
                if (challengeCheck) {
                    GameCaptureRegion.gameRegion1080PPosClick(challengeCheck.centerX, challengeCheck.centerY);
                    await sleep(2000);
                    teleportHit = wipOcrCheckText(teleportRoi, ["传送"], "新版寻路-传送-retry", isDebug);
                }
                if (!teleportHit) {
                    log.info('[新版寻路] 上一步已失效，重试1...');
                    await sleep(1500);
                    teleportHit = wipOcrCheckText(teleportRoi, ["传送"], "新版寻路-传送-r1", isDebug);
                    if (!teleportHit) {
                        const escMenuRoi = [98, 346, 651, 708];
                        const escMenuCheck = wipOcrCheckText(escMenuRoi, ["提升指南"], "新版寻路-检测ESC菜单", isDebug);
                        if (escMenuCheck) {
                            log.info('[新版寻路] 检测到仍在ESC菜单中，关闭菜单后查找交互按钮...');
                            await keyPress("VK_ESCAPE");
                            await sleep(1200);
                            const stygianInteractRoi_skip = [1213, 510, 171, 56];
                            interactHit = wipOcrCheckText(stygianInteractRoi_skip, ["幽境危战"], "新版寻路-交互-skip", isDebug);
                            if (interactHit) {
                                log.info('[新版寻路] 关闭ESC菜单后直接识别到交互按钮，跳转至按F步骤');
                            }
                        } else {
                            log.info('[新版寻路] 不在ESC菜单中，尝试直接识别交互按钮...');
                            const stygianInteractRoi_direct = [1213, 510, 171, 56];
                            interactHit = wipOcrCheckText(stygianInteractRoi_direct, ["幽境危战"], "新版寻路-交互-direct", isDebug);
                            if (interactHit) {
                                log.info('[新版寻路] 直接识别到交互按钮（距离过近跳过传送），跳转至按F步骤');
                            }
                        }
                    }
                }
            }
            if (!teleportHit) {
                log.info('[新版寻路] 传送识别失败，重试2...');
                await sleep(1500);
                teleportHit = wipOcrCheckText(teleportRoi, ["传送"], "新版寻路-传送-r2", isDebug);
            }

            if (!teleportHit && !interactHit) {
                log.warn('[新版寻路] 未识别到传送按钮，回退到路径追踪');
                return false;
            }

            if (!interactHit) {
                log.info('[新版寻路] 识别到传送，点击传送按钮');
                GameCaptureRegion.gameRegion1080PPosClick(teleportHit.centerX, teleportHit.centerY);
                await sleep(5000);
            }

            // 识别"幽境危战"交互按钮并按F
            const stygianInteractRoi_final = [1213, 510, 171, 56];
            if (!interactHit) {
                interactHit = wipOcrCheckText(stygianInteractRoi_final, ["幽境危战"], "新版寻路-交互", isDebug);
                if (!interactHit) {
                    log.info('[新版寻路] 首次识别失败，验证上一步元素...');
                    const teleportCheck = wipOcrCheckText(teleportRoi, ["传送"], "新版寻路-验证传送", isDebug);
                    if (teleportCheck) {
                        log.info('[新版寻路] 传送按钮仍存在，重新点击');
                        GameCaptureRegion.gameRegion1080PPosClick(teleportCheck.centerX, teleportCheck.centerY);
                        await sleep(5000);
                        interactHit = wipOcrCheckText(stygianInteractRoi_final, ["幽境危战"], "新版寻路-交互-retry", isDebug);
                    }
                    if (!interactHit) {
                        log.info('[新版寻路] 上一步已失效，按F备用传送');
                        await keyPress("F");
                        await sleep(5000);
                        interactHit = wipOcrCheckText(stygianInteractRoi_final, ["幽境危战"], "新版寻路-交互-retry-f", isDebug);
                    }
                }
            }
            let interactRetries = 0;
            while (!interactHit && interactRetries < 4) {
                interactRetries++;
                log.info(`[新版寻路] 交互按钮识别失败，重试${interactRetries}...`);
                await sleep(3000);
                interactHit = wipOcrCheckText(stygianInteractRoi_final, ["幽境危战"], `新版寻路-交互-r${interactRetries}`, isDebug);
            }

            if (!interactHit) {
                log.warn('[新版寻路] 多次重试后仍未识别到幽境危战交互按钮，回退到路径追踪');
                return false;
            }

            log.info('[新版寻路] 识别到幽境危战交互按钮，按F进入');
            await keyPress("F");
            await sleep(2000);

            log.info('[新版寻路] 寻路成功');
            return true;

        } catch (ex) {
            log.warn(`[新版寻路] 检测异常: ${ex?.message || ex}`);
            try { await genshin.returnMainUi(); } catch(e2) {}
            return false;
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

    //更换战斗队伍
    async function Switchteams() {

        for (let i = 0;i < 2;i++){
            let teams = await Textocr("预设队伍",5,1,0,1360,985,200, 70);             

            let teams2 = await Textocr("预设队伍",5,0,0,1,0,160, 80);
            if (teams.found) {break}
            else if (!teams2.found && i == 1){log.warn("未找到预设队伍按钮，不执行切换操作...");return false;}
        }

        await click(936,150);
        await sleep(100);
        
        let YOffset = 0; // Y轴偏移量，根据需要调整

         //滚轮预操作
         await click(936,150);
         await sleep(100);
         await leftButtonDown();
         await sleep(100);
         await click(936,140);

         
         const maxRetries = 30; // 最大重试次数
         let retries = 0; // 当前重试次数
         while (retries < maxRetries) {
             let result1 = await Textocr(FightTeam,0.2,1,0,50,108,350, 900); 
             if (result1.found) {
                 await leftButtonUp();
                 await sleep(300);
                 await click(result.x,result.y); 
                 await sleep(500);
                 return true   
             }
             retries++; // 重试次数加1
             //滚轮操作
             YOffset += 100;
             if (retries === maxRetries || 130+YOffset > 1080) {
                await leftButtonUp();
                await sleep(100); 
                log.warn("未找到预设战斗队伍名称，保持原有队伍...");  
                await  keyPress("VK_ESCAPE");
                await sleep(500);
                return false;
            }
             await click(936,130+YOffset);
             await sleep(200);              
         }              

        return true;
    
    }

    log.warn("自动幽境危战版本：v2.4");
    log.warn("请保证队伍战斗实力，战斗失败或执行错误，会重试两次...");
    log.warn("使用前请在 <<幽境危战>> 中配置好战斗队伍...");
    log.info("使用树脂顺序：{0} ", golbalRewardText.join(" ->"))     
    log.info("圣遗物奖励选择：{0} ", Artifacts)  
    if (!(FightTeam === undefined || FightTeam === "")){log.info("配置战斗队伍为：{0}", FightTeam)}

    //重试两次
    var shouldStop = false;
    for (let j = 0;j < 2;j++) {  

        resinAgain = false; //重试标志
        shouldForceStop = false; // 重置强制停止标志

        try{    
                //1.导航进入页面
                await genshin.returnMainUi();
                
                // 根据开关选择导航方式
                let activityResult = false;
                if (settings.useNewPath) {
                    activityResult = await navigateViaActivity(settings.devMode);
                    
                    if (activityResult === "non_burst") {
                        log.warn("[新版寻路] 检测到不在爆发期，停止执行");
                        shouldStop = true;
                        throw new Error("当前处于非爆发期，停止执行...");
                    }
                    
                    if (!activityResult) {
                        log.warn("[新版寻路] 失败，回退到路径追踪");
                        await genshin.returnMainUi(); // 先恢复主界面
                        await pathingScript.runFile(`assets/全自动幽境危战.json`);
                        await VeinEntrance();
                    }
                } else {
                    await pathingScript.runFile(`assets/全自动幽境危战.json`);
                    await VeinEntrance();
                }             

                //2.难度确认和选择（同时检测非爆发期界面）
                let intoAction = null;
                let isNonBurst = false;
                let _pollStart = new Date();
                while (true) {
                    let _cap = captureGameRegion();
                    try {
                        let _resList = _cap.findMulti(RecognitionObject.ocr(1554, 970, 360, 105));
                        for (let _ri = 0; _ri < _resList.count; _ri++) {
                            if (_resList[_ri].text === "单人挑战") {
                                intoAction = { text: _resList[_ri].text, x: _resList[_ri].x, y: _resList[_ri].y, found: true };
                                break;
                            }
                        }
                    } finally {
                        _cap.dispose();
                    }
                    if (intoAction) break;
                    await sleep(100);

                    _cap = captureGameRegion();
                    try {
                        let _resList = _cap.findMulti(RecognitionObject.ocr(861, 426, 197, 70));
                        for (let _ri = 0; _ri < _resList.count; _ri++) {
                            if (_resList[_ri].text === "紊乱平息") {
                                isNonBurst = true;
                                break;
                            }
                        }
                    } finally {
                        _cap.dispose();
                    }
                    if (isNonBurst) break;

                    if (new Date() - _pollStart > 20000) {
                        await genshin.returnMainUi();
                        throw new Error("未进入挑战页面，停止执行...")
                    }
                    await sleep(100);
                }

                if (isNonBurst) {
                    if (settings.devMode) {
                        log.warn("[开发模式] 检测到紊乱平息，但继续执行");
                    } else {
                        await genshin.returnMainUi();
                        shouldStop = true;
                        throw new Error("当前处于非爆发期（紊乱平息），停止执行...")
                    }
                }

                //2.5 判断爆发期
                let rewardsBu  = await imageRecognition(rewardsButton,0.1, 0, 0,63,949,87,80);
                if (!rewardsBu.found){
                    if (settings.devMode) {
                        log.warn("[开发模式] 未检测到爆发期标志，但继续执行");
                    } else {
                        await genshin.returnMainUi();
                        shouldStop = true;
                        throw new Error("未在爆发期内，停止执行...")
                    }
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
                let enter  = await imageRecognition(enterButton,20, 0, 0,15,96 ,40,43);
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
                             
                //6.5 更换队伍
                if (FightTeam === undefined || FightTeam === ""){log.info("不更换战斗队伍...");}
                else{
                    log.info("配置战斗队伍为：{0}", FightTeam)
                    await Switchteams();
                }

                //7.开始挑战
                await Textocr("开始挑战",1,1,0,1554,970,360, 105);               
                var resinexhaustion = false; // 条件1：树脂耗尽

                //8.战斗循环    
                for (let i = 0;i < challengeNum; i++) {

                    log.info("进入战斗环境，开始第 {0} 次战斗", i+1)  

                    //8.1自动战斗                                  
                    for (let fightCount = 0; fightCount < 3; fightCount++) {

                        let battleBegins  = await Textocr("战斗开始",30,0,0,877,235,164,50);     
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
                                    // 战斗线程异常，强制停止
                                    if (shouldForceStop) {
                                        throw new Error("战斗线程异常，强制停止脚本...");
                                    }
                                    let Again = await Textocr("再次挑战",20,1,0,1059,920,177,65);
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
                            // 如果是强制停止，直接向上抛出
                            if (shouldForceStop) {
                                throw error;
                            }
                            if (fightCount < 2)continue;
                            else break;
                        }   
                    }

                    //8.2领取奖励                   
                    if (resinAgain != true) {   
                        
                        await sleep(1000);
                        await keyPress("VK_ESCAPE"); 
                        await sleep(1000);
                        
                        while(await imageRecognition(enterButton,5, 0, 0,15,96 ,40,43).found == false)
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
            if (shouldStop === true) {
                break;
            }
            resinAgain = true;
            await genshin.returnMainUi(); 
            continue;
        }finally{
            // 开发模式：脚本退出时统一清除所有红框（覆盖所有退出路径）
            if (settings.devMode) {
                for (let i = 0; i < 3; i++) {
                    try {
                        const clearRa = captureGameRegion();
                        // 使用左上角1x1区域覆盖来清除红框（极小，几乎不可见）
                        const clearRegion = clearRa.DeriveCrop(0, 0, 1, 1);
                        clearRegion.DrawSelf("rect");
                        clearRa.dispose();
                        break;
                    } catch (clearErr) {
                        log.warn(`[DEBUG] 清除红框尝试${i+1}失败: ${clearErr.message}`);
                        await sleep(200);
                    }
                }
            }

            //10.结束脚本
            // 白名单逻辑：只有严重错误（shouldForceStop=true）时才执行退出流程
            // 触发条件：战斗策略文件不存在、战斗脚本文件不存在、未匹配到任何战斗脚本等致命错误
            if (shouldForceStop) {
                let interruptFound = false;
                for (let i = 0; i < 3; i++) {
                    if (i > 0) {
                        await keyPress("VK_ESCAPE");
                        await sleep(800);
                    } else {
                        await keyPress("VK_ESCAPE");
                        await sleep(800);
                    }
                    const interruptResult = wipOcrCheckText([0, 0, 1920, 1080], ["中断挑战"], "退出-中断挑战", settings.devMode);
                    if (interruptResult) {
                        // 点击"中断挑战"
                        GameCaptureRegion.gameRegion1080PPosClick(interruptResult.centerX, interruptResult.centerY);
                        interruptFound = true;
                        break;
                    }
                }

                if (!interruptFound) {
                    log.warn("未找到'中断挑战'按钮，直接返回主界面");
                    await genshin.returnMainUi();
                } else {
                    await sleep(1000);

                    let returnFound = false;
                    for (let j = 0; j < 2; j++) {
                        const returnResult = wipOcrCheckText([0, 0, 1920, 1080], ["返回"], "退出-返回", settings.devMode);
                        if (returnResult) {
                            // 点击"返回"
                            GameCaptureRegion.gameRegion1080PPosClick(returnResult.centerX, returnResult.centerY);
                            returnFound = true;
                            break;
                        }
                        if (j === 0) {
                            await sleep(1500);  // 等待界面加载（原500ms太快）
                        }
                    }

                    if (!returnFound) {
                        log.warn("未找到'返回'按钮，等待9秒后返回主界面");
                        await sleep(9000);
                    }

                    await sleep(1500);
                    await genshin.returnMainUi();
                }
            }
            if (resinAgain == false) log.info(`Auto自动幽境危战结束...`);
        }
    }

})().catch(error => {
    // 捕获取消任务异常（停止脚本执行）
    const msg = (error && typeof error === "object" && "message" in error)
        ? String(error.message)
        : String(error ?? "");
    if (/取消|canceled|cancelled/i.test(msg)) {
        // 如果当前在战斗中，取消战斗线程
        if (isFighting && fightCts) {
            try {
                log.info("正在取消战斗任务...");
                fightCts.cancel();
                log.info("已取消战斗任务");
            } catch (e) {
                log.warn(`取消战斗任务时出错: ${e.message}`);
            }
        }
        log.info("用户已停止脚本执行");
    } else {
        log.error(`脚本执行异常: ${msg}`);
    }
});