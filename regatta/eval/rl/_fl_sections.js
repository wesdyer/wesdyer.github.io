// ESTUARY SECTION SPLITS (flats push): the time each boat first crosses a set of y-lines up
// the estuary (the course runs north = decreasing y), for his laps (traj/) and for the
// boats of a _fl_census JSON (2 Hz tracks), optionally filtered to wantij takers. Sections:
// gun→line(5950) | →throat(4300) | →traverse(150: wantij exit) | →west bend(−2000) |
// →head entry(−4500) | →head exit(−7000) | →delta(−9000) | →finish(−10750).
//   node _fl_sections.js <census.json> [takersOnly=1]
const fs = require('fs'); const path = require('path');
const YS = [5950, 4300, 150, -2000, -4500, -7000, -9000, -10750];
const NAMES = ['line', 'throat', 'traverse', 'westbend', 'headin', 'headout', 'delta', 'finish'];
const cross = (pts) => { const out = []; let k = 0; for (const [t, x, y] of pts) { while (k < YS.length && y <= YS[k]) { out.push(t); k++; } } while (out.length < YS.length) out.push(null); return out; };
const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const mean = a => { const s = a.filter(v => v != null); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const rows = { his: [], bots: [] };
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(f => f.startsWith('traj_flats_'))) {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8')); const F = j.format, I = {}; F.forEach((k, i) => I[k] = i);
  const pts = j.samples.filter(s => s[I.phase] === 1).map(s => [s[I.t], s[I.x], s[I.y]]);
  rows.his.push(cross(pts));
}
const J = JSON.parse(fs.readFileSync(path.join(__dirname, process.argv[2]), 'utf8'));
const takersOnly = process.argv[3] === '1';
for (const b of J) { if (!b.fin) continue; if (takersOnly && !b.segs.some(s => s.id === 'wantij' && s.t1 - s.t0 >= 4)) continue; rows.bots.push(cross(b.trk.map(s => [s[0], s[1], s[2]]))); }
console.log(`his n=${rows.his.length}, bots n=${rows.bots.length}${takersOnly ? ' (wantij takers)' : ''}`);
console.log('section'.padEnd(12) + 'his med'.padStart(9) + 'bot med'.padStart(9) + 'Δmed'.padStart(7) + '   his mean  bot mean  Δmean');
let prevH = 0, prevB = 0;
for (let k = 0; k < YS.length; k++) {
  const hs = rows.his.map(r => r[k]), bs = rows.bots.map(r => r[k]);
  const hSeg = rows.his.map((r, i) => r[k] != null ? r[k] - (k ? r[k - 1] : 0) : null), bSeg = rows.bots.map((r, i) => r[k] != null && (k === 0 || r[k - 1] != null) ? r[k] - (k ? r[k - 1] : 0) : null);
  console.log(`${NAMES[k].padEnd(12)}${(med(hSeg) || 0).toFixed(1).padStart(9)}${(med(bSeg) || 0).toFixed(1).padStart(9)}${((med(bSeg) || 0) - (med(hSeg) || 0)).toFixed(1).padStart(7)}   ${(mean(hSeg) || 0).toFixed(1).padStart(8)}  ${(mean(bSeg) || 0).toFixed(1).padStart(8)}  ${((mean(bSeg) || 0) - (mean(hSeg) || 0)).toFixed(1).padStart(5)}   (cum his ${(med(hs) || 0).toFixed(0)} bot ${(med(bs) || 0).toFixed(0)})`);
}
