// Probe: frames for GIFs of the painted sea lions' movement ashore — a cow and a bull side by side, walking
// (the haul-out's 'climb'), galloping (the flush to the water, 'shuffle'), and lying up with heads-up and a
// bark — drawn by the real drawSeaLion at `scale` with the stride phase advanced as the sim does (bob * 9).
//   node regatta/eval/_otter_sealion_gif.js <dir> walk|gallop|rest|swim [frames] [scale]     (from the repo root; swim: in the water, flying)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const dir = process.argv[2], kind = process.argv[3] || 'walk', N = +(process.argv[4] || 48), sc = +(process.argv[5] || 4); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 400; c.id = 'gifc'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); });
  for (let f = 0; f < N; f++) {
    await p.evaluate(([f, kind, sc]) => { const g = document.getElementById('gifc').getContext('2d'), doc = state.course.doc;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = kind === 'swim' ? ((doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a') : '#7d7468'; g.fillRect(0, 0, 640, 400);   // rock, or the sea
      state.camera = { x: 0, y: 0, rotation: 0 };
      const bob = f / 30, mode = kind === 'walk' ? 'climb' : kind === 'gallop' ? 'shuffle' : 'lie';
      for (const [i, bull] of [[0, false], [1, true]]) {
        const m = { i, x: 0, y: 0, h: 0, mode, t: 5, up: kind === 'rest' ? Math.max(0, Math.sin(bob * 1.5)) : 0, bark: kind === 'rest' && Math.sin(bob * 1.5) > 0.5 ? 1 : 0, wet: 0, curl: 0, bob, bull, size: bull ? 1.25 : 1, gait: kind === 'rest' ? null : bob * 9, look: kind === 'rest' ? 0.6 * Math.sin(bob * 0.8) : null };
        g.save(); g.translate(170 + i * 300, 200); g.scale(sc, sc); Wildlife.art.drawSeaLion(g, m, kind === 'swim' ? { swim: true } : {}); g.restore();
      }
      g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(`${kind} — cow and bull, x${sc}`, 10, 18); }, [f, kind, sc]);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 640, height: 400 } });
  }
  console.log('ok'); await b.close(); })();
