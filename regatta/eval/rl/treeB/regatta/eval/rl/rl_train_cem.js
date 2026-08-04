// CEM trainer for the sweep policy (pilot: armed-orbit target selection).
// Batch stepping: one page.evaluate per EPISODE (policy runs in-page).
// Parallel envs: a pool of headless pages sharing one browser.
// Fleet episodes: --stage fleet leaves the 8 rivals racing classically
// (window.__rlFleet) and adds the arc-blocking proxy penalty to the reward.
//
//   node rl_train_cem.js --stage solo  --iters 6 --pop 16 --pages 6
//   node rl_train_cem.js --stage fleet --iters 6 --pop 12 --pages 6 --init rl_policy_solo.json
//   node rl_train_cem.js --stage fleetret --iters 8 --pop 12 --pages 6 --init rl_policy_fleet.json
//   node rl_train_cem.js --probe                 # which seeds arm (reset only)
//
// --stage fleetret scores candidates on the FLEET-LEVEL return — the gate
// quantity itself: every armed bot runs the policy (actFor), score = rounders +
// finishers (+ time and leg-1-progress credit) over a 700s window. A cached
// CLASSICAL run of each training seed provides the reference score. Gate seeds
// 9100-9107 are strictly held out.
//
// Output: rl_policy_<stage>.json — { mean, sigma, best, history } per iteration.
// Scoring: mean episode return over the iteration's common seed set (CRN).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, PARAM_DIM, initMean, initSigma, makeRng } = require('./rl_shared.js');
const ROOT = path.join(__dirname, 'treeA');

function arg(name, dflt) {
    const i = process.argv.indexOf('--' + name);
    return i > 0 ? process.argv[i + 1] : dflt;
}
const PROBE = process.argv.includes('--probe');
const STAGE = arg('stage', 'solo');
const FLEETRET = STAGE === 'fleetret';
const RET_WIN = parseInt(arg('win', 700)); // fleetret race window (sim seconds)
const ITERS = parseInt(arg('iters', STAGE === 'solo' ? 6 : FLEETRET ? 8 : 6));
const POP = parseInt(arg('pop', STAGE === 'solo' ? 16 : 12));
const PAGES = parseInt(arg('pages', 6));
const SEEDS_PER = parseInt(arg('seedsper', STAGE === 'solo' ? 4 : 3));
const INIT = arg('init', null);
const OUT = path.join(__dirname, arg('out', `rl_policy_${STAGE}.json`));
const FLEET = STAGE === 'fleet';
const FLEET_PEN = FLEET ? 0.05 : 0;
// Candidate arming seeds; the probe (or a prior probe result) narrows these.
const SEED_POOL = (arg('seeds', '') ? arg('seeds', '').split(',').map(Number)
    : [4242, 4243, 4244, 4245, 4246, 4247, 4248, 4249, 4250, 4251, 4252, 4253]);

async function makePage(browser) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    await page.evaluate((fleet) => {
        window.__rlFleet = fleet;
        window.__rl = { act: null, contacts: 0 };
        const inner = window.onRaceEvent;
        // Hero-only contact counter (fleet mode would otherwise bill the hero
        // for every rival grounding).
        window.onRaceEvent = (t, d) => {
            if (t === 'collision_island' && d && d.boat === window.__hero) window.__rl.contacts++;
            return inner && inner(t, d);
        };
    }, FLEET);
    return page;
}

// Fast-forward to hero arming (identical to rl_env.reset).
async function resetOnPage(page, seed) {
    return page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        window.__hero = bots[0];
        if (!window.__rlFleet) {
            bots.slice(1).forEach((b, i) => { b.x = -4000 + i * 150; b.y = 4500; b.raceState.finished = true; });
        }
        const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
        window.__rl.act = null; window.__rl.contacts = 0;
        for (const b of state.boats) { b.__rlT0 = null; b.__rlActT = null; }
        const dt = 1 / 60;
        for (let i = 0; i < 60 * 700; i++) {
            window.update(dt);
            if (state.race.status !== 'racing') continue;
            if (window.__hero.raceState.roundArmed) break;
            if (state.race.timer > 650) return { failed: 'never-armed', t: state.race.timer };
        }
        if (!window.__hero.raceState.roundArmed) return { failed: 'never-armed', t: state.race.timer };
        window.__rl.t0 = state.race.timer;
        return { armed: true, t: state.race.timer };
    }, seed);
}

// fleetret episode: a full fleet race with the policy driving EVERY armed bot
// (params null = classical reference). Score = the gate quantity, smoothed:
// finisher 2.5 + time credit; rounder 1 + time credit; leg-1 boat at window end
// gets up to 0.5 progress credit so CEM has gradient below the first rounding.
async function runFleetEpisode(page, params, seed) {
    return page.evaluate(async ([P, seed, WIN]) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        if (P) window.__rlInstallActFor(P);
        else if (window.__rl) window.__rl.actFor = null;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
        for (const b of state.boats) { b.__rlT0 = null; b.__rlActT = null; }
        const info = bots.map(() => ({ legT: {}, fin: null }));
        const dt = 1 / 60;
        for (let it = 0; it < 60 * (WIN + 40); it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > WIN) break;
            const t = state.race.timer;
            for (let k = 0; k < bots.length; k++) {
                const b = bots[k], inf = info[k];
                if (inf.fin != null) continue;
                if (b.raceState.finished) { inf.fin = t; continue; }
                const lg = b.raceState.leg;
                if (inf.legT[lg] == null) inf.legT[lg] = t;
            }
        }
        // Score v2 — GATED PER-LEG DMC (owner suggestion): rounding/finish
        // bonuses are the gates; continuous progress credit on BOTH legs is the
        // gradient. v1 had no leg-2 credit, so a rounder that parked scored the
        // same as one 80% home — punishing the tail-nursing the gate rewards.
        let score = 0, rounders = 0, fins = 0;
        const leg1 = state.course.dmc.legs[1], leg2 = state.course.dmc.legs[2];
        for (let k = 0; k < bots.length; k++) {
            const b = bots[k], inf = info[k];
            if (inf.fin != null) { fins++; rounders++; score += 3.0 + (WIN - inf.fin) / WIN; }
            else if (inf.legT[2] != null) {
                rounders++; score += 1 + 0.5 * (WIN - inf.legT[2]) / WIN;
                if (leg2 && b.raceState.leg === 2) {
                    const s = CoursePath.project(leg2, b.x, b.y, null);
                    score += 0.5 * Math.max(0, Math.min(1, s / leg2.length));
                }
            } else if (leg1 && b.raceState.leg === 1) {
                const s = CoursePath.project(leg1, b.x, b.y, null);
                score += 0.5 * Math.max(0, Math.min(1, s / leg1.length));
            }
        }
        if (window.__rl) window.__rl.actFor = null;
        return { R: score, banked: rounders, rounders, fins, t: WIN, steps: 0, contacts: 0 };
    }, [params, seed, RET_WIN]);
}

async function runEpisode(page, params, seed) {
    if (FLEETRET) return { seed, ...(await runFleetEpisode(page, params, seed)) };
    const r0 = await resetOnPage(page, seed);
    if (r0.failed) return { failed: r0.failed, seed };
    const r = await page.evaluate(
        ([P, opts]) => window.__rlRollout(P, opts),
        [params, { maxSteps: 600, fleetPen: FLEET_PEN }]);
    return { seed, tArm: r0.t, ...r };
}

// Simple work queue over the page pool.
async function runJobs(pages, jobs, onDone) {
    let next = 0;
    await Promise.all(pages.map(async (page) => {
        while (next < jobs.length) {
            const j = jobs[next++];
            const res = await runEpisode(page, j.params, j.seed);
            onDone(j, res);
        }
    }));
}

(async () => {
    const browser = await chromium.launch();
    const nPages = Math.min(PAGES, PROBE ? SEED_POOL.length : PAGES);
    const pages = [];
    for (let i = 0; i < nPages; i++) pages.push(await makePage(browser));
    console.log(`stage=${STAGE} pages=${pages.length} pop=${POP} seedsPer=${SEEDS_PER} iters=${ITERS}`);

    if (PROBE) {
        // Reset-only probe: which seeds arm (and when)?
        let next = 0; const rows = [];
        await Promise.all(pages.map(async (page) => {
            while (next < SEED_POOL.length) {
                const seed = SEED_POOL[next++];
                const t0 = Date.now();
                const r = await resetOnPage(page, seed);
                rows.push({ seed, ...r, wall: ((Date.now() - t0) / 1000).toFixed(0) });
                console.log(`seed ${seed}: ${r.failed ? 'FAILED ' + r.failed : 'armed'} t=${r.t.toFixed(0)} wall=${((Date.now() - t0) / 1000).toFixed(0)}s`);
            }
        }));
        fs.writeFileSync(path.join(__dirname, `rl_probe_${STAGE}.json`), JSON.stringify(rows, null, 1));
        await browser.close();
        return;
    }

    const rng = makeRng(90210 + (FLEET ? 7 : 0));
    let mean = initMean(), sigma = initSigma();
    if (INIT) {
        const prev = JSON.parse(fs.readFileSync(path.join(__dirname, INIT), 'utf8'));
        mean = prev.mean; console.log('init mean from', INIT);
    }
    const history = [];
    let bestEver = null;
    const classicalCache = {}; // fleetret: per-seed classical reference score

    for (let iter = 0; iter < ITERS; iter++) {
        // Common random seeds: same set for every candidate this iteration,
        // rotating window over the pool across iterations.
        const seeds = [];
        for (let k = 0; k < SEEDS_PER; k++) seeds.push(SEED_POOL[(iter * SEEDS_PER + k) % SEED_POOL.length]);
        // Candidate 0 is the current mean (free progress readout, elitism).
        const cands = [mean.slice()];
        for (let c = 1; c < POP; c++)
            cands.push(mean.map((m, i) => m + sigma[i] * rng.gauss()));
        const scores = cands.map(() => []);
        const metas = cands.map(() => []);
        const jobs = [];
        // fleetret: score the classical stack once per seed (cached across iters).
        if (FLEETRET) for (const seed of seeds)
            if (classicalCache[seed] == null) jobs.push({ c: -1, seed, params: null });
        for (let c = 0; c < cands.length; c++)
            for (const seed of seeds) jobs.push({ c, seed, params: cands[c] });
        const t0 = Date.now();
        await runJobs(pages, jobs, (j, res) => {
            if (j.c < 0) { classicalCache[j.seed] = { R: res.R, rounders: res.rounders, fins: res.fins }; return; }
            if (res.failed) { metas[j.c].push(res); return; } // seed fails for all equally
            scores[j.c].push(res.R);
            metas[j.c].push(res);
        });
        const agg = cands.map((_, c) => {
            const s = scores[c];
            const banked = metas[c].reduce((a, m) => a + (typeof m.banked === 'number' ? m.banked : m.banked ? 1 : 0), 0);
            return {
                c, n: s.length,
                score: s.length ? s.reduce((a, b) => a + b, 0) / s.length : -99,
                banked,
                fins: metas[c].reduce((a, m) => a + (m.fins || 0), 0),
                meanT: (metas[c].filter(m => m.banked).reduce((a, m) => a + m.t, 0) / Math.max(1, metas[c].filter(m => m.banked).length)),
            };
        }).sort((a, b) => b.score - a.score);
        const nElite = Math.max(2, Math.round(POP / 4));
        const elite = agg.slice(0, nElite);
        const newMean = mean.map((_, i) =>
            elite.reduce((a, e) => a + cands[e.c][i], 0) / nElite);
        const extra = 0.08 * Math.pow(0.85, iter); // decaying exploration noise
        const newSigma = mean.map((_, i) => {
            const v = elite.reduce((a, e) => a + Math.pow(cands[e.c][i] - newMean[i], 2), 0) / nElite;
            return Math.max(0.04, Math.sqrt(v + extra * extra));
        });
        mean = newMean; sigma = newSigma;
        const top = agg[0], meanCand = agg.find(a => a.c === 0);
        if (!bestEver || top.score > bestEver.score)
            bestEver = { score: top.score, banked: top.banked, n: top.n, params: cands[top.c], iter, seeds };
        const wall = ((Date.now() - t0) / 60000).toFixed(1);
        const lbl = FLEETRET ? 'rounders' : 'banked';
        let ref = '';
        if (FLEETRET) {
            const cs = seeds.map(s => classicalCache[s]).filter(Boolean);
            ref = ` | CLASSICAL ${(cs.reduce((a, x) => a + x.R, 0) / cs.length).toFixed(2)}` +
                ` (rounders ${cs.reduce((a, x) => a + x.rounders, 0)}, fins ${cs.reduce((a, x) => a + x.fins, 0)})`;
        }
        console.log(`iter ${iter} seeds=[${seeds}] best ${top.score.toFixed(2)} (${lbl} ${top.banked}${FLEETRET ? ', fins ' + top.fins : '/' + top.n})` +
            ` | meanPolicy ${meanCand.score.toFixed(2)} (${lbl} ${meanCand.banked}${FLEETRET ? ', fins ' + meanCand.fins : '/' + meanCand.n})` +
            `${ref} | elite mean ${(elite.reduce((a, e) => a + e.score, 0) / nElite).toFixed(2)} | ${wall} min`);
        history.push({
            iter, seeds, wallMin: +wall,
            best: { score: top.score, banked: top.banked, n: top.n },
            meanPolicy: { score: meanCand.score, banked: meanCand.banked, n: meanCand.n },
            all: agg.map(a => ({ c: a.c, score: +a.score.toFixed(2), banked: a.banked })),
        });
        fs.writeFileSync(OUT, JSON.stringify({
            stage: STAGE, iterDone: iter, mean, sigma, bestEver, history,
        }));
    }
    console.log('saved', OUT);
    await browser.close();
})();
