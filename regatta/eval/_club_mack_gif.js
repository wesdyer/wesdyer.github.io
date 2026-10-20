// GIF: a Clubhouse Point mackerel boil driven by the REAL behaviour code (Wildlife.update), DRAWN fish (left) vs
// PAINTED (right), the same boil at x4: the whitebait ball, the shoal circling and slashing through it, the fry
// spraying out, a mackerel thrown clear. A hull at the same scale for size.
//   node regatta/eval/_club_mack_gif.js out.gif [seconds]     (from the repo root; needs python3 + Pillow)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const { execFileSync } = require('child_process');
(async () => { const out = process.argv[2] || '/tmp/mack.gif', SEC = +(process.argv[3] || 8), W = 1280, H = 540, FPS = 15, N = Math.round(SEC * FPS), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mack'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('seatrials'); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(([W, H]) => { const c = document.createElement('canvas'); c.id = 'gifc'; c.width = W; c.height = H; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const B = Wildlife.debug().mackBoils[0]; Object.assign(B, { mode: 'boil', k: 1, t: 60, x: 2700, y: -2000 }); window.__mb = B; }, [W, H]);
  for (let f = 0; f < N; f++) {
    await p.evaluate(([f, FPS, W, H]) => { const A = Wildlife.art, B = window.__mb, ctx = document.getElementById('gifc').getContext('2d');
      Wildlife.update(1 / FPS); B.t = 60; A.setT(f / FPS + 10); const oc = state.camera; state.camera = null;
      for (const [x0, drawn] of [[0, true], [W / 2, false]]) { window.__MACK_DRAWN = drawn;
        ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, W / 2, H); ctx.clip(); ctx.fillStyle = '#2a5f86'; ctx.fillRect(x0, 0, W / 2, H);
        ctx.translate(x0 + W / 4, H / 2); ctx.scale(4, 4); ctx.translate(-B.x, -B.y);
        A.drawMackBoil(ctx, B);
        ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 0.3; ctx.save(); ctx.translate(B.x + 62, B.y - 30); ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText((drawn ? 'DRAWN' : 'PAINTED') + ' mackerel — the real boil, x4', x0 + 10, H - 12); }
      window.__MACK_DRAWN = false; ctx.fillStyle = '#123'; ctx.fillRect(W / 2 - 1, 0, 2, H); state.camera = oc;
    }, [f, FPS, W, H]);
    await p.locator('#gifc').screenshot({ path: path.join(dir, String(f).padStart(3, '0') + '.png') });
  }
  await b.close();
  execFileSync('python3', ['-c', `import sys,glob\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.png'))\nims=[Image.open(f).convert('RGB').quantize(colors=200,method=Image.Quantize.MEDIANCUT) for f in fs]\nims[0].save(sys.argv[2],save_all=True,append_images=ims[1:],duration=${Math.round(1000 / FPS)},loop=0,optimize=True)`, dir, out]);
  fs.rmSync(dir, { recursive: true }); console.log(out);
})();
