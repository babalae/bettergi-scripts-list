(async function () {
    setGameMetrics(1920, 1080, 1);

    // 提取字符串中的第一个数字字符
    const Character = (parseInt(settings.Character?.match(/\d/)?.[0], 10)) || 4; // 默认值为 4
    log.info(`Character：${Character}`);

    const elements = ["火", "水", "草", "雷", "风", "冰", "岩", "物"];
    const Element = settings.Element || "物";
    const elementIndex = elements.indexOf(Element);
    const Switching = Math.min(99, Math.max(0, Math.floor(Number(settings.Switching) || 0)));

    // 确保 pageScrollCount 是 0 到 99 的整数，默认值为 0
    const pageScrollCount = Math.min(99, Math.max(0, Math.floor(Number(settings.pageScrollCount) || 0)));
    const rightOffset = Math.max(0, Number(settings.rightOffset) || 2) -1;     // 第几列，默认值为 2
    const downOffset = Math.max(0, Number(settings.downOffset) || 2) -1;       // 第几行，默认值为 2
    log.info(`rightOffset: ${rightOffset},downOffset: ${downOffset}`);


    // 提前计算所有动态坐标
    // 武器区左顶处物品左上角坐标(37,138)
    // 武器图片大小(125,151)
    // 武器间隔(16,16)
    // 第一点击区位置:125/2+37=99.5; 151/2+138=213.5
    const rightClickX = Math.round(99.5 + rightOffset * 141);
    const downClickY = Math.round(213.5 + downOffset * 167);

    async function CharacterPath() {
        // 日志记录任务开始
        log.info("开始寻找");

        // 初始化
        await genshin.returnMainUi();
        // 切换角色
        keyPress(String(Character));
        await sleep(1000);
        // 按下 C 键
        keyPress("C");
        await sleep(1000);

        if (elementIndex !== -1) {
            const ElementClickX = Math.round(787 + elementIndex * 57.5);  // 计算 X 坐标
            log.info(`ElementClickX: ${ElementClickX}`);

            // 如果 Element 不是 "物"，则触发 moveMouseBy(960, 45)
            if (Element !== "物") {
                moveMouseTo(960, 45); // 移动到指定坐标
                await sleep(100);
                leftButtonDown();
                log.info("移动鼠标");
                const steps = 10; // 分成若干步移动
                const stepDistance = 15; // 每步移动的距离

                for (let j = 0; j < steps; j++) {
                    moveMouseBy(stepDistance, 0); // 每次移动 stepDistance 像素
                    await sleep(10); // 每次移动后延迟10毫秒
                }

                // 释放鼠标左键
                await sleep(700);
                leftButtonUp();await sleep(100);
                await click(ElementClickX, 130); await sleep(1000); // 点击元素选项
                const Switchingsteps = Switching+(4-Number(Character))
                for (let i = 0; i < Switchingsteps; i++) {
                await click(1840, 540); await sleep(200); // 循环点击切换选项
                }
            }
        } else {
            log.error(`无效元素: ${Element}`);
        }
        await sleep(1000);

        // 执行按键和鼠标操作
        try {
            // 执行一系列鼠标点击操作
            await click(125, 225); await sleep(1000); // 点击武器选项
            await click(1600, 1005); await sleep(1000); // 点击替换当前武器
            await click(500, 1005); await sleep(200);
            await click(500, 905); await sleep(200); // 使用等级顺序排列
            await moveMouseTo(605, 145); await sleep(200); // 初始化滑条
            await leftButtonDown(); await sleep(600);
            await leftButtonUp(); await sleep(200);

            for (let i = 0; i < pageScrollCount; ++i) {
                // 点击固定坐标
                moveMouseTo(525, 920);
                await sleep(500);
                leftButtonDown();
                await sleep(100);

                // 根据条件选择运行的 JSON 文件
                let filePath;
                if (pageScrollCount >= 10 && (i + 1) % 10 === 0) {
                    filePath = `assets/pageScroll2.json`; // 每 10 次，运行一次pageScroll2.json（多移动一个像素点）
                } else {
                    filePath = `assets/pageScroll.json`; // 一般情况下运行 pageScroll.json
                }

                await keyMouseScript.runFile(filePath); // 平滑移动鼠标
                await sleep(600);

                leftButtonUp();
                await sleep(100);
            }

                // 点击动态坐标
                click(rightClickX, downClickY);  // 点击选中物品的坐标
                await sleep(1000);
 
                 click(1600, 1005); await sleep(1000); // 点击替换
                 click(1320, 755); await sleep(1000); // 确定替换
                 click(1845, 45); await sleep(1000); // 退出武器界面
                 click(1845, 45); await sleep(1000); // 退出角色界面

        } catch (error) {
            log.error(`执行按键或鼠标操作时发生错误：${error.message}`);
        }
    }

    // 调用函数
    await CharacterPath();
})();
