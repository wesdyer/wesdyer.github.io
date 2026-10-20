// Bench: Clubhouse Point's by-the-wind sailors, DRAWN (left) vs PAINTED (right): one sailor at x8 and x3, a real
// windrow from the game at x1 and x2.5 (all facing the same way to the wind), a hull at x1 for size.
//   node regatta/eval/_club_velella_bench.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/velella_bench.png', W = 1600, H = 900;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('seatrials'); resetGame(); });
  await p.waitForTimeout(2500);
  await p.evaluate(([W, H]) => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a5f86'; ctx.fillRect(0, 0, W, H); const oc = state.camera; state.camera = null;
    const F0 = Wildlife.debug().velFleets[0], one = Object.assign({}, F0, { cx: 0, cy: 0, items: [Object.assign({}, F0.items[0], { u: 0, sp: 0, s: 1 })], L: 0, wav: 0 });
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const row = Object.assign({}, F0, { cx: 0, cy: 0 });
    for (const [x0, drawn] of [[0, true], [W / 2, false]]) {
      window.__VEL_DRAWN = drawn; lab(drawn ? 'DRAWN' : 'PAINTED', x0 + 20, 26);
      at(x0 + 120, 130, 8, () => A.drawVelellaFleet(ctx, one)); lab('x8', x0 + 110, 220);
      at(x0 + 300, 130, 3, () => A.drawVelellaFleet(ctx, one)); lab('x3', x0 + 290, 220);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 240, W / 2, 330); ctx.clip(); at(x0 + W / 4, 405, 2.5, () => A.drawVelellaFleet(ctx, row)); ctx.restore(); lab('a windrow from the game, x2.5', x0 + 20, 560);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 580, W / 2, 320); ctx.clip(); at(x0 + W / 4, 740, 1, () => { A.drawVelellaFleet(ctx, row); ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.save(); ctx.translate(300, -60); ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); ctx.restore(); }); ctx.restore(); lab('the same windrow x1, with a hull', x0 + 20, 890);
    }
    window.__VEL_DRAWN = false; ctx.fillStyle = '#123'; ctx.fillRect(W / 2 - 1, 0, 2, H);
    state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); }, [W, H]);
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } }); console.log(out); await b.close(); })();
