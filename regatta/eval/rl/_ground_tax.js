// THE GROUNDING TAX, IN SECONDS (2026-08-09 evening, after the A2 landing).
// A land contact is not a bookkeeping event: `collision_island` multiplies the
// boat's speed by 0.4 on the spot. Redrock's fleet takes ~110 dedup'd contacts
// per boat-race — one every four seconds — against the human's ~0, and the
// per-second contact RATE rises 2.7x from the fastest quartile to the slowest,
// so it is not merely an exposure artifact. A count still names nothing: this
// probe converts it to SECONDS.
//
// Method. At each contact, record the boat's speed just BEFORE the hit (the
// last sample at least 0.25s old, so the 0.4x multiply is not already in it),
// then follow the boat until it recovers to that speed (or RECOV seconds pass)
// and integrate the shortfall. distance-lost = sum((vPre - v(t)) * dt); the
// time that distance would have taken at vPre is the tax. Contacts that arrive
// while the boat is still recovering are folded into the open episode rather
// than double-counted — a boat grinding along a wall is ONE event, not thirty.
//
// ⚠️ This is an UPPER bound on the avoidable part: some of the shortfall is the
// turn the boat was making anyway, and a boat that never touched the rock might
// have sailed a longer line. It is the right order-of-magnitude question —
// "is this 5 seconds a boat or 50?" — not a landing gate.
//   node _ground_tax.js <venue> <trials> <seed0> <tree> [leg]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeA2');
const LEG = process.argv[6] != null ? parseInt(process.argv[6]) : null;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = []; const FINS = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed, LEG }) => {
            const RECOV = 12;           // seconds to follow a hit before giving up
            const hist = {}, open = {}, done = [];
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer
                    && !d.boat.raceState.finished && !d.isFloe && state.race.status === 'racing') {
                    const n = d.boat.name, now = state.race.timer;
                    if (open[n]) { open[n].hits++; open[n].last = now; }
                    else {
                        const h = hist[n] || [];
                        let vPre = 0;
                        for (let i = h.length - 1; i >= 0; i--) { if (now - h[i].t >= 0.25) { vPre = h[i].v; break; } }
                        open[n] = { boat: n, t0: now, last: now, vPre, hits: 1, lost: 0,
                                    leg: d.boat.raceState.leg, x: Math.round(d.boat.x), y: Math.round(d.boat.y) };
                    }
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            let prevT = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const now = state.race.timer, step = now - prevT; prevT = now;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const n = bo.name, v = (bo.speed || 0) * 60;
                    const h = hist[n] = hist[n] || [];
                    h.push({ t: now, v }); if (h.length > 90) h.shift();
                    const o = open[n];
                    if (!o) continue;
                    if (v < o.vPre) o.lost += (o.vPre - v) * step;
                    // close when recovered (and 0.5s clear of the last touch) or timed out
                    if ((v >= o.vPre && now - o.last > 0.5) || now - o.t0 > RECOV) {
                        o.dur = now - o.t0; done.push(o); delete open[n];
                    }
                }
            }
            for (const [n, o] of Object.entries(open)) { o.dur = RECOV; done.push(o); }
            const fins = {}; for (const bo of state.boats) if (!bo.isPlayer) fins[bo.name] = bo.raceState.finished ? bo.raceState.finishTime : null;
            return { done, fins, nBoats: state.boats.filter(x => !x.isPlayer).length };
        }, { seed: SEED0 + t, LEG });
        console.log(`seed ${SEED0 + t}: ${r.done.length} grounding episodes over ${r.nBoats} boats`);
        for (const e of r.done) { e.seed = SEED0 + t; all.push(e); }
        FINS.push({ seed: SEED0 + t, fins: r.fins });
    }
    await b.close();
    const q = (a, pr) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pr * (s.length - 1))] : NaN; };
    const use = LEG == null ? all : all.filter(e => e.leg === LEG);
    if (!use.length) { console.log('no episodes'); return; }
    const nBoatRaces = TRIALS * 9;
    // tax = distance lost / speed it would have been made at
    const tax = use.map(e => e.vPre > 5 ? e.lost / e.vPre : 0);
    const total = tax.reduce((a, x) => a + x, 0);
    console.log(`\n=== ${VENUE}${LEG == null ? '' : ' leg ' + LEG} — ${use.length} episodes over ~${nBoatRaces} boat-races (${ROOT.split('/').pop()}) ===`);
    console.log(`episodes/boat-race ${(use.length / nBoatRaces).toFixed(1)} | hits per episode med ${q(use.map(e => e.hits), .5)} p90 ${q(use.map(e => e.hits), .9)} max ${Math.max(...use.map(e => e.hits))}`);
    console.log(`speed before contact: med ${q(use.map(e => e.vPre), .5).toFixed(0)} u/s | episode duration med ${q(use.map(e => e.dur), .5).toFixed(1)}s p90 ${q(use.map(e => e.dur), .9).toFixed(1)}s`);
    console.log(`⭐ TAX: ${total.toFixed(0)}s over ${nBoatRaces} boat-races = ${(total / nBoatRaces).toFixed(1)} s/boat`);
    console.log(`   per episode: med ${q(tax, .5).toFixed(2)}s p75 ${q(tax, .75).toFixed(2)}s p90 ${q(tax, .9).toFixed(2)}s max ${Math.max(...tax).toFixed(1)}s`);
    const byLeg = {};
    for (let i = 0; i < use.length; i++) { const k = use[i].leg; (byLeg[k] = byLeg[k] || { n: 0, s: 0 }); byLeg[k].n++; byLeg[k].s += tax[i]; }
    console.log('\nleg   episodes   tax s/boat   share');
    for (const [k, v] of Object.entries(byLeg).sort((a, x) => x[1].s - a[1].s))
        console.log(`  ${k.padStart(2)}   ${String(v.n).padStart(6)}   ${(v.s / nBoatRaces).toFixed(1).padStart(8)}    ${(100 * v.s / total).toFixed(0)}%`);
    // where: cluster the worst episodes
    // ⭐ IS THE TAIL THE SAME PHENOMENON AS THE GROUNDING? Per-boat tax vs per-boat
    // finish time: if slow boats are simply boats that ground, one fix buys both.
    const perBoat = {};
    for (let i = 0; i < use.length; i++) { const k = use[i].seed + ':' + use[i].boat; perBoat[k] = (perBoat[k] || 0) + tax[i]; }
    const pairs = [];
    for (const f of FINS) for (const [n, fin] of Object.entries(f.fins)) {
        if (fin == null) continue;
        pairs.push({ tax: perBoat[f.seed + ':' + n] || 0, fin });
    }
    if (pairs.length > 3) {
        const mx = pairs.reduce((a, p) => a + p.tax, 0) / pairs.length, my = pairs.reduce((a, p) => a + p.fin, 0) / pairs.length;
        let sxy = 0, sxx = 0, syy = 0;
        for (const p of pairs) { sxy += (p.tax - mx) * (p.fin - my); sxx += (p.tax - mx) ** 2; syy += (p.fin - my) ** 2; }
        const r = sxy / Math.sqrt(sxx * syy), slope = sxy / sxx;
        const srt = pairs.slice().sort((a, x) => a.fin - x.fin);
        const qt = (lo, hi) => { const g = srt.slice(Math.floor(lo * srt.length), Math.floor(hi * srt.length)); return { fin: (g.reduce((a, p) => a + p.fin, 0) / g.length).toFixed(0), tax: (g.reduce((a, p) => a + p.tax, 0) / g.length).toFixed(1) }; };
        console.log(`\n⭐ TAIL COUPLING (n=${pairs.length} finishing boats): r = ${r.toFixed(2)}, slope ${slope.toFixed(2)}s of finish per 1s of grounding tax`);
        console.log('   ⚠️ association, not proof: a slower boat is on the course longer and so meets more rock.');
        console.log('   The rate check is what argues against pure exposure — contacts/second rises 2.7x Q1->Q4.');
        console.log('   quartile by finish:  Q1 fin ' + qt(0,.25).fin + ' tax ' + qt(0,.25).tax + ' | Q2 ' + qt(.25,.5).fin + '/' + qt(.25,.5).tax + ' | Q3 ' + qt(.5,.75).fin + '/' + qt(.5,.75).tax + ' | Q4 ' + qt(.75,1).fin + '/' + qt(.75,1).tax);
        console.log('   r^2 = ' + (r * r).toFixed(2) + ' — the share of between-boat finish variance the grounding tax alone tracks');
    }
    const worst = use.map((e, i) => ({ ...e, tax: tax[i] })).sort((a, x) => x.tax - a.tax).slice(0, 12);
    console.log('\nworst episodes:  leg  (x,y)  hits  vPre  dur  tax');
    for (const w of worst) console.log(`   ${String(w.leg).padStart(2)}  (${w.x},${w.y})  ${String(w.hits).padStart(3)}  ${w.vPre.toFixed(0).padStart(3)}  ${w.dur.toFixed(1)}s  ${w.tax.toFixed(1)}s`);
})();
