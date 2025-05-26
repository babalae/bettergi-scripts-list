const tpIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/PortableWaypoint.png"));
const goTeleportRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/GoTeleport.png"));
const swimStateRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/SwimState.png"),
    1400, 900, 1920-1400, 1080-900);
tpIconRo.threshold = 0.70;
tpIconRo.Use3Channels = true;
swimStateRo.threshold = 0.50;
(async function () {
    await FeatherFailing();
})();

async function switchPartyIfNeeded(partyName) {
    if (!partyName) {
        await genshin.returnMainUi();
        return;
    }
    try {
        log.info("正在尝试切换至" + partyName);
        if(!await genshin.switchParty(partyName)){
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            await genshin.switchParty(partyName);
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}

async function FeatherFailing() {
    await genshin.tpToStatueOfTheSeven();
    await switchPartyIfNeeded(settings.partyName)
    keyPress("VK_M");
    await sleep(1000);
    await genshin.setBigMapZoomLevel(3.0);
    await genshin.moveMapTo(3419, 2739, `枫丹`);
    await genshin.setBigMapZoomLevel(1.0);
    let result = captureGameRegion().find(tpIconRo);
    if (result.isExist()) {
        log.info("传送点图标已识别，点击传送");
    } else {
        throw new Error("传送点图标未识别，没有放置传送点");
    }
    result.click();
    await sleep(1000);
    result = captureGameRegion().find(goTeleportRo);
    result.click();
    await sleep(1000);
    await genshin.returnMainUi(); 
    await sleep(1000);
    
    for (let i = 0; i < 20; i++) {
        keyDown("W");
        await sleep(50);
        keyUp("W");
        await sleep(300);
        result = captureGameRegion().find(swimStateRo);
        if (result.isExist()) {
            log.info("已进入游泳状态"); 
            break;
        }
    }
    keyDown("VK_LCONTROL");
    for (let i = 0; i < 100; i++) {
        await sleep(1000);
        point = genshin.getPositionFromMap();
        log.info("当前坐标:({x}, {y})", point.x, point.y);
        if (point.x > 3000 && point.y > 2400 && point.x < 4000 && point.y < 3200) {
            log.info("小地图已经可以看到提瓦特大陆了", point.x, point.y);
            break;
        }
    }
    await pathingScript.runFile("assets/pathing/原始胎海.json");
    await sleep(25000);
    keyUp("VK_LCONTROL");
    log.info("我已无敌！");
    if(settings.Test){
        await pathingScript.runFile("assets/pathing/信仰之跃.json");  
    }  
}