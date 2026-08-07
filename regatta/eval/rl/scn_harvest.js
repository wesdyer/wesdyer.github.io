// PUSH C — scene harvester. Runs full arctic races on TRAINING-POOL seeds
// (20000+, disjoint from the 9100-9115 gate and the 30000+ validation seeds)
// with the classical stack, sampling scene entries at 2Hz, and writes the
// scene pool to scn_pool/scenes_<seed>.json.
//
//   node scn_harvest.js --tree treeSCN --pages 6 --from 20000 --n 40 --win 500
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, SCN_SRC } = require('./scn_shared.js');

function arg(n, d) { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; }
const ROOT = path.join(__dirname, arg('tree', 'treeSCN'));
const PAGES = parseInt(arg('pages', 6));
const FROM = parseInt(arg('from', 20000));
const N = parseInt(arg('n', 40));
const WIN = parseInt(arg('win', 500));
const OUTDIR = path.join(__dirname, 'scn_pool');
if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR);

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
    return page;
}

(async () => {
    const browser = await chromium.launch();
    const pages = [];
    for (let i = 0; i < PAGES; i++) pages.push(await makePage(browser));
    const seeds = []; for (let i = 0; i < N; i++) seeds.push(FROM + i);
    const tally = {}; let done = 0;
    let next = 0;
    const t0 = Date.now();
    await Promise.all(pages.map(async (_p, slot) => {
        while (next < seeds.length) {
            const seed = seeds[next++];
            const out = path.join(OUTDIR, `scenes_${seed}.json`);
            if (fs.existsSync(out)) { done++; continue; }
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const sc = await pages[slot].evaluate(
                        ([s, w]) => window.__scnHarvestRace(s, w), [seed, WIN]);
                    fs.writeFileSync(out, JSON.stringify(sc));
                    for (const s of sc) tally[s.cls] = (tally[s.cls] || 0) + 1;
                    done++;
                    console.log(`seed ${seed}: ${sc.length} scenes ` +
                        `(${['gap', 'thread', 'wiggle', 'squeeze'].map(c => c + ' ' + sc.filter(x => x.cls === c).length).join(', ')})` +
                        ` [${done}/${seeds.length}, ${((Date.now() - t0) / 60000).toFixed(1)}min]`);
                    break;
                } catch (e) {
                    console.log(`seed ${seed} failed (${String(e).slice(0, 90)}) — rebuilding page`);
                    try { await pages[slot].close(); } catch (e2) {}
                    pages[slot] = await makePage(browser);
                }
            }
        }
    }));
    console.log('TALLY', JSON.stringify(tally));
    await browser.close();
})();
