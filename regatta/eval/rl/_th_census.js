// THREADING CENSUS (PT-050 push, 2026-10-17): per-boat contacts split trees/banks/boats, penalties, seconds under
// 1 kt by place, contact context (threading? avoidance role? wiggle/escape?), east/west route at the Bayou.
//   node _th_census.js <trials> <seed0> <tree> [venue]     (THREAD='{...}' -> window.__THREAD)
// Attribution only: the player boat is parked (nine bots), unlike ocean_bench's ten-bot races.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SEEDS = +(process.argv[2] || 8), BASE = +(process.argv[3] || 9400), TREE = path.join(__dirname, process.argv[4] || 'treeTH1'), V = process.argv[5] || 'swamp';
(async () => {
  const browser = await chromium.launch(); const chunks = 4, per = Math.ceil(SEEDS / chunks);
  const res = await Promise.all([...Array(chunks).keys()].map(async c => {
    const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(J => { if (J) window.__THREAD = JSON.parse(J); }, process.env.THREAD || '');
    await page.goto('file://' + path.join(TREE, 'regatta/index.html'));
    await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../rate_harness.js'), 'utf8') });
    const r = await page.evaluate(({ s0, s1 }) => {
      const out = [];
      for (let s = s0; s < s1; s++) {
        window.rateHarness.seed = s; resetGame(); startRace();
        const P = state.boats.find(b => b.isPlayer), bots = state.boats.filter(b => !b.isPlayer);
        const rec = new Map(bots.map(b => [b, { fin: null, landE: 0, lastL: -9, east: false, hits: [], thr: 0, boatE: 0, lastB: {}, tree: 0 }]));
        const gT = state.course._botGridStatic || state.course.botGrid, smT = { v: false };
        const prev = window.onRaceEvent;
        window.onRaceEvent = (ev, d) => { if (ev === 'collision_boat' && d && rec.has(d.boat) && d.other) { const q = rec.get(d.boat), k = d.other.id || d.other.name; if (state.race.timer - (q.lastB[k] ?? -9) > 2) q.boatE++; q.lastB[k] = state.race.timer; } if (ev === 'collision_island' && d && rec.has(d.boat) && !d.isFloe) { const q = rec.get(d.boat); if (ev === 'collision_island' && state.race.timer - q.lastL > 1) { SailCheck.trueClear(gT, d.boat.x, d.boat.y, 80, smT); if (smT.v) q.tree++; q.landE++; const cc = d.boat.controller; q.hits.push([Math.round(d.boat.x), Math.round(d.boat.y), cc && cc._threadH != null ? 1 : 0, cc ? cc.avoidanceRole : '', cc ? cc.riskState : '', cc ? (cc.wiggleActive ? 'W' : cc.clearanceTimer > 0 ? 'C' : cc.livenessState) : '', +(d.boat.speed * 4).toFixed(1)]); } q.lastL = state.race.timer; } if (prev) prev(ev, d); };
        for (let it = 0; it < 60 * 700; it++) {
          if (P) { P.x = 1e6; P.y = 1e6; P.speed = 0; }
          update(1 / 60);
          if (state.race.status !== 'racing') continue;
          for (const b of bots) { const q = rec.get(b); if (b.raceState.finished) { if (q.fin == null) q.fin = b.raceState.finishTime; continue; } if (b.x > 400 && b.y > 300) q.east = true; if (b.controller && b.controller._threadH != null) q.thr += 1 / 60; if (b.speed * 4 < 1) { q.slow = (q.slow || 0) + 1 / 60; const k = Math.round(b.x / 150) * 150 + ',' + Math.round(b.y / 150) * 150; (q.slowAt = q.slowAt || {})[k] = (q.slowAt[k] || 0) + 1 / 60; } }
          if (bots.every(b => b.raceState.finished) || state.race.timer > 600) break;
        }
        for (const b of bots) { const q = rec.get(b); q.pen = b.raceState.totalPenalties; delete q.lastB; }
        for (const b of bots) { const q = rec.get(b); if (q.fin == null) q.last = [Math.round(b.x), Math.round(b.y), s]; }
        window.onRaceEvent = prev; out.push([...rec.values()]);
      }
      return out;
    }, { s0: BASE + c * per, s1: Math.min(BASE + SEEDS, BASE + (c + 1) * per) });
    await page.close(); return { r, errs };
  }));
  await browser.close();
  const races = res.flatMap(x => x.r), all = races.flat(), errs = res.flatMap(x => x.errs);
  const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : NaN, med = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN; };
  const fx = v => isNaN(v) ? '-' : v.toFixed(1);
  const fin = all.filter(q => q.fin != null).map(q => q.fin), E = all.filter(q => q.east), W = all.filter(q => !q.east);
  console.log(`${V} ${path.basename(TREE)} THREAD ${process.env.THREAD || 'on'}  races ${races.length}  DNF ${all.length - fin.length}  finish med ${fx(med(fin))} mean ${fx(mean(fin))}  winner med ${fx(med(races.map(r => Math.min(...r.map(q => q.fin ?? 1e9)))))}  land ep/bot ${mean(all.map(q => q.landE)).toFixed(2)} (trees ${mean(all.map(q => q.tree)).toFixed(2)})  boat ep/bot ${mean(all.map(q => q.boatE)).toFixed(2)}  pen/bot ${mean(all.map(q => q.pen)).toFixed(2)}  thread s/bot ${mean(all.map(q => q.thr)).toFixed(1)}`);
  if (V === 'swamp') console.log(`  east ${E.length}/${all.length}  east fin med ${fx(med(E.filter(q => q.fin).map(q => q.fin)))} land ${mean(E.map(q => q.landE)).toFixed(2)}  west fin med ${fx(med(W.filter(q => q.fin).map(q => q.fin)))} land ${mean(W.map(q => q.landE)).toFixed(2)}`);
  const c = {}; for (const q of all) for (const [x, y] of q.hits) { const k = Math.round(x / 150) * 150 + ',' + Math.round(y / 150) * 150; c[k] = (c[k] || 0) + 1; }
  console.log('  hotspots', Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e.join(':')).join('  '));
  const H = all.flatMap(q => q.hits); const tally = (f) => { const t = {}; for (const h of H) { const k = f(h); t[k] = (t[k] || 0) + 1; } return Object.entries(t).sort((a, b) => b[1] - a[1]).map(e => e.join(':')).join('  '); };
  console.log('  contacts', H.length, ' thread', tally(h => h[2]), ' role', tally(h => h[3]), ' risk', tally(h => h[4]), ' mode', tally(h => h[5]), ' kt<1', H.filter(h => h[6] < 1).length);
  const SA = {}; for (const q of all) for (const [k, v] of Object.entries(q.slowAt || {})) SA[k] = (SA[k] || 0) + v;
  console.log(`  slow<1kt s/bot ${mean(all.map(q => q.slow || 0)).toFixed(1)}  where (boat-s):`, Object.entries(SA).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0] + ':' + Math.round(e[1])).join('  '));
  console.log('  DNF at', JSON.stringify(all.filter(q => q.fin == null).map(q => q.last)));
  if (errs.length) console.log('ERR', errs[0]);
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(races));
})();
