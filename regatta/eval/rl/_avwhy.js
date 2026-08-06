// WHY DID SHE NOT HOLD HER COURSE? — the term that vetoed offset 0, counted.
//
// `_transit_probe`'s `avoid: none` sub-bin is 39-65% of arctic's avoidance excess and
// 22-27% of lake's, and its `hadBoat` test needs a FORMAL threatBoat — so a dodge for a
// boat that never became the designated threat lands in `none` and the bin reads as a
// mystery. This asks the cost function directly: whenever the chosen escape deviates
// more than 0.12 rad from the desired heading, which term rejected holding course?
//
// Requires a tree instrumented with the `__avWhy` counter (see treeWHY).
//   node _avwhy.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeWHY');
const VENUE = process.argv[5] || 'arctic';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const tot = { n: 0, boat: 0, stat: 0, rule: 0, proxOnly: 0, nothing: 0, devSum: 0, threat: 0, noThreat: 0 };
    const addAll = (dst, src) => { for (const k in src) dst[k] = (dst[k] || 0) + (src[k] || 0); };
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            window.__avWhy = null;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (bots.every(b => b.raceState.finished)) break;
            }
            return window.__avWhy;
        }, SEED0 + i);
        if (r) addAll(tot, r);
        console.error('seed ' + (SEED0 + i) + ' done');
    }
    const pc = (v) => `${(100 * v / Math.max(1, tot.n)).toFixed(1).padStart(5)}%`;
    console.log(`venue=${VENUE}  ${TRIALS} races  ${tot.n} deflections >0.12 rad`
        + `  mean deflection ${(57.3 * tot.devSum / Math.max(1, tot.n)).toFixed(1)} deg`);
    console.log(`  holding course was vetoed by...`);
    console.log(`    a BOAT inside the safety bubble        ${pc(tot.boat)}`);
    console.log(`    STATIC (land / grid / boundary)        ${pc(tot.stat)}`);
    console.log(`    an RRS rule violation                  ${pc(tot.rule)}`);
    console.log(`    nothing hard — only a proximity cost   ${pc(tot.proxOnly)}`);
    console.log(`    nothing at all (course held was free)  ${pc(tot.nothing)}`);
    const px = Object.keys(tot).filter(k => k.startsWith('px_') && tot[k]);
    if (px.length) {
        console.log(`  of the proximity-only ones, the LARGEST term was...`);
        for (const k of px.sort((a, b) => tot[b] - tot[a]))
            console.log(`    ${k.slice(3).padEnd(38)} ${pc(tot[k])}`);
    }
    console.log(`  and a formal threatBoat existed on ${pc(tot.threat)} of them`
        + ` (so ${pc(tot.noThreat)} are invisible to a threatBoat-based classifier)`);
    await browser.close();
})();
