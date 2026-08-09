// P0 step 3 — ONE PARKED EPISODE, TICK BY TICK (the Lunker-replay move).
// _rr_boxwhy says the box's parked boats sit in 11.5kt wind at TWA ~76 with
// land inside the 140u hard zone on the plan heading, spdLim 1, defl ~6°, and
// do not accelerate. Physics says a close reach in 12kt accelerates from rest.
// Something in the control loop is eating the drive — watch it happen.
// Captures the FIRST episode of ≥8s parked-in-box per seed: 10 samples/s of
//   kt, heading°, target° (controller.targetHeading), desired-vs-actual gap,
//   twa°, sail trim state if exposed, dLandBow (ray at heading), dLandPlan,
//   defl°, x,y — printed 1 line/s with heading CHURN (max-min over the second).
//   node _rr_boxreplay.js <seed> <tree> [nEpisodes=2]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 9400;
const ROOT = path.join(__dirname, process.argv[3] || 'treeHEAD8');
const NEP = parseInt(process.argv[4]) || 2;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(async ([seed, NEP]) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
        const g = state.course.botGrid;
        const deg = r2 => +(r2 * 180 / Math.PI).toFixed(0);
        const landRay = (x, y, h) => {
            for (let d = 20; d <= 300; d += 20) {
                const cc = g.cell(x + Math.sin(h) * d, y - Math.cos(h) * d);
                if (!g.at(cc[0], cc[1])) return d;
            }
            return 999;
        };
        const inBox = (b) => b.x > -200 && b.x < 0 && b.y > 1000 && b.y < 1400;
        const track = {};  // name -> consecutive parked ticks
        let epi = [];
        const episodes = [];
        let watching = null, watchT = 0;
        const dt = 1 / 60;
        for (let it = 0; it < 60 * 900; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > 880) break;
            if (it % 6 !== 0) continue;    // 10Hz
            if (!watching) {
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const kt = b.speed * 4;
                    track[b.name] = (inBox(b) && kt < 1) ? (track[b.name] || 0) + 1 : 0;
                    if (track[b.name] >= 30) {   // 3s parked — latch on
                        watching = b; watchT = 0; epi = [];
                        break;
                    }
                }
            }
            if (watching) {
                const b = watching, c = b.controller;
                const w = getWindAt(b.x, b.y);
                epi.push({
                    t: +state.race.timer.toFixed(1), kt: +(b.speed * 4).toFixed(2),
                    hd: deg(b.heading), tg: c ? deg(c.targetHeading) : null,
                    lim: c ? +c.speedLimit.toFixed(2) : null,
                    twa: Math.abs(deg(norm(b.heading - w.direction))),
                    dLandBow: landRay(b.x, b.y, b.heading),
                    dLandTg: c ? landRay(b.x, b.y, c.targetHeading) : null,
                    defl: c ? deg((c.lastAvoidDeviation || 0)) : null,
                    x: +b.x.toFixed(0), y: +b.y.toFixed(0),
                    leg: b.raceState.leg, armed: !!b.raceState.roundArmed
                });
                watchT++;
                if (watchT >= 400 || b.raceState.finished || (!inBox(b) && b.speed * 4 > 3)) {
                    episodes.push({ name: b.name, seed, epi });
                    watching = null;
                    for (const k in track) track[k] = 0;
                    if (episodes.length >= NEP) break;
                }
            }
        }
        if (watching && epi.length) episodes.push({ name: watching.name, seed, epi });
        return episodes;
    }, [SEED, NEP]);
    for (const ep of r) {
        console.log(`\n=== ${ep.name} seed ${ep.seed} (${ep.epi.length / 10}s) ===`);
        console.log('t      kt    hd    tg  churn  twa dBow dTg  defl  lim   x     y   leg armed');
        for (let s = 0; s + 10 <= ep.epi.length; s += 10) {
            const w = ep.epi.slice(s, s + 10);
            const e = w[0];
            const hds = w.map(q => q.hd);
            let churn = 0;
            for (let i = 1; i < hds.length; i++) {
                let d = Math.abs(hds[i] - hds[i - 1]); if (d > 180) d = 360 - d;
                churn += d;
            }
            console.log([String(e.t).padEnd(6), String(e.kt).padStart(5), String(e.hd).padStart(5),
                String(e.tg).padStart(5), String(churn).padStart(5), String(e.twa).padStart(4),
                String(e.dLandBow).padStart(4), String(e.dLandTg).padStart(4),
                String(e.defl).padStart(5), String(e.lim).padStart(5),
                String(e.x).padStart(6), String(e.y).padStart(6),
                String(e.leg).padStart(3), e.armed ? ' A' : ' .'].join(' '));
        }
    }
    await browser.close();
})();
