// WHAT SUSTAINS A RE-HIT CHAIN? (2026-08-14, the tail push)
//
// _tail_kind found the slow tail's land contacts are CHAINS: re-hits on the same
// obstacle every ~2.3 s, drifting a tight 57-70u along the wall per cycle, entering
// at 42 u/s (never recovered — the reaccel constant is ~5.5 s). The fast quartile's
// contacts are one-off touches at 91 u/s. So the question is not "why does she hit
// rock" but "why does she come BACK within 2.3 s, ~30 times in a row".
//
// This records, for every frame within 6 s after a land contact (sampled at 0.1 s):
// position, heading, commanded heading (controller.targetHeading — the LAST WRITER's
// output, rule 27), signed TWA, speed, helm owner, wind direction. Plus every hit
// (t, x, y, isl). The analyzer (_chain_traj_report.js) reconstructs each chain's
// wall tangent from consecutive hit positions and answers:
//   Q1 who owns the helm between hits           Q2 is the wall a lee shore
//   Q3 is she close-hauled converging (a beat)  Q4 does she ever tack off
//   Q5 does the COMMANDED heading point back into the wall, and whose command
//
//   node _chain_traj.js <trials> <seed0> <label> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const LABEL = process.argv[4] || 'rr';
const ROOT = path.join(__dirname, process.argv[5] || 'treeTAIL');
const VENUE = process.argv[6] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__hits = null; window.__lastHit = {};
        window.onRaceEvent = (ty, d) => {
            try {
                if (window.__hits && d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished
                    && ty === 'collision_island' && !d.isFloe && state.race.status === 'racing') {
                    const b = d.boat, t = state.race.timer;
                    const lh = window.__lastHit[b.name];
                    if (lh == null || t - lh > 1.0) { // episode starts, matching _tail_kind
                        const cd = b.ai && b.ai.collisionData;
                        window.__hits.push({ t: +t.toFixed(2), n: b.name, x: Math.round(b.x), y: Math.round(b.y),
                            nx: cd && cd.normal ? +cd.normal.x.toFixed(3) : null,
                            ny: cd && cd.normal ? +cd.normal.y.toFixed(3) : null,
                            arm: b.raceState.roundArmed ? 1 : 0, leg: b.raceState.leg });
                    }
                    window.__lastHit[b.name] = t;
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });
    const out = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__hits = []; window.__lastHit = {};
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const samples = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 900) break;
                if (it % 6 !== 0) continue; // 0.1 s cadence
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const lh = window.__lastHit[b.name];
                    if (lh == null || t - lh > 6.0) continue;
                    const c = b.controller; if (!c) continue;
                    const w = getWindAt(b.x, b.y);
                    const own = c.penaltySpin ? 1 : c.escActive ? 2 : (c.iceEscapeTimer > 0) ? 3
                        : c.wiggleActive ? 4 : 5; // 5 = clearance/nav ("steering layer")
                    samples.push([b.name, +t.toFixed(2), Math.round(b.x), Math.round(b.y),
                        +b.heading.toFixed(3), +(c.targetHeading || 0).toFixed(3),
                        +w.direction.toFixed(3), Math.round(b.speed * 60), own,
                        +(c.speedLimit != null ? c.speedLimit : 1).toFixed(2),
                        +(c.iceEscapeHeading || 0).toFixed(3), b.raceState.roundArmed ? 1 : 0]);
                }
            }
            const fins = bots.filter(b => b.raceState.finished).length;
            return { hits: window.__hits, samples, fins };
        }, seed);
        out.push({ seed, ...r });
        console.log(`seed ${seed}: fins ${r.fins} hits ${r.hits.length} samples ${r.samples.length}`);
    }
    fs.writeFileSync(path.join(__dirname, `_chaintraj_${LABEL}.json`), JSON.stringify(out));
    console.log(`saved _chaintraj_${LABEL}.json venue ${VENUE}`);
    await browser.close();
})();
