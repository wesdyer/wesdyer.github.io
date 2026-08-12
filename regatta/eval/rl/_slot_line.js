// THE FLEET IS ON THE WEST WALL AND SHE IS NOT — IS THAT THE ROUTE OR THE RESPONSE?
// (2026-08-11, redrock's sw inlet)
//
// `_gap_grid.js` put 24.1 s/lap — 16% of redrock's whole 150.8 s/lap gap — in two
// adjacent cells at x = -1125, y from -1750 to -1250: the WEST WALL of the sw
// inlet. The bots spend 25.1 s/lap there at 24-46 u/s; she spends 0.9 s/lap at
// 95-107 u/s, because her line runs 100-400u further east down the middle of the
// same inlet. Standing rule 17 says route pricing cannot reach a displacement
// failure and displacement fixes cannot reach a routing failure, so the first
// question is which one this is, and it is answerable directly:
//
// For each 50u band of latitude through the inlet, print
//   * where SHE is (median x of her fingerprint-verified track)
//   * where the BOTS are (occupancy-weighted median x)
//   * where their OWN PLAN is (`controller.gridPath`, the A* route from
//     `pathSailable` at ~2062, crossing that same band)
//
// If the plan runs down the middle and the boats are on the wall, this is
// displacement and the fix is in the response. If the plan itself hugs the wall,
// it is the router and the response layer cannot reach it.
//
// usage: node _slot_line.js <venue> <trials> <seed0> <tree> [y0 y1 fp=...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treePR11');
const Y0 = process.argv[6] !== undefined ? parseFloat(process.argv[6]) : -1900;
const Y1 = process.argv[7] !== undefined ? parseFloat(process.argv[7]) : -1150;
const FParg = (process.argv[8] || '').startsWith('fp=') ? process.argv[8].slice(3).split(',') : null;
const BAND = 50;

const nb = (y) => Math.floor((y - Y0) / BAND);
const her = {};
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FParg && !FParg.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    for (const s of j.samples) {
        if (gi(s, 'phase') !== 1) continue;
        const y = gi(s, 'y'); if (y < Y0 || y >= Y1) continue;
        (her[nb(y)] || (her[nb(y)] = { x: [], v: [] })).x.push(gi(s, 'x'));
        her[nb(y)].v.push(gi(s, 'spd') * 60);
    }
}

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const bot = {};
    let noPlan = 0, withPlan = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, Y0, Y1, BAND }) => {
            const nb = (y) => Math.floor((y - Y0) / BAND);
            const B = {}; let np = 0, wp = 0;
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    if (bo.y < Y0 || bo.y >= Y1) continue;
                    const c = bo.controller; if (!c) continue;
                    const k = nb(bo.y);
                    const o = B[k] || (B[k] = { n: 0, x: [], v: [], px: [], land: 0 });
                    o.n++; o.x.push(bo.x); o.v.push((bo.speed || 0) * 60);
                    // where the boat's OWN plan crosses this same band, ahead of her
                    const gp = c.gridPath;
                    if (gp && gp.length) {
                        wp++;
                        let prev = { x: bo.x, y: bo.y }, found = null;
                        for (const q of gp) {
                            if ((prev.y - (Y0 + k * BAND + BAND / 2)) * (q.y - (Y0 + k * BAND + BAND / 2)) <= 0 && q.y !== prev.y) {
                                const f = ((Y0 + k * BAND + BAND / 2) - prev.y) / (q.y - prev.y);
                                found = prev.x + f * (q.x - prev.x); break;
                            }
                            prev = q;
                        }
                        if (found !== null) o.px.push(found);
                    } else np++;
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            return { B, np, wp };
        }, { seed: SEED0 + t, Y0, Y1, BAND });
        noPlan += r.np; withPlan += r.wp;
        for (const k in r.B) {
            const a = bot[k] || (bot[k] = { n: 0, x: [], v: [], px: [] });
            a.n += r.B[k].n; a.x.push(...r.B[k].x); a.v.push(...r.B[k].v); a.px.push(...r.B[k].px);
        }
        console.log(`seed ${SEED0 + t} done`);
    }
    await b.close();

    const med = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    console.log(`\n=== ${VENUE.toUpperCase()} SW INLET: HER LINE vs THEIR LINE vs THEIR PLAN (${TRIALS} seeds) ===`);
    console.log(`plan present on ${(100 * withPlan / (withPlan + noPlan || 1)).toFixed(0)}% of in-band bot frames`);
    console.log(`\n   y band     her x  her spd  |   bot x  bot spd   boat-s  |  PLAN x   plan-bot   plan-her`);
    for (let k = 0; k * BAND + Y0 < Y1; k++) {
        const H = her[k], B = bot[k];
        if (!B && !H) continue;
        const hx = H ? med(H.x) : NaN, bx = B ? med(B.x) : NaN, px = B ? med(B.px) : NaN;
        console.log(`${String(Y0 + k * BAND).padStart(7)}   ` +
            `${(H ? med(H.x).toFixed(0) : '-').padStart(7)}  ${(H ? med(H.v).toFixed(0) : '-').padStart(6)}   |  ` +
            `${(B ? med(B.x).toFixed(0) : '-').padStart(6)}  ${(B ? med(B.v).toFixed(0) : '-').padStart(6)}  ` +
            `${(B ? (B.n / 60).toFixed(0) : '-').padStart(7)}  |  ` +
            `${(B && B.px.length ? med(B.px).toFixed(0) : '-').padStart(6)}   ` +
            `${(isFinite(px - bx) ? (px - bx).toFixed(0) : '-').padStart(8)}   ` +
            `${(isFinite(px - hx) ? (px - hx).toFixed(0) : '-').padStart(8)}`);
    }
    console.log(`\nplan-bot > 0 means the PLAN is east of where the boats actually are (they are displaced WEST of their own route)`);
    console.log(`plan-her ~ 0 means the router agrees with her line`);
})();
