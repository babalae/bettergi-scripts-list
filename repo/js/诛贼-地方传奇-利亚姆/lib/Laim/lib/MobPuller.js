/* =========================================================
 *  MobPuller.js
 *  功能：自动拉怪 → 寻灯 → 射击 直到出现血条！
 *  用法：await MobPuller.executeMainProcess();
 * ========================================================= */
        xietiao = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync('assets/Recognition/血条.png'), 600, 0, 600, 120);
        Shui = RecognitionObject.TemplateMatch(
            file.ReadImageMatSync('assets/Recognition/Shui.png'), 740, 90, 100, 50);
var MobPuller = {

    /* ------------------------------------------------------
     * 委托前准备：目前空壳，后续可补充吃药、换队、开 Buff 等
     * ------------------------------------------------------ */
    Run01: async function() {
        log.info("[MobPuller] 开始执行前准备");
        // TODO: 换角色、吃药、开盾、记时间戳等
        log.info("[MobPuller] 前准备完成");
    },

    /* ------------------------------------------------------
     * 主流程：移植自原 main()，已补全日志
     * ------------------------------------------------------ */
    executeMainProcess: async function() {
        log.info("[MobPuller] ====== 拉怪流程启动 ======");
        try {
            await this.Run01();          // 预留准备阶段

            await sleep(200);
            log.info("[MobPuller] 开始路径脚本 ");
            await this.pathingfiy('Laim');

            await genshin.returnMainUi();
            keyPress("2");

            await sleep(600);
            keyDown('e');
            await sleep(1000);
            keyUp('e');

            await sleep(600);
            keyPress("1");

            await sleep(600);
            keyPress("r");

            await sleep(100);
            keyDown('w');
            await sleep(800);
            keyUp('w');

            await sleep(1200);
            log.info("[MobPuller] 开始寻灯并射击");
            // 主流程里
            const ok = await this.findLamp();
            log.info('[MobPuller] ====== 拉怪流程结束 ======');
            if (!ok) {
              log.warn('[MobPuller] 未找到灯/血条，流程中断')
            }else{
              const down400  = 'assets/Laim/鼠标右负百.json';
              const down20  = 'assets/Laim/鼠标右负十.json';
              for (let i = 0; i < 4; i++)await keyMouseScript.runFile(down400);
              for (let j = 0; j < 3; j++)await keyMouseScript.runFile(down20); 
            }

            return ok;               
        } catch (err) {
            log.error(`[MobPuller] 流程异常: ${err.message}`);
            throw err;   // 抛到最外层统一捕获
        }
    },


    /**
     * 在当前游戏画面里找「灯」图标
     * @returns {Promise<boolean>} true=检测到血条
     */
    findLamp: async function() {
      /* ========== 1. 直接初始化模板 ========== */
      const lampRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync('assets/Recognition/DENG.png'),
        1160, 540,                       // x, y
        genshin.width - 1170,            // w
        genshin.height / 2               // h
      );
      const lampRo02 = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync('assets/Recognition/DENG.png'),
        1160, 540,
        genshin.width - 1170,
        genshin.height / 2
      );
      const xietiaoRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync('assets/Recognition/血条.png'),
        0, 0,
        genshin.width,
        Math.round(genshin.height / 5)
      );

      /* ========== 2. 搜索逻辑（与原流程一致） ========== */
      let a = 0;
        for (let j = 0; j < 3; j++) {
          const region = captureGameRegion();
          const found  = region.find(lampRo);
          const found2 = region.find(lampRo02);

          if (found && found.x !== 0 && found.y !== 0) {
            log.info(`[findLamp] 找到灯图标(模板1) @ (${found.x}, ${found.y})`);
            a++;
            await this.moveLampAndclick(found.x, found.y);
          }
          if (found2 && found2.x !== 0 && found2.y !== 0 && a === 0) {
            log.info(`[findLamp] 找到灯图标(模板2) @ (${found2.x}, ${found2.y})`);
            await this.moveLampAndclick(found2.x, found2.y);
          }
          await sleep(600);

          /* 血条子循环 */
          for (let k = 0; k < 64; k++) {
            await sleep(100);

            const ocrRes = Array.from(captureGameRegion().findMulti(RecognitionObject.ocr(900, 10, 100, 40)) || []);
            const found01 = ocrRes.some(r => r.text.includes('利亚姆'));
            if (found01) { log.info('[findLamp] 找到利亚姆'); return true; }

          }
        }
            await sleep(200);
            keyPress('r');
            await sleep(200);
            middleButtonClick();
            await sleep(1200);
            keyPress('r');
            await sleep(800);
      
      log.error('[findLamp] 未找到灯或血条');
      return false;
    },

    /**
     * 将灯光目标点 (lx, ly) 映射到鼠标移动脚本并左键射击
     */
    moveLampAndclick: async function(lx, ly) {
        const cx = 960, cy = 540;
        const dx = Math.round((lx - cx) / 2.223) - 176 - 36;
        const dy = Math.round((ly - cy) / 0.8)   - 60  - 109;

        const right1 = 'assets/Laim/鼠标右一.json';
        const down1  = 'assets/Laim/鼠标下一.json';

        log.info(`[moveLampAndclick] 计算偏移 → dx=${dx}, dy=${dy}`);

        for (let i = 0; i < Math.abs(dx); i++) await keyMouseScript.runFile(right1);
        for (let i = 0; i < Math.abs(dy); i++) await keyMouseScript.runFile(down1);

        await sleep(150);
        keyPress("VK_LBUTTON");
        await sleep(150);
        log.info("[moveLampAndclick] 射击完成");
    },

    /**
     * 根据地点名称执行预设的路线脚本（跑图路线）
     * @param {string} locationName - 地点名称（不含扩展名）
     * @returns {Promise<void>}
     */
    pathingfiy: async function(locationName) {
        log.info('[MobPuller] 前往路线: {name}', locationName);
        const filePath = `assets/pathing/Laim/${locationName}.json`;
        await pathingScript.RunFile(filePath);
    },

    /**
     * 执行键鼠录制脚本
     * @param {string} locationName - 键鼠脚本文件名（不含扩展名）
     * @param {boolean} [istp=true] - 是否先传送
     * @param {number} [x=253.3994140625] - 传送 X
     * @param {number} [y=1285.4423828125] - 传送 Y
     * @returns {Promise<void>}
     */
    captureCrystalfly: async function(locationName, istp = true, x = 253.3994140625, y = 1285.4423828125) {
        if (istp) {
            log.info('[MobPuller] 传送至: {name}', locationName);
            await genshin.tp(x, y);
            await sleep(1000);
        }
        log.info('[MobPuller] 开始键鼠脚本: {name}', locationName);
        const filePath = `assets/KeyMouseScript/${locationName}.json`;
        await keyMouseScript.runFile(filePath);
    },

    /**
     * 将灯光目标点 (lx, ly) 映射到鼠标移动脚本并左键射击
     * @param {number} lx - 目标 x
     * @param {number} ly - 目标 y
     * @returns {Promise<void>}
     */
    moveLampToCenter: async function(lx, ly) {
        const cx = 960, cy = 540;
        const dx = Math.round((lx - cx) / 2.4);
        const dy = Math.round((ly - cy) / 1.20);
        moveMouseBy(dx, 0);
        moveMouseBy(0, dy);
    },




};

