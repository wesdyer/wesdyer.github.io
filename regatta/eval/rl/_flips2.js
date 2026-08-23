// FLIPS v2 — per-LEG, per-TYPE manoeuvre census (2026-08-23, sub-1.5x push,
// Phase 1.2 leg-2 decomposition). Same skeleton as _flips.js (Rules.getTack
// per frame, flip counts when prior side stable >= 0.5s) plus:
//   type — TACK if |TWA| < 90deg at the post-flip sample (crossed head-to-
//          wind; engine TWA 0 = irons, rule 19), GYBE if >= 90deg (crossed
//          dead-downwind)
//   leg  — printed as a leg x type x ownership table
// Solo mode = neutral hero (rule 18b) for the his-ladder comparison (his
// leg-2 ladder: 8 gybes (7-12), board 918u/5.7s).
//   node _flips2.js <venue> <solo|fleet> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const MODE = process.argv[3] || 'fleet';
const TRIALS = parseInt(process.argv[4]) || 4;
const SEED0 = parseInt(process.argv[5]) || 9400;
const ROOT = path.join(__dirname, process.argv[6] || 'treeBOTH3');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    if (MODE === 'solo') await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = []; let racers = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, MODE]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            let bots = state.boats.filter(b => !b.isPlayer);
            if (MODE === 'solo') {
                for (const b of bots.slice(1)) { b.x = 2e6; b.y = 2e6; b.raceState.finished = true; }
                bots = [bots[0]];
            }
            const flips = [];
            const st = new Map();
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && bots.every(bb => bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing') continue;
                for (const bt of bots) {
                    if (bt.raceState.finished || bt.raceState.leg < 1) continue;
                    const side = window.Rules.getTack(bt);
                    if (!side) continue;
                    let s = st.get(bt.id);
                    if (!s) { st.set(bt.id, { side, stable: 0 }); continue; }
                    if (side === s.side) { s.stable++; continue; }
                    if (s.stable >= 30) {
                        const c = bt.controller || {};
                        let rng = Infinity;
                        for (const ob of state.boats) {
                            if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                            const d = Math.hypot(ob.x - bt.x, ob.y - bt.y);
                            if (d < rng) rng = d;
                        }
                        const wd = getWindAt(bt.x, bt.y).direction;
                        const twa = Math.abs(norm(bt.heading - wd)) * 180 / Math.PI;
                        flips.push({ t: +state.race.timer.toFixed(1), n: bt.name,
                            type: twa >= 90 ? 'GYBE' : 'TACK', twa: +twa.toFixed(0),
                            role: c.avoidanceRole || 'NONE', threat: c.threatBoat ? 1 : 0,
                            rng: rng === Infinity ? null : Math.round(rng),
                            armed: bt.raceState.roundArmed ? 1 : 0,
                            pen: bt.raceState.penalty ? 1 : 0,
                            leg: bt.raceState.leg });
                    }
                    s.side = side; s.stable = 0;
                }
            }
            return { flips, nBots: bots.length };
        }, [seed, MODE]);
        for (const x of r.flips) { x.seed = seed; all.push(x); }
        racers += r.nBots;
        console.log(`seed ${seed}: ${r.flips.length} side-changes (${r.nBots} racers)`);
    }
    await browser.close();
    const own = (r) => r.pen ? 'pen' : (r.role !== 'NONE' && r.role !== '-') ? r.role
        : r.threat ? 'NOROLE-threat' : (r.rng == null || r.rng > 300) ? 'NOROLE-far' : 'NOROLE-near';
    console.log(`\n=== FLIPS v2 (${VENUE} ${MODE}, ${TRIALS} seeds, ${path.basename(ROOT)}) — ${all.length} flips, ${(all.length / racers).toFixed(1)}/boat-race ===`);
    const legs = [...new Set(all.map(r => r.leg))].sort((a, b) => a - b);
    for (const L of legs) {
        const v = all.filter(r => r.leg === L);
        const g = v.filter(r => r.type === 'GYBE'), t = v.filter(r => r.type === 'TACK');
        console.log(`leg ${L}: ${(v.length / racers).toFixed(1)}/boat (tack ${(t.length / racers).toFixed(1)}, gybe ${(g.length / racers).toFixed(1)})`);
        const cls = {};
        for (const r of v) { const k = `${r.type}/${own(r)}${r.armed ? '/armed' : ''}`; cls[k] = (cls[k] || 0) + 1; }
        for (const [k, n] of Object.entries(cls).sort((x, y) => y[1] - x[1]).slice(0, 8))
            console.log(`    ${String(n).padStart(4)}  ${(100 * n / v.length).toFixed(0).padStart(3)}%  ${k}`);
    }
    fs.writeFileSync(path.join(__dirname, `_flips2_${VENUE}_${MODE}_${path.basename(ROOT)}.json`), JSON.stringify(all, null, 1));
    console.log('wrote JSON');
})();
