// GIF: Duckling Pond's painted animals driven by the REAL behaviour code (Wildlife.update), three panels:
//   left   — the turtles on their log, x4: a boat comes close, they slide in one by one, row off and settle on the bottom
//            (silt), one comes up to look; the boat leaves and (the quiet fast-forwarded) they climb back out
//   middle — the pied-billed grebes, camera on the forager, x4: bouts of forage dives; then a boat closes in: the
//            slow sink to the head, slipping away hidden, the head going under, coming up well away
//   right  — five ducklings, x6: swimming in a line, then at rest: pecking at the surface, a tip-up now and then
// A hull at each panel's scale for size.
//   node regatta/eval/_pond_gif.js out.gif [seconds]     (from the repo root; needs python3 + Pillow)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const { execFileSync } = require('child_process');
(async () => { const out = process.argv[2] || '/tmp/pond.gif', SEC = +(process.argv[3] || 24), W = 1440, H = 540, FPS = 12, N = Math.round(SEC * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pond'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && window.School);
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); School.start(2); await new Promise(r => setTimeout(r, 2500)); });
  await p.evaluate(([W, H]) => { const c = document.createElement('canvas'); c.id = 'gifc'; c.width = W; c.height = H; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const D = Wildlife.debug(), bk = D.baskers[0], G = D.divers[0];
    // the ducklings: five in a line, swimming up the frame for a while, then resting
    const ducks = Array.from({ length: 5 }, (_, i) => ({ x: 0, y: i * 11, h: 0, swim: 1 }));
    window.__pg = { bk, G, ducks, cam: { x: G.birds[0].x, y: G.birds[0].y }, boat: { x: 1e6, y: 1e6, heading: 0, isPlayer: false } };
  }, [W, H]);
  for (let f = 0; f < N; f++) {
    await p.evaluate(([f, FPS, W, H, N]) => { const A = Wildlife.art, P = window.__pg, dt = 1 / FPS, ctx = document.getElementById('gifc').getContext('2d'), s = f / FPS;
      const bk = P.bk, L = bk.log, lead = P.G.birds[0];
      // the boat's script: by the log 1-4 s; off, then by the forager from 9 s, closing to 50 u; gone at 17 s
      if (s > 1 && s < 4) { P.boat.x = L.x + 70; P.boat.y = L.y + 50; }
      else if (s >= 9 && s < 17) { const k = Math.min(1, (s - 9) / 4), d = 220 - 170 * k; P.boat.x = lead.x - Math.sin(lead.h + 0.6) * d; P.boat.y = lead.y + Math.cos(lead.h + 0.6) * d; }
      else { P.boat.x = 1e6; P.boat.y = 1e6; }
      if (Math.abs(s - 7) < dt / 2) { const t = bk.turtles.find(t => t.mode === 'under'); if (t) t.peek = 4.5; }   // (one comes up to look)
      if (s > 12 && bk.quiet < 18) bk.quiet = Math.max(bk.quiet, 17.9);                                            // (the quiet fast-forwarded)
      const ob = state.boats; state.boats = [P.boat]; Wildlife.update(dt); state.boats = ob;
      // the ducklings' own motion (school.js moves them in the game): up the frame, then still
      for (const d of P.ducks) { d.swim = s < 6 ? 1 : Math.max(0, 1 - (s - 6) / 0.8); d.y -= 14 * d.swim * dt; }
      A.setT(s + 10);
      const oc = state.camera; state.camera = null;
      const hull = (x, y) => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 0.3; ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); ctx.restore(); };
      const panel = (x0, w, sc, cx, cy, draw, label) => { ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, w, H); ctx.clip(); ctx.fillStyle = '#1f6f78'; ctx.fillRect(x0, 0, w, H);
        ctx.translate(x0 + w / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-cx, -cy); draw(); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(label, x0 + 10, H - 12); };
      const T0 = bk.turtles;
      panel(0, 480, 4, L.x, L.y, () => {
        // the log (a plain stand-in for the prop), then the real layers' turtle drawing
        ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.heading || 0); ctx.fillStyle = '#6b5a44'; ctx.strokeStyle = '#3e3326'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        Wildlife.drawWater(ctx); Wildlife.drawPerched(ctx);
        hull(L.x + 45, L.y - 40);
        if (P.boat.x < 1e5) { ctx.save(); ctx.globalAlpha = 0.5; hull(P.boat.x, P.boat.y); ctx.restore(); }
      }, 'turtles x4 — ' + [...new Set(T0.map(t => t.mode))].join(', ') + (s > 12 ? '  (quiet fast-forwarded)' : ''));
      P.cam.x += (lead.x - P.cam.x) * 0.15; P.cam.y += (lead.y - P.cam.y) * 0.15;
      panel(480, 480, 4, P.cam.x, P.cam.y, () => {
        Wildlife.drawWater(ctx);
        hull(P.cam.x + 45, P.cam.y - 30);
        if (P.boat.x < 1e5) { ctx.save(); ctx.globalAlpha = 0.6; ctx.translate(P.boat.x, P.boat.y); ctx.rotate(Math.atan2(lead.x - P.boat.x, -(lead.y - P.boat.y))); hull(0, 0); ctx.restore(); }
      }, 'grebes x4 — ' + P.G.birds.map(g => g.mode + (g.chicks ? ' (chicks)' : '')).join(' / ') + (lead.mode === 'under' ? ' ' + Math.max(0, lead.t).toFixed(1) + ' s' : ''));
      const dc = P.ducks[2];
      panel(960, 480, 6, dc.x, dc.y, () => { A.drawDucklings(ctx, P.ducks); hull(dc.x + 30, dc.y - 10); }, 'ducklings x6 — ' + (s < 6 ? 'swimming in a line' : 'at rest: pecking, tipping up'));
      ctx.fillStyle = '#123'; ctx.fillRect(479, 0, 2, H); ctx.fillRect(959, 0, 2, H);
      state.camera = oc;
    }, [f, FPS, W, H, N]);
    await p.locator('#gifc').screenshot({ path: path.join(dir, String(f).padStart(4, '0') + '.png') });
  }
  await b.close();
  execFileSync('python3', ['-c', `import sys,glob\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.png'))\nims=[Image.open(f).convert('RGB').quantize(colors=200,method=Image.Quantize.MEDIANCUT) for f in fs]\nims[0].save(sys.argv[2],save_all=True,append_images=ims[1:],duration=${Math.round(1000 / FPS)},loop=0,optimize=True)`, dir, out]);
  fs.rmSync(dir, { recursive: true }); console.log(out, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
})();
