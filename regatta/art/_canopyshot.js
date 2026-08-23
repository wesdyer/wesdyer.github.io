// Park the player under a crown that OVERHANGS WATER and shoot it, then park it under a
// crown that does not, so the two rules can be compared side by side.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const venue = process.argv[2] || 'lake';
const OUT = process.argv[3] || '/tmp/';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(1500);
  await p.evaluate(v => { settings.venue = v; resetGame(); startRace(); }, venue);
  await p.waitForTimeout(9000);
  await p.evaluate(() => {
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
  });

  // Find the biggest crown that overhangs water, and put the boat on the WATER side of it.
  const spots = await p.evaluate(() => {
    const reg = window.VenueDoc.PROP_KINDS, props = state.course.props;
    const w = pr => ((reg[pr.kind] || {}).world || 0) * (pr.scale || 1);
    const over = [], dry = [];
    for (const pr of props) {
      if (!/pine|birch|aspen|fir|alder/.test(pr.kind)) continue;
      (crownOverWater(pr, w(pr)) ? over : dry).push(pr);
    }
    const pick = a => a.sort((x, y) => w(y) - w(x))[0];
    const o = pick(over), d = pick(dry);
    // step from the crown toward open water until we are off land
    const toWater = (pr) => {
      const r = w(pr) * 0.5;
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2;
        const x = pr.x + r * 0.75 * Math.cos(a), y = pr.y + r * 0.75 * Math.sin(a);
        if (!pointOnLand(x, y)) return { x, y };
      }
      return { x: pr.x, y: pr.y };
    };
    return { over: toWater(o), overKind: o.kind, dry: { x: d.x, y: d.y }, dryKind: d.kind };
  });

  for (const [name, s] of [['overhang', spots.over], ['inland', spots.dry]]) {
    await p.evaluate(({ x, y }) => {
      const me = state.boats.find(b => b.isPlayer) || state.boats[0];
      me.x = x; me.y = y; me.speed = 0;
      state.camera.x = x; state.camera.y = y;
      for (const b of state.boats) if (b !== me) { b.x = 1e6; b.y = 1e6; }
    }, s);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(OUT, `${venue}-canopy-${name}.png`) });
    console.log(`${name}: (${s.x.toFixed(0)},${s.y.toFixed(0)})`);
  }
  console.log('over-water crown:', spots.overKind, '  inland crown:', spots.dryKind);
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
