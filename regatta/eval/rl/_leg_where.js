// WHICH PART OF THE COURSE? — the subsection probe, venue-agnostic (2026-08-09)
// _riv_where.js answered this for the river by binning on northing, which only works
// because the river runs south->north. Every leg carries its own polyline in
// `state.course.dmc.legs[k]` (`pts` + `cum` + `length`), so the general form bins by
// ARC LENGTH ALONG THE LEG: project a position onto the leg polyline, take cumulative
// distance / leg length, and both sides are binned by the identical rule.
//
//   node _leg_where.js <venue> <legIndex> <trials> <seed0> <tree> [fp=<hash>,<hash>]
//
// ⚠️ Both sides are binned INSIDE the page by the same projector — the human samples
// are passed in rather than binned offline, so no second implementation can drift.
// ⚠️ SAMPLING CREDIT (rule 18): every 6th frame at 60 fps = exactly 0.1 s per sample.
//    The human side credits real sample-clock deltas.
// ⚠️ Human laps that carry a fingerprint are filtered with fp=; unstamped schema-1
//    laps are used only when the venue's frozen and shipping docs match, and the
//    header says which case applies (see _traj_fp.js / regatta-corpus-fingerprints).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2];
const LEG = parseInt(process.argv[3]);
const TRIALS = parseInt(process.argv[4]) || 4;
const SEED0 = parseInt(process.argv[5]) || 9100;
const ROOT = path.join(__dirname, process.argv[6] || 'treeNOW');
const FP = (process.argv[7] || '').startsWith('fp=') ? process.argv[7].slice(3).split(',') : null;
const NB = 10;

const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 5) continue;
    laps.push({ file: f.slice(5, -5), fin: j.finishTime, fp: j.venueFingerprint,
        pts: S.map(s => [gi(s, 'x'), gi(s, 'y'), gi(s, 't'), gi(s, 'spd') * 60]) });
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const hum = await page.evaluate(async (arg) => {
        const { LEG, NB, laps } = arg;
        window.evalHarness.seed = 9100; window.resetGame(); window.startRace(); window.update(1 / 60);
        const leg = state.course.dmc.legs[LEG];
        const P = leg.pts, C = leg.cum, L = leg.length || C[C.length - 1] || 1;
        window.__proj = (x, y) => {
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
            const t = new Array(NB).fill(0), sp = Array.from({ length: NB }, () => []), xy = Array.from({ length: NB }, () => []);
            for (let i = 1; i < lap.pts.length; i++) {
                const dt = lap.pts[i][2] - lap.pts[i - 1][2];
                if (dt <= 0 || dt > 2) continue;
                const b = window.__proj(lap.pts[i][0], lap.pts[i][1]);
                t[b] += dt; sp[b].push(lap.pts[i][3]); xy[b].push([Math.round(lap.pts[i][0]), Math.round(lap.pts[i][1])]);
            }
            out.push({ file: lap.file, fin: lap.fin, t, sp, xy });
        }
        return { legLen: Math.round(L), laps: out };
    }, { LEG, NB, laps });

    const bBin = new Array(NB).fill(0), bSlow = new Array(NB).fill(0);
    const bSpd = Array.from({ length: NB }, () => []); const why = {};
    let boatLegs = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (arg) => {
            const { seed, LEG, NB } = arg;
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const leg = state.course.dmc.legs[LEG];
            const P = leg.pts, C = leg.cum, L = leg.length || C[C.length - 1] || 1;
            const proj = (x, y) => {
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
            const t = new Array(NB).fill(0), s = new Array(NB).fill(0);
            const sp = Array.from({ length: NB }, () => []);
            const w = {}; const add = (k, v) => w[k] = (w[k] || 0) + v;
            const seen = new Set(); const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0 && state.race.status === 'racing') {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished || b.raceState.leg !== LEG) continue;
                        seen.add(b.name);
                        const bi = proj(b.x, b.y);
                        t[bi] += 0.1; const kt = b.speed * 60; sp[bi].push(kt);
                        if (kt >= 40) continue;
                        s[bi] += 0.1; add('slow', 1); add('bin_' + bi, 1);
                        const ct = b.controller;
                        if (ct && ct.wiggleActive) add('wiggle', 1);
                        if (ct && ct.riskState && ct.riskState !== 'LOW') add('risk_' + ct.riskState, 1);
                        if (b.raceState.roundArmed) add('armed', 1);
                        if (b.penaltyTurnsOwed > 0) add('penTurn', 1);
                        const wd = getWindAt(b.x, b.y);
                        const twa = Math.abs(normalizeAngle(b.heading - wd.direction));
                        if (twa < 0.5) add('inIrons', 1); else if (twa > Math.PI - 0.5) add('deadRun', 1);
                        if (ct && Math.abs(ct.lastAvoidDeviation || 0) > 0.26) add('deflected', 1);
                        const g = state.course.botGrid;
                        let blocked = 0;
                        for (const dd of [90, 180]) {
                            const cc = g.cell(b.x + Math.sin(b.heading) * dd, b.y - Math.cos(b.heading) * dd);
                            if (!g.at(cc[0], cc[1])) { blocked = 1; break; }
                        }
                        if (blocked) add('landAhead', 1);
                    }
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return { t, s, sp: sp.map(a => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null), w, n: seen.size };
        }, { seed, LEG, NB });
        for (let k = 0; k < NB; k++) { bBin[k] += r.t[k]; bSlow[k] += r.s[k]; if (r.sp[k] != null) bSpd[k].push(r.sp[k]); }
        for (const [k, v] of Object.entries(r.w)) why[k] = (why[k] || 0) + v;
        boatLegs += r.n;
    }
    await browser.close();

    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
    const nL = hum.laps.length || 1;
    console.log(`\n${VENUE.toUpperCase()} LEG ${LEG}  (leg length ${hum.legLen}u, ${NB} subsections of ${Math.round(hum.legLen / NB)}u)`);
    console.log(`human ${hum.laps.length} lap(s): ` + hum.laps.map(l => `${l.fin != null ? l.fin.toFixed(1) : '?'}${l.fp ? '' : ' [unstamped]'}`).join(', ') + `   bot ${boatLegs} boat-legs`);
    console.log(`sub   human s   bot s/boat    DELTA   share   bot slow s   human u/s  bot u/s   where (her median x,y)`);
    const dl = [];
    for (let k = 0; k < NB; k++) {
        const h = hum.laps.reduce((a, l) => a + l.t[k], 0) / nL;
        dl.push(bBin[k] / (boatLegs || 1) - h);
    }
    const gap = dl.reduce((a, b) => a + (b > 0 ? b : 0), 0);
    for (let k = 0; k < NB; k++) {
        const h = hum.laps.reduce((a, l) => a + l.t[k], 0) / nL;
        const bs = bBin[k] / (boatLegs || 1);
        const hs = med(hum.laps.flatMap(l => l.sp[k]));
        const xy = hum.laps.flatMap(l => l.xy[k]);
        const cx = xy.length ? Math.round(med(xy.map(p => p[0]))) : null, cy = xy.length ? Math.round(med(xy.map(p => p[1]))) : null;
        console.log(`${String(k).padStart(3)}  ${h.toFixed(1).padStart(8)}  ${bs.toFixed(1).padStart(10)}  ${dl[k].toFixed(1).padStart(7)}` +
            `  ${(dl[k] > 0 ? (100 * dl[k] / gap).toFixed(0) + '%' : '-').padStart(6)}` +
            `  ${(bSlow[k] / (boatLegs || 1)).toFixed(1).padStart(11)}  ${(hs || 0).toFixed(0).padStart(9)}  ${(med(bSpd[k]) || 0).toFixed(0).padStart(6)}` +
            `   ${cx != null ? `(${cx},${cy})` : ''}`);
    }
    const sl = why.slow || 1;
    console.log(`WHY SLOW (of ${(sl * 0.1 / (boatLegs || 1)).toFixed(1)} s/boat under 40 u/s): ` +
        Object.entries(why).filter(([k]) => k !== 'slow' && !k.startsWith('bin_')).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} ${Math.round(100 * v / sl)}%`).join('  '));
    console.log(`slow-time by subsection: ` + Array.from({ length: NB }, (_, k) => `${k}:${Math.round(100 * (why['bin_' + k] || 0) / sl)}%`).join(' '));
})();
