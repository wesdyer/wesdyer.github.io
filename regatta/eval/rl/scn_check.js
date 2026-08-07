// PUSH C — scene-episode integrity proof, per the standing floor discipline:
//   1. DETERMINISM: the same scene run twice classically must agree exactly
//      (cost, prog, hits, pens) — CRN pairing is meaningless otherwise.
//   2. INERTNESS: zero-parameter policy == classical, exactly.
//   3. LIVENESS: a bias-only policy must move the outcome (hook live).
// Also prints per-class episode wall time — the whole push rests on the
// 1-2s/episode budget arithmetic.
//   node scn_check.js [tree] [nScenes] [win]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, SCN_SRC, PARAM_DIM, zeroParams } = require('./scn_shared.js');
const ROOT = path.join(__dirname, process.argv[2] || 'treeSCN');
const NSC = parseInt(process.argv[3] || '8');
const WIN = parseInt(process.argv[4] || '30');
const OUTDIR = path.join(__dirname, 'scn_pool');

(async () => {
    const files = fs.readdirSync(OUTDIR).filter(f => f.startsWith('scenes_')).sort();
    const scenes = [];
    for (const f of files) {
        for (const s of JSON.parse(fs.readFileSync(path.join(OUTDIR, f), 'utf8'))) scenes.push(s);
        if (scenes.length >= NSC * 6) break;
    }
    // A spread across classes, not the first N of one seed.
    const byCls = {};
    for (const s of scenes) (byCls[s.cls] = byCls[s.cls] || []).push(s);
    const pick = [];
    const classes = Object.keys(byCls);
    for (let i = 0; pick.length < NSC && i < 100; i++) {
        const cls = classes[i % classes.length];
        const arr = byCls[cls];
        const k = Math.floor(i / classes.length) * 3;
        if (arr && k < arr.length) pick.push(arr[k]);
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    await page.addScriptTag({ content: SCN_SRC });
    await page.evaluate(() => window.__rltInstallCounter());

    const zero = zeroParams();
    const tiny = zeroParams(); tiny[PARAM_DIM - 1] = 0.5;
    let okDet = true, okInert = true, okLive = 0;
    const wall = {};
    for (const sc of pick) {
        const t0 = Date.now();
        const a = await page.evaluate(([P, s, w]) => window.__scnEpisode(P, s, w), [null, sc, WIN]);
        const tA = (Date.now() - t0) / 1000;
        const a2 = await page.evaluate(([P, s, w]) => window.__scnEpisode(P, s, w), [null, sc, WIN]);
        const b = await page.evaluate(([P, s, w]) => window.__scnEpisode(P, s, w), [zero, sc, WIN]);
        const c = await page.evaluate(([P, s, w]) => window.__scnEpisode(P, s, w), [tiny, sc, WIN]);
        const key = (r) => r ? [r.cost.toFixed(4), r.prog.toFixed(3), r.hits, r.pens].join('|') : 'null';
        const det = key(a) === key(a2), inert = key(a) === key(b), live = key(c) !== key(a);
        if (!det) okDet = false;
        if (!inert) okInert = false;
        if (live) okLive++;
        (wall[sc.cls] = wall[sc.cls] || []).push(tA);
        console.log(`${sc.cls.padEnd(7)} seed ${sc.seed} t=${sc.t}: prog ${a.prog.toFixed(0)}u hits ${a.hits} ` +
            `pens ${a.pens} (${tA.toFixed(2)}s wall) det=${det ? 'OK' : '*** FAIL'} ` +
            `inert=${inert ? 'OK' : '*** FAIL'} bias=${live ? 'moves' : 'no-effect'}`);
    }
    for (const c of Object.keys(wall)) {
        const w = wall[c];
        console.log(`wall ${c}: mean ${(w.reduce((a, b) => a + b, 0) / w.length).toFixed(2)}s over ${w.length}`);
    }
    console.log(`DETERMINISM: ${okDet ? 'PASS' : 'FAIL'}  INERTNESS: ${okInert ? 'PASS' : 'FAIL'}  ` +
        `HOOK LIVE on ${okLive}/${pick.length}`);
    await browser.close();
})();
