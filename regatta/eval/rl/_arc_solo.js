// ARCTIC SOLO DECOMPOSITION — the 2x venue has NO live candidate; the gap
// ledger says the fleet in her races spends 45s under 4kt (her: 10s) and
// moves 6% slower even when moving. Take traffic out entirely: ONE bot races
// alone. Where does its time go vs her clean laps (215 med / 206 clean)?
//   per-leg time, odometer, sub-1kt / sub-4kt time, floe contacts, min-floe
//   distance profile, pack-discipline ease time (speedLimit < 1), and the
//   rounding entry (arm distance/time in zone).
//   node _arc_solo.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBP2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const races = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const R = { seed, name: hero.name, legT: {}, fin: null, odo: 0, sub1: 0, sub4: 0,
                movT: 0, movD: 0, easeT: 0, floeHits: 0, zoneT: 0, armT: 0 };
            let px = hero.x, py = hero.y, prevLeg = hero.raceState.leg;
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) R.floeHits++;
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                const ds = Math.hypot(hero.x - px, hero.y - py); px = hero.x; py = hero.y;
                const kt = hero.speed * 4;
                R.odo += ds;
                if (kt < 1) R.sub1 += 0.1;
                if (kt < 4) R.sub4 += 0.1; else { R.movT += 0.1; R.movD += ds; }
                const c = hero.controller;
                if (c && c.speedLimit < 0.99) R.easeT += 0.1;
                if (hero.raceState.roundArmed) R.armT += 0.1;
                const rm = state.course.dmc && state.course.dmc.legs[hero.raceState.leg]
                    && state.course.dmc.legs[hero.raceState.leg].pts.slice(-1)[0];
                if (rm && Math.hypot(hero.x - rm.x, hero.y - rm.y) < 250) R.zoneT += 0.1;
                if (hero.raceState.leg !== prevLeg) { R.legT[prevLeg] = +t.toFixed(0); prevLeg = hero.raceState.leg; }
                if (hero.raceState.finished && R.fin == null) { R.fin = +t.toFixed(1); break; }
            }
            return R;
        }, seed);
        races.push(r);
        console.log('seed', seed, r.name, 'fin', r.fin, 'legs', JSON.stringify(r.legT),
            'sub4', r.sub4.toFixed(0) + 's', 'ease', r.easeT.toFixed(0) + 's', 'floeHits', r.floeHits);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const fins = races.map(r => r.fin).filter(x => x != null);
    console.log('\nSOLO ARCTIC:', races.length, 'races, fins', fins.length, 'med', med(fins));
    console.log('  odo med', med(races.map(r => r.odo)).toFixed(0),
        ' moving speed med', med(races.map(r => r.movT > 0 ? r.movD / r.movT : 0)).toFixed(1), 'u/s');
    console.log('  sub1 med', med(races.map(r => r.sub1)).toFixed(0) + 's',
        ' sub4 med', med(races.map(r => r.sub4)).toFixed(0) + 's',
        ' easeT med', med(races.map(r => r.easeT)).toFixed(0) + 's',
        ' zoneT med', med(races.map(r => r.zoneT)).toFixed(0) + 's',
        ' armT med', med(races.map(r => r.armT)).toFixed(0) + 's');
    console.log('  floeHits med', med(races.map(r => r.floeHits)));
    console.log('  HUMAN REF (7 recordings): fin med 215 (206.2 clean best new); odo med 25373;');
    console.log('  moving speed 124.2 u/s; sub1 2s; sub4 10s.');
    await browser.close();
})();
