// ============================================================
// OCR Utility Functions
// ============================================================

// Perform OCR on a specific game region with retry
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
                log.warn("[OCR] 识别失败 区域 (" + x + "," + y + ")");
                return null;
            }
        }
        await sleep(Math.round(DELAY_SCROLL * 1.5));
    }
    return null;
}

// Perform OCR on a pre-captured game image
function ocrWithImage(gameImage, x, y, w, h) {
    var ocrObj = RecognitionObject.Ocr(x, y, w, h);
    var result = gameImage.Find(ocrObj);
    var text = result.Text;
    result.Dispose();
    return text ? text.trim() : "";
}

// Check if a template matches in a region
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

// Count template matches in a region
function countTemplateMatches(gameImage, templateMat, x, y, w, h) {
    var crop = gameImage.DeriveCrop(x, y, w, h);
    var tmObj = RecognitionObject.TemplateMatch(templateMat);
    var results = crop.FindMulti(tmObj);
    var count = results.Count;
    results.Dispose();
    crop.Dispose();
    return count;
}

// Parse a number from OCR text
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

// 检测星级像素是否为黄色 (R高 G中 B低)
function isStarYellow(gameImage, x) {
    var mat = gameImage.SrcMat;
    var pixel = mat.SubMat(372, 373, x, x + 1).Mean();
    var b = pixel.Val0, g = pixel.Val1, r = pixel.Val2;
    return (r > 150 && g > 100 && b < 100);
}

// 检测像素亮度是否为深色 (亮度 < 128)
function isPixelDark(gameImage, x, y) {
    var mat = gameImage.SrcMat;
    var pixel = mat.SubMat(y, y + 1, x, x + 1).Mean();
    var b = pixel.Val0, g = pixel.Val1, r = pixel.Val2;
    var brightness = (r + g + b) / 3;
    return brightness < 128;
}

// 双像素验证暗色图标检测
function detectDarkIcon(gameImage, x1, y1, x2, y2, label) {
    var d1 = isPixelDark(gameImage, x1, y1);
    var d2 = isPixelDark(gameImage, x2, y2);
    if (d1 !== d2) {
        log.error("[" + label + "] 检测不一致: (" + x1 + "," + y1 + ")=" + d1 + " (" + x2 + "," + y2 + ")=" + d2);
    }
    return d1;
}

// 检测武器锁定状态
function detectWeaponLock(gameImage) {
    return detectDarkIcon(gameImage, 1768, 428, 1740, 429, "武器锁定");
}

// 检测圣遗物锁定状态
function detectArtifactLock(gameImage, yShift) {
    var dy = yShift || 0;
    return detectDarkIcon(gameImage, 1683, 428 + dy, 1708, 428 + dy, "圣遗物锁定");
}

// 检测圣遗物收藏标记 (astralMark)
function detectArtifactAstralMark(gameImage, yShift) {
    var dy = yShift || 0;
    return detectDarkIcon(gameImage, 1768, 428 + dy, 1740, 429 + dy, "圣遗物收藏");
}

// 检测圣遗物是否为祝圣之霜定义 (elixirCrafted)
function detectElixirCrafted(gameImage) {
    var text = ocrWithImage(gameImage, 1360, 410, 140, 26);
    return !!(text && text.indexOf("祝圣") !== -1);
}

// elixirCrafted 导致的 Y 偏移量
var ELIXIR_SHIFT = 40;

// Read the item count display "N/M"
async function readItemCount() {
    var text = await ocrRegion(1545, 30, 263, 38);
    if (!text) return { current: 0, total: 0 };
    var match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return { current: 0, total: 0 };
    return { current: parseInt(match[1]), total: parseInt(match[2]) };
}
