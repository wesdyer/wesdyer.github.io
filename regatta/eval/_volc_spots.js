// Probe: where Emberfall's animals can live near the racing lines — shore points (land edge, water
// beside it) 120-500 u from Wes's recorded lines, grouped by island; vents and their distance to the
// lines; open water on the lines for booby feeding patches. Prints candidates.
//   node regatta/eval/_volc_spots.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const tr = [].concat(...fs.readdirSync('regatta/eval/rl/traj').filter(f => /volcanic/.test(f)).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f))).map(j => j.samples.filter(s => s[1] === 1 && s[8] !== undefined).filter((_, i) => i % 3 === 0).map(s => [s[2], s[3]])));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate((tr) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
    const dl = (x, y) => { let m = 1e9; for (const [a, c] of tr) { const d = (a - x) ** 2 + (c - y) ** 2; if (d < m) m = d; } return Math.round(Math.sqrt(m)); };
    const out = { shore: [], vents: [], water: [] };
    for (const s of state.course.islands) { if (s.awash || !VenueDoc.traits(s).hard || (s.id || '').endsWith('.hit')) continue;
      const pts = []; const V = s.vertices; for (let i = 0; i < V.length; i += Math.max(1, Math.floor(V.length / 40))) { const v = V[i], d = dl(v.x, v.y); if (d > 120 && d < 500) pts.push([Math.round(v.x), Math.round(v.y), d]); }
      if (pts.length) out.shore.push([s.id, s.kind, pts.length, JSON.stringify(pts.slice(0, 6))]); }
    for (const pr of state.course.props) if (/vent/.test(pr.kind)) out.vents.push([pr.id, Math.round(pr.x), Math.round(pr.y), dl(pr.x, pr.y)]);
    return out; }, tr);
  for (const s of r.shore) console.log('shore', s.join('  ')); for (const v of r.vents) console.log('vent', v.join('  ')); await b.close(); })();
