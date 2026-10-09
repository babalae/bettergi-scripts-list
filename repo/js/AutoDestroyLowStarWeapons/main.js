// BetterGI JS script: destroy unlocked low-rarity weapons through the in-game UI.

const SCREEN = { width: 1920, height: 1080 };

// Coordinates are expressed against BetterGI's 1920x1080 logical game area.
const POS = {
    weaponTab: { x: 575, y: 50 },
    oneStar: { x: 200, y: 150 },
    twoStar: { x: 200, y: 220 },
    threeStar: { x: 200, y: 300 },
    dismissResult: { x: 960, y: 1000 },
    expiredItemsConfirm: { x: 980, y: 750 }
};

const ROI = {
    expiredItems: { x: 700, y: 180, width: 520, height: 260 },
    weaponDetails: { x: 1280, y: 100, width: 640, height: 650 }
};

const TEMPLATE = {
    destroyEntry: RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/DeleteButton.png"),
        0, 940, 220, 140
    ),
    autoAdd: RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/AutoAddButton.png"),
        0, 940, 450, 140
    ),
    quickInsertConfirm: RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/ConfirmButton.png"),
        0, 940, 450, 140
    ),
    destroySelected: RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/DestroyButton.png"),
        1450, 930, 470, 150
    ),
    finalDestroy: RecognitionObject.TemplateMatch(
        file.ReadImageMatSync("assets/DestroyButton.png"),
        900, 600, 500, 300
    )
};

function readBoolean(name, defaultValue) {
    return typeof settings[name] === "boolean" ? settings[name] : defaultValue;
}

function readInteger(name, defaultValue, minValue, maxValue) {
    const value = Number(settings[name]);
    if (!Number.isFinite(value)) {
        return defaultValue;
    }
    return Math.min(maxValue, Math.max(minValue, Math.floor(value)));
}

function normalizeText(value) {
    return String(value || "")
        .replace(/\s+/g, "")
        .replace(/[：:]/g, "");
}

function findAnyText(targets, roi) {
    const expected = targets.map(normalizeText);
    const image = captureGameRegion();
    try {
        const ocr = RecognitionObject.Ocr(roi.x, roi.y, roi.width, roi.height);
        const results = image.findMulti(ocr);

        for (let i = 0; i < results.count; i++) {
            const result = results[i];
            const actual = normalizeText(result.text);
            if (expected.some(text => actual.includes(text))) {
                return {
                    text: result.text,
                    x: result.x,
                    y: result.y,
                    width: result.width,
                    height: result.height
                };
            }
        }
        return null;
    } finally {
        image.dispose();
    }
}

async function waitForAnyText(targets, roi, timeoutMs, retryMs = 250) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
        const match = findAnyText(targets, roi);
        if (match) {
            return match;
        }
        await sleep(retryMs);
    }
    return null;
}

function findTemplate(template) {
    const image = captureGameRegion();
    try {
        const result = image.find(template);
        if (!result.isExist()) {
            return null;
        }
        return {
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height
        };
    } finally {
        image.dispose();
    }
}

async function waitForTemplate(template, timeoutMs, retryMs = 250) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
        const match = findTemplate(template);
        if (match) {
            return match;
        }
        await sleep(retryMs);
    }
    return null;
}

function clickMatch(match) {
    click(
        Math.round(match.x + match.width / 2),
        Math.round(match.y + match.height / 2)
    );
}

async function handleExpiredItemsPopup(delayMs) {
    const popup = await waitForAnyText(["物品过期"], ROI.expiredItems, 1500);
    if (!popup) {
        return;
    }

    log.info("检测到物品过期弹窗，正在关闭");
    click(POS.expiredItemsConfirm.x, POS.expiredItemsConfirm.y);
    await sleep(delayMs);
}

async function openWeaponInventory(delayMs) {
    await genshin.returnMainUi();
    await sleep(300);
    keyPress("B");
    await sleep(Math.max(1500, delayMs));
    await handleExpiredItemsPopup(delayMs);

    click(POS.weaponTab.x, POS.weaponTab.y);
    await sleep(delayMs);

    const weaponPage = await waitForAnyText(["基础攻击力"], ROI.weaponDetails, 3000);
    if (!weaponPage) {
        throw new Error("未确认进入武器页，已停止且没有打开摧毁界面");
    }
}

async function selectConfiguredRarities(config, delayMs) {
    const autoAdd = await waitForTemplate(TEMPLATE.autoAdd, 2500);
    if (!autoAdd) {
        throw new Error("未识别到快捷放入按钮，已停止且未执行最终摧毁");
    }
    clickMatch(autoAdd);
    await sleep(delayMs);

    if (config.includeOneStar) {
        click(POS.oneStar.x, POS.oneStar.y);
        await sleep(Math.max(300, Math.floor(delayMs / 2)));
    }
    if (config.includeTwoStar) {
        click(POS.twoStar.x, POS.twoStar.y);
        await sleep(Math.max(300, Math.floor(delayMs / 2)));
    }
    if (config.includeThreeStar) {
        click(POS.threeStar.x, POS.threeStar.y);
        await sleep(Math.max(300, Math.floor(delayMs / 2)));
    }

    const quickInsertConfirm = await waitForTemplate(TEMPLATE.quickInsertConfirm, 2500);
    if (!quickInsertConfirm) {
        throw new Error("未识别到快捷放入确认按钮，已停止且未执行最终摧毁");
    }
    clickMatch(quickInsertConfirm);
    await sleep(delayMs);
}

async function prepareOneBatch(config, delayMs) {
    const destroyEntry = await waitForTemplate(TEMPLATE.destroyEntry, 2500);
    if (!destroyEntry) {
        throw new Error("未识别到背包摧毁入口，已停止且未执行最终摧毁");
    }
    clickMatch(destroyEntry);
    await sleep(delayMs);

    const destroyPage = await waitForTemplate(TEMPLATE.autoAdd, 2500);
    if (!destroyPage) {
        throw new Error("未识别到武器摧毁页面，已停止且未执行最终摧毁");
    }

    await selectConfiguredRarities(config, delayMs);
}

async function destroyPreparedBatch(delayMs) {
    // The red icon appears only when at least one item has been inserted.
    const destroySelected = await waitForTemplate(TEMPLATE.destroySelected, 2000);
    if (!destroySelected) {
        log.info("没有可摧毁的符合条件且未锁定的武器，处理结束");
        keyPress("ESCAPE");
        await sleep(delayMs);
        return false;
    }
    clickMatch(destroySelected);

    // The irreversible click is allowed only after the red destroy icon is
    // recognized inside the center confirmation dialog.
    const finalDestroy = await waitForTemplate(
        TEMPLATE.finalDestroy,
        Math.max(3000, delayMs * 3)
    );
    if (!finalDestroy) {
        keyPress("ESCAPE");
        await sleep(delayMs);
        throw new Error("未识别到最终确认框中的摧毁按钮，已按 Esc 取消并停止");
    }

    clickMatch(finalDestroy);
    await sleep(Math.max(1500, delayMs));
    click(POS.dismissResult.x, POS.dismissResult.y);
    await sleep(delayMs);
    return true;
}

(async function () {
    setGameMetrics(SCREEN.width, SCREEN.height, 1);

    const config = {
        includeOneStar: readBoolean("includeOneStar", true),
        includeTwoStar: readBoolean("includeTwoStar", true),
        includeThreeStar: readBoolean("includeThreeStar", true),
        executeDestruction: readBoolean("executeDestruction", false),
        returnToMainUi: readBoolean("returnToMainUi", true),
        maxBatches: readInteger("maxBatches", 20, 1, 100),
        actionDelayMs: readInteger("actionDelayMs", 1000, 500, 5000)
    };

    if (!config.includeOneStar && !config.includeTwoStar && !config.includeThreeStar) {
        throw new Error("至少需要选择一个武器星级");
    }

    const selectedStars = [];
    if (config.includeOneStar) selectedStars.push("一星");
    if (config.includeTwoStar) selectedStars.push("二星");
    if (config.includeThreeStar) selectedStars.push("三星");

    let leaveCurrentPageOpen = false;
    let completedBatches = 0;

    log.warn(`目标：${selectedStars.join("、")}未锁定武器`);
    log.warn("三星武器中存在无法稳定再次获取的武器，请先在游戏内锁定所有要保留的武器");

    try {
        await openWeaponInventory(config.actionDelayMs);
        await prepareOneBatch(config, config.actionDelayMs);

        if (!config.executeDestruction) {
            leaveCurrentPageOpen = true;
            log.warn("预演完成：已快捷放入目标武器，但没有点击摧毁");
            log.warn("请检查列表；确认无误后，在脚本自定义配置中开启“执行最终摧毁”再运行");
            return;
        }

        log.warn("已开启最终摧毁，开始执行不可恢复操作");

        for (let batch = 1; batch <= config.maxBatches; batch++) {
            if (batch > 1) {
                await prepareOneBatch(config, config.actionDelayMs);
            }

            const destroyed = await destroyPreparedBatch(config.actionDelayMs);
            if (!destroyed) {
                break;
            }

            completedBatches++;
            log.info(`第 ${batch} 批武器已摧毁`);
        }

        if (completedBatches >= config.maxBatches) {
            log.warn(`已达到最大批次 ${config.maxBatches}，可能仍有符合条件的武器`);
        } else {
            log.info(`处理结束，共完成 ${completedBatches} 批`);
        }
    } catch (error) {
        leaveCurrentPageOpen = true;
        log.error(`脚本已安全停止：${error.message || error}`);
        throw error;
    } finally {
        if (!leaveCurrentPageOpen && config.returnToMainUi) {
            await genshin.returnMainUi();
        }
    }
})();
