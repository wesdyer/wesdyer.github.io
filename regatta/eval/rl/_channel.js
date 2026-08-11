// TWO WAYS PAST THE ROCK — WHICH ONE DOES EACH OF THEM TAKE? (2026-08-11, redrock)
//
// Redrock's sw inlet has TWO channels between the sw mark and the water to the
// north, separated by the rock at (-1008..-896, -1448..-1314): a WEST slot about
// 100-140u wide against the main shore, and a wider EAST one. After the
// turn-limited probe landed (`6bf66ff`), `_slot_line` says the fleet at y=-1400
// is no longer displaced off its route at all — plan minus boat went +227u to
// −3u — and is STILL doing 24 u/s, while the plan there sits 395u WEST of his
// line. That is a different failure from the one just fixed: not "she is pushed
// off her route" but possibly "her route goes the wrong way".
//
// ⚠️ A MEDIAN x POOLED OVER LEGS CANNOT ANSWER THIS. Leg 2 enters the inlet and
// leg 3 leaves it, and a sailor may legitimately go down one side and back up the
// other — which would make a pooled median describe a line neither of them sails
// (the same shape as rule 26's medians-do-not-add). So split by LEG, and report
// SHARES rather than a central tendency, for him and for the fleet.
//
// usage: node _channel.js <venue> <trials> <seed0> <tree> [xsplit y0 y1 fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTRK2');
const XSPLIT = process.argv[6] !== undefined ? parseFloat(process.argv[6]) : -950;
const Y0 = process.argv[7] !== undefined ? parseFloat(process.argv[7]) : -1500;
const Y1 = process.argv[8] !== undefined ? parseFloat(process.argv[8]) : -1300;
const FParg = (process.argv[9] || '').startsWith('fp=') ? process.argv[9].slice(3).split(',') : null;

const her = {};
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const rows = j.samples.filter(s => gi(s, 'phase') === 1);
    const dts = [];
    for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
    dts.sort((a, b) => a - b); const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
    for (const s of rows) {
        const y = gi(s, 'y'); if (y < Y0 || y >= Y1) continue;
        const lg = gi(s, 'leg'), side = gi(s, 'x') < XSPLIT ? 'W' : 'E';
        const o = her[lg] || (her[lg] = { W: 0, E: 0, Wv: 0, Ev: 0, Wn: 0, En: 0 });
        o[side] += DT; o[side + 'v'] += gi(s, 'spd') * 60; o[side + 'n']++;
    }
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const bot = {}; let laps = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, XSPLIT, Y0, Y1 }) => {
            const B = {};
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60; let n = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    if (bo.y < Y0 || bo.y >= Y1) continue;
                    const lg = bo.raceState.leg, side = bo.x < XSPLIT ? 'W' : 'E';
                    const o = B[lg] || (B[lg] = { W: 0, E: 0, Wv: 0, Ev: 0, Wn: 0, En: 0 });
                    o[side] += DT; o[side + 'v'] += (bo.speed || 0) * 60; o[side + 'n']++;
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            for (const bo of state.boats) if (!bo.isPlayer && bo.raceState.finished) n++;
            return { B, n };
        }, { seed: SEED0 + t, XSPLIT, Y0, Y1 });
        laps += r.n;
        for (const lg in r.B) { const a = bot[lg] || (bot[lg] = { W: 0, E: 0, Wv: 0, Ev: 0, Wn: 0, En: 0 }); for (const k in r.B[lg]) a[k] += r.B[lg][k]; }
        console.log(`seed ${SEED0 + t}: ${r.n} finishers`);
    }
    await b.close();

    const herLaps = 3;
    console.log(`\n=== ${VENUE.toUpperCase()}: WHICH SIDE OF THE ROCK, BY LEG ===`);
    console.log(`band y in [${Y0},${Y1}), split at x=${XSPLIT} (W = the narrow slot against the main shore)`);
    console.log(`\n leg |            HIM (per lap)            |           THE FLEET (per finisher-lap)`);
    console.log(`     |   W s    E s   W share  W spd  E spd |    W s     E s   W share  W spd  E spd`);
    const legs = new Set([...Object.keys(her), ...Object.keys(bot)]);
    for (const lg of [...legs].sort((a, c) => a - c)) {
        const H = her[lg] || { W: 0, E: 0, Wv: 0, Ev: 0, Wn: 0, En: 0 };
        const B = bot[lg] || { W: 0, E: 0, Wv: 0, Ev: 0, Wn: 0, En: 0 };
        const sh = (o) => (o.W + o.E) > 0 ? (100 * o.W / (o.W + o.E)).toFixed(0) + '%' : '-';
        const sp = (o, s) => o[s + 'n'] ? (o[s + 'v'] / o[s + 'n']).toFixed(0) : '-';
        console.log(`  ${String(lg).padStart(2)} | ${(H.W / herLaps).toFixed(1).padStart(6)} ${(H.E / herLaps).toFixed(1).padStart(6)}  ${sh(H).padStart(7)}  ${sp(H, 'W').padStart(5)}  ${sp(H, 'E').padStart(5)} | ` +
            `${(B.W / laps).toFixed(1).padStart(7)} ${(B.E / laps).toFixed(1).padStart(7)}  ${sh(B).padStart(7)}  ${sp(B, 'W').padStart(5)}  ${sp(B, 'E').padStart(5)}`);
    }
    const hw = Object.values(her).reduce((a, o) => a + o.W, 0) / herLaps, he = Object.values(her).reduce((a, o) => a + o.E, 0) / herLaps;
    const bw = Object.values(bot).reduce((a, o) => a + o.W, 0) / laps, be = Object.values(bot).reduce((a, o) => a + o.E, 0) / laps;
    console.log(`\n TOTAL per lap:  him  W ${hw.toFixed(1)}s / E ${he.toFixed(1)}s (W ${(100 * hw / (hw + he || 1)).toFixed(0)}%)   ` +
        `fleet  W ${bw.toFixed(1)}s / E ${be.toFixed(1)}s (W ${(100 * bw / (bw + be || 1)).toFixed(0)}%)`);
})();
