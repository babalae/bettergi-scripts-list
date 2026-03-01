(async function () { // 待解决问题: 连音总时值如果为3个四分音符无法表示
    const base_path = "assets/score_file/";
    const regex_name = /(?<=score_file\\)[\s\S]*?(?=.json)/;
    const PlayType = {
        SingleMusicOnce: 0, // 单曲单次执行
        SingleMusicRepeat: 1, // 单曲循环执行
        QueueMusicOnce: 2, // 队列单次执行
        QueueMusicRepeat: 3, // 队列循环执行
    };
    let DEBUG = false;
    /**
     * -------- 工具函数 --------
     */
    /**
     * 
     * @returns {Array} 本地曲谱文件列表
     */
    const musicList = () => {
        const scoreFiles = Array.from(file.readPathSync(base_path)).filter(path => !file.isFolder(path) && path.endsWith(".json"));
        const localMusicList = scoreFiles.map(path => path.match(regex_name)[0]);
        return localMusicList;
    }
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
            queueInterval: 0,
            repeatTimes: 1,
            repeatInterval: 0,
            debug: false
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

            // 读取队列间隔时间
            Settings.queueInterval = (typeof (settings.music_interval) === 'undefined') ? (0) : parseInt(settings.music_interval, 10);
            // 读取循环次数
            Settings.repeatTimes = (typeof (settings.music_repeat) === 'undefined') ? (1) : parseInt(settings.music_repeat, 10);
            // 读取循环间隔时间
            Settings.repeatInterval = (typeof (settings.repeat_interval) === 'undefined') ? (0) : parseInt(settings.repeat_interval, 10);
            // 读取乐曲队列 Array[musicName]
            if (Settings.playType === PlayType.SingleMusicOnce || Settings.playType === PlayType.singleRepeat) {
                Settings.musicQueue.push((typeof (settings.music_selector) === 'undefined') ? (undefined) : (settings.music_selector));
            }
            else {
                let music_queue = (typeof (settings.music_queue) === 'undefined') ? (undefined) : (settings.music_queue);
                if (music_queue === undefined) throw new Error("队列执行无序号");
                let musicIndex = Array.from(new Set(music_queue.split(' ').filter(item => item !== ""))); // 去重
                musicList().forEach(music => {
                    for (let index = 0; index < musicIndex.length; index += 1) {
                        if (music.includes(musicIndex[index])) {
                            Settings.musicQueue.push(music);
                            musicIndex.splice(index, 1);
                        }
                    }
                });
            }
            Settings.debug = (typeof (settings.debug) === 'undefined') ? (false) : (settings.debug === "启用");
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
        MusicInfo.instrument = (music_msg_dic.instrument !== undefined) ? (music_msg_dic.instrument) : ("无建议乐器");
        MusicInfo.description = (music_msg_dic.description !== undefined) ? (music_msg_dic.description) : ("无描述");
        MusicInfo.composer = (music_msg_dic.composer !== undefined) ? (music_msg_dic.composer) : ("未知作曲者");
        MusicInfo.arranger = (music_msg_dic.arranger !== undefined) ? (music_msg_dic.arranger) : ("未知编曲者");
        // 必要信息
        MusicInfo.type = (music_msg_dic.type !== undefined) ? (music_msg_dic.type) : ("yuanqin");
        MusicInfo.bpm = (music_msg_dic.bpm !== undefined) ? (music_msg_dic.bpm) : (120);
        MusicInfo.time_signature = (music_msg_dic.time_signature !== undefined) ? (music_msg_dic.time_signature) : ("4/4");

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
     *
     */
    async function play_note(key) {
        keyDown(key);
        keyUp(key);
    }

    /**
     *
     * 执行和弦
     *
     * @param keys {Array.string}
     *
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
         * @description offset:小节开始时此音符需要先等待多久,单位为一拍时间
         * @description key:键盘按键
         * @description time:此音符需要持续的时长,单位为一拍时间
         */
        async function notePlay(note, gap) {
            const wait = note["offset"];
            const key = note["key"];
            const time = note["time"];
            await sleep(Math.floor(wait * gap));
            keyDown(key);
            await sleep(Math.floor(time * gap));
            keyUp(key);
        }
        log.info(`总计 ${bar_list.length} 小节, 预计演奏时长 ${(bar_list.length * gap * bar_list[0][0] / 1000).toFixed(2)}秒`);
        for (let i = 0; i < bar_list.length; i++) {
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
            await sleep(Math.floor(barTime * gap)); // 等待小节结束
        }
        await sleep(Math.floor(gap * 8)); // 额外等待
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
     * @param sheet_list {Object[][]} 解析后的乐谱
     * @param bpm BPM (240)
     * @param ts 拍号 (3/4)
     * @returns {Promise<void>}
     */
    async function play_sheet(sheet_list, bpm, ts) {
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
            } catch (error) {
                log.error(`出错(cal_time_ornament): ${error}`);
            }

        }
        // 如果是midi转换的乐谱
        if (Object.keys(sheet_list[0]).length === 3) {
            for (let i = 0; i < sheet_list.length; i++) {
                log.info(`时长：${sheet_list[i]["time"]}`)
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
            let ornament_time = Math.round(symbol_time / 16)
            // 存储连音
            let temp_legato = [];

            // test 需要额外计算装饰音时值的影响
            for (let i = 0; i < sheet_list.length; i++) {
                // 显示正在演奏的音符
                if (DEBUG) {
                    log.info(`${sheet_list[i]["note"]}[${sheet_list[i]["type"]}-${sheet_list[i]["spl"]}]`);
                }
                if (sheet_list[i]["spl"] === 'none') { // 单音、休止符或和弦
                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"]); // 和弦
                    } else {
                        if (sheet_list[i]["note"] === '@') { // 休止符
                            // pass
                        } else {
                            await play_note(sheet_list[i]["note"]); // 单音
                        }
                    }

                    if (i !== sheet_list.length - 1) {
                        await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i));
                    }
                } else if (sheet_list[i]["spl"] === '#') { // 装饰音（不会包含休止符），时值为symbol的时值的1/16
                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"]); // 和弦
                    } else {
                        await play_note(sheet_list[i]["note"]); // 单音
                    }
                    if (i !== sheet_list.length - 1) {
                        await sleep(ornament_time);
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
                        let current_type = parseInt(sheet_list[i]["spl"].split(/\./)[0])
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

                            if (temp_legato[j]["chord"]) {
                                await play_chord(temp_legato[j]["note"]); // 和弦
                            } else {
                                if (temp_legato[j]["note"] === '@') { // 休止符
                                    // pass
                                } else {
                                    await play_note(temp_legato[j]["note"]); // 单音
                                }
                            }
                            if (count < temp_legato.length) {
                                await sleep(time_current);
                            } else if (count === temp_legato.length - 1) {
                                if (i !== sheet_list.length - 1) {
                                    // 计算连音的最后一个音的时值（计算装饰音）
                                    await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i, time_current));
                                }
                            } else if (i !== sheet_list.length - 1) {
                                await sleep(time_current);
                            }
                            count += 1;
                        }
                        // 重置连音缓存区
                        temp_legato = [];
                    }
                } else if (sheet_list[i]["spl"] === '*') { // 附点音符
                    if (sheet_list[i]["chord"]) {
                        await play_chord(sheet_list[i]["note"]); // 和弦
                    } else {
                        if (sheet_list[i]["note"] === '@') { // 休止符
                            // pass
                        } else {
                            await play_note(sheet_list[i]["note"]); // 单音
                        }
                    }
                    // 排除尾音
                    if (i !== sheet_list.length - 1) {
                        await sleep(cal_time_ornament(sheet_list, symbol_time * 1.5, symbol, sheet_list[i]["type"], i));
                    }
                } else {
                    log.info(`错误: ${sheet_list[i]["spl"]}`);
                    return null;
                }
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
        return;
    }

    /**
     * 检查本地曲谱文件与主程序配置是否一致，并自动修正配置文件。
     *
     * @returns {boolean} 如果一致返回 true，否则返回 false。
     */
    function checkSheetFile() {
        try {
            // 1. 读取本地所有JSON曲谱文件
            const localMusicList = musicList();

            // 2. 读取JS脚本配置中的曲谱列表
            const settings = JSON.parse(file.readTextSync("settings.json"));
            let configMusicList = undefined;
            let indexOfMusicSelector = -1;
            for (let i = 0; i < settings.length; i++) {
                if (settings[i].name === "music_selector") {
                    indexOfMusicSelector = i;
                    configMusicList = settings[i].options;
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
                const updatedSettings = [...settings];
                updatedSettings[indexOfMusicSelector].options = localMusicList;
                file.writeTextSync("settings.json", JSON.stringify(updatedSettings, null, 2));
                log.warn("检测到曲谱文件不一致, 已自动修改settings(以本地曲谱文件为基准)...");
                log.warn("JS脚本配置已更新, 请重新运行脚本!");
                return false;
            }

            return true;
        } catch (error) {
            log.error("检查曲谱文件时发生错误:", error);
            return false;
        }
    }

    /**
     * ------- 主程序 --------
     */
    async function main() {
        if (!checkSheetFile()) return;

        let settings_msg = get_settings();
        DEBUG = settings_msg.debug;
        console.log(`${settings_msg}`)

        const music_infos = [];
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
        // try {
            do {
                for (const music_info of music_infos) {
                    log.info(`开始演奏: ${music_info.name} - ${music_info.author}`);
                    switch (music_info.type) {
                        case "yuanqin":
                            await play_sheet(music_info.notes, music_info.bpm, music_info.time_signature);
                            break;
                        case "midi":
                            await play_sheet(music_info.notes, music_info.bpm, music_info.time_signature);
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
                    if (settings_msg.queueInterval > 0) await sleep(settings_msg.queueInterval * 1000);
                }
                if (settings_msg.repeatInterval > 0) await sleep(settings_msg.repeatInterval * 1000);
            } while (alwaysRepeat || --settings_msg.repeatTimes > 0);
        // } catch (error) {
        //     if (DEBUG) {
        //         log.error(`脚本执行错误 ${error} erron.txt 已打印`)
        //         file.writeTextSync("erron.txt", `${error.stack}`);
        //     }
        //     else {
        //         log.error(`脚本执行错误 ${error}`)
        //     }
        // }
    }
    await main();

})();
