
eval(file.readTextSync('lib/Laim/lib/core.js'));


var Core = {


    /* ------------------------------------------------------
     * 仅执行单次流程（单人）
     * ------------------------------------------------------ */
    executeSingleProcess: async function () {
        try {
            
            await genshin.switchParty(settings.partyName);
            
            
            keyPress('1');
            await genshin.returnMainUi();

            await core.executeMainProcess();  

            keyPress('Space');
            
            // 4. 检测复活
            const iconFiles = 'assets/ui/a.png';//可能是
            const tplMat = RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconFiles), 0, 0, 1920, 1080);
            const joinResult = captureGameRegion().find(tplMat);
            if (joinResult.isExist()) {
                joinResult.click();
                await sleep(8888);
            }
            const iconFiles1 = 'assets/ui/确认.png';//单人
            const tplMat1 = RecognitionObject.TemplateMatch(file.ReadImageMatSync(iconFiles1), 0, 0, 1920, 1080);
            const joinResult1 = captureGameRegion().find(tplMat1);
            if (joinResult1.isExist()) {
                joinResult1.click();
                await sleep(8888);
            }
            
            return { ok: true, reason: '单人流程完成' };
            
        } catch (e) {
            log.error(`[Core] 单次流程异常：${e.message}`);
            return { ok: false, reason: `异常: ${e.message}` };
        }
    },


};