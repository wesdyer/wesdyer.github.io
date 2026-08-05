// PHASE A — CEM trainer for the driver-level transit residual.
//
// Fitness is CRN-PAIRED against a frozen-classical twin on the same seed:
// score = classicalCost(seed) - policyCost(seed), averaged over the generation's
// seed set. Cost is mean per-boat time-to-ARM (with a bounded shortfall charge
// for boats that never arm), plus 1.5/contact-episode and 60/penalty — the
// penalty weight is what keeps the lexicographic gate honest during training
// rather than only at acceptance.
//
// Seed protocol (the part that failed last time, per the research memo — it was
// PROTOCOL, not policy class): a 200-seed training pool, K seeds RESAMPLED per
// generation (fixed CRN within a generation, rotating across), a disjoint
// 16-seed VALIDATION set scored every --valevery generations with checkpoint
// selection by validation, and the 16 fleet-gate seeds (9100-9115) never seen
// at all.
//
// Trainer: MIRRORED ES (antithetic pairs + rank-scaled update), not plain CEM.
// The first two CEM generations walked the mean 41s BELOW the classical floor:
// with 45 parameters, pop 12 and a fleet-level score, elite selection is mostly
// selecting noise, and an elite MEAN inherits every one of those mistakes. Under
// antithetic pairs the same noise appears in BOTH members of a pair and cancels
// in the difference, which is the whole point of the trick — and the update is a
// scaled gradient step from the CLASSICAL ANCHOR rather than a jump to wherever
// the lucky candidates were.
//
//   node rlt_train.js --pages 5 --pop 12 --seedsper 6 --win 280
//   node rlt_train.js --resume              # continue from rlt_policy.json
//   node rlt_train.js --resume --reset      # keep the classical cache, restart the mean at 0
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, PARAM_DIM, OBS_DIM, zeroParams, makeRng } = require('./rlt_shared.js');

function arg(n, d) { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; }
const ROOT = path.join(__dirname, arg('tree', 'treeF'));
const PAGES = parseInt(arg('pages', 5));
const POP = parseInt(arg('pop', 12));
const SEEDS_PER = parseInt(arg('seedsper', 6));
const GENS = parseInt(arg('gens', 9999));
const WIN = parseInt(arg('win', 280));

const SIGMA0 = parseFloat(arg('sigma', 0.35));
const LR = parseFloat(arg('lr', 0.35));
const VAL_EVERY = parseInt(arg('valevery', 5));
const OUT = path.join(__dirname, arg('out', 'rlt_policy.json'));
const RESUME = process.argv.includes('--resume');

const POOL = []; for (let i = 0; i < 200; i++) POOL.push(20000 + i);
const VAL = []; for (let i = 0; i < 16; i++) VAL.push(30000 + i);

async function makePage(browser) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    await page.evaluate(() => window.__rltInstallCounter());
    return page;
}

// One work queue over the page pool, with page recovery: a crashed renderer
// kills a multi-hour run otherwise, and this job is the floor under the session.
async function runJobs(browser, pages, jobs, onDone) {
    let next = 0;
    await Promise.all(pages.map(async (_p, slotIdx) => {
        while (next < jobs.length) {
            const j = jobs[next++];
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const r = await pages[slotIdx].evaluate(
                        ([P, s, w]) => window.__rltEpisode(P, s, w), [j.params, j.seed, WIN]);
                    onDone(j, r);
                    break;
                } catch (e) {
                    console.log(`page ${slotIdx} episode failed (${String(e).slice(0, 90)}) — rebuilding`);
                    try { await pages[slotIdx].close(); } catch (e2) {}
                    pages[slotIdx] = await makePage(browser);
                    if (attempt === 2) onDone(j, null);
                }
            }
        }
    }));
}

(async () => {
    const browser = await chromium.launch();
    const pages = [];
    for (let i = 0; i < PAGES; i++) pages.push(await makePage(browser));

    let mean = zeroParams();
    const DIM = mean.length;
    // The hidden-layer size lives at index PARAM_DIM and must not be perturbed.
    // The BIAS (index OBS_DIM) is frozen at zero: a constant residual is a
    // proven catastrophe and it is the single easiest direction for a random
    // perturbation to find. The policy has to earn its angle from state.
    const frozen = (i) => i === OBS_DIM;
    let sigma = mean.map((_, i) => frozen(i) ? 0 : SIGMA0);
    let gen0 = 0, classical = {}, history = [], best = null, badRun = 0;
    if (RESUME && fs.existsSync(OUT)) {
        const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
        classical = prev.classical || {};
        if (!process.argv.includes('--reset')) {
            mean = prev.mean; sigma = prev.sigma; gen0 = prev.gen + 1;
            history = prev.history || []; best = prev.best || null;
        }
        console.log(`resumed at gen ${gen0} with ${Object.keys(classical).length} cached classical seeds`);
    }
    const rng = makeRng(4242 + gen0 * 7);
    console.log(`PHASE A residual ES: dim=${DIM} pop=${POP} seedsPer=${SEEDS_PER} pages=${PAGES} win=${WIN}s`);

    for (let gen = gen0; gen < GENS; gen++) {
        const seeds = [];
        for (let k = 0; k < SEEDS_PER; k++) seeds.push(POOL[(gen * SEEDS_PER + k) % POOL.length]);
        // Antithetic pairs: candidate 0 is the mean (free readout of where we
        // actually are), then PAIRS of mirrored perturbations.
        const cands = [mean.slice()];
        const eps = [null];
        const nPair = Math.floor((POP - 1) / 2);
        for (let q = 0; q < nPair; q++) {
            const e = mean.map((_, i) => frozen(i) ? 0 : rng.gauss());
            cands.push(mean.map((m, i) => m + SIGMA0 * e[i]));  eps.push(e);
            cands.push(mean.map((m, i) => m - SIGMA0 * e[i]));  eps.push(e.map(v => -v));
        }

        const jobs = [];
        for (const s of seeds) if (classical[s] == null) jobs.push({ c: -1, seed: s, params: null });
        for (let c = 0; c < cands.length; c++)
            for (const s of seeds) jobs.push({ c, seed: s, params: cands[c] });

        const t0 = Date.now();
        const acc = cands.map(() => ({ d: [], hits: 0, pens: 0, armed: 0, n: 0 }));
        await runJobs(browser, pages, jobs, (j, r) => {
            if (!r) return;
            if (j.c < 0) { classical[j.seed] = { cost: r.cost, armed: r.armed, hits: r.hits, pens: r.pens, rawT: r.rawT }; return; }
            const ref = classical[j.seed];
            if (!ref) return;
            const a = acc[j.c];
            a.d.push(ref.cost - r.cost); a.hits += r.hits; a.pens += r.pens; a.armed += r.armed; a.n++;
        });
        const agg = acc.map((a, c) => ({
            c, n: a.n, score: a.n ? a.d.reduce((x, y) => x + y, 0) / a.n : -1e9,
            hits: a.hits / Math.max(1, a.n), pens: a.pens / Math.max(1, a.n), armed: a.armed / Math.max(1, a.n),
        })).sort((x, y) => y.score - x.score);

        // Mirrored-ES gradient: per pair, the DIFFERENCE of the two scores times
        // the perturbation. Scaled by the spread of those differences so the step
        // is in sigma units and cannot be blown up by one lucky seed set.
        const byC = {}; for (const a of agg) byC[a.c] = a.score;
        const diffs = [], dirs = [];
        for (let q = 0; q < nPair; q++) {
            const ip = 1 + 2 * q, im = 2 + 2 * q;
            if (byC[ip] == null || byC[im] == null) continue;
            diffs.push(byC[ip] - byC[im]);
            dirs.push(eps[ip]);
        }
        let stepped = 0;
        if (diffs.length >= 2) {
            const mu = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / diffs.length) || 1;
            const g = mean.map(() => 0);
            for (let q = 0; q < diffs.length; q++) {
                const w = diffs[q] / sd;
                for (let i = 0; i < g.length; i++) if (!frozen(i)) g[i] += w * dirs[q][i];
            }
            const scale = LR * SIGMA0 / (2 * diffs.length);
            mean = mean.map((m, i) => frozen(i) ? m : m + scale * g[i]);
            stepped = Math.sqrt(g.reduce((a, v) => a + v * v, 0)) * scale;
        }
        // Divergence guard: the classical floor is score 0 by construction, so a
        // mean that sits well below it for three straight generations is not
        // exploring, it is lost. Shrink back toward the anchor.
        const curScore = byC[0] != null ? byC[0] : 0;
        badRun = curScore < -12 ? badRun + 1 : 0;
        if (badRun >= 3) { mean = mean.map((m, i) => frozen(i) ? m : m * 0.5); badRun = 0; console.log('  ^ divergence guard: mean shrunk 0.5x toward the classical anchor'); }

        const top = agg[0], cur = agg.find(a => a.c === 0);
        const refArmed = seeds.reduce((a, s) => a + (classical[s] ? classical[s].armed : 0), 0) / seeds.length;
        const wall = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`gen ${gen} seeds=[${seeds[0]}..${seeds[seeds.length - 1]}] ` +
            `best ${top.score.toFixed(1)}s (armed ${top.armed.toFixed(1)}/${refArmed.toFixed(1)} hits ${top.hits.toFixed(1)} pens ${top.pens.toFixed(2)}) | ` +
            `meanPol ${cur.score.toFixed(1)}s | step ${stepped.toFixed(2)} | ${wall} min`);

        let val = null;
        if ((gen + 1) % VAL_EVERY === 0) {
            const vjobs = [];
            for (const s of VAL) if (classical[s] == null) vjobs.push({ c: -1, seed: s, params: null });
            for (const s of VAL) vjobs.push({ c: 0, seed: s, params: mean });
            const vacc = { d: [], hits: 0, pens: 0, armed: 0, n: 0 };
            await runJobs(browser, pages, vjobs, (j, r) => {
                if (!r) return;
                if (j.c < 0) { classical[j.seed] = { cost: r.cost, armed: r.armed, hits: r.hits, pens: r.pens, rawT: r.rawT }; return; }
                const ref = classical[j.seed]; if (!ref) return;
                vacc.d.push(ref.cost - r.cost); vacc.hits += r.hits; vacc.pens += r.pens; vacc.armed += r.armed; vacc.n++;
            });
            const vs = vacc.n ? vacc.d.reduce((x, y) => x + y, 0) / vacc.n : -1e9;
            const vrefArmed = VAL.reduce((a, s) => a + (classical[s] ? classical[s].armed : 0), 0) / VAL.length;
            const vrefPens = VAL.reduce((a, s) => a + (classical[s] ? classical[s].pens : 0), 0) / VAL.length;
            val = { gen, score: vs, armed: vacc.armed / Math.max(1, vacc.n), refArmed: vrefArmed,
                    hits: vacc.hits / Math.max(1, vacc.n), pens: vacc.pens / Math.max(1, vacc.n), refPens: vrefPens,
                    wins: vacc.d.filter(x => x > 0).length, n: vacc.n };
            console.log(`  VALIDATION gen ${gen}: ${vs.toFixed(1)}s over ${vacc.n} held-out seeds ` +
                `(wins ${val.wins}/${vacc.n}, armed ${val.armed.toFixed(1)} vs ${vrefArmed.toFixed(1)}, ` +
                `pens ${val.pens.toFixed(2)} vs ${vrefPens.toFixed(2)})`);
            if (!best || vs > best.score) { best = { score: vs, gen, params: mean.slice(), val }; console.log('  ^ new best-by-validation checkpoint'); }
        }

        history.push({ gen, seeds, best: top.score, meanPol: cur.score, step: +stepped.toFixed(3), wallMin: +wall, val });
        fs.writeFileSync(OUT, JSON.stringify({ gen, mean, sigma, classical, history, best, dim: DIM, win: WIN }));
    }
    await browser.close();
})();
