// FLATS CHART WITH TRACKS (2026-09-16, the flats push). The estuary at a state of the tide
// (the game's own tide layer), the passages labelled, HIS laps in white/yellow and any
// bot tracks from a _fl_census JSON in colour by nerve (1 blue, 2 green, 3 red; a red dot
// where a track was aground). Scratch instrument for reading the census.
//   node _fl_chart.js out.png <t> [census.json] [seed] [name,name...]   laps from traj/
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const OUT = process.argv[2] || '/tmp/flats.png';
const T = +(process.argv[3] || 8);
const CENSUS = process.argv[4] && process.argv[4] !== '-' ? JSON.parse(fs.readFileSync(path.join(__dirname, process.argv[4]), 'utf8')) : [];
const SEED = process.argv[5] ? +process.argv[5] : null;
const NAMES = process.argv[6] ? process.argv[6].split(',') : null;
const laps = fs.readdirSync(path.join(__dirname, 'traj')).filter(f => f.startsWith('traj_flats_')).map(f => JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8')));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); window.evalHarness.seed = 1; resetGame(); startRace(); });
  await page.waitForFunction(() => state.course && state.tide, null, { timeout: 60000 });
  const bots = CENSUS.filter(b => (SEED == null || b.seed === SEED) && (!NAMES || NAMES.includes(b.name)));
  const dataUrl = await page.evaluate(({ t, laps, bots }) => {
    const doc = state.course.doc; const bb = doc.world.boundary.poly;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of bb) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const k = 0.12; const cv = document.createElement('canvas');
    cv.width = Math.ceil((x1 - x0) * k); cv.height = Math.ceil((y1 - y0) * k);
    const g = cv.getContext('2d'); g.fillStyle = '#3a6394'; g.fillRect(0, 0, cv.width, cv.height);
    g.save(); g.scale(k, k); g.translate(-x0, -y0);
    state.race.status = 'racing'; state.race.timer = t;
    const P = Tide._pic; if (P) { P.cvWet = null; P.cvDry = null; P.level = NaN; }
    window.__TIDE = { pxU: 12 }; Tide.drawWet(g);
    for (const isl of state.course.islands) { if (isl.kind !== 'flats-marsh' || isl.hidden) continue; g.beginPath(); const v = isl.vertices; g.moveTo(v[0].x, v[0].y); for (let i = 1; i < v.length; i++) g.lineTo(v[i].x, v[i].y); g.closePath(); g.fillStyle = '#8f8f52'; g.fill('evenodd'); }
    Tide.drawDry(g); window.__TIDE = null;
    const dmc = state.course.dmc;
    if (dmc) { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 10; g.setLineDash([60, 40]); g.beginPath(); for (const L of dmc.legs) for (let i = 0; i < L.pts.length; i++) { const p = L.pts[i]; if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); } g.stroke(); g.setLineDash([]); }
    for (const p of (doc.tide.passages || [])) { g.strokeStyle = 'rgba(255,0,255,0.8)'; g.lineWidth = 14; g.beginPath(); p.pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); const m = p.pts[p.pts.length >> 1]; g.fillStyle = '#ff00ff'; g.font = 'bold 160px sans-serif'; g.fillText(`${p.id}(r${p.risk})`, m[0] + 80, m[1]); }
    for (const m of state.course.marks) { g.beginPath(); g.arc(m.x, m.y, 60, 0, 6.283); g.fillStyle = '#ef4444'; g.fill(); }
    const cols = ['#ffffff', '#ffee55', '#ffbb00'];
    laps.forEach((lap, li) => { const F = lap.format, I = {}; F.forEach((k2, i) => I[k2] = i); g.strokeStyle = cols[li % 3]; g.lineWidth = 18; g.beginPath(); let first = true; for (const s of lap.samples) { if (s[I.phase] !== 1) continue; if (first) { g.moveTo(s[I.x], s[I.y]); first = false; } else g.lineTo(s[I.x], s[I.y]); } g.stroke(); });
    const nc = { 1: '#2266ff', 2: '#22cc44', 3: '#ff2222', 0: '#888' };
    for (const b of bots) { g.strokeStyle = nc[b.nerve] || '#888'; g.lineWidth = 12; g.beginPath(); b.trk.forEach((s, i) => i ? g.lineTo(s[1], s[2]) : g.moveTo(s[1], s[2])); g.stroke(); for (const s of b.trk) if (s[3]) { g.beginPath(); g.arc(s[1], s[2], 50, 0, 6.283); g.fillStyle = '#ff0000'; g.fill(); } const s0 = b.trk[b.trk.length - 1]; if (s0) { g.fillStyle = nc[b.nerve]; g.font = 'bold 140px sans-serif'; g.fillText(`${b.name} ${b.fin || 'DNF'}`, s0[1] + 60, s0[2]); } }
    // y rulers every 2000u
    g.fillStyle = '#000'; g.font = 'bold 150px sans-serif'; for (let y = -10000; y <= 6000; y += 2000) g.fillText(`y=${y}`, x0 + 50, y);
    g.restore();
    g.fillStyle = '#fff'; g.font = 'bold 24px sans-serif'; g.fillText(`t=${t}s level ${Tide.levelAt(t).toFixed(2)} m`, 20, 40);
    return cv.toDataURL('image/png');
  }, { t: T, laps, bots });
  fs.writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', OUT, 'bots', bots.length, 'laps', laps.length);
  await browser.close();
})();
