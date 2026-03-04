// ============================================================
// Artifact Scanner — Scans artifacts from backpack
// ============================================================

// OCR coordinate regions for artifact detail panel (backpack view, 1920x1080)
var ARTIFACT_OCR = {
    // Part name (e.g., "生之花")
    PART_NAME:    { x: 1320, y: 180, w: 90,  h: 40 },
    // Main stat name + value
    MAIN_STAT:    { x: 1320, y: 268, w: 180, h: 32 },
    // Set name
    SET_NAME:     { x: 1320, y: 630, w: 240, h: 35 },
    // Level area (for OCR, e.g., "+20")
    LEVEL:        { x: 1330, y: 425, w: 70,  h: 30 },
    // Sub-stat lines (4 possible)
    SUB1:         { x: 1352, y: 470, w: 368, h: 40 },
    SUB2:         { x: 1352, y: 510, w: 368, h: 40 },
    SUB3:         { x: 1352, y: 550, w: 368, h: 40 },
    SUB4:         { x: 1352, y: 590, w: 368, h: 40 },
    // Equipped character text area (bottom of panel)
    EQUIP:        { x: 1310, y: 770, w: 340, h: 40 },
    // Lock icon area
    LOCK:         { x: 1750, y: 760, w: 50,  h: 50 },
    // Star/rarity area
    RARITY:       { x: 1430, y: 340, w: 200, h: 40 },
    // Astral mark / elixir area (near the set bonus text)
    EXTRA_INFO:   { x: 1310, y: 660, w: 400, h: 80 }
};

// Offset for "祝圣之霜定义" (Sanctifying Essence) artifacts
var SE_OFFSET_Y = 38;

// Scan a single artifact from the currently displayed detail panel
function scanSingleArtifact(gameImage) {
    // 1. Read part name (slot)
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
        log.warn("Could not detect artifact slot from: " + partText);
        return null;
    }

    // 2. Read main stat
    var mainStatText = ocrWithImage(gameImage, ARTIFACT_OCR.MAIN_STAT.x, ARTIFACT_OCR.MAIN_STAT.y,
        ARTIFACT_OCR.MAIN_STAT.w, ARTIFACT_OCR.MAIN_STAT.h);
    var mainStatKey = null;
    if (mainStatText) {
        // For flower, main is always HP flat; for plume, main is always ATK flat
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
        log.warn("Could not detect main stat from: " + mainStatText);
        return null;
    }

    // 3. Read level
    var levelText = ocrWithImage(gameImage, ARTIFACT_OCR.LEVEL.x, ARTIFACT_OCR.LEVEL.y,
        ARTIFACT_OCR.LEVEL.w, ARTIFACT_OCR.LEVEL.h);
    var level = 0;
    if (levelText) {
        var lvMatch = levelText.match(/\+?\s*(\d+)/);
        level = lvMatch ? parseInt(lvMatch[1]) : 0;
    }

    // 4. Read set name — try normal position first, then SE offset
    var setNameText = ocrWithImage(gameImage, ARTIFACT_OCR.SET_NAME.x, ARTIFACT_OCR.SET_NAME.y,
        ARTIFACT_OCR.SET_NAME.w, ARTIFACT_OCR.SET_NAME.h);
    var setKey = fuzzyMatchMap(setNameText, ARTIFACT_SET_MAP);
    var isSE = false;
    if (!setKey) {
        // Try with SE offset
        setNameText = ocrWithImage(gameImage, ARTIFACT_OCR.SET_NAME.x,
            ARTIFACT_OCR.SET_NAME.y + SE_OFFSET_Y, ARTIFACT_OCR.SET_NAME.w, ARTIFACT_OCR.SET_NAME.h);
        setKey = fuzzyMatchMap(setNameText, ARTIFACT_SET_MAP);
        if (setKey) isSE = true;
    }
    if (!setKey) {
        log.warn("Could not detect artifact set from: " + setNameText);
        return null;
    }

    // 5. Determine rarity from set type
    var rarity = 5;
    if (STAR_3_SETS.indexOf(setKey) !== -1) rarity = 3;
    else if (STAR_4_SETS.indexOf(setKey) !== -1) rarity = 4;

    // 6. Read substats
    var subOffsetY = isSE ? SE_OFFSET_Y : 0;
    var substats = [];
    var unactivatedSubstats = [];
    var subRegions = [ARTIFACT_OCR.SUB1, ARTIFACT_OCR.SUB2, ARTIFACT_OCR.SUB3, ARTIFACT_OCR.SUB4];
    for (var si = 0; si < subRegions.length; si++) {
        var reg = subRegions[si];
        var subText = ocrWithImage(gameImage, reg.x, reg.y + subOffsetY, reg.w, reg.h);
        if (!subText || subText.length < 2) continue;
        var parsed = parseStatFromText(subText);
        if (parsed) {
            if (parsed.inactive) {
                unactivatedSubstats.push({ key: parsed.key, value: parsed.value });
            } else {
                substats.push({ key: parsed.key, value: parsed.value });
            }
        }
    }

    // 7. Read equipped character
    var equipText = ocrWithImage(gameImage, ARTIFACT_OCR.EQUIP.x, ARTIFACT_OCR.EQUIP.y,
        ARTIFACT_OCR.EQUIP.w, ARTIFACT_OCR.EQUIP.h);
    var location = "";
    if (equipText && equipText.indexOf("已装备") !== -1) {
        var charName = equipText.replace("已装备", "").replace(/[:\s：]/g, "").trim();
        location = fuzzyMatchMap(charName, CHARACTER_NAME_MAP) || "";
    }

    // 8. Detect lock status from OCR in the equip/lock area
    var lockText = ocrWithImage(gameImage, ARTIFACT_OCR.LOCK.x, ARTIFACT_OCR.LOCK.y,
        ARTIFACT_OCR.LOCK.w, ARTIFACT_OCR.LOCK.h);
    var lock = false;
    // Lock icon presence — we check if there's a lock indicator
    // In practice, we look for the lock/unlock toggle in that region
    if (lockText && lockText.length > 0) {
        lock = true;
    }

    // 9. Detect astral mark and elixir crafted from extra info area
    var extraText = ocrWithImage(gameImage, ARTIFACT_OCR.EXTRA_INFO.x,
        ARTIFACT_OCR.EXTRA_INFO.y + subOffsetY, ARTIFACT_OCR.EXTRA_INFO.w, ARTIFACT_OCR.EXTRA_INFO.h);
    var astralMark = false;
    var elixirCrafted = false;
    if (extraText) {
        if (extraText.indexOf("星辉") !== -1 || extraText.indexOf("星标") !== -1) {
            astralMark = true;
        }
        if (extraText.indexOf("秘药") !== -1 || extraText.indexOf("精酿") !== -1) {
            elixirCrafted = true;
        }
    }

    // Assemble GOOD artifact object
    var artifact = {
        setKey: setKey,
        slotKey: slotKey,
        level: level,
        rarity: rarity,
        mainStatKey: mainStatKey,
        location: location,
        lock: lock,
        substats: substats
    };

    // Add optional GOOD v3 fields if relevant
    if (astralMark) artifact.astralMark = true;
    if (elixirCrafted) artifact.elixirCrafted = true;
    if (unactivatedSubstats.length > 0) {
        artifact.unactivatedSubstats = unactivatedSubstats;
    }

    return artifact;
}

// Scan all artifacts from the backpack
async function scanAllArtifacts(minRarity) {
    if (minRarity === undefined) minRarity = 4;

    log.info("Opening backpack for artifact scan...");
    await openBackpack();
    await selectBackpackTab("artifact");
    await sleep(500);

    // Read total artifact count
    var counts = await readItemCount();
    var totalCount = counts.total;
    if (totalCount === 0) {
        log.warn("No artifacts found in backpack");
        return [];
    }
    log.info("Total artifacts to scan: " + totalCount);

    var artifacts = [];
    var scannedCount = 0;

    await traverseBackpackGrid(totalCount, async function (itemIndex) {
        scannedCount++;
        if (scannedCount % 20 === 0 || scannedCount === totalCount) {
            log.info("Scanning artifact " + scannedCount + "/" + totalCount + "...");
        }

        await sleep(100); // Wait for detail panel to update

        var gameImage = captureGameRegion();
        try {
            var artifact = scanSingleArtifact(gameImage);
            if (artifact && artifact.rarity >= minRarity) {
                artifacts.push(artifact);
            }
        } catch (e) {
            log.warn("Error scanning artifact #" + scannedCount + ": " + e.message);
        }
        gameImage.Dispose();
    });

    log.info("Artifact scan complete. Found " + artifacts.length + " artifacts (>=" + minRarity + " star)");
    return artifacts;
}
