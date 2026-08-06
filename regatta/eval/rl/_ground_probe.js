// WHY IS THE FLEET HITTING THE BEACH? — every shoreline contact, with the state that
// led to it.
//
// Stillwater Lake's bots take 30.6 land collisions per boat-race (Lighthouse Cove: 0.22).
// A contact count alone names nothing, so this records at the moment of every
// `collision_island` event: the boat's speed, the LOCAL WIND SPEED, whether avoidance
// was deflecting her at the time, and how far she was off her own planned route. The
// hypothesis under test is LIGHT-AIR BLINDNESS — every lookahead in the AI is
// `speed x seconds`, so a boat doing 1.7 kt sees a quarter of the water a boat doing
// 7 kt sees, at exactly the moment she needs more warning, not less.
//
// The control is the wind-speed histogram of all sailing time: a contact rate that
// simply tracks time-in-band is not a light-air effect.
//
//   node _ground_probe.js <trials> <seed0> <tree> [venue] [maxT]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD');
const VENUE = process.argv[5] || 'lake';
const MAXT = parseInt(process.argv[6] || '900');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async ({ seed, maxT }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = maxT;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const bandOf = (s) => s < 2 ? '<2' : s < 4 ? '2-4' : s < 6 ? '4-6' : s < 8 ? '6-8' : '8+';
            const hits = [];
            const lastT = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe) {
                    const b = d.boat, k = b.name, t = state.race.timer;
                    if (!(lastT[k] != null && t - lastT[k] < 0.5)) {
                        lastT[k] = t;
                        const c = b.controller;
                        const w = getWindAt(b.x, b.y);
                        let xtk = null, navBrgOff = null;
                        if (c && c.gridPath && c.gridPath.length) {
                            let best = Infinity;
                            for (const p of c.gridPath) {
                                const dd = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
                                if (dd < best) best = dd;
                            }
                            xtk = Math.sqrt(best);
                        }
                        if (c && c.navTarget) {
                            const brg = Math.atan2(c.navTarget.x - b.x, -(c.navTarget.y - b.y));
                            let dd = brg - b.heading;
                            while (dd > Math.PI) dd -= 2 * Math.PI;
                            while (dd < -Math.PI) dd += 2 * Math.PI;
                            navBrgOff = Math.abs(dd) * 180 / Math.PI;
                        }
                        hits.push({
                            t: +t.toFixed(1), leg: b.raceState.leg,
                            kt: +(b.speed / 0.25).toFixed(2),
                            wind: +w.speed.toFixed(2), band: bandOf(w.speed),
                            avd: c ? +((c.lastAvoidDeviation || 0) * 180 / Math.PI).toFixed(0) : null,
                            xtk: xtk == null ? null : +xtk.toFixed(0),
                            navOff: navBrgOff == null ? null : +navBrgOff.toFixed(0),
                            wig: c ? !!c.wiggleActive : null,
                            live: c ? c.livenessState : null,
                            x: Math.round(b.x), y: Math.round(b.y)
                        });
                    }
                }
                return inner && inner(ty, d);
            };
            const windTime = {}, sTime = {};   // time by wind band; and by boat-speed band
            const dt = 1 / 60;
            let sampAcc = 0;
            for (let it = 0; it < 60 * (maxT + 40); it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > maxT) break;
                if (++sampAcc >= 30) {         // 0.5 s sampling
                    sampAcc = 0;
                    for (const b of bots) {
                        if (b.raceState.finished) continue;
                        const bd = bandOf(getWindAt(b.x, b.y).speed);
                        windTime[bd] = (windTime[bd] || 0) + 0.5;
                        const kt = b.speed / 0.25;
                        const sb = kt < 1 ? '<1' : kt < 2 ? '1-2' : kt < 4 ? '2-4' : kt < 6 ? '4-6' : '6+';
                        sTime[sb] = (sTime[sb] || 0) + 0.5;
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return { seed, hits, windTime, sTime,
                     fins: bots.filter(b => b.raceState.finished).length };
        }, { seed: SEED0 + i, maxT: MAXT });
        all.push(r);
        console.error('seed ' + r.seed + ' hits=' + r.hits.length + ' fins=' + r.fins);
    }
    console.log(JSON.stringify(all));
    await browser.close();
})();
