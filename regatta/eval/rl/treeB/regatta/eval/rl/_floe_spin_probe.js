// Iceberg-spin contact attribution (owner question 2026-08-03d: cap floe
// rotational speed?). Recommendation on the table is an EDGE-speed cap
// (ω ≤ min(0.75, ~30/r)) because collision spin-up runs to the flat ±0.75
// clampSpin regardless of size while every AI predictor is translation-only.
// This probe sizes the AI benefit honestly BEFORE any physics change: per
// floe-contact episode (0.5s dedup per boat), it records the contacting
// floe's edge speed at the hull (|spinRate| * contact radius), drift speed,
// radius, and the boat's own speed — plus a population census of |ω|·r at
// t=120/300 each race. If rotation-dominated hits are rare, the cap is pure
// venue feel; if they are a real share of the grind, the cap has AI value.
// Read-only: samples at frame boundaries, race is byte-identical.
//   node _floe_spin_probe.js <trials> <seed0> [tree] [label]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeB');
const LABEL = process.argv[5] || null;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const contacts = [], census = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            const hits = [];      // one row per dedup'd floe-contact episode
            const pop = [];       // floe population census rows
            const lastHit = {};   // boat name -> timer of last counted floe hit
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_island' && d && d.isFloe && d.boat && !d.boat.isPlayer
                        && state.race.status === 'racing') {
                        const b = d.boat, t = state.race.timer;
                        if (lastHit[b.name] == null || t - lastHit[b.name] >= 0.5) {
                            lastHit[b.name] = t;
                            // The event doesn't carry the island: take the nearest floe
                            // whose bounding circle reaches the hull (the collider that
                            // fired is within radius+50 by construction).
                            let best = null, bestD = Infinity;
                            for (const isl of state.course.islands) {
                                if (!isl.isFloe) continue;
                                const dd = Math.hypot(b.x - isl.x, b.y - isl.y);
                                if (dd < isl.radius + 60 && dd < bestD) { bestD = dd; best = isl; }
                            }
                            if (best) {
                                hits.push({
                                    t: Math.round(t), r: Math.round(best.radius),
                                    cr: Math.round(bestD),
                                    edge: Math.round(Math.abs(best.spinRate || 0) * bestD * 10) / 10,
                                    spin: Math.round(Math.abs(best.spinRate || 0) * 100) / 100,
                                    drift: Math.round(Math.hypot(best.driftVx || 0, best.driftVy || 0) * 10) / 10,
                                    bspd: Math.round(b.speed * 22.5 * 10) / 10 // world u/s (speed*22.5 px/s? keep raw too)
                                    , braw: Math.round(b.speed * 100) / 100
                                });
                            }
                        }
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                const t = state.race.timer;
                if ((Math.abs(t - 120) < dt / 2) || (Math.abs(t - 300) < dt / 2)) {
                    for (const isl of state.course.islands) {
                        if (!isl.isFloe) continue;
                        pop.push({ t: Math.round(t), r: Math.round(isl.radius),
                            spin: Math.round(Math.abs(isl.spinRate || 0) * 100) / 100,
                            edge: Math.round(Math.abs(isl.spinRate || 0) * isl.radius * 10) / 10,
                            drift: Math.round(Math.hypot(isl.driftVx || 0, isl.driftVy || 0) * 10) / 10 });
                    }
                }
            }
            return { hits, pop };
        }, seed);
        contacts.push(...r.hits.map(h => ({ seed, ...h })));
        census.push(...r.pop.map(p => ({ seed, ...p })));
        console.log(`seed ${seed}: ${r.hits.length} floe-contact episodes`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : NaN; };
    console.log(`\n=== FLOE CONTACTS (n=${contacts.length}, ${TRIALS} seeds, 0.5s dedup) ===`);
    const edges = contacts.map(c => c.edge);
    const boats = contacts.map(c => c.braw);
    console.log(`edge speed |w|*r at hull: med ${med(edges)} mean ${mean(edges).toFixed(1)} p90 ${pct(edges, 0.9)} max ${Math.max(...edges, 0)}`);
    console.log(`floe drift speed:         med ${med(contacts.map(c => c.drift))} p90 ${pct(contacts.map(c => c.drift), 0.9)}`);
    console.log(`boat speed (raw knots-ish units): med ${med(boats)}`);
    console.log(`contact radius: med ${med(contacts.map(c => c.cr))}  floe radius: med ${med(contacts.map(c => c.r))} p90 ${pct(contacts.map(c => c.r), 0.9)}`);
    for (const thr of [10, 30, 60, 100]) {
        const n = contacts.filter(c => c.edge > thr).length;
        console.log(`  contacts with edge > ${thr} u/s: ${n} (${(100 * n / Math.max(1, contacts.length)).toFixed(1)}%)`);
    }
    const bigR = contacts.filter(c => c.r >= 300);
    console.log(`big-berg (r>=300) contacts: ${bigR.length} (${(100 * bigR.length / Math.max(1, contacts.length)).toFixed(1)}%), edge med ${med(bigR.map(c => c.edge))} p90 ${pct(bigR.map(c => c.edge), 0.9)}`);
    console.log(`\n=== POPULATION CENSUS (t=120/300, n=${census.length} floe-samples) ===`);
    for (const band of [[0, 100], [100, 200], [200, 300], [300, 1e9]]) {
        const g = census.filter(p => p.r >= band[0] && p.r < band[1]);
        if (!g.length) continue;
        console.log(`  r ${band[0]}-${band[1] === 1e9 ? 'max' : band[1]}: n ${g.length}  |w| med ${med(g.map(p => p.spin))} p90 ${pct(g.map(p => p.spin), 0.9)}  edge med ${med(g.map(p => p.edge))} p90 ${pct(g.map(p => p.edge), 0.9)} max ${Math.max(...g.map(p => p.edge))}`);
    }
    if (LABEL) {
        fs.writeFileSync(path.join(__dirname, `floe_spin_${LABEL}.json`), JSON.stringify({ contacts, census }));
        console.log(`\nwrote floe_spin_${LABEL}.json`);
    }
    await browser.close();
})();
