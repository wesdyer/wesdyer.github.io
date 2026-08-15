// THE TAIL DISCRIMINATOR (2026-08-14) — are the slow quartile's land contacts a
// DIFFERENT KIND from the fast quartile's, or just more of the same?
//
// [[regatta-slow-tail]]: the slowest quartile of boat-races carries 7-13x the land
// contacts of the fastest at 5-6x the per-second RATE. But "contacts down, clock
// flat" is 8-for-8 — most contacts are harmless. The unrun measurement is EPISODE
// STRUCTURE: duration, repetition on the same obstacle, stuck-vs-glancing.
//
// ⚠️ DECISION RULE, FIXED BEFORE THE RUN (regatta-next-push-plan): the line lives
// only if (a) episode-duration distributions SEPARATE (slow med > fast p75, or a
// >=5 s class absent in fast), or (b) re-hit share (new episode within 120u of an
// earlier one, same race) >= 2x fast AND re-hits carry most contact time, or
// (c) stuck-near-land time delta explains >= 30% of the quartile finish gap.
// Otherwise the line is DEAD and no contact-reduction build is proposed.
//
// This is a COLLECTOR (raw episodes to JSON); _tail_kind_report.js analyzes.
// It mirrors ocean_bench.js exactly (late venue write, same tick loop, same
// cutoff) so per-seed races are byte-identical to a bench on the same tree —
// which is also the validation: finisher lists must match the bench's.
//
//   node _tail_kind.js <trials> <seed0> <label> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const TRIALS = parseInt(process.argv[2]) || 16;
const SEED0 = parseInt(process.argv[3]) || 9400;
const LABEL = process.argv[4] || 'x';
const ROOT = path.join(__dirname, process.argv[5] || 'treeTAIL');
const VENUE = process.argv[6] || 'glowtide';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    // Late venue write — the reproducible path (standing rule 30, default since 91003e9).
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.evaluate(() => {
        const inner = window.onRaceEvent;
        window.__ep = null; window.__pv = {};
        window.onRaceEvent = (ty, d) => {
            try {
                if (window.__ep && d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished
                    && ty === 'collision_island' && !d.isFloe && state.race.status === 'racing') {
                    const b = d.boat, t = state.race.timer;
                    const rec = window.__ep[b.name] = window.__ep[b.name] || { eps: [], last: -9 };
                    let ep = rec.eps[rec.eps.length - 1];
                    if (!ep || t - rec.last > 1.0) {
                        // new episode: nearest non-awash island by edge gap = the obstacle
                        let bi = -1, bd = 1e18;
                        const I = state.course.islands || [];
                        for (let i = 0; i < I.length; i++) {
                            const s = I[i]; if (s.awash) continue;
                            const dx = b.x - s.x, dy = b.y - s.y;
                            const dd = Math.sqrt(dx * dx + dy * dy) - (s.radius || 0);
                            if (dd < bd) { bd = dd; bi = i; }
                        }
                        ep = { t0: t, t1: t, fr: 0, isl: bi, leg: b.raceState.leg,
                               x: Math.round(b.x), y: Math.round(b.y),
                               v0: Math.round((window.__pv[b.name] || 0) * 60) };
                        rec.eps.push(ep);
                    }
                    ep.t1 = t; ep.fr++; rec.last = t;
                }
            } catch (e) {}
            return inner && inner(ty, d);
        };
    });
    const out = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            window.__ep = {}; window.__pv = {};
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const info = bots.map(b => ({ name: b.name, fin: null, pen: 0,
                                          slow15: 0, slow30: 0, slowNear: 0 }));
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                for (const b of bots) window.__pv[b.name] = b.speed; // pre-update speed for episode entry
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 900) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], f = info[k];
                    if (b.raceState.finished) { if (f.fin == null) { f.fin = Math.round(t); f.pen = b.raceState.totalPenalties || 0; } continue; }
                    const v = b.speed * 60;
                    if (v < 30) {
                        f.slow30 += dt;
                        if (v < 15) f.slow15 += dt;
                        const rec = window.__ep[b.name];
                        if (rec && t - rec.last < 3.0) f.slowNear += dt;
                    }
                }
                if (info.every(f => f.fin != null)) break;
            }
            for (const [k, b] of bots.entries()) {
                if (info[k].fin == null) info[k].pen = b.raceState.totalPenalties || 0;
                const rec = window.__ep[b.name];
                info[k].eps = rec ? rec.eps.map(e => ({ ...e, t0: +e.t0.toFixed(2), t1: +e.t1.toFixed(2) })) : [];
                info[k].slow15 = +info[k].slow15.toFixed(1);
                info[k].slow30 = +info[k].slow30.toFixed(1);
                info[k].slowNear = +info[k].slowNear.toFixed(1);
            }
            return { info };
        }, seed);
        out.push({ seed, ...r });
        const fins = r.info.filter(f => f.fin != null).map(f => f.fin).sort((a, b) => a - b);
        console.log(`seed ${seed}: finishers ${fins.length} finT ${fins.join(',')}  eps ${r.info.reduce((t, f) => t + f.eps.length, 0)}`);
    }
    fs.writeFileSync(path.join(__dirname, `_tailkind_${LABEL}.json`), JSON.stringify(out));
    console.log(`saved _tailkind_${LABEL}.json  venue ${VENUE}`);
    await browser.close();
})();
