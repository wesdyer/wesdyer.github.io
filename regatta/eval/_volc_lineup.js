// Bench: every Emberfall animal in a row beside the hull, at race scale (x1.2) and x3 — sizes against the boat.
//   node regatta/eval/_volc_lineup.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 560 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const A = Wildlife.art, oc = state.camera; state.camera = null; A.setT(10);
    const c = document.createElement('canvas'); c.width = 1600; c.height = 560; const g = c.getContext('2d'); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 1600, 560); g.fillStyle = '#2b2c30'; g.fillRect(0, 0, 1600, 70); g.fillRect(0, 280, 1600, 90);
    const hull = (s) => { g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 1 / s; g.beginPath(); g.moveTo(0, -27.5); g.quadraticCurveTo(10, -10, 8, 27.5); g.lineTo(-8, 27.5); g.quadraticCurveTo(-10, -10, 0, -27.5); g.fill(); g.stroke(); };
    const row = [['hull', () => hull(1)], ['hammerhead', () => A.drawHammer(g, { x: 0, y: 0, h: 0, ph: 1, size: 1, turn: 0, mir: 1, roll: 0, shake: 0, shP: 0 }, 0.1)],
      ['iguana', () => A.drawIguana(g, { i: 0, x: 0, y: 0, h: 0, mode: 'bask', size: 1, curl: 0.4, curl2: 0, dry: 0.8, trail: [], ph: 0 }, true)],
      ['crab', () => A.drawCrab(g, { x: 0, y: 0, h: 0, t: 1, ph: 0, leg: 0, burst: 0, pick: 0, size: 1 })],
      ['booby', () => A.drawBooby(g, { j: 1, x: 0, y: 0, h: 0, z: 0, flap: 1.3, gliding: true, mode: 'fly', t: 0, dive: 0, splash: 0 })],
      ['frigatebird', () => A.drawFrigate(g, { j: 0, x: 0, y: 0, h: 0, z: 0, flap: 0, beats: 0, mode: 'soar', fork: 0 })],
      ['sooty tern', () => A.drawTern(g, { sooty: true, x: 0, y: 0, h: 0, z: 0, flap: Math.asin(0.95), gliding: true, mode: 'wheel', t: 1, splash: 0 })]];
    for (const [sc, y0, lab] of [[1.2, 140, 'x1.2 (race scale)'], [3, 440, 'x3']]) {
      row.forEach(([n, f], i) => { g.save(); g.translate(110 + i * 220, y0); g.scale(sc, sc); f(); g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(n, 80 + i * 220, y0 + 120); });
      g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(lab, 1500, y0 - 100); }
    state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  await p.screenshot({ path: process.argv[2], clip: { x: 0, y: 0, width: 1600, height: 560 } }); await b.close(); })();
