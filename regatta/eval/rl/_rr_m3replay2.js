// P0 REPLAY TRACE — the m3 wrong-way wrap (51% stall rate, attributed by
// _rr_m3stall.js). Per-tick (0.1s) log of every boat's pass through m3's
// 450u neighbourhood: entrance-hunt sector choice (_entryBrg), ruler-mode,
// arm transition, signed sweep + wrong-way accumulator, outbound/exit state,
// the live nav destination (_lastNav), avoidance deflection, TWA. Dumps the
// first N stall episodes (kt<1 inside 250u) and M clean contrasts in full,
// from neighbourhood entry to exit/stall+15s. The goal is to NAME the one
// physical line: where does the wrap direction go wrong — sector choice,
// cut-in lead, orbit lead sign, or something the trace shows instead?
//   node _rr_m3replay.js <trials> <seed0> <tree> <markIdx> <nStall> <nClean>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4FINAL');
const MIDX = parseInt(process.argv[5] ?? '3');
const NSTALL = parseInt(process.argv[6] ?? '3');
const NCLEAN = parseInt(process.argv[7] ?? '2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => {
        const P = BotController.prototype;
        const gs = P.getStrategicHeading;
        P.getStrategicHeading = function (nav) { const h = gs.call(this, nav); this.__strat = h; return h; };
        const av = P.applyAvoidance;
        P.applyAvoidance = function (dh, sr) { this.__pre = dh; const o = av.call(this, dh, sr); this.__post = o; return o; };
    });
    let gotStall = 0, gotClean = 0;
    for (let i = 0; i < TRIALS && gotStall < NSTALL; i++) {
        const seed = SEED0 + i;
        const eps = await page.evaluate(async ([seed, MIDX, wantStall, wantClean]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const M = state.course.marks[MIDX];
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const deg = r => +(r * 180 / Math.PI).toFixed(0);
            const st = {}; const done = [];
            let nStall = 0, nClean = 0;
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                if (nStall >= wantStall && nClean >= wantClean) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const d = Math.hypot(b.x - M.x, b.y - M.y);
                    const s = st[b.name] = st[b.name] || { in: false };
                    if (d < 450 && !s.in) {
                        s.in = true; s.rows = []; s.stalled = false; s.stallT = null;
                        s.leg = b.raceState.leg;
                    }
                    if (s.in) {
                        const rs = b.raceState, c = b.controller;
                        const w = getWindAt(b.x, b.y);
                        const kt = b.speed * 4;
                        let nRival = 0;
                        for (const o of bots) if (o !== b && !o.raceState.finished
                            && Math.hypot(o.x - b.x, o.y - b.y) < 250) nRival++;
                        const nav = c && c._lastNav;
                        s.rows.push({
                            t: +state.race.timer.toFixed(1),
                            x: +b.x.toFixed(0), y: +b.y.toFixed(0),
                            d: +d.toFixed(0),
                            brg: deg(Math.atan2(b.y - M.y, b.x - M.x)),
                            kt: +kt.toFixed(1), hdg: deg(b.heading),
                            twa: deg(Math.abs(norm(b.heading - w.direction))),
                            arm: rs.roundArmed ? 1 : 0,
                            reb: rs.roundRebased ? 1 : 0,
                            sw: deg(rs.roundSweep || 0),
                            wr: deg(rs.roundWrong || 0),
                            bank: rs.roundBanked ? 1 : 0,
                            rul: c && c._rulerMode ? 1 : 0,
                            eBrg: c && c._entryBrg != null ? deg(c._entryBrg) : null,
                            out: c && c._outbound ? 1 : 0,
                            xBrg: c && c._exitBrg != null ? deg(c._exitBrg) : null,
                            defl: c ? deg(c.lastAvoidDeviation || 0) : 0,
                            navx: nav ? +nav.x.toFixed(0) : null,
                            navy: nav ? +nav.y.toFixed(0) : null,
                            liv: (c && c.livenessState) || '',
                            nr: nRival,
                            str: c && c.__strat != null ? deg(c.__strat) : null,
                            pre: c && c.__pre != null ? deg(c.__pre) : null,
                            pst: c && c.__post != null ? deg(c.__post) : null
                        });
                        if (kt < 1 && d < 250 && !s.stalled) { s.stalled = true; s.stallT = state.race.timer; }
                        const overStall = s.stalled && (state.race.timer - s.stallT) > 15;
                        if (d > 480 || overStall || s.rows.length > 1800) {
                            s.in = false;
                            const keep = s.stalled ? (nStall < wantStall && ++nStall)
                                : (nClean < wantClean && s.rows.length > 40 && ++nClean);
                            if (keep) done.push({ seed, name: b.name, leg: s.leg, stalled: s.stalled, rows: s.rows });
                            s.rows = null;
                        }
                    }
                }
            }
            return { done, nStall, nClean };
        }, [seed, MIDX, NSTALL - gotStall, NCLEAN - gotClean]);
        gotStall += eps.nStall; gotClean += eps.nClean;
        for (const ep of eps.done) {
            console.log(`\n═══ ${ep.stalled ? 'STALL' : 'CLEAN'} seed ${ep.seed} ${ep.name} leg ${ep.leg} (${ep.rows.length} ticks) ═══`);
            console.log('t | d brg | kt hdg twa | arm reb sw wr bank | rul eBrg out xBrg | defl nav | str pre pst | liv nr');
            let last = null;
            for (const r of ep.rows) {
                // print every row near the action; decimate the far approach
                const hot = r.d < 260 || r.kt < 2 || (last && (r.arm !== last.arm || r.rul !== last.rul
                    || r.out !== last.out || r.eBrg !== last.eBrg || r.xBrg !== last.xBrg));
                if (!hot && last && r.t - last.pt < 1.0) continue;
                console.log(`${r.t} | ${r.d} ${r.brg} | ${r.kt} ${r.hdg} ${r.twa} | ${r.arm} ${r.reb} ${r.sw} ${r.wr} ${r.bank} | ${r.rul} ${r.eBrg} ${r.out} ${r.xBrg} | ${r.defl} (${r.navx},${r.navy}) | ${r.str} ${r.pre} ${r.pst} | ${r.liv} ${r.nr}`);
                last = { ...r, pt: r.t };
            }
        }
    }
    console.log(`\ndumped stalls ${gotStall} cleans ${gotClean}`);
    await browser.close();
})();
