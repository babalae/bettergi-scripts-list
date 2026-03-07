// ============================================================
// GOOD Scanner
// ============================================================

(async function () {
    log.info("=== GOOD Scanner v1.0 ===");

    try {
    var dpi = parseFloat(settings.dpiScale) || 1;
    setGameMetrics(1920, 1080, dpi);

    // 延迟设置 (ms)
    var DELAY_OPEN_SCREEN = parseInt(settings.delayOpenScreen) || 1000;
    var DELAY_CHAR_TAB = parseInt(settings.delayCharTabSwitch) || 500;
    var DELAY_INV_TAB = parseInt(settings.delayInventoryTabSwitch) || 500;
    var DELAY_SCROLL = parseInt(settings.delayScroll) || 200;
    var DELAY_GRID_ITEM = parseInt(settings.delayGridItem) || 60;

    eval(file.readTextSync("lib/fetch_mappings.js"));
    eval(file.readTextSync("lib/ocr_utils.js"));
    eval(file.readTextSync("lib/navigation.js"));
    eval(file.readTextSync("lib/artifact_scanner.js"));
    eval(file.readTextSync("lib/weapon_scanner.js"));
    eval(file.readTextSync("lib/character_scanner.js"));

    await fetchMappingsIfNeeded();
    eval(file.readTextSync("lib/constants.js"));

    var startTime = Date.now();

    var doScanCharacters = settings.scanCharacters !== false;
    var doScanWeapons = settings.scanWeapons !== false;
    var doScanArtifacts = settings.scanArtifacts !== false;
    var minWeaponRarity = parseInt(settings.minWeaponRarity) || 3;
    var minArtifactRarity = parseInt(settings.minArtifactRarity) || 4;

    var characters = [];
    var weapons = [];
    var artifacts = [];

        if (doScanCharacters) {
            try {
                characters = await scanAllCharacters();
            } catch (e) {
                log.error("角色扫描失败: " + e.message);
                log.error(e.stack);
            }
            await returnToMainUI();
        }

        if (doScanWeapons) {
            try {
                weapons = await scanAllWeapons(minWeaponRarity);
            } catch (e) {
                log.error("武器扫描失败: " + e.message);
                log.error(e.stack);
            }
            if (!doScanArtifacts) await returnToMainUI();
        }

        if (doScanArtifacts) {
            try {
                var skipOpen = doScanWeapons; // already in backpack after weapon scan
                artifacts = await scanAllArtifacts(minArtifactRarity, undefined, skipOpen);
            } catch (e) {
                log.error("圣遗物扫描失败: " + e.message);
                log.error(e.stack);
            }
            await returnToMainUI();
        }

        var goodData = {
            format: "GOOD",
            version: 3,
            source: "BetterGI-GOODScanner"
        };
        if (doScanCharacters) goodData.characters = characters;
        if (doScanWeapons) goodData.weapons = weapons;
        if (doScanArtifacts) goodData.artifacts = artifacts;

        var now = new Date();
        var timestamp = now.getFullYear() + "-" +
            String(now.getMonth() + 1).padStart(2, "0") + "-" +
            String(now.getDate()).padStart(2, "0") + "_" +
            String(now.getHours()).padStart(2, "0") + "-" +
            String(now.getMinutes()).padStart(2, "0") + "-" +
            String(now.getSeconds()).padStart(2, "0");
        var outputPath = "records/good_export_" + timestamp + ".json";
        var jsonStr = JSON.stringify(goodData, null, 2);

        var writeOk = file.writeTextSync(outputPath, jsonStr);
        if (writeOk) {
            log.info("导出: " + outputPath);
        } else {
            log.error("写入失败: " + outputPath);
            file.writeTextSync("records/good_export.json", jsonStr);
        }

        var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log.info("=== 完成: 角色 " + characters.length + " / 武器 " + weapons.length +
            " / 圣遗物 " + artifacts.length + " (" + elapsed + "s) ===");

    } catch (e) {
        log.error("扫描失败: " + e.message);
        log.error(e.stack);
    }

    try { await genshin.returnMainUi(); } catch (e) {}
})();
