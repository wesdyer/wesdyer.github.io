// ROUTE BALANCE: why does each bot pick its route?   node _vb_why.js <tree> <seed> <venue> '<{name:[[x,y]..]}>' [tSecs,..]
// At each probe time, for every bot on leg 1: the route its CURRENT gridPath is on (nearest via), and the router
// cost / tsail of every named via route FROM THE BOAT'S POSITION on the boat's own grid (jam hints included).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TREE = path.join(__dirname, process.argv[2]), S = +process.argv[3], V = process.argv[4];
const VIAS = JSON.parse(process.argv[5]), TS = (process.argv[6] || '-5,0,5,15,30').split(',').map(Number);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.join(TREE, 'regatta/index.html'));
  await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../rate_harness.js'), 'utf8') });
  const out = await page.evaluate(({ S, VIAS, TS }) => {
    window.rateHarness.seed = S; resetGame(); startRace();
    const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer), log = [];
    const G = state.course.botGrid || state.course._botGrid || state.course.grid;
    const goal = (() => { const L = state.course.dmc && state.course.dmc.legs[1]; return L ? [L.pts[L.pts.length - 1].x, L.pts[L.pts.length - 1].y] : null; })();
    const near = (pts) => { let best = '-', bd = 1e9; for (const [nm, vs] of Object.entries(VIAS)) for (const v of vs) for (const q of pts) { const d = Math.hypot(q.x - v[0], q.y - v[1]); if (d < bd) { bd = d; best = nm; } } return bd < 600 ? best : '-'; };
    let ti = 0;
    for (let it = 0; it < 60 * 400 && ti < TS.length; it++) {
      if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; }
      update(1 / 60);
      const t = state.race.status === 'racing' ? state.race.timer : -(state.race.countdown || state.race.startTimer || 0);
      if (t < TS[ti]) continue; ti++;
      for (const b of bots) {
        const c = b.controller || b.ai || b.bot; const nav = c && (c.nav || c.navigation || c);
        const gp = (nav && nav.gridPath) || (c && c.gridPath) || [];
        const row = { t: Math.round(t), name: b.name, x: b.x | 0, y: b.y | 0, leg: b.raceState.leg, path: near(gp), n: gp.length };
        if (G && goal) for (const [nm, vs] of Object.entries(VIAS)) {
          let tt = 0, cc = 0, ok = true; const pts = [[b.x, b.y], ...vs, goal];
          for (let i = 0; i + 1 < pts.length; i++) { const r = SailCheck.pathSailable(G, pts[i], pts[i + 1]); if (!r) { ok = false; break; } tt += r.tsail; cc += r.cost; }
          row[nm] = ok ? Math.round(cc) + '/' + Math.round(tt) : 'x';
        }
        const r0 = G && goal && SailCheck.pathSailable(G, [b.x, b.y], goal); row.free = r0 ? Math.round(r0.cost) + ' ' + near(r0.map(q => ({ x: q[0], y: q[1] }))) : 'x';
        log.push(row);
      }
    }
    return { log, keys: Object.keys(state.course).filter(k => /grid/i.test(k)), ctl: Object.keys(bots[0]).filter(k => /contr|ai|bot|nav/i.test(k)) };
  }, { S, VIAS, TS });
  console.log('grid keys', out.keys, 'boat keys', out.ctl);
  for (const r of out.log) console.log(JSON.stringify(r));
  await browser.close();
})();
