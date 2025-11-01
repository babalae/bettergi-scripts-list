(async function () { // 掉队识别(聊天框增加超时检测，超时后检测玩家数，如果少人则更换策略)，队长模式启动时检测到多人模式应当先退出多人模式[待定]，加世界自动识别P几[实现]，uid加世界[实现]，核对JS版号[实现]，每个传送点同步[待定]，超时检测(等太久了就都跳到进度最新的传送点)，每个传送点规定时间完全同步，按照传送切分路径、方法：回到(退出到)单人模式和退出检测、领队的实际逻辑为实现
    // const pathingList = file.readPathSync("assets/pathing");
    const nameDic = {
        "1P": "一号",
        "2P": "二号",
        "3P": "三号",
        "4P": "四号"
    }
    const picDic = {
        "1P": "assets/others/1P.png",
        "2P": "assets/others/2P.png",
        "3P": "assets/others/3P.png",
        "4P": "assets/others/4P.png"
    }
    let settingDic = {
        "mode": undefined,
        "player_id": undefined,
        "player_all": undefined,
        "match_identity": undefined,
        "match_detail": undefined,
        "match_mode": undefined,
        "path_folder": undefined
    };

    /**
     *
     * 检查并读取JS脚本配置
     *
     * @returns {Promise<boolean>}
     */
    async function dealSettings() {
        let mode = typeof(settings.mode) === "undefined" ? false : settings.mode;
        if (mode === false) {
            log.warn(`JS脚本配置错误: 选择加入世界的方式`);
        } else if (mode === "手动加世界") {
            settingDic["mode"] = mode;
            let player_id = typeof(settings.player_id) === "undefined" ? false : settings.player_id;
            let player_all = typeof(settings.player_all) === "undefined" ? false : settings.player_all;
            if (player_id === false || player_all === false) {
                log.warn(`JS脚本配置错误: 手动加世界`);
            } else {
                settingDic["player_id"] = player_id;
                settingDic["player_all"] = player_all;
                let pathFolder = typeof(settings.path_folder) === "undefined" ? false : settings.path_folder;
                if (pathFolder === false) {
                    log.warn(`JS脚本配置错误: 路径设置`);
                } else {
                    settingDic["path_folder"] = pathFolder;
                    return true;
                }
            }
        } else if (mode === "自动加世界") {
            settingDic["mode"] = mode;
            let match_identity = typeof(settings.match_identity) === "undefined" ? false : settings.match_identity;
            if (match_identity === false) {
                log.warn(`JS脚本配置错误: 请挑选你的身份`);
            } else {
                if (match_identity.startsWith("作为领队")) { // 领队
                    settingDic["match_identity"] = "领队";
                    let match_detail = typeof(settings.match_detail) === "undefined" ? false : settings.match_detail;
                    if (match_detail === false) {
                        log.warn(`JS脚本配置错误: 自动加世界`); // 该选项无具体文本-位于 自动加世界
                    } else {
                        settingDic["match_detail"] = match_detail.split(" "); // 玩家名
                        settingDic["match_mode"] = typeof(settings.match_mode) === "undefined" ? "全字匹配" : "部分匹配";
                        pathingFolder = typeof(settings.path_folder) === "undefined" ? false : settings.path_folder;
                        if (pathingFolder === false) {
                            log.warn(`JS脚本配置错误: 路径设置`);
                        } else {
                            settingDic["path_folder"] = pathingFolder;
                        }
                        return true;
                    }
                } else if (match_identity.startsWith("作为队员")) { // 队员
                    settingDic["match_identity"] = "队员";
                    let match_detail = typeof(settings.match_detail) === "undefined" ? false : settings.match_detail;
                    if (match_detail === false) {
                        log.warn(`JS脚本配置错误: 自动加世界`); // 该选项无具体文本-位于 自动加世界
                    } else {
                        settingDic["match_detail"] = match_detail; // uid
                        settingDic["match_mode"] = typeof(settings.match_mode) === "undefined" ? "全字匹配" : "部分匹配";
                        pathingFolder = typeof(settings.path_folder) === "undefined" ? false : settings.path_folder;
                        if (pathingFolder === false) {
                            log.warn(`JS脚本配置错误: 路径设置`);
                        } else {
                            settingDic["path_folder"] = pathingFolder;
                        }
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     *
     * 在联机状态下的聊天框发送信息
     *
     * @param msg 发送的信息
     * @returns {Promise<boolean>}
     */
    async function sendMessage(msg) {
        await genshin.returnMainUi(); // 保证在主界面
        await sleep(500);
        await keyPress("VK_RETURN"); // 按Enter进入聊天界面
        await sleep(500);
        const ocrRo = RecognitionObject.Ocr(0, 0, 257, 173);
        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
        await sleep(300);
        let ro = captureGameRegion();
        let ocr = ro.Find(ocrRo); // 当前页面OCR
        ro.dispose();
        for (let i = 0; i < 3; i++) {
            if (ocr.isExist() && ocr.text === "当前队伍") {
                ocr.Click(); // 点击 当前队伍
                await sleep(500);
                click(445, 1010); // 点击聊天框
                await sleep(200);
                inputText(msg); // 输入文本
                keyPress("VK_RETURN"); // 发送
                await sleep(200);
                await genshin.returnMainUi(); // 返回主界面
                return true;
            } else {
                log.error(`未检测到 当前队伍 ，可能不处于联机状态 ${i + 1}/3`);
                await sleep(200); // 等待0.5s
                return false;
            }
        }
        log.error(`未检测到 当前队伍 ,尝试发送信息...`);
        click(445, 1010); // 点击聊天框
        await sleep(200);
        inputText(msg); // 输入文本
        keyPress("VK_RETURN"); // 发送
        await sleep(200);
        await genshin.returnMainUi(); // 返回主界面
        return false;
    }

    /**
     *
     * 生成任务标识
     *
     * @param num 数字
     * @returns {string} 根据数字生成的汉字标识
     */
    async function numberToChinese(num) {
        // 定义数字到中文的映射
        // const chineseDigits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
        const chineseDigits = ['癸', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬'];
        // 将数字转换为字符串，以便逐个处理
        const numStr = num.toString();
        let result = '';

        for (let i = 0; i < numStr.length; i++) {
            const digit = parseInt(numStr[i], 10);
            // 获取对应的中文数字
            result += chineseDigits[digit];
        }

        return result;
    }

    /**
     * 计算 SHA-256 哈希（完全纯计算实现）并返回 8 位数字字符串。
     * 参考了原先的 Python 实现。
     *
     * @param {string | number[]} data - 输入数据，可以是字符串（采用 UTF-8 编码）或者字节数组（各元素 0~255）。
     * @returns {string} 返回一个 8 位数字字符串（不足 8 位时左侧补零）。
     */
    function sha256To8(data) {
        // --- 辅助函数部分 ---

        // 将字符串转换为 UTF-8 编码的字节数组
        function stringToBytes(str) {
            var bytes = [];
            for (var i = 0; i < str.length; i++) {
                var code = str.charCodeAt(i);
                if (code < 0x80) {
                    bytes.push(code);
                } else if (code < 0x800) {
                    bytes.push(0xc0 | (code >> 6));
                    bytes.push(0x80 | (code & 0x3f));
                } else {
                    bytes.push(0xe0 | (code >> 12));
                    bytes.push(0x80 | ((code >> 6) & 0x3f));
                    bytes.push(0x80 | (code & 0x3f));
                }
            }
            return bytes;
        }

        // 右旋操作（32位无符号数）
        function rotr(x, n) {
            return ((x >>> n) | (x << (32 - n))) >>> 0;
        }

        // --- 数据预处理 ---

        // 如果数据为字符串，则转换为字节数组；否则假设 data 已是数组形式
        var bytes;
        if (typeof data === "string") {
            bytes = stringToBytes(data);
        } else {
            // 此处要求 data 为一个数组形式，复制一份
            bytes = data.slice();
        }

        // 保存原始数据长度（单位：比特数）
        var bitLen = bytes.length * 8;

        // 按照 SHA-256 规范先附加一个 0x80 字节
        bytes.push(0x80);

        // 然后填充 0，直到消息长度（字节数）模 64 等于 56
        while ((bytes.length % 64) !== 56) {
            bytes.push(0);
        }

        // 最后附加原始数据长度的 8 字节大端表示
        for (var i = 7; i >= 0; i--) {
            bytes.push((bitLen >>> (i * 8)) & 0xff);
        }

        // --- 初始化常量 ---
        var k = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
            0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
            0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
            0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        var h0 = 0x6a09e667;
        var h1 = 0xbb67ae85;
        var h2 = 0x3c6ef372;
        var h3 = 0xa54ff53a;
        var h4 = 0x510e527f;
        var h5 = 0x9b05688c;
        var h6 = 0x1f83d9ab;
        var h7 = 0x5be0cd19;

        // --- 主循环：分块处理 ---
        for (var chunk = 0; chunk < bytes.length; chunk += 64) {
            var w = new Array(64);
            // 将 64 字节拆分成 16 个 32 位大端字
            for (var i = 0; i < 16; i++) {
                var j = chunk + i * 4;
                w[i] = ((bytes[j] << 24) | (bytes[j+1] << 16) | (bytes[j+2] << 8) | bytes[j+3]) >>> 0;
            }
            // 扩展消息
            for (var i = 16; i < 64; i++) {
                var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
            }

            // 初始化工作变量为当前哈希值
            var a = h0;
            var b = h1;
            var c = h2;
            var d = h3;
            var e = h4;
            var f = h5;
            var g = h6;
            var hh = h7;

            // 主压缩循环
            for (var i = 0; i < 64; i++) {
                var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                var ch = (e & f) ^ ((~e) & g);
                var temp1 = (hh + S1 + ch + k[i] + w[i]) >>> 0;
                var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                var maj = (a & b) ^ (a & c) ^ (b & c);
                var temp2 = (S0 + maj) >>> 0;

                hh = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }

            // 更新哈希值
            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
            h5 = (h5 + f) >>> 0;
            h6 = (h6 + g) >>> 0;
            h7 = (h7 + hh) >>> 0;
        }

        // --- 生成最终结果 ---
        // 这里取 h0 作为哈希结果的前 32 位数字，并对 100,000,000 取模，
        // 保证结果范围在 0 ~ 99,999,999 之间，再手工左侧补零至 8 位字符串格式

        var num = h0 >>> 0;
        num = num % 100000000;

        // 将数字转换为字符串，并手工左侧补零
        var numStr = "";
        // 这里采用逐位构造补零字符串
        var temp = num;
        do {
            numStr = (temp % 10).toString() + numStr;
            temp = Math.floor(temp / 10);
        } while (temp > 0);
        while (numStr.length < 8) {
            numStr = "0" + numStr;
        }

        return numStr;
    }

    /**
     * 异步计算指定文件夹中所有 JSON 文件内容的 SHA-256 哈希值（返回8位数字字符串）(附带JS版号)。
     *
     * 该方法执行步骤如下：
     * 1. 调用 file.readPathSync() 读取指定文件夹下所有文件和文件夹的路径（非递归）。
     * 2. 使用 Array.from() 将返回值转换为标准数组。
     * 3. 过滤出所有非文件夹且文件名以 ".json" 结尾的路径。
     * 4. 将这些 JSON 文件内容读取后合并成一个总体字符串。
     * 5. 调用自定义的 sha256To8() 方法生成并返回 8 位数字的哈希值。
     * 6. 如果没有符合条件的 JSON 文件，返回 "00000000"。
     *
     * @param {string} path - 文件夹路径（相对于根目录）。
     * @returns {Promise<string>} 返回一个 Promise，其解析结果为8位数字格式的哈希值字符串。
     */
    async function getSha256FromPath(path) {
        // 读取指定路径下所有文件和文件夹的路径（非递归）
        let allPaths = file.readPathSync(path);

        // 将返回值转换为标准数组，以确保可以使用 filter 方法
        allPaths = Array.from(allPaths);

        // 过滤出所有非文件夹且以 ".json" 结尾的文件路径
        const jsonPaths = allPaths.filter(p => !file.isFolder(p) && p.endsWith(".json"));

        // 读取manifest.json
        const manifest = file.readTextSync("manifest.json");

        // 读取main.js
        const js_main = file.readTextSync("main.js").replace(/(async\sfunction\sgetSha256FromPath)([\s\S]+)(return "00000000";)([\S\s]{18})/, "");

        // 如果有符合条件的文件，读取并合并文件内容后计算哈希
        if (jsonPaths.length > 0) {
            const combinedContent = jsonPaths
                .map(p => file.readTextSync(p))
                .join('');
            return sha256To8(manifest + js_main + combinedContent);
        } else {
            // 如果没有符合条件的文件，则返回 "00000000"
            return "00000000";
        }
    }

    /**
     *
     * 验证当前所选文件夹下所有路径文件的哈希值是否与其他玩家一致(附带JS版号)
     *
     * @param pathDir 路径文件夹路径
     * @param mode 领队 队员
     * @param sendSignal 是否发送队长信号
     * @returns {Promise<boolean>}
     */
    async function verifyPlayerPath(pathDir, mode="领队", sendSignal=false) {
        const ocrMsgRo = RecognitionObject.Ocr(293, 80, 873, 868); // 聊天框
        let playerNum;
        if (mode === "领队") {
            playerNum = parseInt(settingDic["player_all"], 10);
        }
        let verifyDic = {};
        await sleep(200); // 延时等待
        const verifyString = await numberToChinese(await getSha256FromPath(pathDir)); // 计算8位验证值并转换为中文字符串
        await sendMessage(`${nameDic[settingDic["player_id"]]}验证${verifyString}`);
        await sleep(500);
        keyPress("VK_RETURN"); // 进入聊天界面
        await sleep(500);
        while (true) { // 注意死循环
            moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
            await sleep(200);
            const ro = captureGameRegion();
            let ocrList = ro.FindMulti(ocrMsgRo); // 当前页面OCR
            ro.dispose();
            if (mode === "领队") {
                if (Object.keys(verifyDic).length != playerNum) {
                    for (let j = 1; j < playerNum + 1; j++) {
                        let playerP = `${j.toString()}P`;
                        if (!Object.keys(verifyDic).includes(playerP)) {
                            verifyDic[playerP] = false;
                        }
                    }
                }
                for (let i = 0; i < ocrList.count; i++) {
                    for (let j = 1; j < playerNum + 1; j++) {
                        let playerP = `${j.toString()}P`;
                        if (verifyDic[playerP] == true) {
                            continue;
                        }
                        if (ocrList[i].text.includes(`${nameDic[playerP]}验证`)) {
                            let tempString = ocrList[i].text.split("验证")[1]; // 可能的报错(indexError)
                            if (tempString === verifyString){
                                verifyDic[playerP] = true;
                                log.info(`${playerP}校验通过`);
                            } else {
                                log.error(`${playerP}校验失败: ${ocrList[i].text}`);
                                if (sendSignal) { // 队长发布检验完成信息
                                    await sendMessage(`校验失败`);
                                }
                                return false
                            }
                        }
                    }
                    if (Object.values(verifyDic).every(value => value === true)) { // 全部验证通过
                        if (sendSignal) { // 队长发布检验完成信息
                            await sendMessage(`校验完成`);
                        }
                        await sleep(300);
                        return true;
                    };
                }
            } else { // 队员
                for (let i = 0; i < ocrList.count; i++) {
                    if (ocrList[i].text.includes("校验完成")) {
                        log.info(`检测到队长的校验完成信号`)
                        return true;
                    } else if (ocrList[i].text.includes("校验失败")) {
                        log.error(`检测到队长的校验失败信号`)
                        return false;
                    }
                }
            }
        }
    }

    /**
     *
     * 更新settings的路径文件夹
     *
     * @returns {Promise<void>}
     */
    async function dealSettingsFolder() {
        let settingsJson = JSON.parse(file.readTextSync("settings.json"));
        let pathingFiles = file.readPathSync("assets/pathing");
        let pathFolder = [];
        for (let i = 0; i < pathingFiles.length; i++) {
            if (file.isFolder(pathingFiles[i])) {
                pathFolder.push(pathingFiles[i].replace(/assets\\pathing\\/, ''));
                log.info(`识别到路径文件夹: ${pathingFiles[i]}`);
            }
        }
        if (pathFolder.length == 0) {
            log.error("请在assets/pathing文件夹手动添加路径文件夹后重新运行...");
            settingsJson[6]["options"] = [];
            file.writeTextSync("settings.json", JSON.stringify(settingsJson, null, 2)); // 覆写settings
            return false;
        } else if (pathFolder.join("") === settingsJson[6]["options"].join("")) { // 内容一样
            return true;
        } else {
            settingsJson[6]["options"] = [];
            for (let j = 0; j < pathFolder.length; j++) {
                settingsJson[6]["options"].push(pathFolder[j]);
            }
            file.writeTextSync("settings.json", JSON.stringify(settingsJson, null, 2)); // 覆写settings
            log.info("JS脚本配置已更新，请重新选择路径...");
            return false;
        }
    }

    /**
     *
     * 获取联机世界的当前玩家标识
     *
     * @returns {Promise<boolean|string>}
     */
    async function getPlayerSign() {
        await genshin.returnMainUi();
        await sleep(500);
        const p1Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["1P"]), 344, 22, 45, 45);
        const p2Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["2P"]), 344, 22, 45, 45);
        const p3Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["3P"]), 344, 22, 45, 45);
        const p4Ro = RecognitionObject.TemplateMatch(file.ReadImageMatSync(picDic["4P"]), 344, 22, 45, 45);
        moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
        const gameRegion = captureGameRegion();
        await sleep(200);
        // 当前页面模板匹配
        let p1 = gameRegion.Find(p1Ro);
        let p2 = gameRegion.Find(p2Ro);
        let p3 = gameRegion.Find(p3Ro);
        let p4 = gameRegion.Find(p4Ro);
        gameRegion.dispose();
        if (p1.isExist()) return "1P";
        if (p2.isExist()) return "2P";
        if (p3.isExist()) return "3P";
        if (p4.isExist()) return "4P";
        return false;
    }

    /**
     *
     * 循环等待并点进联机申请界面
     *
     * @param timeOut 超时时间(应大于等于100)
     * @returns {Promise<void>}
     */
    async function enterMultiUi(timeOut = 30000) {
        const ocrRo = RecognitionObject.Ocr(923, 72, 45, 23);
        moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
        let ocr = captureGameRegion().Find(ocrRo);
        log.info(`开始检测进入世界申请弹窗, 超时时长: ${timeOut}ms`);
        for (let i = 0; i < Math.floor(timeOut / 100); i++) {
            if (ocr.isExist() && ocr.text === "世界") {
                log.info(`检测到弹窗！`);
                keyPress("Y");
                await sleep(300); // 弹窗打开的时间
                return true;
            } else {
                ocr = captureGameRegion().Find(ocrRo);
                await sleep(100);
            }
        }
        return false;
    }

    /**
     *
     * 在联机申请界面处理玩家的进入世界请求(循环检测)
     *
     * @param playerList 放行的玩家列表
     * @param timeOut 检测的超时时长
     * @param mode 玩家名匹配模式(exact完全匹配，feature部分匹配)
     * @returns {Promise<void>}
     */
    async function dealPlayerRequest(playerList, timeOut=30000, mode="exact") {
        const ocrTitleRo = RecognitionObject.Ocr(874, 236, 171, 33);
        const ocrTextRo = RecognitionObject.Ocr(507, 285, 907, 484);
        let ro1 = captureGameRegion();
        let ocrTitle = ro1.Find(ocrTitleRo);
        let ro2 = captureGameRegion();
        let ocrText = ro2.FindMulti(ocrTextRo);
        ro1.dispose();
        ro2.dispose();
        let count = 0;
        await sleep(1000);
        let ro3 = captureGameRegion();
        ocrTitle = ro3.Find(ocrTitleRo);
        ro3.dispose();
        if (!(ocrTitle.isExist() && ocrTitle.text === "多人游戏申请")) {
            log.error(`未处于 多人游戏申请 界面...`);
            return false;
        }
        log.info(`开始验证进入世界申请, 超时时长: ${timeOut}ms`);
        for (let i = 0; i < Math.floor(timeOut / 100); i++) {
            for (let j = 0; j < ocrText.count; j++) { // 迭代ocr数组
                log.info(`${ocrText[j].text}`);
                if (mode === "exact") {
                    for (let k = 0; k < playerList.length; k++) {
                        if (playerList[k] === ocrText[j].text) {
                            let x = ocrText[j].x + 642;
                            let y = ocrText[j].y + ocrText[j].height; // 尽可能点中间
                            log.info(`检测到玩家: ${playerList[k]}，验证通过(exact)...`);
                            count++;
                            click(x, y); // 点击通过申请
                            await sleep(100);
                            break;
                        }
                    }
                } else if (mode === "feature") {
                    for (let k = 0; k < playerList.length; k++) {
                        if (ocrText[j].text.includes(playerList[k])) {
                            let x = ocrText[j].x + 642;
                            let y = ocrText[j].y + ocrText[j].height; // 尽可能点中间
                            log.info(`检测到玩家: ${playerList[k]}，验证通过(exact)...`);
                            count++;
                            click(x, y); // 点击通过申请
                            await sleep(100);
                            break;
                        }
                    }
                }
                if (count >= playerList.length) {
                    keyPress("ESCAPE");
                    await sleep(5000); // 单人模式进入多人模式的耗时
                    return true;
                };
            }
            await sleep(100);
            const ro4 = captureGameRegion();
            ocrText = ro4.FindMulti(ocrTextRo);
            ro4.dispose();
        }
        return false;
    }

    /**
     *
     * 输入玩家UID加入房主
     *
     * @param playerUid 房主UID
     * @returns {Promise<void>}
     */
    async function sendMultiRequest(playerUid) {
        const ocrMultiRo = RecognitionObject.Ocr(141, 34, 102, 27);
        const ocrJoinRo =  RecognitionObject.Ocr(1561, 223, 119, 34);
        await genshin.returnMainUi();
        await sleep(100);
        keyPress("F2");
        await sleep(200);
        moveMouseTo(1555, 860); // 移走鼠标，防止干扰识别
        for (let i = 0; i < 3; i++) {
            await sleep(200);
            const ro5 = captureGameRegion();
            let ocrMulti = ro5.Find(ocrMultiRo);
            ro5.dispose();
            if (ocrMulti.isExist() && ocrMulti.text === "多人游戏") {
                break;
            }
        }
        click(260, 115); // 点击搜索框
        await sleep(100);
        inputText(playerUid);
        await sleep(200);
        for (let i = 0; i < 10; i++) { // 防止队长未及时通过，此处待改进
            log.info(`尝试加入房主(${playerUid})世界[${i + 1}/10]`);
            click(1681, 115); // 搜索
            await sleep(200);
            const ro6 = captureGameRegion();
            let ocrJoin = ro6.Find(ocrJoinRo);
            ro6.dispose();
            if (ocrJoin.isExist() && ocrJoin.text === "申请加入") {
                ocrJoin.Click();
                await sleep(10000);
                const ro7 = captureGameRegion();
                ocrJoin = ro7.Find(ocrJoinRo);
                ro7.dispose();
                if (!(ocrJoin.isExist() && ocrJoin.text === "申请加入")) return true;
            }
            await sleep(8000);
        }
        log.info(`未能加入房主(${playerUid})世界...`);
        return false;
    }

    async function main() {
        if (!(await dealSettingsFolder())) { // 检查路径文件夹
            return null;
        }
        if (!(await dealSettings())) { // 读取JS脚本配置
            return null;
        }
        let choicePath = `assets/pathing/${settingDic["path_folder"]}`;
        const pathingList = file.readPathSync(choicePath);
        // 以下根据加世界模式存在差异(首先确保所有玩家加入了世界[自动模式])
        if (settingDic["mode"] === "手动加世界") { // 运行前确保玩家全部加入了世界
            if (!(await verifyPlayerPath(choicePath, "领队"))) { // 验证路径一致性
                log.error("路径校验未通过...");
                return null;
            }
            for (let i = 0; i < pathingList.length; i++) {
                log.info(`当前路线标识(${i})${pathingList[i]}`);
                let pathDic = JSON.parse(file.readTextSync(pathingList[i]));
                for (let j = 0; j < pathDic["positions"].length; j++) {
                    if (pathDic["positions"][j]["id"] === 1) {
                        for (let i = 0; i < 3; i++) {
                            await genshin.tp(pathDic["positions"][j]["x"].toString(), pathDic["positions"][j]["y"].toString()); // 传送到第一个点位
                            await genshin.returnMainUi();
                            await sleep(200);
                            let pos = await genshin.getPositionFromMap();
                            if (pathDic["positions"][j]["x"] - 15 < pos.X && pos.X < pathDic["positions"][j]["x"] + 15 && pathDic["positions"][j]["y"] - 15 < pos.Y && pos.y < pathDic["positions"][j]["y"] + 15) {
                                log.info(`传送点范围坐标正确`);
                                break; // 确保在大地图上的位置正确再发送就位消息
                            }
                            await sleep(200);
                        }
                        // 删去第一个传送点位，避免再次传送
                        pathDic["positions"].splice(j, 1);
                        // 发消息
                        await sendMessage(`${nameDic[settingDic["player_id"]]}已就位${await numberToChinese(i)}`);
                        // 打开聊天框等待继续
                        keyPress("VK_RETURN"); // 按Enter进入聊天界面
                        await sleep(500);
                        const ocrRo = RecognitionObject.Ocr(0, 0, 257, 173);
                        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                        await sleep(200);
                        const ro8 = captureGameRegion();
                        let ocr = ro8.Find(ocrRo); // 当前页面OCR
                        ro8.dispose();
                        if (ocr.isExist() && ocr.text === "当前队伍") { // 多此一举
                            ocr.Click(); // 点击 当前队伍
                        }
                        await sleep(200);
                        // const ocrMsgRo = RecognitionObject.Ocr(397, 83, 662, 870); // 聊天框
                        const ocrMsgRo = RecognitionObject.Ocr(293, 80, 873, 868); // 聊天框
                        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                        await sleep(200);
                        let wait_flag = true;
                        const player_num = parseInt(settingDic["player_all"], 10);
                        let judge_dic = {};
                        while (wait_flag) { // 循环等待
                            const ro9 = captureGameRegion();
                            let ocr = ro9.FindMulti(ocrMsgRo); // 当前页面OCR
                            ro9.dispose();
                            for (let k = 1; k < player_num + 1; k++) { // 遍历总玩家数
                                const player_key = `${player_num.toString()}P`;
                                if (Object.keys(judge_dic).length < k) { // 将玩家加入判断字典
                                    judge_dic[player_key] = false;
                                }
                                if (!judge_dic[player_key]) { // 未识别到对应玩家就绪的信息，继续识别
                                    for (let l = 0; l < ocr.count; l++) { // 遍历OCR数组
                                        if (ocr[l].text === nameDic[player_key] + `已就位${await numberToChinese(i)}`) { // 检测是否存在该玩家信息
                                            judge_dic[player_key] = true;
                                            log.info(`${player_key} 已就位...`);
                                            break;
                                        }
                                    }
                                } else {
                                    log.info(`${player_key} 已就位...`);
                                }
                            }
                            if (Object.values(judge_dic).every(value => value === true)) wait_flag = false; // 全部就位
                        }
                        break;
                    }
                }
                await pathingScript.run(JSON.stringify(pathDic));
            }
            // 返回单人模式（如果是队长会自动踢出队员）
            if (settingDic["player_id"] === "1P") {
                // 等待队员退出（防止自己返回单人模式时卡死）
                await sleep(12000);
                // 返回单人模式（会自动踢出队员）
                genshin.returnMainUi();
                await sleep(1000);
                keyPress("VK_F2");
                await sleep(2500);
                click(1651, 1019);
                await sleep(1000);
                click(1180, 754);
            } else {
                genshin.returnMainUi();
                await sleep(1000);
                keyPress("VK_F2");
                await sleep(2500);
                click(1651, 1019);
            }

        } else if (settingDic["mode"] === "自动加世界") {
            if (settingDic["match_identity"] === "领队") { // 作为领队
                settingDic["player_id"] = "1P";
                settingDic["player_all"] = `${settingDic["match_detail"].length + 1}`;
                let enterFeedback = await enterMultiUi(60000); // 超时时间60s
                if (enterFeedback) {
                    let requestFeedback = await dealPlayerRequest(settingDic["match_detail"], 60000, settingDic["match_mode"] === "全字匹配" ? "exact" : "feature");
                    // if (settingDic["match_mode"] === "全字匹配") {
                    //     requestFeedback = await dealPlayerRequest(settingDic["match_detail"], 60000, "exact");
                    // } else if (settingDic["match_mode"] === "部分匹配") {
                    //     requestFeedback = await dealPlayerRequest(settingDic["match_detail"], 60000, "feature");
                    // }
                    log.info(`${requestFeedback}`);
                    if (requestFeedback) {
                        // 第一步，路径文件校验
                        if (!(await verifyPlayerPath(choicePath, "领队", true))) { // 验证路径一致性
                            log.error("路径校验未通过...");
                            return null;
                        }
                        // 第二步，跑路线
                        for (let i = 0; i < pathingList.length; i++) {
                            log.info(`当前路线标识(${i})${pathingList[i]}`);
                            let pathDic = JSON.parse(file.readTextSync(pathingList[i]));
                            for (let j = 0; j < pathDic["positions"].length; j++) {
                                if (pathDic["positions"][j]["id"] === 1) {
                                    for (let i = 0; i < 3; i++) {
                                        await genshin.tp(pathDic["positions"][j]["x"].toString(), pathDic["positions"][j]["y"].toString()); // 传送到第一个点位
                                        await genshin.returnMainUi();
                                        await sleep(200);
                                        let pos = await genshin.getPositionFromMap();
                                        log.info(`${pathDic["positions"][j]["x"]}${pos.X}${pathDic["positions"][j]["y"]}${pos.Y}`);
                                        if (pathDic["positions"][j]["x"] - 15 < pos.X && pos.X < pathDic["positions"][j]["x"] + 15 && pathDic["positions"][j]["y"] - 15 < pos.Y && pos.y < pathDic["positions"][j]["y"] + 15) {
                                            log.info(`传送点范围坐标正确`);
                                            break; // 确保在大地图上的位置正确再发送就位消息
                                        }
                                        await sleep(200);
                                    }
                                    // 删去第一个传送点位，避免再次传送
                                    pathDic["positions"].splice(j, 1);
                                    // 发消息
                                    await sendMessage(`${nameDic[settingDic["player_id"]]}已就位${await numberToChinese(i)}`);
                                    // 打开聊天框等待继续
                                    keyPress("VK_RETURN"); // 按Enter进入聊天界面
                                    await sleep(500);
                                    const ocrRo = RecognitionObject.Ocr(0, 0, 257, 173);
                                    moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                                    await sleep(200);
                                    let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
                                    if (ocr.isExist() && ocr.text === "当前队伍") { // 多此一举
                                        ocr.Click(); // 点击 当前队伍
                                    }
                                    await sleep(200);
                                    // const ocrMsgRo = RecognitionObject.Ocr(397, 83, 662, 870); // 聊天框
                                    const ocrMsgRo = RecognitionObject.Ocr(293, 80, 873, 868); // 聊天框
                                    moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                                    await sleep(200);
                                    let wait_flag = true;
                                    const player_num = parseInt(settingDic["player_all"], 10);
                                    let judge_dic = {};
                                    while (wait_flag) { // 循环等待
                                        let ocr = captureGameRegion().FindMulti(ocrMsgRo); // 当前页面OCR
                                        for (let k = 1; k < player_num + 1; k++) { // 遍历总玩家数
                                            const player_key = `${player_num.toString()}P`;
                                            if (Object.keys(judge_dic).length < k) { // 将玩家加入判断字典
                                                judge_dic[player_key] = false;
                                            }
                                            if (!judge_dic[player_key]) { // 未识别到对应玩家就绪的信息，继续识别
                                                for (let l = 0; l < ocr.count; l++) { // 遍历OCR数组
                                                    if (ocr[l].text === nameDic[player_key] + `已就位${await numberToChinese(i)}`) { // 检测是否存在该玩家信息
                                                        judge_dic[player_key] = true;
                                                        log.info(`${player_key} 已就位...`);
                                                        break;
                                                    }
                                                }
                                            } else {
                                                log.info(`${player_key} 已就位...`);
                                            }

                                        }
                                        if (Object.values(judge_dic).every(value => value === true)) { // 全部就位
                                            log.info("全部就位");
                                            await sendMessage("路线启动");
                                            wait_flag = false;
                                        };
                                    }
                                    break;
                                }
                            }
                            await pathingScript.run(JSON.stringify(pathDic));
                        }
                        // 跑完了全部路线
                        await sendMessage("全部路线结束");
                        // 等待队员退出（防止自己返回单人模式时卡死）
                        await sleep(12000);
                        // 返回单人模式（会自动踢出队员）
                        genshin.returnMainUi();
                        await sleep(1000);
                        keyPress("VK_F2");
                        await sleep(2500);
                        click(1651, 1019);
                        await sleep(1000);
                        click(1180, 754);
                    } else {
                        log.error("超时时间内无人加入或未全部加入..."); // 应该加一个解散重试之类的逻辑
                    }
                } else {
                    log.error("超时时间内无人申请加入...");
                }
            } else { // 作为队员
                let enterFeedback = await sendMultiRequest(settingDic["match_detail"]);
                if (enterFeedback) {
                    let playerSign = await getPlayerSign();
                    if (playerSign !== false) {
                        settingDic["player_id"] = playerSign;
                        // 第一步，发送路径校验信息
                        if (!(await verifyPlayerPath(choicePath, "队员"))) { // 验证路径一致性
                            log.error("路径校验未通过...");
                            return null;
                        }
                        // 第二步，跑路线
                        for (let i = 0; i < pathingList.length; i++) {
                            log.info(`当前路线标识(${i})${pathingList[i]}`);
                            let pathDic = JSON.parse(file.readTextSync(pathingList[i]));
                            for (let j = 0; j < pathDic["positions"].length; j++) {
                                if (pathDic["positions"][j]["id"] === 1) {
                                    for (let i = 0; i < 3; i++) {
                                        await genshin.tp(pathDic["positions"][j]["x"].toString(), pathDic["positions"][j]["y"].toString()); // 传送到第一个点位
                                        await genshin.returnMainUi();
                                        await sleep(200);
                                        let pos = await genshin.getPositionFromMap();
                                        if (pathDic["positions"][j]["x"] - 15 < pos.X && pos.X < pathDic["positions"][j]["x"] + 15 && pathDic["positions"][j]["y"] - 15 < pos.Y && pos.y < pathDic["positions"][j]["y"] + 15) {
                                            log.info(`传送点范围坐标正确`);
                                            break; // 确保在大地图上的位置正确再发送就位消息
                                        }
                                        await sleep(200);
                                    }
                                    // 删去第一个传送点位，避免再次传送
                                    pathDic["positions"].splice(j, 1);
                                    // 发消息
                                    await sendMessage(`${nameDic[settingDic["player_id"]]}已就位${await numberToChinese(i)}`);
                                    // 打开聊天框等待继续
                                    keyPress("VK_RETURN"); // 按Enter进入聊天界面
                                    await sleep(500);
                                    const ocrRo = RecognitionObject.Ocr(0, 0, 257, 173);
                                    moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                                    await sleep(200);
                                    let ocr = captureGameRegion().Find(ocrRo); // 当前页面OCR
                                    if (ocr.isExist() && ocr.text === "当前队伍") { // 多此一举
                                        ocr.Click(); // 点击 当前队伍
                                    }
                                    await sleep(200);
                                    // const ocrMsgRo = RecognitionObject.Ocr(397, 83, 662, 870); // 聊天框
                                    const ocrMsgRo = RecognitionObject.Ocr(293, 80, 873, 868); // 聊天框
                                    moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                                    await sleep(200);
                                    let wait_flag = true;
                                    const player_num = parseInt(settingDic["player_all"], 10);
                                    let judge_dic = {};
                                    while (wait_flag) { // 循环等待
                                        let ocr = captureGameRegion().FindMulti(ocrMsgRo); // 当前页面OCR
                                        for (let l = 0; l < ocr.count; l++) { // 遍历OCR数组
                                            if (ocr[l].text === "路线启动") { // 检测队长的消息
                                                log.info(`检测到队长发送的路线启动信息`);
                                                wait_flag = false;
                                                break;
                                            }
                                        }
                                        await sleep(500);
                                    }
                                    break;
                                }
                            }
                            await pathingScript.run(JSON.stringify(pathDic));
                        }
                        genshin.returnMainUi();
                        await sleep(1000);
                        // 打开聊天框等待继续
                        keyPress("VK_RETURN"); // 按Enter进入聊天界面
                        await sleep(500);
                        const ocrRo = RecognitionObject.Ocr(0, 0, 257, 173);
                        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                        await sleep(200);
                        const ro12 = captureGameRegion();
                        let ocr = ro12.Find(ocrRo); // 当前页面OCR
                        ro12.dispose();
                        if (ocr.isExist() && ocr.text === "当前队伍") { // 多此一举
                            ocr.Click(); // 点击 当前队伍
                        }
                        await sleep(200);
                        // const ocrMsgRo = RecognitionObject.Ocr(397, 83, 662, 870); // 聊天框
                        const ocrMsgRo = RecognitionObject.Ocr(293, 80, 873, 868); // 聊天框
                        moveMouseTo(1555, 860); // 移走鼠标，防止干扰OCR
                        await sleep(200);
                        while (true) { // 循环等待
                            const ro13 = captureGameRegion();
                            let ocr = ro13.FindMulti(ocrMsgRo); // 当前页面OCR
                            ro13.dispose();
                            for (let l = 0; l < ocr.count; l++) { // 遍历OCR数组
                                if (ocr[l].text.includes("全部路线结束")) { // 检测队长的消息
                                    log.info(`检测到队长发送的脚本结束信息`);
                                    // 返回单人模式（会自动踢出队员）
                                    genshin.returnMainUi();
                                    await sleep(1000);
                                    keyPress("VK_F2");
                                    await sleep(2500);
                                    click(1651, 1019);
                                    return true;
                                }
                            }
                            await sleep(500);
                        }
                    } else {
                        log.error(`未能获取玩家标识...`);
                    }
                } else {
                    log.error(`未能成功加入房主(${settingDic["match_detail"]})...`);
                }
            }
        }
    }

    await main();
})();