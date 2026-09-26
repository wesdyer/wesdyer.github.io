const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof pointOnLand === 'function');
  const r = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame();
    const L = pointOnLand;
    const waterDist = (x, y, max) => { for (let d = 10; d <= max; d += 10) for (let a = 0; a < 16; a++) { const q = a / 16 * 6.283; if (!L(x + Math.cos(q) * d, y + Math.sin(q) * d)) return d; } return 999; };
    const landDist = (x, y, max) => { for (let d = 10; d <= max; d += 10) for (let a = 0; a < 16; a++) { const q = a / 16 * 6.283; if (L(x + Math.cos(q) * d, y + Math.sin(q) * d)) return d; } return 999; };
    const out = { props: [], islands: [], clear: [] };
    for (const pr of state.course.props) if (/talus|tower/.test(pr.kind)) out.props.push([pr.id, pr.kind.replace('redrock-', ''), Math.round(pr.x), Math.round(pr.y), L(pr.x, pr.y) ? 'land' : 'WATER', waterDist(pr.x, pr.y, 400)]);
    for (const s of state.course.islands) out.islands.push([s.id, VenueDoc.traits(s).hard ? 'hard' : 'soft', s.kind]);
    // open water: grid, clearance >= 180
    for (let x = -3000; x <= 1800; x += 150) for (let y = -2300; y <= 2200; y += 150) if (!L(x, y)) { const c = landDist(x, y, 300); if (c >= 180) out.clear.push([x, y, c]); }
    return out;
  });
  console.log(r.props.map(a => a.join(' ')).join('\n'));
  console.log(r.islands.map(a => a.join(' ')).join(' | '));
  console.log('clear water (>=180 from land):', r.clear.map(a => a.join(',')).join('  '));
  await b.close();
})();
