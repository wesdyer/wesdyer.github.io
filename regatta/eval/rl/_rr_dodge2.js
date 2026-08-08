// UNDERLAY anatomy 2 — WHICH SOFT TERM buys the wide dodge when no hard
// blocker fails the small candidates? (_rr_dodge on the cap tree: 34% of
// wide-dodge rising edges are soft-costs-only, 40% land-only.) At each
// soft-costs-only rising edge, score the STRAIGHT candidate's soft terms the
// way the argmin does and report the dominant one:
//   farland — far-blockage 30000·(1−frac) along the (stock 4s) straight ray
//   boatprox — rival nudge Σ 5000/(d²+10) within 250u (5 path samples)
//   marksoft — mark berth 18000/(dSq+100) inside 115u
//   irons — no-go shaping (twa < 0.55 rad of head-to-wind)
//   none — nothing measurable (commitment/hysteresis/other)
// Also prints the deflected-vs-straight far-blockage delta so "the wide rung
// sees open water the straight ray doesn't" is visible directly.
//   node _rr_dodge2.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4FINAL');
const VENUE = process.argv[5] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(v => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const agg = {}; const meds = { farStraight: [], farWide: [] };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const st = bots.map(() => ({ wide: 0 }));
            const out = {}; const farS = []; const farW = [];
            const bump = k => out[k] = (out[k] || 0) + 1;
            const g = state.course.botGrid;
            const hardLand = (b, h) => {
                const spd = Math.max(70, b.speed * 60);
                for (const fr2 of [0.35, 0.7, 1.0]) {
                    const d = Math.min(140, spd * 4 * fr2);
                    const cc = g.cell(b.x + Math.sin(h) * d, b.y - Math.cos(h) * d);
                    const id = cc[1] * g.n + cc[0];
                    if (!g.at(cc[0], cc[1]) && !(g._soft && g._soft[id])) return true;
                }
                return false;
            };
            const rivalBreach = (b, h) => {
                const spd = b.speed * 60;
                const vx = Math.sin(h) * spd, vy = -Math.cos(h) * spd;
                for (const o of state.boats) {
                    if (o === b || o.isPlayer || o.raceState.finished) continue;
                    const ovx = (o.velocity && o.velocity.x) ? o.velocity.x * 60 : Math.sin(o.heading) * o.speed * 60;
                    const ovy = (o.velocity && o.velocity.y) ? o.velocity.y * 60 : -Math.cos(o.heading) * o.speed * 60;
                    for (let s2 = 1; s2 <= 5; s2++) {
                        const t = s2 * 0.8;
                        const dx = (b.x + vx * t) - (o.x + ovx * t);
                        const dy = (b.y + vy * t) - (o.y + ovy * t);
                        if (dx * dx + dy * dy < 80 * 80) return true;
                    }
                }
                return false;
            };
            // far-blockage of a straight stock ray at heading h (the argmin's
            // 30000·(1−frac) term, land only, first hit beyond the 140 hard zone)
            const farCost = (b, h) => {
                const spd = Math.max(2.0 * 60, b.speed * 60);
                const len = spd * 4;
                const steps = Math.max(2, Math.min(8, Math.ceil(len / (g.res * 0.6))));
                for (let sI = 1; sI <= steps; sI++) {
                    const frac = sI / steps;
                    const px = b.x + Math.sin(h) * len * frac;
                    const py = b.y - Math.cos(h) * len * frac;
                    const cc = g.cell(px, py);
                    const id = cc[1] * g.n + cc[0];
                    if (!g.at(cc[0], cc[1]) && !(g._soft && g._soft[id])) {
                        if (frac * len <= 140) return 500000;
                        return 30000 * (1 - frac);
                    }
                }
                return 0;
            };
            const boatProx = (b, h) => {
                const spd = b.speed * 60;
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
            const markSoft = (b, h) => {
                let c = 0;
                const spd = Math.max(2.0 * 60, b.speed * 60);
                const fx = b.x + Math.sin(h) * spd * 4, fy = b.y - Math.cos(h) * spd * 4;
                for (const m of (state.course.marks || [])) {
                    const cp = getClosestPointOnSegment(m.x, m.y, b.x, b.y, fx, fy);
                    const dSq = (cp.x - m.x) ** 2 + (cp.y - m.y) ** 2;
                    const soft = 103 + (m.bodyR || 12);
                    if (dSq < soft * soft) c += 18000 / (dSq + 100);
                }
                return c;
            };
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], c = b.controller;
                    if (b.raceState.finished || b.raceState.leg < 1) continue;
                    const dev = (c && c.lastAvoidDeviation) || 0;
                    if (dev >= 1.0) st[k].wide += 0.1; else { st[k].wide = 0; continue; }
                    if (Math.abs(st[k].wide - 0.2) > 0.001) continue;
                    let landSmall = false, rivalSmall = false;
                    for (const off of [0, 0.2, -0.2, 0.4, -0.4]) {
                        const h = b.heading + off;
                        if (hardLand(b, h)) landSmall = true;
                        if (rivalBreach(b, h)) rivalSmall = true;
                        if (landSmall && rivalSmall) break;
                    }
                    if (landSmall || rivalSmall) continue;   // only the soft-costs-only class
                    // straight candidate = current heading minus the deviation
                    const hS = b.heading - dev * Math.sign(dev >= 0 ? 1 : -1) * 0; // current heading IS ~deflected; use pre-dodge desired ≈ heading (rising edge, barely turned)
                    const w = getWindAt(b.x, b.y);
                    const terms = {
                        farland: farCost(b, b.heading - 0), // straight neighborhood
                        boatprox: boatProx(b, b.heading),
                        marksoft: markSoft(b, b.heading),
                        irons: Math.abs(normalizeAngle(b.heading - w.direction)) < 0.55 ? 500 : 0
                    };
                    farS.push(terms.farland);
                    // the chosen wide rung's far cost (±1.2 rad both sides, best)
                    farW.push(Math.min(farCost(b, b.heading + 1.2), farCost(b, b.heading - 1.2)));
                    let top = 'none', tv = 60; // require > 60 (pow3 cost of 0.67 rad) to count as a buyer
                    for (const [tk, v] of Object.entries(terms)) if (v > tv) { top = tk; tv = v; }
                    bump(`L${b.raceState.leg} ${top}`);
                    bump(`ALL ${top}`);
                }
            }
            return { out, farS, farW };
        }, seed);
        for (const [k, v] of Object.entries(r.out)) agg[k] = (agg[k] || 0) + v;
        meds.farStraight.push(...r.farS); meds.farWide.push(...r.farW);
        console.log('seed', seed, 'done');
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log('\nSOFT-COSTS-ONLY wide-dodge edges — dominant soft term on the straight candidate:');
    for (const k of Object.keys(agg).sort()) console.log(' ', k.padEnd(16), agg[k]);
    console.log('far-blockage med: straight', med(meds.farStraight), ' wide-rung', med(meds.farWide),
        ' (n=' + meds.farStraight.length + ')');
    await browser.close();
})();
