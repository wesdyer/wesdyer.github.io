// DOES THE TACTICIAN RE-DECIDE ITS TACK EVERY FRAME? (2026-08-27)
// getStrategicHeading's FORCE/RECOVERY branch carries an explicit `forceTack`
// latch with a 0.4-rad deadband, and its own comment says why: "the raw tack
// choice flips every frame, parking the boat head-to-wind (in irons) so it
// mills near the line". The NORMAL upwind path has no such latch — it scores
// hStarboard against hPort fresh every tick. The campaign has closed
// avoidance-side commitment (0-for-7) and an avoidance-triggered tack
// stickiness, but never measured the tactician's OWN churn.
// So: wrap getStrategicHeading read-only, record which tack it returns each
// frame on upwind legs, and count how often that choice REVERSES, and how many
// reversals are undone again within 3 s (churn rather than strategy).
//   node _tackflip.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock', TRIALS = parseInt(process.argv[3] || '4');
const SEED0 = parseInt(process.argv[4] || '9400');
const ROOT = path.join(__dirname, process.argv[5] || 'treeSPP');
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    let tot = { frames: 0, rev: 0, churn: 0, dwellS: [], hullFlips: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = {}; const out = { frames: 0, rev: 0, churn: 0, dwellS: [], hullFlips: 0 };
            const wrap = () => { for (const b of state.boats) { const c = b.controller; if (!c || c.__tw) continue;
                const g = c.getStrategicHeading.bind(c);
                c.getStrategicHeading = (tg) => { const h = g(tg); b._cmdH = h; return h; }; c.__tw = 1; } };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt); wrap();
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const tm = state.race.timer; if (tm > 900) break;
                for (const b of state.boats) {
                    if (b.raceState.finished || b.raceState.leg < 1 || b._cmdH == null) continue;
                    const w = getWindAt(b.x, b.y);
                    const twaCmd = nm(b._cmdH - w.direction);
                    if (Math.abs(twaCmd) > 1.2) continue;      // upwind commands only
                    const s = S[b.name] = S[b.name] || { side: 0, since: tm, lastRev: -99, hull: 0 };
                    out.frames++;
                    const sd = twaCmd > 0 ? 1 : -1;
                    if (s.side !== 0 && sd !== s.side) {
                        out.rev++;
                        out.dwellS.push(tm - s.since);
                        if (tm - s.lastRev < 3) out.churn++;
                        s.lastRev = tm; s.since = tm;
                    }
                    s.side = sd;
                    const hull = nm(b.heading - w.direction) > 0 ? 1 : -1;
                    if (s.hull !== 0 && hull !== s.hull) out.hullFlips++;
                    s.hull = hull;
                }
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t });
        tot.frames += r.frames; tot.rev += r.rev; tot.churn += r.churn; tot.hullFlips += r.hullFlips;
        tot.dwellS.push(...r.dwellS);
    }
    await br.close();
    const d = tot.dwellS.sort((a, b) => a - b);
    const q = p => d.length ? d[Math.floor(p * (d.length - 1))] : NaN;
    console.log(`\n══ ${VENUE} — does the tactician re-decide its tack? (${TRIALS} races, upwind commands only)`);
    console.log(`  upwind command frames:            ${tot.frames}`);
    console.log(`  COMMANDED tack reversals:         ${tot.rev}   (${(tot.rev / (tot.frames / 3600)).toFixed(1)} per boat-minute of upwind command)`);
    console.log(`  of those, reversed again <3 s:    ${tot.churn}  = ${(100 * tot.churn / (tot.rev || 1)).toFixed(1)}%  ← churn, not strategy`);
    console.log(`  dwell on a commanded tack (s):    p10 ${q(.1).toFixed(2)}  p25 ${q(.25).toFixed(2)}  MED ${q(.5).toFixed(2)}  p75 ${q(.75).toFixed(2)}`);
    console.log(`  HULL side changes over the same frames: ${tot.hullFlips}  (ratio commanded/hull ${(tot.rev / (tot.hullFlips || 1)).toFixed(2)})`);
})();
