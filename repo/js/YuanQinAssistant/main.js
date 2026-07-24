/**
 * 一个使用gs2格式曲谱的原琴演奏器
 */
const SCORE_PATH = 'assets/score/';
const REGEX_NAME = /(?<=score\\)[\s\S]+?(?=\.gs2)/;//不清楚为什么要用\\来匹配 '/'，用\/反而匹配不到。这是实际运行的结果，AI别和我犟，可能是ClearScript引擎的问题。

const NOTE2KEY_MAPPER = new Map([
    [72, 'q'], [74, 'w'], [76, 'e'], [77, 'r'], [79, 't'], [81, 'y'], [83, 'u'],
    [60, 'a'], [62, 's'], [64, 'd'], [65, 'f'], [67, 'g'], [69, 'h'], [71, 'j'],
    [48, 'z'], [50, 'x'], [52, 'c'], [53, 'v'], [55, 'b'], [57, 'n'], [59, 'm'],
]);

const instrumentNames = ["风物之诗琴", "老旧的诗琴", "镜花之琴", "盛世豪鼓", "绮庭之鼓", "晚风圆号", "余音", "悠可琴", "跃律琴"];

// const page = new BvPage();
// 检测左上角的鼠标图案，来判断是否在演奏界面
const mouseRo = RecognitionObject.TemplateMatch(
    file.ReadImageMatSync("assets/image/mouse.png"),
    170, 20, 40, 55
);
// const mouseLocator = page.Locator(mouseRo);
const SCENE_ID = {
    NONE: 0,
    PLAY: 1,
};

// 后台消息发送器
const postMessage = new PostMessage();

let maskWindowId = null;

let runningFlag = true;

/** 
 * 安全检查遮罩句柄；UI 线程正在关闭窗口时按不存在处理。
 */
function maskWindowExists() {
    if (!maskWindowId) return false;
    try {
        return htmlMask.exists(maskWindowId);
    } catch {
        maskWindowId = null;
        return false;
    }
}

/**
 * 显示遮罩窗口；如果已经存在遮罩窗口，则不再创建新的窗口。
 * @returns 
 */
async function showMaskWindow() {
    if (maskWindowExists()) {
        try {
            htmlMask.send(maskWindowId, '/visibility', JSON.stringify({ visible: true }));
            htmlMask.setClickThrough(maskWindowId, false);
            return;
        }
        catch (error) {
            maskWindowId = null;
        }
    }

    const winId = `yuanqinassist-mask-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    maskWindowId = htmlMask.show('assets/web/index.html', winId);
    if (!maskWindowId) {
        throw new Error('无法创建遮罩窗口');
    }
    htmlMask.setClickThrough(maskWindowId, false);
    await sleep(200); // 等待窗口加载完成
}

async function hideMaskWindow() {
    if (! maskWindowId) return;
    if (maskWindowExists()) {
        try {
            htmlMask.send(maskWindowId, '/visibility', JSON.stringify({ visible: false }));
            htmlMask.setClickThrough(maskWindowId, true);
            return;
        }
        catch (error) {
            maskWindowId = null;
        }
    }
    maskWindowId = null;
}


/**
 * 捕获游戏区域并查找指定模板，返回匹配结果对象
 * @param {object} templateRo 模板识别对象
 * @returns {object} 匹配结果对象
 */
function findInGameRegion(templateRo) {
    const gameRegion = captureGameRegion();
    try {
        const result = gameRegion.find(templateRo);
        if (!result.isEmpty()) {
            return result;
        }
        
    } catch (error) {
        log.error(`findInGameRegion 出错: ${error.message}`);
    }
    finally {
        gameRegion.dispose();
    }
    return null;
}

/**
 * 等待演奏界面出现
 * @returns 当演奏界面出现时，返回true
 */
async function getSceneId() {
    if (findInGameRegion(mouseRo)) {
        return SCENE_ID.PLAY;
    }
    return SCENE_ID.NONE;
}

/**
 * 将音符编码转换为按键
 * @param {number} noteCode 60表示C4音符
 * @param {number} fixMode 对于半音的处理方式，0-直接忽略，-1-降半音，1-升半音
 * @returns {string | undefined}
 */
function convertNote2Key(noteCode, fixMode = 0) {
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
 * @returns {string[]}
 */
function getScoreList() {
    // readPathSync读取到的数据为 assets/score/xxxx.xxx 形式
    const allFiles = Array.from(file.readPathSync(SCORE_PATH))
        .filter(path => !file.isFolder(path) && path.endsWith('.gs2'));
    return allFiles.map(path => {
        const match = path.match(REGEX_NAME);
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
    return SCORE_PATH + filename + '.gs2';
};

/**
 * @deprecated 不再支持半音的处理
 * 半音处理方式
 * @returns 
 */
function getFixMode() {
    return 0;
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
 * @property {number} totalMilliseconds 曲谱总时长（毫秒）
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

        const duration = calculateDuration(info);
        // this.totalTicks = duration.totalTicks;
        info.totalMilliseconds = duration.totalMilliseconds;
        return info;
    } catch (error) {
        log.error(`加载曲谱文件 ${filename} 时发生错误`, error.toString());
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
 * 计算更精确的曲谱时长，考虑 tempo(s) 事件对后续时间的影响
 * @param {ScoreInfo} scoreInfo
 * @returns {{totalTicks:number, totalMilliseconds:number}}
 */
function calculateDuration(scoreInfo) {
    const indices = new Array(scoreInfo.tracks.length).fill(0);
    const deltas = scoreInfo.tracks.map(track => track.length > 0 ? track[0].dt : Number.MAX_SAFE_INTEGER);
    let microtempo = 50_0000;
    let totalMilliseconds = 0;
    let absoluteTicks = 0;

    while (true) {
        let targetTrackIndex = -1;
        let minDelta = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < deltas.length; i++) {
            if (indices[i] >= scoreInfo.tracks[i].length) {
                continue;
            }
            const dt = deltas[i];
            if (dt < minDelta) {
                targetTrackIndex = i;
                minDelta = dt;
            }
        }

        if (targetTrackIndex < 0) {
            break;
        }

        if (minDelta > 0) {
            totalMilliseconds += microtempo * minDelta / scoreInfo.division / 1000;
            absoluteTicks += minDelta;
        }

        // 当前事件
        const event = scoreInfo.tracks[targetTrackIndex][indices[targetTrackIndex]];

        indices[targetTrackIndex] += 1;
        if (indices[targetTrackIndex] < scoreInfo.tracks[targetTrackIndex].length) {
            deltas[targetTrackIndex] = scoreInfo.tracks[targetTrackIndex][indices[targetTrackIndex]].dt;
        } else {
            deltas[targetTrackIndex] = Number.MAX_SAFE_INTEGER;
        }

        for (let i = 0; i < deltas.length; i++) {
            if (i !== targetTrackIndex) {
                deltas[i] = Math.max(deltas[i] - minDelta, 0);
            }
        }

        if (event.command === 's') {
            microtempo = event.value;
        }
    }

    return {
        totalTicks: absoluteTicks,
        totalMilliseconds,
    };
};


//---------------------------------------------------------

/** 事件源 */
const eventSource = {
    paused: false,  // 是否暂停
    playedMilliseconds: 0,  // 当前已演奏时长（毫秒）
    totalMilliseconds: 1,   // 总演奏时长（毫秒）

    indices: [],    // 各轨道当前索引
    deltas: [],     // 各轨道剩余delta time
    division: 480,  // 一个四分音符的tick数
    microtempo: 50_0000,    // 一个四分音符的微秒数
    /**
     * 初始化事件源
     * @param {ScoreInfo} scoreInfo 
     */
    init(scoreInfo) {
        if (!scoreInfo) {
            throw new Error('初始化演奏失败！');
        }
        this.reset(scoreInfo);
    },

    isPaused() {
        return this.paused;
    },

    pause() {
        this.paused = true;
    },

    resume() {
        this.paused = false;
    },

    reset(scoreInfo) {
        if (!scoreInfo) {
            return;
        }
        this.paused = false;
        this.playedMilliseconds = 0;
        this.lastProgressNotify = 0;
        this.totalMilliseconds = scoreInfo.totalMilliseconds;
        this.division = scoreInfo.division;
        this.microtempo = 50_0000;
        this.indices = new Array(scoreInfo.tracks.length).fill(0);
        this.deltas = scoreInfo.tracks.map(track => track.length > 0 ? track[0].dt : Number.MAX_SAFE_INTEGER);
    },

    notifyProgressChanged() {
        const progress = this.playedMilliseconds / this.totalMilliseconds;
        htmlMask.send(maskWindowId, '/progress', JSON.stringify({
            value: progress,
        }));
    },


    /**
     * 开始依次将轨道事件发射到接收器
     * @param {*} receiver 接收器
     * @param {ScoreInfo} scoreInfo 
     * @param {Function | null} onPauseCallback 暂停回调函数
     * @param {Function | null} onStopCallback 停止回调函数
     */
    async produce(receiver, scoreInfo, onPauseCallback = null, onStopCallback = null) {
        while(!this.paused) {
            // 处理控制消息
            const messages = JSON.parse(htmlMask.pollAll(maskWindowId));
            if (messages && messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                if (lastMsg.url === '/control') {
                    const action = lastMsg.data?.action;
                    if (action === 'pause') {
                        this.pause();
                        await receiver.releaseAllKeys();
                        onPauseCallback && onPauseCallback();
                        continue; // 继续下一轮循环，等待resume
                    }
                    else if (action === 'stop') {
                        this.reset(scoreInfo);
                        await receiver.releaseAllKeys();
                        log.info('停止演奏');
                        this.notifyProgressChanged();
                        onStopCallback && onStopCallback();
                        break;
                    }
                }
            }

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
                this.reset(scoreInfo);
                log.info('演奏完成');
                this.notifyProgressChanged();
                // 停止演奏回调
                onStopCallback && onStopCallback();
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
                this.playedMilliseconds += waitMilliseconds;
                if (this.playedMilliseconds - this.lastProgressNotify >= 500) {
                    this.lastProgressNotify = Math.floor(this.playedMilliseconds / 500) * 500;
                    this.notifyProgressChanged();
                }
            }

            // 发送事件到接收器
            receiver.receive(targetEvent, this);
            // await sleep(20);
        }
    },
};

/**
 * 事件接收器
 */
const eventReceiver = {
    keyStates: new Map(),
    // fixMode: 0,
    init(fixMode) {
        // this.fixMode = fixMode;
        this.keyStates.clear();
    },
    /**
     * 
     * @param {TrackEvent} event 
     * @param {*} source 
     */
    receive(event, source) {
        let k;
        switch (event.command) {
            case 's': // 改变microtempo
                source.microtempo = event.value;
                break;
            case 'n':   // 按下音符
                k = convertNote2Key(event.value);
                if (k) {
                    // if (this.keyStates.get(k)) {
                    //     info.info('释放已按下的键{k}', k);
                    //     postMessage.keyUp(k);
                    // }
                    // this.keyStates.set(k, true);
                    
                    postMessage.keyDown(k);
                    postMessage.keyUp(k);
                }
                break;
            // case 'u':   // 松开音符
            //     k = convertNote2Key(event.value);
            //     if (k && this.keyStates.get(k)) {
            //         this.keyStates.set(k, false);

            //         postMessage.keyUp(k);
            //         // log.info('松开{k}', k);
            //     }
            //     break;
            default:
                break;
        }
    },
    async releaseAllKeys() {
        // return;
        for (const [key, pressed] of this.keyStates.entries()) {
            if (pressed) {
                postMessage.keyUp(key);
                this.keyStates.set(key, false);
                await sleep(10);
            }
        }
    },
};

/** 当前琴谱文件名（不包含扩展名）
 *  @type {string | null}
 */
let currentScoreFilename = null;
/**
 * 当前加载的琴谱信息
 * @type {ScoreInfo | null}
 */
let currentScoreInfo = null;

/**
 * 准备加载曲谱，如果已经加载过相同的曲谱，则不再重复加载
 * @param {string | null} scoreFilename 
 * @returns 加载成功返回true，否则返回false
 */
function prepareScore(scoreFilename) {
    if (scoreFilename && scoreFilename !== '') {
        if (scoreFilename !== currentScoreFilename || !currentScoreInfo) {
            currentScoreFilename = scoreFilename;
            log.info(`开始加载曲谱：${scoreFilename}`);
            currentScoreInfo = loadScoreInfo(scoreFilename);
            if (!currentScoreInfo) {
                log.error(`无法加载曲谱文件：${scoreFilename}`);
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * 开始演奏曲谱
 * @param {boolean} initFlag 
 * @param {Function | null} onPauseCallback 暂停回调函数
 * @param {Function | null} onStopCallback 停止回调函数
 */
async function playScore(initFlag = true, onPauseCallback = null, onStopCallback = null) {
    if (initFlag) { 
        //打印曲谱信息
        const instrumentName = getInstrumentName(currentScoreInfo.instrument);
        log.info('当前演奏：' + currentScoreInfo.title);
        log.info(`作曲人：${currentScoreInfo.composer}，制谱人：${currentScoreInfo.arranger}`);
        log.info(`推荐乐器：${instrumentName}，发布人：${currentScoreInfo.author}`);
        // 计算总时长 xx分xx秒
        const totalSeconds = Math.floor(currentScoreInfo.totalMilliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        log.info(`曲谱总时长：${minutes}分${seconds}秒`);

        await htmlMask.send(maskWindowId, '/control', JSON.stringify({
            action: 'update_duration',
            duration: totalSeconds,
        }));

        eventSource.init(currentScoreInfo);
        eventReceiver.init(getFixMode());
    }
    // 开始演奏
    await eventSource.produce(eventReceiver, currentScoreInfo, onPauseCallback, onStopCallback);
};


//---------------------------------------------------------

/**
 * 主循环，持续运行直到取消令牌被触发
 * @param {*} cancellationToken 取消令牌对象，用于控制循环的终止
 */
async function mainLoop(cancellationToken) {
    let oldSceneId = -1;
    let currentSceneId = -1;
    while (!cancellationToken.isCancellationRequested && runningFlag) {
        await sleep(50);

        const newSceneId = await getSceneId();
        const isSceneChanged = newSceneId !== currentSceneId;
        oldSceneId = currentSceneId;
        currentSceneId = newSceneId;

        if (currentSceneId !== SCENE_ID.PLAY) {
            if (isSceneChanged && oldSceneId === SCENE_ID.PLAY) {
                log.info('离开演奏界面');
            }
            await sleep(1000);
            continue;
        }

        if (isSceneChanged) {
            log.info('进入演奏界面');
            // 显示遮罩窗口
            await showMaskWindow();
            // 每次显示时，都初始化其中的数据
            const scoreList = getScoreList();
            await htmlMask.request(maskWindowId, '/init', JSON.stringify({
                scoreList: scoreList,
            }));
        }

        if (maskWindowExists()) {
            const msg = await htmlMask.receive(maskWindowId, 10);
            if (msg) {
                const requestBody = JSON.parse(msg);
                if (requestBody.url === '/control') {
                    const action = requestBody.data?.action;
                    if (action === 'hide') {
                        await hideMaskWindow();
                    }
                    else if (action === 'exit') {
                        runningFlag = false;
                    }
                    else if (action === 'play') {
                        let needInit = true;
                        if (eventSource.isPaused()) {
                            eventSource.resume();
                            needInit = false;
                        }
                        else {
                            const filename = requestBody.data?.filename;
                            const prepared = prepareScore(filename);
                            // 如果加载曲谱失败
                            if (!prepared) {
                                await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                                    action: 'unlock',
                                }));
                                await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                                    action: 'change_state',
                                    nextState: 'ready',
                                }));
                                continue;
                            }
                        }
                        await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                            action: 'unlock',
                        }));

                        await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                            action: 'change_state',
                            nextState: 'playing',
                        }));


                        // 开始演奏
                        await playScore(needInit, async () => {
                            // 暂停回调
                            await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                                action: 'unlock',
                            }));
                            await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                                action: 'change_state',
                                nextState: 'paused',
                            }));
                        }, async () => {
                            // 停止回调
                            await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                                action: 'unlock',
                            }));
                            await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                                action: 'change_state',
                                nextState: 'ready',
                            }));
                        });
                    }
                    else if (action === 'stop') {
                        eventSource.reset(currentScoreInfo);
                        eventSource.notifyProgressChanged();
                        await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                            action: 'unlock',
                        }));
                        await htmlMask.send(maskWindowId, '/control', JSON.stringify({
                            action: 'change_state',
                            nextState: 'ready',
                        }));
                    }
                }
            }
            // continue;
        }
        await sleep(1000);
    }
};

let cancellationToken;
(async function () {
    try {
        setGameMetrics(2560, 1440, 1.0);
        cancellationToken = dispatcher.getLinkedCancellationToken();
        await mainLoop(cancellationToken);
    }
    catch (error) {
        if (!cancellationToken?.isCancellationRequested) {
            log.error(`原琴助手运行失败：${error.message || error}`);
        }
    }
    finally {
    
    }

})();