// ARE GLOWTIDE'S BOAT COLLISIONS REALLY A ROCK PROBLEM? (2026-08-13)
//
// OWNER HYPOTHESIS, from watching races: "most of these are a direct result or
// secondary effect of the difficulty of navigating the rocks just before and after
// the first mark (end of leg 1, beginning leg 2). They may manifest as boat on
// boat collisions, but are a result of the narrow rock channels + tide... AI locks
// in trouble in the rocks."
//
// That is a causal claim with three testable parts, and this tests all three:
//   WHERE   is each boat-boat contact, by leg and by range to mark 1
//   WHAT WATER  clearance to the nearest blocked cell, and the tide there
//   WHAT CAME FIRST  in the 5 s before the rub: a LAND contact, an escape, a
//                    wiggle, a stall — i.e. was the boat already in trouble
// A rub whose 5 s of history contains a rock contact or an escape is SECONDARY;
// one that arrives at full speed in open water is a genuine traffic failure.
//   node _glow_rub.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 6;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGTW');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            const hit = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (d && d.boat && !d.boat.isPlayer) {
                    if (ty === 'collision_boat') hit[d.boat.name] = 'boat';
                    else if (ty === 'collision_island') hit[d.boat.name] = d.isFloe ? 'floe' : 'land';
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__ownLog = [];                       // enables treeGTW's helm tags
            const clr = (x, y) => {
                const g = state.course.botGrid; if (!g) return -1;
                const R = g.res || 50;
                for (let ring = 0; ring <= 8; ring++)
                    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                        const cc = g.cell(x + dx * R, y + dy * R);
                        if (!g.at(cc[0], cc[1])) return ring * R;
                    }
                return 8 * R;
            };
            const out = []; const hist = {}; const open = {};
            const m1 = (state.course.marks || []).find(m => m.id === 'mark-1') || state.course.marks[0];
            const DT = 1 / 60; let now = 0;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT); now += DT;
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    const c = b.controller;
                    const H = hist[b.name] = hist[b.name] || [];
                    H.push({ t: now, k: hit[b.name] || null, spd: b.speed * 60,
                             esc: c && c.iceEscapeTimer > 0 ? 1 : 0, wig: c && c.wiggleActive ? 1 : 0 });
                    if (H.length > 400) H.shift();
                    if (hit[b.name] === 'boat' && !open[b.name]) {
                        open[b.name] = now;
                        const pre = H.filter(h => now - h.t <= 5 && now - h.t > 0.05);
                        let nb = 0;
                        for (const o of state.boats) if (o !== b && !o.isPlayer && !o.raceState.finished
                            && Math.hypot(o.x - b.x, o.y - b.y) < 300) nb++;
                        const cu = getCurrentAt(b.x, b.y);
                        out.push({
                            leg: b.raceState.leg,
                            dM1: m1 ? Math.round(Math.hypot(b.x - m1.x, b.y - m1.y)) : -1,
                            clr: clr(b.x, b.y), cur: cu ? +cu.speed.toFixed(2) : 0,
                            spd: Math.round(b.speed * 60),
                            preLand: pre.some(h => h.k === 'land') ? 1 : 0,
                            preEsc: pre.some(h => h.esc) ? 1 : 0,
                            preWig: pre.some(h => h.wig) ? 1 : 0,
                            preSlow: pre.length && pre.filter(h => h.spd < 40).length / pre.length > 0.5 ? 1 : 0,
                            nb, t: Math.round(now)
                        });
                    }
                    if (open[b.name] && hit[b.name] !== 'boat' && now - open[b.name] > 1.0) delete open[b.name];
                }
                if (state.race.timer > 895) break;
            }
            return out;
        }, SEED0 + t);
        A.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} boat-contact episodes`);
    }
    await br.close();
    const q = (a, pp) => { const s = a.filter(v => v != null && v >= 0).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const n = A.length || 1, pc = x => `${x} (${(100 * x / n).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()}: ARE THE BOAT RUBS A ROCK PROBLEM? (${A.length} episodes) ===`);
    console.log(`\nWHERE — by leg:`);
    const byLeg = {}; for (const e of A) byLeg[e.leg] = (byLeg[e.leg] || 0) + 1;
    for (const L of Object.keys(byLeg).sort()) console.log(`   leg ${L}: ${pc(byLeg[L])}`);
    console.log(`\n   range to MARK 1: med ${q(A.map(e => e.dM1), .5)}u   p25 ${q(A.map(e => e.dM1), .25)}u   p75 ${q(A.map(e => e.dM1), .75)}u`);
    console.log(`   within 900u of mark 1: ${pc(A.filter(e => e.dM1 >= 0 && e.dM1 < 900).length)}`);
    console.log(`   on leg 1 or 2:         ${pc(A.filter(e => e.leg === 1 || e.leg === 2).length)}`);
    console.log(`\nWHAT WATER:`);
    console.log(`   clearance to rock at the rub: med ${q(A.map(e => e.clr), .5)}u   p25 ${q(A.map(e => e.clr), .25)}u`);
    console.log(`   in NARROW water (<100u):      ${pc(A.filter(e => e.clr >= 0 && e.clr < 100).length)}`);
    console.log(`   tide there: med ${q(A.map(e => e.cur), .5)} kt`);
    console.log(`   boats within 300u: med ${q(A.map(e => e.nb), .5)}   speed at the rub: med ${q(A.map(e => e.spd), .5)} u/s`);
    console.log(`\n⭐ WHAT CAME FIRST (the 5 s before the rub):`);
    console.log(`   a LAND contact:        ${pc(A.filter(e => e.preLand).length)}`);
    console.log(`   an ESCAPE running:     ${pc(A.filter(e => e.preEsc).length)}`);
    console.log(`   a WIGGLE running:      ${pc(A.filter(e => e.preWig).length)}`);
    console.log(`   mostly SLOW (<40 u/s): ${pc(A.filter(e => e.preSlow).length)}`);
    const sec = A.filter(e => e.preLand || e.preEsc || e.preWig || e.preSlow);
    console.log(`   ⭐ SECONDARY (any of the above): ${pc(sec.length)}`);
    console.log(`     PRIMARY (clean, at speed, in open water): ${pc(n - sec.length)}`);
})();
