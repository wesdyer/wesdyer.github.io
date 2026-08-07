// Paired scene read between TWO TREES (classical baseline vs candidate tree).
// Same CRN restore per scene on each tree; per-scene cost delta clipped ±250
// (rule 15: tails dominate). Reads the FULL held-out split for every class,
// plus the ENTIRE wiggle corpus (the target class for the P1 candidate).
//   node scn_tree_pair.js <baseTree> <candTree> [pagesPerTree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, SCN_SRC } = require('./scn_shared.js');
const BASE = process.argv[2] || 'treePH0';
const CAND = process.argv[3] || 'treeARC';
const PAGES = parseInt(process.argv[4] || '3');
const OUTDIR = path.join(__dirname, 'scn_pool');
const WIN_BY = { gap: 25, thread: 30, wiggle: 40, squeeze: 25 };
const CLIP = 250;
function hash32(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
async function makePage(browser, tree) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(path.join(__dirname, tree), 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(path.join(__dirname, tree), 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    await page.addScriptTag({ content: SCN_SRC });
    await page.evaluate(() => window.__rltInstallCounter());
    return page;
}
(async () => {
    const scenes = [];
    for (const f of fs.readdirSync(OUTDIR).filter(x => x.startsWith('scenes_')).sort()) {
        for (const s of JSON.parse(fs.readFileSync(path.join(OUTDIR, f), 'utf8'))) {
            s.id = `${s.seed}:${s.t}:${s.ego.name}`;
            const held = hash32(s.id) % 100 >= 85;
            if (s.cls === 'wiggle' || held) { s.held = held; scenes.push(s); }
        }
    }
    console.log(`scenes: ${scenes.length} (all wiggle + held-out other classes)`);
    const browser = await chromium.launch();
    const res = { base: {}, cand: {} };
    for (const [key, tree] of [['base', BASE], ['cand', CAND]]) {
        const pages = [];
        for (let i = 0; i < PAGES; i++) pages.push(await makePage(browser, tree));
        let next = 0;
        await Promise.all(pages.map(async (_p, slot) => {
            while (next < scenes.length) {
                const s = scenes[next++];
                for (let a = 0; a < 3; a++) {
                    try {
                        const r = await pages[slot].evaluate(
                            ([s, w]) => window.__scnEpisode(null, s, w),
                            [s, WIN_BY[s.cls] || 30]);
                        if (r) res[key][s.id] = r;
                        break;
                    } catch (e) {
                        try { await pages[slot].close(); } catch (e2) {}
                        pages[slot] = await makePage(browser, tree);
                    }
                }
            }
        }));
        for (const pg of pages) { try { await pg.close(); } catch (e) {} }
        console.log(`${key} (${tree}) done: ${Object.keys(res[key]).length}`);
    }
    const rows = {};
    let D = [], W = 0, L = 0, hitsC = 0, hitsB = 0, n = 0;
    for (const s of scenes) {
        const b = res.base[s.id], c = res.cand[s.id];
        if (!b || !c) continue;
        const d = Math.max(-CLIP, Math.min(CLIP, b.cost - c.cost)); // >0: candidate better
        (rows[s.cls] = rows[s.cls] || []).push(d);
        D.push(d); if (d > 0) W++; else if (d < 0) L++;
        hitsC += c.hits; hitsB += b.hits; n++;
    }
    const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    console.log(`\nALL: n=${n} mean ${(D.reduce((a, b) => a + b, 0) / n).toFixed(1)}u med ${q(D, .5).toFixed(1)} win/loss ${W}/${L} hits cand ${(hitsC / n).toFixed(3)} vs base ${(hitsB / n).toFixed(3)}`);
    for (const cls of Object.keys(rows)) {
        const d = rows[cls];
        console.log(`  ${cls.padEnd(7)} n=${d.length} mean ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)}u med ${q(d, .5).toFixed(1)} win ${d.filter(x => x > 0).length}/${d.filter(x => x < 0).length}`);
    }
    fs.writeFileSync(path.join(__dirname, `scn_pair_${CAND}.json`), JSON.stringify({ base: BASE, cand: CAND, res }, null, 0));
    await browser.close();
})();
