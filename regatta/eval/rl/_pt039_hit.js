// PT-039: a boat sailed square at the start-cove swim line, at speed — does it cross the rope?
//   ROOT=<checkout's regatta dir> node eval/rl/_pt039_hit.js
const { chromium } = require('playwright'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  const r = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lake', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('lake'); resetGame(); startRace(); state.race.status = 'racing';
    const me = state.boats[0]; for (const o of state.boats) if (o !== me) { o.x = 1e6; o.y = 1e6; }
    const seg = state.course.props.find(q => q.id === 'prop-16');   // mid-line, the cove's rope
    const h = seg.heading || 0, nx = Math.cos(h), ny = Math.sin(h);   // the rope runs along the prop's local y; its normal is local x
    const out = [];
    for (const side of [1, -1]) {
      me.x = seg.x - nx * side * 160; me.y = seg.y - ny * side * 160; me.heading = Math.atan2(nx * side, -ny * side); me.speed = 2.5;
      const s0 = (me.x - seg.x) * nx + (me.y - seg.y) * ny; let crossed = false, minKt = 99;
      for (let i = 0; i < 30 * 6; i++) { state.keys.ArrowLeft = state.keys.ArrowRight = false; for (const o of state.boats) if (o !== me) { o.x = 1e6; o.y = 1e6; } update(1 / 30);
        const sN = (me.x - seg.x) * nx + (me.y - seg.y) * ny; if (Math.sign(sN) !== Math.sign(s0) && Math.abs(sN) > 25) crossed = true; minKt = Math.min(minKt, me.speed * 4); }
      out.push({ from: side > 0 ? 'outside' : 'inside', crossedRope: crossed, slowestKt: +minKt.toFixed(1) });
    }
    return out;
  });
  console.log(JSON.stringify(r)); await b.close(); })();
