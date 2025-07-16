(async function () {

    /**
     * 封装函数，执行图片识别及点击操作（测试中，未封装完成，后续会优化逻辑）
     */
    async function imageRecognition(imagefilePath="空参数",timeout=10,afterBehavior=0,debugmodel=0,xa=0,ya=0,wa=1920,ha=1080) {
        const startTime = new Date();
        //  const recognitionObject = new RecognitionObject();
        //  recognitionObject.UseMask = false; // 设置 UseMask 为 true
        // 下个版本BGI才支持带UseMask的构造函数
        const Imagidentify = RecognitionObject.TemplateMatch(file.ReadImageMatSync(imagefilePath));
        for (let ii = 0; ii < 10; ii++) {    
            captureRegion = captureGameRegion();  // 获取一张截图
            res = captureRegion.DeriveCrop(xa, ya, wa, ha).Find(Imagidentify);
        if (res.isEmpty()) {
            if (debugmodel===1 & xa===0 & ya===0){log.info("识别图片中")};
        } else {
          if (afterBehavior===1){if (xa===0 & ya===0){log.info("点击模式:开");}await sleep(1000);click(res.x+xa, res.y+ya);}else{if (debugmodel===1 & xa===0 & ya===0){log.info("点击模式:关")}}
          if (afterBehavior===2){if (xa===0 & ya===0){log.info("F模式:开");}await sleep(1000);keyPress("F");}else{if (debugmodel===1 & xa===0 & ya===0){log.info("F模式:关")}}
          if (debugmodel===1 & xa===0 & ya===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);}else{if(ii<=1) log.info("识别到元素");}
          return result = { x: res.x+xa, y: res.y+ya, w:res.width,h:res.Height,found: true }
        }
        const NowTime = new Date();
        if ((NowTime - startTime)>timeout*1000){if (debugmodel===1 & xa===0 & ya===0){log.info(`${timeout}秒超时退出，未找到图片`);}return result = {found: false };}else{ii=8}
        await sleep(200); 
        }
        await sleep(1200); 
    }

    //ocr封装函数
    async function Textocr(wenzi="空参数",chaotime=10,clickocr=0,debugcode=0,x=0,y=0,w=1920,h=1080) {
        const startTime = new Date();
        for (let ii = 0; ii < 10; ii++) 
        {    
            let captureRegion = captureGameRegion();
            let  res1
            let resList = captureRegion.findMulti(RecognitionObject.ocr(x,y,w,h));
            for (let i = 0; i < resList.count; i++) { 
                let res = resList[i];
                res1=res.text
                if (res.text === wenzi) {
                    if(ii<=1)log.info(`·${res1}·识别到`)
                    if (debugcode === 1){
                        if (x === 0 & y === 0){
                            log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);
                            return result = { text: res.text, x: res.x, y: res.y, found: true }}
                        }
                        else{if (x === 0 & y === 0){log.info("文本OCR完成'{text}'", res.text);}
                    }
                    if (clickocr===1){await sleep(1000);click(res.x, res.y);} 
                    if (clickocr===2){await sleep(100);keyPress("F");}
                    if (debugcode===3){ 
                        break;
                    }
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
                if (debugcode===2 && !res.isEmpty()){
                    return result = { text: res.text, x: res.x, y: res.y, found: true }
                }
            }

            if (debugcode===3 && (resList.count <=0 || res1!=wenzi) ){
                return result = { found: true }
            }

            const NowTime = new Date();
            if (Math.abs(NowTime - startTime)>chaotime*1000){
                if (x===0 & y===0){
                    log.info(`${chaotime}秒超时退出，·${wenzi}·未找到`);
                }
                return result = {found: false};
            }
            else{
                ii=8; 
                if(x !== 840 && x !== 1188){
                    keyPress("w")
                }; 
            }
            await sleep(100);
        }   
    }
   
    //初始化
    var SMODEL = settings.SMODEL ? settings.SMODEL : false; // false 公版BETTERGI，true 自编译版本LCB
    var SHUOVER=0 //0初始状态，1队伍配置标志，2结束线路，3线路出错
    var haoganq=0 //0初始状态，1好感队伍配置标志
    var Rewards = settings.Rewards ? settings.Rewards : false; // ture 领取冒险点奖励，false 不领取冒险点奖励
    var Fligtin = false;  //领取冒险点奖励标志。
    var tolerance = 30;
    var position ={};
    var position_another ={};
    var repeatRoute = false;//线路重复标志
    var Lastexecution = false;//线路执行标志，用于判断上一线路是否执行。
    var Fightquick = settings.Fightquick ? settings.Fightquick : true; 
    var Fighttimeout = settings.timeout * 1000 ? settings.timeout * 1000 : 180000;//战斗超时时间，默认为240秒
    const ocrRegion2 = { x: 0, y: 200, width: 300, height: 300 };     // 追踪任务区域
    const ocrRo2 = RecognitionObject.ocr(ocrRegion2.x, ocrRegion2.y, ocrRegion2.width, ocrRegion2.height);
    const ocrRegion1 = { x: 800, y: 200, width: 300, height: 100 };   // 中心区域
    const ocrRo1 = RecognitionObject.ocr(ocrRegion1.x, ocrRegion1.y, ocrRegion1.width, ocrRegion1.height);
    const ocrRegion3 = { x: 906, y: 928, width: 161, height: 100 };   // 下方区域
    const ocrRo3 = RecognitionObject.ocr(ocrRegion3.x, ocrRegion3.y, ocrRegion3.width, ocrRegion3.height);
    var method= settings.method ? settings.method : "冒险之证"; 
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
    const golbalRewards = ["","浓缩树脂","原粹树脂","脆弱树脂","须臾树脂"]; // 对应四种树脂
    // 根据 rewards 数组长度，依次赋值给对应的变量
    if (rewards.length > 0) onerewards = golbalRewards[rewards[0]];
    if (rewards.length > 1) secendrewards = golbalRewards[rewards[1]];
    if (rewards.length > 2) threendrewards = golbalRewards[rewards[2]];
    if (rewards.length > 3) fourdrewards = golbalRewards[rewards[3]];
    const golbalRewardText = [onerewards, secendrewards, threendrewards, fourdrewards].filter(Boolean);//过滤树脂使用类型
   
    var doneCount = 0;

    filePath = ""
    // 读取原始次数配置   
    var rawTimes = settings.times*2 ? settings.times : "6";
    const colorMap = {
        "1-蓝花(经验花)": 1,
        "2-黄花(摩拉花)": 2
    };
    var color = colorMap[settings.color] || 1;
    const modelMap = {
        "1-次数刷取": 1,
        "2-树脂耗尽": 2
    };
    var SHUV = modelMap[settings.shuv] || 1;

    var BIAOZZ = "assets/model/BIAOZ.bmp"
    var timesValue = 12; // 设置默认值
    var num = parseFloat(rawTimes) * 2; // 直接计算乘以2后的值，并尝试转换为浮点数
    // 如果输入是有效的数字，并且在合理范围内，则更新timesValue
    if (/^-?\d+\.?\d*$/.test(rawTimes) && num >= 1 && num <= 198) {
        timesValue = Math.max(1, Math.min(198, Math.floor(num))); // 确保timesValue为整数，并且不超过上限
    }  
    var timesConfig = { value: timesValue };

    log.warn(`全自动枫丹地脉花: v3.3 - ${SHUV}.${color}.${rawTimes}`);//调试LOG
    log.warn(`使用树脂类型数量：${rewards.length}`);
    log.warn(`使用树脂顺序：${golbalRewardText.join(" ->")}`); 

    if  (color == 2){ var DIMAIHUA = "assets/model/DIMAIHUA-huank.bmp";var DIMAIHUA2 = "assets/model/DIMAIHUA-lank.bmp";}
    else if (color == 1){var DIMAIHUA = "assets/model/DIMAIHUA-lank.bmp";var DIMAIHUA2 = "assets/model/DIMAIHUA-huank.bmp";}
    else{var DIMAIHUA = "assets/model/DIMAIHUA-lank.bmp";;var DIMAIHUA2 = "assets/model/DIMAIHUA-huank.bmp";}
    var DIMAIHUA3 = "assets/model/DIMAIHUA-da.bmp"
    var DIMAIHUA4 = "assets/model/DIMAIHUA-da2.bmp"
    var condensedResin = "assets/model/condensed_resin_count.png";
    var originalResin = "assets/model/original_resin_count.png";
    var fragileResin = "assets/model/fragile_resin_count.png";
    var momentResin = "assets/model/moment_resin_count.png";
    var oneResin = "assets/model/one.png";
    
    if (Rewards){log.warn("结束后领励练点和提交每日...");if(settings.nh === undefined || settings.nh === "") {log.warn("好感队未配置，领奖励时不切换队伍..")}}
    if (SHUV == 1) {log.warn(`线路模式 ： <<按次数刷取>> ${timesConfig.value/2} 次 `);}else{log.warn("线路模式 ： 设定使用的树脂类型<<耗尽模式>>（最多99次）");timesConfig.value = 198;}
    if (color == 1) {log.warn("地脉类型 ： <<蓝色-经验花>>...");}else{log.warn("地脉类型 ： <<黄色-摩拉花>>...")}
    if (settings.n === undefined || settings.n === "") { log.warn("队伍名称未配置，不更换队伍...");SHUOVER=1;}
    if (settings.nh === undefined || settings.nh === "") { log.warn("好感队禁用...");haoganq=0}else{var haogandui = settings.nh;haoganq=1;if(settings.n === undefined ) {throw new Error("好感队已经设置，请填战斗队伍...")}}  
    let nowuidString = settings.nowuid ? settings.nowuid : "";      

    setGameMetrics(1920, 1080, 1);
    //================= 1.设定路线 =================

    const folder1 = 'assets/枫丹地脉花-路线1 厄里那斯/';
    const folder2 = 'assets/枫丹地脉花-路线2 秋分山西侧锚点左下/';
    const folder3 = 'assets/枫丹地脉花-路线3 秋分山西侧锚点右/';
    const folder4 = 'assets/枫丹地脉花-路线4 柔灯港上锚点/';
    const folder5 = 'assets/枫丹地脉花-路线5 新枫丹科学院左锚点/';
    const folder6 = 'assets/枫丹地脉花-路线6 芒索斯山东麓/';

    const pathing1 = [
        "枫丹地脉花-路线1 厄里那斯-1：厄里那斯神像下1.json",
        "枫丹地脉花-路线1 厄里那斯-1：厄里那斯神像下2.json",
        "枫丹地脉花-路线1 厄里那斯-2：厄里那斯神像右下1.json",
        "枫丹地脉花-路线1 厄里那斯-2：厄里那斯神像右下2.json",
        "枫丹地脉花-路线1 厄里那斯-3：厄里那斯神像右下_1.json",
        "枫丹地脉花-路线1 厄里那斯-3：厄里那斯神像右下_2.json",
        "枫丹地脉花-路线1 厄里那斯-4：厄里那斯神像右下下下1.json",
        "枫丹地脉花-路线1 厄里那斯-4：厄里那斯神像右下下下2.json",
        "枫丹地脉花-路线1 厄里那斯-5：厄里那斯神像下下下下1.json",
        "枫丹地脉花-路线1 厄里那斯-5：厄里那斯神像下下下下2.json",
        "枫丹地脉花-路线1 厄里那斯-6：厄里那斯神像下下下1.json",
        "枫丹地脉花-路线1 厄里那斯-6：厄里那斯神像下下下2.json",
    ]; 

    const pathing2 = [
        "枫丹地脉花-路线2 秋分山西侧锚点左下-1：秋分山左下1.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-1：秋分山左下2.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-2：秋分山左下+1.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-2：秋分山左下+2.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-3：秋分山左下下1.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-3：秋分山左下下2.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-4：秋分山左下下下1.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-4：秋分山左下下下2.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下1.json",
        "枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下2.json",
    ]; 

    const pathing3 = [
        "枫丹地脉花-路线3 秋分山西侧锚点右-1：锚点右1.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-1：锚点右2.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-2：锚点右右1.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-2：锚点右右2.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-3：锚点右右右1.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-3：锚点右右右2.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-4：东侧锚点上1.json",
        "枫丹地脉花-路线3 秋分山西侧锚点右-4：东侧锚点上2.json",
    ]; 

    const pathing4 = [
       "枫丹地脉花-路线4 柔灯港上锚点-1：锚点左上1.json",
       "枫丹地脉花-路线4 柔灯港上锚点-1：锚点左上2.json",
        "枫丹地脉花-路线4 柔灯港上锚点-2：锚点左上+1.json",
        "枫丹地脉花-路线4 柔灯港上锚点-2：锚点左上+2.json",
        "枫丹地脉花-路线4 柔灯港上锚点-3：锚点左左上1.json",
        "枫丹地脉花-路线4 柔灯港上锚点-3：锚点左左上2.json",
        "枫丹地脉花-路线4 柔灯港上锚点-4：锚点左上++1.json",
        "枫丹地脉花-路线4 柔灯港上锚点-4：锚点左上++2.json",
    ]; 

    const pathing5 = [
        "枫丹地脉花-路线5 新枫丹科学院左锚点-1：锚点左上1.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-1：锚点左上2.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-2：锚点上1.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-2：锚点上2.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-3：科学院左上锚点1.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-3：科学院左上锚点2.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-4：科学院左上锚点左上1.json",
        "枫丹地脉花-路线5 新枫丹科学院左锚点-4：科学院左上锚点左上2.json",

    ]; 

    const pathing6 = [
        "枫丹地脉花-路线6 芒索斯山东麓-1：锚点下1.json",
        "枫丹地脉花-路线6 芒索斯山东麓-1：锚点下2.json",
        "枫丹地脉花-路线6 芒索斯山东麓-2：锚点右1.json",
        "枫丹地脉花-路线6 芒索斯山东麓-2：锚点右2.json",
        "枫丹地脉花-路线6 芒索斯山东麓-3：锚点左1.json",
        "枫丹地脉花-路线6 芒索斯山东麓-3：锚点左2.json",
        "枫丹地脉花-路线6 芒索斯山东麓-4：锚点左上1.json",
        "枫丹地脉花-路线6 芒索斯山东麓-4：锚点左上2.json",
    ]; 

    // 路线映射表-将用户设置映射对应路线
    const pathingMap = {
        "路线1 厄里那斯": pathing1,
        "路线2 秋分山西侧锚点左下": pathing2,
        "路线3 秋分山西侧锚点右": pathing3,
        "路线4 柔灯港上锚点": pathing4,
        "路线5 新枫丹科学院左锚点": pathing5,
        "路线6 芒索斯山东麓": pathing6
    };

    const folderMap = {
        "路线1 厄里那斯": folder1,
        "路线2 秋分山西侧锚点左下": folder2,
        "路线3 秋分山西侧锚点右": folder3,
        "路线4 柔灯港上锚点": folder4,
        "路线5 新枫丹科学院左锚点": folder5,
        "路线6 芒索斯山东麓": folder6
    };

    const allFlowerCoords = [
        // 线路1
        { line: 1, flower: 1, x: 773, y: 669 , xR: 4760.80029296875 , yR: 2574.517578125 },
        { line: 1, flower: 2, x: 846, y: 696 , xR: 4653.67138671875 , yR: 2531.894287109375 },
        { line: 1, flower: 3, x: 902, y: 762 , xR: 4568.48828125 , yR: 2433.225341796875 },
        { line: 1, flower: 4, x: 912, y: 812 , xR: 4553.5107421875 , yR: 2358.491943359375 },
        { line: 1, flower: 5, x: 876, y: 840 , xR: 4607.455078125 , yR: 2316.584716796875 },
        { line: 1, flower: 6, x: 815, y: 788 , xR: 4700.13818359375 , yR: 2393.348876953125 },
        // 线路2
        { line: 2, flower: 1, x: 1160, y: 716 , xR: 4183.26953125 , yR: 2502.36962890625 },
        { line: 2, flower: 2, x: 1155, y: 766 , xR: 4190.03271484375 , yR: 2426.40625 },
        { line: 2, flower: 3, x: 1117, y: 801 , xR: 4246.28271484375 , yR: 2374.04833984375 },
        { line: 2, flower: 4, x: 1082, y: 896 , xR: 4299.75146484375 , yR: 2232.588134765625 },
        { line: 2, flower: 5, x: 1013, y: 883 , xR: 4402.5263671875 , yR: 2253.2724609375 },
        // 线路3√
        { line: 3, flower: 1, x: 1216, y: 661 , xR: 4098.6328125 , yR: 2584.1611328125 },
        { line: 3, flower: 2, x: 1230, y: 685 , xR: 4063.5205078125 , yR: 2564.291259765625 },
        { line: 3, flower: 3, x: 1282, y: 642 , xR: 3999.6552734375 , yR: 2613.181640625 },
        { line: 3, flower: 4, x: 1335, y: 639 , xR: 3921.345703125 , yR: 2617.813232421875 },
        // 线路4
        { line: 4, flower: 1, x: 965, y: 672 , xR: 2932.47265625 , yR: 3583.896728515625 },
        { line: 4, flower: 2, x: 921, y: 660 , xR: 3008.40234375 , yR: 3602.593017578125 },
        { line: 4, flower: 3, x: 886, y: 660 , xR: 3077.185546875 , yR: 3602.835693359375 },
        { line: 4, flower: 4, x: 876, y: 625 , xR: 3091.7978515625 , yR: 3654.750732421875 },
        // 线路5
        { line: 5, flower: 1, x: 727, y: 153 , xR: 4556.0986328125 , yR: 4762.41748046875 },
        { line: 5, flower: 2, x: 752, y: 78 ,  xR: 4517.81201171875 , yR: 4866.47802734375 },
        { line: 5, flower: 3, x: 712, y: 47 ,  xR: 4578.63134765625 , yR: 4913.2822265625 },
        { line: 5, flower: 4, x: 643, y: 4 ,   xR: 4679.46875 , yR: 4977.8310546875 },
        // 线路6
        { line: 6, flower: 1, x: 0, y: 0 ,     xR: 4962.818359375 , yR: 4395.8056640625 },
        { line: 6, flower: 2, x: 469, y: 369 , xR: 4952.037109375 , yR: 4468.8408203125 },
        { line: 6, flower: 3, x: 400, y: 343 , xR: 5043.3564453125 , yR: 4479.98974609375 },
        { line: 6, flower: 4, x: 371, y: 281 , xR: 5087.0234375 , yR: 4573.26708984375 },
      ];      
    
    async function PathCheak(findFlower=0) {

        if (method=="拖动地图"){findFlower = findFlower === 0 ? 1 : 0;}

        if (findFlower == 0){
            return await PathCheak0();
        }else
        if (findFlower == 1){
            return await PathCheak1();  
        }
    }

    async function PathCheak0() {   

        repeatRoute = false;
        var bigMapPosition={x:0,y:0};  

        await genshin.returnMainUi();
        log.info("重置地图中,打开冒险之证寻找地脉花...");  
        await genshin.tp(2297.60, -824.45);
        await genshin.returnMainUi();    

        for(let i = 0;i<5;i++){
            await sleep(700);
            await keyPress("VK_ESCAPE");
            await sleep(300);

            for(let j=0;j<5;j++){
                let book = await Textocr("冒险之证",3,0,0,113,626,630,430);
                if (book.found){
                    await click(book.x+40,book.y+10);
                    await sleep(500);
                }
                let bookconfirm = await Textocr("冒险之证",0.1,0,3,113,626,630,430);   
                if (bookconfirm.found){    
                    break 
                }else{
                    continue
                }
            }

            let crusade = await await Textocr("讨伐",5,1,0,127,98,437,900);
            if (!crusade.found){
                log.info("冒险之证打开错误T..."); 
                continue;
            }

            await sleep(500);
            await click(860,683);

            let dimai = await imageRecognition(DIMAIHUA3,2,0,0,400,248,550,370);
            if (!dimai.found){
                await sleep(500);
                await click(956,288);
                await sleep(500);          
                await moveMouseTo(956,282);
                await sleep(100);
                await leftButtonDown();
                await sleep(100);
                await moveMouseTo(956,275);
                await sleep(100);
                await moveMouseTo(956,273);
                await sleep(100);
                await leftButtonUp();
                let dimai2 = await imageRecognition(DIMAIHUA3,1,0,0,400,248,550,370);
                if (!dimai2.found){continue}
            }
            
            await sleep(200);
            if (color==1){
                await imageRecognition(DIMAIHUA4,2,1,0,400,248,550,370);
            }else{
                await imageRecognition(DIMAIHUA3,2,1,0,400,248,550,370);
            }

            let fontaine = await Textocr("枫丹",1,0,0,1031,641,250,240);
            if (!fontaine.found){
                await sleep(1000);
                await click(1562,787);
                await sleep(1000);
                let fontaine1 = await Textocr("枫丹",1,1,0,1031,641,250,240);
                if(!fontaine1.found){await click(1524,670);}
                await sleep(1000);
                let fontaine2 = await Textocr("枫丹",1,0,0,1031,641,250,240);
                if (!fontaine2.found){continue}
            }

            for(let i=0;i<5;i++){
                await sleep(500);
                await click(1529,846);
                await sleep(500);
                await click(1529,846);
                await sleep(1500);  
                let crusade = await await Textocr("讨伐",0,1,0,127,98,437,900);
                if (crusade.found){
                    continue
                }else{
                    break
                }
            }

            try{
                bigMapPosition = genshin.getPositionFromBigMap();
                if (bigMapPosition.x >= 2900 && bigMapPosition.y <= 5100 ){
                    log.info("区域正确...");
                    break;
                }else{
                    log.info("区域错误...");                     
                }
            }
            catch(error){
                log.info("冒险之证打开错误G...", error);
                continue;                          
            }                   
        }
                          
        const bigMapZoomLevel = genshin.getBigMapZoomLevel();
        // log.info(`当前大地图坐标: X：${Math.floor(bigMapPosition.X)} / Y：${Math.floor(bigMapPosition.Y)}`); 
        // log.info(`当前大地图缩放：${bigMapZoomLevel}`); 
        const RealPosition ={x: bigMapPosition.X,y: bigMapPosition.Y}
        position = await findFlowerPositionWithTolerance(RealPosition,10,allFlowerCoords);
        if (position){
            log.info(`找到地脉花的线路：|X:${Math.floor(bigMapPosition.X)}|Y:${Math.floor(bigMapPosition.Y)}|线路:${position.line}|序号:${position.flower}|`);
            let XIAN_another = await imageRecognition(DIMAIHUA2,1,0,0,0);
            if (XIAN_another.found){
                if (XIAN_another.found){
                    let  recognizedCoord_another = { x: ( bigMapPosition.X+((960-(XIAN_another.x+XIAN_another.w/2))*(5-bigMapZoomLevel))), y: ( bigMapPosition.Y+((540-(XIAN_another.y+XIAN_another.h/2)))*(5-bigMapZoomLevel))};
                    position_another = await findFlowerPositionWithTolerance(recognizedCoord_another, 10,allFlowerCoords);
                    log.info(`找到另一个线路：|X:${Math.floor( bigMapPosition.X+((960-(XIAN_another.x+XIAN_another.w/2))*(5-bigMapZoomLevel)))}|Y:${Math.floor( bigMapPosition.Y+((540-(XIAN_another.y+XIAN_another.h/2)))*(5-bigMapZoomLevel))}|线路:${position_another.line}|序号:${position_another.flower}|`);
                } 
            }

            if (position_another.line == position.line){
                log.info("线路重合，绕过模式打开...");repeatRoute = true;
            }else{
                log.info("线路正常...");repeatRoute = false;
            }

            return true
        }    
        else{
            return false
        }
    }

    // 输出选择的线路
    async function PathCheak1() {
        repeatRoute = false;
        await genshin.returnMainUi();
        log.info("重置地图中,关闭自定义标记，快速拖动模式寻找地脉花……");  
        await genshin.tp(2297.60, -824.45);
        await genshin.returnMainUi();

        // //自定义标关闭
        await sleep(1200);
        await keyPress("M");
        await sleep(1200);
        await click(53,1019);
        await sleep(200);
        await imageRecognition(BIAOZZ,0.6,1,0,1782,284,122,73);
        await sleep(100);
        await keyPress("VK_ESCAPE");
        await sleep(600);

        //开始寻找
        await genshin.setBigMapZoomLevel(3.5);
        await click(1844,1021);
        await sleep(500);
        await click(1446,350);
        await sleep(500);
        let XIAN6 = await imageRecognition(DIMAIHUA,0.5,0,0,387,0,700,200);if (XIAN6.found){
            log.info("地脉花位置: X:"+XIAN6.x+" Y:"+XIAN6.y);
            position = {line:6,flower:1};
            return true }//return true
        await moveMouseTo(1275,601);
        await sleep(200);
        await leftButtonDown();
        await sleep(300);
        await moveMouseTo(1275,651);
        await sleep(300);
        await moveMouseTo(1275,300);
        await sleep(300);
        await moveMouseTo(1272,18);
        await sleep(500);
        let XIAN123 = await imageRecognition(DIMAIHUA,1,0,0,0,0,1720,1080);
        if (XIAN123.found){

            let XIAN123_another = await imageRecognition(DIMAIHUA2,0.5,0,0,0,0,1720,1080);
            if (XIAN123_another.found){
                log.info("地脉花位置_another: X:"+XIAN123_another.x+" Y:"+XIAN123_another.y);
                const recognizedCoord_another = { x: XIAN123_another.x, y: XIAN123_another.y };
                position_another = await findFlowerPositionWithTolerance(recognizedCoord_another, tolerance,allFlowerCoords);        
            } 

            log.info("地脉花位置: X:"+XIAN123.x+" Y:"+XIAN123.y);
            const recognizedCoord = { x: XIAN123.x, y: XIAN123.y };
            position = await findFlowerPositionWithTolerance(recognizedCoord, tolerance,allFlowerCoords);

            if (position.line == 3){position = await findFlowerPositionWithTolerance(recognizedCoord, tolerance,allFlowerCoords);}

            if (position) {

                if (position_another.line == position.line){log.info("线路重合，谨慎模式打开...");repeatRoute = true;}

                return true;
              } else {
                log.info(`无法找到花朵位置（在容错范围内）。`);return false;
              }
        }
        await sleep(500);
        await moveMouseTo(132,783);
        await sleep(800);
        let XIAN4 = await imageRecognition(DIMAIHUA,1,0,0);
         if (XIAN4.found){

            let XIAN4_another = await imageRecognition(DIMAIHUA2,0.5,0,0);
            if (XIAN4_another.found){
                log.info("地脉花位置_another: X:"+XIAN4_another.x+" Y:"+XIAN4_another.y);
                const recognizedCoord_another = { x: XIAN4_another.x, y: XIAN4_another.y };
                position_another = await findFlowerPositionWithTolerance(recognizedCoord_another, tolerance,allFlowerCoords);        
            }            

            log.info("地脉花位置: X:"+XIAN4.x+" Y:"+XIAN4.y);
            const recognizedCoord = { x: XIAN4.x, y: XIAN4.y };
            position = await findFlowerPositionWithTolerance(recognizedCoord, tolerance,allFlowerCoords);

            if (position) {

                if (position_another.line == position.line){log.info("线路重合，谨慎模式打开...");repeatRoute = true;}

                return true;
              } else {
                log.info(`无法找到花朵位置（在容错范围内）。`);return false;
              }
        }
        await sleep(500);
        await moveMouseTo(1064,1079);
        await sleep(200);
        let XIAN56 = await imageRecognition(DIMAIHUA,1,0,0);
        if (XIAN56.found){

            let XIAN56_another = await imageRecognition(DIMAIHUA2,0.5,0,0);
            if (XIAN56_another.found){
                log.info("地脉花位置_another: X:"+XIAN56_another.x+" Y:"+XIAN56_another.y);
                const recognizedCoord_another = { x: XIAN56_another.x, y: XIAN56_another.y };
                position_another = await findFlowerPositionWithTolerance(recognizedCoord_another, tolerance,allFlowerCoords);        
            } 

            log.info("地脉花位置: X:"+XIAN56.x+" Y:"+XIAN56.y);
            const recognizedCoord = { x: XIAN56.x, y: XIAN56.y };
            position = await findFlowerPositionWithTolerance(recognizedCoord, tolerance,allFlowerCoords);

            if (position) {

                if (position_another.line == position.line){log.info("线路重合，谨慎模式打开...");repeatRoute = true;}

                return true;
              } else {
                log.info(`无法找到花朵位置（在容错范围内）。`);return false;
            }
            
        }else{throw new Error("线路出错，退出！")}        
    }

    function findFlowerPositionWithTolerance(coord, tolerance,allFlowerCoordsIn) {

        let closestFlower = null; // 用于记录最近的花朵
        let closestDistance = Infinity; // 初始化最近距离为无穷大
        let matches = []; // 用于存储所有匹配的花朵

        // 遍历所有花朵坐标，检查是否在容错范围内
        for (let i = 0; i < allFlowerCoordsIn.length; i++) {
            const flower = allFlowerCoordsIn[i];

            if (tolerance == 10){
                var distance = Math.sqrt(Math.pow(flower.xR - coord.x, 2) + Math.pow(flower.yR - coord.y, 2));
            }else{
                var distance = Math.sqrt(Math.pow(flower.x - coord.x, 2) + Math.pow(flower.y - coord.y, 2));
            }

            if (distance <= tolerance) {
                matches.push(flower); // 在容错范围内，添加到匹配列表
            } else {
                // 如果不在容错范围内，则检查是否是当前最近的花朵
                if (distance < closestDistance) {
                    closestFlower = flower;
                    closestDistance = distance;
                }
            }
        }

        // 根据匹配情况返回结果
        if (matches.length === 1) {
            // 找到一个符合项，返回这个项
            log.warn("找到了一个匹配的花朵！", matches[0].line,matches[0].flower);
            return { line: matches[0].line, flower: matches[0].flower,x: matches[0].x, y: matches[0].y };
        } else if (matches.length > 1) {
            // 找到多个符合项，处理逻辑
            let minXDiff = Infinity;
            let minYDiff = Infinity;
            let minXFlower = null;
            let minYFlower = null;

            for (let i = 0; i < matches.length; i++) {
                const diffX = Math.abs(matches[i].x - coord.x);
                const diffY = Math.abs(matches[i].y - coord.y);

                if (diffX < minXDiff) {
                    minXDiff = diffX;
                    minXFlower = matches[i];
                }

                if (diffY < minYDiff) {
                    minYDiff = diffY;
                    minYFlower = matches[i];
                }
            }

            // 比对X轴和Y轴的最小差距，返回对应的花朵
            if (minXDiff < minYDiff) {
                log.warn("找到了多个匹配的花朵，选择X轴差距最小的花朵！", minXFlower.line,minXFlower.flower);
                return { line: minXFlower.line, flower: minXFlower.flower,x: minXFlower.x, y: minXFlower.y };
            } else {
                log.warn("找到了多个匹配的花朵，选择Y轴差距最小的花朵！", minYFlower.line,minYFlower.flower);
                return { line: minYFlower.line, flower: minYFlower.flower,x: minYFlower.x, y: minYFlower.y };
            }
        } else {
            // 没有找到符合项，返回全局最近的花朵
            if (closestFlower) {
                log.warn("没有找到地脉花，返回最近地脉花！", closestFlower.line,closestFlower.flower);
                return { line: closestFlower.line, flower: closestFlower.flower,x: closestFlower.x, y: closestFlower.y };
            } else {
                // 如果没有找到任何花朵，返回一个默认值或抛出错误（根据实际需求决定）
                throw new Error("未找到任何花朵");
            }
        }
    }

    //寻找地脉溢口，文字识别不到转圈寻找，不管有没找到都执行战斗，最后领取奖励判断是否继续执行
    async function VeinEntrance() {
        for (let i = 0;i < 2;i++) {
            let JIECHU = await Textocr("接触地脉溢口",1,2,0,1187,358,200,400);
            if (JIECHU.found)
            {
                await keyPress("F");await dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));await keyPress("F");return true;
            }
            else{
                if(i == 1){
                    let SHUN01 = await Textocr("接触地脉之花",0.2,0,0,1188,358,200,400);
                    let SHUN02 = await Textocr("地脉之花", 0.2, 0, 0, 840,225, 230, 125);
                        if (SHUN01.found || SHUN02.found) {
                            await keyPress("VK_ESCAPE");
                            await sleep(1000);
                            await genshin.returnMainUi();
                            await sleep(1000);
                            log.info("找到地脉之花，开始领取奖励...");
                            return false;
                        }
                    log.warn("没找到地脉花，尝试强制转圈寻找，不管有没找到都执行战斗...");  
                    await dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                    await keyDown("W");await sleep(500);await keyUp("W"); 
                    await keyDown("D");await sleep(500);await keyUp("D");
                    await dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                    await keyDown("S");await sleep(1000);await keyUp("S");
                    await keyDown("A");await sleep(1000);await keyUp("A");
                    await dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                    await keyDown("W");await sleep(1500);await keyUp("W");
                    await dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
                    await sleep(1000);
                    await keyPress("VK_ESCAPE");
                    await sleep(500);
                    await genshin.returnMainUi();
                    await sleep(500);
                    return true;
                }
            }
        }
    }

    //定义领取动作,好感队伍是否添加？
    async function claimRewards() {
        log.info(`尝试领取奖励，优先${onerewards}'`);
        let SHUN01 = await Textocr("接触地脉之花",1.5,2,0,1187,358,200,400);
        if (SHUN01.found) {
            log.info("找到地脉之花，开始领取奖励...");
        }else{
                let SHUN02 = await Textocr("接触地脉之花",1,2,0,1187,358,200,400);
                if (!SHUN02.found) {log.info("未找到地脉之花，尝试强制转圈寻找...")
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("W");await sleep(500);await keyUp("W"); 
                await keyDown("D");await sleep(500);await keyUp("D");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("S");await sleep(1000);await keyUp("S");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("A");await sleep(1000);await keyUp("A");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));
                await keyDown("W");await sleep(1500);await keyUp("W");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
                }
        }
        
        await Textocr("地脉之花", 1, 1, 0, 840,225, 230, 125);
        await sleep(500);

        for (let j = 0;j < 2;j++) {
 
            for (let i = 0;i < rewards.length;i++) {
                let SHU =  await Textocr(resinTypeMap[rewards[i]],0.1,0,0,510,380,640,600);
                if (SHU.found){
                    if (resinTypeMap[rewards[i]] == "使用20个原粹树脂")
                    {
                      let BUC =  await Textocr("补充",0.1,0,0,1150,440,210,130);
                        if (BUC.found) {continue;}                                           
                    }

                    let { condensedResinCount, originalResinCount, fragileResinCount, momentResinCount } = await getRemainResinStatus(); 

                    switch (rewards[i]) {
                        case 1:
                            condensedResinCount--;
                            break;
                        case 2:
                            originalResinCount -= 20;
                            break;
                        case 3:
                            fragileResinCount--;
                            break;
                        case 4:
                            momentResinCount--;
                            break;
                    }

                    let shouldExit = true;

                    if (resinTypes.includes("1"))
                    {
                        shouldExit &= (parseInt(condensedResinCount, 10) <= 0);
                    }
                    if (resinTypes.includes("2"))
                    {
                        shouldExit &= (parseInt(originalResinCount, 10) < 20);
                    }
                    if (resinTypes.includes("3"))
                    {
                        shouldExit &= (parseInt(fragileResinCount, 10)  <= 0);
                    }
                    if (resinTypes.includes("4"))
                    {
                        shouldExit &= (parseInt(momentResinCount, 10)  <= 0);
                    }   

                    log.info(`${resinTypeMap[rewards[i]]} ...`);   
                    await click(SHU.x+550,SHU.y)                  
                    
                    if (shouldExit) 
                    {
                        log.warn("树脂耗尽，停止执行...");
                        await sleep(1000);  
                        SHUOVER=2;  
                        return false;     
                    } 

                    return true;
                }            
            }
            await sleep(500);  
        }
        log.warn("未找到树脂，结束地脉花...");
        await sleep(1000);        
        await keyPress("VK_ESCAPE");
        await sleep(1000);
        SHUOVER=2;
        return false;           
    }

    async function getRemainResinStatus() {
        var condensedResinCount = 0; // 浓缩树脂
        var originalResinCount = 0; // 原粹树脂
        var fragileResinCount = 0; // 脆弱树脂
        var momentResinCount = 0; //须臾树脂

        // 浓缩树脂
        var condensedResinCountRa = await imageRecognition(condensedResin,0.1, 0, 0,800,20,700,55);
        if (condensedResinCountRa.found) {  
            let countArea = await Textocr("",2, 0, 2,condensedResinCountRa.x,condensedResinCountRa.y-20,100,80);//
            if (countArea.found){
                // log.info("浓缩树脂识别数量结果： "+ countArea.text);
                condensedResinCount = countArea.text
            }
            else
            {           
                condensedResinCount = "1";
                log.info("浓缩树脂识别数量结果：1");//不知道为什么，1无法识别，0是不显示图标的，所以就当时1了，反正也没啥影响
            }
        }else{
            log.info("未检测到浓缩树脂图标");        
        }       

        var originalResinCountRa = await imageRecognition(originalResin,0.1, 0, 0,1555,0,90,80);
        if (originalResinCountRa.found) {  
            // await moveMouseTo(originalResinCountRa.x,originalResinCountRa.y);   
            let countArea = await Textocr("",0.5, 0, 2,originalResinCountRa.x+originalResinCountRa.w,originalResinCountRa.y,originalResinCountRa.w*3,originalResinCountRa.h);//
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

        var momentResinCountRa = await imageRecognition(momentResin,0.1, 0, 1,1170,0,300,100);
        if (momentResinCountRa.found) {  
            // await moveMouseTo(momentResinCountRa.x+momentResinCountRa.w+15+momentResinCountRa.w+50,momentResinCountRa.y-15+momentResinCountRa.h+25);   
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

    async function isOnRewardPage() {
        const rewardText = await Textocr("地脉之花", 0.2, 0, 0, 840,225, 230, 125);
        return rewardText.found;
    }    

    async function isOnRewardPage() {
        const rewardText = await Textocr("地脉之花", 0.2, 0, 0, 840,225, 230, 125);
        return rewardText.found;
    }

    var shouldContinueChecking = true;
    /**
     * 异步检查领奖页面的函数
     *
     * @param timeout 超时时间，单位为毫秒，默认值为1000毫秒
     * @returns 无返回值
     */
    async function checkRewardPage(timeout = 1000) {

        if (!shouldContinueChecking) {
            return; // 如果不应该继续检测，则直接返回
        }
        if (await isOnRewardPage()) {
            log.info("检测到领奖页面，按ESC退出...");
            await keyPress("VK_ESCAPE"); // 按ESC退出领奖页面
            await genshin.returnMainUi();
            await sleep(timeout);
            checkRewardPage(timeout);
        } else {
            await sleep(timeout);
            checkRewardPage(timeout);
        }
    }

    //异步检测战斗，来自D捣蛋&秋云佬的全自动地脉花的代码
    async function autoFight(Fighttimeout) {
        const cts = new CancellationTokenSource();
        log.info("开始战斗");
        dispatcher.RunTask(new SoloTask("AutoFight"), cts);
        let fightResult = await recognizeTextInRegion(Fighttimeout);
        logFightResult = fightResult ? "成功" : "失败";
        log.info(`战斗结束，战斗结果：${logFightResult}`);
        cts.cancel();
        if(!fightResult){
            Lastexecution = false;
            await genshin.returnMainUi();
            await sleep(1000);
            await genshin.tp(2297.60, -824.45);
            await genshin.returnMainUi();
        }
        return fightResult;
    }

    function recognizeFightText(captureRegion) {
        try {
            let result = captureRegion.find(ocrRo2);
            let text = result.text;
            keywords = ["打倒", "所有", "敌人"];
            for (let keyword of keywords) {
                if (text.includes(keyword)) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            log.error("OCR过程中出错: {0}", error);
        }
    }

    async function recognizeTextInRegion(Fighttimeout) {
        return new Promise((resolve, reject) => {
            (async () => {
                try {
                    let startTime = Date.now();
                    let noTextCount = 0;
                    const successKeywords = ["挑战达成", "战斗胜利", "挑战成功"];
                    const failureKeywords = ["挑战失败"];
                    const recovery  = ["复苏"];
    
                    // 循环检测直到超时
                    while (Date.now() - startTime < Fighttimeout) {
                        try {
                            let captureRegion = captureGameRegion();
                            let result = captureRegion.find(ocrRo1);
                            let result3 = captureRegion.find(ocrRo3);
                            let text = result.text;
                            let text3 = result3.text;
    
                            // 检查成功关键词
                            for (let keyword of successKeywords) {
                                if (text.includes(keyword)) {
                                    log.info("检测到战斗成功关键词: {0}", keyword);
                                    resolve(true);
                                    return;
                                }
                            }
    
                            // 检查失败关键词
                            for (let keyword of failureKeywords) {
                                if (text.includes(keyword)) {
                                    log.warn("检测到战斗失败关键词: {0}", keyword);
                                    resolve(false);
                                    return;
                                }
                            }

                            // 检查复苏关键词
                            for (let keyword of recovery) {
                                if (text3.includes(keyword)) {
                                    log.warn("检测到战斗失败关键词: {0}", keyword);
                                    await sleep(1000);
                                    result3.click();                                    
                                    resolve(false);
                                    return;
                                }
                            }
    
                            //战斗区域
                            let foundText = recognizeFightText(captureRegion);
                            if (!foundText) {
                                noTextCount++;
                                log.info(`检测到可能离开战斗区域，当前计数: ${noTextCount}`);
    
                                if (noTextCount >= 12) {
                                    log.warn("已离开战斗区域");
                                    resolve(false);
                                    return;
                                }
                            }
                            else {
                                noTextCount = 0; // 重置计数
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
    
    //重新战斗次数
    var retryCount = 0;
    var executedCount = 0;
    async function Veinfligt() {
       // 定义路线常量
        var selectedPath = pathingMap[`路线${position.line} ${['厄里那斯', '秋分山西侧锚点左下', '秋分山西侧锚点右', '柔灯港上锚点', '新枫丹科学院左锚点', '芒索斯山东麓'][position.line - 1]}`]
        var selectedFolder = folderMap[`路线${position.line} ${['厄里那斯', '秋分山西侧锚点左下', '秋分山西侧锚点右', '柔灯港上锚点', '新枫丹科学院左锚点', '芒索斯山东麓'][position.line - 1]}`]
        
        executedCount = (position.flower-1)*2+0;         
        Lastexecution = false;       

        log.info(`开始执行第 ${position.line} 线路的第 ${executedCount/2 + 1}/${selectedPath.length/2} 朵地脉花...`);

        for (let i = 0; i < selectedPath.length; i += 2){

            if (executedCount/2 + 1 > selectedPath.length/2) {
                log.info("本线路执行完毕...");
                break;
            }  
                
            if (doneCount >= timesConfig.value/2){
                SHUOVER=2;log.info(`地脉花执行完成 ${timesConfig.value/2} 次，结束执行...`);
                return true;
            }    

            const jsonFile1 = selectedPath[i+position.flower*2-2];
            if (jsonFile1 == undefined) {              
                log.info(`本线路完结，未达设定执行次数 ${timesConfig.value/2} ，继续执行...`);
                return true;
            }

            if (repeatRoute && (executedCount/2 + 1 + i) == position_another.flower) {
                log.info(`线路混合其他类型地脉花，跳过...`);
                SMODEL = false;
                continue;
            }else{
                log.info(`线路正常，继续...`);
                SMODEL = settings.SMODEL ? settings.SMODEL : false;
            }

            const jsonFile2 = selectedPath[i+position.flower*2-1];         

            // 执行单个到达地脉花路径文件1
            const choicePath = `${selectedFolder}${jsonFile1}` 
            log.info(`开始执行前往都地脉花：${jsonFile1}`);
            if(SMODEL){
                if (!Lastexecution || (position.line==1 && (i+position.flower*2-2)==8)) {                        
                    if(position.line==2 && (i+position.flower*2-2)==8 && Lastexecution){                       
                        await pathingScript.runFile("assets/枫丹地脉花-路线2 秋分山西侧锚点左下/线路修复/枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下1-线路修复.json");}
                    else{ 
                            if(position.line==2 && (i+position.flower*2-2)==8)//特殊处理
                            {                                
                                let pathDic = JSON.parse(file.readTextSync(choicePath));
                                log.info(`第 2 线路第 5 朵花特殊处理...`);
                                await genshin.tp("4402.5048", "2295.4807", true);
                                await genshin.returnMainUi();
                                pathDic["positions"].splice(0, 1);
                                await pathingScript.run(JSON.stringify(pathDic));
                            }else{
                                await pathingScript.runFile(`${selectedFolder}${jsonFile1}`);
                            }
                        }
                }
                else
                {                     
                    let pathDic = JSON.parse(file.readTextSync(choicePath));
                    if (pathDic["positions"].length > 1) 
                    {
                        pathDic["positions"] = pathDic["positions"].slice(-1);
                    }
                    await pathingScript.run(JSON.stringify(pathDic));
                }
            }else{

                  if(position.line==2 && (i+position.flower*2-2)==8 && Lastexecution)
                     {
                        await pathingScript.runFile("assets/枫丹地脉花-路线2 秋分山西侧锚点左下/线路修复/枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下1-线路修复.json");
                    }
                  else
                     {
                        if(position.line==2 && (i+position.flower*2-2)==8)//特殊处理
                            {                     
                                let pathDic = JSON.parse(file.readTextSync(choicePath));
                                log.info(`第 2 线路第 5 朵花特殊处理...`);
                                await genshin.tp("4402.5048", "2295.4807", true);
                                await genshin.returnMainUi();
                                pathDic["positions"].splice(0, 1);
                                await pathingScript.run(JSON.stringify(pathDic));
                            }else{await pathingScript.runFile(`${selectedFolder}${jsonFile1}`);}
                        
                    }
            }            
             
            // 寻找地脉溢口，找到地脉花就领奖，没有找到就直接战斗，再尝试领奖
            if (await VeinEntrance()){ 
                
                if(position.line==2 && (i+position.flower*2-2)==8){   
            
                    await pathingScript.runFile("assets/枫丹地脉花-路线2 秋分山西侧锚点左下/线路修复/枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下_特殊处理.json");
                }

                await sleep(1000);
                await dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false})); await keyPress("F");
                log.warn("开始战斗..."); 

                shouldContinueChecking = true;
                checkRewardPage();// 执行自动战斗并同步检测领奖页面
                
                if (!Fightquick){           
                    await dispatcher.runTask(new SoloTask("AutoFight")); //固定执行两次战斗，执行自动战斗,配置器中的设置建议填你的队伍打一次大概得时间
                    await sleep(1000);
                    await dispatcher.runTask(new SoloTask("AutoFight"));
                }else
                {                
                    if(!await autoFight(Fighttimeout)){
                        if (retryCount < 2) {
                            log.warn("战斗失败,重新重试...");
                            i = i-2;
                            retryCount ++;
                            continue;
                        }
                       //退出执行
                       SHUOVER=2;
                       return false;
                    }                                 
                }
                await keyPress("1");//防止战斗后处于特殊状态寻路异常，例如火神上摩托车，1号位不要放类似角色
            }

            shouldContinueChecking = true;
            await dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false}));

            //执行到地脉花地点的寻路脚本
            let pathDic = JSON.parse(file.readTextSync(`${selectedFolder}${jsonFile2}`));
            log.info(`开始执行寻找地脉花奖励：${jsonFile2}`);

            await genshin.returnMainUi();
            if(!await updatePositionWithTolerance(pathDic, 40)){
                log.info(`离领奖区域过远，通过重新传送寻路到地脉花地点：${jsonFile2}`);
                await pathingScript.runFile(`${selectedFolder}${jsonFile1}`);
            }else{
            //到达领奖地点
            pathDic["positions"][0]["type"] = "path";//
            await pathingScript.run(JSON.stringify(pathDic));
            let SHUN01 = await Textocr("接触地脉之花",1,0,0,1188,358,200,400);
            if (!SHUN01.found) await pathingScript.runFile(`${selectedFolder}${jsonFile2}`);     
            }              
        
            await sleep(1000);
            // 领取奖励，开始找地脉口            
            log.info(`开始本线路第 ${executedCount/2+1} 朵花的奖励领取`);
            if (haoganq==1){log.info(`切换好感队伍：'${haogandui}'`);await genshin.returnMainUi(); await sleep(1000);await genshin.SwitchParty(haogandui);}
            shouldContinueChecking = false;
            await sleep(500);
            if (!(await claimRewards())) {
                log.warn("树脂消耗完毕，结束任务");
                dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                await genshin.returnMainUi(); 
                return true; // 条件2触发：树脂耗尽================
            }
            Lastexecution=true;
            if (haoganq==1){log.info(`切换战斗队伍：'${settings.n}'`);await genshin.returnMainUi(); await sleep(1000);await genshin.SwitchParty(settings.n);}
            dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
            // 冷却等待（可选）
            await sleep(1000);
            executedCount=executedCount+2;   
            doneCount++;          
        }
        return true;// 线路完成
    }   

    async function updatePositionWithTolerance(pathDic,tolerance = 40) {
        await genshin.returnMainUi();
        let smallXY = await genshin.getPositionFromMap();
        const currentX = pathDic["positions"][0]["x"];
        const currentY = pathDic["positions"][0]["y"];
        let isUpdated = false; 
        log.info(`当前小地图坐标: X=${currentX}, Y=${currentY}`);

        if (Math.abs(currentX - smallXY.x) < tolerance) {
            // pathDic["positions"][0]["x"] = smallXY.x;
            isUpdated = true; 
        }
    
        if (Math.abs(currentY - smallXY.y) < tolerance) {
            // pathDic["positions"][0]["y"] = smallXY.y;
            isUpdated = true; 
        }
    
        return isUpdated; 
    }    

    // UID获取存在概率不成功，慎用！请更换背景纯色的名片提高OCR成功率
    let uidNumbers = nowuidString.match(/\d+/g);
    if (nowuidString) {
        log.debug(`DEBUG:${uidNumbers}`);//调试LOG
        await genshin.returnMainUi(); 
        await keyPress("VK_ESCAPE");
        await sleep(500);
            if (uidNumbers && uidNumbers.length > 0) {
                // 使用 for...of 循环遍历 uidNumbers 数组
                for (let number of uidNumbers) {
                    var UIDnow = number;
                    log.debug(`DEBUG:${UIDnow}`);
                    let UIDD = await Textocr(UIDnow, 1, 0, 0, 112,177, 190, 39);
                    if (UIDD.found) {
                        log.warn(`UID "${UIDnow}" 已被禁用，停止刷取！`);
                        SHUOVER = 2; // 假设 SHUOVER = 2 表示需要停止程序
                        break; 
                    }
                } 
        }
    }  

    try { 
        //根据SHUOVER决定模式
        while (SHUOVER<=1){           
            if (!(await PathCheak(0))){
                await leftButtonUp();
                log.info("未找到地脉花，更换寻找方式，重试...")
                if (!(await PathCheak(1)))
                {
                    await leftButtonUp();await genshin.returnMainUi();
                    throw new Error("未找到地脉花，退出！")
                }
            }                      
            Fligtin = true ; //领取冒险点奖励标志。
            //第一次执行选择队伍
            if (SHUOVER == 0){await genshin.returnMainUi(); await sleep(1000);await genshin.SwitchParty(settings.n);await sleep(500);}
            //开始寻找并执行地脉花自动。
            if (!(await Veinfligt())){throw new Error("线路出错，退出！")}
            //线路一般4~6朵花，默认打完一条线路后退出，如耗尽模式重新寻找地脉线路，打到没树脂为止。
            if (SHUV == 2 && SHUOVER !==2){SHUOVER=1;}else{SHUOVER=2;}
        }
        await genshin.returnMainUi(); 
        log.warn("本次地脉花路线已执行完毕。");
        //领取冒险点奖励，切换好感队伍
        if (Rewards && Fligtin) {
            if(!(settings.nh === undefined)){
                shouldContinueChecking = true;
                checkRewardPage();// 执行自动战斗并同步检测领奖页面    
                log.info(`切换好感队伍：'${haogandui}'`);
                await genshin.returnMainUi(); await sleep(1000);
                await genshin.SwitchParty(haogandui);
            }else{log.warn("好感队未配置，领奖励时不切换队伍")}
            await genshin.goToAdventurersGuild("枫丹");
                shouldContinueChecking = false;
                await sleep(2000);
        }
    } catch (error) {
        log.error(`执行过程中发生错误：${error.message}`);
    }finally{
        await genshin.returnMainUi(); 
    }
})();