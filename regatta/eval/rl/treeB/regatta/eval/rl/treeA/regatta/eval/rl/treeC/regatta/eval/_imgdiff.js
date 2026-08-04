const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const enc = (f) => 'data:image/png;base64,' + fs.readFileSync('regatta/eval/' + f).toString('base64');
  const r = await p.evaluate(async ([a, bb]) => {
    const load = (src) => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(bb)]);
    const c1 = document.createElement('canvas'); c1.width = ia.width; c1.height = ia.height;
    const c2 = document.createElement('canvas'); c2.width = ib.width; c2.height = ib.height;
    c1.getContext('2d').drawImage(ia, 0, 0); c2.getContext('2d').drawImage(ib, 0, 0);
    const d1 = c1.getContext('2d').getImageData(0,0,ia.width,ia.height).data;
    const d2 = c2.getContext('2d').getImageData(0,0,ib.width,ib.height).data;
    let n = 0, max = 0, sum = 0;
    for (let i = 0; i < d1.length; i += 4) {
      const dr = Math.abs(d1[i]-d2[i]), dg = Math.abs(d1[i+1]-d2[i+1]), db = Math.abs(d1[i+2]-d2[i+2]);
      const m = Math.max(dr, dg, db);
      if (m) { n++; sum += m; }
      if (m > max) max = m;
    }
    return { w: ia.width, h: ia.height, n, max, mean: n ? sum / n : 0 };
  }, [enc(process.argv[2] || '_water_smooth_rs50.png'), enc(process.argv[3] || '_water_nearest_rs50.png')]);
  console.log(`${r.w}x${r.h}  differing px: ${r.n} (${(100*r.n/(r.w*r.h)).toFixed(1)}%)  max delta: ${r.max}  mean delta where differing: ${r.mean.toFixed(1)}`);
  await b.close();
})();
