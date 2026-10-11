// PT-096 — DOES WHAT YOU SEE OF THE ASH MATCH WHERE IT KILLS THE WIND? (Oct 11 2026)
// Emberfall, a real race clock. At moments through an eruption the camera (north-up, 1 u = 1 px) is put on
// the plume and the frame drawn twice — with the ash cloud and without it (Volcano.drawVeil stubbed). The
// per-pixel difference is how VISIBLE the ash is there; Volcano.windMul at the same world point is how much
// wind it actually takes. Binned against each other, plus:
//   hidden dead air  — windMul < 0.7 where the ash is barely visible (diff < 6% of full scale)
//   empty cloud      — clearly visible ash (> 15%) where the wind is ~untouched (windMul > 0.95)
//   node regatta/eval/rl/_pt096_visual.js [seed] [outdir]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const SEED = +process.argv[2] || 9400, OUT = process.argv[3] || path.join(__dirname, '_pt096');
fs.mkdirSync(OUT, { recursive: true });
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', musicEnabled: false, soundEnabled: false })); });
  await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForFunction(() => window.state && state.boats.length > 0);
  await p.evaluate((seed) => { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace(); for (const e of ['pre-race-overlay', 'clubhouse-overlay', 'hud-instruments', 'leaderboard']) { const el = document.getElementById(e); if (el) el.style.visibility = 'hidden'; }
    state.paused = true; window.__veil = Volcano.drawVeil; }, SEED);
  const frames = [];
  // step the race and pick moments: each time a cone's ash list is big, every ~20 s, up to 10 moments
  for (let k = 0; k < 10; k++) {
    const info = await p.evaluate(() => {
      for (let i = 0; i < 60 * 20; i++) update(1 / 60);
      const v = state.volcano, ps = [];
      for (const c of v.cones) for (const q of c.parcels) if (q.dead > 0) ps.push(q);
      if (ps.length < 6) return null;
      // camera on the dead air's weighted middle
      let sx = 0, sy = 0, sw = 0; for (const q of ps) { const w = q.dead; sx += q.x * w; sy += q.y * w; sw += w; }
      state.camera.x = sx / sw; state.camera.y = sy / sw; state.camera.rotation = 0;
      const ages = ps.map(q => q.age / q.life).sort((a, b) => a - b);
      return { t: state.race.timer.toFixed(0), n: ps.length, ageMed: ages[ages.length >> 1].toFixed(2), cx: state.camera.x, cy: state.camera.y, I: v.cones.map(c => c.intensity.toFixed(2)).join('/') };
    });
    if (!info) continue;
    const shot = async (veil) => { await p.evaluate((veil) => { Volcano.drawVeil = veil ? window.__veil : () => {}; state.camera.rotation = 0; draw(); }, veil); return p.screenshot({ type: 'png' }); };
    const A = await shot(true), B = await shot(false);
    fs.writeFileSync(path.join(OUT, `f${k}_ash.png`), A); fs.writeFileSync(path.join(OUT, `f${k}_bare.png`), B);
    // windMul on the same grid (every 8 px), world = camera + pixel offset (north-up, 1 u/px)
    const grid = await p.evaluate(({ cx, cy }) => { const W = innerWidth, H = innerHeight, g = [];
      for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) g.push(+Volcano.windMul(cx + x - W / 2, cy + y - H / 2).toFixed(3)); return { W, H, g }; }, info);
    fs.writeFileSync(path.join(OUT, `f${k}_mul.json`), JSON.stringify(grid));
    frames.push({ k, ...info });
  }
  fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames, null, 1));
  console.log(frames.map(f => `f${f.k}: t ${f.t}s, ${f.n} parcels, median age ${f.ageMed} of life, cone intensity ${f.I}`).join('\n'));
  await b.close(); })();
