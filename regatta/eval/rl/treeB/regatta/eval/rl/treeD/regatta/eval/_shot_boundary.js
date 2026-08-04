// The sailing limit, seen from a corner of it and from above the whole course.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1200);
  const venue = process.argv[2] || 'seatrials';
  const info = await p.evaluate((v) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame();
    state.race.status = 'racing';
    for (const id of ['pre-race-overlay','results-overlay']) {
      const el = document.getElementById(id); if (el) el.classList.add('hidden');
    }
    const bd = state.course.boundary;
    return { poly: !!(bd.poly && bd.poly.length), n: bd.poly ? bd.poly.length : 0,
             r: Math.round(bd.radius) };
  }, venue);
  // Wherever the limit runs closest to land — the layering question.
  await p.evaluate(() => {
    const bd = state.course.boundary;
    let c = bd.poly ? bd.poly[0] : [bd.x + bd.radius, bd.y];
    const land = (state.course.landShapes || []).filter(l => l.vertices && l.vertices.length);
    if (bd.poly && land.length) {
      let best = Infinity;
      for (const pt of bd.poly) for (const l of land) for (const v of l.vertices) {
        const d = (v.x - pt[0]) ** 2 + (v.y - pt[1]) ** 2;
        if (d < best) { best = d; c = [(v.x + pt[0]) / 2, (v.y + pt[1]) / 2]; }
      }
    }
    state.camera.target = 'free';
    state.camera.x = c[0]; state.camera.y = c[1];
    state.camera.zoom = 1; state.camera.rotation = 0;
    draw();
  });
  await p.screenshot({ path: `regatta/eval/_bnd_close.png` });
  // The whole course.
  await p.evaluate(() => {
    const bd = state.course.boundary;
    state.camera.x = bd.x; state.camera.y = bd.y;
    state.camera.zoom = 0.09; state.camera.rotation = 0;
    draw();
  });
  await p.screenshot({ path: `regatta/eval/_bnd_wide.png` });
  console.log(venue, JSON.stringify(info), 'errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();
