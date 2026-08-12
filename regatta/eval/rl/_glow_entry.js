// WHAT PUTS THE FLEET IN GLOWTIDE'S ROCKS? (2026-08-12)
//
// `_glow_l1`: the leg-1 hot box is 37% blocked on the router's own grid, **0 of 36
// boats plan through it**, and the fleet still spends **45.7 s/boat** inside it —
// against a whole leg-1 gap of 42.1 s. So the route is innocent and this is the
// DISPLACEMENT class (rule 17: "Route pricing cannot reach displacement-driven
// failures; fix the displacement, not the map").
//
// The current there is 1.33 kt median (p90 2.6) and the set — the angle between
// the commanded heading and the actual track — is 13.6 deg median. That is a
// candidate, but so are the avoidance fan and the island reflex.
//
// This catches the ENTRY: the moment each boat first crosses into the box, and the
// five seconds before it. Who owned the helm, how far off its own plan was it
// already, what was the set, and was it being deflected?
//   node _glow_entry.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeM');
const BOX = { x0: -750, x1: 0, y0: -1750, y1: -500 };
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = { ent: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, BOX }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const inBox = (x, y) => x >= BOX.x0 && x <= BOX.x1 && y >= BOX.y0 && y <= BOX.y1;
            const S = { ent: [] };
            const hist = {}, done = {};
            const DT = 1 / 60; let now = 0;
            const offPlan = (b) => {
                const c = b.controller; if (!c || !c.gridPath || c.gridPath.length < 2) return null;
                let best = 1e9, px = b.x, py = b.y;
                let ax = b.x, ay = b.y;
                for (const q of c.gridPath) {
                    const dx = q.x - ax, dy = q.y - ay, L2 = dx * dx + dy * dy || 1;
                    let tt = ((px - ax) * dx + (py - ay) * dy) / L2; tt = Math.max(0, Math.min(1, tt));
                    const cx = ax + dx * tt, cy = ay + dy * tt;
                    const d = Math.hypot(px - cx, py - cy); if (d < best) best = d;
                    ax = q.x; ay = q.y;
                }
                return best;
            };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT); now += DT;
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== 1) continue;
                    const H = hist[b.name] = hist[b.name] || [];
                    const cur = getCurrentAt(b.x, b.y);
                    const c = b.controller;
                    let set = 0;
                    if (cur && cur.speed > 0.01 && b.speed > 0.05) {
                        const vx = Math.sin(b.heading) * b.speed + Math.sin(cur.direction) * (cur.speed / 4);
                        const vy = -Math.cos(b.heading) * b.speed - Math.cos(cur.direction) * (cur.speed / 4);
                        let d = Math.atan2(vx, -vy) - b.heading;
                        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
                        set = d * 180 / Math.PI;
                    }
                    H.push({ t: now, x: b.x, y: b.y, spd: b.speed * 60, set,
                             dev: c ? +(c.lastAvoidDeviation || 0).toFixed(3) : 0,
                             wig: c && c.wiggleActive ? 1 : 0, esc: c && c.iceEscapeTimer > 0 ? 1 : 0,
                             off: offPlan(b) });
                    if (H.length > 400) H.shift();
                    if (!done[b.name] && inBox(b.x, b.y)) {
                        done[b.name] = 1;
                        const pre = H.filter(h => now - h.t <= 5 && now - h.t > 0);
                        const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
                        S.ent.push({
                            offAtEntry: H[H.length - 1].off, offBefore: med(pre.map(h => h.off).filter(v => v != null)),
                            setMed: med(pre.map(h => Math.abs(h.set))), spd: med(pre.map(h => h.spd)),
                            devMed: med(pre.map(h => h.dev)), devMax: Math.max(...pre.map(h => h.dev), 0),
                            wig: pre.some(h => h.wig) ? 1 : 0, esc: pre.some(h => h.esc) ? 1 : 0,
                            t: +now.toFixed(0)
                        });
                    }
                }
                if (state.race.timer > 895) break;
            }
            return S;
        }, { seed: SEED0 + t, BOX });
        A.ent.push(...r.ent);
        console.log(`seed ${SEED0 + t}: ${r.ent.length} boats entered the box`);
    }
    await br.close();
    const q = (a, pp) => { const s = a.filter(v => v != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const E = A.ent, n = E.length || 1;
    console.log(`\n=== ${VENUE.toUpperCase()}: HOW THE FLEET ARRIVES IN THE ROCKS (${E.length} entries) ===`);
    console.log(`   DISTANCE FROM ITS OWN PLAN at the moment of entry: med ${q(E.map(e => e.offAtEntry), .5).toFixed(0)}u  p75 ${q(E.map(e => e.offAtEntry), .75).toFixed(0)}u  p90 ${q(E.map(e => e.offAtEntry), .9).toFixed(0)}u`);
    console.log(`   ...and in the 5 s before:                          med ${q(E.map(e => e.offBefore), .5).toFixed(0)}u`);
    console.log(`   SET in the 5 s before: med ${q(E.map(e => e.setMed), .5).toFixed(1)}deg  p90 ${q(E.map(e => e.setMed), .9).toFixed(1)}deg`);
    console.log(`   speed before entry:    med ${q(E.map(e => e.spd), .5).toFixed(0)} u/s`);
    console.log(`   avoidance deflection:  med ${(q(E.map(e => e.devMed), .5) * 180 / Math.PI).toFixed(0)}deg   max in window med ${(q(E.map(e => e.devMax), .5) * 180 / Math.PI).toFixed(0)}deg`);
    console.log(`   wiggle active in the window: ${(100 * E.filter(e => e.wig).length / n).toFixed(0)}%   escape: ${(100 * E.filter(e => e.esc).length / n).toFixed(0)}%`);
    console.log(`   entry time: med ${q(E.map(e => e.t), .5).toFixed(0)}s into the race`);
})();
