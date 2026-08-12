// LEG 1 = TIME = DISTANCE / SPEED. WHICH FACTOR IS THE 2.16x? (2026-08-11, arctic)
//
// `_gap_grid` per leg: arctic's leg 1 is 142.6 s/lap of a 137.7 s/lap LAP gap —
// 104% of the whole venue — with the bot at 265.1 s against his 122.5 s. That
// ratio is the product of two independent factors and nobody has separated them
// on the current HEAD:
//
//     time  =  odometer / mean speed
//     2.16x =    D-factor   x   1/S-factor
//
// A distance excess is a ROUTING/manoeuvre-count story; a speed deficit is a
// SAILING story (wrong angle, in irons, grinding, throttled). They call for
// completely different fixes and eight dead shapes on this venue were aimed at
// one of them without ever measuring the split.
//
// Speed is measured two ways because they answer different questions:
//   * PATH speed   = odometer / time-on-leg   (how fast is she moving)
//   * MADE-GOOD    = straight-line start->end / time  (how fast toward the mark)
// The ratio of the two is the tortuosity of the track, which is the manoeuvre
// count and the staircase expressed as one number.
//
// usage: node _leg1_budget.js <venue> <trials> <seed0> <tree> [fp=a,b] [leg]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeARCB');
const FParg = (process.argv[6] || '').startsWith('fp=') ? process.argv[6].slice(3).split(',') : null;
const LEG = process.argv[7] != null ? parseInt(process.argv[7]) : 1;

const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

// ── HER SIDE ────────────────────────────────────────────────────────────────
const her = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const rows = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (rows.length < 10) continue;
    const dts = [];
    for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
    dts.sort((a, b) => a - b);
    const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
    let odo = 0, tacks = 0, lastSide = null, irons = 0;
    for (let i = 1; i < rows.length; i++) {
        odo += Math.hypot(gi(rows[i], 'x') - gi(rows[i - 1], 'x'), gi(rows[i], 'y') - gi(rows[i - 1], 'y'));
    }
    // tack count off the recorded heading column (`hdg`, NOT `heading`)
    const hk = F.indexOf('hdg') >= 0 ? 'hdg' : null;
    if (hk) for (const s of rows) {
        const tw = Math.atan2(Math.sin(gi(s, hk)), Math.cos(gi(s, hk)));
        void tw;
    }
    const t = rows.length * DT;
    const d0 = [gi(rows[0], 'x'), gi(rows[0], 'y')], d1 = [gi(rows[rows.length - 1], 'x'), gi(rows[rows.length - 1], 'y')];
    her.push({ t, odo, mg: Math.hypot(d1[0] - d0[0], d1[1] - d0[1]), spd: odo / t, tacks, irons });
}
if (!her.length) { console.log('no fingerprint-matching laps'); process.exit(1); }

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const bots = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const per = {}; const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== LEG) continue;
                    const P = per[b.name] || (per[b.name] = { t: 0, odo: 0, x0: b.x, y0: b.y, x1: 0, y1: 0, irons: 0, slow: 0, n: 0 });
                    P.t += DT; P.odo += (b.speed || 0) * 60 * DT; P.x1 = b.x; P.y1 = b.y; P.n++;
                    const twa = Math.abs(Math.atan2(Math.sin(b.heading - getWindAt(b.x, b.y).direction), Math.cos(b.heading - getWindAt(b.x, b.y).direction)));
                    if (twa < 0.62) P.irons += DT;
                    if ((b.speed || 0) * 60 < 40) P.slow += DT;
                }
                if (state.race.timer > 895) break;
            }
            const fin = {}; for (const b of state.boats) if (!b.isPlayer) fin[b.name] = b.raceState.finishTime || null;
            const out = [];
            for (const k in per) if (fin[k]) out.push({ ...per[k], mg: Math.hypot(per[k].x1 - per[k].x0, per[k].y1 - per[k].y0) });
            return out;
        }, { seed: SEED0 + t, LEG });
        bots.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} finishers on leg ${LEG}`);
    }
    await br.close();

    const H = { t: mean(her.map(h => h.t)), odo: mean(her.map(h => h.odo)), mg: mean(her.map(h => h.mg)) };
    const B = { t: mean(bots.map(b => b.t)), odo: mean(bots.map(b => b.odo)), mg: mean(bots.map(b => b.mg)),
                irons: mean(bots.map(b => b.irons)), slow: mean(bots.map(b => b.slow)) };
    console.log(`\n=== ${VENUE.toUpperCase()} LEG ${LEG}: DISTANCE OR SPEED? (${TRIALS} seeds, ${bots.length} bot-legs, ${her.length} of his laps) ===`);
    const row = (n, h, b) => console.log(`   ${n.padEnd(22)} his ${h.toFixed(1).padStart(9)}   bot ${b.toFixed(1).padStart(9)}   ratio ${(b / h).toFixed(2)}x`);
    row('time on leg (s)', H.t, B.t);
    row('odometer (u)', H.odo, B.odo);
    row('made good (u)', H.mg, B.mg);
    row('path speed (u/s)', H.odo / H.t, B.odo / B.t);
    row('made-good speed (u/s)', H.mg / H.t, B.mg / B.t);
    console.log(`   ${'tortuosity odo/mg'.padEnd(22)} his ${(H.odo / H.mg).toFixed(2).padStart(9)}   bot ${(B.odo / B.mg).toFixed(2).padStart(9)}   ratio ${((B.odo / B.mg) / (H.odo / H.mg)).toFixed(2)}x`);
    const dF = B.odo / H.odo, sF = (H.odo / H.t) / (B.odo / B.t);
    console.log(`\n   ⭐ TIME RATIO ${(B.t / H.t).toFixed(2)}x = DISTANCE ${dF.toFixed(2)}x  x  SPEED-DEFICIT ${sF.toFixed(2)}x   (product ${(dF * sF).toFixed(2)}x)`);
    console.log(`      of the ${(B.t - H.t).toFixed(0)}s excess: ${(H.t * (dF - 1)).toFixed(0)}s is EXTRA DISTANCE at his pace, ${(B.t - H.t - H.t * (dF - 1)).toFixed(0)}s is BEING SLOWER`);
    console.log(`\n   bot time inside the no-go: ${B.irons.toFixed(1)}s (${(100 * B.irons / B.t).toFixed(1)}% of the leg)`);
    console.log(`   bot time under 40 u/s:     ${B.slow.toFixed(1)}s (${(100 * B.slow / B.t).toFixed(1)}% of the leg)`);
})();
