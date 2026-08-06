(async function () { // 待新增功能：添加UI界面方便选歌
    const base_path = "assets/score_file/";
    const regex_name = /(?<=score_file\\)[\s\S]*?(?=.json)/;
    const PlayType = {
        SingleMusicOnce: 0, // 单曲单次执行
        SingleMusicRepeat: 1, // 单曲循环执行
        QueueMusicOnce: 2, // 队列单次执行
        QueueMusicRepeat: 3, // 队列循环执行
    };
    const lowest_latency = 30;
    let DEBUG;
    let settings_msg = get_settings();
    let playbackTask = null;
    let playbackPaused = false;
    let activePlaybackWindowId = null;
    let lastPauseHotkeyAt = 0;
    const activeMusicKeys = new Set();
    const ignoredInjectedKeyDownUntil = new Map();
    const ignoredInjectedKeyUpUntil = new Map();
    let suspendedMusicKeys = [];
    let music_infos = [];

    const pressedHotkeyKeys = new Set();
    let pauseHotkeyLatched = false;

    function keyCodeToHotkeyName(value) {
        if (typeof value === "string" && !/^\d+$/.test(value)) {
            if (/^[A-Z0-9]$/.test(value) || /^F(?:[1-9]|1[0-2])$/.test(value)) return value;
            if (["Ctrl", "Alt", "Shift", "Backspace", "Tab", "Enter", "Space", "PageUp", "PageDown",
                "End", "Home", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Insert", "Delete",
                "Semicolon", "Equal", "Comma", "Minus", "Period", "Slash", "Backquote", "BracketLeft",
                "Backslash", "BracketRight", "Quote"].includes(value)) return value;
        }
        const code = Number(value);
        if (code >= 65 && code <= 90) return String.fromCharCode(code);
        if (code >= 48 && code <= 57) return String.fromCharCode(code);
        if (code >= 112 && code <= 123) return `F${code - 111}`;
        if ([16, 160, 161].includes(code)) return "Shift";
        if ([17, 162, 163].includes(code)) return "Ctrl";
        if ([18, 164, 165].includes(code)) return "Alt";
        const names = {
            8: "Backspace", 9: "Tab", 13: "Enter", 32: "Space",
            33: "PageUp", 34: "PageDown", 35: "End", 36: "Home",
            37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown",
            45: "Insert", 46: "Delete",
            186: "Semicolon", 187: "Equal", 188: "Comma", 189: "Minus",
            190: "Period", 191: "Slash", 192: "Backquote",
            219: "BracketLeft", 220: "Backslash", 221: "BracketRight", 222: "Quote"
        };
        return names[code];
    }

    function normalizePauseHotkey(value) {
        if (typeof value !== "string") return "F8";
        const order = { Ctrl: 0, Alt: 1, Shift: 2 };
        const unique = Array.from(new Set(value.split("+").map(part => part.trim()).filter(Boolean)));
        const modifiers = unique.filter(part => Object.prototype.hasOwnProperty.call(order, part)).sort((a, b) => order[a] - order[b]);
        const mainKeys = unique.filter(part => !Object.prototype.hasOwnProperty.call(order, part));
        if (mainKeys.length !== 1) return "F8";
        const mainKey = mainKeys[0];
        const supported = /^[A-Z0-9]$/.test(mainKey)
            || /^F(?:[1-9]|1[0-2])$/.test(mainKey)
            || ["Backspace", "Tab", "Enter", "Space", "PageUp", "PageDown", "End", "Home",
                "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Insert", "Delete", "Semicolon",
                "Equal", "Comma", "Minus", "Period", "Slash", "Backquote", "BracketLeft", "Backslash",
                "BracketRight", "Quote"].includes(mainKey);
        if (!supported || (modifiers.length === 0 && /^[A-Z]$/.test(mainKey))) return "F8";
        return [...modifiers, mainKey].join("+");
    }

    function getPauseHotkey() {
        const configured = settings_msg && settings_msg.pauseHotkey;
        return normalizePauseHotkey(configured);
    }

    /**
     * 等待暂停结束。使用短轮询让 HTML 控制面板可以及时恢复演奏。
     */
    async function waitWhilePaused() {
        while (playbackPaused) {
            await sleep(50);
        }
    }

    /**
     * 只计算实际演奏时间的 sleep；暂停所经过的时间不会消耗音符时值。
     * @param {number} duration 等待时长（毫秒）
     */
    async function playbackSleep(duration) {
        let remaining = Math.max(0, Math.round(Number(duration) || 0));
        while (remaining > 0) {
            await waitWhilePaused();
            const slice = Math.min(remaining, 50);
            const startedAt = Date.now();
            await sleep(slice);
            if (!playbackPaused) {
                remaining -= Math.max(1, Date.now() - startedAt);
            }
        }
        await waitWhilePaused();
    }

    function musicKeyDown(key) {
        ignoredInjectedKeyDownUntil.set(key, Date.now() + 250);
        keyDown(key);
        activeMusicKeys.add(key);
    }

    function musicKeyUp(key) {
        ignoredInjectedKeyUpUntil.set(key, Date.now() + 250);
        keyUp(key);
        activeMusicKeys.delete(key);
    }

    function scriptKeyPress(key) {
        const ignoredUntil = Date.now() + 250;
        ignoredInjectedKeyDownUntil.set(key, ignoredUntil);
        ignoredInjectedKeyUpUntil.set(key, ignoredUntil);
        keyPress(key);
    }

    function releaseAllMusicKeys() {
        for (const key of activeMusicKeys) {
            ignoredInjectedKeyUpUntil.set(key, Date.now() + 250);
            keyUp(key);
        }
        activeMusicKeys.clear();
    }

    /**
     * 切换演奏暂停状态。暂停时释放琴键，恢复时重新按下被暂停的长音。
     */
    function setPlaybackPaused(paused) {
        const nextPaused = Boolean(paused);
        if (nextPaused === playbackPaused) return;

        if (nextPaused) {
            suspendedMusicKeys = Array.from(activeMusicKeys);
            releaseAllMusicKeys();
            playbackPaused = true;
            log.info("演奏已暂停");
        } else {
            playbackPaused = false;
            for (const key of suspendedMusicKeys) {
                musicKeyDown(key);
            }
            suspendedMusicKeys = [];
            log.info("演奏已继续");
        }
    }

    function resetPlaybackState() {
        releaseAllMusicKeys();
        suspendedMusicKeys = [];
        playbackPaused = false;
    }

    function sendPlaybackState(message) {
        if (activePlaybackWindowId !== null && htmlMask.exists(activePlaybackWindowId)) {
            htmlMask.send(activePlaybackWindowId, "/playback/state", JSON.stringify({
                playing: playbackTask !== null,
                paused: playbackPaused,
                hotkey: getPauseHotkey(),
                message: message
            }));
        }
    }

    /**
     * 注册全局暂停热键。即使 HTML 遮罩处于鼠标穿透状态也可使用，
     * 因而不会影响玩家继续操作游戏。
     */
    function registerPauseHotkey() {
        const hook = new KeyMouseHook();
        hook.onKeyDown((keyCode) => {
            const normalized = typeof keyCode === "object"
                ? (keyCode.keyCode ?? keyCode.KeyCode ?? keyCode.code ?? keyCode.Code)
                : keyCode;
            const keyName = keyCodeToHotkeyName(normalized);
            if (!keyName) return;
            const ignoredUntil = ignoredInjectedKeyDownUntil.get(keyName) || 0;
            if (ignoredUntil >= Date.now()) {
                ignoredInjectedKeyDownUntil.delete(keyName);
                return;
            }
            pressedHotkeyKeys.add(keyName);
            const hotkeyParts = getPauseHotkey().split("+");
            const mainHotkey = hotkeyParts[hotkeyParts.length - 1];
            const isPauseHotkey = keyName === mainHotkey && hotkeyParts.every(part => pressedHotkeyKeys.has(part));
            const now = Date.now();
            if (!isPauseHotkey || pauseHotkeyLatched || playbackTask === null || now - lastPauseHotkeyAt < 300) return;

            pauseHotkeyLatched = true;
            lastPauseHotkeyAt = now;
            setPlaybackPaused(!playbackPaused);
            sendPlaybackState();
        }, true);
        hook.onKeyUp((keyCode) => {
            const normalized = typeof keyCode === "object"
                ? (keyCode.keyCode ?? keyCode.KeyCode ?? keyCode.code ?? keyCode.Code)
                : keyCode;
            const keyName = keyCodeToHotkeyName(normalized);
            const ignoredUntil = keyName ? (ignoredInjectedKeyUpUntil.get(keyName) || 0) : 0;
            if (keyName && ignoredUntil >= Date.now()) {
                ignoredInjectedKeyUpUntil.delete(keyName);
                return;
            }
            if (keyName) pressedHotkeyKeys.delete(keyName);
            const hotkeyParts = getPauseHotkey().split("+");
            if (!hotkeyParts.every(part => pressedHotkeyKeys.has(part))) pauseHotkeyLatched = false;
        }, true);
        return hook;
    }
    /**
     * -------- 工具函数 --------
     */

    /**
     * 计算曲谱的理论总时长（毫秒），不包含随机偏移和优化补偿。
     * 支持三种格式：'yuanqin'、'midi'、'keyboard'
     * @param {Object} music_info - 由 getMusicInfo 返回的乐曲信息对象
     * @returns {number} 总时长（毫秒）
     */
    function calculateMusicDuration(music_info) {
        if (!music_info || !music_info.notes) {
            log.warn('calculateMusicDuration: 乐曲信息不完整');
            return 0;
        }

        const type = music_info.type;
        let totalMs = 0;

        switch (type) {
            case 'keyboard': {
                // 如果 notes 已经是解析好的数组（由 getMusicInfo 预处理），直接使用；否则进行序列化
                let bar_list;
                if (Array.isArray(music_info.notes)) {
                    bar_list = music_info.notes;
                } else {
                    bar_list = keySheetSerialization(music_info.notes);
                }
                const gap = 60000 / music_info.bpm; // 每拍毫秒数
                let totalBeats = 0;
                for (const bar of bar_list) {
                    totalBeats += bar[0]; // 每个小节的拍数（通常为4）
                }
                // 加上最后的额外等待 8 拍（对应 listNotePlay 末尾的 sleep(gap * 8)）
                totalMs = (totalBeats + 8) * gap;
                break;
            }

            case 'midi': {
                // music_info.notes 是字符串，按 '|' 分割得到各事件
                const events = music_info.notes.split('|');
                const initialBpm = music_info.bpm || 120;
                const ticks = music_info.ticks || 480;
                let currentBpm = initialBpm;
                let baseTime = 60000 / (currentBpm * ticks); // 每 tick 毫秒数
                const regex = /^([A-Z])([A-Z@]+)(\d+)$/;

                for (const evt of events) {
                    if (!evt) continue;
                    // 变速标记
                    if (evt[0] === '*') {
                        const newBpm = Number(evt.slice(1));
                        if (!isNaN(newBpm) && newBpm > 0) {
                            currentBpm = newBpm;
                            baseTime = 60000 / (currentBpm * ticks);
                        }
                        continue;
                    }
                    const match = evt.match(regex);
                    if (match) {
                        const noteTicks = Math.round(Number(match[3]));
                        totalMs += noteTicks * baseTime;
                    }
                    // 忽略其他非音符事件（如休止符 '@' 在 MIDI 中可能以 'U@...' 出现，但这里只累加有 tick 的）
                }
                break;
            }

            case 'yuanqin': {
                const sheet = music_info.notes;
                const bpm = music_info.bpm || 120;
                const symbol = parseInt(music_info.time_signature.split('/')[1], 10);
                let symbolTime = 60000 / bpm;
                let currentBpm = bpm;

                function calcNoteTime(noteObj, count, symbolTimeLocal, symbolLocal) {
                    const type = parseInt(noteObj.type, 10);
                    if (isNaN(type) || type <= 0) return 0;
                    let baseDuration = Math.round(symbolTimeLocal * (symbolLocal / type));
                    let ornamentCount = 0;
                    let idx = count + 1;
                    while (idx < sheet.length) {
                        if (sheet[idx].spl === '#') {
                            ornamentCount++;
                            idx++;
                        } else break;
                    }
                    const ornamentTime = Math.round(symbolTimeLocal / 16);
                    if (ornamentCount > 0 && ornamentTime * ornamentCount < baseDuration) {
                        baseDuration -= ornamentTime * ornamentCount;
                    }
                    return baseDuration;
                }

                let i = 0;
                while (i < sheet.length) {
                    const note = sheet[i];
                    const spl = note.spl;

                    if (spl === '%') {
                        const newBpm = Number(note.type);
                        if (!isNaN(newBpm) && newBpm > 0) {
                            currentBpm = newBpm;
                            symbolTime = 60000 / currentBpm;
                        }
                        i++;
                        continue;
                    }

                    if (spl === 'none' || spl === '#' || spl === '*') {
                        let duration = 0;
                        if (spl === '#') {
                            duration = Math.round(symbolTime / 16);
                        } else if (spl === '*') {
                            const base = calcNoteTime(note, i, symbolTime, symbol);
                            duration = Math.round(base * 1.5);
                        } else {
                            const type = parseInt(note.type, 10);
                            if (!isNaN(type) && type > 0) {
                                duration = calcNoteTime(note, i, symbolTime, symbol);
                            }
                        }
                        totalMs += duration;
                        i++;
                    } else if (/\.([36$])/.test(spl)) {
                        let legatoGroup = [];
                        while (i < sheet.length && /\.([36$])/.test(sheet[i].spl)) {
                            legatoGroup.push(sheet[i]);
                            if (sheet[i].spl.includes('$')) {
                                i++;    // ✅ 修复死循环
                                break;
                            }
                            i++;
                        }
                        const firstNote = legatoGroup[0];
                        const type = parseInt(firstNote.type, 10);
                        if (!isNaN(type) && type > 0) {
                            let totalLegatoTime = Math.round(symbolTime * (symbol / type));
                            totalMs += totalLegatoTime;
                        }
                    } else if (spl === '^' || spl === '&') {
                        i++;
                    } else {
                        i++;
                    }
                }
                break;
            }

            default:
                log.warn(`calculateMusicDuration: 未知的曲谱类型 ${type}`);
                return 0;
        }
        return Math.round(totalMs);
    }

    /**
     * 计算 SHA-256 哈希并返回 8 位数字字符串。
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

        // 组合 h0~h7 为一个 BigInt（256位）
        var hashBig = BigInt(h0) << 224n |
            BigInt(h1) << 192n |
            BigInt(h2) << 160n |
            BigInt(h3) << 128n |
            BigInt(h4) << 96n  |
            BigInt(h5) << 64n  |
            BigInt(h6) << 32n  |
            BigInt(h7);

        // 计算 62^8，作为模数
        var mod = 62n ** 8n;  // 即 62 的 8 次方

        // 取模，得到 0 ~ mod-1 范围内的数字
        var num = hashBig % mod;

        // Base62 编码字符集
        var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var result = "";
        for (var i = 0; i < 8; i++) {
            result = chars[Number(num % 62n)] + result;
            num = num / 62n;
        }
        return result;
    }

    /**
     * 读取每个曲谱的乐器信息并返回字典
     * @returns {Promise<void>}
     */
    async function get_sheet_ins() {
        let settingsJson = JSON.parse(file.readTextSync("settings.json"));
        let ms_index = settingsJson.findIndex(item => item.name === 'music_selector');
        let sheetDic = {};
        for (const name of settingsJson[ms_index].options) {
            sheetDic[name] = {
                "instruments": (JSON.parse(file.readTextSync(`assets\\score_file\\${name}.json`)).instrument).split(","),
                "duration": calculateMusicDuration(getMusicInfo(name))
            }
        }
        settingsJson[ms_index].options = sheetDic;
        return settingsJson;
    }

    /**
     *
     * 判断两个按键字符串是否有公共字符
     *
     * @param {string} strA 第一个按键串（如 "ZVN"）
     * @param {string} strB 第二个按键串（如 "ZCN"）
     * @returns {boolean} 有公共字符返回 true
     */
    function hasCommonChar(strA, strB) {
        const setA = new Set(strA);
        for (let ch of strB) {
            if (setA.has(ch)) return true;
        }
        return false;
    }

    /**
     * 简洁易用的OCR函数
     * @param x
     * @param y
     * @param w
     * @param h
     * @param multi 是否使用FindMulti
     * @returns {Promise<void>} 返回对应的OCR对象
     */
    async function Ocr(x, y, w, h, multi = false) {
        let OcrRo = RecognitionObject.Ocr(x, y, w, h);
        let gameRegion = captureGameRegion();
        if (multi) {
            let ocrResult = gameRegion.FindMulti(OcrRo);
            gameRegion.dispose();
            if (ocrResult.count !== 0) {
                let resultList = [];
                for (let i = 0; i < ocrResult.count; i++) {
                    resultList.push(ocrResult[i]);
                }
                return resultList;
            } else {
                log.debug(`FindMulti为空: (${x}, ${y}, ${w}, ${h})`);
                return false;
            }
        } else {
            let ocrResult = gameRegion.Find(OcrRo);
            gameRegion.dispose();
            if (ocrResult.isExist()) {
                return ocrResult;
            } else {
                log.debug(`Find为空: (${x}, ${y}, ${w}, ${h})`);
                return false;
            }
        }
    }

    /**
     * 在指定区域内OCR文本并返回OCR对象
     * @param x
     * @param y
     * @param w
     * @param h
     * @param text 文本
     * @returns {Promise<*>} 找到返回OCR对象，未找到返回false
     * @see Ocr
     */
    async function ocr_find_area(x, y, w, h, text) {
        const OcrResult = await Ocr(x, y, w, h, true);

        if (OcrResult) {
            let flag = true;
            for (let i = 0; i < OcrResult.length; i++) {
                if (OcrResult[i].text.includes(text)) {
                    flag = false;
                    await sleep(200);
                    return OcrResult[i];
                }
            }
            if (flag) {
                log.debug(`区域(${x}, ${y}, ${w}, ${h})内未找到文本：${text}`);
                return false;
            }
        } else {
            log.error(`OCR错误，区域内未识别到文本: (${x}, ${y}, ${w}, ${h})`);
            return false;
        }
    }

    /**
     * 向上/下滑动滑块一次（原理，点击紧贴滑块的上/下方）[以下，高/顶表示屏幕上方，低/底表示屏幕下方]
     * @param x 滑块移动区域
     * @param y 滑块移动区域
     * @param w 滑块移动区域
     * @param h 滑块移动区域
     * @param max 滑块最高临界y值，若滑块y值小于此值则认为已经到顶
     * @param min 滑块最低临界y值，若滑块y值大于此值则认为已经到底
     * @param m_x 滑块区域的滑条中心x值
     * @param direction 滑动方向(Up/Down)
     * @param bg 背景颜色(白white/黑black)，black时滑块只能拖动
     * @param distance 滑动一页滑块需要滑动的y方向的距离（适用于bg为black），必须大于4
     * @returns {Promise<boolean>}
     */
    async function scroll_page(x, y, w, h, max, min, m_x, direction, bg = "white", distance = 140) {
        let barUpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${bg === "white" ? "slide_bar_main_up": "slide_bar_left_up"}.png`), x, y, w, h);
        let barDownRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${bg === "white" ? "slide_bar_main_down": "slide_bar_left_down"}.png`), x, y, w, h);
        barUpRo.threshold = 0.7;
        barDownRo.threshold = 0.7;

        let gameRegion = captureGameRegion();
        if (direction.toLowerCase() === "up") {
            let barUpper = gameRegion.Find(barUpRo);
            gameRegion.dispose();
            if (barUpper.isExist()) {
                if (barUpper.y < max) { // 到顶了
                    log.info(`滑块已经滑动到顶部(${barUpper.y})...`);
                    return false;
                } else {
                    if (bg === "white") {
                        click(m_x, barUpper.y - 15);
                    } else {
                        await mouseDrag(m_x, barUpper.y + 4, m_x, barUpper.y - (distance - 4));
                    }

                    log.debug(`将滑块向上调一格，当前位置: ${barUpper.y}`);
                }
            } else {
                log.error("未找到滑块: Up");
                return false;
            }
        } else {
            let barLower = gameRegion.Find(barDownRo);
            gameRegion.dispose();
            if (barLower.isExist()) {
                if (barLower.y > min) { // 到底了
                    log.info(`滑块已经滑动到底部(${barLower.y})...`);
                    return false;
                } else {
                    if (bg === "white") {
                        click(m_x, barLower.y + 15);
                    } else {
                        await mouseDrag(m_x, barLower.y + 4, m_x, barLower.y + (distance + 4));
                    }

                    log.debug(`将滑块向下调一格，当前位置: ${barLower.y}`);
                }
            } else {
                log.error("未找到滑块: Down");
                return false;
            }
        }
        await sleep(200);
        return true;
    }

    /**
     * 向上/下滑动滑块至顶部/底部（原理，点击紧贴滑块的上/下方）[以下，高/顶表示屏幕上方，低/底表示屏幕下方]
     * @param x 滑块移动区域
     * @param y 滑块移动区域
     * @param w 滑块移动区域
     * @param h 滑块移动区域
     * @param max 滑块最高临界y值，若滑块y值小于此值则认为已经到顶
     * @param min 滑块最低临界y值，若滑块y值大于此值则认为已经到底
     * @param max_y 滑块移动区域的最高点y值
     * @param min_y 滑块移动区域的最低点y值
     * @param m_x 滑块区域的滑条中心x值
     * @param side 滑动顶部或底部(Up/Down)
     * @param bg 背景颜色(白white/黑black)
     * @param distance 滑动一页滑块需要滑动的y方向的距离（适用于bg为black），必须大于4
     * @returns {Promise<boolean>}
     * @see scroll_page
     */
    async function scroll_bar_to_side(x, y, w, h, max, min, max_y, min_y, m_x, side, bg = "white", distance = 140) {
        let barUpRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${bg === "white" ? "slide_bar_main_up": "slide_bar_left_up"}.png`), x, y, w, h);
        let barDownRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/${bg === "white" ? "slide_bar_main_down": "slide_bar_left_down"}.png`), x, y, w, h);
        barUpRo.threshold = 0.7;
        barDownRo.threshold = 0.7;
        let barUpper_temp = 0;

        while (true) {
            await sleep(200);
            log.debug(`将滑块滑动至 ${side} `);
            let gameRegion = captureGameRegion();
            if (side.toLowerCase() === "up") {
                let barUpper = gameRegion.Find(barUpRo);
                if (barUpper.y !== barUpper_temp) { // 防止卡死
                    barUpper_temp = barUpper.y;
                } else {
                    break;
                }
                gameRegion.dispose();
                if (barUpper.isExist()) {
                    if (barUpper.y < max) { // 到顶了
                        log.info(`滑块已经滑动到顶部(${barUpper.y})...`);
                        break;
                    } else {
                        if (bg === "white") {
                            click(m_x, barUpper.y - 15);
                        } else {
                            await mouseDrag(m_x, barUpper.y + 4, m_x, barUpper.y - (distance - 4));
                        }
                        log.debug(`将滑块向上调一格，当前位置: ${barUpper.y}`);
                    }
                } else {
                    log.error("未找到滑块: Up");
                    return false;
                }
            } else {
                let barLower = gameRegion.Find(barDownRo);
                gameRegion.dispose();
                if (barLower.isExist()) {
                    if (barLower.y > min) { // 到底了
                        log.info(`滑块已经滑动到底部(${barLower.y})...`);
                        break;
                    } else {
                        if (bg === "white") {
                            click(m_x, barLower.y + 15);
                        } else {
                            await mouseDrag(m_x, barLower.y + 4, m_x, barLower.y + (distance + 4));
                        }
                        log.debug(`将滑块向下调一格，当前位置: ${barLower.y}`);
                    }
                } else {
                    log.error("未找到滑块: Down");
                    return false;
                }
            }
        }
        await sleep(200);
        return true;
    }

    /**
     *
     * 按照原神物品名长度显示裁剪字符串[主物品显示界面适用]（用于OCR）
     *
     * @param string 原字符串
     * @returns {Promise<*|string>} 处理后的字符串
     */
    async function deal_string(string) {
        if (string.length <= 6) {
            return string; // 如果字符串长度是6位或以下，原形返回
        } else {
            // return string.substring(0, 5) + '..'; // 如果字符串长度超过6位，保留前5位并加上'..'
            return string.substring(0, 5); // 如果字符串长度超过6位，保留前5位
        }
    }

    /**
     * 读取本地曲谱文件夹下的所有 .json 文件，并返回文件名列表（不带 .json）。
     * 自动将不合规文件名重命名为 "曲名 - 8位hash.json" 格式。
     * hash 由 sha256To8 根据文件内容计算得出。
     * @returns {Array} 本地曲谱文件列表（合规文件名，不带 .json）
     */
    const musicList = () => {
        const finalList = [];
        const entries = Array.from(file.readPathSync(base_path));
        const jsonEntries = entries.filter(entry => !file.isFolder(entry) && entry.endsWith('.json'));

        jsonEntries.forEach(entry => {
            const fullPath = entry;
            const fileName = entry.split(/[/\\]/).pop();
            const dirPath = entry.slice(0, entry.length - fileName.length);
            const base = fileName.replace(/\.json$/, '');

            // 读取内容并计算 hash (使用notes)
            let content;
            try {
                content = JSON.parse(file.readTextSync(fullPath)).notes;
            } catch (e) {
                log.error(`读取文件失败: ${fullPath}, 错误: ${e}`);
                return;
            }
            const hash = sha256To8(content);
            const suffix = " - " + hash;
            let finalName = base;

            // 判断当前文件名是否已经合规（包含正确的 hash）
            if (base.endsWith(suffix)) {
                // 合规，直接使用
                finalList.push(base);
                return;
            }

            // 不合规 → 提取曲名（兼容旧格式）
            let displayName = base;
            const dashIndex = base.lastIndexOf(' - ');
            if (dashIndex > 0) {
                displayName = base.substring(0, dashIndex);
            } else if (/^\d{4}\./.test(base)) {
                displayName = base.replace(/^\d{4}\./, '');
            }
            const newBase = displayName + " - " + hash;
            const newPath = dirPath + newBase + ".json";

            // 检查新旧路径是否相同，若相同则直接使用（理论上不会发生，因为上面已判断合规）
            if (newPath === fullPath) {
                finalList.push(newBase);
                return;
            }

            // 尝试重命名
            const renameSuccess = file.renamePathSync(fullPath, newPath);
            if (renameSuccess) {
                log.debug(`重命名: ${fileName} -> ${newBase}.json`);
                finalList.push(newBase);
            } else {
                // 重命名失败（可能是目标已存在等），保留原文件名
                log.warn(`重命名失败: ${fullPath} -> ${newPath}，保留原名`);
                finalList.push(base);
            }
        });

        finalList.sort((a, b) => a.localeCompare(b));
        return finalList;
    };


    /**
     *
     * 根据乐曲文件名生成乐曲文件路径
     *
     * @param music_name 乐曲文件名
     * @returns {string} 乐曲文件路径
     */
    function pathJoin(music_name) {
        return base_path + music_name + ".json";
    }

    /**
     * 获取JS脚本配置
     *
     * @returns {Object} 包含解析后JS脚本配置的对象，具有以下属性：
     * @property {Number} startTime - 目标时间的时间戳
     * @property {Number} playType - 播放模式，使用PlayType枚举
     * @property {Array[String]} musicQueue - 乐曲队列，包含乐曲文件名的数组
     * @property {Boolean} autoSwitch - 开始演奏前是否自动切换乐器
     * @property {Number} queueInterval - 乐曲队列间隔时间，单位为秒
     * @property {Number} repeatTimes - 循环执行次数
     * @property {Number} repeatInterval - 循环间隔时间，单位为秒
     * @property {Boolean} debug - 是否启用调试模式
     *
     */
    function get_settings() {
        const Settings = {
            startTime: 0,
            playType: undefined,
            musicQueue: [],
            autoSwitch: false,
            queueInterval: 0,
            repeatTimes: 1,
            repeatInterval: 0,
            debug: false,
            pauseHotkey: "F8"
        }


        /**
         * @param {String} timeString 
         * @returns {Number} 目标时间运行当天的时间戳
         * @example
         * console.log(calTargetTimeStamp('14:30:00')) // at 2025/9/10
         * -> 1757485800000 (2025/9/10 14:30:00)的时间戳
         */
        const calTargetTimeStamp = (timeString) => {
            const [hours, minutes, seconds] = timeString.replace(/[^0-9:]/g, "").split(':').map(Number);

            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const day = now.getDate();

            const localDate = new Date(year, month, day, hours, minutes, seconds);
            return localDate.getTime();
        }
        try {
            // 读取开始时间
            let music_start = typeof (settings.music_start) === 'undefined' ? "00:00:00" : settings.music_start;
            Settings.startTime = calTargetTimeStamp(music_start);
            // 读取播放模式
            let type_select = typeof (settings.type_select) === 'undefined' ? "单曲单次执行" : settings.type_select;
            switch (type_select) {
                case "单曲单次执行":
                    Settings.playType = PlayType.SingleMusicOnce;
                    break;
                case "单曲循环":
                    Settings.playType = PlayType.SingleMusicRepeat;
                    break;
                case "队列单次执行":
                    Settings.playType = PlayType.QueueMusicOnce;
                    break;
                case "队列循环":
                    Settings.playType = PlayType.QueueMusicRepeat;
                    break;
                default:
                    Settings.playType = PlayType.SingleMusicOnce;
                    break;
            }
            // 读取切换乐器
            Settings.autoSwitch = settings.auto_switch;
            // 读取队列间隔时间
            Settings.queueInterval = (typeof (settings.music_interval) === 'undefined') ? (0) : parseInt(settings.music_interval, 10);
            // 读取循环次数
            Settings.repeatTimes = (typeof (settings.music_repeat) === 'undefined') ? (1) : parseInt(settings.music_repeat, 10);
            // 读取循环间隔时间
            Settings.repeatInterval = (typeof (settings.repeat_interval) === 'undefined') ? (0) : parseInt(settings.repeat_interval, 10);
            // 读取乐曲队列 Array[musicName]
            if (Settings.playType === PlayType.SingleMusicOnce || Settings.playType === PlayType.SingleMusicRepeat) {
                // 单曲模式不变
                Settings.musicQueue.push((typeof (settings.music_selector) === 'undefined') ? undefined : (settings.music_selector));
            } else {
                // 队列模式
                let music_queue = (typeof (settings.music_queue) === 'undefined') ? undefined : (settings.music_queue);
                if (music_queue === undefined) throw new Error("队列执行无序号");
                // 按空格分割用户输入，例如 "小星星 花海"
                const tokens = music_queue.split(/\s+/).filter(item => item !== "");
                const localList = musicList(); // 获取合规文件名列表，如 ["小星星 - abc123", "花海 - def456"]
                const matched = [];

                tokens.forEach(token => {
                    // 优先精确匹配完整文件名
                    let found = localList.find(m => m === token);
                    if (!found) {
                        // 模糊匹配：文件名包含 token 或曲名包含 token
                        found = localList.find(m => m.includes(token));
                    }
                    if (found && !matched.includes(found)) {
                        matched.push(found);
                    }
                });

                Settings.musicQueue = matched;
            }
            Settings.debug = (typeof (settings.debug_mode) === 'undefined') ? false : settings.debug_mode === "启用";
            Settings.pauseHotkey = normalizePauseHotkey(settings.pause_hotkey);

            DEBUG = Settings.debug;
            return Settings;

        } catch (error) {
            log.error(`读取JS脚本配置时出错：${error}`);
        }
    }

    /**
     *
     * 读取并解析一个乐谱文件
     *
     * @param music_name {string} 乐曲文件名
     * @returns {Promise<{}|null>}
     * @property {string} name 乐曲名称
     * @property {string} author 作者
     * @property {string} instrument 建议乐器
     * @property {string} description 乐曲描述
     * @property {string} type 乐曲类型
     * @property {number} bpm BPM
     * @property {string} time_signature 拍号
     * @property {string} composer 作曲者
     * @property {string} arranger 编曲者
     * @property {Object[][]} notes 乐谱内容
     */
    function getMusicInfo(music_name) {
        const MusicInfo = {
            name: undefined, // 乐曲名称
            author: undefined, // 作者
            instrument: undefined, // 乐器
            description: undefined, // 乐曲描述
            type: undefined, // 乐曲类型
            bpm: undefined, // BPM
            time_signature: undefined, // 拍号
            composer: undefined, // 作曲者
            arranger: undefined, // 编曲者
            notes: undefined, // 乐谱内容
        }

        let music_path = pathJoin(music_name);
        let file_text = ""; // 存储乐曲文件内容
        // 读取并检查文件
        try {
            file_text = file.readTextSync(music_path);
        } catch (error) {
            log.error(`文件无法读取：${music_path}\nerror:${error}`);
        }

        if (file_text == null) { // 检测文件是否读取
            log.error(`读取文件 ${music_path} 错误，文件为空`);
            return null;
        }
        // else {
        //     log.info(`文件读取成功: ${music_path}`);
        // }

        let music_msg_dic = JSON.parse(file_text);
        let regex_blank = /[\n]/g;

        MusicInfo.name = (music_msg_dic.name !== undefined) ? (music_msg_dic.name) : ("未知曲名");
        MusicInfo.author = (music_msg_dic.author !== undefined) ? (music_msg_dic.author) : ("未知作者");
        MusicInfo.instrument = (music_msg_dic.instrument !== undefined) ? (music_msg_dic.instrument) : ("风物之诗琴");
        MusicInfo.description = (music_msg_dic.description !== undefined) ? (music_msg_dic.description) : ("无描述");
        MusicInfo.composer = (music_msg_dic.composer !== undefined) ? (music_msg_dic.composer) : ("未知作曲者");
        MusicInfo.arranger = (music_msg_dic.arranger !== undefined) ? (music_msg_dic.arranger) : ("未知编曲者");
        // 必要信息
        MusicInfo.type = (music_msg_dic.type !== undefined) ? (music_msg_dic.type) : ("yuanqin");
        MusicInfo.bpm = (music_msg_dic.bpm !== undefined) ? (music_msg_dic.bpm) : (120);
        MusicInfo.time_signature = (music_msg_dic.time_signature !== undefined) ? (music_msg_dic.time_signature) : ("4/4");
        MusicInfo.ticks = (music_msg_dic.ticks !== undefined) ? (music_msg_dic.ticks) : (480);

        if (music_msg_dic.notes === undefined) {
            log.error(`文件 ${music_name} 无乐曲信息`);
            return null;
        }

        switch (MusicInfo.type) {
            case "yuanqin":
                MusicInfo.notes = parseMusicSheet(music_msg_dic.notes.replace(regex_blank, ""));
                break;
            case "midi":
                MusicInfo.notes = music_msg_dic.notes;
                break;
            case "keyboard":
                MusicInfo.notes = keySheetSerialization(music_msg_dic.notes);
            default:
                break;
        }

        return MusicInfo;
    }

    /**
     *
     * 执行单音
     *
     * @param key {string}
     * @param status 按键模式 press down up
     * @param extra_wait 额外等待（防止单个按键间隔过短）
     *
     */
    async function play_note(key, status = "press", extra_wait = false) {
        if (status === "press") {
            musicKeyDown(key);
            musicKeyUp(key);
            if (extra_wait) await playbackSleep(lowest_latency);
        } else if (status === "down") {
            musicKeyDown(key);
        } else if (status === "up") {
            musicKeyUp(key);
            if (extra_wait) {
                await playbackSleep(lowest_latency);
                if (DEBUG) {
                    log.info(`补足延迟：预期用时 ${lowest_latency} ms`);
                }
                await playbackSleep(lowest_latency);
            }
        }

    }

    /**
     *
     * 执行和弦
     *
     * @param keys {string}
     * @param status 按键模式 press down up
     * @param extra_wait 额外等待（防止单个按键间隔过短）
     *
     */
    async function play_chord(keys, status = "press", extra_wait = false) {
        if (status === "press") {
            for (const key of keys) {
                await play_note(key, status);
                if (extra_wait) {
                    if (DEBUG) {
                        log.info(`补足延迟：预期用时 ${lowest_latency} ms`);
                    }
                    await playbackSleep(lowest_latency);
                }
            }
        } else if (status === "down") {
            for (const key of keys) {
                musicKeyDown(key);
            }
        } else if (status === "up") {
            for (const key of keys) {
                musicKeyUp(key);
            }
            if (extra_wait) {
                if (DEBUG) {
                    log.info(`补足延迟：预期用时 ${lowest_latency} ms`);
                }
                await playbackSleep(lowest_latency);
            }
        }

    }

    /**
     * 音符小节序列演奏
     * @typedef {[Number,[Map]]} Bar 
     * @param {Bar[]} bar_list
     * @param {Number} gap 一拍的时长,单位ms
     * @property {Number} barTime 小节时长
     * @property {[Map]} notes 一个小节中所有音符的信息
     */
    async function listNotePlay(bar_list, gap) {
        /**
         * 按键模拟
         * 不使用await修饰调用，利用javascript特性实现异步弹奏
         * 
         * @param {Map} note
         * @param {Number} gap 
         * @description offset:小节开始时此音符需要先等待多久,单位为一拍时间
         * @description key:键盘按键
         * @description time:此音符需要持续的时长,单位为一拍时间
         */
        async function notePlay(note, gap) {
            const wait = note["offset"];
            const key = note["key"];
            const time = note["time"];
            await playbackSleep(RandomRhythmOffset(Math.floor(wait * gap))); // SleepTime
            musicKeyDown(key);
            await playbackSleep(RandomRhythmOffset(Math.floor(time * gap))); // SleepTime
            musicKeyUp(key);
        }
        log.info(`总计 ${bar_list.length} 小节, 预计演奏时长 ${(bar_list.length * gap * bar_list[0][0] / 1000).toFixed(2)}秒`);
        for (let i = 0; i < bar_list.length; i++) {
            await waitWhilePaused();
            if (Math.random() < 0.5) scriptKeyPress("I");  // AC
            let bar = bar_list[i];
            let barTime = bar[0];
            let notes = bar.slice(1);
            for (let j = 0; j < notes.length; j++) {
                let note = notes[j];
                notePlay(note, gap); // 启动音符异步函数
            }
            if (DEBUG) {
                log.info(`${i} / ${bar_list.length} ${(i / bar_list.length * 100).toFixed(2)}%`)
            }
            await playbackSleep(Math.floor(barTime * gap)); // 等待小节结束
        }
        await playbackSleep(Math.floor(gap * 8)); // 额外等待
    }

    /**
     * 将乐谱键位字符串序列化为按小节分组的音符对象数组
     * 
     * 此函数处理自定义记谱字符串，将其解析为音符组，展开嵌套组，合并相邻音符，并按小节分组
     * 每个小节表示为一个数组，首元素为小节长度(固定为4)，后接包含键位、偏移量和时间属性的音符对象
     * 
     * @param {string} stringSheet - 待序列化的键位乐谱字符串
     * @returns {Array<Array<number|Object>>} - 小节数组，每个小节为数组结构(首元素为长度4，后接音符对象)：
     *   - { key: string, offset: number, time: number }
     * 
     * @example
     * const testString = "(QH) DQ/D-G-/[(HF)A] A /FH(QH) / (QG)SJ>(JG)Q(WJ)G>[G0E00]/-(EA)-DF/(GD)H(GD)F/";
     * const result = keySheetSerialization(testString);
     * // 返回结果: [
     * //   [4, { key: 'Q', offset: 0, time: 1 }, ...],
     * //   [4, { key: 'D', offset: 0, time: 2 }, ...],
     * //   ...
     * // ]
     */
    function keySheetSerialization(stringSheet) {
        /**
         * 函数是安全的，在处理按键序列时不会触发回溯地狱
         * @param {String} inputString
         * @example
         * const testString = "(QH) DQ/D-G-/[(HF)A] A /FH(QH) / (QG)SJ>(JG)Q(WJ)G>[G0E00]/-(EA)-DF/(GD)H(GD)F/";
         * console.log("原始字符串:", testString);
         * console.log("转换后字符串:", keySheetProcess(testString));
         * input  : "(QH) DQ/D-G-/[(HF)A] A /FH(QH) / (QG)SJ>(JG)Q(WJ)G>[G0E00]/-(EA)-DF/(GD)H(GD)F/"
         * output : "(QH)0DQ{D}-G-{[(HF)A]}0A0{F}H(QH)00(QG)SJ(JG)Q(WJ)G[G0E00]-(EA)-DF{GD}H(GD)F"
         */
        const keySheetProcess = (inputString) => {
            return inputString
                .replace(/\/\(([^)]+)\)/g, '{$1}')      // 替换 /(content) 为 {content}
                .replace(/\/([A-Z])/g, '{$1}')          // 替换 /X 为 {X}
                .replace(/ /g, "0")                     // 替换空格为 0
                .replace(/\/\[([^\]]+)\]/g, '{[$1]}')   // 替换 /[content] 为 {[content]}
                .replace(/[\/\>]/g, "");                // 删除所有 / 和 >
        };

        /**
         * @typedef {Array} noteInfo 
         * @param {String} processedString 处理完成的字符串，只有A-Z，0，-，()[]{}
         * @returns {[noteInfo[]]}
         */
        const keySheetParse = (processedString) => {
            const isLeftBrackets = (char) => ((char.length === 1) && (/[\(\[\{]/.test(char)));
            const isRightBrackets = (char) => ((char.length === 1) && (/[\)\]\}]/.test(char)));
            class GroupProcess {
                constructor() {
                    this.stack = [{ type: 'ROOT', listKey: [] }];
                    this.current = this.stack[0];
                }
                push(char) {
                    if (isLeftBrackets(char)) {
                        const newGroup = { type: char, listKey: [] };
                        this.current.listKey.push(newGroup);
                        this.stack.push(newGroup);
                        this.current = newGroup;
                    }
                    else if (isRightBrackets(char)) {
                        if (this.stack.length > 1) {
                            this.stack.pop();
                            this.current = this.stack[this.stack.length - 1];
                        }
                    }
                    else if (char !== '-') {
                        this.current.listKey.push(char);
                    }
                    return this;
                }
                invaildMatch() { return ((this.stack.length === 1) && (this.stack[0].listKey.length !== 0)); }
                clear() {
                    this.stack = [{ type: 'ROOT', listKey: [] }];
                    this.current = this.stack[0];
                }
                genAll() {
                    let out = this.stack[0].listKey[0];
                    if ((typeof out) === "string") out = { type: "{", listKey: [out] };
                    out.mult = 1;
                    this.clear();
                    return out;
                }
            }

            let group = new GroupProcess(); // 处理流程1
            let groupProess = new Array(); // 处理流程2
            for (let i = 0; i < processedString.length; i++) {
                const char = processedString[i];
                if (char !== "-") { group.push(char); }
                else { groupProess[groupProess.length - 1].mult += 1; }

                if (group.invaildMatch()) { groupProess.push(group.genAll()); }
            }
            // console.dir(groupProess, { depth: null });
            return groupProess;
        }

        function unfoldGroup(input) {
            const unfoldGroup = [];
            let cumulativeBeats = 0;

            const processGroup = (group, mult, beats, baseOffset) => {
                let offset = baseOffset;
                if (group.type === '{') offset += 0.001;

                if (group.type === '[') {
                    const unitTime = mult / group.listKey.length;
                    group.listKey.forEach((item, i) => {
                        const itemOffset = offset + i * unitTime;
                        if (typeof item === 'string') {
                            if (item !== '0') unfoldGroup.push({ beats, offset: itemOffset, key: item, time: unitTime });
                        } else {
                            processGroup(item, unitTime, beats, itemOffset);
                        }
                    });
                } else {
                    group.listKey.forEach(item => {
                        if (typeof item === 'string') {
                            if (item !== '0') unfoldGroup.push({ beats, offset, key: item, time: mult });
                        } else {
                            processGroup(item, mult, beats, offset);
                        }
                    });
                }
            };

            input.forEach(group => {
                const groupBeats = cumulativeBeats;
                cumulativeBeats += group.mult;
                processGroup(group, group.mult, groupBeats, 0);
            });

            return unfoldGroup;
        }

        function mergeGroup(notes) {
            const buckets = {};

            notes.forEach(note => {
                if (!buckets[note.key]) {
                    buckets[note.key] = [];
                }
                buckets[note.key].push({ ...note });
            });

            const mergedNotes = [];

            Object.keys(buckets).forEach(key => {
                const bucket = buckets[key];
                bucket.sort((a, b) => (a.beats + a.offset) - (b.beats + b.offset));

                let i = 0;
                while (i < bucket.length - 1) {
                    const current = bucket[i];
                    const next = bucket[i + 1];
                    const currentEnd = current.beats + current.time;
                    const nextStart = next.beats + next.offset;

                    if (Math.abs(currentEnd - nextStart) < 0.01) {
                        current.time += next.time;
                        bucket.splice(i + 1, 1);
                    } else {
                        i++;
                    }
                }

                mergedNotes.push(...bucket);
            });

            mergedNotes.sort((a, b) => {
                if (a.beats !== b.beats) return a.beats - b.beats;
                return a.offset - b.offset;
            });

            return mergedNotes;
        }
        let SerializedKey = keySheetProcess(stringSheet);
        SerializedKey = keySheetParse(SerializedKey);
        SerializedKey = unfoldGroup(SerializedKey);
        SerializedKey = mergeGroup(SerializedKey);
        const grouped = [];
        const wholeBeats = Math.floor(SerializedKey[SerializedKey.length - 1].beats / 4) + 1;
        for (let i = 0; i < wholeBeats; i++) {
            grouped.push([4]);
        }
        for (const note of SerializedKey) {
            grouped[Math.floor(note.beats / 4)].push({ offset: note.beats % 4 + note.offset, key: note.key, time: note.time });
        }
        return grouped;
    }

    /**
     *
     * 解析乐谱字符串（乐谱JSON文件中的notes）
     *
     * 小节之间用|隔开且乐谱中不能有空格，单个小节的解析规则如下：
     * A[4] 表示按下A键，A键视作四分音符
     * (ASD)[4-#] 表示同时按下ASD键，这个和弦视作四分音符的装饰音
     * A[4-3](AS)[4-3](ASD)[4-3] 表示等分四分音符的三连音（-后填3必须要连着写三个这样的音符），按顺序按下A、AS、ASD键
     * @[4] 表示休止符，中括号内标明这是几分休止符，例如这里表示4分休止符
     * 附：
     * 中括号（-前表示音符类型-后用于区分特殊音符）：[填4表示4分音符，填16表示16分音符...-填#表示装饰音，填3表示三连音] 例：[16-#]
     *
     * @param sheet {string} 乐谱 [DEBUG]更新midi后这里也会是一个字典
     * @returns {Object[][]}
     */
    function parseMusicSheet(sheet) {
        let result = [];

        if (typeof (sheet) === "object") {
            result = sheet;
        } else {
            // 将输入字符串按照小节分割
            let bars = sheet.split('|');

            // 遍历每个小节
            bars.forEach(bar => {
                let i = 0;

                // 逐个字符解析小节中的音符及其属性
                while (i < bar.length) {
                    let note = ''; // 存储音符
                    let type = ''; // 存储音符类型
                    let chord = false; // 判断是否为和弦
                    let spl = 'none'; // 存储特殊音符属性，默认值为 "none"

                    // 检查是否为和弦（和弦用圆括号包裹）
                    if (bar[i] === '(') {
                        chord = true;
                        i++;
                        while (bar[i] !== ')') {
                            note += bar[i];
                            i++;
                        }
                        i++; // 跳过闭合圆括号
                    } else if (bar[i] === '@') {
                        // 处理休止符
                        note = '@';
                        i++;
                    } else if (bar[i] === '%') {
                        // 处理BPM标记
                        note = '%';
                        i++;
                    } else {
                        note = bar[i];
                        i++;
                    }

                    // 解析音符类型（用方括号包裹）
                    if (bar[i] === '[') {
                        i++;
                        while (bar[i] !== ']') {
                            type += bar[i];
                            i++;
                        }
                        i++; // 跳过闭合方括号
                    }

                    // 解析特殊音符属性（如果type中包含'-'）
                    if (type.includes('-')) {
                        let splIndex = type.indexOf('-');
                        spl = type.slice(splIndex + 1);
                        type = parseInt(type.slice(0, splIndex), 10);
                    } else if (type === "^" || type === "&") {
                        spl = type
                    }

                    // 将解析结果添加到parsedNotes数组中
                    result.push({
                        "note": note,
                        "type": type,
                        "chord": chord,
                        "spl": spl
                    });
                }
            });
        }

        return result;
    }

    /**
     *
     * 根据解析后的乐谱进行演奏
     *
     * @param index
     * @param sheet_list {Object[][]} 解析后的乐谱
     * @param bpm BPM (240)
     * @param ts 拍号 (3/4)
     * @param ticks ticks per beat （MIDI用）
     * @returns {Promise<void>}
     */
    async function play_sheet(index, sheet_list, bpm, ts, ticks = 480) {
        /**
         *
         * 计算当前音符的时长（检测音符后是否有装饰音）
         *
         * @param sheet_list {Object[][]} 解析后的乐谱
         * @param symbol_time 每一拍的时间
         * @param symbol 以几分音符为一拍
         * @param note_type 音符类型
         * @param count 当前音符下标
         * @param note_time 当前音符的时长（默认为undefined，不为空时symbol note_type count实效）
         * @returns {number}
         */
        function cal_time_ornament(sheet_list, symbol_time, symbol, note_type, count, note_time = undefined) {
            try {
                if (note_time === undefined) {
                    // 该音符的正常时长
                    note_time = Math.round(symbol_time * (symbol / note_type));
                }
                // 装饰音时长
                let ornament_time = Math.round(symbol_time / 16)

                let check_count = count + 1;
                let ornament_count = 0; // 装饰音计数

                while (check_count < sheet_list.length) { // 装饰音不可能在曲谱末尾，else会在匹配不到装饰音的循环触发
                    if (sheet_list[check_count]["spl"] === "#") {
                        ornament_count += 1;
                    } else {
                        if (ornament_count === 0) {
                            return note_time;
                        } else {
                            // 装饰音占用的时间过长就不预留时间
                            if (ornament_time * ornament_count < note_time) {
                                return note_time - ornament_time * ornament_count;
                            } else {
                                return note_time;
                            }
                        }
                    }
                    check_count += 1;
                }
                return note_time;
            } catch (error) {
                log.error(`出错(cal_time_ornament): ${error}`);
            }

        }
        // 如果是midi转换的乐谱
        if (typeof(sheet_list) === "string") {
			let play_sheet = sheet_list.split("|");
            let base_time = 60000 / (bpm * ticks);  // second per beat - 每tick多少毫秒

            let midi_start_time = Date.now();
            for (let i = 0; i < play_sheet.length; i++) {
                await waitWhilePaused();
                if (Math.random() < 0.5) scriptKeyPress("I");  // AC
                // 预期用时
                let expected_usage = 0;
                // 变速标记
                if (play_sheet[i][0] === "*") {
                    const bpm_new = Number(play_sheet[i].slice(1));
                    music_infos[index]["bpm"] = bpm_new;
                    bpm = bpm_new;
                    // 重新计算
                    base_time = 60000 / (bpm * ticks);
                    if (DEBUG) {
                        log.info(`变速：${bpm_new}`);
                    }
                    continue;
                }
                // 正则表达式：首字母（A-Z），中间字母串（A-Z@），数字部分（0-9）
                const regex = /^([A-Z])([A-Z@]+)(\d+)$/;

                let current_note = play_sheet[i];

                const match = current_note.match(regex);
                const status = match[1];
                const notes = match[2];
                const note_ticks = Math.round(match[3]);

                if (DEBUG) {
                    log.info(`${status}-${notes}-${note_ticks}`);
                }
                let wait_time = RandomRhythmOffset(Math.round(note_ticks * base_time)); // SleepTime

                if (i > 0) {
                    if (wait_time >= lowest_latency) {
                        if (i + 1 < play_sheet.length) {
                            if (play_sheet[i][0] !== "*" && play_sheet[i + 1][0] !== "*") {
                                const next_match = play_sheet[i + 1].match(regex);
                                if (next_match && hasCommonChar(next_match[2], notes) && next_match[1] === 'D' && 'D' !== status) {
                                    let r_wait_time = wait_time - lowest_latency; // 正常时长减去 下一个音的额外延迟+延迟补偿
                                    await playbackSleep(r_wait_time);
                                    if (DEBUG) {
                                        log.info(`提前抬起：${r_wait_time}`);
                                    }
                                } else {
                                    await playbackSleep(wait_time);
                                }
                            }
                        } else {
                            await playbackSleep(wait_time);
                        }
                    } else { //对相邻同音的按下/抬起对添加补偿延迟，避免无差别强制sleep导致流畅度下降
                        if (play_sheet[i - 1][0] !== "*" && play_sheet[i][0] !== "*") {
                            const prev_match = play_sheet[i - 1].match(regex);
                            if (prev_match && hasCommonChar(prev_match[2], notes) && prev_match[1] === 'U' && 'U' !== status) {
                                await playbackSleep(lowest_latency); // 额外延迟 防止丢音
                                if (DEBUG) {
                                    log.info(`补足延迟：${lowest_latency}`);
                                }
                            }
                        }
                    }
                } else {
                    await playbackSleep(wait_time);
                }

				if (notes === "@") continue;

                if (status === "D") {
                    if (notes.length > 1) {
                        await play_chord(notes, "down");
                    } else {
                        await play_note(notes, "down");
                    }
                } else {
                    if (notes.length > 1) {
                        await play_chord(notes, "up");
                    } else {
                        await play_note(notes, "up");
                    }
                }
            }
            let midi_end_time = Date.now();
            if (DEBUG) {
                log.info(`总计用时：${midi_end_time - midi_start_time}ms`);
            }
        } else {
            // 确定是以几分音符为一拍
            let symbol = parseInt(ts.split("/")[1], 10);
            // 存储连音
            let temp_legato = [];
            // 每拍所需的时间
            let symbol_time = Math.round(60000 / bpm);
            // 装饰音时长
            let ornament_time = Math.round(symbol_time / 16)

            let yq_start_time = Date.now();
            // test 需要额外计算装饰音时值的影响
            for (let i = 0; i < sheet_list.length; i++) {
                await waitWhilePaused();
                if (Math.random() < 0.5) scriptKeyPress("I"); // AC

                // 显示正在演奏的音符
                if (DEBUG) {
                    log.info(`${sheet_list[i]["note"]}[${sheet_list[i]["type"]}-${sheet_list[i]["spl"]}]`);
                }
                if (sheet_list[i]["spl"] === 'none') { // 单音、休止符或和弦
                    let sleep_time = RandomRhythmOffset(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i)); // SleepTime

                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"], "down"); // 和弦
                        let flag = false;
                        flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                        if (flag) {
                            let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                            if (wait_time >= 1) {
                                sleep_time = wait_time;
                                if (DEBUG) {
                                    log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                }
                            }
                        }
                        await playbackSleep(sleep_time);
                        await play_chord(sheet_list[i]["note"], "up", flag);
                    } else {
                        if (sheet_list[i]["note"] === '@') { // 休止符
                            await playbackSleep(sleep_time);
                        } else {
                            await play_note(sheet_list[i]["note"], "down"); // 单音
                            let flag = false;
                            flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                            if (flag) {
                                let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                                if (wait_time >= 1) {
                                    sleep_time = wait_time;
                                    if (DEBUG) {
                                        log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                    }
                                }
                            }
                            await playbackSleep(sleep_time);
                            await play_chord(sheet_list[i]["note"], "up", flag);
                        }
                    }

                    // if (i !== sheet_list.length - 1) {
                    //     await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i));
                    // }
                } else if (sheet_list[i]["spl"] === '#') { // 装饰音（不会包含休止符），时值为symbol的时值的1/16
                    let sleep_time = RandomRhythmOffset(ornament_time); // SleepTime
                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"], "down"); // 和弦
                        let flag = false;
                        flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                        if (flag) {
                            let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                            if (wait_time >= 1) {
                                sleep_time = wait_time;
                                if (DEBUG) {
                                    log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                }
                            }
                        }
                        await playbackSleep(sleep_time);
                        await play_chord(sheet_list[i]["note"], "up", flag);
                    } else {
                        await play_note(sheet_list[i]["note"], "down"); // 单音
                        let flag = false;
                        flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                        if (flag) {
                            let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                            if (wait_time >= 1) {
                                sleep_time = wait_time;
                                if (DEBUG) {
                                    log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                }
                            }
                        }
                        await playbackSleep(sleep_time);
                        await play_note(sheet_list[i]["note"], "up", flag);
                    }
                } else if (/\.([36$])/.test(sheet_list[i]["spl"])) { // 三连音/六连音（可能包含休止符）
                    temp_legato.push({
                        "note": sheet_list[i]["note"],
                        "chord": sheet_list[i]["chord"],
                        "type": sheet_list[i]["type"],
                        "spl": sheet_list[i]["spl"]
                    });

                    // 演奏连音
                    if (sheet_list[i]["spl"].includes("$")) {
                        // 连音的总时长
                        let time_legato = Math.round(symbol_time * (symbol / sheet_list[i]["type"]));
                        // 当前音符类型
                        let current_type = parseInt(sheet_list[i]["spl"].split(/\./)[0]);
                        // 连音的音符数值总和（用于计算当前音符时长）
                        let time_all = 0;
                        for (let j = 0; j < temp_legato.length; j++) {
                            time_all += 1 / parseInt(temp_legato[j]["spl"].split(/\./)[0], 0);
                        }
                        // 计数
                        let count = 0;

                        for (let j = 0; j < temp_legato.length; j++) {
                            // 当前音符时长
                            let time_current = Math.round(time_legato * (1 / parseInt(temp_legato[j]["spl"].split(/\./)[0], 0)) / time_all);
                            let sleep_time = 0;
                            if (count < temp_legato.length) {
                                sleep_time = time_current;
                            } else if (count === temp_legato.length - 1) {
                                if (i !== sheet_list.length - 1) {
                                    // 计算连音的最后一个音的时值（计算装饰音）
                                    sleep_time = cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i, time_current);
                                }
                            } else if (i !== sheet_list.length - 1) {
                                sleep_time = time_current;
                            }
                            sleep_time = RandomRhythmOffset(sleep_time); // SleepTime

                            if (temp_legato[j]["chord"]) {
                                await play_chord(temp_legato[j]["note"], "down"); // 和弦
                                let flag = false;
                                flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                                if (flag) {
                                    let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                                    if (wait_time >= 1) {
                                        sleep_time = wait_time;
                                        if (DEBUG) {
                                            log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                        }
                                    }
                                }
                                await playbackSleep(sleep_time);
                                await play_chord(temp_legato[j]["note"], "up", flag);
                            } else {
                                if (temp_legato[j]["note"] === '@') { // 休止符
                                    await playbackSleep(sleep_time);
                                } else {
                                    await play_note(temp_legato[j]["note"], "down"); // 单音
                                    let flag = false;
                                    flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                                    if (flag) {
                                        let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                                        if (wait_time >= 1) {
                                            sleep_time = wait_time;
                                            if (DEBUG) {
                                                log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                            }
                                        }
                                    }
                                    await playbackSleep(sleep_time);
                                    await play_note(temp_legato[j]["note"], "up", flag);
                                }
                            }
                            // if (count < temp_legato.length) {
                            //     await sleep(time_current);
                            // } else if (count === temp_legato.length - 1) {
                            //     if (i !== sheet_list.length - 1) {
                            //         // 计算连音的最后一个音的时值（计算装饰音）
                            //         await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i, time_current));
                            //     }
                            // } else if (i !== sheet_list.length - 1) {
                            //     await sleep(time_current);
                            // }
                            count += 1;
                        }
                        // 重置连音缓存区
                        temp_legato = [];
                    }
                } else if (sheet_list[i]["spl"] === '*') { // 附点音符
                    let sleep_time = RandomRhythmOffset(cal_time_ornament(sheet_list, symbol_time * 1.5, symbol, sheet_list[i]["type"], i)); // SleepTime

                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"], "down"); // 和弦
                        let flag = false;
                        flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                        if (flag) {
                            let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                            if (wait_time >= 1) {
                                sleep_time = wait_time;
                                if (DEBUG) {
                                    log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                }
                            }
                        }
                        await playbackSleep(sleep_time);
                        await play_chord(sheet_list[i]["note"], "up", flag);
                    } else {
                        if (sheet_list[i]["note"] === '@') { // 休止符
                            await playbackSleep(sleep_time);
                        } else {
                            await play_note(sheet_list[i]["note"], "down"); // 单音
                            let flag = false;
                            flag = i + 1 < sheet_list.length && hasCommonChar(sheet_list[i]["note"], sheet_list[i + 1]["note"]);
                            if (flag) {
                                let wait_time = sleep_time - lowest_latency; // 提前去lowest_latency
                                if (wait_time >= 1) {
                                    sleep_time = wait_time;
                                    if (DEBUG) {
                                        log.info(wait_time >= 1 ? `提前抬起：预期时长 ${wait_time} ms (原值: ${sleep_time} ms)`: `正常抬起：预期时长 ${sleep_time} ms`);
                                    }
                                }
                            }
                            await playbackSleep(sleep_time);
                            await play_note(sheet_list[i]["note"], "up", flag);
                        }
                    }
                    // // 排除尾音
                    // if (i !== sheet_list.length - 1) {
                    //     await sleep(cal_time_ornament(sheet_list, symbol_time * 1.5, symbol, sheet_list[i]["type"], i));
                    // }
                } else if (sheet_list[i]["spl"] === '%') { // BPM标记
                    const bpm_new = Number(sheet_list[i]["type"]);
                    music_infos[index]["bpm"] = bpm_new;
                    bpm = bpm_new;
                    // 重新计算
                    symbol_time = Math.round(60000 / bpm);
                    ornament_time = Math.round(symbol_time / 16)
                    if (DEBUG) {
                        log.info(`变速：${bpm_new}`);
                    }
                } else if (sheet_list[i]["spl"] === '^' || sheet_list[i]["spl"] === '&') { // 抬起/按下
                    if (sheet_list[i]["chord"]) {
                        if (sheet_list[i]["spl"] === '^') {
                            for (const key of sheet_list[i]["note"]) {
                                musicKeyDown(key);
                            }
                        } else {
                            for (const key of sheet_list[i]["note"]) {
                                musicKeyUp(key);
                            }
                            await playbackSleep(RandomRhythmOffset(lowest_latency)); // SleepTime
                        }
                    } else {
                        if (sheet_list[i]["spl"] === '^') {
                            musicKeyDown(sheet_list[i]["note"]);
                        } else {
                            musicKeyUp(sheet_list[i]["note"]);
                            await playbackSleep(RandomRhythmOffset(lowest_latency)); // SleepTime
                        }
                    }
                } else {
                    log.info(`错误: ${sheet_list[i]["spl"]}`);
                    return null;
                }
            }
            let yq_end_time = Date.now();
            if (DEBUG) {
                log.info(`总计用时：${yq_end_time - yq_start_time}ms`);
            }
        }
    }

    async function waitTargetTime(targetTimeStamp) {
        let now = new Date();
        if (now.getTime() >= targetTimeStamp) return;
        log.info(`等待至目标时间: ${new Date(targetTimeStamp).toLocaleString()}`);
        if ((targetTimeStamp - now.getTime()) > 100) {
            await sleep(targetTimeStamp - now.getTime() - 100);
        }
        while (Date.now() < targetTimeStamp) {
        }
    }

    /**
     * 检查本地曲谱文件与主程序配置是否一致，并自动修正配置settings文件。
     *
     * @param winId
     * @returns {Promise<boolean>} 如果一致返回 true，否则返回 false。
     */
    async function checkSheetFile (winId) {

        // 1. 读取本地所有JSON曲谱文件
        const localMusicList = musicList();

        // 2. 读取JS脚本配置中的曲谱列表
        const js_settings = JSON.parse(file.readTextSync("settings.json"));
        let configMusicList = undefined;
        let indexOfMusicSelector = -1;
        for (let i = 0; i < js_settings.length; i++) {
            if (js_settings[i].name === "music_selector") {
                indexOfMusicSelector = i;
                configMusicList = js_settings[i].options;
                break;
            }
        }
        // 3. 核对两个列表是否相同
        const areArraysEqual = (a, b) => {
            if (a.length !== b.length) return false;
            const sortedA = [...a].sort();
            const sortedB = [...b].sort();
            return sortedA.every((item, index) => item === sortedB[index]);
        };

        if (!areArraysEqual(localMusicList, configMusicList)) {
            // 以本地曲谱为准更新配置
            const updatedSettings = [...js_settings];
            updatedSettings[indexOfMusicSelector].options = localMusicList;
            file.writeTextSync("settings.json", JSON.stringify(updatedSettings, null, 2));
            log.warn("检测到曲谱文件不一致, 已自动适配(以本地曲谱文件为基准)...");
            log.warn("JS脚本配置已更新!");
            if (settings.cover) {
                htmlMask.send(winId, "/config/update", JSON.stringify({ status: "update", msg: "JS脚本配置已更新!", settings: await get_sheet_ins() }));
            }
            return false;
        }
        log.info("未检测到新增曲谱文件，当前已是最新...");
        if (settings.cover) {
            htmlMask.send(winId, "/config/update", JSON.stringify({ status: "latest", msg: "未检测到新增曲谱文件，当前已是最新...", settings: await get_sheet_ins() }));
        }
        return true;
    }

    /**
     *  检测并切换乐器
     * @returns {Promise<void>}
     */
    async function autoSwitchInstrument(instrument) {
        let switchFlag = true;
        // 解析出需要更换的乐器 [DEBUG]多乐器未适配，目前仅选择第一个
        if (instrument.includes(",")) {
            instrument = instrument.split(",")[0]
        }
        // 确认是否已在正确的乐器界面
        let sRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/setting.png`), 1578, 10, 80, 80);
        let gameRegion = captureGameRegion();
        let result = gameRegion.Find(sRo);
        gameRegion.dispose();
        if (result.isExist()) { // 当前处于乐器演奏界面
            click(1618, 48);
            for (let i = 0; i < 30; i++) {
                let gameRegion = captureGameRegion();
                let result = gameRegion.Find(sRo);
                if (!(result.isExist())) {
                    let insName = await Ocr(1035, 166, 254, 109);
                    if (insName && insName.text.includes(instrument)) {  // 当前乐器正确
                        log.info(`当前乐器：${insName.text} （期望：${instrument}）`);
                        keyPress("Escape");
                        switchFlag = false;
                        break;
                    } else if (insName && !(insName.text.includes(instrument))) {  // 当前乐器错误
                        log.info(`当前乐器：${insName.text} （期望：${instrument}）`);
                        await genshin.returnMainUi();
                        break;
                    } else {
                        log.debug(`设置界面未识别到乐器文本... - ${i}`);
                        await sleep(300);
                        if (i === 29) {
                            log.error("打开设置界面超时...");
                        }
                    }
                }
            }
        } else { // 不处于乐器界面则退回到主界面
            await genshin.returnMainUi();
        }

        if (switchFlag) {
            // 确保在主界面
            await genshin.returnMainUi();
            // 检查当前世界是提瓦特还是千星奇域
            await sleep(500);
            keyPress("Escape");
            await sleep(1000);
            let ocrResult_btn = await Ocr(1663, 997, 168, 47);
            await genshin.returnMainUi();
            if (ocrResult_btn && ocrResult_btn.text.includes("提瓦特")) { // 千星奇域
                // 进入乐器选择界面
                keyDown("Z");
                await sleep(1500);
                keyUp("Z");
                await sleep(1000);
                // 查找乐器
                let insRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/instruments/${instrument}.png`), 97, 75, 1191, 891);
                insRo.threshold = 0.8;
                gameRegion = captureGameRegion();
                result = gameRegion.Find(insRo);
                let ocrResult = await Ocr(1333, 122, 441, 48);
                gameRegion.dispose();
                if (result.isExist()) {
                    await sleep(500);
                    result.click();
                    await sleep(500);
                    let ocrText = await Ocr(1633, 985, 142, 67);
                    if (ocrText && ocrText.text.includes("装备")) {
                        click(1692, 1016);
                        await sleep(300);
                    }
                    keyPress("Escape");
                    log.info(`乐器更换完成(${instrument})，将在7s后开始演奏...`);
                    await sleep(5000);
                    keyPress("Z");
                    await sleep(2000);
                    return true;
                } else if (ocrResult && ocrResult.text.includes(instrument)) {
                    keyPress("Escape");
                    log.info(`已经装备乐器(${instrument})，将在7s后开始演奏...`);
                    await sleep(5000);
                    keyPress("Z");
                    await sleep(2000);
                    return true;
                }else {
                    log.error(`未找到乐器，请确保千星奇域支持该乐器：(${instrument})...`);
                    await sleep(10000);
                    return false;

                }
            } else { // 提瓦特
                // 打开背包-小道具
                keyPress("B");
                await sleep(1000);
                click(1054, 48);
                await sleep(1000);
                // 查找乐器
                let insRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/instruments/${instrument}.png`), 97, 75, 1191, 891);
                for (let i = 0; i < 5; i++) {
                    gameRegion = captureGameRegion();
                    result = gameRegion.Find(insRo);
                    gameRegion.dispose();
                    if (result.isExist()) {
                        await sleep(500);
                        result.click();
                        await sleep(500);
                        let ocrText = await Ocr(1656, 993, 92, 47);
                        if (ocrText && ocrText.text.includes("替换")) {
                            click(1686, 1016);
                            await sleep(300);
                        }
                        keyPress("Escape");
                        log.info(`乐器更换完成(${instrument})，将在7s后开始演奏...`);
                        await sleep(5000);
                        keyPress("Z");
                        await sleep(2000);
                        // 检测是否需要选择 联机合奏
                        let ocrResult = await Ocr(867, 272, 185, 57);
                        if (ocrResult && ocrResult.text.includes("联机合奏")) {
                            click(758, 761);
                            await sleep(2000);
                        }
                        return true;
                    } else {
                        await scroll_page(1283, 113, 11, 837, 133, 931, 1288, "Down");
                        await sleep(200);
                    }
                }
                log.error(`未找到乐器，请确保已经购买了乐器: ${instrument}`);
                await sleep(10000);
                return false;
            }

        } else {
            log.info("将在3s后开始演奏...");
            await sleep(3000);
        }
    }

    async function play(winId) {
        if (settings.cover) {
            if (!(await checkSheetFile(winId))) return;
        } else {
            if (!(await checkSheetFile())) return;
        }
        music_infos = [];

        console.log(`${settings_msg}`)
        for (const music_name of settings_msg.musicQueue) {
            const music_info = getMusicInfo(music_name);
            if (music_info === null) {
                log.error(`乐曲 ${music_name} 信息有误，已跳过`);
                continue;
            }
            music_infos.push(music_info);
        }


        const alwaysRepeat = ((settings_msg.playType === PlayType.SingleMusicRepeat || settings_msg.playType === PlayType.QueueMusicRepeat) && (settings_msg.repeatTimes === 0));
        await waitTargetTime(settings_msg.startTime);
        do {
            for (let i = 0; i < music_infos.length; i++) {
                let music_info = music_infos[i];

                if (settings_msg.autoSwitch) {
                    await autoSwitchInstrument(music_info.instrument);  // 检测并切换乐器
                } else {
                    log.info(`建议演奏乐器：${music_info.instrument}`);
                }

                // 检查是否处于乐器界面
                let sRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync(`assets/setting.png`), 1578, 10, 80, 80);
                let gameRegion = captureGameRegion();
                let result = gameRegion.Find(sRo);
                gameRegion.dispose();
                if (!(result.isExist())) {
                    log.error("当前未处于乐器界面...");
                    return null;
                }

                log.info(`开始演奏: ${music_info.name} - ${music_info.author}`);
                switch (music_info.type) {
                    case "yuanqin":
                        await play_sheet(i, music_info.notes, music_info.bpm, music_info.time_signature);
                        break;
                    case "midi":
                        await play_sheet(i, music_info.notes, music_info.bpm, music_info.time_signature, music_info.ticks);
                        break;
                    case "keyboard":
                        if (DEBUG) {
                            log.info(`乐曲已打印至${music_info.name}.json`)
                            let info = []
                            music_info.notes.forEach((note, index) => {
                                info.push([index, ...note]);
                            });
                            file.writeTextSync(`${music_info.name}.json`, `${JSON.stringify(info)}`);
                        }
                        await listNotePlay(music_info.notes, (60000 / music_info.bpm));
                        break;
                    default:
                        break;
                }
                if (settings_msg.queueInterval > 0) await playbackSleep(settings_msg.queueInterval * 1000);
            }
            if (settings_msg.repeatInterval > 0) await playbackSleep(settings_msg.repeatInterval * 1000);
        } while (alwaysRepeat || --settings_msg.repeatTimes > 0);
    }

    /**
     * 随机节奏偏移（模拟真人演奏）
     * 以一定概率对给定时长进行随机百分比偏移，达到“人性化”效果
     * 仅在 DEBUG 模式下生效，配置从 settings.random_rhythm_offset 读取
     * 配置格式："概率 范围百分比"，例如 "0.05 10" 表示 5% 概率 ±10% 偏移
     *
     * @param {number} duration - 原始时长，单位毫秒（正整数）
     * @returns {number} 偏移后的时长（整数毫秒），若未触发或偏移后时长过小则返回原始时长
     */
    function RandomRhythmOffset(duration) {
        // 仅在调试模式下启用此功能
        if (!DEBUG) {
            return duration;
        }

        // 解析配置，增加容错处理
        const config = settings.random_rhythm_offset || "0.05 10";
        const parts = config.split(/\s+/).filter(s => s !== '');
        if (parts.length < 2) {
            return duration; // 配置格式错误，直接返回原值
        }
        const probability = parseFloat(parts[0]);
        const rangePercent = parseFloat(parts[1]);

        // 校验参数合法性
        if (isNaN(probability) || isNaN(rangePercent) || probability < 0 || probability > 1 || rangePercent < 0) {
            return duration;
        }

        // 根据概率决定是否偏移
        if (Math.random() < probability) {
            // 生成 [-rangePercent%, +rangePercent%] 范围内的随机比例因子
            const offsetFactor = (Math.random() * 2 - 1) * (rangePercent / 100);
            let newDuration = Math.round(duration * (1 + offsetFactor));

            if (newDuration >= 40) log.info(`触发概率: ${probability} 偏移量: ${offsetFactor.toFixed(2)} 时长: ${newDuration}|${duration}(原)`);

            // 如果偏移后的时长小于 40ms，则舍弃偏移，返回原始时长
            if (newDuration < 40) {
                return duration;
            }
            return newDuration;
        }

        // 未触发，返回原始时长
        return duration;
    }

    /**
     * ------- 主程序 --------
     */
    async function main() {
        const pauseHotkey = registerPauseHotkey();
        try {
        if (settings.cover) {
            const winId = htmlMask.show("assets/index.html");
            activePlaybackWindowId = winId;
            htmlMask.setClickThrough(winId, false);

            // 持续接收 HTML 消息
            while (htmlMask.exists(winId)) {
                const msg = await htmlMask.receive(winId);
                if (msg) {
                    const parsed = JSON.parse(msg);

                    switch (parsed.url) {
                        case "/event/click":
                            if (playbackTask !== null) {
                                htmlMask.send(winId, "/playback/state", JSON.stringify({ playing: true, paused: playbackPaused, hotkey: getPauseHotkey(), message: "已有乐曲正在演奏" }));
                                break;
                            }
                            htmlMask.send(winId, "/frame/minimize", "minimize");
                            // 演奏时保持鼠标穿透，使用全局自定义热键暂停，不影响游戏操作。
                            htmlMask.setClickThrough(winId, true);
                            settings_msg = parsed.data;
                            resetPlaybackState();
                            htmlMask.send(winId, "/playback/state", JSON.stringify({ playing: true, paused: false, hotkey: getPauseHotkey() }));
                            playbackTask = (async () => {
                                try {
                                    await play(winId);
                                } catch (error) {
                                    log.error(`演奏过程中出错：${error}`);
                                } finally {
                                    resetPlaybackState();
                                    playbackTask = null;
                                    if (htmlMask.exists(winId)) {
                                        htmlMask.send(winId, "/playback/state", JSON.stringify({ playing: false, paused: false, hotkey: getPauseHotkey() }));
                                        htmlMask.send(winId, "/frame/restore", "restore");
                                        htmlMask.setClickThrough(winId, false);
                                    }
                                }
                            })();
                            break;
                        case "/playback/pause":
                            if (playbackTask === null) {
                                htmlMask.send(winId, "/playback/state", JSON.stringify({ playing: false, paused: false, hotkey: getPauseHotkey(), message: "当前没有正在演奏的乐曲" }));
                                break;
                            }
                            setPlaybackPaused(parsed.data && typeof parsed.data.paused === "boolean" ? parsed.data.paused : !playbackPaused);
                            htmlMask.send(winId, "/playback/state", JSON.stringify({ playing: true, paused: playbackPaused, hotkey: getPauseHotkey() }));
                            break;
                        case "/config/update":
                            await checkSheetFile(winId);
                            break;
                        case "/window/close":
                            return null;
                        case "/config/settings":
                            await checkSheetFile(winId);
                            htmlMask.send(winId, "/config/settings", JSON.stringify(settings_msg));
                            break;
                        case "/debug":
                            log.info(`${parsed.data}`);
                            break;

                    }
                }
            }

            htmlMask.close(winId);
            activePlaybackWindowId = null;
        } else {
            resetPlaybackState();
            playbackTask = play();
            try {
                await playbackTask;
            } finally {
                resetPlaybackState();
                playbackTask = null;
            }
        }
        } finally {
            pauseHotkey.removeAllListeners();
            pauseHotkey.dispose();
        }
    }
    await main();

})();
