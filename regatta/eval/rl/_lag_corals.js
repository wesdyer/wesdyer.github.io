const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join('/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl', 'treeLAG');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(() => {
        window.evalHarness.seed = 9100;
        window.resetGame(); window.startRace();
        for (let i = 0; i < 120; i++) window.update(1 / 60);
        const g = state.course.botGrid;
        const isles = state.course.islands || [];
        const hits = isles.filter(i => /\.hit$/.test(i.id || ''));
        const out = { nIslands: isles.length, nHitShapes: hits.length, corals: [] };
        for (const h of hits.slice(0, 40)) {
            let blocked = 0;
            const cc = g.cell(h.x, h.y);
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                if (!g.at(cc[0] + dx, cc[1] + dy)) blocked++;
            }
            out.corals.push({ id: h.id, r: Math.round(h.radius), blocked });
        }
        out.navIslandsHasHits = (state.course.navIslands || []).filter(i => /\.hit$/.test(i.id || '')).length;
        return out;
    });
    const zero=r.corals.filter(c=>c.blocked===0);
    console.log('islands',r.nIslands,'hitShapes',r.nHitShapes,'navIslandsWithHits',r.navIslandsHasHits);
    console.log('corals sampled',r.corals.length,'ZERO-blocked',zero.length,'radii:',zero.map(c=>c.r).sort((a,b)=>a-b).join(','));
    await browser.close();
})();
