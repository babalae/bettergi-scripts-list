async function getMonsterCounts() {
    /* 0. 读取怪物列表 */
    const raw = file.readTextSync('assets/info.json');
    const monsterList = JSON.parse(raw).map(it => it.name);
    const monsterCounts = {};

    /* 1. 外层循环：最多 3 次进入生物志 */
    let attempt = 0;
    while (attempt < 3) {
        attempt++;
        log.info(`第 ${attempt} 次尝试进入生物志`);
        await genshin.returnMainUi();
        keyPress('VK_ESCAPE');
        await sleep(1500);

        const archiveTpl = RecognitionObject.TemplateMatch(
            file.readImageMatSync('assets/RecognitionObject/图鉴.png'), 0, 0, 1920, 1080);
        if (!(await findAndClick(archiveTpl))) continue;

        const faunaTpl = RecognitionObject.TemplateMatch(
            file.readImageMatSync('assets/RecognitionObject/生物志.png'), 0, 0, 1920, 1080);
        if (!(await findAndClick(faunaTpl))) continue;

        click(1355, 532);
        await sleep(2000);
        break;
    }
    if (attempt >= 3) {
        log.error('连续 3 次无法进入生物志，脚本终止');
        await genshin.returnMainUi();
        return {};
    }

    /* ===== 工具函数 ===== */
    async function findAndClick(target, maxAttempts = 20) {
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const gameRegion = captureGameRegion();
            try {
                const result = gameRegion.find(target);
                if (result.isExist()) {
                    result.click();
                    return true;                 // 成功立刻返回
                }
            } catch (err) {
            } finally {
                gameRegion.dispose();
            }
            if (attempts < maxAttempts - 1) {   // 最后一次不再 sleep
                await sleep(50);
            }
        }
        //log.error("已达到重试次数上限，仍未找到目标");
        return false;
    }

    async function scrollPage(totalDistance, stepDistance = 10, delayMs = 5) {
        moveMouseTo(400, 750); // 移动到屏幕水平中心，垂直750坐标
        await sleep(50);
        leftButtonDown();

        // 计算滚动方向和总步数
        const isDownward = totalDistance < 0; // 如果totalDistance为负数，则向下滑动
        const steps = Math.ceil(Math.abs(totalDistance) / stepDistance); // 使用绝对值计算步数

        for (let j = 0; j < steps; j++) {
            const remainingDistance = Math.abs(totalDistance) - j * stepDistance;
            const moveDistance = remainingDistance < stepDistance ? remainingDistance : stepDistance;

            // 根据滚动方向调整移动方向
            const direction = isDownward ? 1 : -1; // 向下滑动为正方向，向上滑动为负方向
            moveMouseBy(0, 1.2 * direction * moveDistance); // 根据方向调整滚动方向
            await sleep(delayMs);
        }

        await sleep(200);
        leftButtonUp();
        await sleep(500);
    }

    async function readKillCount(maxTry = 5) {
        const ocrObj = RecognitionObject.Ocr(865, 980, 150, 50);
        for (let t = 0; t < maxTry; t++) {
            const region = captureGameRegion();
            const results = region.findMulti(ocrObj);
            region.dispose();

            for (let i = 0; i < results.count; i++) {
                const str = results[i].text.trim();
                // 必须是纯数字
                if (/^\d+$/.test(str)) {
                    return { success: true, count: parseInt(str, 10) };
                }
            }
            if (t < maxTry - 1) await sleep(200); // 最后一次不重试
        }
        return { success: false, count: -1 };
    }

    async function readKillCountStable(prevCount, sameTolerance = 5) {
        let lastCount = -1;
        for (let r = 0; r < sameTolerance; r++) {
            await sleep(50 * r);
            //log.info(`执行第${r}次ocr`)
            const ocrRet = await readKillCount(5);
            if (!ocrRet.success) break;              // 真的读不到数字就放弃
            lastCount = ocrRet.count;

            if (lastCount !== prevCount) return { success: true, count: lastCount }; // 变了→成功
        }
        // 3 次仍相同→返回最后一次相同值
        return { success: true, count: lastCount };
    }


    async function findMonsterIcon(monsterId, iconRetry = 3) {
        const tpl = RecognitionObject.TemplateMatch(
            file.readImageMatSync(`assets/monster/${monsterId.trim()}.png`), 130, 80, 670, 970);
        let pageTurnsUp = 0;
        while (pageTurnsUp < 1) {
            let pageTurns = 0;
            while (pageTurns < 2) {
                //log.info("执行一次模板识别");
                if (await findAndClick(tpl, iconRetry)) return true;
                await scrollPage(300);
                pageTurns++;
            }
            for (let j = 0; j < 2; j++) {
                await scrollPage(-300);
            }
            pageTurnsUp++;
        }
        return false;
    }

    /* ===== 主循环 ===== */
    let prevCount = -1;          // 上一轮 OCR 结果
    let retryMask = 0;           // 位掩码：第 i 位为 1 表示已回退过
    let prevFinalCount = -1;   // 上一只怪物的最终击杀数

    for (let i = 0; i < monsterList.length; i++) {
        const monsterId = monsterList[i];
        let time0 = new Date();
        /* 1. 找怪 + OCR */
        if (!(await findMonsterIcon(monsterId, 3))) {
            log.info(`怪物: ${monsterId.trim()}, 未找到图标`);
            monsterCounts[monsterId.trim()] = -1;
            prevCount = -1;                 // 重置
            continue;
        }
        let time1 = new Date();
        //log.info(`寻找图标用时${time1 - time0}`);
        /* 2. OCR：与上一只结果比较，原地重试 3 次 */
        const ocr = await readKillCountStable(prevFinalCount, 3);
        const count = ocr.success ? ocr.count : -1;
        let time2 = new Date();
        //log.info(`ocr用时${time2 - time1}`);
        /* 2. 结果相同且本行还没回退过 → 回退一次 */
        if (count === prevCount && !(retryMask & (1 << i))) {
            retryMask |= (1 << i);          // 标记已回退
            i--;                            // 回退同一 i 一次
            continue;
        }

        /* 3. 正常记录 */
        monsterCounts[monsterId.trim()] = count;
        log.info(`怪物: ${monsterId.trim()}, 数量: ${count}`);
        prevCount = count;
        prevFinalCount = count;   // 记录本次最终值，供下一只比对
    }
    return monsterCounts;
}


(async function () {
    const monsterCounts = await getMonsterCounts();

    /* 1. 控制台打印 */
    log.info("怪物数量统计结果：");
    for (const [monsterName, count] of Object.entries(monsterCounts)) {
        log.info(`${monsterName}: ${count}`);
    }

    /* 2. 写入 record.txt（JSON）*/
    try {
        const filePath = 'record.txt';
        const json = JSON.stringify(monsterCounts, null, 2);
        await file.writeText(filePath, json, false);
        log.info(`结果已写入 ${filePath}`);
    } catch (error) {
        log.error(`写入 record.txt 时出错: ${error.message}`);
    }
})();

