// DO THE TWO CUES AGREE? The tone and the comet density both claim to say where the pressure
// is, and if they disagree the player is worse off than with one of them. Draws the real
// frame, then the FIELD's own contour over it in magenta, and prints comet counts inside
// versus outside that contour. The picture and the number answer the same question.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const venue = process.argv[2] || 'lake';
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1300);
  const r = await p.evaluate((v) => {
    state.paused = true; settings.venue = v; resetGame(); startRace();
    for (const bt of state.boats) bt.isPlayer = false;
    for (let i = 0; i < 3000; i++) update(1 / 60);
    let best = null;
    for (const g of state.gusts) {
      const s = Math.abs(g.speedDelta) * Math.min(g.radiusX, g.radiusY);
      if (!best || s > best.s) best = { g, s };
    }
    // ⚠️ PARK THE CAMERA, THEN LET THE POPULATION BUILD. Comets spawn in a box around the
    // CAMERA, so moving it onto a cell after the fact frames water no comet has reached —
    // which is why the first run of this counted one comet on screen and called the ratio
    // zero. `target: 'none'` stops the follow dragging it back to the boat.
    if (best) { state.camera.x = best.g.x; state.camera.y = best.g.y; }
    state.camera.rotation = 0;
    state.camera.target = 'none';
    for (let i = 0; i < 900; i++) update(1 / 60);
    for (let i = 0; i < 5; i++) draw();
    // The cell outlines, from the same skewed ellipse the sampler uses.
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.translate(-state.camera.x, -state.camera.y);
    ctx.lineWidth = 2;
    for (const g of state.gusts) {
      ctx.strokeStyle = g.type === 'gust' ? 'rgba(255,0,200,0.9)' : 'rgba(0,255,180,0.9)';
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rotation);
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * Math.PI * 2;
        const rx = Math.cos(a) * g.radiusX, ry = Math.sin(a) * g.radiusY;
        const px = rx >= 0 ? rx * PUFF_NOSE : rx * PUFF_TAIL;
        if (i === 0) ctx.moveTo(px, ry); else ctx.lineTo(px, ry);
      }
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    // Counts inside vs outside, on screen only.
    const puffAt = (x, y) => {
      let m = 0;
      for (const g of state.gusts) {
        const dx = x - g.x, dy = y - g.y;
        const c = Math.cos(-g.rotation), s2 = Math.sin(-g.rotation);
        const rx0 = dx * c - dy * s2, ry = dx * s2 + dy * c;
        const rx = rx0 >= 0 ? rx0 / PUFF_NOSE : rx0 / PUFF_TAIL;
        const d2 = (rx * rx) / (g.radiusX * g.radiusX) + (ry * ry) / (g.radiusY * g.radiusY);
        if (d2 > 1) continue;
        const t = 1 - Math.sqrt(d2);
        const life = Math.min(g.age / 5, 1) * Math.min((g.duration - g.age) / 5, 1);
        const i2 = Math.max(0, t * t * (3 - 2 * t) * life) * (g.speedDelta >= 0 ? 1 : -1);
        if (Math.abs(i2) > Math.abs(m)) m = i2;
      }
      return m;
    };
    let inN = 0, outN = 0, inA = 0, outA = 0;
    for (const q of state.particles) {
      if (q.type !== 'wind') continue;
      if (Math.abs(q.x - state.camera.x) > canvas.width / 2 || Math.abs(q.y - state.camera.y) > canvas.height / 2) continue;
      if (puffAt(q.x, q.y) > 0.25) inN++; else outN++;
    }
    const M = 40000;
    for (let i = 0; i < M; i++) {
      const x = state.camera.x + (Math.random() - 0.5) * canvas.width;
      const y = state.camera.y + (Math.random() - 0.5) * canvas.height;
      if (puffAt(x, y) > 0.25) inA++; else outA++;
    }
    const area = canvas.width * canvas.height / M;
    return { cells: state.gusts.length,
             inDen: inA ? +(inN / (inA * area / 1e6)).toFixed(1) : null,
             outDen: outA ? +(outN / (outA * area / 1e6)).toFixed(1) : null,
             inN, outN };
  }, venue);
  fs.writeFileSync(`${OUT}/_agree_${venue}.png`,
    await p.screenshot({ clip: { x: 340, y: 130, width: 1000, height: 700 } }));
  const ratio = r.outDen ? (r.inDen / r.outDen).toFixed(2) : '—';
  console.log(`  ${venue}: ${r.cells} cells   comets/1e6u²  in-gust ${r.inDen} (n=${r.inN})   elsewhere ${r.outDen} (n=${r.outN})   ratio ${ratio}`);
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
