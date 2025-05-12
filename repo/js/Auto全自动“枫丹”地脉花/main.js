(async function () {

    /**
     * 封装函数，执行图片识别及点击操作（测试中，未封装完成，后续会优化逻辑）
     *
     * @param imagefilePath 图片路径，默认为"空参数"
     * @param timeout 超时时间，单位为秒，默认为10秒
     * @param afterBehavior 点击模式，0为关闭点击，1为开启点击，2为开启F键点击，默认为0
     * @param debugmodel 调试代码模式，0为关闭调试模式，1为开启调试模式，默认为0
     * @param xa 识别区域的x轴偏移量，默认为0
     * @param ya 识别区域的y轴偏移量，默认为0
     * @param wa 识别区域的宽度，默认为1920
     * @param ha 识别区域的高度，默认为1080
     * @returns 返回识别结果，包括图片的x轴坐标、y轴坐标、宽度、高度及是否找到图片
     */
    async function imageRecognition(imagefilePath="空参数",timeout=10,afterBehavior=0,debugmodel=0,xa=0,ya=0,wa=1920,ha=1080) {
        const startTime = new Date();
        const Imagidentify = RecognitionObject.TemplateMatch(file.ReadImageMatSync(imagefilePath));
        for (let ii = 0; ii < 10; ii++) {    
            captureRegion = captureGameRegion();  // 获取一张截图
            res = captureRegion.DeriveCrop(xa, ya, wa, ha).Find(Imagidentify);
        if (res.isEmpty()) {
            if (debugmodel===1 & xa===0 & ya===0){log.info("识别图片中")};
        } else {
          if (afterBehavior===1){if (xa===0 & ya===0){log.info("点击模式:开");}await sleep(1000);click(res.x+xa, res.y+ya);}else{if (debugmodel===1 & xa===0 & ya===0){log.info("点击模式:关")}}
          if (afterBehavior===2){if (xa===0 & ya===0){log.info("F模式:开");}await sleep(1000);keyPress("F");}else{if (debugmodel===1 & xa===0 & ya===0){log.info("F模式:关")}}
          if (debugmodel===1 & xa===0 & ya===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);}else{ log.info("识别到图片");}
          return result = { x: res.x, y: res.y, w:res.width,h:res.Height,found: true }
        }
        const NowTime = new Date();
        if ((NowTime - startTime)>timeout*1000){if (debugmodel===1 & xa===0 & ya===0){log.info(`${timeout}秒超时退出，未找到图片`);}return result = {found: false };}else{ii=8}
        await sleep(200); 
        }
        await sleep(1200); 
    }


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
                    log.info(`“${res1}”找到`);
                    if (debugcode===1){if (x===0 & y===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);return result = { text: res.text, x: res.x, y: res.y, found: true }}}else{if (x===0 & y===0){log.info("文本OCR完成'{text}'", res.text);}}
                    if (clickocr===1){await sleep(1000);click(res.x, res.y);}else{log.info("点击模式:关")}  
                    if (clickocr===2){await sleep(100);keyPress("F");}else{log.info("F模式:关");}
                     return result = { text: res.text, x: res.x, y: res.y, found: true }
                 }
            }
            const NowTime = new Date();
            if (Math.abs(NowTime - startTime)>chaotime*1000){if (x===0 & y===0){log.info(`${chaotime}秒超时退出，"${wenzi}"未找到`);}return result = {found: false };}else{ii=8;if (x !== 861){await keyPress("VK_W");}log.info(`"${wenzi}"识别中……`);}
            await sleep(100);
        }   
    }

    // //容错检测函数，备用
    // function checkOverlap() {
    //     const overlappingPoints = [];
    
    //     for (let i = 0; i < allFlowerCoords.length; i++) {
    //         for (let j = i + 1; j < allFlowerCoords.length; j++) {
    //             const point1 = allFlowerCoords[i];
    //             const point2 = allFlowerCoords[j];
    
    //             const dx = Math.abs(point1.x - point2.x);
    //             const dy = Math.abs(point1.y - point2.y);
    
    //             if (dx <= tolerance && dy <= tolerance) {
    //                 overlappingPoints.push({
    //                     point1: { line: point1.line, flower: point1.flower, x: point1.x, y: point1.y },
    //                     point2: { line: point2.line, flower: point2.flower, x: point2.x, y: point2.y }
    //                 });
    //             }
    //         }
    //     }
    //     overlappingPoints.forEach((point, index) => {
    //         log.info(`重叠点 ${index + 1}：${JSON.stringify(point)}`);
    //       });

    //     return overlappingPoints;
    //     // await checkOverlap(allFlowerCoords,tolerance);
    // }

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

    filePath = ""
    // 读取原始次数配置
    var LOOOKING  = 0 
    var rawTimes = settings.times*2 ? settings.times : "12";
    var color = settings.color ? settings.color : 1;
    var BIAOZZ = "assets/model/BIAOZ.bmp"

    if (LOOOKING == 0) {
        if  (color == 2){var DIMAIHUA = "assets/model/DIMAIHUA-huank.bmp";}
        else if (color == 1){var DIMAIHUA = "assets/model/DIMAIHUA-lank.bmp";}
        else{var DIMAIHUA = "assets/model/DIMAIHUA-lank.bmp";}

    } else if (LOOOKING == 1) {
        if  (color == 2){var DIMAIHUA = "assets/model/DIMAIHUA-huan.bmp";}
        else if (color == 1){var DIMAIHUA = "assets/model/DIMAIHUA-lan.bmp";}
        else{var DIMAIHUA = "assets/model/DIMAIHUA-lan.bmp";}
    }

    // // 验证是否为数字
    // var timesValue; 
    // if (!/^-?\d+\.?\d*$/.test(rawTimes)) { // 匹配整数和小数
    //     timesValue = 12
    //    // log.info("⚠️ 刷本次数设置不为数字，改为默认值12");
    // } else {
    //     // 转换为数字
    //     const num = parseFloat(rawTimes*2); // 乘以2，因为每次战斗两次（一次战斗两次掉落）
    //     // 范围检查
    //     if (num < 1) {
    //         timesValue = 1;
    //       //log.info(`⚠️ 次数 ${num} 小于1，已调整为1`);
    //     } else if (num > 12) {
    //         timesValue = 12;
    //        // log.info(`⚠️ 次数 ${num} 大于12，已调整为12`);
    //     } else {
    //         // 处理小数
    //         if (!Number.isInteger(num)) {
    //             timesValue = Math.floor(num);
    //            // log.info(`⚠️ 次数 ${num} 不是整数，已向下取整为 ${timesValue}`);
    //         } else {
    //             timesValue = num;
    //         }
    //     }
    // }
    // var timesConfig = { value: timesValue };

    var timesValue = 12; // 设置默认值
    var num = parseFloat(rawTimes) * 2; // 直接计算乘以2后的值，并尝试转换为浮点数
    
    // 如果输入是有效的数字，并且在合理范围内，则更新timesValue
    if (/^-?\d+\.?\d*$/.test(rawTimes) && num >= 1 && num <= 24) {
        timesValue = Math.max(1, Math.min(12, Math.floor(num))); // 确保值在1到12之间，并向下取整
    }
    
    // 如果num大于12（因为乘以2了，所以实际上是原始值大于6），则设置为最大值12
    // 注意：这里不需要额外检查，因为Math.min已经处理了上限
    
    var timesConfig = { value: timesValue };


    const allFlowerCoords = [
        // 线路1
        { line: 1, flower: 1, x: 773, y: 669 },
        { line: 1, flower: 2, x: 846, y: 696 },
        { line: 1, flower: 3, x: 902, y: 762 },
        { line: 1, flower: 4, x: 912, y: 812 },
        { line: 1, flower: 5, x: 876, y: 840 },
        { line: 1, flower: 6, x: 815, y: 788 },
        // 线路2
        { line: 2, flower: 1, x: 1160, y: 716 },
        { line: 2, flower: 2, x: 1155, y: 766 },
        { line: 2, flower: 3, x: 1117, y: 801 },
        { line: 2, flower: 4, x: 1082, y: 896 },
        { line: 2, flower: 5, x: 1013, y: 883 },
        // 线路3
        { line: 3, flower: 1, x: 1216, y: 661 },
        { line: 3, flower: 2, x: 1239, y: 685 },
        { line: 3, flower: 3, x: 1282, y: 642 },
        { line: 3, flower: 4, x: 1335, y: 639 },
        // 线路4
        { line: 4, flower: 1, x: 983, y: 672 },
        { line: 4, flower: 2, x: 932, y: 660 },
        { line: 4, flower: 3, x: 886, y: 660 },
        { line: 4, flower: 4, x: 876, y: 625 },
        // 线路5
        { line: 5, flower: 1, x: 727, y: 153 },
        { line: 5, flower: 2, x: 752, y: 78 },
        { line: 5, flower: 3, x: 712, y: 47 },
        { line: 5, flower: 4, x: 643, y: 4 },
        // 线路6
        { line: 6, flower: 1, x: 0, y: 0 },//开始已经检测，不用复检
        { line: 6, flower: 2, x: 469, y: 369 },//315   54
        { line: 6, flower: 3, x: 400, y: 343 },//289
        { line: 6, flower: 4, x: 371, y: 281 },//227  379 290
      ];
    
    // 快速寻路模式寻路
    // 输出选择的线路
    async function PathCheak1() {
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
        let XIAN6 = await imageRecognition(DIMAIHUA,1,0,0,387,0,700,200);if (XIAN6.found){
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
            log.info("地脉花位置: X:"+XIAN123.x+" Y:"+XIAN123.y);
            const recognizedCoord = { x: XIAN123.x, y: XIAN123.y };
            position = findFlowerPositionWithTolerance(recognizedCoord, tolerance);
            if (position.line==3){position = findFlowerPositionWithTolerance(recognizedCoord, 20);}
            if (position) {
                return true;
              } else {
                log.info(`无法找到花朵位置（在容错范围内）。`);return false;
              }
        }
        await moveMouseTo(132,783);
        await sleep(500);
        let XIAN4 = await imageRecognition(DIMAIHUA,1,0,0);
         if (XIAN4.found){
            log.info("地脉花位置: X:"+XIAN4.x+" Y:"+XIAN4.y);
            const recognizedCoord = { x: XIAN4.x, y: XIAN4.y };
            position = findFlowerPositionWithTolerance(recognizedCoord, tolerance);
            if (position) {
                return true;
              } else {
                log.info(`无法找到花朵位置（在容错范围内）。`);return false;
              }
        }
        await moveMouseTo(1064,1079);
        await sleep(200);
        let XIAN66 = await imageRecognition(DIMAIHUA,1,0,0);
        if (XIAN66.found){
            log.info("地脉花位置: X:"+XIAN66.x+" Y:"+XIAN66.y);
            const recognizedCoord = { x: XIAN66.x, y: XIAN66.y };
            position = findFlowerPositionWithTolerance(recognizedCoord, tolerance);
            if (position) {
                return true;
              } else {
                log.info(`无法找到花朵位置（在容错范围内）。`);return false;
              }
        }else{throw new Error("线路出错，退出！")}        
    }

    // 函数：根据坐标查找花朵位置
    function findFlowerPositionWithTolerance(coord, tolerance) {
        for (let i = 0; i < allFlowerCoords.length; i++) {
        const flower = allFlowerCoords[i];
        if (Math.abs(flower.x - coord.x) <= tolerance && Math.abs(flower.y - coord.y) <= tolerance) {
            return { line: flower.line, flower: flower.flower };
        }
        }
        return null; // 如果没有找到匹配的坐标，返回null
    }

    //寻找地脉溢口，文字识别不到转圈寻找，不管有没找到都执行战斗，最后领取奖励判断是否继续执行
    async function VeinEntrance() {
        for (let i = 0;i < 2;i++) {
            let JIECHU = await Textocr("接触地脉溢口",3,2,0,1188,358,200,400);
            if (JIECHU.found){await keyPress("F");await dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": true }));break;}else{if(i = 1){
                log.warn("没找到地脉花，尝试强制转圈寻找，不管有没找到都执行战斗...");  
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
                break;}
            }
        }
    }

    //定义领取动作,好感队伍是否添加？
    async function claimRewards() {
        log.info("尝试领取奖励，优先使用浓缩~");
        let SHUN01 = await Textocr("接触地脉之花",1.5,2,0,1188,358,200,400);
        if (SHUN01.found) {
            log.info("找到地脉之花，开始领取奖励...");
        }else{
                let SHUN02 = await Textocr("接触地脉之花",1,2,0,1188,358,200,400);
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
        await sleep(500);
        let SHUN =  await Textocr("使用浓缩树脂",1,1,0,672,726,191,53);
        let SHUY =  await Textocr("使用原粹树脂",1,1,0,877,726,193,53);
        let SHUB =  await Textocr("补充原粹树脂",1,0,0,877,726,193,53);
                await sleep(1000);
            if  (SHUB.found){log.warn("树脂消耗完毕，结束任务");await keyPress("VK_ESCAPE");FINDagin=0;await sleep(1000);SHUOVER=2;return false;}
            else if (SHUN.found || SHUY.found) {
                log.info("找到树脂，已经使用...");FINDagin=0;dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: true })); return true;
            }else{
                log.warn("未找到树脂，尝试领取奖励...");
                let SHUN =  await Textocr("使用浓缩树脂",0.5,1,0,672,726,191,53);
                let SHUY =  await Textocr("使用原粹树脂",0.5,1,0,877,726,193,53);
                if (SHUN.found || SHUY.found) {FINDagin=0; return true;}else{log.warn("领取错误，退出！");if (FINDagin===1){SHUOVER=1;log.warn("模糊模式，地脉不在初始位置，继续寻找！");return true}else{SHUOVER=2;return false;}}//SHUOVER=2
            }
    }

    async function isOnRewardPage() {
        const rewardText = await Textocr("地脉之花", 0.5, 0, 0, 861,265, 194, 265);
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


    async function Veinfligt() {
         // 定义路线常量
         var selectedPath = pathingMap[`路线${position.line} ${['厄里那斯', '秋分山西侧锚点左下', '秋分山西侧锚点右', '柔灯港上锚点', '新枫丹科学院左锚点', '芒索斯山东麓'][position.line - 1]}`]
         var selectedFolder = folderMap[`路线${position.line} ${['厄里那斯', '秋分山西侧锚点左下', '秋分山西侧锚点右', '柔灯港上锚点', '新枫丹科学院左锚点', '芒索斯山东麓'][position.line - 1]}`]
         var maxExecutions = Math.min(timesConfig.value, selectedPath.length);

         var executedCount = (position.flower-1)*2+0;
         Lastexecution = false;

         log.info(`开始执行第 ${position.line} 线路的第 ${executedCount/2 + 1}/${selectedPath.length/2} 朵地脉花...`);

        for (let i = 0; i < selectedPath.length; i += 2){
           // log.info(`executedCount: ${executedCount} maxExecutions: ${maxExecutions}次`);
            if (executedCount >= maxExecutions) {
                log.info("本线路已达到执行次数，终止运行！");
                break;}   

            const jsonFile1 = selectedPath[i+position.flower*2-2];
            const jsonFile2 = selectedPath[i+position.flower*2-1];         

            // 执行单个到达地脉花路径文件1
            log.info(`开始执行前往都地脉花：${jsonFile1}`);
            if(SMODEL){
            if (!Lastexecution || (position.line==1 && (i+position.flower*2-2)==8)) {
                    
                if(position.line==2 && (i+position.flower*2-2)==8){await pathingScript.runFile("assets/枫丹地脉花-路线2 秋分山西侧锚点左下/线路修复/枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下1-线路修复.json");}
                  else{await pathingScript.runFile(`${selectedFolder}${jsonFile1}`);}

                }else{
                    const choicePath = `${selectedFolder}${jsonFile1}`
                    //const pathingList = file.readPathSync(choicePath);    
                    let pathDic = JSON.parse(file.readTextSync(choicePath));
                    if (pathDic["positions"].length > 3) {
                        pathDic["positions"] = pathDic["positions"].slice(-3);
                    }
                    await pathingScript.run(JSON.stringify(pathDic));
                }
            }else{

                  if(position.line==2 && (i+position.flower*2-2)==8){await pathingScript.runFile("assets/枫丹地脉花-路线2 秋分山西侧锚点左下/线路修复/枫丹地脉花-路线2 秋分山西侧锚点左下-5：秋分山左左下下1-线路修复.json");}
                  else{await pathingScript.runFile(`${selectedFolder}${jsonFile1}`);}
            }

 
            // 寻找地脉溢口，文字识别不到转圈寻找，不管有没找到都执行战斗，最后领取奖励判断是否继续执行
            shouldContinueChecking = true;
            checkRewardPage();// 执行自动战斗并同步检测领奖页面
            await VeinEntrance();
            await sleep(1000);
            dispatcher.addTimer(new RealtimeTimer("AutoPick", { "forceInteraction": false }));
           
            //执行自动战斗,配置器中的设置建议填你的队伍打一次大概得时间
            await dispatcher.runTask(new SoloTask("AutoFight"));
            await sleep(2000);
            await dispatcher.runTask(new SoloTask("AutoFight"));//公版BETTERGI战斗两次可能触发已经出现的地脉花
           
            //执行到地脉花地点的寻路脚本
            log.info(`开始执行寻找地脉花奖励：${jsonFile2}`);
            await pathingScript.runFile(`${selectedFolder}${jsonFile2}`);
            await sleep(3000);
            // 领取奖励，开始找地脉口
            log.info(`开始第 ${executedCount/2} 朵花的奖励领取`);
            if (haoganq==1){log.info(`切换好感队伍：'${haogandui}'`);await genshin.returnMainUi(); await sleep(1000);await genshin.SwitchParty(haogandui);}
            shouldContinueChecking = false;
            await sleep(2000);
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
        }
        FINDagin = 0; //重置地脉花寻找标志。lv.1.2新增，用于判断是否找线路余下地脉花。
        return true;// 线路完成
    }


    //初始化
    var SMODEL = settings.SMODEL ? settings.SMODEL : false; // false 公版BETTERGI，true 自编译版本LCB
    var SHUOVER=0 //0初始状态，1队伍配置标志，2结束线路，3线路出错
    var haoganq=0 //0初始状态，1好感队伍配置标志
    var SHUV = settings.shuv ? settings.shuv : 1; // 1 单线路，2 树脂耗尽
    var Rewards = settings.Rewards ? settings.Rewards : false; // ture 领取冒险点奖励，false 不领取冒险点奖励
    var Fligtin = false;  //领取冒险点奖励标志。
    var FINDagin = 0; //地脉花寻找标志。lv.1.2新增，用于判断是否找线路余下地脉花。
    var tolerance = 25;
    var position ={};
    var Lastexecution = false;//线路执行标志，用于判断上一线路是否执行。



    log.debug(`DEBUG:${SHUV}.${color}.${rawTimes}`);//调试LOG
    if (Rewards){log.warn("结束后领励练点和提交每日！");if(settings.nh === undefined || settings.nh === "") {log.warn("好感队未配置，领奖励时不切换队伍")}}
    if (settings.nh === undefined || settings.nh === "") { log.warn("好感队禁用！");haoganq=0}else{var haogandui = settings.nh;haoganq=1;if(settings.n === undefined ) {throw new Error("好感队已经设置，请填战斗队伍！")}}
    if (settings.n === undefined || settings.n === "") { log.warn("队伍名称未配置，不更换队伍！");SHUOVER=1;}
    if (SHUV == 1) {log.warn("线路模式 ：'单线路！'");}else{log.warn("线路模式 ：'树脂耗尽模式，强制打完整体线路！'");rawTimes=12}
    if (color == 1) {log.warn("地脉类型 ：'蓝色-经验书花！'");}else{log.warn("地脉类型 ：'黄色-摩拉花！'")}  
    let nowuidString = settings.nowuid ? settings.nowuid : "";

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
    }else{log.warn("未配置禁用UID，继续进行！");}

    try { 
        //根据SHUOVER决定模式
        while (SHUOVER<=1){
            Fligtin = true ; //领取冒险点奖励标志。
            if (!(await PathCheak1())){;await leftButtonUp();throw new Error("未找到地脉花，退出！")}else{await leftButtonUp();await genshin.returnMainUi();}

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