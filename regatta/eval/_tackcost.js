// t_c — the SECONDS a tack costs, in VMG terms, measured from natural AI maneuvers.
//
// The corridor model VMG_eff(B) = B·V·cosθ / (B + t_c·V·sinθ) needs t_c as an input,
// and the plan says measure it, don't tune it. Definition used here: over the window
// from maneuver start until speed rebuilds (or 25 s), the lost upwind progress
//     t_c = ∫ (VMG_steady − VMG(t)) dt / VMG_steady
// where VMG(t) = kn(t)·cos(twa(t)) along the wind axis and VMG_steady is the boat's
// own entry VMG 3 s before the maneuver. That is "how many seconds of steady beating
// the maneuver threw away", which is exactly the t_c the closed form charges per tack.
//
// Gybes are reported too (the corridor pricer penalizes any heading≠bearing water,
// downwind mildly) — expect them cheaper.
//
// Usage: node regatta/eval/_tackcost.js [venue=ocean] [trials=3] [baseSeed=9100]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const A = process.argv.slice(2);
const VENUE = A[0] || 'ocean';
const NUM = parseInt(A[1]) || 3, BASE = parseInt(A[2]) || 9100;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  const out = await page.evaluate(({ NUM, BASE }) => {
    const tacks = [], gybes = [];
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    for (let i = 0; i < NUM; i++) {
      window.evalHarness.seed = BASE + i;
      window.resetGame(); window.startRace();
      state.course.cutoff = 900;
      const trk = {};
      state.boats.forEach(b => { if (!b.isPlayer) trk[b.id] = { hist: [], man: null, lastSide: 0 }; });
      const dt = 1 / 60; let it = 0; let t = 0;
      while (it < 700 * 60) {
        if (state.race.status === 'racing') {
          if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
          t = state.race.timer;
          if (it % 6 === 0) { // 10 Hz
            state.boats.forEach(b => {
              if (b.isPlayer || !trk[b.id] || b.raceState.finished || b.raceState.leg < 1) return;
              const k = trk[b.id];
              const w = getWindAt(b.x, b.y);
              const twa = norm(b.heading - w.direction);
              const kn = b.speed * 4;
              k.hist.push({ t, twa, kn });
              if (k.hist.length > 60) k.hist.shift();
              const side = Math.sign(twa);
              if (k.man) {
                const m = k.man;
                // VMG along the wind axis, signed the way the boat is working:
                // upwind maneuvers measure progress TO windward, downwind maneuvers
                // progress DOWN it. cos keeps its own sign; use |cos| against the
                // entry sense so a tack through head-to-wind counts the stall.
                const v = kn * Math.abs(Math.cos(twa));
                m.lost += (m.vSteady - v) * 0.1;
                const el = t - m.t0;
                const rebuilt = kn >= 0.98 * m.entryKn && el > 1.5;
                if (el >= 25 || rebuilt || b.raceState.penalty) {
                  if (!b.raceState.penalty && m.entryKn > 3.0 && m.vSteady > 1.0) {
                    (m.absTwa < 90 ? tacks : gybes).push({
                      tc: m.lost / m.vSteady, entry: m.entryKn,
                      ws: m.ws, el, absTwa: m.absTwa
                    });
                  }
                  k.man = null;
                }
              }
              if (!k.man && k.lastSide !== 0 && side !== 0 && side !== k.lastSide) {
                const last = k.hist[k.hist.length - 1];
                const past = k.hist.find(h => last.t - h.t <= 3.05 && last.t - h.t >= 2.5) || k.hist[0];
                if (past && !b.raceState.penalty && (last.t - past.t) > 2.0) {
                  k.man = { t0: t, entryKn: past.kn, absTwa: Math.abs(past.twa) * 180 / Math.PI,
                            vSteady: past.kn * Math.abs(Math.cos(past.twa)),
                            ws: w.speed, lost: 0 };
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
  }, { NUM, BASE });

  const rep = (label, arr) => {
    if (!arr.length) { console.log(`${label}: n=0`); return; }
    const bins = {};
    for (const r of arr) {
      const b = r.ws < 10 ? '8' : r.ws < 14 ? '12' : r.ws < 18 ? '16' : r.ws < 22 ? '20' : r.ws < 27 ? '25' : '30';
      (bins[b] = bins[b] || []).push(r.tc);
    }
    const q = (s, p) => s[Math.floor(p * (s.length - 1))];
    console.log(`${label}: n=${arr.length}`);
    for (const b of Object.keys(bins).sort((a, c) => +a - +c)) {
      const s = bins[b].slice().sort((a, c) => a - c);
      console.log(`  ws~${b}kt  n=${s.length}  t_c med=${q(s, 0.5).toFixed(2)}s  p25=${q(s, 0.25).toFixed(2)}  p75=${q(s, 0.75).toFixed(2)}`);
    }
  };
  console.log(`venue=${VENUE} trials=${NUM} seeds=${BASE}+`);
  rep('TACKS', out.tacks);
  rep('GYBES', out.gybes);
  await browser.close();
})();
