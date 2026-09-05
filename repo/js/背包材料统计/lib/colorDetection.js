const COLOR_TOLERANCE = 20;
const PIXEL_SAMPLE_RADIUS = 2;
const STD_TOLERANCE = 20;
const OUTLIER_THRESHOLD = 1.5;
const POSITION_TOLERANCE = 200;

function compareColorTolerance(pixel1, pixel2, tolerance) {
    const bDiff = Math.abs(pixel1.Item0 - pixel2.Item0);
    const gDiff = Math.abs(pixel1.Item1 - pixel2.Item1);
    const rDiff = Math.abs(pixel1.Item2 - pixel2.Item2);
    return bDiff <= tolerance && gDiff <= tolerance && rDiff <= tolerance;
}

function compareColor(templateMat, cachedFrame, result, detectRange = null) {
    const regionMat = cachedFrame.SrcMat;
    
    if (!detectRange) {
        detectRange = {
            x: 0,
            y: 0,
            width: regionMat.cols,
            height: regionMat.rows
        };
    }
    
    const resultCenterX = Math.floor(result.x + result.width / 2);
    const resultCenterY = Math.floor(result.y + result.height / 2);
    
    const templateSize = Math.min(templateMat.cols, templateMat.rows);
    const radius = Math.min(PIXEL_SAMPLE_RADIUS, Math.floor(templateSize / 2) - 1);
    
    const { bestPosition } = getBestRegionPosition(
        templateMat, 
        regionMat, 
        resultCenterX, 
        resultCenterY, 
        radius,
        detectRange
    );
    
    const templateCenterX = Math.floor(templateMat.cols / 2);
    const templateCenterY = Math.floor(templateMat.rows / 2);
    
    const { templatePixels, regionPixels, matchedPixels } = getMatchedPixelsAroundCenter(
        templateMat, templateCenterX, templateCenterY,
        regionMat, bestPosition.x, bestPosition.y,
        radius, COLOR_TOLERANCE
    );
    
    const matchedTemplatePixels = matchedPixels.map(p => p.template);
    const matchedRegionPixels = matchedPixels.map(p => p.region);
    
    const templateDist = analyzeColorDistribution(matchedTemplatePixels);
    const regionDist = analyzeColorDistribution(matchedRegionPixels);
    
    const matchedCount = matchedPixels.length;
    const totalCount = templatePixels.length;
    
    const bDiff = Math.abs(templateDist.avg.Item0 - regionDist.avg.Item0);
    const gDiff = Math.abs(templateDist.avg.Item1 - regionDist.avg.Item1);
    const rDiff = Math.abs(templateDist.avg.Item2 - regionDist.avg.Item2);
    
    const stdBDiff = Math.abs(templateDist.std.Item0 - regionDist.std.Item0);
    const stdGDiff = Math.abs(templateDist.std.Item1 - regionDist.std.Item1);
    const stdRDiff = Math.abs(templateDist.std.Item2 - regionDist.std.Item2);
    
    const isMatch = stdBDiff <= STD_TOLERANCE && stdGDiff <= STD_TOLERANCE && stdRDiff <= STD_TOLERANCE;
    
    return {
        isMatch: isMatch,
        avgDiff: { b: bDiff, g: gDiff, r: rDiff },
        stdDiff: { b: stdBDiff, g: stdGDiff, r: stdRDiff },
        matchedCount: matchedCount,
        totalCount: totalCount
    };
}

function getPixelsAroundCenter(mat, centerX, centerY, radius) {
    const pixels = [];
    for (let y = centerY - radius; y <= centerY + radius; y++) {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            if (x >= 0 && y >= 0 && x < mat.cols && y < mat.rows) {
                try {
                    const pixel = mat.Get(OpenCvSharp.OpenCvSharp.Vec3b, y, x);
                    pixels.push(pixel);
                } catch (error) {
                    log.debug(`获取像素(${x}, ${y})失败: ${error.message}`);
                }
            }
        }
    }
    return pixels;
}

function getMatchedPixelsAroundCenter(templateMat, templateCenterX, templateCenterY, regionMat, regionCenterX, regionCenterY, radius, tolerance) {
    const templatePixels = [];
    const regionPixels = [];
    const matchedPixels = [];
    
    for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
            const tx = templateCenterX + x;
            const ty = templateCenterY + y;
            const rx = regionCenterX + x;
            const ry = regionCenterY + y;
            
            if (tx >= 0 && ty >= 0 && tx < templateMat.cols && ty < templateMat.rows &&
                rx >= 0 && ry >= 0 && rx < regionMat.cols && ry < regionMat.rows) {
                try {
                    const templatePixel = templateMat.Get(OpenCvSharp.OpenCvSharp.Vec3b, ty, tx);
                    const regionPixel = regionMat.Get(OpenCvSharp.OpenCvSharp.Vec3b, ry, rx);
                    
                    templatePixels.push(templatePixel);
                    regionPixels.push(regionPixel);
                    
                    const bDiff = Math.abs(templatePixel.Item0 - regionPixel.Item0);
                    const gDiff = Math.abs(templatePixel.Item1 - regionPixel.Item1);
                    const rDiff = Math.abs(templatePixel.Item2 - regionPixel.Item2);
                    
                    if (bDiff <= tolerance && gDiff <= tolerance && rDiff <= tolerance) {
                        matchedPixels.push({ template: templatePixel, region: regionPixel });
                    }
                } catch (error) {
                    log.debug(`获取像素失败: ${error.message}`);
                }
            }
        }
    }
    
    return { templatePixels, regionPixels, matchedPixels };
}

function removeOutliers(pixels, threshold) {
    if (pixels.length <= 1) return pixels;
    
    let sumB = 0, sumG = 0, sumR = 0;
    for (const pixel of pixels) {
        sumB += pixel.Item0;
        sumG += pixel.Item1;
        sumR += pixel.Item2;
    }
    const meanB = sumB / pixels.length;
    const meanG = sumG / pixels.length;
    const meanR = sumR / pixels.length;
    
    let sumSqB = 0, sumSqG = 0, sumSqR = 0;
    for (const pixel of pixels) {
        sumSqB += Math.pow(pixel.Item0 - meanB, 2);
        sumSqG += Math.pow(pixel.Item1 - meanG, 2);
        sumSqR += Math.pow(pixel.Item2 - meanR, 2);
    }
    const stdB = Math.sqrt(sumSqB / pixels.length);
    const stdG = Math.sqrt(sumSqG / pixels.length);
    const stdR = Math.sqrt(sumSqR / pixels.length);
    
    const filteredPixels = [];
    for (const pixel of pixels) {
        const bDiff = Math.abs(pixel.Item0 - meanB);
        const gDiff = Math.abs(pixel.Item1 - meanG);
        const rDiff = Math.abs(pixel.Item2 - meanR);
        
        if (bDiff <= threshold * stdB && gDiff <= threshold * stdG && rDiff <= threshold * stdR) {
            filteredPixels.push(pixel);
        }
    }
    
    return filteredPixels.length > 0 ? filteredPixels : pixels;
}

function calculateAverageColor(pixels) {
    if (pixels.length === 0) {
        return { Item0: 0, Item1: 0, Item2: 0 };
    }
    
    let sumB = 0, sumG = 0, sumR = 0;
    for (const pixel of pixels) {
        sumB += pixel.Item0;
        sumG += pixel.Item1;
        sumR += pixel.Item2;
    }
    
    return {
        Item0: Math.round(sumB / pixels.length),
        Item1: Math.round(sumG / pixels.length),
        Item2: Math.round(sumR / pixels.length)
    };
}

function analyzeColorDistribution(pixels) {
    if (pixels.length === 0) {
        return {
            count: 0,
            min: { Item0: 0, Item1: 0, Item2: 0 },
            max: { Item0: 0, Item1: 0, Item2: 0 },
            avg: { Item0: 0, Item1: 0, Item2: 0 },
            std: { Item0: 0, Item1: 0, Item2: 0 }
        };
    }
    
    let minB = 255, minG = 255, minR = 255;
    let maxB = 0, maxG = 0, maxR = 0;
    let sumB = 0, sumG = 0, sumR = 0;
    
    for (const pixel of pixels) {
        minB = Math.min(minB, pixel.Item0);
        minG = Math.min(minG, pixel.Item1);
        minR = Math.min(minR, pixel.Item2);
        
        maxB = Math.max(maxB, pixel.Item0);
        maxG = Math.max(maxG, pixel.Item1);
        maxR = Math.max(maxR, pixel.Item2);
        
        sumB += pixel.Item0;
        sumG += pixel.Item1;
        sumR += pixel.Item2;
    }
    
    const avgB = sumB / pixels.length;
    const avgG = sumG / pixels.length;
    const avgR = sumR / pixels.length;
    
    let sumSqB = 0, sumSqG = 0, sumSqR = 0;
    for (const pixel of pixels) {
        sumSqB += Math.pow(pixel.Item0 - avgB, 2);
        sumSqG += Math.pow(pixel.Item1 - avgG, 2);
        sumSqR += Math.pow(pixel.Item2 - avgR, 2);
    }
    
    const stdB = Math.sqrt(sumSqB / pixels.length);
    const stdG = Math.sqrt(sumSqG / pixels.length);
    const stdR = Math.sqrt(sumSqR / pixels.length);
    
    return {
        count: pixels.length,
        min: { Item0: minB, Item1: minG, Item2: minR },
        max: { Item0: maxB, Item1: maxG, Item2: maxR },
        avg: { Item0: Math.round(avgB), Item1: Math.round(avgG), Item2: Math.round(avgR) },
        std: { Item0: Math.round(stdB), Item1: Math.round(stdG), Item2: Math.round(stdR) }
    };
}

function analyzeRowColumnDifferences(templateMat, regionMat, centerX, centerY, radius, detectRect = null) {
    const templateRows = [];
    const regionRows = [];
    
    for (let y = -radius; y <= radius; y++) {
        const templateRow = [];
        const regionRow = [];
        
        for (let x = -radius; x <= radius; x++) {
            const templateX = Math.floor(templateMat.cols / 2) + x;
            const templateY = Math.floor(templateMat.rows / 2) + y;
            if (templateX >= 0 && templateY >= 0 && templateX < templateMat.cols && templateY < templateMat.rows) {
                try {
                    templateRow.push(templateMat.Get(OpenCvSharp.OpenCvSharp.Vec3b, templateY, templateX));
                } catch (e) {}
            }
            
            const regionX = centerX + x;
            const regionY = centerY + y;
            
            let isInDetectRange = true;
            if (detectRect) {
                if (regionX < detectRect.x || regionX >= detectRect.x + detectRect.width ||
                    regionY < detectRect.y || regionY >= detectRect.y + detectRect.height) {
                    isInDetectRange = false;
                }
            }
            
            if (isInDetectRange && regionX >= 0 && regionY >= 0 && regionX < regionMat.cols && regionY < regionMat.rows) {
                try {
                    regionRow.push(regionMat.Get(OpenCvSharp.OpenCvSharp.Vec3b, regionY, regionX));
                } catch (e) {}
            }
        }
        
        if (templateRow.length > 0 && regionRow.length > 0) {
            templateRows.push(templateRow);
            regionRows.push(regionRow);
        }
    }
    
    const rowDiffs = [];
    for (let i = 0; i < Math.min(templateRows.length, regionRows.length); i++) {
        const templateRow = templateRows[i];
        const regionRow = regionRows[i];
        
        let totalDiff = 0;
        const minLength = Math.min(templateRow.length, regionRow.length);
        
        for (let j = 0; j < minLength; j++) {
            const tPixel = templateRow[j];
            const rPixel = regionRow[j];
            totalDiff += Math.abs(tPixel.Item0 - rPixel.Item0) + 
                        Math.abs(tPixel.Item1 - rPixel.Item1) + 
                        Math.abs(tPixel.Item2 - rPixel.Item2);
        }
        
        rowDiffs.push(totalDiff / minLength);
    }
    
    const colDiffs = [];
    const maxCol = Math.min(
        templateRows[0]?.length || 0,
        regionRows[0]?.length || 0
    );
    
    for (let j = 0; j < maxCol; j++) {
        let totalDiff = 0;
        const minRow = Math.min(templateRows.length, regionRows.length);
        
        for (let i = 0; i < minRow; i++) {
            const tPixel = templateRows[i][j];
            const rPixel = regionRows[i][j];
            totalDiff += Math.abs(tPixel.Item0 - rPixel.Item0) + 
                        Math.abs(tPixel.Item1 - rPixel.Item1) + 
                        Math.abs(tPixel.Item2 - rPixel.Item2);
        }
        
        colDiffs.push(totalDiff / minRow);
    }
    
    return {
        rowDiffs,
        colDiffs,
        avgRowDiff: rowDiffs.length > 0 ? rowDiffs.reduce((a, b) => a + b, 0) / rowDiffs.length : 0,
        avgColDiff: colDiffs.length > 0 ? colDiffs.reduce((a, b) => a + b, 0) / colDiffs.length : 0
    };
}

function getBestRegionPosition(templateMat, regionMat, initialCenterX, initialCenterY, radius, detectRect = null, maxAttempts = 4) {
    const initialDiffs = analyzeRowColumnDifferences(templateMat, regionMat, initialCenterX, initialCenterY, radius, detectRect);
    
    let positions;
    if (initialDiffs.avgColDiff > initialDiffs.avgRowDiff) {
        const leftColDiff = initialDiffs.colDiffs[Math.floor(initialDiffs.colDiffs.length / 2) - 1] || 0;
        const rightColDiff = initialDiffs.colDiffs[Math.floor(initialDiffs.colDiffs.length / 2) + 1] || 0;
        
        if (leftColDiff > rightColDiff) {
            positions = [
                { x: initialCenterX, y: initialCenterY, name: "原始位置" },
                { x: initialCenterX - 1, y: initialCenterY, name: "左移1像素" },
                { x: initialCenterX - 1, y: initialCenterY - 1, name: "左上移1像素" },
                { x: initialCenterX, y: initialCenterY - 1, name: "上移1像素" },
                { x: initialCenterX + 1, y: initialCenterY - 1, name: "右上移1像素" },
                { x: initialCenterX + 1, y: initialCenterY, name: "右移1像素" },
                { x: initialCenterX + 1, y: initialCenterY + 1, name: "右下移1像素" },
                { x: initialCenterX, y: initialCenterY + 1, name: "下移1像素" },
                { x: initialCenterX - 1, y: initialCenterY + 1, name: "左下移1像素" }
            ];
        } else {
            positions = [
                { x: initialCenterX, y: initialCenterY, name: "原始位置" },
                { x: initialCenterX + 1, y: initialCenterY, name: "右移1像素" },
                { x: initialCenterX + 1, y: initialCenterY + 1, name: "右下移1像素" },
                { x: initialCenterX, y: initialCenterY + 1, name: "下移1像素" },
                { x: initialCenterX - 1, y: initialCenterY + 1, name: "左下移1像素" },
                { x: initialCenterX - 1, y: initialCenterY, name: "左移1像素" },
                { x: initialCenterX - 1, y: initialCenterY - 1, name: "左上移1像素" },
                { x: initialCenterX, y: initialCenterY - 1, name: "上移1像素" },
                { x: initialCenterX + 1, y: initialCenterY - 1, name: "右上移1像素" }
            ];
        }
    } else {
        const topRowDiff = initialDiffs.rowDiffs[Math.floor(initialDiffs.rowDiffs.length / 2) - 1] || 0;
        const bottomRowDiff = initialDiffs.rowDiffs[Math.floor(initialDiffs.rowDiffs.length / 2) + 1] || 0;
        
        if (topRowDiff > bottomRowDiff) {
            positions = [
                { x: initialCenterX, y: initialCenterY, name: "原始位置" },
                { x: initialCenterX, y: initialCenterY - 1, name: "上移1像素" },
                { x: initialCenterX + 1, y: initialCenterY - 1, name: "右上移1像素" },
                { x: initialCenterX + 1, y: initialCenterY, name: "右移1像素" },
                { x: initialCenterX + 1, y: initialCenterY + 1, name: "右下移1像素" },
                { x: initialCenterX, y: initialCenterY + 1, name: "下移1像素" },
                { x: initialCenterX - 1, y: initialCenterY + 1, name: "左下移1像素" },
                { x: initialCenterX - 1, y: initialCenterY, name: "左移1像素" },
                { x: initialCenterX - 1, y: initialCenterY - 1, name: "左上移1像素" }
            ];
        } else {
            positions = [
                { x: initialCenterX, y: initialCenterY, name: "原始位置" },
                { x: initialCenterX, y: initialCenterY + 1, name: "下移1像素" },
                { x: initialCenterX - 1, y: initialCenterY + 1, name: "左下移1像素" },
                { x: initialCenterX - 1, y: initialCenterY, name: "左移1像素" },
                { x: initialCenterX - 1, y: initialCenterY - 1, name: "左上移1像素" },
                { x: initialCenterX, y: initialCenterY - 1, name: "上移1像素" },
                { x: initialCenterX + 1, y: initialCenterY - 1, name: "右上移1像素" },
                { x: initialCenterX + 1, y: initialCenterY, name: "右移1像素" },
                { x: initialCenterX + 1, y: initialCenterY + 1, name: "右下移1像素" }
            ];
        }
    }
    
    let bestPosition = positions[0];
    let bestDiff = Infinity;
    
    const positionDiffs = [];
    
    for (const pos of positions) {
        const diffs = analyzeRowColumnDifferences(templateMat, regionMat, pos.x, pos.y, radius, detectRect);
        const totalDiff = diffs.avgRowDiff + diffs.avgColDiff;
        positionDiffs.push({ name: pos.name, diff: totalDiff });
        
        if (totalDiff < bestDiff) {
            bestDiff = totalDiff;
            bestPosition = pos;
        }
    }
    
    // log.debug(`位置调整分析: 原始位置行列差异 - 行: ${Math.round(initialDiffs.avgRowDiff)}, 列: ${Math.round(initialDiffs.avgColDiff)}`);
    // for (const pd of positionDiffs) {
    //     log.debug(`  ${pd.name}: 总差异 = ${Math.round(pd.diff)}`);
    // }
    
    return { bestPosition, bestDiff };
}