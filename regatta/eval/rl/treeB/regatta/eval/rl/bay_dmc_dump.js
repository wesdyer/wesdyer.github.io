// Dump bay DMC leg paths + course type. node bay_dmc_dump.js [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeA');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = await page.evaluate(() => {
        window.evalHarness.seed = 9100;
        window.resetGame(); window.startRace();
        return {
            type: state.course.type,
            marks: state.course.marks.map(m => ({ x: Math.round(m.x), y: Math.round(m.y), zone: m.zone && Math.round(m.zone), reqSweep: m.reqSweep && +m.reqSweep.toFixed(2), side: m.side })),
            legs: state.course.dmc.legs.map((l, i) => ({
                i, len: Math.round(l.length),
                pts: l.pts.filter((_, k) => k % 2 === 0).map(p => [Math.round(p.x), Math.round(p.y)])
            }))
        };
    });
    fs.writeFileSync(path.join(__dirname, 'bay_dmc.json'), JSON.stringify(out));
    console.log('type', out.type);
    for (const m of out.marks) console.log('mark', JSON.stringify(m));
    for (const l of out.legs) console.log('leg', l.i, 'len', l.len, 'pts', l.pts.length);
    await browser.close();
})();
