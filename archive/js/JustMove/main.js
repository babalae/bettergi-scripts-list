(async function () {

    timeset=1000*settings.t
    domainName = settings.domainName

    switch (domainName) {
        case "前（W）":
            keyDown("w")
            await sleep(timeset);
            keyUp("w")
            log.info("前（W）移动{time}秒", settings.t)
            break;
        case "后（S）":
            keyDown("s")
            await sleep(timeset);
            keyUp("s")
            log.info("后（S）移动{time}秒", settings.t)
            break;
        case "左（A）":
            keyDown("a")
            await sleep(timeset);
            keyUp("a")
            log.info("左（A）移动{time}秒", settings.t)
            break;
        case "右（D）":
            keyDown("d")
            await sleep(timeset);
            keyUp("d")
            log.info("右（D）移动{time}秒", settings.t)
            break;
        default:
            log.info("未检测到设置，你需要到设置里设置移动方向");
            break;
    }
    await sleep(timeset);
})();