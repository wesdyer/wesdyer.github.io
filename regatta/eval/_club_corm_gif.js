// GIF: Clubhouse Point's painted cormorants driven by the REAL behaviour code (Wildlife.update), two panels:
//   left  — a fishing group at x3 (leap-dives, down out of sight, hunting along the bottom, floating up again)
//   right — one bird followed by the camera at x2.5: the takeoff run, the low fast flight, the glide in and the skid
// A hull at each panel's scale for size; faint specks on the sea so the moving camera's speed reads.
//   node regatta/eval/_club_corm_gif.js out.gif [seconds]     (from the repo root; needs python3 + Pillow)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const { execFileSync } = require('child_process');
(async () => { const out = process.argv[2] || '/tmp/corm.gif', SEC = +(process.argv[3] || 12), W = 1280, H = 540, FPS = 15, N = Math.round(SEC * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corm'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('seatrials'); resetGame(); });
  await p.waitForTimeout(2500);   // (the paintings load)
  const info = await p.evaluate(([W, H]) => { const c = document.createElement('canvas'); c.id = 'gifc'; c.width = W; c.height = H; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const D = Wildlife.debug(), C = D.clubCorms, groups = {};
    for (const q of C) (groups[q.g] = groups[q.g] || []).push(q);
    const gs = Object.values(groups).sort((a, b) => b.length - a.length), fish = gs[0], fl = gs[1][0];
    // the fishing group: everyone at the surface, the first about to start a bout, the others a little after
    fish.forEach((q, i) => { Object.assign(q, { mode: 'swim', z: 0, vis: 1, depth: 0, t: 0.4 + i * 1.6, bout: 4 - i % 2, trail: [] }); q.x = q.cx + (i - 1) * 22; q.y = q.cy + (i % 2) * 18; });
    // the flyer: off along its flank, now
    Object.assign(fl, { mode: 'takeoff', t: 1.6, flap: 0, ring: 0.8, sp: 15, prints: [], pr: 0, z: 0, lx: fl.x, ly: fl.y + (fl.y > -2000 ? -1500 : 1500) });
    fl.h = Math.atan2(fl.lx - fl.x, -(fl.ly - fl.y));
    window.__cg = { fish, fl, cam: { x: fl.x, y: fl.y }, fc: { x: fish.reduce((s, q) => s + q.x, 0) / fish.length, y: fish.reduce((s, q) => s + q.y, 0) / fish.length } };
    return { n: fish.length };
  }, [W, H]);
  for (let f = 0; f < N; f++) {
    await p.evaluate(([f, FPS, W, H]) => { const A = Wildlife.art, G = window.__cg, dt = 1 / FPS, ctx = document.getElementById('gifc').getContext('2d');
      Wildlife.update(dt); A.setT(f / FPS + 10);
      const oc = state.camera; state.camera = null;
      const hull = (x, y) => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 0.3; ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); ctx.restore(); };
      const specks = (cx, cy, w, h) => { ctx.fillStyle = 'rgba(255,255,255,0.07)'; const s = 30; for (let x = Math.floor((cx - w) / s) * s; x < cx + w; x += s) for (let y = Math.floor((cy - h) / s) * s; y < cy + h; y += s) { const k = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1; if (Math.abs(k) < 0.35) { ctx.beginPath(); ctx.ellipse(x + k * 20, y + k * 13, 1.6, 0.7, 0.4, 0, 6.283); ctx.fill(); } } };
      const water = (q) => { if (q.prints && q.prints.length) A.drawCormPrints(ctx, q); if (q.splash > 0) A.drawSlap(ctx, q.sx, q.sy, q.splash, 0.22); if (q.mode === 'swim' || q.mode === 'under' || q.mode === 'leap') A.drawCormorant(ctx, q); };
      const air = (q) => { if (q.mode === 'fly' || q.mode === 'takeoff' || q.mode === 'land') A.drawCormorant(ctx, q); };
      const panel = (x0, w, s, cx, cy, birds, label) => { ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, w, H); ctx.clip(); ctx.fillStyle = '#2a5f86'; ctx.fillRect(x0, 0, w, H);
        ctx.translate(x0 + w / 2, H / 2); ctx.scale(s, s); ctx.translate(-cx, -cy); specks(cx, cy, w / s, H / s);
        hull(cx + w / s / 2 - 16, cy - H / s / 2 + 34);
        for (const q of birds) water(q); for (const q of birds) air(q); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(label, x0 + 10, H - 12); };
      // the left camera holds on the group; the right one rides with the flyer
      G.cam.x += (G.fl.x - G.cam.x) * 0.25; G.cam.y += (G.fl.y - G.cam.y) * 0.25;
      panel(0, 640, 3, G.fc.x, G.fc.y, G.fish, 'fishing group x3 — the real behaviour code');
      panel(640, 640, 2.5, G.cam.x, G.cam.y, [G.fl], 'one bird, camera following x2.5 — ' + G.fl.mode + (G.fl.mode === 'fly' ? ' ' + Math.round(G.fl.sp) + ' u/s' : ''));
      ctx.fillStyle = '#123'; ctx.fillRect(639, 0, 2, H);
      const deep = G.fish.filter(q => q.mode === 'under').map(q => q.depth.toFixed(1) + ' m').join(', ');
      ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText('under: ' + (deep || '—'), 10, 20);
      state.camera = oc;
    }, [f, FPS, W, H]);
    await p.locator('#gifc').screenshot({ path: path.join(dir, String(f).padStart(3, '0') + '.png') });
  }
  await b.close();
  execFileSync('python3', ['-c', `import sys,glob\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.png'))\nims=[Image.open(f).convert('RGB').quantize(colors=200,method=Image.Quantize.MEDIANCUT) for f in fs]\nims[0].save(sys.argv[2],save_all=True,append_images=ims[1:],duration=${Math.round(1000 / FPS)},loop=0,optimize=True)`, dir, out]);
  fs.rmSync(dir, { recursive: true }); console.log(out, info);
})();
