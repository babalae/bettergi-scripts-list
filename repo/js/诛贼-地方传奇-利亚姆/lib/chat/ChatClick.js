/**
 * ChatClick —— 对话+表情包发送
 */

// === 模块加载区域（顶层执行，BGI要求） ===
eval(file.readTextSync("lib/chat/ChatCore.js"));
eval(file.readTextSync("lib/Online/Multiplayer.js"));
var ChatClick = {

    // === 主执行入口 ===
    run: async function(isNewStart = false) {
        try {
            await sleep(66);
            await this.Dialog(isNewStart);
            
            // await this.sendEmoji(2, 2); // 发送第2种类的第6个表情包
        } catch (error) {
            log.error(`服务崩溃: ${error.message}`);
        }
    },

    /**
     * 发送表情包
     * @param {number} category - 表情包的种类（0到7）
     * @param {number} emojiIndex - 表情包的具体位置（1到15）
     */
    sendEmoji: async function(category, emojiIndex) {
        if (category < 0 || category > 7) {
            log.error('表情包种类超出范围（0到7）');
            return;
        }

        if (emojiIndex < 1 || emojiIndex > 15) {
            log.error('表情包具体位置超出范围（1到15）');
            return;
        }

        // 打开对话框
        await genshin.returnMainUi();
        await sleep(100);
        keyPress('VK_RETURN');
        await sleep(500);

        // 打开表情包界面
        click(910, 980);
        await sleep(360);

        // 选择表情包种类
        const categoryX = 425 + (category ) * 100; // 每个种类间隔100像素
        click(categoryX, 900);
        await sleep(360);

        // 选择具体表情包
        const row = Math.floor((emojiIndex - 1) / 5); // 行号
        const col = (emojiIndex - 1) % 5; // 列号
        const emojiX = 400 + col * 150; // 每列间隔150像素
        const emojiY = 400 + row * 200; // 每行间隔200像素
        click(emojiX, emojiY);
        await sleep(300);

        // 返回主界面
        await genshin.returnMainUi();
    },

    /**
     * 在大世界聊天框发送一句话
     * @param {string}  [say=' ']        要发送的文字
     */
    saySomething: async function(say = ' ') {


        await genshin.returnMainUi();
        await sleep(666);
        keyPress('VK_RETURN');
        await sleep(666);
        click(160, 140);          // 大世界队伍频道
        await sleep(666);
        keyPress('VK_RETURN');
        await sleep(666);

        inputText(say);

        await sleep(600);
        keyPress('VK_RETURN');
        await sleep(666);
        keyPress('VK_ESCAPE');
        await sleep(666);
        await genshin.returnMainUi();
    },

    /**
     * 根据传入的数字选择并执行一个 saySomething 调用
     * @param {number} num - 1到1000之间的数字
     */
    selectSaySomething: async function(num) {
        const messages = [
        '大佬，风雨里长大，有你的点滴爱意就成家。拜拜啦\\^o^/',
        '大佬，我们相遇时间碎片，都是爱的粼粼光点。拜拜 (●•ᴗ•●)❤',
        '大佬，我像被你宠爱的小孩，迷路也像一场旅行。现在要回去啦~',
        '大佬，岁月会褪去记忆，却褪不去我们的相遇！拜拜啦 (●•ᴗ•●)❤',
        '大佬，你是清风，是晚霞，是我的一抹的星光。拜拜啦(●•ᴗ•●)❤',
        '大佬，遇见是神奇的安排，这片刻也是联机的美好回忆，拜拜\\^o^/',
        '大佬，让我写张欠条，把你的烦恼都承包掉吧！拜拜啦(￣▽￣)',
        '大佬，你是冬燕与我，都想探访的整个春天，现在，飞走啦~~~',
        '大佬，你的爱，就值得这世间所有的温柔。谢谢，拜拜啦=￣ω￣=',
        '大佬，拥抱以松手告终，相遇也常以告别落幕，拜拜啦',
        '大佬，你是细嗅蔷薇的英雄，我是被宠爱的小朋友，再见(●•ᴗ•●)❤',
        '大佬，站在时间的枝头，我们不期而遇，谢谢，拜拜啦ヽ(・∀・)ﾉ',
        '大佬，你眼中的温柔，胜过我所见灵濛山川。谢谢，拜拜啦( • ω • )',
        '大佬，愿你被世界温柔以待，也自有光芒成为暖阳，拜拜啦=￣ω￣=',
        '大佬，我因你璀璨星河而停驻，又将奔赴远方山海，拜拜啦',
        '大佬，你一树花开，爱在花间吸引我如蜜蜂般徘徊，飞走啦~~~',
        '大佬，原神无聊如海，你是灯塔，也是港湾，谢谢，拜拜啦(づ￣ 3￣)づ',
        '大佬，离别匆匆，你的温柔却让日子变甜了些，谢谢，拜拜啦(●ˇ∀ˇ●)',
        '大佬，世界之大，你的温柔是心安归处，只是离别匆匆(●•ᴗ•●)❤'
        ];

        // 计算余数
        const index = (num - 1) % messages.length; // 确保索引从0开始

        // 调用 saySomething
        await this.saySomething(messages[index]);
    },

    /**
     * OCR 识别固定矩形区域（无关键词过滤，最快 200 ms 超时）
     * @param {{x:number, y:number, width:number, height:number}} rect  识别区域（像素）
     * @param {number} [timeout=200]  最长等待时间（毫秒，默认 200）
     * @returns {string}  识别到的全部文字（未识别到返回空字符串）
     */
    ocrFixedRect: async function(rect, timeout = 300) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const roi   = captureGameRegion();
                const ocrObj = RecognitionObject.ocr(rect.x, rect.y, rect.width, rect.height);
                const resList = Array.from(roi.findMulti(ocrObj) || []);
                const text = resList.map(r => r.text).join('');
                if (text.length) return text;
            } catch (e) {
                log.error(`[ocrFixedRect] ${e.message}`);
            }
            await sleep(50); // 短间隔快速重试
        }
        return '';
    },

    /**
     * 在游戏区域中查找模板图片并返回其中心点
     * @param {string} imgVar  模板图片变量名（需提前在函数外初始化）
     * @returns {{x:number, y:number}|null}  找到返回中心点坐标，未找到返回 null
     */
    findImageCenter: function(imgVar) {
        const region = captureGameRegion();
        const found  = region.find(imgVar);

        if (found && found.x !== 0 && found.y !== 0) {
            // 计算中心点
            const cx = found.x + imgVar.TemplateMat.cols / 2;
            const cy = found.y + imgVar.TemplateMat.rows / 2;
            log.info(`[findImageCenter] 找到 ${imgVar.Name || '图片'}，中心 (${cx}, ${cy})`);
            return { x: cx, y: cy };
        }
        return null;
    },

    /**
     * 获取联机世界当前玩家数
     * @param {boolean} [openF2IfFail=false]  若当前界面未识别到人数，是否再按 F2 重新识别一次
     * @returns {[number, number]}  [快速识别结果, 最终确认结果]（0 表示未识别到）
     */
getPlayerSign: async function(openF2IfFail = false) {
    const picDic = {
        "0P": "assets/0P.png",   // 单人
        "1P": "assets/1P.png",
        "2P": "assets/2P.png",
        "3P": "assets/3P.png",
        "4P": "assets/4P.png"
    };

    await genshin.returnMainUi();
    await sleep(500);

    // 0P~4P 全部一次性加载
    const [p0Ro, p1Ro, p2Ro, p3Ro, p4Ro] = [0, 1, 2, 3, 4].map(p =>
        RecognitionObject.TemplateMatch(
            file.ReadImageMatSync(picDic[`${p}P`]),
            344, 22, 45, 45
        )
    );

    moveMouseTo(1555, 860);
    const region = captureGameRegion();

    // 识别 0P~4P，返回第一个命中的编号（0~4）
    const a = [region.find(p0Ro),
               region.find(p1Ro),
               region.find(p2Ro),
               region.find(p3Ro),
               region.find(p4Ro)]
        .findIndex(r => r.isExist());

    region.dispose();

    // 二次识别逻辑保持不变
    if (openF2IfFail && a === 2) {
        keyPress('VK_F2');
        await sleep(700);
        click(1, 1);
        await sleep(500);
        const text = await this.ocrFixedRect({ x: 830, y: 90, width: 260, height: 40 }, 200);
        const m = text.match(/当前游戏进度内人数([0-4])\/4/);
        await genshin.returnMainUi();
        return [a, m ? Number(m[1]) : 0];
    }
    return [a, 0];
},

    /**
     * 检测最靠下对话框所属玩家（0P|2P|4P），0=未检测到{不打开！}
     * 逻辑不变：
     *  1. 先固定位置检测 dialogP0（零号素材）
     *  2. 若0号存在，直接返回0
     *  3. 若0号不存在，纵向扫描2P/4P，谁在最下返回谁
     * @returns {number} 0 | 2 | 4 | 0(都未检测到)
     */
    getLowerDialog: async function() {
        const picDic = {
            "0P": "assets/dialog01.png",
            "2P": "assets/dialog02.png",
            "4P": "assets/dialog04.png"
        };
        setGameMetrics(1920, 1080, 1.0);
        await genshin.returnMainUi(); 
        await sleep(200);

        // 0️⃣ 固定位置检 dialogP0（33×26  @ 47,870）
        const mat0 = file.ReadImageMatSync(picDic["0P"]);
        const roi0 = RecognitionObject.TemplateMatch(mat0, 33, 1020, 53, 36);
        if (captureGameRegion().Find(roi0).isExist()) {
            log.info('对话框未更新');
            await genshin.returnMainUi();
            return 0;
        }

        // 1️⃣ 共用竖带 30-80（50宽） 880-1025
        const stepY   = 8;
        const iconH   = 17;
        const maxY    = 1025;
        const stripX  = 30;
        const stripW  = 50;
        let best      = { player: 0, y: -1, x: -1 };

        // 先扫2P
        const mat2 = file.ReadImageMatSync(picDic["2P"]);
        for (let y = 880; y <= maxY - iconH; y += stepY) {
            const roi = RecognitionObject.TemplateMatch(mat2, stripX, y, stripW, maxY - y);
            const f   = captureGameRegion().Find(roi);
            if (f.isExist() && f.y > best.y) best = {player: 2, y: f.y, x: f.x};
        }

        // 再扫4P
        const mat4 = file.ReadImageMatSync(picDic["4P"]);
        for (let y = 880; y <= maxY - iconH; y += stepY) {
            const roi = RecognitionObject.TemplateMatch(mat4, stripX, y, stripW, maxY - y);
            const f   = captureGameRegion().Find(roi);
            if (f.isExist() && f.y > best.y) best = {player: 4, y: f.y, x: f.x};
        }

        // 最终结果日志
        if (best.player === 0) {
            log.info('未检测到2P/4P对话框');
        } else {
            log.info(`最下方对话框玩家=${best.player}P  坐标(${best.x}, ${best.y})`);
        }
        return best.player;
    },

    /**
     * 返回最靠下的！打开！的对话框所属玩家
     * @returns {number} 1 | 2 | 0
     */
    getLowerDialogPlayer: async function() {
        const picDic = { "1P": "assets/dialogP1.png", "2P": "assets/dialogP2.png" };
        setGameMetrics(1920, 1080, 1.0);
        await genshin.returnMainUi(); await sleep(300);
        keyPress('VK_RETURN'); await sleep(200); moveMouseTo(1, 1);

        const stepY = 8;
        let best = { player: 0, y: -1 };

        for (const {id, x} of [{id:1, x:414}, {id:2, x:955}]) {
            const mat = file.ReadImageMatSync(picDic[`${id}P`]);
            for (let y = 0; y <= 1080 - 15; y += stepY) {
                const roi   = RecognitionObject.TemplateMatch(mat, x, y, 33, 1080 - y);
                const found = captureGameRegion().Find(roi);
                if (found.isExist() && found.y > best.y) best = {player: id, y: found.y};
            }
        }
        log.info('对话框位置：' + best.y);
        await genshin.returnMainUi();
        return best.player;
    },

    /**
     * 返回最靠下的！打开的对话框所属玩家（已修复越界 + 强制 1080p 坐标系）
     * 扩展：返回数组
     *   [0] 玩家编号 0|1|2
     *   [1] 当且仅当玩家==1 时，返回指定区域的 OCR 文本；否则为返回2P上面的 OCR 文本
     */
    getLowerPlayerText: async function() {
        const picDic = { "1P": "assets/dialogP1.png", "2P": "assets/dialogP2.png" };
        setGameMetrics(1920, 1080, 1.0);
        await genshin.returnMainUi(); await sleep(300);
        keyPress('VK_RETURN'); await sleep(200); moveMouseTo(1, 1);

        const stepY = 8;
        let best = { player: 0, y: -1 };

        for (const {id, x} of [{id:1, x:414}, {id:2, x:955}]) {
            const mat = file.ReadImageMatSync(picDic[`${id}P`]);
            for (let y = 0; y <= 1080 - 15; y += stepY) {
                const roi   = RecognitionObject.TemplateMatch(mat, x, y, 33, 1080 - y);
                const found = captureGameRegion().Find(roi);
                if (found.isExist() && found.y > best.y) best = {player: id, y: found.y};
            }
        }
        log.info('对话框位置：' + best.y);
        log.info('对话框玩家：' + best.player);

        // 动态OCR：仅1P或2P有效
        let ocrText = "";
        if (best.player === 1) {
            // 1P 的 OCR 区域
            const top    = best.y + 42;          // 文字开始比气泡低37像素
            const ocrRect = {
                x: 420,
                y: top,
                width: 620,
                height: 50
            };
            ocrText = await this.ocrFixedRect(ocrRect, 600);
            log.info(`1P：${ocrText}`);
        } else if (best.player === 2) {
            // 2P 的 OCR 区域，起点比检测位置高 76 像素
            const top    = best.y - 76 ;     // 文字开始比检测位置高 76 像素
            const ocrRect = {
                x: 420,
                y: top,
                width: 620,
                height: 50
            };
            ocrText = await this.ocrFixedRect(ocrRect, 600);
            log.info(`1P：${ocrText}`);
        }
        await genshin.returnMainUi();

        return [best.player, ocrText];
    },

    /**
     * 处理 getLowerPlayerText 返回结果
     * @param {Array} res  [0:玩家编号, 1:OCR文本]
     * @returns {number|Array}  0=相同, 1=不同且返回识别内容
     */
    checkDialogP1Text: async function(res) {
        const path = 'data/dialogP1.txt';

        // 读取文件内容
        let data = '';
        try {
            data = file.readTextSync(path).trim();
        } catch (error) {
            log.error(`读取文件 ${path} 时出错: ${error.message}`);
            return 0;
        }

        const lines = data.split(/\r?\n/);
        const last = lines.pop() || ''; // 如果文件为空，返回空字符串

        // 检查是否相同
        if (last === res[1]) {
            log.info(`检测到相同的文本内容：${res[1]}`);
            return 0;
        }

        // 不同：追加新行
        try {
            file.WriteTextSync(path, '\n' + res[1], true); // 追加模式
            log.info(`追加新行到文件 ${path}: ${res[1]}`);
        } catch (error) {
            log.error(`写入文件 ${path} 时出错: ${error.message}`);
            return 0;
        }

        return [1, res[1]];
    },

/**
 * 处理 checkDialogP1Text 的返回值
 * @param {number|Array} result - checkDialogP1Text 的返回值
 * @returns {number} - 如果有文本内容，返回 1~4；如果没有文本内容，返回 0
 */
processDialogText: async function(result, speak = true, isNewStart = false) {
    if (result === 0) {
        // 没有新对话或文本内容
        return 0;
    }
    
    // 如果有文本内容，调用新的函数框架处理文本
    const [status, text] = result;
    if (status === 1 && text && speak) {
        // 调用新的函数框架处理文本
        var result1 = ChatCore.chatWithHistory(text, isNewStart);
        
        // 检查是否有重复回复
        if (result1.isReplyDuplicate) {
            log.info(`检测到重复回复: "${result1.reply}"，跳过发送`);
            // 可以选择发送一个默认表情，或者什么都不做
            await this.sendEmoji(5, 3); // 发送表情
            return 0;
        }
        
        log.info(`回复: ${result1.reply}`);
        log.info(`对话是否重复: ${result1.isDuplicate}`);
        log.info(`是否回复重复: ${result1.isReplyDuplicate}`);
        log.info(`表情: ${result1.emojiName}`);
        log.info(`表情位置: ${result1.position}`);
        
        await this.saySomething(result1.reply);
        const [cat, idx] = result1.position;   // 可以默认cat=2, idx=2
        await this.sendEmoji(cat, idx);
        
        // 如果需要根据结果返回不同的值，可以在这里添加逻辑
        // 例如：return result1.isReplyDuplicate ? 0 : 1;
    }
    
    return 0;
},
    /**
     * 处理 dialogP1.txt 文件的内容
     * - 将 dialogP1.txt 的所有内容续写到 ALLP1.txt 文件的后面
     * - 清空 dialogP1.txt 文件的内容
     */
    processDialogP1File: async function() {
        const dialogPath = 'data/dialogP1.txt';
        const allPath = 'data/ALLP1.txt';

        try {
            // 1. 读取 dialogP1.txt 文件的所有内容
            const dialogContent = file.readTextSync(dialogPath).trim();

            if (dialogContent) {
                // 2. 将内容续写到 ALLP1.txt 文件的后面，并在最后打上时间戳
                const timestamp = new Date().toLocaleString();
                const allContent = `${dialogContent}\n${timestamp}\n—————\n`;
                file.WriteTextSync(allPath, allContent, true); // 追加模式

                // 3. 清空 dialogP1.txt 文件的内容
                file.WriteTextSync(dialogPath, '', false); // 覆盖模式
            } else {
                log.info('dialogP1.txt 文件为空，发表情');
                await this.sendEmoji(5, 3); // 发送第2种类的第2个表情包
            }
        } catch (error) {
            log.error(`处理文件时出错: ${error.message}`);
        }
    },

    /**
     * 循环运行对话框检测和处理逻辑
     */
    Dialog: async function(isNewStart = false) {  
        const player0 = await Multiplayer.detectPlayerCount();
        log.info(`多人结果：${player0.count}`);
        if (player0.count === 0) {            return 0;        }  
        if(isNewStart){
            // 重置历史记录，确保测试环境干净
            ChatCore.conversationHistory = [];
            ChatCore.log("已清空历史记录");
        }
        // 1. 获取最下方的对话框信息
        const who = await this.getLowerPlayerText();
        const speak = who[0];
        log.info(`多人对话结果：${speak}`);
        if (speak === 2 || speak === 0) {            return 0;        }  

        // 2. 检查对话框文本内容
        const result = await this.checkDialogP1Text(who);

        // 3. 处理对话框文本内容
        const finalResult = await this.processDialogText(result, true, isNewStart);
        log.info(`结果：${finalResult}`);

        // 4. 处理 dialogP1.txt 文件
        await this.processDialogP1File();

        // 等待
        await sleep(500);
    },

};