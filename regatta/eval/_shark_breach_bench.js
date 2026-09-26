// Bench: the great white's breach in stages (z rising and falling, the roll, the jaws), large, on the
// venue's water — for comparing with breach references.
//   node regatta/eval/_shark_breach_bench.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/shark_breach.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 420; const ctx = c.getContext('2d');
    const doc = state.course.doc; ctx.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a'; ctx.fillRect(0, 0, 1500, 420);
    const oc = state.camera; state.camera = null;
    const st = [[0.15, 0.2, 1], [0.4, 0.5, 1], [0.65, 0.8, 1], [0.9, 1, 1], [1, 1, 0.6], [0.7, 1, 0.1], [0.35, 1, 0]];
    st.forEach(([z, roll, jaw], i) => { const W = { i: 0, x: 0, y: 0, h: 0, depth: 0, mode: 'breach', ph: 1, trail: [], trailT: 0, z, roll, jaw, slick: 0, turn: 0, bx: 0, by: 0 };
      ctx.save(); ctx.translate(110 + i * 210, 200); A.drawWhiteShark(ctx, W, 'air'); ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText('z ' + z + ' jaw ' + jaw, 70 + i * 210, 400); });
    state.camera = oc; return c.toDataURL(); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await b.close(); })();
