// THREADING PUSH: what is a boat doing while it is under 1 kt inside a box?  node _th_slow.js <tree> <seed0> <n> '<x0,y0,x1,y1>'
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TREE = path.join(__dirname, process.argv[2] || 'treeTH2b'), S0 = +(process.argv[3] || 9400), N = +(process.argv[4] || 4);
const [X0, Y0, X1, Y1] = (process.argv[5] || '-2250,950,-1850,1150').split(',').map(Number);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.join(TREE, 'regatta/index.html'));
  await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'swamp');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../rate_harness.js'), 'utf8') });
  console.log(await page.evaluate(({ S0, N, X0, Y0, X1, Y1, TMAX }) => {
    const tally = {}, add = (k, v) => tally[k] = (tally[k] || 0) + v; const ex = [];
    for (let s = S0; s < S0 + N; s++) {
      window.rateHarness.seed = s; resetGame(); startRace();
      const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer);
      for (let it = 0; it < 60 * 400; it++) { if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; } update(1 / 60);
        if (state.race.status !== 'racing' || it % 6) continue;
        for (const b of bots) { if (b.raceState.finished || b.speed * 4 >= 1 || b.x < X0 || b.x > X1 || b.y < Y0 || b.y > Y1) continue;
          const c = b.controller, w = getWindAt(b.x, b.y), twa = Math.abs(normalizeAngle(b.heading - w.direction)) * 180 / Math.PI;
          const k = `thr${c._threadH != null ? 1 : 0} ${c.wiggleActive ? 'W' : c.clearanceTimer > 0 ? 'C' : c.livenessState} role ${c.avoidanceRole} lim ${(c.speedLimit ?? 1) < 0.9 ? 'eased' : 'full'} twa ${twa < 40 ? 'irons' : twa < 100 ? 'upwind' : 'down'} leg${b.raceState.leg} wind${w.speed < 2 ? '<2' : '>2'}`;
          add(k, 0.1); if (ex.length < 12 && Math.random() < 0.02) ex.push(`${s} t${state.race.timer.toFixed(0)} ${b.name} (${Math.round(b.x)},${Math.round(b.y)}) hd${Math.round(b.heading*57.3)} wind ${Math.round(w.direction*57.3)}/${w.speed.toFixed(1)} ${k}`); }
        if (state.race.timer > TMAX) break; }
    }
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 14).map(e => e[1].toFixed(0).padStart(5) + ' boat-s  ' + e[0]).join('\n') + '\n' + ex.join('\n');
  }, { S0, N, X0, Y0, X1, Y1, TMAX: +(process.env.TMAX || 200) }));
  await browser.close();
})();
