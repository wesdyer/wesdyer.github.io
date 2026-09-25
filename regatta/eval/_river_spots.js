// Probe: candidate wildlife spots on Sockeye Run. For each anchor, water points 20-60 u off the
// bank (the shallows), with the stream there (kn, and the direction it runs TO, radians) and the
// rapids' turbulence — bears and holding salmon want the slack edge beside fast water.
//   node regatta/eval/_river_spots.js "x,y;x,y;..."     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const anchors = (process.argv[2] || '5530,-6050').split(';').map(s => s.split(',').map(Number));
  console.log(await p.evaluate((anchors) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); resetGame();
    const landDist = (x, y) => { for (let r = 5; r <= 120; r += 5) for (let a = 0; a < 16; a++) if (pointOnLand(x + Math.cos(a / 16 * 6.283) * r, y + Math.sin(a / 16 * 6.283) * r)) return r; return 999; };
    return anchors.map(([ax, ay]) => { const c = [];
      for (let dx = -240; dx <= 240; dx += 20) for (let dy = -240; dy <= 240; dy += 20) { const x = ax + dx, y = ay + dy; if (pointOnLand(x, y)) continue;
        const d = landDist(x, y); if (d < 20 || d > 60) continue; const cu = getCurrentAt(x, y) || { speed: 0, direction: 0 };
        c.push({ x, y, d, kn: +cu.speed.toFixed(1), dir: +cu.direction.toFixed(2), turb: +rapidsTurbAt(x, y).toFixed(2), off: Math.round(Math.hypot(dx, dy)) }); }
      c.sort((a, b) => a.off - b.off);
      return `@${ax},${ay}: ` + c.slice(0, 8).map(o => `(${o.x},${o.y}) bank${o.d} ${o.kn}kn dir${o.dir} turb${o.turb}`).join('\n      '); }).join('\n'); }, anchors));
  await b.close(); })();
