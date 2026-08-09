// WHY DO BOTS PARK AT THE GRANITE-ISLE ROUNDING? (owner lead, 2026-08-08.)
// The same-race ledger (_arc_round.py) says: human crosses the 600u ring to the
// flip in 19s at min speed 85 u/s; the bots take 63s with min speed 3.6 — they
// PARK on the same line the human sails through (dMin ~310u both). His son went
// rank 9 → 1 across one rounding. This probe asks the controller itself WHY:
// every slow frame (<40 u/s) inside the ring is attributed from live state —
//   irons    — head-to-wind (|TWA| < 0.55, the no-go cone)
//   ease     — a speed governor holds it back (c.speedLimit < 0.99)
//   risk     — riskState HIGH/IMMINENT (traffic)
//   defl     — mid-dodge (|lastAvoidDeviation| > 15°)
//   soft     — grinding a floe-plugged cell
//   other    — none of the above (the interesting residual)
// Modes: solo (traffic removed — separates the ice/entry layer from give-way)
// and fleet (all 9, every rounding pooled). ⚠️ Rule 16: this is attribution,
// not a gate — full-race benches still judge any candidate.
//   node _arc_roundlive.js <solo|fleet> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const MODE = process.argv[2] || 'solo';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeHD9');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    // Neutral bot, same convention as the other arctic probes: the question is
    // about the AI's rounding, not about a character's handling stat.
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ({ seed, MODE }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            let heroes = bots;
            if (MODE === 'solo') {
                heroes = [bots[0]];
                for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            }
            const rmk = state.course.dmc && state.course.dmc.legs[1]
                && state.course.dmc.legs[1].pts.slice(-1)[0];
            const RM = rmk ? { x: rmk.x, y: rmk.y } : { x: 138, y: -3095 };
            const nz = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const per = new Map();
            for (const b of heroes) per.set(b, { ringT: 0, slow: 0, irons: 0, ease: 0, risk: 0,
                defl: 0, soft: 0, other: 0, vMin: Infinity, enterT: null, flipT: null, armT: 0,
                orbitT: 0, name: b.name });
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (const b of heroes) {
                    if (b.raceState.finished) continue;
                    const R = per.get(b);
                    if (R.flipT == null && b.raceState.leg >= 2) R.flipT = t;
                    if (b.raceState.leg !== 1 || R.flipT != null) continue;
                    const d = Math.hypot(b.x - RM.x, b.y - RM.y);
                    if (d > 600) continue;
                    if (R.enterT == null) R.enterT = t;
                    R.ringT += 0.1;
                    if (b.raceState.roundArmed) R.armT += 0.1;
                    const c = b.controller;
                    if (c && c.orbitTightR != null) R.orbitT += 0.1;
                    const v = b.speed * 60;
                    if (v < R.vMin) R.vMin = v;
                    if (v < 40) {
                        R.slow += 0.1;
                        // THE m5 QUESTION, ASKED HERE: on the PLAN heading, is
                        // there a blocker inside the 140u hard zone — and is it
                        // AUTHORED LAND (the granite isle, which does not move
                        // and which the landed hard-zone scaling would forgive at
                        // this speed) or a FLOE (drifting, where the full veto is
                        // the landed conservative answer)?
                        {
                            const c2 = b.controller, gp = c2 && c2.gridPath;
                            if (gp && gp.length) {
                                let jj = 0, acc = 0;
                                while (jj < gp.length - 1 && acc < 260) {
                                    acc += Math.hypot(gp[jj + 1].x - gp[jj].x, gp[jj + 1].y - gp[jj].y);
                                    jj++;
                                }
                                const hp = Math.atan2(gp[jj].x - b.x, -(gp[jj].y - b.y));
                                const g2 = state.course.botGrid, gS = state.course._botGridStatic;
                                let hit = null;
                                for (let dstep = 30; dstep <= 140; dstep += 30) {
                                    const wx = b.x + Math.sin(hp) * dstep, wy = b.y - Math.cos(hp) * dstep;
                                    const cc2 = g2.cell(wx, wy);
                                    if (!g2.at(cc2[0], cc2[1])) {
                                        hit = gS && !gS.at(cc2[0], cc2[1]) ? 'land' : 'floe';
                                        break;
                                    }
                                }
                                if (hit === 'land') R.hzLand = (R.hzLand || 0) + 0.1;
                                else if (hit === 'floe') R.hzFloe = (R.hzFloe || 0) + 0.1;
                                else R.hzNone = (R.hzNone || 0) + 0.1;
                            }
                        }
                        const w = getWindAt(b.x, b.y);
                        const twa = Math.abs(nz(b.heading - w.direction));
                        const g = state.course.botGrid;
                        let soft = false;
                        if (g && g._soft) {
                            const cc = g.cell(b.x, b.y);
                            const id = cc[1] * g.n + cc[0];
                            if (cc[0] >= 0 && cc[1] >= 0 && cc[0] < g.n && cc[1] < g.n && g._soft[id]) soft = true;
                        }
                        if (twa < 0.55) R.irons += 0.1;
                        else if (c && c.speedLimit < 0.99) R.ease += 0.1;
                        else if (c && (c.riskState === 'HIGH' || c.riskState === 'IMMINENT')) R.risk += 0.1;
                        else if (c && Math.abs(c.lastAvoidDeviation || 0) > 0.26) R.defl += 0.1;
                        else if (soft) R.soft += 0.1;
                        else R.other += 0.1;
                    }
                }
            }
            const out = [];
            for (const [b, R] of per) {
                if (R.enterT == null) continue;
                out.push({ name: R.name, tIn: R.flipT != null ? +(R.flipT - R.enterT).toFixed(1) : null,
                    ringT: +R.ringT.toFixed(1), slow: +R.slow.toFixed(1),
                    irons: +R.irons.toFixed(1), ease: +R.ease.toFixed(1), risk: +R.risk.toFixed(1),
                    defl: +R.defl.toFixed(1), soft: +R.soft.toFixed(1), other: +R.other.toFixed(1),
                    vMin: R.vMin === Infinity ? null : Math.round(R.vMin),
                    armT: +R.armT.toFixed(1), orbitT: +R.orbitT.toFixed(1),
                    hzLand: +(R.hzLand || 0).toFixed(1), hzFloe: +(R.hzFloe || 0).toFixed(1),
                    hzNone: +(R.hzNone || 0).toFixed(1) });
            }
            return { seed, out };
        }, { seed, MODE });
        for (const x of r.out) rows.push(x);
        console.log('seed', r.seed, r.out.map(x =>
            `${x.name}: ring→flip ${x.tIn}s (in-ring ${x.ringT}) vMin ${x.vMin} slow ${x.slow}s` +
            ` [irons ${x.irons} ease ${x.ease} risk ${x.risk} defl ${x.defl} soft ${x.soft} other ${x.other}]` +
            ` armed ${x.armT} orbit ${x.orbitT}`).join('\n         '));
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const sum = k => rows.reduce((a, x) => a + (x[k] || 0), 0);
    console.log(`\n${MODE.toUpperCase()} POOLED over ${rows.length} ring passages:`);
    console.log('  ring→flip med', med(rows.map(x => x.tIn).filter(x => x != null)),
        's   vMin med', med(rows.map(x => x.vMin).filter(x => x != null)),
        '  slow med', med(rows.map(x => x.slow)), 's');
    const tot = sum('slow') || 1;
    console.log('  slow attribution:',
        ['irons', 'ease', 'risk', 'defl', 'soft', 'other']
            .map(k => `${k} ${sum(k).toFixed(0)}s (${(100 * sum(k) / tot).toFixed(0)}%)`).join('  '));
    console.log('  armed med', med(rows.map(x => x.armT)), 's  orbit med', med(rows.map(x => x.orbitT)), 's');
    console.log('  hard-zone blocker on the plan heading during slow frames:',
        `LAND ${sum('hzLand').toFixed(0)}s  FLOE ${sum('hzFloe').toFixed(0)}s  none ${sum('hzNone').toFixed(0)}s`);
    console.log('  HUMAN REF (same-race ledger): ring→flip 19s, vMin 85, slow 0.0s.');
    await browser.close();
})();
