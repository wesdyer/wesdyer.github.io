// IS THE BOAT-COLLISION VETO BUILT ON A TRUE FORECAST? (2026-08-29, C2(b) census)
// On avoidance-owned out-of-band ticks whose cheapest IN-BAND candidate is vetoed
// by a boat collision (bc), take the nearest rival, forecast her position 2 s out
// the way the scorer does (velocity x t), and compare with where she actually is
// 120 frames later. Split by her hold status (held / not-row / flip<0.75 /
// tacking / rule15 / ...). A forecast error above the ~80 u hard core means the
// veto is deciding on fiction; below it the veto is honest.
//   node _re_forecast.js <venue> <leg> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '4'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeRB');
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const rows = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            window.__AVDBG = { full: 1 };
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const out = []; const pend = []; const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.__AVLOG = [];
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                // settle forecasts that are due
                while (pend.length && pend[0].due <= it) {
                    const p = pend.shift(); const rv = state.boats.find(x => x.name === p.rival); if (!rv) continue;
                    out.push({ why: p.why, err: Math.hypot(rv.x - p.px, rv.y - p.py), rng: p.rng, meRow: p.meRow,
                        errRadial: Math.hypot(rv.x - p.bx2, rv.y - p.by2) });
                }
                for (const e of window.__AVLOG) {
                    const b = state.boats.find(x => x.name === e.n); if (!b || b.raceState.leg !== LEG || !e.full) continue;
                    const wd = getWindAt(b.x, b.y).direction;
                    const twa0 = Math.abs(nm(e.h0 - wd)) * 180 / Math.PI;
                    const best = e.full.reduce((m, r) => r.cost < m.cost ? r : m, e.full[0]);
                    const twaB = Math.abs(nm(e.h0 + best.off - wd)) * 180 / Math.PI;
                    if (!(twa0 >= 30 && twa0 < 50 && twaB >= 50)) continue;
                    const inb = e.full.filter(r => { const tw = Math.abs(nm(e.h0 + r.off - wd)) * 180 / Math.PI; return tw >= 30 && tw < 50; });
                    if (!inb.length) continue;
                    const ch = inb.reduce((m, r) => r.cost < m.cost ? r : m, inb[0]);
                    if (!ch.bc) continue;
                    // nearest rival, forecast the scorer's way (velocity x 2 s)
                    let nr = null, rng = 1e9;
                    for (const o of state.boats) { if (o === b || o.raceState.finished) continue; const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < rng) { rng = d; nr = o; } }
                    if (!nr || rng > 400) continue;
                    const ovx = (nr.velocity && nr.velocity.x) ? nr.velocity.x * 60 : Math.sin(nr.heading) * nr.speed * 60;
                    const ovy = (nr.velocity && nr.velocity.y) ? nr.velocity.y * 60 : -Math.cos(nr.heading) * nr.speed * 60;
                    pend.push({ due: it + 120, rival: nr.name, px: nr.x + ovx * 2, py: nr.y + ovy * 2, bx2: nr.x, by2: nr.y,
                        why: e.why || 'n/a', rng: Math.round(rng), meRow: e.rowDbg && e.rowDbg.row === e.n ? 1 : 0 });
                }
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG });
        rows.push(...r);
    }
    await br.close();
    const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
    const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    console.log(`\n══ ${VENUE} leg ${LEG} — 2 s forecast error of the nearest rival on BOAT-VETO ticks (tree ${path.basename(ROOT)}, ${rows.length} ticks)`);
    console.log(`  all: err med ${med(rows.map(r => r.err)).toFixed(0)} u  p75 ${pct(rows.map(r => r.err), .75).toFixed(0)}  p90 ${pct(rows.map(r => r.err), .9).toFixed(0)}  | rival moved med ${med(rows.map(r => r.errRadial)).toFixed(0)} u in 2 s | err > 80 u on ${(100 * rows.filter(r => r.err > 80).length / rows.length).toFixed(0)}%`);
    const g = {}; for (const r of rows) (g[r.why] = g[r.why] || []).push(r);
    console.log('  by hold status: n | share | err med | p75 | err>80u %');
    for (const [k, v] of Object.entries(g).sort((a, b) => b[1].length - a[1].length))
        console.log(`    ${k.padEnd(10)} ${String(v.length).padStart(5)} | ${(100 * v.length / rows.length).toFixed(0).padStart(3)}% | ${med(v.map(r => r.err)).toFixed(0).padStart(4)} | ${pct(v.map(r => r.err), .75).toFixed(0).padStart(4)} | ${(100 * v.filter(r => r.err > 80).length / v.length).toFixed(0).padStart(3)}`);
    const me = rows.filter(r => r.meRow); console.log(`  ME-row subset: ${me.length} ticks, err med ${med(me.map(r => r.err)).toFixed(0)} u, err>80u ${(100 * me.filter(r => r.err > 80).length / Math.max(1, me.length)).toFixed(0)}%`);
})();
