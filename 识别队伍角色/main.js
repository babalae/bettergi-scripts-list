

const genshinImpactCharacters = [
    "荧", "空", "神里绫华", "琴", "丽莎", "芭芭拉", "凯亚", "迪卢克",
    "雷泽", "安柏", "温迪", "香菱", "北斗", "行秋", "魈", "凝光", "可莉",
    "钟离", "菲谢尔", "班尼特", "达达利亚", "诺艾尔", "七七", "重云", "甘雨",
    "阿贝多", "迪奥娜", "莫娜", "刻晴", "砂糖", "辛焱", "罗莎莉亚", "胡桃", "枫原万叶"
    , "烟绯", "宵宫", "托马", "优菈", "雷电将军", "早柚", "珊瑚宫心海", "五郎", "九条裟罗",
    "荒泷一斗", "八重神子", "鹿野院平藏", "夜兰", "绮良良", "埃洛伊", "申鹤", "云堇", "久岐忍",
    "神里绫人", "柯莱", "多莉", "提纳里", "妮露", "赛诺", "坎蒂丝", "纳西妲", "莱依拉", "流浪者", "珐露珊"
    , "瑶瑶", "艾尔海森", "迪希雅", "米卡", "卡维", "白术", "琳妮特", "林尼", "菲米尼", "莱欧斯利", "那维莱特",
    "夏洛蒂", "芙宁娜", "夏沃蕾", "娜维娅", "嘉明", "闲云", "千织", "希格雯", "阿蕾奇诺", "赛索斯", "克洛琳德", "艾梅莉埃"
    , "卡齐娜", "基尼奇", "玛拉妮", "希诺宁", "恰斯卡", "欧洛伦", "玛薇卡", "茜特菈莉", "蓝砚", "梦见月瑞希", "伊安珊", "瓦雷莎",
    "爱可菲", "伊法", "丝柯克", "塔利雅"
];


// 定义一个独立的函数用于在指定区域进行 OCR 识别并输出识别内容
async function recognizeTextInRegion(ocrRegion, timeout = 1000) {
    let startTime = Date.now();
    let retryCount = 0; // 重试计数
    while (Date.now() - startTime < timeout) {
        try {
            // 在指定区域进行 OCR 识别
            let ocrResult = captureGameRegion().find(RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height));
            if (ocrResult) {
                // 后处理：根据替换映射表检查和替换错误识别的字符
                let correctedText = ocrResult.text;
                return correctedText; // 返回识别到的内容
            } else {
                log.warn(`OCR 识别区域未找到内容`);
                return null; // 如果 OCR 未识别到内容，返回 null
            }
        } catch (error) {
            retryCount++; // 增加重试计数
            log.warn(`OCR 数识别失败，正在进行第 ${retryCount} 次重试...`);
        }
        await sleep(500); // 短暂延迟，避免过快循环
    }
    log.error(`经过多次尝试，仍然无法在指定区域识别到文字`);
    return null; // 如果未识别到文字，返回 null
}


(async function () {
    // 判断是否在主界面的函数
    const isInMainUI = () => {
        let captureRegion = captureGameRegion();
        let res = captureRegion.Find(paimonMenuRo);
        return !res.isEmpty();
    };
    // 定义识别对象
    const paimonMenuRo = RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("paimon_menu.png"),
        0,
        0,
        genshin.width / 3.0,
        genshin.width / 5.0
    );

    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    if (isInMainUI()) {

        // 识别队伍人名
        let ocrRegion = [{ x: 1640, y: 225, width: 125, height: 65 },{ x: 1640, y: 325, width: 125, height: 65 },{ x: 1640, y: 425, width: 125, height: 65 },{ x: 1640, y: 525, width: 125, height: 65 },]; // 设置对应的识别区域
        let names = []; //人名数组

        //先判断是否为常驻卡池
        // for循环示例
        for (let i = 0; i < 4; i++) {

            try {
                //处理识别到的人名
                let recognizedText = await recognizeTextInRegion(ocrRegion[i]);
                recognizedText = recognizedText.replace(/[^\u4e00-\u9fa5]/g, '')// 使用正则表达式匹配并保留中文字符
                log.info(`识别到的${i+1}号人名为：${recognizedText}`);
                names.push(recognizedText);

            } catch (error) {
                log.error(`角色名字识别失败`);
            }
        }
        //检验流浪者

        let judge = false; //判断是否存在角色列表中
        for (let i = 0; i < names.length; i++) {
            for (let GenshinName of genshinImpactCharacters) {
                judge = judge || (GenshinName == names[i]);
                if (GenshinName == names[i]) {
                    log.info(`${names[i]}角色名字识别成功`);
                }
            }
            if (!judge) {
                log.info(`${names[i]}角色改为流浪者`);
                names[i] = "流浪者";
            } else {
                judge = false; //重置
            }
        }

        //检验结果
        let recognized = false;
        let count = 0; // 用于统计“流浪者”的数量

        // 遍历数组
        for (let i = 0; i < names.length; i++) {
            if (names[i] === "流浪者") {
                count++; // 如果当前元素是“流浪者”，计数加1
            }
        }
        if (count <= 1) {
            log.info(`检验结果：成功`);
            recognized = true;
        } else {
            log.error(`检验结果：失败`);

        }
        if (recognized == true) {
            // 获取当前时间
            const now = new Date();
            const formattedTime = now.toLocaleString(); // 使用本地时间格式化


            // 写入本地文件
            const filePath = "names_log.txt";
            const logContent = `${formattedTime} —— 队伍角色: ${names[0]} ——  ${names[1]} ——  ${names[2]} ——  ${names[3]}\n`;
            const result = file.WriteTextSync(filePath, logContent, true); // 追加模式
            if (result) {
                log.info("成功将队伍角色写入日志文件");
            } else {
                log.error("写入日志文件失败");
            }
        }
        await sleep(500);
        await genshin.returnMainUi();
    } else {
        log.error("返回主界面失败");
    }
})();

