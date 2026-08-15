// LEG 1 IS 19.6 s OF DISTANCE — IS IT POINTING, OR IS IT DETOUR? (2026-08-14)
// The reconciled per-leg split says glowtide's remaining 57 s/race is 65% distance,
// and leg 1 alone is 19.6 s of it. His beat is 1.458x the straight line (a 46.7°
// tacking angle); the fleet's is 1.783x (55.9°). Two very different causes fit:
//   POINTING — she sails a wider TWA than he does, so the same beat costs more ground.
//   DETOUR   — she points as well as he does but her PATH wanders (rocks, traffic,
//              carrot jumps), and the wide effective angle is the wander averaged in.
// They are separated by the TWA the boat actually holds. This prints the
// DISTANCE-WEIGHTED TWA distribution for both sides on one leg, and — because a beat
// mixes both tacks and the turns between them — restricts the headline to CLEAN
// frames: no avoidance deviation, not inside a tack window, not armed for a rounding.
//
// ⚠️ TWA 0 = HEAD TO WIND (standing note). Close-hauled is ~40-45°, not ~135°.
// ⚠️ Distances come from POSITIONS on both sides (standing rule 32).
//   node _glow_beatangle.js <venue> <leg> <trials> <seed0> <tree> [humanFingerprint]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const LEG = parseInt(process.argv[3]) || 1;
const TRIALS = parseInt(process.argv[4]) || 4;
const SEED0 = parseInt(process.argv[5]) || 9400;
const ROOT = path.join(__dirname, process.argv[6] || 'treeFINAL');
const FP = process.argv[7] || '771cd6a3:67190';

const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const BINS = [0, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 110, 130, 150, 180];
const binOf = d => { let i = 0; while (i < BINS.length - 1 && d >= BINS[i + 1]) i++; return i; };
const fmt = (hist, tot) => BINS.slice(0, -1).map((b, i) => hist[i] / tot > 0.005
    ? `${b}-${BINS[i + 1]}:${(100 * hist[i] / tot).toFixed(1)}%` : null).filter(Boolean).join('  ');
const wmed = (pairs) => {  // distance-weighted median TWA
    const s = pairs.slice().sort((a, b) => a[0] - b[0]);
    const tot = s.reduce((t, p) => t + p[1], 0); let c = 0;
    for (const p of s) { c += p[1]; if (c >= tot / 2) return p[0]; }
    return null;
};

// ── HIS SIDE, offline from the corpus ───────────────────────────────────────
const TD = path.join(__dirname, 'traj');
const hHist = new Array(BINS.length - 1).fill(0), hClean = new Array(BINS.length - 1).fill(0);
const hPairs = [], hCleanPairs = [];
let hDist = 0, hCleanDist = 0, hLaps = 0;
for (const f of fs.readdirSync(TD).filter(x => x.startsWith(`traj_${VENUE}_`))) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (j.venueFingerprint !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 3) continue;
    hLaps++;
    // his tack windows: playerTack flips. Mark +-1.0 s around each flip as dirty.
    const flips = [];
    for (let i = 1; i < S.length; i++) {
        const t = gi(S[i], 'playerTack'), p = gi(S[i - 1], 'playerTack');
        if (t !== p && t !== 0 && p !== 0) flips.push(gi(S[i], 't'));
    }
    for (let i = 1; i < S.length; i++) {
        const dx = gi(S[i], 'x') - gi(S[i - 1], 'x'), dy = gi(S[i], 'y') - gi(S[i - 1], 'y');
        const d = Math.hypot(dx, dy); if (d >= 200 || d <= 0) continue;
        const twa = Math.abs(norm(gi(S[i], 'hdg') - gi(S[i], 'windDir'))) * 180 / Math.PI;
        const b = binOf(twa); hHist[b] += d; hDist += d; hPairs.push([twa, d]);
        const tt = gi(S[i], 't');
        if (!flips.some(ft => Math.abs(ft - tt) < 1.0)) { hClean[b] += d; hCleanDist += d; hCleanPairs.push([twa, d]); }
    }
}

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage();
    await p.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const bHist = new Array(BINS.length - 1).fill(0), bClean = new Array(BINS.length - 1).fill(0);
    const bPairs = [], bCleanPairs = [];
    let bDist = 0, bCleanDist = 0, bLegs = 0;
    for (let i = 0; i < TRIALS; i++) {
        const r = await p.evaluate(async ({ seed, LEG, NB }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            const nrm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const bin = d => { let i = 0; while (i < NB.length - 1 && d >= NB[i + 1]) i++; return i; };
            const acc = {};
            for (const bt of state.boats) if (!bt.isPlayer) acc[bt.id] = {
                h: new Array(NB.length - 1).fill(0), c: new Array(NB.length - 1).fill(0),
                d: 0, cd: 0, px: null, py: null, lastTackT: -99, lastSide: null, seen: false, pairs: [], cpairs: []
            };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished) continue;
                    const a = acc[bt.id];
                    if (bt.raceState.leg !== LEG) { a.px = null; continue; }
                    a.seen = true;
                    const side = bt.lastWindSide;
                    if (a.lastSide != null && side !== a.lastSide && side !== undefined) a.lastTackT = state.time;
                    a.lastSide = side;
                    if (a.px === null) { a.px = bt.x; a.py = bt.y; continue; }
                    const d = Math.hypot(bt.x - a.px, bt.y - a.py);
                    a.px = bt.x; a.py = bt.y;
                    if (d <= 0 || d > 50) continue;
                    const w = window.getWindAt ? getWindAt(bt.x, bt.y) : state.wind;
                    const twa = Math.abs(nrm(bt.heading - w.direction)) * 180 / Math.PI;
                    const k = bin(twa);
                    a.h[k] += d; a.d += d; a.pairs.push([Math.round(twa * 10) / 10, d]);
                    const c = bt.controller || {};
                    const dirty = (c.lastAvoidDeviation || 0) > 0.08 || c.wiggleActive
                        || (state.time - a.lastTackT) < 4 * 0.24 || !!bt.raceState.roundArmed;
                    if (!dirty) { a.c[k] += d; a.cd += d; a.cpairs.push([Math.round(twa * 10) / 10, d]); }
                }
            }
            return Object.values(acc).filter(a => a.seen).map(a => ({ h: a.h, c: a.c, d: a.d, cd: a.cd, pairs: a.pairs, cpairs: a.cpairs }));
        }, { seed: SEED0 + i, LEG, NB: BINS });
        for (const q of r) {
            bLegs++;
            for (let k = 0; k < bHist.length; k++) { bHist[k] += q.h[k]; bClean[k] += q.c[k]; }
            bDist += q.d; bCleanDist += q.cd;
            bPairs.push(...q.pairs); bCleanPairs.push(...q.cpairs);
        }
        console.log(`seed ${SEED0 + i}: ${r.length} boat-legs`);
    }
    await b.close();

    console.log(`\n=== ${VENUE} leg ${LEG} — DISTANCE-WEIGHTED TWA (0 = head to wind) ===`);
    console.log(`HIM   (${hLaps} laps, ${Math.round(hDist)}u)   ${fmt(hHist, hDist)}`);
    console.log(`FLEET (${bLegs} boat-legs, ${Math.round(bDist)}u)   ${fmt(bHist, bDist)}`);
    console.log(`\n--- CLEAN only (no avoidance / tack window / armed) ---`);
    console.log(`HIM   (${Math.round(hCleanDist)}u, ${(100 * hCleanDist / hDist).toFixed(0)}% of his leg)   ${fmt(hClean, hCleanDist)}`);
    console.log(`FLEET (${Math.round(bCleanDist)}u, ${(100 * bCleanDist / bDist).toFixed(0)}% of the fleet's)   ${fmt(bClean, bCleanDist)}`);
    console.log(`\nweighted median TWA   him ${wmed(hPairs)}°  fleet ${wmed(bPairs)}°   | CLEAN  him ${wmed(hCleanPairs)}°  fleet ${wmed(bCleanPairs)}°`);
    // The beating band is what a wider tacking angle would move. Upwind = TWA < 70.
    const band = (pairs, lo, hi) => { const t = pairs.reduce((s, p) => s + p[1], 0); const q = pairs.filter(p => p[0] >= lo && p[0] < hi).reduce((s, p) => s + p[1], 0); return [q, 100 * q / t]; };
    for (const [lo, hi, name] of [[0, 30, 'in irons / pinching hard'], [30, 50, 'close-hauled 30-50'], [50, 70, 'FOOTING 50-70'], [70, 110, 'reaching 70-110'], [110, 180, 'running 110-180']]) {
        const [hu, hp] = band(hCleanPairs, lo, hi), [bu, bp] = band(bCleanPairs, lo, hi);
        console.log(`  ${name.padEnd(22)} him ${hp.toFixed(1).padStart(5)}% (${Math.round(hu)}u)   fleet ${bp.toFixed(1).padStart(5)}% (${Math.round(bu)}u)`);
    }
    fs.writeFileSync(path.join(__dirname, `_glow_beatangle_${VENUE}_L${LEG}.json`),
        JSON.stringify({ BINS, him: hHist, hClean, hDist, hCleanDist, fleet: bHist, bClean, bDist, bCleanDist, bLegs, hLaps }, null, 1));
})();
