// WHAT IS SHE HITTING INSIDE THE RING? (2026-08-11, arctic push)
//
// `_round_helm`: the armed granite-isle rounding is 81.6 s/boat (59% of arctic's
// whole gap) and 63.9% of its slow time is owned by the ICE ESCAPE, which is
// under 40 u/s on 84.5% of its ticks. The in-zone escape picks its heading from a
// wind-relative fan (|TWA| 60 or 100 deg), so it is NOT steering her into irons —
// she is simply in contact, and `collision_island` takes 60% of her speed EVERY
// FRAME of overlap (rule 28), so a boat collapses inside ~6 frames.
//
// So the question is what she is touching, and for how long. He touches nothing:
// 0.0 s under 40 u/s across three recorded roundings.
//   node _round_contact.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeARCB');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { armedT: 0, boats: 0, cls: {}, epi: {}, dur: {}, rDist: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            const hit = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (d && d.boat && !d.boat.isPlayer &&
                    (ty === 'collision_island' || ty === 'collision_boat' || ty === 'collision_mark' || ty === 'collision_boundary')) {
                    const c = ty === 'collision_boat' ? 'boat' : ty === 'collision_mark' ? 'mark'
                        : ty === 'collision_island' ? (d.isFloe ? 'floe' : 'land') : 'bounds';
                    hit[d.boat.name] = c;
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const rm = state.course.roundMark;
            const S = { armedT: 0, boats: {}, cls: {}, epi: {}, dur: {}, rDist: [] };
            const open = {};
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || !b.raceState.roundArmed || b.raceState.leg !== 1) continue;
                    S.armedT += DT; S.boats[b.name] = 1;
                    const c = hit[b.name];
                    const key = b.name;
                    if (c) {
                        S.cls[c] = (S.cls[c] || 0) + DT;
                        if (!open[key] || open[key].c !== c) { open[key] = { c, t: 0 }; S.epi[c] = (S.epi[c] || 0) + 1; }
                        open[key].t += DT;
                        if (c === 'land' || c === 'floe') S.rDist.push(Math.round(Math.hypot(b.x - rm.x, b.y - rm.y)));
                    } else if (open[key]) {
                        S.dur[open[key].c] = (S.dur[open[key].c] || []); S.dur[open[key].c].push(open[key].t);
                        delete open[key];
                    }
                }
                if (state.race.timer > 895) break;
            }
            S.nBoats = Object.keys(S.boats).length;
            S.rDist = S.rDist.filter((_, i) => i % 10 === 0);
            return S;
        }, SEED0 + t);
        A.armedT += r.armedT; A.boats += r.nBoats;
        for (const k in r.cls) A.cls[k] = (A.cls[k] || 0) + r.cls[k];
        for (const k in r.epi) A.epi[k] = (A.epi[k] || 0) + r.epi[k];
        for (const k in r.dur) (A.dur[k] = A.dur[k] || []).push(...r.dur[k]);
        A.rDist.push(...r.rDist);
        console.log(`seed ${SEED0 + t}: ${r.nBoats} armed boats, ${r.armedT.toFixed(0)} armed boat-seconds`);
    }
    await br.close();
    const q = (a, pp) => { if (!a || !a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    console.log(`\n=== ${VENUE.toUpperCase()}: CONTACT INSIDE THE ARMED ROUNDING (${A.boats} boats) ===`);
    console.log(`armed time: ${(A.armedT / A.boats).toFixed(1)} s/boat`);
    for (const c of Object.keys(A.cls).sort((a, b) => A.cls[b] - A.cls[a]))
        console.log(`   ${c.padEnd(7)} ${(A.cls[c] / A.boats).toFixed(2)} s/boat in contact  over ${(A.epi[c] / A.boats).toFixed(1)} episodes/boat  (episode med ${q(A.dur[c], .5) ? q(A.dur[c], .5).toFixed(2) : '-'}s p90 ${q(A.dur[c], .9) ? q(A.dur[c], .9).toFixed(2) : '-'}s)`);
    console.log(`   radius from the mark at a land/floe contact: med ${q(A.rDist, .5)}u  p25 ${q(A.rDist, .25)}  p75 ${q(A.rDist, .75)}   (his median rounding radius 613u)`);
})();
