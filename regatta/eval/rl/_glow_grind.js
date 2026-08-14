// ⭐ SIZE THE LEG-1 GRIND BEFORE BUILDING FOR IT (2026-08-13, after the venue-class landing)
//
// The residual on glowtide is LEG 1's rock box (28.2 s/lap of a 67.1 s/lap gap, after
// leg 3 fell from 35.5 to 10.3). Inside that box the contact/ice escape still owns
// 28.3% of ticks at 17 u/s with 73% under 40 u/s — down from 37.0% at 11 u/s before
// the landing, but still the modal slow state.
//
// The plan's own warning about this shape: "the escape's share is the arctic ring
// signature — EFFECT as much as cause, so size the grind before building for it."
// This is that sizing, in the `_tack_cost` shape: per ESCAPE EPISODE (rule 2 — the
// rising edge of `iceEscapeTimer > 0`, not per frame), inside the box:
//
//   * how long it lasts and how much CLOCK it costs (speed deficit x duration
//     against the boat's own polar target, so a slow boat in light air is not
//     charged for the air)
//   * WHAT CAME FIRST in the 2 s before it: a land contact (the escape is a
//     RESPONSE), or already-slow / already-deflected (the escape is a SYMPTOM of
//     something upstream), or full speed and clear (the escape is the CAUSE)
//   * what it does: does the boat's clearance to land actually improve during it?
//     An escape that does not increase clearance is not escaping anything.
//
//   node _glow_grind.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeFINAL');
const BOX = { x0: -750, x1: 0, y0: -1750, y1: -500 };   // the leg-1 rock box
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 250)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const EP = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(([seed, BOX]) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const inBox = (b) => b.x >= BOX.x0 && b.x <= BOX.x1 && b.y >= BOX.y0 && b.y <= BOX.y1;
            const clr = (x, y) => {
                const g = state.course.botGrid; if (!g) return -1;
                const R = g.res || 50;
                for (let ring = 0; ring <= 8; ring++)
                    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                        const c = g.cell(x + dx * R, y + dy * R);
                        if (!g.at(c[0], c[1])) return ring * R;
                    }
                return 8 * R;
            };
            // ⚠️ the engine's polar entry point is `getTargetSpeed(twa, spinnaker, windSpeed)`
            // — there is no `getPolarSpeed` in scope outside its own closure — and the
            // TWA convention is 0 = HEAD TO WIND (standing rule 19).
            const polarTarget = (b) => {
                try {
                    const w = getWindAt(b.x, b.y);
                    let twa = Math.abs(normalizeAngle(b.heading - w.direction));
                    return getTargetSpeed(twa, !!b.spinnakerUp, w.speed) * 60;
                } catch (e) { return null; }
            };
            const hist = {}, open = {}, out = [];
            const H = 40;   // 2.0 s at 0.05 s
            let frame = 0, hi = 0;
            for (let i = 0; i < 60 * 940; i++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (const b of bots) {
                    const c = b.controller; if (!c || b.raceState.finished) continue;
                    const esc = (c.iceEscapeTimer || 0) > 0;
                    const o = open[b.name];
                    if (esc && !o && inBox(b)) {
                        // rising edge INSIDE the box — look back 2 s
                        const q = hist[b.name] || [];
                        const back = (k) => q[((hi - 1 - k) % H + H) % H] || null;
                        const h40 = back(39), h20 = back(20), h10 = back(10);
                        open[b.name] = {
                            t0: state.race.timer, x0: b.x, y0: b.y, clr0: clr(b.x, b.y),
                            spdBefore: h20 ? Math.round(h20.spd) : null,
                            spd2sBefore: h40 ? Math.round(h40.spd) : null,
                            aground2s: (h40 && h40.agr) || (h20 && h20.agr) || (h10 && h10.agr) ? 1 : 0,
                            dev2s: h20 ? +(h20.dev).toFixed(2) : null,
                            lost: 0, n: 0, minSpd: 1e9
                        };
                    }
                    if (o) {
                        const tgt = polarTarget(b), sp = b.speed * 60;
                        if (tgt && tgt > 1) { o.lost += Math.max(0, tgt - sp) / 60; o.n++; }
                        o.minSpd = Math.min(o.minSpd, sp);
                        if (!esc) {
                            o.dur = +(state.race.timer - o.t0).toFixed(2);
                            o.clr1 = clr(b.x, b.y);
                            o.moved = Math.round(Math.hypot(b.x - o.x0, b.y - o.y0));
                            o.lost = +o.lost.toFixed(1);
                            o.minSpd = Math.round(o.minSpd);
                            out.push(o); open[b.name] = null;
                        }
                    }
                }
                if (frame++ % 3 === 0) {
                    for (const b of bots) {
                        const q = hist[b.name] = hist[b.name] || [];
                        q[hi % H] = { spd: b.speed * 60,
                            agr: (b.ai && b.ai.collisionData && b.ai.collisionData.type === 'island') ? 1 : 0,
                            dev: b.controller ? (b.controller.lastAvoidDeviation || 0) : 0 };
                    }
                    hi++;
                }
            }
            return out;
        }, [SEED0 + t, BOX]);
        EP.push(...r);
        console.log(`  seed ${SEED0 + t}: ${r.length} in-box escape episodes`);
    }
    await br.close();
    const q = (a, f) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    const col = k => EP.map(e => e[k]).filter(v => v != null && !isNaN(v));
    console.log(`\n=== ${VENUE} LEG-1 BOX — ${EP.length} ESCAPE EPISODES over ${TRIALS} seeds ===`);
    const line = (lbl, k, u = '') => { const c = col(k); console.log(`  ${lbl.padEnd(34)} p25 ${String(q(c, .25)).padStart(7)}  med ${String(q(c, .5)).padStart(7)}  p75 ${String(q(c, .75)).padStart(7)}  max ${String(Math.max(...c)).padStart(7)} ${u}`); };
    line('duration', 'dur', 's');
    line('CLOCK LOST vs its own polar', 'lost', 's');
    line('minimum speed reached', 'minSpd', 'u/s');
    line('distance actually covered', 'moved', 'u');
    line('clearance at the start', 'clr0', 'u');
    line('clearance at the end', 'clr1', 'u');
    const better = EP.filter(e => e.clr1 > e.clr0).length, same = EP.filter(e => e.clr1 === e.clr0).length;
    console.log(`  clearance IMPROVED ${pct(better, EP.length)} · unchanged ${pct(same, EP.length)} · WORSENED ${pct(EP.length - better - same, EP.length)}`);
    console.log(`\n  WHAT CAME FIRST (the 2 s before the rising edge)`);
    console.log(`   already AGROUND                 ${pct(EP.filter(e => e.aground2s).length, EP.length)}   ⬅ the escape is a RESPONSE`);
    console.log(`   already slow (<40 u/s 1 s before) ${pct(EP.filter(e => e.spdBefore != null && e.spdBefore < 40).length, EP.length)}   ⬅ SYMPTOM of something upstream`);
    console.log(`   at speed (>60 u/s) and not aground ${pct(EP.filter(e => !e.aground2s && e.spdBefore > 60).length, EP.length)}   ⬅ the escape is the CAUSE`);
    console.log(`   avoidance was deflecting >0.35 rad ${pct(EP.filter(e => e.dev2s > 0.35).length, EP.length)}`);
    const tot = col('lost').reduce((a, b) => a + b, 0);
    console.log(`\n  TOTAL CLOCK IN THESE EPISODES: ${tot.toFixed(0)} s over ${TRIALS} seeds` +
        `  = ${(tot / (TRIALS * 9)).toFixed(1)} s/boat`);
    fs.writeFileSync(path.join(__dirname, `_glow_grind_${path.basename(ROOT)}.json`), JSON.stringify(EP));
})();
