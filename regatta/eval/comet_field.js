// Measure the wind-comet distribution over the VIEW (camera frame, rotation included):
// on-screen count, per-cell uniformity normalised by each cell's water fraction, nearest
// neighbour spacing, at several times after the gun, plus a screenshot per venue.
//   NODE_PATH=../../node_modules node eval/comet_field.js <tag> [venues,csv] [W] [H]   (OUT=dir for the files)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = (process.env.OUT || require('os').tmpdir()) + '/';
const TAG = process.argv[2] || 'base';
const VENUES = (process.argv[3] || 'ocean,bay,redrock,river,arctic,glowtide,lake,otter,pond,volcanic').split(',');
const W = +(process.argv[4] || 1600), H = +(process.argv[5] || 1000);
const TIMES = (process.env.TIMES || '0.5,2,5,12,25').split(',').map(Number);
const ROOT = process.env.ROOT || '/Users/wesdyer/Desktop/wesdyer.github.io';

const sample = ({ W, H }) => {
  const s = window.state, cam = s.camera;
  const cos = Math.cos(cam.rotation), sin = Math.sin(cam.rotation);
  const parts = s.particles.filter(q => q.type === 'wind');
  const on = [];
  for (const q of parts) {
    const dx = q.x - cam.x, dy = q.y - cam.y;
    const u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
    if (Math.abs(u) < W / 2 && Math.abs(v) < H / 2) on.push({ u, v, spd: q.spd || 0, life: q.life });
  }
  // Water fraction per cell of a 4x3 grid, sampled on a 24x15 lattice.
  const CX = 4, CY = 3, water = Array(CX * CY).fill(0), tot = Array(CX * CY).fill(0);
  for (let i = 0; i < 24; i++) for (let j = 0; j < 15; j++) {
    const u = (i + 0.5) / 24 * W - W / 2, v = (j + 0.5) / 15 * H - H / 2;
    const x = cam.x + u * cos - v * sin, y = cam.y + u * sin + v * cos;
    const c = Math.min(CX - 1, (i / 6) | 0) + CX * Math.min(CY - 1, (j / 5) | 0);
    tot[c]++;
    if (Arena.contains(s.course.boundary, x, y, 0) && inMaskWater(x, y)) water[c]++;
  }
  const cnt = Array(CX * CY).fill(0);
  for (const p of on) cnt[Math.min(CX - 1, ((p.u + W / 2) / W * CX) | 0) + CX * Math.min(CY - 1, ((p.v + H / 2) / H * CY) | 0)]++;
  const wf = water.map((w, i) => w / tot[i]);
  const waterFrac = water.reduce((a, b) => a + b, 0) / tot.reduce((a, b) => a + b, 0);
  // Density per water cell, in comets per (1000px)^2 of water — cells that are < 25% water skipped
  const dens = [];
  for (let c = 0; c < CX * CY; c++) if (wf[c] >= 0.25) dens.push(cnt[c] / (wf[c] * (W / CX) * (H / CY)) * 1e6);
  const mean = dens.reduce((a, b) => a + b, 0) / Math.max(1, dens.length);
  const sd = Math.sqrt(dens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, dens.length));
  const emptyCells = dens.filter(d => d === 0).length;
  // Nearest-neighbour distance among on-screen comets
  const nn = [];
  for (let i = 0; i < on.length; i++) {
    let best = 1e9;
    for (let j = 0; j < on.length; j++) if (j !== i) { const d = Math.hypot(on[i].u - on[j].u, on[i].v - on[j].v); if (d < best) best = d; }
    if (best < 1e9) nn.push(best);
  }
  nn.sort((a, b) => a - b);
  const q = f => nn.length ? +nn[Math.min(nn.length - 1, (nn.length * f) | 0)].toFixed(0) : null;
  // Wind at the camera, and the upwind/downwind halves of the view (skew check)
  const wc = getWindAt(cam.x, cam.y);
  const wu = Math.sin(wc.direction), wv = -Math.cos(wc.direction);   // screen-space unit vector the comets DRIFT along (world -> camera frame)
  const du = wu * cos + wv * sin, dv = -wu * sin + wv * cos;
  let up = 0, down = 0;
  for (const p of on) ((p.u * du + p.v * dv) < 0 ? up++ : down++);
  return {
    t: +(s.race.timer || 0).toFixed(1), status: s.race.status,
    alive: parts.length, onScreen: on.length, waterFrac: +waterFrac.toFixed(2),
    perMpx: +(on.length / (waterFrac * W * H) * 1e6).toFixed(1),
    cellCV: dens.length ? +(sd / Math.max(1e-9, mean)).toFixed(2) : null, cells: dens.length, emptyCells,
    nnP10: q(0.1), nnMed: q(0.5), nnP90: q(0.9),
    upwindHalf: up, downwindHalf: down,
    camKt: +wc.speed.toFixed(1), rotDeg: +(cam.rotation * 180 / Math.PI).toFixed(0),
    spdMed: on.length ? +on.map(p => p.spd).sort((a, b) => a - b)[on.length >> 1].toFixed(1) : null
  };
};

(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const v of VENUES) {
    const p = await b.newPage({ viewport: { width: W, height: H } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()); });
    await p.addInitScript(vv => localStorage.setItem('regatta_settings', JSON.stringify({ venue: vv })), v);
    await p.goto('file://' + path.join(ROOT, 'regatta/index.html'));
    await p.waitForTimeout(2500);
    await p.evaluate(() => { if (typeof startRace === 'function') startRace(); });
    let last = 0;
    for (const t of TIMES) {
      await p.waitForTimeout((t - last) * 1000); last = t;
      const r = await p.evaluate(sample, { W, H });
      r.venue = v; r.at = t;
      rows.push(r);
      if (t === 12) await p.screenshot({ path: OUT + `shot_${TAG}_${v}.png` });
    }
    if (errs.length) rows[rows.length - 1].err = errs.slice(0, 2).join(' | ');
    await p.close();
  }
  await b.close();
  fs.writeFileSync(OUT + `field_${TAG}.json`, JSON.stringify(rows, null, 1));
  const cols = ['venue', 'at', 'status', 'alive', 'onScreen', 'waterFrac', 'perMpx', 'cellCV', 'emptyCells', 'nnP10', 'nnMed', 'nnP90', 'upwindHalf', 'downwindHalf', 'camKt', 'spdMed', 'err'];
  console.log(cols.join('\t'));
  for (const r of rows) console.log(cols.map(c => r[c] === undefined ? '' : r[c]).join('\t'));
})();
