// GIF (PT-028): a Clubhouse Point gull raft driven by the REAL behaviour code (Wildlife.update), x5 on the raft:
// riding the chop (surge, heave, the wash), drifting and paddling back, a bather; then a boat closes in: the
// alarm runs through the raft, each turns into the wind, patters off and flies; the camera follows the flock to
// its new water and the landing skids. A hull at the same scale for size.
//   node regatta/eval/_club_gull_gif.js out.gif [seconds]     (from the repo root; needs python3 + Pillow)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const { execFileSync } = require('child_process');
(async () => { const out = process.argv[2] || '/tmp/gulls.gif', SEC = +(process.argv[3] || 16), W = 900, H = 600, FPS = 15, N = Math.round(SEC * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gull'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('seatrials'); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(([W, H]) => { const c = document.createElement('canvas'); c.id = 'gifc'; c.width = W; c.height = H; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const F = Wildlife.debug().clubGulls.sort((a, b) => b.birds.length - a.birds.length)[0]; F.birds[1].bathT = 2.5;
    window.__gg = { F, cam: { x: F.cx, y: F.cy }, boat: { x: 1e6, y: 1e6, heading: 0, isPlayer: false } }; }, [W, H]);
  for (let f = 0; f < N; f++) {
    await p.evaluate(([f, FPS, W, H]) => { const A = Wildlife.art, P = window.__gg, F = P.F, dt = 1 / FPS, s = f / FPS, ctx = document.getElementById('gifc').getContext('2d');
      // the boat: from 7 s, sailing up at the raft from downwind
      if (s >= 7 && !P.b0) P.b0 = { x: F.birds[0].x + 30, y: F.birds[0].y + 420 };
      if (P.b0) { P.boat.x = P.b0.x; P.boat.y = P.b0.y - (s - 7) * 90; } 
      const ob = state.boats; state.boats = [P.boat]; Wildlife.update(dt); state.boats = ob; A.setT(s + 10);
      const up = F.birds.filter(b => b.mode !== 'float'); const fx = up.length ? up.reduce((k, b) => k + b.x, 0) / up.length : F.birds.reduce((k, b) => k + b.x, 0) / F.birds.length, fy = up.length ? up.reduce((k, b) => k + b.y, 0) / up.length : F.birds.reduce((k, b) => k + b.y, 0) / F.birds.length;
      P.cam.x += (fx - P.cam.x) * 0.2; P.cam.y += (fy - P.cam.y) * 0.2;
      const oc = state.camera; state.camera = null;
      ctx.save(); ctx.fillStyle = '#2a5f86'; ctx.fillRect(0, 0, W, H); ctx.translate(W / 2, H / 2); ctx.scale(5, 5); ctx.translate(-P.cam.x, -P.cam.y);
      Wildlife.drawWater(ctx); Wildlife.drawAir && Wildlife.drawAir(ctx);
      const hull = (x, y, a, al) => { ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); ctx.restore(); };
      hull(P.cam.x + 70, P.cam.y - 25, 0, 1); if (P.b0) hull(P.boat.x, P.boat.y, 0, 0.6);
      ctx.restore(); state.camera = oc;
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText('gull raft x5 — ' + [...new Set(F.birds.map(b => b.mode + (b.bathe > 0 ? ' (bathing)' : '')))].join(', ') + '   wind ' + state.wind.speed.toFixed(0) + ' kt', 10, H - 12);
    }, [f, FPS, W, H]);
    await p.locator('#gifc').screenshot({ path: path.join(dir, String(f).padStart(4, '0') + '.png') });
  }
  await b.close();
  execFileSync('python3', ['-c', `import sys,glob\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.png'))\nims=[Image.open(f).convert('RGB').quantize(colors=200,method=Image.Quantize.MEDIANCUT) for f in fs]\nims[0].save(sys.argv[2],save_all=True,append_images=ims[1:],duration=${Math.round(1000 / FPS)},loop=0,optimize=True)`, dir, out]);
  fs.rmSync(dir, { recursive: true }); console.log(out, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
})();
