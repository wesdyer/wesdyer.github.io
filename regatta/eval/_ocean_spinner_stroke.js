// Probe: the painted spinner's STROKE close up — eight frames through one beat (the flukes swinging from flat to
// nearly edge-on, the tail stock flexing with them), then a leap at three heights; on the venue's water.
//   node regatta/eval/_ocean_spinner_stroke.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1650, height: 330 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1650; c.height = 330; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#1e5fa6'; g.fillRect(0, 0, 1650, 330); state.camera = { x: 0, y: 0, rotation: 0 };
    const rate = 14, step = Math.PI / rate / 4;   // a quarter of a half-beat per frame: two full swings over eight
    for (let f = 0; f < 8; f++) { A.setT(f * step); g.save(); g.translate(75 + f * 150, 160); g.scale(4, 4); A.drawSpinner(g, { live: true, i: 0, x: 0, y: 0, h: 0, spin: 0, breath: 0, spd: 120 }); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('stroke ' + f + '/8', 40 + f * 150, 320); }
    [0.2, 0.5, 0.8].forEach((j, i) => { g.save(); g.translate(1275 + i * 130, 160); g.scale(3, 3); A.drawSpinner(g, { live: true, i: 0, x: 0, y: 0, h: 0, spin: 0, breath: 0, jump: j }); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('leap ' + j, 1250 + i * 130, 320); }); });
  await p.screenshot({ path: process.argv[2] }); await b.close(); console.log('ok'); })();
