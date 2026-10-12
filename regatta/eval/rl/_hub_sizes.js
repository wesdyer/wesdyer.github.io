// The hub at many window sizes: screenshot each and print the main boxes.
//   node regatta/eval/rl/_hub_sizes.js <outdir> [WxH,WxH,...]
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.argv[2] || '.';
const SIZES = (process.argv[3] || '1280x800,1440x900,1600x1000,1920x1080,1920x1200,2560x1440,3440x1440').split(',').map(s => s.split('x').map(Number));
(async () => {
    const b = await chromium.launch();
    for (const [w, h] of SIZES) {
        const p = await b.newPage({ viewport: { width: w, height: h } });
        await p.goto('file://' + path.resolve(__dirname, '../../index.html'));
        await p.waitForTimeout(2200);
        const r = await p.evaluate(() => {
            const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
            const img = document.getElementById('hub-hero-img');
            return { hero: box('#hub-hero'), boat: box('#hub-boat-card'), skipper: box('#hub-skipper-card'), doors: box('#door-cup'), header: box('.ch-header'),
                     paintingShown: img ? (() => { const b = img.getBoundingClientRect(), ar = img.naturalWidth / img.naturalHeight; const w = Math.min(b.width, b.height * ar); return [Math.round(w), Math.round(w / ar)]; })() : null };
        });
        console.log(`${w}x${h}`, JSON.stringify(r));
        await p.screenshot({ path: path.join(OUT, `size_${w}x${h}.png`) });
        await p.close();
    }
    await b.close();
})();
