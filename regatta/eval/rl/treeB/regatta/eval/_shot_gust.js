// Draw two gust sources on the open venue and shoot the Gusts layer.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1800);
  const info = await p.evaluate(() => {
    const A = window.EditorApp;
    A._setMode('gust');
    const d = A._state().doc;
    const bc = d.world.boundary.circle || { x: 0, y: 0, r: d.world.size * 0.3 };
    const h = bc.r * 0.30;
    // A hot rim source ...
    A._drawRing([[bc.x - bc.r*0.95, bc.y - h], [bc.x - bc.r*0.45, bc.y - h*1.4],
                 [bc.x - bc.r*0.45, bc.y + h*1.4], [bc.x - bc.r*0.95, bc.y + h]]);
    let r = d.gusts.regions[0];
    r.density = 3; r.strength = 2.2; r.bias = 0.95; r.name = 'Rim bombs';
    // ... and a soft hole downcourse.
    A._drawRing([[bc.x + bc.r*0.15, bc.y - h*0.7], [bc.x + bc.r*0.8, bc.y - h*0.7],
                 [bc.x + bc.r*0.8, bc.y + h*0.7], [bc.x + bc.r*0.15, bc.y + h*0.7]]);
    r = d.gusts.regions[1];
    r.density = 1; r.bias = 0.05; r.life = 0.6; r.name = 'Dead patch';
    A._setOsel([{ kind: 'gust', i: 0 }]);
    A.fitView(); A.draw();
    return { venue: d.venue, regions: d.gusts.regions.length };
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'regatta/eval/_ed_gusts.png' });
  console.log(JSON.stringify(info), 'errors:', errs.length ? errs.slice(0,3) : 'none');
  await b.close();
})();
