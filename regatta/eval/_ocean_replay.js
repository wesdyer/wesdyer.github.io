// Probe: replay one of Wes's Ocean races against the sea he actually sailed — the swell's clock
// wound to each sample (TIME = race timer + the 30 s prestart), then per second on the run: his
// speed, heading against the swell's travel, the set strength where he is, where he sits in the
// wave (phase: 0 crest, + ahead of it on the face, ± π trough) and the along-track slope.
//   node regatta/eval/_ocean_replay.js <traj.json> [leg]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), LEG = +(process.argv[3] || 3);
  const pre = j.samples.find(s => s[1] === 0); const PRE = pre ? pre[0] : 30;
  const SW = (j.format || []).indexOf('swell');   // recorded swell clock (from Sep 25 2026 on) — exact; else estimated
  const rows = j.samples.filter(s => s[1] === 1 && s[8] === LEG).map(s => [s[0], s[2], s[3], s[4], s[5] * 4, SW >= 0 && s[SW] ? s[SW][0] : null]);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Swell && typeof resetGame === 'function');
  const out = await p.evaluate(({ rows, PRE }) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })); resetGame();
    const P = Swell.primary(); let T = 0; const res = [];
    const deg = (a) => Math.round(((a * 180 / Math.PI) % 360 + 360) % 360);
    let last = -1;
    for (const [t, x, y, h, kn, clk] of rows) {
      const want = clk != null ? clk : t + PRE; if (want - T > 0) { Swell.update(want - T); T = want; }
      if (Math.floor(t) === last) continue; last = Math.floor(t);
      let ph = Swell.phaseAt(P, x, y) % (2 * Math.PI); if (ph > Math.PI) ph -= 2 * Math.PI; if (ph < -Math.PI) ph += 2 * Math.PI;
      const f = Swell.sampleAt(x, y), hx = Math.sin(h), hy = -Math.cos(h), slope = f.gx * hx + f.gy * hy;
      // the push he got, split by train, and the best push on offer within 40° of his heading
      const TR = Swell.trains(), per = TR.map((_, i) => Swell.surfPushAt(x, y, h, i));
      let best = -1e9, bh = h; for (let d = -40; d <= 40; d += 5) { const hh = h + d * Math.PI / 180, v = Swell.surfPushAt(x, y, hh); if (v > best) { best = v; bh = hh; } }
      const W2 = TR[1];
      res.push(`${Math.round(t)}s ${kn.toFixed(1)}kn hdg${deg(h)} | ground: set${Swell.setAt(P, x, y).toFixed(2)} off${Math.round(Math.abs(((h - P.theta) * 180 / Math.PI + 540) % 360 - 180))}° push${per[0].toFixed(2)}` +
        (W2 ? ` | wind: set${Swell.setAt(W2, x, y).toFixed(2)} off${Math.round(Math.abs(((h - W2.theta) * 180 / Math.PI + 540) % 360 - 180))}° push${per[1].toFixed(2)}` : '') +
        ` | best${best.toFixed(2)}@${deg(bh)}`);
    }
    return { dir: deg(P.theta), res };
  }, { rows, PRE });
  console.log(SW >= 0 ? 'swell clock: RECORDED (exact)' : 'swell clock: ESTIMATED (race timer + prestart) — phase may be off');
  console.log('swell travels to ' + out.dir + '°  (slope < 0 = downhill ahead = the face pushing you)');
  console.log(out.res.join('\n'));
  await b.close();
})();
