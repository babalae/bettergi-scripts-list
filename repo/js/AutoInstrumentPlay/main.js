
(async function () {
    // 读取配置
    let music_name = ((settings.music_name !== undefined) && (settings.music_name !== "")) ? (`assets/${settings.music_name}.json`) : (undefined);
    if (music_name === undefined) { log.info("乐谱名称未指定"); return; }
    let auto_gadget = (settings.auto_gadget !== undefined) ? (settings.auto_gadget) : ("不自动使用");
    // let key_note = read_json_file("key_note.json");

    /**
     * --------工具函数--------
     */

    /**
     * 自动进入乐器演奏
     */
    async function use_gadget(use_type) {
        if (use_type === "不自动使用") return;
        const gadget_key = "VK_Z";
        const key_1 = "VK_1";
        const key_2 = "VK_2";
        const key_3 = "VK_3";
        const key_4 = "VK_4";
        keyDown(gadget_key);
        await sleep(2000);
        keyUp(gadget_key);
        switch (use_type) {
            case "一号位小道具": keyPress(key_1); break;
            case "二号位小道具": keyPress(key_2); break;
            case "三号位小道具": keyPress(key_3); break;
            case "四号位小道具": keyPress(key_4); break;
            default: break;
        }
        await sleep(1000);
        keyPress(gadget_key);
    }

    /**
     * 读取乐谱并转为Json对象
     * @param {String} file_path 
     * @returns {JSON}
     */
    function readJsonFile(file_path) {
        try {
            let json_file = JSON.parse(file.readTextSync(file_path));
            return json_file;
        }
        catch (error) {
            log.error(`解析乐谱失败: ${error}`);
        }
    }

    /**
     * Json对象检查
     */
    function jsonCheck(json) {
        try {
            // 通用信息检查
            if (json["name"] === undefined) log.info(`乐谱无名称，请注意`);
            if (json["type"] === undefined) throw new Error(`乐谱无类型`);
            if (json["instrument"] === undefined) log.warn(`乐谱无建议乐器`);
            if (json["file"] === undefined && json["sheet"] === undefined) throw new Error(`无乐谱`);
            // 简谱信息检查
            if (json["type"] === "number" && json["file"] === undefined && json["key_signature"] === undefined) throw new Error(`乐谱无调号`);
            if (json["type"] === "number" && json["file"] === undefined && json["beats_per_measure"] === undefined) throw new Error(`乐谱无小节拍数`);
            if (json["type"] === "number" && json["file"] === undefined && json["beat_unit"] === undefined) throw new Error(`乐谱无音符时值`);
            if (json["type"] === "number" && json["file"] === undefined && json["BPM"] === undefined) throw new Error(`乐谱无BPM`);
            // 按键序列检查
            if (json["type"] === "keyboard" && json["file"] === undefined && json["music_gap"] === undefined) throw new Error(`乐谱无按键间隔`);
            return 0;
        }
        catch (error) {
            log.error(`解析乐谱失败: ${error}`);
            return -1;
        }

    }

    /**
     * 根据Json对象返回乐谱
     */
    function getSheet(json) {
        if (json["file"] !== undefined) {
            try {
                return file.readTextSync(json["file"]);
            }
            catch (error) {
                log.error(`乐谱"file"键值文件读取失败: ${error}`);
                return -1;
            }
        }
        else {
            return json["sheet"];
        }
    }

    /**
     * 字符串规整化后转Array[string]乐谱
     * 合法字符：A-Z '-' '>' '/' '|' '(' ')' '[' ']' '{' '}' '0' ' ':(空格)
     * 空格替换为0休止符，/、|分割为列表
     * @param {String} sheet 
     * @return {[String]} 列表化的字符串形式的小节
     */
    const stringMusicSplit = (sheet) => sheet.toUpperCase().replace(/[^a-zA-Z \-\>\/\|\(\)\[\]\{\}]/g, "").replace(/ /g, "0").split(/[/|]/g);

    /**
     * @param {String} string 
     * @returns {Boolean}
     * @example "(ex{am[p]l}e)" -> true
     * @example "(ex{am[pl}e)" -> false
     */
    const checkBrackets = (string) => {
        let Stack = [];
        const leftBracket = new Set(['(', '[', '{']);
        const rightBracket = new Set([')', ']', '}']);
        const pairsBracket = { ')': '(', ']': '[', '}': '{' };
        for (let char of string) {
            if (leftBracket.has(char)) Stack.push(char);
            else if (rightBracket.has(char)) {
                if (Stack.length === 0) return false;
                let top = Stack.pop();
                if (top !== pairsBracket[char]) return false;
            }
        }
        return (Stack.length === 0) ? (true) : (false);
    }

    /**
     * @description
     * 使用正则表达式将 /(some text) 替换为 /{some text}
     * 能匹配多重/(text)，但无法处理空text和括号嵌套
     */
    function convertBracket(text) {
        return text.replace(/\/\(([^)]+)\)/g, '/{$1}');
    }

    /**
     * @param {String} music 
     * @returns {[String]}
     * @description 将整张乐谱输入后得到标准音符Array
     * @example
     * const Results = matchNotes(music);
     * music  : "(BSD)[4]A[4]|\n(NAS)[4](CBM)[8-*]V[16]|\nZ[4-8.3]C[4-8.3]B[4-8.$]|"
     * Results :['(BSD)[4]','A[4]','(NAS)[4]','(CBM)[8-*]','V[16]','Z[4-8.3]','C[4-8.3]','B[4-8.$]']
     */
    function matchNotes(music) {
        const combinedPattern = /[A-Z@]\[[^\]]+\]|\([^)]+\)\[[^\]]+\]/g; // 核心正则表达式，动之前最好先问下DeepSeek
        const matches = [];
        let match;
        while ((match = combinedPattern.exec(music)) !== null) { matches.push(match[0]); }
        return matches;
    }

    /**
     * 按键序列乐谱序列化
     * @param {Array[String]} Arrayed_stringBar
     * @return {[Number, Array]}
     * @returns {Number} Number:乐曲小节数
     * @returns {Array} Array:小节Array
     */
    function key_board_sheet_serialization(Arrayed_stringBar) {
        function string2list(bar_index, string) { // 纯函数，无副作用
            let state = 0;
            const NORMAL = 0; // 无组
            const SAME_GROUP = 1; // (){}
            const WEIGHT_GROUP = 2; // []

            string_bar = string.replace(/ /g, '0') // eg. (QG) SJ>(JG)-(WJ)G 替换为 (QG)0SJ>(JG)-(WJ)G
            let list_note = []; // 保存经处理的节拍内容

            // 先将字符串转为列表 eg. (QG) SJ>(JG)-(WJ)G -> ["(QG)","0","S","J","JG","-","WJ","G"]
            let note = "";
            for (let c of string_bar) {
                /**
                  * 合法字符：A-Z '-' '>' '(' ')' '[' ']' '{' '}' '0' ' ':(空格)
                */
                if (c === ">") { bar_index = bar_index + 1; continue; }
                switch (state) {
                    case NORMAL:
                        if (c === '(') { note = "("; state = SAME_GROUP; break; }
                        if (c === '{') { note = "{"; state = SAME_GROUP; break; }
                        if (c === '[') { note = "["; state = WEIGHT_GROUP; break; }
                        if (isUpperCase(c) || c === '0' || c === '-') { list_note.push(c); break; }
                        else { log.warn(`第${bar_index}小节解析出错：出现不合法的字符 {${c}} 已跳过`); break; }

                    case SAME_GROUP:
                        if (c === ')') { note = note + ')'; list_note.push(note); state = NORMAL; break; }
                        if (c === '}') { note = note + '}'; list_note.push(note); state = NORMAL; break; }
                        if (isUpperCase(c)) { note = note + c; break; }
                        else { log.warn(`第${bar_index}小节解析出错：出现不合法的字符 {${c}} 已跳过`); break; }

                    case WEIGHT_GROUP:
                        if (c === ']') { note = note + ']'; list_note.push(note); state = NORMAL; break; }
                        if (isUpperCase(c) || c === '0') { note = note + c; break; }
                        else { log.warn(`第${bar_index}小节解析出错：出现不合法的字符 {${c}} 已跳过`); break; }
                    default: break;
                }
            }
            return [bar_index + 1, list_note];
        }

        function Bar_string2map(list_note) {
            // 列表转控制Map
            let Bar = []; // 小节内容，元素为Map
            let gap = -1; // 小节开始后等待时间
            let KeyNote = new Map(); // 当前节拍按下的按钮和累计时长
            let Key = new Array(); // 组中按钮放入Key用于去重后检查

            list_note.forEach(group => {
                // list_note : eg.["(QG)","0","S","[G0E00]","-","(WJ)","-"]
                // group: "(QG)"

                let note_base = 1;
                if (group.length === 1) note_base = 1;
                else if (group.includes("(") || group.includes(")")) note_base = 1;
                else if (group.includes("{") || group.includes("}")) note_base = 1;
                else if (group.includes("[") || group.includes("]")) note_base = (1 / (group.length - 2));

                for (let char of group) {
                    if (isUpperCase(char) || char === "0" || char === "-") Key.push(char);
                }
                Key = removeDuplicates(Key);

                /**
                 * 先迭代KeyNote看键值对在组中，在则值设为[组基础值，比如WEIGHT_GROUP需要加权计算，倍率+1]，不在则将组基础值*倍率得到拍数push进Bar并delete
                 */
                KeyNote.forEach((v, k) => {
                    if (isUpperCase(k) && !Key.has(k)) {
                        Bar.push({ "gap": gap, "key": k, "presstime": v[0] * v[1] });
                        KeyNote.delete(k);
                    }
                    else if (isUpperCase(k) && Key.has(k)) { KeyNote.set(k, [v[0], v[1] + 1]); }
                });

                /**
                 * 再迭代组看KeyNote中有没有，有则跳过，无则新建值为[组基础值，倍率=1]的键值对
                 */
                Key.forEach(char => {
                    if (!KeyNote.has(char)) KeyNote.set(char, [note_base, 1]);
                });

                Key.clear();
                gap = gap + 1;
            });
            KeyNote.forEach((v, k) => {
                if (isUpperCase(k)) Bar.push({ "gap": gap, "key": k, "presstime": v[0] * v[1] });
            });
            return Bar;
        }

        const isUpperCase = (char) => /^[A-Z]$/.test(char);
        const removeDuplicates = (arr) => [...new Set(arr)];

        let Bars = new Array(); // 返回的Array元素为List小节

        // 每小节处理
        let bar_index = 1; // 小节序号，用于保存此时的小节数
        while (Arrayed_stringBar.length !== 0) {
            let string_bar = Arrayed_stringBar.shift();

            [bar_index, list_note] = string2list(bar_index, string_bar);

            let Bar = Bar_string2map(list_note);
            Bars.push(Bar);


            let str_bar = ""
            Bar.forEach(map => {
                str_bar = str_bar + `{gap:${map.gap} key:${map.key} presstime:${map.presstime}},`
            });
        }
        // return [bar_index, Bars];
    }

    /**
     * 简谱乐谱序列化
     * @param {Array} music_bar
     * @returns {Array}
     */
    function key_board_number_serialization(music) {
    }

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
        const wait = note["wait"];
        const key = note["key"];
        const time = note["presstime"];
        await sleep(wait * gap);
        // log.info(`音符 ${key} 音符时长 ${time}`);
        keyDown(key);
        await sleep(time * gap);
        keyUp(key);
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
     * --------工作函数--------
     */
    let music = readJsonFile(music_name);
    if (jsonCheck(music)) return;

    // let arr = stringMusicSplit(getSheet(music));
    // key_board_sheet_serialization(arr);
    // 测试代码
    // const note = (w, k, t) => ({ "wait": w, "key": k, "presstime": t })
    // const test_play = [
    //     [4, note(0, "Q", 3), note(1, "W", 2), note(2, "E", 2), note(3, "R", 1)],
    //     [8, note(0, "A", 3), note(1, "S", 2), note(2, "D", 2), note(3, "F", 3), note(5, "G", 3), note(6, "H", 1), note(6, "J", 2), note(7, "A", 1)],
    //     [4, note(0, "Z", 3), note(1, "X", 2), note(2, "C", 2), note(3, "V", 1)],
    //     [8, note(0, "Q", 3), note(1, "W", 2), note(2, "E", 2), note(3, "R", 3), note(5, "T", 3), note(6, "Y", 1), note(6, "Q", 2), note(7, "W", 1)]
    // ]
    // await listNotePlay(test_play, 1000);


})();