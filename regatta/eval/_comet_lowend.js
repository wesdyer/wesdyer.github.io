// WHAT DOES A COMET LOOK LIKE AT EACH WIND SPEED?
//
// Four channels carry the reading — how MANY, how LONG, how WIDE, how BRIGHT — and three of
// them key off absolute wind, so they can collapse together at the light end and leave a
// venue with marks too small to read. This reports all four per wind band, from the live
// functions (`streakChannels`, `_streakRef`, `pressureAt`, `cometCfg`), so it cannot grade a
// formula the renderer stopped using.
//
// LENGTH is the distance a parcel covers in the tail window — the thing the layer is built
// on — so it is computed the same way updateParticles moves one.
//
// Usage: node eval/_comet_lowend.js [venue...]
const { chromium } = require('playwright');
const path = require('path');
// First arg may be a TREE to measure (any path containing regatta/index.html); the rest are
// venues. Lets the same probe run against a pre-change copy without installing node_modules
// into it — the harness stays here, only the page under test moves.
const args = process.argv.slice(2);
const ROOT = (args[0] && args[0].includes('/')) ? args.shift() : '.';
const VENUES = args.length ? args : ['lake', 'swamp', 'bay', 'redrock', 'ocean'];
const BANDS = [[0, 6], [6, 8], [8, 11], [11, 15], [15, 20], [20, 99]];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await p.waitForTimeout(1300);
  console.log('  venue      band kt    share   chance  onScreen   length  halfW   alpha');
  for (const v of VENUES) {
    const rows = await p.evaluate(({ vv, bands }) => {
      // ⚠️ SEEDED. Without this each run rolls a different wind realisation and the bands
      // hold different water, so a before/after comparison measures the weather rather than
      // the change — which is exactly how the first pass appeared to move Bluewater's
      // 15-20 kt band when nothing in that band's arithmetic had been touched.
      let sd = 90210;
      Math.random = () => { let t = sd += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      state.paused = true; settings.venue = vv; resetGame(); startRace();
      for (let i = 0; i < 2400; i++) { update(1 / 60); if (i % 20 === 0) draw(); }
      const acc = bands.map(() => ({ n: 0, c: 0, len: 0, w: 0, a: 0 }));
      let total = 0;
      const world = (state.course.doc && state.course.doc.world) ? state.course.doc.world.size : 12000;
      for (let i = 0; i < 40000; i++) {
        const x = (Math.random() - 0.5) * world * 1.7, y = (Math.random() - 0.5) * world * 1.7;
        if (!Arena.contains(state.course.boundary, x, y, 0) || !inMaskWater(x, y)) continue;
        const spd = getWindAt(x, y).speed;
        const bi = bands.findIndex(([lo, hi]) => spd >= lo && spd < hi);
        if (bi < 0) continue;
        const windiness = Math.max(0, Math.min(1, (spd - _streakRef.floor) / _streakRef.span));
        const t = pressureAt(spd);
        const c = cometCfg();
        const chance = windiness <= 0 ? 0
          : Math.min(STREAK_MAX_SPAWN, c.dens0 + c.dens1 * windiness * (0.18 + 0.82 * t * t));
        // The drawn length: distance covered over the whole tail window, at the mean drift.
        const len = spd * 15 * 0.75 * (_streakRef.tailStep * WIND_TAIL_PTS);
        const ch = streakChannels(t, 0.5, spd);
        const A = acc[bi];
        A.n++; A.c += chance; A.len += len; A.w += ch.halfWidth; A.a += ch.alpha;
        total++;
      }
      // Expected comets on screen: spawn rate x life x the share of the spawn box in view.
      const box = Math.max(canvas.width, canvas.height) * 1.35;
      const inView = (canvas.width * canvas.height) / (box * box);
      return acc.map((A, i) => A.n ? {
        band: bands[i], share: +(A.n / total).toFixed(3),
        chance: +(A.c / A.n).toFixed(3),
        onScreen: Math.round((A.c / A.n) * 2 * 60 * WIND_LIFE * inView),
        len: Math.round(A.len / A.n), w: +(A.w / A.n).toFixed(2), a: +(A.a / A.n).toFixed(2)
      } : null);
    }, { vv: v, bands: BANDS });
    for (const r of rows) {
      if (!r) continue;
      console.log(`  ${v.padEnd(10)} ${String(r.band[0]).padStart(2)}-${String(r.band[1]).padEnd(3)}` +
        `  ${String(r.share).padStart(6)}  ${String(r.chance).padStart(6)}  ${String(r.onScreen).padStart(7)}` +
        `   ${String(r.len).padStart(5)}u  ${String(r.w).padStart(5)}  ${String(r.a).padStart(6)}`);
    }
  }
  console.log('errors', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
