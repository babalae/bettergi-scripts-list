/* =========================================================
 *  MobFallAttack.js
 *  功能：自动寻怪 →攻击 → 确认血条出现
 *  用法：await MobFallAttack.executeMainProcess();
 * ========================================================= */
            eval(file.readTextSync("lib/Laim/lib/core.js"));

        xietiao = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync('assets/Recognition/血条.png'), 600, 0, 600, 120);
        Shui = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync('assets/Recognition/Shui.png'), 740, 90, 100, 50);
var MobFallAttack = {





    /* ---------- 2. 主流程 ---------- */
    executeMainProcess: async function () {
        log.info('[MobFallAttack] ====== 下落攻击流程启动 ======');
        try {


            const filePath = 'assets/Laim/跳加下落.json';
            const deadline = Date.now() + 60000; // 60 秒总超时
            let foundInRect = false;

            // 主轮询：60 秒内不断找水图标,找到就行动
            while (Date.now() < deadline && !foundInRect) {
                const result = await this.findLiamShui();
                if (result.found && result.x >= 740 && result.x <= 800) {
                    log.info('[MobFallAttack] 找到Liam水图标(合格区域) ');

                    /* --- 一套 combo --- */
                    await keyMouseScript.runFile(filePath); // 跳+下落
                    await sleep(1200);
                    keyPress('2');
                    await sleep(600);
                    keyDown('e');
                    await sleep(1000);
                    keyUp('e');
                    await sleep(1000);

                    foundInRect = true; // 命中后结束外层 while
                }
            }

            log.info('[MobFallAttack] ====== 下落攻击流程结束 ======');
            return foundInRect; // true=成功出手
        } catch (err) {
            log.error(`[MobFallAttack] 流程异常: ${err.message}`);
            throw err;
        }
    },

    /* ---------- 3. 核心函数：找 Liam 水 + 血条守护 ---------- */
    /**
     * 在当前游戏画面里找「Liam」的水图标
     * @returns {Promise<{found:boolean, x:number, y:number}>}
     */
    findLiamShui: async function () {
        const LIMIT = 60_000; // 单轮搜索最多 60 秒
        const start = Date.now();

        while (Date.now() - start < LIMIT) {
            const region = captureGameRegion();
            const hit1 = region.find(Shui);
            if (hit1?.x && hit1?.y) {
                log.info(`[findLiamShui] 水图标确认 @ (${hit1.x}, ${hit1.y})`);
                return { found: true, x: hit1.x, y: hit1.y };
            }
            // 血条消失立即结束
            if (!region.find(xietiao)) {
                log.info('[findLiamShui] 血条消失，停止搜索');
                return { found: false, x: -1, y: -1 };
            }
            await sleep(20); // 高频轮询
        }

        // 60 秒到了仍没找到
        log.warn('[findLiamShui] 60 秒限时到，强制返回未找到');
        return { found: false, x: -1, y: -1 };
    },

    /* ---------- 4. 工具：鼠标移动脚本（可选） ---------- */
    moveMouseScripts: async function (dx, dy) {
        const right = 'assets/Laim/鼠标右一.json';
        const down  = 'assets/Laim/鼠标下一.json';
        for (let i = 0; i < Math.abs(dx); i++) await keyMouseScript.runFile(right);
        for (let i = 0; i < Math.abs(dy); i++) await keyMouseScript.runFile(down);
    },


    /**
     * 根据地点名称执行预设的路线脚本（跑图路线）
     * @param {string} locationName - 地点名称（不含扩展名）
     * @returns {Promise<void>}
     */
    pathingfiy: async function(locationName) {
        log.info('前往路线: ');
        const filePath = `assets/Laim/pathing/${locationName}.json`;
        await pathingScript.RunFile(filePath);
    },



    pickUp: async function () {
        log.info('[MobFallAttack] 开始拾取准备');
        
        await core.recognizeOnePopup();
                await genshin.tpToStatueOfTheSeven();

            await sleep(1200);

// await genshin.Tp(3032.96875, 3732.70);

    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: true }));
            await sleep(1200);
            keyPress("1");
            await sleep(1200);
            keyPress("3");
            await sleep(1200);
            await this.pathingfiy('Laim1');



await sleep(1200);
            keyDown('e');
            await sleep(1000);
            keyUp('e');
await sleep(300);await click(960, 540); 

            await sleep(3600);
    dispatcher.addTimer(new RealtimeTimer("AutoPick", { forceInteraction: false }));



    }






   
};