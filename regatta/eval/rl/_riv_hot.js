// WHERE ON THE LEG DO THE BOTS ACTUALLY STOP? (2026-08-10, river leg 3)
//
// `_leg_where` localizes a subsection by HER median position, which is only the
// bots' position if the bots sail her line. On river leg 3 they do not: a 450u
// pocket on her sub-5 median caught 451 boat-s of the ~3800 that subsection
// costs. So the diagnosis pocket was measuring the wrong water, and any fix
// aimed at it would have been aimed at nothing (rule 18: audit the probe).
//
// This bins every SLOW bot frame on the leg by its OWN position (250u cells)
// and reports the hot cells with, per cell:
//   * slow boat-s, mean speed, mean achievable target
//   * land-contact fraction on those frames
//   * who owns the helm in TRUE precedence order (rule 27) — the reflex block
//     at ~993 overwrites desiredHeading AFTER wiggle, so `wiggleActive` being
//     true does not mean wiggle is steering
//   * how close her own track comes to the cell — a hot cell she never visits
//     is a place the bots go and she does not (a routing error); a hot cell she
//     crosses fast is the same water sailed worse (an execution error)
//
// usage: node _riv_hot.js [venue] [leg] [trials] [seed0] [tree] [fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'river';
const LEG = parseInt(process.argv[3] !== undefined ? process.argv[3] : 3);
const TRIALS = parseInt(process.argv[4]) || 6;
const SEED0 = parseInt(process.argv[5]) || 7300;
const ROOT = path.join(__dirname, process.argv[6] || 'treePROBE');
const FParg = (process.argv[7] || '').startsWith('fp=') ? process.argv[7].slice(3).split(',') : null;
const CELL = 250;

// her track on this leg, from the fingerprint-verified recordings only
const herPts = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    for (const s of j.samples) {
        if (gi(s, 'phase') !== 1 || gi(s, 'leg') !== LEG) continue;
        herPts.push([gi(s, 'x'), gi(s, 'y'), gi(s, 'spd') * 60]);
    }
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const cells = {};
    let totSlow = 0, totLeg = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, LEG, CELL }) => {
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const C = {}; const DT = 1 / 60; let slow = 0, on = 0;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg !== LEG) continue;
                    const c = bo.controller; if (!c) continue;
                    const v = (bo.speed || 0) * 60;
                    on += DT;
                    if (v >= 40) continue;
                    slow += DT;
                    const kx = Math.floor(bo.x / CELL), ky = Math.floor(bo.y / CELL);
                    const k = kx + ',' + ky;
                    const o = C[k] || (C[k] = { t: 0, n: 0, spd: 0, tgt: 0, con: 0,
                                                spin: 0, esc: 0, reflex: 0, wig: 0, nav: 0 });
                    o.t += DT; o.n++;
                    o.spd += v; o.tgt += (bo.targetSpeed != null ? bo.targetSpeed : 0) * 60;
                    if (hit[bo.name]) o.con += DT;
                    if (c.penaltySpin) o.spin += DT;
                    else if (c.escActive) o.esc += DT;
                    else if (c.iceEscapeTimer > 0) o.reflex += DT;
                    else if (c.wiggleActive) o.wig += DT;
                    else o.nav += DT;
                }
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return { C, slow, on };
        }, { seed: SEED0 + t, LEG, CELL });
        totSlow += r.slow; totLeg += r.on;
        for (const k in r.C) {
            const a = cells[k] || (cells[k] = { t: 0, n: 0, spd: 0, tgt: 0, con: 0, spin: 0, esc: 0, reflex: 0, wig: 0, nav: 0 });
            for (const f in r.C[k]) a[f] += r.C[k][f];
        }
        console.log(`seed ${SEED0 + t}: ${r.slow.toFixed(0)} slow boat-s of ${r.on.toFixed(0)} on leg ${LEG}`);
    }
    await b.close();

    const rows = Object.entries(cells).sort((a, c) => c[1].t - a[1].t).slice(0, 12);
    console.log(`\n=== ${VENUE.toUpperCase()} LEG ${LEG}: WHERE THE BOTS STOP (${TRIALS} seeds, ${CELL}u cells) ===`);
    console.log(`leg time ${totLeg.toFixed(0)} boat-s, slow (<40 u/s) ${totSlow.toFixed(0)} (${(100 * totSlow / totLeg).toFixed(0)}%)`);
    console.log(`her track on this leg: ${herPts.length} samples from ${FParg ? FParg.length : 'ALL'} lap(s)\n`);
    console.log(` cell centre        slow s   share   spd   tgt  contact   helm (spin/esc/reflex/wig/nav)   her nearest  her spd there`);
    for (const [k, o] of rows) {
        const [kx, ky] = k.split(',').map(Number);
        const cx = kx * CELL + CELL / 2, cy = ky * CELL + CELL / 2;
        let hd = Infinity, hs = null;
        for (const q of herPts) {
            const d = Math.hypot(q[0] - cx, q[1] - cy);
            if (d < hd) { hd = d; hs = q[2]; }
        }
        const P = (x) => (100 * x / o.t).toFixed(0).padStart(3) + '%';
        console.log(`(${String(Math.round(cx)).padStart(5)},${String(Math.round(cy)).padStart(6)})  ` +
            `${o.t.toFixed(0).padStart(6)}  ${(100 * o.t / totSlow).toFixed(0).padStart(3)}%  ` +
            `${(o.spd / o.n).toFixed(0).padStart(4)}  ${(o.tgt / o.n).toFixed(0).padStart(4)}  ` +
            `${P(o.con)}    ${P(o.spin)}/${P(o.esc)}/${P(o.reflex)}/${P(o.wig)}/${P(o.nav)}   ` +
            `${Math.round(hd).toString().padStart(6)}u ${hd > 350 ? '(never)' : '       '}  ` +
            `${hs != null && hd <= 350 ? Math.round(hs) + ' u/s' : '-'}`);
    }
})();
