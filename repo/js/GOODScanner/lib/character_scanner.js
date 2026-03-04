// ============================================================
// Character Scanner — Scans characters from the character screen
// ============================================================

// OCR coordinate regions for character detail panel (1920x1080)
// The character screen shows a character list on the left and details on the right
var CHAR_OCR = {
    // Character name (top-center of detail panel)
    NAME:         { x: 120,  y: 18,  w: 250, h: 42 },
    // Character level (e.g., "Lv.90")
    LEVEL:        { x: 120,  y: 62,  w: 180, h: 30 },
    // Talent levels in the talent tab
    // Normal Attack talent level
    TALENT_AUTO:   { x: 270, y: 520, w: 60, h: 30 },
    // Elemental Skill talent level
    TALENT_SKILL:  { x: 270, y: 620, w: 60, h: 30 },
    // Elemental Burst talent level
    TALENT_BURST:  { x: 270, y: 720, w: 60, h: 30 }
};

// Character sidebar positions
// Characters appear as avatar icons in a vertical list on the left side
// First character position and spacing
var CHAR_SIDEBAR = {
    X: 60,           // X position of character avatars
    FIRST_Y: 175,    // Y position of first avatar
    OFFSET_Y: 84,    // spacing between avatars
    VISIBLE: 8       // max visible avatars before scrolling
};

// Tab positions within the character detail view
var CHAR_TABS = {
    // The detail/attributes tab
    DETAIL:       { x: 850, y: 60 },
    // The talent tab
    TALENT:       { x: 1050, y: 60 },
    // The constellation tab
    CONSTELLATION: { x: 1250, y: 60 }
};

// Constellation sidebar click positions (scaled from Inventory_Kamera's 1280x720 base)
// At 1920x1080: X=1695, Y starts at 270 with 112.5px spacing
var CONST_SIDEBAR = {
    X: 1695,
    FIRST_Y: 270,
    OFFSET_Y: 112.5
};

// Constellation activation indicator region (scaled from 1280x720 to 1920x1080)
// At 1280x720: rect(70, 665, 30, 30) → At 1920x1080: rect(105, 997, 45, 45)
// This is the "Activate" button area at the bottom-left of the constellation detail
var CONST_ACTIVATE_REGION = {
    x: 105, y: 997, w: 45, h: 45
};

// Read a single character's basic info (name + level) from the character screen
async function readCharacterBasicInfo() {
    var nameText = await ocrRegion(CHAR_OCR.NAME.x, CHAR_OCR.NAME.y,
        CHAR_OCR.NAME.w, CHAR_OCR.NAME.h);
    var levelText = await ocrRegion(CHAR_OCR.LEVEL.x, CHAR_OCR.LEVEL.y,
        CHAR_OCR.LEVEL.w, CHAR_OCR.LEVEL.h);

    var charKey = fuzzyMatchMap(nameText, CHARACTER_NAME_MAP);
    var level = 1;
    if (levelText) {
        var lvMatch = levelText.match(/[Ll][Vv]\.?\s*(\d+)/);
        level = lvMatch ? parseInt(lvMatch[1]) : parseNumberFromText(levelText);
    }

    return {
        name: nameText,
        key: charKey,
        level: level
    };
}

// Read talent levels from the talent tab
// Returns { auto: N, skill: N, burst: N }
async function readTalentLevels() {
    // Navigate to talent tab
    click(CHAR_TABS.TALENT.x, CHAR_TABS.TALENT.y);
    await sleep(800);

    var autoText = await ocrRegion(CHAR_OCR.TALENT_AUTO.x, CHAR_OCR.TALENT_AUTO.y,
        CHAR_OCR.TALENT_AUTO.w, CHAR_OCR.TALENT_AUTO.h);
    var skillText = await ocrRegion(CHAR_OCR.TALENT_SKILL.x, CHAR_OCR.TALENT_SKILL.y,
        CHAR_OCR.TALENT_SKILL.w, CHAR_OCR.TALENT_SKILL.h);
    var burstText = await ocrRegion(CHAR_OCR.TALENT_BURST.x, CHAR_OCR.TALENT_BURST.y,
        CHAR_OCR.TALENT_BURST.w, CHAR_OCR.TALENT_BURST.h);

    return {
        auto: parseNumberFromText(autoText) || 1,
        skill: parseNumberFromText(skillText) || 1,
        burst: parseNumberFromText(burstText) || 1
    };
}

// Read constellation count from the constellation tab
// Strategy adapted from Inventory_Kamera: click each constellation entry in the
// sidebar sequentially, then OCR the activation button region. A locked constellation
// shows "激活" (Activate) text, while an unlocked one shows the constellation
// name/description. We count how many are unlocked before hitting a locked one.
// Returns 0-6
async function readConstellationCount() {
    // Navigate to constellation tab
    click(CHAR_TABS.CONSTELLATION.x, CHAR_TABS.CONSTELLATION.y);
    await sleep(1000);

    var constellation = 0;

    for (var c = 0; c < 6; c++) {
        // Click the constellation entry in the right sidebar
        var clickX = CONST_SIDEBAR.X;
        var clickY = Math.round(CONST_SIDEBAR.FIRST_Y + c * CONST_SIDEBAR.OFFSET_Y);

        click(clickX, clickY);
        // First constellation needs more time for the UI to load
        await sleep(c === 0 ? 700 : 500);

        // OCR the activation region at the bottom of the constellation detail
        // A locked constellation has "激活" (Activate) button text
        // An unlocked constellation does NOT show "激活" — it shows something else or nothing
        var activateText = await ocrRegion(
            CONST_ACTIVATE_REGION.x, CONST_ACTIVATE_REGION.y,
            CONST_ACTIVATE_REGION.w, CONST_ACTIVATE_REGION.h, 800
        );

        // Check if this constellation is locked (shows "激活" button)
        if (activateText && activateText.indexOf("激活") !== -1) {
            // This constellation is locked — all remaining are also locked
            break;
        }

        // This constellation is unlocked
        constellation++;
    }

    return constellation;
}

// Scan a single character fully (basic info + talents + constellation)
async function scanSingleCharacter() {
    // Read basic info (already on character detail)
    var basicInfo = await readCharacterBasicInfo();
    if (!basicInfo.key) {
        log.warn("Could not identify character: " + basicInfo.name);
        return null;
    }

    // Read talent levels
    var talents = await readTalentLevels();

    // Read constellation
    var constellation = await readConstellationCount();

    // Navigate back to detail tab for next character
    click(CHAR_TABS.DETAIL.x, CHAR_TABS.DETAIL.y);
    await sleep(500);

    var level = basicInfo.level;
    var ascension = levelToAscension(level);

    return {
        key: basicInfo.key,
        level: level,
        constellation: constellation,
        ascension: ascension,
        talent: {
            auto: talents.auto,
            skill: talents.skill,
            burst: talents.burst
        }
    };
}

// Scan all characters
async function scanAllCharacters() {
    log.info("Opening character screen...");
    await openCharacterScreen();
    await sleep(1000);

    var characters = [];
    var seenKeys = {};
    var noNewCharCount = 0;
    var maxNoNew = 3; // Stop scrolling after 3 rounds with no new characters

    // Click the first character to start
    click(CHAR_SIDEBAR.X, CHAR_SIDEBAR.FIRST_Y);
    await sleep(500);

    // Scan characters by iterating through the sidebar
    // The sidebar shows up to CHAR_SIDEBAR.VISIBLE characters at a time
    // We click each one, scan, then scroll down for more
    var totalScanned = 0;
    var scrollRound = 0;

    while (noNewCharCount < maxNoNew) {
        var foundNew = false;

        for (var i = 0; i < CHAR_SIDEBAR.VISIBLE; i++) {
            var y = CHAR_SIDEBAR.FIRST_Y + i * CHAR_SIDEBAR.OFFSET_Y;
            if (y > 900) break; // Don't click below visible area

            click(CHAR_SIDEBAR.X, y);
            await sleep(600);

            try {
                var charData = await scanSingleCharacter();
                if (charData && !seenKeys[charData.key]) {
                    seenKeys[charData.key] = true;
                    characters.push(charData);
                    foundNew = true;
                    totalScanned++;
                    log.info("Scanned character: " + charData.key +
                        " (Lv." + charData.level +
                        " C" + charData.constellation +
                        " " + charData.talent.auto + "/" + charData.talent.skill + "/" + charData.talent.burst + ")");
                }
            } catch (e) {
                log.warn("Error scanning character at position " + i + ": " + e.message);
            }
        }

        if (!foundNew) {
            noNewCharCount++;
        } else {
            noNewCharCount = 0;
        }

        // Scroll down to reveal more characters
        await scrollCharacterList(-5);
        scrollRound++;
        await sleep(500);
    }

    log.info("Character scan complete. Found " + characters.length + " characters");
    return characters;
}
