
(async function () {
    // 读取配置
    let music_name = ((settings.music_name !== undefined) && (settings.music_name !== "")) ? (`assets/${settings.music_name}.json`) : (undefined);
    if (music_name === undefined) { log.info("乐谱名称未指定"); return; }
    let auto_gadget = (settings.auto_gadget !== undefined) ? (settings.auto_gadget) : ("不自动使用");
    let key_note = readJsonFile("key_note.json");

    /**
     * --------工具函数--------
     */

    /**
     * 自动进入乐器演奏
     */
    async function useGadget(use_type) {
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
     * 读取乐谱并转为Json对象
     * @param {String} file_path 
     * @returns {JSON}
     */
    function readJsonFile(file_path) {
        try {
            let json_file = JSON.parse(file.readTextSync(file_path));
            return json_file;
        }
        catch (error) { log.error(`解析乐谱失败: ${error}`); }
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
            return true;
        }
        catch (error) {
            log.error(`解析乐谱失败: ${error}`);
            return false;
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
     * 按键序列乐谱序列化
     * @param {String} stringSheet
     * @return {[Map]}
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
         * noteInfo[0] : 开始拍数 eg. 6.25  
         * noteInfo[1] : 按键  
         * noteInfo[2] : 持续拍数 eg. 1.25  
         */
        const keySheetParse = (processedString) => {
            const SINGLE = 0;
            const NOTES_CTU = 1; // continuous
            const NOTES_UCTU = 2; // uncontinuous
            const NOTE_WEIGHT = 3;

            const isLeftBrackets = (char) => ((char.length === 1) && (/[\(\[\{]/.test(char)));
            const isRightBrackets = (char) => ((char.length === 1) && (/[\)\]\}]/.test(char)));
            const isNote = (char) => ((char.length === 1) && (/[A-Z0]/.test(char)));
            const state = (brackets) => {
                switch (brackets) {
                    case "(": return NOTES_CTU;
                    case "[": return NOTE_WEIGHT;
                    case "{": return NOTES_UCTU;
                    default: return SINGLE;
                }
            }
            const genNote = (type, listKey) => ({ type: state(type), listKey: listKey, mult: 1 });

            class GroupProcess {
                constructor() {
                    /**
                     * const SINGLE = 0;
                     * const NOTES_CTU = 1; // continuous
                     * const NOTES_UCTU = 2; // uncontinuous
                     * const NOTE_WEIGHT = 3;
                     */
                    this.stack = new Array();
                    this.listKey = new Array();
                    this.unMatchBrackets = 0;
                }
                push(char) {
                    if (isLeftBrackets(char)) {
                        this.stack.push(char);
                        this.listKey.push([]);
                        this.unMatchBrackets += 1;
                    }
                    else if (isRightBrackets(char)) { (this.unMatchBrackets > 0) ? (this.unMatchBrackets -= 1) : (0); }
                    else if (!isRightBrackets(char) && char !== "-") {
                        const lastIndex = this.listKey.length - 1;
                        // if (lastIndex >= 0) this.listKey[lastIndex].push(char);
                        if (lastIndex >= 0) this.listKey[this.unMatchBrackets - 1].push(char);
                        else {
                            this.stack.push(undefined)
                            this.listKey.push([char]);
                        }
                    } else { ; }
                    return this;
                }
                pop() { return this.stack.pop(); }
                last() { return this.stack[this.stack.length - 1]; }
                isEmpty() { return this.stack.length === 0; }
                invaildMatch() { return ((this.unMatchBrackets === 0) && (this.stack.length !== 0)); }
                clear() {
                    this.stack = [];
                    this.listKey = [];
                    this.unMatchBrackets = 0;
                }
                genAll() {
                    let brackets = this.stack;   // 左括号的栈
                    let key = this.listKey;      // 每个左括号对应的键数组
                    let current = genNote(brackets.pop(), key.pop());
                    let outerNote = undefined;
                    while (brackets.length > 0) {
                        outerNote = genNote(brackets.pop(), key.pop());
                        outerNote.listKey.push(current);
                        current = outerNote;
                    }
                    this.clear();
                    return current;
                }
            }

            let group = new GroupProcess(); // 处理流程1
            let groupProess = new Array(); // 处理流程2
            let untime = undefined;
            for (let i = 0; i < processedString.length; i++) {
                const char = processedString[i];
                /**
                 * 1: group.stack已空, 整组解析完毕
                 * 2: group.stack不为空，
                 */
                if (char !== "-") { group.push(char); }
                else if (group.isEmpty()) { groupProess[groupProess.length - 1].mult += 1; }

                if (group.invaildMatch()) {
                    untime = group.genAll();
                    groupProess.push(untime);
                }
            }

            let groupQueue = new Array(); // 处理流程3
            let countBeat = 0;
            let pressed_key = new Set()
            let noteInfo = new Array()
            return groupProess;
        }
        
        let processedString = keySheetProcess(stringSheet);
        let processedList = keySheetParse(processedString);
    }

    /**
     * 简谱乐谱序列化
     * @param {String} stringSheet
     * @returns {[Map]}
     */
    function noteSheetSerialization(stringSheet) {
        /**
         * @param {String} music 
         * @returns {[String]}
         * @description 将整张乐谱输入后得到标准音符Array
         * @example
         * const music = "(BSD)[4]A[4]|\n(NAS)[4](CBM)[8-*]V[16]|\nZ[4-8.3]C[4-8.3]B[4-8.$]|"
         * console.log("原始字符串:", music);
         * console.log("转换后列表:", noteSheetProcess(music));
         * input  :"(BSD)[4]A[4]|\n(NAS)[4](CBM)[8-*]V[16]|\nZ[4-8.3]C[4-8.3]B[4-8.$]|"
         * output :['(BSD)[4]','A[4]','(NAS)[4]','(CBM)[8-*]','V[16]','Z[4-8.3]','C[4-8.3]','B[4-8.$]']
         */
        function noteSheetProcess(music) {
            const combinedPattern = /[A-Z@]\[[^\]]+\]|\([^)]+\)\[[^\]]+\]/g; // 核心正则表达式，动之前最好先问下DeepSeek
            const matches = [];
            let match;
            while ((match = combinedPattern.exec(music)) !== null) { matches.push(match[0]); }
            return matches;
        }
    }


    /**
     * --------工作函数--------
     */
    let music = readJsonFile(music_name);
    if (jsonCheck(music)) return;

    // let arr = stringMusicSplit(getSheet(music));
    // keySheetSerialization(arr);

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