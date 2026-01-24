eval(file.readTextSync("lib/ocr.js"));

const ArtifactsIconRo = RecognitionObject.TemplateMatch(file.ReadImageMatSync("assets/DeleteIcon.png"));
const targetSpace = safeParseInt(settings.targetSpace, 300);

function safeParseInt(value, defaultValue = 0) {
    if (!value) return defaultValue;
    const parsed = parseInt(value.replace(/[^\d]/g, ""), 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * @description 获取当前游戏界面中圣遗物（Artifacts）的剩余空间数量。
 * @returns {number} 圣遗物剩余空间数量。如果无法识别或解析文本，则返回 -1。
 */
async function getRemainingArtifactsSpace() {
    const total = await getTextInRegion([1676, 30, 128, 36]);
    log.info("当前总圣遗物数量: {0}", total);
    try {
        if (total && total.includes("/")) {
            const parts = total.trim().split("/");
            let used = safeParseInt(parts[0]);
            used = used % 10000;    // 有时OCR会误识别出一个多余的1
            const max = safeParseInt(parts[1]);
            return max - used;
        }
    } catch (error) {
        log.error("解析空间失败: " + error.toString());
    }
    return -1;
}

(async function () {
    setGameMetrics(1920, 1080, 1.25);
    await genshin.returnMainUi();

    // 进入背包圣遗物页
    keyPress("B");
    await waitForImageAppear(ArtifactsIconRo);
    const tabName = await getTextInRegion([134, 24, 118, 50]);
    if (tabName !== "圣遗物") {
        click(670, 46);
        await waitForTextAppear("圣遗物", [134, 24, 118, 50]);
    }
    const remainingSpace = await getRemainingArtifactsSpace();
    let missingSpace = targetSpace - remainingSpace;
    if (missingSpace <= 0) {
        log.info(`当前剩余空间 (${remainingSpace}) 已满足目标 (${targetSpace})，无需分解`);
        await genshin.returnMainUi();
        return;
    }

    log.info(`圣遗物目标预留空间: {0}，空间缺口: {1}`, targetSpace, missingSpace);

    // 进入分解界面
    await recognizeTextAndClick("分解", [634, 996, 75, 42]);
    await recognizeTextAndClick("快速选择", [252, 1000, 114, 40]);
    await waitForTextAppear("星圣遗物", [44, 362, 163, 38]);
    await sleep(300);

    // --- 步骤 A: 提取各星级数量并记录日志 ---
    const starCounts = [0, 0, 0, 0, 0]; // 索引 1-4 对应 1-4 星
    await withCapture(async (region) => {
        for (let i = 1; i <= 4; i++) {
            const res = await region.find(RecognitionObject.ocr(574, 46 + 78 * i, 60, 46));
            starCounts[i] = safeParseInt(res ? res.text : "0");
        }
    });

    log.info(`圣遗物数量: 1星={1}, 2星={2}, 3星={3}, 4星={4}`, starCounts[1], starCounts[2], starCounts[3], starCounts[4]);

    // --- 步骤 B: 计算哪些需要【取消选中】 ---
    // 默认全选 (1-4星)，我们需要从高星往低星看，哪些可以“保住”不分解
    let totalAvailable = starCounts[1] + starCounts[2] + starCounts[3] + starCounts[4];
    const stillNeed = missingSpace - totalAvailable;
    if (totalAvailable === 0) {
        const msg = `仍需分解${stillNeed}个圣遗物，但是无低星圣遗物可分解或低星圣遗物数量识别失败`;
        notification.error(msg);
        log.warn(msg);
        await genshin.returnMainUi();
        return;
    }

    if (totalAvailable < missingSpace) {
        const msg = `将分解全部1-4星圣遗物(${totalAvailable}个)，但仍无法达到目标空间(还差${stillNeed}个)。请手动整理五星圣遗物`;
        notification.error(msg);
        log.warn(msg);
        // 这种情况下，不需要点击任何选项（因为默认全选，我们要的就是全选）
    } else {
        // 计算需要分解到哪一级
        let currentSum = 0;
        let keepThreshold = 0; // 高于这个等级的都要取消选中
        for (let i = 1; i <= 4; i++) {
            currentSum += starCounts[i];
            if (currentSum >= missingSpace) {
                keepThreshold = i;
                break;
            }
        }
        log.info(`分解到${keepThreshold}星圣遗物可满足缺口`);

        // --- 步骤 C: 执行【取消选中】的操作 ---
        // 如果 keepThreshold 是 2，说明 1-2 星足够了，我们需要取消选中 3 星和 4 星
        for (let i = 4; i > keepThreshold; i--) {
            log.info(`取消选中: ${i} 星圣遗物`);
            click(520, 147 + 78 * (i - 1));
            await sleep(100);
        }
    }

    click(350, 1018); // 确认选择
    await waitForTextAppear("快速选择", [252, 1000, 114, 40]);
    const exp = await getTextInRegion([1492, 886, 160, 56]);
    click(1742, 1018); // 分解
    await recognizeTextAndClick("进行分解", [1115, 735, 134, 46]);
    await sleep(300);
    log.info("分解结束，获得{exp}圣遗物经验", exp);
    await genshin.returnMainUi();
})();
