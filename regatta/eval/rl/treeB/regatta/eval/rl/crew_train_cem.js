// CEM trainer for the CREW-level policy (four-level architecture: crew =
// controls execution). Open-water episodes on seatrials with overridden wind
// (8-28 kt) and a scripted tactician issuing TWA commands incl. forced tacks
// and gybes; the policy owns turn rate + sail power via the inert
// window.__rlCrew hook in updateAI (treeA must contain the hook).
//
//   node crew_train_cem.js --iters 10 --pop 24 --pages 6 --seedsper 6
//   node crew_train_cem.js --eval crew_policy.json --n 40   # vs classical
//
// Score per episode: mean VMG toward the commanded heading minus irons tax,
// reported as DELTA vs the classical crew on the same command script (CRN:
// per-epSeed classical results are cached). Output: crew_policy.json.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { CREW_SRC, PARAM_DIM, initMean, initSigma } = require('./crew_shared.js');
const { makeRng } = require('./rl_shared.js');
const ROOT = path.join(__dirname, 'treeA');

function arg(name, dflt) {
    const i = process.argv.indexOf('--' + name);
    return i > 0 ? process.argv[i + 1] : dflt;
}
const EVAL = arg('eval', null);
const ITERS = parseInt(arg('iters', 10));
const POP = parseInt(arg('pop', 24));
const PAGES = parseInt(arg('pages', 6));
const SEEDS_PER = parseInt(arg('seedsper', 6));
const EVAL_N = parseInt(arg('n', 40));
const OUT = path.join(__dirname, arg('out', 'crew_policy.json'));

async function makePage(browser) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: CREW_SRC });
    // One world per page: race started, everyone parked but the hero, whose
    // tactician is replaced by the episode's command script.
    await page.evaluate(() => {
        window.evalHarness.seed = 777;
        window.resetGame(); window.startRace();
        const dt = 1 / 60;
        for (let i = 0; i < 60 * 40 && state.race.status !== 'racing'; i++) window.update(dt);
        state.course.cutoff = 1e9;
        const bots = state.boats.filter(b => !b.isPlayer);
        window.__hero = bots[0];
        bots.slice(1).forEach((b, i) => { b.raceState.finished = true; b.x = 30000 + i * 200; b.y = 30000; });
        const pl = state.boats.find(b => b.isPlayer);
        pl.raceState.finished = true; pl.x = 32000; pl.y = 30000;
        window.update(dt); // ensure controllers exist
        window.__hero.controller.update = () => {};
        window.__hero.controller.wiggleActive = false;
        window.__crewX0 = window.__hero.x; window.__crewY0 = window.__hero.y;
        window.__rlCrew = { act: null, actFor: (b) => (b === window.__hero ? window.__rlCrew.act : null) };
    });
    return page;
}

async function runEpisode(page, params, epSeed) {
    return page.evaluate(([P, s]) => window.__crewEpisode(P, s), [params, epSeed]);
}

async function runJobs(pages, jobs, onDone) {
    let next = 0;
    await Promise.all(pages.map(async (page) => {
        while (next < jobs.length) {
            const j = jobs[next++];
            const res = await runEpisode(page, j.params, j.epSeed);
            onDone(j, res);
        }
    }));
}

(async () => {
    const browser = await chromium.launch();
    const pages = [];
    for (let i = 0; i < PAGES; i++) pages.push(await makePage(browser));

    if (EVAL) {
        const pol = JSON.parse(fs.readFileSync(path.join(__dirname, EVAL), 'utf8'));
        const P = pol.mean || pol;
        const jobs = [];
        for (let k = 0; k < EVAL_N; k++) {
            jobs.push({ epSeed: 50000 + k, params: null, kind: 'cls' });
            jobs.push({ epSeed: 50000 + k, params: P, kind: 'pol' });
        }
        const acc = {}; // epSeed -> {cls, pol}
        await runJobs(pages, jobs, (j, r) => { (acc[j.epSeed] = acc[j.epSeed] || {})[j.kind] = r; });
        const byW = {};
        let dSum = 0;
        for (const s in acc) {
            const { cls, pol: pl2 } = acc[s];
            const d = pl2.R - cls.R;
            dSum += d;
            (byW[cls.wspd] = byW[cls.wspd] || []).push({ d, cls: cls.R, pol: pl2.R, ironsC: cls.ironsT, ironsP: pl2.ironsT });
        }
        console.log(`EVAL ${EVAL} on ${EVAL_N} held-out episodes: mean dR ${(dSum / EVAL_N).toFixed(3)}`);
        for (const w of Object.keys(byW).sort((a, b) => a - b)) {
            const g = byW[w];
            const m = f => (g.reduce((a, x) => a + f(x), 0) / g.length).toFixed(3);
            console.log(`  ${String(w).padStart(2)}kt n=${g.length}  dR ${m(x => x.d)}  vmg cls ${m(x => x.cls)} pol ${m(x => x.pol)}  irons cls ${m(x => x.ironsC)}s pol ${m(x => x.ironsP)}s`);
        }
        await browser.close();
        return;
    }

    const rng = makeRng(31337);
    let mean = initMean(), sigma = initSigma();
    const clsCache = {};
    const history = []; let bestEver = null;
    for (let iter = 0; iter < ITERS; iter++) {
        const epSeeds = [];
        for (let k = 0; k < SEEDS_PER; k++) epSeeds.push(10000 + iter * SEEDS_PER + k);
        const cands = [mean.slice()];
        for (let c = 1; c < POP; c++) cands.push(mean.map((m, i) => m + sigma[i] * rng.gauss()));
        const scores = cands.map(() => 0), ns = cands.map(() => 0);
        const jobs = [];
        for (const s of epSeeds) if (clsCache[s] == null) jobs.push({ c: -1, epSeed: s, params: null });
        for (let c = 0; c < cands.length; c++) for (const s of epSeeds) jobs.push({ c, epSeed: s, params: cands[c] });
        const t0 = Date.now();
        await runJobs(pages, jobs, (j, r) => {
            if (j.c < 0) { clsCache[j.epSeed] = r.R; return; }
            scores[j.c] += r.R - clsCache[j.epSeed]; ns[j.c]++;
        });
        const agg = cands.map((_, c) => ({ c, score: scores[c] / Math.max(1, ns[c]) })).sort((a, b) => b.score - a.score);
        const nElite = Math.max(2, Math.round(POP / 4));
        const elite = agg.slice(0, nElite);
        mean = mean.map((_, i) => elite.reduce((a, e) => a + cands[e.c][i], 0) / nElite);
        const extra = 0.06 * Math.pow(0.85, iter);
        sigma = sigma.map((_, i) => {
            const v = elite.reduce((a, e) => a + Math.pow(cands[e.c][i] - mean[i], 2), 0) / nElite;
            return Math.max(0.03, Math.sqrt(v + extra * extra));
        });
        const top = agg[0], mc = agg.find(a => a.c === 0);
        if (!bestEver || top.score > bestEver.score) bestEver = { score: top.score, params: cands[top.c], iter };
        console.log(`iter ${iter} epSeeds=[${epSeeds}] best dR ${top.score.toFixed(3)} | meanPolicy dR ${mc.score.toFixed(3)} | elite ${(elite.reduce((a, e) => a + e.score, 0) / nElite).toFixed(3)} | ${((Date.now() - t0) / 60000).toFixed(1)} min`);
        history.push({ iter, epSeeds, best: top.score, meanPolicy: mc.score });
        fs.writeFileSync(OUT, JSON.stringify({ iterDone: iter, mean, sigma, bestEver, history }));
    }
    console.log('saved', OUT);
    await browser.close();
})();
