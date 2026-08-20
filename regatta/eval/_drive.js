// SHARED SCENARIO DRIVER — the lab page IS the fixture. Both runners
// (run_scenario.js, run_scenarios.js) boot scenario.html and drive it
// through LAB.testAPI, so the page and the CLI share one engine, one
// recording format, one evaluator and one metrics computation.
//
// Isolation note: browser.newPage() gives each call its OWN context —
// fresh localStorage, so no draft or mirror leaks between scenarios.
const path = require('path');

const LAB_URL = 'file://' + path.resolve(__dirname, '../scenario.html');

async function newLabPage(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => console.error('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto(LAB_URL);
    await page.waitForFunction(() => window.__LAB && window.__LAB.ready && window.__LAB.testAPI,
        null, { timeout: 60000 });
    return page;
}

// the COMMITTED library's names (fresh context = empty localStorage mirror)
async function listScenarios(page) {
    return page.evaluate(() => Object.keys(window.SCENARIO_DOC || {}));
}

// run one scenario's whole seed set, then the DETERMINISM TRIPWIRE: the
// set again from a cold cache — any state leak turns a silent flake into
// a loud failure.
async function driveScenario(page, name) {
    const loaded = await page.evaluate((n) => {
        try { window.__LAB.testAPI.load(n); return { ok: true }; }
        catch (e) { return { ok: false, err: String(e.message || e) }; }
    }, name);
    if (!loaded.ok) return { ok: false, err: loaded.err };
    const t0 = Date.now();
    const out = await page.evaluate(() => window.__LAB.testAPI.run());
    const sig2 = await page.evaluate(() => {
        window.__LAB.recs = {};
        return JSON.stringify(window.__LAB.testAPI.run().runs);
    });
    return { ok: true, out, ms: Date.now() - t0,
             deterministic: JSON.stringify(out.runs) === sig2 };
}

module.exports = { newLabPage, listScenarios, driveScenario };
