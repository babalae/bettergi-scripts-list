(async function () {

    //初始化配置======================================================================================
    var actiontime = settings.actiontime != undefined && ~~settings.actiontime > 0 ? ~~settings.actiontime : 150;
    var TEAM
    var AKF = settings.AKF !== undefined ? (
        settings.AKF === "是" ? 1 :
        settings.AKF === "否" ? 0 :
        settings.AKF === "每天执行" ? 2 
        : 0 ) : 0; // 如果settings.AKF完全未定义，也赋予AKF为0
    
    /**
     * 文字OCR识别封装函数（测试中，未封装完成，后续会优化逻辑）
     * @param text 要识别的文字，默认为"空参数"
     * @param timeout 超时时间，单位为秒，默认为10秒
     * @param afterBehavior 点击模式，0表示不点击，1表示点击识别到文字的位置，2表示输出模式，默认为0
     * @param debugmodel 调试代码，0表示输入判断模式，1表示输出位置信息，2表示输出判断模式，默认为0
     * @param x OCR识别区域的起始X坐标，默认为0
     * @param y OCR识别区域的起始Y坐标，默认为0
     * @param w OCR识别区域的宽度，默认为1920
     * @param h OCR识别区域的高度，默认为1080
     * @returns 包含识别结果的对象，包括识别的文字、坐标和是否找到的结果
     */
    async function textOCR(text="空参数",timeout=10,afterBehavior=0,debugmodel=0,x=0,y=0,w=1920,h=1080) {
        const startTime = new Date();
        var Outcheak = 0 
        for (var ii = 0; ii < 10; ii++) 
        {    
             // 获取一张截图
             var captureRegion = captureGameRegion();
             var  res1 
             var  res2 
             var  conuntcottimecot=1;
             var  conuntcottimecomp=1;
            // 对整个区域进行 OCR
            var resList = captureRegion.findMulti(RecognitionObject.ocr(x,y,w,h));
            //log.info("OCR 全区域识别结果数量 {len}", resList.count);
            if (resList.count !== 0) {
             for (let i = 0; i < resList.count; i++) 
             { // 遍历的是 C# 的 List 对象，所以要用 count，而不是 length
                let  res = resList[i];
                res1=res.text  
                conuntcottimecomp++;
                if (res.text.includes(text) && debugmodel ==3 ) {return result = { text: res.text, x: res.x, y: res.y, found: true };}
                 if (res.text.includes(text) && debugmodel !==2 ) {
                    conuntcottimecot ++;
                    log.info(`“${res1}”找到`);
                    if (debugmodel===1 & x===0 & y===0){log.info("全图代码位置：({x},{y},{h},{w})", res.x-10, res.y-10, res.width+10, res.Height+10);}else{log.info("文本OCR完成'{text}'", res.text);}
                    if (afterBehavior===1){log.info("点击模式:开");await sleep(1000);click(res.x, res.y);}else{if (debugmodel===1 & x===0 & y===0){log.info("点击模式:关")}}  
                    if (afterBehavior===2){log.info("F模式:开");await sleep(100);keyPress("F");}else{if (debugmodel===1 & x===0 & y===0){log.info("F模式:关");}}
                    if (conuntcottimecot>=conuntcottimecomp/2){return result = { text: res.text, x: res.x, y: res.y, found: true };}else{return result = {  found: false};}  
                 }
                 if (debugmodel ===2 ){
                    if (res1 === res2){conuntcottimecot ++;res2=res1;}
                    //log.info("输出模式：全图代码位置：({x},{y},{h},{w},{string})", res.x-10, res.y-10, res.width+10, res.Height+10, res.text);
                    if (Outcheak===1){ if (conuntcottimecot>=conuntcottimecomp/2){return result = { text: res.text, x: res.x, y: res.y, found: true };}else{return result = {  found: false};}}
                }}}             
            const NowTime = new Date();
            if ((NowTime - startTime)>timeout*1000){if (debugmodel===2){ if (resList.count === 0){return result = {found: false};} else{Outcheak=1;ii=2;}     } else {Outcheak=0;if (debugmodel===1 & x===0 & y===0){log.info(`${timeout}秒超时退出，"${text}"未找到`)};return result = {found: false };}}
            else{ii=2;if (debugmodel===1 & x===0 & y===0){log.info(`"${text}"识别中……`); } }
            await sleep(100);
            }  
    } 

/**======================================================================================
 * 执行质变仪的部署动作，未找到质变仪时返回false结束，找到质变仪时返回true
 */
async function deployTransformer(){
    
    await genshin.SwitchParty(TEAM); //切换到指定队伍，必须进行配置，4号位放芭芭拉
    await sleep(1000);
    await keyPress("3");
    await sleep(1200);
    await keyDown("e");
    await sleep(1000);
    await keyUp("e");
    await sleep(1000);
    return true;

}

/**======================================================================================
 * 执行芭芭拉攻击指令，并等待质变仪完成提示出现。 若超时则强制结束流程。
 */
async function executeAttack(){
    await sleep(1000);
    await keyPress("4");
    await sleep(1200);
    await middleButtonClick();
    await sleep(1000);
    
        log.info(`攻击动作开始，${actiontime}秒后超时退出！一般120秒左右完成！`)
        var startTime = new Date();
        await sleep(500);
        var NowTime = new Date();
        //芭芭拉攻击指令，等待质变仪完成提示出现，若超时则强制结束流程。
        var getshu = 0;
        var lastIncrementTime = 0; // 上次增加getshu的时间
        const intervalTime = 3000; // 3秒的时间间隔，单位为毫秒
        while ((NowTime - startTime)<actiontime*1000){
            const result = await textOCR("获得", 0.2, 0, 3, 159, 494, 75, 44);
            if (result.found) {
                const currentTime = new Date().getTime();
                if (currentTime - lastIncrementTime >= intervalTime) {
                    getshu++;
                    lastIncrementTime = currentTime;
                    log.warn(`获得料理数量: ${getshu}`);
                    if (getshu >= 10) { 
                        log.warn("获得料理数量已达10，结束流程！");
                        await genshin.returnMainUi(); // 提前退出循环
                        return true;  
                    }       
                }
            }
            leftButtonClick(); 
            await sleep(50);
            NowTime = new Date();
        }

    await genshin.returnMainUi();
    throw new Error(`${actiontime}秒攻击动作超时，结束流程！`);
}

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
                    let UIDD = await textOCR(UIDnow, 1, 0, 0, 112,177, 190, 39);
                    if (UIDD.found) {
                        await genshin.returnMainUi();
                        throw new Error(`UID "${UIDnow}" 已被禁用，停止刷取！`);                        
                    }
                } 
        }
    }else{log.warn("未配置禁用UID，继续进行！");}
//main/======================================================================================
    await genshin.returnMainUi();
    //检查用户是否配置队伍============================================
    if (settings.TEAMname === undefined) { 
        throw new Error("必填！请在配置页面填写队伍名称，3号为爱可菲，4号位芭芭拉！"); // 没选就报错后停止
    }else{TEAM = settings.TEAMname}

    //爱可菲厨艺机关
    try {
        var AKFevry = 0;
        if (AKF == 2){AKF = 1;AKFevry = 1;}       
        if (AKF == 1){
            const today = new Date();
            // 判断是否为周一（getDay()返回0-6，1代表周一）
            if (today.getDay() == 1 || AKFevry == 1) {
                log.info("执行爱可菲烹饪任务");
                if ((await deployTransformer())) {//部署厨艺机关
                    log.info("厨艺机关部署成功！");
                }                
                if ((await executeAttack())) {//芭芭拉攻击指令流程
                    log.info("爱可菲烹饪任务执行完成，结束！！");
                }  
            }else{
                log.info("不执行爱可菲烹饪任务");
            }
        }else{
            log.info("爱可菲烹饪任务禁用");
        }
    } catch (error) {
        log.error(`执行过程中发生错误：${error.message}`);
    } finally {
        await genshin.returnMainUi();
    }
//main/**======================================================================================

})();


