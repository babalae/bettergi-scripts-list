// ============================================================
// Character Scanner — 基于 Inventory Kamera 逻辑
// 坐标基准: 1920x1080
// ============================================================

var CHAR_TAB_ATTRIBUTES = { x: 220, y: 158 };
var CHAR_TAB_CONSTELLATION = { x: 220, y: 368 };
var CHAR_TAB_TALENTS = { x: 170, y: 435 };
var CHAR_NEXT_BUTTON = { x: 1845, y: 525 };

var CHAR_NAME_REGION = { x: 128, y: 15, w: 330, h: 68 };
var CHAR_LEVEL_REGION = { x: 1440, y: 203, w: 248, h: 42 };

var CONST_CLICK_X = 1695;
var CONST_FIRST_Y = 270;
var CONST_OFFSET_Y = 113;
var CONST_ACTIVATE = { x: 218, y: 1002, w: 82, h: 31 };

var TALENT_OVERVIEW = {
    AUTO:  { x: 1630, y: 166, w: 70, h: 30 },
    SKILL: { x: 1630, y: 256, w: 70, h: 30 },
    BURST: { x: 1630, y: 346, w: 70, h: 30 },
    BURST_SPECIAL: { x: 1630, y: 436, w: 70, h: 30 }
};
var TALENT_CLICK_X = 1695;
var TALENT_FIRST_Y = 165;
var TALENT_OFFSET_Y = 90;
var TALENT_LEVEL_REGION = { x: 1, y: 138, w: 559, h: 77 };

// 解析角色名称和元素类型文本，返回 {name, element, rawText}
function parseCharacterNameAndElement(text) {
    var name = null;
    var element = null;
    if (text && text.indexOf("/") !== -1) {
        var parts = text.split("/");
        element = parts[0].trim();
        var rawName = parts[1].replace(/[^\u4E00-\u9FFF\u300C\u300Da-zA-Z0-9]/g, "").trim();
        name = fuzzyMatchMap(rawName, CHARACTER_NAME_MAP);
    } else if (text) {
        name = fuzzyMatchMap(text, CHARACTER_NAME_MAP);
    }
    return { name: name, element: element, rawText: text };
}

// OCR 读取角色名称和元素，失败时等待1秒重试一次
async function readCharacterNameAndElement() {
    var text = await ocrRegion(CHAR_NAME_REGION.x, CHAR_NAME_REGION.y,
        CHAR_NAME_REGION.w, CHAR_NAME_REGION.h);
    var result = parseCharacterNameAndElement(text);
    if (!result.name) {
        log.warn("[角色] 第1次无法匹配名称: 「" + text + "」，等待重试");
        await sleep(1000);
        text = await ocrRegion(CHAR_NAME_REGION.x, CHAR_NAME_REGION.y,
            CHAR_NAME_REGION.w, CHAR_NAME_REGION.h);
        result = parseCharacterNameAndElement(text);
        if (!result.name) log.warn("[角色] 第2次无法匹配名称: 「" + text + "」");
    }
    return result;
}

// OCR 读取角色等级，返回 {level, ascended}
async function readCharacterLevel() {
    var text = await ocrRegion(CHAR_LEVEL_REGION.x, CHAR_LEVEL_REGION.y,
        CHAR_LEVEL_REGION.w, CHAR_LEVEL_REGION.h);

    var level = 1;
    var ascended = false;
    if (text) {
        var match = text.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
            level = parseInt(match[1]);
            var maxLevel = Math.round(parseInt(match[2]) / 10) * 10;
            ascended = level >= 20 && level < maxLevel;
        } else {
            level = parseNumberFromText(text) || 1;
        }
    }
    return { level: level, ascended: ascended };
}

// 点击第 cIndex 个命座节点，检测是否已激活
async function isConstellationActivated(cIndex, isFirstClick) {
    var clickY = CONST_FIRST_Y + cIndex * CONST_OFFSET_Y;
    click(CONST_CLICK_X, clickY);
    await sleep(isFirstClick ? DELAY_CHAR_TAB : Math.round(DELAY_CHAR_TAB * 0.5));

    var gameImage = captureGameRegion();
    var text = ocrWithImage(gameImage, CONST_ACTIVATE.x, CONST_ACTIVATE.y,
        CONST_ACTIVATE.w, CONST_ACTIVATE.h);
    gameImage.Dispose();

    return (text && text.indexOf("已激活") !== -1);
}

// 无命座角色
var NO_CONSTELLATION = ["Aloy", "Manekin", "Manekina"];

// 二分法读取命座数量（最多3次点击）
// C3 → 失败: C2 → 失败: C1
// C3 → 成功: C6 → 成功: 6
// C3 → 成功: C6 → 失败: C4 → C5
async function readConstellationCount(characterName, element) {
    if (NO_CONSTELLATION.indexOf(characterName) !== -1) {
        return 0;
    }

    click(CHAR_TAB_CONSTELLATION.x, CHAR_TAB_CONSTELLATION.y);
    await sleep(DELAY_CHAR_TAB);

    var constellation = 0;

    var c3 = await isConstellationActivated(2, true);
    if (!c3) {
        var c2 = await isConstellationActivated(1, false);
        if (!c2) {
            var c1 = await isConstellationActivated(0, false);
            constellation = c1 ? 1 : 0;
        } else {
            constellation = 2;
        }
    } else {
        var c6 = await isConstellationActivated(5, false);
        if (c6) {
            constellation = 6;
        } else {
            var c4 = await isConstellationActivated(3, false);
            if (!c4) {
                constellation = 3;
            } else {
                var c5 = await isConstellationActivated(4, false);
                constellation = c5 ? 5 : 4;
            }
        }
    }

    // 岩元素背景动效可能干扰OCR，C5时重新验证C6
    if (constellation === 5 && element && element.indexOf("岩") !== -1) {
        var c6Recheck = await isConstellationActivated(5, false);
        if (c6Recheck) {
            constellation = 6;
            log.warn("[角色] 岩元素C6重新验证通过，修正为C6");
        }
    }

    keyPress("VK_ESCAPE");
    await sleep(DELAY_CHAR_TAB);

    return constellation;
}

// 从文本中解析 "Lv.X" 格式的等级数字
function parseLvText(text) {
    if (!text) return 0;
    var m = text.match(/[Ll][Vv]\.?\s*(\d{1,2})/);
    if (m) {
        var lv = parseInt(m[1]);
        return (lv >= 1 && lv <= 15) ? lv : 0;
    }
    return 0;
}

// 点击天赋详情读取等级（概览读取失败时的回退方案）
async function readTalentByClick(talentIndex, isFirst) {
    var clickY = TALENT_FIRST_Y + talentIndex * TALENT_OFFSET_Y;
    click(TALENT_CLICK_X, clickY);
    await sleep(isFirst ? DELAY_CHAR_TAB : Math.round(DELAY_CHAR_TAB * 0.5));

    var text = await ocrRegion(TALENT_LEVEL_REGION.x, TALENT_LEVEL_REGION.y,
        TALENT_LEVEL_REGION.w, TALENT_LEVEL_REGION.h);

    var lv = 1;
    if (text) {
        var m = text.match(/(\d+)/);
        if (m) {
            var v = parseInt(m[1]);
            if (v >= 1 && v <= 15) lv = v;
        }
    }
    return lv;
}

// skipTab: 如果当前已在天赋页则跳过点击
async function readTalentLevels(characterName, skipTab) {
    if (!skipTab) {
        click(CHAR_TAB_TALENTS.x, CHAR_TAB_TALENTS.y);
        await sleep(DELAY_CHAR_TAB);
    }

    var hasSpecial = characterName && (characterName === "KamisatoAyaka" || characterName === "Mona");

    var talents = { auto: 1, skill: 1, burst: 1 };
    var needClick = false;

    var gameImage = captureGameRegion();

    var autoLv = parseLvText(ocrWithImage(gameImage, TALENT_OVERVIEW.AUTO.x, TALENT_OVERVIEW.AUTO.y,
        TALENT_OVERVIEW.AUTO.w, TALENT_OVERVIEW.AUTO.h));
    if (autoLv > 0) { talents.auto = autoLv; } else { needClick = true; }

    var skillLv = parseLvText(ocrWithImage(gameImage, TALENT_OVERVIEW.SKILL.x, TALENT_OVERVIEW.SKILL.y,
        TALENT_OVERVIEW.SKILL.w, TALENT_OVERVIEW.SKILL.h));
    if (skillLv > 0) { talents.skill = skillLv; } else { needClick = true; }

    var burstRegion = hasSpecial ? TALENT_OVERVIEW.BURST_SPECIAL : TALENT_OVERVIEW.BURST;
    var burstLv = parseLvText(ocrWithImage(gameImage, burstRegion.x, burstRegion.y,
        burstRegion.w, burstRegion.h));
    if (burstLv > 0) { talents.burst = burstLv; } else { needClick = true; }

    gameImage.Dispose();

    if (needClick) {
        var missing = [];
        if (autoLv === 0) missing.push("普攻");
        if (skillLv === 0) missing.push("技能");
        if (burstLv === 0) missing.push("大招");
        log.warn("[角色] 天赋概览未匹配Lv.格式: " + missing.join("/") + "，使用点击详情读取");
        var isFirst = true;
        if (autoLv === 0) {
            talents.auto = await readTalentByClick(0, isFirst);
            isFirst = false;
        }
        if (skillLv === 0) {
            talents.skill = await readTalentByClick(1, isFirst);
            isFirst = false;
        }
        if (burstLv === 0) {
            talents.burst = await readTalentByClick(hasSpecial ? 3 : 2, isFirst);
        }
        keyPress("VK_ESCAPE");
        await sleep(500);
    }

    return talents;
}

// reverse=false: 属性→命座→天赋 (下个角色停在天赋页)
// reverse=true:  天赋→命座→属性 (下个角色停在属性页)
async function scanSingleCharacter(firstName, reverse) {
    // 名称和元素在任何页面都可见，先读取用于重复检测
    var nameInfo = await readCharacterNameAndElement();
    if (!nameInfo.name) {
        if (settings.continueOnFailure) {
            log.warn("[角色] 无法识别角色: 「" + nameInfo.rawText + "」，跳过");
            return null;
        }
        throw new Error("无法识别角色: 「" + nameInfo.rawText + "」");
    }

    if (firstName && nameInfo.name === firstName) {
        return { _repeat: true };
    }

    var levelInfo, constellation, talents;

    if (!reverse) {
        // 正序: 属性→命座→天赋 (已在属性页，无需点击)
        levelInfo = await readCharacterLevel();
        constellation = await readConstellationCount(nameInfo.name, nameInfo.element);
        talents = await readTalentLevels(nameInfo.name);
    } else {
        // 反序: 天赋→命座→属性 (当前已在天赋页)
        talents = await readTalentLevels(nameInfo.name, true);
        constellation = await readConstellationCount(nameInfo.name, nameInfo.element);
        click(CHAR_TAB_ATTRIBUTES.x, CHAR_TAB_ATTRIBUTES.y);
        await sleep(DELAY_CHAR_TAB);
        levelInfo = await readCharacterLevel();
    }

    var ascension = levelToAscension(levelInfo.level, levelInfo.ascended);

    // 达达利亚固有天赋: 普攻等级+1
    if (nameInfo.name === "Tartaglia") {
        talents.auto = Math.max(1, talents.auto - 1);
    }

    // 扣除命座加成的天赋等级 (c3/c5 各+3)
    var bonus = CHARACTER_CONST_BONUS[nameInfo.name];
    if (bonus) {
        var talentKeyMap = { "A": "auto", "E": "skill", "Q": "burst" };
        var k;
        if (constellation >= 3 && bonus.c3 && talentKeyMap[bonus.c3]) {
            k = talentKeyMap[bonus.c3];
            talents[k] = Math.max(1, talents[k] - 3);
        }
        if (constellation >= 5 && bonus.c5 && talentKeyMap[bonus.c5]) {
            k = talentKeyMap[bonus.c5];
            talents[k] = Math.max(1, talents[k] - 3);
        }
    }

    return {
        key: nameInfo.name,
        level: levelInfo.level,
        constellation: constellation,
        ascension: ascension,
        talent: {
            auto: talents.auto,
            skill: talents.skill,
            burst: talents.burst
        }
    };
}

// 扫描所有角色，返回 GOOD 角色数组
async function scanAllCharacters(devLimit) {
    log.info("[角色] 开始扫描...");
    await openCharacterScreen();

    var characters = [];
    var firstName = null;
    var viewedCount = 0;
    var reverse = false;

    while (true) {
        if (devLimit && characters.length >= devLimit) break;

        var charData = await scanSingleCharacter(firstName, reverse);

        if (charData && charData._repeat) break;

        if (charData && charData.key) {
            characters.push(charData);
            if (!firstName) firstName = charData.key;
            if (settings.logProgress) log.info("[角色] " + charData.key + " Lv." + charData.level +
                " C" + charData.constellation +
                " " + charData.talent.auto + "/" + charData.talent.skill + "/" + charData.talent.burst);
        }

        viewedCount++;
        if (viewedCount > 3 && characters.length < 1) {
            log.error("[角色] 已查看 " + viewedCount + " 个但无结果，停止");
            break;
        }

        click(CHAR_NEXT_BUTTON.x, CHAR_NEXT_BUTTON.y);
        await sleep(DELAY_CHAR_TAB);
        reverse = !reverse;
    }

    log.info("[角色] 完成，共 " + characters.length + " 个");
    return characters;
}
