(async function () {
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();

    let language = settings.language;

    const languageMessages = {
        "简体中文": ["切换至简体中文", 260],
        "繁體中文": ["切換至繁體中文", 310],
        "English": ["Switch to English", 360],
        "日本語": ["日本語に切り替え", 460],
        "한국어": ["한국어로 전환", 410]
    };

    const [message, yPos] = languageMessages[language] || ["Unknown language, switch to Chinese", 260];
    log.info(message);

    keyPress("ESCAPE");
    await sleep(1000);
    click(50, 830); //点击设置
    await sleep(1000);
    click(180, 510); //点击语言
    await sleep(1000);
    click(1630, 210); //点击选项
    await sleep(1000);
    moveMouseTo(1630, 260);
    await PageScroll(1);
    await sleep(1000);
    click(1630, yPos);
    await genshin.returnMainUi();
})();

// 自动执行划页操作
async function PageScroll(scrollCount) {
    try {
        const clickX = 1630; // 假设点击的起始坐标
        const clickY = 260;
        const totalDistance = 200; // 假设每次滑动的总距离
        const stepDistance = 15; // 每步移动的距离

        for (let i = 0; i < scrollCount; ++i) {
            // 如果点击坐标为 (0, 0)，则跳过点击
            if (clickX !== 0 || clickY !== 0) {
                moveMouseTo(clickX, clickY); // 移动到指定坐标
                await sleep(100);
            }

            // 按住鼠标左键
            leftButtonDown();

            // 将鼠标移动到目标位置，模拟更自然的拖动操作
            const steps = totalDistance / stepDistance; // 分成若干步移动

            for (let j = 0; j < steps; j++) {
                moveMouseBy(0, stepDistance); // 每次移动 stepDistance 像素
                await sleep(10); // 每次移动后延迟10毫秒
            }

            // 释放鼠标左键
            await sleep(700);
            leftButtonUp();
            await sleep(100);
        }
    } catch (error) {
        log.error(`执行滑动操作时发生错误：${error.message}`);
    }
}