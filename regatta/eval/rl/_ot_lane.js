// OTTER LANES — where he sails each leg against where the fleet sails it (2026-09-14, the
// otter intake). Both sides projected onto the DMC leg path IN-PAGE (CoursePath.project),
// so the cross-track offset is measured against the one line both are steering by:
// per leg, ten stations along the path, the signed cross-track (u; + = the required side /
// starboard of the path direction), the mean wind SPEED sampled at the hull (his: the
// recorder's windSpd; fleet: getWindAt), tacks per leg, close-hauled share (|TWA| < 55°),
// ground distance and duration. Ten-bot conversion as ocean_bench; fins are not validated
// (this is a lane atlas, not a clock).
//   node _ot_lane.js [tree] [seed0] [n] [venue]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const TREE = process.argv[2] || 'treeOT0', SEED0 = parseInt(process.argv[3] || '9400'), N = parseInt(process.argv[4] || '2'), VENUE = process.argv[5] || 'otter';
const ROOT = path.join(__dirname, TREE);
const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8')); const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    laps.push({ f, fp: j.venueFingerprint, S: j.samples.filter(s => gi(s, 'phase') === 1).map(s => ({ t: gi(s, 't'), x: gi(s, 'x'), y: gi(s, 'y'), h: gi(s, 'hdg'), w: gi(s, 'windDir'), ws: gi(s, 'windSpd'), leg: gi(s, 'leg') })) });
}
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const R = await p.evaluate(({ SEED0, N, laps }) => {
        const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
        window.evalHarness.seed = SEED0; window.resetGame(); window.startRace();
        const legs = state.course.dmc.legs; const NB = 10;
        // per-sample projection: s along the leg path and signed cross-track
        const proj = (L, x, y) => { const s = CoursePath.project(L, x, y, null); const cum = L.cum, pts = L.pts; let k = 1; while (k < cum.length - 1 && cum[k] < s) k++; const ax = pts[k - 1].x, ay = pts[k - 1].y, bx = pts[k].x, by = pts[k].y; const ex = bx - ax, ey = by - ay, el = Math.hypot(ex, ey) || 1; const ux = ex / el, uy = ey / el; const wx = x - ax, wy = y - ay; return { s, ct: wx * (-uy) + wy * ux, frac: s / L.length }; };
        const summarize = (S, legIdx) => {
            const L = legs[legIdx]; if (!L || !L.pts) return null;
            const rows = S.filter(r => r.leg === legIdx); if (rows.length < 5) return null;
            const bins = Array.from({ length: NB }, () => []); let ws = 0, ch = 0, dist = 0, tacks = 0;
            for (let i = 0; i < rows.length; i++) { const r = rows[i]; const pr = proj(L, r.x, r.y); const b = Math.max(0, Math.min(NB - 1, Math.floor(pr.frac * NB))); bins[b].push(pr.ct); ws += r.ws; const twa = Math.abs(nm(r.h - r.w)); if (twa < 0.96) ch++; if (i) { dist += Math.hypot(r.x - rows[i - 1].x, r.y - rows[i - 1].y); const a = Math.sign(nm(r.h - r.w)), b2 = Math.sign(nm(rows[i - 1].h - rows[i - 1].w)); if (a && b2 && a !== b2 && twa < 1.6) tacks++; } }
            const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)]); };
            return { leg: legIdx, dur: +(rows[rows.length - 1].t - rows[0].t).toFixed(1), dist: Math.round(dist), ws: +(ws / rows.length).toFixed(2), ch: +(ch / rows.length).toFixed(2), tacks, ct: bins.map(med) };
        };
        const out = { him: [], fleet: [] };
        for (const lap of laps) for (const li of [1, 2]) { const s = summarize(lap.S, li); if (s) out.him.push({ ...s, lap: lap.f }); }
        for (let t = 0; t < N; t++) {
            window.evalHarness.seed = SEED0 + t; window.resetGame(); window.startRace(); state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
            const DT = 1 / 60; const tr = {}; for (const b of state.boats) tr[b.name] = [];
            for (let it = 0; it < 60 * 900; it++) { window.update(DT); if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; } if (it % 6) continue; const tt = it * DT; for (const b of state.boats) { if (b.raceState.finished) continue; const w = getWindAt(b.x, b.y); tr[b.name].push({ t: tt, x: b.x, y: b.y, h: b.heading, w: w.direction, ws: w.speed, leg: b.raceState.leg }); } if (state.race.timer > 895) break; }
            for (const [name, S] of Object.entries(tr)) for (const li of [1, 2]) { const s = summarize(S, li); if (s) out.fleet.push({ ...s, seed: SEED0 + t, name, fin: state.boats.find(b => b.name === name).raceState.finished ? 1 : 0 }); }
        }
        return out;
    }, { SEED0, N, laps: laps.map(l => ({ f: l.f, S: l.S })) });
    await br.close();
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }; const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const row = (lab, A) => { if (!A.length) return `${lab}: n=0`; const cts = Array.from({ length: 10 }, (_, k) => { const v = A.map(r => r.ct[k]).filter(x => x != null); return v.length ? String(med(v)).padStart(5) : '    -'; }); return `${lab.padEnd(12)} n=${String(A.length).padStart(3)} dur ${mean(A.map(r => r.dur)).toFixed(1).padStart(6)} dist ${Math.round(mean(A.map(r => r.dist))).toString().padStart(6)} wind ${mean(A.map(r => r.ws)).toFixed(1)} kt  close-hauled ${(100 * mean(A.map(r => r.ch))).toFixed(0)}%  tacks ${mean(A.map(r => r.tacks)).toFixed(1)} | xtrack@10%..90% ${cts.join('')}`; };
    console.log(`=== ${VENUE.toUpperCase()} LANES (${TREE}, seeds ${SEED0}+${N}; his laps ${laps.length}) — cross-track from the DMC leg path (u, + = right of the path direction), medians per station ===`);
    for (const li of [1, 2]) { console.log(`LEG ${li}`); console.log('  ' + row('him', R.him.filter(r => r.leg === li))); for (const h of R.him.filter(r => r.leg === li)) console.log('     ' + h.lap.slice(11, -5).padEnd(14) + ` dur ${h.dur} dist ${h.dist} wind ${h.ws} ch ${h.ch} tacks ${h.tacks} | ${h.ct.map(v => v == null ? '    -' : String(v).padStart(5)).join('')}`); console.log('  ' + row('fleet', R.fleet.filter(r => r.leg === li))); }
    fs.writeFileSync(path.join(__dirname, `_ot_lane_${TREE}.json`), JSON.stringify(R));
})();
