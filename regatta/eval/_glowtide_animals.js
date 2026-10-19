// Probe: Glowtide's animals over N minutes — frames on land (swimming hawksbills, mantas, dugongs), what each does
// (manta modes and feeding styles, hawksbill feeding share), the flying foxes' real speed, and the cost of drawing them.
//   node regatta/eval/_glowtide_animals.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide' })); resetGame(); });
  await p.evaluate(() => { const D = Wildlife.debug(), A = Wildlife.art, g = document.createElement('canvas').getContext('2d');   // (start the paintings loading)
    A.drawManta(g, D.mantas[0]); A.drawHawksbill(g, D.hawksbills[0]); A.drawDugong(g, D.dugongs[0]); A.drawFlyingFox(g, D.foxFlocks[0].bats[0]); });
  await p.waitForTimeout(2000);
  console.log(await p.evaluate((MIN) => { for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const D = Wildlife.debug(), dry = { haw: 0, manta: 0, dug: 0 }, mm = {}, hf = [0, 0]; let fv = 0, fn = 0, frames = 0;
    for (let i = 0; i < 30 * 60 * MIN; i++) { Wildlife.update(1 / 30); frames++;
      for (const H of D.hawksbills) if (H.mode === 'swim') { if (pointOnLand(H.x, H.y)) { dry.haw++; if (!dry.where) dry.where = [i, H.i, Math.round(H.x), Math.round(H.y), H.feed > 0 ? 'feeding' : 'moving', Math.round(H.tx), Math.round(H.ty)]; } hf[H.feed > 0 ? 0 : 1]++; }
      for (const M of D.mantas) { if (pointOnLand(M.x, M.y)) dry.manta++; const k = M.mode + (M.mode === 'feed' ? ':' + M.style : ''); mm[k] = (mm[k] || 0) + 1; }
      for (const G of D.dugongs) if (pointOnLand(G.x, G.y)) dry.dug++;
      if (i % 30 === 0) for (const F of D.foxFlocks) for (const bb of F.bats) { if (bb.px !== undefined) { fv += Math.hypot(bb.x - bb.px, bb.y - bb.py); fn++; } bb.px = bb.x; bb.py = bb.y; } }
    // draw cost: the camera on each animal kind
    const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g = c.getContext('2d'), A = Wildlife.art, cost = {};
    for (const [k, list, fn2] of [['manta', D.mantas, A.drawManta], ['hawk', D.hawksbills, A.drawHawksbill], ['dugong', D.dugongs, A.drawDugong], ['fox', D.foxFlocks.flatMap(F => F.bats), A.drawFlyingFox]]) {
      const t0 = performance.now(); for (let r = 0; r < 30; r++) for (const a of list) { state.camera.x = a.x; state.camera.y = a.y; g.setTransform(1, 0, 0, 1, 450 - a.x, 300 - a.y); fn2(g, a); } cost[k] = ((performance.now() - t0) / 30 / list.length).toFixed(2) + ' ms each';
    }
    const tot = Object.values(mm).reduce((a, c2) => a + c2, 0);
    return `${MIN} min. dry frames ${JSON.stringify(dry)}\nmanta time: ${Object.entries(mm).map(([k, v]) => k + ' ' + Math.round(100 * v / tot) + '%').join(', ')}\nhawksbill swim time feeding ${Math.round(100 * hf[0] / (hf[0] + hf[1]))}%\nflying fox mean speed ${(fv / fn).toFixed(0)} u/s (${(fv / fn / 15).toFixed(1)} kn)\ndraw ${JSON.stringify(cost)}`; }, MIN));
  await b.close(); })();
