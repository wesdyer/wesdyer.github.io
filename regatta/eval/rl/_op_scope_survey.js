// The orbit-phase ease's missing scope: per rounding mark, the features that
// might separate canyon hairpins (ease wins: m3 14→4%) from lake/ocean
// confined marks (ease grinds/taxes). Reports orbitTightR, first wall radius
// (90..300 scan), reqSweep, zone, _gyOK, and wind at the mark.
//   node _op_scope_survey.js <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeBP2');
const VENUE = process.argv[3] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(v => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async () => {
        window.evalHarness.seed = 9400;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const dt = 1 / 60;
        for (let it = 0; it < 60 * 60; it++) window.update(dt);   // 60s: fields built
        const g = state.course.botGrid;
        const out = [];
        for (let i = 0; i < state.course.route.length; i++) {
            const e = state.course.route[i];
            if (!e || e.kind !== 'round' || !e.mark) continue;
            const m = e.mark;
            const orb = (typeof orbitTightR === 'function') ? orbitTightR(m) : 'n/a';
            let wallR = null;
            outer:
            for (let R = 90; R <= 300; R += 15) {
                for (let k = 0; k < 32; k++) {
                    const a = k / 32 * Math.PI * 2;
                    const c = g.cell(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
                    if (!g.at(c[0], c[1])) { wallR = R; break outer; }
                }
            }
            let gy = m._gyOK;
            if (gy === undefined) {
                const zR = m.zone || 165; gy = true;
                for (let k = 0; k < 32; k++) {
                    const a = k / 32 * Math.PI * 2;
                    const c = g.cell(m.x + Math.cos(a) * zR, m.y + Math.sin(a) * zR);
                    if (!g.at(c[0], c[1])) { gy = false; break; }
                }
            }
            const w = getWindAt(m.x, m.y);
            out.push({ leg: i, id: e.markId, orbitTightR: orb, wallR,
                reqSweep: m.reqSweep != null ? Math.round(m.reqSweep * 180 / Math.PI) : null,
                zone: Math.round(m.zone || 165), gyOK: gy, windKt: +w.speed.toFixed(1) });
        }
        return out;
    });
    console.log(VENUE, JSON.stringify(r, null, 1));
    await browser.close();
})();
