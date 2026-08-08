// CAP anatomy — the clearance-capped probe raises redrock mark contacts +45%
// in every variant (funnel and armed-arc exclusions included), so the rise is
// presumed downstream traffic, not probe blindness. Verify: for every mark
// contact, WHICH mark, what leg, how many rivals inside the zone at contact,
// the boat's speed, and whether a rounding was armed. Run on baseline and
// candidate trees and diff the anatomy.
//   node _rr_markhits.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4H');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = { byMark: {}, byLeg: {}, crowd: [], kt: [], armed: 0, n: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = { byMark: {}, byLeg: {}, crowd: [], kt: [], armed: 0, n: 0 };
            const lastT = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_mark' && d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished) {
                        const b = d.boat, t = state.race.timer;
                        const k0 = b.name;
                        if (lastT[k0] == null || t - lastT[k0] >= 0.5) {
                            lastT[k0] = t;
                            let mk = null, md = 1e9;
                            for (let mi = 0; mi < (state.course.marks || []).length; mi++) {
                                const m = state.course.marks[mi];
                                const dd = Math.hypot(m.x - b.x, m.y - b.y);
                                if (dd < md) { md = dd; mk = mi; }
                            }
                            out.byMark[mk] = (out.byMark[mk] || 0) + 1;
                            out.byLeg[b.raceState.leg] = (out.byLeg[b.raceState.leg] || 0) + 1;
                            let nz = 0;
                            const m = state.course.marks[mk];
                            for (const o of bots) if (o !== b && !o.raceState.finished
                                && Math.hypot(o.x - m.x, o.y - m.y) < 250) nz++;
                            out.crowd.push(nz);
                            out.kt.push(+(b.speed * 4).toFixed(1));
                            if (b.raceState.roundArmed || (b.raceState.roundSweep || 0) !== 0) out.armed++;
                            out.n++;
                        }
                    }
                } catch (e) { }
                if (inner) inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                if (bots.every(b => b.raceState.finished)) break;
            }
            return out;
        }, seed);
        for (const [k, v] of Object.entries(r.byMark)) agg.byMark[k] = (agg.byMark[k] || 0) + v;
        for (const [k, v] of Object.entries(r.byLeg)) agg.byLeg[k] = (agg.byLeg[k] || 0) + v;
        agg.crowd.push(...r.crowd); agg.kt.push(...r.kt); agg.armed += r.armed; agg.n += r.n;
        console.log('seed', seed, 'markHits', r.n);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log('\nmark-contact episodes', agg.n, ' armed-share', (100 * agg.armed / Math.max(1, agg.n)).toFixed(0) + '%');
    console.log('by mark idx:', JSON.stringify(agg.byMark), ' by leg:', JSON.stringify(agg.byLeg));
    console.log('rivals-in-zone at contact: med', med(agg.crowd), ' 0-rival share',
        (100 * agg.crowd.filter(c => c === 0).length / Math.max(1, agg.crowd.length)).toFixed(0) + '%');
    console.log('speed at contact med', med(agg.kt), 'kt');
    await browser.close();
})();
