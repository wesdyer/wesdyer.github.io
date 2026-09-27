// Probe: the OUTSIDE LOOP at Emberfall — 12 radial gates from the archipelago's centre, each from the
// farthest land on its bearing (+ margin) out to the boundary. Prints the gates (length = the water
// outside the last land), and for each of Wes's races how many gates it crossed.
//   node regatta/eval/_volc_outer.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const trs = fs.readdirSync('regatta/eval/rl/traj').filter(f => /volcanic/.test(f)).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f))).map(j => j.samples.filter(s => s[1] === 1).map(s => ({ x: s[2], y: s[3] })));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate((trs) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const B = VENUE_DOC.volcanic.world.boundary; const poly = B && B.poly ? B.poly.map(([x, y]) => ({ x, y })) : null;
    const inB = (x, y) => poly ? pointInPoly(x, y, poly) : Math.hypot(x, y) < (B && B.circle ? B.circle.r : 6500);
    const hard = state.course.islands.filter(s => !s.awash && s.vertices && VenueDoc.traits(s).hard);
    let cx = 0, cy = 0, n = 0; for (const s of hard) for (const v of s.vertices) { cx += v.x; cy += v.y; n++; } cx /= n; cy /= n;
    const solid = (x, y) => hard.some(s => Math.hypot(x - s.x, y - s.y) < (s.radius || 1e9) && pointInPoly(x, y, s.vertices));
    const gates = [];
    // a gate on the bearing through EVERY island's outermost point (so an island between two bearings
    // still has its own), plus 12 even bearings for the main island's long coasts
    const angs = [...Array(12)].map((_, k) => k / 12 * Math.PI * 2);
    for (const s of hard) { let bv = null, bd = -1; for (const v of s.vertices) { const d = Math.hypot(v.x - cx, v.y - cy); if (d > bd) { bd = d; bv = v; } }
      const a = Math.atan2(bv.x - cx, -(bv.y - cy)); if (!angs.some(q => Math.abs(Math.atan2(Math.sin(q - a), Math.cos(q - a))) < 0.03)) angs.push(a); }
    angs.sort((p1, p2) => ((p1 + 6.2832) % 6.2832) - ((p2 + 6.2832) % 6.2832));
    for (let k = 0; k < angs.length; k++) { const a = angs[k], dx = Math.sin(a), dy = -Math.cos(a); let far = 0, edge = 0;
      for (let d = 0; d < 9000; d += 20) { const x = cx + dx * d, y = cy + dy * d; if (!inB(x, y)) { edge = d; break; } if (solid(x, y)) far = d; }
      gates.push({ k, a: { x: cx + dx * (far + 60), y: cy + dy * (far + 60) }, b: { x: cx + dx * (edge + 50), y: cy + dy * (edge + 50) }, water: edge - far - 60 }); }
    const cross = (p0, q0, a, b) => { const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); return (o(a, b, p0) > 0) !== (o(a, b, q0) > 0) && (o(p0, q0, a) > 0) !== (o(p0, q0, b) > 0); };
    const races = trs.map(t => gates.filter(g => t.some((q, i) => i && cross(t[i - 1], q, g.a, g.b))).map(g => g.k).join(','));
    return { c: [Math.round(cx), Math.round(cy)], bound: B && Object.keys(B), n: gates.length, minWater: Math.min(...gates.map(g => g.water)), gates: gates.map(g => [Math.round(g.a.x), Math.round(g.a.y), Math.round(g.b.x), Math.round(g.b.y)]), races: races.map(r2 => r2.split(',').length + ' of ' + gates.length) }; }, trs);
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();
