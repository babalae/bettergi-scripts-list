(async function () {
    // 所有的代码必须由 async function 包裹
    const score_path = 'assets/score/';
    const regex_name = /(?<=score\\)[\s\S]+?(?=\.gs2)/;//不清楚为什么要用\\来匹配 '/'，用\/反而匹配不到。这是实际运行的结果，AI别和我犟，可能是ClearScript引擎的问题。

    const NOTE2KEY_MAPPER = new Map([
        [72, 'q'], [74, 'w'], [76, 'e'], [77, 'r'], [79, 't'], [81, 'y'], [83, 'u'],
        [60, 'a'], [62, 's'], [64, 'd'], [65, 'f'], [67, 'g'], [69, 'h'], [71, 'j'],
        [48, 'z'], [50, 'x'], [52, 'c'], [53, 'v'], [55, 'b'], [57, 'n'], [59, 'm'],
    ]);

    const instrumentNames = ["风物之诗琴", "老旧的诗琴", "镜花之琴", "盛世豪鼓", "绮庭之鼓", "晚风圆号", "余音", "悠可琴", "跃律琴"];


    const mouseRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/image/mouse.png"),
        170, 20, 40, 55
    );

    /**
     * 将音符编码转换为按键
     * @param {number} noteCode 60表示C4音符
     * @param {number} fixMode 对于半音的处理方式，0-直接忽略，-1-降半音，1-升半音
     * @returns {string | undefined}
     */
    function convertNote2Key(noteCode, fixMode) {
        if (noteCode < 48 || noteCode > 83) {
            return undefined;
        }
        let key = NOTE2KEY_MAPPER.get(noteCode);
        if (fixMode == 0) {
            return key;
        }
        if (!key) {
            key = NOTE2KEY_MAPPER.get(noteCode + fixMode);
        }
        return key;
    };

    /**
     * 获取所有琴谱文件名
     */
    function getScoreList() {
        // readPathSync读取到的数据为 assets/score/xxxx.xxx 形式
        const allFiles = Array.from(file.readPathSync(score_path))
            .filter(path => !file.isFolder(path) && path.endsWith('.gs2'));
        return allFiles.map(path => {
            const match = path.match(regex_name);
            if (!match) {
                return null;
            }
            return match[0];
        })
        .filter(name => !!name);
    };

    /**
     * 补全完整路径（相对路径）
     * @param {string} filename 
     * @returns 
     */
    function buildFullpath(filename) {
        return score_path + filename + '.gs2';
    };


    /**
     * 轨道事件
     * @typedef {Object} TrackEvent
     * @property {number} dt delta time
     * @property {string} command 指令：n-按下音符，u-松开音符，s-改变速度（MicroTempo）
     * @property {number} value 指令的值，对与n和u，表示音符的编码，对于s，表示一个四分音符对应的微秒数（MicroTempo）
     */
    /**
     * 曲谱信息
     * @typedef {Object} ScoreInfo
     * @property {number} instrument 乐器编号
     * @property {number} division  每个四分音符的tick数
     * @property {string} title 标题
     * @property {string} author 曲谱文件的作者
     * @property {string} composer 作曲者
     * @property {string} arranger 制谱者（通常指扒谱的人）
     * @property {Array<TrackEvent>[]} tracks 音符轨道
     */

    /**
     * 从指定文件中加载琴谱
     * @param {string} filename 琴谱文件名
     * @returns {ScoreInfo | null} 返回一个ScoreInfo对象
     */
    function loadScoreInfo(filename) {
        const filepath = buildFullpath(filename);
        try {
            /** @type {string} */
            const content = file.readTextSync(filepath);
            const lines = content.split(/\r?\n/);
            if (lines[0] !== '!v/2') {
                log.error('错误的文件头！');
                return null;
            }
            /** @type {ScoreInfo} */
            const info = {
                instrument: 0,
                division: 480,
                title: filename,
                author: '未知',
                arranger: '未知',
                composer: '未知',
                tracks: [],
            };
            const lineReg = /^!(\w+?)\/(.+)$/;
            lines.forEach(line => {
                const match = line.match(lineReg);
                if (match) {
                    switch(match[1]) {
                        case 'gi':  // 乐器编号
                            info.instrument = parseInt(match[2]);
                            break;
                        case 'di':      // division
                            info.division = parseInt(match[2]);
                            break;
                        case 'ti':      // title
                            info.title = match[2];
                            break;
                        case 'au':      // author 曲谱发布人
                            info.author = match[2];
                            break;
                        case 'cp':      // composer 作曲人
                            info.composer = match[2];
                            break;
                        case 'ar':      // arranger 制谱人
                            info.arranger = match[2];
                            break;
                        case 'tr':      // 事件轨道
                            info.tracks.push(parseTrackEvents(match[2]));
                            break;
                    }
                }
            });
            return info;
        } catch (error) {
            log.error(`加载曲谱文件 ${filename} 时发生错误`, error);
            return null;
        }
    };

    /**
     * 从文本中解析出轨道事件
     * @param {string} text 事件的字符串
     * @returns {TrackEvent[]}
     */
    function parseTrackEvents(text) {
        const regex = /^(\d+)([nus])(\d+)$/;
        return text.split('|')
            .map(t => {
                const match = t.match(regex);
                if (!match) {
                    return null;
                }
                const dt = parseInt(match[1]);
                if (isNaN(dt) || dt < 0 || dt > Number.MAX_SAFE_INTEGER) {
                    return null;
                }
                return {
                    dt,
                    command: match[2],
                    value: parseInt(match[3]),
                };

            })
            .filter(v => !!v);
    };

    /**
     * 检查本地的文件列表和设置中的选项是否一致
     * @returns {boolean}
     */
    function checkScoreSheet() {
        try {
            // 获取本地琴谱文件名列表
            const localMusicList = getScoreList();

            // 读取配置文件
            /** @type {Array} */
            const settingsList = JSON.parse(file.readTextSync('settings.json'));
            /** @type {string[]} */
            let configMusicList = undefined;    // 配置文件中的gs2文件名列表
            let selectorIndex = -1;     // 音乐选择器在配置列表中的序号
            for(let i = 0; i < settingsList.length; i++) {
                if(settingsList[i].name === 'music_selector') {
                    selectorIndex = i;
                    configMusicList = settingsList[i].options;
                    break;
                }
            }

            // 核对两个列表是否相同
            let totallySame = true;
            if (localMusicList.length !== configMusicList.length) {
                totallySame = false;
            }
            else {
                for (let i = 0; i < localMusicList.length; i++) {
                    if (localMusicList[i] !== configMusicList[i]) {
                        totallySame = false;
                        break;
                    }
                }
            }

            // 如果不相同，则以本地列表为准，更新到配置文件中去
            if (!totallySame) {
                const updatedSettings = [...settingsList];
                updatedSettings[selectorIndex].options = localMusicList;
                file.writeTextSync("settings.json", JSON.stringify(updatedSettings, null, 4));
                log.warn("检测到曲谱文件不一致, 已自动修改settings(以本地曲谱文件为基准)...");
                log.warn("JS脚本配置已更新, 请重新运行脚本!");
                return false;
            }

            return true;

        } catch (error) {
            log.error('检查曲谱文件时发生错误：', error);
            return false;
        }
    };
    //---------------------------------------------------------

    /** 事件源 */
    const eventSource = {
        indices: [],    // 各轨道当前索引
        deltas: [],     // 各轨道剩余delta time
        division: 480,  // 一个四分音符的tick数
        microtempo: 50_0000,    // 一个四分音符的微秒数
        /**
         * 初始化事件源
         * @param {ScoreInfo} scoreInfo 
         */
        init(scoreInfo) {
            this.division = scoreInfo.division;
            this.microtempo = 50_0000;
            this.indices = new Array(scoreInfo.tracks.length).fill(0);
            this.deltas = scoreInfo.tracks.map(l => l[0].dt);
        },
        /**
         * 开始依次将轨道事件发射到接收器
         * @param {*} receiver 接收器
         * @param {ScoreInfo} scoreInfo 
         */
        async produce(receiver, scoreInfo) {
            while(true) {
                // 选择delta time最小的轨道
                let targetTrackIndex = -1;
                let minDelta = Number.MAX_SAFE_INTEGER;
                for (let i = 0; i < this.deltas.length; i++) {
                    if (this.indices[i] >= scoreInfo.tracks[i].length) {
                        continue;
                    }
                    const dt = this.deltas[i];
                    if (dt < minDelta) {
                        targetTrackIndex = i;
                        minDelta = dt;
                    }
                }

                // 所有轨道都处理完
                if (targetTrackIndex < 0) {
                    break;
                }
                // 选定事件
                let targetEvent = scoreInfo.tracks[targetTrackIndex][this.indices[targetTrackIndex]];

                // 将选定轨道的索引往后移动一位，并更新其对应的delta time
                this.indices[targetTrackIndex] += 1;
                if (this.indices[targetTrackIndex] < scoreInfo.tracks[targetTrackIndex].length) {
                    this.deltas[targetTrackIndex] = scoreInfo.tracks[targetTrackIndex][this.indices[targetTrackIndex]].dt;
                }
                else {
                    this.deltas[targetTrackIndex] = Number.MAX_SAFE_INTEGER;
                }
                // 其他轨道对应的delta time相应减少
                for (let i = 0; i < this.deltas.length; i++) {
                    const dt = this.deltas[i];
                    if (i !== targetTrackIndex) {
                        this.deltas[i] = Math.max(dt - minDelta, 0);
                    }
                }

                // 等待
                if (minDelta > 0) {
                    let waitMilliseconds = ((this.microtempo * minDelta / this.division) / 1000) | 0;
                    await sleep(waitMilliseconds);
                }

                // 发送事件到接收器
                receiver.receive(targetEvent, this);
            }
        },
    };

    /**
     * 事件接收器
     */
    const eventReceiver = {
        // keyStates: new Map(),
        fixMode: 0,
        init(fixMode) {
            this.fixMode = fixMode;
            // this.keyStates.clear();
        },
        /**
         * 
         * @param {TrackEvent} event 
         * @param {*} source 
         */
        receive(event, source) {
            // let k;
            switch (event.command) {
                case 's': // 改变microtempo
                    source.microtempo = event.value;
                    break;
                case 'n':   // 按下音符
                    let k = convertNote2Key(event.value, this.fixMode);
                    // if (k && (!this.keyStates.get(k))) {
                    if (k) {
                        // this.keyStates.set(k, true);
                        keyDown(k);
                        keyUp(k);
                    }
                    break;
                // case 'u':   // 松开音符
                    // k = convertNote2Key(event.value, this.fixMode);
                    // if (k && this.keyStates.get(k)) {
                    //     this.keyStates.set(k, false);
                    //     keyUp(k);
                    // }
                    // break;
                default:
                    break;
            }
        },
    };


    function getFixMode() {
        const modeDesc = settings.fix_mode;
        if (modeDesc == '降半音') {
            return -1;
        }
        else if (modeDesc == '升半音') {
            return 1;
        }
        else {
            return 0;
        }
    };

    /**
     * 获取乐器编号对应的乐器名称
     * @param {number} instrumentCode 
     * @returns {string} 乐器名称
     */
    function getInstrumentName(instrumentCode) {
        return instrumentNames[instrumentCode] || "未知乐器";
    }

    /**
     * 捕获游戏区域并查找指定模板，返回匹配结果对象
     * @param {object} templateRo 模板识别对象
     * @returns {object} 匹配结果对象
     */
    function findInGameRegion(templateRo) {
        try {
            const gameRegion = captureGameRegion();
            const result = gameRegion.find(templateRo);
            gameRegion.dispose();
            return result;
        } catch (error) {
            log.error(`findInGameRegion 出错: ${error.message}`);
        }
        return null;
    }

    /**
     * 获取当前画面乐器的编号
     * @returns {number} 若成功识别乐器界面，返回乐器编号，否则返回-1
     */
    function getCurrentInstrumentCode() {
        let result = -1;
        const res = findInGameRegion(mouseRo);
        if (res && res.isExist()) {
            result = 0;   // TODO: 后续根据不同乐器图标进行区分
            res.dispose();
        }
        else {
            log.warn('未检测到乐器界面，请切换到乐器界面后重新运行脚本\n如无法正确识别到乐器界面，请反馈给作者');
        }
        return result;
    }


    //----------------------------------------------------------
    async function main() {
        if (!checkScoreSheet())  return;

        // 移动鼠标到右下角
        setGameMetrics(1920, 1080, 1);
        moveMouseTo(1920, 1080);
        await sleep(500);

        // 检查是否在乐器界面
        if (getCurrentInstrumentCode() < 0) {
            return;
        }
        
        const scoreFilename = settings.music_selector;
        if (!scoreFilename) {
            log.warn('未选择曲谱，请在js配置中选择后再次运行脚本');
            return;
        }

        const scoreInfo = loadScoreInfo(scoreFilename);
        if (!scoreInfo) {
            log.warn('读取曲谱文件失败，请在js配置中选择后尝试再次运行脚本');
            return;
        }
        
        const instrumentName = getInstrumentName(scoreInfo.instrument);
        log.info('当前演奏：' + scoreInfo.title);
        log.info(`作曲人：${scoreInfo.composer}，制谱人：${scoreInfo.arranger}`);
        log.info(`推荐乐器：${instrumentName}，发布人：${scoreInfo.author}`);

        eventSource.init(scoreInfo);
        eventReceiver.init(getFixMode());

        // 开始演奏
        await eventSource.produce(eventReceiver, scoreInfo);
    };

    await main();
})();