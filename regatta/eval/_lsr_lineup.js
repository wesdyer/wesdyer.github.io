// Bench: Pearl Lagoon, Gatorgrass Bayou and Sockeye Run's animals in a row beside the hull, at race scale (x1.2)
// and x3 — sizes against the boat (Oct 18 2026, Wes: "1.5x or less" at sea level). One PNG per venue.
//   node regatta/eval/_lsr_lineup.js out-dir      (from the repo root) -> out-dir/lineup-<venue>.png
const { chromium } = require('playwright'); const path = require('path');
const ROWS = {
  lagoon: [['green sea turtle', 'A.drawCruiser(g, { kind: "seaturtle", x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: "cruise" })'],
    ['eagle ray', 'A.drawCruiser(g, { kind: "eagleray", x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: "cruise" })'],
    ['blacktip', 'A.drawCruiser(g, { kind: "reefshark", x: 0, y: 0, h: 0, depth: 0.5, ph: 0, size: 1, mode: "cruise" })'],
    ['tangs (school)', 'A.drawShoal(g, { cfg: { kind: "yellowtang" }, cx: 0, cy: 0, fish: Array.from({ length: 14 }, (_, i) => ({ x: Math.cos(i * 2.4) * (4 + i * 1.6), y: Math.sin(i * 2.4) * (3 + i * 1.1), h: 0.3, size: 0.8 + (i % 4) * 0.08, ph: i, spd: 3 })) })']],
  swamp: [['alligator', 'A.drawGator(g, { x: 0, y: 0, h: 0, mode: "float", sink: 0, bob: 0, i: 0 })'],
    ['egret', 'A.drawEgret(g, { x: 0, y: 0, h: 0, mode: "stand", bob: 0, neck: 0 })'],
    ['egret flying', 'A.drawEgret(g, { x: 0, y: 0, h: 0, mode: "fly", flap: 0, z: 0 })'],
    ['anhinga drying', 'A.drawAnhinga(g, { px: 0, py: 0, x: 0, y: 0, ph: 0, snag: 0, mode: "dry", flap: 0, t: 0, sink: 0, splash: 0, trail: [] })'],
    ['anhinga swimming', 'A.drawAnhinga(g, { px: 0, py: 0, x: 0, y: 0, h: 0, ph: 0, mode: "swim", flap: 0, t: 0, upT: 9, sink: 0, splash: 0, trail: [] })'],
    ['bullfrogs', '[[-6, 0, 1], [3, -2, 0.85], [8, 4, 0.75]].forEach(([x, y, s]) => A.drawFrog(g, x, y, 1.2, s, "sit"))']],
  river: [['brown bear', 'A.drawBear(g, { i: 0, x: 0, y: 0, h: 0, up: 0, mode: "watch", rear: 0, lunge: 0, look: 0, splash: 0, fish: 0, kn: 0 })'],
    ['bear eating', 'A.drawBear(g, { i: 0, x: 0, y: 0, h: 0, up: 0, mode: "eat", rear: 0, lunge: 0, look: 0, splash: 0, fish: 1, kn: 0 })'],
    ['sockeye (run)', '[[0, -14, 1], [-5, -4, 0.9], [4, 2, 1.05], [-2, 10, 0.95], [6, 16, 0.88]].forEach(([x, y, s], i) => A.drawSockeye(g, x, y, 0, s, 0, 0.28, i === 3))'],
    ['bald eagle', 'A.drawEagle(g, { i: 0, x: 0, y: 0, h: 0, z: 0, mode: "soar", flap: 0, fish: 0, splash: 0 })'],
    ['eagle + fish', 'A.drawEagle(g, { i: 0, x: 0, y: 0, h: 0, z: 0, mode: "climb", flap: 0, fish: 1, splash: 0 })'],
    ['otter swimming', 'A.drawOtter(g, { i: 0, x: 0, y: 0, h: 0, rh: 0, size: 1, dip: 0, ring: 0, trail: [], trailT: 0, curl: 0 }, false)'],
    ['otters on the jam', '[0, 1, 2, 3].forEach(i => A.drawOtter(g, { i, x: (i - 1.5) * 3.4, y: 0, h: 0, rh: Math.PI / 2, size: i ? 0.9 : 1.08, dip: 0, ring: 0, trail: [], trailT: 0, curl: 0.2 }, true))']],
};
(async () => { const b = await chromium.launch(); const out = process.argv[2] || '.';
  for (const venue of Object.keys(ROWS)) {
    const p = await b.newPage({ viewport: { width: 1800, height: 600 } });
    await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); selectVenue(v); resetGame(); }, venue);
    await p.waitForTimeout(2500);
    await p.evaluate(([row, venue]) => { const A = Wildlife.art, oc = state.camera; state.camera = null; A.setT(10);
      const fns = row.map(([n, src]) => [n, new Function('A', 'g', src)]);
      const g0 = document.createElement('canvas').getContext('2d'); for (const [, f] of fns) try { f(A, g0); } catch (e) {}   // (ask for the sprites)
      return new Promise(res => setTimeout(() => {
        const c = document.createElement('canvas'); c.width = 1800; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 1800, 600);
        const hull = (s) => { g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 1 / s; g.beginPath(); g.moveTo(0, -27.5); g.quadraticCurveTo(10, -10, 8, 27.5); g.lineTo(-8, 27.5); g.quadraticCurveTo(-10, -10, 0, -27.5); g.fill(); g.stroke(); };
        const all = [['hull (55)', () => hull(1)]].concat(fns.map(([n, f]) => [n, () => f(A, g)]));
        for (const [sc, y0, lab] of [[1.2, 130, 'x1.2 (race scale)'], [3, 420, 'x3']]) {
          all.forEach(([n, f], i) => { g.save(); g.translate(90 + i * 210, y0); g.scale(sc, sc); try { f(); } catch (e) { g.restore(); g.save(); g.fillStyle = '#f66'; g.fillText('err ' + e.message, 90 + i * 210 - 60, y0); } g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(n, 40 + i * 210, y0 + (sc > 2 ? 150 : 90)); });
          g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(lab + ' — ' + venue, 1560, y0 - 100); }
        state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); res(); }, 1200)); }, [ROWS[venue], venue]);
    await p.screenshot({ path: path.join(out, 'lineup-' + venue + '.png'), clip: { x: 0, y: 0, width: 1800, height: 600 } }); await p.close(); }
  await b.close(); })();
