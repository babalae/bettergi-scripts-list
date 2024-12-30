/**
 *  谱子说明：/为节拍线，每两个/之间为一拍，每个字符占1/4拍，小括号（ ）内视为一个整体，一起按下，中括号【 】内从左到右依次快速演奏。
 * @author 阿城同学
 * @link https://github.com/shilic
 */
// 所有的代码必须由 async function 包裹
(async function () {
    log.info("[{YuanQin}]正在启动", "原琴");
    /* ------------------------------------------------------1. 数据结构区, 以下代码用于预定义数据结构-------------------------------------------------- */
    // 从配置中获取你选择的乐谱
    let selectValue = settings.selectValue;
    //log.info("selectValue:{options}",selectValue);
    let scoreFilePath = `assets/${selectValue}.json`;
    /** 定义分割类型枚举 */
    const SplitTypeEnum = {
        /** 括号分割 */
        Bracket : 0,
        /** 逗号分割 */
        Comma : 1,
        /** 默认分割类型 */
        Default : 2,
    };
    /** 定义音符类型枚举 */
    const ToneTypeEnum = {
        /** 该音符表示一个长停顿，例如某段歌曲中的间隔 （就是换气，谁TM 唱歌不换气啊）。文件中用 / 表示 */
        LongPause : 0,
        /** 该音符表示一个单音符（简简单单） */
        Single : 1,
        /** 该音符表示一个多音符，即多个音符同时按下（原琴玩家表示办不到啊，只有用脚本了） ，如 (QA) 表示这两个同时按下 */
        Multi : 2,
        /** 一个短间隔，在文件中用 <> 表示 ，表示左右两个字符需要快速弹奏。 */
        ShortInterval : 3,
    };
    /** 音符对象模型 */
    var ToneObject = {
        toneType : ToneTypeEnum.Single ,
        tones : [] ,
    };
    /** 定义一个乐谱对象原型，用于描述乐谱。 */
    var MusicScoreObject = {
        /** 乐谱名称 */
        name : "" ,
         /** 一个短间隔（单位：毫秒）。在文件中用 <> 表示 ，表示左右两个字符需要快速弹奏。 */
        shortMills : 80,
        /** 暂停间隔 （单位：毫秒）。当你按下一个音符时，需要暂停这么多毫秒的时间再按下一个音符（废话，难道你一直按啊）*/
        pauseMills : 200 ,
        /** 长间隔 （单位：毫秒）。表示一个长停顿，例如某段歌曲中的间隔 。（就是换气，谁TM 唱歌不换气啊）*/
        longPauseMills : 500 ,
        /** 分割类型 。用于适应不同的乐谱格式，例如：将同时按下的音符用括号括起来。 */
        split : SplitTypeEnum.Bracket ,
        /** 音符列表 这个字段用于以字符串形式表示音符列表 */
        toneStr : "",
        /** 音符列表 用 列表的形式存储每个音符 toneList : ToneObject = [] */
        toneList :  [] ,
    };
    /* ----------------------------------------------------2. 执行区域 ,以下代码用于正式执行操作------------------------------------------------------ */
    /** 乐谱对象 
     * @class MusicScoreObject
    */
    let musicScore = await getMusicScoreFromFile(scoreFilePath); // 使用 await 来等待函数执行完毕。获取乐谱
    ////await printMusicScore(musicScore); //打印一个乐谱的基本信息
    let ifParse = await parseScore(musicScore); // 解析乐谱
    if(ifParse){
        log.info("音符解析成功,尝试播放《{name}》",musicScore.name);
        //await printTones(musicScore); // 打印解析后的音符列表
        await sleep(3000); 
        await playMusic(musicScore);
    }
    else{
        log.error("音符解析失败");
    }

    //await regexTest2();
    /* ---------------------------------------------------3. 方法区 ,  以下代码用于定义方法------------------------------------------------------------*/
    /**
     * 从文件中读取一个乐谱
     * @param {String} scorePath 文件地址，例如 assets/JOJO黄金之风.json
     * @returns 返回一个乐谱对象 MusicScoreObject
     */
    async function getMusicScoreFromFile(scorePath){
        let musicScore = Object.create(MusicScoreObject); // 通过原型创建一个乐谱对象
        //log.info(`尝试读取乐谱《${scorePath}》`);
        let fileContent;
        try {
            fileContent = file.readTextSync(scorePath); // 同步阻塞式的将乐谱从文件中读取。
            //log.info("{fileContent}",fileContent); // 用于测试读取文件，测试成功
            //log.info("[{y}]读取乐谱文件《{scorePath}》成功","原琴",scorePath);
        } catch (error) {
            log.error("[{y}]在读取文件 《{scorePath}》时，发生错误","原琴",scorePath);
            return null ;
        }
        if(fileContent == null){ // 可能存在文件无法读出的情况，增加一步校验。
            log.error("[{y}]在读取文件 《{scorePath}》，文件为空","原琴",scorePath);
            return null ;
        }
        // 一些正则表达式，用于解析你的乐谱文件
        const scoreNameRegex = /"\s*name\s*"\s*:\s*"\s*(?<scoreName>[^"]+)\s*"\s*,/; 
        const scoreShortRegex = /"\s*short\s*"\s*:\s*"?\s*(?<scoreShort>\d+)\s*"?\s*,/; 
        const scorePauseRegex = /"\s*pause\s*"\s*:\s*"?\s*(?<scorePause>\d+)\s*"?\s*,/; 
        const scoreLongPauseRegex = /"\s*longPause\s*"\s*:\s*"?\s*(?<scoreLongPause>\d+)\s*"?\s*,/; 
        const scoreSplitRegex = /"\s*split\s*"\s*:\s*"\s*(?<scoreSplit>[^"\s]+)\s*"\s*,/; 
        const scoreTonesRegex = /"\s*toneStr\s*"\s*:\s*"\s*(?<scoreTones>[^"]+)\s*"\s*,?/; 
        // 执行正则表达式  匹配操作
        const scoreNameMatch = scoreNameRegex.exec(fileContent); 
        const scoreShortMatch = scoreShortRegex.exec(fileContent);
        const scorePauseMatch = scorePauseRegex.exec(fileContent);
        const scoreLongPauseMatch = scoreLongPauseRegex.exec(fileContent);
        const scoreSplitMatch = scoreSplitRegex.exec(fileContent);
        const scoreTonesMatch = scoreTonesRegex.exec(fileContent);
        // 得到匹配结果
        // 可能会出现无法捕获的情况，例如用户没有填这个字段。给代码增加容错性。
        // 使用 try-catch 语句，替换了原来的空值判断，看来java的正则表达式和js还是不太一样，java是可以直接获取，但是可能为空，而js是直接报错。
        try {
            musicScore.name = scoreNameMatch.groups.scoreName;
        } catch (error) {
            log.error("未识别到乐曲名称");
        }
        try {
            musicScore.shortMills = parseInt(scoreShortMatch.groups.scoreShort) ;
        } catch (error) {
            log.error("未识别到短间隔");
        }
        try {
            musicScore.pauseMills = parseInt(scorePauseMatch.groups.scorePause);
        } catch (error) {
            log.error("未识别到普通间隔");
        }
        try {
            musicScore.longPauseMills = parseInt(scoreLongPauseMatch.groups.scoreLongPause);
        } catch (error) {
            log.error("未识别到长间隔");
        }
        try {
            let value = scoreSplitMatch.groups.scoreSplit;
            if(value === "括号"){
                musicScore.split = SplitTypeEnum.Bracket ;
            }else if(value === "逗号"){
                musicScore.split = SplitTypeEnum.Comma ;
            }else{
                musicScore.split = SplitTypeEnum.Bracket ;
            }
        } catch (error) {
            log.error("未识别到分割类型");
        }
        try {
            musicScore.toneStr = scoreTonesMatch.groups.scoreTones;
        } catch (error) {
            log.error("未识别到乐谱");
        }
        return musicScore;
    } //getMusicScoreFromFile 从文件中读取一个乐谱
    /**
     * 解析一个乐谱对象
     * @param {MusicScoreObject} musicScore 
     * @returns 返回是否解析成功
     */
    async function parseScore(musicScore) {
        if (musicScore == null){
            return false;
        }
        musicScore.toneList = await parseTones(musicScore.toneStr,musicScore.split);
        if(musicScore.toneList == null){
            return false;
        }
        return true;
    } // 解析一个乐谱对象
    /**
     * 传入待解析的字符串，以及分割类型，解析得到最终的音符数组
     * @param {String} tonesString 
     * @param {SplitTypeEnum} splitType 
     * @returns 返回一个音符数组
     */
    async function parseTones(tonesString ,splitType) {
        let toneList = [] ; //预定义返回值
        /** 括号分割模式下，用于识别音符的正则表达式  /g 表示全局匹配*/
        // /([(]\s*(?<multi>[A-Za-z]{2,})\s*[)])|(?<single>[a-zA-Z])|(?<LongPause>[/])/g
        const BracketRegex =/([(]\s*(?<multi>[A-Za-z]{2,})\s*[)])|(?<single>[a-zA-Z])|(?<LongPause>[/|])|(?<shortPause>[<\[\{]\s*(?<item>[A-Za-z]{2,})\s*[\}>\]])/g ; // 由 + 号表示长间隔，改为了由 / 表示
        let regex = null;
        if(splitType == SplitTypeEnum.Bracket){ // 括号分割
            regex = BracketRegex;
        }
        else{
            log.error("未识别到音符分割模式"); 
        }
        if(regex == null){
            return null;
        }
        //let match = regex.exec(tonesString);
        log.info("正在执行音符匹配"); 
        let match;
        //let toneArray = [] ;
        while( match = regex.exec(tonesString) ) {
            let tone = Object.create(ToneObject); // 通过原型创建一个音符对象
            tone.tones = [] ;
            let value ;
            
            if(match.groups.multi != null){
                //log.debug("{m}",match[1]);
                tone.toneType = ToneTypeEnum.Multi ;
                value = match.groups.multi; // 如 EHN 
                const charArray = Array.from(value);
                for (const element of charArray) {
                    tone.tones.push(element);
                }
                //log.debug("multi ={m}",value);
            }
            if(match.groups.single != null){
                tone.toneType = ToneTypeEnum.Single ;
                value = match.groups.single ; // 如 B
                //tone.tones.push(value);
                tone.tones = value ;
                //log.debug("single ={m}",value);
            }
            if(match.groups.LongPause != null){
                tone.toneType = ToneTypeEnum.LongPause ;
                value = match.groups.LongPause ; // 如 + 号；以及多个加号，如 +++ 表示更长时间的停顿
                // const charArray = Array.from(value);
                // for (const element of charArray) {
                //     tone.tones.push(element);
                // }
                tone.tones = value ;
            }
            if(match.groups.shortPause != null){
                tone.toneType = ToneTypeEnum.ShortInterval ;
                //let shortPauseValue = match.groups.shortPause ; // <JHHKJ>
                let value = match.groups.item ; // JHHKJ
                const charArray = Array.from(value);
                for (const element of charArray) {
                    tone.tones.push(element);
                }
                //log.info("快速弹奏的音符：{m}",shortPauseValue);
            }
            // else{
            //     log.info("未识别到快速弹奏的音符{m}",match.groups.shortPause);
            // }
            toneList.push(tone);
            // //log.debug("{m}",value);
            //toneArray.push(value);
        }
        //log.debug("{m}",toneArray);
        return toneList ;
    } // 传入待解析的字符串，以及分割类型，解析得到最终的音符数组

    /**
     * 打印解析后的音符列表
     * @param {MusicScoreObject} musicScore 
     */
    async function printTones(musicScore) {
        let toneList = musicScore.toneList;
        let toneStr = "" ;
        for(const toneObject of toneList) { // 遍历所有音符
            let type = toneObject.toneType;
            let tones = toneObject.tones;
            switch(type){
                case ToneTypeEnum.Multi:
                    toneStr = toneStr + "(" ;
                    toneStr = toneStr + tones;
                    toneStr = toneStr + ")" ;
                    toneStr = toneStr + " ";
                    break;
                case ToneTypeEnum.Single:
                    toneStr = toneStr + tones;
                    toneStr = toneStr + " ";
                    break;
                case ToneTypeEnum.LongPause:
                    toneStr = toneStr + tones;
                    toneStr = toneStr + " ";
                    break;
                case ToneTypeEnum.ShortInterval:
                    toneStr = toneStr + "<" ;
                    toneStr = toneStr + tones;
                    toneStr = toneStr + ">" ;
                    toneStr = toneStr + " ";
                    break;
                default:
                    break;
            }
        } // 遍历所有音符
        log.info("{m}",toneStr);
    } // 打印解析后的音符列表
    /**
     * 执行播放操作
     * @param {MusicScoreObject} musicScore 
     */
    async function playMusic(musicScore) {
        let mills = musicScore.pauseMills ;
        let shortMills = musicScore.shortMills;
        let longPause = musicScore.longPauseMills ;
        let toneList = musicScore.toneList;
        for(const toneObject of toneList) { // 遍历所有音符
            let type = toneObject.toneType;
            let tones = toneObject.tones;
            // 1. 按下按键，并松开  
            switch(type){
                case ToneTypeEnum.Multi:
                    await playMulti(tones);
                    await sleep(mills);
                    break;
                case ToneTypeEnum.Single:
                    await playSingle(tones);
                    await sleep(mills);
                    break;
                case ToneTypeEnum.LongPause:
                    await sleep(longPause);
                    break;
                case ToneTypeEnum.ShortInterval:
                    for(const item of tones){
                        await playSingle(item);
                        await sleep(shortMills) ;
                    }
                    break;
                default:
                    break;
            }
            // 2. 间隔一定时间
        } // 遍历所有音符
    } //执行播放操作
    /**
     * 模拟单个按键按下
     * @param {String} singlekey 
     */
    async function playSingle(singlekey) {
        //按下按键后马上松开
        keyDown(singlekey);
        keyUp(singlekey);
    }
    /**
     * 模拟多个按键同时按下
     * @param {String[]} multiKeyArray 
     */
    async function playMulti(multiKeyArray) {
        // 多个按键同时按下
        for(const key of multiKeyArray){
            keyDown(key);
        }
        // 多个按键同时松开
        for(const key of multiKeyArray){
            keyUp(key);
        }
    } // 模拟多个按键同时按下
    async function regexTest2(params) {
        let regex = /((?<item>[A-Za-z])~?)/g;
        let match;
        let input = "J~H~J~W~K";
        while(match = regex.exec(input)){
            log.info("音符{m}",match.groups.item);
            //log.info("音符{m}",match[1]);
        } //while
    }

})();// 所有的代码必须由 async function 包裹