// Probe: clearance of Otter Point's animal paths from anything solid (land, rock colliders): for each
// path of WILDLIFE.otter (sharks' patrols, blue whales' loops) the smallest distance from a point on
// the path to solid, sampled every 40 u, and where it is. A blue whale needs ~260 u, a shark ~80.
//   node regatta/eval/_otter_clear.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const clear = (x, y) => { for (let r = 0; r <= 500; r += 20) for (let i = 0; i < (r ? 24 : 1); i++) { const a = i / 24 * Math.PI * 2; if (pointOnLand(x + Math.cos(a) * r, y + Math.sin(a) * r)) return r; } return 500; };
    const C = Wildlife.WILDLIFE.otter, out = [];
    const walk = (name, P, loop) => { let best = 1e9, at = null; for (let k = 0; k < P.length - (loop ? 0 : 1); k++) { const a = P[k], q = P[(k + 1) % P.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]);
        for (let s = 0; s <= L; s += 40) { const x = a[0] + (q[0] - a[0]) * s / L, y = a[1] + (q[1] - a[1]) * s / L, c = clear(x, y); if (c < best) { best = c; at = [Math.round(x), Math.round(y)]; } } }
      out.push(`${name}: min clearance ${best} at ${at}`); };
    // a path point too near solid: the nearest spot with room (150 u) — a suggestion to move it to
    const room = (P, need) => P.map(([x, y]) => { if (clear(x, y) >= need) return null; for (let r = 40; r < 1200; r += 40) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (clear(px, py) >= need) return `[${x},${y}] -> [${Math.round(px)},${Math.round(py)}]`; } return `[${x},${y}] -> none`; }).filter(Boolean);
    C.whites.forEach((W, i) => { walk('shark ' + i, W.path, !W.pingpong); const s2 = room(W.path, 150); if (s2.length) out.push('   move ' + s2.join('  ')); });
    C.blues.pods.forEach((P, i) => walk('blue ' + i, P.path, true));
    return out; });
  console.log(r.join('\n')); await b.close(); })();
