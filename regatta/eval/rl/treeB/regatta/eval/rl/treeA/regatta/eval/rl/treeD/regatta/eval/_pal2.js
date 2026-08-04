// Is the preview's texture as dense as the GAME's? Same metric on both — water plus the wind
// ripple layer, which is most of what the water looks like — so "it looks flat" becomes a
// number instead of an argument.
const { chromium } = require('playwright');
const path = require('path');
const rough = `(function (c) {
  const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data;
  let r = 0, n = 0; const W = c.width;
  for (let y = 0; y < c.height; y += 2) for (let px = 0; px + 3 < W; px += 3) {
    const a = (y * W + px) * 4, b = (y * W + px + 3) * 4;
    r += Math.abs(d[a] - d[b]) + Math.abs(d[a+1] - d[b+1]) + Math.abs(d[a+2] - d[b+2]); n++;
  }
  return +(r / Math.max(1, n)).toFixed(2);
})`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1600);
  // Let the preview tick a few times.
  await p.evaluate(() => document.querySelector('#layer-list [data-layer="water"]').click());
  await p.waitForTimeout(700);
  const r = await p.evaluate((src) => {
    const roughness = eval(src);
    const fake = { wind: { direction: state.wind.direction },
                   camera: { x: 0, y: -900, rotation: 0, zoom: 1 } };
    const frame = (w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      window.WaterRenderer.draw(x, fake);
      const cam = state.camera; state.camera = fake.camera;
      window.updateWindWaves(0.12);
      x.save(); x.translate(w / 2, h / 2); x.translate(-fake.camera.x, -fake.camera.y);
      window.drawWindWaves(x); x.restore();
      state.camera = cam;
      return c;
    };
    const panel = document.getElementById('pal-preview');
    return { gameFull: roughness(frame(1280, 720)),          // what a player sees
             panel: roughness(panel),                        // what the panel shows
             waves: state.waveStates.size,
             windAtCam: getWindAt(0, -900).speed.toFixed(2) };
  }, rough);
  console.log(JSON.stringify(r));
  console.log('errs:', errs.slice(0, 2));
  await b.close();
})();
