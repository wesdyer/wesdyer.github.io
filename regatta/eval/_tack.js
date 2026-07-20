// Tack/gybe cost anatomy: detect natural AI maneuvers in races and measure the
// speed profile around each — entry speed, min speed, % loss, rebuild time.
// Usage: node regatta/eval/_tack.js [trials] [baseSeed]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const NUM = parseInt(A[0]) || 3, BASE = parseInt(A[1]) || 100;
const PHYS = A[2] ? JSON.parse(A[2]) : null; // e.g. '{"ironsHi":0.998,"bandLo":1.5,"bandHi":4}'
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE, PHYS }) => {
    if (PHYS) window.__PHYS = PHYS;
    const tacks = [], gybes = [];
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    for (let i = 0; i < NUM; i++) {
      window.evalHarness.seed = BASE + i;
      window.resetGame(); window.startRace();
      // per-boat rolling state
      const trk = {};
      state.boats.forEach(b => { if (!b.isPlayer) trk[b.id] = { hist: [], man: null, lastSide: 0 }; });
      const dt = 1 / 60; let it = 0; let t = 0;
      while (it < 600 * 60) {
        if (state.race.status === 'racing') {
          if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
          t = state.race.timer;
          if (it % 6 === 0) { // 10Hz sampling
            state.boats.forEach(b => {
              if (b.isPlayer || !trk[b.id] || b.raceState.finished || b.raceState.leg < 1) return;
              const k = trk[b.id];
              const wd = getWindAt(b.x, b.y).direction;
              const twa = norm(b.heading - wd);
              const kn = b.speed * 4;
              k.hist.push({ t, twa, kn });
              if (k.hist.length > 60) k.hist.shift(); // 6s history
              const side = Math.sign(twa);
              if (k.man) {
                // collecting post-maneuver profile
                k.man.prof.push({ t, kn });
                const el = t - k.man.t0;
                if (k.man.minKn > kn) k.man.minKn = kn;
                if (el >= 25 || b.raceState.penalty) {
                  if (!b.raceState.penalty && k.man.entryKn > 3.0) {
                    // rebuild time: first t where kn >= 95% entry
                    let t95 = null;
                    for (const p of k.man.prof) { if (p.kn >= 0.95 * k.man.entryKn) { t95 = p.t - k.man.t0; break; } }
                    const rec = { entry: k.man.entryKn, min: k.man.minKn, t95, absTwa: k.man.absTwa };
                    (k.man.absTwa < 90 ? tacks : gybes).push(rec);
                  }
                  k.man = null;
                }
              }
              if (!k.man && k.lastSide !== 0 && side !== 0 && side !== k.lastSide) {
                // maneuver: TWA sign change. Entry = speed 3s ago; absTwa = |twa| 3s ago
                const past = k.hist.find(h => k.hist[k.hist.length - 1].t - h.t <= 3.05 && k.hist[k.hist.length - 1].t - h.t >= 2.5) || k.hist[0];
                if (past && !b.raceState.penalty) {
                  k.man = { t0: t, entryKn: past.kn, minKn: past.kn, absTwa: Math.abs(past.twa) * 180 / Math.PI, prof: [] };
                }
              }
              if (side !== 0) k.lastSide = side;
            });
          }
        }
        window.update(dt); it++;
      }
    }
    return { tacks, gybes };
  }, { NUM, BASE, PHYS });

  const rep = (label, arr) => {
    if (!arr.length) { console.log(`${label}: n=0`); return; }
    const mean = f => arr.reduce((a, r) => a + f(r), 0) / arr.length;
    const losses = arr.map(r => 100 * (1 - r.min / r.entry)).sort((a, b) => a - b);
    const t95s = arr.filter(r => r.t95 != null).map(r => r.t95).sort((a, b) => a - b);
    const q = (s, p) => s[Math.floor(p * (s.length - 1))];
    console.log(`${label}: n=${arr.length} entry=${mean(r => r.entry).toFixed(1)}kn min=${mean(r => r.min).toFixed(1)}kn ` +
      `loss%[med=${q(losses, 0.5).toFixed(0)} p25=${q(losses, 0.25).toFixed(0)} p75=${q(losses, 0.75).toFixed(0)}] ` +
      `t95s[med=${t95s.length ? q(t95s, 0.5).toFixed(1) : '-'} p75=${t95s.length ? q(t95s, 0.75).toFixed(1) : '-'} n95=${t95s.length}]`);
  };
  rep('TACKS', out.tacks);
  rep('GYBES', out.gybes);
  await browser.close();
})();
