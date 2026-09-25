// Probe: does the race board's briefing fit at every window size? Opens the pre-race board on a
// venue with a best time (no stars — the widest record line) and a character earned (the
// widest objectives strip), at a spread of viewports, and reports anything in the record block
// or the objectives strip that spills out of its own box, or out of the briefing panel.
// Screenshots of the briefing go to $SHOTS (default /tmp/preview_fit).
//   node regatta/eval/_preview_fit.js [venue]      (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SIZES = [[1920, 1080], [1680, 1050], [1440, 900], [1366, 768], [1280, 720], [1180, 820], [1024, 768], [1920, 1200], [2560, 1440], [1100, 640]];
(async () => {
    const venue = process.argv[2] || 'swamp';
    const shots = process.env.SHOTS || '/tmp/preview_fit';
    fs.mkdirSync(shots, { recursive: true });
    const b = await chromium.launch();
    let bad = 0;
    for (const [w, h] of SIZES) {
        const p = await b.newPage({ viewport: { width: w, height: h } });
        await p.goto('file://' + path.resolve('regatta/index.html'));
        await p.waitForFunction(() => window.state && typeof setupPreRaceOverlay === 'function');
        const r = await p.evaluate(async (venue) => {
            window.__UNLOCKS = 'on';
            settings.venue = venue;
            window.bestForVenue = () => ({ t: 200.367, bestPos: 1, bestPosT: 200, stars: 0 });
            const earned = Unlocks.isEarned.bind(Unlocks);
            const first = Unlocks.forVenue(venue)[0];
            Unlocks.isEarned = (c) => c === (first && first.char) || earned(c);
            setupPreRaceOverlay();
            await new Promise(r => setTimeout(r, 400));
            const panel = document.getElementById('venue-detail').getBoundingClientRect();
            const spill = [];
            for (const sel of ['.pr-record', '.pr-objectives']) {
                const box = document.querySelector('#venue-detail ' + sel);
                if (!box) continue;
                const bb = box.getBoundingClientRect();
                if (bb.right > panel.right + 1) spill.push(`${sel} ${Math.round(bb.right - panel.right)}px past the panel`);
                for (const el of box.querySelectorAll('*')) {
                    const e = el.getBoundingClientRect();
                    if (!e.width || !e.height) continue;
                    if (e.right > bb.right + 1 || e.left < bb.left - 1) spill.push(`${sel} > ${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || '').trim().slice(0, 18)}" ${Math.round(e.right - bb.right)}px out`);
                }
                // anything drawn on top of anything else inside the strip (a link over a face)
                const kids = [...box.querySelectorAll(':scope > *, :scope > span > *')].map(el => el.getBoundingClientRect()).filter(e => e.width && e.height);
                for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
                    const a = kids[i], c = kids[j];
                    const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
                    if (ox > 2 && oy > 2 && !(a.left <= c.left && a.right >= c.right && a.top <= c.top && a.bottom >= c.bottom) && !(c.left <= a.left && c.right >= a.right && c.top <= a.top && c.bottom >= a.bottom)) spill.push(`${sel} overlap ${Math.round(ox)}x${Math.round(oy)}px`);
                }
            }
            // Vertically: every fact row must sit inside the panel (it does not scroll).
            const rows = [...document.querySelectorAll('#venue-detail .pr-row')];
            const last = rows.length ? rows[rows.length - 1].getBoundingClientRect() : null;
            if (last && last.bottom > panel.bottom + 1) spill.push(`facts cut: last row ${Math.round(last.bottom - panel.bottom)}px below the panel`);
            const rec = document.querySelector('#venue-detail .pr-record'), obj = document.querySelector('#venue-detail .pr-objectives');
            if (rec && obj && rec.getBoundingClientRect().bottom > obj.getBoundingClientRect().top + 1) spill.push('record overlaps objectives');
            if (obj && rows.length && obj.getBoundingClientRect().bottom > rows[0].getBoundingClientRect().top + 1) spill.push('objectives overlap the facts');
            return { panelW: Math.round(panel.width), panelH: Math.round(panel.height), spill: [...new Set(spill)].slice(0, 6) };
        }, venue);
        const el = await p.$('#venue-detail');
        if (el) await el.screenshot({ path: path.join(shots, `${w}x${h}.png`) });
        console.log(`${w}x${h}  panel ${r.panelW}x${r.panelH}  ${r.spill.length ? 'SPILL: ' + r.spill.join(' | ') : 'fits'}`);
        if (r.spill.length) bad++;
        await p.close();
    }
    await b.close();
    console.log(bad ? `\n${bad} size(s) spill` : '\nfits at every size');
})();
