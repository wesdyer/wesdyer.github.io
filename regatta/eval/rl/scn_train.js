// PUSH C — mirrored-ES trainer over the SCENE POOL (spawn-into-scenario).
// The protocol is rlt_train.js's (antithetic pairs, rank-scaled step from the
// classical anchor, frozen zero bias, divergence guard, best-by-validation
// checkpointing) with the budget arithmetic fixed: episodes are 20-40s scenes
// at ~1-2s wall, not 280s full races at ~20s wall.
//
// CRN pairing: fitness per scene = classicalCost(scene) - policyCost(scene);
// the classical twin is DETERMINISTIC per scene, so it is computed once and
// cached forever in the output JSON.
//
// Scene split: train/held-out by a deterministic hash of (seed, t) — the
// held-out set is never trained on; the kill criterion (two overnight runs
// without beating the classical floor on held-out scenes) reads exactly this.
//
//   node scn_train.js --tree treeSCN --pages 8 --pop 12 --scenesper 40
//   node scn_train.js --resume
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, SCN_SRC, OBS_DIM, PARAM_DIM, zeroParams, makeRng } = require('./scn_shared.js');

function arg(n, d) { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; }
const ROOT = path.join(__dirname, arg('tree', 'treeSCN'));
const PAGES = parseInt(arg('pages', 8));
const POP = parseInt(arg('pop', 12));
const SCENES_PER = parseInt(arg('scenesper', 40));
const GENS = parseInt(arg('gens', 9999));
const SIGMA0 = parseFloat(arg('sigma', 0.35));
const LR = parseFloat(arg('lr', 0.35));
const VAL_EVERY = parseInt(arg('valevery', 10));
const VAL_N = parseInt(arg('valn', 120));
const OUT = path.join(__dirname, arg('out', 'scn_policy.json'));
const RESUME = process.argv.includes('--resume');
// Per-scene paired deltas are tail-dominated: a twin that wedges while the
// policy escapes (or vice versa) is a ±2000u outlier that swamps the other 39
// scenes of a generation — the same dispersion that starved the driver ES,
// re-expressed per scene. Clip each paired delta so a stuck/unstuck
// bifurcation counts as ONE decisive win/loss, not ten ordinary ones.
const CLIP = parseFloat(arg('clip', 250));
const clip = (x) => Math.max(-CLIP, Math.min(CLIP, x));
const OUTDIR = path.join(__dirname, 'scn_pool');

// Episode window by class: wiggle needs the stuck-detector latency plus the
// escape; gap/squeeze resolve fast.
const WIN_BY = { gap: 25, thread: 30, wiggle: 40, squeeze: 25 };
// Sophy-style mixed proportions, solo-first per the leader analysis.
// REBUILT overnight (run 1 verdict at gens 0-28: meanPol oscillated noise-
// shaped, divergence guard twice, validation -30.5 -> -17.1 with hits UP):
// thread/squeeze are where the classical stack is already decent, so their
// scenes contribute chaos variance and no gradient. Weight the pool toward
// the DECISIVE classes — wiggle (stuck by construction; the detector's
// 10-18s latency is the known classical failure) and gap approach (the
// leader's line-choice residual).
const MIX = { gap: 0.35, thread: 0.20, wiggle: 0.35, squeeze: 0.10 };

function hash32(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
function loadPool() {
    const all = [];
    for (const f of fs.readdirSync(OUTDIR).filter(x => x.startsWith('scenes_')).sort()) {
        for (const s of JSON.parse(fs.readFileSync(path.join(OUTDIR, f), 'utf8'))) all.push(s);
    }
    for (const s of all) s.id = `${s.seed}:${s.t}:${s.ego.name}`;
    const train = [], held = [];
    for (const s of all) (hash32(s.id) % 100 < 85 ? train : held).push(s);
    return { train, held };
}

async function makePage(browser) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    await page.addScriptTag({ content: SCN_SRC });
    await page.evaluate(() => window.__rltInstallCounter());
    return page;
}
async function runJobs(browser, pages, jobs, onDone) {
    let next = 0;
    await Promise.all(pages.map(async (_p, slot) => {
        while (next < jobs.length) {
            const j = jobs[next++];
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const r = await pages[slot].evaluate(
                        ([P, s, w]) => window.__scnEpisode(P, s, w),
                        [j.params, j.scene, WIN_BY[j.scene.cls] || 30]);
                    onDone(j, r);
                    break;
                } catch (e) {
                    console.log(`page ${slot} episode failed (${String(e).slice(0, 90)}) — rebuilding`);
                    try { await pages[slot].close(); } catch (e2) {}
                    pages[slot] = await makePage(browser);
                    if (attempt === 2) onDone(j, null);
                }
            }
        }
    }));
}
// Stratified deterministic sample: MIX proportions, rotating through each
// class's list across generations (CRN within a generation).
function sampleScenes(pool, gen, k) {
    const byCls = {};
    for (const s of pool) (byCls[s.cls] = byCls[s.cls] || []).push(s);
    const out = [];
    for (const cls of Object.keys(MIX)) {
        const arr = byCls[cls] || [];
        if (!arr.length) continue;
        const want = Math.max(1, Math.round(k * MIX[cls]));
        for (let i = 0; i < want; i++) out.push(arr[(gen * want + i) % arr.length]);
    }
    return out;
}

(async () => {
    const { train, held } = loadPool();
    const tal = (arr) => Object.entries(arr.reduce((m, s) => (m[s.cls] = (m[s.cls] || 0) + 1, m), {}))
        .map(([c, n]) => `${c} ${n}`).join(', ');
    console.log(`pool: train ${train.length} (${tal(train)}) | held-out ${held.length} (${tal(held)})`);
    if (!train.length) { console.log('EMPTY POOL — run scn_harvest.js first'); process.exit(1); }

    const browser = await chromium.launch();
    const pages = [];
    for (let i = 0; i < PAGES; i++) pages.push(await makePage(browser));

    let mean = zeroParams();
    const frozen = (i) => i === OBS_DIM;   // bias stays zero, forever
    let gen0 = 0, classical = {}, history = [], best = null, badRun = 0, epTotal = 0;
    if (RESUME && fs.existsSync(OUT)) {
        const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
        classical = prev.classical || {};
        if (!process.argv.includes('--reset')) {
            mean = prev.mean; gen0 = prev.gen + 1;
            history = prev.history || []; best = prev.best || null; epTotal = prev.epTotal || 0;
        }
        console.log(`resumed at gen ${gen0}, ${Object.keys(classical).length} cached twins, ${epTotal} episodes so far`);
    }
    const rng = makeRng(1717 + gen0 * 13);
    console.log(`PUSH C scene-ES: dim=${PARAM_DIM} pop=${POP} scenesPer=${SCENES_PER} pages=${PAGES}`);

    for (let gen = gen0; gen < GENS; gen++) {
        const scenes = sampleScenes(train, gen, SCENES_PER);
        const cands = [mean.slice()];
        const eps = [null];
        const nPair = Math.floor((POP - 1) / 2);
        for (let q = 0; q < nPair; q++) {
            const e = mean.map((_, i) => frozen(i) ? 0 : rng.gauss());
            cands.push(mean.map((m, i) => m + SIGMA0 * e[i])); eps.push(e);
            cands.push(mean.map((m, i) => m - SIGMA0 * e[i])); eps.push(e.map(v => -v));
        }
        const jobs = [];
        for (const s of scenes) if (classical[s.id] == null) jobs.push({ c: -1, scene: s, params: null });
        for (let c = 0; c < cands.length; c++)
            for (const s of scenes) jobs.push({ c, scene: s, params: cands[c] });

        const t0 = Date.now();
        const acc = cands.map(() => ({ d: [], hits: 0, pens: 0, n: 0 }));
        await runJobs(browser, pages, jobs, (j, r) => {
            epTotal++;
            if (!r) return;
            if (j.c < 0) { classical[j.scene.id] = { cost: r.cost, prog: r.prog, hits: r.hits, pens: r.pens }; return; }
            const ref = classical[j.scene.id];
            if (!ref) return;
            const a = acc[j.c];
            a.d.push(clip(ref.cost - r.cost)); a.hits += r.hits; a.pens += r.pens; a.n++;
        });
        const agg = acc.map((a, c) => ({
            c, n: a.n, score: a.n ? a.d.reduce((x, y) => x + y, 0) / a.n : -1e9,
            hits: a.hits / Math.max(1, a.n), pens: a.pens / Math.max(1, a.n),
        })).sort((x, y) => y.score - x.score);

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
        // Divergence guard, in scene units (u of course-path progress): the
        // floor is 0 by construction; sustained deep negatives = lost.
        const curScore = byC[0] != null ? byC[0] : 0;
        badRun = curScore < -30 ? badRun + 1 : 0;
        if (badRun >= 3) { mean = mean.map((m, i) => frozen(i) ? m : m * 0.5); badRun = 0; console.log('  ^ divergence guard: mean shrunk 0.5x'); }

        const top = agg[0], cur = agg.find(a => a.c === 0);
        const wall = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`gen ${gen} scenes=${scenes.length} best ${top.score.toFixed(1)}u ` +
            `(hits ${top.hits.toFixed(2)} pens ${top.pens.toFixed(2)}) | meanPol ${cur.score.toFixed(1)}u | ` +
            `step ${stepped.toFixed(2)} | ${wall} min | ep ${epTotal}`);

        let val = null;
        if ((gen + 1) % VAL_EVERY === 0 && held.length) {
            const hs = held.slice(0, VAL_N);
            const vjobs = [];
            for (const s of hs) if (classical[s.id] == null) vjobs.push({ c: -1, scene: s, params: null });
            for (const s of hs) vjobs.push({ c: 0, scene: s, params: mean });
            const vacc = { d: [], hits: 0, pens: 0, refHits: 0, n: 0 };
            await runJobs(browser, pages, vjobs, (j, r) => {
                epTotal++;
                if (!r) return;
                if (j.c < 0) { classical[j.scene.id] = { cost: r.cost, prog: r.prog, hits: r.hits, pens: r.pens }; return; }
                const ref = classical[j.scene.id]; if (!ref) return;
                vacc.d.push(clip(ref.cost - r.cost)); vacc.hits += r.hits; vacc.pens += r.pens;
                vacc.refHits += ref.hits; vacc.n++;
            });
            const vs = vacc.n ? vacc.d.reduce((x, y) => x + y, 0) / vacc.n : -1e9;
            val = { gen, score: vs, wins: vacc.d.filter(x => x > 0).length,
                    losses: vacc.d.filter(x => x < 0).length, n: vacc.n,
                    hits: vacc.hits / Math.max(1, vacc.n), refHits: vacc.refHits / Math.max(1, vacc.n) };
            console.log(`  VALIDATION gen ${gen}: ${vs.toFixed(1)}u over ${vacc.n} held-out scenes ` +
                `(win/loss ${val.wins}/${val.losses}, hits ${val.hits.toFixed(2)} vs ${val.refHits.toFixed(2)})`);
            if (!best || vs > best.score) { best = { score: vs, gen, params: mean.slice(), val }; console.log('  ^ new best-by-validation checkpoint'); }
        }
        history.push({ gen, best: +top.score.toFixed(2), meanPol: +cur.score.toFixed(2), step: +stepped.toFixed(3), wallMin: +wall, val });
        fs.writeFileSync(OUT, JSON.stringify({ gen, mean, classical, history, best, epTotal, dim: PARAM_DIM }));
    }
    await browser.close();
})();
