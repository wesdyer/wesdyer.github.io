// PT-051: replay one census race and print one bot's state every second over a window.
//   node _pt051_watch.js <venue> <seed> <boat> <t0> <t1>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [venue, seed, who, t0, t1] = process.argv.slice(2); const ROOT = path.resolve(__dirname, '../../..');
(async () => { const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), venue);   // LATE, as ocean_bench: reproducible across processes
  if (process.env.WARM0) await page.evaluate((w) => { window.__WARM0 = w; }, +process.env.WARM0);
  const rows = await page.evaluate(({ seed, who, t0, t1 }) => {
    // WARM: the census sails seeds back to back in one page, and a race reads state the last one left (caches);
    // replay the earlier seeds first so this race is the census's race (env WARM0 = first seed of that run).
    const conv = () => { const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
      const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300; };
    for (let s0 = (window.__WARM0 || seed); s0 < seed; s0++) { window.evalHarness.seed = s0; window.resetGame(); window.startRace(); state.course.cutoff = 900; conv();
      for (let it = 0; it < 60 * 940; it++) { window.update(1 / 60); if (state.race.status === 'finished' || state.race.timer > 900) break; } }
    window.evalHarness.seed = seed; window.resetGame(); window.startRace(); state.course.cutoff = 900;
    const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
    const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
    const me = state.boats.find(b => b.name === who); const out = []; let lastT = -1;
    for (let it = 0; it < 60 * 940; it++) { window.update(1 / 60);
      if (state.race.status === 'finished' || !me) break; if (state.race.status !== 'racing' && state.race.status !== 'prestart') continue;
      const t = state.race.status === 'prestart' ? -state.race.timer : state.race.timer; if (t > t1) break; if (t < t0 || Math.floor(t) === lastT) continue; lastT = Math.floor(t);
      const c = me.controller || {}, w = getWindAt(me.x, me.y), twa = normalizeAngle(me.heading - w.direction) * 57.3;
      const nt = c.navTarget, rs = me.raceState;
      let nb = null, nd = 1e9; for (const o of state.boats) { if (o === me || o.raceState.finished) continue; const d = Math.hypot(o.x - me.x, o.y - me.y); if (d < nd) { nd = d; nb = o; } }
      const nbS = nb ? `near ${nb.name}@${Math.round(nd)} h${Math.round(nb.heading * 57.3)} L${nb.raceState.leg} brg ${Math.round(Math.atan2(nb.x - me.x, -(nb.y - me.y)) * 57.3)}` : '';
      const intent = c._raceIntent != null ? Math.round(c._raceIntent * 57.3) : '-';
      const ln = c._lastNav; const gp = c.gridPath || [];
      const navS = ln ? `NAV (${Math.round(ln.x)},${Math.round(ln.y)})${ln.kind ? ' ' + ln.kind : ''} gp ${gp.length} [${gp.slice(0, 3).map(p => Math.round(p.x) + ',' + Math.round(p.y)).join(' ')}]` : 'NAV -';
      let landAt = null; if (c._raceIntent != null && state.course.botGrid) { const g = state.course.botGrid; for (let d = 30; d <= 400; d += 30) { const cc = g.cell(me.x + Math.sin(c._raceIntent) * d, me.y - Math.cos(c._raceIntent) * d); if (!g.at(cc[0], cc[1])) { landAt = d; break; } } }
      const rmW = (typeof legRoundMark === 'function') ? legRoundMark(rs.leg) : null; out.push(`t${t.toFixed(0)} LEG ${rs.leg} arm ${rs.roundArmed ? 1 : 0} sw ${(rs.roundSweep || 0).toFixed(2)} mk ${rmW ? Math.round(Math.hypot(me.x - rmW.x, me.y - rmW.y)) + '@' + Math.round(rmW.x) + ',' + Math.round(rmW.y) : '-'} INTENT ${intent} land@${landAt} ${navS} ${nbS} | (${Math.round(me.x)},${Math.round(me.y)}) spd ${(me.speed * 4).toFixed(1)}kt twa ${twa.toFixed(0)} tws ${w.speed.toFixed(1)} hdg ${(me.heading * 57.3).toFixed(0)} tgtH ${c.targetHeading != null ? (c.targetHeading * 57.3).toFixed(0) : '-'} escH ${c.iceEscapeHeading != null ? (c.iceEscapeHeading * 57.3).toFixed(0) : '-'} col ${me.ai && me.ai.collisionData ? me.ai.collisionData.type : '-'} wd ${(w.direction * 57.3).toFixed(0)} cur ${(() => { const cc = getCurrentAt(me.x, me.y); return cc ? (cc.speed).toFixed(1) + '@' + (cc.direction * 57.3).toFixed(0) : '-'; })()} nav ${nt ? `(${Math.round(nt.x)},${Math.round(nt.y)})` : '-'} leg ${rs.leg} live ${c.livenessState} low ${(c.lowSpeedTimer || 0).toFixed(1)} esc ${(c.escSustain || 0).toFixed(1)} ice ${(c.iceEscapeTimer || 0).toFixed(1)} pen ${rs.penalty ? 'OWES' : '-'} spin ${c.penaltySpin ? 'Y' : '-'} risk ${c.riskState || '-'} sail ${(me.sailAngle || 0).toFixed(2)} luff ${(me.luffIntensity || 0).toFixed(2)}`);
    }
    return out; }, { seed: +seed, who, t0: +t0, t1: +t1 });
  console.log(rows.join('\n')); await b.close(); })();
