// Does repositionBoats' `boat.controller.startStageDepth = 60` ever run?
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = require('path').join(__dirname, process.argv[2] || 'treeRW');
(async () => {
    const b = await chromium.launch(); const page = await b.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    const out = await page.evaluate(() => {
        const res = {};
        const orig = window.repositionBoats;
        window.repositionBoats = function () {
            res.controllersAtReposition = state.boats.filter(x => x.controller).length;
            res.nBoats = state.boats.length;
            return orig.apply(this, arguments);
        };
        window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
        res.afterReset_controllers = state.boats.filter(x => x.controller).length;
        for (let i = 0; i < 5; i++) window.update(1 / 60);
        res.afterUpdate_controllers = state.boats.filter(x => x.controller).length;
        res.stageDepths = state.boats.filter(x => x.controller).map(x => x.controller.startStageDepth);
        // second race in the same process
        window.evalHarness.seed = 9401; window.resetGame(); window.startRace();
        res.race2_controllersAtReposition = res.controllersAtReposition;
        for (let i = 0; i < 5; i++) window.update(1 / 60);
        res.race2_stageDepths = state.boats.filter(x => x.controller).map(x => x.controller.startStageDepth);
        return res;
    });
    console.log(JSON.stringify(out, null, 1));
    await b.close();
})();
