// Probe: ten minutes of Emberfall's iguanas against the research — modes, walking and swimming speeds (u/s; 29 u/s ≈
// 1 m/s), the tail beat, how far out they go, any walking on the water or swimming on the rock, any dive on the way home,
// the warm ones pointed at the sun.   node regatta/eval/_volc_iguana_behave.js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const H = Wildlife.debug().igHeaps, all = H.flatMap(G => G.members.map(m => [G, m])), dt = 1 / 30;
    const modes = {}, spd = { walk: [], swim: [], climbWater: [] }, prev = new Map(all.map(([, m]) => [m, [m.x, m.y, m.mode, m.home]]));
    let walkWet = 0, swimDry = 0, homeDives = 0, trips = 0, grazes = 0, maxOut = 0, sphHz = [];
    for (let i = 0; i < 30 * 600; i++) { Wildlife.update(dt);
      for (const [G, m] of all) { const [px, py, pm, ph] = prev.get(m), v = Math.hypot(m.x - px, m.y - py) / dt;
        modes[m.mode] = (modes[m.mode] || 0) + 1;
        if (m.mode === pm && v > 0.5) { if (m.mode === 'walk' || (m.mode === 'climb' && pointOnLand(m.x, m.y))) spd.walk.push(v / Math.sqrt(m.size)); if (m.mode === 'swim') spd.swim.push(v / Math.pow(m.size, 1.3)); }
        if (m.mode === 'walk' && !pointOnLand(m.x, m.y)) walkWet++;
        if (m.mode === 'swim' && pointOnLand(m.x, m.y)) swimDry++;
        if (pm === 'swim' && ph && m.mode === 'dive') homeDives++;
        if (pm !== 'swim' && m.mode === 'swim' && !m.home) trips++;
        if (pm !== 'graze' && m.mode === 'graze') grazes++;
        if (m.mode === 'swim' || m.mode === 'under') maxOut = Math.max(maxOut, Math.hypot(m.x - G.w.x, m.y - G.w.y));
        prev.set(m, [m.x, m.y, m.mode, m.home]); } }
    // the beat: the swim phase's rate
    const sw = all.find(([, m]) => m.mode === 'swim'); if (sw) { const m = sw[1], s0 = m.sph; Wildlife.update(1); sphHz.push((m.sph - s0) / 6.283); }
    const med = (a) => a.length ? a.sort((x, y) => x - y)[a.length >> 1].toFixed(1) : '-';
    const basks = all.filter(([, m]) => m.mode === 'bask'), warmUp = basks.filter(([, m]) => m.warm > 0.6), aimed = warmUp.filter(([, m]) => Math.abs(((m.h + Math.PI / 4 + 9 * Math.PI) % (2 * Math.PI)) - Math.PI) < 0.45);
    const tot = Object.values(modes).reduce((a, b) => a + b, 0), pct = {}; for (const k in modes) pct[k] = (100 * modes[k] / tot).toFixed(2) + '%';
    return { iguanas: all.length, modes: pct, walk_us_adult: med(spd.walk), swim_us_adult: med(spd.swim), beatHz: sphHz.map(x => x.toFixed(2)), trips, grazes, maxOut: Math.round(maxOut),
      walkOnWater: walkWet, swimOnRock: swimDry, divesHeadingHome: homeDives, warmPointedAtSun: aimed.length + '/' + warmUp.length }; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();
