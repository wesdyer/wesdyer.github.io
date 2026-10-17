// Probe: the painted penguins' poses at 5x — standing with the waddle's flipper sway, tobogganing (flippers pushing),
// swimming (the flipper stroke through a cycle). Writes a PNG.   node regatta/eval/_penguin_strokes.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const A = Wildlife.art, cam = state.camera; state.camera = null;
    const g0 = document.createElement('canvas').getContext('2d');
    for (const sp of ['emperor', 'adelie', 'macaroni']) { A.drawSwimmers(g0, { species: sp, x: 0, y: 0, h: 0, t: 1, birds: [{ ox: 0, oy: 0, ph: 0, per: 99 }] }); A.drawTreks(g0, []); }
    for (const sp of ['emperor', 'adelie', 'macaroni']) for (const v of ['', '-prone']) for (const pt of ['body', 'fore-l', 'fore-r']) A.arcticImg('penguin-' + sp + v + '-' + pt);
    await new Promise(r => setTimeout(r, 1200));
    const c = document.createElement('canvas'); c.width = 1200; c.height = 700; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#eef4fa'; g.fillRect(0, 0, 1200, 250); g.fillStyle = '#1f4466'; g.fillRect(0, 250, 1200, 450);
    g.fillStyle = '#000'; g.font = '13px sans-serif'; g.fillText('standing, the waddle (step 0, 1/4, 1/2, 3/4)', 10, 18);
    ['emperor', 'adelie', 'macaroni'].forEach((sp, i) => [0, 1.57, 3.14, 4.71].forEach((st, j) => {
      g.save(); g.translate(70 + i * 400 + j * 85, 130); g.scale(4, 4); A.drawTreks(g, [{ species: sp, slide: false, dir: 'in', pts: [{ x: 0, y: 10 }, { x: 0, y: -10 }], birds: [{ delay: 0, s: 10, step: st / (A.PENG()[sp].rock * 0.5) }] }]); g.restore(); }));
    g.fillStyle = '#fff'; g.fillText('swimming, one stroke (prone sprite, flippers flying)', 10, 270);
    ['emperor', 'adelie', 'macaroni'].forEach((sp, i) => [0, 0.25, 0.5, 0.75].forEach((q, j) => {
      const P = A.PENG()[sp], L = sp === 'emperor' ? 30 : sp === 'adelie' ? 20 : 21, fq = P.swim / (1.15 * L);
      g.save(); g.translate(70 + i * 400 + j * 85, 470); g.scale(4, 4); A.drawSwimmers(g, { species: sp, x: 0, y: 0, h: 0, t: q / fq, birds: [{ ox: 0, oy: 0, ph: 0, per: 999 }] }); g.restore(); }));
    state.camera = cam;
  });
  await p.screenshot({ path: out }); await b.close();
})();
