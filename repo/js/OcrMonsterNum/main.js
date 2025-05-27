(async function () {
    // 1. 初始化（分辨率由游戏环境自动提供）
    // 输出当前系统时间到 monster_count.txt 文件
    const now = new Date();
    const formattedTime = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/\//g, '.');
    const storagePath = "monster_count.txt"; // 结果存储文件
    const timeContent = `\n${formattedTime}\n`;
    file.writeTextSync(storagePath, timeContent, true); // 追加模式

    await genshin.returnMainUi(); // 返回主界面
    keyPress("VK_ESCAPE"); // 打开派蒙菜单
    await sleep(1500); // 等待1.5秒

    // 2. 识别并点击【图鉴】
    const archiveTemplate = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/RecognitionObject/图鉴.png"),
        0, 0, 1920, 1080
    );
    const archiveRegion = captureGameRegion().find(archiveTemplate);
    if (!archiveRegion.isEmpty()) {
        archiveRegion.click();
    }
    await sleep(3000); // 等待3秒

    // 3. 识别并点击【生物志】
    const faunaTemplate = RecognitionObject.TemplateMatch(
        file.readImageMatSync("assets/RecognitionObject/生物志.png"),
        0, 0, 1920, 1080
    );
    const faunaRegion = captureGameRegion().find(faunaTemplate);
    if (!faunaRegion.isEmpty()) {
        faunaRegion.click();
    }
    await sleep(400);
    click(1355, 532);
    await sleep(2000); // 等待2秒

    // 4. 循环处理怪物识别
    // 读取 name.txt 文件中的怪物名称列表
    const monsterList = file.readTextSync("name.txt").split('\n').filter(name => name.trim()!== '');

    for (const monsterId of monsterList) {
        let pageTurns = 0;
        let monsterRegion = null;

        while (pageTurns < 70) {
            // 4a. 识别怪物图片
            const monsterTemplate = RecognitionObject.TemplateMatch(
                file.readImageMatSync(`assets/monster/${monsterId.trim()}.png`),
                0, 0, 1920, 1080
            );
            monsterRegion = captureGameRegion().find(monsterTemplate);

            if (!monsterRegion.isEmpty()) {
                break; // 识别到怪物，跳出翻页循环
            }

            // 未识别到则翻页
            await scrollPage(300); // 调用翻页函数
            pageTurns++;
        }

        if (!monsterRegion || monsterRegion.isEmpty()) {
            log.info(`Monster ID: ${monsterId.trim()}, not found after 70 page turns.`);
            continue; // 达到翻页上限仍未找到，处理下一个怪物
        }

        monsterRegion.click(); // 点击怪物图标
        await sleep(10); // 等待界面加载

        // 4b. 识别数量区域（870,1000,100,30）
        const countRegion = new ImageRegion(
            captureGameRegion().SrcMat,
            830, 980,
            null, // owner 参数设置为 null
            null, // converter 参数设置为 null
            null  // drawContent 参数设置为 null
        );
        // 创建OCR识别对象
        const ocrObject = RecognitionObject.Ocr(830, 980, 140, 70);
        const countResults = countRegion.findMulti(ocrObject);
        let monsterCount = "-1";

        if (countResults.count > 0) {
            for (let i = 0; i < countResults.count; i++) {
                const text = countResults[i].text;
                const numbers = text.match(/\d+/);
                if (numbers) {
                    monsterCount = numbers[0];
                    break;
                }
            }
        }

        // 4c. 输出日志
        log.info(`怪物名称: ${monsterId.trim()}, 数量: ${monsterCount}`);

        // 4d. 存储结果到文件
        const writeContent = `${monsterId.trim()},${monsterCount}\n`;
        file.writeTextSync(storagePath, writeContent, true); // 追加模式
    }
})();

// 翻页函数（优化坐标为屏幕中心）
async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
    moveMouseTo(400, 750); // 移动到屏幕水平中心，垂直750坐标
    await sleep(50);
    leftButtonDown();

    const steps = Math.ceil(totalDistance / stepDistance);
    for (let j = 0; j < steps; j++) {
        const remainingDistance = totalDistance - j * stepDistance;
        const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;
        moveMouseBy(0, 1.2*(-moveDistance)); // 向上滚动
        await sleep(delayMs);
    }

    await sleep(200);
    leftButtonUp();
    await sleep(100);
}