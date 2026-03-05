// ============================================================
// Artifact Scanner — 扫描背包中的圣遗物
// 卡片区域: x=1307, y=119, w=494, h=841
// ============================================================

var CARD = { x: 1307, y: 119, w: 494, h: 841 };

var ARTIFACT_OCR = {
    PART_NAME: {
        x: CARD.x + Math.round(CARD.w * 0.0405),
        y: CARD.y + Math.round(CARD.h * 0.0772),
        w: Math.round(CARD.w * 0.4757),
        h: Math.round(CARD.h * 0.0475)
    },
    MAIN_STAT: {
        x: CARD.x + Math.round(CARD.w * 0.0405),
        y: CARD.y + Math.round(CARD.h * 0.1722),
        w: Math.round(CARD.w * 0.4555),
        h: Math.round(CARD.h * 0.0416)
    },
    LEVEL: {
        x: CARD.x + Math.round(CARD.w * 0.0506),
        y: CARD.y + Math.round(CARD.h * 0.3634),
        w: Math.round(CARD.w * 0.1417),
        h: Math.round(CARD.h * 0.0416)
    },
    SUBSTATS: { x: 1353, y: 475, w: 247, h: 150 },
    SET_NAME_X: 1330,
    SET_NAME_W: 200,
    SET_NAME_Y: 630,
    SET_NAME_H: 30,
    EQUIP: {
        x: CARD.x + Math.round(CARD.w * 0.10),
        y: CARD.y + Math.round(CARD.h * 0.935),
        w: Math.round(CARD.w * 0.85),
        h: Math.round(CARD.h * 0.06)
    }
};

// 从 OCR 文本中模糊匹配套装名，返回 GOOD setKey 或 null
function findSetKeyInText(text) {
    if (!text) return null;
    var key = fuzzyMatchMap(text, ARTIFACT_SET_MAP);
    if (key) return key;
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.length < 2) continue;
        key = fuzzyMatchMap(line, ARTIFACT_SET_MAP);
        if (key) return key;
    }
    return null;
}

// 检测星级像素是否为黄色
function isStarYellow(gameImage, x) {
    var mat = gameImage.SrcMat;
    var pixel = mat.SubMat(372, 373, x, x + 1).Mean();
    var b = pixel.Val0, g = pixel.Val1, r = pixel.Val2;
    return (r > 150 && g > 100 && b < 100);
}

// 检测圣遗物星级: 5星=(1485黄), 4星=(1450黄,1485非黄), 其他=3星及以下
function detectArtifactRarity(gameImage) {
    if (isStarYellow(gameImage, 1485)) return 5;
    if (isStarYellow(gameImage, 1450)) return 4;
    return 3;
}

// 扫描单个圣遗物卡片，返回 GOOD 圣遗物对象或 {_stop} 或 null
function scanSingleArtifact(gameImage) {
    // 0. 检测星级，3星及以下直接停止
    var rarity = detectArtifactRarity(gameImage);
    if (rarity <= 3) {
        log.info("[圣遗物] 检测到 " + rarity + "★ 物品，停止扫描");
        return { _stop: true };
    }

    // 1. 部位名
    var partText = ocrWithImage(gameImage, ARTIFACT_OCR.PART_NAME.x, ARTIFACT_OCR.PART_NAME.y,
        ARTIFACT_OCR.PART_NAME.w, ARTIFACT_OCR.PART_NAME.h);
    var slotKey = null;
    if (partText) {
        for (var cn in SLOT_KEY_MAP) {
            if (partText.indexOf(cn) !== -1) {
                slotKey = SLOT_KEY_MAP[cn];
                break;
            }
        }
    }
    if (!slotKey) {
        // 4星无法识别部位 — 可能是祝圣精华，跳过
        if (rarity === 4) {
            log.info("[圣遗物] 4★ 无法识别部位（可能为祝圣精华），跳过");
            return null;
        }
        if (settings.continueOnFailure) {
            log.warn("[圣遗物] 无法识别部位: 「" + partText + "」，跳过");
            return null;
        }
        throw new Error("无法识别部位: 「" + partText + "」");
    }

    // 2. 主属性
    var mainStatText = ocrWithImage(gameImage, ARTIFACT_OCR.MAIN_STAT.x, ARTIFACT_OCR.MAIN_STAT.y,
        ARTIFACT_OCR.MAIN_STAT.w, ARTIFACT_OCR.MAIN_STAT.h);
    var mainStatKey = null;
    if (mainStatText) {
        if (slotKey === "flower") {
            mainStatKey = "hp";
        } else if (slotKey === "plume") {
            mainStatKey = "atk";
        } else {
            var mainParsed = parseStatFromText(mainStatText);
            mainStatKey = mainParsed ? mainParsed.key : null;
        }
    }
    if (!mainStatKey) {
        if (settings.continueOnFailure) {
            log.warn("[圣遗物] 无法识别主属性: 「" + mainStatText + "」，跳过");
            return null;
        }
        throw new Error("无法识别主属性: 「" + mainStatText + "」");
    }

    // 3. 检测 elixirCrafted
    var elixirCrafted = detectElixirCrafted(gameImage);
    var yShift = elixirCrafted ? ELIXIR_SHIFT : 0;

    // 4. 等级
    var levelText = ocrWithImage(gameImage, ARTIFACT_OCR.LEVEL.x, ARTIFACT_OCR.LEVEL.y + yShift,
        ARTIFACT_OCR.LEVEL.w, ARTIFACT_OCR.LEVEL.h);
    var level = 0;
    if (levelText) {
        var lvMatch = levelText.match(/\+?\s*(\d+)/);
        level = lvMatch ? parseInt(lvMatch[1]) : 0;
    }

    // 5. 副属性
    var subsText = ocrWithImage(gameImage, ARTIFACT_OCR.SUBSTATS.x, ARTIFACT_OCR.SUBSTATS.y + yShift,
        ARTIFACT_OCR.SUBSTATS.w, ARTIFACT_OCR.SUBSTATS.h);
    var substats = [];
    var unactivatedSubstats = [];
    if (subsText) {
        var cutIdx = subsText.indexOf("2件套");
        if (cutIdx !== -1) subsText = subsText.substring(0, cutIdx);
        var lines = subsText.split("\n");
        for (var si = 0; si < lines.length; si++) {
            var line = lines[si].trim();
            if (!line || line.length < 2) continue;
            var parsed = parseStatFromText(line);
            if (parsed) {
                if (parsed.inactive) {
                    unactivatedSubstats.push({ key: parsed.key, value: parsed.value });
                } else {
                    substats.push({ key: parsed.key, value: parsed.value });
                }
            }
        }
    }

    // 6. 套装名
    // 套装名位置基于4条副属性，每少一条上移40px
    var statCount = substats.length + unactivatedSubstats.length;
    if (statCount < 1) statCount = 1;
    if (statCount > 4) statCount = 4;
    if (statCount < 4 && rarity === 5) {
        log.warn("[圣遗物] 5★ 仅识别到 " + statCount + " 条副属性");
    }
    var missingStats = 4 - statCount;
    var setX = ARTIFACT_OCR.SET_NAME_X;
    var setY = ARTIFACT_OCR.SET_NAME_Y + yShift - (missingStats * 40);
    var setNameText = ocrWithImage(gameImage, setX, setY, ARTIFACT_OCR.SET_NAME_W, ARTIFACT_OCR.SET_NAME_H);
    var setKey = findSetKeyInText(setNameText);
    if (!setKey) {
        var statKeys = substats.map(function(s) { return s.key; }).concat(
            unactivatedSubstats.map(function(s) { return s.key + "(inactive)"; }));
        log.warn("[圣遗物] 无法识别套装: setY=" + setY + " stats=[" + statKeys.join(", ") + "] text=「" + setNameText + "」");
        if (settings.continueOnFailure) {
            return null;
        }
        throw new Error("无法识别套装 (副属性数=" + statCount + "): 「" + setNameText + "」");
    }

    // 7. 星级 (已在步骤0通过像素检测)

    // 8. 装备角色
    var equipText = ocrWithImage(gameImage, ARTIFACT_OCR.EQUIP.x, ARTIFACT_OCR.EQUIP.y,
        ARTIFACT_OCR.EQUIP.w, ARTIFACT_OCR.EQUIP.h);
    var location = "";
    if (equipText && equipText.indexOf("已装备") !== -1) {
        var charName = equipText.replace("已装备", "").replace(/[:\s：]/g, "").trim();
        location = fuzzyMatchMap(charName, CHARACTER_NAME_MAP) || "";
    }

    // 9. 锁定
    var lock = detectArtifactLock(gameImage, yShift);

    // 10. 收藏标记 (astralMark)
    var astralMark = detectArtifactAstralMark(gameImage, yShift);

    var artifact = {
        setKey: setKey,
        slotKey: slotKey,
        level: level,
        rarity: rarity,
        mainStatKey: mainStatKey,
        location: location,
        lock: lock,
        astralMark: astralMark,
        elixirCrafted: elixirCrafted,
        substats: substats
    };

    if (unactivatedSubstats.length > 0) {
        artifact.unactivatedSubstats = unactivatedSubstats;
    }

    return artifact;
}

// 扫描背包中所有圣遗物，返回 GOOD 圣遗物数组
async function scanAllArtifacts(minRarity, devLimit, skipOpenBackpack) {
    if (minRarity === undefined) minRarity = 4;

    log.info("[圣遗物] 开始扫描...");
    if (!skipOpenBackpack) await openBackpack();
    await selectBackpackTab("artifact");

    var counts = await readItemCount();
    var totalCount = counts.total;
    if (totalCount === 0) {
        log.warn("[圣遗物] 背包中没有圣遗物");
        return [];
    }
    log.info("[圣遗物] 总数: " + totalCount);

    var artifacts = [];
    var scannedCount = 0;
    var failCount = 0;

    // 行级去重: 每行8个指纹，与已见行比较
    var seenRows = [];
    var currentRow = [];
    var COLS = 8;

    // 生成圣遗物指纹用于行去重
    function artifactFingerprint(a) {
        if (!a) return "null";
        var subs = a.substats.map(function(s) { return s.key + ":" + s.value; }).join(";");
        return a.setKey + "|" + a.slotKey + "|" + a.level + "|" + a.mainStatKey + "|" + a.rarity + "|" + subs;
    }

    // 检查当前行指纹是否与已见行重复
    function isRowDuplicate(row) {
        var rowStr = row.join(",");
        for (var i = 0; i < seenRows.length; i++) {
            if (seenRows[i] === rowStr) return true;
        }
        return false;
    }

    var pendingRow = []; // artifacts pending row dedup check

    await traverseBackpackGrid(totalCount, async function (itemIndex) {
        if (devLimit && artifacts.length >= devLimit) return true;

        scannedCount++;
        var col = itemIndex % COLS;

        var gameImage = captureGameRegion();
        var artifact = null;
        try {
            artifact = scanSingleArtifact(gameImage);
            if (artifact && artifact._stop) {
                gameImage.Dispose();
                return true;
            }
        } catch (e) {
            gameImage.Dispose();
            throw e;
        }
        gameImage.Dispose();

        currentRow.push(artifactFingerprint(artifact));
        if (artifact && artifact.rarity >= minRarity) {
            pendingRow.push(artifact);
        } else if (!artifact) {
            failCount++;
        } else {
            failCount = 0;
        }

        // 行满时检查去重
        if (currentRow.length >= COLS) {
            if (isRowDuplicate(currentRow)) {
                log.warn("[圣遗物] 检测到重复行，跳过 " + pendingRow.length + " 个");
            } else {
                seenRows.push(currentRow.join(","));
                for (var ri = 0; ri < pendingRow.length; ri++) {
                    artifacts.push(pendingRow[ri]);
                    if (settings.logProgress) log.info("[圣遗物] " + pendingRow[ri].setKey + " " + pendingRow[ri].slotKey +
                        " +" + pendingRow[ri].level + " " + pendingRow[ri].rarity + "★" +
                        " " + (pendingRow[ri].location || "-") +
                        (pendingRow[ri].lock ? " 🔒" : "") +
                        (pendingRow[ri].astralMark ? " ⭐" : "") +
                        (pendingRow[ri].elixirCrafted ? " 祝圣" : ""));
                }
                failCount = 0;
            }
            currentRow = [];
            pendingRow = [];
        }

        if (devLimit && artifacts.length >= devLimit) return true;

        if (failCount >= 10) {
            log.error("[圣遗物] 连续 " + failCount + " 个失败，停止");
            return true;
        }
    }, function () { // onScroll: clear row cache
        seenRows = [];
        currentRow = [];
        pendingRow = [];
    });

    // 后处理: 移除未强化的4★低价值圣遗物（5★套装的4★掉落）
    var beforeCount = artifacts.length;
    artifacts = artifacts.filter(function (a) {
        if (a.rarity === 4 && a.level === 0) {
            var maxRarity = ARTIFACT_SET_MAX_RARITY[a.setKey];
            if (maxRarity && maxRarity >= 5) {
                return false;
            }
        }
        return true;
    });
    if (artifacts.length < beforeCount) {
        log.info("[圣遗物] 过滤 " + (beforeCount - artifacts.length) + " 个未强化的4★低价值圣遗物");
    }

    log.info("[圣遗物] 完成，共 " + artifacts.length + " 个 (>=" + minRarity + "★)");
    return artifacts;
}
