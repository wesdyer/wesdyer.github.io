// IS THE ROUTE LONG, OR IS THE BOAT OFF IT? — per venue and leg (2026-08-27).
// The distance atlas says the whole remaining gap is extra ground distance, and
// the per-cell maps say the biggest pockets are 87-100% NAV-owned (glowtide
// leg 2, lagoon leg 4) — no avoidance, no contact, no reflex. Two opposite
// stories fit that, and they want opposite fixes:
//   ROUTER  — the boat's own planned path is longer than his line, and she
//             sails it faithfully;
//   DRIVER  — the plan is near-direct and she cannot hold it.
// Sample both, per second, on the leg:
//   planRatio = (length of the boat's OWN gridPath ahead) / (straight line ahead)
//   offPlan   = distance from the boat to its own gridPath polyline
//   trackRatio= ground odometer / straight line, for the same boat-leg
//   node _plan_vs_track.js <venue> <leg> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'lagoon', LEG = parseInt(process.argv[3] || '4');
const TRIALS = parseInt(process.argv[4] || '6'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeSPP');
const q = (a, p) => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
(async () => {
    const browser = await chromium.launch(); const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const P = [], O = [], T = [], PL = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const segDist = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
                let u = ((px - ax) * dx + (py - ay) * dy) / L2; u = Math.max(0, Math.min(1, u));
                return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
            };
            const out = { pr: [], off: [], tr: [], plen: [] };
            const st = {}; const dt = 1 / 60;
            let prev = state.boats.map(b => ({ x: b.x, y: b.y }));
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') { prev = state.boats.map(b => ({ x: b.x, y: b.y })); continue; }
                if (state.race.timer > 900) break;
                state.boats.forEach((b, k) => {
                    if (b.raceState.finished) return;
                    const s = st[b.name] = st[b.name] || { leg: null, odo: 0, x0: 0, y0: 0 };
                    if (s.leg !== b.raceState.leg) {
                        if (s.leg === LEG) { const straight = Math.hypot(b.x - s.x0, b.y - s.y0);
                            if (straight > 50) out.tr.push(s.odo / straight); }
                        s.leg = b.raceState.leg; s.odo = 0; s.x0 = b.x; s.y0 = b.y;
                    }
                    s.odo += Math.hypot(b.x - prev[k].x, b.y - prev[k].y);
                    if (b.raceState.leg !== LEG || it % 60) return;
                    const c = b.controller; const gp = c && c.gridPath;
                    if (!gp || gp.length < 2) return;
                    let plen = 0, off = Infinity;
                    for (let i = 1; i < gp.length; i++) {
                        plen += Math.hypot(gp[i].x - gp[i - 1].x, gp[i].y - gp[i - 1].y);
                        off = Math.min(off, segDist(b.x, b.y, gp[i - 1].x, gp[i - 1].y, gp[i].x, gp[i].y));
                    }
                    const end = gp[gp.length - 1];
                    const straightAhead = Math.hypot(end.x - b.x, end.y - b.y);
                    if (straightAhead > 200) { out.pr.push(plen / straightAhead); out.plen.push(plen); out.off.push(off); }
                });
                prev = state.boats.map(b => ({ x: b.x, y: b.y }));
                if (state.boats.every(b => b.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG });
        P.push(...r.pr); O.push(...r.off); T.push(...r.tr); PL.push(...r.plen);
    }
    await browser.close();
    console.log(`\n══ ${VENUE} leg ${LEG} — is the ROUTE long, or is the BOAT off it?  (${TRIALS} races)`);
    console.log(`  planRatio  (own gridPath ahead / straight ahead):  p25 ${q(P,.25).toFixed(3)}  MED ${q(P,.5).toFixed(3)}  p75 ${q(P,.75).toFixed(3)}   n=${P.length}`);
    console.log(`  offPlan    (boat to its own gridPath, units):      p25 ${q(O,.25).toFixed(0)}  MED ${q(O,.5).toFixed(0)}  p75 ${q(O,.75).toFixed(0)}  p90 ${q(O,.9).toFixed(0)}`);
    console.log(`  trackRatio (ground odometer / straight, per leg):  p25 ${q(T,.25).toFixed(3)}  MED ${q(T,.5).toFixed(3)}  p75 ${q(T,.75).toFixed(3)}   n=${T.length}`);
    console.log(`  ⇒ the router asks for ${((q(P,.5)-1)*100).toFixed(0)}% over the straight line; the boat delivers ${((q(T,.5)-1)*100).toFixed(0)}%.`);
})();
