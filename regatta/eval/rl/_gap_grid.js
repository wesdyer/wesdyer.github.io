// WHERE, ON THE GROUND, IS THE WHOLE GAP? (2026-08-11)
//
// Every localizer the campaign has used so far answers a narrower question than
// the one that matters:
//   * `_leg_where` bins by HER MEDIAN POSITION along the leg, so it can only see
//     water she sails; on river a 450u pocket on her sub-5 median caught 451 of
//     ~3800 boat-seconds and the diagnosis was aimed at the wrong water.
//   * `_riv_hot` fixed the localization (it bins by the BOTS' own positions) but
//     it only bins SLOW frames (<40 u/s). On redrock leg 3 slow frames are 26% of
//     the leg's time while the leg's excess is 45% of it, so a slow-frame map
//     cannot be apportioned against the gap either.
//
// This bins TIME — all of it, hers and theirs — into the same ground cells, and
// reports the DIFFERENCE per cell in seconds per lap:
//
//     delta(cell) = bot boat-seconds in cell / bot laps
//                 - her  seconds     in cell / her laps
//
// Two properties make that the honest instrument:
//   1. IT IS ADDITIVE BY CONSTRUCTION. Summed over every cell it equals
//      (mean bot lap) - (mean her lap) exactly, because every second of every lap
//      lands in exactly one cell. Rule 26 says medians do not add and a per-leg
//      MEDIAN table cannot explain a lap median; a per-cell MEAN table can, and
//      this prints the reconciliation so the claim is checkable rather than
//      asserted.
//   2. IT SCORES WATER SHE NEVER ENTERS. A cell with her = 0 and the bots at
//      8 s/lap is 8 s/lap of pure detour, and no her-referenced localizer can see
//      it at all.
//
// Only FINISHERS are counted on the bot side, so the sum reconciles against the
// finisher mean rather than against a censored mixture (a DNF sails a partial lap
// and would deflate every cell it never reached).
//
// usage: node _gap_grid.js <venue> <trials> <seed0> <tree> [cell] [fp=a,b] [leg]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 6;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treePR11');
const CELL = parseFloat(process.argv[6]) || 250;
const FParg = (process.argv[7] || '').startsWith('fp=') ? process.argv[7].slice(3).split(',') : null;
const LEG = process.argv[8] !== undefined && process.argv[8] !== 'all' ? parseInt(process.argv[8]) : null;

// ── HER SIDE ────────────────────────────────────────────────────────────────
// Sample spacing is read from the file rather than assumed: the recorder's rate
// has changed across schemas and crediting a fixed dt would scale her whole
// column (rule 18 — the leganat run inflated every time stat 6x that way).
const herCells = {}; let herLaps = 0, herTotal = 0;
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const rows = j.samples.filter(s => gi(s, 'phase') === 1 && (LEG === null || gi(s, 'leg') === LEG));
    if (rows.length < 10) continue;
    // median |dt| between consecutive racing samples
    const dts = [];
    for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
    dts.sort((a, b) => a - b);
    const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
    herLaps++;
    for (const s of rows) {
        const k = Math.floor(gi(s, 'x') / CELL) + ',' + Math.floor(gi(s, 'y') / CELL);
        const o = herCells[k] || (herCells[k] = { t: 0, spd: 0, n: 0 });
        o.t += DT; o.n++; o.spd += gi(s, 'spd') * 60;
        herTotal += DT;
    }
}
if (!herLaps) { console.log('no fingerprint-matching laps — refusing to print a gap map without a reference'); process.exit(1); }

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const bot = {}; let botLaps = 0, botTotal = 0, dnf = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CELL, LEG }) => {
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const per = {};   // boat name -> {cells, fin}
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    if (LEG !== null && bo.raceState.leg !== LEG) continue;
                    const c = bo.controller; if (!c) continue;
                    const P = per[bo.name] || (per[bo.name] = { cells: {}, fin: 0, t: 0 });
                    const k = Math.floor(bo.x / CELL) + ',' + Math.floor(bo.y / CELL);
                    const o = P.cells[k] || (P.cells[k] = { t: 0, n: 0, spd: 0, con: 0, slow: 0,
                                                           spin: 0, esc: 0, reflex: 0, wig: 0, nav: 0 });
                    o.t += DT; o.n++; P.t += DT;
                    const v = (bo.speed || 0) * 60;
                    o.spd += v; if (v < 40) o.slow += DT;
                    if (hit[bo.name]) o.con += DT;
                    if (c.penaltySpin) o.spin += DT;
                    else if (c.escActive) o.esc += DT;
                    else if (c.iceEscapeTimer > 0) o.reflex += DT;
                    else if (c.wiggleActive) o.wig += DT;
                    else o.nav += DT;
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            for (const bo of state.boats) {
                if (bo.isPlayer || !per[bo.name]) continue;
                per[bo.name].fin = bo.raceState.finished ? 1 : 0;
            }
            return per;
        }, { seed: SEED0 + t, CELL, LEG });
        let f = 0;
        for (const nm in r) {
            if (!r[nm].fin) { dnf++; continue; }
            f++; botLaps++; botTotal += r[nm].t;
            for (const k in r[nm].cells) {
                const a = bot[k] || (bot[k] = { t: 0, n: 0, spd: 0, con: 0, slow: 0, spin: 0, esc: 0, reflex: 0, wig: 0, nav: 0 });
                for (const q in r[nm].cells[k]) a[q] += r[nm].cells[k][q];
            }
        }
        console.log(`seed ${SEED0 + t}: ${f} finishers counted`);
    }
    await b.close();

    const keys = new Set([...Object.keys(bot), ...Object.keys(herCells)]);
    const rows = [];
    for (const k of keys) {
        const B = bot[k] || { t: 0, n: 0, spd: 0, con: 0, slow: 0, spin: 0, esc: 0, reflex: 0, wig: 0, nav: 0 };
        const H = herCells[k] || { t: 0, n: 0, spd: 0 };
        rows.push({ k, bs: B.t / botLaps, hs: H.t / herLaps, d: B.t / botLaps - H.t / herLaps, B, H });
    }
    rows.sort((a, c) => c.d - a.d);
    const tag = LEG === null ? 'WHOLE LAP' : 'LEG ' + LEG;
    console.log(`\n=== ${VENUE.toUpperCase()} ${tag}: THE GAP BY PLACE (${TRIALS} seeds, ${CELL}u cells) ===`);
    console.log(`bot ${botLaps} finisher-laps  mean ${(botTotal / botLaps).toFixed(1)}s   |   her ${herLaps} lap(s)  mean ${(herTotal / herLaps).toFixed(1)}s`);
    console.log(`RECONCILIATION: sum of cell deltas ${rows.reduce((a, r) => a + r.d, 0).toFixed(1)}s  ==  mean gap ${(botTotal / botLaps - herTotal / herLaps).toFixed(1)}s  (DNF not counted: ${dnf})`);
    const totD = rows.reduce((a, r) => a + Math.max(0, r.d), 0);
    console.log(`\n cell centre       bot s/lap  her s/lap   DELTA  cum%   botSpd herSpd  slow%  con%   helm spin/esc/reflex/wig/nav`);
    let cum = 0;
    for (const r of rows.slice(0, 20)) {
        const [kx, ky] = r.k.split(',').map(Number);
        const cx = kx * CELL + CELL / 2, cy = ky * CELL + CELL / 2;
        cum += r.d;
        const B = r.B, P = (x) => (B.t ? (100 * x / B.t).toFixed(0) : '0').padStart(3) + '%';
        console.log(`(${String(Math.round(cx)).padStart(5)},${String(Math.round(cy)).padStart(6)})  ` +
            `${r.bs.toFixed(1).padStart(8)}  ${r.hs.toFixed(1).padStart(8)}  ${r.d.toFixed(1).padStart(6)}  ${(100 * cum / totD).toFixed(0).padStart(3)}%  ` +
            `${(B.n ? B.spd / B.n : 0).toFixed(0).padStart(5)}  ${(r.H.n ? r.H.spd / r.H.n : 0).toFixed(0).padStart(5)}  ` +
            `${P(B.slow)} ${P(B.con)}   ${P(B.spin)}/${P(B.esc)}/${P(B.reflex)}/${P(B.wig)}/${P(B.nav)}`);
    }
    const neverHers = rows.filter(r => r.hs === 0 && r.d > 0).reduce((a, r) => a + r.d, 0);
    console.log(`\nwater she NEVER enters: ${neverHers.toFixed(1)} s/lap of the gap (${(100 * neverHers / totD).toFixed(0)}% of all positive deltas)`);
    const top5 = rows.slice(0, 5).reduce((a, r) => a + r.d, 0);
    console.log(`top 5 cells: ${top5.toFixed(1)} s/lap (${(100 * top5 / totD).toFixed(0)}% of positive deltas)`);
    fs.writeFileSync(path.join(__dirname, `gapgrid_${VENUE}${LEG === null ? '' : '_L' + LEG}.json`),
        JSON.stringify({ venue: VENUE, cell: CELL, botLaps, herLaps, rows: rows.map(r => ({ k: r.k, bs: r.bs, hs: r.hs, d: r.d })) }));
})();
