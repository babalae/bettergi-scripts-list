// Minimap coordinate adapter for the scoped snow path runner.
function createWeatherPositionReader(options = {}) {
    const locator = createWeatherLocalizer('assets/weather');
    let cached = null, capturedAt = -Infinity, announced = false;
    let confirmed = null, confirmedAt = -Infinity;
    const diagnosticSession = Date.now();
    let diagnosticCount = 0;
    const stats = {weather: 0, contrast: 0, recentPart: 0, sift: 0, failed: 0};
    // Both spellings are used by the original recorder. Keep them synchronized
    // when its existing big-map correction writes X/Y.
    function point(x, y) {
        return {X: x, Y: y, get x() {return this.X;}, get y() {return this.Y;}};
    }
    function valid(p) {
        return p && Number.isFinite(Number(p.X)) && Number.isFinite(Number(p.Y)) && !(p.X === 0 && p.Y === 0);
    }
    function reset() {
        cached = null; capturedAt = -Infinity; announced = false;
        confirmed = null; confirmedAt = -Infinity;
    }
    function nearbyPart(result, sampledAt) {
        // A recent full/consensus match can corroborate one clearly matched half.
        // Always return that half's newly measured coordinate, never the anchor.
        const age = sampledAt - confirmedAt;
        if (!confirmed || age < 0 || age > 3000 ||
            !result.partialMatches || result.partialMatches.length !== 1) return null;
        const p = result.partialMatches[0];
        if (!p.ok || !valid(p) || p.method !== 'local-contrast' ||
            !['top', 'bottom', 'left', 'right'].includes(p.part) ||
            ![p.score, p.runnerUp, p.exactScore].every(Number.isFinite) ||
            p.score < .60 || p.score - p.runnerUp < .15 || p.exactScore < .72 ||
            Math.hypot(p.X - confirmed.X, p.Y - confirmed.Y) > 30) return null;
        return Object.assign({}, p, {method: 'local-contrast-recent'});
    }
    function saveFailure(src, result, sampledAt) {
        // Save only the minimap, at most eight failures per script invocation.
        // Diagnostic I/O must never change recognition or abort recording.
        if (!options.diagnostics || diagnosticCount >= 8) return;
        const stem = `weather-diagnostics/${diagnosticSession}-${++diagnosticCount}`;
        let crop = null;
        try {
            const scale = src.Width / 1920;
            const rect = {x: Math.round(90 * scale), y: Math.round(47 * scale),
                width: Math.round(156 * scale), height: Math.round(156 * scale)};
            const cv = OpenCvSharp.OpenCvSharp;
            crop = new Mat(src, new cv.Rect(rect.x, rect.y, rect.width, rect.height));
            if (!file.WriteImageSync(stem + '.png', crop)) throw new Error('小地图图片写入失败');
            const info = {sampledAt, sourceWidth: src.Width, sourceHeight: src.Height,
                rect, confirmed, confirmedAt: confirmed ? confirmedAt : null, result};
            if (!file.WriteTextSync(stem + '.json', JSON.stringify(info, null, 2))) {
                throw new Error('匹配信息写入失败');
            }
            log.info('[雪雾定位] 已保存雪雾分析图，继续核验坐标：' + stem + '.png');
        } catch (e) {
            log.warn('[雪雾定位] 诊断保存未完成：' + e.message);
        } finally {if (crop) crop.Dispose();}
    }
    function read(fresh = false) {
        // A menu has no minimap. Clear the cache to force a new capture on return.
        if (!isInMainUI()) {reset(); return null;}
        if (!fresh && Date.now() - capturedAt < 900) {
            return cached ? point(cached.X, cached.Y) : null;
        }
        const sampledAt = Date.now();
        const image = captureGameRegion();
        let p;
        try {
            p = locator.match(image.SrcMat);
            if (!p.ok) saveFailure(image.SrcMat, p, sampledAt);
        }
        finally {image.Dispose();}
        cached = null;
        if (p.ok && valid(p)) {
            confirmed = point(p.X, p.Y); confirmedAt = sampledAt;
        } else {
            const recovered = nearbyPart(p, sampledAt);
            if (recovered) {
                p = recovered;
                stats.recentPart++;
                // Do not renew the anchor: partial matches cannot chain forever.
                log.info(`[雪雾定位] 雪雾补充定位成功：X=${p.X}, Y=${p.Y}，纹理匹配=${p.exactScore.toFixed(3)}，参考区域=${p.part}`);
            }
        }
        if (p.ok && valid(p)) {
            cached = point(p.X, p.Y);
            stats.weather++;
            if (p.method && p.method.startsWith('local-contrast')) stats.contrast++;
            if (!announced) {
                log.info(`[雪雾定位] 已识别至冬室外地图：X=${p.X}, Y=${p.Y}，纹理匹配=${p.exactScore.toFixed(3)}`);
                announced = true;
            }
        } else {
            confirmed = null; confirmedAt = -Infinity;
            // Native SIFT also covers layers/scales outside this outdoor asset.
            // Zero cache time prevents an old native coordinate being reused.
            // Never fall back to the colour matcher that confused the snow areas.
            log.warn('[雪雾定位] 两种纹理识别均未通过：' + JSON.stringify(p));
            const fallbackStarted=Date.now();
            const fallback = options.nativeFallback === false ? null :
                genshin.getPositionFromMapWithMatchingMethod('Teyvat', 'SIFT', 0);
            if (options.nativeFallback !== false) log.info('[雪雾定位] SIFT后备用时 ' + (Date.now()-fallbackStarted) + 'ms');
            if (valid(fallback)) {
                cached = point(Number(fallback.X), Number(fallback.Y));
                stats.sift++;
            } else {stats.failed++;}
        }
        capturedAt = Date.now();
        return cached ? point(cached.X, cached.Y) : null;
    }
    return {read, reset, dispose() {
        locator.dispose();
        log.info('[雪雾定位] 采样统计 ' + JSON.stringify(stats));
    }};
}
