const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 260 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 260; const g = c.getContext('2d'); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 1600, 260);
    const oc = state.camera; state.camera = null; const A = Wildlife.art;
    // tip-over at f = 0, .15, .3, .45, .6, .75, .9; fall at .2, .5, .8, .95
    const fr = [['fold', 0.0], ['fold', 0.12], ['fold', 0.25], ['fold', 0.38], ['fold', 0.5], ['fold', 0.65], ['fold', 0.8], ['fold', 0.95], ['dive', 0.2], ['dive', 0.5], ['dive', 0.8], ['dive', 0.95]];
    fr.forEach(([m, v], i) => { const bd = { j: 0, x: 0, y: 0, h: 0, z: m === 'fold' ? 55 : 55 * (1 - v * v), mode: m, t: m === 'fold' ? 1 - v : 0, dive: m === 'dive' ? v : 0, flap: v / 0.6 * Math.PI * 2 * 2 * 0.6 + 1.57, splash: 0 };
      g.save(); g.translate(70 + i * 130, 110); g.scale(3, 3); A.drawBooby(g, bd); g.restore(); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(m === 'fold' ? 'tip ' + v : 'fall ' + v, 40 + i * 130, 240); });
    state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  await p.screenshot({ path: process.argv[2], clip: { x: 0, y: 0, width: 1600, height: 260 } }); await b.close(); })();
