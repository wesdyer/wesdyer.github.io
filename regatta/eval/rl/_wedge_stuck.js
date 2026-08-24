// WEDGE vs STUCK-DETECTOR OVERLAP (2026-08-23 night, H1b push Phase 1.2 —
// option-B sizing folded in). The armed wedge class (5.9 s/boat, dur med
// 3.9s, minClr med 21u, ALL leg-1) sits NEAR the stuck machinery's bars:
// lowSpeedTimer accrues only under accelBar (0.25 raw = 15 u/s) and the
// land-venue wiggle trigger is 3.0s. Wedge def is speed*60<20 — so a wedge
// may hover ABOVE the accrual bar and never bank stuck-time. Per wedge
// episode: time below accelBar, peak lowSpeedTimer, whether wiggle/escape
// fired DURING the episode, layer in the last 0.5s before recovery (what
// actually ended it). Fleet, __CHAR unset (rule 18b).
//   node _wedge_stuck.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 16;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeR1C');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const EPS = []; let NBOATS = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const dt = 1 / 60;
            const floes = () => state.course._floeObjs || [];
            const eps = [], open = new Map();
            const accelBar = (state.course._stuckAccelBar != null ? state.course._stuckAccelBar : 0.25) * 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                if (it % 6) continue;   // 10 Hz
                for (const b of bots) {
                    const rs = b.raceState;
                    if (rs.finished || rs.leg < 1 || !rs.roundArmed) {
                        const o = open.get(b); if (o && t - o.lastT > 1.0) { if (o.dur > 2) eps.push(o); open.delete(b); }
                        continue;
                    }
                    const c = b.controller; if (!c) continue;
                    let clr = Infinity;
                    for (const f of floes()) {
                        if (Math.hypot(b.x - f.x, b.y - f.y) > (f.radius || 0) + 400) continue;
                        const cH = floeHullClear(f, b.x, b.y, 0);
                        if (cH < clr) clr = cH;
                    }
                    const spd = (b.speed || 0) * 60;
                    const slow = spd < 20, near = clr < 60;
                    const layer = c.penaltySpin ? 'pen' : c.escActive ? 'esc'
                        : (c.iceEscapeTimer || 0) > 0 ? 'latch' : c.wiggleActive ? 'wig'
                            : Math.abs(c.lastAvoidDeviationSigned || 0) > 0.09 ? 'avoid' : 'nav';
                    const o = open.get(b);
                    if (slow && near) {
                        if (!o) {
                            open.set(b, { seed, t0: +t.toFixed(1), lastT: t, dur: 0.1,
                                belowBar: spd < accelBar ? 0.1 : 0,
                                lstPeak: c.lowSpeedTimer || 0,
                                wigFired: c.wiggleActive ? 1 : 0, escFired: c.escActive ? 1 : 0,
                                lastLayer: layer, minClr: Math.round(clr) });
                        } else {
                            o.dur += 0.1; o.lastT = t;
                            if (spd < accelBar) o.belowBar += 0.1;
                            if ((c.lowSpeedTimer || 0) > o.lstPeak) o.lstPeak = c.lowSpeedTimer || 0;
                            if (c.wiggleActive) o.wigFired = 1;
                            if (c.escActive) o.escFired = 1;
                            o.lastLayer = layer;
                            if (clr < o.minClr) o.minClr = Math.round(clr);
                        }
                    } else if (o) {
                        if (t - o.lastT > 1.0 || spd > 40 || clr > 90) {
                            o.grace = (o.grace || 0) + 0.1;
                            if (t - o.lastT > 1.0 || o.grace > 1.0) { if (o.dur > 2) eps.push(o); open.delete(b); }
                        }
                    }
                }
            }
            for (const o of open.values()) if (o.dur > 2) eps.push(o);
            return { eps, nBoats: bots.length };
        }, seed);
        EPS.push(...r.eps); NBOATS += r.nBoats;
        console.log(`seed ${seed}: ${r.eps.length} wedges (${r.eps.filter(e => e.wigFired).length} saw wiggle, ${r.eps.filter(e => e.escFired).length} escape)`);
    }
    await browser.close();
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    console.log(`\n=== WEDGE vs STUCK MACHINERY (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`${EPS.length} episodes, ${(EPS.reduce((a, e) => a + e.dur, 0) / NBOATS).toFixed(1)} s/boat`);
    console.log(`share of wedge time BELOW accelBar (stuck-accruing): ${(100 * EPS.reduce((a, e) => a + e.belowBar, 0) / EPS.reduce((a, e) => a + e.dur, 0)).toFixed(0)}%`);
    console.log(`lowSpeedTimer peak p25/med/p75: ${q(EPS.map(e => e.lstPeak), .25).toFixed(1)}/${q(EPS.map(e => e.lstPeak), .5).toFixed(1)}/${q(EPS.map(e => e.lstPeak), .75).toFixed(1)}s (wiggle trigger 3.0s)`);
    console.log(`wiggle fired during: ${(100 * EPS.filter(e => e.wigFired).length / EPS.length).toFixed(0)}%   escape fired: ${(100 * EPS.filter(e => e.escFired).length / EPS.length).toFixed(0)}%`);
    const end = {};
    for (const e of EPS) end[e.lastLayer] = (end[e.lastLayer] || 0) + 1;
    console.log(`layer at episode end (what ended it): ${Object.entries(end).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} (${(100 * v / EPS.length).toFixed(0)}%)`).join('  ')}`);
    const wig = EPS.filter(e => e.wigFired), noWig = EPS.filter(e => !e.wigFired);
    console.log(`dur med: with-wiggle ${q(wig.map(e => e.dur), .5).toFixed(1)}s  without ${q(noWig.map(e => e.dur), .5).toFixed(1)}s`);
    fs.writeFileSync(path.join(__dirname, `_wedge_stuck_${path.basename(ROOT)}_${SEED0}.json`), JSON.stringify(EPS, null, 1));
    console.log(`wrote _wedge_stuck_${path.basename(ROOT)}_${SEED0}.json`);
})();
