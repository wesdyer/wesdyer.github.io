// DOES A BOAT DELAY THE TACK IT WANTS BECAUSE A PORT-TACK RIVAL IS NEARBY —
// WHEN COMPLETING THE TACK WOULD MAKE HER THE RIGHTS BOAT? (2026-08-15, owner:
// "if a boat wants to tack onto starboard it should factor in that it will
// have rights and not delay... if it gives adequate room to respond.")
//
// "Wants the tack" proxy: on an upwind leg, on PORT, while the STARBOARD board
// points at least MARGIN closer to the leg's rounding mark (VMG-favored by
// geometry, no layline subtlety — conservative margin absorbs shifts).
// Suppression geometry: a port-tack rival within 350u. Episode ends when she
// tacks or the condition breaks. Recorded per episode: duration, whether the
// rival was her controller's threatBoat (the avoidance is what's holding her),
// her role, and — if she tacked after the rival cleared 350u — the latency
// from clear to tack ("waited for him to leave").
//   node _tack_delay.js <trials> <seed0> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBASE');
const VENUE = process.argv[5] || 'bay';
const MARGIN = 15 * Math.PI / 180;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);

    const EPS = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, MARGIN }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const st = new Map(), eps = [];
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const tnow = state.race.timer;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    let s = st.get(bo.name); if (!s) { s = { ep: null, clearT: null }; st.set(bo.name, s); }
                    const rs = bo.raceState;
                    const w = getWindAt(bo.x, bo.y);
                    const twa = norm(bo.heading - w.direction);
                    const onPort = twa > 0;
                    // point of sail only — legTargetsWindward is false on rounding-
                    // terminated beats (roles derive only for gate entries)
                    const upwind = Math.abs(twa) < 1.2;
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null) || state.course.roundMark;
                    let wantStbd = false;
                    if (rm && upwind && onPort) {
                        const brg = Math.atan2(rm.x - bo.x, -(rm.y - bo.y));
                        const hS = norm(w.direction - 0.66), hP = norm(w.direction + 0.66);
                        wantStbd = Math.abs(norm(hS - brg)) + MARGIN < Math.abs(norm(hP - brg));
                    }
                    // rival: port tack, within 350u
                    let rival = null, rd = 1e9;
                    if (wantStbd) {
                        for (const oy of state.boats) {
                            if (oy === bo || oy.isPlayer || oy.raceState.finished) continue;
                            const d = Math.hypot(oy.x - bo.x, oy.y - bo.y);
                            if (d > 350 || d >= rd) continue;
                            const wt = norm(oy.heading - getWindAt(oy.x, oy.y).direction);
                            if (wt > 0) { rival = oy; rd = d; }
                        }
                    }
                    if (s.ep) {
                        const e = s.ep;
                        e.dur = tnow - e.t0;
                        const c = bo.controller;
                        if (c && rival && c.threatBoat === rival) e.threatT += DT;
                        if (!onPort) { // SHE TACKED
                            e.outcome = 'tacked';
                            e.clearGap = s.clearT != null ? +(tnow - s.clearT).toFixed(1) : null;
                            eps.push(e); s.ep = null; s.clearT = null;
                        } else if (!wantStbd) {
                            e.outcome = 'wantEnded'; eps.push(e); s.ep = null; s.clearT = null;
                        } else if (!rival) {
                            if (s.clearT == null) s.clearT = tnow;
                            if (tnow - s.clearT > 6) { e.outcome = 'rivalGone>6s'; eps.push(e); s.ep = null; s.clearT = null; }
                        } else s.clearT = null;
                    } else if (wantStbd && rival) {
                        s.ep = { t0: +tnow.toFixed(1), boat: bo.name, rival: rival.name,
                                 d0: Math.round(rd), dur: 0, threatT: 0 };
                        s.clearT = null;
                    }
                }
            }
            for (const s of st.values()) if (s.ep) { s.ep.outcome = 'raceEnd'; eps.push(s.ep); }
            return eps;
        }, { seed: SEED0 + t, MARGIN });
        EPS.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} wanted-tack-with-rival episodes`);
    }
    await b.close();
    const by = {};
    for (const e of EPS) by[e.outcome] = (by[e.outcome] || 0) + 1;
    const durs = EPS.map(e => e.dur).sort((a, c) => a - c);
    const q = (a, f) => a.length ? +a[Math.floor((a.length - 1) * f)].toFixed(1) : null;
    console.log(`\n=== ${VENUE}, ${TRIALS} seeds: ${EPS.length} episodes (port boat, starboard-favored ≥15°, port rival <350u) ===`);
    for (const k of Object.keys(by)) console.log(`  ${k.padEnd(12)} ${by[k]}`);
    console.log(`hold duration: med ${q(durs, .5)} p75 ${q(durs, .75)} p90 ${q(durs, .9)} max ${q(durs, 1)} s`);
    const tk = EPS.filter(e => e.outcome === 'tacked');
    const gaps = tk.filter(e => e.clearGap != null).map(e => e.clearGap).sort((a, c) => a - c);
    console.log(`of ${tk.length} that tacked: ${gaps.length} tacked AFTER the rival cleared 350u (gap med ${q(gaps, .5)} s) — the "waited for him to leave" signature`);
    const thr = EPS.filter(e => e.threatT > 1);
    console.log(`episodes with the rival as active threatBoat >1s: ${thr.length} (${(100 * thr.length / Math.max(1, EPS.length)).toFixed(0)}%) — the avoidance is what held her`);
    for (const e of EPS.slice(0, 10)) console.log(' ', JSON.stringify(e));
})();
