eval(file.readTextSync("utils.js"));
let targetTemplate = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/1P.png"), 180, 170, 60, 140);
// 读取设置
let enableTargetMatching = settings.enableTargetMatching || false;
let targetUid = settings.targetUid || "";
let enableLevel = settings.enableLevel;
let selectRoom = settings.selectRoom;
(async function () {
    //回到主界面
    await genshin.returnMainUi();
    // 1.传送到黄金屋&苗圃
    if (selectRoom == "黄金屋"){
        await genshin.tp(254.8642578125,-904.357421875,"Teyvat",true) // 黄金屋
    }else{
        await genshin.tp(-250.669921875,2256.83349609375,"Teyvat",true) // 苗圃
        }
    await tpEndDetection();
    // 向前走
    keyDown("w");
    await sleep(3000);
    keyUp("w");
    log.info("开始进行匹配...");
    await sleep(1000);
    // 进入匹配
    await keyPress("F");
    await sleep(4000);
    // 选择
    await click(170,200); 
    await sleep(1000);

    // 默认持续5min,期间每次调用recognizeAndClick，识别成功则退出，否则一直进行到到计时结束
    let t = parseFloat (settings.time) || 5;         
    log.info(`已点击开始匹配，等待时间:${t}min........`);
    let isLevel = false;
    let isUid = false;     
    if (await monitorMatching(t)) {
        await tpEndDetection();
        if (enableTargetMatching) {
            log.info('已启动目标房间匹配！');
            let startTime = Date.now();
            while(Date.now() - startTime <t * 60 * 1000){
                await genshin.returnMainUi();
                log.info('开始检查是否为目标房间')
                // 检查房主UID
                // 是则返回主界面并结束这个脚本
                // 不是的话则返回原世界继续匹配
                isUid = await checkUid(targetTemplate)
                if(!isUid){
                    // 先回到单人模式
                    await returnSingle();
                    // 重新匹配
                    await roomMatch(selectRoom);
                }else{
                    break;
                }
            } 
        }else if(enableLevel){  
            let startTime = Date.now();
            let matchLevel = settings.matchLevel
            while(Date.now() - startTime <t * 60 * 1000){
                await genshin.returnMainUi();
                log.info('开始检查房主等级')
                // 检查房主等级
                try{
                    isLevel = await checkLevel(targetTemplate,matchLevel);
                }catch (e) {
                    console.error("出现错误", e.message);
                    return; 
                }

                if(!isLevel){
                    // 先回到单人模式
                    await returnSingle();
                    // 重新匹配
                    await roomMatch(selectRoom);
                }else{
                    log.info('成功加入目标房间！')
                    break;
                }
            }      
        }else{
            log.info('已禁止目标房间匹配，继续留在该世界！');
        }
        let enableChat = settings.enableChat;
        if(enableChat &&(isLevel||isUid)){
            let randomTextsStr = settings.randomTexts02;
            await communicate(randomTextsStr);
        }
    }else{
        log.info("匹配超时，返回主界面");
    }
    await genshin.returnMainUi();
})();

