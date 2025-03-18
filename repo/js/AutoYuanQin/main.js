(async function () { // 优化了单曲循环逻辑、优化乐谱读取逻辑、修复了连音中的休止符的时长计算错误、修复了队列留空导致的错误

    // 乐曲名（带序号）
    const music_list = [
        "1.小星星",
        "2.小星星变奏曲",
        "3.Unknown Mother Goose [アンノウン・マザーグース]",
        "4.铃芽之旅[Suzume]",
        "5.Flower Dance",
        "6.起风了",
        "7.千本樱 (Eric Chen)"
    ]
    const base_path = "assets/score_file/"

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
     * @param note_time 当前音符的时长（默认为undefined，不为空时symbol note_type count实效）
     * @returns {number}
     */
    function cal_time_ornament(sheet_list, symbol_time, symbol, note_type, count, note_time=undefined) {
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
            let repeat_mode = typeof(settings.repeat_mode) === 'undefined' ? "单曲循环" : settings.repeat_mode;
            // 读取乐曲队列
            let music_queue = typeof(settings.music_queue) === 'undefined' ? 0 : settings.music_queue;
            // 读取队列间隔时间
            let music_interval = typeof(settings.music_interval) === 'undefined' ? 0 : parseInt(settings.music_interval, 10);

            let local_music_dic = {}; // 存储本地乐曲对照字典
            // 写入本地乐曲对照字典
            for (const each of music_list) {
                if (each !== "example") {
                    // 从文件名提取编号
                    let temp_num = each.split(".")[0];
                    local_music_dic[temp_num] = each;
                }
            }

            if (music_queue === 0 || music_queue === "") { // 单曲执行
                if (music_single !== 0) {
                    return {
                        "type": "single",
                        "repeat": music_repeat,
                        "repeat_interval": repeat_interval,
                        "music": local_music_dic[music_single.split(".")[0]]
                    };
                } else {
                    log.error(`错误：JS脚本配置有误（单曲未选择）`);
                    return null;
                }
            } else { // 队列执行
                let temp_music_list = []; // 存储乐曲名

                // 读取乐曲队列配置
                for (const num of music_queue.split(" ")) {
                    if (Object.keys(local_music_dic).includes(num)) {
                        temp_music_list.push(local_music_dic[num]);
                        log.info(`乐曲: ${local_music_dic[num]} 已加入队列`)
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
        let regex_description = /(?<="description": ")[\s\S]*?(?=")/
        let regex_bpm = /(?<="bpm": ")[\s\S]*?(?=")/
        let regex_time_signature = /(?<="time_signature": ")[\s\S]*?(?=")/
        let regex_composer = /(?<="composer": ")[\s\S]*?(?=")/
        let regex_arranger = /(?<="arranger": ")[\s\S]*?(?=")/
        let regex_notes = /(?<="notes": ")[\s\S]*?(?=")/

        let regex_blank = /[\\n]/g
        try {
            // 歌曲名
            music_msg_dic["name"] = file_text.match(regex_name)[0];
            // 录谱人
            music_msg_dic["author"] = file_text.match(regex_author)[0];
            // 描述
            music_msg_dic["description"] = file_text.match(regex_description)[0];
            // 歌曲BPM
            music_msg_dic["bpm"] = file_text.match(regex_bpm)[0];
            // 拍号
            music_msg_dic["time_signature"] = file_text.match(regex_time_signature)[0];
            // 曲师
            music_msg_dic["composer"] = file_text.match(regex_composer)[0];
            // 谱师
            music_msg_dic["arranger"] = file_text.match(regex_arranger)[0];
            // 曲谱内容(删除换行符)
            music_msg_dic["notes"] = file_text.match(regex_notes)[0].replace(regex_blank, '');
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
        // 存储连音
        let temp_legato = [];

        // test 需要额外计算装饰音时值的影响
        for (let i = 0; i < sheet_list.length; i++) {
            // 显示正在演奏的音符
            log.info(`${sheet_list[i]["note"]}[${sheet_list[i]["type"]}-${sheet_list[i]["spl"]}]`);
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
            } else if (/\.3|\.6|\.\$/.test(sheet_list[i]["spl"])) { // 三连音/六连音（可能包含休止符）
                temp_legato.push({
                    "note": sheet_list[i]["note"],
                    "chord": sheet_list[i]["chord"],
                    "type": sheet_list[i]["type"]
                });

                // 演奏连音
                if ("$".includes(sheet_list[i]["spl"])) {
                    // 连音的总时长
                    let time_legato = Math.round(symbol_time * (symbol / sheet_list[i]["type"]));
                    // 当前音符类型
                    let current_type = parseInt(sheet_list[i]["spl"].split(".")[0])
                    // 连音的音符数值总和（用于计算当前音符时长）
                    let time_all = temp_legato.reduce((sum, each) => sum + 1 / parseInt(each["spl"].split(".")[0]), 0);
                    // 当前音符时长
                    let time_current = Math.round(time_legato * (1 / current_type) / time_all);
                    // 计数
                    let count = undefined;

                    for (const note_legato of temp_legato) {
                        if (sheet_list[i]["chord"]) {
                            await play_chord(sheet_list[i]["note"]); // 和弦
                        } else {
                            if (sheet_list[i]["note"] === '@') { // 休止符
                                // pass
                            } else {
                                await play_note(sheet_list[i]["note"]); // 单音
                            }
                        }

                        if (count === temp_legato.length - 1 && i !== sheet_list.length - 1) {
                            // 计算连音的最后一个音的时值（计算装饰音）
                            await sleep(cal_time_ornament(sheet_list, symbol_time, symbol, sheet_list[i]["type"], i, time_current));
                            // 重置连音缓存区
                            temp_legato = [];
                        } else if (i !== sheet_list.length - 1) {
                            await sleep(time_current);
                        }
                        count += 1;
                    }
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

    async function main() {
        const settings_msg = get_settings();
        if (settings_msg == null) {
            return null
        }
        try {
            if (settings_msg["type"] === "single") { // 单曲
                // 读取乐谱
                const music_msg = await get_music_msg(settings_msg["music"]);
                const music_sheet = parseMusicSheet(music_msg["notes"]);

                for (let i = 0; i < settings_msg["repeat"]; i++) {
                    await play_sheet(music_sheet, music_msg["bpm"], music_msg["time_signature"]);

                    // 单曲循环间隔
                    if (settings_msg["repeat"] !== 1 && i !== settings_msg["repeat"] - 1) {
                        await sleep(settings_msg["repeat_interval"] * 1000);
                    }
                }
            } else { // 队列
                // 存储读取的乐谱
                let music_msg_list = [];
                // 读取乐谱
                for (let i = 0; i < settings_msg["music"].length; i++) {
                    const music_msg = await get_music_msg(settings_msg["music"][i]);
                    const music_sheet = parseMusicSheet(music_msg["notes"]);

                    music_msg_list.push([settings_msg["music"][i], music_msg, music_sheet]);
                }

                let repeat_queue = settings_msg["repeat_mode"] === "队列循环" ? settings_msg["repeat"] : 1;
                let repeat_single = settings_msg["repeat_mode"] !== "队列循环" ? settings_msg["repeat"] : 1;

                for (let r = 0; r < repeat_queue; r++) {
                    for (let j = 0; j < music_msg_list.length; j++) {
                        for (let i = 0; i < repeat_single; i++) {
                            await play_sheet(music_msg_list[j][2], music_msg_list[j][1]["bpm"], music_msg_list[j][1]["time_signature"]);
                            log.info(`曲目: ${music_msg_list[j][0]} 演奏完成`);
                            if (repeat_single !== 1) {
                                await sleep(settings_msg["repeat_interval"] * 1000); // 单曲循环间隔
                            }
                        }
                        // 队列内间隔
                        if (music_msg_list.indexOf(music_msg_list[j]) !== music_msg_list.length - 1) {
                            await sleep(settings_msg["interval"] * 1000);
                        }
                    }
                    // 队列循环间隔
                    if (repeat_queue !== 1 && r !== repeat_queue - 1) {
                        await sleep(settings_msg["repeat_interval"] * 1000);
                    }
                }
            }
        } catch (error) {
            log.error(`出现错误: ${error}`);
        }

    }

    await main();
})();