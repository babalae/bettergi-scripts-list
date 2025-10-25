function getUidFromCover() {
    // 1. 获取游戏窗口截图（全区域）
    const captureRegion = captureGameRegion();

    // 2. 1080P 下 UID 区域的原始坐标
    const x1080 = 1685;
    const y1080 = 1053;
    const width1080 = 178;
    const height1080 = 22;

    // 3. 根据当前分辨率的缩放比例，计算实际坐标
    const scale = genshin.scaleTo1080PRatio;
    const x = x1080 * scale;
    const y = y1080 * scale;
    const w = width1080 * scale;
    const h = height1080 * scale;

    try {
        // 4. 按区域执行 OCR
        const resList = captureRegion.findMulti(RecognitionObject.Ocr(x, y, w, h));
        // 打印区域坐标和大小
        log.info(`OCR 区域识别结果数量 ${x} ${y} ${w} ${h} scale:${scale} resList.count：${resList.count}`);

        // 5. 遍历所有结果，筛选符合 UID 格式的文本
        const uidRegex = /^(?:UID[:：]?)?(\d+)$/i;
        if (resList.count > 0) {
            for (let i = 0; i < resList.count; i++) {
                const raw = resList[i].text.trim();
                log.info(`检测到区域内文本 ${raw}`);

                const match = raw.match(uidRegex);
                if (match) {
                    const uid = match[1];  // 提取出纯数字部分
                    log.info(`识别到的 UID: ${uid}`);
                    return uid;
                } else {
                    log.info(`识别结果不符合 UID 格式: ${raw}`);
                }
            }
            log.info("区域内未识别到符合格式的 UID");
        } else {
            log.info("指定区域内未检测到任何文本");
        }
    } catch (error) {
        log.error(`获取 UID 时发生错误: ${error}`);
    }
}
const myuid = getUidFromCover()
log.info(`识别结果myuid: ${myuid}`);

