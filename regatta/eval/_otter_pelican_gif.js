// GIF (PT-028): Otter Point's brown pelican lines, driven by the REAL behaviour code (Wildlife.update). The player
// parked in open water, a line forced across the view and right over the boat: skimming low, flap bouts passing back
// down the line, each bird rising over the mast and settling behind it. x1.6, a hull for size.
//   node regatta/eval/_otter_pelican_gif.js out.gif [seconds]     (from the repo root; needs python3 + Pillow)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const { execFileSync } = require('child_process');
(async () => { const out = process.argv[2] || '/tmp/pelicans.gif', SEC = +(process.argv[3] || 9), W = 1200, H = 700, FPS = 15, N = Math.round(SEC * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pel'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('otter'); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(([W, H]) => { const c = document.createElement('canvas'); c.id = 'gifc'; c.width = W; c.height = H; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const me = state.boats.find(b => b.isPlayer); for (const o of state.boats) if (o !== me) { o.x = 1e6; o.y = 1e6; }
    me.x = -3400; me.y = 600; me.heading = 0.3; window.__pg = { me };
    // run the spawner until a line comes (debug() hands back the live array, re-read each step), then lay it on a
    // track straight over the boat
    for (let i = 0; i < 900 && !Wildlife.debug().pelLines.length; i++) Wildlife.update(1 / 30);
    const D = Wildlife.debug(), L = D.pelLines[0]; L.h = 1.9; L.x = me.x - Math.sin(L.h) * 650; L.y = me.y + Math.cos(L.h) * 650; L.t = 0;
    D.pelLines.length = 1; }, [W, H]);
  for (let f = 0; f < N; f++) {
    await p.evaluate(([f, FPS, W, H]) => { const A = Wildlife.art, P = window.__pg, me = P.me, dt = 1 / FPS, ctx = document.getElementById('gifc').getContext('2d');
      const nl = () => Wildlife.debug().pelLines; const keep = nl()[0]; Wildlife.update(dt); const D = Wildlife.debug(); D.pelLines.length = 0; if (keep) D.pelLines.push(keep);
      A.setT(f / FPS + 10); const oc = state.camera; state.camera = null;
      ctx.save(); ctx.fillStyle = '#2d5f7a'; ctx.fillRect(0, 0, W, H); ctx.translate(W / 2, H / 2); ctx.scale(1.6, 1.6); ctx.translate(-me.x, -me.y);
      ctx.save(); ctx.translate(me.x, me.y); ctx.rotate(me.heading); ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); ctx.restore();
      Wildlife.drawAir(ctx); ctx.restore(); state.camera = oc;
      const L = keep; ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
      ctx.fillText('brown pelican line x1.6 — ' + (L ? L.birds.length + ' birds, heights ' + L.birds.map(b => (b.z / 10).toFixed(1)).join(' ') + ' m' : ''), 10, H - 12);
    }, [f, FPS, W, H]);
    await p.locator('#gifc').screenshot({ path: path.join(dir, String(f).padStart(4, '0') + '.png') });
  }
  await b.close();
  execFileSync('python3', ['-c', `import sys,glob\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.png'))\nims=[Image.open(f).convert('RGB').quantize(colors=200,method=Image.Quantize.MEDIANCUT) for f in fs]\nims[0].save(sys.argv[2],save_all=True,append_images=ims[1:],duration=${Math.round(1000 / FPS)},loop=0,optimize=True)`, dir, out]);
  fs.rmSync(dir, { recursive: true }); console.log(out, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
})();
