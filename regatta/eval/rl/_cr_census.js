// PT-050 PHASE 1 CENSUS: how does the fleet spread over a leg's candidate routes?
//   node _cr_census.js <tree> <seed0> <n> <venue>      CR env: JSON for window.__CR (e.g. '{"off":1}')
// Nine bots, player parked. For each leg, the first bot's candidates (3 s into the leg, _crGenerate with
// stock knobs) are the reference; every bot's track on that leg is assigned to the candidate whose own
// water it sat in most. Reports per leg: candidates (plain time), the share on each, the top share; and
// per race finish times, land/boat contact episodes, pick switches before the fork.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TREE = path.join(__dirname, process.argv[2] || 'treeCR1'), S0 = +(process.argv[3] || 9400), N = +(process.argv[4] || 4), V = process.argv[5] || 'otter';
const CR = process.env.CR ? JSON.parse(process.env.CR) : null;
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.join(TREE, 'regatta/index.html'));
  await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../rate_harness.js'), 'utf8') });
  const res = await page.evaluate(({ S0, N, CR }) => {
    if (CR) window.__CR = CR;
    const legs = {}, fin = [], ev = { land: 0, boat: 0 }, sw = { n: 0, boats: 0 };
    let lastLand = new Map(), lastBoat = new Map();
    const prevOn = window.onRaceEvent;
    for (let s = S0; s < S0 + N; s++) {
      window.rateHarness.seed = s; resetGame(); startRace();
      const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer);
      const ref = {}, hits = {}, pend = {}, lastPick = new Map();
      window.onRaceEvent = (name, d) => {
        const t = state.race.timer;
        if (name === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe) {
          const k = d.boat.id; if (!(t - (lastLand.get(k) ?? -9) < 2)) ev.land++; lastLand.set(k, t);
        }
        if (name === 'collision_boat' && d && d.boat && d.other && !d.boat.isPlayer && !d.other.isPlayer) {
          const k = Math.min(d.boat.id, d.other.id) + ':' + Math.max(d.boat.id, d.other.id);
          if (!(t - (lastBoat.get(k) ?? -9) < 2)) ev.boat++; lastBoat.set(k, t);
        }
      };
      for (let it = 0; it < 60 * 600; it++) {
        if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; }
        update(1 / 60);
        if (state.race.status !== 'racing' || it % 30) continue;
        const G = state.course.botGrid;
        for (const b of bots) {
          const L = b.raceState.leg; if (b.raceState.finished || L < 1) continue;
          if (!ref[L] && !pend[L]) pend[L] = { b, t: state.race.timer + 3 };
          const cr = b.controller._cr;
          if (cr && cr.leg === L && !cr.fork && cr.pick >= 0) {
            const k = b.id + ':' + L, lp = lastPick.get(k);
            if (lp != null && lp !== cr.pick) sw.n++;
            lastPick.set(k, cr.pick);
          }
          if (ref[L] && ref[L].length >= 2 && G) {
            const c = G.cell(b.x, b.y), id = c[1] * G.n + c[0];
            const h = (hits[L] = hits[L] || {}); const hb = (h[b.id] = h[b.id] || new Array(ref[L].length).fill(0));
            ref[L].forEach((r, i) => { if (r.ownSet.has(id)) hb[i]++; });
          }
        }
        for (const L of Object.keys(pend)) {
          const q = pend[L]; if (state.race.timer < q.t) continue; delete pend[L];
          const c = q.b.controller;
          ref[L] = (G && c.gridGoal) ? c._crGenerate(G, c.gridGoal.x, c.gridGoal.y, {}) : [];
        }
        if (bots.every(b => b.raceState.finished) || state.race.timer > 600) break;
      }
      for (const b of bots) fin.push(b.raceState.finished ? +state.race.timer.toFixed(1) && b.raceState.finishTime : null);
      for (const L of Object.keys(ref)) {
        if (ref[L].length < 2) { (legs[L] = legs[L] || { n: 0, multi: 0, share: null, tsail: null }).n++; continue; }
        const lg = (legs[L] = legs[L] || { n: 0, multi: 0, share: null, tsail: null }); lg.n++; lg.multi++;
        const sh = new Array(ref[L].length + 1).fill(0);
        for (const b of bots) { const hb = (hits[L] || {})[b.id]; if (!hb || hb.every(x => !x)) { sh[ref[L].length]++; continue; } sh[hb.indexOf(Math.max(...hb))]++; }
        (lg.races = lg.races || []).push({ seed: s, tsail: ref[L].map(r => +r.tsail.toFixed(1)), share: sh });
      }
    }
    window.onRaceEvent = prevOn;
    return { legs, fin, ev, sw };
  }, { S0, N, CR });
  const f = res.fin.filter(x => x != null).sort((a, b) => a - b);
  console.log(`${V} ${process.argv[2]} CR=${process.env.CR || '-'}  races ${N}  fins ${f.length}/${res.fin.length}  med ${f[f.length >> 1]?.toFixed(1)}  mean ${(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1)}  land ep/bot ${(res.ev.land / res.fin.length).toFixed(2)}  boat ep/bot ${(res.ev.boat / res.fin.length).toFixed(2)}  pick switches ${res.sw.n}`);
  for (const [L, lg] of Object.entries(res.legs)) {
    if (!lg.races) { console.log(`  leg ${L}: one route (${lg.n} races)`); continue; }
    let top = 0, tot = 0;
    for (const r of lg.races) { const m = Math.max(...r.share.slice(0, -1)); top += m; tot += r.share.reduce((a, b) => a + b, 0) - r.share[r.share.length - 1]; }
    console.log(`  leg ${L}: forks in ${lg.multi}/${lg.n}  top-route share ${(100 * top / Math.max(1, tot)).toFixed(0)}%  ` + lg.races.map(r => `[${r.tsail.join('/')}s → ${r.share.join('/')}]`).join(' '));
  }
  await browser.close();
})();
