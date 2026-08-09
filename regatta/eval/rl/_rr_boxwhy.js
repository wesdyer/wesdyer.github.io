// P0 step 2 — WHY IS THE ON-PLAN BOAT PARKED? (_rr_mdisp: the box mass is 97%
// on-plan, waiver ACTIVE in 70-77% of parked episodes — the displacement story
// is dead. So what holds a boat at <1 kt on its own corridor?) Every 2s of
// parked-in-box time, sample the physical situation:
//   wind    — speed at the boat (is the box a lull pocket?)
//   twa     — |heading−wind| in deg (engine: 0 = head-to-wind; <31° = in the
//             no-go tax zone, sails cannot drive)
//   planTwa — the PLAN direction's angle off the wind (is the corridor a beat
//             the boat must tack up in a confined pocket?)
//   blockAhead — a rival hull within 90u inside ±40° of the bow (physically
//             queued behind a raft-up)
//   hardPlan   — land within the 140u hard zone on the plan heading
//   boatProxPlan — the argmin's rival-nudge term on the plan heading
//   spdLim  — controller speedLimit (is a metering/ease governor the cap?)
//   defl    — |lastAvoidDeviation| deg
// Movers control: same samples for boats crossing the box at >2 kt — if wind
// and terms match, the difference is state, not place.
//   node _rr_boxwhy.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD8');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const parked = [], movers = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const g = state.course.botGrid;
            const parked = [], movers = [];
            const inBox = (b) => b.x > -200 && b.x < 0 && b.y > 1000 && b.y < 1400;
            const planDir = (c, b) => {
                if (!c || !c.gridPath || c.gridPath.length < 2) return null;
                const pts = c.gridPath;
                let j = 0, acc = 0;
                while (j < pts.length - 1 && acc < 260) {
                    acc += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].y - pts[j].y);
                    j++;
                }
                return Math.atan2(pts[j].x - b.x, -(pts[j].y - b.y));
            };
            const hardLand = (b, h) => {
                for (const d of [50, 95, 140]) {
                    const cc = g.cell(b.x + Math.sin(h) * d, b.y - Math.cos(h) * d);
                    const id = cc[1] * g.n + cc[0];
                    if (!g.at(cc[0], cc[1]) && !(g._soft && g._soft[id])) return true;
                }
                return false;
            };
            const boatProx = (b, h) => {
                const spd = Math.max(0.5 * 60, b.speed * 60);
                const vx = Math.sin(h) * spd, vy = -Math.cos(h) * spd;
                let c = 0;
                for (const o of state.boats) {
                    if (o === b || o.isPlayer || o.raceState.finished) continue;
                    const ovx = (o.velocity && o.velocity.x) ? o.velocity.x * 60 : Math.sin(o.heading) * o.speed * 60;
                    const ovy = (o.velocity && o.velocity.y) ? o.velocity.y * 60 : -Math.cos(o.heading) * o.speed * 60;
                    for (let s2 = 1; s2 <= 5; s2++) {
                        const t = s2 * 0.8;
                        const dx = (b.x + vx * t) - (o.x + ovx * t);
                        const dy = (b.y + vy * t) - (o.y + ovy * t);
                        const d2 = dx * dx + dy * dy;
                        if (d2 < 250 * 250) c += 5000 / (d2 + 10);
                    }
                }
                return c;
            };
            const blockAhead = (b) => {
                for (const o of state.boats) {
                    if (o === b || o.isPlayer || o.raceState.finished) continue;
                    const dx = o.x - b.x, dy = o.y - b.y;
                    const d = Math.hypot(dx, dy);
                    if (d > 90) continue;
                    const brg = Math.atan2(dx, -dy);
                    if (Math.abs(norm(brg - b.heading)) < 0.7) return true;
                }
                return false;
            };
            const tk = {};
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (const b of bots) {
                    if (b.raceState.finished || !inBox(b)) continue;
                    const key = b.name;
                    tk[key] = (tk[key] || 0) + 1;
                    if (tk[key] % 20 !== 1) continue;   // one sample per 2s per boat
                    const c = b.controller;
                    const kt = b.speed * 4;
                    const w = getWindAt(b.x, b.y);
                    const hp = planDir(c, b);
                    const rec = {
                        seed, kt: +kt.toFixed(1), leg: b.raceState.leg,
                        wind: +w.speed.toFixed(1),
                        twa: +(Math.abs(norm(b.heading - w.direction)) * 180 / Math.PI).toFixed(0),
                        planTwa: hp == null ? null : +(Math.abs(norm(hp - w.direction)) * 180 / Math.PI).toFixed(0),
                        blockAhead: blockAhead(b),
                        hardPlan: hp == null ? null : hardLand(b, hp),
                        proxPlan: hp == null ? null : +boatProx(b, hp).toFixed(0),
                        spdLim: c ? +(c.speedLimit).toFixed(2) : null,
                        defl: +((((c && c.lastAvoidDeviation) || 0)) * 180 / Math.PI).toFixed(0)
                    };
                    if (kt < 1) parked.push(rec); else if (kt > 2) movers.push(rec);
                }
            }
            return { parked, movers };
        }, seed);
        parked.push(...r.parked); movers.push(...r.movers);
        console.log('seed', seed, 'parkedSamples', r.parked.length, 'moverSamples', r.movers.length);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const pct = (n, d) => (100 * n / Math.max(1, d)).toFixed(0) + '%';
    const rep = (label, E) => {
        if (!E.length) { console.log(label, '0 samples'); return; }
        console.log(label, E.length, 'samples');
        console.log('   wind med', med(E.map(e => e.wind)), 'kt   twa med', med(E.map(e => e.twa)),
            '°  planTwa med', med(E.filter(e => e.planTwa != null).map(e => e.planTwa)), '°');
        console.log('   in-irons(twa<31°)', pct(E.filter(e => e.twa < 31).length, E.length),
            '  planUpwind(<31°)', pct(E.filter(e => e.planTwa != null && e.planTwa < 31).length, E.length),
            '  blockAhead', pct(E.filter(e => e.blockAhead).length, E.length));
        console.log('   hardPlan', pct(E.filter(e => e.hardPlan === true).length, E.length),
            '  proxPlan med', med(E.filter(e => e.proxPlan != null).map(e => e.proxPlan)),
            '  spdLim med', med(E.filter(e => e.spdLim != null).map(e => e.spdLim)),
            '  |defl| med', med(E.map(e => Math.abs(e.defl))), '°');
        const w5 = E.filter(e => e.wind < 5);
        console.log('   wind<5kt share', pct(w5.length, E.length),
            '  wind bins {<3:', E.filter(e => e.wind < 3).length,
            ', 3-5:', E.filter(e => e.wind >= 3 && e.wind < 5).length,
            ', 5-8:', E.filter(e => e.wind >= 5 && e.wind < 8).length,
            ', >8:', E.filter(e => e.wind >= 8).length, '}');
    };
    rep('\nPARKED (<1kt) in box:', parked);
    rep('\nMOVERS (>2kt) in box:', movers);
    await browser.close();
})();
