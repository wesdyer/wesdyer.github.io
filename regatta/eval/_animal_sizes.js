// Drawn size of every venue animal at game scale: the solid-pixel (alpha > 150) bounding
// box of each Wildlife.art draw function, so shadows, rings and wakes are left out (the ray at
// alpha > 40, so its thin whip tail counts: the eye reads it tip to tail). The
// numbers guidelines/scale.md checks against (true size x 3, floor 20 units).
//   node regatta/eval/_animal_sizes.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.Wildlife && Wildlife.art);
  const r = await p.evaluate(() => {
    const A = Wildlife.art;
    const mk = (o) => Object.assign({ x: 0, y: 0, h: 0, sink: 0, flap: 0, yaw: 0, trail: [], bob: 0, stick: false, splash: 0, slap: 0, rise: 0, swim: 0 }, o);
    const items = {
      'gull (flying, span)': g => A.drawGullFlying(g, 0, 0, Math.PI / 2, 0, 0),
      'gull (perched)': g => A.drawGullPerched(g, 0, 0, 0),
      'pelican (flying, span)': g => A.drawPelicanFlying(g, 0, 0, Math.PI / 2, 0, 0, false),
      'pelican (sitting)': g => A.drawPelicanSitting(g, 0, 0, 0, 0),
      'porpoise': g => A.drawPorpoise(g, { phase: 0.5, sx: 0, sy: 0, sh: 0 }),
      'turtle': g => A.drawTurtle(g, 0, 0, 0, 1, 0),
      'grebe': g => A.drawGrebe(g, mk({})),
      'loon': g => A.drawLoon(g, mk({})),
      'beaver': g => A.drawBeaver(g, mk({})),
      'moose': g => A.drawMoose(g, { x: 0, y: 0, h: 0, alpha: 1, dip: 0, drip: 0, bob: 0, sway: 0, mode: 'alert', ashore: true }),
      'duckling': g => A.drawDuckling(g, mk({}), 0, 0),
      'green sea turtle': g => A.drawCruiser(g, { kind: 'seaturtle', x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: 'cruise' }),
      'eagle ray (span wide × snout-to-tail-tip long)': g => A.drawCruiser(g, { kind: 'eagleray', x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: 'cruise' }),
      'reef shark': g => A.drawCruiser(g, { kind: 'reefshark', x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: 'cruise' }),
      'alligator (nose to tail tip)': g => A.drawGator(g, { x: 0, y: 0, h: 0, mode: 'float', sink: 0, bob: 0, i: 0 }),
      'egret standing': g => A.drawEgret(g, { x: 0, y: 0, h: 0, mode: 'stand', bob: 0, neck: 0 }),
      'egret flying (span)': g => A.drawEgret(g, { x: 0, y: 0, h: Math.PI / 2, mode: 'fly', flap: 0, z: 0 }),
      'anhinga drying (span)': g => A.drawAnhinga(g, { px: 0, py: 0, x: 0, y: 0, ph: 0, mode: 'dry', flap: 0, t: 0, sink: 0, splash: 0 }),
      'brown bear (nose to rump)': g => A.drawBear(g, { i: 0, x: 0, y: 0, h: 0, up: 0, mode: 'watch', rear: 0, lunge: 0, look: 0, splash: 0, fish: 0 }),
      'sockeye': g => A.drawSockeye(g, 0, 0, 0, 1, 0, 0),
      'bald eagle (span)': g => A.drawEagle(g, { i: 0, x: 0, y: 0, h: Math.PI / 2, z: 0, mode: 'soar', flap: 0, fish: 0, splash: 0 }),
      'river otter (with tail)': g => A.drawOtter(g, { i: 0, x: 0, y: 0, h: 0, rh: 0, size: 1, dip: 0, ring: 0, trail: [], trailT: 0, curl: 0 }, true),
    };
    const out = {};
    for (const [k, fn] of Object.entries(items)) {
      const c = document.createElement('canvas'); c.width = c.height = 400; const g = c.getContext('2d');
      g.translate(200, 200); try { fn(g); } catch (e) { out[k] = 'err ' + e.message; continue; }
      const d = g.getImageData(0, 0, 400, 400).data; let x0 = 400, x1 = -1, y0 = 400, y1 = -1;
      for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > (/ray|alligator/.test(k) ? 40 : 150)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      out[k] = x1 < 0 ? 'empty' : `${x1 - x0 + 1} wide × ${y1 - y0 + 1} long`;
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
