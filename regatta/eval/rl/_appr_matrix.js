// MARK-APPROACH MATRIX (P3, human-level push 2026-08-09). Mechanism C: arctic
// L1 subs 8-9 (armed 65%) and lake L2 sub9 (armed 45%) — the time is at the
// rounding, not the beat. Bin frames by DISTANCE TO THE LEG'S ROUNDING MARK
// (dRM bands), both sides by the same rule: fleet per-frame in the page, human
// laps passed in. Per band: s/boat (episodes on the clock), speed med, armed%,
// avoid%, wiggle%, near-zero-speed% (parked), plus her speed med.
//   node _appr_matrix.js <venue> <legIndex> <trials> <seed0> <tree> [fp=<h>,<h>]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2];
const LEG = parseInt(process.argv[3]);
const TRIALS = parseInt(process.argv[4]) || 4;
const SEED0 = parseInt(process.argv[5]) || 9100;
const ROOT = path.join(__dirname, process.argv[6] || 'treeP0');
const FP = (process.argv[7] || '').startsWith('fp=') ? process.argv[7].slice(3).split(',') : null;
const BANDS = [0, 150, 300, 450, 600, 900, 1200, 1800, 2700, 1e9];

const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 5) continue;
    laps.push({ file: f.slice(5, -5), fin: j.finishTime,
        pts: S.map(s => [gi(s, 'x'), gi(s, 'y'), gi(s, 't'), gi(s, 'spd') * 60]) });
}
if (!laps.length) console.log('⚠️ no human laps for this venue/leg (fingerprint filter?)');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const res = await page.evaluate(async (arg) => {
        const { LEG, TRIALS, SEED0, BANDS, laps } = arg;
        const nb = BANDS.length - 1;
        const mkAcc = () => Array.from({ length: nb }, () => ({
            t: 0, boatSecs: 0, spd: [], armed: 0, avoid: 0, wig: 0, parked: 0, n: 0 }));
        const band = (d) => { for (let k = 0; k < nb; k++) if (d < BANDS[k + 1]) return k; return nb - 1; };

        // one race to find the leg's rounding mark position
        window.evalHarness.seed = SEED0; window.resetGame(); window.startRace(); window.update(1 / 60);
        const rm = (typeof legRoundMark === 'function' && legRoundMark(LEG)) || state.course.roundMark || null;
        let rmx, rmy;
        if (rm) { rmx = rm.x; rmy = rm.y; }
        else {
            // fall back: the leg polyline's endpoint
            const leg = state.course.dmc.legs[LEG];
            const e = leg.pts[leg.pts.length - 1]; rmx = e[0] != null ? e[0] : e.x; rmy = e[1] != null ? e[1] : e.y;
        }

        // human side
        const H = mkAcc();
        for (const lap of laps) {
            const P = lap.pts;
            for (let i = 1; i < P.length; i++) {
                const [x, y, t, spd] = P[i];
                const dtm = Math.min(1.0, Math.max(0, t - P[i - 1][2]));
                const k = band(Math.hypot(x - rmx, y - rmy));
                H[k].t += dtm; H[k].spd.push(spd); H[k].n++;
                if (spd < 8) H[k].parked += dtm;
            }
        }

        // fleet side
        const B = mkAcc();
        let boatLegs = 0;
        const dt = 1 / 60;
        for (let tr = 0; tr < TRIALS; tr++) {
            window.evalHarness.seed = SEED0 + tr;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const seen = new Set();
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg !== LEG) continue;
                    seen.add(bt.id);
                    const k = band(Math.hypot(bt.x - rmx, bt.y - rmy));
                    const c = bt.controller || {};
                    const spd = (bt.speed || 0) * 60;
                    B[k].t += dt; B[k].boatSecs += dt; B[k].spd.push(spd); B[k].n++;
                    if (bt.raceState.roundArmed) B[k].armed += dt;
                    if ((c.lastAvoidDeviation || 0) > 0.08) B[k].avoid += dt;
                    if (c.wiggleActive) B[k].wig += dt;
                    if (spd < 8) B[k].parked += dt;
                }
            }
            boatLegs += seen.size;
        }
        const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null; };
        return {
            rm: [Math.round(rmx), Math.round(rmy)], boatLegs, nLaps: laps.length,
            rows: BANDS.slice(0, -1).map((lo, k) => ({
                band: `${lo}-${BANDS[k + 1] === 1e9 ? '∞' : BANDS[k + 1]}`,
                humS: +( H[k].t / Math.max(1, laps.length)).toFixed(1), humSpd: med(H[k].spd), humPark: +(H[k].parked / Math.max(1, laps.length)).toFixed(1),
                botS: +(B[k].boatSecs / Math.max(1, boatLegs)).toFixed(1), botSpd: med(B[k].spd),
                armedPct: B[k].t ? Math.round(100 * B[k].armed / B[k].t) : 0,
                avoidPct: B[k].t ? Math.round(100 * B[k].avoid / B[k].t) : 0,
                wigPct: B[k].t ? Math.round(100 * B[k].wig / B[k].t) : 0,
                parkPct: B[k].t ? Math.round(100 * B[k].parked / B[k].t) : 0
            }))
        };
    }, { LEG, TRIALS, SEED0, BANDS, laps });
    await browser.close();

    console.log(`=== ${VENUE} leg ${LEG}: approach matrix by dist-to-rounding-mark (${res.rm}) — ${res.boatLegs} boat-legs, ${res.nLaps} human laps ===`);
    console.log('band(u)      humS/lap humSpd humPark | botS/boat botSpd armed% avoid% wig% park%');
    for (const r of res.rows) {
        console.log(`${r.band.padEnd(12)} ${String(r.humS).padStart(7)} ${String(r.humSpd).padStart(6)} ${String(r.humPark).padStart(7)} | ${String(r.botS).padStart(9)} ${String(r.botSpd).padStart(6)} ${String(r.armedPct).padStart(6)} ${String(r.avoidPct).padStart(6)} ${String(r.wigPct).padStart(4)} ${String(r.parkPct).padStart(5)}`);
    }
})();
