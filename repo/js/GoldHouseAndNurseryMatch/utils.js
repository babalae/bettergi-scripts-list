// 定义一个函数用于识别图标并点击
async function recognizeAndClick(recognitionObject, iconName, timeout = 200) {
    let startTime = Date.now();
    log.info(`尝试识别图标: ${iconName}`);
    while (Date.now() - startTime < timeout) {
        try {
            // 设置识别阈值和通道
            recognitionObject.threshold = 0.85; // 设置识别阈值为 0.85
            const ro = captureGameRegion();
            let imageResult = ro.find(recognitionObject);
            ro.dispose();
            if (imageResult) {
                // 计算中心坐标
                let centerX = imageResult.x + imageResult.width / 2;
                let centerY = imageResult.y + imageResult.height / 2;
                //await sleep(100); // 避免过快log
                if (centerX === 0 && centerY === 0) {
                    await sleep(50);
                    continue; // 跳过本次循环，继续尝试
                }
                await sleep(500);
                log.info(`成功识别图标!!: ${iconName}，点击${iconName}`);
                await click(Math.round(centerX), Math.round(centerY)); // 执行点击图片操作  
                return true;
            }
        } catch (error) {
            log.error(`识别图标时发生异常: ${error.message}`);
            if (error.message.includes("PrevConverter is null")) {
                log.error("识别对象的 PrevConverter 属性未正确初始化，请检查识别对象的定义");
            }
            break; // 如果发生异常，退出循环
        }
        // await sleep(100); // 短暂延迟，避免过快循环
    }
    log.info(`无法识别图标: ${iconName},取消匹配`);

    // 若500ms内依旧没有匹配成功，点击取消匹配按钮
    return false;
}

// 定义一个函数用于识别文字并点击
async function recAndClickText(text,x,y,w,h) {
    let capture = captureGameRegion();
    const ocrRo = RecognitionObject.Ocr(x, y, w, h);
    let region = capture.find(ocrRo);
    capture.dispose();
    if (region.text == text){
        log.info(`识别到${text},尝试点击`);
        click(Math.round(region.x + region.width/2), Math.round(region.y + region.height/2));
        await sleep(100);
        return true;
    }   
    return false;
}

// 定义一个函数，用于检测是否开始传送
async function tpStartDetection(x=1272,y=192,w=600,h=150,time=500) {
    const region = RecognitionObject.ocr(x,y,w,h); // 注意！不同地方的检测传截取的文字区域是不一样的
    let startTime = Date.now();
    while(Date.now()-startTime < time)
    {
        let capture = captureGameRegion();
        let res = capture.find(region);
        capture.dispose();
        if (res.isEmpty()){
            log.info("检测到传送........");
            return true;
        }
    }
    log.info("没有检测到传送！");
    return false;
}

// 检测传送结束 await tpEndDetection();
async function tpEndDetection() {
    const region = RecognitionObject.ocr(1690, 230, 75, 350); // 队伍名称区域
    let tpTime = 0;
    await sleep(2000); // 点击传送后等待一段时间避免误判
    // 最多30秒传送时间
    log.info("检测是否传送完成");
    log.info("...............");
    while (tpTime < 300) {
        let capture = captureGameRegion();
        let res = capture.find(region);
        capture.dispose();
        if (!res.isEmpty()) {
            await sleep(500);
            log.info("传送完成ヘ( ^o^)ノ＼(^_^ )");
            return;
        }
        tpTime++;
        await sleep(100);
    }
    await genshin.returnMainUi();
    throw new Error('传送时间超时,已返回主界面');
}

// 定义一个函数用于加入别人世界
async function monitorMatching(totalDurationMin = 5) {
    log.info(`开始 ${totalDurationMin} 分钟总循环监测任务...`);
    let startTime = Date.now();
    while (Date.now() - startTime < totalDurationMin * 60 * 1000) {    
        // 开始匹配
        await recAndClickText("匹配挑战",1300,990,162,44); // 等待100ms
        let ConfirmRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Confirm.png"), 960, 710, 420, 100); 
        let isConfirm = await recognizeAndClick(ConfirmRo, "Confirm", 200); // 最多等待200ms
         // 不管是否检测到确认键，仍然点击取消匹配
        if (isConfirm){
            await sleep(200); // 等待200ms
            await recAndClickText("取消匹配",1300,990,162,44); // 理论总共最多等待500ms按下取消匹配
            log.info("开始判断是否传送");           
            if(await tpStartDetection(1272,192,600,150,3000) ){
                log.info("已成功进入，停止监测。"); 
                await sleep(100);
                return true; // 识别成功则退出
            }
        }else{
            await recAndClickText("取消匹配",1300,990,162,44); 
        }       
        if (await tpStartDetection(1272,192,600,150,2000)){
            await tpEndDetection();
            log.info("尝试回到单人模式...");
            await genshin.returnMainUi();
            await sleep(1000);
            keyPress("F2");
            await sleep(1500);
            // 一直点击，直到回到单人模式
            while(!await tpStartDetection(1545,980,1754-1545,1035-980)){
                click(1550, 1020); //回到单人模式
                await sleep(2000);
                click(1030, 760);
            }
            await tpEndDetection(); // 检测是否传送完毕
            keyPress("F");
            await sleep(2000);
        }        
    }
    log.info("达到总时间上限，匹配任务结束。");
    return false;
}

async function roomMatch(selectRoom) {
    try {
        //回到主界面
        await genshin.returnMainUi();
        if (selectRoom =="塞西莉亚苗圃"){
            // 向前走
            keyDown("w");
            await sleep(3000);
            keyUp("w");
        }
        await sleep(1000);
        // 进入
        await keyPress("F");
        await sleep(3000);
        // 选择Confirm
        await click(170,200); 
        await sleep(1000);
        log.info("已选择");
  
        if (await monitorMatching()) {
            await tpEndDetection();
        }            
    } catch (e) {
        log.error(`[脚本错误] 脚本执行异常，错误信息：${e.message}`);
        notification.send("脚本运行异常");
    }
} 

// 定义一个函数，用于对话
async function communicate(randomTextsStr){
    let delay=1000;
    let mytext="";
    let textArray = randomTextsStr.split("|").filter(t => t.trim().length > 0);
    if (textArray.length > 0) {
        mytext = textArray[Math.floor(Math.random() * textArray.length)];
        log.info(`选中句子: ${mytext}`);
    }
    await genshin.returnMainUi();
    await sleep(delay);
    keyPress("RETURN");
    await sleep(delay);
    keyPress("RETURN");
    log.info('正在输入对话内容')
    await sleep(delay);
    await inputText(mytext);
    await sleep(delay);
    log.info('点击发送');
    await keyDown("RETURN");
    await sleep(500);
    await keyUp("RETURN");
}

// 定义一个函数用于检查是否为目标UID，是的话返回true,否则返回false
async function checkUid(recognitionObject) {
    await sleep(1000);
    await keyPress("F2");
    await sleep(2000);
    let targetUid=settings.targetUid;
    // 获得1p的位置
    recognitionObject.threshold = 0.85; // 设置识别阈值为 0.85
    const ro = captureGameRegion();
    let imageResult = ro.find(recognitionObject);
    ro.dispose();
    if (imageResult){
        let centerX = imageResult.x + imageResult.width / 2;
        let centerY = imageResult.y + imageResult.height / 2;
        // 然后进行偏移
        centerX = centerX + 130;
        centerY = centerY + 20;
        // 点击偏移后的位置
        click(Math.round(centerX), Math.round(centerY));
        await sleep(1000);
        centerX = centerX + 270;
        centerY = centerY-5;
        click(Math.round(centerX), Math.round(centerY));
        await sleep(1000);
        try{
            const ocrRegion = RecognitionObject.ocr(627, 196,740-627, 218-196);
            let capture = captureGameRegion();
            let result = capture.find(ocrRegion);
            capture.dispose();
            if (!result.isEmpty()) {
                // 获取识别到的文本
                let text = result.text;
                log.info(`识别到Uid: ${text}`);
                if(text == targetUid){
                    log.info('是目标Uid，继续留在房间！')
                    await genshin.returnMainUi();
                    return true;
                }
                log.info('非目标Uid，准备离开');
                // 友好地发一句“再见”以示礼貌
                await genshin.returnMainUi();
                // 检查是否启用聊天功能
                if (settings.enableChat) {
                    log.info('已启用礼貌离开，友好地发一句话以示礼貌')
                    let randomTextsStr = settings.randomTexts;
                    await communicate(randomTextsStr);
                } else {
                    log.info('未启用礼貌离开功能');
                }
                return false;
            }else{
                log.info('识别不到UID');
                return false;
            }
        }catch(error){
            log.error(`识别UID时发生异常: ${error.message}`);
        }
    }
}

// 定义一个函数用于识别需求等级
async function checkLevel(recognitionObject,matchLevel){
    await sleep(1000);
    await keyPress("F2");
    await sleep(2000);
    // 获得1p的位置
    recognitionObject.threshold = 0.85; // 设置识别阈值为 0.85
    const ro = captureGameRegion();
    let imageResult = ro.find(recognitionObject);
    ro.dispose();
    if (imageResult){
        let centerX = imageResult.x + imageResult.width / 2;
        let centerY = imageResult.y + imageResult.height / 2;
        // 然后进行偏移
        centerX = centerX + 130;
        centerY = centerY + 20;
        // 点击偏移后的位置
        click(Math.round(centerX), Math.round(centerY));
        await sleep(1000);
        centerX = centerX + 270;
        centerY = centerY-5;
        click(Math.round(centerX), Math.round(centerY));
        await sleep(1000);
        try{
            const ocrRegion = RecognitionObject.ocr(831, 445,60, 36);
            let capture = captureGameRegion();
            let result = capture.find(ocrRegion);
            capture.dispose();
            if (!result.isEmpty()) {
                // 获取识别到的文本
                let text = result.text;
                log.info(`识别到等级: ${text}级`);
                // 1.去除空格并将可能的中文分隔符替换为 '-'
                matchLevel = matchLevel.trim().replace(/[～—]/g, '-');
                // 2. 使用 split 拆分
                const parts = matchLevel.split('-');
                if (parts.length === 2) {
                    const min = parseInt(parts[0]);
                    const max = parseInt(parts[1]);
                    if(Number(text)>=min && Number(text)<=max){
                        await genshin.returnMainUi();
                        return true;
                    }
                }else if(parts.length === 1){
                    const matchLevel = parseInt(parts);
                    if (Number(text) === matchLevel){
                        await genshin.returnMainUi();
                        return true;
                    }
                }else{
                    throw new Error("Invalid Level"); // 抛出异常
                }
                log.info('等级不在范围内，准备离开');
                // 友好地发一句“再见”以示礼貌
                await genshin.returnMainUi();
                // 检查是否启用聊天功能
                if (settings.enableChat) {
                    log.info('已启用礼貌离开，友好地发一句话以示礼貌')
                    let randomTextsStr = settings.randomTexts;
                    await communicate(randomTextsStr);
                } else {
                    log.info('未启用礼貌离开功能');
                }
                return false;
            }else{
                log.info('识别不到等级');
                return false;
            }
        }catch(error){
            log.error(`识别等级时发生异常: ${error.message}`);
        }
    }
}

async function returnSingle() {
    let leaveRoomRo= RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/leaveRoom.png"), 1485, 990, 75, 60);
    // 检测传送结束 await tpEndDetection();
    log.info("尝试回到单人模式...");
    await genshin.returnMainUi();
    await sleep(1000);
    keyPress("F2");
    await sleep(1500);
    // 检查是否处于联机状态
    // leaveRoomRo.threshold = 0.85; // 设置识别阈值为 0.85
    const ro = captureGameRegion();
    let imageResult = ro.find(leaveRoomRo);
    ro.dispose();
    // 是则离开否则返回主界面
    if(!imageResult.isEmpty()){
        log.info("检测到处于联机状态，正在返回单人模式")
        click(1710,130);
        await sleep(500);
        click(1550, 1020);
        await sleep(1000);
        click(1030, 760); // 点击单人模式
        log.info("------开始检测是否传送完成")
        await tpEndDetection(); // 检测是否传送完毕，是的话就结束这个函数
    }else{
        log.info('已经处于单人模式,返回主界面');
        await genshin.returnMainUi();
    }  
}