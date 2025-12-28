eval(file.readTextSync('lib/chat/ChatClick.js'));
const Online = {};
eval(file.readTextSync('lib/Online/core.js'));
Online.core = Core;

const Laim = {};
eval(file.readTextSync('lib/Laim/lib/core.js'));
Laim.core = core;

const Firefly = {};
eval(file.readTextSync('lib/Firefly/lib/core.js'));
Firefly.core = core;

var Core = {
    /* ------------------------------------------------------
     * 1. 辅助函数：等待进入世界
     * ------------------------------------------------------ */
    _waitEnterWorld: async function (timeout = 180) {
        for (let i = 0; i < timeout; i++) {
            const res = await Online.core.detectPlayerCount();    
            if (res && res.status !== 'loading') {
                log.info('[Core] 已进入世界');
                await sleep(200);
                return true;
            }
            await sleep(200);
        }
        log.warn('[Core] 等待进入世界超时');
        return false;
    },

    /* ------------------------------------------------------
     * 2. 前置准备
     * ------------------------------------------------------ */
    Run01: async function () {
        log.info('[Core] 开始执行前准备');
        log.info('[Core] 模板加载完成');
        // TODO: 吃药、换队、Buff 等
        log.info('[Core] 前准备完成');
    },

    /* ------------------------------------------------------
     * 3. 摩拉识别相关
     * ------------------------------------------------------ */
    mora: async function () {
        const CharacterMenuRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/Recognition/Friends Button.png"));
        let result = 0, tryTimes = 0;
        
        while (result === 0 && tryTimes < 3) {
            await genshin.returnMainUi();
            log.info('[Core] 开始识别摩拉');
            keyPress('C');
            await sleep(1500);

            let recognized = false, startTime = Date.now();
            while (Date.now() - startTime < 5000) {
                // 角色菜单图标
                const charRes = await this.recognizeImage(CharacterMenuRo, 5000);
                if (charRes.success) {
                    await click(177, 433);
                    await sleep(500);
                    recognized = true;
                    break;
                }
                // 天赋文字
                const talentRes = await this.recognizeTextAndClick('天赋', { x: 133, y: 395, width: 115, height: 70 });
                if (talentRes.success) {
                    log.info(`[Core] 点击天赋文字 @ ${talentRes.x}, ${talentRes.y}`);
                    recognized = true;
                    break;
                }
                await sleep(1000);
            }

            if (recognized) {
                const moraText = await this.recognizeTextInRegion({ x: 1620, y: 25, width: 152, height: 46 });
                if (moraText) {
                    log.info(`[Core] 识别到摩拉: ${moraText}`);
                    result = Number(moraText) || 0;
                }
            }
            tryTimes++;
            await genshin.returnMainUi();
            await sleep(500);
        }
        return result;
    },

    recognizeImage: async function (recognitionObject, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const r = captureGameRegion().find(recognitionObject);
                if (r) return { success: true, x: r.x, y: r.y };
            } catch (e) { log.error(`[Core] 识别图像异常: ${e.message}`); }
            await sleep(500);
        }
        log.warn('[Core] 识别图像超时');
        return { success: false };
    },

    recognizeTextAndClick: async function (targetText, ocrRegion, timeout = 3000) {
        const start = Date.now();
        let retry = 0;
        while (Date.now() - start < timeout) {
            try {
                const list = captureGameRegion()
                    .findMulti(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
                for (const res of list) {
                    if (res.text.includes(targetText)) {
                        const cx = Math.round(res.x + res.width / 2);
                        const cy = Math.round(res.y + res.height / 2);
                        await click(cx, cy);
                        await sleep(500);
                        return { success: true, x: cx, y: cy };
                    }
                }
            } catch (e) {
                retry++;
                log.warn(`[Core] 文字识别失败，第${retry}次重试...`);
            }
            await sleep(1000);
        }
        // 超时点默认中心
        const cx = Math.round(ocrRegion.x + ocrRegion.width / 2);
        const cy = Math.round(ocrRegion.y + ocrRegion.height / 2);
        await click(cx, cy);
        await sleep(1000);
        return { success: false };
    },

    recognizeTextInRegion: async function (ocrRegion, timeout = 5000) {
        const start = Date.now();
        let retry = 0;
        while (Date.now() - start < timeout) {
            try {
                const ocrResult = captureGameRegion()
                    .find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
                if (ocrResult) return ocrResult.text;
            } catch (e) {
                retry++;
                log.warn(`[Core] OCR 识别失败，第${retry}次重试...`);
            }
            await sleep(500);
        }
        log.warn('[Core] 指定区域未识别到文字');
        return null;
    },

    /* ------------------------------------------------------
     * 4. 仅执行单次流程（单人）
     * ------------------------------------------------------ */
    executeSingleProcess: async function () {
        try {
            // 1. 获取配置
            const mode = settings.run_mode || "试试“利亚姆";
            const LaimAttack = settings.LaimAttack || false;
            
            // 2. 切换世界
            keyPress('1');
            await genshin.returnMainUi();
            
            // 3. 路由分发
            let fireflyOk = false;
            let laimDone = false;
            
            switch (mode) {
                case "我全都要！":
                    fireflyOk = await Firefly.core.executeMainProcess();
                    laimDone  = await Laim.core.executeMainProcess();
                    break;
                case "试试“利亚姆":
                    laimDone = await Laim.core.executeMainProcess();
                    break;
                case "试试“飞萤":
                    fireflyOk = await Firefly.core.executeMainProcess();
                    break;
                case "一二三，木头人":
                    log.info('[木头人] 已跳过所有路线');
                    break;
                default:
                    log.warn(`[WARN] 未知的 run_mode: ${mode}，已自动回落到"利亚姆"`);
                    laimDone = await Laim.core.executeMainProcess();
            }
            
            log.info('Laim 最终执行结果:', laimDone);
            if (!laimDone && LaimAttack) {
                const laimDone1 = await Core.executeSingleProcess();
                log.info('Laim 补跑结果:', laimDone1);
            }
            
            keyPress('Space');
            
            // 4. 检测加入按钮
            const iconFiles = 'assets/ui/a.png';
            const tplMat = RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconFiles), 0, 0, 1920, 1080);
            const joinResult = captureGameRegion().find(tplMat);
            if (joinResult.isExist()) {
                joinResult.click();
                await sleep(8888);
                await this._waitEnterWorld();
            }
            
            return { ok: true, reason: '单人流程完成' };
            
        } catch (e) {
            log.error(`[Core] 单次流程异常：${e.message}`);
            return { ok: false, reason: `异常: ${e.message}` };
        }
    },

    /* ------------------------------------------------------
     * 5. 主流程（主函数功能）
     * ------------------------------------------------------ */
    executeMainProcess: async function () {
        // 1. 获取配置参数
        const mpTask = settings.multiplayer_task || "一二三，木头人";
        const LaimAttack = settings.LaimAttack || false;
        const MAX_LOOP = settings.max_run_cycles || 133;
        const MAX_TIME_S = settings.max_run_minutes * 60 || 12 * 3600;
        const GREET_TEXT = '你好呀，可以打一点飞萤吗,谢谢你(✿◡‿◡)';
        const JOIN_ICON = 'assets/ui/a.png';
        
        // 2. 检查木头人模式（早退）
        if (mpTask === "一二三，木头人" ||mpTask === "放好路线啦！" ) {
            log.info('[multiplayer] 其他模式：直接跳过后续流程');
            return { ok: true, reason: '其他模式跳过' };
        }
        
        try {
            await sleep(1200);
            
            // 3. 循环控制器
            let counter = 0;
            let errCnt = 0;
            const startTs = Date.now();
            
            while (true) {
                // 终止条件检查
                const elapsed = (Date.now() - startTs) / 1000;
                if (counter >= MAX_LOOP || elapsed >= MAX_TIME_S) {
                    log.info(`[Loop] 循环结束：次数=${counter}, 耗时=${elapsed.toFixed(1)}s`);
                    break;
                }
                counter++;
                
                try {
                    log.info(`[Core] 第 ${counter} 次循环开始`);
                    
                    // 4.1 切换世界等待
                    keyPress('1');
                    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                    
                    await Online.core.outF2();
                    await sleep(6600);
                    
                    // 等待进入世界
                    await this._waitEnterWorld();
                    
                    await Online.core.outF2();
                    
                    // 等待进入世界
                    await this._waitEnterWorld();
                    
                    // 世界过渡等待
                    const timers = Online.core.createTimer(60000 * 5);
                    await Online.core.waitForWorldTransition(timers);
                    await sleep(300);
                    await genshin.returnMainUi();
                    const res = await Online.core.detectPlayerCount();    
                    // 4.2 聊天打招呼
                    if ( res && res.count >= 1) {
                        await ChatClick.saySomething(GREET_TEXT);
                        await ChatClick.sendEmoji(5, 3);
                    }
                    
                    // 4.3 路由分发（多人任务）
                    let fireflyOk = false;
                    let laimDone = false;
                    
                    switch (mpTask) {
                        case "摩拉上限（20小时）":
                            fireflyOk = await Firefly.core.executeMainProcess();
                            laimDone  = await Laim.core.executeMainProcess();
                            break;
                        case "试试“利亚姆":
                            laimDone = await Laim.core.executeMainProcess();
                            break;
                        case "试试“飞萤":
                            fireflyOk = await Firefly.core.executeMainProcess();
                            break;
                        default:
                            log.warn(`[WARN] 未知的 multiplayer_task: ${mpTask}，回落到"利亚姆"`);
                            laimDone = await Laim.core.executeMainProcess();
                    }
                    
                    log.info('Laim 执行结果:', laimDone);
                    if (!laimDone && LaimAttack) {
                        const laimDone1 = await Laim.core.executeMainProcess();
                        log.info('Laim 补跑结果:', laimDone1);
                    }
                    
                    keyPress('Space');
                    
                    // 4.4 检测复活按钮
                    const tplMat = RecognitionObject.TemplateMatch(file.ReadImageMatSync(JOIN_ICON), 0, 0, 1920, 1080);
                    const joinResult = captureGameRegion().find(tplMat);
                    if (joinResult.isExist()) {
                        joinResult.click();
                        await sleep(8888);
                        await this._waitEnterWorld();
                    }
                    
                    // 4.5 最终检测和聊天
                    await this._waitEnterWorld();
                    keyPress('Space');
                    
                    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                    
                    const res1 = await Online.core.detectPlayerCount();    
                    
                    if (res1 && res1.count >= 1) {
                        await ChatClick.selectSaySomething(counter);
                    }
                    keyPress('Space');
                    await Online.core.outF2();
                    await sleep(3600);
                    
                    // 成功完成一次循环，重置错误计数
                    errCnt = 0;
                    
                } catch (e) {
                    errCnt++;
                    log.error(`[Loop] 第 ${counter} 次异常：${e.message} (连续异常${errCnt}/3)`);
                    if (errCnt >= 3) {
                        log.error('[Loop] 连续异常 3 次，强制中断');
                        return { ok: false, reason: `连续异常${errCnt}次: ${e.message}` };
                    }
                }
            }
            
            return { ok: true, reason: `正常完成 ${counter} 次循环` };
            
        } catch (err) {
            log.error(`[Core] 服务崩溃: ${err.message}`);
            return { ok: false, reason: `服务崩溃: ${err.message}` };
        }
    },

    /* ------------------------------------------------------
     * 6. 多人路径模式
     * ------------------------------------------------------ */
    executeMainProcess1: async function () {
        // 1. 获取配置参数
        const mpTask = settings.multiplayer_task || "一二三，木头人";
        const MAX_LOOP = settings.max_run_cycles || 133;
        const MAX_TIME_S = settings.max_run_minutes * 60 || 12 * 3600;
        const folderName = settings.route_folder_name || "测试";
        const GREET_TEXT = settings.greeting_sentence || '你好呀，可以让我采甜甜花做饭吗,谢谢你(✿◡‿◡)';
        const JOIN_ICON = 'assets/ui/a.png';
        
        // 2. 检查是否为路径模式
        if (mpTask !== "放好路线啦！") {
            log.info('[multiplayer] 非路径模式，跳过');
            return { ok: true, reason: '非路径模式跳过' };
        }
        
        try {
            log.info('[multiplayer] 路径模式，开始');
            await sleep(1200);
            
            // 3. 循环控制器
            let counter = 0;
            let errCnt = 0;
            const startTs = Date.now();
            
            while (true) {
                // 终止条件检查
                const elapsed = (Date.now() - startTs) / 1000;
                if (counter >= MAX_LOOP || elapsed >= MAX_TIME_S) {
                    log.info(`[Loop] 循环结束：次数=${counter}, 耗时=${elapsed.toFixed(1)}s`);
                    break;
                }
                counter++;
                
                try {
                    log.info(`[Core] 第 ${counter} 次循环开始`);
                    
                    // 4.1 切换世界等待
                    keyPress('1');
                    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                    await Online.core.outF2();
                    await sleep(6600);
                    
                    // 等待进入世界
                    await this._waitEnterWorld();
                    
                    // 世界过渡等待
                    const timers = Online.core.createTimer(60000 * 5);
                    await Online.core.waitForWorldTransition(timers);
                    await sleep(300);
                    await genshin.returnMainUi();
                    
                    // 4.2 聊天打招呼                    
                    const res = await Online.core.detectPlayerCount();   
                    if (res && res.count >= 1) {
                        await ChatClick.saySomething(GREET_TEXT);
                        await ChatClick.sendEmoji(5, 3);
                    await ChatClick.run(true);
                    }
                    
                    // 4.3 执行路径
                    await Online.core.runPathingFolder(folderName);
                    
                    keyPress('Space');
                    
                    // 4.4 检测复活按钮
                    const tplMat = RecognitionObject.TemplateMatch(file.ReadImageMatSync(JOIN_ICON), 0, 0, 1920, 1080);
                    const joinResult = captureGameRegion().find(tplMat);
                    if (joinResult.isExist()) {
                        joinResult.click();
                        await sleep(8888);
                        await this._waitEnterWorld();
                    }
                    
                    // 4.5 最终检测
                    await this._waitEnterWorld();
                    
                    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));
                    
                    const res1 = await Online.core.detectPlayerCount();    
                    
                    if (res1 && res1.count >= 1) {
                        await ChatClick.selectSaySomething(counter);}
                    keyPress('Space');
                    await Online.core.outF2();
                    await sleep(3600);
                    
                    // 成功完成一次循环，重置错误计数
                    errCnt = 0;
                    
                } catch (e) {
                    errCnt++;
                    log.error(`[Loop] 第 ${counter} 次异常：${e.message} (连续异常${errCnt}/3)`);
                    if (errCnt >= 3) {
                        log.error('[Loop] 连续异常 3 次，强制中断');
                        return { ok: false, reason: `连续异常${errCnt}次: ${e.message}` };
                    }
                }
            }
            
            return { ok: true, reason: `路径模式完成 ${counter} 次循环` };
            
        } catch (err) {
            log.error(`[Core] 服务崩溃: ${err.message}`);
            return { ok: false, reason: `服务崩溃: ${err.message}` };
        }
    },

    /* ------------------------------------------------------
     * 7. 简化外部调用
     * ------------------------------------------------------ */
    runMainLoop: async function () {
        return await this.executeMainProcess();
    }
};