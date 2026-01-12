(async function () {
    const outTime= ~~settings.outTime;
    switch (settings.selectTask) {
        case "一条龙":
            await sleep(500);
            log.info(`ABGI启动${settings.selectTask}`+"："+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "配置组":
            await sleep(500);
            log.info(`ABGI启动${settings.selectTask}`+"："+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "一条龙(关闭原神)":
            await sleep(500);
            log.info("ABGI启动关闭原神：一条龙-"+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "配置组(关闭原神)":
            await sleep(500);
            log.info("ABGI启动关闭原神：配置组-"+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "狗粮联机上线":
            await sleep(500);
            log.info("ABGI启动联机上线：");
            await sleep(outTime);
            return;
        case "狗粮联机下线":
            await sleep(500);
            log.info("ABGI启动联机下线：");
            await sleep(outTime);
            return;
        case "狗粮联机调试":
            await sleep(500);
            log.info("ABGI启动联机调试：");
            await sleep(outTime);
            return;
        case "指定脚本更新":
            await sleep(500);
            log.info("ABGI启动脚本更新："+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "今日配置组执行情况通知":
            await sleep(500);
            log.info(`ABGI启动${settings.selectTask}`+"：");
            await sleep(outTime);
            return;
        case "关闭原神和关闭bgi":
            await sleep(500);
            log.info(`ABGI启动${settings.selectTask}`+"：");
            await sleep(outTime);
            return;
        case "电脑静音":
            await sleep(500);
            log.info(`ABGI启动${settings.selectTask}`+"：");
            await sleep(outTime);
            return;
        case "开始obs录制":
            await sleep(500);
            log.info("ABGI启动obs："+`启动`);
            await sleep(outTime);
            return;
        case "结束obs录制":
            await sleep(500);
            log.info("ABGI启动obs："+`关闭`);
            await sleep(outTime);
            return;
        case "米游社签到":
            await sleep(500);
            log.info(`ABGI启动${settings.selectTask}`+"：");
            await sleep(outTime);
            return;
        case "bat脚本":
            await sleep(500);
            log.info("ABGI启动BAT脚本："+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "联机更换ABGI的账号信息":
            await sleep(500);
            log.info("ABGI启动联机换号："+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "关闭原神":
            await sleep(500);
            log.info(`ABGI启动${settings.selectTask}`+"：");
            await sleep(outTime);
            return;
        default:
            log.error(`ABGI不支持的任务${settings.selectTask}`);
            await sleep(outTime);
            return;
    };
})();
