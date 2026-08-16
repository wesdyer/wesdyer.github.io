// THE NOTCH ENTRY — who steers a boat into island 8's capture basin?
// Sequence-replays a bench race and logs, at 4 Hz for every bot within 700u of
// the notch (4254,-3474): position, speed, heading, the controller's nav vs
// final desired heading (deflection), avoidance role/risk, nearest rival.
//   node _notch_entry.js <seed0> <targetSeed> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED0 = parseInt(process.argv[2]) || 9500;
const TARGET = parseInt(process.argv[3]) || 9501;
const ROOT = path.join(__dirname, process.argv[4] || 'treeR15U');
const VENUE = process.argv[5] || 'river';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    for (let s = SEED0; s < TARGET; s++) {
        await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 900) break;
            }
        }, s);
        console.log(`prefix ${s} done`);
    }
    const rows = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const TX = 4254, TY = -3474;
        const out = [];
        const seen = {}; // name -> entered basin (within 90u) once?
        for (let it = 0; it < 60 * 940; it++) {
            window.update(1 / 60);
            if (state.race.status === 'finished') break;
            const t = state.race.status === 'racing' ? state.race.timer : -state.race.timer;
            if (t > 900) break;
            if (state.race.status !== 'racing') continue;
            if (it % 15 !== 0) continue;
            for (const b of state.boats) {
                if (b.isPlayer || b.raceState.finished) continue;
                const d = Math.hypot(b.x - TX, b.y - TY);
                if (d > 700) continue;
                const c = b.controller;
                let rivD = 1e9, rivN = '';
                for (const o of state.boats) {
                    if (o === b || o.isPlayer || o.raceState.finished) continue;
                    const dd = Math.hypot(o.x - b.x, o.y - b.y);
                    if (dd < rivD) { rivD = dd; rivN = o.name; }
                }
                if (d < 90 && !seen[b.name]) { seen[b.name] = t; }
                out.push([+t.toFixed(1), b.name, Math.round(b.x), Math.round(b.y), Math.round(d),
                    Math.round(b.speed * 60),
                    +(b.heading).toFixed(2),
                    c ? (c.avoidanceRole || '-')[0] : '-',
                    c ? (c.riskState || '-')[0] : '-',
                    c ? +(c.lastAvoidDeviation || 0).toFixed(2) : 0,
                    Math.round(rivD), rivN,
                    c && c.wiggleActive ? 'W' : (c && c.escActive ? 'E' : (c && c.iceEscapeTimer > 0 ? 'L' : '-'))]);
            }
        }
        return { rows: out, captured: seen };
    }, TARGET);
    console.log('CAPTURED (first time within 90u):', JSON.stringify(rows.captured));
    for (const r of rows.rows) console.log(r.join(' '));
    await browser.close();
})();
