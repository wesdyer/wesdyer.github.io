// The hub's skipper card: screenshots at several window sizes and skippers.
//   node regatta/eval/rl/_hub_skipper_shot.js <outdir>
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.argv[2] || '.';
(async () => {
    const b = await chromium.launch();
    for (const [w, h, who] of [[1600, 1000, 'Finley'], [1440, 900, 'Glide'], [1280, 800, 'Gasket']]) {
        const p = await b.newPage({ viewport: { width: w, height: h } });
        p.on('pageerror', e => console.log('PAGE ERROR', e.message));
        await p.addInitScript((c) => { try { const s = JSON.parse(localStorage.getItem('regatta_settings') || '{}'); s.character = c; localStorage.setItem('regatta_settings', JSON.stringify(s)); } catch (e) {} }, who);
        await p.goto('file://' + path.resolve(__dirname, '../../index.html'));
        await p.waitForTimeout(2500);
        const info = await p.evaluate(() => {
            const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.left)},${Math.round(b.top)}`; };
            return { char: settings.character, card: r('hub-skipper-card'), band: r('hub-skipper-band'), face: r('hub-skipper-img'), boat: r('hub-skipper-boat'), hero: r('hub-hero'), doors: r('door-cup'), btn: r('hub-skipper'),
                     overflow: document.getElementById('clubhouse-overlay').scrollHeight > document.getElementById('clubhouse-overlay').clientHeight };
        });
        console.log(w + 'x' + h, JSON.stringify(info));
        await p.screenshot({ path: path.join(OUT, `hub_${w}x${h}_${who}.png`) });
        await p.close();
    }
    await b.close();
})();
