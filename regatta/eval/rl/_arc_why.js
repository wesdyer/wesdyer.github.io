// ARCTIC EXCESS ANATOMY — SPLIT THE ROUTE FROM THE FOLLOWING (2026-08-08 push P0).
// _arc_clr.js killed the directive's premise at the measurement step: the router's
// chosen lines do sit at 330-410u clearance (vs her 200u), but it REFUSES almost
// nothing (1-3 of 23-40 plans had a ≥150u-clear straight it declined), its plans are
// only ~1.4x the straight line, and the opening-lead ×2.5 bets never fail (6 win /
// 0 fail / 6 abandoned pooled). Yet the solo bot sails 1.6-2.5x rhumb with 444 floe
// contacts. So: is the excess IN the plan, or in the boat not sailing it?
// Per solo race, per leg:
//   planOdo  — length of the CURRENT gridPath from the boat to the leg target,
//              sampled at replan time (what the router asks for)
//   odo      — what the boat actually sails
//   d0       — distance from the boat to its own gridPath (on-plan vs wandering)
//   tackOdo  — odometer while beating (|TWA| < 1.2 rad off the wind axis)
//   deflOdo  — odometer while |lastAvoidDeviation| > 0.26
//   softT    — time the boat spends INSIDE floe-blocked water (the grinding)
//   contacts — every floe contact tagged with d0, avoidance-active, speed, and
//              whether the boat's own cell was navigable in the plan-time grid
//              (a contact in NAVIGABLE water = the grid is stale/drifted;
//               a contact in BLOCKED water = the boat sailed into known ice)
//   node _arc_why.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD9');
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
            const R = { seed, name: hero.name, fin: null, odo: 0, deflOdo: 0, tackOdo: 0, softT: 0, blockT: 0,
                        d0: [], planLen: [], contacts: [], legOdo: {}, planSamp: 0, rhumb: 0 };
            // rhumb: sum of straight leg lengths from the course path
            try {
                let px2 = hero.x, py2 = hero.y;
                for (let lg = 0; lg <= state.race.totalLegs; lg++) {
                    const p = window.legTargetPoint ? window.legTargetPoint(lg) : null;
                    if (p) { R.rhumb += Math.hypot(p.x - px2, p.y - py2); px2 = p.x; py2 = p.y; }
                }
            } catch (e) {}
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
                const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            const distToPath = (b) => {
                const c = b.controller, gp = c && c.gridPath;
                if (!gp || gp.length < 2) return null;
                let best = Infinity;
                for (let k = 1; k < gp.length; k++) {
                    const a = gp[k - 1], q = gp[k];
                    const ax = a.x != null ? a.x : a[0], ay = a.y != null ? a.y : a[1];
                    const bx = q.x != null ? q.x : q[0], by = q.y != null ? q.y : q[1];
                    const d = segD(b.x, b.y, ax, ay, bx, by);
                    if (d < best) best = d;
                }
                return best === Infinity ? null : best;
            };
            const pathLen = (b) => {
                const c = b.controller, gp = c && c.gridPath;
                if (!gp || gp.length < 2) return null;
                let L = 0;
                for (let k = 1; k < gp.length; k++) {
                    const a = gp[k - 1], q = gp[k];
                    const ax = a.x != null ? a.x : a[0], ay = a.y != null ? a.y : a[1];
                    const bx = q.x != null ? q.x : q[0], by = q.y != null ? q.y : q[1];
                    L += Math.hypot(bx - ax, by - ay);
                }
                return L;
            };
            const inner = window.onRaceEvent;
            let lastC = -9;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) {
                        const t = state.race.timer;
                        if (t - lastC >= 0.5) {          // episodes, not frames
                            lastC = t;
                            const g = state.course.botGrid;
                            const cc = g && g.cell(hero.x, hero.y);
                            const nav = (g && cc) ? g.at(cc[0], cc[1]) : null;
                            const c = hero.controller;
                            R.contacts.push({ t: +t.toFixed(0), d0: +(distToPath(hero) || -1).toFixed(0),
                                nav: nav ? 1 : 0, defl: +Math.abs((c && c.lastAvoidDeviation) || 0).toFixed(2),
                                kt: +(hero.speed * 4).toFixed(1) });
                        }
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            let px = hero.x, py = hero.y;
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
                R.odo += ds;
                const leg = hero.raceState.leg;
                R.legOdo[leg] = (R.legOdo[leg] || 0) + ds;
                const c = hero.controller;
                if (c && Math.abs(c.lastAvoidDeviation || 0) > 0.26) R.deflOdo += ds;
                const w = getWindAt(hero.x, hero.y);
                if (Math.abs(norm(hero.heading - w.direction)) < 1.2) R.tackOdo += ds;
                const dd = distToPath(hero);
                if (dd != null) { R.d0.push(Math.round(dd)); R.planSamp++; }
                const pl2 = pathLen(hero);
                if (pl2 != null) R.planLen.push(Math.round(pl2));
                const g = state.course.botGrid;
                if (g) {
                    const cc = g.cell(hero.x, hero.y);
                    const id = cc[1] * g.n + cc[0];
                    if (cc[0] >= 0 && cc[1] >= 0 && cc[0] < g.n && cc[1] < g.n) {
                        if (!g.nav[id]) R.blockT += 0.1;
                        if (g._soft && g._soft[id]) R.softT += 0.1;
                    }
                }
                if (hero.raceState.finished && R.fin == null) { R.fin = +t.toFixed(1); break; }
            }
            const pct = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };
            return { seed: R.seed, name: R.name, fin: R.fin, odo: Math.round(R.odo), rhumb: Math.round(R.rhumb),
                deflPct: +(100 * R.deflOdo / R.odo).toFixed(0), tackPct: +(100 * R.tackOdo / R.odo).toFixed(0),
                softT: +R.softT.toFixed(0), blockT: +R.blockT.toFixed(0),
                d0med: pct(R.d0, 50), d0p90: pct(R.d0, 90), offPlan100: +(100 * R.d0.filter(x => x > 100).length / (R.d0.length || 1)).toFixed(0),
                nCon: R.contacts.length,
                conNav: R.contacts.filter(c => c.nav).length,
                conD0med: pct(R.contacts.map(c => c.d0).filter(x => x >= 0), 50),
                conDefl: R.contacts.filter(c => c.defl > 0.26).length,
                conKtMed: pct(R.contacts.map(c => c.kt), 50),
                legOdo: Object.fromEntries(Object.entries(R.legOdo).map(([k, v]) => [k, Math.round(v)])) };
        }, seed);
        races.push(r);
        console.log('seed', r.seed, r.name, 'fin', r.fin, 'odo', r.odo, 'rhumb', r.rhumb,
            'x' + (r.rhumb ? (r.odo / r.rhumb).toFixed(2) : '-'),
            '\n   defl%', r.deflPct, 'beat%', r.tackPct, 'softT', r.softT + 's', 'blockT', r.blockT + 's',
            '\n   d0 med', r.d0med, 'p90', r.d0p90, 'off-plan>100u', r.offPlan100 + '%',
            '\n   floe contacts', r.nCon, 'in NAVIGABLE water', r.conNav,
            '(' + (r.nCon ? Math.round(100 * r.conNav / r.nCon) : 0) + '% — stale grid)',
            'd0 med at contact', r.conD0med, 'while deflecting', r.conDefl, 'kt med', r.conKtMed,
            '\n   legOdo', JSON.stringify(r.legOdo));
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log('\nPOOLED over', races.length, 'solo races:');
    console.log('  fin med', med(races.map(r => r.fin).filter(x => x != null)),
        ' odo/rhumb med', med(races.map(r => r.rhumb ? +(r.odo / r.rhumb).toFixed(2) : 0)));
    console.log('  d0 med', med(races.map(r => r.d0med)), ' off-plan>100u med', med(races.map(r => r.offPlan100)) + '%',
        ' blockT med', med(races.map(r => r.blockT)) + 's', ' softT med', med(races.map(r => r.softT)) + 's');
    const nc = races.reduce((a, r) => a + r.nCon, 0), nn = races.reduce((a, r) => a + r.conNav, 0);
    console.log('  contacts pooled', nc, ' in navigable water', nn, '(' + (nc ? Math.round(100 * nn / nc) : 0) + '%)');
    console.log('  HUMAN REF: odo 25.4k = 1.06x rhumb; fin med 217.6; ~1 contact/run.');
    await browser.close();
})();
