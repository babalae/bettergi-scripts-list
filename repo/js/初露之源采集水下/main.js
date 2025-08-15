(async function () {

    if (!settings.enable) {
        log.error(`请打开「JS脚本自定义配置」，然后阅读并勾选第一个复选框。`);
        return
    }

    // 切换跑图队伍
    if (settings.team) {
        log.info(`切换至队伍 ${settings.team},请确保成女男体型并无加速效果！`);
        try {
            log.info("正在尝试切换至" + settings.team);
            if (!await genshin.switchParty(settings.team)) {
                log.info("切换队伍失败，前往七天神像重试");
                await genshin.tpToStatueOfTheSeven();
                await genshin.switchParty(settings.team);
            }
        } catch {
            log.error("队伍切换失败，可能处于联机模式或其他不可切换状态");
            notification.error(`队伍切换失败，可能处于联机模式或其他不可切换状态`);
            await genshin.returnMainUi();
        }
    }

    dispatcher.addTimer(new RealtimeTimer("AutoPick", {"forceInteraction": true}));


    log.debug("自体自身之塔1 传送点")
    if (settings.selectAll || settings.upperPortion01) {
        try {
            log.info('上部-拾取-01(1~2个)');
            await genshin.tp(3647.38, 2928);//自体自身之塔1
            await sleep(1000);
            await keyMouseScript.runFile(`assets/拾取-01(1~2个).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('上部-拾取-01(1~2个)跳过。');
    }

    log.debug("行走-上部-1-1")
    if (settings.selectAll || settings.upperPortion02) {
        try {
            log.info('上部-拾取-02(1~2个)');
            await genshin.tp(3647.38, 2928);//自体自身之塔1 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-上部-1-1.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-上部-1-1)拾取-02(1~2个).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('上部-拾取-02(1~2个)跳过。');
    }

    if (settings.selectAll || settings.upperPortion03) {
        try {
            log.info('上部-拾取-03(1~5个)');
            await genshin.tp(3647.38, 2928);//自体自身之塔1 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-上部-1-1.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-上部-1-1)拾取-03(1~5个).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('上部-拾取-03(1~5个)跳过。');
    }

    log.debug("行走-上部-1-2")

    if (settings.selectAll || settings.upperPortion04) {
        try {
            log.info('上部-拾取-04(1~4个)');
            await genshin.tp(3647.38, 2928);//自体自身之塔1 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-上部-1-1.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-上部-1-2(续自行走-上部-1-1).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-上部-1-2)拾取-04(1~4个).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('上部-拾取-04(1~4个)跳过。');
    }

    if (settings.selectAll || settings.upperPortion05) {
        try {
            log.info('上部-拾取-05(1~8个)');
            await genshin.tp(3647.38, 2928);//自体自身之塔1 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-上部-1-1.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-上部-1-2(续自行走-上部-1-1).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-上部-1-2)拾取-05(1~8个).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('上部-拾取-05(1~8个)跳过。');
    }

    log.debug("行走-上部-1-3")
    if (settings.selectAll || settings.upperPortion06) {
        try {
            log.info('上部-拾取-06(1~6个)');
            await genshin.tp(3647.38, 2928);//自体自身之塔1 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-上部-1-3.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-上部-1-3)拾取-06(1~6个).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-上部-1-3)拾取-06(1~6个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('上部-拾取-06(1~6个)跳过。');
    }
    log.debug("自体自身之塔2 传送点")
    log.debug("行走-中部-2-1")
    if (settings.selectAll || settings.central01) {
        try {
            log.info('中部-拾取07(1~2个)');
            await genshin.tp(3578.32, 2695.5);//自体自身之塔2 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-中部-2-1.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-中部-2-1)拾取07(1~2个).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-中部-2-1)拾取07(1~2个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('中部-拾取07(1~2个)跳过。');
    }

    if (settings.selectAll || settings.central02) {
        try {
            log.info('中部-拾取08(1~5个)');
            await genshin.tp(3578.32, 2695.5);//自体自身之塔2 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-中部-2-2.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-中部-2-2)拾取08(1~5个).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-中部-2-2)拾取08(1~5个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('中部-拾取08(1~5个)跳过。');
    }

    if (settings.selectAll || settings.central03) {
        try {
            log.info('中部-拾取09(1~7个)');
            await genshin.tp(3578.32, 2695.5);//自体自身之塔2 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-中部-2-2.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-中部-2-2)拾取09(1~7个).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-中部-2-2)拾取09(1~7个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('中部-拾取09(1~7个)跳过。');
    }

    if (settings.selectAll || settings.lower01) {
        try {
            log.info('下部-拾取10(1~5个)');
            await genshin.tp(3672.54, 2448);//自体自身之塔3 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/拾取10(1~5个).json`);
            // await sleep(1000);
            // await keyMouseScript.runFile(`assets/拾取10续(1~4个).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('下部-拾取10(1~5个)跳过。');
    }

    if (settings.selectAll || settings.lower02) {
        try {
            log.info('下部-拾取11(1~4个)');
            await genshin.tp(3672.54, 2448);//自体自身之塔3 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-下部-3-2.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/拾取11(1~4个).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/拾取11(1~4个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('下部-拾取11(1~4个)跳过。');
    }

    if (settings.selectAll || settings.lower03) {
        try {
            log.info('下部-拾取11(1~4个)');
            await genshin.tp(3672.54, 2448);//自体自身之塔3 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/拾取12(1~4个).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('下部-拾取12(1~4个)跳过。');
    }

    if (settings.selectAll || settings.lower04) {
        try {
            log.info('下部-拾取13(1~12个)');
            await genshin.tp(3672.54, 2448);//自体自身之塔3 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-下部-3-1.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/拾取13(1~12个).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/拾取13(1~12个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('下部-拾取13(1~12个)跳过。');
    }

    if (settings.selectAll || settings.lower05) {
        try {
            log.info('下部-拾取14(1~4个)');
            await genshin.tp(3672.54, 2448);//自体自身之塔3 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-下部-3-2.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-下部-3-2)拾取14(1~4个).json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-下部-3-2)拾取14(1~4个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('下部-拾取14(1~4个)跳过。');
    }

    if (settings.selectAll || settings.lower06) {
        try {
            log.info('下部-拾取15(1~3个)');
            await genshin.tp(3672.54, 2448);//自体自身之塔3 传送点
            await sleep(1000);
            await keyMouseScript.runFile(`assets/行走-下部-3-2.json`);
            await sleep(1000);
            await keyMouseScript.runFile(`assets/(行走-下部-3-2)拾取15(1~3个).json`);
            // await sleep(1000);
            // await keyMouseScript.runFile(`assets/(行走-下部-3-2)拾取14(1~4个)(修正兼容1).json`);
        } catch (error) {
            log.warn(error.message);
            log.warn('传送错误，跳过。');
        }
    } else {
        log.info('下部-拾取15(1~3个)跳过。');
    }
    // if (settings.selectAll || settings.central01) {
    //     try {
    //         log.info('拾取-01(1~2个)');
    //     } catch (error) {
    //         log.warn(error.message);
    //         log.warn('传送错误，跳过。');
    //     }
    // } else {
    //     log.info('跳过。');
    // }




    dispatcher.addTimer(new RealtimeTimer("AutoPick", {"forceInteraction": false}));


})();
