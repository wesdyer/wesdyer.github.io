// The hub's "you and your boat" card: for every character, does any text overflow its box,
// run below the band, or slide under the boat drawing? Run at the stage's narrowest width.
//   node regatta/eval/rl/_hub_text_fit.js [WxH]
const { chromium } = require('playwright'); const path = require('path');
const [W, H] = (process.argv[2] || '1600x1000').split('x').map(Number);
(async () => {
    const b = await chromium.launch(), p = await b.newPage({ viewport: { width: W, height: H } });
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(2000);
    const rows = await p.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const out = [];
        for (const c of AI_CONFIG) {
            fillSkipperCard(c);
            const band = r('hub-skipper-band'), boat = r('hub-skipper-boat');
            const who = document.querySelector('.ch-you-who'), w = who.getBoundingClientRect();
            const issues = [];
            for (const id of ['hub-skipper-name', 'hub-skipper-creature', 'hub-skipper-motto']) {
                const el = document.getElementById(id), e = el.getBoundingClientRect();
                if (el.scrollWidth > el.clientWidth + 1) issues.push(id.replace('hub-skipper-', '') + ' too wide');
                if (e.bottom > band.bottom - 8) issues.push(id.replace('hub-skipper-', '') + ' below band');
                // text glyph extent vs the boat drawing
                const range = document.createRange(); range.selectNodeContents(el); const t = range.getBoundingClientRect();
                if (t.right > boat.left + 4 && t.width > 0) issues.push(id.replace('hub-skipper-', '') + ' under boat');
            }
            const mo = document.getElementById('hub-skipper-motto');
            if (mo.scrollHeight > mo.clientHeight + 1) issues.push('motto cut off');
            if (issues.length) out.push(c.name + ': ' + issues.join(', '));
        }
        // the boat half: every spec, the polar legend, the boat name row
        for (const el of document.querySelectorAll('#hub-boat-specs dd, #hub-boat-specs dt, #hub-boat-polar-key, .ch-you-boathead')) {
            if (el.scrollWidth > el.clientWidth + 1) out.push('boat: "' + el.textContent.trim().slice(0, 30) + '" too wide');
        }
        const body = document.querySelector('.ch-you-body');
        if (body.scrollHeight > body.clientHeight + 1) out.push('boat: body taller than the card');
        return { n: AI_CONFIG.length, out };
    });
    console.log(`${W}x${H}: ${rows.out.length} of ${rows.n} characters overflow`); for (const l of rows.out) console.log('  ' + l);
    await b.close();
})();
