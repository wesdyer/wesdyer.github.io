// PT-051: the avoidance cost ledger for one bot over a window (window.__AVDBG), summarised per second.
//   node _pt051_avdbg.js <venue> <seed> <boat> <t0> <t1>
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
    const out = []; let lastT = -1;
    for (let it = 0; it < 60 * 940; it++) {
      const t = state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
      window.__AVDBG = (t >= t0 && t <= t1) ? { name: who, full: true } : null; window.__AVLOG = [];
      window.update(1 / 60);
      if (state.race.status === 'finished' || t > t1) break;
      if (t < t0 || Math.floor(t * 2) === lastT || !window.__AVLOG.length) continue; lastT = Math.floor(t * 2);
      const L = window.__AVLOG[window.__AVLOG.length - 1], z = L.zero, bb = L.best;
      const f = (r) => r ? `off ${r.off} cost ${Math.round(r.cost)} (riv ${Math.round(r.riv)} prox ${Math.round(r.prox)} mk ${Math.round(r.cost - r.mkp)} pre ${Math.round(r.pre)}) bc${r.bc} sc${r.sc} rv${r.rv}` : '-';
      out.push(`t${t.toFixed(1)} ${L.role}/${L.risk} rng ${L.rng} row ${L.rowDbg ? L.rowDbg.row + ' ' + L.rowDbg.rule : '-'} dev ${L.dev} | ZERO ${f(z)} | BEST ${f(bb)}`);
    }
    return out; }, { seed: +seed, who, t0: +t0, t1: +t1 });
  console.log(rows.join('\n')); await b.close(); })();
