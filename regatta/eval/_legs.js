// Leg anatomy diagnostic: for each rounding leg, split time into APPROACH
// (leg start -> gate segment cross / isRounding set) and ROUND (segment cross
// -> leg_complete), and record WHERE on the gate the boat crossed (pct along
// segment 0..1) and which side it rounded.
// Usage: node regatta/eval/_legs.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 10, BASE = parseInt(A[1]) || 100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE }) => {
    // rec[leg] = list of {approach, round, crossPct, name}
    const rec = { 1: [], 2: [], 3: [], 4: [] };
    const finishTimes = [];
    for (let i = 0; i < NUM; i++) {
      window.evalHarness.seed = BASE + i;
      window.resetGame(); window.startRace();
      const marks = state.course.marks;
      const alongPct = (b, i1, i2) => {
        const m1 = marks[i1], m2 = marks[i2];
        const dx = m2.x - m1.x, dy = m2.y - m1.y, l2 = dx * dx + dy * dy;
        return ((b.x - m1.x) * dx + (b.y - m1.y) * dy) / l2;
      };
      // per-boat live tracking
      const trk = {}; // id -> {legStart, crossT, crossPct, lastRounding}
      state.boats.forEach(b => { if (!b.isPlayer) trk[b.id] = { legStart: null, crossT: null, crossPct: null, wasRounding: false }; });
      const oh = window.onRaceEvent;
      window.onRaceEvent = (t, d) => {
        if (!d.boat.isPlayer && trk[d.boat.id]) {
          const k = trk[d.boat.id];
          if (t === 'leg_complete') {
            const doneLeg = d.leg;
            if (doneLeg >= 1 && doneLeg <= 4) {
              const total = state.race.timer - (k.legStart == null ? state.race.timer : k.legStart);
              const crossT = k.crossT == null ? state.race.timer : k.crossT;
              rec[doneLeg].push({
                approach: +(crossT - (k.legStart ?? crossT)).toFixed(1),
                round: +(state.race.timer - crossT).toFixed(1),
                crossPct: k.crossPct == null ? null : +k.crossPct.toFixed(2),
                total: +total.toFixed(1), name: d.boat.name
              });
            }
            k.legStart = state.race.timer; k.crossT = null; k.crossPct = null; k.wasRounding = false;
          }
          if (t === 'start_cross') { k.legStart = state.race.timer; }
        }
        if (oh) oh(t, d);
      };
      const dt = 1 / 60; let it = 0;
      while (it < 600 * 60) {
        if (state.race.status === 'racing') {
          if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
          // sample isRounding transitions at frame rate
          state.boats.forEach(b => {
            if (b.isPlayer || !trk[b.id]) return;
            const k = trk[b.id];
            if (b.raceState.isRounding && !k.wasRounding) {
              k.wasRounding = true;
              if (k.crossT == null) {
                k.crossT = state.race.timer;
                const idx = (b.raceState.leg % 2 !== 0) ? [2, 3] : [0, 1];
                k.crossPct = alongPct(b, idx[0], idx[1]);
              }
            } else if (!b.raceState.isRounding && k.wasRounding) {
              k.wasRounding = false;
            }
          });
        }
        window.update(dt); it++;
      }
      window.onRaceEvent = oh;
      state.boats.forEach(b => { if (!b.isPlayer && b.raceState.finished) finishTimes.push(b.raceState.finishTime); });
    }
    return { rec, finishTimes };
  }, { NUM, BASE });

  const stat = a => {
    if (!a.length) return 'n=0';
    const s = [...a].sort((x, y) => x - y);
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    return `n=${a.length} mean=${mean.toFixed(1)} med=${s[Math.floor(s.length / 2)].toFixed(1)} p90=${s[Math.floor(0.9 * (s.length - 1))].toFixed(1)} max=${s[s.length - 1].toFixed(1)}`;
  };
  for (const leg of [1, 2, 3, 4]) {
    const r = out.rec[leg];
    console.log(`LEG ${leg}: total[${stat(r.map(x => x.total))}]`);
    console.log(`   approach[${stat(r.map(x => x.approach))}]  round[${stat(r.map(x => x.round))}]`);
    const pcts = r.map(x => x.crossPct).filter(v => v != null);
    if (pcts.length) {
      const hist = [0, 0.15, 0.3, 0.45, 0.55, 0.7, 0.85, 1.01];
      const h = hist.slice(0, -1).map((lo, i) => {
        const c = pcts.filter(v => v >= lo - (i === 0 ? 9 : 0) && v < hist[i + 1] + (i === hist.length - 2 ? 9 : 0)).length;
        return `${lo.toFixed(2)}:${c}`;
      }).join(' ');
      console.log(`   crossPct hist: ${h}`);
    }
  }
  console.log(`FINISH: ${stat(out.finishTimes)}`);
  await browser.close();
})();
