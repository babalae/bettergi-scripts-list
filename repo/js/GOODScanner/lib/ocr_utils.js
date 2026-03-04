// ============================================================
// OCR Utility Functions
// ============================================================

// Perform OCR on a specific game region with retry
// Returns recognized text string, or null on failure
async function ocrRegion(x, y, w, h, timeout) {
    if (timeout === undefined) timeout = 3000;
    var startTime = Date.now();
    var retryCount = 0;
    while (Date.now() - startTime < timeout) {
        try {
            var ro = captureGameRegion();
            var ocrObj = RecognitionObject.Ocr(x, y, w, h);
            var result = ro.Find(ocrObj);
            var text = result.Text;
            result.Dispose();
            ro.Dispose();
            if (text && text.trim().length > 0) {
                return text.trim();
            }
            return null;
        } catch (e) {
            retryCount++;
            if (retryCount > 3) {
                log.warn("OCR failed after " + retryCount + " retries at (" + x + "," + y + ")");
                return null;
            }
        }
        await sleep(300);
    }
    return null;
}

// Perform OCR and return text, capturing a fresh game image each time
// Uses pre-created OCR recognition objects for efficiency
function ocrWithImage(gameImage, x, y, w, h) {
    var ocrObj = RecognitionObject.Ocr(x, y, w, h);
    var result = gameImage.Find(ocrObj);
    var text = result.Text;
    result.Dispose();
    return text ? text.trim() : "";
}

// Check if a template matches in a region of the game image
// Returns true if match found
function templateMatchInRegion(gameImage, templateMat, x, y, w, h, threshold) {
    var crop = gameImage.DeriveCrop(x, y, w, h);
    var tmObj = RecognitionObject.TemplateMatch(templateMat);
    if (threshold !== undefined) {
        tmObj.Threshold = threshold;
    }
    var result = crop.Find(tmObj);
    var found = !result.IsEmpty();
    result.Dispose();
    crop.Dispose();
    return found;
}

// Count template matches in a region (e.g., counting star icons)
function countTemplateMatches(gameImage, templateMat, x, y, w, h) {
    var crop = gameImage.DeriveCrop(x, y, w, h);
    var tmObj = RecognitionObject.TemplateMatch(templateMat);
    var results = crop.FindMulti(tmObj);
    var count = results.Count;
    results.Dispose();
    crop.Dispose();
    return count;
}

// Parse a number from OCR text (e.g., "Lv.90" → 90, "+20" → 20, "1/1800" → 1)
function parseNumberFromText(text) {
    if (!text) return 0;
    var match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// Parse "XX/YY" format and return first number
function parseSlashNumber(text) {
    if (!text) return 0;
    var match = text.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? parseInt(match[1]) : parseNumberFromText(text);
}

// Detect lock status from a game image region
// Lock icon is typically at a known position in the detail panel
function detectLockIcon(gameImage, lockTemplateMat, x, y, w, h) {
    return templateMatchInRegion(gameImage, lockTemplateMat, x, y, w, h);
}

// Read the item count display "N/M" from the top-right area
async function readItemCount() {
    var text = await ocrRegion(1500, 0, 300, 80);
    if (!text) return { current: 0, total: 0 };
    var match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return { current: 0, total: 0 };
    return { current: parseInt(match[1]), total: parseInt(match[2]) };
}
