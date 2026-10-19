// Film: a Sally Lightfoot bed at 4x on the venue's own rock — picking, a face-off (forced), a wave washing the low
// rock (most cling, some run or leap), then a boat run past (they bolt up the rock) — ~14 s at 15 fps -> PNG frames.
//   node regatta/eval/_volc_crab_gif.js outdir
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 30 * 5; i++) Wildlife.update(1 / 30);
    // the densest cluster: the bed and the crab with the most neighbours inside 60 u
    const beds = Wildlife.debug().crabBeds.filter(B => !B.cleaners); let best = null, bn = -1;
    for (const B of beds) for (const c of B.crabs) { const n = B.crabs.filter(o => Math.hypot(o.x - c.x, o.y - c.y) < 60).length; if (n > bn) { bn = n; best = [B, c]; } }
    const [B, c0] = best; window.__B = B; window.__cx = c0.x; window.__cy = c0.y; B.duelT = 0.1;
    const c = document.createElement('canvas'); c.width = 900; c.height = 700; c.id = 'film'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  for (let fr = 0; fr < 210; fr++) {
    await p.evaluate((fr) => { const B = window.__B, A = Wildlife.art, c = document.getElementById('film'), g = c.getContext('2d'), me = state.boats[0];
      if (fr === 60 || fr === 100) { B.sprayT = 0; B.washAt = { x: window.__cx, y: window.__cy + (fr === 60 ? 0 : -30) }; }                                             // waves
      if (fr === 120) { me.x = window.__cx + 130; me.y = window.__cy - 130; me.speed = 5; }  // the boat comes in
      if (fr >= 120) { me.x -= 1.2; me.y += 1.2; }
      Wildlife.update(1 / 30); Wildlife.update(1 / 30);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#245866'; g.fillRect(0, 0, 900, 700);
      g.setTransform(4, 0, 0, 4, 450 - window.__cx * 4, 350 - window.__cy * 4);
      g.fillStyle = '#2b2c30'; for (const s of state.course.islands) if (s.vertices && !s.awash && pointInPoly(window.__cx, window.__cy, s.vertices) | s.vertices.some(v => Math.hypot(v.x - window.__cx, v.y - window.__cy) < 400)) { g.beginPath(); s.vertices.forEach((v, i) => i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)); g.closePath(); g.fill(); }
      if (B.wash) A.drawCrabWash(g, B.wash); for (const o of B.crabs) A.drawCrab(g, o);
      if (fr >= 120) { g.fillStyle = '#f2f2f2'; g.save(); g.translate(me.x, me.y); g.rotate(-Math.PI / 4); g.beginPath(); g.moveTo(0, -27.5); g.quadraticCurveTo(10, -10, 8, 27.5); g.lineTo(-8, 27.5); g.quadraticCurveTo(-10, -10, 0, -27.5); g.fill(); g.restore(); }
      const D = B.crabs.some(o => o.duel && o.duel.sh.t > 0), cl = B.crabs.filter(o => o.cling > 0).length, fl = B.crabs.filter(o => o.flee > 0).length;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif';
      g.fillText('Sally Lightfoots x4' + (D ? ' — two males face off' : '') + (cl ? ' — ' + cl + ' clinging under the wash' : '') + (fl ? ' — ' + fl + ' bolting' : ''), 14, 24); }, fr);
    await p.screenshot({ path: path.join(out, String(fr).padStart(3, '0') + '.png') }); }
  await b.close(); })();
