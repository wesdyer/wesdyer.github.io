// Probe: frames for a GIF of a LIVE breach — a sea lion raft staged in open sea (as test_otter does; the
// shark rightly refuses one by the rocks), Wildlife.forceHunt on it, retried until the strike is a full
// BREACH (taken at the strike with startBreach's own fields — it is a 1-in-8 roll), recorded through the
// sprint, the leap and the crash, following the shark, heading up, at `scale`.
//   node regatta/eval/_otter_breachgif.js <dir> [scale] [lead] [tail]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], sc = +(process.argv[3] || 1.6), lead = +(process.argv[4] || 30), tail = +(process.argv[5] || 45); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 640 } });
  const setup = async () => {
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
    await p.waitForTimeout(900);
    await p.evaluate(() => {
      window.__stage = (attempt) => { const d = Wildlife.debug();
        const open = (x, y) => { for (let r = 0; r <= 150; r += 30) for (let i = 0; i < 8; i++) if (pointOnLand(x + Math.cos(i * 0.785) * r, y + Math.sin(i * 0.785) * r)) return false; return true; };
        const L = d.slGroups.map((G, gi) => [G, gi]).filter(([G]) => G.members.filter(q => !q.gone).length >= 2); if (!L.length) return null;
        const [G, gi] = L[attempt % L.length];
        let sp = null; for (let r = 0; r < 2000 && !sp; r += 100) for (let i = 0; i < 16 && !sp; i++) { const x = G.x + Math.cos(i * 0.39) * r, y = G.y + Math.sin(i * 0.39) * r; if (open(x, y)) sp = { x, y }; }
        G.x = sp.x; G.y = sp.y; G.tx = sp.x; G.ty = sp.y; G.mode = 'raft'; G.t = 100; G.H = Object.assign({}, G.H, { sea: sp }); G.from = null;
        for (const q of G.members) { q.x = sp.x + q.ox * 0.5; q.y = sp.y + q.oy * 0.5; q.leap = 0; q.z = 0; }
        for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
        state.camera = { x: G.x, y: G.y, rotation: 0 };
        Wildlife.forceHunt(0, gi); return d.whites[0]; };
    }); };
  // a real hunt on a staged raft, stepped to the sprint; at the strike the leap is set up with the fields
  // startBreach sets (a breach is a 1-in-8 roll of the strike, so it is taken rather than waited for)
  await setup();
  const ok = await p.evaluate((lead) => { const W = window.__W = window.__stage(0); if (!W) return false;
    let n = 0; while (n++ < 30 * 40 && W.mode !== 'sprint') Wildlife.update(1 / 30);
    if (W.mode !== 'sprint') return false;
    window.__force = () => { if (W.mode !== 'sprint' || !W.target) return; const q = W.target.q; if (Math.hypot(q.x - W.x, q.y - W.y) > 40 && W.t > 0.15) return;
      W.mode = 'breach'; W.t = 1.9; W.bt = 1.9; W.bz = 1; W.z = 0; W.caught = false; W.sawSprint = false; W.sx = q.x; W.sy = q.y; W.splash = 1; W.bx = q.x; W.by = q.y;
      const a = W.h + 1; q.flung = 1.1; q.fx = Math.sin(a) * 50; q.fy = -Math.cos(a) * 50; };
    const c = document.createElement('canvas'); c.width = 640; c.height = 640; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    return true; }, lead);
  if (!ok) { console.log('no sprint'); await b.close(); return; }
  for (let f = 0; f < lead + tail; f++) {
    await p.evaluate((sc) => { const W = window.__W; for (let k = 0; k < 2; k++) { window.__force(); Wildlife.update(1 / 30); }
      const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a';
      if (W.mode !== 'breach' || !window.__last) window.__last = { x: W.x, y: W.y, h: W.h };   // hold the frame still through the leap
      const v = window.__last; state.camera = { x: v.x, y: v.y, rotation: 0 };
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = water; g.fillRect(0, 0, 640, 640);
      g.save(); g.translate(320, 330); g.scale(sc, sc); g.rotate(-v.h); g.translate(-v.x, -v.y);
      Wildlife.drawWater(g); if (Wildlife.drawPerched) Wildlife.drawPerched(g); if (Wildlife.drawAir) Wildlife.drawAir(g); g.restore();
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`great white x${sc} — ${W.mode}${W.mode === 'breach' ? ' z ' + W.z.toFixed(2) : ''}`, 10, 18); }, sc);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 640 } });
  }
  console.log('ok'); await b.close(); })();
