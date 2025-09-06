
(async function () {
    


//模板匹配得到烹制时间
async function getPerfectCookingWaitTime() {

let extraTime = settings.extraTime || 0; // 
let threshold0 = Number(settings.threshold0) || 0.9; 
extraTime = extraTime+300;
    const checkPoints = [
    {x: 741, y: 772},    // 原始点1
        {x: 758, y: 766},    // 中间点1-2
        {x: 776, y: 760},    // 原始点2
        {x: 793, y: 755},    // 中间点2-3
        {x: 810, y: 751},    // 原始点3
        {x: 827, y: 747},    // 中间点3-4
        {x: 845, y: 744},    // 原始点4
        {x: 861, y: 742},    // 中间点4-5
        {x: 878, y: 740},    // 原始点5
        {x: 897, y: 737},    // 中间点5-6
        {x: 916, y: 735},    // 原始点6
        {x: 933, y: 735},    // 中间点6-7
        {x: 950, y: 736},    // 原始点7
        {x: 968, y: 736},    // 中间点7-8
        {x: 986, y: 737},    // 原始点8
        {x: 1002, y: 738},   // 中间点8-9
        {x: 1019, y: 740},   // 原始点9
        {x: 1038, y: 742},   // 中间点9-10
        {x: 1057, y: 744},   // 原始点10
        {x: 1074, y: 748},   // 中间点10-11
        {x: 1092, y: 752},   // 原始点11
        {x: 1107, y: 757},   // 中间点11-12
        {x: 1122, y: 762},   // 原始点12
        {x: 1138, y: 766},   // 中间点12-13
        {x: 1154, y: 770},    // 原始点13
        {x: 1170, y: 774},    // 中间点13-14
        {x: 1193, y: 779}   // 原始点14



    ];
    
    // 区域大小
    const regionSize = 60;
    
    // 加载模板图片
    const templateMat0 = file.readImageMatSync("assets/best0.png");
    const templateMat1 = file.readImageMatSync("assets/best1.png");
    const templateMat2 = file.readImageMatSync("assets/best2.png");

    
    // 创建模板匹配识别对象
    const templateRo0 = RecognitionObject.templateMatch(templateMat0);
    const templateRo1 = RecognitionObject.templateMatch(templateMat1);
    const templateRo2 = RecognitionObject.templateMatch(templateMat2);
    templateRo0.threshold = threshold0;
    templateRo0.Use3Channels = true;
    templateRo1.threshold = threshold0;
    templateRo1.Use3Channels = true;
    templateRo2.threshold = threshold0;
    templateRo2.Use3Channels = true;
    // 捕获游戏区域
    const gameRegion = captureGameRegion();
    
    // 检查每个点
    for (let i = 0; i < checkPoints.length; i++) {
        const point = checkPoints[i];
        
        // 裁剪出当前检测区域
        const region = gameRegion.deriveCrop(
            point.x - regionSize/2, 
            point.y - regionSize/2, 
            regionSize, 
            regionSize
        );
        
let result;
        if (i < 9) {
            result = region.find(templateRo0);
        } else if (i >= 18) {
            result = region.find(templateRo2);
        } else {
            result = region.find(templateRo1);
        }

             if (!result.isEmpty()) {
   
            const segmentTime = 66;
            
          
            const waitTime = Math.round(i * segmentTime+extraTime);
   log.info(`找到点位${i}号区域`);
        await sleep(waitTime);
 keyPress("VK_SPACE");
         return 0;
        }

    }
    
   log.info(`未找到点位区域，烹饪结束`);
keyPress("ESCAPE");
await sleep(1000);
keyPress("ESCAPE");
throw new Error("人家才不是错误呢>_<");
}





//主要流程


await sleep(1000);
await pathingScript.runFile("assets/前往蒙德灶台.json");
keyPress("F");
await sleep(1000);
click(910, 51);//选择料理
await sleep(1000);
click(170, 1020);//筛选
await sleep(500);
click(195, 1020);//重置
await sleep(500);
click(195, 675);//熟练度未满
await sleep(1000);
click(490, 1020);//确认筛选
await sleep(1000);

let sum= 0;

       while (1) {
await sleep(500);
click(175, 200);//选择第一个菜
await sleep(500);
click(1700, 1020);//制作
await sleep(1000);
click(1080, 1015);//手动烹饪
await sleep(1000);//等待画面稳定
//自动烹饪
await getPerfectCookingWaitTime();
log.info(`第${sum+1}次烹饪`);
await sleep(1000);
click(975, 900);//确认
await sleep(500);
click(215, 1015);//重新排序
await sleep(500);
click(1700, 1020);//制作
await sleep(500);
click(1700, 1020);//制作
await sleep(1000);
keyPress("ESCAPE"); 
await sleep(1000);
click(215, 1015);//重新排序
await sleep(1000);
sum++;
     } 



       
})();
