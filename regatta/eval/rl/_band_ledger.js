// WHERE THE PATH GOES AND WHAT IT BUYS (2026-08-27, closing the atlas question).
// The distance atlas rules out pointing, tack split, off-chord alignment and
// micro-steering, and the residue was located by ARITHMETIC: the off-chord
// cosine was averaged only over frames inside the working band while the
// odometer counts every frame, so the excess must live outside it. This
// measures that directly instead of deriving it.
//
// Every frame of the leg is bucketed by |TWA|, and each bucket records the three
// quantities that decide the question:
//   seconds  — how much of the leg is spent there
//   path     — ground distance travelled there (positions, standing rule 32)
//   progress — NET displacement along the leg's own chord gained there
// efficiency = progress / path. A bucket with lots of path and no progress is
// where the extra distance is. Computed identically for him and for the fleet.
//   node _band_ledger.js <venue> <leg> <trials> <seed0> <tree> [fp]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '6'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeSPP');
const FP = process.argv[7] || null;
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// bands in degrees of |TWA|
const BANDS = [[0,30,'pinch / no-go'],[30,50,'close-hauled'],[50,75,'wide of CH'],[75,110,'reaching'],[110,181,'deep']];
const bandOf = d => BANDS.findIndex(b => d >= b[0] && d < b[1]);
const blank = () => BANDS.map(() => ({ t: 0, path: 0, prog: 0 }));

const TD = path.join(__dirname, 'traj');
const hum = blank();
let humLaps = 0;
for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && String(j.venueFingerprint) !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 10) continue;
    humLaps++;
    const ax = gi(S[0], 'x'), ay = gi(S[0], 'y');
    const bx = gi(S[S.length-1], 'x'), by = gi(S[S.length-1], 'y');
    const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
    for (let i = 1; i < S.length; i++) {
        const d = Math.abs(norm(gi(S[i], 'hdg') - gi(S[i], 'windDir'))) * 180 / Math.PI;
        const k = bandOf(d); if (k < 0) continue;
        const dx = gi(S[i],'x') - gi(S[i-1],'x'), dy = gi(S[i],'y') - gi(S[i-1],'y');
        hum[k].t += gi(S[i],'t') - gi(S[i-1],'t');
        hum[k].path += Math.hypot(dx, dy);
        hum[k].prog += dx * ux + dy * uy;
    }
}
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const bot = blank(); let botLegs = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG, BANDS }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a,x)=>a+x.ai.startLinePct,0)/nine.length));
            pl.ai.setupDist = 300;
            const nm = a => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
            const bandOf = d => BANDS.findIndex(b => d >= b[0] && d < b[1]);
            const A = {}; const out = []; const dt = 1/60;
            let prev = state.boats.map(b => ({x:b.x,y:b.y}));
            for (let it = 0; it < 60*940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') { prev = state.boats.map(b=>({x:b.x,y:b.y})); continue; }
                if (state.race.timer > 900) break;
                state.boats.forEach((b,k) => {
                    if (b.raceState.finished) return;
                    const a = A[b.name] = A[b.name] || { leg: null };
                    if (a.leg !== b.raceState.leg) {
                        if (a.leg === LEG && a.rows) out.push({ x0:a.x0, y0:a.y0, x1:b.x, y1:b.y, rows:a.rows });
                        a.leg = b.raceState.leg; a.x0 = b.x; a.y0 = b.y; a.rows = [];
                    }
                    if (b.raceState.leg !== LEG) return;
                    const d = Math.abs(nm(b.heading - getWindAt(b.x,b.y).direction)) * 180/Math.PI;
                    const kk = bandOf(d); if (kk < 0) return;
                    if (a.rows.length < 40000) a.rows.push([kk, b.x - prev[k].x, b.y - prev[k].y]);
                });
                prev = state.boats.map(b => ({x:b.x,y:b.y}));
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG, BANDS });
        for (const leg of r) {
            botLegs++;
            const L = Math.hypot(leg.x1-leg.x0, leg.y1-leg.y0) || 1;
            const ux = (leg.x1-leg.x0)/L, uy = (leg.y1-leg.y0)/L;
            for (const [k,dx,dy] of leg.rows) {
                bot[k].t += 1/60; bot[k].path += Math.hypot(dx,dy); bot[k].prog += dx*ux + dy*uy;
            }
        }
    }
    await br.close();
    const show = (name, acc, laps) => {
        const T = acc.reduce((s,b)=>s+b.t,0), P = acc.reduce((s,b)=>s+b.path,0);
        console.log(`\n  ${name}  (${laps} legs)   total ${(T/laps).toFixed(1)} s, ${(P/laps).toFixed(0)} u of path`);
        console.log('    band              time%   path/leg   progress/leg   efficiency');
        BANDS.forEach((b,i) => {
            const a = acc[i];
            console.log(`    ${b[2].padEnd(16)} ${(100*a.t/T).toFixed(1).padStart(5)}%  ${(a.path/laps).toFixed(0).padStart(8)}   ${(a.prog/laps).toFixed(0).padStart(12)}   ${a.path > 0 ? (a.prog/a.path).toFixed(3).padStart(10) : '         -'}`);
        });
    };
    console.log(`\n══ ${VENUE} leg ${LEG} — where the path goes and what it buys`);
    show('HIM  ', hum, humLaps);
    show('FLEET', bot, botLegs);
})();
