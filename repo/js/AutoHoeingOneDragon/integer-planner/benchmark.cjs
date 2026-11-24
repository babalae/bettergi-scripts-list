// Emits reproducible numeric inputs from checked-in routes; reads no user history.
const crypto = require('node:crypto');
const { createHarness, totals } = require('./harness.cjs');

(async () => {
    const api = createHarness();
    const source = (await api.getHtmlRouteCache()).sort((a, b) => a.fullPath.localeCompare(b.fullPath, 'en'));
    const routes = source.map(route => api.htmlRouteClone(route, null, { curiosityFactor: 0, ignoreRate: -1 }));
    await api.markPathings(routes, [], ['蕈兽', '传奇', '狭窄地形']);
    const candidates = routes.filter(p => p.available);
    const cases = [];
    for (const [name, size, eliteLimit, normalTarget] of [
        ['official-small', 128, 100, 300],
        ['official-medium', 256, 200, 400],
        ['official-full', candidates.length, 400, 2000],
        ['official-infeasible', 256, 200, 800]
    ]) {
        const rows = candidates.slice(0, size);
        const times = [];
        let selected;
        for (let run = 0; run < 8; run++) {
            const copy = structuredClone(rows);
            const started = performance.now();
            await api.findBestRouteGroups(copy, 0.25, eliteLimit + 5, normalTarget + 25, false);
            const elapsed = performance.now() - started;
            if (run) times.push(elapsed); // discard the first JS warm-up
            selected = copy.filter(p => p.selected);
        }
        const input = { version: 1, requestId: name, eliteLimit, normalTarget,
            routes: rows.map((p, id) => ({ id, e: p.original_e, m: p.m,
                mora: p.mora_e + p.mora_m, t: p.t, required: false })) };
        cases.push({ name, input, inputSha256: crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex'),
            legacyMs: times, legacy: totals(selected) });
    }
    console.log(JSON.stringify({ node: process.version, sourceRoutes: routes.length,
        availableRoutes: candidates.length, history: 'none; checked-in description times', cases }));
})().catch(error => { console.error(error); process.exitCode = 1; });
