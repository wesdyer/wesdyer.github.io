// C2 SOLO GATE (2026-08-22, arctic router push): solo NEUTRAL races (the
// _arc_solo pattern — identical stats, no archetype, shipped difficulty),
// reporting fin / odometer / per-leg MANOEUVRE COUNT (hull side vs local
// wind, previous side stable >= 0.5s — the _flips convention) / floe
// EPISODES (0.5s dedup, rule 2). Pre-registered criteria: leg-1 tacks
// toward <= 12 with clock flat-or-better on 4 seeds (his ladder: 7 med
// leg 1, 8 med leg 2).
//   node _c2_solo.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNP5');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const races = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const R = { seed, name: hero.name, legT: {}, fin: null, odo: 0,
                tacksByLeg: {}, floeEp: 0 };
            let px = hero.x, py = hero.y, prevLeg = hero.raceState.leg;
            let side = null, sideT = 0, lastFloeT = -10;
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) {
                        const tE = state.race.timer;
                        if (tE - lastFloeT > 0.5) R.floeEp++;
                        lastFloeT = tE;
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                const ds = Math.hypot(hero.x - px, hero.y - py); px = hero.x; py = hero.y;
                R.odo += ds;
                const wd = getWindAt(hero.x, hero.y).direction;
                const s = norm(hero.heading - wd) >= 0 ? 1 : -1;
                if (side === null) { side = s; sideT = t; }
                else if (s !== side) {
                    if (t - sideT >= 0.5) {
                        const L = hero.raceState.leg;
                        R.tacksByLeg[L] = (R.tacksByLeg[L] || 0) + 1;
                    }
                    side = s; sideT = t;
                }
                if (hero.raceState.leg !== prevLeg) { R.legT[prevLeg] = +t.toFixed(0); prevLeg = hero.raceState.leg; }
                if (hero.raceState.finished && R.fin == null) { R.fin = +t.toFixed(1); break; }
            }
            return R;
        }, seed);
        races.push(r);
        console.log('seed', seed, r.name, 'fin', r.fin, 'legs', JSON.stringify(r.legT),
            'tacks', JSON.stringify(r.tacksByLeg), 'floeEp', r.floeEp, 'odo', r.odo.toFixed(0));
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const fins = races.map(r => r.fin).filter(x => x != null);
    console.log('\nC2 SOLO ARCTIC (' + path.basename(ROOT) + '):', races.length, 'races, fins', fins.length, '/', races.length, ' med', med(fins));
    console.log('  leg-1 tacks med', med(races.map(r => r.tacksByLeg[1] || 0)),
        '  leg-2 tacks med', med(races.map(r => r.tacksByLeg[2] || 0)),
        '  odo med', med(races.map(r => r.odo)).toFixed(0),
        '  floeEp med', med(races.map(r => r.floeEp)));
    console.log('  HIS LADDER: leg-1 7 (4-10), leg-2 8 (7-12); fin med 207.0; odo ~25.4k');
    await browser.close();
})();
