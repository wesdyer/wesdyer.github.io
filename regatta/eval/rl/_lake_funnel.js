// P2 measurement — lake mark-3 funnel INTERIOR. Half of all lake groundings
// happen inside the 250u funnel radius where metering never acts (a queue,
// not a stuck state). This records, for every bot pass through the funnel:
//   - grounders: berth at grounding (dist/bearing-from-mark), what was around
//     (parked boats, nearest rival, overlap/right-of-way), avoidance state,
//     speed history (parked vs pushed), wind side (lee-shore sector or not)
//   - survivors: closest-approach berth through the same funnel, for contrast
//   node _lake_funnel.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treePH0');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            // which mark ends leg 2? (the funnel mark)
            const mk = legTargetPoint(2);
            if (!mk) return { err: 'no leg-2 mark' };
            const R = 600;
            const spdHist = {};   // name -> ring buffer of [t, kt]
            const inFun = {};     // name -> current funnel pass record
            const passes = []; const grounds = [];
            let totalHits = 0, pocketHits = 0;
            const lastHit = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe
                        && state.race.status === 'racing' && !d.boat.raceState.finished) {
                        const b = d.boat, t = state.race.timer;
                        totalHits++;
                        const dM = Math.hypot(b.x - mk.x, b.y - mk.y);
                        if (dM > R) return inner && inner(ty, d);
                        pocketHits++;
                        if (inFun[b.name]) inFun[b.name].hits = (inFun[b.name].hits || 0) + 1;
                        if (lastHit[b.name] != null && t - lastHit[b.name] < 3) return inner && inner(ty, d);
                        lastHit[b.name] = t;
                        const c = b.controller || {};
                        const w = getWindAt(b.x, b.y);
                        // bearing FROM mark (which sector of the funnel)
                        const brg = Math.atan2(b.x - mk.x, -(b.y - mk.y));
                        // downwind sector = the lee shore side: bearing aligned with wind vector
                        const leeAlign = Math.cos(norm(brg - w.direction)); // 1 = dead-downwind of mark
                        // neighbours
                        let n100 = 0, n250 = 0, parked100 = 0, nearest = null, nd = 1e9;
                        for (const b2 of state.boats) {
                            if (b2 === b || b2.isPlayer || b2.raceState.finished) continue;
                            const dd = Math.hypot(b2.x - b.x, b2.y - b.y);
                            if (dd < 100) { n100++; if (b2.speed * 4 < 0.5) parked100++; }
                            if (dd < 250) n250++;
                            if (dd < nd) { nd = dd; nearest = b2; }
                        }
                        let row = null, ovl = null;
                        if (nearest && nd < 150 && window.Rules) {
                            try {
                                ovl = window.Rules.isOverlapped ? !!window.Rules.isOverlapped(b, nearest) : null;
                                const r2 = window.Rules.getRightOfWay ? window.Rules.getRightOfWay(b, nearest) : null;
                                row = r2 === b ? 'row' : (r2 === nearest ? 'giveway' : String(r2));
                            } catch (e) {}
                        }
                        // speed history: parked (was <0.5kt for last 8s) or moving-then-pushed
                        const h = spdHist[b.name] || [];
                        const recent = h.filter(([tt]) => t - tt <= 8);
                        const parkedFor = recent.length && recent.every(([, kt]) => kt < 0.5);
                        const maxRecent = recent.length ? Math.max(...recent.map(([, kt]) => kt)) : null;
                        grounds.push({
                            seed, name: b.name, t: +t.toFixed(1), leg: b.raceState.leg,
                            x: +b.x.toFixed(0), y: +b.y.toFixed(0), wkt: +w.speed.toFixed(1),
                            dMark: +dM.toFixed(0), brgDeg: +(brg * 180 / Math.PI).toFixed(0),
                            leeAlign: +leeAlign.toFixed(2),
                            kt: +(b.speed * 4).toFixed(2), parkedFor, maxRecent8s: maxRecent,
                            n100, n250, parked100, nearestD: +nd.toFixed(0),
                            nearestBrg: nearest ? +(norm(Math.atan2(nearest.x - b.x, -(nearest.y - b.y)) - Math.atan2(mk.x - b.x, -(mk.y - b.y))) * 180 / Math.PI).toFixed(0) : null,
                            ovl, row,
                            av: (c.lastAvoidDeviation || 0) * 180 / Math.PI > 2 ? 1 : 0,
                            avDeg: +((c.lastAvoidDeviation || 0) * 180 / Math.PI).toFixed(1),
                            live: c.livenessState || '?',
                        });
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                if (it % 30 === 0) {
                    for (const b of bots) {
                        if (b.raceState.finished) continue;
                        const kt = b.speed * 4;
                        (spdHist[b.name] = spdHist[b.name] || []).push([t, kt]);
                        if (spdHist[b.name].length > 40) spdHist[b.name].shift();
                        const dM = Math.hypot(b.x - mk.x, b.y - mk.y);
                        if (dM < R && !inFun[b.name]) {
                            const brgIn = Math.atan2(b.x - mk.x, -(b.y - mk.y)) * 180 / Math.PI;
                            inFun[b.name] = { seed, name: b.name, tIn: t, legIn: b.raceState.leg, minD: dM, minKt: kt, maxN100: 0,
                                              xIn: +b.x.toFixed(0), yIn: +b.y.toFixed(0), brgIn: +brgIn.toFixed(0), hits: 0 };
                        }
                        if (inFun[b.name]) {
                            const f = inFun[b.name];
                            if (dM < f.minD) f.minD = +dM.toFixed(0);
                            if (kt < f.minKt) f.minKt = +kt.toFixed(2);
                            let n100 = 0;
                            for (const b2 of state.boats) {
                                if (b2 === b || b2.isPlayer || b2.raceState.finished) continue;
                                if (Math.hypot(b2.x - b.x, b2.y - b.y) < 100) n100++;
                            }
                            if (n100 > f.maxN100) f.maxN100 = n100;
                            if (dM > R * 1.2) { f.tOut = t; f.dur = +(t - f.tIn).toFixed(1); passes.push(f); delete inFun[b.name]; }
                        }
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return { seed, grounds, passes, totalHits, pocketHits };
        }, seed);
        if (r.err) { console.log('ERR', r.err); break; }
        all.push(r);
        console.log(`seed ${seed}: funnel passes ${r.passes.length} groundings-in-funnel ${r.grounds.length}`);
    }
    fs.writeFileSync(path.join(__dirname, 'lake_funnel.json'), JSON.stringify(all));
    const g = [].concat(...all.map(r => r.grounds));
    const p = [].concat(...all.map(r => r.passes));
    const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '-';
    const tH = all.reduce((a, r) => a + r.totalHits, 0), pH = all.reduce((a, r) => a + r.pocketHits, 0);
    console.log(`\nraw hit frames: total ${tH}, in 600u pocket ${pH} (${pct(pH, tH)})`);
    console.log(`GROUNDING EPISODES in pocket: ${g.length}  (passes ${p.length}, grounding rate ${pct(g.length, p.length)})`);
    console.log('wind at grounding: med', med(g.map(e => e.wkt)), 'kt');
    const cl = {};
    for (const e of g) { const k = (Math.round(e.x / 200) * 200) + ',' + (Math.round(e.y / 200) * 200); cl[k] = (cl[k] || 0) + 1; }
    console.log('episode clusters (200u bins):', JSON.stringify(Object.fromEntries(Object.entries(cl).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]))));
    console.log('by leg:', JSON.stringify(g.reduce((a, e) => (a[e.leg] = (a[e.leg] || 0) + 1, a), {})));
    console.log('dMark med', med(g.map(e => e.dMark)), ' leeAlign med', med(g.map(e => e.leeAlign)), ' (1=dead downwind of mark)');
    console.log('kt at grounding med', med(g.map(e => e.kt)), ' parkedFor8s:', pct(g.filter(e => e.parkedFor).length, g.length), ' maxRecent8s med', med(g.map(e => e.maxRecent8s ?? 99)));
    console.log('crowding: n100 med', med(g.map(e => e.n100)), ' parked100 med', med(g.map(e => e.parked100)), ' n250 med', med(g.map(e => e.n250)));
    console.log('nearest rival: dist med', med(g.map(e => e.nearestD)), ' overlap:', pct(g.filter(e => e.ovl).length, g.filter(e => e.ovl != null).length), ' has-ROW:', pct(g.filter(e => e.row === 'row').length, g.filter(e => e.row).length));
    console.log('avoidance active:', pct(g.filter(e => e.av).length, g.length), ' avDeg med', med(g.map(e => e.avDeg)));
    console.log('liveness:', JSON.stringify(g.reduce((a, e) => (a[e.live] = (a[e.live] || 0) + 1, a), {})));
    const surv = p.filter(x => x.legIn === 2 && !x.hits);
    const dirty = p.filter(x => x.legIn === 2 && x.hits);
    console.log(`\nCLEAN passes (leg 2): ${surv.length}  minD med ${med(surv.map(x => x.minD))}  minKt med ${med(surv.map(x => x.minKt))}  maxN100 med ${med(surv.map(x => x.maxN100))}`);
    console.log(`DIRTY passes (leg 2): ${dirty.length}  minD med ${med(dirty.map(x => x.minD))}  minKt med ${med(dirty.map(x => x.minKt))}  maxN100 med ${med(dirty.map(x => x.maxN100))}`);
    const binB = (arr) => { const h = {}; for (const e of arr) { const b = Math.round(e.brgIn / 45) * 45; h[b] = (h[b] || 0) + 1; } return h; };
    console.log('entry bearing-from-mark (45deg bins) CLEAN:', JSON.stringify(binB(surv)));
    console.log('entry bearing-from-mark (45deg bins) DIRTY:', JSON.stringify(binB(dirty)));
    const binT = (arr) => { const h = {}; for (const e of arr) { const b = Math.min(9, Math.floor(e.tIn / 60)); h[b] = (h[b] || 0) + 1; } return h; };
    console.log('entry minute CLEAN:', JSON.stringify(binT(surv)), ' DIRTY:', JSON.stringify(binT(dirty)));
    await browser.close();
})();
