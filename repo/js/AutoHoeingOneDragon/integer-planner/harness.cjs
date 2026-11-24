// Read-only test harness: omit image initialization and the game entry point.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const diskPath = name => path.join(root, ...String(name).split(/[\\/]/));

function createHarness(options = {}) {
    const source = options.source ?? fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const start = source.indexOf('const itemFullRo =');
    const end = source.indexOf('})();', start) + 5;
    if (start < 0 || end < start) throw new Error('Cannot locate game bootstrap');
    const logs = [], writes = new Map();
    const settings = { sortMode: '原文件顺序', groupIndex: '路径组一', ...options.settings };
    const context = {
        settings,
        log: Object.fromEntries(['info', 'warn', 'error'].map(level => [level, text => logs.push([level, text])])),
        sleep: options.sleep ?? (ms => ms === 5000 ? new Promise(() => {}) : Promise.resolve()),
        http: { request: options.request ?? (() => { throw new Error('Unexpected HTTP request'); }) },
        file: {
            readText: async name => writes.get(name) ?? fs.readFileSync(diskPath(name), 'utf8'),
            writeText: (name, value) => { writes.set(name, value); },
            ReadPathSync: name => fs.readdirSync(diskPath(name)).map(entry => `${name}\\${entry}`),
            IsFolder: name => fs.statSync(diskPath(name)).isDirectory()
        }
    };
    vm.createContext(context);
    vm.runInContext(source.slice(0, start) + source.slice(end) + `
        htmlPreviewMode = true;
        globalThis.api = { findBestRouteGroups,
            requestIntegerPlan: typeof requestIntegerPlan === 'function' ? requestIntegerPlan : undefined,
            integerPlannerEnabled: typeof integerPlannerEnabled === 'function' ? integerPlannerEnabled : undefined,
            loadConfig, htmlSettingSnapshot, applyHoeingHtmlConfig, getHtmlRouteCache,
            htmlRouteClone, markPathings, buildHtmlRoutePreview, validateHoeingHtmlConfig };
    `, context);
    return { ...context.api, settings, logs, writes, context };
}

function totals(rows) {
    const result = rows.reduce((sum, p) => ({
        e: sum.e + (p.original_e ?? p.e), m: sum.m + p.m,
        mora: sum.mora + p.mora_e + p.mora_m, seconds: sum.seconds + p.t
    }), { e: 0, m: 0, mora: 0, seconds: 0 });
    return { ...result, rate: result.seconds ? result.mora / result.seconds : 0, routes: rows.length };
}

module.exports = { createHarness, totals, root };
