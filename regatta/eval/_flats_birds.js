// Probe: the painted Flats waders posed — the spoonbill feeding (its spoon swept), roosting and through a wingbeat; the
// avocet scything, upending and through a wingbeat — at game scale and at 4x, on flats water, a hull for size.
//   node regatta/eval/_flats_birds.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const OUT = process.argv[2] || 'flats_birds.png';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1450, height: 820 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1450; c.height = 820; const g = c.getContext('2d');
    g.fillStyle = '#6f8f8c'; g.fillRect(0, 0, 1400, 820); g.fillStyle = '#b9a57e'; g.fillRect(0, 600, 1400, 220);
    const bird = (o) => Object.assign({ x: 0, y: 0, h: 0, sw: 0, swR: 1, step: 0, z: 0, flap: 0, mode: 'wade', ring: 0, j: 0 }, o);
    const rows = [
      ['spoon', A.drawSpoonbill, [bird({ sw: 0 }), bird({ sw: 1.57 }), bird({ sw: -1.57 }), bird({ roost: true }), ...[0, 1, 2, 3, 4].map(f => bird({ mode: 'fly', flap: f * 1.26, z: 20 }))]],
      ['avo', A.drawAvocet, [bird({ sw: 0 }), bird({ sw: 1.57 }), bird({ sw: -1.57 }), bird({ swim: 1, upV: 1 }), ...[0, 1, 2, 3, 4].map(f => bird({ mode: 'fly', flap: f * 1.26, z: 20 }))]]];
    rows.forEach(([k, fn, list], r) => list.forEach((o, i) => {
      for (const [sc, y0] of [[4, 150 + r * 300], [1, 50 + r * 300]]) { g.setTransform(sc, 0, 0, sc, 70 + i * 145, y0 + (sc === 4 ? 40 : 0)); fn(g, Object.assign({}, o)); } }));
    // the seals: sandy cow, silver cow, banana both sides, bull, pup; head lifted; galumphing; wet; awash; in the water
    const seal = (o) => Object.assign({ x: 0, y: 0, h: 0, size: 0.9, pal: 4, pup: false, side: 0, mode: 'haul', bob: 0, lift: 0, wet: 0, i: 0, ring: 0, awashOv: 0, vis: 1, blend: 0, curl: 0, spots: [] }, o);
    const seals = [seal({}), seal({ pal: 2 }), seal({ side: 1, curl: 0.8 }), seal({ side: -1, curl: -0.8 }), seal({ pal: 0, size: 1.1 }), seal({ pup: true, pal: 5, size: 0.5 }),
      seal({ alert: 1, watch: 1.0 }), seal({ side: 1, curl: 0.8, alert: 1, watch: -1.0 }), seal({ wet: 1 }), seal({ awashOv: 0.15 })];   // (alert: head round to a boat on the right; a banana cow to one on the left)
    seals.forEach((o, i) => { for (const [sc, y0] of [[3, 700], [1, 640]]) { g.setTransform(sc, 0, 0, sc, 70 + i * 130, y0); A.drawGreySeal(g, o); } });
    g.setTransform(3, 0, 0, 3, 70 + 10 * 130, 700); A.drawGreySealSwim(g, seal({ mode: 'swim', vis: 0.3 }));
    // a hull at game scale for size (55 u)
    g.setTransform(1, 0, 0, 1, 1340, 60); g.fillStyle = '#eee'; g.fillRect(-6, -27, 12, 55);
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  await p.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1450, height: 820 } }); await b.close(); })();
