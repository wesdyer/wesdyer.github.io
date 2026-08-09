// WHERE DOES RIVER LEG 3 GO? (2026-08-08 night, THE SECTION PUSH P3b)
// The per-leg matrix (_leg_matrix.js, human lap on the FROZEN river) put 80% of the
// river's whole gap on ONE leg: index 3, human 80.4 s vs bot median 151.0 s (1.88x)
// over the course's longest run (legLens 9782). This is the redrock decomposition
// treatment applied there: bin the leg by NORTHING (the river runs south->north, so
// y is monotone progress for both sides and needs no leg-progress field), and for
// each bin report the time each side spends in it — then, for the bot only, why.
//
//   node _riv_where.js <trials> <seed0> <tree>
//
// ⚠️ SAMPLING CREDIT (rule 18): sampled every 6th frame at 60 fps, so each sample is
// worth exactly 0.1 s — the same convention _rr_why.js uses. The human side credits
// real sample-clock deltas, never a per-sample constant.
// ⚠️ Human laps are filtered to the frozen-river fingerprint; the corpus's other
// river lap (161.3) is on a retired document (_traj_fp.js).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeCP1');
const FROZEN_FP = 'f2b03316:36253';
const NB = 10;
const Y0 = -3447, Y1 = 9476;                     // leg-3 start mark -> finish line
const binOf = (y) => Math.max(0, Math.min(NB - 1, Math.floor((y - Y0) / (Y1 - Y0) * NB)));

// ── HUMAN ───────────────────────────────────────────────────────────────────────
const hBin = new Array(NB).fill(0); const hSpd = Array.from({ length: NB }, () => []);
const hX = Array.from({ length: NB }, () => []);
let hLaps = 0;
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_river_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (j.venueFingerprint !== FROZEN_FP) continue;
    hLaps++;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === 3);
    for (let i = 1; i < S.length; i++) {
        const dt = gi(S[i], 't') - gi(S[i - 1], 't');
        if (dt <= 0 || dt > 2) continue;
        const b = binOf(gi(S[i], 'y'));
        // ⚠️ UNITS (rule 18): the recording stores `spd` as the raw per-frame boat
        // speed; every bot statistic in this campaign is speed*60 in u/s. The first
        // run of this probe printed "human 2.1 kt vs bot 112" side by side, which is
        // the same number, and would have read as the human crawling where she is in
        // fact at full pace. Multiply here, once, at the source.
        hBin[b] += dt; hSpd[b].push(gi(S[i], 'spd') * 60);
        hX[b].push(gi(S[i], 'x'));
    }
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const bBin = new Array(NB).fill(0), bSlow = new Array(NB).fill(0), bSpd = Array.from({ length: NB }, () => []);
    const why = {}, slowX = {}; let boatLegs = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (arg) => {
            const { seed, NB, Y0, Y1 } = arg;
            const binOf = (y) => Math.max(0, Math.min(NB - 1, Math.floor((y - Y0) / (Y1 - Y0) * NB)));
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const tBin = new Array(NB).fill(0), sBin = new Array(NB).fill(0);
            const spd = Array.from({ length: NB }, () => []);
            const w = {}; const add = (k, v) => w[k] = (w[k] || 0) + v;
            const sx = {};   // x of every SLOW sample, by bin: names the pocket
            const seen = new Set();
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0 && state.race.status === 'racing') {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished) continue;
                        if (b.raceState.leg !== 3) continue;
                        seen.add(b.name);
                        const bi = binOf(b.y);
                        tBin[bi] += 0.1;
                        const kt = b.speed * 60;
                        spd[bi].push(kt);
                        if (kt >= 40) continue;              // SLOW frames only below
                        sBin[bi] += 0.1;
                        add('slow', 1);
                        const ct = b.controller;
                        if (ct && ct.wiggleActive) add('wiggle', 1);
                        if (ct && ct.riskState && ct.riskState !== 'LOW') add('risk_' + ct.riskState, 1);
                        if (b.raceState.roundArmed) add('armed', 1);
                        if (b.penaltyTurnsOwed > 0) add('penTurn', 1);
                        const wd = getWindAt(b.x, b.y);
                        const twa = Math.abs(normalizeAngle(b.heading - wd.direction));
                        if (twa < 0.5) add('inIrons', 1);
                        else if (twa > Math.PI - 0.5) add('deadRun', 1);
                        if (ct && Math.abs(ct.lastAvoidDeviation || 0) > 0.26) add('deflected', 1);
                        const g = state.course.botGrid;
                        let blocked = 0;
                        for (const dd of [90, 180]) {
                            const cc = g.cell(b.x + Math.sin(b.heading) * dd, b.y - Math.cos(b.heading) * dd);
                            if (!g.at(cc[0], cc[1])) { blocked = 1; break; }
                        }
                        if (blocked) add('landAhead', 1);
                        // BANK PROXIMITY: the river's named-but-unsized class. Nearest
                        // hard cell within 200u, in the clearance field the router uses.
                        const cc0 = g.cell(b.x, b.y);
                        const cl = g._clear ? g._clear[cc0[1] * g.n + cc0[0]] : null;
                        if (cl != null && cl <= 2) add('nearBank', 1);
                        add('bin_' + bi, 1);
                        (sx[bi] = sx[bi] || []).push(Math.round(b.x));
                    }
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return { tBin, sBin, spd: spd.map(a => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null), w, n: seen.size, sx };
        }, { seed, NB, Y0, Y1 });
        for (let k = 0; k < NB; k++) { bBin[k] += r.tBin[k]; bSlow[k] += r.sBin[k]; if (r.spd[k] != null) bSpd[k].push(r.spd[k]); }
        for (const [k, v] of Object.entries(r.w)) why[k] = (why[k] || 0) + v;
        for (const [k, v] of Object.entries(r.sx || {})) (slowX[k] = slowX[k] || []).push(...v);
        boatLegs += r.n;
        console.log(`seed ${seed}: boats on leg3 ${r.n}  leg3 boat-seconds ${r.tBin.reduce((a, b) => a + b, 0).toFixed(0)}`);
    }
    await browser.close();

    const hTot = hBin.reduce((a, b) => a + b, 0);
    console.log(`\nRIVER LEG 3 BY NORTHING — human ${hLaps} lap(s) on the frozen river, bot ${boatLegs} boat-legs`);
    console.log(`bin   y-range           human s   bot s/boat   DELTA    bot slow s   human u/s  bot u/s   her x   bot SLOW x [range]`);
    let cum = 0;
    for (let k = 0; k < NB; k++) {
        const y0 = Math.round(Y0 + (Y1 - Y0) * k / NB), y1 = Math.round(Y0 + (Y1 - Y0) * (k + 1) / NB);
        const bs = bBin[k] / (boatLegs || 1), d = bs - hBin[k] / (hLaps || 1);
        cum += d;
        console.log(`${String(k).padStart(3)}  ${String(y0).padStart(6)}..${String(y1).padStart(6)}` +
            `  ${(hBin[k] / (hLaps || 1)).toFixed(1).padStart(9)}  ${bs.toFixed(1).padStart(10)}  ${d.toFixed(1).padStart(7)}` +
            `  ${(bSlow[k] / (boatLegs || 1)).toFixed(1).padStart(11)}` +
            `  ${(med(hSpd[k]) || 0).toFixed(0).padStart(9)}  ${(med(bSpd[k]) || 0).toFixed(0).padStart(6)}` +
            `  ${med(hX[k]) != null ? String(Math.round(med(hX[k]))).padStart(7) : '      -'}` +
            `  ${slowX[k] && slowX[k].length ? (String(Math.round(med(slowX[k]))) + ' [' + Math.min(...slowX[k]) + '..' + Math.max(...slowX[k]) + ']').padStart(20) : ''}`);
    }
    console.log(`TOT                    ${(hTot / (hLaps || 1)).toFixed(1).padStart(9)}` +
        `  ${(bBin.reduce((a, b) => a + b, 0) / (boatLegs || 1)).toFixed(1).padStart(10)}  ${cum.toFixed(1).padStart(7)}` +
        `  ${(bSlow.reduce((a, b) => a + b, 0) / (boatLegs || 1)).toFixed(1).padStart(11)}`);
    const sl = why.slow || 1;
    console.log(`\nWHY SLOW on leg 3 (share of the ${(sl * 0.1 / (boatLegs || 1)).toFixed(1)} s/boat below 40 u/s):`);
    for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1])) {
        if (k === 'slow' || k.startsWith('bin_')) continue;
        console.log(`  ${k}: ${Math.round(100 * v / sl)}%`);
    }
    console.log(`  slow-time by bin: ${Array.from({ length: NB }, (_, k) => (why['bin_' + k] || 0)).map((v, k) => k + ':' + Math.round(100 * v / sl) + '%').join(' ')}`);
})();
