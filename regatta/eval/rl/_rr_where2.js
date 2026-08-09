// REDROCK ATTRIBUTION ON HEAD (owner order: redrock after arctic).
// 2.18x, med 494 vs human ~227, land 131 contacts/boat, 8% DNF — no named
// class. Decompose per bot: slow time (<2.7kt) by site (nearest mark within
// 600u, else shore-adjacent via grid clearance <3 cells, else open), per-leg
// time meds, land-contact episodes by site. Human legs (s2 lap): 39.9/64.7/
// 51.3/29.6/26.1.  node _rr_where2.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeSWT');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = { slow: {}, legT: {}, landEp: {}, fins: [], dnf: 0, boats: 0, odo: 0, slowTot: 0, raceT: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const marks = state.course.marks;
            const g = state.course.botGrid;
            if (g && !g._clear && window.SailCheck) g._clear = window.SailCheck.clearanceField(g);
            const site = (x, y) => {
                let best = -1, bd = 600;
                for (let m = 0; m < marks.length; m++) {
                    const d = Math.hypot(x - marks[m].x, y - marks[m].y);
                    if (d < bd) { bd = d; best = m; }
                }
                if (best >= 0) return 'm' + best;
                if (g && g._clear) {
                    const cc = g.cell(x, y);
                    const id = cc[1] * g.n + cc[0];
                    if (g._clear[id] >= 0 && g._clear[id] < 3) return 'shore';
                }
                return 'open';
            };
            const slow = {}, landEp = {}, lastLand = {};
            const legT = {}, legStart = {};
            const inner = window.onRaceEvent;
            const mono = () => state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe) {
                        const t = mono(), k = d.boat.name;
                        if (lastLand[k] == null || t - lastLand[k] >= 2.0) {
                            lastLand[k] = t;
                            const s = site(d.boat.x, d.boat.y);
                            landEp[s] = (landEp[s] || 0) + 1;
                        } else lastLand[k] = t;
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            let slowTot = 0, odo = 0;
            const prev = {};
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0) {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished) continue;
                        const lg = b.raceState.leg;
                        if (legStart[b.name + ':' + lg] == null) legStart[b.name + ':' + lg] = state.race.timer;
                        if (prev[b.name]) odo += Math.hypot(b.x - prev[b.name][0], b.y - prev[b.name][1]);
                        prev[b.name] = [b.x, b.y];
                        if (state.race.status === 'racing' && b.speed * 60 < 40) {
                            slowTot += 0.1;
                            const s = site(b.x, b.y);
                            const key = 'L' + lg + ':' + s;
                            slow[key] = (slow[key] || 0) + 0.1;
                        }
                    }
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            const legs = {};
            for (const [k, t0] of Object.entries(legStart)) {
                const [n, lg] = k.split(':');
                const t1 = legStart[n + ':' + (+lg + 1)];
                if (t1 != null) { (legs[lg] = legs[lg] || []).push(t1 - t0); }
            }
            const fins = state.boats.filter(b => !b.isPlayer && b.raceState.finishTime).map(b => b.raceState.finishTime);
            return { slow, landEp, legs, fins, n: state.boats.length - 1, slowTot, odo };
        }, seed);
        for (const [k, v] of Object.entries(r.slow)) agg.slow[k] = (agg.slow[k] || 0) + v;
        for (const [k, v] of Object.entries(r.landEp)) agg.landEp[k] = (agg.landEp[k] || 0) + v;
        for (const [lg, arr] of Object.entries(r.legs)) (agg.legT[lg] = agg.legT[lg] || []).push(...arr);
        agg.fins.push(...r.fins); agg.dnf += r.n - r.fins.length; agg.boats += r.n;
        agg.slowTot += r.slowTot; agg.odo += r.odo;
        console.log('seed', seed, 'fins', r.fins.length + '/' + r.n, 'slowTot', r.slowTot.toFixed(0) + 's');
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    console.log(`\nboats ${agg.boats} fins ${agg.fins.length} (dnf ${agg.dnf}) fin med ${med(agg.fins)}`);
    console.log(`slow s/boat: ${(agg.slowTot / agg.boats).toFixed(1)}   odo/boat: ${(agg.odo / agg.boats).toFixed(0)}u`);
    console.log('leg time meds (human s2: L1 39.9 L2 64.7 L3 51.3 L4 29.6 L5 26.1):');
    for (const lg of Object.keys(agg.legT).sort()) console.log(`  L${lg}: med ${med(agg.legT[lg]).toFixed(1)}s  n ${agg.legT[lg].length}`);
    console.log('slow-time by site (top 12, s/boat):');
    const rows = Object.entries(agg.slow).sort((a, b) => b[1] - a[1]).slice(0, 12);
    for (const [k, v] of rows) console.log(`  ${k}: ${(v / agg.boats).toFixed(1)}`);
    console.log('land episodes by site:', JSON.stringify(agg.landEp));
    await browser.close();
})();
