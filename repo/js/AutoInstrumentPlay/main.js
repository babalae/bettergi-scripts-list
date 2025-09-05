
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
     * 日志写入
     */
    const DEBUG = 1;
    function log_file(str) {
        if (DEBUG) file.writeTextSync("log.txt", `${str}\n`, true);
    }
    function log_clear() {
        if (DEBUG) file.writeTextSync("log.txt", "");
    }
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
    function read_json_file(file_path) {
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
    function json_check(json) {
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
    function get_sheet(json) {
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
     * 按键模拟
     * 不使用await修饰调用，利用javascript特性实现异步弹奏
     * 
     * @param {Map} note
     * @description gap:小节开始时此音符需要先等待多久
     * @description key:键盘按键
     * @description presstime:此音符需要持续的时长
     */
    async function key_press(note) {
        const gap = note["gap"];
        const key = note["key"];
        const time = note["presstime"];
        await sleep(gap);
        keyDown(key);
        await sleep(time);
        keyUp(key);
    }

    /**
     * 字符串乐谱转Array乐谱
     * @param {String} sheet 
     * @return {Array} 解析后的音符小节
     */
    function json_sheet_analyse(sheet) {
        let bars = new Array();
        let note = "";
        /**
         * 
         * @param {Array} bars 
         * @param {String} note 
         * @param {String} sheet 
         */
        function iter(bars, note, sheet) {
            if (sheet === "") {
                if (note !== "") bars.push(note);
                return bars;
            }
            else {
                if (sheet[0] === "/" && note !== "") {
                    bars.push(note);
                    note = "";
                }
                else {
                    note = note + sheet[0];
                }
                return iter(bars, note, sheet.slice(1));
            }
        }
        return iter(bars, note, sheet)
    }

    /**
     * 按键序列乐谱序列化
     * @param {Array[String]} Arrayed_stringBar
     * @return {[Number, Array]}
     * @returns {Number} Number:乐曲小节数
     * @returns {Array} Array:小节Array
     */
    function key_board_sheet_serialization(Arrayed_stringBar) {
        let state = 0;
        const NORMAL = 0; // 无组
        const SAME_GROUP = 1; // (){}
        const WEIGHT_GROUP = 2; // []

        const isUpperCase = (char) => /^[A-Z]$/.test(char);

        // 每小节处理
        let bar_index = 1; // 小节序号，用于保存此时的小节数
        while (Arrayed_stringBar.length !== 0) {
            let bar = Arrayed_stringBar.shift();
            bar = bar.replace(/ /g, '0') // eg. (QG) SJ>(JG)-(WJ)G 替换为 (QG)0SJ>(JG)-(WJ)G
            let notes = []; // 保存经处理的节拍内容

            // 先将字符串转为列表 eg. (QG) SJ>(JG)-(WJ)G -> ["(QG)","0","S","J","JG","-","WJ","G"]
            let note = "";
            for (let c of bar) {
                /**
                  * 合法字符：A-Z '-' '>' '(' ')' '[' ']' '{' '}' '0' ' ':(空格)
                */
                if (c === ">") { bar_index = bar_index + 1; continue; }
                switch (state) {
                    case NORMAL:
                        if (c === '(') { note = "("; state = SAME_GROUP; break; }
                        if (c === '{') { note = "{"; state = SAME_GROUP; break; }
                        if (c === '[') { note = "["; state = WEIGHT_GROUP; break; }
                        if (isUpperCase(c) || c === '0' || c === '-') { notes.push(c); break; }
                        else { log.warn(`第${bar_index}小节解析出错：出现不合法的字符 {${c}} 已跳过`); break; }

                    case SAME_GROUP:
                        if (c === ')') { note = note + ')'; notes.push(note); state = NORMAL; break; }
                        if (c === '}') { note = note + '}'; notes.push(note); state = NORMAL; break; }
                        if (isUpperCase(c)) { note = note + c; break; }
                        else { log.warn(`第${bar_index}小节解析出错：出现不合法的字符 {${c}} 已跳过`); break; }

                    case WEIGHT_GROUP:
                        if (c === ']') { note = note + ']'; notes.push(note); state = NORMAL; break; }
                        if (isUpperCase(c) || c === '0') { note = note + c; break; }
                        else { log.warn(`第${bar_index}小节解析出错：出现不合法的字符 {${c}} 已跳过`); break; }
                    default: break;
                }
                // log_file(`state:${state} char:${c} note:${note} len:${notes.length} notes:${notes}`);
            }
            // 列表转控制Map
            let Bars = new Array(); // 返回的小节对象Array
            let Bar = new Array(); // 小节内容，元素为Map
            let KeyNote = new Map(); // 当前节拍按下的按钮
            KeyNote.set("Q", [1, 1]);
            KeyNote.set("B", [2, 2]);
            log_file(`notes : ${notes}`);
            notes.forEach(node => {
                // node : eg.["(QG)","0","S","[G0E00]","-","(WJ)","-"]
                /**
                 * 迭代KeyNote先看键值对在组中，在则值设为[组基础值，比如WEIGHT_GROUP需要加权计算，倍率+1]，不在则delete并将组基础值*倍率得到拍数push进Bar
                 */
                KeyNote.forEach((v, k) => {
                    if (!node.includes(k)) KeyNote.delete(k);
                    else KeyNote.set(k, [v[0], v[1] + 1]);
                });
                KeyNote.forEach((v, k) => {
                    log_file(`node ${node} K:${k} V:${v}`);
                });
                /**
                 * 再迭代组看KeyNote中有没有，有则跳过，无则新建值为[组基础值，倍率=1]的键值对
                 */
                // gap = 0;
                // gap = gap + 1;
                // log_file(`node : ${node} KeyNote : ${KeyNote}`);
            });
            // Bars.push();
            bar_index = bar_index + 1; // 新小节
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
     * 音符小节序列演奏
     * @param {Array} bar_list 
     */
    async function note_list_play(bar_list) {
        bar_list.forEach(bar => {

        });
    }

    /**
     * --------工作函数--------
     */
    log_clear();
    let music = read_json_file(music_name);
    if (json_check(music)) return;

    let arr = json_sheet_analyse(get_sheet(music));
    [Len, List] = key_board_sheet_serialization(arr);

})();