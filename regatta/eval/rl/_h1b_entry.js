// H1B ENTRY ATTRIBUTION (2026-08-23, ice-craft session 2, Phase A).
// For every solo sub-78u encounter ONSET (first frame under 120u, later
// dipping <78): was the boat ON its gridPath (xtrack), and did the PATH
// itself shave the encounter floe (path min clearance to the predicted
// hull within the next 300u), how old was the plan, which layer owned
// the boat, entry angle/speed. Decides the H1b level per trap 17:
//   ON-PATH + path-shave  -> fair the path (H1b)
//   OFF-PATH (displaced)  -> the response is the lever, not the map
//   node _h1b_entry.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBOTH3');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const ONS = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const dt = 1 / 60;
            const floes = () => (state.course.islands || []).filter(i2 => i2.isFloe);
            const ons = [];
            let enc = null; // {onset captured, min, lastT}
            const ring = [];
            let hitT = -10;
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try { if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) hitT = state.race.timer; } catch (e) { }
                if (inner) inner(ty, d);
            };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                if (hero.raceState.finished) break;
                const L = hero.raceState.leg;
                if (L !== 1 && L !== 2) continue;
                const c = hero.controller; if (!c) continue;
                ring.push({ t, x: hero.x, y: hero.y });
                while (ring.length && t - ring[0].t > 3.2) ring.shift();
                // nearest floe clearance (true hull)
                let clr = Infinity, nf = null;
                for (const f of floes()) {
                    if (Math.hypot(hero.x - f.x, hero.y - f.y) > (f.radius || 0) + 800) continue;
                    const cH = floeHullClear(f, hero.x, hero.y, 0);
                    if (cH < clr) { clr = cH; nf = f; }
                }
                if (clr < 120) {
                    if (!enc) {
                        // ONSET capture
                        const gp = c.gridPath;
                        let xtk = null, pClr = null;
                        if (gp && gp.length > 1) {
                            let best = Infinity;
                            for (let k2 = 0; k2 < gp.length - 1; k2++)
                                best = Math.min(best, segD(hero.x, hero.y, gp[k2].x, gp[k2].y, gp[k2 + 1].x, gp[k2 + 1].y));
                            xtk = best;
                            // path clearance to the ENCOUNTER floe over next 300u of path
                            if (nf) {
                                let acc = 0, px2 = hero.x, py2 = hero.y; pClr = Infinity;
                                const vB = Math.max(60, (hero.speed || 0) * 60);
                                for (let k2 = 0; k2 < gp.length && acc <= 300; k2++) {
                                    const q = gp[k2];
                                    acc += Math.hypot(q.x - px2, q.y - py2); px2 = q.x; py2 = q.y;
                                    const tE = acc / vB;
                                    const cP = floeHullClear(nf,
                                        q.x - (nf.driftVx || 0) * tE, q.y - (nf.driftVy || 0) * tE, tE);
                                    if (cP < pClr) pClr = cP;
                                }
                                if (pClr === Infinity) pClr = null;
                            }
                        }
                        // entry angle: track vs radial-perp tangent of nf
                        let ang = null, spd = null;
                        const a0 = ring.find(rr => t - rr.t >= 0.5) || ring[0];
                        if (a0 && nf) {
                            const tl = Math.hypot(hero.x - a0.x, hero.y - a0.y);
                            spd = Math.round(tl / Math.max(0.05, t - a0.t));
                            if (tl > 1) {
                                const tx = (hero.x - a0.x) / tl, ty = (hero.y - a0.y) / tl;
                                const ux = hero.x - nf.x, uy = hero.y - nf.y;
                                const dU = Math.hypot(ux, uy) || 1;
                                const cosT = Math.abs((-uy / dU) * tx + (ux / dU) * ty);
                                ang = Math.round(Math.acos(Math.min(1, cosT)) * 57.3);
                            }
                        }
                        const dev = c.lastAvoidDeviationSigned || 0;
                        const layer = c.penaltySpin ? 'pen' : c.escActive ? 'esc'
                            : (c.iceEscapeTimer || 0) > 0 ? 'latch' : c.wiggleActive ? 'wig'
                                : Math.abs(dev) > 0.09 ? 'avoid' : 'nav';
                        enc = { seed, t0: t, min: clr, lastT: t, xtk: xtk != null ? Math.round(xtk) : null,
                            pClr: pClr != null ? Math.round(pClr) : null,
                            age: c.gridTimer != null ? +(2.0 - Math.min(2, c.gridTimer)).toFixed(1) : null,
                            layer, ang, spd, hit: 0 };
                    } else { enc.lastT = t; if (clr < enc.min) enc.min = clr; if (hitT >= enc.t0) enc.hit = 1; }
                } else if (enc && t - enc.lastT > 1.0) {
                    if (enc.min < 78) ons.push(enc);
                    enc = null;
                }
            }
            if (enc && enc.min < 78) ons.push(enc);
            return ons;
        }, seed);
        ONS.push(...r);
        console.log(`seed ${seed}: ${r.length} sub-78 encounters`);
    }
    await browser.close();
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    console.log(`\n=== ENTRY ATTRIBUTION (${TRIALS} seeds, ${path.basename(ROOT)}): ${ONS.length} sub-78u encounters ===`);
    const xt = ONS.map(e => e.xtk).filter(x => x != null);
    console.log(`xtrack at onset  p25/med/p75/p90: ${q(xt, .25)}/${q(xt, .5)}/${q(xt, .75)}/${q(xt, .9)}u   ON-path(<80u): ${(100 * xt.filter(x => x < 80).length / xt.length).toFixed(0)}%`);
    const pc = ONS.map(e => e.pClr).filter(x => x != null);
    console.log(`path clr to floe p25/med/p75: ${q(pc, .25)}/${q(pc, .5)}/${q(pc, .75)}u   path-shave(<90u): ${(100 * pc.filter(x => x < 90).length / pc.length).toFixed(0)}%`);
    const onShave = ONS.filter(e => e.xtk != null && e.xtk < 80 && e.pClr != null && e.pClr < 90);
    const off = ONS.filter(e => e.xtk != null && e.xtk >= 80);
    console.log(`QUADRANTS: on-path+path-shave ${onShave.length} (${(100 * onShave.length / ONS.length).toFixed(0)}%)  off-path ${off.length} (${(100 * off.length / ONS.length).toFixed(0)}%)  on-path+path-clear ${ONS.length - onShave.length - off.length}`);
    const lay = {};
    for (const e of ONS) lay[e.layer] = (lay[e.layer] || 0) + 1;
    console.log(`owning layer at onset: ${Object.entries(lay).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  ')}`);
    for (const [nm, arr] of [['on+shave', onShave], ['off-path', off]]) {
        if (!arr.length) continue;
        console.log(`${nm}: hit ${(100 * arr.filter(e => e.hit).length / arr.length).toFixed(0)}%  ang med ${q(arr.map(e => e.ang).filter(x => x != null), .5)}  spd med ${q(arr.map(e => e.spd).filter(x => x != null), .5)}`);
    }
    fs.writeFileSync(path.join(__dirname, `_h1b_entry_${path.basename(ROOT)}.json`), JSON.stringify(ONS, null, 1));
    console.log(`wrote _h1b_entry_${path.basename(ROOT)}.json`);
})();
