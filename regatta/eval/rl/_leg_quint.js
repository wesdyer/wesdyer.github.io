// LEG QUINTILE TABLE (2026-08-09, owner table request): one leg, binned into
// NB arc-length bands by _leg_where's projector (same rule both sides).
// Reports per band: human med/best (fp-matched laps), bot med/best of
// per-boat-race durations (FINISHERS only, matching the per-leg table), and
// per-boat-race boat/land contact med+mean (ocean_bench's 0.5s dedup).
//   node _leg_quint.js <venue> <leg> <NB> <trials> <seed0> <tree> [fp=<hash>]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2];
const LEG = parseInt(process.argv[3]);
const NB = parseInt(process.argv[4]) || 5;
const TRIALS = parseInt(process.argv[5]) || 8;
const SEED0 = parseInt(process.argv[6]) || 9400;
const ROOT = path.join(__dirname, process.argv[7] || 'treeB1');
const FP = (process.argv[8] || '').startsWith('fp=') ? process.argv[8].slice(3).split(',') : null;

const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 5) continue;
    laps.push({ file: f.slice(5, -5), fin: j.finishTime,
        pts: S.map(s => [gi(s, 'x'), gi(s, 'y'), gi(s, 't')]) });
}
console.log(`${laps.length} fp-matched human laps`);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    // human quintiles, binned in-page by the course's own leg polyline
    const hum = await page.evaluate(async (arg) => {
        const { LEG, NB, laps } = arg;
        window.evalHarness.seed = 9100; window.resetGame(); window.startRace(); window.update(1 / 60);
        const leg = state.course.dmc.legs[LEG];
        const P = leg.pts, C = leg.cum, L = leg.length || C[C.length - 1] || 1;
        window.__proj3 = (x, y) => {
            let best = Infinity, bs = 0;
            for (let i = 1; i < P.length; i++) {
                const a = P[i - 1], b = P[i];
                const vx = b.x - a.x, vy = b.y - a.y, wx = x - a.x, wy = y - a.y;
                const dd = vx * vx + vy * vy;
                let t = dd ? (wx * vx + wy * vy) / dd : 0; t = Math.max(0, Math.min(1, t));
                const px = a.x + t * vx, py = a.y + t * vy;
                const d2 = (x - px) * (x - px) + (y - py) * (y - py);
                if (d2 < best) { best = d2; bs = C[i - 1] + t * Math.hypot(vx, vy); }
            }
            return Math.max(0, Math.min(NB - 1, Math.floor(bs / L * NB)));
        };
        const out = [];
        for (const lap of laps) {
            const t = new Array(NB).fill(0);
            for (let i = 1; i < lap.pts.length; i++) {
                const dt = lap.pts[i][2] - lap.pts[i - 1][2];
                if (dt <= 0 || dt > 2) continue;
                t[window.__proj3(lap.pts[i][0], lap.pts[i][1])] += dt;
            }
            out.push({ file: lap.file, t });
        }
        return { legLen: Math.round(L), quints: out };
    }, { LEG, NB, laps });
    console.log(`leg ${LEG} length ${hum.legLen}u; human per-quintile:`);
    for (const h of hum.quints) console.log(' ', h.file, h.t.map(x => x.toFixed(1)).join(' / '));

    // collision hook once; __qc reset per race
    await page.evaluate((LEG) => {
        const inner = window.onRaceEvent;
        window.__qc = {}; window.__qcT = {};
        const mono = () => state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
        window.onRaceEvent = (ty, d) => {
            try {
                if (d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished
                    && d.boat.raceState.leg === LEG
                    && (ty === 'collision_boat' || ty === 'collision_island')) {
                    const cat = ty === 'collision_boat' ? 'boat' : (d.isFloe ? 'floe' : 'land');
                    if (cat !== 'floe') {
                        const k = d.boat.name + ':' + cat, t = mono();
                        if (window.__qcT[k] == null || t - window.__qcT[k] >= 0.5) {
                            window.__qcT[k] = t;
                            const bin = window.__proj3(d.boat.x, d.boat.y);
                            const c = window.__qc[d.boat.name] = window.__qc[d.boat.name]
                                || { boat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], land: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
                            c[cat][bin] += 1;
                        }
                    }
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    }, LEG);

    const durRows = [], colRows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (arg) => {
            const { seed, LEG, NB } = arg;
            window.__qc = {}; window.__qcT = {};
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            // rebuild projector on this race's course object
            const leg = state.course.dmc.legs[LEG];
            const P = leg.pts, C = leg.cum, L = leg.length || C[C.length - 1] || 1;
            window.__proj3 = (x, y) => {
                let best = Infinity, bs = 0;
                for (let i = 1; i < P.length; i++) {
                    const a = P[i - 1], b = P[i];
                    const vx = b.x - a.x, vy = b.y - a.y, wx = x - a.x, wy = y - a.y;
                    const dd = vx * vx + vy * vy;
                    let t = dd ? (wx * vx + wy * vy) / dd : 0; t = Math.max(0, Math.min(1, t));
                    const px = a.x + t * vx, py = a.y + t * vy;
                    const d2 = (x - px) * (x - px) + (y - py) * (y - py);
                    if (d2 < best) { best = d2; bs = C[i - 1] + t * Math.hypot(vx, vy); }
                }
                return Math.max(0, Math.min(NB - 1, Math.floor(bs / L * NB)));
            };
            const T = {};
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0 && state.race.status === 'racing') {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished || b.raceState.leg !== LEG) continue;
                        const tb = T[b.name] = T[b.name] || new Array(NB).fill(0);
                        tb[window.__proj3(b.x, b.y)] += 0.1;
                    }
                }
                if (state.race.status === 'finished') break;
            }
            const fins = {};
            for (const b of state.boats) if (!b.isPlayer) fins[b.name] = !!b.raceState.finished;
            return { T, qc: window.__qc, fins };
        }, { seed, LEG, NB });
        const nf = Object.values(r.fins).filter(Boolean).length;
        console.log(`seed ${seed}: ${Object.keys(r.T).length} boats sailed leg ${LEG}, fins ${nf}`);
        for (const nm of Object.keys(r.fins)) {
            if (r.fins[nm] && r.T[nm]) durRows.push(r.T[nm]);
            const c = r.qc[nm] || { boat: new Array(NB).fill(0), land: new Array(NB).fill(0) };
            colRows.push({ boat: c.boat.slice(0, NB), land: c.land.slice(0, NB) });
        }
    }
    await browser.close();

    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    console.log(`\n=== ${VENUE} leg ${LEG} in ${NB} bands: bot n=${durRows.length} finishing boat-races, contacts n=${colRows.length} boat-races ===`);
    console.log('band   human med/best     bot med/best    ratio   boatcol med/mean   landcol med/mean');
    for (let b2 = 0; b2 < NB; b2++) {
        const hu = hum.quints.map(h => h.t[b2]);
        const hm = q(hu, .5), hb = Math.min(...hu);
        const bd = durRows.map(r => r[b2]);
        const bm = q(bd, .5), bb = Math.min(...bd);
        const bc = colRows.map(r => r.boat[b2]), lc = colRows.map(r => r.land[b2]);
        console.log(`  ${b2}    ${hm.toFixed(1)} / ${hb.toFixed(1)}      ${bm.toFixed(1)} / ${bb.toFixed(1)}     ${(bm / hm).toFixed(2)}    ${q(bc, .5)} / ${mean(bc).toFixed(2)}         ${q(lc, .5)} / ${mean(lc).toFixed(2)}`);
    }
})();
