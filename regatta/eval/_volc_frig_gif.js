// Film: Emberfall's frigatebirds — (1) a thermal's stack at 1x, wings still, banked round, tails scissoring; (2) one
// sent down to snatch from the sea at 2x (the glide, the dip, the ring, the climb); (3) a chase at 2x, forced to pay:
// a booby harried until it drops its fish, the frigates diving for it. PNG frames for a GIF.   node regatta/eval/_volc_frig_gif.js outdir
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (let i = 0; i < 30 * 10; i++) Wildlife.update(1 / 30);
    const d = Wildlife.debug(); window.__Fr = d.frigates; for (const f of d.frigates) f.t = 1e4;   // (nobody leaves on their own)
    const c = document.createElement('canvas'); c.width = 900; c.height = 700; c.id = 'film'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  const shot = async (fr) => p.screenshot({ path: path.join(out, String(fr).padStart(3, '0') + '.png') });
  let fr = 0;
  const run = async (n, setup, frame) => { await p.evaluate(setup); for (let i = 0; i < n; i++, fr++) { await p.evaluate(frame, i); await shot(fr); } };
  const DRAW = `const A = Wildlife.art, c = document.getElementById('film'), g = c.getContext('2d');
      const land = () => { g.fillStyle = '#2b2c30'; for (const s of state.course.islands) if (s.vertices && !s.awash) { g.beginPath(); s.vertices.forEach((v, i) => i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)); g.closePath(); g.fill(); } };`;
  // (1) the stack
  await run(75, () => { window.__f = window.__Fr[0]; }, new Function('i', DRAW + `
      Wildlife.update(1 / 30); Wildlife.update(1 / 30); const f = window.__f;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 900, 700); g.setTransform(1, 0, 0, 1, 450 - f.cx, 350 - f.cy); land();
      for (const q of window.__Fr) if (q.ti === f.ti) A.drawFrigate(g, q);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText('great frigatebirds x1 — soaring on the thermal over the cone, banked round, tails scissoring', 14, 24);`));
  // (2) a surface snatch
  await run(150, () => { const f = window.__Fr[0]; f.t = 0; window.__f = f; window.__cx = f.x; window.__cy = f.y;
      // (force the dip: the soar branch picks it when no booby flock is rising nearby)
      for (const F of Wildlife.debug().boobyFlocks) if (F.mode === 'rise') F.mode = 'circle'; }, new Function('i', DRAW + `
      const f = window.__f; if (f.mode === 'soar' && i < 3) f.t = 0; for (let k = 0; k < 2; k++) Wildlife.update(1 / 30);
      // (the film starts it 300 u short of its spot: from a thermal over a cone the glide out to sea is long)
      if (f.mode === 'dip' && !window.__moved) { window.__moved = 1; const a = Math.atan2(f.tx - f.x, -(f.ty - f.y)); f.x = f.tx - Math.sin(a) * 300; f.y = f.ty + Math.cos(a) * 300; f.h = a; window.__cx = f.x; window.__cy = f.y; }
      window.__cx += (f.x - window.__cx) * 0.1; window.__cy += (f.y - window.__cy) * 0.1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 900, 700); g.setTransform(2, 0, 0, 2, 450 - window.__cx * 2, 350 - window.__cy * 2); land();
      A.drawFrigate(g, f);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText('x2 — ' + (f.mode === 'dip' ? 'gliding down to snatch from the surface' : f.mode === 'climb' ? (f.dipRing > 0 ? 'the snatch — and back up' : 'climbing back to the thermal') : f.mode), 14, 24);`));
  // (3) a chase that pays
  await run(150, () => { const Fs = Wildlife.debug().boobyFlocks, f = window.__Fr[0];
      const B = Fs.flatMap(F => F.birds).filter(q => q.mode === 'fly').sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0]; B.kl = { won: true, T: 3.5, at: 1e9 };
      for (const q of window.__Fr.filter(o => o.ti === f.ti).slice(0, 2)) { q.mode = 'swoop'; q.t = 16; q.tgt = B; q.harry = 0; q.x = B.x + 160; q.y = B.y - 120; q.z = 60; }
      window.__B = B; window.__cx = B.x; window.__cy = B.y; }, new Function('i', DRAW + `
      const B = window.__B; Wildlife.update(1 / 30); Wildlife.update(1 / 30); B.kl && (B.kl.at = 1e9);
      window.__cx += (B.x - window.__cx) * 0.12; window.__cy += (B.y - window.__cy) * 0.12;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 900, 700); g.setTransform(2, 0, 0, 2, 450 - window.__cx * 2, 350 - window.__cy * 2); land();
      A.drawBooby(g, B); for (const q of Wildlife.debug().frigFish) A.drawFrigFish(g, q); for (const q of window.__Fr) if (q.tgt === B || q.mode === 'catch') A.drawFrigate(g, q);
      const ff = Wildlife.debug().frigFish; if (ff.length) window.__drop = 1; if (window.__drop && !ff.length) window.__got = 1; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.font = '14px sans-serif';
      g.fillText('x2 — piracy: ' + (window.__got ? 'the fish snatched in the air' : ff.length ? 'harried, the booby drops its fish' : 'two frigatebirds harrying a booby'), 14, 24);`));
  await b.close(); })();
