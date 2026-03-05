// ============================================================
// Weapon Scanner — 扫描背包中的武器
// 卡片区域: x=1307, y=119, w=494, h=841
// ============================================================

var CARD = { x: 1307, y: 119, w: 494, h: 841 };

var WEAPON_OCR = {
    NAME: { x: CARD.x, y: CARD.y, w: CARD.w, h: Math.round(CARD.h * 0.07) },
    LEVEL: {
        x: CARD.x + Math.round(CARD.w * 0.060),
        y: CARD.y + Math.round(CARD.h * 0.367),
        w: Math.round(CARD.w * 0.262),
        h: Math.round(CARD.h * 0.035)
    },
    REFINEMENT: {
        x: CARD.x + Math.round(CARD.w * 0.058),
        y: CARD.y + Math.round(CARD.h * 0.417),
        w: Math.round(CARD.w * 0.25),
        h: Math.round(CARD.h * 0.038)
    },
    EQUIP: {
        x: CARD.x + Math.round(CARD.w * 0.10),
        y: CARD.y + Math.round(CARD.h * 0.935),
        w: Math.round(CARD.w * 0.85),
        h: Math.round(CARD.h * 0.06)
    }
};

// 武器背包中排在最后的低星武器和锻造材料（中文名）
var WEAPON_STOP_NAMES = [
    "历练的猎弓", "口袋魔导书", "铁尖枪", "佣兵重剑", "银剑",
    "猎弓", "学徒笔记", "新手长枪", "训练大剑", "无锋剑",
    "精锻用魔矿", "精锻用良矿", "精锻用杂矿"
];

// 检测星级像素是否为黄色
function isWeaponStarYellow(gameImage, x) {
    var mat = gameImage.SrcMat;
    var pixel = mat.SubMat(372, 373, x, x + 1).Mean();
    var b = pixel.Val0, g = pixel.Val1, r = pixel.Val2;
    return (r > 150 && g > 100 && b < 100);
}

// 检测武器星级: 5星/4星/3星及以下
function detectWeaponRarity(gameImage) {
    if (isWeaponStarYellow(gameImage, 1485)) return 5;
    if (isWeaponStarYellow(gameImage, 1450)) return 4;
    if (isWeaponStarYellow(gameImage, 1416)) return 3;
    return 2;
}

// 扫描单个武器卡片，返回 GOOD 武器对象或 {_stop} 或 null
function scanSingleWeapon(gameImage) {
    var nameText = ocrWithImage(gameImage, WEAPON_OCR.NAME.x, WEAPON_OCR.NAME.y,
        WEAPON_OCR.NAME.w, WEAPON_OCR.NAME.h);
    var weaponKey = fuzzyMatchMap(nameText, WEAPON_NAME_MAP);
    if (!weaponKey) {
        // 匹配失败时，检查是否为低星武器/材料
        for (var i = 0; i < WEAPON_STOP_NAMES.length; i++) {
            if (nameText && nameText.indexOf(WEAPON_STOP_NAMES[i]) !== -1) {
                log.info("[武器] 检测到「" + WEAPON_STOP_NAMES[i] + "」，停止扫描");
                return { _stop: true };
            }
        }
        if (detectWeaponRarity(gameImage) <= 2) {
            log.info("[武器] 检测到低星物品，停止扫描");
            return { _stop: true };
        }
        if (settings.continueOnFailure) {
            log.warn("[武器] 无法匹配: 「" + nameText + "」，跳过");
            return null;
        }
        throw new Error("无法匹配武器: 「" + nameText + "」");
    }

    var levelText = ocrWithImage(gameImage, WEAPON_OCR.LEVEL.x, WEAPON_OCR.LEVEL.y,
        WEAPON_OCR.LEVEL.w, WEAPON_OCR.LEVEL.h);
    var level = 1;
    var ascended = false;
    if (levelText) {
        var lvMatch = levelText.match(/(\d+)\s*\/\s*(\d+)/);
        if (lvMatch) {
            level = parseInt(lvMatch[1]);
            var maxLevel = Math.round(parseInt(lvMatch[2]) / 10) * 10;
            ascended = level >= 20 && level < maxLevel;
        } else {
            var singleMatch = levelText.match(/[Ll][Vv]\.?\s*(\d+)/);
            level = singleMatch ? parseInt(singleMatch[1]) : parseNumberFromText(levelText);
        }
    }

    var refText = ocrWithImage(gameImage, WEAPON_OCR.REFINEMENT.x, WEAPON_OCR.REFINEMENT.y,
        WEAPON_OCR.REFINEMENT.w, WEAPON_OCR.REFINEMENT.h);
    var refinement = 1;
    if (refText) {
        var refMatch = refText.match(/精炼\s*(\d)/);
        if (refMatch) {
            refinement = parseInt(refMatch[1]);
        } else {
            var rMatch = refText.match(/[Rr](\d)/);
            if (rMatch) refinement = parseInt(rMatch[1]);
            else {
                var digitMatch = refText.match(/(\d)/);
                if (digitMatch) {
                    var d = parseInt(digitMatch[1]);
                    if (d >= 1 && d <= 5) refinement = d;
                }
            }
        }
    }

    var equipText = ocrWithImage(gameImage, WEAPON_OCR.EQUIP.x, WEAPON_OCR.EQUIP.y,
        WEAPON_OCR.EQUIP.w, WEAPON_OCR.EQUIP.h);
    var location = "";
    if (equipText && equipText.indexOf("已装备") !== -1) {
        var charName = equipText.replace("已装备", "").replace(/[:\s：]/g, "").trim();
        location = fuzzyMatchMap(charName, CHARACTER_NAME_MAP) || "";
    }

    var rarity = detectWeaponRarity(gameImage);
    var lock = detectWeaponLock(gameImage);
    var ascension = levelToAscension(level, ascended);

    return {
        key: weaponKey,
        level: level,
        ascension: ascension,
        refinement: refinement,
        rarity: rarity,
        location: location,
        lock: lock
    };
}

// 扫描背包中所有武器，返回 GOOD 武器数组
async function scanAllWeapons(minRarity, devLimit, skipOpenBackpack) {
    if (minRarity === undefined) minRarity = 3;

    log.info("[武器] 开始扫描...");
    if (!skipOpenBackpack) await openBackpack();
    await selectBackpackTab("weapon");

    var counts = await readItemCount();
    var totalCount = counts.total;
    if (totalCount === 0) {
        log.warn("[武器] 背包中没有武器");
        return [];
    }
    log.info("[武器] 总数: " + totalCount);

    var weapons = [];
    var scannedCount = 0;

    await traverseBackpackGrid(totalCount, async function (itemIndex) {
        scannedCount++;

        var gameImage = captureGameRegion();
        try {
            var weapon = scanSingleWeapon(gameImage);
            if (weapon && weapon._stop) {
                gameImage.Dispose();
                return true;
            }
            if (weapon && weapon.key && weapon.rarity >= minRarity) {
                weapons.push(weapon);
                if (settings.logProgress) log.info("[武器] " + weapon.key + " Lv." + weapon.level +
                    " R" + weapon.refinement + " " + (weapon.location || "-") +
                    (weapon.lock ? " 🔒" : ""));
            }
        } catch (e) {
            gameImage.Dispose();
            throw e;
        }
        gameImage.Dispose();

        if (devLimit && weapons.length >= devLimit) return true;
    });

    log.info("[武器] 完成，共 " + weapons.length + " 把");
    return weapons;
}
