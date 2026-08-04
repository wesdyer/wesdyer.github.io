// How predictable is the ice? Linear-drift extrapolation error vs horizon.
//
// The SIPP design rests on one empirical claim: floe positions are knowable
// far enough ahead that a space-time plan beats a snapshot plan. This measures
// the claim directly. At each sample time t0 every floe's state (x,y,driftV) is
// frozen; at t0+H the predicted position (linear) is compared with the truth.
// Reported against the floe's own radius, because a 40u error on a 300u berg is
// nothing and on a 90u pan is everything.
//
// Also reported: SNAPSHOT error, i.e. what the current router believes — the
// floe pinned at its t0 position (+2s lead, as refreshBotGrid does) with no
// drift at all. The gap between the two columns is what space-time routing buys.
// node _drift_pred.js <seeds> <seed0> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const HS = [5, 10, 15, 20, 30, 45, 60, 90];
    const acc = {};   // H -> {lin:[], snap:[], linR:[], snapR:[]}
    for (const H of HS) acc[H] = { lin: [], snap: [], linR: [], snapR: [] };
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ({ seed, HS }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const dt = 1 / 60;
            const floes = (state.course.islands || []).filter(f => f.isFloe);
            const idx = new Map(floes.map((f, k) => [f, k]));
            // ring buffer of predictions to check later: {tDue, k, px, py, sx, sy, r}
            const pend = [];
            const out = {};
            for (const H of HS) out[H] = { lin: [], snap: [], linR: [], snapR: [],
                                           bigL: [], bigS: [], smlL: [], smlS: [] };
            let nextSample = 0;
            for (let it = 0; it < 60 * 400; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                const T = state.time;
                if (T >= nextSample) {
                    nextSample = T + 2.0;
                    for (const f of floes) {
                        const k = idx.get(f);
                        for (const H of HS) {
                            pend.push({ tDue: T + H, H, k, r: f.radius,
                                px: f.x + (f.driftVx || 0) * H, py: f.y + (f.driftVy || 0) * H,
                                sx: f.x + (f.driftVx || 0) * 2, sy: f.y + (f.driftVy || 0) * 2 });
                        }
                    }
                }
                // resolve anything due
                while (pend.length && pend[0].tDue <= T) {
                    const p = pend.shift();
                    const f = floes[p.k];
                    const eL = Math.hypot(f.x - p.px, f.y - p.py);
                    const eS = Math.hypot(f.x - p.sx, f.y - p.sy);
                    const o = out[p.H];
                    o.lin.push(eL); o.snap.push(eS); o.linR.push(eL / p.r); o.snapR.push(eS / p.r);
                    if (p.r > 200) { o.bigL.push(eL / p.r); o.bigS.push(eS / p.r); }
                    else { o.smlL.push(eL / p.r); o.smlS.push(eS / p.r); }
                }
                pend.sort((a, b) => a.tDue - b.tDue);
            }
            const md = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
            const q = {};
            for (const H of HS) {
                const o = out[H];
                q[H] = { lin: md(o.lin), snap: md(o.snap), linR: md(o.linR), snapR: md(o.snapR),
                         bigL: md(o.bigL), bigS: md(o.bigS), smlL: md(o.smlL), smlS: md(o.smlS),
                         n: o.lin.length };
            }
            return q;
        }, { seed, HS });
        for (const H of HS) {
            const o = r[H];
            if (!o.n) continue;
            for (const k of ['lin', 'snap', 'linR', 'snapR', 'bigL', 'bigS', 'smlL', 'smlS']) {
                (acc[H][k] = acc[H][k] || []).push(o[k]);
            }
        }
        console.log(`seed ${seed} done`);
    }
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    console.log('\n(medians over samples, meaned over seeds; err/radius)');
    console.log('H(s)   linErr  snapErr | lin/r  snap/r | BERG(r>200) lin/r snap/r | PAN lin/r snap/r');
    for (const H of HS) {
        const a = acc[H];
        console.log(`${String(H).padStart(3)}   ${mean(a.lin).toFixed(0).padStart(6)}u ${mean(a.snap).toFixed(0).padStart(7)}u | `
            + `${mean(a.linR).toFixed(2).padStart(5)} ${mean(a.snapR).toFixed(2).padStart(6)} | `
            + `${mean(a.bigL).toFixed(2).padStart(16)} ${mean(a.bigS).toFixed(2).padStart(6)} | `
            + `${mean(a.smlL).toFixed(2).padStart(7)} ${mean(a.smlS).toFixed(2).padStart(6)}`);
    }
    await browser.close();
})();
