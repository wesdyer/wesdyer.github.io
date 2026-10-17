// Probe: a sheet of competitors' kites (pattern + colours) beside their hull colour, for review.
//   node regatta/eval/_kite_sheet.js <out.png> Name1 Name2 ...
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2], names = process.argv.slice(3);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForTimeout(1500);
  await p.evaluate((names) => {
    const cols = 6, cw = 190, ch = 230, c = document.createElement('canvas'); c.width = cols * cw; c.height = Math.ceil(names.length / cols) * ch;
    Object.assign(c.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999, background: '#2f5f7a' }); document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#2f5f7a'; g.fillRect(0, 0, c.width, c.height);
    names.forEach((n, i) => { const C = AI_CONFIG.find(q => q.name === n), x = (i % cols) * cw, y = Math.floor(i / cols) * ch, look = SPIN_LOOKS[n] || 'solid';
      const s = getSpinnakerSprite(look, C.spinnaker, C.spinnaker2, C.spinnaker3);
      if (s) { const k = Math.min(150 / s.width, 150 / s.height); g.drawImage(s, x + (cw - s.width * k) / 2, y + 8, s.width * k, s.height * k); }
      g.fillStyle = C.hull; g.fillRect(x + 35, y + 165, 120, 22);
      g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText(n + ' · ' + look, x + cw / 2, y + 210); });
    window.__h = c.height; }, names);
  const h = await p.evaluate(() => window.__h);
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1140, height: h } }); await b.close(); })();
