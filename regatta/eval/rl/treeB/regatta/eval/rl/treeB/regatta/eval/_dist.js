// Start-time distribution + bucketed trajectory sampling.
// Usage: node regatta/eval/_dist.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 40, BASE = parseInt(A[1]) || 100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE }) => {
    const allStarts = [];
    const samples = { fast: null, mid: null, slow: null }; // one trajectory each
    for (let i = 0; i < NUM; i++) {
      const seed = BASE + i; window.evalHarness.seed = seed;
      window.resetGame(); window.startRace();
      const marks = state.course.marks, m0 = marks[0], m1 = marks[1];
      const ldx = m1.x - m0.x, ldy = m1.y - m0.y, llen = Math.hypot(ldx, ldy) || 1;
      const perp = b => ((b.x - m0.x) * ldy - (b.y - m0.y) * ldx) / llen;
      const along = b => (((b.x - m0.x) * ldx + (b.y - m0.y) * ldy) / (llen * llen));
      const startT = {}; const oh = window.onRaceEvent;
      window.onRaceEvent = (t, d) => { if (t === 'leg_complete' && d.leg === 0 && startT[d.boat.id] == null) startT[d.boat.id] = state.race.timer; if (oh) oh(t, d); };
      const dt = 1 / 60; let it = 0; const logs = {}; let last = -1;
      while (it < 200 * 60) {
        const racing = state.race.status === 'racing';
        if (racing) {
          if (state.race.timer > 200) break;
          if (state.boats.every(b => b.raceState.finished || b.raceState.leg > 0)) break;
          const t = state.race.timer;
          if (t - last >= 1) {
            last = t;
            state.boats.forEach(b => {
              if (b.isPlayer || b.raceState.leg > 0) return;
              (logs[b.id] = logs[b.id] || []).push({ t: +t.toFixed(1), p: Math.round(perp(b)), al: +along(b).toFixed(2), s: +b.speed.toFixed(2), tw: Math.round(Math.abs(((b.heading - state.wind.direction) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 180 / Math.PI), st: (b.controller.livenessState || '?')[0], r: (b.controller.riskState || '?')[0], w: b.controller.wiggleActive ? 1 : 0 });
            });
          }
        }
        window.update(dt); it++;
      }
      window.onRaceEvent = oh;
      state.boats.forEach(b => {
        if (b.isPlayer) return;
        const v = startT[b.id] == null ? 999 : startT[b.id];
        allStarts.push(v);
        const bucket = v < 6 ? 'fast' : (v < 25 ? 'mid' : 'slow');
        if (!samples[bucket]) samples[bucket] = { seed, name: b.name, start: +v.toFixed(1), log: (logs[b.id] || []).slice(0, 60) };
      });
    }
    return { allStarts, samples };
  }, { NUM, BASE });

  const s = out.allStarts.filter(v => v < 999).sort((a, b) => a - b);
  const dns = out.allStarts.filter(v => v >= 999).length;
  const n = out.allStarts.length;
  const mean = out.allStarts.reduce((a, b) => a + Math.min(b, 600), 0) / n;
  const pct = q => s[Math.floor(q * (s.length - 1))];
  const buckets = [0, 3, 6, 10, 15, 20, 30, 45, 70, 100, 600];
  const hist = buckets.slice(0, -1).map((lo, i) => {
    const hi = buckets[i + 1];
    const c = out.allStarts.filter(v => v >= lo && v < hi).length;
    return `  [${lo}-${hi}): ${c} (${(100 * c / n).toFixed(1)}%)`;
  });
  console.log(`n=${n} mean=${mean.toFixed(2)} median=${pct(0.5).toFixed(1)} p75=${pct(0.75).toFixed(1)} p90=${pct(0.9).toFixed(1)} p95=${pct(0.95).toFixed(1)} max=${s[s.length-1].toFixed(1)} dns=${dns}`);
  console.log('histogram:'); hist.forEach(h => console.log(h));
  for (const k of ['fast', 'mid', 'slow']) {
    const r = out.samples[k]; if (!r) continue;
    console.log(`\n--- ${k.toUpperCase()} sample: seed ${r.seed} ${r.name} START=${r.start} ---`);
    r.log.forEach(p => console.log(`  t=${p.t} perp=${p.p} al=${p.al} spd=${p.s} twa=${p.tw} live=${p.st} risk=${p.r} wig=${p.w}`));
  }
  await browser.close();
})();
