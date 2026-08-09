// POCKET TRANSIT ANATOMY (redrock push, 2026-08-09). The leg3-sub0 pocket is
// +114 s/boat with the waiver active; argmin says land STATIC_VETO (60u floor)
// + clearance band defeat the 0-rung, boundary refuted. This probe answers the
// NEXT question: what does a transit LOOK like — one long park at the face, or
// an escape-and-re-enter loop? Samples boats inside the box at 2 Hz (each
// sample credits 0.5 s, rule 18); reports per-transit anatomy: duration, slow
// time, parked spells (<15 u/s for >=2 s), wiggle share, nosedIn share (same
// 90/180u grid test as the near-reversal gate), heading churn INSIDE parks
// (std of unwrapped heading), drift during parks, re-entry count.
//   node _pocket_anat.js <venue> <x0> <y0> <x1> <y1> <trials> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const BOX = process.argv.slice(3, 7).map(Number);
const TRIALS = parseInt(process.argv[7]) || 3;
const SEED0 = parseInt(process.argv[8]) || 9400;
const ROOT = path.join(__dirname, process.argv[9] || 'treeHZ2');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const samples = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(async ({ seed, BOX }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (it % 30 !== 0) continue; // 2 Hz, 0.5 s per sample
                const g = state.course.botGrid;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished) continue;
                    if (bt.x < BOX[0] || bt.y < BOX[1] || bt.x > BOX[2] || bt.y > BOX[3]) continue;
                    let nosed = 0;
                    if (g) {
                        for (const dN of [90, 180]) {
                            const cc = g.cell(bt.x + Math.sin(bt.heading) * dN, bt.y - Math.cos(bt.heading) * dN);
                            if (!g.at(cc[0], cc[1])) { nosed = 1; break; }
                        }
                    }
                    const c = bt.controller || {};
                    // wiggle-blindness stat: is the COMMANDED beam-reach heading
                    // (windDir + side*1.75, the blind bypass at applyAvoidance top)
                    // hard-blocked within 150u? soft (floe-plug) cells do not count.
                    let wigBlk = -1, otherClr = -1, roseClr = -1;
                    if (c.wiggleActive && c.wiggleSide && g) {
                        const wd = getWindAt(bt.x, bt.y).direction;
                        const clearTo = (hc, dMax) => {
                            for (const dW of [60, 100, 150, 220]) {
                                if (dW > dMax) break;
                                const cw = g.cell(bt.x + Math.sin(hc) * dW, bt.y - Math.cos(hc) * dW);
                                if (!g.at(cw[0], cw[1])) {
                                    const idW = cw[1] * g.n + cw[0];
                                    if (!(g._soft && g._soft[idW])) return dW;
                                }
                            }
                            return 999;
                        };
                        wigBlk = clearTo(wd + c.wiggleSide * 1.75, 150) < 999 ? 1 : 0;
                        otherClr = clearTo(wd - c.wiggleSide * 1.75, 220) === 999 ? 1 : 0;
                        // rose: any non-irons heading (|d-wind|>=0.62 off head-to-wind)
                        // with >=220u hard-clear water?
                        roseClr = 0;
                        for (let k = 0; k < 16; k++) {
                            const hR = wd + 0.62 + (k / 15) * (2 * Math.PI - 1.24);
                            if (clearTo(hR, 220) === 999) { roseClr = 1; break; }
                        }
                    }
                    out.push({ id: bt.id, t: +state.race.timer.toFixed(1), x: +bt.x.toFixed(0), y: +bt.y.toFixed(0),
                        spd: +((bt.speed || 0) * 60).toFixed(0), h: +bt.heading.toFixed(2),
                        wig: c.wiggleActive ? 1 : 0, ws: c.wiggleSide || 0, nosed, wigBlk, otherClr, roseClr, leg: bt.raceState.leg });
                }
            }
            return out;
        }, { seed: SEED0 + t, BOX });
        console.log(`seed ${SEED0 + t}: ${rows.length} box samples`);
        for (const r of rows) { r.seed = SEED0 + t; samples.push(r); }
    }
    await b.close();
    // Reassemble transits: same seed+boat, gap > 2s => new transit
    const key = r => r.seed + ':' + r.id;
    const byBoat = {};
    for (const r of samples) (byBoat[key(r)] = byBoat[key(r)] || []).push(r);
    const transits = [];
    for (const k of Object.keys(byBoat)) {
        const rs = byBoat[k].sort((a, c) => a.t - c.t);
        let cur = [rs[0]];
        for (let i = 1; i < rs.length; i++) {
            if (rs[i].t - rs[i - 1].t > 2.01) { transits.push(cur); cur = []; }
            cur.push(rs[i]);
        }
        transits.push(cur);
    }
    const unwrap = hs => { const o = [hs[0]]; for (let i = 1; i < hs.length; i++) { let d = hs[i] - hs[i - 1]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; o.push(o[i - 1] + d); } return o; };
    const std = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
    const anat = [];
    const reentry = {};
    for (const tr of transits) {
        if (tr.length < 2) continue;
        const dur = 0.5 * tr.length;
        const slow = 0.5 * tr.filter(r => r.spd < 40).length;
        const wig = 0.5 * tr.filter(r => r.wig).length;
        const nosed = 0.5 * tr.filter(r => r.nosed).length;
        // parked spells
        const spells = [];
        let sp = null;
        for (const r of tr) {
            if (r.spd < 15) { (sp = sp || { rows: [] }).rows.push(r); }
            else if (sp) { spells.push(sp); sp = null; }
        }
        if (sp) spells.push(sp);
        const spells2 = spells.filter(s => s.rows.length >= 4); // >=2s
        let parkT = 0, churn = 0, drift = 0, wsFlips = 0;
        for (const s of spells2) {
            parkT += 0.5 * s.rows.length;
            churn += std(unwrap(s.rows.map(r => r.h)));
            drift += Math.hypot(s.rows[s.rows.length - 1].x - s.rows[0].x, s.rows[s.rows.length - 1].y - s.rows[0].y);
            for (let i = 1; i < s.rows.length; i++) if (s.rows[i].ws && s.rows[i - 1].ws && s.rows[i].ws !== s.rows[i - 1].ws) wsFlips++;
        }
        const kk = tr[0].seed + ':' + tr[0].id;
        reentry[kk] = (reentry[kk] || 0) + 1;
        anat.push({ dur, slow, wig, nosed, nSpell: spells2.length, parkT,
            churnAvg: spells2.length ? +(churn / spells2.length).toFixed(2) : 0,
            driftAvg: spells2.length ? Math.round(drift / spells2.length) : 0, wsFlips });
    }
    anat.sort((a, c) => c.dur - a.dur);
    const tot = f => anat.reduce((s, a) => s + f(a), 0);
    console.log(`\n=== ${VENUE} box [${BOX}] anatomy: ${anat.length} transits, ${Object.keys(byBoat).length} boats ===`);
    console.log(`total box time ${tot(a => a.dur).toFixed(0)}s | slow ${tot(a => a.slow).toFixed(0)}s | wiggle ${tot(a => a.wig).toFixed(0)}s | nosedIn ${tot(a => a.nosed).toFixed(0)}s | parked-in-spells ${tot(a => a.parkT).toFixed(0)}s`);
    const wigS = samples.filter(r => r.wigBlk >= 0);
    if (wigS.length) {
        console.log(`wiggle-commanded heading HARD-BLOCKED within 150u: ${Math.round(100 * wigS.filter(r => r.wigBlk === 1).length / wigS.length)}% of ${wigS.length} wiggle samples (${(0.5 * wigS.filter(r => r.wigBlk === 1).length).toFixed(0)}s of blind wall-aim)`);
        const blk = wigS.filter(r => r.wigBlk === 1);
        if (blk.length) {
            console.log(`  of BLOCKED samples: other beam side clear(>=220u): ${Math.round(100 * blk.filter(r => r.otherClr === 1).length / blk.length)}%  | ANY non-irons heading clear(>=220u): ${Math.round(100 * blk.filter(r => r.roseClr === 1).length / blk.length)}%`);
        }
    }
    const re = Object.values(reentry);
    console.log(`transits per boat: mean ${(re.reduce((a, c) => a + c, 0) / re.length).toFixed(2)}  max ${Math.max(...re)}  (re-entry loops if >1)`);
    console.log(`parked spells: ${tot(a => a.nSpell)} total; wiggleSide flips inside spells: ${tot(a => a.wsFlips)}`);
    console.log('worst 8 transits (dur/slow/wig/nosed/spells/parkT/churn/drift):');
    for (const a of anat.slice(0, 8)) console.log('  ', JSON.stringify(a));
})();
