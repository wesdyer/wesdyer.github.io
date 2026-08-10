// BAY CROSS-PROCESS NONDETERMINISM HUNT (human-level push, P0a).
// bay/90210+90211 fail golden verify after --update; bench path not byte-equal
// across processes post-windOsc-merge, but IS deterministic within a page.
// => a per-process constant captured at load (before eval_harness stubs
// Math.random) that survives resetGame and became behavioral via the oscillator.
// Discriminate WHICH quantity diverges first: run the same seed in TWO SEPARATE
// BROWSER PROCESSES, record one-time constants after reset + per-frame digests
// (boats, wind field at fixed probes, gusts, squalls), report first divergence.
// node _bay_ndet.js <seed> [venue] [secs]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 90210;
const VENUE = process.argv[3] || 'bay';
const SECS = parseInt(process.argv[4]) || 240;
const ROOT = path.resolve(__dirname, '..', '..', '..');

const runRace = async (page, seed, secs) => page.evaluate(async ({ seed, secs }) => {
    window.evalHarness.seed = seed;
    window.resetGame(); window.startRace();
    // one-time constants after reset — if any of these differ, the leak is in setup
    const consts = {
        raceSeed: state.race.seed,
        baseSpeed: state.wind.baseSpeed, baseDir: state.wind.baseDirection,
        dirBias: state.race.conditions && state.race.conditions.directionBias,
        phases: (state.course.windRegions || []).map(r => +r.phase.toFixed(6)),
        periods: (state.course.windRegions || []).map(r => r.period),
        pressure: state.wind.pressure ? [state.wind.pressure.lo, state.wind.pressure.med, state.wind.pressure.hi].map(v => +v.toFixed(6)) : null,
        spread: state.wind.spread ? [state.wind.spread.lo, state.wind.spread.med, state.wind.spread.hi].map(v => +v.toFixed(6)) : null,
        squalls: (state.squalls || []).map(s => [Math.round(s.x), Math.round(s.y)]),
        gusts: state.gusts.length,
        nBoats: state.boats.length,
        boats0: state.boats.map(b => [+b.x.toFixed(3), +b.y.toFixed(3), +b.heading.toFixed(5)])
    };
    const dt = 1 / 60;
    const frames = [];
    // wind probes at fixed world points, sampled every 30 frames
    const P = [[0, 0], [1500, 1500], [-1500, 1000], [500, -2000]];
    for (let it = 0; it < 60 * secs; it++) {
        window.update(dt);
        if (it % 30 === 0) {
            let bx = 0, by = 0, bh = 0;
            for (const b of state.boats) { bx += b.x; by += b.y; bh += b.heading; }
            let gx = 0; for (const g of state.gusts) gx += g.x + g.y + g.radiusX;
            let sq = 0; for (const s of (state.squalls || [])) sq += s.x + s.y;
            const w = P.map(p => { const ww = getWindAt(p[0], p[1]); return +(ww.speed).toFixed(5) + ',' + +(ww.direction).toFixed(5); });
            frames.push({
                it, t: +state.time.toFixed(4),
                bx: +bx.toFixed(2), by: +by.toFixed(2), bh: +bh.toFixed(4),
                g: state.gusts.length, gx: +gx.toFixed(1), sq: +sq.toFixed(1),
                ws: +state.wind.speed.toFixed(5), wd: +state.wind.direction.toFixed(5),
                w: w.join('|')
            });
        }
        if (state.race.status === 'finished') break;
    }
    return { consts, frames };
}, { seed, secs });

const mkBrowserPage = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    return { browser, page };
};

(async () => {
    const a = await mkBrowserPage();
    const ra = await runRace(a.page, SEED, SECS);
    await a.browser.close();
    const b = await mkBrowserPage();
    const rb = await runRace(b.page, SEED, SECS);
    await b.browser.close();

    // one-time constants
    console.log('=== CONSTANTS ===');
    let constDiff = false;
    for (const k of Object.keys(ra.consts)) {
        const sa = JSON.stringify(ra.consts[k]), sb = JSON.stringify(rb.consts[k]);
        if (sa !== sb) { constDiff = true; console.log(`DIFF ${k}:\n  A ${sa}\n  B ${sb}`); }
        else console.log(`  ok ${k} ${sa.length > 90 ? sa.slice(0, 90) + '…' : sa}`);
    }
    if (!constDiff) console.log('  (all one-time constants identical)');

    console.log('\n=== FRAMES ===');
    const n = Math.min(ra.frames.length, rb.frames.length);
    let firstDiv = -1;
    for (let i = 0; i < n; i++) {
        const fa = ra.frames[i], fb = rb.frames[i];
        const keys = Object.keys(fa).filter(k => JSON.stringify(fa[k]) !== JSON.stringify(fb[k]));
        if (keys.length) {
            firstDiv = i;
            console.log(`FIRST DIVERGENCE at sample ${i} (frame ${fa.it}, t=${fa.t}) keys: ${keys.join(',')}`);
            for (const k of keys) console.log(`  ${k}: A=${JSON.stringify(fa[k])} B=${JSON.stringify(fb[k])}`);
            // context: previous sample
            if (i > 0) console.log(`  prev sample frame ${ra.frames[i-1].it}: identical`);
            break;
        }
    }
    if (firstDiv < 0) console.log(`no divergence in ${n} samples (${SECS}s sim) — extend or venue not affected`);
    else {
        // which diverged LAST — boats may lag wind
        const fa = ra.frames[firstDiv], fb = rb.frames[firstDiv];
        const windDiff = fa.w !== fb.w || fa.ws !== fb.ws || fa.wd !== fb.wd;
        const boatDiff = fa.bx !== fb.bx || fa.by !== fb.by || fa.bh !== fb.bh;
        const gustDiff = fa.g !== fb.g || fa.gx !== fb.gx;
        console.log(`\nat first divergence: wind ${windDiff} | boats ${boatDiff} | gusts ${gustDiff} | squalls ${fa.sq !== fb.sq}`);
    }
})();
