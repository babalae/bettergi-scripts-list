const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness, root } = require('./harness.cjs');

function rows() {
    return [
        { fullPath: 'a', fileName: 'a', e: 1, original_e: 1, m: 1, mora_e: 100, mora_m: 0, t: 1 },
        { fullPath: 'b', fileName: 'b', e: 1, original_e: 1, m: 0, mora_e: 110, mora_m: 0, t: 1 },
        { fullPath: 'c', fileName: 'c', e: 0, original_e: 0, m: 1, mora_e: 0, mora_m: 1, t: 10 }
    ].map(p => ({ ...p, available: true, prioritized: false, tags: [] }));
}

function response(body, ids = [0]) {
    const request = JSON.parse(body);
    const chosen = request.routes.filter(r => ids.includes(r.id));
    const totals = chosen.reduce((s, r) => ({ e: s.e + r.e, m: s.m + r.m,
        mora: s.mora + r.mora, seconds: s.seconds + r.t }), { e: 0, m: 0, mora: 0, seconds: 0 });
    return { version: 1, requestId: request.requestId, status: 'optimal', selected: ids,
        totals, rate: totals.mora / totals.seconds, upperRate: totals.mora / totals.seconds };
}

function httpResult(result) { return { status_code: 200, body: JSON.stringify(result) }; }

test('default and string false make no HTTP call', async () => {
    for (const value of [undefined, false, 'false']) {
        const api = createHarness({ settings: { useIntegerPlanner: value } });
        await api.findBestRouteGroups(rows(), 0.25, 6, 26);
        assert.equal(api.logs.some(([_, s]) => s.includes('整数规划未采用')), false);
    }
});

test('HTML rendering and saving cannot turn string false into opt-in', async () => {
    const html = fs.readFileSync(path.join(root, 'assets/config.html'), 'utf8');
    const setFieldSource = html.match(/function setField\([^\n]+/)[0];
    const setField = vm.runInNewContext(`(${setFieldSource})`);
    for (const value of [undefined, false, 'false', true, 'true']) {
        const api = createHarness({ settings: { useIntegerPlanner: value } });
        const snapshot = api.htmlSettingSnapshot();
        const checkbox = { type: 'checkbox' };
        setField(checkbox, snapshot.useIntegerPlanner);
        const expected = value === true || value === 'true';
        assert.equal(checkbox.checked, expected);
        const saved = { ...snapshot, accountName: 'test', groupIndex: '路径组一', useIntegerPlanner: checkbox.checked };
        await api.applyHoeingHtmlConfig({ settings: saved }, { settings: snapshot });
        assert.equal(api.settings.useIntegerPlanner, expected);
        assert.equal(JSON.parse(api.writes.get('settings/test.json')).useIntegerPlanner, expected);
    }
});

test('adapter validates a result produced by the actual Python solver', async () => {
    const api = createHarness({ request: async (method, url, body, headers) => {
        assert.equal(method, 'POST');
        assert.equal(url, 'http://127.0.0.1:18766/auto-hoeing/solve');
        assert.equal(JSON.parse(headers)['X-BGI-Planner'], '1');
        const result = execFileSync(process.env.PYTHON || 'python', ['-X', 'utf8', '-c',
            'import json,sys,server; print(json.dumps(server.solve(json.load(sys.stdin))))'],
            { cwd: __dirname, input: body, encoding: 'utf8', windowsHide: true });
        return { status_code: 200, body: result };
    } });
    const result = await api.requestIntegerPlan(rows(), 1, 1);
    assert.equal(result.rate, 100);
    assert.deepEqual([...result.selected].map(p => p.fileName), ['a']);
});

test('failed, stale, malformed and infeasible responses preserve legacy selection', async () => {
    const baselineRows = rows();
    await createHarness().findBestRouteGroups(baselineRows, 0.25, 6, 26, false);
    const baseline = baselineRows.filter(p => p.selected).map(p => p.fileName);
    const failures = [
        () => { throw new Error('HTTP permission denied / service offline'); },
        () => ({ status_code: 500, body: '{}' }),
        () => ({ status_code: 200, body: 'not JSON' }),
        (_, __, body) => httpResult({ ...response(body), requestId: 'stale' }),
        (_, __, body) => httpResult({ ...response(body), status: 'incomplete' }),
        (_, __, body) => httpResult({ ...response(body), status: 'infeasible' }),
        (_, __, body) => httpResult({ ...response(body), selected: [0, 0] }),
        (_, __, body) => httpResult({ ...response(body), selected: [999] }),
        (_, __, body) => httpResult({ ...response(body), upperRate: 999 }),
        (_, __, body) => httpResult({ ...response(body), totals: {} })
    ];
    for (const request of failures) {
        const api = createHarness({ request });
        const copy = rows();
        await api.findBestRouteGroups(copy, 0.25, 6, 26, true);
        assert.deepEqual(copy.filter(p => p.selected).map(p => p.fileName), baseline);
        assert.ok(api.logs.some(([level, s]) => level === 'warn' && s.includes('回退原算法')));
    }
});

test('successful opt-in replaces the legacy set and reports unreserved totals', async () => {
    const api = createHarness({ request: async (_, __, body) => {
        const request = JSON.parse(body);
        return httpResult(response(body, [request.routes.find(r => r.e === 1 && r.m === 1).id]));
    } });
    const copy = rows();
    await api.findBestRouteGroups(copy, 0.25, 6, 26, true);
    assert.deepEqual(copy.filter(p => p.selected).map(p => p.fileName), ['a']);
    assert.equal(copy.find(p => p.selected).plannedEliteCount, 1);
    assert.ok(api.logs.some(([_, s]) => s === '总收益: 100 摩拉'));
    assert.ok(api.logs.some(([_, s]) => s.includes('已验证最优')));
});

test('timeout preserves legacy selection and a late response cannot mutate it', async () => {
    let finish;
    const api = createHarness({ request: () => new Promise(resolve => { finish = resolve; }), sleep: async () => {} });
    const copy = rows();
    await api.findBestRouteGroups(copy, 0.25, 6, 26, true);
    const before = JSON.stringify(copy);
    finish({ status_code: 200, body: '{}' });
    await Promise.resolve();
    assert.equal(JSON.stringify(copy), before);
    assert.ok(api.logs.some(([_, s]) => s.includes('超过 5 秒')));
});

test('actual elite counts, availability and required routes are enforced', async () => {
    let payload;
    const api = createHarness({ request: async (_, __, body) => {
        payload = JSON.parse(body);
        return httpResult(response(body));
    } });
    const copy = rows();
    copy[0].e = 0; // ignoreRate must not erase consumption of the elite cap
    copy[1].available = false;
    copy[2].prioritized = true;
    await assert.rejects(api.requestIntegerPlan(copy, 1, 1), /必选约束/);
    assert.equal(payload.routes[0].e, 1);
    assert.equal(payload.routes.length, 2);
    assert.equal(payload.routes[1].required, true);
    await assert.rejects(api.requestIntegerPlan(copy, 0, 1), /数量或必选约束/);
});

test('opt-in persists across account groups, old accounts default off, and zero cap stays zero', async () => {
    const api = createHarness({ settings: { useIntegerPlanner: true, targetEliteNum: 0, targetMonsterNum: 1 } });
    await api.loadConfig();
    assert.equal(JSON.parse(api.writes.get('settings/默认账户.json')).useIntegerPlanner, true);
    assert.equal(api.htmlSettingSnapshot().useIntegerPlanner, true);
    assert.equal(require('node:vm').runInContext('targetEliteNum', api.context), 5);
    api.settings.groupIndex = '路径组二';
    api.settings.useIntegerPlanner = false;
    await api.loadConfig();
    assert.equal(api.settings.useIntegerPlanner, true);
    api.writes.set('settings/默认账户.json', '{}');
    await api.loadConfig();
    assert.equal(api.settings.useIntegerPlanner, false);
});

test('zero elite cap failure restores the original zero-to-default target rule', async () => {
    const selected = [];
    let requestedCap;
    for (const enabled of [false, true]) {
        const api = createHarness({ settings: { useIntegerPlanner: enabled, targetEliteNum: 0, targetMonsterNum: 0 },
            request: async (_, __, body) => { requestedCap = JSON.parse(body).eliteLimit; throw new Error('offline'); } });
        await api.loadConfig();
        const [elite, normal] = vm.runInContext('[targetEliteNum, targetMonsterNum]', api.context);
        const copy = Array.from({ length: 500 }, (_, id) => ({ fileName: String(id), tags: [], available: true,
            e: 1, original_e: 1, m: 0, mora_e: 200, mora_m: 0, t: 10 }));
        await api.findBestRouteGroups(copy, 0.25, elite, normal);
        selected.push(copy.filter(p => p.selected).map(p => p.fileName));
    }
    assert.equal(requestedCap, 0);
    assert.equal(selected[0].length, 405);
    assert.deepEqual(selected[1], selected[0]);
});

test('HTML save includes the option and preview passes its unsaved value', async () => {
    let calls = 0;
    const api = createHarness({ request: () => { calls++; throw new Error('offline'); } });
    const values = { ...api.htmlSettingSnapshot(), groupIndex: '路径组一', accountName: 'test', useIntegerPlanner: true };
    await api.applyHoeingHtmlConfig({ settings: values }, { settings: values });
    assert.equal(JSON.parse(api.writes.get('settings/test.json')).useIntegerPlanner, true);
    api.settings.useIntegerPlanner = false;
    await api.buildHtmlRoutePreview({ settings: { ...values, targetEliteNum: 400, targetMonsterNum: 2000 } });
    assert.equal(calls, 1);
});
