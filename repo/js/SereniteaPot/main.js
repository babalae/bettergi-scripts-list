(async function () {
    setGameMetrics(1920, 1080, 2);
    // 来自于界面配置
    let sereniteaPotType = settings.sereniteaPot;
    log.info('快捷道具栏需装满4个，确保尘歌壶在第5位');
    setGameMetrics(1920, 1080, 2);
    await sleep(1000); 
    keyPress("B");     //打开背包
    await sleep(1000); 
    click(1058, 48);   //小道具
    await sleep(500); 
    click(765, 190);   //背包第5位（诚哥壶）
    await sleep(500); 
    click(1700, 1018); //放置
    await sleep(1000);
    keyPress("F");    //进入诚哥壶
    await sleep(10000); 

    if (sereniteaPotType == "璃月绿顶建筑"){
        log.info("璃月绿顶建筑");
        keyDown("D");
        await sleep(500);
        keyUp("D");
        await sleep(500);    
    }else if(sereniteaPotType == "蒙德红顶建筑"){
        log.info("蒙德红顶建筑");
        keyDown("A");
        await sleep(1200);
        keyUp("A");
        await sleep(500); 
    }else if(sereniteaPotType == "稻妻蓝顶建筑"){
        log.info("稻妻蓝顶建筑");
        keyDown("A");
        await sleep(1700);
        keyUp("A");
        await sleep(500); 
        keyDown("S");
        await sleep(1700);
        keyUp("S");
        await sleep(500);
    }else if(sereniteaPotType == "须弥绿色建筑"){
        log.info("须弥绿色建筑");
        keyDown("D");
        await sleep(1300);
        keyUp("D");
        await sleep(500);
    }else if(sereniteaPotType == "枫丹白色建筑"){
        log.info("枫丹白色建筑");
        keyDown("S");
        await sleep(1300);
        keyUp("S");
        await sleep(500);
        keyDown("A");
        await sleep(500);
        keyUp("A");
        await sleep(500);
    }else{
    }
    keyPress("F");    //阿圆对话
    await sleep(2000);
    click(1081, 955); //跳过对话
    await sleep(2000);
    click(1383, 430); //信任等阶
    await sleep(2000);
    click(1081, 955); //宝钱
    await sleep(2000);
    click(1812, 716); //好感度
    await sleep(2000);
    click(1863, 48);; //返回
    await sleep(5000);
    click(1356, 804); //再见1
    await sleep(2000);
    click(1356, 804); //再见2
    await sleep(1000);
})();