// 延时时间
const outTime= ~~settings.outTime;

// 比较结果
let result = 0
// 比较ABGI版本号
async function compareVersion(version1, version2) {
  const v1Segments = version1.split('.');
  const v2Segments = version2.split('.');
  const maxLength = Math.max(v1Segments.length, v2Segments.length);
  for (let i = 0; i < maxLength; i++) {
    const v1Num = Number(v1Segments[i] || 0);
    const v2Num = Number(v2Segments[i] || 0);
    if (v1Num > v2Num) {
      return 1;
    } else if (v1Num < v2Num) {
      return -1;
    }
  };
  return 0;
};

// 主函数
(async function () {
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
            result = await compareVersion(settings.versionABGI, "3.4.12");
            if (result == -1) {
                log.error("无法调用该任务，请更新ABGI至3.4.12版本或更高版本");
                await sleep(outTime);
                return;
            };
            await sleep(500);
            log.info("ABGI启动联机换号："+`${settings.inputText}`);
            await sleep(outTime);
            return;
        // case "关闭原神":
        //     await sleep(500);
        //     log.info(`ABGI启动${settings.selectTask}`+"：");
        //     await sleep(outTime);
        //     return;
        case "更换联机房间":
            result = await compareVersion(settings.versionABGI, "3.5.25");
            if (result == -1) {
                log.error("无法调用该任务，请更新ABGI至3.5.25版本或更高版本");
                await sleep(outTime);
                return;
            };
            await sleep(500);
            log.info(`ABGI启动更换房间：`+`${settings.inputText}`);
            await sleep(outTime);
            return;
        case "等待时间(单位为ms)":
            await sleep(500);
            await sleep(outTime);
            return;
        default:
            log.error(`ABGI不支持的任务${settings.selectTask}`);
            await sleep(outTime);
            return;
    };
})();
