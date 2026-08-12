// WHERE ALONG LEG 1 IS THE EXTRA DISTANCE SPENT? (2026-08-11, arctic push)
//
// `_leg1_budget`: arctic leg 1 is 2.16x = DISTANCE 1.79x x SPEED 1.21x, made good
// identical (1.02x). 97 s of the 143 s excess is distance — the fleet sails
// 25 604 u where he sails 14 299 to reach the same place. `_beat_width` says only
// part of that is lateral spread (1.31x rms) or a wider beat angle (44.1 vs
// 41.2 deg), so the rest is along-axis: ground covered and re-covered.
//
// This is the SUB-LEG cut. Progress along the leg is measured as the DMC
// projection (`CoursePath.project` on the leg's own path, the same ruler the
// engine uses) and split into ten equal bands. For each band, per lap:
//     seconds spent, odometer sailed, and made good along the ruler
// so the odometer/made-good ratio is a local tortuosity and the seconds are
// additive against the leg gap. His column uses the recorded `legProg` if the
// schema has it, else the same projection recomputed offline.
//
// usage: node _leg1_where.js <venue> <trials> <seed0> <tree> [fp=a,b] [leg] [bands]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeARCB');
const FParg = (process.argv[6] || '').startsWith('fp=') ? process.argv[6].slice(3).split(',') : null;
const LEG = process.argv[7] != null ? parseInt(process.argv[7]) : 1;
const NB = parseInt(process.argv[8]) || 10;

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

// ── HIS SIDE (recorded legProg column) ──────────────────────────────────────
const herLaps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const pk = F.findIndex(c => String(c).startsWith('legProg'));
    if (pk < 0) continue;
    const rows = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (rows.length < 20) continue;
    const dts = [];
    for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
    dts.sort((a, b) => a - b);
    const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
    const prog = rows.map(s => s[pk]);
    const maxP = Math.max(...prog);
    const L = { t: new Array(NB).fill(0), odo: new Array(NB).fill(0), maxP };
    for (let i = 1; i < rows.length; i++) {
        const b = Math.min(NB - 1, Math.max(0, Math.floor(NB * prog[i] / (maxP || 1))));
        L.t[b] += DT;
        L.odo[b] += Math.hypot(gi(rows[i], 'x') - gi(rows[i - 1], 'x'), gi(rows[i], 'y') - gi(rows[i - 1], 'y'));
    }
    herLaps.push(L);
}
if (!herLaps.length) { console.log('no fingerprint-matching laps with a legProg column'); process.exit(1); }

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const botLaps = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, LEG, NB }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const per = {}; const DT = 1 / 60;
            const legPath = () => state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[LEG];
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const lp = legPath();
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== LEG) continue;
                    const P = per[b.name] || (per[b.name] = { t: [], odo: [], irons: [], slow: [], px: b.x, py: b.y, hint: null, maxP: 0, samples: [] });
                    if (!P.t.length) { for (let i = 0; i < NB; i++) { P.t.push(0); P.odo.push(0); P.irons.push(0); P.slow.push(0); } }
                    let s = 0;
                    if (lp && typeof CoursePath !== 'undefined') { s = CoursePath.project(lp, b.x, b.y, P.hint); P.hint = s; }
                    P.maxP = Math.max(P.maxP, s);
                    P.samples.push([s, Math.hypot(b.x - P.px, b.y - P.py), b.speed * 60,
                        Math.abs(Math.atan2(Math.sin(b.heading - getWindAt(b.x, b.y).direction), Math.cos(b.heading - getWindAt(b.x, b.y).direction)))]);
                    P.px = b.x; P.py = b.y;
                }
                if (state.race.timer > 895) break;
            }
            const fin = {}; for (const b of state.boats) if (!b.isPlayer) fin[b.name] = b.raceState.finishTime || null;
            const out = [];
            for (const k in per) {
                if (!fin[k]) continue;
                const P = per[k], L = { t: new Array(NB).fill(0), odo: new Array(NB).fill(0), irons: new Array(NB).fill(0), maxP: P.maxP };
                for (const [s, d, sp, twa] of P.samples) {
                    const bd = Math.min(NB - 1, Math.max(0, Math.floor(NB * s / (P.maxP || 1))));
                    L.t[bd] += 1 / 60; L.odo[bd] += d; if (twa < 0.62) L.irons[bd] += 1 / 60;
                }
                out.push(L);
            }
            return out;
        }, { seed: SEED0 + t, LEG, NB });
        botLaps.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} bot legs`);
    }
    await br.close();

    console.log(`\n=== ${VENUE.toUpperCase()} LEG ${LEG} BY SUB-LEG (${botLaps.length} bot legs, ${herLaps.length} of his) ===`);
    console.log(`ruler length: his ${mean(herLaps.map(l => l.maxP)).toFixed(0)}u   bot ${mean(botLaps.map(l => l.maxP)).toFixed(0)}u`);
    console.log(`\n band        his s   bot s   DELTA   cum%  |  his odo   bot odo   odo ratio  | bot irons s`);
    const tot = [];
    for (let b = 0; b < NB; b++) tot.push(mean(botLaps.map(l => l.t[b])) - mean(herLaps.map(l => l.t[b])));
    const sum = tot.reduce((a, x) => a + x, 0);
    let cum = 0;
    for (let b = 0; b < NB; b++) {
        const ht = mean(herLaps.map(l => l.t[b])), bt = mean(botLaps.map(l => l.t[b]));
        const ho = mean(herLaps.map(l => l.odo[b])), bo = mean(botLaps.map(l => l.odo[b]));
        const ir = mean(botLaps.map(l => l.irons[b]));
        cum += tot[b];
        console.log(`  ${String(b * 10).padStart(3)}-${String(b * 10 + 10).padEnd(3)} ${ht.toFixed(1).padStart(7)} ${bt.toFixed(1).padStart(7)} ${tot[b].toFixed(1).padStart(7)} ${(100 * cum / sum).toFixed(0).padStart(5)}%  | ${ho.toFixed(0).padStart(8)} ${bo.toFixed(0).padStart(9)} ${(bo / (ho || 1)).toFixed(2).padStart(9)}x  | ${ir.toFixed(1).padStart(9)}`);
    }
    console.log(`  TOTAL   ${mean(herLaps.map(l => l.t.reduce((a, x) => a + x, 0))).toFixed(1).padStart(7)} ${mean(botLaps.map(l => l.t.reduce((a, x) => a + x, 0))).toFixed(1).padStart(7)} ${sum.toFixed(1).padStart(7)}`);
})();
