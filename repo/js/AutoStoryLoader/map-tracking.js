// Narrow adapter for MapBack_07 outdoor routes. Other routes retain native pathing.
(function () {
    // Match the recorder's Snezhnaya gate; Teyvat includes all other nations.
    const snezhnayaBounds = {minX: 4326, maxX: 8986, minY: 7400, maxY: 11034};
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const inside = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
        p.x > snezhnayaBounds.minX && p.x < snezhnayaBounds.maxX &&
        p.y > snezhnayaBounds.minY && p.y < snezhnayaBounds.maxY;
    const bearing = (a, b) => (Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI + 360) % 360;
    const turnDelta = (a, b) => ((b - a + 540) % 360) - 180;
    function select(route) {
        const points = route && route.positions;
        if (!Array.isArray(points) || !points.length) throw new Error('地图路线没有路径点');
        if (points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
            throw new Error('地图路线包含无效坐标');
        }
        if ((route.info && route.info.map_name || 'Teyvat') !== 'Teyvat' || !points.some(inside)) {
            return {weather: false};
        }
        if (!points.every(inside)) return {weather: false, reason: '路线跨出雪雾地图素材范围'};
        const unsupported = points.find(p =>
            !['path', 'target', 'teleport'].includes(p.type || 'path') ||
            !['walk', 'dash', 'run'].includes(p.move_mode || 'walk') ||
            (p.action && p.action.trim()) || (p.action_params && String(p.action_params).trim()) ||
            (p.items && p.items.length) ||
            (p.point_ext_params && Object.keys(p.point_ext_params).length));
        if (unsupported) return {weather: false, reason: '路线含飞行、攀爬、特殊动作或扩展参数'};
        return {weather: true};
    }
    function createRunner(env) {
        async function runFile(path) {
            const route = JSON.parse(env.readFile(path));
            const choice = select(route);
            if (!choice.weather) {
                if (choice.reason) env.warn('[雪雾寻路] ' + choice.reason + '，本次仍使用原内置寻路器');
                return await env.nativeRun(path);
            }
            let reader = null;
            let previous = null, walking = false, running = false, lastDash = -Infinity;
            let currentIndex = 0, teleported = false, usedNative = false;
            function release() {
                walking = false; running = false;
                try {env.keyUp('VK_W');} finally {env.keyUp('VK_RBUTTON');}
            }
            function move(mode, distanceToTarget) {
                if (!walking) {walking = true; env.keyDown('VK_W');}
                const keepSprinting = mode === 'run' && distanceToTarget > 10;
                if (running !== keepSprinting) {
                    running = keepSprinting;
                    if (running) env.keyDown('VK_RBUTTON'); else env.keyUp('VK_RBUTTON');
                }
                // Same mode semantics as PathExecutor: run holds sprint; dash
                // taps it no more than once per second, outside 20 image units.
                if (mode === 'dash' && distanceToTarget > 10 && env.now() - lastDash >= 1000) {
                    env.tap('VK_RBUTTON'); lastDash = env.now();
                }
            }
            async function sample(expected, tolerance = 30) {
                for (let attempt = 0; attempt < 3; ++attempt) {
                    await env.sleep(100);
                    const measured = reader.read(true);
                    const p = measured && {x: Number(measured.X), y: Number(measured.Y)};
                    if (inside(p) && (!expected || distance(p, expected) <= tolerance)) {
                        previous = p;
                        return p;
                    }
                    // The loader disables slow SIFT fallback. Successful fresh
                    // samples keep motion continuous; failed samples stop it.
                    release();
                    if (p) reader.reset();
                    env.warn('[雪雾寻路] 本帧坐标未通过核验，保持停止并重新识别');
                }
                throw new Error('雪雾定位未获得可靠坐标；已停止移动，当前地图步骤未完成');
            }
            async function verifyNative(expected, tolerance) {
                let last = null;
                for (let i = 0; i < 2; ++i) {
                    await env.sleep(100); // Cancellation must propagate before each blocking read.
                    if (env.mainUI && !env.mainUI()) return null;
                    const raw = env.nativeRead();
                    const p = raw && raw.X != null && raw.Y != null && {x: Number(raw.X), y: Number(raw.Y)};
                    if (!inside(p) || !expected || distance(p, expected) > tolerance ||
                        (last && distance(p, last) > 3)) return null;
                    last = p;
                }
                return last;
            }
            async function tryNativeSegment(expected, tolerance) {
                // Select once, at rest and before creating the weather reader.
                // Ordinary maps must not perform three doomed weather scans
                // just to reach native pathing. Never reselect during movement.
                if (!env.nativeRead || !env.nativeRunJson) return null;
                release();
                env.info('[地图寻路] 正在核验原生坐标，确认后选择本段定位方式');
                const at = await verifyNative(expected, tolerance);
                if (!at) return null;
                const nextTeleport = route.positions.findIndex((p, i) => i > currentIndex && p.type === 'teleport');
                const endIndex = nextTeleport < 0 ? route.positions.length : nextTeleport;
                const remaining = route.positions.slice(currentIndex + (teleported ? 1 : 0), endIndex);
                if (remaining.length) {
                    // Seed native local matching at the measured position, and
                    // do not repeat a teleport already performed by this runner.
                    const nativeRoute = {...route, info: {...route.info, map_match_method: 'SIFT'},
                        positions: [{x: at.x, y: at.y, type: 'path', move_mode: 'walk'}, ...remaining]};
                    env.info('[地图寻路] 原生定位复核通过；本段使用 BetterGI 内置寻路，不执行雪雾检测');
                    await env.nativeRunJson(JSON.stringify(nativeRoute));
                    release();
                    // BetterGI's public Run catches its own errors. A resolved
                    // promise alone cannot mark the story map step complete.
                    const end = remaining[remaining.length - 1];
                    if (!await verifyNative(end, 3)) {
                        throw new Error('内置寻路结束后终点坐标未通过复核，当前地图步骤未完成');
                    }
                }
                usedNative = true; previous = null;
                env.info('[地图寻路] 原生定位复核通过，本段完成；下次传送后重新选择识别方式');
                return endIndex;
            }
            async function walkTo(target, index, finalPoint) {
                const started = env.now();
                let best = Infinity, improvedAt = started;
                while (env.now() - started < 120000) {
                    const p = await sample(previous || target, previous ? 30 : 120);
                    const d = distance(p, target);
                    if (d <= 2) {
                        const mustStop = target.type === 'target' || finalPoint;
                        if (mustStop) release();
                        const check = mustStop ? await sample(p, 3) : p;
                        if (distance(check, target) <= 2) {
                            env.info(`[雪雾寻路] 已到达点 ${index}：X=${check.x}, Y=${check.y}，距目标=${distance(check, target).toFixed(2)}`);
                            return;
                        }
                        continue;
                    }
                    if (d < best - 1) {best = d; improvedAt = env.now();}
                    if (env.now() - improvedAt > 20000) throw new Error(`路径点 ${index} 持续无进展，已停止；请检查障碍或非步行地形`);
                    const heading = bearing(p, target), angle = env.orientation();
                    if (!Number.isFinite(angle)) throw new Error('无法识别相机朝向，已停止移动');
                    const delta = turnDelta(angle, heading);
                    if (!walking || Math.abs(delta) > 30) {
                        release();
                        await rotateTo(heading, index);
                    } else if (Math.abs(delta) > 5) {
                        // Small corrections while walking, as in native pathing.
                        env.turn(Math.round(delta), 0);
                    }
                    move(target.move_mode || 'walk', d);
                    await env.sleep(d > 4 ? 100 : 50);
                }
                throw new Error(`路径点 ${index} 超时，当前地图步骤未完成`);
            }
            async function rotateTo(target, index) {
                // Freeze the heading while stationary. Re-sampling integer map
                // coordinates during a close turn makes the desired angle jump.
                let gain = 1, lastAngle = null, lastPixels = 0;
                for (let attempt = 0; attempt < 40; ++attempt) {
                    await env.sleep(100);
                    if (env.mainUI && !env.mainUI()) throw new Error('转向时已离开主界面，停止移动');
                    const angle = env.orientation();
                    if (!Number.isFinite(angle)) throw new Error('无法识别相机朝向，已停止移动');
                    const delta = turnDelta(angle, target);
                    if (Math.abs(delta) <= 7) return;
                    if (lastAngle !== null && Math.abs(lastPixels) >= 8) {
                        const response = turnDelta(lastAngle, angle) / lastPixels;
                        // Account for actual mouse sensitivity and DPI. A damped
                        // correction avoids alternating past the desired angle.
                        if (response >= .02 && response <= 2) gain = Math.max(.25, Math.min(3, .65 / response));
                    }
                    const pixels = Math.round(Math.max(-150, Math.min(150, delta * gain)));
                    env.info(`[雪雾转向] 点=${index}，目标=${target.toFixed(1)}，相机=${angle.toFixed(1)}，误差=${delta.toFixed(1)}，鼠标=${pixels}`);
                    env.turn(pixels, 0);
                    lastAngle = angle; lastPixels = pixels;
                }
                throw new Error('相机转向未能对准目标，已停止移动');
            }
            try {
                for (let i = 0; i < route.positions.length; ++i) {
                    currentIndex = i; teleported = false;
                    const p = route.positions[i];
                    if (p.type === 'teleport') {
                        release();
                        await env.teleport(p.x, p.y);
                        teleported = true; previous = null;
                    }
                    if (i === 0 || teleported) {
                        const nextIndex = await tryNativeSegment(p, 120);
                        if (nextIndex !== null) {
                            i = nextIndex - 1;
                            continue;
                        }
                        if (!reader) reader = env.createReader();
                        reader.reset();
                        env.info('[雪雾寻路] 原生坐标未能确认，启用本段室外纹理定位');
                    }
                    if (teleported) {
                        const at = await sample(p, 120);
                        await sample(at, 3);
                        env.info(`[雪雾寻路] 传送后实测位置：X=${previous.x}, Y=${previous.y}`);
                    } else {
                        await walkTo(p, i + 1, i === route.positions.length - 1);
                    }
                }
                await env.sleep(1); // Cancellation must propagate before reporting completion.
                env.info(usedNative ? '[地图寻路] 当前地图步骤完成，内置寻路终点已复核' : '[雪雾寻路] 全部路径点已实测到达');
            } finally {
                try {release();} finally {if (reader) reader.dispose();}
            }
        }
        return {runFile};
    }
    function createBgi(paimonMenuRo) {
        // The loader also accepts a menu exit icon in its general UI checker.
        // Localization requires the actual HUD with a minimap, so use only Paimon.
        const isInMainUI = () => {
            const image = captureGameRegion();
            try {return !image.Find(paimonMenuRo).isEmpty();}
            finally {image.Dispose();}
        };
        return createRunner({
            readFile: path => file.readTextSync(path),
            nativeRun: path => pathingScript.runFile(path),
            nativeRunJson: json => pathingScript.run(json),
            nativeRead: () => genshin.getPositionFromMapWithMatchingMethod('Teyvat', 'SIFT', 0),
            createReader: () => {
                const createWeatherLocalizer = eval('(function () {\n' + file.readTextSync('weather-localizer.js') + '\nreturn createWeatherLocalizer;})()');
                const createWeatherPositionReader = eval('(function () {\n' + file.readTextSync('weather-position.js') + '\nreturn createWeatherPositionReader;})()');
                return createWeatherPositionReader({nativeFallback: false, diagnostics: settings.weather_diagnostics === true});
            },
            now: () => Date.now(), sleep: ms => sleep(ms),
            keyDown: key => keyDown(key), keyUp: key => keyUp(key),
            tap: key => keyPress(key),
            orientation: () => Number(genshin.getCameraOrientation()),
            mainUI: isInMainUI,
            turn: (x, y) => moveMouseBy(x, y),
            teleport: (x, y) => genshin.tp(x, y, 'Teyvat', false),
            info: message => log.info(message), warn: message => log.warn(message)
        });
    }
    return {createBgi, createRunner, select, bearing, turnDelta};
})();
