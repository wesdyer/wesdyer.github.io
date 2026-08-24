// BOT PASS AUTOPSY + bot side of the GAP CENSUS (2026-08-23, ICE-CRAFT ARC,
// Phase 1.3). Neutral solo hero (the _arc_solo/_dev_census pattern), arctic.
// SAME definitions as _his_pass.js so the two sides are comparable:
//   encounter = contiguous frames nearest-floe clr < 120u (close >1.0s above),
//   clearance = boat center to floe localHull segment distance,
//   speeds from POSITIONS (rule 32), gap = nearest + nearest-opposite-side
//   (<=400u) of the track direction.
// Per encounter: min-clr, entry/at-min ground speed, owning-layer occupancy
// (pen > esc > latch > wiggle > avoid > nav — rule 27 order), deviation
// oscillation (sign flips), outcome (HIT via onRaceEvent collision_island
// during the encounter or within 0.5s), edge angle at min-clr.
// Per leg (1,2): odometer (positions), racing time, exposure s under
// 78/120/300u, encounters by gap-width bin.
//   node _bot_pass.js <trials> <seed0> <tree>
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
    const ENC = [], LEG = {};
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), qx: ax + t * dx, qy: ay + t * dy };
            };
            const nearHull = (f, px, py) => { // {d,qx,qy,tx,ty} on the live hull
                if (!f.localHull || !f.localHull.length) {
                    const d = Math.hypot(px - f.x, py - f.y) - (f.radius || 0);
                    return { d, qx: f.x, qy: f.y, tx: 0, ty: 0 };
                }
                const c = Math.cos(f.spin || 0), s = Math.sin(f.spin || 0);
                const pts = f.localHull.map(p => [f.x + p.x * c - p.y * s, f.y + p.x * s + p.y * c]);
                let best = null;
                for (let i2 = 0; i2 < pts.length; i2++) {
                    const a = pts[i2], b = pts[(i2 + 1) % pts.length];
                    const r2 = segD(px, py, a[0], a[1], b[0], b[1]);
                    if (!best || r2.d < best.d) {
                        best = r2;
                        const el = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
                        best.tx = (b[0] - a[0]) / el; best.ty = (b[1] - a[1]) / el;
                    }
                }
                return best;
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
            let hitT = -10;
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try { if (d && d.boat === hero && ty === 'collision_island' && d.isFloe) hitT = state.race.timer; } catch (e) { }
                if (inner) inner(ty, d);
            };
            const ring = []; // {t,x,y} trailing 4s
            const encs = [], leg = {};
            let enc = null;
            const gspdTrail = (t, w) => { // ground speed over trailing w seconds
                let a = null; for (let m = ring.length - 1; m >= 0; m--) { if (t - ring[m].t >= w) { a = ring[m]; break; } }
                if (!a) a = ring[0]; if (!a || t - a.t < 0.1) return null;
                let d = 0, started = false;
                for (let m = 0; m < ring.length; m++) {
                    if (!started) { if (ring[m] === a) started = true; continue; }
                    d += Math.hypot(ring[m].x - ring[m - 1].x, ring[m].y - ring[m - 1].y);
                }
                return d / (t - a.t);
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
                const prev = ring.length ? ring[ring.length - 1] : null;
                ring.push({ t, x: hero.x, y: hero.y });
                while (ring.length && t - ring[0].t > 4.2) ring.shift();
                const TL = leg[L] = leg[L] || { odo: 0, racing: 0, e78: 0, e120: 0, e300: 0, enc: 0 };
                if (prev) TL.odo += Math.hypot(hero.x - prev.x, hero.y - prev.y);
                TL.racing += dt;
                // nearest + second-opposite floe
                let best = null, bestF = null;
                const FL = floes();
                for (const f of FL) {
                    if (Math.hypot(hero.x - f.x, hero.y - f.y) > (f.radius || 0) + 800) continue;
                    const nr = nearHull(f, hero.x, hero.y);
                    if (!best || nr.d < best.d) { best = nr; bestF = f; }
                }
                const clr = best ? best.d : Infinity;
                if (clr < 78) TL.e78 += dt;
                if (clr < 120) TL.e120 += dt;
                if (clr < 300) TL.e300 += dt;
                // layer of this frame (rule 27 precedence)
                const dev = c.lastAvoidDeviationSigned || 0;
                const layer = c.penaltySpin ? 'pen' : c.escActive ? 'esc'
                    : (c.iceEscapeTimer || 0) > 0 ? 'latch' : c.wiggleActive ? 'wig'
                        : Math.abs(dev) > 0.09 ? 'avoid' : 'nav';
                if (clr < 120) {
                    if (!enc) {
                        enc = { seed, leg: L, t0: t, lastT: t, min: clr, hit: 0,
                            vIn: gspdTrail(t, 3), vMin: null, edgeAng: null, gap: null,
                            lay: {}, maxDev: 0, flips: 0, lastSign: 0, minT: t };
                    }
                    enc.lastT = t;
                    enc.lay[layer] = (enc.lay[layer] || 0) + dt;
                    enc.maxDev = Math.max(enc.maxDev, Math.abs(dev));
                    const sg = dev > 0.09 ? 1 : dev < -0.09 ? -1 : 0;
                    if (sg && enc.lastSign && sg !== enc.lastSign) enc.flips++;
                    if (sg) enc.lastSign = sg;
                    if (hitT >= enc.t0 - 0.5) enc.hit = 1;
                    if (clr < enc.min) {
                        enc.min = clr; enc.minT = t;
                        enc.vMin = gspdTrail(t, 1);
                        // track dir from trailing 0.5s
                        let a = null; for (let m = ring.length - 1; m >= 0; m--) if (t - ring[m].t >= 0.5) { a = ring[m]; break; }
                        if (a) {
                            const tl = Math.hypot(hero.x - a.x, hero.y - a.y);
                            if (tl > 1 && best.tx !== 0 || best.ty !== 0) {
                                const tx = (hero.x - a.x) / tl, ty = (hero.y - a.y) / tl;
                                enc.edgeAng = Math.acos(Math.min(1, Math.abs(tx * best.tx + ty * best.ty))) * 180 / Math.PI;
                                // opposite-side gap
                                const sideOf = (px, py) => Math.sign((px - hero.x) * ty - (py - hero.y) * tx);
                                const s1 = sideOf(best.qx, best.qy);
                                let opp = null;
                                for (const f of FL) {
                                    if (f === bestF) continue;
                                    if (Math.hypot(hero.x - f.x, hero.y - f.y) > (f.radius || 0) + 500) continue;
                                    const n2 = nearHull(f, hero.x, hero.y);
                                    if (n2.d > 400 || sideOf(n2.qx, n2.qy) === s1) continue;
                                    if (opp == null || n2.d < opp) opp = n2.d;
                                }
                                enc.gap = opp != null ? clr + opp : null;
                            }
                        }
                    }
                } else if (enc && t - enc.lastT > 1.0) {
                    if (hitT >= enc.t0 - 0.5 && hitT <= enc.lastT + 0.5) enc.hit = 1;
                    enc.dur = enc.lastT - enc.t0; TL.enc++;
                    encs.push(enc); enc = null;
                }
            }
            if (enc) { enc.dur = enc.lastT - enc.t0; encs.push(enc); }
            return { encs, leg };
        }, seed);
        ENC.push(...r.encs);
        for (const L of Object.keys(r.leg)) {
            const T = LEG[L] = LEG[L] || { odo: 0, racing: 0, e78: 0, e120: 0, e300: 0, enc: 0, n: 0 };
            for (const k of ['odo', 'racing', 'e78', 'e120', 'e300', 'enc']) T[k] += r.leg[L][k];
            T.n++;
        }
        console.log(`seed ${seed}: ${r.encs.length} encounters  leg-odo ${Object.entries(r.leg).map(([L, v]) => `${L}:${(v.odo / 1000).toFixed(1)}k`).join(' ')}`);
    }
    await browser.close();
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    const col = (arr, k) => arr.map(e => e[k]).filter(x => x != null && isFinite(x));
    const P = (arr, k, u) => `p10/p25/med/p75/p90: ${q(col(arr, k), .1).toFixed(0)}/${q(col(arr, k), .25).toFixed(0)}/${q(col(arr, k), .5).toFixed(0)}/${q(col(arr, k), .75).toFixed(0)}/${q(col(arr, k), .9).toFixed(0)}${u}`;
    console.log(`\n=== BOT PASS AUTOPSY (solo neutral, ${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`${ENC.length} encounters <120u (${(ENC.length / TRIALS).toFixed(1)}/race)`);
    const sub = ENC.filter(e => e.min < 78);
    console.log(`sub-78u: ${sub.length} (${(sub.length / TRIALS).toFixed(1)}/race)  hit rate ${(100 * sub.filter(e => e.hit).length / Math.max(1, sub.length)).toFixed(0)}%  (all-enc hits ${ENC.filter(e => e.hit).length})`);
    for (const [nm, arr] of [['ALL <120u', ENC], ['sub-78u', sub]]) {
        if (!arr.length) continue;
        console.log(`\n--- ${nm} ---`);
        console.log(`min-clr      ${P(arr, 'min', 'u')}`);
        console.log(`duration     ${P(arr, 'dur', 's')}`);
        console.log(`speed entry  ${P(arr, 'vIn', ' u/s')}`);
        console.log(`speed at min ${P(arr, 'vMin', ' u/s')}`);
        console.log(`edge angle   ${P(arr, 'edgeAng', 'deg')}`);
        console.log(`maxDev (deg) ${P(arr.map(e => ({ d: e.maxDev * 180 / Math.PI })), 'd', '')}  flips/enc med ${q(col(arr, 'flips'), .5)}  flips>=2: ${(100 * arr.filter(e => e.flips >= 2).length / arr.length).toFixed(0)}%`);
        const lay = {};
        for (const e of arr) for (const [k, v] of Object.entries(e.lay)) lay[k] = (lay[k] || 0) + v;
        const tot = Object.values(lay).reduce((a, b) => a + b, 0) || 1;
        console.log(`layer occupancy: ${Object.entries(lay).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(0)}%`).join('  ')}`);
        const gaps = col(arr, 'gap');
        console.log(`gap (2-sided): ${gaps.length}/${arr.length} threaded  width med ${q(gaps, .5).toFixed(0)}u  bins <60:${gaps.filter(x => x < 60).length} 60-100:${gaps.filter(x => x >= 60 && x < 100).length} 100-150:${gaps.filter(x => x >= 100 && x < 150).length} 150+:${gaps.filter(x => x >= 150).length}`);
    }
    console.log(`\n=== PER-LEG (per race avg) ===`);
    for (const [L, T] of Object.entries(LEG))
        console.log(`leg ${L}: odo ${(T.odo / T.n / 1000).toFixed(1)}k u  racing ${(T.racing / T.n).toFixed(0)}s  exposure<78 ${(T.e78 / T.n).toFixed(1)}s  <120 ${(T.e120 / T.n).toFixed(1)}s  <300 ${(T.e300 / T.n).toFixed(1)}s  encounters ${(T.enc / T.n).toFixed(1)}`);
    fs.writeFileSync(path.join(__dirname, `_bot_pass_${path.basename(ROOT)}.json`), JSON.stringify({ ENC, LEG }, null, 1));
    console.log(`wrote _bot_pass_${path.basename(ROOT)}.json`);
})();
