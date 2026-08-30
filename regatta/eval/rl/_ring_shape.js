// THE SHAPE OF A ROUNDING (2026-08-30, the paths-intake session, P0 of the corner
// push). `_roundcraft.js` says the ring tax is RADIUS — closest 2× his, overshoot
// 2.5×, ring distance +32% — and that the fleet LEADER rounds exactly like the pack,
// so it is geometry, not traffic. This asks what the geometry IS: per rounding
// episode (fleet + his fp-valid laps, identical code) the track in mark-polar
// coordinates, the TURN (the span of |turn rate| >= 0.35 rad/s nearest the closest
// approach), a least-squares circle through it, and where that circle's CENTRE sits
// relative to the mark — a concentric orbit has its centre on the mark; a corner has
// it displaced toward the exit. Also: turn radius, speed at closest, speed at window
// open, heading change through the turn, and the offset of the straight approach
// line from the mark.
//   node _ring_shape.js <venue> <trials> <seed0> <tree> [fp]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const TREE = process.argv[5] || 'treePA';
const ROOT = path.join(__dirname, TREE);
const djb = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + str.length; };
const docFp = (p, v) => { const sb = { window: { VENUE_DOC: {} } }; vm.createContext(sb); vm.runInContext(fs.readFileSync(p, 'utf8'), sb); const d = sb.window.VENUE_DOC[v]; return d ? djb(JSON.stringify(d)) : null; };
const FP = process.argv[6] || docFp(path.resolve(__dirname, '../../assets/venues', VENUE + '.venue.js'), VENUE);
const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ── the shape fit (node side; fleet tracks come back raw) ──
// samples: [{t,x,y,h,v}] on leg L (and the first seconds of L+1) within 2z of the mark.
function shape(S, g) {
    if (S.length < 8) return null;
    const rr = S.map(s => Math.hypot(s.x - g.x, s.y - g.y));
    let iMin = 0; for (let i = 1; i < S.length; i++) if (rr[i] < rr[iMin]) iMin = i;
    // turn rate, smoothed over ~0.5 s either side
    const tr = S.map((s, i) => { const a = Math.max(0, i - 2), b = Math.min(S.length - 1, i + 2); const dt = S[b].t - S[a].t; return dt > 0 ? nm(S[b].h - S[a].h) / dt : 0; });
    const sgn = g.side === 'port' ? -1 : 1;
    // the turn: contiguous span of |tr| >= 0.35 containing (or nearest to) the closest approach
    let a = iMin, b = iMin;
    if (Math.abs(tr[iMin]) < 0.35) { let best = -1, bd = 1e9; for (let i = 0; i < S.length; i++) if (Math.abs(tr[i]) >= 0.35 && Math.abs(i - iMin) < bd) { bd = Math.abs(i - iMin); best = i; } if (best < 0) return null; a = b = best; }
    while (a > 0 && Math.abs(tr[a - 1]) >= 0.35) a--;
    while (b < S.length - 1 && Math.abs(tr[b + 1]) >= 0.35) b++;
    if (b - a < 3) return null;
    // Kasa circle fit on the turn span
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0, n = 0;
    for (let i = a; i <= b; i++) { const x = S[i].x - g.x, y = S[i].y - g.y, z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; n++; }
    // solve [sxx sxy sx; sxy syy sy; sx sy n] [A B C] = [sxz syz sz]  for x^2+y^2 = A x + B y + C
    const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], R = [sxz, syz, sz];
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(M); if (Math.abs(D) < 1e-9) return null;
    const col = (k) => M.map((row, i) => row.map((v, j) => j === k ? R[i] : v));
    const A = det(col(0)) / D, B = det(col(1)) / D, C = det(col(2)) / D;
    const cx = A / 2, cy = B / 2, Rfit = Math.sqrt(Math.max(0, C + cx * cx + cy * cy));
    // frame: approach direction = velocity direction at window open; exit direction = toward g.next
    const h0 = S[0].h; const ax = Math.sin(h0), ay = -Math.cos(h0);
    const exv = g.next ? [g.next.x - g.x, g.next.y - g.y] : null; const exl = exv ? Math.hypot(exv[0], exv[1]) || 1 : 1;
    const along = cx * ax + cy * ay, abeam = -(cx * ay) + cy * ax;   // abeam: +left of the approach direction (screen y-down)
    const toExit = exv ? (cx * exv[0] + cy * exv[1]) / exl : null;
    // approach line offset from the mark: perpendicular distance from the mark to the line through S[0] along h0
    const ox = S[0].x - g.x, oy = S[0].y - g.y; const lineOff = Math.abs(-(ox) * ay + oy * ax);
    return { minR: rr[iMin], vMin: S[iMin].v, vOpen: S[0].v, vTurnMin: Math.min(...S.slice(a, b + 1).map(s => s.v)),
             R: Rfit, cDist: Math.hypot(cx, cy), cAlong: along, cAbeam: abeam * sgn, cToExit: toExit,
             hdgChange: Math.abs(nm(S[b].h - S[a].h)) * 180 / Math.PI, turnDur: S[b].t - S[a].t,
             trMax: Math.max(...tr.slice(a, b + 1).map(Math.abs)), lineOff, span: S[S.length - 1].t - S[0].t };
}

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const GEO = await p.evaluate(() => {
        window.evalHarness.seed = 1; window.resetGame(); window.startRace();
        const out = []; const route = state.course.route || [];
        for (let i = 0; i < route.length; i++) { const e = route[i]; if (!e || e.kind !== 'round' || !e.mark) continue;
            let nx = null; const nleg = state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[i + 1];
            if (nleg && nleg.pts && nleg.pts.length) nx = nleg.pts[nleg.pts.length - 1];
            out.push({ leg: i, x: e.mark.x, y: e.mark.y, zone: e.mark.zone, side: e.mark.side, next: nx }); }
        return out;
    });
    // ── his laps ──
    const HIS = [];
    const TD = path.join(__dirname, 'traj');
    for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
        if (String(j.venueFingerprint) !== String(FP)) continue;
        const F = j.format, gi = (s, k) => s[F.indexOf(k)];
        const rows = j.samples.filter(s => gi(s, 'phase') === 1);
        for (const g of GEO) {
            const S = []; let opened = false, adv = false;
            for (const s of rows) {
                const leg = gi(s, 'leg'); const d = Math.hypot(gi(s, 'x') - g.x, gi(s, 'y') - g.y);
                if (!opened) { if (leg === g.leg && d < g.zone * 2) opened = true; else continue; }
                if (leg > g.leg) adv = true;
                if (leg > g.leg + 1 || (adv && d > g.zone * 2)) break;
                S.push({ t: gi(s, 't'), x: gi(s, 'x'), y: gi(s, 'y'), h: gi(s, 'hdg'), v: gi(s, 'spd') * 60 });   // recorder stores boat.speed (u/frame) → u/s
            }
            const sh = shape(S, g); if (sh) HIS.push({ ...sh, leg: g.leg, who: 'him', lap: f });
        }
    }
    // ── fleet ──
    const FLEET = [];
    for (let t = 0; t < TRIALS; t++) {
        const seed = SEED0 + t;
        const r = await p.evaluate(({ seed, GEO }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const DT = 1 / 60; const eps = {};
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                if (it % 6) continue;                                   // 10 Hz samples
                const t = it * DT;
                for (const bo of state.boats) {
                    const rs = bo.raceState; if (rs.finished) continue;
                    for (const g of GEO) {
                        if (rs.leg < g.leg || rs.leg > g.leg + 1) continue;
                        const key = bo.name + ':' + g.leg;
                        const E = eps[key] || (eps[key] = { S: [], opened: false, adv: false, done: false, t0: null });
                        if (E.done) continue;
                        const d = Math.hypot(bo.x - g.x, bo.y - g.y);
                        if (!E.opened) { if (rs.leg === g.leg && d < g.zone * 2) { E.opened = true; E.t0 = t; } else continue; }
                        if (rs.leg > g.leg) E.adv = true;
                        if (E.adv && d > g.zone * 2) { E.done = true; continue; }
                        const v = bo.velocity ? Math.hypot(bo.velocity.x, bo.velocity.y) * 60 : bo.speed * 60;
                        E.S.push({ t, x: bo.x, y: bo.y, h: bo.heading, v });
                    }
                }
                if (state.race.timer > 895) break;
            }
            return Object.entries(eps).filter(([k, E]) => E.opened && E.adv).map(([k, E]) => ({ leg: +k.split(':')[1], name: k.split(':')[0], t0: E.t0, S: E.S }));
        }, { seed, GEO });
        for (const e of r) { const g = GEO.find(x => x.leg === e.leg); const sh = shape(e.S, g); if (sh) FLEET.push({ ...sh, leg: e.leg, who: 'fleet', seed, name: e.name, t0: e.t0 }); }
        console.log(`seed ${seed}: ${r.length} episodes`);
    }
    await br.close();
    // rank by arrival per seed-leg
    const byKey = {}; for (const e of FLEET) (byKey[e.seed + ':' + e.leg] = byKey[e.seed + ':' + e.leg] || []).push(e);
    for (const k in byKey) byKey[k].sort((a, b) => a.t0 - b.t0).forEach((e, i) => e.rank = i + 1);
    fs.writeFileSync(path.join(__dirname, `_ring_shape_${VENUE}_${TREE}.json`), JSON.stringify({ VENUE, FP, GEO, HIS, FLEET }));
    const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
    const f0 = (v) => isFinite(v) ? v.toFixed(0) : '—';
    const row = (lab, A) => `${lab.padEnd(14)} n=${String(A.length).padStart(3)} | centre dist ${f0(med(A.map(x => x.cDist)))}  along ${f0(med(A.map(x => x.cAlong)))}  abeam(req side +) ${f0(med(A.map(x => x.cAbeam)))}  toward-exit ${f0(med(A.map(x => x.cToExit)))} | R ${f0(med(A.map(x => x.R)))}  minR ${f0(med(A.map(x => x.minR)))}  lineOff ${f0(med(A.map(x => x.lineOff)))} | v open ${f0(med(A.map(x => x.vOpen)))}  v@min ${f0(med(A.map(x => x.vMin)))}  v turn-min ${f0(med(A.map(x => x.vTurnMin)))} | Δhdg ${f0(med(A.map(x => x.hdgChange)))}°  turn ${med(A.map(x => x.turnDur)).toFixed(1)} s  tr max ${med(A.map(x => x.trMax)).toFixed(2)} rad/s`;
    console.log(`\n=== ${VENUE.toUpperCase()} ROUNDING SHAPE (fp ${FP}; his laps ${new Set(HIS.map(h => h.lap)).size}, fleet ${FLEET.length}) — turn circle fitted over |turn rate| >= 0.35 rad/s; centre offsets in u from the mark ===`);
    for (const g of GEO) {
        console.log(`LEG ${g.leg} (${g.side}, zone ${g.zone})`);
        console.log('  ' + row('him', HIS.filter(x => x.leg === g.leg)));
        console.log('  ' + row('fleet leader', FLEET.filter(x => x.leg === g.leg && x.rank === 1)));
        console.log('  ' + row('fleet rest', FLEET.filter(x => x.leg === g.leg && x.rank > 1)));
    }
    console.log('POOLED');
    console.log('  ' + row('him', HIS)); console.log('  ' + row('fleet leader', FLEET.filter(x => x.rank === 1))); console.log('  ' + row('fleet rest', FLEET.filter(x => x.rank > 1)));
})();
