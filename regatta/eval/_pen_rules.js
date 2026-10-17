// Penalty episodes by rule (and where), over a venue's races.   ROOT=<repo root> node regatta/eval/_pen_rules.js venue seeds
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = process.env.ROOT || path.resolve('.'); const V = process.argv[2], N = +(process.argv[3] || 4);
(async () => {
  const b = await chromium.launch(); const H = fs.readFileSync(path.join(ROOT, 'regatta/eval/trace_harness.js'), 'utf8'); const tally = {}; const where = [];
  for (let s = 0; s < N; s++) {
    const p = await b.newPage(); await p.goto('file://' + path.join(ROOT, 'regatta/index.html')); await p.addScriptTag({ content: H });
    await p.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
    const r = await p.evaluate(async (seed) => {
      const ep = []; let inner = null; const last = new Map();
      Object.defineProperty(window, 'onRaceEvent', { configurable: true, get: () => (t, d) => { if (t === 'penalty' && d.boat) { const k = d.boat.id + (d.rule || '') + (d.reason || ''); const tm = state.race.timer || 0;
        if (!(last.get(k) > tm - 2)) ep.push({ rule: (d.rule || '') + ' ' + (d.reason || ''), x: Math.round(d.boat.x), y: Math.round(d.boat.y) }); last.set(k, tm); } if (inner) inner(t, d); }, set: (f) => { inner = f; } });
      await window.traceHarness.runTrace(seed, { timeLimit: 600, legs: 4 }); return ep; }, 90210 + s);
    for (const e of r) { tally[e.rule] = (tally[e.rule] || 0) + 1; where.push(e); }
    await p.close();
  }
  console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(' | '));
  console.log('obstruction/land:', where.filter(e => /19|31|land|Obstruction|aground/i.test(e.rule)).map(e => `${e.rule.trim()}@${e.x},${e.y}`).join('; '));
  await b.close(); })();
