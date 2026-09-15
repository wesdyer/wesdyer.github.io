// OTTER ROUNDING TRACES — the fleet through Otter Point at 1 Hz, in the SAME format the
// offline pass over his laps prints (2026-09-14, the otter intake): per boat, from the
// first sample within WIN u of the mark on the rounding leg until the boat is WIN u away
// on the next leg. Ten-bot conversion as ocean_bench. Also the per-boat summary row.
//   node _ot_trace.js [tree] [seed] [venue] [win] [--quiet]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const TREE = process.argv[2] || 'treeOT0', SEED = parseInt(process.argv[3] || '9400'), VENUE = process.argv[4] || 'otter', WIN = parseInt(process.argv[5] || '700');
const QUIET = process.argv.includes('--quiet');
const LEG = process.env.LEG ? parseInt(process.env.LEG) : null;   // LEG=n picks the round mark on route index n (default: the first round)
const ROOT = path.join(__dirname, TREE);
const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const deg = r => (r * 180 / Math.PI).toFixed(0);
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const R = await p.evaluate(({ seed, WIN, LEG }) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const pl = state.boats.find(x => x.isPlayer);
        applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
        const nine = state.boats.filter(x => x !== pl);
        pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
        pl.ai.setupDist = 300;
        const route = state.course.route || []; let G = null;
        for (let i = 0; i < route.length; i++) { const e = route[i]; if (e && e.kind === 'round' && e.mark && (LEG == null || i === LEG)) { G = { leg: i, x: e.mark.x, y: e.mark.y, zone: e.mark.zone, side: e.mark.side }; break; } }
        const DT = 1 / 60; const eps = {};
        for (let it = 0; it < 60 * 900; it++) {
            window.update(DT);
            if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
            if (it % 6) continue;
            const t = it * DT;
            for (const bo of state.boats) {
                const rs = bo.raceState; if (rs.finished) continue;
                if (rs.leg < G.leg || rs.leg > G.leg + 1) continue;
                const E = eps[bo.name] || (eps[bo.name] = { S: [], opened: false, done: false });
                if (E.done) continue;
                const d = Math.hypot(bo.x - G.x, bo.y - G.y);
                if (!E.opened) { if (rs.leg === G.leg && d < WIN) E.opened = true; else continue; }
                if (rs.leg > G.leg && d > WIN) { E.done = true; continue; }
                const v = bo.velocity ? Math.hypot(bo.velocity.x, bo.velocity.y) * 60 : bo.speed * 60;
                const c = bo.controller; const w = getWindAt(bo.x, bo.y);
                E.S.push({ t, x: bo.x, y: bo.y, h: bo.heading, v, w: w.direction, ws: w.speed, leg: rs.leg, d, armed: rs.roundArmed ? 1 : 0, banked: rs.roundBanked ? 1 : 0, sweep: rs.roundSweep || 0,
                    ruler: c && c._rulerMode ? 1 : 0, ob: c && c._outbound ? 1 : 0, fol: c ? c.dmcFollowLeg : null, eb: c && c._entryBrg != null ? c._entryBrg : null, dh: c ? c.desiredHeading : null,
                    wig: c && c.wiggleActive ? 1 : 0, corner: c && c._corner ? 1 : 0, spin: rs.penaltyTurnsOwed || 0, cl: (bo.ai && bo.ai.collisionData) ? 1 : 0 });
            }
            if (state.race.timer > 895) break;
        }
        return { G, eps: Object.entries(eps).filter(([k, E]) => E.opened).map(([k, E]) => ({ name: k, S: E.S })) };
    }, { seed: SEED, WIN, LEG });
    await br.close();
    const M = R.G; console.log(`seed ${SEED} ${VENUE} mark leg ${M.leg} zone ${M.zone} side ${M.side}; ${R.eps.length} boats`);
    const sum = [];
    for (const e of R.eps) {
        const rows = e.S; if (rows.length < 3) continue;
        let iMin = 0; rows.forEach((r, i) => { if (r.d < rows[iMin].d) iMin = i; });
        const r0 = rows[0], rN = rows[rows.length - 1], rm = rows[iMin];
        const brg = r => Math.atan2(r.y - M.y, r.x - M.x);
        const in15 = rows.filter(r => r.d < 1.5 * M.zone); const ringT = in15.length ? in15[in15.length - 1].t - in15[0].t : 0;
        let flips = 0; for (let i = 1; i < rows.length; i++) { const a = Math.sign(nm(rows[i].h - rows[i].w)), b = Math.sign(nm(rows[i - 1].h - rows[i - 1].w)); if (a && b && a !== b && Math.abs(nm(rows[i].h - rows[i].w)) < 1.6) flips++; }
        const dist = rows.reduce((a, r, i) => i ? a + Math.hypot(r.x - rows[i - 1].x, r.y - rows[i - 1].y) : 0, 0);
        const slow = rows.filter(r => r.v < 60).length * 0.1;
        const advI = rows.findIndex(r => r.leg > M.leg);
        const row = { name: e.name, win: +(rN.t - r0.t).toFixed(1), dist: Math.round(dist), closest: Math.round(rm.d), vMin: Math.round(rm.v), vOpen: Math.round(r0.v), vExit: Math.round(rN.v), ringT: +ringT.toFixed(1), flips, slow: +slow.toFixed(1),
            twa0: +deg(Math.abs(nm(r0.h - r0.w))), brg0: +deg(brg(r0)), twaN: +deg(Math.abs(nm(rN.h - rN.w))), brgN: +deg(brg(rN)), tAdv: advI >= 0 ? +(rows[advI].t - r0.t).toFixed(1) : null, dAdv: advI >= 0 ? Math.round(rows[advI].d) : null, vMean: Math.round(rows.reduce((a, r) => a + r.v, 0) / rows.length) };
        sum.push(row);
        if (!QUIET) {
            console.log(`== ${e.name}  win ${row.win} s dist ${row.dist} closest ${row.closest} v@min ${row.vMin} ringT ${row.ringT} flips ${row.flips} slow<60 ${row.slow}s adv t+${row.tAdv} d ${row.dAdv}`);
            let last = -9; for (const r of rows) { if (r.t - last < 1.0) continue; last = r.t;
                console.log(`  t+${(r.t - r0.t).toFixed(0).padStart(3)} leg ${r.leg} d ${r.d.toFixed(0).padStart(4)} brg ${deg(brg(r)).padStart(5)} hdg ${deg(r.h).padStart(5)} des ${r.dh != null ? deg(r.dh).padStart(5) : '    ?'} TWA ${deg(Math.abs(nm(r.h - r.w))).padStart(4)} v ${r.v.toFixed(0).padStart(4)} sweep ${r.sweep.toFixed(2)} arm ${r.armed} bank ${r.banked} ruler ${r.ruler} ob ${r.ob} fol ${r.fol} eb ${r.eb != null ? deg(r.eb) : '-'} wig ${r.wig} corner ${r.corner} spin ${r.spin} col ${r.cl}`); }
        }
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }; const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    console.log('\nFLEET SUMMARY (median / mean over boats):');
    for (const k of ['win', 'dist', 'closest', 'vMin', 'vOpen', 'vExit', 'vMean', 'ringT', 'flips', 'slow', 'twa0', 'twaN', 'tAdv', 'dAdv']) { const a = sum.map(r => r[k]).filter(x => x != null); console.log(`  ${k.padEnd(8)} med ${med(a)}  mean ${mean(a).toFixed(1)}`); }
    fs.writeFileSync(path.join(__dirname, `_ot_trace_${TREE}_${SEED}.json`), JSON.stringify({ M, sum, eps: R.eps }));
})();
