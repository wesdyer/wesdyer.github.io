// The skipper band's colour roles, audited for every character (APCA |Lc|):
// text (target 75, floor 60), name (floor 40), stripe vs band and body (30), Change label at rest and on hover.
//   node regatta/eval/rl/_hub_colour_audit.js [Name,Name,...]
const { chromium } = require('playwright'); const path = require('path');
const SHOW = (process.argv[2] || 'Muninn,Bruce,Cheer,Gasket,Finley,Glide,Chomp,Pebble').split(',');
(async () => {
    const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(2000);
    const r = await p.evaluate((SHOW) => {
        const hex = c => { const m = c.match(/[\d.]+/g).map(Number); return '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); };
        const Y = (c) => { const h = c.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.4)); return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b; };
        const apca = (t, bg) => { const k = y => (y > 0.022 ? y : y + Math.pow(0.022 - y, 1.414)); const yt = k(Y(t)), yb = k(Y(bg)); const s = yb > yt ? (Math.pow(yb, 0.56) - Math.pow(yt, 0.57)) * 1.14 : (Math.pow(yb, 0.65) - Math.pow(yt, 0.62)) * 1.14; return Math.abs(s) < 0.1 ? 0 : Math.abs(s) * 100 - 2.7; };
        const bandAt = () => hex(document.getElementById('hub-skipper-band').style.background.match(/rgb\([^)]*\)/g)[1]);
        const stats = { text75: 0, text60to75: 0, nameSrc: {}, minText: 999, minName: 999, minStripe: 999, minHoverLabel: 999, minRestLabel: 999 };
        const rows = [];
        for (const c of AI_CONFIG) {
            fillSkipperCard(c);
            const bg = bandAt(), g = id => getComputedStyle(document.getElementById(id));
            const text = hex(g('hub-skipper-motto').color), name = hex(g('hub-skipper-name').color), stripe = hex(g('hub-skipper-stripe').backgroundColor);
            const left = hex(document.getElementById('hub-skipper-band').style.background.match(/rgb\([^)]*\)/g)[0]);
            const chg = document.getElementById('hub-skipper'), v = n => chg.style.getPropertyValue(n).trim();
            const tLc = apca(text, bg), nLc = apca(name, bg), sLc = Math.min(apca(stripe, left), apca(stripe, '#101a2e')), hLc = apca(v('--chg-hover-ink'), v('--chg-hover'));
            tLc >= 75 ? stats.text75++ : stats.text60to75++;
            const src = name === c.spinnaker.toLowerCase() ? 'kite' : [c.spinnaker2, c.spinnaker3].some(x => x && x.toLowerCase() === name) ? 'other kite' : name === c.hull.toLowerCase() ? 'hull' : name === '#ffffff' ? 'white' : 'black';
            stats.nameSrc[src] = (stats.nameSrc[src] || 0) + 1;
            stats.minText = Math.min(stats.minText, tLc); stats.minName = Math.min(stats.minName, nLc); stats.minStripe = Math.min(stats.minStripe, sLc); stats.minHoverLabel = Math.min(stats.minHoverLabel, hLc);
            if (SHOW.includes(c.name)) rows.push({ name: c.name, base: bandColorFor(c.hull, c.spinnaker), band: bg, text: `${text} Lc ${tLc.toFixed(0)}`, nameCol: `${name} (${src}) Lc ${nLc.toFixed(0)}`, stripe: `${stripe} Lc ${sLc.toFixed(0)}`, hover: `${v('--chg-hover')} / ${v('--chg-hover-ink')} Lc ${hLc.toFixed(0)}` });
        }
        for (const k of ['minText', 'minName', 'minStripe', 'minHoverLabel']) stats[k] = +stats[k].toFixed(0);
        return { stats, rows };
    }, SHOW);
    console.log(JSON.stringify(r.stats)); console.table(r.rows);
    await b.close();
})();
