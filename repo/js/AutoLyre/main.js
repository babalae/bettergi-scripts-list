(async function () { //

    // 乐曲名（带序号）
    const music_list = ["example"]
    const base_path = "assets/"

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
     *
     * 根据乐曲文件名生成乐曲文件路径
     *
     * @param music_name 乐曲文件名
     * @returns {string} 乐曲文件路径
     */
    function path_join(music_name) {
        return base_path + music_name + ".json";
    }

    /**
     *
     * 计算当前音符的时长（检测音符后是否有装饰音）
     *
     * @param sheet_list {Object[][]} 解析后的乐谱
     * @param symbol_time 每一拍的时间
     * @param symbol 以几分音符为一拍
     * @param note_type 音符类型
     * @param count 当前音符下标
     * @returns {number}
     */
    function cal_time_ornament(sheet_list, symbol_time, symbol, note_type, count) {
        // 该音符的正常时长
        let note_time = Math.round(symbol_time * (symbol / note_type));
        // 装饰音时长
        let ornament_time = Math.round(symbol_time / 16)

        let check_count = count + 1;
        let ornament_count = 0; // 装饰音计数

        while (check_count < sheet_list.length) { // 装饰音不可能在曲谱末尾，else会在匹配不到装饰音的循环触发
            if (sheet_list[check_count].spl === "#") {
                ornament_count += 1;
            } else {
                if (ornament_count === 0) {
                    return note_time;
                } else {
                    if (ornament_time * ornament_count < note_time) {
                        return note_time - ornament_time *ornament_count;
                    } else {
                        return note_time; // 装饰音占用的时间过长就不预留时间
                    }
                }
            }
            check_count += 1;
        }
    }

    /**
     * 获取JS脚本配置
     *
     * @returns {Object} 包含解析后JS脚本配置的对象，具有以下属性：
     *  - type {string} 执行类型：单曲和队列
     *  - repeat {integer} 单曲重复次数
     *  - interval {integer} 队列间隔时间(type为"single"时无此属性)
     *  - music {string}|{Array.string} 乐曲名（type为"single"时为 {string}, type为"queue"时为 {Array.<string>}）
     *
     */
    function get_settings() {
        try{
            // 读取选择的单曲
            let music_single = typeof(settings.music_selector) === 'undefined' ? 0 : settings.music_selector;
            // 读取循环次数
            let music_repeat = typeof(settings.music_repeat) === 'undefined' ? 1 : parseInt(settings.music_repeat, 10);
            // 读取循环间隔时间
            let repeat_interval = typeof(settings.repeat_interval) === 'undefined' ? 0 : parseInt(settings.repeat_interval, 10);
            // 读取循环模式
            let repeat_mode = typeof(settings.repeat_mode) === 'undefined' ? 0 : settings.repeat_mode;
            // 读取乐曲队列
            let music_queue = typeof(settings.music_queue) === 'undefined' ? 0 : settings.music_queue;
            // 读取队列间隔时间
            let music_interval = typeof(settings.music_interval) === 'undefined' ? 0 : parseInt(settings.music_interval, 10);

            if (music_queue === 0) { // 单曲执行
                if (music_single !== 0) {
                    return {
                        "type": "single",
                        "repeat": music_repeat,
                        "repeat_interval": repeat_interval,
                        "music": music_single,
                    };
                } else {
                    log.error(`错误：JS脚本配置有误（单曲未选择）`);
                }
            } else { // 队列执行
                let local_music_dic = {}; // 存储本地乐曲对照字典
                let temp_music_list = []; // 存储乐曲名

                // 写入本地乐曲对照字典
                for (const each of music_list) {
                    if (each !== "example") {
                        // 从文件名提取编号
                        let temp_num = parseInt(each.split(".")[0], 10);
                        local_music_dic[temp_num] = each;
                    }
                }

                // 读取乐曲队列配置
                for (const num of music_queue) {
                    if (local_music_dic.keys().contains(num)) {
                        temp_music_list.push(local_music_dic[num]);
                    } else {
                        log.info(`编号不存在，已跳过(编号：${num})`)
                    }

                }

                return {
                    "type": "queue",
                    "repeat": music_repeat,
                    "repeat_interval": repeat_interval,
                    "repeat_mode": repeat_mode,
                    "interval": music_interval,
                    "music": temp_music_list
                };
            }
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
     */
    async function get_music_msg(music_name) {

        let music_path = path_join(music_name);
        let file_text = ""; // 存储乐曲文件内容

        try{
            file_text = file.readTextSync(music_path);
        } catch (error) {
            log.error(`文件无法读取：${music_path}\nerror:${error}`);
        }

        if(file_text == null){ // 检测文件是否读取
            log.error(`读取文件 ${music_path} 错误，文件为空`);
            return null ;
        } else {
            log.info(`文件读取成功: ${music_path}`);
        }

        let music_msg_dic = {};

        // 正则表达式，用于匹配如下内容
        let regex_name = /(?<="name": ")[\s\S]*?(?=")/
        let regex_author = /(?<="author": ")[\s\S]*?(?=")/
        let regex_bpm = /(?<="bpm": ")[\s\S]*?(?=")/
        let regex_time_signature = /(?<="time_signature": ")[\s\S]*?(?=")/
        let regex_composer = /(?<="composer": ")[\s\S]*?(?=")/
        let regex_arranger = /(?<="arranger": ")[\s\S]*?(?=")/
        let regex_notes = /(?<="notes": ")[\s\S]*?(?=")/

        let regex_blank = /\s+/g
        try {
            // 歌曲名
            music_msg_dic["name"] = file_text.match(regex_name)[0];
            // 录谱人
            music_msg_dic["author"] = file_text.match(regex_author)[0];
            // 歌曲BPM
            music_msg_dic["bpm"] = file_text.match(regex_bpm)[0];
            // 拍号
            music_msg_dic["time_signature"] = file_text.match(regex_time_signature)[0];
            // 曲师
            music_msg_dic["composer"] = file_text.match(regex_composer)[0];
            // 谱师
            music_msg_dic["arranger"] = file_text.match(regex_arranger)[0];
            // 曲谱内容（删除空白符）
            if (regex_blank.test(file_text.match(regex_notes)[0])) {
                music_msg_dic["notes"] = file_text.match(regex_notes)[0].replace(regex_blank, '');
            } else {
                music_msg_dic["notes"] = file_text.match(regex_notes)[0];
            }
        } catch(error) {
            log.info(`曲谱解析错误：${error}\n请检查曲谱文件格式是否正确`);
            return null;
        }

        return music_msg_dic;
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
     * @param sheet {string} 乐谱
     * @returns {Object[][]}
     */
    function parseMusicSheet(sheet) {
        // 将输入字符串按照小节分割
        let bars = sheet.split('|');
        let result = [];

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
        // 确定是以几分音符为一拍
        let symbol = parseInt(ts.split("/")[1], 10);
        // 每拍所需的时间
        let symbol_time = Math.round(60000 / bpm);
        // 装饰音时长
        let ornament_time = Math.round(symbol_time / 16)
        // 存储三连音
        let temp_triple = [];

        // test 需要额外计算装饰音时值的影响
        for (let i = 0; i < sheet_list.length; i++) {
            if (sheet_list[i]["spl"] === 'none') { // 单音、休止符或和弦
                if (sheet_list[i]["chord"]) {
                    await play_chord(sheet_list[i]["note"]); // 和弦
                    await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i));
                    // await sleep(Math.round(symbol_time * (symbol / sheet_list[i]["type"]))); // 停顿（根据当前音符的时值）
                } else {
                    if (sheet_list[i]["note"] === '@') { // 休止符
                        await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i));
                        // await sleep(Math.round(symbol_time * (symbol / sheet_list[i]["type"])));
                    } else {
                        await play_note(sheet_list[i]["note"]); // 单音
                        await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i));
                        // await sleep(Math.round(symbol_time * (symbol / sheet_list[i]["type"])));
                    }
                }
            } else if (sheet_list[i]["spl"] === '#') { // 装饰音（不会包含休止符），时值为symbol的时值的1/16
                if (sheet_list[i]["chord"]) {
                    await play_chord(sheet_list[i]["note"]); // 和弦
                } else {
                    await play_note(sheet_list[i]["note"]); // 单音
                }
                await sleep(ornament_time);
            } else if (sheet_list[i]["spl"] === '3') { // 三连音（可能包含休止符）
                temp_triple.push({note: sheet_list[i]["note"], chord: sheet_list[i]["chord"]});

                if (temp_triple.length === 3) {
                    let count = 0 // 计数
                    let time_all = Math.round(symbol_time * (symbol / sheet_list[i]["type"]));
                    let time_current = Math.round(symbol_time * (symbol / sheet_list[i]["type"]) / 3);

                    for (const tri_note of temp_triple) {
                        if (count === 3) {
                            time_current = time_all - time_current * 2;
                            await sleep(cal_time_ornament(sheet_list, time_current, symbol, sheet_list[i]["type"], i));
                        }

                        if (sheet_list[i]["chord"]) {
                            await play_chord(sheet_list[i]["note"]); // 和弦
                            await sleep(time_current);
                        } else {
                            if (sheet_list[i]["note"] === '@') { // 休止符
                                await sleep(time_current);
                            } else {
                                await play_note(sheet_list[i]["note"]); // 单音
                                await sleep(time_current);
                            }
                        }
                        count += 1;
                    }
                    // 重置三连音缓存区
                    temp_triple = [];
                }
            } else if (sheet_list[i]["spl"] === '*') { // 附点音符
                if (sheet_list[i]["chord"]) {
                    await play_chord(sheet_list[i]["note"]); // 和弦
                    await sleep(cal_time_ornament(sheet_list, symbol_time * 1.5, symbol, sheet_list[i]["type"], i));
                } else {
                    if (sheet_list[i]["note"] === '@') { // 休止符
                        await sleep(cal_time_ornament(sheet_list, symbol_time * 1.5, symbol, sheet_list[i]["type"], i));
                    } else {
                        await play_note(sheet_list[i]["note"]); // 单音
                        await sleep(cal_time_ornament(sheet_list, symbol_time * 1.5, symbol, sheet_list[i]["type"], i));
                    }
                }
            } else {
                log.info(`错误: ${sheet_list[i]["spl"]}`);
                return null;
            }
        }
    }

    async function main() {
        const settings_dic = get_settings();

        if (settings_dic["type"] === "single") { // 单曲
            if (settings_dic["repeat"] === 1) {
                let music_msg = await get_music_msg(settings_dic["music"]);
                const music_sheet = parseMusicSheet(music_msg["notes"]);
                await play_sheet(music_sheet, music_msg["bpm"], music_msg["time_signature"]);
            } else {
                for (let i = 0; i < settings_dic["repeat"]; i++) {
                    await sleep(settings_dic["repeat_interval"]); // 循环间隔

                    const music_msg = await get_music_msg(settings_dic["music"]);
                    const music_sheet = parseMusicSheet(music_msg["notes"]);
                    await play_sheet(music_sheet, music_msg["bpm"], music_msg["time_signature"]);
                }
            }
        } else { // 队列
            let repeat_queue = 1;
            if (settings_dic["repeat_mode"] === "队列循环") { // 队列循环
                repeat_queue = settings_dic["repeat"];
            }

            for (let r = 0; r < repeat_queue; r++) {
                for (const music_name of settings_dic["music"]) {
                    await sleep(settings_dic["interval"]); // 队列间隔

                    if (settings_dic["repeat"] === 1) {
                        const music_msg = await get_music_msg(music_name);
                        const music_sheet = parseMusicSheet(music_msg["notes"]);
                        await play_sheet(music_sheet, music_msg["bpm"], music_msg["time_signature"]);
                    } else {
                        let repeat_single = 1;
                        if (settings_dic["repeat_mode"] !== "队列循环") { // 单曲循环
                            repeat_single = settings_dic["repeat"];
                        }

                        for (let i = 0; i < repeat_single; i++) {
                            const music_msg = await get_music_msg(music_name);
                            const music_sheet = parseMusicSheet(music_msg["notes"]);
                            await play_sheet(music_sheet, music_msg["bpm"], music_msg["time_signature"]);
                        }
                    }
                }
            }
        }
    }

    await main();
})();