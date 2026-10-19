// Bench: Glacier Sound's or Glowtide's animals in a row beside the hull, at race scale (x1.2) and x3 — sizes against the
// boat after the Oct 18 2026 "1.5x or less" resize.
//   node regatta/eval/_glac_glow_lineup.js arctic out.png      (or glowtide)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const venue = process.argv[2] || 'arctic', out = process.argv[3]; const W = 1760, H = 600;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); selectVenue(v); resetGame(); }, venue);
  await p.waitForTimeout(2500);
  const draw = (args) => { const [venue, W, H, show] = args; const A = Wildlife.art, oc = state.camera; state.camera = null; A.setT(10);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, W, H); g.fillStyle = venue === 'arctic' ? '#cfd8df' : '#c9b48a'; g.fillRect(0, 0, W, 70); g.fillRect(0, 300, W, 90);
    const hull = (s) => { g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 1 / s; g.beginPath(); g.moveTo(0, -27.5); g.quadraticCurveTo(10, -10, 8, 27.5); g.lineTo(-8, 27.5); g.quadraticCurveTo(-10, -10, 0, -27.5); g.fill(); g.stroke(); };
    const swim = (sp) => () => A.drawSwimmers(g, { species: sp, x: 0, y: 0, h: 0, t: 0, birds: [{ ox: 0, oy: 0, ph: 0, leap: -1, sur: 0.5 }] });
    const stand = (sp) => () => A.drawTreks(g, [{ species: sp, dir: 'out', pts: [{ x: 0, y: 0 }, { x: 0, y: -1 }], birds: [{ delay: 1, s: 0 }] }]);
    const row = venue === 'arctic' ? [['hull', () => hull(1)], ['orca cow', () => A.drawOrca(g, { kind: 'orca-b', x: 0, y: 0, h: 0, z: 0, up: -1, beat: 0, turn: 0, trail: [], j: 0 })],
        ['leopard seal', () => A.drawLeopardSeal(g, { mode: 'swim', x: 0, y: 0, h: 0, sw: 0, up: 1, ring: 0, plop: 0 })],
        ['emperor', () => { swim('emperor')(); g.translate(18, 0); stand('emperor')(); }], ['gentoo', () => { swim('gentoo')(); g.translate(14, 0); stand('gentoo')(); }],
        ['macaroni', () => { swim('macaroni')(); g.translate(13, 0); stand('macaroni')(); }], ['adelie', () => { swim('adelie')(); g.translate(13, 0); stand('adelie')(); }],
        ['tern flying', () => A.drawTern(g, { x: 0, y: 0, h: 0, z: 0, mode: 'shift', flap: Math.PI / 2, splash: 0 })], ['tern roost', () => A.drawTern(g, { x: 0, y: 0, h: 0, z: 0, mode: 'roost', flap: 0, splash: 0 })]]
      : [['hull', () => hull(1)], ['manta', () => A.drawManta(g, { x: 0, y: 0, h: 0, mode: 'travel', glide: 1, beat: 0, pitch: 0, bank: 0, i: 0, sparks: [], surfTip: 0, ceph: 0 })],
        ['dugong + calf', () => A.drawDugong(g, { x: -8, y: 0, h: 0, len: 41.3, beat: Math.PI / 2, up: 1, trail: [], silt: 0, ring: 0, calf: { x: 14, y: 12, h: 0, len: 23.8, beat: 0, up: 1 } })],
        ['hawksbill', () => A.drawHawksbill(g, { x: 0, y: 0, h: 0, mode: 'swim', beat: 0, up: 1, i: 0, ring: 0, puff: 0, sand: [], tracks: [] })],
        ['hawksbill (sand)', () => A.drawHawksbill(g, { x: 0, y: 0, h: 0, mode: 'crawlup', beat: 0, i: 0, sand: [], tracks: [[{ x: 0, y: 8, h: 0, side: 1 }, { x: 0, y: 11, h: 0, side: -1 }, { x: 0, y: 14, h: 0, side: 1 }]] })],
        ['flying fox', () => A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: 0, glideT: 1, bank: 0 })],
        ['golden jellies', () => { for (const [x, y, s, z] of [[-10, -8, 1.25, 0.3], [6, -4, 1, 1], [-2, 8, 0.8, 2], [10, 9, 0.6, 0.5]]) A.drawGoldJelly(g, { x, y, h: 0, size: s, depth: z / 7, z, pitch: 1.4, sq: 0, ph: 0, spots: x + 9 }); }]];
    if (venue !== 'arctic') A.drawTurtleTracks(g, { tracks: [] });
    const sp = W / row.length;
    for (const [sc, y0, lab] of [[1.2, 160, 'x1.2 (race scale)'], [3, 470, 'x3']]) {
      row.forEach(([n, f], i) => { g.save(); g.translate(sp * 0.5 + i * sp, y0); g.scale(sc, sc); try { f(); } catch (e) { console.log(n, e.message); } g.restore(); if (show) { g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(n, sp * 0.5 + i * sp - 40, y0 + 110); } });
      if (show) { g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(lab, W - 140, y0 - 100); } }
    state.camera = oc; if (show) { c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); } };
  // the paintings load on first use (and the tern's wings only once its body has): two warm-up passes
  for (let k = 0; k < 2; k++) { await p.evaluate(draw, [venue, W, H, false]); await p.waitForTimeout(1200); }
  await p.evaluate(draw, [venue, W, H, true]);
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } }); await b.close(); })();
