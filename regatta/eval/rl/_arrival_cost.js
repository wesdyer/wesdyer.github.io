// THE COST OF ARRIVING INTO AN OCCUPIED ZONE (2026-08-08 — the arrival layer's
// budget). Three measurements this session named the fleet-pile class (granite
// ring 57s/boat, redrock post-m1 74% of the worst leg's slow time, the duck
// verdict's physically-blocked escapes). Before the next push builds an
// arrival layer, price the pile: for every boat's zone passage, record HOW MANY
// boats were already inside the zone when it entered, and its transit time.
// The slope of transit(occupancy) is the seconds each spread-out arrival buys —
// the design budget, and the success metric for any arrival candidate.
//   node _arrival_cost.js <venue> <zoneX> <zoneY> <radius> <trials> <seed0> <tree>
//   e.g. arctic granite ring:  node _arrival_cost.js arctic 138 -3095 600 3 9100 treeHD9
//        redrock m1 exit:      node _arrival_cost.js redrock 876 185 500 3 9400 treeHD9
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const ZX = parseFloat(process.argv[3]), ZY = parseFloat(process.argv[4]);
const ZR = parseFloat(process.argv[5]) || 600;
const TRIALS = parseInt(process.argv[6]) || 3;
const SEED0 = parseInt(process.argv[7]) || 9100;
const ROOT = path.join(__dirname, process.argv[8] || 'treeHD9');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ({ seed, ZX, ZY, ZR }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const bots = state.boats.filter(b => !b.isPlayer);
            // ⚠️ PROBE AUDIT (rule 18, v2): v1 counted each contiguous stay as a
            // passage — a parked boat oscillating at the rim generated ~9
            // "transits" per race and chopped its parked time across occupancy
            // bins, flattening the curve into noise. The honest unit is ONE
            // passage per boat per rounding: FIRST entry (on the approach leg)
            // to the LEG FLIP, occupancy read once at that first entry.
            const st = new Map();
            for (const b of bots) st.set(b, { enterT: null, occAtEntry: 0, leg0: null, done: false });
            const out = [];
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                let occ = 0;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    if (Math.hypot(b.x - ZX, b.y - ZY) < ZR) occ++;
                }
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const s = st.get(b);
                    if (s.done) continue;
                    const inside = Math.hypot(b.x - ZX, b.y - ZY) < ZR;
                    if (s.enterT == null && inside) {
                        s.enterT = t; s.occAtEntry = occ - 1; s.leg0 = b.raceState.leg;
                    } else if (s.enterT != null && b.raceState.leg > s.leg0) {
                        s.done = true;
                        out.push({ name: b.name, occ: s.occAtEntry, dur: +(t - s.enterT).toFixed(1) });
                    }
                }
            }
            return out;
        }, { seed, ZX, ZY, ZR });
        console.log('seed', seed, r.length, 'passages');
        rows.push(...r);
    }
    const byOcc = {};
    for (const p of rows) {
        const k = Math.min(p.occ, 6);
        (byOcc[k] = byOcc[k] || []).push(p.dur);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log(`\nTRANSIT TIME vs OCCUPANCY AT ENTRY (${VENUE} zone ${ZX},${ZY} r${ZR}; ${rows.length} passages)`);
    for (const k of Object.keys(byOcc).sort((a, b) => a - b)) {
        const v = byOcc[k];
        console.log(`  ${k}${k === '6' ? '+' : ' '} boats already in: transit med ${med(v).toFixed(1).padStart(6)}s  mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1).padStart(6)}s  (n=${v.length})`);
    }
    console.log('  READ: the slope is the arrival layer\'s budget — seconds bought per boat of spacing.');
    await browser.close();
})();
