// PHANTOM-DEVIATION ATTRIBUTION (2026-08-22, C4 push). At every AVOID_NONE
// deviation ONSET (the _dev_census definition: solo, legs 1-2, |dev|>0.09,
// no wiggle/escape/penalty) read the __AVDBG zero row: was the zero-offset
// candidate rejected by a hard flag (sc = static collision / bc = boat) or
// by PRICE (prox), and at what magnitude — plus the winning row's own cost.
// Bins the onsets by the zero row's rejection mode:
//   sc=1            — the 4s probe called the straight line a WALL hit
//   prox>=3000      — far-half grind price / clearance band scale
//   prox 800-3000   — buffer band scale (1200-class)
//   prox 1-800      — soft gradients
//   prox=0 & sc=0   — the deviation came from some other term entirely
//     (retro / rule19 / band trust — the zero row cost tells)
//   node _phantom_why.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeC2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const ROWS = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const rows = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            window.__AVDBG = { name: hero.name };
            const out = [];
            let inEp = false, lastDevT = -10;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.__AVLOG = [];
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                const leg = hero.raceState.leg;
                if (leg !== 1 && leg !== 2) continue;
                const c = hero.controller; if (!c) continue;
                const dev = Math.abs(c.lastAvoidDeviationSigned || 0);
                const avNone = dev > 0.09 && (!c.avoidanceRole || c.avoidanceRole === 'NONE')
                    && !c.threatBoat && !c.wiggleActive && !c.escActive && !hero.raceState.penalty;
                if (avNone) {
                    if (!inEp || t - lastDevT > 0.5) {
                        // ONSET — grab this frame's AVLOG row for the hero
                        const L = (window.__AVLOG || []).filter(r => r.n === hero.name);
                        const r = L[L.length - 1];
                        if (r && r.zero) {
                            out.push({ t: +t.toFixed(1), leg, dev: +dev.toFixed(2),
                                sc: r.zero.sc, bc: r.zero.bc, prox: Math.round(r.zero.prox || 0),
                                zc: Math.round(r.zero.cost || 0),
                                bestOff: r.best ? +r.best.off.toFixed(2) : null,
                                bestCost: r.best ? Math.round(r.best.cost) : null,
                                pt: r.pt, armed: hero.raceState.roundArmed ? 1 : 0 });
                        }
                    }
                    inEp = true; lastDevT = t;
                } else if (inEp && t - lastDevT > 0.5) inEp = false;
            }
            delete window.__AVDBG;
            return out;
        }, seed);
        for (const r of rows) r.seed = seed;
        ROWS.push(...rows);
        console.log(`seed ${seed}: ${rows.length} onsets`);
    }
    await browser.close();
    const bins = {};
    for (const r of ROWS) {
        const k = r.sc ? 'sc(wall-on-straight)'
            : r.bc ? 'bc(boat?!)'
            : r.prox >= 3000 ? 'prox>=3000(grind/band)'
            : r.prox >= 800 ? 'prox800-3000(buffer)'
            : r.prox > 0 ? 'prox1-800(soft)'
            : 'prox0-other-term';
        const k2 = k + (r.pt ? '/planTight' : '');
        bins[k2] = bins[k2] || { n: 0, proxs: [], zcs: [] };
        bins[k2].n++; bins[k2].proxs.push(r.prox); bins[k2].zcs.push(r.zc);
    }
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    console.log(`\n=== PHANTOM WHY (${TRIALS} seeds, ${path.basename(ROOT)}) — ${ROWS.length} AVOID_NONE onsets ===`);
    for (const [k, v] of Object.entries(bins).sort((a, b) => b[1].n - a[1].n))
        console.log(`  ${k.padEnd(30)} n=${String(v.n).padStart(4)} (${(100 * v.n / ROWS.length).toFixed(0)}%)  prox med ${q(v.proxs, .5)}  zeroCost med ${q(v.zcs, .5)}`);
    fs.writeFileSync(path.join(__dirname, '_phantom_why.json'), JSON.stringify(ROWS, null, 1));
    console.log('wrote _phantom_why.json');
})();
