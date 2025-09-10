(async function () {
    // 待解决问题: 连音总时值如果为3个四分音符无法表示

    // 乐曲名(带序号)
    const music_list = [
        "1.小星星",
        "2.小星星变奏曲",
        "3.Unknown Mother Goose [アンノウン・マザーグース]",
        "4.铃芽之旅[Suzume]",
        "5.Flower Dance",
        "6.起风了",
        "7.千本樱 (Eric Chen)",
        "8.春よ、来い(春天，来吧)",
        "9.One Last Kiss",
        "10.卡农(MIDI转谱)",
        "11.圆号卡农"
    ];
    const base_path = "assets/";

    const PlayMode = {
        SingleMusicOnce: 0, // 单曲单次执行
        SingleMusicRepeat: 1, // 单曲循环执行
        QueueMusicOnce: 2, // 队列单次执行
        QueueMusicRepeat: 3, // 队列循环执行
    };
    /**
     * --------工具函数--------
     */
    /**
     * 获取JS脚本配置
     * @typedef {Map} Config
     * @returns {Config} 包含解析后JS脚本配置的对象，具有以下属性:
     * @property {Number} playMode 播放模式
     * @property {Array.String} musicQueue 乐曲队列
     * @property {Number} queueInterval 队列内间隔
     * @property {Number} repeatCount 循环次数
     * @property {Number} repeatInterval 循环间隔
     */
    function get_settings() {
        try {
            // 播放模式 enum
            const Settings = {
                playMode: undefined, // 播放模式
                musicQueue: [], // 乐曲队列
                queueInterval: 0, // 队列内间隔
                repeatCount: 1, // 循环次数
                repeatInterval: 0, // 循环间隔
            };

            switch (settings.type_select) {
                case "单曲单次执行":
                    Settings.playMode = PlayMode.SingleMusicOnce;
                    break;
                case "单曲循环":
                    Settings.playMode = PlayMode.SingleMusicRepeat;
                    break;
                case "队列单次执行":
                    Settings.playMode = PlayMode.QueueMusicOnce;
                    break;
                case "队列循环":
                    Settings.playMode = PlayMode.QueueMusicRepeat;
                    break;
                default:
                    Settings.playMode = PlayMode.SingleMusicOnce;
                    break;
            }

            // 读取曲名 String
            if ((Settings.playMode == PlayMode.SingleMusicOnce || Settings.playMode == PlayMode.SingleMusicRepeat)) {
                if (typeof settings.music_name !== "undefined") {
                    Settings.musicQueue.push(settings.music_name); // 直接读取曲名 String
                } else if (typeof settings.music_selector !== "undefined") {
                    Settings.musicQueue.push(music_list[parseInt(settings.music_selector.split(".")[0], 10) - 1]);// 选择器从1开始 Number
                }
            }
            else if (Settings.playMode == PlayMode.QueueMusicOnce || Settings.playMode == PlayMode.QueueMusicRepeat) {
                if (typeof settings.music_queue !== "undefined") {
                    let indexList = settings.music_queue.split(" ").filter((item) => /^[0-9]+$/.test(item)).map((num) => parseInt(num, 10) - 1);// 读取曲名列表 Number[]
                    for (const index of indexList) {
                        if (index >= 0 && index < music_list.length) {
                            Settings.musicQueue.push(music_list[index]);
                        }
                    }
                }
            }

            // 读取队列间隔时间 Number
            Settings.queueInterval = (typeof settings.music_interval === "undefined") ? (0) : (parseInt(settings.music_interval, 10));
            // 读取循环次数 Number
            Settings.repeatCount = (typeof settings.music_repeat === "undefined") ? (1) : (parseInt(settings.music_repeat, 10));
            // 读取循环间隔时间 Number
            Settings.repeatInterval = (typeof settings.repeat_interval === "undefined") ? (0) : (parseInt(settings.repeat_interval, 10));

            return Settings;
        } catch (error) {
            log.error(`读取JS脚本配置时出错: ${error}`);
        }
    }

    /**
     * 执行单音
     * @param key {string}
     */
    async function play_note(key) {
        keyDown(key);
        keyUp(key);
    }

    /**
     * 执行和弦
     * @param keys {Array.string}
     */
    async function play_chord(keys) {
        for (const key of keys) {
            play_note(key);
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
         * @description wait:小节开始时此音符需要先等待多久,单位为一拍时间
         * @description key:键盘按键
         * @description presstime:此音符需要持续的时长,单位为一拍时间
         */
        async function notePlay(note, gap) {
            const wait = note["offset"];
            const key = note["key"];
            const time = note["time"];
            await sleep(Math.floor(wait * gap));
            // log.info(`按键:${key},时长:${time}`);
            // log.info(`音符 ${key} 音符时长 ${time}`);
            keyDown(key);
            await sleep(Math.floor(time * gap));
            keyUp(key);
        }
        log.info(`总计 ${bar_list.length} 小节, 预计演奏时长 ${bar_list.length * gap * 4 / 1000}秒`);
        for (let i = 0; i < bar_list.length; i++) {
            let bar = bar_list[i];
            let barTime = bar[0];
            let notes = bar.slice(1);
            for (let j = 0; j < notes.length; j++) {
                let note = notes[j];
                notePlay(note, gap); // 启动音符异步函数
            }
            await sleep(barTime * gap); // 等待小节结束
        }
        await sleep(gap * 8); // 额外等待
    }

    /**
     * 根据乐曲文件名生成乐曲文件路径
     * @param music_name 乐曲文件名
     * @returns {string} 乐曲文件路径
     */
    function path_join(music_name) {
        return base_path + music_name + ".json";
    }

    /**
     * 计算音符的持续时间，并根据乐谱中的装饰音进行调整
     *
     * @param {Array<Object>} sheet_list - 乐谱中的音符对象列表
     * @param {number} symbol_time - 音符符号的基础时长
     * @param {number} symbol - 当前音符的符号值
     * @param {number} note_type - 音符的类型值（用于计算时长的分母）
     * @param {number} count - 当前音符在 sheet_list 中的索引
     * @param {number} [note_time] - 可选参数音符的预计算时长
     * @returns {number|undefined} 计算出的音符时长（可能因装饰音而减少），如果发生错误则返回 undefined
     */
    function calDurationWithOrnament(
        sheet_list,
        symbol_time,
        symbol,
        note_type,
        count,
        note_time = undefined
    ) {
        try {
            if (note_time === undefined) {
                // 该音符的正常时长
                note_time = Math.round(symbol_time * (symbol / note_type));
            }
            // 装饰音时长
            let ornament_time = Math.round(symbol_time / 16);

            let check_count = count + 1;
            let ornament_count = 0; // 装饰音计数

            while (check_count < sheet_list.length) {
                // 装饰音不可能在曲谱末尾，else会在匹配不到装饰音的循环触发
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
        } catch (error) {
            log.error(`出错(cal_time_ornament): ${error}`);
        }
    }

    /**
     * 解析乐谱JSON文件并返回其元数据和音符信息
     * 
     * @async
     * @function getMusicMsg
     * @param {string} music_name - 要解析的乐谱文件名称
     * @returns {Promise<Object|undefined>} 包含乐谱元数据和音符信息的对象，解析失败时返回undefined
     * @property {string} name - 乐谱名称
     * @property {string} archor - 乐谱作者
     * @property {string} description - 乐谱描述
     * @property {string} instrument - 乐谱推荐演奏乐器
     * @property {string} type - 乐谱类型(合法值："yuanqin", "keyboard", "midi")
     * @property {number} bpm - 乐谱的每分钟节拍数
     * @property {string} timeSignature - 乐谱拍号(如："3/4")
     * @property {string} composer - 乐谱作曲者
     * @property {string} arranger - 乐谱编曲者
     * @property {any} notes - 解析后的乐谱音符信息，具体格式取决于乐谱类型
     */
    async function getMusicInfo(music_name) {
        function jsonCheck(json) {
            try {
                // 必要信息检查
                if (json.name === undefined) throw new Error(`乐谱名称为空`);
                if (json.type === undefined) throw new Error(`乐谱类型为空`);
                if (json.bpm === undefined) throw new Error(`乐谱BPM为空`);
                if (json.notes === undefined) throw new Error(`乐谱音符信息为空`);
                if ((json.time_signature === undefined) == (json.type !== "keyboard")) throw new Error(`乐谱拍号为空`);
                return true;
            }
            catch (error) {
                log.error(`解析乐谱失败: ${error}`);
                return false;
            }

        }
        const musicMessage = {
            name: undefined,
            archor: undefined,
            description: undefined,
            instrument: undefined,
            type: undefined,
            bpm: undefined,
            timeSignature: undefined,
            composer: undefined,
            arranger: undefined,
            notes: undefined,
        };

        let music_path = path_join(music_name);
        let jsonObj = null; // 存储解析后的乐曲文件

        try {
            jsonObj = JSON.parse(file.readTextSync(music_path));
        }
        catch (error) {
            log.error(`解析乐谱失败: ${error}`);
        }
        if (jsonCheck(jsonObj) === false) return null;

        // 必要信息
        musicMessage.name = (typeof jsonObj.name !== "undefined") ? ("未知乐曲") : (jsonObj.name);
        musicMessage.type = (typeof jsonObj.type === "undefined") ? ("yuanqin") : (jsonObj.type);
        musicMessage.bpm = (isNaN(parseInt(jsonObj.bpm, 10))) ? (120) : (parseInt(jsonObj.bpm, 10));
        musicMessage.timeSignature = (typeof jsonObj.ts === "undefined") ? ("4/4") : (jsonObj.ts);
        musicMessage.notes = (typeof jsonObj.notes === "undefined") ? ("") : (jsonObj.notes);
        // 可选信息
        musicMessage.instrument = (typeof jsonObj.instrument !== "undefined") ? (jsonObj.instrument) : ("无推荐乐器");
        musicMessage.archor = (typeof jsonObj.author !== "undefined") ? (jsonObj.author) : ("未知作者");
        musicMessage.description = (typeof jsonObj.description !== "undefined") ? (jsonObj.description) : ("无描述");
        musicMessage.composer = (typeof jsonObj.composer !== "undefined") ? (jsonObj.composer) : ("未知作曲");
        musicMessage.arranger = (typeof jsonObj.arranger !== "undefined") ? (jsonObj.arranger) : ("未知编曲");
        // 乐谱解析 TODO
        if (musicMessage.type === "yuanqin") {
            musicMessage.notes = parseMusicSheet(jsonObj.notes.replace(/[\r\n]/g, ""));
        }
        else if (musicMessage.type === "keyboard") {
            musicMessage.notes = keySheetSerialization(jsonObj.notes);
        }
        else if (musicMessage.type === "midi") {
            log.info("MIDI乐谱解析中，请稍候...");
            musicMessage.notes = musicMessage.notes;
        }

        return musicMessage;
    }

    /**
     * 解析乐谱字符串或对象为音符对象数组
     * 
     * 小节之间用|隔开且乐谱中不能有空格，单个小节的解析规则如下:
     * A[4] 表示按下A键，A键视作四分音符
     * (ASD)[4-#] 表示同时按下ASD键，这个和弦视作四分音符的装饰音
     * A[4-3](AS)[4-3](ASD)[4-3] 表示等分四分音符的三连音(-后填3必须要连着写三个这样的音符)，按顺序按下A、AS、ASD键
     * @[4] 表示休止符，中括号内标明这是几分休止符，例如这里表示4分休止符
     * 
     * 输入字符串按小节线('|')分割，每个音符解析以下属性：
     * - note: 音符字符(可为单个或多个字符)，'@'表示休止符，圆括号内为和弦
     * - type: 音符类型，从方括号中解析(例如[1]、[2-abc])
     * - chord: 布尔值，表示是否为和弦(由圆括号包裹)
     * - spl: 特殊音符属性，当类型包含连字符时解析(例如[2-abc] => spl: 'abc')
     * 
     * 附:
     * 中括号(-前表示音符类型-后用于区分特殊音符): [填4表示4分音符，填16表示16分音符...-填#表示装饰音，填3表示三连音] 例: [16-#]

     * 若输入已是对象，则直接返回
     * 
     * @param {string|Object} sheet - 待解析的乐谱，可为字符串或对象
     * @returns {Array<Object>} 解析后的音符对象数组，包含属性：note, type, chord, spl
     */
    function parseMusicSheet(sheet) {
        let result = [];

        if (typeof sheet === "object") {
            result = sheet;
        } else {
            // 将输入字符串按照小节分割
            let bars = sheet.split("|");

            // 遍历每个小节
            bars.forEach((bar) => {
                let i = 0;

                // 逐个字符解析小节中的音符及其属性
                while (i < bar.length) {
                    let note = ""; // 存储音符
                    let type = ""; // 存储音符类型
                    let chord = false; // 判断是否为和弦
                    let spl = "none"; // 存储特殊音符属性，默认值为 "none"

                    // 检查是否为和弦(和弦用圆括号包裹)
                    if (bar[i] === "(") {
                        chord = true;
                        i++;
                        while (bar[i] !== ")") {
                            note += bar[i];
                            i++;
                        }
                        i++; // 跳过闭合圆括号
                    } else if (bar[i] === "@") {
                        // 处理休止符
                        note = "@";
                        i++;
                    } else {
                        note = bar[i];
                        i++;
                    }

                    // 解析音符类型(用方括号包裹)
                    if (bar[i] === "[") {
                        i++;
                        while (bar[i] !== "]") {
                            type += bar[i];
                            i++;
                        }
                        i++; // 跳过闭合方括号
                    }

                    // 解析特殊音符属性(如果type中包含'-')
                    if (type.includes("-")) {
                        let splIndex = type.indexOf("-");
                        spl = type.slice(splIndex + 1);
                        type = parseInt(type.slice(0, splIndex), 10);
                    }

                    // 将解析结果添加到parsedNotes数组中
                    result.push({
                        note: note,
                        type: type,
                        chord: chord,
                        spl: spl,
                    });
                }
            });
        }

        return result;
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
            grouped[Math.floor(note.beats / 4)].push({ ...note, offset: note.beats % 4 + note.offset, key: note.key, time: note.time });
        }
        return grouped;
    }

    /**
     * 根据提供的乐谱列表、BPM和拍号演奏一系列音符或和弦。
     * 处理不同的音符类型，包括单音、和弦、休止符、装饰音、连音和附点音符。
     *
     * @async
     * @param {Array<Object>} sheet_list - 要演奏的音符对象列表。每个对象应包含诸如 "note"、"type"、"spl" 等属性，并可选择性地包含 "chord" 和 "time"。
     * @param {number} bpm - 每分钟节拍数，决定播放速度。
     * @param {string} ts - 拍号，格式为 "分子/分母"（例如："4/4"）。
     * @returns {Promise<void>} 当整个乐谱演奏完毕时解析。
     */
    async function play_sheet(sheet_list, bpm, ts) {
        if (Object.keys(sheet_list[0]).length === 3) {
            for (let i = 0; i < sheet_list.length; i++) {
                await sleep(Math.round(sheet_list[i]["time"]));
                if (sheet_list[i]["type"] === "on") {
                    keyDown(sheet_list[i]["note"]);
                } else {
                    keyUp(sheet_list[i]["note"]);
                }
            }
        } else {
            // 确定是以几分音符为一拍
            let symbol = parseInt(ts.split("/")[1], 10);
            // 每拍所需的时间
            let symbol_time = Math.round(60000 / bpm);
            // 装饰音时长
            let ornament_time = Math.round(symbol_time / 16);
            // 存储连音
            let temp_legato = [];

            // test 需要额外计算装饰音时值的影响
            for (let i = 0; i < sheet_list.length; i++) {
                // 显示正在演奏的音符
                // log.info(
                //     `${sheet_list[i]["note"]}[${sheet_list[i]["type"]}-${sheet_list[i]["spl"]}]`
                // );
                if (sheet_list[i]["spl"] === "none") {
                    // 单音、休止符或和弦
                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"]); // 和弦
                    } else {
                        if (sheet_list[i]["note"] === "@") {
                            // 休止符
                            // pass
                        } else {
                            await play_note(sheet_list[i]["note"]); // 单音
                        }
                    }

                    if (i !== sheet_list.length - 1) {
                        await sleep(
                            calDurationWithOrnament(
                                sheet_list,
                                symbol_time,
                                symbol,
                                sheet_list[i]["type"],
                                i
                            )
                        );
                    }
                } else if (sheet_list[i]["spl"] === "#") {
                    // 装饰音(不会包含休止符)，时值为symbol的时值的1/16
                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"]); // 和弦
                    } else {
                        await play_note(sheet_list[i]["note"]); // 单音
                    }
                    if (i !== sheet_list.length - 1) {
                        await sleep(ornament_time);
                    }
                } else if (/\.3|\.6|\.\$/.test(sheet_list[i]["spl"])) {
                    // 三连音/六连音(可能包含休止符)
                    temp_legato.push({
                        note: sheet_list[i]["note"],
                        chord: sheet_list[i]["chord"],
                        type: sheet_list[i]["type"],
                    });

                    // 演奏连音
                    if ("$".includes(sheet_list[i]["spl"])) {
                        // 连音的总时长
                        let time_legato = Math.round(
                            symbol_time * (symbol / sheet_list[i]["type"])
                        );
                        // 当前音符类型
                        let current_type = parseInt(sheet_list[i]["spl"].split(".")[0]);
                        // 连音的音符数值总和(用于计算当前音符时长)
                        let time_all = temp_legato.reduce(
                            (sum, each) => sum + 1 / parseInt(each["spl"].split(".")[0]),
                            0
                        );
                        // 当前音符时长
                        let time_current = Math.round(
                            (time_legato * (1 / current_type)) / time_all
                        );
                        // 计数
                        let count = undefined;

                        for (const note_legato of temp_legato) {
                            if (sheet_list[i]["chord"]) {
                                await play_chord(sheet_list[i]["note"]); // 和弦
                            } else {
                                if (sheet_list[i]["note"] === "@") {
                                    // 休止符
                                    // pass
                                } else {
                                    await play_note(sheet_list[i]["note"]); // 单音
                                }
                            }

                            if (
                                count === temp_legato.length - 1 &&
                                i !== sheet_list.length - 1
                            ) {
                                // 计算连音的最后一个音的时值(计算装饰音)
                                await sleep(
                                    calDurationWithOrnament(
                                        sheet_list,
                                        symbol_time,
                                        symbol,
                                        sheet_list[i]["type"],
                                        i,
                                        time_current
                                    )
                                );
                                // 重置连音缓存区
                                temp_legato = [];
                            } else if (i !== sheet_list.length - 1) {
                                await sleep(time_current);
                            }
                            count += 1;
                        }
                    }
                } else if (sheet_list[i]["spl"] === "*") {
                    // 附点音符
                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"]); // 和弦
                    } else {
                        if (sheet_list[i]["note"] === "@") {
                            // 休止符
                            // pass
                        } else {
                            await play_note(sheet_list[i]["note"]); // 单音
                        }
                    }
                    // 排除尾音
                    if (i !== sheet_list.length - 1) {
                        await sleep(
                            calDurationWithOrnament(
                                sheet_list,
                                symbol_time * 1.5,
                                symbol,
                                sheet_list[i]["type"],
                                i
                            )
                        );
                    }
                } else {
                    log.info(`错误: ${sheet_list[i]["spl"]}`);
                    return null;
                }
            }
        }
    }

    async function main() {
        try {
            const scriptSettings = get_settings();
            if (scriptSettings.musicQueue.length === 0) {
                log.error("乐曲列表为空，请检查脚本配置");
                return;
            }
            log.info("当前设置  :");
            log.info(`播放模式  : ${settings.type_select}`);
            log.info(`乐曲列表  : ${scriptSettings.musicQueue}`);
            log.info(`队列内间隔: ${scriptSettings.queueInterval}s`);
            log.info(`循环间隔  : ${scriptSettings.repeatInterval}s`);
            const alwaysPlay = ((scriptSettings.playMode === PlayMode.SingleMusicRepeat || scriptSettings.playMode === PlayMode.QueueMusicRepeat) && (scriptSettings.repeatCount === 0));
            if (alwaysPlay) {
                log.info("循环次数  : 无限循环");
            }
            else {
                log.info(`循环次数  : ${scriptSettings.repeatCount}`);
            }
            const musicQueue = new Array();
            // 解析乐谱
            for (let music_name of scriptSettings.musicQueue) {
                let musicInfo = await getMusicInfo(music_name);
                if (musicInfo === null) {
                    log.error(`乐曲 ${music_name} 信息获取失败，跳过此曲`);
                    continue;
                }
                musicQueue.push(musicInfo);
            }
            do {
                for (let music of musicQueue) {
                    let music_name = music.name;
                    let music_bpm = music.bpm;
                    let music_type = music.type;
                    let music_ts = music.timeSignature;
                    let music_notes = music.notes;

                    log.info("----------");
                    log.info(`开始演奏乐曲: ${music_name}`);
                    log.info(`乐曲类型  : ${music_type}`);
                    log.info(`乐曲BPM: ${music_bpm} 乐曲拍号  : ${music_ts} 推荐乐器 : ${music.instrument}`);
                    log.info(`乐曲作者  : ${music.archor} 作曲 : ${music.composer} 编曲 : ${music.arranger}`);
                    log.info(`乐曲描述  : ${music.description}`);
                    log.info("----------");
                    switch (music_type) {
                        case "yuanqin":
                            await play_sheet(music_notes, music_bpm, music_ts);
                            break;
                        case "keyboard":
                            await listNotePlay(music_notes, Math.round(60000 / music_bpm));
                            break;
                        case "midi":
                            await play_sheet(music_notes, music_bpm, music_ts);
                            break;
                        default:
                            break;
                    }
                    if (scriptSettings.playMode === PlayMode.QueueMusicOnce || scriptSettings.playMode === PlayMode.QueueMusicRepeat) {
                        await sleep(scriptSettings.queueInterval * 1000);
                    }
                }
                if (scriptSettings.playMode === PlayMode.SingleMusicOnce) {
                    break;
                }
                else if (scriptSettings.playMode === PlayMode.QueueMusicOnce) {
                    break;
                } else if (scriptSettings.playMode === PlayMode.SingleMusicRepeat) {
                    await sleep(scriptSettings.repeatInterval * 1000);
                } else if (scriptSettings.playMode === PlayMode.QueueMusicRepeat) {
                    await sleep(scriptSettings.repeatInterval * 1000);
                }
                scriptSettings.repeatCount -= 1;
            } while (alwaysPlay || scriptSettings.repeatCount > 0)
        }
        catch (error) {
            log.error(`获取脚本配置失败: ${error}`);
            return;
        }
    }

    await main();

})();
