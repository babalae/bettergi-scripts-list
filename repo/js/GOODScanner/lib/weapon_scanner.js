// ============================================================
// Weapon Scanner — Scans weapons from backpack
// ============================================================

// OCR coordinate regions for weapon detail panel (backpack view, 1920x1080)
var WEAPON_OCR = {
    // Weapon name
    NAME:         { x: 1310, y: 140, w: 300, h: 50 },
    // Level display (e.g., "Lv.90/90")
    LEVEL:        { x: 1310, y: 420, w: 200, h: 35 },
    // Refinement rank text (e.g., "精炼1阶")
    REFINEMENT:   { x: 1310, y: 500, w: 200, h: 35 },
    // Equipped character text
    EQUIP:        { x: 1310, y: 770, w: 340, h: 40 },
    // Lock area
    LOCK:         { x: 1750, y: 760, w: 50,  h: 50 },
    // Star rarity area
    RARITY:       { x: 1380, y: 340, w: 200, h: 40 },
    // Base ATK area
    BASE_ATK:     { x: 1310, y: 460, w: 150, h: 35 }
};

// Detect weapon rarity by counting star icons or OCR
// Returns 1-5
function detectWeaponRarity(gameImage) {
    // Try OCR on rarity area — look for star count from the detail panel
    // The rarity stars are shown near the weapon level
    // We use star position: stars appear around (1380-1560, 345)
    // Each star is about 28px wide. We check how many appear.
    var text = ocrWithImage(gameImage, 1310, 180, 380, 30);
    // A rough heuristic: higher-rarity weapons have different name stylings
    // For now, we count the number of star characters if the OCR picks them up
    // Fallback: check if weapon is in the 1-2 star list
    return 0; // Will be determined from lookup
}

// Scan a single weapon from the currently displayed detail panel
function scanSingleWeapon(gameImage) {
    // 1. Read weapon name
    var nameText = ocrWithImage(gameImage, WEAPON_OCR.NAME.x, WEAPON_OCR.NAME.y,
        WEAPON_OCR.NAME.w, WEAPON_OCR.NAME.h);
    var weaponKey = fuzzyMatchMap(nameText, WEAPON_NAME_MAP);
    if (!weaponKey) {
        log.warn("Could not match weapon name: " + nameText);
        return null;
    }

    // 2. Determine rarity from lookup
    var rarity = 0;
    if (WEAPON_1_2_STAR.indexOf(weaponKey) !== -1) {
        rarity = (weaponKey === "DullBlade" || weaponKey === "WasterGreatsword" ||
                  weaponKey === "BeginnersProtector" || weaponKey === "HuntersBow" ||
                  weaponKey === "ApprenticesNotes") ? 1 : 2;
    }
    // If we couldn't determine from lookup, try detecting from star area
    if (rarity === 0) {
        // Read text near the rarity star area to see if we can pick up star info
        var rarityText = ocrWithImage(gameImage, WEAPON_OCR.RARITY.x, WEAPON_OCR.RARITY.y,
            WEAPON_OCR.RARITY.w, WEAPON_OCR.RARITY.h);
        // Count star-like characters
        if (rarityText) {
            var starCount = (rarityText.match(/★|☆|✦|⭐/g) || []).length;
            if (starCount >= 3 && starCount <= 5) rarity = starCount;
        }
        // Default heuristic: if we found the weapon in WEAPON_NAME_MAP, it's at least 3-star
        // 5-star weapons are well-known, 4-star are the rest
        if (rarity === 0) rarity = 4; // conservative default
    }

    // 3. Read level
    var levelText = ocrWithImage(gameImage, WEAPON_OCR.LEVEL.x, WEAPON_OCR.LEVEL.y,
        WEAPON_OCR.LEVEL.w, WEAPON_OCR.LEVEL.h);
    var level = 1;
    if (levelText) {
        var lvMatch = levelText.match(/[Ll][Vv]\.?\s*(\d+)/);
        if (lvMatch) {
            level = parseInt(lvMatch[1]);
        } else {
            level = parseNumberFromText(levelText);
        }
    }

    // 4. Read refinement
    var refText = ocrWithImage(gameImage, WEAPON_OCR.REFINEMENT.x, WEAPON_OCR.REFINEMENT.y,
        WEAPON_OCR.REFINEMENT.w, WEAPON_OCR.REFINEMENT.h);
    var refinement = 1;
    if (refText) {
        // Match patterns like "精炼1阶", "精炼2", "R1" etc.
        var refMatch = refText.match(/精炼\s*(\d)/);
        if (refMatch) {
            refinement = parseInt(refMatch[1]);
        } else {
            var rMatch = refText.match(/[Rr](\d)/);
            if (rMatch) refinement = parseInt(rMatch[1]);
        }
    }

    // 5. Read equipped character
    var equipText = ocrWithImage(gameImage, WEAPON_OCR.EQUIP.x, WEAPON_OCR.EQUIP.y,
        WEAPON_OCR.EQUIP.w, WEAPON_OCR.EQUIP.h);
    var location = "";
    if (equipText && equipText.indexOf("已装备") !== -1) {
        var charName = equipText.replace("已装备", "").replace(/[:\s：]/g, "").trim();
        location = fuzzyMatchMap(charName, CHARACTER_NAME_MAP) || "";
    }

    // 6. Detect lock status
    var lockText = ocrWithImage(gameImage, WEAPON_OCR.LOCK.x, WEAPON_OCR.LOCK.y,
        WEAPON_OCR.LOCK.w, WEAPON_OCR.LOCK.h);
    var lock = (lockText && lockText.length > 0);

    // 7. Calculate ascension from level
    var ascension = levelToAscension(level);

    return {
        key: weaponKey,
        level: level,
        ascension: ascension,
        refinement: refinement,
        location: location,
        lock: lock
    };
}

// Scan all weapons from the backpack
async function scanAllWeapons(minRarity) {
    if (minRarity === undefined) minRarity = 3;

    log.info("Opening backpack for weapon scan...");
    await openBackpack();
    await selectBackpackTab("weapon");
    await sleep(500);

    // Read total weapon count
    var counts = await readItemCount();
    var totalCount = counts.total;
    if (totalCount === 0) {
        log.warn("No weapons found in backpack");
        return [];
    }
    log.info("Total weapons to scan: " + totalCount);

    var weapons = [];
    var scannedCount = 0;

    await traverseBackpackGrid(totalCount, async function (itemIndex) {
        scannedCount++;
        if (scannedCount % 20 === 0 || scannedCount === totalCount) {
            log.info("Scanning weapon " + scannedCount + "/" + totalCount + "...");
        }

        await sleep(100);

        var gameImage = captureGameRegion();
        try {
            var weapon = scanSingleWeapon(gameImage);
            if (weapon) {
                // Check rarity via lookup — if weapon key is in our map, it's at least 3-star
                // Skip 1-2 star if below threshold
                var isLowRarity = WEAPON_1_2_STAR.indexOf(weapon.key) !== -1;
                if (!isLowRarity || minRarity <= 2) {
                    weapons.push(weapon);
                }
            }
        } catch (e) {
            log.warn("Error scanning weapon #" + scannedCount + ": " + e.message);
        }
        gameImage.Dispose();
    });

    log.info("Weapon scan complete. Found " + weapons.length + " weapons");
    return weapons;
}
