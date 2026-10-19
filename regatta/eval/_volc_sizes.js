// Drawn size of every Emberfall animal: the solid-pixel (alpha > 150) bounding box of each painted animal drawn alone,
// heading up the frame — so its LENGTH (bill/nose/snout to tail tip, scale.md rule 4) is the box's height and its SPAN
// the width. Shadows, rings and wakes are left out by the alpha cut. Served over http (the paintings taint file://).
//   node regatta/eval/_volc_sizes.js
const { chromium } = require('playwright'); const path = require('path'); const { spawn } = require('child_process');
(async () => {
  const port = 8700 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: path.resolve('.'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(`http://localhost:${port}/regatta/index.html`); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const A = Wildlife.art, oc = state.camera; state.camera = null; A.setT(10);
    const K = 4, items = {
      'marine iguana basking (curl 0)': g => A.drawIguana(g, { i: 0, x: 0, y: 0, h: 0, mode: 'bask', size: 1, curl: 0, curl2: 0, dry: 0.8, trail: [], ph: 0 }, true),
      'marine iguana swimming': g => A.drawIguana(g, { i: 0, x: 0, y: 0, h: 0, mode: 'swim', size: 1, trail: [], ph: 0, sph: 0 }, false),
      'Sally Lightfoot (adult)': g => A.drawCrab(g, { x: 0, y: 0, h: 0, t: 1, ph: 0, leg: 0, burst: 0, pick: 0, size: 1 }),
      'blue-footed booby (glide)': g => A.drawBooby(g, { j: 1, x: 0, y: 0, h: 0, z: 0, flap: 1.3, gliding: true, mode: 'fly', t: 0, dive: 0, splash: 0 }),
      'blue-footed booby (sitting)': g => A.drawBooby(g, { j: 1, x: 0, y: 0, h: 0, z: 0, mode: 'sit', sit: 1, splash: 0 }),
      'great frigatebird (soar)': g => A.drawFrigate(g, { j: 0, x: 0, y: 0, h: 0, z: 0, flap: 0, beats: 0, mode: 'soar', fork: 0 }),
      'sooty tern (glide)': g => A.drawTern(g, { sooty: true, x: 0, y: 0, h: 0, z: 0, flap: Math.asin(0.95), gliding: true, mode: 'wheel', t: 1, splash: 0 }),
      'scalloped hammerhead (size 1)': g => A.drawHammer(g, { x: 0, y: 0, h: 0, ph: 1, size: 1, turn: 0, mir: 1, roll: 0, shake: 0, shP: 0 }, 0.1),
    };
    const out = {};
    for (const [name, f] of Object.entries(items)) {
      const c = document.createElement('canvas'); c.width = c.height = 800; const g = c.getContext('2d');
      g.translate(400, 400); g.scale(K, K); f(g);
      const d = g.getImageData(0, 0, 800, 800).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let y = 0; y < 800; y++) for (let x = 0; x < 800; x++) if (d[(y * 800 + x) * 4 + 3] > 150) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      out[name] = x1 < 0 ? 'nothing drawn' : { length: +((y1 - y0 + 1) / K).toFixed(1), span: +((x1 - x0 + 1) / K).toFixed(1) };
    }
    state.camera = oc; return out; });
  for (const [k, v] of Object.entries(r)) console.log(k.padEnd(34), JSON.stringify(v));
  await b.close(); srv.kill(); })();
