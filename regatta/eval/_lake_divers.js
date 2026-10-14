// Probe: the painted loon and beaver GOING UNDER (sink 0.15 -> 0.9: the water closing over them head first, the waterline
// sliding back), the water they leave (the swirl, the slick, the rings, bubbles: diveWater at 0.3 / 1 / 2 s, through the
// game's own diver draw), and COMING UP (upT 0.1 / 0.5); plus the loon's wings-spread rear-up. 3x on the lake's water.
//   node regatta/eval/_lake_divers.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 560 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake' })); resetGame(); });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 560; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'), doc = state.course.doc; g.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a5a7a'; g.fillRect(0, 0, 1500, 560); state.camera = { x: 0, y: 0, rotation: 0 }; A.setT(1);
    const d = Wildlife.debug().divers, loonG = d.find(G => G.cfg.kind === 'loon'), bvG = d.find(G => G.cfg.kind === 'beaver');
    const row = (draw, G, y, name) => {
      const cells = [['swimming', { sink: 0 }], ['going under .15', { sink: 0.15 }], ['.4', { sink: 0.4 }], ['.65', { sink: 0.65 }], ['.9', { sink: 0.9 }],
        ['gone: .3 s', { mode: 'under', dvT: 0.3 }], ['1 s', { mode: 'under', dvT: 1 }], ['2 s', { mode: 'under', dvT: 2 }], ['coming up', { upT: 0.1 }], ['up .5 s', { upT: 0.5 }]];
      cells.forEach(([lab, o], i) => { const x = 75 + i * 145; g.save(); g.translate(x, y); g.scale(3, 3);
        const m = Object.assign({ x: 0, y: 0, h: 0, sink: 0, flap: 0, mode: 'swim', bob: 0, dvT: 99, upT: 99 }, o);
        if (m.mode === 'under') { m.dvX = 0; m.dvY = 0; m.dvH = 0; }
        // the diver loop's own drawing: the water left behind, then the animal if it is not under
        const saved = G.birds; G.birds = [m]; m.dvX = m.dvX ?? null;
        if (m.mode !== 'under') draw(g, m);
        if (m.dvX != null) A.drawDiveWaterProbe(g, m, G.cfg.kind);
        G.birds = saved; g.restore();
        g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(lab, x - 35, y + 100); });
      g.fillText(name, 8, y - 100); };
    row(A.drawLoon, loonG, 150, 'COMMON LOON'); row(A.drawBeaver, bvG, 420, 'BEAVER'); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();
