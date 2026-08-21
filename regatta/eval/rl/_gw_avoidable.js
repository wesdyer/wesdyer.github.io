// AVOIDABILITY AUDIT (owner question, 2026-08-20): of the contact episodes,
// what fraction could the GIVE-WAY boat still have avoided at T seconds out,
// rolling her real turn rate/speed against every boat's RECORDED track and
// the land grid? (Stand-on now holds her course, so her recorded track is a
// valid counterfactual.) For episodes she could NOT avoid, could the
// STAND-ON boat have cleared with a deflection inside the owner's 11-23°
// band? Also: penalty composition (contact vs no-contact fouls).
//
// Counterfactual assumptions, stated: candidate heading approached at her
// real max turn rate; speed held at decision-time value, decayed 2%/step
// while inside the no-go (TWA < 0.55); third-party boats follow recorded
// tracks (they would react in reality — this overstates the danger of the
// counterfactual slightly, so "avoidable" leans conservative at wide fans).
//
//   node _gw_avoidable.js <trials> <seed0> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeDFC');
const VENUE = process.argv[5] || 'bay';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const eps = [], penKinds = {};
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const out = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const bots = state.boats.filter(b => !b.isPlayer);
            // ring buffer: 8s of every-2nd-frame states (240 entries)
            const RING = 240, STEP = 2;
            const ring = bots.map(() => new Array(RING));
            let fIx = 0;
            const episodes = [], pens = {};
            const lastT = new Map();
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'penalty' && state.race.status === 'racing') {
                    const k = (d.kind || 'nocontact') + ':' + (d.rule || '?');
                    pens[k] = (pens[k] || 0) + 1;
                }
                if (ty === 'collision_boat' && state.race.status === 'racing') {
                    const a = d.boat, b = d.other;
                    const key = [a.id, b.id].sort().join('-');
                    const now = state.race.timer;
                    if (lastT.has(key) && now - lastT.get(key) < 5) return;
                    lastT.set(key, now);
                    let row = null, rule = null;
                    try { const r = window.Rules.getRightOfWay(a, b); row = r.boat; rule = r.rule; } catch (e) { }
                    episodes.push({ t: now, fIx, ai: bots.indexOf(a), bi: bots.indexOf(b),
                        rowIx: row ? bots.indexOf(row) : -1, rule,
                        chain: !!(a.raceState.penalty || b.raceState.penalty) });
                }
                if (inner) inner(ty, d);
            };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && bots.every(bb => bb.raceState.finished)) break;
                update(dt); it++;
                if (it % STEP === 0) {
                    fIx++;
                    for (let bi = 0; bi < bots.length; bi++) {
                        const bt = bots[bi];
                        ring[bi][fIx % RING] = { x: bt.x, y: bt.y, h: bt.heading,
                            s: bt.speed, tk: bt.raceState.isTacking ? 1 : 0,
                            pen: bt.raceState.penalty ? 1 : 0 };
                    }
                    // resolve pending episodes once their +1s future exists
                    for (const ep of episodes) {
                        if (ep.done || fIx - ep.fIx < 30 * 1) continue;   // wait 1s past contact
                        ep.done = true;
                        if (ep.rowIx < 0 || ep.chain) continue;           // bucketed, no counterfactual
                        const gwIx = ep.rowIx === ep.ai ? ep.bi : ep.ai;
                        const soIx = ep.rowIx;
                        const wd = getWindAt(bots[0].x, bots[0].y).direction;
                        const grid = state.course.botGrid || state.course._botGridStatic;
                        // counterfactual roll for boat IX from T(sec) before contact:
                        // returns best min-clearance over a heading fan (deg limits)
                        const roll = (ix, Tback, fanLo, fanHi) => {
                            const startIx = ep.fIx - Math.round(Tback * 30);
                            if (fIx - startIx >= RING || startIx < 1) return null;
                            const st = ring[ix][startIx % RING];
                            if (!st || st.pen) return null;
                            const bt = bots[ix];
                            const om = getTurnSpeed() * 60 * (1.0 + bt.stats.handling * 0.03);
                            const endIx = Math.min(ep.fIx + 30, fIx);
                            let bestClr = -1, bestOff = null;
                            for (let offD = fanLo; offD <= fanHi; offD += 10) {
                                const tgt = st.h + offD * Math.PI / 180;
                                let x = st.x, y = st.y, h = st.h, s = st.s;
                                let clr = Infinity, onWater = true;
                                for (let f = startIx + 1; f <= endIx; f++) {
                                    const d2 = (2 / 60);
                                    const dh = ((tgt - h + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                                    h += Math.sign(dh) * Math.min(Math.abs(dh), om * d2);
                                    let twa = Math.abs(((h - wd + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                                    if (twa < 0.55) s *= 0.98;
                                    x += Math.sin(h) * s * 60 * d2;
                                    y += -Math.cos(h) * s * 60 * d2;
                                    if (grid) { const c = grid.cell(x, y); if (!grid.at(c[0], c[1])) { onWater = false; break; } }
                                    for (let oi = 0; oi < bots.length; oi++) {
                                        if (oi === ix) continue;
                                        const o = ring[oi][f % RING];
                                        if (!o) continue;
                                        clr = Math.min(clr, Math.hypot(x - o.x, y - o.y));
                                    }
                                }
                                if (onWater && clr > bestClr) { bestClr = clr; bestOff = offD; }
                            }
                            return { clr: Math.round(bestClr), off: bestOff, spd: +(st.s * 4).toFixed(1), tk: st.tk };
                        };
                        ep.gw = { t5: roll(gwIx, 5, -180, 180), t3: roll(gwIx, 3, -180, 180), t15: roll(gwIx, 1.5, -180, 180) };
                        ep.so23 = { t3: roll(soIx, 3, -23, 23), t15: roll(soIx, 1.5, -23, 23) };
                        // context at T-3s
                        const cIx = ep.fIx - 90;
                        const gs = cIx > 0 ? ring[gwIx][cIx % RING] : null;
                        let pack = 0;
                        if (gs) for (let oi = 0; oi < bots.length; oi++) {
                            if (oi === gwIx) continue;
                            const o = ring[oi][cIx % RING];
                            if (o && Math.hypot(gs.x - o.x, gs.y - o.y) < 150) pack++;
                        }
                        ep.ctx = gs ? { spd: +(gs.s * 4).toFixed(1), tk: gs.tk, pack } : null;
                    }
                }
            }
            window.onRaceEvent = inner;
            return { episodes: episodes.map(e => ({ t: +e.t.toFixed(1), rule: e.rule, chain: e.chain,
                        noRow: e.rowIx < 0, gw: e.gw || null, so23: e.so23 || null, ctx: e.ctx || null })), pens };
        }, seed);
        for (const e of out.episodes) { e.seed = seed; eps.push(e); }
        for (const [k, v] of Object.entries(out.pens)) penKinds[k] = (penKinds[k] || 0) + v;
        console.log(`seed ${seed}: ${out.episodes.length} episodes`);
    }
    await browser.close();
    const CLEAR = 65;
    const root = eps.filter(e => !e.chain && !e.noRow && e.gw && e.gw.t3);
    const cls = { avoid5: 0, avoid3: 0, avoid15only: 0, unavoidable: 0 };
    const unav = [];
    for (const e of root) {
        const ok = (r) => r && r.clr >= CLEAR;
        if (ok(e.gw.t5) && ok(e.gw.t3)) cls.avoid3++;          // avoidable with >=3s notice
        else if (ok(e.gw.t5)) cls.avoid5++;                     // only with 5s notice
        else if (ok(e.gw.t15)) cls.avoid15only++;
        else { cls.unavoidable++; unav.push(e); }
    }
    console.log(`\n${eps.length} episodes: ${eps.filter(e => e.chain).length} chain (post-penalty), ${eps.filter(e => e.noRow).length} no-determination, ${root.length} rooted+judged`);
    console.log(`GIVE-WAY AVOIDABILITY (clearance ≥${CLEAR}u on water, full fan):`);
    console.log(`  avoidable at 3s+  : ${cls.avoid3}`);
    console.log(`  only at 5s        : ${cls.avoid5}`);
    console.log(`  only at 1.5s      : ${cls.avoid15only}`);
    console.log(`  UNAVOIDABLE (all T): ${cls.unavoidable}`);
    console.log(`STAND-ON ≤23° could clear the unavoidable ones:`);
    console.log(`  at 3s : ${unav.filter(e => e.so23 && e.so23.t3 && e.so23.t3.clr >= CLEAR).length}/${unav.length}`);
    console.log(`  at 1.5s: ${unav.filter(e => e.so23 && e.so23.t15 && e.so23.t15.clr >= CLEAR).length}/${unav.length}`);
    for (const e of unav.slice(0, 8)) console.log(`  unav s${e.seed} t=${e.t} ${e.rule} ctx=${JSON.stringify(e.ctx)} gw3=${JSON.stringify(e.gw.t3)} so3=${JSON.stringify(e.so23 && e.so23.t3)}`);
    const gwCtx = root.map(e => e.ctx).filter(Boolean);
    console.log(`give-way context at T-3s: mean spd ${(gwCtx.reduce((x, c) => x + c.spd, 0) / (gwCtx.length || 1)).toFixed(1)}kt, tacking ${gwCtx.filter(c => c.tk).length}, pack≥2 ${gwCtx.filter(c => c.pack >= 2).length}/${gwCtx.length}`);
    console.log(`PENALTY COMPOSITION: ${JSON.stringify(penKinds)}`);
})();
