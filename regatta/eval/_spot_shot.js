// The race view parked at one world point on a venue, with each shape there listed (kind, curved?).
//   ROOT=<repo root> SHOT=file node regatta/eval/_spot_shot.js venue x y [zoom]
const { chromium } = require('playwright'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.'); const [V, X, Y, Z] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file://' + path.join(ROOT, 'regatta/index.html')); await p.waitForTimeout(800);
  const info = await p.evaluate(([v, x, y, z]) => { settings.venue = v; selectVenue(v); resetGame(); startRace();
    state.paused = true; state.camera.target = 'none'; state.camera.mode = 'north'; state.camera.rotation = 0; state.camera.x = x; state.camera.y = y; if (z) state.camera.zoom = z;
    document.querySelectorAll('.hud, #hud, .leaderboard, #leaderboard, .overlay').forEach(el => (el.style.display = 'none')); draw();
    const near = (state.course.islands || []).filter(i => Math.hypot(i.x - x, i.y - y) < i.radius + 300).map(i => `${i.id}:${i.kind}${i.smooth ? '(curved)' : ''}`);
    const marks = (state.course.marks || []).filter(m => Math.hypot(m.x - x, m.y - y) < 600).map(m => `mark ${m.id || ''}@${Math.round(m.x)},${Math.round(m.y)}`);
    return near.concat(marks).join(', '); }, [V, +X, +Y, Z ? +Z : 0]);
  await p.waitForTimeout(200); await p.screenshot({ path: process.env.SHOT }); console.log(info); await b.close(); })();
