(async function () {

    // 读取用户设置
    let PowerOptions = settings.PowerOptions != undefined ? settings.PowerOptions : '';

    //执行计算机操作
    keyDown("LWIN");
    keyDown("X");
    await sleep(50);
    keyUp("LWIN");
    keyUp("X");
    await sleep(3000);
    keyPress("LSHIFT");
    await sleep(50);
    keyPress("LCONTROL");    
    await sleep(50);
    keyPress("U");
    await sleep(1000);

    // 根据用户选择进行操作
    if (PowerOptions == '注销') {
        log.info(" 将执行 注销 ");
        keyPress("I");
    } else if (PowerOptions == '睡眠') {
        log.info(" 将执行 睡眠 ");
        keyPress("S");
    } else if (PowerOptions == '休眠') {
        log.info(" 将执行 休眠 ");
        keyPress("H");
    } else if (PowerOptions == '关机') {
        log.info(" 将执行 关机 ");
        keyPress("U");
    } else if (PowerOptions == '重启') {
        log.info(" 将执行 重启 ");
        keyPress("R");
    } else {
        // 无指定操作﹐将使用“注销”
        log.info(" 将执行 注销 ");
        keyPress("I");
    }
    await sleep(50);
    keyPress("RETURN");

})();
