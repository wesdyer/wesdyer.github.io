// Bench: Bluewater Bonanza's and Redrock's animals in a row beside the hull, at race scale (x1.2) and x3 — sizes against
// the boat (Oct 18 2026, "1.5x or less" at sea level).
//   node regatta/eval/_ocrr_lineup.js ocean out.png      (or: redrock out.png)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const venue = process.argv[2] === 'redrock' ? 'redrock' : 'ocean';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 560 } }); p.on('console', m => { if (m.text().includes(': ')) console.log(m.text()); });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); selectVenue(v); resetGame(); }, venue);
  const draw = (v) => { const A = Wildlife.art, oc = state.camera; state.camera = null; A.setT(10);
    const c = document.createElement('canvas'); c.width = 1600; c.height = 560; const g = c.getContext('2d'); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 1600, 560);
    if (v === 'redrock') { g.fillStyle = '#a8644a'; g.fillRect(410, 0, 800, 560); }   // the walkers on rock
    const hull = (s) => { g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 1 / s; g.beginPath(); g.moveTo(0, -27.5); g.quadraticCurveTo(10, -10, 8, 27.5); g.lineTo(-8, 27.5); g.quadraticCurveTo(-10, -10, 0, -27.5); g.fill(); g.stroke(); };
    const sheep = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, mode: 'look', head: 0, look: 0, bed: 0, moving: 0, ph: 0, gait: 'walk', pitch: 0, z: 0 }, o);
    const row = v === 'ocean' ? [['hull', () => hull(1)],
      ['spinner', () => A.drawSpinner(g, { live: true, i: 0, x: 0, y: 0, h: 0, spin: 0, breath: 0 })],
      ['mahi-mahi', () => A.drawMahi(g, { x: 0, y: 0, h: 0, size: 1, mode: 'chase', t: 0, i: 0, leap: 0, trail: [] })],
      ['flying fish (x3 of them)', () => { for (const [x, y] of [[-12, -10], [8, 0], [-4, 14]]) A.drawFlyfish(g, { x0: x, y0: y, h: 0.3, len: 0.001, t: 0.5, dur: 1, z: 0, size: 1 }); }],
      ['albatross (z 0)', () => A.drawAlbatross(g, { x: 0, y: 0, h: 0, z: 0, bank: 0 })],
      ['albatross (z 40)', () => A.drawAlbatross(g, { x: 0, y: 0, h: 0, z: 40, bank: 0.4 })],
      ['humpback calf', () => A.drawWhale(g, { j: 0, calf: true, len: 48, x: 0, y: 0, h: 0, mode: 'under', depth: 0, ph: 0, turn: 0 })]]
    : [['hull', () => hull(1)],
      ['condor (z 0)', () => A.drawCondor(g, { x: 0, y: 0, h: 0, z: 0, bank: 0, sweep: 0 })],
      ['ram + ewe', () => { A.drawBighorn(g, sheep({ ram: true, x: -9 })); A.drawBighorn(g, sheep({ x: 9, i: 1 })); }],
      ['ewe + lamb', () => { A.drawBighorn(g, sheep({ x: -7, i: 1 })); A.drawBighorn(g, sheep({ lamb: true, x: 8, y: 4, i: 2 })); }],
      ['coyote', () => A.drawCoyote(g, { i: 0, x: 0, y: 0, h: 0, side: 0, z: 0, sit: 0, mode: 'stand', head: 0, look: 0, moving: 0, ph: 0, gait: 'walk', pitch: 0, crouch: 0, leap: 0 })],
      ['coyote sitting', () => A.drawCoyote(g, { i: 0, x: 0, y: 0, h: 0, side: 0, z: 0, sit: 1, mode: 'sit', head: 0, look: 0.3, moving: 0, ph: 0, gait: 'walk', pitch: 0, crouch: 0, leap: 0 })],
      ['striper boil (r 60)', () => { g.save(); g.scale(0.5, 0.5); A.drawStriperBoil(g, { x: 0, y: 0, h: 0, r: 60, t: 10, life: 60, seed: 7, fish: Array.from({ length: 13 }, (_, i) => ({ a: i * 2.4, d: 0.15 + (i % 5) * 0.17, per: 2, ph: i * 0.37, dir: i % 2 ? 1 : -1, size: 1 })) }); g.restore(); }],
      ['carp (flat) + striper', () => { A.drawLeap(g, { kind: 'carp', x: -10, y: 0, h: 0, t: 0.99, dur: 1, size: 1, hop: 0, roll: 1 }); A.drawStriper(g, 12, 0, 0, 1, 1, 0.6); }]];
    for (const [sc, y0, lab] of [[1.2, 140, 'x1.2 (race scale)'], [3, 420, 'x3']]) {
      row.forEach(([n, f], i) => { g.save(); g.translate(110 + i * 200, y0); g.scale(sc, sc); try { f(); } catch (e) { console.log(n + ": " + e.stack); } g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(n, 60 + i * 200, y0 + 120); });
      g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(lab, 1460, y0 - 100); }
    state.camera = oc; return c; };
  await p.evaluate(`(${draw})(${JSON.stringify(venue)})`);   // a first pass asks for the paintings
  await p.waitForTimeout(2500);
  await p.evaluate(`{ const c = (${draw})(${JSON.stringify(venue)}); c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); }`);
  await p.screenshot({ path: process.argv[3], clip: { x: 0, y: 0, width: 1600, height: 560 } }); await b.close(); })();
