// T1 LAB INTROSPECTION (2026-08-23): what machinery does the NP-70u lab
// rung actually run on? After a burst on one seed, report: does the lab
// have botGrid / _tight cells; does boat A carry a gridPath / plan
// headings (hPlanFF is plan-scoped — without it the tight-tier trust
// never fires and every mouth approach walls); and the crab through the
// slot: heading vs COG vs slot axis while inside/near tight cells.
//   node regatta/eval/rl/_t1_lab_probe.js
const { chromium } = require('playwright');
const path = require('path');
const LAB_URL = 'file://' + path.resolve(__dirname, '../../scenario.html');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => console.error('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto(LAB_URL);
    await page.waitForFunction(() => window.__LAB && window.__LAB.ready && window.__LAB.testAPI, null, { timeout: 60000 });
    const out = await page.evaluate(() => {
        window.__LAB.testAPI.load('Narrow Passage 70u');
        // instrument: sample every frame during the burst via onRaceEvent? —
        // simpler: run one seed, then re-simulate while sampling per frame
        // using the recording (pose per frame is in the rec).
        const res = window.__LAB.testAPI.run();
        const g = state.course.botGrid;
        const rep = { grid: !!g, tight: 0, soft: !!(g && g._soft), res: g ? g.res : null, n: g ? g.n : null };
        if (g && g._tight) for (let i = 0; i < g._tight.length; i++) if (g._tight[i]) rep.tight++;
        // boat A internals after the last burst
        const A = state.boats.find(b => b._labLetter === 'A' || (b.name && b.name.startsWith('A')));
        const bots = state.boats.filter(b => b.controller && b.fadeTimer === 999);
        const bt = A || bots[0];
        rep.boat = bt ? {
            name: bt.name,
            gridPath: bt.controller && bt.controller.gridPath ? bt.controller.gridPath.length : null,
            dmc: bt.controller ? (bt.controller.dmcCarrotS != null) : null,
        } : null;
        // crab census from the watched seed's recording: frames where the
        // boat's cell (or 60u ahead) is tight
        const seed = Object.keys(window.__LAB.recs || {})[0];
        const rec = seed != null ? window.__LAB.recs[seed] : null;
        rep.recSeed = seed;
        rep.crab = [];
        if (rec && rec.frames && g && g._tight) {
            for (let fi = 0; fi < rec.frames.length; fi += 6) {
                const fr = rec.frames[fi];
                const bs = fr.boats || fr;
                for (const b of (Array.isArray(bs) ? bs : [])) {
                    if (b.x == null) continue;
                    const cc = g.cell(b.x, b.y);
                    const id = cc[1] * g.n + cc[0];
                    if (id < 0 || id >= g.n * g.n || !g._tight[id]) continue;
                    rep.crab.push({ t: fr.t, hdg: +(b.heading || b.hdg || 0).toFixed(2) });
                }
            }
        }
        rep.frameKeys = rec && rec.frames && rec.frames[0] ? Object.keys(rec.frames[0]).slice(0, 12) : null;
        rep.verdict = res && res.runs ? Object.keys(res.runs).length + ' seeds run' : 'no runs';
        return rep;
    });
    console.log(JSON.stringify(out, null, 1).slice(0, 2000));
    await browser.close();
})();
