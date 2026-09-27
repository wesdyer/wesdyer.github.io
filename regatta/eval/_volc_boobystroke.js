// Filmstrip: one blue-footed booby through a wingbeat (8 phases) and in a glide, x3, on the venue's water.
//   node regatta/eval/_volc_boobystroke.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const c = document.createElement('canvas'); c.width = 1500; c.height = 220; const g = c.getContext('2d'); g.fillStyle = '#1e3a5a'; g.fillRect(0, 0, 1500, 220);
    const oc = state.camera; state.camera = null;
    for (let i = 0; i < 9; i++) { const bd = { j: 0, x: 0, y: 0, h: Math.PI / 2, z: 50, flap: i / 8 * Math.PI * 2, mode: 'fly', gliding: i === 8, t: 0, dive: 0, splash: 0 }; if (i === 8) bd.flap = Math.asin(0.95);
      g.save(); g.translate(90 + i * 160, 100); g.scale(3, 3); Wildlife.art.drawBooby(g, bd); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(i < 8 ? 'phase ' + i + '/8' : 'glide', 60 + i * 160, 205); }
    state.camera = oc; return c.toDataURL(); });
  require('fs').writeFileSync(process.argv[2], Buffer.from(url.split(',')[1], 'base64')); await b.close(); })();
