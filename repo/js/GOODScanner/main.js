// ============================================================
// GOOD Scanner — Scan characters, weapons, artifacts via OCR
// Export in GOOD v3 format for Genshin Optimizer
// ============================================================

// Load modules
eval(file.readTextSync("lib/fetch_mappings.js"));
eval(file.readTextSync("lib/ocr_utils.js"));
eval(file.readTextSync("lib/navigation.js"));
eval(file.readTextSync("lib/artifact_scanner.js"));
eval(file.readTextSync("lib/weapon_scanner.js"));
eval(file.readTextSync("lib/character_scanner.js"));

(async function () {
    setGameMetrics(1920, 1080, 1);

    // Fetch/refresh game data mappings before loading constants
    await fetchMappingsIfNeeded();
    eval(file.readTextSync("lib/constants.js"));

    var startTime = Date.now();
    log.info("=== GOOD Scanner v1.0 ===");
    log.info("Starting inventory scan for GOOD v3 export...");

    // Read user settings
    var doScanCharacters = settings.scanCharacters !== false;
    var doScanWeapons = settings.scanWeapons !== false;
    var doScanArtifacts = settings.scanArtifacts !== false;
    var minWeaponRarity = parseInt(settings.minWeaponRarity) || 3;
    var minArtifactRarity = parseInt(settings.minArtifactRarity) || 4;

    log.info("Scan config: characters=" + doScanCharacters +
        ", weapons=" + doScanWeapons + " (>=" + minWeaponRarity + "★)" +
        ", artifacts=" + doScanArtifacts + " (>=" + minArtifactRarity + "★)");

    var characters = [];
    var weapons = [];
    var artifacts = [];

    try {
        // Phase 1: Scan Characters
        if (doScanCharacters) {
            log.info("");
            log.info("========== Phase 1: Scanning Characters ==========");
            try {
                characters = await scanAllCharacters();
            } catch (e) {
                log.error("Character scan failed: " + e.message);
                log.error(e.stack);
            }
            await returnToMainUI();
        }

        // Phase 2: Scan Weapons
        if (doScanWeapons) {
            log.info("");
            log.info("========== Phase 2: Scanning Weapons ==========");
            try {
                weapons = await scanAllWeapons(minWeaponRarity);
            } catch (e) {
                log.error("Weapon scan failed: " + e.message);
                log.error(e.stack);
            }
            await returnToMainUI();
        }

        // Phase 3: Scan Artifacts
        if (doScanArtifacts) {
            log.info("");
            log.info("========== Phase 3: Scanning Artifacts ==========");
            try {
                artifacts = await scanAllArtifacts(minArtifactRarity);
            } catch (e) {
                log.error("Artifact scan failed: " + e.message);
                log.error(e.stack);
            }
            await returnToMainUI();
        }

        // Assemble GOOD v3 JSON
        var goodData = {
            format: "GOOD",
            version: 3,
            source: "BetterGI-GOODScanner"
        };
        if (doScanCharacters) goodData.characters = characters;
        if (doScanWeapons) goodData.weapons = weapons;
        if (doScanArtifacts) goodData.artifacts = artifacts;

        // Write output file
        var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        var outputPath = "records/good_export_" + timestamp + ".json";
        var jsonStr = JSON.stringify(goodData, null, 2);

        var writeOk = file.WriteTextSync(outputPath, jsonStr);
        if (writeOk) {
            log.info("");
            log.info("=== Export Complete ===");
            log.info("Output: " + outputPath);
        } else {
            log.error("Failed to write output file: " + outputPath);
            // Try alternative path
            var altPath = "records/good_export.json";
            file.WriteTextSync(altPath, jsonStr);
            log.info("Written to fallback path: " + altPath);
        }

        // Summary
        var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log.info("");
        log.info("=== Scan Summary ===");
        log.info("Characters: " + characters.length);
        log.info("Weapons:    " + weapons.length);
        log.info("Artifacts:  " + artifacts.length);
        log.info("Time:       " + elapsed + "s");
        log.info("Format:     GOOD v3");
        log.info("====================");

    } catch (e) {
        log.error("Scan failed: " + e.message);
        log.error(e.stack);
    }

    // Return to main UI
    try {
        await genshin.returnMainUi();
    } catch (e) {
        log.warn("Could not return to main UI: " + e.message);
    }
})();
