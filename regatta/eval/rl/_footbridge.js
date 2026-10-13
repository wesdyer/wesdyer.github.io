// PT-057: a hull under Sockeye's footbridge is hidden by the deck (opaque), not seen through a faded one.
// Prints the records hash too (a visual change must not move it).   node regatta/eval/rl/_footbridge.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
        TimeTrial.active = true; selectVenue('river'); resetGame(); state.boats.length = 1; startRace();
        while (state.race.status === 'prestart') update(1 / 30);
        const fb = state.course.doc.props.find(q => q.kind === 'river-footbridge'), me = state.boats[0];
        for (let i = 0; i < 20; i++) { me.x = fb.x; me.y = fb.y; me.speed = 0; me.heading = (fb.heading || 0) + Math.PI / 2; update(1 / 30); }
        draw();
        return { prop: fb.id, at: [Math.round(fb.x), Math.round(fb.y)], hash: recordsVenueHash('river') };
    });
    console.log(JSON.stringify(r));
    await p.screenshot({ path: process.argv[2] || 'footbridge.png', clip: { x: 300, y: 150, width: 600, height: 500 } });
    await b.close();
})();
