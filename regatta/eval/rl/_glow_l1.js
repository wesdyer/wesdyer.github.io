// IS THE FLEET PLANNING INTO GLOWTIDE'S ROCKS, OR BEING SET INTO THEM? (2026-08-12)
//
// `_gap_grid` leg 1: the four hottest cells — (-125,-1125) 8.9 s/lap,
// (-125,-875) 6.8, (-375,-875) 5.5, (-375,-625) 3.7 — carry 28 s of the leg's
// 42 s gap and **his time in every one of them is 0.0 s**. He does not go there.
// The fleet does, at 36-67 u/s, with 11-22% of its frames in contact and 25-47%
// under the island reflex. That is a route failure, not an execution one.
//
// Glowtide is the high-current venue, so there are two candidate mechanisms and
// they need opposite fixes:
//   MAP   — the router PLANS through the rocks (pathSailable admits the water)
//   SET   — the plan avoids them and the CURRENT carries the fleet in anyway
//           (the ground-frame class: a commanded heading is not where the boat
//           goes — the river landings fbb1c27 / 2cbf847)
//
// So: for every boat on leg 1, how close does its own PLAN come to the hot box,
// how close does the BOAT come, what is the current there, and what is the angle
// between the commanded heading and the actual track?
//   node _glow_l1.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeM');
// the hot box from _gap_grid leg 1
const BOX = { x0: -750, x1: 0, y0: -1750, y1: -500 };
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { inBox: 0, planInBox: 0, boats: 0, drift: [], cur: [], setAng: [], curSpd: [], slow: 0, n: 0, blocked: 0, soft: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, BOX }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const S = { inBox: 0, planInBox: 0, names: {}, drift: [], setAng: [], curSpd: [], slow: 0, n: 0, blocked: 0, soft: 0, grid: null };
            const inBox = (x, y) => x >= BOX.x0 && x <= BOX.x1 && y >= BOX.y0 && y <= BOX.y1;
            const seen = {};
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== 1) continue;
                    S.names[b.name] = 1;
                    const c = b.controller;
                    // does the boat's OWN PLAN pass through the box?
                    // ⚠️ SAMPLE THE SEGMENTS, NOT THE VERTICES (rule 18). A grid path can
                    // cross the box on a long straight leg with no vertex inside it, and a
                    // vertex-only test then reports a route that never goes there. And test
                    // EVERY replan, not just the first — the question is whether the route
                    // EVER buys this water.
                    if (c && c.gridPath && c.gridPath.length > 1 && !seen[b.name]) {
                        let ax = b.x, ay = b.y, crossed = 0;
                        for (const qq of c.gridPath) {
                            const L = Math.hypot(qq.x - ax, qq.y - ay), st = Math.max(1, Math.ceil(L / 40));
                            for (let i = 1; i <= st; i++) {
                                if (inBox(ax + (qq.x - ax) * i / st, ay + (qq.y - ay) * i / st)) { crossed = 1; break; }
                            }
                            if (crossed) break;
                            ax = qq.x; ay = qq.y;
                        }
                        if (crossed) { seen[b.name] = 1; S.planInBox++; }
                    }
                    if (!inBox(b.x, b.y)) continue;
                    S.n++;
                    if (b.speed * 60 < 40) S.slow++;
                    const cur = getCurrentAt(b.x, b.y);
                    if (cur && cur.speed > 0.01) {
                        S.curSpd.push(+cur.speed.toFixed(2));
                        // angle between the COMMANDED heading and the actual TRACK over ground
                        const vx = Math.sin(b.heading) * b.speed + Math.sin(cur.direction) * (cur.speed / 4);
                        const vy = -Math.cos(b.heading) * b.speed - Math.cos(cur.direction) * (cur.speed / 4);
                        const trk = Math.atan2(vx, -vy);
                        let d = trk - b.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
                        S.setAng.push(+(d * 180 / Math.PI).toFixed(1));
                    }
                }
                if (state.race.timer > 895) break;
            }
            // is the box even navigable on the grid the router uses?
            const g = state.course.botGrid;
            if (g) {
                for (let x = BOX.x0; x <= BOX.x1; x += 50) for (let y = BOX.y0; y <= BOX.y1; y += 50) {
                    const cc = g.cell(x, y); const id = cc[1] * g.n + cc[0];
                    if (!g.at(cc[0], cc[1])) S.blocked++; else if (g._soft && g._soft[id]) S.soft++;
                    S.grid = (S.grid || 0) + 1;
                }
            }
            S.nBoats = Object.keys(S.names).length;
            return S;
        }, { seed: SEED0 + t, BOX });
        A.inBox += r.n; A.planInBox += r.planInBox; A.boats += r.nBoats; A.slow += r.slow;
        A.setAng.push(...r.setAng); A.curSpd.push(...r.curSpd);
        A.blocked = r.blocked; A.soft = r.soft; A.gridN = r.grid;
        console.log(`seed ${SEED0 + t}: ${r.nBoats} boats, ${r.planInBox} planned through the box, ${(r.n / 60).toFixed(1)} boat-s inside it`);
    }
    await br.close();
    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    console.log(`\n=== ${VENUE.toUpperCase()} LEG 1 HOT BOX  x[${BOX.x0},${BOX.x1}] y[${BOX.y0},${BOX.y1}] ===`);
    console.log(`the box on the ROUTER'S OWN GRID: ${(100 * A.blocked / (A.gridN || 1)).toFixed(0)}% blocked, ${(100 * A.soft / (A.gridN || 1)).toFixed(0)}% soft, ${(100 * (A.gridN - A.blocked - A.soft) / (A.gridN || 1)).toFixed(0)}% clear`);
    console.log(`⭐ boats whose OWN PLAN passes through the box: ${A.planInBox}/${A.boats} (${(100 * A.planInBox / (A.boats || 1)).toFixed(0)}%)`);
    console.log(`   boat-seconds spent inside it: ${(A.inBox / 60 / (A.boats || 1)).toFixed(1)} s/boat   (under 40 u/s on ${(100 * A.slow / (A.inBox || 1)).toFixed(0)}%)`);
    console.log(`   current there: med ${q(A.curSpd, .5)} kt  p90 ${q(A.curSpd, .9)} kt`);
    console.log(`   ⭐ SET — angle between commanded heading and actual TRACK: med ${q(A.setAng.map(Math.abs), .5)}deg  p90 ${q(A.setAng.map(Math.abs), .9)}deg`);
})();
