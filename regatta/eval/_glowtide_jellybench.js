// Probe: Glowtide's jellies close up. Row 1: a golden jelly at five tilts of its swim axis (going down steeply ..
// going up steeply), mid-pulse and coasting; row 2: a real moon-jelly drift at night, 4x, its members labelled with
// their depth and which way they swim; and the water-column census of both kinds over two minutes.
//   node regatta/eval/_glowtide_jellybench.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/jellybench.png';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; state.paused = true; });
  await p.waitForTimeout(1500);
  const census = await p.evaluate(() => {
    const B = Wildlife.debug().jellyBloom, zs = [], dirs = [0, 0];
    const drifts = state.course.props.filter(q => /jelly/.test(q.kind) && q._jelly);
    for (let i = 0; i < 30 * 120; i++) { update(1 / 30); if (i % 30 === 0) for (const j of B.jel) { zs.push(j.z); dirs[j.pitch < 0 ? 0 : 1]++; } }
    zs.sort((a, c) => a - c);
    const mz = []; for (const q of drifts) for (const m of q._jelly) mz.push(m.z);
    // a golden jelly's own trip: time from the surface to the bottom of its range and back
    return `golden: depth median ${zs[zs.length >> 1].toFixed(1)} m, 10-90% ${zs[(zs.length * 0.1) | 0].toFixed(1)}-${zs[(zs.length * 0.9) | 0].toFixed(1)} m; ${Math.round(100 * dirs[0] / (dirs[0] + dirs[1]))}% going down; shallower than 3.5 m (glowing) ${Math.round(100 * zs.filter(z => z < 3.5).length / zs.length)}%\\nmoon jellies: ${mz.length} in ${drifts.length} drifts, depths ${mz.map(z => z.toFixed(1)).join(' ')}`; });
  console.log(census);
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1000; c.height = 640; c.id = 'bench'; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#1d4a5c'; g.fillRect(0, 0, 1000, 640); g.fillStyle = '#fff'; g.font = '13px sans-serif';
    const W = Wildlife.art, base = Wildlife.debug().jellyBloom.jel[0];
    [-1.3, -0.6, 0, 0.6, 1.3].forEach((pt, i) => { for (const [k, sq] of [[0, 0], [1, 0.9]]) {
      const j = Object.assign({}, base, { x: 0, y: 0, h: 0, pitch: pt, z: 0.5, depth: 0.07, sq, size: 1.1 });
      g.save(); g.translate(100 + i * 190, 90 + k * 140); g.scale(10, 10); W.drawGoldJelly(g, j); g.restore(); }
      g.fillText(pt < 0 ? 'going down ' + Math.round(-pt * 57) + '°' : pt > 0 ? 'going up ' + Math.round(pt * 57) + '°' : 'across', 60 + i * 190, 20); });
    g.fillText('top: coasting   below: mid-contraction   (heading up the page, 10x)', 10, 630);
  });
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1000, height: 330 } });
  await b.close(); })();
