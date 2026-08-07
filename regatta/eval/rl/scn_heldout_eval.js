// Definitive held-out read for the overnight verdict: the chosen checkpoint
// vs the frozen classical twin over EVERY held-out scene (training's
// validation only ever sampled the first 120). Same clip as training.
//   node scn_heldout_eval.js [tree] [policy.json] [pages]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, SCN_SRC } = require('./scn_shared.js');
const ROOT = path.join(__dirname, process.argv[2] || 'treeSCN');
const POLICY = process.argv[3] || 'scn_policy.json';
const PAGES = parseInt(process.argv[4] || '4');
const OUTDIR = path.join(__dirname, 'scn_pool');
const WIN_BY = { gap: 25, thread: 30, wiggle: 40, squeeze: 25 };
const CLIP = 250;
function hash32(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
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
(async () => {
    const pol = JSON.parse(fs.readFileSync(path.join(__dirname, POLICY), 'utf8'));
    const P = (pol.best && pol.best.params) || pol.mean;
    const classical = pol.classical || {};
    const held = [];
    for (const f of fs.readdirSync(OUTDIR).filter(x => x.startsWith('scenes_')).sort()) {
        for (const s of JSON.parse(fs.readFileSync(path.join(OUTDIR, f), 'utf8'))) {
            s.id = `${s.seed}:${s.t}:${s.ego.name}`;
            if (hash32(s.id) % 100 >= 85) held.push(s);
        }
    }
    console.log(`held-out ${held.length} scenes; policy from gen ${pol.best ? pol.best.gen : '?'}`);
    const browser = await chromium.launch();
    const pages = [];
    for (let i = 0; i < PAGES; i++) pages.push(await makePage(browser));
    const jobs = [];
    for (const s of held) if (!classical[s.id]) jobs.push({ kind: 'twin', scene: s });
    for (const s of held) jobs.push({ kind: 'pol', scene: s });
    const res = {};
    let next = 0;
    await Promise.all(pages.map(async (_p, slot) => {
        while (next < jobs.length) {
            const j = jobs[next++];
            for (let a = 0; a < 3; a++) {
                try {
                    const r = await pages[slot].evaluate(
                        ([P, s, w]) => window.__scnEpisode(P, s, w),
                        [j.kind === 'pol' ? P : null, j.scene, WIN_BY[j.scene.cls] || 30]);
                    if (j.kind === 'twin') classical[j.scene.id] = { cost: r.cost, prog: r.prog, hits: r.hits, pens: r.pens };
                    else res[j.scene.id] = r;
                    break;
                } catch (e) {
                    try { await pages[slot].close(); } catch (e2) {}
                    pages[slot] = await makePage(browser);
                }
            }
        }
    }));
    const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    const rows = {};
    let D = [], W = 0, L = 0, hitsP = 0, hitsC = 0, n = 0;
    for (const s of held) {
        const r = res[s.id], ref = classical[s.id];
        if (!r || !ref) continue;
        const d = Math.max(-CLIP, Math.min(CLIP, ref.cost - r.cost));
        (rows[s.cls] = rows[s.cls] || []).push(d);
        D.push(d); if (d > 0) W++; else if (d < 0) L++;
        hitsP += r.hits; hitsC += ref.hits; n++;
    }
    console.log(`ALL: n=${n} mean ${(D.reduce((a, b) => a + b, 0) / n).toFixed(1)}u med ${q(D, .5).toFixed(1)} ` +
        `win/loss ${W}/${L} hits ${(hitsP / n).toFixed(3)} vs ${(hitsC / n).toFixed(3)}`);
    for (const cls of Object.keys(rows)) {
        const d = rows[cls];
        console.log(`  ${cls.padEnd(7)} n=${d.length} mean ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)}u ` +
            `med ${q(d, .5).toFixed(1)} win ${d.filter(x => x > 0).length}/${d.filter(x => x < 0).length}`);
    }
    await browser.close();
})();
