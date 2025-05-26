const tpIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/PortableWaypoint.png"));
const goTeleportRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/GoTeleport.png"));
const tpBagRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/PortableWaypointBag.png"));
const swimStateRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/icon/SwimState.png"),
    1400, 900, 1920 - 1400, 1080 - 900);
const ocrRo = RecognitionObject.ocr(1420, 320, 500, 80);
tpIconRo.threshold = 0.70;
tpIconRo.Use3Channels = true;
tpBagRo.threshold = 0.70;
tpBagRo.Use3Channels = true;
swimStateRo.threshold = 0.60;

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
        if (!await genshin.switchParty(partyName)) {
            log.info("切换队伍失败，前往七天神像重试");
            await genshin.tpToStatueOfTheSeven();
            return await genshin.switchParty(partyName);
        } else {
            return true;
        }
    } catch {
        log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
        notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
        await genshin.returnMainUi();
    }
}

async function PlacePortableWaypoint() {
    log.info("正在放置锚点");
    await genshin.returnMainUi();
    await sleep(500);
    keyPress("B");    
    await sleep(500);
    click(1050, 50);
    await sleep(50);
    click(1050, 50);
    await sleep(1000);
    let result = captureGameRegion().find(tpBagRo);
    if(result.isExist()) {
        result.click();
        await sleep(1000);
        click(1680, 990);
        await sleep(50);
        click(1680, 990);
    } else {
        throw new Error("锚点图标未识别，请制作口袋锚点");
    }
    await sleep(500);
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
        result.click();
        await sleep(1000); 
        if (settings.autoPortableWaypoint) {
            let result = captureGameRegion().find(ocrRo);
            log.info("识别到锚点文字: " + result.text);

            // 使用正则表达式匹配不同的时间格式
            const dayHourPattern = /(\d+)天(\d+)小时/;  // X天X小时格式
            const hourOnlyPattern = /(\d+)小时/;       // X小时格式

            let totalHours = 0;
            let dayMatch = result.text.match(dayHourPattern);
            let hourMatch = result.text.match(hourOnlyPattern);

            if (dayMatch) {
                // 匹配到 X天X小时 格式
                const days = parseInt(dayMatch[1]);
                const hours = parseInt(dayMatch[2]);
                totalHours = days * 24 + hours;
                log.info(`解析到剩余时间: ${days}天${hours}小时，总计${totalHours}小时`);
            } else if (hourMatch) {
                // 匹配到 X小时 格式（不足24小时）
                totalHours = parseInt(hourMatch[1]);
                log.info(`解析到剩余时间: ${totalHours}小时`);
            } else {
                log.warn("无法解析锚点剩余时间格式，本次不放置锚点");
            }

            // 判断是否需要放置锚点
            if (totalHours < settings.autoPortableWaypointHours) {
                await PlacePortableWaypoint();
            } else {
                log.info(`剩余时间${totalHours}小时，大于设定阈值${settings.autoPortableWaypointHours}小时，不放置锚点`);
            }
        }
        result = captureGameRegion().find(goTeleportRo);
        result.click();
        await sleep(1000);
        await genshin.returnMainUi();
        await sleep(1000);
    } else {
        log.warn("传送点图标未识别，没有放置传送点");
        await genshin.tp(3347.59, 2756.12);
        if (settings.keymousePartyName) {
            await sleep(500);
            if (!await switchPartyIfNeeded(settings.keymousePartyName)) {
                throw new Error("未找到队伍 " + settings.keymousePartyName + "，请检查设置");
            }
        } else {
            throw new Error("请在设置中配置1号位放凯亚，4号位放七七或多莉无任何移速加成的队伍");
        }
        await sleep(500);
        await keyPress("VK_4");
        await sleep(500);
        await keyMouseScript.runFile("assets/keymouse/锚点放置处.json");
        await sleep(500);
        await switchPartyIfNeeded(settings.partyName);
        if (settings.autoPortableWaypoint) {
            await PlacePortableWaypoint();
        }

    }


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
    if (settings.Test) {
        await pathingScript.runFile("assets/pathing/信仰之跃.json");
    }
}