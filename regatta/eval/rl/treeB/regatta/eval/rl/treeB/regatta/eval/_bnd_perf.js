// drawBoundary costs ~0.08 ms when the limit is off screen and 7+ ms when it is on.
// This asks which part of the visible case is spending it.
const { chromium } = require('playwright');
const path = require('path');
const SECS = 3;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' }));
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace();
    for (let i = 0; i < 1800; i++) update(1/60);
    state.paused = true;
  });
  const timeIt = (body) => p.evaluate(([src, secs]) => {
    const f = new Function(src);
    for (let i = 0; i < 10; i++) f();
    let n = 0; const t0 = performance.now();
    while (performance.now() - t0 < secs * 1000) { f(); n++; }
    return (performance.now() - t0) / n;
  }, [body, SECS]);

  const at = async (where) => {
    await p.evaluate((w) => {
      const bd = state.course.boundary;
      state.camera.target = 'free';
      if (w === 'on')  { state.camera.x = bd.poly[0][0]; state.camera.y = bd.poly[0][1]; }
      else             { state.camera.x = bd.x; state.camera.y = bd.y; }
      state.camera.rotation = 0;
    }, where);
  };
  const C = 'const c = document.getElementById("gameCanvas").getContext("2d");'
          + 'c.setTransform(1,0,0,1,0,0); c.translate(750,475); c.rotate(-state.camera.rotation);'
          + 'c.translate(-state.camera.x, -state.camera.y);';

  for (const where of ['off', 'on']) {
    await at(where);
    const full = await timeIt(`${C} drawBoundary(c);`);
    console.log(`\nlimit ${where === 'on' ? 'ON screen' : 'off screen'}:`);
    console.log(`  drawBoundary               ${full.toFixed(2).padStart(7)} ms`);
    if (where === 'on') {
      const noShadow = await timeIt(`${C} const rb=c.__rb||(c.__rb=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'shadowBlur'));
        Object.defineProperty(c,'shadowBlur',{configurable:true,set(){},get(){return 0;}}); drawBoundary(c); delete c.shadowBlur;`);
      console.log(`  ...with shadowBlur forced 0${noShadow.toFixed(2).padStart(6)} ms   (glow costs ${(full-noShadow).toFixed(2)})`);
      const noText = await timeIt(`${C} const ft=c.fillText.bind(c); c.fillText=()=>{}; const di=c.drawImage.bind(c); c.drawImage=()=>{}; drawBoundary(c); c.fillText=ft; c.drawImage=di;`);
      console.log(`  ...with lettering removed  ${noText.toFixed(2).padStart(7)} ms   (type costs ${(full-noText).toFixed(2)})`);
    }
  }
  await b.close();
})();
